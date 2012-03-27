var config = require('./config');
var mongodb = require('mongodb');
var q = require('promised-io');

var serverOptions = {
    'auto_reconnect': true,
    'poolSize': 5
};

exports.client = function (cb) {
    var server, client;
    // FIXME: Support authentication
    server = new mongodb.Server(config.general.database.host, config.general.database.port, {});
    client = new mongodb.Db(config.general.database.name, server);
    client.open(cb);
};

function pooled(error, client) {
    exports.pooledClient = client;
};

exports.pooledClient = null;
config.load(function () {
    var server, client;
    server = new mongodb.Server(config.general.database.host, config.general.database.port, serverOptions);
    client = new mongodb.Db(config.general.database.name, server);
    client.open(pooled);
});

var collectionCache = {};
exports.collection = function (name, callback) {
    if (!collectionCache[name]) {
        exports.pooledClient.collection(name, function (error, collection) {
            if (name.indexOf('host.') === 0) {
                collection.ensureIndex({ts: 1});
            }
            if (error) { throw error; };
            collectionCache[name] = collection;
            return callback(undefined, collection);
        });
    } else {
        return callback(undefined, collectionCache[name]);
    }
}

