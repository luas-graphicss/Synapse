'use strict';

const proxyPolicy = require('./openrouter-proxy-policy.js');

const allowedMethods = ['POST', 'GET', 'OPTIONS'];
const defaultRecipientAddress = 'pedrinnieeva@gmail.com';

const apiKeyEnvironmentNames = [
	'RESEND_API_KEY',
	'BUG_REPORT_RESEND_KEY',
	'BUG_REPORT_API_KEY',
	'RESEND_KEY',
	'RESEND_TOKEN',
	'EMAIL_API_KEY',
];
const apiKeyEnvironmentName = apiKeyEnvironmentNames[0];
const senderEnvironmentName = 'BUG_REPORT_SENDER';
const recipientEnvironmentName = 'BUG_REPORT_RECIPIENT';
const defaultSenderAddress = 'IDE Synapse <onboarding@resend.dev>';
const maximumBodyBytes = 131072;
const maximumSubjectCharacters = 180;
const maximumTextCharacters = 20000;
const requestTimeoutMs = 15000;
const rateLimitWindowMs = 600000;
const rateLimitMaximumRequests = 10;

const emailPattern = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

function cleanValue(value) {
	return String(value || '')
		.trim()
		.replace(/^["']+/, '')
		.replace(/["']+$/, '')
		.trim();
}

function mailboxAddress(value) {
	const text = cleanValue(value);
	const angled = /<([^>]+)>/.exec(text);
	return (angled ? angled[1] : text).trim();
}

function isEmailAddress(value) {
	return emailPattern.test(mailboxAddress(value));
}

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
	const answer = singleLine(trimmedText(body.resposta || body.contato, 180));
	const replyTo = isEmailAddress(answer) ? mailboxAddress(answer) : '';
	return { subject, text, replyTo };
}

function apiKeyEntry(environment) {
	for (const name of apiKeyEnvironmentNames) {
		const value = cleanValue(environment && environment[name]);
		if (value) return { name, value };
	}
	return { name: '', value: '' };
}

function apiKey(environment) {
	return apiKeyEntry(environment).value;
}

function senderAddress(environment) {
	const configured = cleanValue(environment && environment[senderEnvironmentName]);
	if (!configured) return defaultSenderAddress;
	return isEmailAddress(configured) ? configured : defaultSenderAddress;
}

function recipientAddress(environment) {
	const configured = cleanValue(environment && environment[recipientEnvironmentName]);
	if (configured && isEmailAddress(configured)) return mailboxAddress(configured);
	return defaultRecipientAddress;
}

function senderUsesSharedDomain(sender) {
	return mailboxAddress(sender).toLowerCase().endsWith('@resend.dev');
}

module.exports = {
	allowedMethods,
	defaultRecipientAddress,
	apiKeyEnvironmentName,
	apiKeyEnvironmentNames,
	senderEnvironmentName,
	recipientEnvironmentName,
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
	apiKeyEntry,
	senderAddress,
	recipientAddress,
	senderUsesSharedDomain,
	isEmailAddress,
	mailboxAddress,
};
