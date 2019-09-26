// Produces AWS v4 signature header.

var crypto = require('crypto');
var parse = require('url').parse;


exports.authorization = function(options) {
  return [
    'AWS4-HMAC-SHA256 ',
    'Credential=',
    credential(options),
    ',SignedHeaders=',
    signedHeaders(options.headers),
    ',Signature=',
    signature(options)
  ].join('');
};

function credential(options) {
  return options.key + '/' + scope(options);
}

function scope(options) {
  return dateStamp(options.date) + '/' + options.region + '/s3/aws4_request';
}

function dateStamp(date) {
  var y = date.getUTCFullYear().toString();
  var m = (date.getUTCMonth() + 1).toString();
  var d = date.getUTCDate().toString();
  if (m.length === 1) {
    m = '0' + m;
  }
  if (d.length === 1) {
    d = '0' + d;
  }
  return y + m + d;
}

function signedHeaders(headers) {
  var keys = Object.keys(headers);
  var buf = [];
  for (var i = 0; i < keys.length; i++) {
    buf.push(keys[i].toLowerCase());
  }
  buf.sort();
  return buf.join(';');
}

function signature(options) {
  return hmacSha256(stringToSign(options), signingKey(options), 'hex');
}

function stringToSign(options) {
  return [
    'AWS4-HMAC-SHA256',
    timeStamp(options.date),
    scope(options),
    sha256(canonicalRequest(options))
  ].join('\n');
}

function timeStamp(date) {
  var h = date.getUTCHours().toString();
  var m = date.getUTCMinutes().toString();
  var s = date.getUTCSeconds().toString();
  if (h.length === 1) {
    h = '0' + h;
  }
  if (m.length === 1) {
    m = '0' + m;
  }
  if (s.length === 1) {
    s = '0' + s;
  }
  return dateStamp(date) + 'T' + h + m + s + 'Z';
}

exports.timeStamp = timeStamp;

function canonicalRequest(options) {
  return [
    options.verb,
    options.path,
    '',  // empty query string
    canonicalHeaders(options.headers),
    signedHeaders(options.headers),
    hashedPayload(options)
  ].join('\n');
}

function canonicalHeaders(headers) {
  var keys = Object.keys(headers);
  var buf = [];
  for (var i = 0; i < keys.length; i++) {
    buf.push(keys[i].toLowerCase() + ':' + headers[keys[i]].toString().trim() + '\n');
  }
  buf.sort();
  return buf.join('');
}

function hashedPayload(options) {
  // If the request has no payload, use sha256 hash of an empty string.
  return options.headers['x-amz-content-sha256'] || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
}

function signingKey(options) {
  var dateKey = hmacSha256(dateStamp(options.date), 'AWS4' + options.secret);
  var dateRegionKey = hmacSha256(options.region, dateKey);
  var dateRegionServiceKey = hmacSha256('s3', dateRegionKey);
  return hmacSha256('aws4_request', dateRegionServiceKey);
}

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function hmacSha256(str, secret, encoding) {
  return crypto.createHmac('sha256', secret).update(str).digest(encoding);
};
