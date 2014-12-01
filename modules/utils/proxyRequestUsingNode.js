var http = require('http');
var https = require('https');
var AbortablePromise = require('./AbortablePromise');

function proxyRequestUsingNode(conn, location) {
  var transport = location.protocol === 'https:' ? https : http;

  return new AbortablePromise(function (resolve, reject, onAbort) {
    var path = conn.location.pathname == '/' ? location.path : conn.location.path; // need query string on location

    var nodeOpts = {
      method: conn.method,
      protocol: location.protocol,
      auth: location.auth,
      hostname: location.hostname,
      port: location.port,
      path: path,
      headers: conn.request.headers
    };

    if (location.port) nodeOpts.port = location.port;

    var nodeRequest = transport.request(nodeOpts);

    nodeRequest.on('response', function (nodeResponse) {
      conn.status = nodeResponse.statusCode;
      conn.response.headers = nodeResponse.headers;
      conn.response.content = nodeResponse;
      resolve(conn);
    });

    nodeRequest.on('error', reject);

    onAbort(function () {
      nodeRequest.abort();
      resolve();
    });

    conn.request.content.pipe(nodeRequest);
  });
}

module.exports = proxyRequestUsingNode;
