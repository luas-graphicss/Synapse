'use strict';
(function auroraPoolWS() {
	if (typeof MCP === 'undefined' || typeof WebSocket === 'undefined') return;

	function base() {
		try {
			return String(mcpBase() || '').replace(/\/+$/, '');
		} catch (e) {
			return '';
		}
	}
	function ehLocal(b) {
		try {
			return (
				(typeof APPN !== 'undefined' && APPN.ativo) ||
				/^https?:\/\/(localhost|127\.|\[::1\])/i.test(b)
			);
		} catch (e) {
			return false;
		}
	}
	function nuvemOk() {
		const b = base();
		return !!b && /^https?:\/\//i.test(b) && !ehLocal(b) && !!MCP.sid && !!MCP.token;
	}
	function wsDe(b) {
		return (
			String(b).replace(/\/+$/, '').replace(/^http/i, 'ws') +
			'/bridge/' +
			MCP.sid +
			'/' +
			MCP.token +
			'/ws'
		);
	}
	function curto(u) {
		try {
			return String(u).replace(/^https?:\/\//i, '');
		} catch (e) {
			return String(u);
		}
	}

	function alvos() {
		const out = [];
		const b = base();
		if (b) out.push(b);
		try {
			const st =
				window.SYNAPSE_FAILOVER && window.SYNAPSE_FAILOVER.estado
					? window.SYNAPSE_FAILOVER.estado()
					: null;
			const rs = (st && st.reservas) || [];
			for (let i = 0; i < rs.length; i++) {
				const u = String((rs[i] && rs[i].url) || '').replace(/\/+$/, '');
				if (u && /^https?:\/\//i.test(u) && !out.includes(u)) out.push(u);
			}
		} catch (e) {
			ignorarErro(e, 'alvos');
		}
		return out;
	}

	function querPool() {
		return !!(MCP.active && nuvemOk() && !MCP.forceSse && !MCP.forcePoll);
	}

	async function executar(sock, pkt) {
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
			ignorarErro(e, 'executar');
		}
		try {
			if (sock && sock.ws && sock.ws.readyState === 1) {
				sock.ws.send(JSON.stringify({ t: 'reply', reqId: pkt.reqId, body: out }));
				return;
			}
		} catch (e) {
			ignorarErro(e, 'executar');
		}
		try {
			await mcpEnviarResposta(pkt.reqId, out);
		} catch (e) {
			ignorarErro(e, 'executar');
		}
	}

	function tratarMsg(sock, ev) {
		let m = null;
		try {
			m = JSON.parse(ev.data);
		} catch (e) {
			return;
		}
		if (!m) return;
		sock.lastBeat = Date.now();
		if (m.t === 'hello') {
			if (sock.status !== 'online') {
				sock.status = 'online';
				sock.fails = 0;
			}
			return;
		}
		if (m.t === 'ping') {
			try {
				sock.ws.send(JSON.stringify({ t: 'pong' }));
			} catch (e) {
				ignorarErro(e, 'tratarMsg');
			}
			return;
		}
		if (m.t === 'pong' || m.t === 'stats') return;
		if (m.t === 'rpc') {
			const pks = mcpPacotesRpc(m);
			for (let i = 0; i < pks.length; i++) executar(sock, pks[i]);
			return;
		}
	}

	const POOL = [];
	const N = Math.max(0, (typeof MCP_POOL_SOCKETS === 'number' ? MCP_POOL_SOCKETS : 6) - 1);
	for (var i = 0; i < N; i++)
		POOL.push({
			n: i + 2,
			url: '',
			ws: null,
			status: 'off',
			fails: 0,
			timer: 0,
			lastBeat: 0,
			pingEm: 0,
			chave: '',
		});
	const AVISO = { cheio: 0, quebrado: 0 };

	function chaveDe(url) {
		return url + '|' + MCP.sid + '|' + MCP.token;
	}

	function conectar(sock, url) {
		desligar(sock, true);
		if (!querPool() || !url) return;
		let ws;
		try {
			ws = new WebSocket(wsDe(url));
		} catch (e) {
			sock.fails++;
			agendar(sock);
			return;
		}
		sock.ws = ws;
		sock.url = url;
		sock.chave = chaveDe(url);
		sock.status = 'connecting';
		sock.lastBeat = Date.now();
		sock.pingEm = Date.now();
		ws.onopen = function () {
			if (sock.ws === ws) sock.lastBeat = Date.now();
		};
		ws.onmessage = function (ev) {
			if (sock.ws === ws) tratarMsg(sock, ev);
		};
		ws.onerror = function () {};
		ws.onclose = function () {
			if (sock.ws !== ws) return;
			sock.ws = null;
			sock.status = 'off';
			sock.fails++;
			agendar(sock);
		};
	}

	function agendar(sock) {
		clearTimeout(sock.timer);
		const esp =
			Math.min(20000, 700 * Math.pow(1.7, Math.min(sock.fails, 6))) * (0.7 + Math.random() * 0.6);
		sock.timer = setTimeout(function () {
			sock.timer = 0;
			if (querPool()) conectar(sock, sock.url || base());
		}, esp);
	}

	function desligar(sock, manterUrl) {
		clearTimeout(sock.timer);
		sock.timer = 0;
		if (sock.ws) {
			try {
				sock.ws.onclose = null;
				sock.ws.onmessage = null;
				sock.ws.close();
			} catch (e) {
				ignorarErro(e, 'desligar');
			}
			sock.ws = null;
		}
		sock.status = 'off';
		if (!manterUrl) sock.url = '';
	}

	const SONDA = { ws: null, ok: false, lim: 0 };
	function esperaSonda() {
		const n = Math.min(4, MCP.promoveN || 0);
		return Math.min(
			900000,
			(typeof MCP_PROMOVER_MS === 'number' ? MCP_PROMOVER_MS : 60000) * Math.pow(2, n),
		);
	}
	function marcoSonda() {
		return Math.max(MCP.promoveEm || 0, MCP.pollDesde || 0, MCP.sseDesde || 0);
	}
	function falhouSonda() {
		MCP.promoveN = Math.min(6, (MCP.promoveN || 0) + 1);
		MCP.promoveEm = Date.now();
	}

	function promover() {
		MCP.forceSse = false;
		MCP.forcePoll = false;
		MCP.wsFails = 0;
		MCP.pollGen = (MCP.pollGen || 0) + 1;
		MCP.promoveEm = Date.now();
		mcpLog('ok', 'WebSocket voltou a responder - recuperando o transporte rapido');
		try {
			mcpConnect();
		} catch (e) {
			ignorarErro(e, 'promover');
		}
	}

	function sondar() {
		if (SONDA.ws || !MCP.active || !nuvemOk()) return;
		const url = base();
		let ws;
		try {
			ws = new WebSocket(wsDe(url));
		} catch (e) {
			falhouSonda();
			return;
		}
		SONDA.ws = ws;
		SONDA.ok = false;
		const alvo = { ws: ws, lastBeat: Date.now(), status: 'connecting', fails: 0 };
		clearTimeout(SONDA.lim);
		SONDA.lim = setTimeout(function () {
			if (SONDA.ws !== ws) return;
			try {
				ws.onclose = null;
				ws.close();
			} catch (e) {
				ignorarErro(e, 'sondar');
			}
			SONDA.ws = null;
			if (!SONDA.ok) falhouSonda();
		}, 12000);
		ws.onmessage = function (ev) {
			if (SONDA.ws !== ws) return;
			let m = null;
			try {
				m = JSON.parse(ev.data);
			} catch (e) {
				return;
			}
			if (!m) return;
			if (m.t === 'hello' && !SONDA.ok) {
				SONDA.ok = true;
				clearTimeout(SONDA.lim);
				try {
					ws.onclose = null;
					ws.close();
				} catch (e) {
					ignorarErro(e, 'onmessage');
				}
				SONDA.ws = null;
				promover();
				return;
			}
			tratarMsg(alvo, ev);
		};
		ws.onerror = function () {};
		ws.onclose = function () {
			if (SONDA.ws !== ws) return;
			SONDA.ws = null;
			clearTimeout(SONDA.lim);
			if (!SONDA.ok) falhouSonda();
		};
	}

	const LANES = Math.max(1, typeof MCP_POLL_LANES === 'number' ? MCP_POLL_LANES : 3);
	async function canalExtra(gen) {
		while (MCP.active && gen === MCP.pollGen && MCP.forcePoll) {
			try {
				const ctl = new AbortController();
				const tid = setTimeout(function () {
					try {
						ctl.abort();
					} catch (e) {
						ignorarErro(e, 'canalExtra');
					}
				}, 35000);
				const r = await fetch(base() + '/bridge/' + MCP.sid + '/' + MCP.token + '/poll', {
					method: 'POST',
					headers: MCP_HDRS(),
					body: JSON.stringify({
						wait: typeof MCP_MOBILE !== 'undefined' && MCP_MOBILE ? 12000 : 25000,
					}),
					signal: ctl.signal,
				});
				clearTimeout(tid);
				if (!r.ok) throw new Error('HTTP ' + r.status);
				const j = await r.json();
				const evs = (j && (j.events || j.itens || j.items)) || [];
				if (MCP.active) {
					for (let a = 0; a < evs.length; a++) {
						const pks = mcpPacotesRpc(evs[a]);
						for (let b = 0; b < pks.length; b++) mcpOnRpc(pks[b]);
					}
				}
				if (!MCP.active || gen !== MCP.pollGen) break;
				MCP.lastBeat = Date.now();
			} catch (e) {
				if (!MCP.active || gen !== MCP.pollGen) break;
				const espMs = 1500 + Math.random() * 1500;
				await (typeof window.bgEspera === 'function'
					? window.bgEspera(espMs)
					: new Promise(function (rs) {
							setTimeout(rs, espMs);
						}));
			}
		}
	}
	try {
		const _pollUm = mcpPollLoop;
		const _pollParalelo = function () {
			const saida = _pollUm.apply(this, arguments);
			const gen = MCP.pollGen;
			for (let i = 1; i < LANES; i++) canalExtra(gen);
			return saida;
		};
		try {
			mcpPollLoop = _pollParalelo;
		} catch (e) {
			window.mcpPollLoop = _pollParalelo;
		}
	} catch (e) {
		ignorarErro(e, 'auroraPoolWS');
	}

	setInterval(function () {
		try {
			const quer = querPool();
			const lista = alvos();

			for (let i = 0; i < POOL.length; i++) {
				const s = POOL[i];
				if (!quer) {
					if (s.ws || s.status !== 'off' || s.timer) desligar(s);
					continue;
				}
				const alvo = lista.length ? lista[(i + 1) % lista.length] : base();
				if (s.chave && s.chave !== chaveDe(alvo)) {
					desligar(s);
					s.fails = 0;
				}
				if (!s.ws && !s.timer) {
					conectar(s, alvo);
					continue;
				}
				if (s.ws && s.status === 'online' && Date.now() - s.lastBeat > 45000) {
					s.fails++;
					conectar(s, alvo);
					continue;
				}
				if (s.ws && s.ws.readyState === 1 && Date.now() - s.pingEm > 20000) {
					s.pingEm = Date.now();
					try {
						s.ws.send(JSON.stringify({ t: 'ping' }));
					} catch (e) {
						ignorarErro(e, 'auroraPoolWS');
					}
				}
			}

			if (
				MCP.active &&
				MCP.ws &&
				MCP.status === 'online' &&
				Date.now() - (MCP.lastBeat || 0) > 45000
			) {
				mcpLog('err', 'Ponte principal sem batimento ha 45s - reconectando');
				try {
					mcpConnect();
				} catch (e) {
					ignorarErro(e, 'auroraPoolWS');
				}
			}
			if (MCP.ws && MCP.status === 'online') MCP.promoveN = 0;

			if (
				MCP.active &&
				nuvemOk() &&
				(MCP.forceSse || MCP.forcePoll) &&
				Date.now() - marcoSonda() > esperaSonda()
			)
				sondar();

			let on = 0;
			for (let k = 0; k < POOL.length; k++) if (POOL[k].status === 'online') on++;
			if (quer && POOL.length) {
				if (on === POOL.length && AVISO.cheio !== POOL.length) {
					AVISO.cheio = POOL.length;
					AVISO.quebrado = 0;
					mcpLog(
						'ok',
						`Pool pronto: ${on}${1} pontes paralelas em ${lista.length} no(s) - capacidade para 80+ agentes`,
					);
				} else if (on < POOL.length && AVISO.cheio === POOL.length && !AVISO.quebrado) {
					AVISO.quebrado = 1;
					AVISO.cheio = 0;
					mcpLog(
						'ok',
						`Uma ponte do pool reconectando - as outras ${on}${1} seguem atendendo, sem interrupcao`,
					);
				}
			} else {
				AVISO.cheio = 0;
				AVISO.quebrado = 0;
			}
		} catch (e) {
			ignorarErro(e, 'auroraPoolWS');
		}
	}, 2000);

	try {
		document.addEventListener('visibilitychange', function () {
			if (document.visibilityState !== 'visible' || !querPool()) return;
			for (let i = 0; i < POOL.length; i++) {
				const s = POOL[i];
				if (!s.ws) {
					clearTimeout(s.timer);
					s.timer = 0;
					s.fails = 0;
				}
			}
		});
		window.addEventListener('online', function () {
			if (!querPool()) return;
			for (let i = 0; i < POOL.length; i++) {
				const s = POOL[i];
				clearTimeout(s.timer);
				s.timer = 0;
				s.fails = 0;
			}
		});
	} catch (e) {
		ignorarErro(e, 'auroraPoolWS');
	}

	try {
		window.SYNAPSE_POOL = {
			estado: function () {
				return {
					pontes: [
						{ n: 1, url: curto(base()), status: MCP.ws ? MCP.status : 'off', papel: 'principal' },
					].concat(
						POOL.map(function (s) {
							return { n: s.n, url: curto(s.url || ''), status: s.status, papel: 'pool' };
						}),
					),
					transporte: MCP.forcePoll ? 'polling' : MCP.forceSse ? 'sse' : 'websocket',
					degradado: !!(MCP.forceSse || MCP.forcePoll),
					proximaSonda:
						MCP.forceSse || MCP.forcePoll
							? Math.max(0, Math.round((esperaSonda() - (Date.now() - marcoSonda())) / 1000)) + 's'
							: '-',
					alvos: alvos().map(curto),
					emVoo: (function () {
						let n = 0;
						try {
							MCP.seenReq.forEach(function (v) {
								if (v && !v.done) n++;
							});
						} catch (e) {
							ignorarErro(e, 'estado');
						}
						return n;
					})(),
				};
			},
			religar: function () {
				for (let i = 0; i < POOL.length; i++) {
					const s = POOL[i];
					desligar(s);
					s.fails = 0;
				}
				return 'pontes do pool religando...';
			},
			sondarAgora: function () {
				MCP.promoveN = 0;
				MCP.promoveEm = 0;
				MCP.pollDesde = 0;
				MCP.sseDesde = 0;
				sondar();
				return 'sondando o WebSocket...';
			},
		};
	} catch (e) {
		ignorarErro(e, 'auroraPoolWS');
	}
})();
