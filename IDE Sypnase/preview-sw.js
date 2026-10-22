'use strict';

const VERSAO = 'synapse-preview-sw-1';
const PREFIXO_CACHE = 'proj:';
const RUNTIME = '/preview-runtime.js';

self.addEventListener('install', () => {
	self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
	evento.waitUntil(self.clients.claim());
});

self.addEventListener('message', (evento) => {
	const m = evento.data;
	if (!m || m.type !== 'versao') return;
	if (evento.source) evento.source.postMessage({ type: 'versao', versao: VERSAO });
});

self.addEventListener('fetch', (evento) => {
	const url = new URL(evento.request.url);
	if (url.origin !== self.location.origin) return;
	const partes = url.pathname.match(/^\/p\/([^/]+)(\/.*)?$/);
	if (!partes) return;
	evento.respondWith(responder(evento.request, partes[1], url));
});

async function responder(pedido, pid, url) {
	const cache = await caches.open(PREFIXO_CACHE + pid);
	let caminho = url.pathname;
	if (caminho.endsWith('/')) caminho += 'index.html';
	let resposta = await cache.match(new URL(caminho, self.location.origin).href, { ignoreSearch: true });
	if (!resposta && !/\.[a-z0-9]+$/i.test(caminho)) {
		resposta = await cache.match(new URL(caminho + '/index.html', self.location.origin).href, {
			ignoreSearch: true,
		});
	}
	if (!resposta) return naoEncontrado(caminho, pedido);
	const tipo = resposta.headers.get('content-type') || '';
	const ehNavegacao = pedido.mode === 'navigate' || pedido.destination === 'document' || pedido.destination === 'iframe';
	if (!/text\/html/i.test(tipo) || !ehNavegacao) {
		return comCabecalhos(resposta);
	}
	const html = await resposta.text();
	return new Response(injetarRuntime(html, pid), {
		status: 200,
		headers: cabecalhosDe(resposta, 'text/html; charset=utf-8'),
	});
}

function injetarRuntime(html, pid) {
	const tag = '<script src="' + RUNTIME + '?pid=' + encodeURIComponent(pid) + '" data-synapse="runtime"></script>';
	if (html.indexOf('data-synapse="runtime"') >= 0) return html;
	const cabeca = /<head[^>]*>/i.exec(html);
	if (cabeca) return html.slice(0, cabeca.index + cabeca[0].length) + tag + html.slice(cabeca.index + cabeca[0].length);
	const raiz = /<html[^>]*>/i.exec(html);
	if (raiz) return html.slice(0, raiz.index + raiz[0].length) + tag + html.slice(raiz.index + raiz[0].length);
	const doctype = /^\s*<!doctype[^>]*>/i.exec(html);
	if (doctype) return html.slice(0, doctype[0].length) + tag + html.slice(doctype[0].length);
	return tag + html;
}

function cabecalhosDe(resposta, tipo) {
	const h = new Headers(resposta.headers);
	if (tipo) h.set('Content-Type', tipo);
	h.set('Cross-Origin-Resource-Policy', 'cross-origin');
	h.set('Cache-Control', 'no-store');
	h.delete('Content-Length');
	return h;
}

function comCabecalhos(resposta) {
	return new Response(resposta.body, { status: 200, headers: cabecalhosDe(resposta) });
}

function naoEncontrado(caminho, pedido) {
	if (pedido.destination === 'document' || pedido.mode === 'navigate') {
		const html =
			'<!doctype html><meta charset="utf-8"><title>Preview</title>' +
			'<style>body{font:14px/1.5 system-ui,sans-serif;color:#3a4252;padding:32px}code{background:#eef1f6;padding:1px 5px;border-radius:4px}</style>' +
			'<h1 style="font-size:16px;margin:0 0 8px">Arquivo nao encontrado no preview</h1>' +
			'<p><code>' + caminho.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]) + '</code> ainda nao foi publicado pela IDE. Recompile o preview.</p>';
		return new Response(html, {
			status: 404,
			headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cross-Origin-Resource-Policy': 'cross-origin' },
		});
	}
	return new Response('', { status: 404, headers: { 'Cross-Origin-Resource-Policy': 'cross-origin' } });
}
