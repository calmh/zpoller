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
