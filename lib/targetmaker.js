var _ = require('underscore');
var fs = require('fs');
var q = require('promised-io');
var snmp = require('snmp-native');
var util = require('util');

// Methods exported for testing only.
exports.unittest = {};

function parseOid(str) {
    return _.map(_.compact(str.split('.')), function (s) { return parseInt(s, 10); });
}
exports.unittest.parseOid = parseOid;

function getCandidateOIDs(conn, index, collect) {
    var oids, tableNames, seenTables, tables, deferred = q.defer();

    seenTables = {};
    tables = [];
    oids = [];
    tableNames = {};
    _.each(collect, function (coll) {
        oids.push(parseOid(coll.oid).concat(index));
        tableNames[coll.oid] = coll.table;
    });

    conn.getAll(oids, function (error, data) {
        if (error) {
            return deferred.resolve(tables);
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

        deferred.resolve(tables);
    });

    return deferred.promise;
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

function getFilterResult(conn, index, filters) {
    var oids, oidFs, tables, deferred = q.defer();

    oids = _.map(filters, function (filter) {
        return parseOid(filter.oid).concat(index);
    });

    conn.getAll(oids, function (error, data) {
        var values = {}, result;
        if (error) {
            return deferred.resolve(false);
        }

        _.each(data, function (vb) {
            var oidStr = '.' + vb.oid.join('.');
            values[oidStr] = vb.value;
        });

        result = evaluateFilters(values, filters);

        deferred.resolve(result);
    });

    return deferred.promise;
}

function getMetadata(conn, index, meta) {
    var d = q.defer();
    var result = {};
    var oids = [];
    var fields = {};

    _.each(meta, function (oid, field) {
        var fullOid = parseOid(oid).concat(index);
        oids.push(fullOid);

        var oidStr = '.' + fullOid.join('.');
        fields[oidStr] = field;
    });

    conn.getAll(oids, function (error, data) {
        if (error) {
            d.resolve(result);
        } else {
            _.each(data, function (vb) {
                var oidStr = '.' + vb.oid.join('.');
                result[fields[oidStr]] = vb.value;
            });
            d.resolve(result);
        }
    });

    return d.promise;
}

function getPackage(conn, coll) {
    var indexOid, d = q.defer(), interfaces = {};
    var psubTree = _.bind(q.convertNodeAsyncFunction(conn.getSubtree), conn);

    indexOid = parseOid(coll.index);
    conn.getSubtree(indexOid, function (err, data) {
        if (err) {
            return d.resolve(interfaces);
        }

        function checkInterface(index) {
            var vb = data[index];
            var indexName = vb.value;
            var indexId = vb.oid.slice(indexOid.length, vb.oid.length);

            getFilterResult(conn, indexId, coll.filter).then(function (res) {
                var oids, meta;
                if (res) {
                    oids = getCandidateOIDs(conn, indexId, coll.collect);
                    meta = getMetadata(conn, indexId, coll.metadata);
                    return q.all(oids, meta);
                }
            }).then(function (arr) {
                var o, m;
                if (arr) {
                    o = arr[0];
                    m = arr[1];

                    _.each(o, function (t) {
                        t.intervals = coll.intervals;
                    });

                    interfaces[indexName] = { metadata: m, tables: o };
                }

                if (index < data.length - 1) {
                    checkInterface(index + 1);
                } else {
                    d.resolve(interfaces);
                }
            });
        }

        checkInterface(0);
    });

    return d.promise;
}

function getUptime(conn) {
    var d = q.defer();

    conn.get([1, 3, 6, 1, 2, 1, 1, 3, 0], function (err, data) {
        if (err) {
            return d.resolve(0);
        }

        return d.resolve(data.pdu.varbinds[0].value);
    });

    return d.promise;
}

function getUptimes(hosts) {
    var results = [];

    _.each(hosts, function (host) {
        var conn = new snmp.Session(host.ip, host.community);
        var uptime = getUptime(conn).then(function (u) {
            return { host: host.name, uptime: u };
        });
        results.push(uptime);
        uptime.then(function () {
            conn.close();
        });
    });

    return q.all(results);
}
exports.getUptimes = getUptimes;

exports.mapHosts = function mapHosts(hosts, collect) {
    var deferred = q.defer(), sessions = [];
    var interfaces = 0, tables = 0;
    var result = {};
    _.each(hosts, function (host) {
        var conn, hostSessions = [];
        result[host.name] = host;
        host.interfaces = {};

        conn = new snmp.Session(host.ip, host.community);

        var u = getUptime(conn);
        sessions.push(u);

        u.then(function (uptime) {
            host.uptimeWhenIndexed = uptime;
            host.indexed = Math.floor(Date.now() / 1000);
        });

        _.each(collect, function (coll) {
            var p = getPackage(conn, coll);
            sessions.push(p);
            hostSessions.push(p);

            p.then(function (ifs) {
                _.each(ifs, function (i, iname) {
                    if (!result[host.name].interfaces[iname]) {
                        result[host.name].interfaces[iname] = {
                            metadata: i.metadata,
                            tables: i.tables
                        };
                    } else {
                        _.extend(result[host.name].interfaces[iname].metadata, i.metadata);
                        result[host.name].interfaces[iname].tables.push.apply(result[host.name].interfaces[iname].tables, i.tables);
                    }
                });
            });
        });
        q.all(hostSessions).then(function () {
            conn.close();
        });
    });

    q.all(sessions).then(function () {
        deferred.resolve(_.values(result));
    });

    return deferred.promise;
}

