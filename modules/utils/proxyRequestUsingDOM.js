/* jshint -W058 */

var XMLHttpRequest = window.XMLHttpRequest;
var Stream = require('bufferedstream');
var AbortablePromise = require('./AbortablePromise');

function copyStatusAndHeaders(xhr, conn) {
  conn.response.headers = xhr.getAllResponseHeaders();
  conn.status = xhr.status;

  return conn.status;
}

function getContent(xhr) {
  var type = String(xhr.responseType).toLowerCase();

  if (type === 'blob')
    return xhr.responseBlob || xhr.response;

  if (type === 'arraybuffer')
    return xhr.response;

  return xhr.responseText;
}

function pipeContent(xhr, stream, offset) {
  var content = getContent(xhr);

  if (content.toString().match(/ArrayBuffer/)) {
    stream.write(new Uint8Array(content, offset));
    return content.byteLength;
  }

  if (content.length > offset) {
    stream.write(content.slice(offset));
    return content.length;
  }

  return offset;
}

var READ_HEADERS_RECEIVED_STATE = true;
var READ_LOADING_STATE = true;

function proxyRequestUsingDOM(conn, location) {
  return new AbortablePromise(function (resolve, reject, onAbort) {
    var xhr = new XMLHttpRequest;
    var href = conn.location.href == '/' ? location.href : conn.location.href; // need query string when location.href
    xhr.open(conn.method, href, true);

    if ('withCredentials' in xhr && conn.withCredentials)
      xhr.withCredentials = true;

    if ('responseType' in xhr)
      xhr.responseType = 'arraybuffer';

    var headers = conn.request.headers;

    if (headers)
      for (var headerName in headers)
        if (headers.hasOwnProperty(headerName))
          xhr.setRequestHeader(headerName, headers[headerName]);

    var content = conn.response.content = new Stream;
    var offset = 0, status;

    function tryToResolve() {
      if (!status && (status = copyStatusAndHeaders(xhr, conn)) > 0)
        resolve(conn);
    }

    xhr.onreadystatechange = function () {
      if (xhr.error)
        return; // readystatechange triggers before error.

      if (xhr.readyState === 2 && READ_HEADERS_RECEIVED_STATE) {
        try {
          tryToResolve();
        } catch (error) {
          READ_HEADERS_RECEIVED_STATE = false;
        }
      } else if (xhr.readyState === 3 && READ_LOADING_STATE) {
        try {
          tryToResolve();
          offset = pipeContent(xhr, content, offset);
        } catch (error) {
          READ_LOADING_STATE = false;
        }
      } else if (xhr.readyState === 4) {
        tryToResolve();
        pipeContent(xhr, content, offset);
        content.end();
      }
    };

    xhr.onerror = function () {
      reject(new Error('XMLHttpRequest error: ' + getContent(xhr)));
    };

    onAbort(function () {
      try {
        xhr.abort();
      } catch (error) {
        // Not a problem.
      }

      resolve();
    });

    request.stringifyContent().then(function (content) {
      xhr.send(content);
    }, reject);
  });
}

module.exports = proxyRequestUsingDOM;
