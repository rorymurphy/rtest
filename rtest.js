var q = require('querystring'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        Promise = require('promise');

var assert = function(name, url){
    this.name = name;
    this.url = url;
    _.bindAll(this, 'isTrue', 'areEqual', 'areNotEqual', 'success', 'failure');
};

assert.prototype = {
    isTrue: function(truthTest, msg, errorLvl){
        if(!truthTest){
            rtest.logMessage(errorLvl, this.url, msg);
        }
    },

    areEqual: function(expected, actual, msg, errorLvl){
        if(expected !== actual){
            rtest.logMessage(errorLvl, this.url, msg);
        }
    },

    areNotEqual: function(notExpected, actual, msg, errorLvl){
        if(notExpected === actual){
            rtest.logMessage(errorLvl, this.url, msg);
        }
    },

    success: function(msg){
        rtest.logMessage("SUCCESS", this.url, msg);
    },

    failure: function(msg, errorLvl){
        rtest.logMessage(errorLvl, this.url, msg);
    }
};


var testInternal = function(name, callback){
    this.name = name;
    this.callback = callback;
    _.bindAll(this, 'callback');
}
testInternal.prototype = {
    execute: function(response){
       var a = new assert(this.name, response.url);
       this.callback(a, response);
    }
};

var rtest = {

    logLevels: {
        FATAL : 0,
        ERROR : 10,
        WARN : 20,
        SUCCESS: 30,
        DEBUG : 40,
        INFO : 50
    },

    test: function( name, callback ){
        return new testInternal(name, callback);
    },

    logMessage: function(errorLvl, url, msg){
        errorLvl = errorLvl || "ERROR";
        if(rtest.logLevels[errorLvl] <= rtest.logLevels[GLOBAL.appConfig.logLevel]){
          GLOBAL.appConfig.stdout(strFormat("{0}\t{1}\t{2}\n", errorLvl, url, msg));
        }
    }
};

//Provides string formatting using the "{0} is the first value in the array parameter" syntax
var strFormat = function(formatString){
    var args = arguments;
    formatString = formatString.replace(/\{(\d+)\}/ig, function(match, p1, offset, s){
        return args[parseInt(p1) + 1];
    });
    return formatString;
};

var tests = [];

module.exports = rtest;
