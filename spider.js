GLOBAL.appConfig = require('./conf/config');

var q = require('querystring'),
        urlUtils = require('url'),
        fs = require('fs'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        Promise = require('promise'),
        Sequelize = require('sequelize'),
        db = require('./models'),
        Crawler = require('./crawler');

_.mixin({
    beginsWith: function(haystack, needle){
        return typeof haystack === 'string'
            && typeof needle === 'string'
            && haystack.length >= needle.length
            && haystack.substr(0, needle.length) === needle;
    }
});

db.Resource.sync();

var Spider = function(options){
    var t = this;
    options = options || {};
    t.options = _.extend({}, t.options);
    t.options = _.extend(t.options, options);

    t._pagesSpidered = 0;
    t._crawler = new Crawler();
    _.bindAll(t,
        'addUrl',
        '_getUrlToServer',
        '_isDomainIncluded',
        '_ensureProcessing',
        '_processQueue',
        '_crawlSuccess');
};
_.extend(Spider.prototype, Backbone.Events);

_.extend(Spider.prototype, {
    options: {
        includeDomains: null,
        excludeDomains: null,
        depth: 3,
        maxPages: null,
        
        crawlImages: true,
        crawlCss: true,
        crawlScripts: true,
        fetchTimeout: null,
        maxConnections: 50
    },
    
    
    addUrl: function(url){
        var res = db.Resource.findOrCreate({ url: url }, {
            crawlStatus: 0,
            statusCode: null,
            dataSize: null         
        });
        
        this._ensureProcessing();
        return res;
    },
    
    addUrls: function(urls){
        var chainer = new Sequelize.Utils.QueryChainer();
        _.each(urls, function(url){
            var date = new Date();
           chainer.add(
                
                db.sequelize.query(
                    "INSERT OR IGNORE INTO Resources (url, crawlStatus, statusCode, dataSize, createdAt, updatedAt) VALUES(:url, :crawlStatus, :statusCode, :dataSize, :createdAt, :updatedAt)",
                    null,
                    {raw: true},
                    {
                        url: url,
                        crawlStatus: 0,
                        statusCode: null,
                        dataSize: null,
                        createdAt: date,
                        updatedAt: date
                    }
                )
//                db.Resource.findOrCreate({ url: url }, {
//                    crawlStatus: 0,
//                    statusCode: null,
//                    dataSize: null         
//                })
            );
        });
        
        this._ensureProcessing();
        chainer.add( db.Resource.sync() );
        return chainer.run();
    },
    
    //Strips off the # portion of the URL
    _getUrlToServer: function(url){
        var parts = urlUtils.parse(url);
        parts.hash = null;
        return urlUtils.format(parts);
    },
    
    _isDomainIncluded: function(url){
        var t = this;
        var inDoms = t.options.includeDomains;
        var exDoms = t.options.excludeDomains;
        if(inDoms === null && exDoms === null){ return true; }
        
        var parts = urlUtils.parse(url);
        if(exDoms !== null && _.contains(exDoms, parts.hostname)){ return false; }
        else if(inDoms !== null && _.contains(inDoms, parts.hostname)){ return true; }
        else{ return false; }
    },
    
    _ensureProcessing: function(){
        var t = this;
        if(!t._processTimeout){
            t._processTimeout = setTimeout(t._processQueue, 1000);
        }
    },
    
    _processQueue: function(){
        var t = this;
        t._processTimeout = null;
        if(t._isProcessing){ return; }
        t._isProcessing = true;

        var num = t.options.maxConnections -  t._crawler.getQueueDepth();
        db.Resource.findAll({
            where: {
                crawlStatus: 0
            },
            //Grabbing one more record than we want so we don't have to do a second query
            //to check if we need to do another process pass.
            limit: num + 1
        }).success(function(res){

            if(res.length === 0){
                t._isProcessing = false;
            }else{
                var chainer = new Sequelize.Utils.QueryChainer();
                res = _.filter(res, function(val){
                    //Grabbing one more record than we want so we don't have to do a second query
                    //to check if we need to do another process pass.
                    if(res.length === num + 1 && val.id === res[num].id){ return false; }

                    //Make sure we respect the maxPages
                    if(t.options.maxPages !== null && t.options.maxPages <= t._pagesSpidered){ return false; }
                    t._pagesSpidered++

                    chainer.add(
                        val.updateAttributes({
                            crawlStatus: 1
                        })
                    );

                    return true;
                });

                chainer.run().success(function(){
                    _.each(res, function(val){
                        t._crawler.addUrl(val.url).then(t._crawlSuccess);
                    });
                    t._isProcessing = false;
                    if(res.length >= num){
                        t._ensureProcessing();
                    }
                });
            }


        });

    },
    
    _crawlSuccess: function(response){
        var t = this;
        db.Resource.find({
            where: {
                url: response.url
            }
        }).success(function(val){
            
            val.updateAttributes({
                crawlStatus: 2,
                statusCode: response.statusCode,
                dataSize: response.body.length
            });
            
            if(response.refs.length > 0){
                var refs = _.map(response.refs, function(r){
                   return t._getUrlToServer(r);
                });

                var respSvrUrl = t._getUrlToServer(response.url);
                refs = _.reject(refs, function(u){
                    return u === respSvrUrl
                        || !t._isDomainIncluded(u);
                });

                t.addUrls(refs).success(function(refObjs){
                    val.setReferences(refObjs).error(function(err){
                        
                    });
                });
            }

        });
        

        
        t.trigger('crawl', response);
    }
});

module.exports = Spider;
