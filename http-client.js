const http = require('http');
const https = require('https');

const TLS_CODES = new Set([
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'CERT_HAS_EXPIRED',
  'CERT_NOT_YET_VALID',
  'ERR_SSL_WRONG_VERSION_NUMBER'
]);

function isTruthy(value) {
  return /^(true|1|yes|on)$/i.test(String(value || '').trim());
}

function hasHeader(headers, name) {
  const lower = name.toLowerCase();
  return Object.keys(headers).some((key) => key.toLowerCase() === lower);
}

function looksLikeJson(body) {
  const trimmed = String(body).trim();
  return trimmed.startsWith('{') || trimmed.startsWith('[');
}

function errorCode(err) {
  return (err && (err.code || (err.cause && err.cause.code))) || '';
}

function formatNetworkError(err, url) {
  const code = errorCode(err);
  const lines = [err && err.message ? err.message : String(err)];
  if (code) lines.push(`Code: ${code}`);
  if (err && err.cause && err.cause.message && err.cause.message !== err.message) {
    lines.push(`Cause: ${err.cause.message}`);
  }
  if (url) lines.push(`URL: ${url}`);

  if (TLS_CODES.has(code)) {
    lines.push(
      '',
      'The TLS certificate could not be verified.',
      'If this is a local or corporate CA, add this at the top of the file:',
      '@insecureSSL = true'
    );
  } else if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    lines.push('', 'Hostname could not be resolved. Check DNS or VPN.');
  } else if (code === 'ECONNREFUSED') {
    lines.push('', 'Connection refused. Is the server listening on this host and port?');
  } else if (code === 'ECONNRESET') {
    lines.push('', 'The server closed the connection before a complete response.');
  } else if (code === 'ETIMEDOUT') {
    lines.push('', 'The request timed out after 30 seconds.');
  }

  return lines.join('\n');
}

function sendHttpRequest(request) {
  const started = Date.now();

  function once(urlString, redirectsLeft) {
    return new Promise((resolve, reject) => {
      let url;
      try {
        url = new URL(urlString);
      } catch {
        reject(Object.assign(new Error(`Invalid URL: ${urlString}`), { code: 'ERR_INVALID_URL' }));
        return;
      }

      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        reject(
          Object.assign(new Error('Only http and https URLs are allowed'), {
            code: 'ERR_INVALID_PROTOCOL'
          })
        );
        return;
      }

      const isHttps = url.protocol === 'https:';
      const lib = isHttps ? https : http;
      const method = (request.method || 'GET').toUpperCase();
      const headers = { ...(request.headers || {}) };
      if (!Object.keys(headers).some((key) => key.toLowerCase() === 'user-agent')) {
        headers['User-Agent'] = 'Restinator/1.0';
      }

      const body = request.body ? String(request.body) : '';
      if (body) {
        if (!hasHeader(headers, 'content-length')) {
          headers['Content-Length'] = Buffer.byteLength(body);
        }
        if (!hasHeader(headers, 'content-type') && looksLikeJson(body)) {
          headers['Content-Type'] = 'application/json';
        }
      }

      const options = {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method,
        headers,
        timeout: 30000
      };
      if (isHttps) {
        options.rejectUnauthorized = !isTruthy(request.insecureSSL);
      }

      const req = lib.request(options, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('error', reject);
        res.on('end', () => {
          const location = res.headers.location;
          if (location && res.statusCode >= 300 && res.statusCode < 400 && redirectsLeft > 0) {
            const next = new URL(location, url).toString();
            resolve(once(next, redirectsLeft - 1));
            return;
          }

          const buffer = Buffer.concat(chunks);
          const responseHeaders = {};
          Object.entries(res.headers).forEach(([key, value]) => {
            responseHeaders[key] = Array.isArray(value) ? value.join(', ') : String(value);
          });

          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            statusText: res.statusMessage || '',
            headers: responseHeaders,
            sentHeaders: { ...headers },
            body: buffer.toString('utf8'),
            size: buffer.length,
            time: Date.now() - started,
            url: url.toString(),
            contentType: responseHeaders['content-type'] || ''
          });
        });
      });

      req.on('timeout', () => {
        req.destroy(
          Object.assign(new Error('Request timed out after 30 seconds'), { code: 'ETIMEDOUT' })
        );
      });
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }

  return once(request.url, 10).catch((err) => ({
    error: formatNetworkError(err, request.url),
    time: Date.now() - started
  }));
}

module.exports = {
  sendHttpRequest,
  formatNetworkError,
  isTruthy
};
