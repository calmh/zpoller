var config = require('./config');
var mongodb = require('mongodb');
var q = require('promised-io');

exports.client = function () {
    var server, client, d;
    d = q.defer();

    // FIXME: Support authentication
    server = new mongodb.Server(config.general.database.host, config.general.database.port, {});
    client = new mongodb.Db(config.general.database.name, server);
    client.open(function (err, client) {
        if (err) {
            d.reject(err);
        } else {
            d.resolve(client);
        }
    });

    return d.promise;
};
