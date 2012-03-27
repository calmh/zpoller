var _ = require('underscore');
var csv = require('csv');
var fs = require('fs');
var glob = require('glob');
var path = require('path');
var util = require('util');
var yaml = require('js-yaml');

var initComplete = false;
var initCallbacks = [];

load();

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
    initCallbacks = [];
}

function load(extraExtension) {
    initComplete = false;

    var matches = glob.sync("conf/*.yml" + (extraExtension || ''));
    _.each(matches, function (filename) {
        var shortname = path.basename(filename, '.yml' + (extraExtension || ''));
        var data = fs.readFileSync(filename).toString();
        try {
            exports[shortname] = yaml.load(data);
        } catch (err) {
            console.log('In ' + filename + ':');
            console.log(err.stack || err.toString());
            process.exit();
        }
    });

    matches = glob.sync("conf/*.csv" + (extraExtension || ''));
    var count = matches.length;
    _.each(matches, function (filename) {
        var shortname = path.basename(filename, '.csv' + (extraExtension || ''));
        var data = fs.readFileSync(filename).toString();

        exports[shortname] = [];
        csv().from(data).transform(function (data) {
            if (data[0][0] === '#') {
                return null;
            } else {
                return data;
            }
        }).on('data', function (l) {
            exports[shortname].push(l);
        }).on('end', function () {
            if (--count === 0) {
                complete();
            }
        });
    });
}
exports.load = load;

