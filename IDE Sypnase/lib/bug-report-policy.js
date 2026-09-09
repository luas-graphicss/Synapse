'use strict';

const proxyPolicy = require('./openrouter-proxy-policy.js');

const allowedMethods = ['POST', 'OPTIONS'];
const recipientAddress = 'pedrinnieeva@gmail.com';
const apiKeyEnvironmentName = 'RESEND_API_KEY';
const senderEnvironmentName = 'BUG_REPORT_SENDER';
const defaultSenderAddress = 'IDE Synapse <onboarding@resend.dev>';
const maximumBodyBytes = 131072;
const maximumSubjectCharacters = 180;
const maximumTextCharacters = 20000;
const requestTimeoutMs = 15000;
const rateLimitWindowMs = 600000;
const rateLimitMaximumRequests = 10;

function trimmedText(value, maximumLength) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maximumLength);
}

function singleLine(value) {
  return value.replace(/[\r\n]+/g, ' ');
}

function safeReport(body) {
  if (!body || typeof body !== 'object') return null;
  const subject = singleLine(trimmedText(body.assunto, maximumSubjectCharacters));
  const text = trimmedText(body.texto, maximumTextCharacters);
  if (!subject || !text) return null;
  return { subject, text };
}

function apiKey(environment) {
  return String((environment && environment[apiKeyEnvironmentName]) || '').trim();
}

function senderAddress(environment) {
  const configured = String((environment && environment[senderEnvironmentName]) || '').trim();
  return configured || defaultSenderAddress;
}

module.exports = {
  allowedMethods,
  recipientAddress,
  apiKeyEnvironmentName,
  senderEnvironmentName,
  maximumBodyBytes,
  requestTimeoutMs,
  rateLimitWindowMs,
  rateLimitMaximumRequests,
  originDecision: proxyPolicy.originDecision,
  clientKey: proxyPolicy.clientKey,
  createRateLimiter: proxyPolicy.createRateLimiter,
  readJson: proxyPolicy.readJson,
  safeReport,
  apiKey,
  senderAddress,
};
