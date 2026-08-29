'use strict';
const COMPL_PADRAO = 'http://localhost:8787';
const COMPL = { url: '', ok: false, ver: '', at: 0, checando: false, fails: 0, graceT: null };
const TERM_FALTA =
	'O Synapse Relay nao esta respondendo. Execute "node relay.js" (Node 18+), abra o menu MCP > modo Local e clique em Testar. Terminal e disco dependem do Relay; o restante do MCP segue pela nuvem.';
const MCP_TOOLS_COMPL = new Set([
	'run_command',
	'command_output',
	'stop_command',
	'start_dev_server',
	'dev_server_status',
	'stop_dev_server',
	'list_disk_projects',
	'open_project_from_disk',
	'model3d_convert',
	'deploy_static',
	'undeploy_static',
]);
function complCarregarCfg() {
	try {
		const v = localStorage.getItem('aurora.compl.url');
		COMPL.url = v == null ? COMPL_PADRAO : v;
	} catch (e) {
		COMPL.url = COMPL_PADRAO;
	}
}
function complSalvarCfg() {
	try {
		localStorage.setItem('aurora.compl.url', COMPL.url || '');
	} catch (e) {
		ignorarErro(e, 'complSalvarCfg');
	}
}
function complModoLocal() {
	try {
		return typeof window.mcpModoAtual === 'function' ? window.mcpModoAtual() === 'local' : true;
	} catch (e) {
		return true;
	}
}
function termBase() {
	const b = (MCP.relay || '').trim().replace(/\/+$/, '');
	if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(b)) return b;
	if (!complModoLocal()) return '';
	const u = (COMPL.url || '').trim().replace(/\/+$/, '');
	return /^https?:\/\//i.test(u) ? u : '';
}
function mcpEhLocal(u) {
	const s = String(u || '').trim();
	return /^https?:\/\/(localhost|127\.\d+\.\d+\.\d+|\[::1\]|0\.0\.0\.0|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:|\/|$)/i.test(
		s,
	);
}
function mcpTransporteNuvem(avisar) {
	try {
		if (appPonte()) return false;
		const atual = String(MCP.relay || '')
			.trim()
			.replace(/\/+$/, '');
		if (!mcpEhLocal(atual)) return false;
		const nuvem = String(MCP_RELAY_PADRAO || '')
			.trim()
			.replace(/\/+$/, '');
		if (!/^https?:\/\//i.test(nuvem)) return false;
		try {
			if (!String(COMPL.url || '').trim()) COMPL.url = atual;
			complSalvarCfg();
		} catch (e) {
			ignorarErro(e, 'mcpTransporteNuvem');
		}
		MCP.relay = nuvem;
		try {
			mcpSaveCfg();
		} catch (e) {
			ignorarErro(e, 'mcpTransporteNuvem');
		}
		try {
			const i1 = document.getElementById('mcpRelay');
			if (i1) i1.value = nuvem;
		} catch (e) {
			ignorarErro(e, 'mcpTransporteNuvem');
		}
		try {
			const i2 = document.getElementById('mcpRelayLocal');
			if (i2 && !String(i2.value || '').trim()) i2.value = atual;
		} catch (e) {
			ignorarErro(e, 'mcpTransporteNuvem');
		}
		if (avisar) {
			try {
				mcpLog(
					'err',
					`O endereco local (${atual}) estava no lugar do TRANSPORTE do MCP - era por isso que o Notion via \
0 ferramentas. Transporte movido para a nuvem (${nuvem}); o endereco local virou complemento (terminal \
e disco).`,
				);
			} catch (e) {
				ignorarErro(e, 'mcpTransporteNuvem');
			}
		}
		return true;
	} catch (e) {
		return false;
	}
}
try {
	window.mcpTransporteNuvem = mcpTransporteNuvem;
	window.mcpEhLocal = mcpEhLocal;
} catch (e) {
	ignorarErro(e, 'complemento');
}
function termTemComplemento() {
	return !!termBase() && COMPL.ok;
}
async function complSondar(silencioso) {
	const base = termBase();
	if (!base) {
		COMPL.fails = 0;
		clearTimeout(COMPL.graceT);
		const era0 = COMPL.ok;
		COMPL.ok = false;
		if (era0) complMudou();
		return false;
	}
	if (COMPL.checando) return COMPL.ok;
	COMPL.checando = true;
	const era = COMPL.ok;
	let vivo = false,
		ver = '';
	let ctl = null,
		t = null;
	try {
		ctl = new AbortController();
		t = setTimeout(function () {
			try {
				ctl.abort();
			} catch (e) {
				ignorarErro(e, 'complSondar');
			}
		}, 4500);
		const r = await fetch(base + '/stats', {
			method: 'GET',
			cache: 'no-store',
			mode: 'cors',
			credentials: 'omit',
			headers: { 'ngrok-skip-browser-warning': 'true' },
			signal: ctl.signal,
		});
		const j = await r.json();
		vivo = !!(r && r.ok && j);
		ver = String((j && (j.version || j.versao)) || '');
	} catch (e) {
		vivo = false;
	} finally {
		if (t) clearTimeout(t);
		COMPL.checando = false;
	}
	if (vivo) {
		clearTimeout(COMPL.graceT);
		COMPL.fails = 0;
		COMPL.ok = true;
		COMPL.ver = ver;
		COMPL.at = Date.now();
	} else {
		COMPL.fails = (COMPL.fails || 0) + 1;
		if (COMPL.fails >= 2) COMPL.ok = false;
		clearTimeout(COMPL.graceT);
		const esperaC = Math.min(60000, 2500 * Math.pow(2, Math.max(0, COMPL.fails - 1)));
		COMPL.proximo = Date.now() + esperaC;
		COMPL.graceT = setTimeout(function () {
			try {
				complSondar(true);
			} catch (e) {
				ignorarErro(e, 'complSondar');
			}
		}, esperaC);
	}
	if (COMPL.ok !== era) {
		if (!silencioso) {
			try {
				mcpLog(
					COMPL.ok ? 'ok' : 'err',
					COMPL.ok
						? `Serviço local ativo em ${base} ${COMPL.ver || ''} — terminal e disco disponíveis.`
						: `Serviço local sem resposta em ${base} — reconectando automaticamente; o MCP segue operando pela nuvem.`,
				);
			} catch (e) {
				ignorarErro(e, 'complSondar');
			}
		}
		complMudou();
	}
	return COMPL.ok;
}
function complMudou() {
	try {
		if (typeof window.auroraTermUI === 'function') window.auroraTermUI();
	} catch (e) {
		ignorarErro(e, 'complMudou');
	}
	try {
		if (typeof mcpRenderPanel === 'function') mcpRenderPanel();
	} catch (e) {
		ignorarErro(e, 'complMudou');
	}
	try {
		if (typeof window.mcpEnviarCatalogo === 'function') window.mcpEnviarCatalogo(true);
	} catch (e) {
		ignorarErro(e, 'complMudou');
	}
}
try {
	complCarregarCfg();
} catch (e) {
	ignorarErro(e, 'complemento');
}
try {
	window.auroraCompl = COMPL;
	window.auroraComplSondar = complSondar;
	window.auroraTermBase = termBase;
} catch (e) {
	ignorarErro(e, 'complemento');
}
setInterval(function () {
	try {
		if (COMPL.checando) return;
		if (Date.now() < (COMPL.proximo || 0)) return;
		if (!COMPL.ok || Date.now() - (COMPL.at || 0) > 18000) complSondar(true);
	} catch (e) {
		ignorarErro(e, 'complemento');
	}
}, 5000);
function mcpPubBase() {
	const p = (MCP.pub || '').trim().replace(/\/+$/, '');
	return /^https?:\/\//i.test(p) ? p : mcpBase();
}
function mcpPortaoBase() {
	try {
		let g = typeof window.__flvPortao === 'function' ? window.__flvPortao() : '';
		g = String(g || '')
			.trim()
			.replace(/\/+$/, '');
		return /^https?:\/\//i.test(g) ? g : '';
	} catch (e) {
		return '';
	}
}
function mcpPublicUrl() {
	const g = mcpPortaoBase();
	return (g || mcpPubBase()) + '/mcp/' + MCP.sid + '/' + MCP.token;
}
function mcpLog(kind, text) {
	MCP.log.unshift({ t: Date.now(), kind: kind, text: String(text) });
	if (MCP.log.length > 250) MCP.log.length = 250;
	mcpRenderLog();
}
