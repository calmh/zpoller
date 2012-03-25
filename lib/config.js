var fs = require('fs');
var yaml = require('yaml-js');

function loadYAML(filename) {
    try {
        return yaml.load(fs.readFileSync(filename).toString());
    } catch (err) {
        console.error('Parse error opening ' + filename + ':');
        throw err;
    }
};

exports.general = loadYAML(__dirname + '/../conf/general.yml');


