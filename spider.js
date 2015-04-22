var q = require('querystring'),
        urlUtils = require('url'),
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

    var cOpts = {
        log: console.log
    };
    if('userAgent' in options){ cOpts.userAgent = options.userAgent; }
    if('httpProxy' in options) { cOpts.httpProxy = options.httpProxy; }

    t._crawler = new Crawler({log: console.log});
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
        urlFilter: null,

        depth: 3,
        maxPages: null,

        crawlImages: true,
        crawlCss: true,
        crawlScripts: true,
        fetchTimeout: null,
        maxConnections: 50
    },


    addUrl: function(url){
        var t = this;
        return t.addUrls([url]);
    },

    addUrls: function(urls){
        var t = this;
        urls = _.unique(urls);
        return new Promise(function(resolve, reject){
            var chainer = new Sequelize.Utils.QueryChainer();
            _.each(urls, function(url){
                var date = new Date();

               var isIncluded = (
                    t._isDomainIncluded(url)
                    && !(t.options.urlFilter && !t.options.urlFilter(url))
               );

               var insertVals = null;
               if(isIncluded){
                   insertVals = {
                        url: url,
                        crawlStatus: 0,
                        statusCode: null,
                        dataSize: null,
                        createdAt: date,
                        updatedAt: date
                    };
               }else{
                   insertVals = {
                        url: url,
                        crawlStatus: 3,
                        statusCode: null,
                        dataSize: null,
                        createdAt: date,
                        updatedAt: date
                    };
               }
               chainer.add(

                    db.sequelize.query(
                        "INSERT OR IGNORE INTO Resources (url, crawlStatus, statusCode, dataSize, createdAt, updatedAt) VALUES(:url, :crawlStatus, :statusCode, :dataSize, :createdAt, :updatedAt)",
                        {replacements: insertVals}
                    )
    //                db.Resource.findOrCreate({ url: url }, {
    //                    crawlStatus: 0,
    //                    statusCode: null,
    //                    dataSize: null
    //                })
                );
            });


            chainer.run().then(function(){
                chainer = new Sequelize.Utils.QueryChainer();
                _.each(urls, function(url){
                   chainer.add(db.Resource.find({where: { url: url } }));
                });
                chainer.run().then(function(results){
                    t._ensureProcessing();
                    resolve(results);
                });
            }, function(err){
              throw err;
            });
        });
    },

    _getRecordsByStatus : function(status, limit){
        var q = {
            where: {
                crawlStatus: status
            }
        };
        if(limit){
            q['limit'] = limit;
        }

        return db.Resource.findAll(q);
    },

    _getRecordByUrl: function(url){
        var q = {
            where : {
                url: url
            }
        };
        return db.Resource.find(q)
    },

    _updateRecords: function(rec){
        if(rec instanceof Array){
            var chainer = new Sequelize.Utils.QueryChainer();
            _.each(rec, function(v){
               chainer.add(v.save());
            });
            return chainer.run();
        }else{
            return rec.save();
        }
    },

    _setReferences: function(val, refs){
        return val.setReferences(refs);
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
            t._processTimeout = setTimeout(t._processQueue, 250);
        }
    },

    _processQueue: function(){
        var t = this;
        t._processTimeout = null;
        if(t._isProcessing){ return; }
        t._isProcessing = true;

        var num = t.options.maxConnections -  t._crawler.getQueueDepth();
        this._getRecordsByStatus(0, num + 1).then(function(res){

            if(res.length === 0){
                t._isProcessing = false;
            }else{
                var updates = [];
                res = _.filter(res, function(val){
                    //Grabbing one more record than we want so we don't have to do a second query
                    //to check if we need to do another process pass.
                    if(res.length === num + 1 && val.id === res[num].id){ return false; }

                    //Make sure we respect the maxPages
                    if(t.options.maxPages !== null && t.options.maxPages <= t._pagesSpidered){ return false; }
                    t._pagesSpidered++;

                    val.crawlStatus = 1;
                    updates.push( val );

                    return true;
                });

                t._updateRecords(updates).then(function(){
                    _.each(res, function(val){
                        t._crawler.addUrl(val.url).then(t._crawlSuccess);
                    });
                    t._isProcessing = false;
                    if(res.length >= num){
                        t._ensureProcessing();
                    }
                }, function(err){throw err;});
              }


        }, function(err){throw err;} );

    },

    _crawlSuccess: function(response){
        var t = this;
        t._getRecordByUrl(response.url).then(function(val){

            val.crawlStatus = 2;
            val.statusCode = response.statusCode;
            val.dataSize = response.body.length;
            val.contentType = response.headers['content-type'];

            t._updateRecords(val);
            t._ensureProcessing();

            if(response.refs.length > 0){
                var refs = _.map(response.refs, function(r){
                   return t._getUrlToServer(r);
                });

                var respSvrUrl = t._getUrlToServer(response.url);
                refs = _.reject(refs, function(u){
                    return u === respSvrUrl;
                });

                t.addUrls(refs).then(function(refObjs){
                    t._ensureProcessing();
                    t._setReferences(val, refObjs);
                });
            }

            val.getReferrers().then(function(referrers){
               response.referrers = [];
                _.each(referrers, function(r){
                    response.referrers.push(r.url);
                });
               t.trigger('crawl', response);
            });
        }, function(err){throw err;});




    }
});

module.exports = Spider;
