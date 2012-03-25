require('should');

var config = require('../lib/config');

describe('config', function(){
  describe('general', function(){
    it('should exist', function(){
      config.should.have.property('general');
    });
    it('should have database config', function(){
      config.general.should.have.property('database');
    });
    it('should have reasonable default values', function(){
      config.general.database.host.should.equal('localhost');
      config.general.database.port.should.equal(27017);
      config.general.database.name.should.equal('zpoller');
      config.general.database.should.not.have.property('username');
      config.general.database.should.not.have.property('password');
    });
  });
});

