const synapse = require('synapse');

const ENDPOINT_PATH = 'api/bug-report';
const RECIPIENT = 'pedrinnieeva@gmail.com';
const SUBJECT_PREFIX = 'Bug na IDE Synapse';
const REQUEST_TIMEOUT_MS = 15000;
const CLOSE_DELAY_MS = 1600;

const FIELDS = [
	{ name: 'title', label: 'Título curto', type: 'text', required: true, wide: true, placeholder: 'O preview congela quando eu troco de arquivo' },
	{ name: 'area', label: 'Onde aconteceu', type: 'select', required: true, options: ['Editor de código', 'Explorador de arquivos', 'Preview ao vivo', 'Build e compilador', 'Terminal e relay', 'Blepse 3D', 'Assistente de IA', 'MCP e agentes', 'Extensões', 'Configurações e temas', 'Outro lugar'] },
	{ name: 'severity', label: 'Gravidade', type: 'select', required: true, options: ['Trava a IDE inteira', 'Bloqueia o meu trabalho', 'Incomoda mas dá para seguir', 'Detalhe visual'] },
	{ name: 'description', label: 'O que aconteceu', type: 'textarea', required: true, wide: true, rows: 4, placeholder: 'Descreva o comportamento errado e quando ele começou.' },
	{ name: 'steps', label: 'Passos para repetir', type: 'textarea', required: true, wide: true, rows: 4, placeholder: '1. Abrir o projeto\n2. Editar um arquivo grande\n3. Trocar de aba' },
	{ name: 'expected', label: 'O que você esperava', type: 'textarea', required: false, wide: true, rows: 2 },
	{ name: 'consoleOutput', label: 'Erros do console', type: 'textarea', required: false, wide: true, rows: 3, placeholder: 'Cole aqui o que aparece no painel Console.' },
	{ name: 'contact', label: 'E-mail para resposta', type: 'text', required: false, placeholder: 'opcional' },
	{ name: 'projectName', label: 'Projeto em que ocorreu', type: 'text', required: false, placeholder: 'opcional' },
];

let panel = null;

function escapeHtml(text) {
	return String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function environmentEntries(client) {
	const entries = [
		{ label: 'Versão da IDE', value: synapse.env.appVersion || 'não informado' },
		{ label: 'API de extensões', value: synapse.version },
		{ label: 'Idioma', value: synapse.env.language },
		{ label: 'Tipo de interface', value: synapse.env.uiKind },
		{ label: 'Projeto ativo', value: synapse.workspace.name || 'nenhum' },
		{ label: 'Tema', value: synapse.window.activeColorTheme && synapse.window.activeColorTheme.kind === synapse.ColorThemeKind.Dark ? 'escuro' : 'claro' },
	];
	if (client && typeof client === 'object') {
		if (client.userAgent) entries.push({ label: 'Navegador', value: String(client.userAgent).slice(0, 200) });
		if (client.viewport) entries.push({ label: 'Janela', value: String(client.viewport) });
	}
	if (synapse.env.appRoot) entries.push({ label: 'Página', value: synapse.env.appRoot });
	entries.push({ label: 'Data', value: new Date().toISOString() });
	return entries;
}

function buildMessage(values, environment) {
	const title = String(values.title || '').trim();
	const sections = FIELDS.filter((field) => String(values[field.name] || '').trim()).map((field) => `${field.label}\n${String(values[field.name]).trim()}`);
	sections.push(['Ambiente', ...environment.map((entry) => `${entry.label}: ${entry.value}`)].join('\n'));
	const contact = String(values.contact || '').trim();
	return {
		subject: title ? `${SUBJECT_PREFIX}: ${title}` : SUBJECT_PREFIX,
		body: sections.join('\n\n'),
		replyTo: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) ? contact : '',
	};
}

function endpointUrl(page) {
	const base = synapse.env.appRoot || page || '';
	try {
		return new URL(ENDPOINT_PATH, base).href;
	} catch (error) {
		return '';
	}
}

async function send(message, page) {
	const address = endpointUrl(page);
	if (!address) return { delivered: false, failure: 'sem-endereco' };
	try {
		const response = await fetch(address, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ assunto: message.subject, texto: message.body, resposta: message.replyTo || '' }),
			timeoutMs: REQUEST_TIMEOUT_MS,
		});
		let payload = null;
		try {
			payload = await response.json();
		} catch (error) {}
		if (!response.ok) return { delivered: false, failure: payload && payload.erro ? String(payload.erro) : String(response.status), detail: payload && payload.detalhe ? String(payload.detalhe) : '' };
		if (!payload || payload.estado !== 'enviado') return { delivered: false, failure: 'resposta-inesperada' };
		return { delivered: true, identifier: payload.identificador || '' };
	} catch (error) {
		return { delivered: false, failure: 'falha-de-rede', detail: error && error.message ? error.message : '' };
	}
}

function mailto(message) {
	return `mailto:${RECIPIENT}?subject=${encodeURIComponent(message.subject)}&body=${encodeURIComponent(message.body)}`;
}

function controlMarkup(field) {
	const required = field.required ? ' required' : '';
	const placeholder = field.placeholder ? ` placeholder="${escapeHtml(field.placeholder)}"` : '';
	if (field.type === 'select') {
		const options = ['<option value="">Selecione…</option>'].concat(field.options.map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`)).join('');
		return `<select id="${field.name}" name="${field.name}"${required}>${options}</select>`;
	}
	if (field.type === 'textarea') return `<textarea id="${field.name}" name="${field.name}" rows="${field.rows || 3}"${required}${placeholder}></textarea>`;
	return `<input id="${field.name}" name="${field.name}" type="text"${required}${placeholder} />`;
}

function fieldMarkup(field) {
	return `<label class="field${field.wide ? ' wide' : ''}" for="${field.name}"><span class="label">${escapeHtml(field.label)}${field.required ? ' <b aria-hidden="true">*</b>' : ''}</span>${controlMarkup(field)}</label>`;
}

function html(webview) {
	const csp = `default-src 'none'; style-src 'nonce-${webview.nonce}'; script-src 'nonce-${webview.nonce}';`;
	return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8" /><meta http-equiv="Content-Security-Policy" content="${csp}" /><title>Relatar um bug</title>
<style nonce="${webview.nonce}">
:root{color-scheme:light dark}
body{margin:0;font:14px/1.5 var(--synapse-font-ui,system-ui,sans-serif);color:var(--synapse-txt,#ece5d8);background:var(--synapse-bg-1,#191613);padding:16px}
h1{font-size:18px;margin:0 0 4px}
p.lead{margin:0 0 16px;color:var(--synapse-txt-2,#b5ab99)}
form{display:grid;grid-template-columns:1fr 1fr;gap:12px 16px}
.field{display:flex;flex-direction:column;gap:4px}
.field.wide{grid-column:1/-1}
.label{font-weight:600;font-size:13px;color:var(--synapse-txt,#ece5d8)}
.label b{color:var(--synapse-err,#e35d55)}
input,select,textarea{font:inherit;padding:8px 10px;border-radius:var(--synapse-radius,6px);border:1px solid var(--synapse-line-2,#4a4335);background:var(--synapse-bg-2,#1f1c18);color:var(--synapse-txt,#ece5d8)}
input::placeholder,textarea::placeholder{color:var(--synapse-txt-3,#847a69)}
select option{background:var(--synapse-bg-2,#1f1c18);color:var(--synapse-txt,#ece5d8)}
textarea{resize:vertical;min-height:64px}
.missing{outline:2px solid var(--synapse-err,#e35d55)}
.env{grid-column:1/-1;font-size:12px;color:var(--synapse-txt-2,#b5ab99)}
.env summary{cursor:pointer}
.env dl{display:grid;grid-template-columns:max-content 1fr;gap:2px 12px;margin:8px 0 0}
.env dt{font-weight:600}
.actions{grid-column:1/-1;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
button{font:inherit;padding:8px 16px;border-radius:var(--synapse-radius,6px);border:1px solid transparent;cursor:pointer;background:var(--synapse-acc,#ef7137);color:var(--synapse-acc-ink,#211106)}
button.secondary{background:transparent;border-color:var(--synapse-line-2,#4a4335);color:var(--synapse-txt,#ece5d8)}
button[disabled]{opacity:.6;cursor:progress}
.status{grid-column:1/-1;min-height:20px;font-size:13px}
.status.ok{color:var(--synapse-ok,#79b877)}
.status.error{color:var(--synapse-err,#e35d55)}
@media (max-width:560px){form{grid-template-columns:1fr}}
</style></head><body>
<h1>Relatar um bug</h1>
<p class="lead">Conte o que aconteceu. Os dados de ambiente abaixo vão junto para ajudar na reprodução.</p>
<form id="form" novalidate>
${FIELDS.map(fieldMarkup).join('')}
<details class="env"><summary>Dados de ambiente enviados</summary><dl id="env"></dl></details>
<div class="actions"><button type="submit" id="send">Enviar relato</button><button type="button" class="secondary" id="copy">Copiar texto</button><button type="button" class="secondary" id="close">Cancelar</button></div>
<div class="status" id="status" role="status" aria-live="polite"></div>
</form>
<script nonce="${webview.nonce}">
(function(){
	const api = acquireSynapseApi();
	const form = document.getElementById('form');
	const status = document.getElementById('status');
	const sendButton = document.getElementById('send');
	const envList = document.getElementById('env');
	function client(){ return { userAgent: navigator.userAgent, viewport: window.innerWidth + 'x' + window.innerHeight, page: (document.referrer || '').split('#')[0] }; }
	function values(){ const out = {}; new FormData(form).forEach((value, key) => { out[key] = String(value); }); return out; }
	function setStatus(text, kind){ status.textContent = text || ''; status.className = 'status' + (kind ? ' ' + kind : ''); }
	function missing(){ return Array.from(form.querySelectorAll('[required]')).filter((el) => !String(el.value || '').trim()); }
	form.addEventListener('submit', (event) => {
		event.preventDefault();
		form.querySelectorAll('.missing').forEach((el) => el.classList.remove('missing'));
		const gaps = missing();
		if (gaps.length) { gaps.forEach((el) => el.classList.add('missing')); gaps[0].focus(); setStatus('Preencha os campos obrigatórios marcados.', 'error'); return; }
		sendButton.disabled = true;
		setStatus('Enviando…', 'working');
		api.postMessage({ type: 'submit', values: values(), client: client() });
	});
	document.getElementById('copy').addEventListener('click', () => api.postMessage({ type: 'copy', values: values(), client: client() }));
	document.getElementById('close').addEventListener('click', () => api.postMessage({ type: 'close' }));
	window.addEventListener('message', (event) => {
		const message = event.data && event.data.data ? event.data.data : event.data;
		if (!message || typeof message !== 'object') return;
		if (message.type === 'status') { setStatus(message.text, message.kind); if (message.kind !== 'working') sendButton.disabled = false; }
		if (message.type === 'environment') { envList.innerHTML = ''; (message.entries || []).forEach((entry) => { const dt = document.createElement('dt'); dt.textContent = entry.label; const dd = document.createElement('dd'); dd.textContent = entry.value; envList.appendChild(dt); envList.appendChild(dd); }); }
	});
	api.postMessage({ type: 'ready', client: client() });
	const first = form.querySelector('input,select,textarea'); if (first) first.focus();
})();
</script></body></html>`;
}

async function handleSubmit(values, client) {
	const environment = environmentEntries(client);
	const message = buildMessage(values, environment);
	const result = await send(message, client && client.page);
	if (result.delivered) {
		panel.webview.postMessage({ type: 'status', text: 'Relato enviado. Obrigado!', kind: 'ok' });
		setTimeout(() => panel && panel.dispose(), CLOSE_DELAY_MS);
		return;
	}
	const reason = [result.failure, result.detail].filter(Boolean).join(' - ');
	panel.webview.postMessage({ type: 'status', text: `Não foi possível enviar pelo servidor${reason ? ` (${reason})` : ''}. Abrindo seu e-mail com o texto pronto…`, kind: 'error' });
	await synapse.env.openExternal(mailto(message));
}

async function handleCopy(values, client) {
	const message = buildMessage(values, environmentEntries(client));
	const choice = await synapse.window.showInformationMessage('Texto do relato pronto. Copiar para a área de transferência?', 'Copiar');
	if (choice !== 'Copiar') return;
	try {
		await synapse.env.clipboard.writeText(`${message.subject}\n\n${message.body}`);
		panel.webview.postMessage({ type: 'status', text: 'Texto copiado.', kind: 'ok' });
	} catch (error) {
		panel.webview.postMessage({ type: 'status', text: 'Sem permissão para copiar; selecione e copie manualmente.', kind: 'error' });
	}
}

function open() {
	if (panel) {
		panel.reveal();
		return;
	}
	panel = synapse.window.createWebviewPanel('synapse.bugReport', 'Relatar um bug', synapse.ViewColumn.Active, { enableScripts: true, retainContextWhenHidden: true });
	panel.webview.html = html(panel.webview);
	panel.webview.onDidReceiveMessage(async (message) => {
		if (!message || typeof message !== 'object') return;
		try {
			if (message.type === 'ready') panel.webview.postMessage({ type: 'environment', entries: environmentEntries(message.client) });
			else if (message.type === 'submit') await handleSubmit(message.values || {}, message.client);
			else if (message.type === 'copy') await handleCopy(message.values || {}, message.client);
			else if (message.type === 'close') panel.dispose();
		} catch (error) {
			if (panel) panel.webview.postMessage({ type: 'status', text: `Falha inesperada: ${error && error.message ? error.message : error}`, kind: 'error' });
		}
	});
	panel.onDidDispose(() => {
		panel = null;
	});
}

function draftTool(args) {
	const values = { title: args.title, description: args.description, steps: args.steps || '', area: 'MCP e agentes', severity: 'Incomoda mas dá para seguir' };
	const message = buildMessage(values, environmentEntries(null));
	return `${message.subject}\n\n${message.body}`;
}

function activate(context) {
	context.subscriptions.push(synapse.commands.registerCommand('synapse.bugReport.open', open));
	context.subscriptions.push(synapse.mcp.registerTool('draft', (args) => draftTool(args || {})));
}

function deactivate() {
	if (panel) panel.dispose();
	panel = null;
}

module.exports = { activate, deactivate };
