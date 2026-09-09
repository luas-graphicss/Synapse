'use strict';

const NOTION_BASE_URL = 'https://api.notion.com';
const DEFAULT_NOTION_VERSION = '2026-03-11';
const ALLOWED_METHODS = Object.freeze(['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS']);
const MAXIMUM_BODY_BYTES = 1048576;
const MAXIMUM_RESPONSE_BYTES = 8388608;
const MAXIMUM_PATH_LENGTH = 512;
const MAXIMUM_QUERY_LENGTH = 1024;
const REQUEST_TIMEOUT_MS = 20000;
const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAXIMUM_REQUESTS = 120;
const SAFE_PATH = /^\/v1\/[A-Za-z0-9._~\-/]*$/;
const SAFE_AUTHORIZATION = /^Bearer [A-Za-z0-9._~+/=-]{10,400}$/;
const SAFE_NOTION_VERSION = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_HOST_NAMES = Object.freeze(['localhost', '127.0.0.1', '[::1]']);

function hasControlCharacters(text) {
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code <= 32 || code === 127) return true;
  }
  return false;
}

function cleanText(value) {
  return String(value == null ? '' : value).trim();
}

function hostName(host) {
  return cleanText(host).toLowerCase().split(':')[0];
}

function isLocalHost(host) {
  return LOCAL_HOST_NAMES.includes(hostName(host));
}

function originDecision(requestOrigin, requestHost) {
  const origin = cleanText(requestOrigin).toLowerCase();
  if (!origin) return { allowed: true, echo: '' };
  const host = cleanText(requestHost).toLowerCase();
  if (!host) return { allowed: false, echo: '' };
  if (origin === `https://${host}`) return { allowed: true, echo: origin };
  if (origin === `http://${host}` && isLocalHost(host)) return { allowed: true, echo: origin };
  return { allowed: false, echo: '' };
}

function safeApiPath(rawPath) {
  const path = cleanText(rawPath);
  if (!path || path.length > MAXIMUM_PATH_LENGTH) return null;
  if (hasControlCharacters(path)) return null;
  if (path.includes('//')) return null;
  if (path.split('/').some((part) => part === '..' || part === '.')) return null;
  return SAFE_PATH.test(path) ? path : null;
}

function safeQueryString(rawQuery) {
  const query = String(rawQuery == null ? '' : rawQuery);
  if (!query) return '';
  if (query.length > MAXIMUM_QUERY_LENGTH) return null;
  if (hasControlCharacters(query)) return null;
  if (query.includes('#')) return null;
  return query.startsWith('?') ? query : `?${query}`;
}

function safeAuthorization(value) {
  const header = cleanText(value);
  if (!header) return null;
  return SAFE_AUTHORIZATION.test(header) ? header : null;
}

function safeNotionVersion(value) {
  const version = cleanText(value);
  return SAFE_NOTION_VERSION.test(version) ? version : DEFAULT_NOTION_VERSION;
}

function readBody(method, headers, rawBody) {
  if (method === 'GET' || method === 'HEAD') return { ok: true, value: undefined };
  const declaredBytes = Number((headers && headers['content-length']) || 0);
  if (declaredBytes > MAXIMUM_BODY_BYTES) return { ok: false, value: undefined };
  if (rawBody == null) return { ok: true, value: undefined };
  let text = null;
  if (typeof rawBody === 'string') text = rawBody;
  else if (Buffer.isBuffer(rawBody)) text = rawBody.toString('utf8');
  else {
    try {
      text = JSON.stringify(rawBody);
    } catch (error) {
      return { ok: false, value: undefined };
    }
  }
  if (typeof text !== 'string') return { ok: true, value: undefined };
  if (Buffer.byteLength(text, 'utf8') > MAXIMUM_BODY_BYTES) return { ok: false, value: undefined };
  return { ok: true, value: text };
}

function clientKey(headers, remoteAddress) {
  const forwarded = cleanText((headers && headers['x-forwarded-for']) || '').split(',')[0].trim();
  const address = forwarded || cleanText(remoteAddress) || 'desconhecido';
  return address.slice(0, 64);
}

function createRateLimiter(windowMs, maximumRequests) {
  const buckets = new Map();
  function dropExpired(now) {
    if (buckets.size < 500) return;
    for (const [key, bucket] of buckets) {
      if (now - bucket.start >= windowMs) buckets.delete(key);
    }
    if (buckets.size > 5000) buckets.clear();
  }
  function consume(key) {
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || now - bucket.start >= windowMs) {
      dropExpired(now);
      buckets.set(key, { start: now, count: 1 });
      return true;
    }
    bucket.count += 1;
    return bucket.count <= maximumRequests;
  }
  return { consume };
}

module.exports = {
  notionBaseUrl: NOTION_BASE_URL,
  allowedMethods: ALLOWED_METHODS,
  maximumBodyBytes: MAXIMUM_BODY_BYTES,
  maximumResponseBytes: MAXIMUM_RESPONSE_BYTES,
  requestTimeoutMs: REQUEST_TIMEOUT_MS,
  rateLimitWindowMs: RATE_LIMIT_WINDOW_MS,
  rateLimitMaximumRequests: RATE_LIMIT_MAXIMUM_REQUESTS,
  originDecision,
  safeApiPath,
  safeQueryString,
  safeAuthorization,
  safeNotionVersion,
  readBody,
  clientKey,
  createRateLimiter,
  isLocalHost,
};
