'use strict';

const policy = require('../lib/bug-report-policy.js');
const mail = require('../lib/bug-report-mail.js');

const takeRequestSlot = policy.createRateLimiter(
	policy.rateLimitWindowMs,
	policy.rateLimitMaximumRequests,
);

function applyBaseHeaders(response) {
	response.setHeader('Cache-Control', 'no-store');
	response.setHeader('X-Content-Type-Options', 'nosniff');
	response.setHeader('Referrer-Policy', 'no-referrer');
	response.setHeader('Vary', 'Origin');
}

function applyCorsHeaders(response, origin) {
	if (!origin) return;
	response.setHeader('Access-Control-Allow-Origin', origin);
	response.setHeader('Access-Control-Allow-Methods', policy.allowedMethods.join(', '));
	response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
	response.setHeader('Access-Control-Max-Age', '600');
}

function fail(response, status, code, message, detail) {
	const payload = { erro: code, mensagem: message };
	if (detail) payload.detalhe = String(detail).slice(0, 400);
	response.status(status).json(payload);
}

function reportConfiguration(response) {
	const entry = policy.apiKeyEntry(process.env);
	const sender = policy.senderAddress(process.env);
	const recipient = policy.recipientAddress(process.env);
	response.status(200).json({
		estado: entry.value ? 'pronto' : 'sem_chave',
		chaveConfigurada: Boolean(entry.value),
		variavelDaChave: entry.name || policy.apiKeyEnvironmentName,
		variaveisAceitas: policy.apiKeyEnvironmentNames,
		remetente: sender,
		destinatario: recipient,
		provedor: mail.mailProviderUrl,
		aviso: policy.senderUsesSharedDomain(sender)
			? `O remetente usa o dominio compartilhado do provedor: ele so entrega para o email dono da conta. Verifique um dominio proprio e defina ${policy.senderEnvironmentName}.`
			: '',
	});
}

module.exports = async function handler(request, response) {
	applyBaseHeaders(response);
	const origin = policy.originDecision(request);
	if (!origin.allowed) {
		fail(response, 403, 'origem_nao_permitida', 'Esta origem nao pode enviar relatos de bug.');
		return;
	}
	applyCorsHeaders(response, origin.origin);
	if (request.method === 'OPTIONS') {
		response.status(204).end();
		return;
	}
	if (request.method === 'GET') {
		reportConfiguration(response);
		return;
	}
	if (request.method !== 'POST') {
		fail(response, 405, 'metodo_nao_permitido', 'Use POST para enviar um relato de bug.');
		return;
	}
	const keyEntry = policy.apiKeyEntry(process.env);
	if (!keyEntry.value) {
		fail(
			response,
			503,
			'chave_ausente',
			'O envio de relatos nao esta configurado neste ambiente.',
			`Defina ${policy.apiKeyEnvironmentName} no ambiente da funcao e publique de novo.`,
		);
		return;
	}
	const slot = takeRequestSlot(policy.clientKey(request));
	if (!slot.allowed) {
		response.setHeader('Retry-After', String(slot.retryAfterSeconds));
		fail(
			response,
			429,
			'limite_atingido',
			'Muitos relatos em pouco tempo. Tente de novo em alguns minutos.',
		);
		return;
	}
	let body;
	try {
		body = await policy.readJson(request, policy.maximumBodyBytes);
	} catch (error) {
		fail(
			response,
			error.statusCode || 400,
			'corpo_invalido',
			'Nao foi possivel ler o relato enviado.',
		);
		return;
	}
	const report = policy.safeReport(body);
	if (!report) {
		fail(response, 400, 'relato_incompleto', 'Informe o assunto e o texto do relato.');
		return;
	}
	const sender = policy.senderAddress(process.env);
	const recipient = policy.recipientAddress(process.env);
	try {
		const delivery = await mail.deliver({
			apiKey: keyEntry.value,
			sender,
			recipient,
			replyTo: report.replyTo,
			subject: report.subject,
			text: report.text,
			timeoutMs: policy.requestTimeoutMs,
		});
		if (!delivery.delivered) {
			console.error('bug-report: provedor recusou o envio', {
				status: delivery.status,
				detail: delivery.detail,
				sender,
				recipient,
			});
			fail(
				response,
				502,
				'falha_no_envio',
				'O servico de email recusou o relato.',
				`${delivery.status}: ${delivery.detail}`,
			);
			return;
		}
		response.status(200).json({
			estado: 'enviado',
			identificador: delivery.identifier,
			destinatario: recipient,
		});
	} catch (error) {
		if (error.name === 'AbortError') {
			fail(
				response,
				504,
				'tempo_esgotado',
				'O servico de email demorou demais para responder.',
			);
			return;
		}
		console.error('bug-report: falha de rede ao falar com o provedor', error);
		fail(
			response,
			502,
			'falha_de_rede',
			'Nao foi possivel falar com o servico de email.',
			error.message,
		);
	}
};
