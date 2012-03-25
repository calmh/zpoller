var _ = require('underscore');
var csv = require('csv');
var fs = require('fs');
var glob = require('glob');
var path = require('path');
var util = require('util');
var yaml = require('js-yaml');
var q = require('promised-io');

var matches = glob.sync("conf/*.yml");
_.each(matches, function (filename) {
    var shortname = path.basename(filename, '.yml');
    var data = fs.readFileSync(filename).toString();
    try {
        exports[shortname] = yaml.load(data);
    } catch (err) {
        console.log('In ' + filename + ':');
        console.log(err.stack || err.toString());
        process.exit();
    }
});

var promises = [];

matches = glob.sync("conf/*.csv");
_.each(matches, function (filename) {
    var d = q.defer();
    var shortname = path.basename(filename, '.csv');
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

exports._complete = q.all(promises);

