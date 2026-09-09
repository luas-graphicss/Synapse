'use strict';

const policy = require('../../lib/notion-proxy-policy.js');

const rateLimiter = policy.createRateLimiter(
  policy.rateLimitWindowMs,
  policy.rateLimitMaximumRequests,
);

function applyBaseHeaders(response) {
  response.setHeader('Vary', 'Origin');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
}

function applyCorsHeaders(response, origin) {
  if (!origin) return;
  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Methods', policy.allowedMethods.join(','));
  response.setHeader(
    'Access-Control-Allow-Headers',
    'authorization,content-type,notion-version,accept',
  );
  response.setHeader('Access-Control-Max-Age', '600');
}

function fail(response, status, code, message) {
  response.status(status).json({ object: 'error', code, message });
}

function requestedPath(request) {
  const raw = (request.query && request.query.caminho) || [];
  const parts = Array.isArray(raw) ? raw : String(raw).split('/');
  const cleaned = parts.map((part) => String(part)).filter(Boolean);
  if (cleaned.length) return `/${cleaned.join('/')}`;
  const url = String(request.url || '');
  const marker = url.indexOf('/api/notion');
  return marker < 0 ? '' : url.slice(marker + '/api/notion'.length).split('?')[0];
}

function requestedQuery(request) {
  const parts = String(request.url || '').split('?');
  return parts.length > 1 ? parts.slice(1).join('?') : '';
}

module.exports = async (request, response) => {
  applyBaseHeaders(response);
  const origin = policy.originDecision(request.headers.origin, request.headers.host);
  if (!origin.allowed) {
    fail(response, 403, 'origem_nao_permitida', 'Esta origem nao pode usar o proxy do Notion.');
    return;
  }
  applyCorsHeaders(response, origin.echo);
  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }
  if (!policy.allowedMethods.includes(request.method)) {
    fail(response, 405, 'metodo_invalido', 'Metodo nao suportado pelo proxy.');
    return;
  }
  const caller = policy.clientKey(
    request.headers,
    request.socket && request.socket.remoteAddress,
  );
  if (!rateLimiter.consume(caller)) {
    fail(response, 429, 'limite_excedido', 'Muitas chamadas seguidas. Tente de novo em instantes.');
    return;
  }
  const path = policy.safeApiPath(requestedPath(request));
  if (!path) {
    fail(response, 400, 'rota_invalida', 'Use /api/notion/v1/...');
    return;
  }
  const query = policy.safeQueryString(requestedQuery(request));
  if (query === null) {
    fail(response, 400, 'consulta_invalida', 'Parametros de consulta invalidos.');
    return;
  }
  const body = policy.readBody(request.method, request.headers, request.body);
  if (!body.ok) {
    fail(response, 413, 'corpo_grande', 'Corpo da requisicao acima do limite permitido.');
    return;
  }
  const headers = {
    'notion-version': policy.safeNotionVersion(request.headers['notion-version']),
    'content-type': 'application/json',
    accept: 'application/json',
  };
  const authorization = policy.safeAuthorization(request.headers.authorization);
  if (authorization) headers.authorization = authorization;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), policy.requestTimeoutMs);
  try {
    const upstream = await fetch(policy.notionBaseUrl + path + query, {
        method: request.method,
        headers,
        body: body.value,
        signal: controller.signal,
        redirect: 'error',
    });
    const declaredBytes = Number(upstream.headers.get('content-length') || 0);
    if (declaredBytes > policy.maximumResponseBytes) {
      fail(response, 502, 'resposta_grande', 'Resposta da API do Notion acima do limite.');
      return;
    }
    const text = await upstream.text();
    if (text.length > policy.maximumResponseBytes) {
      fail(response, 502, 'resposta_grande', 'Resposta da API do Notion acima do limite.');
      return;
    }
    response.status(upstream.status);
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.send(text);
  } catch (error) {
    fail(response, 502, 'proxy_falhou', 'Nao consegui falar com a API do Notion.');
  } finally {
    clearTimeout(timer);
  }
};
