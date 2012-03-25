var db = require('../lib/db');
var should = require('should');

describe('db', function () {
    describe('client', function () {
        it('should produce a client', function(done) {
            db.client(function (err, client) {
                should.exist(client);
                done();
            });
        });
    });

    describe('insert', function () {
        it('should return a promise of a doc', function(done) {
            db.client(function (err, c) {
                should.exist(db.insert(c, 'test-collection', {foo: 'bar'}));
                done();
            });
        });
        it('should fulfil the promise of a doc after insert', function(done) {
            db.client(function (err, c) {
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
            db.client(function (err, c) {
                should.exist(db.update(c, 'test-collection', {foo: 'bar'}));
                done();
            });
        });
        it('should fulfil the promise of a doc after update', function(done) {
            db.client(function (err, c) {
                db.update(c, 'test-collection', {foo: 'bar'}, {foo: { $set: 'baz' }}).then(function (status) {
                    status.should.be.true;
                    done();
                });
            });
        });
    });

    describe('find', function () {
        it('should return a promise of a doc', function(done) {
            db.client(function (err, c) {
                should.exist(db.find(c, 'test-collection', {foo: 'bar'}));
                done();
            });
        });
        it('should fulfil the promise of a doc after find', function(done) {
            db.client(function (err, c) {
                db.update(c, 'test-collection', {a: 'a'}, { a: 'a', b: 'b' }).then (function () {
                    db.find(c, 'test-collection', {a: 'a'}).then(function (docs) {
                        should.exist(docs);
                        docs.should.have.length(1);
                        docs[0].a.should.equal('a');
                        docs[0].b.should.equal('b');
                        done();
                    });
                });
            });
        });
    });
});
