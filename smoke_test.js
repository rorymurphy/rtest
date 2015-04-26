var rtest = require('./rtest');
var filecount = 0;
module.exports = [
    rtest.test("Not an error code", function(assert, response){
        var referrer = response.referrers.length > 0 ? response.referrers[0] : 'NONE';
        assert.isTrue(response.statusCode < 400, 'URL returned a status code ' + response.statusCode + ", referred to by " + referrer);
    }),

    rtest.test("Optimize with 1 CSS file", function(assert, response){
        if(response.$){
            assert.areEqual(1, response.$('link[type="text/css"]').length, "More than one stylesheet found", "WARN");
        }
    })
];
