/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
var Spider = require('./spider');

var c = new Spider({
    includeDomains: [
     "www.campbellskitchen.com"   
    ],
    maxPages: 500
});
var result = c.addUrl('http://www.campbellskitchen.com/');
c.on('crawl', function(response){
//    console.log(JSON.stringify(response));
});
