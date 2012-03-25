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
});
