var spider = require('./spider');

GLOBAL.appConfig = {
    "database": {
        "host": null,
        "username": null,
        "password": null,
        "settings": {
            "dialect": "sqlite",
            "storage": "",
            "logging": function(){}
        }
    }
};

var parseArgs = function(){
    for(var i=2; i < process.argv.length - 1; i++){
        switch(process.argv[i]){
            case '--crawlDbFile':
                GLOBAL.appConfig.database.settings.storage = process.argv[i + 1];
                i++;
                break;
            default:
                
                break;
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
    
var logMessage = function(errorLvl, url, msg){
    errorLvl = errorLvl || "ERROR";
    console.log(strFormat("{0}\t{1}\t{2}\t", errorLvl, url, msg));
};

var rtest = function(){
    _.bindAll(this, 'assert', 'assertEqual', 'assertNotEqual', 'success', 'fail');
};

rtest.prototype = {
    assert: function(truthTest, msg, errorLvl){
        if(!truthTest){
            logMessage(errorLvl, this.url, msg);
        }
    },
    
    assertEqual: function(expected, actual, msg, errorLvl){
        if(expected !== actual){
            logMessage(errorLvl, this.url, msg);
        }
    },
    
    assertNotEqual: function(notExpected, actual, msg, errorLvl){
        if(notExpected === actual){
            logMessage(errorLvl, this.url, msg);
        }
    },
    
    success: function(msg){
        logMessage("SUCCESS", this.url, msg);
    },
    
    fail: function(msg, errorLvl){
        logMessage(errorLvl, this.url, msg);
    }
};