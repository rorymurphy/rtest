var rtest = require('./rtest');
module.exports = [
    rtest.test("Not an error code", function(assert, response){
        assert.isTrue(response.statusCode < 400, 'URL returned a status code ' + response.statusCode);
    }),
    
    rtest.test("Optimize with 1 CSS file", function(assert, response){
       assert.areEqual(1, response.$('link[type="text/css"]').length, "More than one stylesheet found", "WARN"); 
    })
];

