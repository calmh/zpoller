var targetmaker = require('../lib/targetmaker');
var tm = targetmaker.unittest;
var should = require('should');

describe('targetmaker', function () {
    describe('parseOid', function () {
        it('should parse an OID', function () {
            tm.parseOid('.1.2.3.44.66.99.0.0').should.eql([1, 2, 3, 44, 66, 99, 0, 0]);
        });
    });

    describe('evaluateFilter', function () {
        it('should throw an exception for mismatching types', function () {
            (function () {
                tm.evaluateFilter("42", '==', 42);
            }).should.throw(/^Mismatching types/);
        });
        it('should throw an exception for unknown operation', function () {
            (function () {
                tm.evaluateFilter(42, '~', 42);
            }).should.throw(/^Unknown operation/);
        });
        it('should evaluate a == expression', function () {
            tm.evaluateFilter(42, '==', 42).should.be.true;
            tm.evaluateFilter(38, '==', 42).should.be.false;
        });
        it('should evaluate a > expression', function () {
            tm.evaluateFilter(42, '>', 42).should.be.false;
            tm.evaluateFilter(38, '>', 42).should.be.false;
            tm.evaluateFilter(42, '>', 38).should.be.true;
        });
        it('should evaluate a < expression', function () {
            tm.evaluateFilter(42, '<', 42).should.be.false;
            tm.evaluateFilter(38, '<', 42).should.be.true;
            tm.evaluateFilter(42, '<', 38).should.be.false;
        });
        it('should evaluate a != expression', function () {
            tm.evaluateFilter(42, '!=', 42).should.be.false;
            tm.evaluateFilter(38, '!=', 42).should.be.true;
        });
    });

    describe('evaluateFilters', function () {
        it('should return true for empty filter list', function () {
            tm.evaluateFilters({}, []).should.be.true;
        });
        it('should return true for no relevant filters', function () {
            var values = { '.1.2.3.4.5.10': 42 };
            var filters = [ { oid: '.4.5.6.7.8', op: '!=', rhs: 42 } ];
            tm.evaluateFilters(values, filters).should.be.true;
        });
        it('should return false for one failing test', function () {
            var values = { '.1.2.3.4.5.10': 42 };
            var filters = [ { oid: '.1.2.3.4.5', op: '!=', rhs: 42 } ];
            tm.evaluateFilters(values, filters).should.be.false;
        });
        it('should return false for one failing test and one true', function () {
            var values = { '.1.2.3.4.5.10': 42,
                '.1.2.3.4.6.10': 42 };
            var filters = [ { oid: '.1.2.3.4.5', op: '!=', rhs: 42 },
                { oid: '.1.2.3.4.6', op: '==', rhs: 42 } ];
            tm.evaluateFilters(values, filters).should.be.false;
        });
        it('should return true for to successfull tests', function () {
            var values = { '.1.2.3.4.5.10': 38,
                '.1.2.3.4.6.10': 42 };
            var filters = [ { oid: '.1.2.3.4.5', op: '!=', rhs: 42 },
                { oid: '.1.2.3.4.6', op: '==', rhs: 42 } ];
            tm.evaluateFilters(values, filters).should.be.true;
        });
    });
});

