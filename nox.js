// nox - S3 Client for node.js
//
// Copyright(c) 2011-2012 Nephics AB
// MIT Licensed
//
// Some code parts derived from knox:
//   https://github.com/LearnBoost/knox
//   Copyright(c) 2010 LearnBoost <dev@learnboost.com>
//   MIT Licensed

var http = require('http');
var url = require('url');
var path = require('path');
var fs = require('fs');

var auth = require('./auth')


function merge(a, b) {
  var o = {};
  Object.keys(a).forEach(function(key) {
    o[key] = a[key];
  });
  Object.keys(b).forEach(function(key) {
    o[key] = b[key];
  });
  return o;
}


// Create a S3 client
//
// Required options:
//      key: aws key
//   secret: aws secret
//   bucket: aws bucket name (may include the endpoint)
exports.createClient = function(options) {
  if (!options.key) throw new Error('aws "key" required');
  if (!options.secret) throw new Error('aws "secret" required');
  if (!options.bucket) throw new Error('aws "bucket" required');

  var region = options.region || 'us-east-1';

  var bucket;
  var endpoint;
  var basepath = '/';

  if (options.endpoint) {
    endpoint = options.endpoint;
    bucket = options.bucket;
    basepath = '/' + bucket;
  } else if (options.bucket.match(/\.amazonaws\.com$/)) {
    // bucket includes the endpoint
    endpoint = options.bucket;
    bucket = options.bucket.match(/(.*)\.([\w\-]+)\.amazonaws\.com$/)[1];
  } else {
    // assume default endpoint
    bucket = options.bucket;
    endpoint = bucket + '.s3.amazonaws.com';
  }

  function request(method, filename, headers, http_opts) {
    var date = new Date;
    headers = headers || {};
    http_opts = http_opts || {};

    // Default headers
    headers = merge(headers, {
      Date:date.toUTCString(),
      Host:endpoint,
      'x-amz-date': auth.timeStamp(date)
    });

    var pathname = path.join(basepath, filename);

    // Authorization header
    headers.Authorization = auth.authorization({
      key:options.key,
      secret:options.secret,
      region:region,
      verb:method,
      date:date,
      path:pathname,
      headers: headers,
    });

    // Issue request
    var opts = merge(http_opts, {
      host:endpoint,
      port:80,
      method:method,
      path:pathname,
      headers:headers
    });

    return http.request(opts);
  }

  var client = new function() {};

  client.put = function put(filename, headers, opts) {
    headers.Expect = '100-continue';
    return request('PUT', filename, headers, opts);
  };

  client.get = function get(filename, headers, opts) {
    return request('GET', filename, headers, opts);
  };

  client.head = function head(filename, headers, opts) {
    return request('HEAD', filename, headers, opts);
  };

  // Delete file
  client.del = function del(filename, headers, opts) {
    return request('DELETE', filename, headers, opts);
  };

  // Return an S3 presigned url to the given `filename`.
  // TODO: Port to AWS4.
  client.signedUrl = function signedUrl(filename, expiration) {
    var epoch = Math.floor(expiration.getTime()/1000);
    var signature = auth.signQuery({
      secret:options.secret,
      date:epoch,
      resource:'/' + bucket + url.parse(filename).pathname
    });

    var _url = 'http://' + path.join(endpoint, filename) +
      '?Expires=' + epoch +
      '&AWSAccessKeyId=' + options.key +
      '&Signature=' + encodeURIComponent(signature);

    return _url;
  };

  client.url =
  client.http = function(filename){
    return 'http://' + path.join(this.endpoint, this.bucket, filename);
  };

  client.https = function(filename){
    return 'https://' + path.join(this.endpoint, filename);
  };

  return client;
};

