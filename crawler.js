var http = require('http'),
        jsdom = require('jsdom'),
	q = require('querystring'),
        urlUtils = require('url'),
        fs = require('fs'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        Promise = require('promise');

var jQScriptSrc=fs.readFileSync('./node_modules/jquery/dist/jquery.min.js').toString();

_.mixin({
    beginsWith: function(haystack, needle){
        return typeof haystack === 'string'
            && typeof needle === 'string'
            && haystack.length >= needle.length
            && haystack.substr(0, needle.length) === needle;
    }
});
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
        maxConnections: 50
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

        var options = {  
           host: url_parts.host,   
           port: ('port' in url_parts && url_parts.port !== null) ? url_parts.port : 80,   
           path: url_parts.path
        };
        
        var req = http.get(options, function(req_url){
            t._openConnection();
            return function(res) {
                var response = {
                    url: req_url,
                    statusCode: 0,
                    body: '',
                    refs: []
                };

                res.on('data', function(chunk) {
                    response.body = response.body + chunk.toString();
                });
                res.on('end', function() {
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
                            response.refs.push( res.headers['location'] );
                        }
                        
                        result = new Promise(function(resolve, reject){ resolve(response); });
                    }
                    
                    result.then(function(resp){
                        item.resolve(resp);
                    });
                });
                res.on('close', function(err){
                    //Not sure if this overlaps with "error"
                    //t._openRequests--;
                    console.log('Connection to ' + req_url + ' closed due to error: ' + err + "\n");
                });
            };
        }(url)).on('error', function(req_url){
            return function(e) {
                var response = {
                    url: req_url,
                    body: '',
                    refs: [],
                    statusCode: e.statusCode,
                    headers: e.headers
                };

//                item.resolve(response);
            };
        }(url)); 
    },
    
    _processResponse: function(response){
        
    },
    
    _processHtmlResponse: function(response){
        var t = this;
        var result = new Promise(function(resolve, reject){
            jsdom.env({
              html: response.body,
              //scripts: ['http://code.jquery.com/jquery-1.7.2.min.js'],
              src: [jQScriptSrc],
              done: function (err, window) {
                response.jQuery = window.jQuery;
                response.refs = t._scrapeUrls(response.url, response.jQuery);
                resolve(response);
              }
            });
        });
        
        return result;
    },
    
    _processCssResponse: function(response){
        var t = this;
        var result = new Promise(function(resolve, reject){
            resolve();
        });
        
        return result;
    },
    
    _scrapeUrls: function(docURL, $){
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
