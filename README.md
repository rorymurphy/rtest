# RTest
## Web site scanning and testing made easy

### Project Page: https://github.com/rorymurphy/rtest

RTest makes ensuring consistency across every page on all your web sites a snap. After defining a set of test, all you have to specify is any entrypoint URL and a few options, and RTest will do the rest. It will crawl your web site, executing your tests against each response. Your tests can access all the standard attributes of the response - url, headers, body, as well as a jQuery-like (cheerio) object for the response body that can be used to test the structure of the document.

## Syntax
rtest &lt;options&gt; &lt;test file 1&gt; ... &lt;test file n&gt;

### Options
| Flag | Description |
| ---- | ----------- |
| --url -u | Specifies a Url that serves as an entrypoint for the crawler - can be used multiple times. |
| --includeDomain -i | Adds a domain to the list of domains to be included in the crawl. If used, white-list scanning is enabled and only those domains specifically included will be scanned. This option may be repeated to include multiple domains. However this option is mutually exclusive with  --excludeDomain. |
| --excludeDomain -x | Adds a domain to the list of domains not included in the crawl. If used, black-list scanning is enabled and all domains will be included unless specifically excluded. This option may be repeated to exclude multiple domains. It is mutually exclusive with --includeDomain. |
| --maxPages | The maximum number of pages that should be crawled. |
| --maxConnections | The maximum number of simultaneous connections that can be open at any given time. It is important not to set this too high unless you have a web farm capable of handling it. The crawler is capable of opening thousands of simultaneous connections due to node's asynchronous IO, which is more than many traditional web servers can handle |
| --fetchTimeout | The amount of time to wait to retrieve a page before giving up, specified in milliseconds |
| --outputFile -o | A file to write the test output to |
| --noCss | Forces the crawler to ignore CSS references |
| --noImages | Forces the crawler to ignore image references |
| --noScripts | Forces the crawler to ignore scripts |

## Example Test File

    var rtest = require('./rtest');

    //The module exports must be an array of tests
    module.exports = [
        rtest.test("Not an error code", function(assert, response){
            //Assert that the response code is not an error code (a 4XX or 5XX) status
            assert.isTrue(response.statusCode < 400, 'URL returned a status code ' + response.statusCode);
        }),

        rtest.test("Optimize with 1 CSS file", function(assert, response){
            //Assert that there is only one link element of type text/css
            assert.areEqual(1, response.$('link[type="text/css"]').length, "More than one stylesheet found", "WARN");
        })
    ];

## The _assert_ object
The assert option provides methods for testing various conditions and outputting the result to the console, along with some basic information about the request being tested. The errorLvl argument should be one of "FATAL", "ERROR", "WARN", "INFO" or "DEBUG". The assert object has the following methods:

| Signature | Description |
| ------ | ----------- |
| isTrue(truthTest, msg, errorLvl) | accepts a single value and evaluates it as truthy or not (using ==), logs the specified msg if it is not |
| areEqual(expected, actual, msg, errorLvl) | accepts two values and tests their equality using === checking, logs the specified msg if not |
| areNotEqual(notExpected, actual, msg, errorLvl) | reverse of areEqual |
| success(msg) | logs a success message |
| failure(msg, errorLvl) | unconditionally logs an error message with the specified errorLvl |

## The _response_ object

| Property | Description |
| -------- | ----------- |
| url | the requested url |
| body | the body of the HTTP request in string form - may be HTML or binary |
| refs | other URLs that are referenced by this document - only parsed for HTML or CSS documents |
| referrers | URLs that have been crawled and reference this document. Only contains pages that have already been crawled and parsed, so list is likely incomplete but can be very helpful in diagnosing where resources returning a 404 are being referenced. |
| statusCode | the HTTP status code returned by the server |
| headers | a javascript object with the header names as keys and values. The content-type is often a header of particular interest in order to write tests that only pertain to a particular resource class |
| $ | the jQuery-like cheerio object for the document root that can be used to run queries against the page structure - only populated for HTML responses |
