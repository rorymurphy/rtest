var rtest = require('./rtest');
module.exports = [
    rtest.test("Not an error code", function(assert, resp){
        assert.isTrue(resp.statusCode < 400, 'URL returned a status code ' + resp.statusCode);
    }),
    
    rtest.test("Optimize with 1 CSS file", function(assert, r){
       assert.areEqual(1, resp.$('link[type="text/css"]').length, "More than one stylesheet found", "WARN"); 
    })
];

