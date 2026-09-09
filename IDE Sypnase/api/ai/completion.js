'use strict';

const policy = require('../../lib/openrouter-proxy-policy.js');
const prompt = require('../../lib/openrouter-completion-prompt.js');

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
  response.setHeader('Access-Control-Allow-Headers', 'content-type,accept');
  response.setHeader('Access-Control-Max-Age', '600');
}

function fail(response, status, code, message) {
  response.status(status).json({ error: { code, message } });
}

function upstreamHeaders(secret) {
  const headers = {
    authorization: `Bearer ${secret}`,
    'content-type': 'application/json',
    'x-title': 'Synapse IDE',
  };
  const referer = policy.configuredReferer(process.env);
  if (referer) headers['http-referer'] = referer;
  return headers;
}

function providerMessage(payload, upstream) {
  const reported = payload && payload.error && payload.error.message;
  return reported || upstream.statusText || 'O provedor recusou a requisicao.';
}

module.exports = async function handler(request, response) {
  applyBaseHeaders(response);
  const decision = policy.originDecision(request);
  if (!decision.allowed) {
    fail(response, 403, 'origem_nao_permitida', 'Esta origem nao pode usar o proxy de IA.');
    return;
  }
  applyCorsHeaders(response, decision.origin);
  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }
  if (request.method !== 'POST') {
    response.setHeader('Allow', policy.allowedMethods.join(','));
    fail(response, 405, 'metodo_nao_permitido', 'Use POST para pedir sugestoes.');
    return;
  }
  const secret = policy.apiKey(process.env);
  if (!secret) {
    fail(
      response,
      503,
      'chave_ausente',
      `Defina ${policy.apiKeyEnvironmentName} nas variaveis do servidor para ativar a IA do autocomplete.`,
    );
    return;
  }
  const quota = rateLimiter(policy.clientKey(request));
  if (!quota.allowed) {
    response.setHeader('Retry-After', String(quota.retryAfterSeconds));
    fail(
      response,
      429,
      'limite_atingido',
      `Limite de sugestoes atingido. Repita em ${quota.retryAfterSeconds}s.`,
    );
    return;
  }
  let body;
  try {
    body = await policy.readJson(request, policy.maximumBodyBytes);
  } catch (error) {
    fail(response, error.statusCode || 400, 'corpo_invalido', error.message);
    return;
  }
  const context = policy.safeContext(body);
  if (!context) {
    fail(response, 400, 'contexto_invalido', 'Envie o texto antes do cursor no campo prefix.');
    return;
  }
  const model = policy.configuredModel(process.env);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), policy.requestTimeoutMs);
  try {
    const upstream = await fetch(policy.openRouterCompletionsUrl, {
        method: 'POST',
        headers: upstreamHeaders(secret),
        body: JSON.stringify({
            model,
            messages: prompt.buildMessages(context),
            max_tokens: policy.maximumOutputTokens,
            temperature: 0.1,
            stream: false,
        }),
        signal: controller.signal,
    });
    const payload = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      fail(response, upstream.status, 'falha_no_provedor', providerMessage(payload, upstream));
      return;
    }
    const choice = payload && payload.choices && payload.choices[0];
    const content = (choice && choice.message && choice.message.content) || '';
    response
    .status(200)
    .json({ model, suggestions: prompt.parseSuggestions(content, policy.maximumSuggestions) });
  } catch (error) {
    const aborted = error && error.name === 'AbortError';
    fail(
      response,
      aborted ? 504 : 502,
      aborted ? 'tempo_esgotado' : 'falha_de_rede',
      aborted
      ? 'O provedor demorou demais para responder.'
      : 'Nao foi possivel falar com o provedor de IA.',
    );
  } finally {
    clearTimeout(timer);
  }
};
