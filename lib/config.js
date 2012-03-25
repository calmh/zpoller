var _ = require('underscore');
var fs = require('fs');
var glob = require('glob');
var path = require('path');
var util = require('util');
var yaml = require('js-yaml');

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
