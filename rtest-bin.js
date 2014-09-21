GLOBAL.appConfig = {
    database: {
        "host": null,
        "username": null,
        "password": null,
        "settings": {
            "dialect": "sqlite",
            "storage": "db.sqlite3",
            "logging": function(){}//console.log
        }
    }
};

var _ = require('underscore');
    
var options = {
    includeDomains: null,
    excludeDomains: null,
    urlFilter: null,

    depth: 9999,
    maxPages: null,

    crawlImages: true,
    crawlCss: true,
    crawlScripts: true,
    fetchTimeout: null,
    maxConnections: 50
};

var urls = [];
var testFiles = [];

var parseArgs = function(){
    for(var i=2; i < process.argv.length; i++){
        switch(process.argv[i]){
            case '--crawlDbFile':
            case '-db':
                GLOBAL.appConfig.database.settings.storage = process.argv[i + 1];
                i++;
                break;
            case '--includeDomain':
            case '-i':
                options.includeDomains = options.includeDomains || [];
                options.includeDomains.push( process.argv[i + 1] );
                i++;
                break;
            case '--excludeDomain':
            case '-x':
                options.excludeDomains = options.excludeDomains || [];
                options.excludeDomains.push( process.argv[i + 1] );
                i++;
                break;
            case '--depth':
            case '-d':
                options.depth = parseInt(process.argv[i + 1]);
                i++;
                break;
            case '--maxPages':
            case '-m':
                options.maxPages = parseInt(process.argv[i + 1]);
                i++;
                break;
            case '--noImages':
                options.crawlImages = false;
                break;
            case '--noCss':
                options.crawlCss = false;
                break;
            case '--noScripts':
                options.crawlCss = false;
                break;
            case '--fetchTimeout':
                options.fetchTimeout = parseInt(process.argv[i + 1]);
                i++;
                break;
            case '--maxConnections':
            case '-mc':
                options.maxConnections = parseInt(process.argv[i + 1]);
                i++;
                break;
            case '--url':
            case '-u':
                urls.push(process.argv[i + 1]);
                i++;
                break;
            default:
                testFiles.push(process.argv[i]);
                break;
        }
    }
};

var showHelp = function(){
    console.log('Syntax rtest <options> <testfile 1> ... <testfile n>');
    console.log('');
    console.log('--url -u               The entrypoint URL for the scans');
    console.log('                       can be used multiple time');
    console.log('--includeDomain -i     Domains to include in scan, can be used multiple times');
    console.log('                       Use one or the other between this or --excludeDomain');
    console.log('--excludeDomain -x     Domain ton exclude from scan, can be used multiple times');
    console.log('                       Use one or the other between this or --includeDomain');
    console.log('--maxPages -m          Maximum number of pages to crawl');
    console.log('--maxConnections -mc   Maximum number of simultaneous open connections');
}
var runTests = function(){
    var tests = [];
    _.each(testFiles, function(file){
        console.log(file);
        tests = tests.concat(require(file));
    });
    
    var c = new Spider(options);
    c.on('crawl', function(response){
       _.each(tests, function(tst){
            tst.execute(response); 
        });
    });
    _.each(urls, function(u){
       c.addUrl(u); 
    });
};

parseArgs();
var Spider = require('./spider');

if(testFiles.length === 0
    || urls.length === 0){

    showHelp();
}else{
    runTests();
}