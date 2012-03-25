var db = require('../lib/db');
var should = require('should');

describe('db', function () {
    describe('client', function () {
        it('should return a promise of a client', function() {
            should.exist(db.client());
        });
        it('should fulfil the promise of a client', function(done) {
            var c = db.client();
            c.then(function (client) {
                should.exist(client);
                done();
            });
        });
    });

    describe('insert', function () {
        it('should return a promise of a doc', function(done) {
            db.client().then(function (c) {
                should.exist(db.insert(c, 'test-collection', {foo: 'bar'}));
                done();
            });
        });
        it('should fulfil the promise of a doc after insert', function(done) {
            db.client().then(function (c) {
                db.insert(c, 'test-collection', {foo: 'bar'}).then(function (docs) {
                    docs.should.have.length(1);
                    docs[0].should.have.property('foo');
                    docs[0].should.have.property('_id');
                    docs[0].foo.should.equal('bar');
                    done();
                });
            });
        });
    });

    describe('update', function () {
        it('should return a promise of a doc', function(done) {
            db.client().then(function (c) {
                should.exist(db.update(c, 'test-collection', {foo: 'bar'}));
                done();
            });
        });
        it('should fulfil the promise of a doc after update', function(done) {
            db.client().then(function (c) {
                db.update(c, 'test-collection', {foo: 'bar'}, {foo: { $set: 'baz' }}).then(function (status) {
                    status.should.be.true;
                    done();
                });
            });
        });
    });
});
