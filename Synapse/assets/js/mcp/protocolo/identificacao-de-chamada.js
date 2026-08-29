'use strict';
function mcpReqKey(pkt) {
	let b = '';
	try {
		b = JSON.stringify(pkt.body);
	} catch (e) {
		b = String(pkt.body);
	}
	let h = 5381;
	for (let i = 0; i < b.length; i++) {
		h = (((h << 5) + h) ^ b.charCodeAt(i)) >>> 0;
	}
	return (
		(pkt.ep != null ? String(pkt.ep) + '|' : '') + pkt.reqId + '|' + b.length + '|' + h.toString(36)
	);
}
function mcpReqVisto(key) {
	const nowT = Date.now();
	if (!MCP.seenReq) MCP.seenReq = new Map();
	for (const [rk, rv] of MCP.seenReq) {
		if (nowT - ((rv && rv.t) || 0) > MCP_SEEN_TTL) MCP.seenReq.delete(rk);
	}
	const v = MCP.seenReq.get(key) || null;
	if (v && !v.done && nowT - ((v && v.t) || 0) > MCP_INFLIGHT_TTL) {
		MCP.seenReq.delete(key);
		return null;
	}
	return v;
}
async function mcpEnviarResposta(reqId, out) {
	try {
		if (MCP.ws && MCP.ws.readyState === 1) {
			MCP.ws.send(JSON.stringify({ t: 'reply', reqId: reqId, body: out }));
			return;
		}
	} catch (e) {
		ignorarErro(e, 'mcpEnviarResposta');
	}
	const corpo = JSON.stringify({ reqId: reqId, body: out });
	const esperar = function (ms) {
		try {
			if (typeof window.bgEspera === 'function') return window.bgEspera(ms);
		} catch (e) {
			ignorarErro(e, 'esperar');
		}
		return new Promise(function (rs) {
			setTimeout(rs, ms);
		});
	};
	let ultimo = '';
	for (let tent = 1; tent <= 4; tent++) {
		try {
			if (MCP.ws && MCP.ws.readyState === 1) {
				MCP.ws.send(JSON.stringify({ t: 'reply', reqId: reqId, body: out }));
				return;
			}
		} catch (e) {
			ignorarErro(e, 'mcpEnviarResposta');
		}
		try {
			const r = await fetch(mcpBase() + '/bridge/' + MCP.sid + '/' + MCP.token + '/reply', {
				method: 'POST',
				headers: MCP_HDRS(),
				body: corpo,
			});
			if (r && r.ok) return;
			ultimo = 'HTTP ' + ((r && r.status) || '?');
		} catch (e) {
			ultimo = String((e && e.message) || e).slice(0, 120);
		}
		if (!MCP.active) return;
		if (tent < 4) await esperar(tent === 1 ? 400 : tent === 2 ? 1200 : 3000);
	}
	try {
		MCP.respPerdidas = (MCP.respPerdidas | 0) + 1;
	} catch (e) {
		ignorarErro(e, 'mcpEnviarResposta');
	}
	mcpLog('err', `Falha ao enviar resposta ao relay apos 4 tentativas (${ultimo})`);
}
