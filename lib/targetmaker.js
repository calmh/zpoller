var Log = require('log'), log = new Log('info', process.stderr);
var _ = require('underscore');
var fs = require('fs');
var q = require('promised-io');
var snmp = require('snmp-native');
var util = require('util');

// Exported methods for testing only.
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
            //return deferred.reject(error);
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
                    tables.push({table: thisTable, oid: eoidStr});
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

function getCollect(conn, coll) {
    var indexOid, deferred = q.defer(), interfaces = {};

    indexOid = parseOid(coll.index);
    conn.getSubtree(indexOid, function (error, data) {
        if (error) {
            return deferred.resolve(interfaces);
        }

        function checkInterface(index) {
            var vb = data[index];
            var ifName = vb.value;
            var eoid, fres;

            eoid = vb.oid;
            eoid = eoid.slice(indexOid.length, eoid.length);
            fres = getFilterResult(conn, eoid, coll.filter);
            fres.then(function (res) {
                var oids;
                if (res) {
                    oids = getCandidateOIDs(conn, eoid, coll.collect);
                    oids.then(function (o) {
                        var meta = getMetadata(conn, eoid, coll.metadata);
                        meta.then(function (m) {
                            interfaces[ifName] = { metadata: m, tables: o };
                            if (index < data.length - 1) {
                                checkInterface(index + 1);
                            } else {
                                deferred.resolve(interfaces);
                            }
                        });
                    });
                } else {
                    if (index < data.length - 1) {
                        checkInterface(index + 1);
                    } else {
                        deferred.resolve(interfaces);
                    }
                }
            });
        }

        checkInterface(0);
    });

    return deferred.promise;
}

exports.mapHosts = function mapHosts(hosts, collect) {
    var deferred = q.defer(), sessions = [];
    var interfaces = 0, tables = 0;
    var result = {};
    log.info('mapHosts: Finding targets on ' + hosts.length + ' hosts.');
    _.each(hosts, function (host) {
        var conn, hostSessions = [];
        host.interfaces = {};

        conn = new snmp.Session(host.ip, host.community);
        _.each(collect, function (coll) {
            var p = getCollect(conn, coll);
            p.then(function (ifs) {
                _.extend(host.interfaces, ifs);
                interfaces += _.size(host.interfaces);
                _.each(host.interfaces, function (intf) {
                    tables += _.size(intf.tables);
                });
                result[host.name] = host;
            });
            sessions.push(p);
            hostSessions.push(p);
        });
        q.all(hostSessions).then(function () {
            conn.close();
        });

    });

    q.all(sessions).then(function () {
        deferred.resolve(result);
        log.info('mapHosts: Found a total of ' + interfaces +' interfaces and ' + tables + ' tables.');
    });

    return deferred.promise;
}

