var targetmaker = require('../lib/targetmaker');
var should = require('should');

describe('targetmaker', function () {
    describe('parseOid', function () {
        it('should parse an OID', function () {
            targetmaker.parseOid('.1.2.3.44.66.99.0.0').should.eql([1, 2, 3, 44, 66, 99, 0, 0]);
        });
    });
});

