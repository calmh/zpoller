var Log = require('log'), log = new Log('info', process.stderr);
var _ = require('underscore');
var fs = require('fs');
var q = require('promised-io');
var snmp = require('snmp-native');
var util = require('util');

function parseOid(str) {
    return _.map(_.compact(str.split('.')), function (s) { return parseInt(s, 10); });
}
exports.parseOid = parseOid;

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

function getFilterResult(conn, index, filters) {
    var oids, oidFs, tables, deferred = q.defer();

    oids = [];
    oidFs = {};
    _.each(filters, function (filter) {
        oids.push(parseOid(filter.oid).concat(index));
        oidFs[filter.oid] = filter;
    });

    conn.getAll(oids, function (error, data) {
        var resolved = false;
        if (error) {
            //return deferred.reject(error);
            return deferred.resolve(false);
        }
        _.each(data, function (vb) {
            var oidStr, eoidStr, thisTable;

            if (!resolved && !_.isUndefined(vb)) {
                var fop, dval;
                oidStr = '.' + vb.oid.slice(0, vb.oid.length - index.length).join('.');
                fop = oidFs[oidStr].op;
                fval  = oidFs[oidStr].rhs;

                if (fop === '==' && fval !== vb.value) {
                    deferred.resolve(false);
                    resolved = true;
                    return;
                }

                if (fop === '!=' && fval === vb.value) {
                    deferred.resolve(false);
                    resolved = true;
                    return;
                }

                if (fop === '>' && fval > vb.value) {
                    deferred.resolve(false);
                    resolved = true;
                    return;
                }

                if (fop === '<' && fval < vb.value) {
                    deferred.resolve(false);
                    resolved = true;
                    return;
                }
            }
        });

        if (!resolved) {
            deferred.resolve(true);
        }
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
            //d.reject(error);
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
            //return deferred.reject(error);
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

