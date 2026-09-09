'use strict';

const openRouterCompletionsUrl = 'https://openrouter.ai/api/v1/chat/completions';
const allowedMethods = ['POST', 'OPTIONS'];
const apiKeyEnvironmentName = 'OPENROUTER_API_KEY';
const modelEnvironmentName = 'OPENROUTER_COMPLETION_MODEL';
const refererEnvironmentName = 'OPENROUTER_REFERER';
const defaultModel = 'qwen/qwen-2.5-coder-32b-instruct';
const allowedModels = [
  'qwen/qwen-2.5-coder-32b-instruct',
  'openai/gpt-4o-mini',
  'openai/gpt-4.1-mini',
  'anthropic/claude-3.5-haiku',
  'google/gemini-2.0-flash-001',
  'meta-llama/llama-3.3-70b-instruct',
  'deepseek/deepseek-chat',
];
const maximumBodyBytes = 65536;
const maximumPrefixCharacters = 3000;
const maximumSuffixCharacters = 1200;
const maximumPathCharacters = 300;
const maximumSuggestions = 6;
const maximumOutputTokens = 180;
const requestTimeoutMs = 12000;
const rateLimitWindowMs = 60000;
const rateLimitMaximumRequests = 45;
const rateLimitMaximumKeys = 500;

function isLocalHost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function originDecision(request) {
  const rawOrigin = String((request.headers && request.headers.origin) || '').trim();
  if (!rawOrigin) return { allowed: true, origin: '' };
  let parsedOrigin;
  try {
    parsedOrigin = new URL(rawOrigin);
  } catch (error) {
    return { allowed: false, origin: '' };
  }
  const requestHost = String((request.headers && request.headers.host) || '')
  .split(':')[0]
  .toLowerCase();
  const originHost = parsedOrigin.hostname.toLowerCase();
  if (originHost === requestHost || isLocalHost(originHost))
  return { allowed: true, origin: parsedOrigin.origin };
  return { allowed: false, origin: parsedOrigin.origin };
}

function clientKey(request) {
  const forwarded = String((request.headers && request.headers['x-forwarded-for']) || '')
  .split(',')[0]
  .trim();
  return forwarded || (request.socket && request.socket.remoteAddress) || 'origem-desconhecida';
}

function createRateLimiter(windowMs, maximumRequests) {
  const windows = new Map();
  return function take(key) {
    const now = Date.now();
    if (windows.size > rateLimitMaximumKeys) {
      for (const [storedKey, stored] of windows)
      if (now - stored.start >= windowMs) windows.delete(storedKey);
    }
    const current = windows.get(key);
    if (!current || now - current.start >= windowMs) {
      windows.set(key, { start: now, count: 1 });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    current.count += 1;
    if (current.count <= maximumRequests) return { allowed: true, retryAfterSeconds: 0 };
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - current.start)) / 1000)),
    };
  };
}

function readRawBody(request, maximumBytes) {
  return new Promise((resolve, reject) => {
      let received = 0;
      const chunks = [];
      request.on('data', (chunk) => {
          received += chunk.length;
          if (received > maximumBytes) {
            const failure = new Error('O corpo da requisicao passou do tamanho aceito.');
            failure.statusCode = 413;
            request.destroy();
            reject(failure);
            return;
          }
          chunks.push(chunk);
      });
      request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      request.on('error', reject);
  });
}

async function readJson(request, maximumBytes) {
  if (request.body && typeof request.body === 'object') return request.body;
  const raw = typeof request.body === 'string' ? request.body : await readRawBody(request, maximumBytes);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (error) {
    const failure = new Error('O corpo da requisicao nao e um JSON valido.');
    failure.statusCode = 400;
    throw failure;
  }
}

function safeText(value, maximumLength) {
  if (typeof value !== 'string') return '';
  return value.length > maximumLength ? value.slice(value.length - maximumLength) : value;
}

function safeContext(body) {
  if (!body || typeof body !== 'object') return null;
  const prefix = safeText(body.prefix, maximumPrefixCharacters);
  if (!prefix.trim()) return null;
  const rawSuffix = typeof body.suffix === 'string' ? body.suffix : '';
  return {
    path: String(body.path || '').slice(0, maximumPathCharacters),
    prefix,
    suffix: rawSuffix.slice(0, maximumSuffixCharacters),
  };
}

function apiKey(environment) {
  return String((environment && environment[apiKeyEnvironmentName]) || '').trim();
}

function configuredModel(environment) {
  const requested = String((environment && environment[modelEnvironmentName]) || '').trim();
  return allowedModels.includes(requested) ? requested : defaultModel;
}

function configuredReferer(environment) {
  return String((environment && environment[refererEnvironmentName]) || '').trim();
}

module.exports = {
  openRouterCompletionsUrl,
  allowedMethods,
  apiKeyEnvironmentName,
  allowedModels,
  defaultModel,
  maximumBodyBytes,
  maximumPrefixCharacters,
  maximumSuffixCharacters,
  maximumSuggestions,
  maximumOutputTokens,
  requestTimeoutMs,
  rateLimitWindowMs,
  rateLimitMaximumRequests,
  isLocalHost,
  originDecision,
  clientKey,
  createRateLimiter,
  readJson,
  safeContext,
  apiKey,
  configuredModel,
  configuredReferer,
};
