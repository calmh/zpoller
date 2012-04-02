var _ = require('underscore');
var Log = require('log'), log = new Log('debug', process.stderr);
var fs = require('fs');
var snmp = require('snmp-native');
var util = require('util');

// Methods exported for testing only.
exports.unittest = {};

function parseOid(str) {
    return _.map(_.compact(str.split('.')), function (s) { return parseInt(s, 10); });
}
exports.unittest.parseOid = parseOid;

function getCandidateOIDs(conn, index, collect, callback) {
    var oids, tableNames, seenTables, tables;

    seenTables = {};
    tables = [];
    oids = [];
    tableNames = {};
    _.each(collect, function (coll) {
        oids.push(parseOid(coll.oid).concat(index));
        tableNames[coll.oid] = coll.table;
    });

    conn.getAll({ oids: oids }, function (error, data) {
        if (error) {
            return callback(error);
        }
        _.each(data, function (vb) {
            var oidStr, eoidStr, thisTable;

            if (!_.isUndefined(vb)) {
                oidStr = '.' + vb.oid.slice(0, vb.oid.length - index.length).join('.');
                eoidStr = '.' + vb.oid.join('.');
                thisTable = tableNames[oidStr];
                if (!seenTables[thisTable]) {
                    seenTables[thisTable] = true;
                    tables.push({ table: thisTable, oid: eoidStr });
                }
            }
        });

        return callback(null, tables);
    });
}

function evaluateFilter(value, op, rhs) {
    if (typeof value !== typeof rhs) {
        throw new Error('Mismatching types: "' + typeof value + '" vs. "' + typeof rhs + '"');
    }

    if (op === '==') {
        return value === rhs;
    } else if (op === '>') {
        return value > rhs;
    } else if (op === '<') {
        return value < rhs;
    } else if (op === '!=') {
        return value !== rhs;
    }

    throw new Error('Unknown operation: "' + op + '"');
};
exports.unittest.evaluateFilter = evaluateFilter;

function evaluateFilters(values, filters) {
/*
    * values should be a hash of oid to value:
    * { '.1.2.3.4.5': 42, '.2.3.4.5.6': 23 }
    * filters should be the filter list from config, i.e.
    * [ { oid: '.1.2.3.4', op: '==', rhs: 43 }, ... ]
*/
    var result = _.all(filters, function (filter) {
        var value = _.find(values, function (val, oid) { return oid.indexOf(filter.oid) === 0; });
        return _.isUndefined(value) || evaluateFilter(value, filter.op, filter.rhs);
    });

    return result;
}
exports.unittest.evaluateFilters = evaluateFilters;

function getFilterResult(conn, index, filters, callback) {
    var oids, oidFs, tables;

    oids = _.map(filters, function (filter) {
        return parseOid(filter.oid).concat(index);
    });

    conn.getAll({ oids: oids }, function (error, data) {
        var values = {}, result;
        if (error) {
            callback(error);
        }

        _.each(data, function (vb) {
            var oidStr = '.' + vb.oid.join('.');
            values[oidStr] = vb.value;
        });

        result = evaluateFilters(values, filters);

        callback(null, result);
    });
}

function getMetadata(conn, index, meta, callback) {
    var result = {};
    var oids = [];
    var fields = {};

    _.each(meta, function (oid, field) {
        var fullOid = parseOid(oid).concat(index);
        oids.push(fullOid);

        var oidStr = '.' + fullOid.join('.');
        fields[oidStr] = field;
    });

    conn.getAll({ oids: oids }, function (error, data) {
        if (error) {
            return callback(null, result);
        } else {
            _.each(data, function (vb) {
                var oidStr = '.' + vb.oid.join('.');
                result[fields[oidStr]] = vb.value;
            });
            return callback(null, result);
        }
    });
}

function getPackage(conn, coll, callback) {
    var indexOid, interfaces = {};

    indexOid = parseOid(coll.index);
    conn.getSubtree({ oids: indexOid }, function (err, data) {
        function checkInterface(index) {
            var vb = data[index];
            var indexName = vb.value;
            var indexId = vb.oid.slice(indexOid.length, vb.oid.length);

            getFilterResult(conn, indexId, coll.filter, function (err, res) {
                var oids, meta;
                if (res) {
                    getCandidateOIDs(conn, indexId, coll.collect, continueMetadata);
                } else {
                    if (index < data.length - 1) {
                        checkInterface(index + 1);
                    } else {
                        callback(null, interfaces);
                    }
                }
            });

            function continueMetadata(error, oids) {
                getMetadata(conn, indexId, coll.metadata, function (err, meta) {
                    continue2(err, oids, meta);
                });
            }

            function continue2(err, oids, meta) {
                _.each(oids, function (oid) {
                    oid.intervals = coll.intervals.join('-');
                });

                interfaces[indexName] = { metadata: meta, tables: oids };

                if (index < data.length - 1) {
                    checkInterface(index + 1);
                } else {
                    callback(null, interfaces);
                }
            }
        }

        return checkInterface(0);
    });
}

function getUptime(conn, callback) {
    conn.get({ oid: [1, 3, 6, 1, 2, 1, 1, 3, 0] }, function (err, data) {
        if (err) {
            return callback(null, 0);
        }

        return callback(null, data.pdu.varbinds[0].value);
    });
}

function indexHost(host, collect, cb) {
    var conn, hostSessions = [];
    host.interfaces = {};

    conn = new snmp.Session({ host: host.ip, community: host.community });

    getUptime(conn, function (error, uptime) {
        host.uptimeWhenIndexed = uptime;
        host.indexed = Math.floor(Date.now() / 1000);

        var count = collect.length;
        _.each(collect, function (coll) {
            if (!host.name.match(new RegExp(coll.hosts))) {
                count--;
                return;
            }

            getPackage(conn, coll, function (err, ifs) {
                if (err) {
                    log.warning('Error indexing ' + host.name);
                    log.warning(error.message);
                    if (--count === 0) {
                        cb(null, host);
                    }
                } else {
                    _.each(ifs, function (i, iname) {
                        if (!host.interfaces[iname]) {
                            host.interfaces[iname] = {
                                name: iname,
                                metadata: i.metadata,
                                tables: i.tables
                            };
                        } else {
                            _.extend(host.interfaces[iname].metadata, i.metadata);
                            host.interfaces[iname].tables.push.apply(host.interfaces[iname].tables, i.tables);
                        }
                    });
                    if (--count === 0) {
                        host.interfaces = _.sortBy(_.values(host.interfaces), function (v) { return v.name; });;
                        cb(null, host);
                    }
                }
            });
        });
    });
}
exports.indexHost = indexHost;

