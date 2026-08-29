'use strict';
(function auroraFailover() {
	'use strict';
	const KRES = 'aurora.mcp.reservas',
		KLEG = 'aurora.mcp.relay2',
		KPORT = 'aurora.mcp.portao';
	const FLV = {
		urls: [],
		pontes: [],
		ativa: 'principal',
		caidoDesde: 0,
		provaOk: 0,
		provaEm: 0,
		statsP: null,
		snooze: 0,
		falhasP: 0,
		__assUI: '',
		metaKey: '',
		portao: '',
		portaoInfo: null,
		portaoEm: 0,
	};

	function $id(x) {
		try {
			return document.getElementById(x);
		} catch (e) {
			return null;
		}
	}
	function lim2(s) {
		return String(s || '')
			.trim()
			.replace(/\/+$/, '');
	}
	function ehUrl2(s) {
		return /^https?:\/\//i.test(s || '');
	}
	function logf(k, t) {
		try {
			mcpLog(k, t);
		} catch (e) {
			ignorarErro(e, 'logf');
		}
	}
	function toastf(t, s, k) {
		try {
			if (typeof toast === 'function') toast(t, s, k);
		} catch (e) {
			ignorarErro(e, 'toastf');
		}
	}
	function ativoMcp() {
		try {
			return !!MCP.active;
		} catch (e) {
			return false;
		}
	}
	function nomeNo(u) {
		return String(u || '')
			.replace(/^https?:\/\//i, '')
			.replace(/\/.*$/, '');
	}

	function normalizar(lista) {
		const vis = {},
			fin = [];
		(Array.isArray(lista) ? lista : []).forEach(function (u) {
			u = lim2(u);
			if (ehUrl2(u) && !vis[u.toLowerCase()]) {
				vis[u.toLowerCase()] = 1;
				fin.push(u);
			}
		});
		return fin.slice(0, 8);
	}
	function carregar() {
		let lista = [];
		try {
			const bruto = localStorage.getItem(KRES);
			if (bruto != null) {
				try {
					const j = JSON.parse(bruto);
					if (Array.isArray(j)) lista = j;
				} catch (e) {
					lista = String(bruto).split(/[\n,]+/);
				}
			} else {
				const antigo = lim2(localStorage.getItem(KLEG) || '');
				if (ehUrl2(antigo)) lista = [antigo];
			}
		} catch (e) {
			ignorarErro(e, 'carregar');
		}
		return normalizar(lista);
	}
	function salvar() {
		try {
			localStorage.setItem(KRES, JSON.stringify(FLV.urls));
		} catch (e) {
			ignorarErro(e, 'salvar');
		}
	}
	FLV.urls = carregar();
	try {
		const q = new URLSearchParams(location.search);
		let rq = q.get('reservas') || q.get('relay2') || q.get('reserva');
		if (rq != null) {
			rq = String(rq).trim();
			if (/^(reset|off|limpar|padrao)$/i.test(rq)) {
				FLV.urls = [];
				salvar();
			} else {
				const ls = normalizar(rq.split(/[,|\s]+/));
				if (ls.length) {
					FLV.urls = ls;
					salvar();
				}
			}
		}
	} catch (e) {
		ignorarErro(e, 'auroraFailover');
	}

	function salvarPortao() {
		try {
			if (FLV.portao) localStorage.setItem(KPORT, FLV.portao);
			else localStorage.removeItem(KPORT);
		} catch (e) {
			ignorarErro(e, 'salvarPortao');
		}
	}
	try {
		const gsalvo = lim2(localStorage.getItem(KPORT) || '');
		if (ehUrl2(gsalvo)) FLV.portao = gsalvo;
	} catch (e) {
		ignorarErro(e, 'auroraFailover');
	}
	try {
		const qg = new URLSearchParams(location.search);
		let gq = qg.get('portao') || qg.get('gate');
		if (gq != null) {
			gq = lim2(gq);
			if (/^(reset|off|limpar|padrao)$/i.test(String(gq))) FLV.portao = '';
			else if (ehUrl2(gq)) FLV.portao = gq;
			salvarPortao();
		}
	} catch (e) {
		ignorarErro(e, 'auroraFailover');
	}
	try {
		window.__flvPortao = function () {
			return FLV.portao;
		};
	} catch (e) {
		ignorarErro(e, 'auroraFailover');
	}
	function adotarNodos(info) {
		if (!info || !info.ok || !Array.isArray(info.nodos) || !info.nodos.length) return;
		let trans = '';
		try {
			trans = lim2(MCP.relay || '');
		} catch (e) {
			ignorarErro(e, 'adotarNodos');
		}
		const lista = info.nodos
			.map(function (n) {
				return lim2(n && n.url);
			})
			.filter(ehUrl2);
		if (!lista.length) return;
		if (
			trans &&
			lista.every(function (u) {
				return u.toLowerCase() !== trans.toLowerCase();
			})
		) {
			if (FLV.__avisoNodos !== trans) {
				FLV.__avisoNodos = trans;
				logf(
					'err',
					`ATENCAO: o no desta aba (${nomeNo(trans)}) NAO esta na lista NODOS do portao (${lista.map(nomeNo).join(', ')}). \
O Notion entra pelo portao, cai num no sem catalogo e mostra 0 ferramentas. Corrija NODOS no wrangler-portao.toml \
ou abra o site com ?relay=${trans}`,
				);
			}
		}
		const novos = lista.filter(function (u) {
			if (trans && u.toLowerCase() === trans.toLowerCase()) return false;
			return FLV.urls.every(function (x) {
				return x.toLowerCase() !== u.toLowerCase();
			});
		});
		if (!novos.length) return;
		FLV.urls = normalizar(FLV.urls.concat(novos));
		salvar();
		try {
			const inp = $id('mcpReservas');
			if (inp) inp.value = FLV.urls.join('\n');
		} catch (e) {
			ignorarErro(e, 'adotarNodos');
		}
		FLV.metaKey = '';
		pontesSync();
		FLV.pontes.forEach(function (pt) {
			pt.catKey = '';
			pt.fails = 0;
			pt.forcePoll = false;
			if (ativoMcp()) conectarP(pt);
		});
		metaPrincipal();
		logf(
			'ok',
			`Nos do portao adotados (${novos.map(nomeNo).join(', ')}) - catalogo e executor passam a existir em todos os nos que o portao pode escolher.`,
		);
		pintar();
	}
	async function provarPortao(forcar) {
		if (!FLV.portao) {
			FLV.portaoInfo = null;
			return;
		}
		const suspeita =
			FLV.ativa === 'reserva' ||
			(FLV.caidoDesde && Date.now() - FLV.caidoDesde > 5000) ||
			(FLV.portaoInfo && FLV.portaoInfo.ok === false);
		const passo = suspeita ? 15000 : 60000;
		if (!forcar && Date.now() - FLV.portaoEm < passo) return;
		FLV.portaoEm = Date.now();
		let novo = null;
		try {
			const ctl = new AbortController();
			const t = setTimeout(function () {
				try {
					ctl.abort();
				} catch (e) {
					ignorarErro(e, 'provarPortao');
				}
			}, 7000);
			const r = await fetch(FLV.portao + '/nodos', {
				method: 'GET',
				cache: 'no-store',
				mode: 'cors',
				credentials: 'omit',
				signal: ctl.signal,
			});
			clearTimeout(t);
			let j = null;
			try {
				j = await r.json();
			} catch (e) {
				ignorarErro(e, 'provarPortao');
			}
			if (r && r.ok && j && j.portao)
				novo = {
					ok: true,
					at: Date.now(),
					servindo: String(j.servindo || ''),
					failover: !!j.failover,
					nodos: Array.isArray(j.nodos) ? j.nodos : [],
					versao: String(j.portao),
				};
			else novo = { ok: false, at: Date.now(), servindo: '', failover: false, nodos: [] };
		} catch (e) {
			novo = { ok: false, at: Date.now(), servindo: '', failover: false, nodos: [] };
		}
		const antes = FLV.portaoInfo;
		FLV.portaoInfo = novo;
		try {
			adotarNodos(novo);
		} catch (e) {
			ignorarErro(e, 'provarPortao');
		}
		if (!antes || antes.ok !== novo.ok || (antes.servindo || '') !== (novo.servindo || '')) {
			if (!novo.ok)
				logf(
					'err',
					`Portao sem resposta (${nomeNo(FLV.portao)}) — a URL unica pode estar fora; confira o deploy do portao.`,
				);
			else if (novo.failover)
				logf('ok', `Portao vivo — desviando pela MESMA URL para ${nomeNo(novo.servindo)}.`);
			else if (novo.servindo)
				logf('ok', `Portao vivo — servindo pelo no principal (${nomeNo(novo.servindo)}).`);
			try {
				if (typeof mcpRenderPanel === 'function') mcpRenderPanel();
			} catch (e) {
				ignorarErro(e, 'provarPortao');
			}
		}
		pintar();
	}
	function urlEmergencia() {
		const on = pOnline();
		try {
			return on ? on.url + '/mcp/' + MCP.sid + '/' + MCP.token : '';
		} catch (e) {
			return on ? on.url : '';
		}
	}

	function novaPonte(url, i) {
		return {
			url: url,
			i: i,
			ws: null,
			status: 'off',
			fails: 0,
			gen: 0,
			lastBeat: 0,
			pingT: null,
			retryT: null,
			seen: new Map(),
			forcePoll: false,
			catKey: '',
			stats: null,
		};
	}
	function pontesSync() {
		const mapa = {};
		FLV.pontes.forEach(function (pt) {
			mapa[pt.url] = pt;
		});
		const novas = [];
		FLV.urls.forEach(function (u, i) {
			let pt = mapa[u];
			if (pt) {
				pt.i = i;
				delete mapa[u];
			} else pt = novaPonte(u, i);
			novas.push(pt);
		});
		Object.keys(mapa).forEach(function (u) {
			desligarP(mapa[u]);
		});
		FLV.pontes = novas;
	}
	function valida(pt) {
		if (!pt || !FLV.pontes.includes(pt)) return false;
		if (!ehUrl2(pt.url)) return false;
		try {
			if (lim2(MCP.relay) === pt.url) return false;
		} catch (e) {
			ignorarErro(e, 'valida');
		}
		return true;
	}
	function pOnline() {
		for (let i = 0; i < FLV.pontes.length; i++) {
			if (FLV.pontes[i].status === 'online') return FLV.pontes[i];
		}
		return null;
	}

	async function catalogoP(pt, forcar) {
		try {
			if (!valida(pt) || !ativoMcp() || typeof mcpHandleMessage !== 'function') return;
			const ini = await mcpHandleMessage({
				jsonrpc: '2.0',
				id: 'cat-i2',
				method: 'initialize',
				params: {
					protocolVersion: '2025-06-18',
					capabilities: {},
					clientInfo: { name: 'aurora-cache', version: '1' },
				},
			});
			const tls = await mcpHandleMessage({
				jsonrpc: '2.0',
				id: 'cat-t2',
				method: 'tools/list',
				params: {},
			});
			let nFer2 = 0;
			try {
				nFer2 = ((tls && tls.result && tls.result.tools) || []).length;
			} catch (e) {
				ignorarErro(e, 'catalogoP');
			}
			const chave =
				pt.url + '|' + MCP.sid + '|' + MCP.token + '|' + JSON.stringify(FLV.urls) + '|' + nFer2;
			if (!forcar && pt.catKey === chave) return;
			const r = await fetch(pt.url + '/bridge/' + MCP.sid + '/' + MCP.token + '/meta', {
				method: 'POST',
				headers: MCP_HDRS(),
				body: JSON.stringify({
					init: (ini && ini.result) || null,
					tools: (tls && tls.result) || null,
					reservas: (function () {
						const l = [];
						try {
							const pr = lim2(MCP.relay || '');
							if (ehUrl2(pr)) l.push(pr);
						} catch (e) {
							ignorarErro(e, 'catalogoP');
						}
						FLV.urls.forEach(function (u) {
							if (u !== pt.url && !l.includes(u)) l.push(u);
						});
						return l;
					})(),
				}),
			});
			if (r && r.ok) {
				if (pt.catKey !== chave)
					logf('ok', `Catalogo publicado no no de reserva ${pt.i}${1} (${nomeNo(pt.url)}).`);
				pt.catKey = chave;
			}
		} catch (e) {
			ignorarErro(e, 'catalogoP');
		}
	}
	async function metaPrincipal() {
		try {
			if (!ativoMcp()) return;
			const chave =
				lim2(MCP.relay || '') + '|' + MCP.sid + '|' + MCP.token + '|' + JSON.stringify(FLV.urls);
			if (FLV.metaKey === chave) return;
			let iniP = null,
				tlsP = null;
			try {
				if (typeof mcpHandleMessage === 'function') {
					iniP = await mcpHandleMessage({
						jsonrpc: '2.0',
						id: 'cat-i3',
						method: 'initialize',
						params: {
							protocolVersion: '2025-06-18',
							capabilities: {},
							clientInfo: { name: 'aurora-cache', version: '1' },
						},
					});
					tlsP = await mcpHandleMessage({
						jsonrpc: '2.0',
						id: 'cat-t3',
						method: 'tools/list',
						params: {},
					});
				}
			} catch (e) {
				ignorarErro(e, 'metaPrincipal');
			}
			const corpoP = { reservas: FLV.urls };
			try {
				if (iniP && iniP.result) corpoP.init = iniP.result;
			} catch (e) {
				ignorarErro(e, 'metaPrincipal');
			}
			try {
				if (tlsP && tlsP.result && (tlsP.result.tools || []).length) corpoP.tools = tlsP.result;
			} catch (e) {
				ignorarErro(e, 'metaPrincipal');
			}
			const r = await fetch(mcpBase() + '/bridge/' + MCP.sid + '/' + MCP.token + '/meta', {
				method: 'POST',
				headers: MCP_HDRS(),
				body: JSON.stringify(corpoP),
			});
			try {
				if (!corpoP.tools && typeof window.mcpEnviarCatalogo === 'function')
					window.mcpEnviarCatalogo(true);
			} catch (e) {
				ignorarErro(e, 'metaPrincipal');
			}
			if (r && r.ok) {
				FLV.metaKey = chave;
				if (FLV.urls.length)
					logf(
						'ok',
						FLV.urls.length +
							' no(s) de reserva registrados no no principal — failover automatico pronto, URL unica.',
					);
			}
		} catch (e) {
			ignorarErro(e, 'metaPrincipal');
		}
	}

	async function responderP(pt, reqId, out) {
		try {
			if (pt.ws && pt.ws.readyState === 1) {
				pt.ws.send(JSON.stringify({ t: 'reply', reqId: reqId, body: out }));
				return;
			}
		} catch (e) {
			ignorarErro(e, 'responderP');
		}
		try {
			await fetch(pt.url + '/bridge/' + MCP.sid + '/' + MCP.token + '/reply', {
				method: 'POST',
				headers: MCP_HDRS(),
				body: JSON.stringify({ reqId: reqId, body: out }),
			});
		} catch (e) {
			logf('err', `Reserva ${pt.i}${1}: falha ao devolver resposta`);
		}
	}
	function vistoP(pt, key) {
		const t = Date.now();
		try {
			pt.seen.forEach(function (v, k) {
				if (t - ((v && v.t) || 0) > MCP_SEEN_TTL) pt.seen.delete(k);
			});
		} catch (e) {
			ignorarErro(e, 'vistoP');
		}
		var v = pt.seen.get(key) || null;
		if (v && !v.done && t - v.t > MCP_INFLIGHT_TTL) {
			pt.seen.delete(key);
			return null;
		}
		return v;
	}
	async function rpcP(pt, pkt) {
		if (!pkt || pkt.reqId == null) return;
		let key = '';
		try {
			key = mcpReqKey(pkt);
		} catch (e) {
			key = String(pkt.reqId);
		}
		const v = vistoP(pt, key);
		if (v) {
			if (v.done) responderP(pt, pkt.reqId, v.out);
			return;
		}
		pt.seen.set(key, { t: Date.now(), done: false, out: null });
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
			pt.seen.set(key, { t: Date.now(), done: true, out: out });
		} catch (e) {
			ignorarErro(e, 'rpcP');
		}
		await responderP(pt, pkt.reqId, out);
	}

	function atrasoP(pt) {
		const n = Math.min(pt.fails, 8);
		return Math.min(90000, (n < 2 ? 1200 : 3500) * Math.pow(1.7, n)) * (0.75 + Math.random() * 0.5);
	}
	function agendarP(pt) {
		clearTimeout(pt.retryT);
		pt.retryT = setTimeout(function () {
			conectarP(pt);
		}, atrasoP(pt));
	}
	function desligarP(pt) {
		pt.gen++;
		clearTimeout(pt.retryT);
		clearInterval(pt.pingT);
		if (pt.ws) {
			try {
				pt.ws.onclose = null;
				pt.ws.close();
			} catch (e) {
				ignorarErro(e, 'desligarP');
			}
			pt.ws = null;
		}
		if (pt.status !== 'off') pt.status = 'off';
	}
	function conectarP(pt) {
		if (!valida(pt) || !ativoMcp()) {
			desligarP(pt);
			return;
		}
		pt.gen++;
		const gen = pt.gen;
		clearTimeout(pt.retryT);
		clearInterval(pt.pingT);
		if (pt.ws) {
			try {
				pt.ws.onclose = null;
				pt.ws.close();
			} catch (e) {
				ignorarErro(e, 'conectarP');
			}
			pt.ws = null;
		}
		if (pt.forcePoll) {
			pollP(pt, gen);
			return;
		}
		pt.status = 'connecting';
		pintar();
		let ws = null;
		try {
			ws = new WebSocket(
				pt.url.replace(/^http/i, 'ws') + '/bridge/' + MCP.sid + '/' + MCP.token + '/ws',
			);
		} catch (e) {
			pt.forcePoll = true;
			pollP(pt, gen);
			return;
		}
		pt.ws = ws;
		pt.lastBeat = Date.now();
		const helloT = setTimeout(function () {
			if (pt.ws !== ws || pt.gen !== gen) return;
			try {
				ws.onclose = null;
				ws.close();
			} catch (e) {
				ignorarErro(e, 'conectarP');
			}
			pt.ws = null;
			pt.fails++;
			if (pt.fails >= 2) {
				pt.forcePoll = true;
				pollP(pt, gen);
			} else agendarP(pt);
		}, 4000);
		ws.onmessage = function (ev) {
			if (pt.ws !== ws || pt.gen !== gen) return;
			pt.lastBeat = Date.now();
			let m = null;
			try {
				m = JSON.parse(ev.data);
			} catch (e) {
				return;
			}
			if (!m) return;
			if (m.t === 'hello') {
				clearTimeout(helloT);
				const era = pt.status;
				pt.status = 'online';
				pt.fails = 0;
				if (era !== 'online') logf('ok', `No de reserva ${pt.i}${1} conectado (${nomeNo(pt.url)})`);
				pintar();
				catalogoP(pt, false);
				return;
			}
			if (m.t === 'ping') {
				try {
					ws.send(JSON.stringify({ t: 'pong' }));
				} catch (e) {
					ignorarErro(e, 'onmessage');
				}
				return;
			}
			if (m.t === 'pong') return;
			if (m.t === 'stats') {
				pt.stats = m;
				return;
			}
			if (m.t === 'rpc') {
				let pks = [];
				try {
					pks = mcpPacotesRpc(m);
				} catch (e) {
					pks = [m];
				}
				for (let i = 0; i < pks.length; i++) rpcP(pt, pks[i]);
				return;
			}
		};
		ws.onclose = function () {
			if (pt.ws !== ws || pt.gen !== gen) return;
			clearTimeout(helloT);
			clearInterval(pt.pingT);
			const semHello = pt.status !== 'online';
			pt.ws = null;
			if (!valida(pt) || !ativoMcp()) {
				pt.status = 'off';
				pintar();
				return;
			}
			pt.status = 'error';
			pintar();
			if (semHello) {
				pt.fails++;
				if (pt.fails >= 2) {
					pt.forcePoll = true;
					pollP(pt, pt.gen);
					return;
				}
			} else pt.fails++;
			agendarP(pt);
		};
		ws.onerror = function () {};
		pt.pingT = setInterval(function () {
			if (pt.ws !== ws) {
				clearInterval(pt.pingT);
				return;
			}
			try {
				ws.send(JSON.stringify({ t: 'ping' }));
			} catch (e) {
				ignorarErro(e, 'conectarP');
			}
		}, 25000);
	}
	async function pollP(pt, gen) {
		if (pt.status !== 'online') {
			pt.status = 'connecting';
			pintar();
		}
		while (true) {
			if (!ativoMcp() || !valida(pt) || pt.gen !== gen) return;
			try {
				const ctl = new AbortController();
				const t = setTimeout(function () {
					try {
						ctl.abort();
					} catch (e) {
						ignorarErro(e, 'pollP');
					}
				}, 35000);
				const r = await fetch(pt.url + '/bridge/' + MCP.sid + '/' + MCP.token + '/poll', {
					method: 'POST',
					headers: MCP_HDRS(),
					body: JSON.stringify({ wait: 20000 }),
					signal: ctl.signal,
				});
				clearTimeout(t);
				if (!r.ok) throw new Error('HTTP ' + r.status);
				const j = await r.json();
				if (!ativoMcp() || pt.gen !== gen) return;
				pt.lastBeat = Date.now();
				if (pt.status !== 'online') {
					pt.status = 'online';
					pt.fails = 0;
					logf('ok', `No de reserva ${pt.i}${1} conectado (modo compativel)`);
					pintar();
					catalogoP(pt, false);
				}
				if (j && Array.isArray(j.events)) {
					for (let i = 0; i < j.events.length; i++) {
						let pks = [];
						try {
							pks = mcpPacotesRpc(j.events[i]);
						} catch (e) {
							pks = [j.events[i]];
						}
						for (let k = 0; k < pks.length; k++) rpcP(pt, pks[k]);
					}
				}
			} catch (e) {
				if (!ativoMcp() || pt.gen !== gen) return;
				pt.fails++;
				if (pt.status !== 'connecting') {
					pt.status = 'connecting';
					pintar();
				}
				await new Promise(function (rs) {
					setTimeout(rs, atrasoP(pt));
				});
			}
		}
	}

	try {
		const _agendaAntiga = mcpScheduleRetry;
		mcpScheduleRetry = function () {
			FLV.falhasP++;
			if (FLV.falhasP <= 2) {
				_agendaAntiga();
				return;
			}
			clearTimeout(MCP.retryT);
			const esp =
				Math.min(60000, (MCP_MOBILE ? 2500 : 5000) * Math.pow(1.6, Math.min(FLV.falhasP - 2, 8))) *
				(0.75 + Math.random() * 0.5);
			MCP.retryT = setTimeout(function () {
				if (MCP.active) mcpConnect();
			}, esp);
		};
	} catch (e) {
		ignorarErro(e, 'auroraFailover');
	}

	async function provarPrincipal() {
		try {
			const ctl = new AbortController();
			const t = setTimeout(function () {
				try {
					ctl.abort();
				} catch (e) {
					ignorarErro(e, 'provarPrincipal');
				}
			}, 6000);
			const r = await fetch(mcpBase() + '/salud', {
				method: 'GET',
				cache: 'no-store',
				mode: 'cors',
				credentials: 'omit',
				signal: ctl.signal,
			});
			clearTimeout(t);
			return !!(r && r.status && r.status !== 429 && r.status !== 503 && r.status !== 530);
		} catch (e) {
			return false;
		}
	}
	function nivelDe(st) {
		if (!st) return 0;
		if (st.critico) return 2;
		if (st.quente) return 1;
		return 0;
	}
	function decidir() {
		const caido = !!(FLV.caidoDesde && Date.now() - FLV.caidoDesde > 15000);
		const nP = nivelDe(FLV.statsP);
		const on = pOnline();
		const quer = (caido || nP >= 2) && on ? 'reserva' : 'principal';
		if (quer !== FLV.ativa) {
			FLV.ativa = quer;
			if (quer === 'reserva') {
				const portaoOk = !!(FLV.portao && FLV.portaoInfo && FLV.portaoInfo.ok);
				const portaoFail = !!(FLV.portaoInfo && FLV.portaoInfo.failover);
				if (portaoOk && portaoFail) {
					logf(
						'err',
						`Failover ativo: no principal ${caido ? 'sem resposta' : 'no limite de capacidade'} — o PORTAO \
esta desviando para o no de reserva ${on.i}${1} (${nomeNo(on.url)}) pela MESMA URL do conector.`,
					);
					toastf(
						'Failover ativo',
						'Portao desviando pela mesma URL — nenhuma acao e necessaria.',
						'err',
					);
				} else if (portaoOk && !portaoFail) {
					logf(
						'warn',
						'Ponte local instavel (troca WS->SSE->polling) — portao confirma principal respondendo. Sem acao necessaria.',
					);
					FLV.ativa = 'principal';
				} else if (!caido) {
					logf(
						'err',
						`Failover ativo: no principal no limite de capacidade — o encaminhador interno do no esta desviando para o no de reserva ${on.i}${1} (${nomeNo(on.url)}) pela MESMA URL.`,
					);
					toastf('Failover ativo', `No de reserva ${on.i}${1} assumiu automaticamente.`, 'err');
				} else {
					logf(
						'err',
						`ATENCAO: no principal indisponivel (provavel bloqueio de borda). SEM portao, a URL unica do conector \
esta FORA DO AR — o encaminhador interno mora no proprio no bloqueado e nao roda. A sessao segue viva \
no no de reserva ${on.i}${1} (${nomeNo(on.url)}). URL direta de emergencia: ${urlEmergencia() || '(indisponivel)'}`,
					);
					toastf(
						'URL unica fora do ar',
						'Sem portao a mesma URL nao tem como atender. Veja o log do MCP.',
						'err',
					);
				}
				if (FLV.portao) {
					FLV.portaoEm = 0;
					provarPortao(true);
				}
			} else {
				logf('ok', 'No principal recuperado — operacao normal; reservas seguem de prontidao.');
				toastf('No principal recuperado', 'Operacao normal restabelecida.', 'ok');
			}
		}
		faixa(caido, nP);
	}

	function garantirFaixa() {
		if ($id('flvFaixa')) return;
		try {
			const st = document.createElement('style');
			st.id = 'flvFaixaCss';
			st.textContent =
				'#flvFaixa{position:fixed;left:0;right:0;top:0;z-index:2147483000;display:none;padding:' +
				'9px 44px 9px 14px;text-align:center;font:600 12.5px/1.4 -apple-system,' +
				'BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color:#fff;box-shadow:0 2px 14px ' +
				'rgba(0,0,0,.35)}#flvFaixa.err{background:#8f2320}#flvFaixa.warn{background:#7a5800}' +
				'#flvFaixa.ok{background:#1e6b41}#flvFaixa b{font-weight:800}#flvFaixaX{position:' +
				'absolute;right:8px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.14);' +
				'border:0;color:#fff;border-radius:6px;width:26px;height:26px;cursor:pointer;font:700 ' +
				'13px/1 inherit}';
			document.head.appendChild(st);
			const d = document.createElement('div');
			d.id = 'flvFaixa';
			d.innerHTML =
				'<span id="flvFaixaTx"></span><button id="flvFaixaX" title="Ocultar por 10 min">×</button>';
			document.body.appendChild(d);
			d.querySelector('#flvFaixaX').addEventListener('click', function () {
				FLV.snooze = Date.now() + 600000;
				d.style.display = 'none';
			});
		} catch (e) {
			ignorarErro(e, 'garantirFaixa');
		}
	}
	function faixa(caido, nP) {
		garantirFaixa();
		const d = $id('flvFaixa'),
			tx = $id('flvFaixaTx');
		if (!d || !tx) return;
		if (Date.now() < FLV.snooze) {
			d.style.display = 'none';
			return;
		}
		let s = '',
			cls = '';
		if (FLV.ativa === 'reserva') {
			cls = 'err';
			const on = pOnline();
			const pInfo = FLV.portaoInfo;
			const portaoOk = !!(FLV.portao && pInfo && pInfo.ok);
			if (portaoOk) {
				const svNome =
					pInfo.failover && pInfo.servindo
						? nomeNo(pInfo.servindo)
						: 'no de reserva ' + (on ? on.i + 1 : 1);
				s = `⚠️ Failover ativo: o no principal esta ${caido ? 'indisponivel' : 'no limite de capacidade'} \
— o <b>portao esta desviando para ${svNome}</b> pela mesma URL (verificado no portao). Nenhuma acao \
e necessaria.`;
			} else if (FLV.portao && !pInfo) {
				s = `⚠️ Failover: o no principal esta ${caido ? 'indisponivel' : 'no limite de capacidade'} — verificando no portao se a URL unica segue atendendo...`;
			} else if (FLV.portao) {
				s = `🛑 <b>URL unica possivelmente fora do ar:</b> o portao (${nomeNo(FLV.portao)}) nao respondeu \
a sonda. Confira o deploy (wrangler-portao.toml). Emergencia: URL direta do no de reserva vivo: ${urlEmergencia() || '(nenhum no de reserva vivo)'}`;
			} else if (caido) {
				s = `🛑 <b>No principal indisponivel (provavel bloqueio de borda) — SEM portao, a URL unica do conector \
esta FORA DO AR.</b> O encaminhador interno mora no proprio no bloqueado e nao chega a rodar. A sessao \
esta preservada no no de reserva ${on ? on.i + 1 : 1}. Solucao definitiva: configure o <b>portao</b>\
 (menu MCP, gratis). Emergencia agora: ${urlEmergencia() || '(nenhum no de reserva vivo)'}`;
			} else {
				s = `⚠️ Failover ativo: o no principal esta no limite de capacidade — <b>no de reserva ${on ? on.i + 1 : 1} \
atendendo</b> pela mesma URL (encaminhador interno do no, que segue rodando). Nenhuma acao e necessaria.`;
			}
			let todas = nP >= 2 && FLV.pontes.length > 0;
			FLV.pontes.forEach(function (pt) {
				if (nivelDe(pt.stats) < 2) todas = false;
			});
			if (todas)
				s =
					'⚠\ufe0f Todos os nos estao no limite de capacidade — reduza chamadas em paralelo por alguns minutos.';
		} else if (nP === 1) {
			cls = 'warn';
			const stp = FLV.statsP || {};
			const mm = (stp.minuto && stp.minuto.usados) || 0,
				dd = (stp.dia && stp.dia.usados) || 0,
				dl = (stp.dia && stp.dia.limite) || 100000;
			s =
				'⏰ Capacidade proxima do limite: ' +
				mm +
				' req/min' +
				(dd ? ` · ${dd}/${dl} hoje` : '') +
				(FLV.urls.length
					? ' — nos de reserva de prontidao (failover automatico).'
					: ' — <b>adicione nos de reserva</b> no menu MCP para failover automatico.');
		} else {
			d.style.display = 'none';
			return;
		}
		tx.innerHTML = s;
		d.className = cls;
		d.style.display = 'block';
	}

	function ligarUI() {
		const ing = $id('mcpPortao');
		if (ing && !ing.getAttribute('data-flv')) {
			ing.setAttribute('data-flv', '1');
			ing.value = FLV.portao;
			let debG = null;
			ing.addEventListener('input', function () {
				clearTimeout(debG);
				debG = setTimeout(function () {
					const v = lim2(ing.value);
					FLV.portao = ehUrl2(v) ? v : '';
					salvarPortao();
					FLV.portaoInfo = null;
					FLV.portaoEm = 0;
					if (ativoMcp() && FLV.portao) provarPortao(true);
					try {
						if (typeof mcpRenderPanel === 'function') mcpRenderPanel();
					} catch (e) {
						ignorarErro(e, 'ligarUI');
					}
					pintar();
				}, 700);
			});
		}
		const inp = $id('mcpReservas');
		if (!inp) return;
		if (!inp.getAttribute('data-flv')) {
			inp.setAttribute('data-flv', '1');
			inp.value = FLV.urls.join('\n');
			let deb = null;
			inp.addEventListener('input', function () {
				clearTimeout(deb);
				deb = setTimeout(function () {
					FLV.urls = normalizar(String(inp.value).split(/[\n,]+/));
					salvar();
					FLV.metaKey = '';
					pontesSync();
					FLV.pontes.forEach(function (pt) {
						pt.catKey = '';
						pt.forcePoll = false;
						pt.fails = 0;
						if (ativoMcp()) conectarP(pt);
					});
					metaPrincipal();
					pintar();
				}, 700);
			});
		}
	}
	function pintar() {
		try {
			ligarUI();
			const msg = $id('mcpFlvMsg');
			if (msg) {
				let t = '',
					k = '';
				const tot = FLV.pontes.length || FLV.urls.length;
				let igual = false;
				try {
					igual = FLV.urls.some(function (u) {
						return u === lim2(MCP.relay || '');
					});
				} catch (e) {
					ignorarErro(e, 'pintar');
				}
				if (igual) {
					t =
						'Um dos enderecos de reserva e IGUAL ao no principal — remova-o (use o worker de outra conta).';
					k = 'err';
				} else if (!tot) {
					t =
						'Nenhum no de reserva configurado — failover desligado. Adicione enderecos acima ou via RESERVAS no wrangler.toml.';
				} else if (!ativoMcp()) {
					t =
						tot +
						' no(s) de reserva configurado(s) — as pontes conectam quando o MCP for ativado. O conector do Notion usa UMA unica URL.';
				} else {
					let on = 0,
						conn = 0,
						err = 0;
					FLV.pontes.forEach(function (pt) {
						if (pt.status === 'online') on++;
						else if (pt.status === 'connecting') conn++;
						else if (pt.status === 'error') err++;
					});
					if (on === tot && tot > 0) {
						t =
							(FLV.ativa === 'reserva' ? 'FAILOVER ATIVO — no de reserva atendendo. ' : '') +
							tot +
							' no(s) de reserva conectado(s) e de prontidao — failover automatico pronto (URL unica).';
						k = 'ok';
					} else if (on > 0) {
						t =
							on +
							' de ' +
							tot +
							' no(s) de reserva conectado(s)' +
							(conn ? ` · ${conn} conectando` : '') +
							(err ? ` · ${err} sem resposta` : '') +
							'.';
						k = 'ok';
					} else if (conn) {
						t = 'Conectando aos nos de reserva...';
					} else {
						t = 'Nos de reserva sem resposta — verifique os enderecos e o deploy do worker.js.';
						k = 'err';
					}
				}
				msg.className = 'mcp-teste' + (k ? ' ' + k : '');
				msg.textContent = t;
			}
			const pmsg = $id('mcpPortaoMsg');
			if (pmsg) {
				let tp = '',
					kp = '';
				const pi = FLV.portaoInfo;
				if (!FLV.portao) {
					tp =
						'Sem portao: o failover em URL unica cobre limite de capacidade, mas NAO cobre bloqueio ' +
						'de borda do no principal (a URL cai junto). Publique o portao numa conta separada ' +
						'(wrangler-portao.toml) e cole a URL acima.';
				} else if (!ativoMcp()) {
					tp = 'Portao configurado — a URL do Notion ja sai pelo portao quando o MCP for ativado.';
					kp = 'ok';
				} else if (!pi) {
					tp = `Portao configurado — sondando ${nomeNo(FLV.portao)}...`;
				} else if (pi.ok) {
					tp = `Portao OK — failover total em URL unica (cobre ate bloqueio de borda)${pi.servindo ? ' · servindo por ' + nomeNo(pi.servindo) : ''}${pi.failover ? ' · FAILOVER ATIVO' : ''}.`;
					kp = 'ok';
				} else {
					tp = `Portao SEM RESPOSTA (${nomeNo(FLV.portao)}) — confira a URL e o deploy (wrangler-portao.toml). Enquanto isso, a URL unica segue sem protecao de borda.`;
					kp = 'err';
				}
				pmsg.className = 'mcp-teste' + (kp ? ' ' + kp : '');
				pmsg.textContent = tp;
			}
		} catch (e) {
			ignorarErro(e, 'pintar');
		}
	}

	let chaveViva = '';
	setInterval(function () {
		try {
			if (FLV.pontes.length !== FLV.urls.length) pontesSync();
			const quer = ativoMcp() && FLV.urls.length > 0;
			const chave = quer ? FLV.urls.join(',') + '|' + MCP.sid + '|' + MCP.token : '';
			FLV.pontes.forEach(function (pt) {
				if (quer && pt.status === 'off') conectarP(pt);
				if (!quer && pt.status !== 'off') desligarP(pt);
			});
			if (quer && chaveViva && chave !== chaveViva) {
				FLV.metaKey = '';
				FLV.pontes.forEach(function (pt) {
					pt.catKey = '';
					pt.forcePoll = false;
					pt.fails = 0;
					conectarP(pt);
				});
			}
			chaveViva = chave;
			FLV.pontes.forEach(function (pt) {
				if (pt.status === 'online' && pt.ws && Date.now() - pt.lastBeat > 45000) {
					logf('err', `No de reserva ${pt.i}${1} sem batimento ha 45s — reconectando`);
					pt.fails++;
					conectarP(pt);
				}
			});
			let st = 'off';
			try {
				st = MCP.status;
			} catch (e) {
				ignorarErro(e, 'auroraFailover');
			}
			if (!ativoMcp()) {
				FLV.caidoDesde = 0;
			} else if (st === 'online') {
				FLV.caidoDesde = 0;
				FLV.falhasP = 0;
			} else if (!FLV.caidoDesde) {
				const _pOk = !!(
					FLV.portao &&
					FLV.portaoInfo &&
					FLV.portaoInfo.ok &&
					!FLV.portaoInfo.failover
				);
				if (!_pOk) FLV.caidoDesde = Date.now();
			}
			try {
				const w = MCP.ws;
				if (w && !w.__flvStats) {
					w.__flvStats = 1;
					w.addEventListener('message', function (ev) {
						try {
							const m = JSON.parse(ev.data);
							if (m && m.t === 'stats') FLV.statsP = m;
						} catch (e) {
							ignorarErro(e, 'auroraFailover');
						}
					});
				}
			} catch (e) {
				ignorarErro(e, 'auroraFailover');
			}
			if (ativoMcp()) {
				metaPrincipal();
				provarPortao(false);
			}
			if (FLV.ativa === 'reserva' && Date.now() - FLV.provaEm > 30000) {
				FLV.provaEm = Date.now() + Math.floor(Math.random() * 8000);
				provarPrincipal().then(function (ok) {
					if (ok) {
						FLV.provaOk++;
						if (FLV.provaOk >= 2) {
							FLV.provaOk = 0;
							FLV.caidoDesde = 0;
							try {
								if (MCP.active && MCP.status !== 'online') mcpConnect();
							} catch (e) {
								ignorarErro(e, 'auroraFailover');
							}
						}
					} else FLV.provaOk = 0;
				});
			}
			decidir();
			pintar();
			let onCount = 0;
			FLV.pontes.forEach(function (pt) {
				if (pt.status === 'online') onCount++;
			});
			const assUI = String(onCount > 0) + '|' + FLV.ativa + '|' + String(st) + '|' + onCount;
			if (assUI !== FLV.__assUI) {
				FLV.__assUI = assUI;
				try {
					if (typeof mcpRenderPanel === 'function') mcpRenderPanel();
				} catch (e) {
					ignorarErro(e, 'auroraFailover');
				}
			}
		} catch (e) {
			ignorarErro(e, 'auroraFailover');
		}
	}, 2000);

	setTimeout(function () {
		try {
			pontesSync();
			pintar();
			if (ativoMcp())
				FLV.pontes.forEach(function (pt) {
					conectarP(pt);
				});
		} catch (e) {
			ignorarErro(e, 'auroraFailover');
		}
	}, 300);
	try {
		window.SYNAPSE_FAILOVER = {
			estado: function () {
				return {
					reservas: FLV.pontes.map(function (pt) {
						return { url: pt.url, status: pt.status, transporte: pt.forcePoll ? 'poll' : 'ws' };
					}),
					ativa: FLV.ativa,
					statsPrincipal: FLV.statsP,
					portao: { url: FLV.portao || '(nenhum)', info: FLV.portaoInfo },
					urlUnica: ativoMcp() && typeof mcpPublicUrl === 'function' ? mcpPublicUrl() : '',
				};
			},
			definirReservas: function (lista) {
				FLV.urls = normalizar(lista);
				salvar();
				FLV.metaKey = '';
				pontesSync();
				const inp = $id('mcpReservas');
				if (inp) inp.value = FLV.urls.join('\n');
				FLV.pontes.forEach(function (pt) {
					pt.catKey = '';
					pt.forcePoll = false;
					pt.fails = 0;
					if (ativoMcp()) conectarP(pt);
				});
				metaPrincipal();
				pintar();
				return FLV.urls.slice();
			},
			definirReserva: function (u) {
				return this.definirReservas(u ? [u] : []);
			},
			definirPortao: function (u) {
				u = lim2(u || '');
				FLV.portao = ehUrl2(u) ? u : '';
				salvarPortao();
				FLV.portaoInfo = null;
				FLV.portaoEm = 0;
				const ig = $id('mcpPortao');
				if (ig) ig.value = FLV.portao;
				if (ativoMcp() && FLV.portao) provarPortao(true);
				try {
					if (typeof mcpRenderPanel === 'function') mcpRenderPanel();
				} catch (e) {
					ignorarErro(e, 'definirPortao');
				}
				pintar();
				return FLV.portao || '(portao removido)';
			},
			sondarPortao: function () {
				if (!FLV.portao) return 'nenhum portao configurado';
				FLV.portaoEm = 0;
				provarPortao(true);
				return `sondando o portao ${nomeNo(FLV.portao)}...`;
			},
			forcarCatalogo: function () {
				FLV.metaKey = '';
				metaPrincipal();
				FLV.pontes.forEach(function (pt) {
					pt.catKey = '';
					catalogoP(pt, true);
				});
				return 'republicando catalogo e lista de reservas...';
			},
			sondarAgora: function () {
				FLV.provaEm = 0;
				return 'sondando o no principal...';
			},
			novaSessao: function () {
				FLV.metaKey = '';
				FLV.pontes.forEach(function (pt) {
					pt.catKey = '';
					pt.fails = 0;
					pt.forcePoll = false;
					try {
						pt.seen.clear();
					} catch (e) {
						ignorarErro(e, 'novaSessao');
					}
					if (ativoMcp()) conectarP(pt);
				});
				pintar();
			},
		};
	} catch (e) {
		ignorarErro(e, 'auroraFailover');
	}
	try {
		window.__flvUI = function () {
			const pi = FLV.portaoInfo;
			return {
				online: !!pOnline(),
				ativa: FLV.ativa,
				ligada: FLV.urls.length > 0,
				url: '',
				portao: FLV.portao
					? {
							ok: !!(pi && pi.ok),
							sondado: !!pi,
							servindo: (pi && pi.servindo) || '',
							failover: !!(pi && pi.failover),
						}
					: null,
			};
		};
	} catch (e) {
		ignorarErro(e, 'auroraFailover');
	}
	try {
		window.__flvReservas = function () {
			return FLV.urls.slice();
		};
	} catch (e) {
		ignorarErro(e, 'auroraFailover');
	}
	try {
		const _ativarAntigo = mcpActivate,
			_desativarAntigo = mcpDeactivate;
		mcpActivate = function (silent) {
			_ativarAntigo(silent);
			try {
				pontesSync();
				FLV.metaKey = '';
				FLV.pontes.forEach(function (pt) {
					pt.fails = 0;
					pt.forcePoll = false;
					conectarP(pt);
				});
				metaPrincipal();
				FLV.portaoEm = 0;
				provarPortao(true);
			} catch (e) {
				ignorarErro(e, 'auroraFailover');
			}
			pintar();
		};
		mcpDeactivate = function () {
			_desativarAntigo();
			try {
				FLV.pontes.forEach(function (pt) {
					desligarP(pt);
				});
			} catch (e) {
				ignorarErro(e, 'auroraFailover');
			}
			pintar();
		};
	} catch (e) {
		ignorarErro(e, 'auroraFailover');
	}
	try {
		document.addEventListener('visibilitychange', function () {
			if (!document.hidden && ativoMcp()) {
				FLV.pontes.forEach(function (pt) {
					if (pt.status !== 'online') {
						pt.fails = 0;
						conectarP(pt);
					}
				});
				provarPortao(true);
			}
		});
		window.addEventListener('online', function () {
			if (ativoMcp()) {
				FLV.pontes.forEach(function (pt) {
					if (pt.status !== 'online') {
						pt.fails = 0;
						conectarP(pt);
					}
				});
				provarPortao(true);
			}
		});
	} catch (e) {
		ignorarErro(e, 'auroraFailover');
	}
})();
