'use strict';

(function auroraRelayWS() {
	const mcpConnectSSE = mcpConnect;
	try {
		window.__mcpConnectSSE = mcpConnectSSE;
	} catch (e) {
		ignorarErro(e, 'auroraRelayWS');
	}

	function mcpWsUrl() {
		const base = mcpBase().replace(/\/+$/, '');
		return base.replace(/^http/i, 'ws') + '/bridge/' + MCP.sid + '/' + MCP.token + '/ws';
	}

	async function mcpOnRpcWS(pkt) {
		if (!pkt || pkt.reqId == null) return;
		const key = mcpReqKey(pkt);
		const visto = mcpReqVisto(key);
		if (visto) {
			if (visto.done) mcpEnviarResposta(pkt.reqId, visto.out);
			return;
		}
		MCP.seenReq.set(key, { t: Date.now(), done: false, out: null });

		let out = null;
		try {
			out = await mcpHandleMessage(pkt.body);
		} catch (e) {
			out = {
				jsonrpc: '2.0',
				id: pkt.body && pkt.body.id != null ? pkt.body.id : null,
				error: { code: -32603, message: String((e && e.message) || e) },
			};
		}

		try {
			MCP.seenReq.set(key, { t: Date.now(), done: true, out: out });
		} catch (e) {
			ignorarErro(e, 'mcpOnRpcWS');
		}

		try {
			if (MCP.ws && MCP.ws.readyState === 1) {
				MCP.ws.send(JSON.stringify({ t: 'reply', reqId: pkt.reqId, body: out }));
				return;
			}
		} catch (e) {
			ignorarErro(e, 'mcpOnRpcWS');
		}

		try {
			await fetch(mcpBase() + '/bridge/' + MCP.sid + '/' + MCP.token + '/reply', {
				method: 'POST',
				headers: MCP_HDRS(),
				body: JSON.stringify({ reqId: pkt.reqId, body: out }),
			});
		} catch (e) {
			mcpLog('err', 'Falha ao enviar resposta ao relay');
		}
	}

	function mcpConnectWS() {
		clearTimeout(MCP.retryT);
		clearTimeout(MCP.helloT);
		MCP.pollGen = (MCP.pollGen || 0) + 1;

		if (MCP.es) {
			try {
				MCP.es.close();
			} catch (e) {
				ignorarErro(e, 'mcpConnectWS');
			}
			MCP.es = null;
		}
		if (MCP.ws) {
			try {
				MCP.ws.onclose = null;
				MCP.ws.close();
			} catch (e) {
				ignorarErro(e, 'mcpConnectWS');
			}
			MCP.ws = null;
		}
		clearInterval(MCP.pingT);

		if (!MCP.active) return;
		let baseAtual = '';
		try {
			baseAtual = mcpBase();
		} catch (e) {
			ignorarErro(e, 'mcpConnectWS');
		}
		if (MCP.lastBase !== baseAtual) {
			MCP.lastBase = baseAtual;
			MCP.forcePoll = false;
			MCP.forceSse = false;
			MCP.wsFails = 0;
		}
		if (MCP.forcePoll) {
			mcpPollLoop();
			return;
		}
		let relayLocal = false;
		try {
			relayLocal =
				(typeof APPN !== 'undefined' && APPN.ativo) ||
				/^https?:\/\/(localhost|127\.|\[::1\])/i.test(baseAtual);
		} catch (e) {
			ignorarErro(e, 'mcpConnectWS');
		}
		if (relayLocal || MCP.forceSse) {
			mcpConnectSSE();
			return;
		}

		MCP.status = 'connecting';
		mcpRenderPanel();

		let ws;
		try {
			ws = new WebSocket(mcpWsUrl());
		} catch (e) {
			MCP.forcePoll = true;
			mcpLog('err', 'WebSocket indisponivel — modo compativel (polling)');
			mcpPollLoop();
			return;
		}
		MCP.ws = ws;
		MCP.lastBeat = Date.now();

		const helloT = setTimeout(function () {
			if (MCP.ws !== ws) return;
			try {
				ws.onclose = null;
				ws.close();
			} catch (e) {
				ignorarErro(e, 'mcpConnectWS');
			}
			MCP.ws = null;
			MCP.forceSse = true;
			MCP.sseDesde = Date.now();
			mcpLog('err', 'Handshake do WebSocket lento — SSE TEMPORARIO; volto ao WebSocket sozinho');
			mcpConnectSSE();
		}, MCP_HELLO_MS);

		ws.onopen = function () {
			if (MCP.ws !== ws) return;
			MCP.lastBeat = Date.now();
		};

		ws.onmessage = function (ev) {
			if (MCP.ws !== ws) return;
			MCP.lastBeat = Date.now();
			let m = null;
			try {
				m = JSON.parse(ev.data);
			} catch (e) {
				return;
			}
			if (!m) return;
			if (m.t === 'hello') {
				clearTimeout(helloT);
				MCP.status = 'online';
				MCP.wsFails = 0;
				mcpLog('ok', 'Conectado ao relay (WebSocket)');
				mcpRenderPanel();
				return;
			}
			if (m.t === 'pong') return;
			if (m.t === 'ping') {
				try {
					ws.send(JSON.stringify({ t: 'pong' }));
				} catch (e) {
					ignorarErro(e, 'onmessage');
				}
				return;
			}
			if (m.t === 'rpc') {
				const pks = mcpPacotesRpc(m);
				for (let pi = 0; pi < pks.length; pi++) mcpOnRpcWS(pks[pi]);
				return;
			}
		};

		ws.onclose = function () {
			if (MCP.ws !== ws) return;
			clearTimeout(helloT);
			clearInterval(MCP.pingT);
			const semHello = MCP.status !== 'online';
			MCP.ws = null;
			if (!MCP.active) return;
			if (semHello) {
				MCP.wsFails = (MCP.wsFails || 0) + 1;
				if (MCP.wsFails >= MCP_WS_FAILS_MAX) {
					MCP.forceSse = true;
					MCP.sseDesde = Date.now();
					mcpLog(
						'err',
						`WebSocket recusado ${MCP.wsFails}x — SSE TEMPORARIO; volto ao WebSocket sozinho`,
					);
					mcpConnectSSE();
					return;
				}
			}
			MCP.status = 'error';
			mcpRenderPanel();
			mcpScheduleRetry();
		};

		ws.onerror = function () {};

		MCP.pingT = setInterval(function () {
			if (MCP.ws !== ws) {
				clearInterval(MCP.pingT);
				return;
			}
			try {
				ws.send(JSON.stringify({ t: 'ping' }));
			} catch (e) {
				ignorarErro(e, 'mcpConnectWS');
			}
		}, 20000);
	}

	try {
		mcpConnect = mcpConnectWS;
	} catch (e) {
		window.mcpConnect = mcpConnectWS;
	}

	try {
		if (MCP && MCP.active) mcpConnectWS();
	} catch (e) {
		ignorarErro(e, 'auroraRelayWS');
	}
})();
