var config = require('./config');
var mongodb = require('mongodb');
var q = require('promised-io');

exports.client = function (cb) {
    var server, client;
    // FIXME: Support authentication
    server = new mongodb.Server(config.general.database.host, config.general.database.port, {});
    client = new mongodb.Db(config.general.database.name, server);
    client.open(cb);
};

exports.insert = function (client, colname, value) {
    var d;
    d = q.defer();

    client.collection(colname, function (err, col) {
        if (err) {
            d.reject(err);
        } else {
            col.insert(value, function (err, docs) {
                if (err) {
                    d.reject(err);
                } else {
                    d.resolve(docs);
                }
            });
        }
    });

    return d.promise;
};

exports.update = function (client, colname, query, value) {
    var d;
    d = q.defer();

    client.collection(colname, function (err, col) {
        if (err) {
            d.reject(err);
        } else {
            col.update(query, value, { upsert: true }, function (err) {
                if (err) {
                    d.reject(err);
                } else {
                    d.resolve(true);
                }
            });
        }
    });

    return d.promise;
};

exports.find = function (client, colname, query) {
    var d;
    d = q.defer();

    client.collection(colname, function (err, col) {
        if (err) {
            d.reject(err);
        } else {
            col.find(query).toArray(function (err, docs) {
                if (err) {
                    d.reject(err);
                } else {
                    d.resolve(docs);
                }
            });
        }
    });

    return d.promise;
};

