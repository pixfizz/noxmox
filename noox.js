
// noox - OpenStack Object Storage Client for node.js
//
// Copyright(c) 2011 Nephics AB
// MIT Licensed
//
// Some code parts derived from knox:
//   https://github.com/LearnBoost/knox
//   Copyright(c) 2010 LearnBoost <dev@learnboost.com>
//   MIT Licensed

var http = require('http');
var https = require('https');
var url = require('url');

var http_modules = {http: http, https: https};


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


// Create a Object Storage client
//
// Required options:
//      host: authentication endpoint host
//      user: username
//       key: api key
// container: container name
exports.createClient = function(options) {
  if (!options.host) throw new Error('"host" required');
  if (!options.user) throw new Error('"user" required');
  if (!options.key) throw new Error('"key" required');
  if (!options.container) throw new Error('"container" required');

  var client = new function() {};

  client.authenticate = function(callback) {
    callback = callback || function() {};
    var opts = {
      host: options.host,
      port: options.port,
      path: '/auth/v1.0/',
      headers: {
        'X-Auth-User': options.user,
        'X-Auth-Key': options.key
      }
    };

    var req = https.request(opts, function(res) {
      var buffer = [];

      res.on('data', function(chunk) {
        buffer.push(chunk);
      });

      res.on('end', function() {
        var storage_url = res.headers['x-storage-url'];
        var auth_token = res.headers['x-auth-token'];
        var body = buffer.join('');
        var err;

        if (res.statusCode >= 400) {
          err = new Error('Bad auth server response');
          err.statusCode = res.statusCode;
          err.body = body;
          callback(err);
        } else if (!(storage_url && auth_token)) {
          err = new Error('Missing X-Storage-Url or X-Auth-Token headers');
          err.statusCode = res.statusCode;
          err.body = body;
          err.headers = res.headers;
          callback(err);
        } else {
          client.authenticated = true;
          client.storage_url = url.parse(storage_url);
          client.auth_token = auth_token;
          callback();
        }
      });
    });

    req.setTimeout(15 * 1000, function() {
      req.abort();
      var err = new Error('Object storage authentication request timed out.');
      callback(err);
    });

    req.on('error', function(err) {
      callback(err);
    });

    req.end();
  };

  var request = function(method, filename, headers, http_opts) {
    if (!client.authenticated) { throw new Error('noox client not authenticated. Call the .authenticate() function.'); }
    var date = new Date;
    var url_path = client.storage_url.path + '/'+ options.container + '/' + filename;
    headers = headers || {};
    http_opts = http_opts || {};

    // Default headers
    headers = merge(headers, {
      'Date': date.toUTCString(),
      'Host': options.host,
      'X-Auth-Token': client.auth_token
    });

    // Issue request
    var opts = merge(http_opts, {
      host: client.storage_url.host,
      port: client.storage_url.port,
      method: method,
      path: url_path,
      headers: headers
    });

    var protocol = client.storage_url.protocol.replace(':', '');
    return http_modules[protocol].request(opts);
  };

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

  return client;
};
