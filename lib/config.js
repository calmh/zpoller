var _ = require('underscore');
var csv = require('csv');
var fs = require('fs');
var glob = require('glob');
var path = require('path');
var util = require('util');
var yaml = require('js-yaml');
var q = require('promised-io');

exports.load = function (cb, extraExtension) {
    var matches, promises;

    matches = glob.sync("conf/*.yml" + (extraExtension || ''));
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

    promises = [];
    matches = glob.sync("conf/*.csv" + (extraExtension || ''));
    _.each(matches, function (filename) {
        var d = q.defer();
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
            d.resolve(true);
        });

        promises.push(d.promise);
    });

    q.all(promises).then(function () {
        cb(undefined, exports);
    });
}

