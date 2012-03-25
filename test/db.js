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
});
