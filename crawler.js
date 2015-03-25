var http = require('http'),
        cheerio = require('cheerio'),
        //jsdom = require('jsdom'),
	q = require('querystring'),
        urlUtils = require('url'),
        fs = require('fs'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        Promise = require('promise');


_.mixin({
    beginsWith: function(haystack, needle){
        return typeof haystack === 'string'
            && typeof needle === 'string'
            && haystack.length >= needle.length
            && haystack.substr(0, needle.length) === needle;
    }
});

var protocol_default_ports = {
    'http': 80,
    'https': 443,
    'ftp': 21
};

var Crawler = function(options){
    var t = this;
    options = options || {};
    t.options = _.extend({}, t.options);
    t.options = _.extend(t.options, options);
    t._queue = [];
    t._openConnections = 0;
    
    _.bindAll(t,
        'complete',
        'addUrl',
        'getQueueDepth',
        '_openConnection',
        '_closeConnection',
        'getQueueDepth',
        '_processUrl',
        '_processHtmlResponse',
        '_processCssResponse',
        '_scrapeUrls');
};
_.extend(Crawler.prototype, Backbone.Events);

_.extend(Crawler.prototype, {
    options: {
        crawlImages: true,
        crawlCss: true,
        crawlScripts: true,
        fetchTimeout: null,
        maxConnections: 50,
        log: function(){}
    },
    
    complete: function(callback){
        var t = this;
        if(t._openConnections === 0){
            callback();
        }else{
            t.on('complete', callback);
        }
    },
    
    addUrl: function(url, meta){
        var t = this;
        var item = {
            url: url,
            meta: meta
        };
        
        var result = new Promise(function(resolve, reject){
            item.resolve = resolve;
            item.reject = reject;
        });
        
        if(t._openConnections < t.options.maxConnections){
            t._processUrl(item);
        }else{
            t._queue.push(item);
        }
        
        return result;
    },
    
    getQueueDepth: function(){
        return this._queue.length;
    },
    
    _openConnection: function(){
        var t = this;
        t._openConnections++;
    },
    
    _closeConnection: function(){
        var t = this;
        t._openConnections--;
        if(t._queue.length > 0){
            var item = t._queue.pop();
            t._processUrl(item);
        }
    },
    
    _processUrl: function(item){       
        
        var t = this;
        var url = item.url;
        var url_parts = urlUtils.parse(url);
        
        //t.options.log("Crawling Url: " + url);

        var options = {  
           host: url_parts.host,   
           port: ('port' in url_parts && url_parts.port !== null) ? url_parts.port : protocol_default_ports[url.protocol],   
           path: url_parts.path
        };
        
        if('httpProxy' in t.options){
            var proxy_parts = urlUtils.parse(t.options.httpProxy);
            options.path = url;
            options.host = proxy_parts.host;
            options.port = ('port' in proxy_parts && proxy_parts.port !== null) ? proxy_parts.port : 80;
        }
        
        if('userAgent' in t.options){
            options.headers = options.headers || {};
            options.headers['User-Agent'] = t.options.userAgent;
        }
        
        var req = http.get(options, function(req_url){
            t._openConnection();
            return function(res) {
                var response = {
                    url: req_url,
                    statusCode: 0,
                    body: '',
                    refs: []
                };

                var done = function() {
                    t._closeConnection();
                    
                    response.statusCode = res.statusCode;
                    response.headers = res.headers;
                    
                    var result = null;
                    if(res.statusCode==200
                        && 'content-type' in res.headers
                        && _.beginsWith(res.headers['content-type'], 'text/html')){
                        
                        result = t._processHtmlResponse(response);

                    }else if(res.statusCode==200
                        && 'content-type' in res.headers
                        && _.beginsWith(res.headers['content-type'], 'text/css')){
                        
                        result = t._processCssResponse(response);
                    }else{
                        if(res.statusCode==301 || res.statusCode==302){
                            var location = res.headers['location'];
                            if(!location || ! response.url){
                                t.options.log("Bad redirect from " + response.url);
                                t.options.log(JSON.stringify(res.headers));
                            }else{
                                response.refs.push(urlUtils.resolve(response.url, location ) );
                            }
                        }
                        
                        result = new Promise(function(resolve, reject){ resolve(response); });
                    }
                    
                    result.then(function(resp){
                        item.resolve(resp);
                    },
                    function(err){
                        t.options.log(err);
                        throw err;
                    });
                };
                
                res.on('data', function(chunk) {
                    response.body = response.body + chunk.toString();
                });
                res.on('end', done);
                res.on('close', done);
            };
        }(url)).on('error', function(req_url){
            return function(e) {
                var response = {
                    url: req_url,
                    body: '',
                    refs: [],
                    statusCode: e.statusCode || 0,
                    headers: e.headers || {}
                };

                item.resolve(response);
            };
        }(url)); 
    },
    
    _processResponse: function(response){
        
    },
    
    _processHtmlResponse: function(response){
        var t = this;
        var result = new Promise(function(resolve, reject){
            response.$ = cheerio.load(response.body);
            response.refs = t._scrapeUrls(response.url, response.$);
            resolve(response);
        });
        
        return result;
    },
    
    _processCssResponse: function(response){
        var t = this;
        var result = new Promise(function(resolve, reject){
            var urlMatch = /[:\s]+url\(['"]?([^\(]+)['"]?\)/g;
            var match;
            var refs = [];
            while ((match = urlMatch.exec(response.body)) !== null)
            {
                refs.push(match[1]);
            }
            
            refs = _.map(refs, function(item){
                return urlUtils.resolve(response.url, item);
            });
            response.refs = response.refs.concat(refs);
            resolve(response);
        });
        
        return result;
    },
    
    _scrapeUrls: function(docURL, $){
        var protoCheck = /^https?\:\/\//;
        var t=this;
        var results = [];
        
        if(t.options.crawlImages){
            $('img').each(function(idx, el){
               var src = $(el).attr('src');
               if(src === null || src === ''){
                   return;
               }
               results.push(src);
            });
        }
        
        if(t.options.crawlScripts){
            $('script').each(function(idx, el){
               var src = $(el).attr('src');
               if(src==null || src==''){
                   return;
               }
               results.push(src);
            });
        }
        
        if(t.options.crawlCss){
            $('link[rel="stylesheet"]').each(function(idx, el){
               var src = $(el).attr('href');
               if(src === null || src === ''){
                   return;
               }
               results.push(src);                
            });
        }
        
        $('a').each(function(idx, el){
          var href = $(el).attr('href');
          if(href === undefined
                  || href === null
                  || _.beginsWith(href, '#')
                  || _.beginsWith(href, 'javascript:')){return;}
          
          results.push(href);
        });
        
        results = _.map(results, function(item){
            return urlUtils.resolve(docURL, item);
        });
        
        results = _.uniq(results);
        return results;
    }
});

module.exports = Crawler;
