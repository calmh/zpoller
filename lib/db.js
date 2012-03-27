var config = require('./config');
var mongodb = require('mongodb');
var q = require('promised-io');

var serverOptions = {
    'auto_reconnect': true,
    'poolSize': 5
};

exports.pooledClient = null;
function pooled(error, client) {
    exports.pooledClient = client;
    complete();
};

config.ready(function () {
    var server, client;
    server = new mongodb.Server(config.general.database.host, config.general.database.port, serverOptions);
    client = new mongodb.Db(config.general.database.name, server);
    client.open(pooled);
});

var initComplete = false;
var initCallbacks = [];

function ready(callback) {
    if (initComplete) {
        return callback();
    } else {
        initCallbacks.push(callback);
    }
}
exports.ready = ready;

function complete() {
    initComplete = true;
    initCallbacks.forEach(function (cb) {
        process.nextTick(cb);
    });
}

var collectionCache = {};
function collection(name, callback) {
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
exports.collection = collection;

function close() {
    exports.pooledClient.close();
}
exports.close = close;

