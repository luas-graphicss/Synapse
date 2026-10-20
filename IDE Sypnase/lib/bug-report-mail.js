'use strict';

const mailProviderUrl = 'https://api.resend.com/emails';
const maximumDetailCharacters = 400;

function identifierFrom(rawBody) {
	try {
		const payload = JSON.parse(rawBody);
		if (payload && typeof payload === 'object') return String(payload.id || payload.data?.id || '');
		return '';
	} catch (error) {
		return '';
	}
}

async function deliver(request) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), request.timeoutMs);
	const payload = {
		from: request.sender,
		to: [request.recipient],
		subject: request.subject,
		text: request.text,
	};
	if (request.replyTo) payload.reply_to = [request.replyTo];
	try {
		const response = await fetch(mailProviderUrl, {
			method: 'POST',
			headers: {
				authorization: `Bearer ${request.apiKey}`,
				'content-type': 'application/json',
			},
			body: JSON.stringify(payload),
			signal: controller.signal,
		});
		const rawBody = await response.text();
		if (!response.ok) {
			return {
				delivered: false,
				status: response.status,
				detail: rawBody.slice(0, maximumDetailCharacters),
				identifier: '',
			};
		}

		const identifier = identifierFrom(rawBody);
		if (!identifier) {
			return {
				delivered: false,
				status: response.status,
				detail: `resposta sem identificador de envio: ${rawBody.slice(0, 200)}`,
				identifier: '',
			};
		}
		return { delivered: true, status: response.status, detail: '', identifier };
	} finally {
		clearTimeout(timer);
	}
}

module.exports = { mailProviderUrl, deliver };
