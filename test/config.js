var config = require('../lib/config');
var should = require('should');

describe('config', function () {
    describe('general', function () {
        it('should exist', function () {
            config.should.have.property('general');
        });

        it('should have database config', function () {
            config.general.should.have.property('database');
        });

        it('should have reasonable default values', function () {
            config.general.database.host.should.equal('localhost');
            config.general.database.port.should.equal(27017);
            config.general.database.name.should.equal('zpoller');
            config.general.database.should.not.have.property('username');
            config.general.database.should.not.have.property('password');
        });
    });

    describe('packages', function () {
        it('should exist', function () {
            config.should.have.property('packages');
        });

        it('should have two packages', function () {
            config.packages.should.have.length(2)
        });

        it('package should have some values', function () {
            config.packages[0].hosts.should.equal('.');
            config.packages[0].index.should.equal('.1.3.6.1.2.1.31.1.1.1.1');
            config.packages[0].intervals.should.have.length(3);
            config.packages[0].intervals[0].should.equal(60);
            config.packages[0].filter.should.have.length(4);
            config.packages[0].collect.should.have.length(6);
            config.packages[0].metadata.should.have.length(3);
            config.packages[0].graphs.should.have.length(0);
        });

    });
});

