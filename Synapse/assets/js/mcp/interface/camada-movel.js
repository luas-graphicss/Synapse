'use strict';

(function mcpCamadaMovel() {
	if (!MCP_MOBILE) return;

	try {
		const st = document.createElement('style');
		st.id = 'aurora-mcp-mobile';
		st.textContent = `body.mcp-movel label[for="mcpPub"],body.mcp-movel #mcpPub,body.mcp-movel #mcpTermListWrap,body.mcp-movel \
#mcpDlRelay,body.mcp-movel #termBtn{display:none!important}body.mcp-movel label[for="mcpRelay"]{display:none!important}\
body.mcp-movel #mcpRelay{display:none!important}body.mcp-movel .mcp-menu{max-width:94vw}`;
		document.head.appendChild(st);
		document.body.classList.add('mcp-movel');
	} catch (e) {
		ignorarErro(e, 'mcpCamadaMovel');
	}

	function trocaDica() {
		try {
			const dicas = document.querySelectorAll('#mcpMenu .mcp-hint');
			for (const d of dicas) {
				if (d.textContent.includes('relay.js') || d.textContent.includes('cloudflared')) {
					d.innerHTML = `<b>Modo celular.</b> A conexao ja vem configurada: toque em <b>Ativar MCP</b>, copie \
a URL e cole no conector MCP do Notion. Nao precisa de terminal nem de tunel. <b>Mantenha esta aba aberta</b>\
 enquanto o agente trabalha - se o celular dormir, o agente pausa ate voce voltar.`;
				}
			}
		} catch (e) {
			ignorarErro(e, 'trocaDica');
		}
	}
	trocaDica();
	setTimeout(trocaDica, 1200);

	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState !== 'visible') return;
		if (!MCP.active) return;
		if (MCP.status === 'online' && Date.now() - (MCP.lastBeat || 0) < 20000) return;
		mcpLog('ok', 'Voltou ao primeiro plano - reconectando…');
		try {
			mcpConnect();
		} catch (e) {
			ignorarErro(e, 'mcpCamadaMovel');
		}
	});
	window.addEventListener('online', () => {
		if (MCP.active)
			try {
				mcpConnect();
			} catch (e) {
				ignorarErro(e, 'mcpCamadaMovel');
			}
	});
	window.addEventListener('pageshow', (ev) => {
		if (ev.persisted && MCP.active)
			try {
				mcpConnect();
			} catch (e) {
				ignorarErro(e, 'mcpCamadaMovel');
			}
	});

	let wl = null;
	async function wlPega() {
		try {
			if (!('wakeLock' in navigator)) return;
			if (wl || !MCP.active || document.visibilityState !== 'visible') return;
			wl = await navigator.wakeLock.request('screen');
			wl.addEventListener('release', () => {
				wl = null;
			});
		} catch (e) {
			wl = null;
		}
	}
	function wlSolta() {
		try {
			if (wl) {
				wl.release();
				wl = null;
			}
		} catch (e) {
			ignorarErro(e, 'wlSolta');
		}
	}
	setInterval(() => {
		if (MCP.active) wlPega();
		else wlSolta();
	}, 4000);
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible') wlPega();
	});
})();
async function mcpOnRpc(pkt) {
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
		ignorarErro(e, 'mcpOnRpc');
	}
	await mcpEnviarResposta(pkt.reqId, out);
}

const AG = { claims: {}, log: [], msgs: [], seen: {}, msgSeq: 1 };
const AG_WRITE = new Set([
	'model3d_forge',
	'create_file',
	'write_file',
	'write_files',
	'edit_file',
	'rename',
	'delete',
	'restore_version',
	'restore_snapshot',
	'run_command',
	'stop_command',
	'start_dev_server',
	'stop_dev_server',
	'deploy_static',
	'undeploy_static',
	'export_zip',
	'add_asset_from_url',
	'add_asset_base64',
	'model3d_set_pivot',
	'model3d_transform',
	'model3d_apply',
	'model3d_convert',
]);
const AG_TRACK = new Set([
	...AG_WRITE,
	'create_project',
	'open_project_from_disk',
	'set_active_project',
	'snapshot_project',
]);
const MCP_AGENT_PROP = {
	type: 'string',
	description:
		'Seu nome de agente (identidade autodeclarada, ex.: agente-frontend). Com vários agentes ' +
		'em paralelo, SEMPRE informe o MESMO nome em todas as chamadas: ele identifica você nos ' +
		'claims (locks), no feed de atividade e nas mensagens.',
};
let __agProps = false;
function agEnsureProps() {
	if (__agProps) return;
	try {
		for (const t of MCP_TOOLS) {
			if (t.schema && t.schema.properties && !t.schema.properties.agent)
				t.schema.properties.agent = MCP_AGENT_PROP;
		}
		__agProps = true;
	} catch (e) {
		ignorarErro(e, 'agEnsureProps');
	}
}
function agName(a) {
	return String((a && a.agent) || '')
		.trim()
		.slice(0, 40);
}
function agIn(ts) {
	const s = Math.max(0, Math.round((ts - Date.now()) / 1000));
	if (s < 60) return `em ${s}s`;
	const m = Math.round(s / 60);
	if (m < 60) return `em ${m} min`;
	const h = Math.round(m / 60);
	return `em ${h} h`;
}
function agProjQuiet(args) {
	try {
		return mcpProj(args);
	} catch (e) {
		return null;
	}
}
function agClaimOf(proj) {
	const c = AG.claims[proj.id];
	if (!c) return null;
	if (Date.now() > c.until) {
		delete AG.claims[proj.id];
		return null;
	}
	return c;
}
function agSeen(agent) {
	if (agent) AG.seen[agent] = Date.now();
}
function agRecord(e) {
	e.t = Date.now();
	AG.log.push(e);
	if (AG.log.length > 250) AG.log.splice(0, AG.log.length - 250);
	agSeen(e.agent);
	mcpRenderAgents();
	saveSession();
}
function agTrack(agent, tool, args, ok) {
	agSeen(agent);
	if (!AG_TRACK.has(tool)) return;
	const p = agProjQuiet(args);
	agRecord({
		agent: agent || '(sem nome)',
		tool: tool,
		project: p ? p.name : args && args.name ? String(args.name).slice(0, 40) : '',
		hint: (mcpArgHint(args) || '').replace(' · ', ''),
		ok: ok ? 1 : 0,
	});
}
function agGate(proj, tool, args) {
	const agent = agName(args);
	const c = agClaimOf(proj);
	if (!c) return;
	if (agent && c.agent === agent) {
		c.until = Date.now() + c.mins * 60000;
		return;
	}
	if (args && args.force === true) {
		agRecord({
			agent: agent || '(sem nome)',
			tool: tool,
			project: proj.name,
			hint: 'FORÇOU gravação em projeto reivindicado por ' + c.agent,
			ok: 1,
			warn: 1,
		});
		return;
	}
	throw new Error(
		`Projeto "${proj.name}" está reivindicado pelo agente "${c.agent}" (expira ${agIn(c.until)}${c.note ? ' · nota: ' + c.note : ''}). \
Trabalhe em outro projeto, aguarde, combine via post_message, ou repita com force=true APENAS se tiver \
certeza de que esse agente terminou/abandonou.${agent ? '' : ' Dica: identifique-se sempre com o parâmetro agent.'}`,
	);
}
function agPost(from, to, text, projName) {
	const m = {
		id: AG.msgSeq++,
		t: Date.now(),
		from: from,
		to: String(to == null ? '' : to)
			.trim()
			.slice(0, 40),
		text: String(text).slice(0, 500),
		project: projName || '',
	};
	AG.msgs.push(m);
	if (AG.msgs.length > 100) AG.msgs.splice(0, AG.msgs.length - 100);
	mcpRenderAgents();
	saveSession();
	return m;
}
function mcpRenderAgents() {
	const el = document.getElementById('mcpAgents');
	if (!el) return;
	const now = Date.now();
	const claims = Object.keys(AG.claims)
		.map((id) => [id, AG.claims[id]])
		.filter((x) => now <= x[1].until);
	const acts = AG.log.slice(-6).reverse();
	const msgs = (function () {
		try {
			return tmMsgs()
				.slice(-3)
				.reverse()
				.map(function (m) {
					return {
						id: m.id,
						t: m.at,
						from: m.de,
						to: m.tipo === 'todos' ? '' : m.tipo === 'equipe' ? 'equipe ' + m.para : m.para,
						project: m.proj || '',
						text: m.texto,
					};
				});
		} catch (e) {
			return [];
		}
	})();
	const travas = (function () {
		try {
			return tmLocksResumo();
		} catch (e) {
			return [];
		}
	})();
	if (!claims.length && !acts.length && !msgs.length && !travas.length) {
		el.innerHTML = '';
		return;
	}
	const h = [
		'<div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,.08);font-size:11px;line-height:1.55">',
		'<div style="font-weight:600;opacity:.8;margin-bottom:2px">Agentes</div>',
	];
	for (const x of claims) {
		const c = x[1];
		const p = State.projects.find((pp) => pp.id === x[0]);
		h.push(
			`<div>📌 <b>${esc(c.agent)}</b> → projeto ${esc(p ? p.name : x[0])} <span style="opacity:.55">(${esc(agIn(c.until))}${c.note ? ' · ' + esc(c.note) : ''})</span></div>`,
		);
	}
	if (travas.length) {
		try {
			tmLockTickOn();
		} catch (e) {
			ignorarErro(e, 'mcpRenderAgents');
		}
		h.push(
			`<div style="font-weight:600;opacity:.8;margin:5px 0 2px">Arquivos ocupados (${travas.length})</div>`,
		);
		for (const it of travas.slice(0, 6)) {
			const nome = it.path.length > 44 ? '…' + it.path.slice(-43) : it.path;
			const pj = it.projName ? ' · ' + esc(it.projName) : '';
			if (it.escritor) {
				const l = it.escritor;
				h.push(
					`<div>🔒 <b>${esc(l.agent)}</b> → ${esc(nome)} <span style="opacity:.55">(${l.mode === 'manual' ? 'reservado' : 'gravando'} \
· so ele mexe · faltam ${tmLockPrazoTxt(l)}${pj})</span></div>`,
				);
			}
			if (it.leitores.length) {
				const quem = it.leitores.map(function (l) {
					return l.agent;
				});
				const mais = Math.max.apply(
					null,
					it.leitores.map(function (l) {
						return tmLockRestanteSeg(l);
					}),
				);
				h.push(
					`<div>👀 <b>${esc(quem.slice(0, 3).join(', '))}${quem.length > 3 ? ' +' + (quem.length - 3) : ''}</b>\
 → ${esc(nome)} <span style="opacity:.55">(lendo · ninguem grava · faltam ${tmSegTxt(mais)}${pj})</span>\
</div>`,
				);
			}
		}
		if (travas.length > 6)
			h.push(
				`<div style="opacity:.55">… e mais ${travas.length - 6} (veja com TM_LOCKS.lista())</div>`,
			);
	}
	for (const e of acts) {
		h.push(
			`<div style="${e.warn ? 'color:#fca5a5' : 'opacity:.72'}">${esc(relTime(e.t))} · <b>${esc(e.agent)}</b>\
 · ${esc(e.tool)}${e.project ? ' · ' + esc(e.project) : ''}${e.ok ? '' : ' · falhou'}</div>`,
		);
	}
	for (const m of msgs) {
		h.push(
			`<div style="opacity:.72">💬 <b>${esc(m.from)}</b>${m.to ? ' → ' + esc(m.to) : ''}: ${esc(m.text.slice(0, 80))}</div>`,
		);
	}
	h.push('</div>');
	el.innerHTML = h.join('');
}

const TM_SCHEMA = 1;
const TM_META3D = 'aurora.3d.json';
const TM_DEFAULT_CFG = {
	enforce: false,
	teamMode: 'auto',
	shadow: true,
	serializeCommands: true,
	cmdQueueMax: 200,
	cmdQueueWaitMs: 600000,
	cmdEsperaChamadaMs: 55000,

	cmdMaxMs: 900000,
	cmdPollMs: 3000,
	cmdMaxErrs: 3,
	cmdTicketMs: 120000,

	lockMinutes: 10,
	lockReadMinutes: 2,
	lockAutoSeconds: 90,

	lockReadGraceSeconds: 8,
	lockMax: 400,
	auditMax: 400,
	enlist: {
		ativo: true,
		porEquipe: 1,
		prefixo: 'agente',
		nativas: false,
		soProjeto: true,
		unicos: true,
	},
};
const TM_MSG_LIMITS = {
	texto: 4000,
	partes: 8,
	historico: 400,
	inbox: 50,
	agentes: 200,
	ativoMin: 30,
};
const TM = {
	v: TM_SCHEMA,
	cfg: Object.assign({}, TM_DEFAULT_CFG, { enlist: Object.assign({}, TM_DEFAULT_CFG.enlist) }),
	teams: {},
	globals: {},
	agents: {},
	locks: {},
	reviews: [],
	msgs: [],
	msgSeq: 1,
	audit: [],
	seq: 1,
	active: [],
	cmd: { busy: null, queue: [], seq: 1, timer: null, tickets: [] },
	stats: {
		calls: 0,
		writes: 0,
		deniedReal: 0,
		deniedShadow: 0,
		cmdRuns: 0,
		cmdQueued: 0,
		cmdForced: 0,
		adopted: 0,
		teamDenied: 0,
		teamShadow: 0,
		teamPreflight: 0,
		lockDenied: 0,
		lockReadDenied: 0,
		staleDenied: 0,
		locksTaken: 0,
	},
};
function tmNow() {
	return Date.now();
}
function tmCap(a, n) {
	if (a.length > n) a.splice(0, a.length - n);
	return a;
}
function tmAudit(kind, data) {
	const e = Object.assign({ id: TM.seq++, t: tmNow(), kind: kind }, data || {});
	TM.audit.push(e);
	tmCap(TM.audit, TM.cfg.auditMax);
	if (
		kind === 'deny' ||
		kind === 'shadow-deny' ||
		kind === 'cmd-overlap' ||
		kind === 'selfcheck-fail' ||
		kind === 'spec-missing'
	) {
		try {
			registro.aviso('[Synapse Teams]', kind, e);
		} catch (_e) {
			ignorarErro(_e, 'tmAudit');
		}
	}
	return e;
}
const TM_CFG_LIMITS = {
	cmdTicketMs: [0, 600000],
	cmdQueueMax: [1, 500],
	cmdQueueWaitMs: [5000, 7200000],
	cmdEsperaChamadaMs: [5000, 80000],
	cmdMaxMs: [10000, 86400000],
	cmdPollMs: [250, 60000],
	cmdMaxErrs: [1, 50],
	lockMinutes: [1, 240],
	lockReadMinutes: [0, 240],
	lockAutoSeconds: [0, 900],
	lockReadGraceSeconds: [0, 300],
	lockMax: [10, 5000],
	auditMax: [20, 5000],
};
function tmSaneCfg(c) {
	Object.keys(TM_CFG_LIMITS).forEach(function (k) {
		const lim = TM_CFG_LIMITS[k];
		const v = Number(c[k]);
		if (!isFinite(v) || v < lim[0] || v > lim[1]) {
			tmAudit('cfg-corrigida', { campo: k, recebido: c[k], usando: TM_DEFAULT_CFG[k] });
			c[k] = TM_DEFAULT_CFG[k];
		}
	});
	c.enforce = !!c.enforce;
	c.shadow = !!c.shadow;
	c.serializeCommands = !!c.serializeCommands;
	c.enlist = tmEnlSane(c.enlist);
	if (!['auto', 'on', 'shadow', 'off'].includes(String(c.teamMode))) {
		if (c.teamMode !== undefined)
			tmAudit('cfg-corrigida', { campo: 'teamMode', recebido: c.teamMode, usando: 'auto' });
		c.teamMode = 'auto';
	}
	return c;
}
function tmSerialize() {
	try {
		return {
			v: TM_SCHEMA,
			cfg: TM.cfg,
			teams: TM.teams,
			globals: TM.globals,
			agents: TM.agents,
			locks: TM.locks,
			reviews: TM.reviews.slice(
				-(typeof TM_REVIEW_LIMITS !== 'undefined' ? TM_REVIEW_LIMITS.historico : 50),
			),
			msgs: (Array.isArray(TM.msgs) ? TM.msgs : []).slice(-TM_MSG_LIMITS.historico),
			msgSeq: TM.msgSeq,
			audit: TM.audit.slice(-120),
			seq: TM.seq,
			stats: TM.stats,
		};
	} catch (e) {
		return { v: TM_SCHEMA, cfg: Object.assign({}, TM_DEFAULT_CFG) };
	}
}
function tmRestore(d) {
	if (!d || typeof d !== 'object') return false;
	if ((d.v | 0) !== TM_SCHEMA) {
		tmAudit('schema-mismatch', { encontrado: d.v, esperado: TM_SCHEMA });
		return false;
	}
	TM.cfg = tmSaneCfg(
		Object.assign({}, TM_DEFAULT_CFG, d.cfg && typeof d.cfg === 'object' ? d.cfg : {}),
	);
	TM.teams = d.teams && typeof d.teams === 'object' ? d.teams : {};
	TM.globals = d.globals && typeof d.globals === 'object' ? d.globals : {};
	TM.agents = d.agents && typeof d.agents === 'object' ? d.agents : {};
	TM.locks = d.locks && typeof d.locks === 'object' ? d.locks : {};
	try {
		Object.keys(TM.locks).forEach(function (k) {
			const l = TM.locks[k];
			if (l && l.mode !== 'manual') delete TM.locks[k];
		});
	} catch (e) {
		ignorarErro(e, 'tmRestore');
	}
	TM.reviews = Array.isArray(d.reviews) ? d.reviews : [];
	try {
		if (typeof tmReviewsSane === 'function') tmReviewsSane();
	} catch (e) {
		ignorarErro(e, 'tmRestore');
	}
	TM.msgs = Array.isArray(d.msgs) ? d.msgs : [];
	TM.msgSeq = typeof d.msgSeq === 'number' && d.msgSeq > 0 ? d.msgSeq : 1;
	try {
		if (typeof tmMsgsSane === 'function') tmMsgsSane();
	} catch (e) {
		ignorarErro(e, 'tmRestore');
	}
	TM.audit = Array.isArray(d.audit) ? d.audit : [];
	TM.seq = typeof d.seq === 'number' && d.seq > 0 ? d.seq : 1;
	if (d.stats && typeof d.stats === 'object') TM.stats = Object.assign(TM.stats, d.stats);
	tmTeamsSane();
	try {
		if (typeof tmGlobalsSane === 'function') tmGlobalsSane();
	} catch (e) {
		ignorarErro(e, 'tmRestore');
	}
	tmEnsureNativeTeams();
	tmAgentsSync();
	try {
		if (typeof tmLocksGC === 'function') tmLocksGC();
	} catch (e) {
		ignorarErro(e, 'tmRestore');
	}
	return true;
}
class TMFileMap extends Map {
	set(k, v) {
		tmGateWrite(k, 'set');
		return super.set(k, v);
	}
	delete(k) {
		tmGateWrite(k, 'delete');
		return super.delete(k);
	}
	clear() {
		tmGateWrite('*', 'clear');
		return super.clear();
	}
}
function tmAdopt(proj) {
	if (!proj || !proj.files) return proj;
	if (proj.files instanceof TMFileMap) return proj;
	const g = new TMFileMap();
	proj.files.forEach(function (v, k) {
		Map.prototype.set.call(g, k, v);
	});
	proj.files = g;
	TM.stats.adopted++;
	tmAudit('adopt', { projeto: proj.name || proj.id, arquivos: g.size });
	return proj;
}
function tmNormPath(p) {
	return String(p == null ? '' : p)
		.trim()
		.replace(/\\/g, '/')
		.replace(/\/{2,}/g, '/')
		.replace(/^\/+/, '')
		.replace(/\/+$/, '');
}
function tmMatch(ctx, path) {
	if (ctx.writesAll) return true;
	const p = tmNormPath(path);
	if (ctx.allow.has(p)) return true;
	for (let i = 0; i < ctx.prefixes.length; i++) {
		const pre = ctx.prefixes[i];
		if (p === pre || p.indexOf(pre + '/') === 0) return true;
	}
	return false;
}
function tmAuthorizer(path) {
	for (let i = TM.active.length - 1; i >= 0; i--) {
		if (tmMatch(TM.active[i], path)) return TM.active[i];
	}
	return null;
}
function tmGateWrite(path, op) {
	if (!TM.active.length) return true;
	const ok = tmAuthorizer(path);
	if (ok) {
		if (!ok.probe) {
			tmTeamGate(ok, path, op);
			tmLockGate(ok, path, op);
			TM.stats.writes++;
		}
		ok.wrote.push(op + ':' + path);
		return true;
	}
	const cur = TM.active[TM.active.length - 1];
	if (cur && cur.probe) {
		cur.undeclared.push(op + ':' + path);
		return true;
	}
	const info = {
		tool: cur ? cur.tool : '?',
		agent: (cur && cur.agent) || '',
		path: String(path),
		op: op,
	};
	if (TM.cfg.enforce) {
		TM.stats.deniedReal++;
		tmAudit('deny', info);
		throw new Error(
			`Escrita bloqueada pelo controle de Equipes: a ferramenta "${info.tool}" nao declarou o arquivo "${info.path}". \
Se isso for um engano do site, avise o usuario (auditoria: TM_QA.audit()).`,
		);
	}
	TM.stats.deniedShadow++;
	if (cur) cur.undeclared.push(op + ':' + path);
	tmAudit('shadow-deny', info);
	tmTeamGate(cur, path, op);
	tmLockGate(cur, path, op);
	return true;
}
function tmArg(a, k) {
	const v = a ? a[k] : null;
	const s = v == null ? '' : tmNormPath(v);
	return s || null;
}
function tmArgList(a, k) {
	const v = a ? a[k] : null;
	return Array.isArray(v) ? v.map(tmNormPath).filter(Boolean) : [];
}
const TM_TOOL_PATHS = {
	create_file: function (a) {
		return { w: [tmArg(a, 'path')] };
	},
	write_file: function (a) {
		return { w: [tmArg(a, 'path')] };
	},
	edit_file: function (a) {
		return { w: [tmArg(a, 'path')], r: [tmArg(a, 'path')] };
	},
	write_files: function (a) {
		return {
			w: Array.isArray(a && a.files)
				? a.files.map(function (f) {
						return tmNormPath(f && f.path);
					})
				: [],
		};
	},
	rename: function (a) {
		return { w: [tmArg(a, 'from'), tmArg(a, 'to')], wp: [tmArg(a, 'from'), tmArg(a, 'to')] };
	},
	delete: function (a) {
		return { w: tmArgList(a, 'paths'), wp: tmArgList(a, 'paths') };
	},
	restore_version: function (a) {
		return { w: [tmArg(a, 'path')] };
	},
	restore_snapshot: function (a) {
		return a && a.path ? { w: [tmArg(a, 'path')] } : { all: true };
	},
	snapshot_project: function () {
		return {};
	},
	add_asset_from_url: function (a) {
		return { w: [tmArg(a, 'path')] };
	},
	add_asset_base64: function (a) {
		return { w: [tmArg(a, 'path')] };
	},
	model3d_set_pivot: function (a) {
		return { w: [tmArg(a, 'path'), TM_META3D] };
	},
	model3d_transform: function (a) {
		return { w: [tmArg(a, 'path'), TM_META3D] };
	},
	model3d_apply: function (a) {
		const p = tmArg(a, 'path');
		const w = [p, tmArg(a, 'output'), TM_META3D];
		if (p) {
			w.push(p + '.pivot');
			w.push(p.replace(/(\.[a-z0-9]+)$/i, '.pivot$1'));
		}
		return { w: w, wp: [p] };
	},
	model3d_convert: function () {
		return { all: true, x: true };
	},
	model3d_forge: function (a) {
		return { w: [tmArg(a, 'path'), 'assets/forge', 'tools/forge.mjs', 'tools/forge-exemplo.mjs'] };
	},
	model3d_docs: function () {
		return {};
	},
	run_command: function () {
		return { all: true, x: true };
	},
	start_dev_server: function () {
		return { all: true, x: true };
	},
	stop_dev_server: function () {
		return { all: true };
	},
	stop_command: function () {
		return { all: true };
	},
	export_zip: function () {
		return {};
	},
	deploy_static: function () {
		return {};
	},
	undeploy_static: function () {
		return {};
	},
	create_project: function () {
		return { all: true };
	},
	open_project_from_disk: function () {
		return { all: true };
	},
};
function tmSpecFor(name, args) {
	const fn = TM_TOOL_PATHS[name];
	let s = {};
	if (fn) {
		try {
			s = fn(args || {}) || {};
		} catch (e) {
			s = { all: true };
			tmAudit('spec-error', { tool: name, erro: String((e && e.message) || e) });
		}
	} else if (typeof AG_WRITE !== 'undefined' && AG_WRITE.has(name)) {
		s = { all: true };
		tmAudit('spec-missing', { tool: name });
	}
	return {
		writes: (s.w || []).filter(Boolean),
		prefixes: (s.wp || []).filter(Boolean),
		writesAll: !!s.all,
		exclusive: !!s.x,
		reads: (s.r || []).filter(Boolean),
	};
}
async function tmBegin(name, args) {
	const spec = tmSpecFor(name, args);
	let who = '';
	try {
		who = agName(args) || '';
	} catch (e) {
		ignorarErro(e, 'tmBegin');
	}
	const ctx = {
		id: TM.seq++,
		tool: name,
		at: tmNow(),
		agent: who,
		allow: new Set(spec.writes),
		prefixes: spec.prefixes,
		writesAll: spec.writesAll,
		exclusive: spec.exclusive,
		wrote: [],
		undeclared: [],
		cmdLock: null,
	};
	try {
		const _pj = agProjQuiet(args);
		ctx.projId = _pj ? String(_pj.id) : '';
		ctx.projName = _pj ? String(_pj.name || '') : '';
	} catch (e) {
		ctx.projId = '';
		ctx.projName = '';
	}
	TM.active.push(ctx);
	try {
		if (typeof tmTeamPreflight === 'function') tmTeamPreflight(ctx);
		if (typeof tmLockPreflight === 'function') tmLockPreflight(ctx);
		if (typeof tmLockClaimCtx === 'function') tmLockClaimCtx(ctx);
		if (ctx.exclusive && TM.cfg.serializeCommands) ctx.cmdLock = await tmCmdAcquire(ctx, args);
	} catch (e) {
		const i = TM.active.indexOf(ctx);
		if (i >= 0) TM.active.splice(i, 1);
		try {
			if (typeof tmLockReleaseCtx === 'function') tmLockReleaseCtx(ctx);
		} catch (e2) {
			ignorarErro(e2, 'tmBegin');
		}
		throw e;
	}
	TM.stats.calls++;
	return ctx;
}
function tmEnd(ctx, ok, err) {
	if (!ctx) return;
	const i = TM.active.indexOf(ctx);
	if (i >= 0) TM.active.splice(i, 1);
	if (ctx.undeclared.length)
		tmAudit('undeclared-writes', {
			tool: ctx.tool,
			agent: ctx.agent,
			paths: ctx.undeclared.slice(0, 12),
		});
	try {
		if (typeof tmLockReleaseCtx === 'function') tmLockReleaseCtx(ctx);
	} catch (e) {
		ignorarErro(e, 'tmEnd');
	}
	if (ctx.cmdLock) tmCmdAfterCall(ctx, !!ok);
	if (!ok && err)
		tmAudit('call-error', {
			tool: ctx.tool,
			agent: ctx.agent,
			erro: String((err && err.message) || err).slice(0, 180),
		});
}
