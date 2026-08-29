'use strict';

const APPN = { ativo: false, ultimo: null, autoFeito: false, userOff: false };
function appPonte() {
	try {
		return window.AuroraApp && window.AuroraApp.isApp ? window.AuroraApp : null;
	} catch (e) {
		return null;
	}
}
function appEstado() {
	const p = appPonte();
	if (!p) return null;
	try {
		const s = p.state ? p.state() : null;
		return s && typeof s === 'object' ? s : null;
	} catch (e) {
		return null;
	}
}
function appLog(m) {
	const p = appPonte();
	if (p && p.log)
		try {
			p.log(String(m));
		} catch (e) {
			ignorarErro(e, 'appLog');
		}
}
function appAplicar(s) {
	if (!s) return false;
	const novo = !APPN.ativo;
	APPN.ativo = true;
	APPN.ultimo = s;
	const base = String(s.relayUrl || 'http://127.0.0.1:' + (s.port || 8787)).replace(/\/+$/, '');
	let mudou = false;
	if (MCP.relay !== base) {
		MCP.relay = base;
		mudou = true;
	}
	const pub = String(s.publicUrl || '')
		.trim()
		.replace(/\/+$/, '');
	if ((MCP.pub || '') !== pub) {
		MCP.pub = pub;
		mudou = true;
	}
	if (s.sid && s.token && (MCP.sid !== s.sid || MCP.token !== s.token)) {
		MCP.sid = s.sid;
		MCP.token = s.token;
		mudou = true;
	}
	if (mudou) mcpSaveCfg();
	const ri = document.getElementById('mcpRelay');
	if (ri && ri.value !== MCP.relay) ri.value = MCP.relay;
	const pi = document.getElementById('mcpPub');
	if (pi && pi.value !== (MCP.pub || '')) pi.value = MCP.pub || '';
	if (novo) {
		try {
			mcpLog(
				'ok',
				`App Synapse Relay detectado (v${s.appVersion || '?'}) - usando o relay do proprio aparelho: ${base}`,
			);
		} catch (e) {
			ignorarErro(e, 'appAplicar');
		}
		const dica = document.getElementById('mcpAppDica');
		if (dica) dica.classList.remove('hidden');
	}
	if (s.running) {
		if (!MCP.active && !APPN.userOff) {
			APPN.autoFeito = true;
			mcpActivate(true);
			return true;
		}
		if (MCP.active && mudou) {
			mcpConnect();
			return true;
		}
	} else if (MCP.active && APPN.autoFeito) {
		try {
			mcpLog('err', 'O relay do app foi parado - MCP desativado. Toque em Iniciar relay no app.');
		} catch (e) {
			ignorarErro(e, 'appAplicar');
		}
		mcpDeactivate();
		return true;
	}
	try {
		mcpRenderPanel();
	} catch (e) {
		ignorarErro(e, 'appAplicar');
	}
	return true;
}
function appIniciar() {
	const s = appEstado();
	if (s) appAplicar(s);
}
function appStatusTexto() {
	const s = APPN.ultimo;
	if (!APPN.ativo || !s) return '';
	if (!s.running) return 'App detectado - relay parado (toque em Iniciar relay no app)';
	if (s.publicUrl) return 'App: relay ligado + tunel pronto';
	return `App: relay ligado - tunel ${String(s.tunnel || '') || 'iniciando'}...`;
}
try {
	window.addEventListener('aurora:app-ready', function (ev) {
		appAplicar((ev && ev.detail) || appEstado());
	});
	window.addEventListener('aurora:app-state', function (ev) {
		appAplicar((ev && ev.detail) || appEstado());
	});
	document.addEventListener('visibilitychange', function () {
		if (!document.hidden) appIniciar();
	});
} catch (e) {
	ignorarErro(e, 'ponte-relay');
}
function mcpActivate(silent) {
	try {
		mcpTransporteNuvem(true);
	} catch (e) {
		ignorarErro(e, 'mcpActivate');
	}
	const base = mcpBase();
	if (!/^https?:\/\//i.test(base)) {
		toast(
			'URL do relay inválida',
			'Informe a URL pública do relay (ex.: https://meu-relay.onrender.com)',
			'err',
		);
		const i = $('#mcpRelay');
		if (i) i.focus();
		return;
	}
	MCP.active = true;
	MCP.forcePoll = false;
	MCP.forceSse = false;
	MCP.wsFails = 0;
	mcpSaveCfg();
	mcpConnect();
	if (/^https?:\/\/(localhost|127\.)/i.test(mcpPubBase()))
		mcpLog(
			'err',
			'A URL para o Notion está apontando para localhost — preencha a URL pública do túnel no segundo campo.',
		);
	if (!silent) toast('MCP ativado', 'Copie a URL e cole no conector MCP do Notion', 'ok');
	mcpRenderPanel();
}
function mcpMarcarOff() {
	try {
		APPN.userOff = true;
	} catch (e) {
		ignorarErro(e, 'mcpMarcarOff');
	}
}
function mcpDeactivate() {
	MCP.active = false;
	mcpSaveCfg();
	clearTimeout(MCP.retryT);
	clearTimeout(MCP.helloT);
	MCP.pollGen = (MCP.pollGen || 0) + 1;
	if (MCP.es) {
		try {
			MCP.es.close();
		} catch (e) {
			ignorarErro(e, 'mcpDeactivate');
		}
		MCP.es = null;
	}
	if (MCP.ws) {
		try {
			MCP.ws.onclose = null;
			MCP.ws.close();
		} catch (e) {
			ignorarErro(e, 'mcpDeactivate');
		}
		MCP.ws = null;
	}
	clearInterval(MCP.pingT);
	MCP.status = 'off';
	mcpLog('ok', 'MCP desativado');
	mcpRenderPanel();
}
function mcpConnect() {
	clearTimeout(MCP.retryT);
	clearTimeout(MCP.helloT);
	MCP.pollGen = (MCP.pollGen || 0) + 1;
	if (MCP.es) {
		try {
			MCP.es.close();
		} catch (e) {
			ignorarErro(e, 'mcpConnect');
		}
		MCP.es = null;
	}
	if (!MCP.active) return;
	if (!MCP.forcePoll && /ngrok/i.test(mcpBase())) {
		MCP.forcePoll = true;
		mcpLog(
			'ok',
			'Túnel ngrok detectado — usando o modo compatível (polling), que passa pela página de aviso do ngrok',
		);
	}
	if (MCP.forcePoll) {
		mcpPollLoop();
		return;
	}
	MCP.status = 'connecting';
	mcpRenderPanel();
	let es;
	try {
		es = new EventSource(mcpBase() + '/bridge/' + MCP.sid + '/' + MCP.token + '/events');
	} catch (e) {
		MCP.status = 'error';
		mcpLog('err', 'Falha ao conectar: ' + ((e && e.message) || e));
		mcpScheduleRetry();
		mcpRenderPanel();
		return;
	}
	MCP.es = es;
	MCP.lastBeat = Date.now();
	let alive = false;
	const mark = () => {
		alive = true;
		MCP.lastBeat = Date.now();
	};
	MCP.helloT = setTimeout(() => {
		if (alive || !MCP.active || MCP.es !== es) return;
		try {
			es.close();
		} catch (e) {
			ignorarErro(e, 'mcpConnect');
		}
		MCP.es = null;
		MCP.forcePoll = true;
		MCP.pollDesde = Date.now();
		mcpLog('err', 'Streaming lento — polling TEMPORARIO; volto ao WebSocket sozinho');
		mcpPollLoop();
	}, MCP_HELLO_MS);
	es.addEventListener('hello', () => {
		mark();
		MCP.status = 'online';
		mcpLog('ok', 'Conectado ao relay');
		mcpRenderPanel();
	});
	es.addEventListener('ping', mark);
	es.addEventListener('rpc', (ev) => {
		mark();
		let pkt = null;
		try {
			pkt = JSON.parse(ev.data);
		} catch (e) {
			return;
		}
		for (const it of mcpPacotesRpc(pkt)) mcpOnRpc(it);
	});
	es.onopen = () => {
		if (MCP.status !== 'online') {
			MCP.status = 'online';
			mcpRenderPanel();
		}
	};
	clearInterval(MCP.watchT);
	MCP.watchT = setInterval(() => {
		if (!MCP.active) {
			clearInterval(MCP.watchT);
			return;
		}
		if (MCP.forcePoll) return;
		if (Date.now() - (MCP.lastBeat || 0) > 40000) {
			mcpLog('err', 'Conexão com o relay parou de responder — reconectando…');
			mcpConnect();
		}
	}, 10000);
	es.onerror = () => {
		if (!MCP.active) return;
		if (es.readyState === EventSource.CLOSED) {
			MCP.status = 'error';
			mcpScheduleRetry();
		} else {
			MCP.status = 'connecting';
		}
		mcpRenderPanel();
	};
}
async function mcpPollLoop() {
	const gen = (MCP.pollGen = (MCP.pollGen || 0) + 1);
	if (MCP.status !== 'online') {
		MCP.status = 'connecting';
		mcpRenderPanel();
	}
	while (MCP.active && gen === MCP.pollGen && MCP.forcePoll) {
		try {
			const ctl = new AbortController();
			const tid = setTimeout(() => ctl.abort(), 35000);
			const r = await fetch(mcpBase() + '/bridge/' + MCP.sid + '/' + MCP.token + '/poll', {
				method: 'POST',
				headers: MCP_HDRS(),
				body: JSON.stringify({ wait: MCP_MOBILE ? 12000 : 25000 }),
				signal: ctl.signal,
			});
			clearTimeout(tid);
			if (!r.ok) throw new Error('HTTP ' + r.status);
			const j = await r.json();
			if (MCP.active && j && Array.isArray(j.events)) {
				for (const ev of j.events) for (const it of mcpPacotesRpc(ev)) mcpOnRpc(it);
			}
			if (!MCP.active || gen !== MCP.pollGen) break;
			MCP.lastBeat = Date.now();
			if (MCP.status !== 'online') {
				MCP.status = 'online';
				mcpLog('ok', 'Conectado ao relay (modo compatível)');
				mcpRenderPanel();
			}
		} catch (e) {
			if (!MCP.active || gen !== MCP.pollGen) break;
			if (MCP.status !== 'connecting') {
				MCP.status = 'connecting';
				mcpRenderPanel();
			}
			await (typeof window.bgEspera === 'function'
				? window.bgEspera(3000)
				: new Promise((rs) => setTimeout(rs, 3000)));
		}
	}
}
function mcpScheduleRetry() {
	clearTimeout(MCP.retryT);
	MCP.retryT = setTimeout(
		() => {
			if (MCP.active) mcpConnect();
		},
		MCP_MOBILE ? 2500 : 5000,
	);
}
