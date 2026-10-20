'use strict';
function tmRequireManager(nome, acao) {
	const n = tmAgNome(nome);
	const g = tmNativeTeam('manager');
	const nomeG = (g && g.name) || 'Gerenciador';
	if (!n)
		throw new Error(
			`Informe agent="seu-nome": so o agente registrado na equipe nativa "${nomeG}" pode ${acao}.`,
		);
	tmAgentsSync();
	const t = tmAgentTeam(n);
	if (!t || !t.caps || !t.caps.manageTeams) {
		try {
			tmAudit('manager-deny', { agente: n, acao: acao, equipe: t ? t.name : '' });
		} catch (e) {
			ignorarErro(e, 'tmRequireManager');
		}
		throw new Error(
			'So o agente da equipe nativa "' +
				nomeG +
				'" pode ' +
				acao +
				'. Voce ' +
				(t ? `esta na equipe "${t.name}"` : 'nao esta em nenhuma equipe') +
				'. Se o usuario quer que VOCE administre as equipes, peca a vaga a ele e entre com team_join team="' +
				nomeG +
				'" (a vaga e unica). Enquanto isso, peca a mudanca ao Gerenciador com msg_send.',
		);
	}
	return t;
}
function tmAdminSalvar() {
	try {
		tmAgentsSync();
	} catch (e) {
		ignorarErro(e, 'tmAdminSalvar');
	}
	try {
		tmAgSave();
	} catch (e) {
		ignorarErro(e, 'tmAdminSalvar');
	}
	try {
		tmUIRender();
	} catch (e) {
		ignorarErro(e, 'tmAdminSalvar');
	}
	try {
		mcpRenderAgents();
	} catch (e) {
		ignorarErro(e, 'tmAdminSalvar');
	}
}
function tmAdminPaths(a) {
	let lista = a && Array.isArray(a.paths) ? a.paths : a && a.path ? [a.path] : [];
	return lista.map(function (p) {
		if (p && typeof p === 'object') return p;
		const s = String(p == null ? '' : p);
		return /\/+$/.test(s) ? { path: s.replace(/\/+$/, ''), dir: true } : s;
	});
}
function tmAdminProj(a) {
	try {
		return agProjQuiet(a) || null;
	} catch (e) {
		return null;
	}
}
function tmAdminResumo(t) {
	return (
		'Equipe "' +
		t.name +
		'"' +
		(t.native ? ' [nativa]' : '') +
		' - projeto: ' +
		(tmTeamProj(t) ? `"${tmTeamProjNome(t)}"` : '(qualquer)') +
		String.fromCharCode(10) +
		'  pode alterar: ' +
		(t.caps.writeAny
			? 'qualquer arquivo'
			: (t.files || []).length + (t.dirs || []).length
				? tmTeamAlvos(t)
				: '(nenhum caminho ainda)') +
		String.fromCharCode(10) +
		'  agentes: ' +
		((t.agents || []).join(', ') || '(nenhum)') +
		(t.maxAgents ? ' - maximo ' + t.maxAgents : '') +
		String.fromCharCode(10) +
		'  saida liberada: ' +
		(t.allowLeave ? 'sim' : 'nao')
	);
}
function tmAgentStatus(nome, path, proj) {
	tmAgentsSync();
	const n = tmAgNome(nome);
	const a = tmAgent(n);
	const t = tmAgentTeam(n);
	const modo = tmTeamMode();
	const L = [];
	L.push(
		'Regime de Equipes: ' +
			(modo === 'off'
				? 'DESLIGADO (o usuario ainda nao criou equipes — todo mundo altera tudo, como antes)'
				: modo === 'shadow'
					? 'MODO SOMBRA (nada e bloqueado ainda; tudo que seria bloqueado vira auditoria)'
					: 'LIGADO (a posse dos arquivos e obrigatoria)'),
	);
	if (!n)
		L.push(
			'Voce NAO informou o parametro agent, entao o site nao sabe quem voce e. Informe agent="seu-nome" em todas as chamadas.',
		);
	else if (!t)
		L.push(
			`Agente "${n}": SEM EQUIPE. Voce le tudo, mas nao altera nada enquanto o regime estiver ligado. Use team_join.`,
		);
	else {
		L.push(
			`Agente "${n}" na equipe "${t.name}"${t.desc ? ' — ' + t.desc : ''}${a && a.joinedAt ? ' desde ' + new Date(a.joinedAt).toLocaleString() : ''}.`,
		);
		L.push(
			'Projeto desta equipe: ' +
				(tmTeamProj(t)
					? `"${tmTeamProjNome(t)}" (a posse dela so vale nesse projeto)`
					: '(nenhum - vale em qualquer projeto)') +
				'.',
		);
		L.push(
			`Voce pode alterar: ${t.caps.writeAny ? 'QUALQUER arquivo (Integrador Revisor)' : (t.files || []).length + (t.dirs || []).length ? tmTeamAlvos(t) : '(nada ainda — peca arquivos ao usuario)'}${t.caps.writeOwnerless && !t.caps.writeAny ? ' + arquivos sem dono' : ''}.`,
		);
		L.push(
			`Saida da equipe: ${t.allowLeave ? 'liberada pelo usuario (team_leave)' : 'bloqueada (so o usuario libera)'}.`,
		);
		const colegas = (t.agents || []).filter(function (x) {
			return tmAgKey(x) !== tmAgKey(n);
		});
		L.push(`Colegas nesta equipe: ${colegas.join(', ') || '(so voce)'}.`);
		if (a)
			L.push(`Seu historico: ${a.writes} alteracao(oes) aprovada(s), ${a.denied} recusada(s).`);
	}
	if (path) {
		const p = tmNormPath(path);
		const pr = tmProjEscopo(proj);
		const d = tmOwnerOf(p, pr);
		const v = tmAgentCanWrite(n, p, pr);
		L.push(
			'Caminho "' +
				p +
				'": dono = ' +
				(d ? `equipe "${d.team.name}" (por ${d.regra}: "${d.alvo}")` : 'nenhuma equipe') +
				'. Voce ' +
				(v.ok ? 'PODE alterar' : 'NAO pode alterar') +
				' — ' +
				v.motivo,
		);
	}
	L.push(
		`Arquivos GLOBAIS (sem dono, TODAS as equipes podem alterar): ${tmGlobalsTxt(tmProjEscopo(proj) || (t ? tmTeamProj(t) : ''))}. \
Quem define e o Gerenciador (team_global_add / team_global_remove); qualquer agente consulta com team_globals.`,
	);
	const outras = tmTeams()
		.filter(function (x) {
			return !t || x.id !== t.id;
		})
		.map(function (x) {
			return (
				'"' +
				x.name +
				'"' +
				(tmTeamProj(x) ? ` <${tmTeamProjNome(x)}>` : '') +
				((x.agents || []).length ? ` [${x.agents.join(', ')}]` : ' [sem agentes]')
			);
		});
	L.push(`Outras equipes: ${outras.join(' · ') || '(nenhuma)'}.`);
	return L.join('\n');
}
function tmAgentsReport() {
	tmAgentsSync();
	return tmAgentList().map(function (a) {
		const t = a.teamId ? TM.teams[a.teamId] || null : null;
		return {
			agente: a.name,
			equipe: t ? t.name : '(sem equipe)',
			escritas: a.writes,
			recusadas: a.denied,
			desde: a.joinedAt ? new Date(a.joinedAt).toLocaleString() : '-',
		};
	});
}

function tmAgentsSelfCheck() {
	const p = [];
	try {
		tmAgentsSync();
		const A = tmAgents();
		Object.keys(A).forEach(function (k) {
			const a = A[k];
			if (tmAgKey(a.name) !== k) p.push(`chave do registro difere do nome do agente: "${k}"`);
			if (a.teamId && !TM.teams[a.teamId])
				p.push(`agente "${a.name}" aponta para equipe inexistente`);
		});
		tmTeams().forEach(function (t) {
			if (t.maxAgents && (t.agents || []).length > t.maxAgents)
				p.push(`equipe "${t.name}" acima do limite de agentes`);
			(t.agents || []).forEach(function (nm) {
				const a = tmAgent(nm);
				if (!a) p.push(`equipe "${t.name}" lista o agente "${nm}", que nao existe no registro`);
				else if (a.teamId !== t.id)
					p.push(`agente "${nm}" aparece na equipe "${t.name}" mas seu registro diz outra coisa`);
			});
		});
		let vistos = {};
		tmTeams().forEach(function (t) {
			(t.agents || []).forEach(function (nm) {
				const k = tmAgKey(nm);
				if (vistos[k]) p.push(`agente "${nm}" aparece em duas equipes ao mesmo tempo`);
				vistos[k] = 1;
			});
		});
		if (!tmModoValido(String((TM.cfg && TM.cfg.teamMode) || 'auto')))
			p.push('cfg.teamMode invalido');
		if (tmTeamMode() === 'on') {
			if (tmAgentCanWrite('', 'qualquer/arquivo.js').ok)
				p.push('regime ligado, mas chamada SEM nome de agente passaria (ADR-0019 furado)');
			if (tmAgentCanWrite('__nao_existe__', 'qualquer/arquivo.js').ok)
				p.push('regime ligado, mas agente sem equipe passaria (decisao 1 furada)');
		}
		if (typeof tmTeamGate !== 'function')
			p.push('tmTeamGate ausente: a posse nao esta ligada ao trilho de escrita');
		else if (!String(tmBegin).includes('tmTeamPreflight'))
			p.push(
				'tmBegin nao chama tmTeamPreflight: a chamada voltou a ser conferida arquivo por arquivo (ADR-0024 furado)',
			);
		else if (!String(tmGateWrite).includes('tmTeamGate'))
			p.push(
				'tmGateWrite nao chama tmTeamGate: a posse esta desligada da primitiva (ADR-0022 furado)',
			);
	} catch (e) {
		p.push('autodiagnostico de agentes falhou: ' + ((e && e.message) || e));
	}
	return p;
}

const TM_AGENTS = {
	entrar: function (agente, equipe) {
		return tmAgentJoin(agente, equipe, { forcarUsuario: true }).mensagem;
	},
	sair: function (agente) {
		return tmAgentLeave(agente, { forcarUsuario: true }).mensagem;
	},
	remover: function (agente) {
		return tmAgentRemove(agente);
	},
	alistar: function () {
		const r = tmEnlist({});
		registro.debug(r.mensagem);
		return { nome: r.nome, equipe: r.equipe.name };
	},
	alistamento: function (o) {
		if (o === undefined) return tmEnlCfg();
		TM.cfg.enlist = tmEnlSane(Object.assign({}, tmEnlCfg(), o));
		tmAgSave();
		try {
			tmUIRender();
		} catch (e) {
			ignorarErro(e, 'alistamento');
		}
		return tmEnlCfg();
	},
	lista: function () {
		const r = tmAgentsReport();
		try {
			console.table(r);
		} catch (e) {
			ignorarErro(e, 'lista');
		}
		return r;
	},
	status: function (agente, caminho) {
		const s = tmAgentStatus(agente, caminho);
		registro.debug(s);
		return s;
	},
	modo: function (m) {
		if (m === undefined) return tmTeamMode();
		if (!tmModoValido(String(m)))
			throw new Error('modo invalido: use "auto", "on", "shadow" ou "off"');
		TM.cfg.teamMode = String(m);
		tmAgSave();
		tmAudit('team-mode', { escolhido: TM.cfg.teamMode, efetivo: tmTeamMode() });
		return tmTeamMode();
	},
};
try {
	window.TM_AGENTS = TM_AGENTS;
} catch (e) {
	ignorarErro(e, 'status-legivel');
}

function tmLockPathKey(p) {
	return String(tmNormPath(p) || '').toLowerCase();
}
function tmProjKey(x) {
	if (!x) return '';
	if (typeof x === 'string') return String(x);
	if (typeof x === 'object' && x.id) return String(x.id);
	return '';
}
function tmProjMatch(a, b) {
	return !a || !b || a === b;
}
function tmLockMs() {
	return (Number(TM.cfg.lockMinutes) || 10) * 60000;
}
function tmLocks() {
	if (!TM.locks || typeof TM.locks !== 'object') TM.locks = {};
	return TM.locks;
}
function tmLocksLivres() {
	return Math.max(0, (Number(TM.cfg.lockMax) || 400) - Object.keys(tmLocks()).length);
}
function tmLockRestante(l) {
	return Math.max(0, Math.ceil((((l && l.until) || 0) - tmNow()) / 60000));
}
function tmSegTxt(s) {
	s = Math.max(0, Math.round(Number(s) || 0));
	return s < 120 ? s + 's' : Math.ceil(s / 60) + ' min';
}
function tmLockRestanteSeg(l) {
	return Math.max(0, Math.ceil((((l && l.until) || 0) - tmNow()) / 1000));
}
function tmLockPrazoTxt(l) {
	return tmSegTxt(tmLockRestanteSeg(l));
}
function tmCurCtx() {
	try {
		return TM.active && TM.active.length ? TM.active[TM.active.length - 1] : null;
	} catch (e) {
		return null;
	}
}
function tmCtxVivo(id) {
	if (id == null) return false;
	try {
		return TM.active.some(function (c) {
			return c && c.id === id;
		});
	} catch (e) {
		return false;
	}
}
function tmCtxDono(nome, tool) {
	const n = tmAgKey(nome);
	if (!n) return null;
	let cand = null;
	try {
		for (let i = TM.active.length - 1; i >= 0; i--) {
			const c = TM.active[i];
			if (!c || tmAgKey(c.agent) !== n) continue;
			if (tool && c.tool === tool) return c;
			if (!cand) cand = c;
		}
	} catch (e) {
		ignorarErro(e, 'tmCtxDono');
	}
	return cand;
}
function tmLockDonos(l) {
	if (!l) return [];
	if (Array.isArray(l.ctxIds)) return l.ctxIds;
	return l.ctxId != null ? [l.ctxId] : [];
}
function tmLockDonoVivo(l) {
	return tmLockDonos(l).some(function (id) {
		return tmCtxVivo(id);
	});
}
function tmLockAddDono(l, id) {
	if (!l || id == null) return;
	if (!Array.isArray(l.ctxIds)) l.ctxIds = l.ctxId != null ? [l.ctxId] : [];
	if (!l.ctxIds.includes(id)) l.ctxIds.push(id);
	if (l.ctxIds.length > 24) l.ctxIds.splice(0, l.ctxIds.length - 24);
	l.ctxId = id;
	l.grace = false;
}
function tmLockDelDono(l, id) {
	if (!l) return 0;
	if (!Array.isArray(l.ctxIds)) l.ctxIds = l.ctxId != null ? [l.ctxId] : [];
	const i = l.ctxIds.indexOf(id);
	if (i >= 0) l.ctxIds.splice(i, 1);
	l.ctxIds = l.ctxIds.filter(function (x) {
		return tmCtxVivo(x);
	});
	l.ctxId = l.ctxIds.length ? l.ctxIds[l.ctxIds.length - 1] : null;
	return l.ctxIds.length;
}

function tmLockKind(l) {
	return l && l.kind === 'read' ? 'read' : 'write';
}
function tmLockTipo(l) {
	return tmLockKind(l) === 'read' ? 'leitura' : 'escrita';
}
function tmLockKindArg(v) {
	const s = String(v == null ? '' : v)
		.trim()
		.toLowerCase();
	if (!s) return '';
	if (
		s.indexOf('leit') === 0 ||
		s === 'read' ||
		s === 'r' ||
		s === 'compartilhada' ||
		s === 'shared'
	)
		return 'read';
	if (
		s.indexOf('escr') === 0 ||
		s === 'write' ||
		s === 'w' ||
		s === 'exclusiva' ||
		s === 'exclusive'
	)
		return 'write';
	return '';
}
function tmLockKey(p, proj, kind, agente) {
	const k = tmLockPathKey(p);
	if (!k) return '';
	const base = tmProjKey(proj) + '|' + k;
	return kind === 'read' ? base + '|r:' + tmAgKey(agente || '') : base;
}
function tmLockKeyOf(l) {
	return l ? tmLockKey(l.path, l.proj, tmLockKind(l), l.agent) : '';
}
function tmLockDesc(l) {
	if (!l) return '';
	const lendo = tmLockKind(l) === 'read';
	const auto = l.mode !== 'manual';
	return (
		'"' +
		l.path +
		'"' +
		(l.projName ? ` (projeto ${l.projName})` : '') +
		(lendo ? ' esta EM LEITURA por "' : ' esta travado para ESCRITA por "') +
		l.agent +
		'"' +
		(l.team ? ` (equipe ${l.team})` : '') +
		' ha ' +
		tmSegTxt((tmNow() - (l.at || tmNow())) / 1000) +
		(auto
			? l.grace
				? ` (a chamada dele acabou de responder: a trava some em ${tmLockPrazoTxt(l)})`
				: ` (trava automatica: cai assim que a chamada dele receber a resposta, no maximo em ${tmLockPrazoTxt(l)})`
			: ` (reserva manual de file_lock: mais ${tmLockPrazoTxt(l)})`) +
		(l.note ? ' - motivo: ' + l.note : '') +
		'.'
	);
}
function tmLockEspera(l) {
	return l && l.mode === 'manual'
		? `Espere o prazo (mais ${tmLockPrazoTxt(l)})`
		: 'Espere alguns segundos: a trava automatica cai assim que a chamada dele responder';
}
function tmLockRegra(l) {
	return tmLockKind(l) === 'read'
		? ' Ler junto pode - varios agentes leem o mesmo arquivo ao mesmo tempo. Gravar enquanto alguem le, nao: sairia por cima do trabalho dele.'
		: ' Enquanto um agente esta reescrevendo, ninguem le nem grava esse arquivo: a versao atual esta pela metade.';
}

function tmLocksGC() {
	const K = tmLocks();
	const agora = tmNow();
	const mortas = [];
	let mudou = false;
	Object.keys(K).forEach(function (k) {
		const l = K[k];
		if (!l || typeof l !== 'object' || !l.path || !l.agent || !(Number(l.until) > 0)) {
			delete K[k];
			mudou = true;
			return;
		}
		if (l.kind !== 'read') l.kind = 'write';
		if (typeof l.proj !== 'string') l.proj = '';
		if (k !== tmLockKeyOf(l)) {
			delete K[k];
			mudou = true;
			return;
		}
		if (l.mode === 'auto' && !l.grace && tmLockDonos(l).length && !tmLockDonoVivo(l)) {
			mortas.push(l.path);
			delete K[k];
			mudou = true;
			return;
		}
		if (l.until <= agora) {
			mortas.push(l.path);
			delete K[k];
			mudou = true;
		}
	});
	if (mortas.length)
		tmAudit('lock-expired', { quantas: mortas.length, arquivos: mortas.slice(0, 8) });
	if (mudou) {
		try {
			if (typeof mcpRenderAgents === 'function') mcpRenderAgents();
		} catch (e) {
			ignorarErro(e, 'tmLocksGC');
		}
	}
	return mortas.length;
}

function tmLocksOn(path, proj) {
	const K = tmLocks();
	const pk = tmLockPathKey(path);
	const out = [];
	if (!pk) return out;
	const alvo = tmProjKey(proj);
	const agora = tmNow();
	Object.keys(K).forEach(function (k) {
		const l = K[k];
		if (!l || tmLockPathKey(l.path) !== pk) return;
		if (!tmProjMatch(l.proj, alvo)) return;
		if (!(Number(l.until) > agora)) {
			delete K[k];
			return;
		}
		out.push(l);
	});
	out.sort(function (a, b) {
		return (tmLockKind(a) === 'write' ? 0 : 1) - (tmLockKind(b) === 'write' ? 0 : 1);
	});
	return out;
}
function tmLockOf(path, proj) {
	const ls = tmLocksOn(path, proj);
	for (let i = 0; i < ls.length; i++) if (tmLockKind(ls[i]) === 'write') return ls[i];
	return null;
}
function tmLockLeitores(path, proj) {
	return tmLocksOn(path, proj).filter(function (l) {
		return tmLockKind(l) === 'read';
	});
}
function tmLockMeu(path, proj, nome, kind) {
	const n = tmAgKey(nome);
	if (!n) return null;
	const ls = tmLocksOn(path, proj);
	for (let i = 0; i < ls.length; i++) {
		const l = ls[i];
		if (tmAgKey(l.agent) === n && (!kind || tmLockKind(l) === kind)) return l;
	}
	return null;
}
function tmLocksDeOutros(path, nome, proj) {
	const n = tmAgKey(nome);
	return tmLocksOn(path, proj).filter(function (l) {
		return !n || tmAgKey(l.agent) !== n;
	});
}
function tmBloqueioEscrita(path, nome, proj) {
	const ls = tmLocksDeOutros(path, nome, proj);
	return ls[0] || null;
}
function tmBloqueioLeitura(path, nome, proj) {
	const ls = tmLocksDeOutros(path, nome, proj);
	for (let i = 0; i < ls.length; i++) if (tmLockKind(ls[i]) === 'write') return ls[i];
	return null;
}
function tmLockDeOutro(path, nome, proj) {
	return tmBloqueioEscrita(path, nome, proj);
}
function tmLocksDoAgente(nome) {
	const n = tmAgKey(nome);
	if (!n) return [];
	tmLocksGC();
	const K = tmLocks();
	return Object.keys(K)
		.map(function (k) {
			return K[k];
		})
		.filter(function (l) {
			return l && tmAgKey(l.agent) === n;
		});
}

function tmLockAcquire(nome, path, opts) {
	const o = opts || {};
	const kind = o.kind === 'read' ? 'read' : 'write';
	const n = tmAgNome(nome);
	const p = tmNormPath(path);
	if (!p) throw new Error('Informe o caminho do arquivo para travar.');
	if (!n)
		throw new Error('Informe agent="seu-nome" para travar arquivos: a trava precisa ter dono.');
	const proj = tmProjKey(o.proj);
	const K = tmLocks();
	const choque = kind === 'read' ? tmBloqueioLeitura(p, n, proj) : tmBloqueioEscrita(p, n, proj);
	if (choque)
		throw new Error(
			`Nao consegui travar para ${kind === 'read' ? 'LEITURA' : 'ESCRITA'}: ${tmLockDesc(choque)}${tmLockRegra(choque)} ${tmLockEspera(choque)}, \
peca ao agente para soltar (post_message) ou peca ao usuario para liberar.`,
		);
	const padrao =
		kind === 'read' ? Number(TM.cfg.lockReadMinutes) || 2 : Number(TM.cfg.lockMinutes) || 10;
	const dur =
		Number(o.seconds) > 0
			? Math.max(1000, Math.min(900000, Math.round(Number(o.seconds) * 1000)))
			: Math.max(60000, Math.min(14400000, (Number(o.minutes) || padrao) * 60000));
	const minutos = Math.max(1, Math.round(dur / 60000));
	const t = tmAgentTeam(n);
	let atual = tmLockMeu(p, proj, n, kind);
	if (!atual && kind === 'read') atual = tmLockMeu(p, proj, n, 'write');
	if (atual) {
		const novo = tmNow() + dur;
		const estendeu = novo > (atual.until || 0);
		if (estendeu) atual.until = novo;
		atual.renews = (atual.renews | 0) + 1;
		if (o.mode === 'manual') {
			atual.mode = 'manual';
			if (o.note) atual.note = String(o.note).slice(0, 120);
		}
		if (o.ctxId != null && atual.mode !== 'manual') tmLockAddDono(atual, o.ctxId);
		if (!atual.projName && o.projName) atual.projName = String(o.projName).slice(0, 40);
		tmAudit('lock-renew', {
			arquivo: p,
			agente: n,
			tipo: tmLockTipo(atual),
			prazo: tmSegTxt(dur / 1000),
			estendeu: estendeu,
		});
		return { lock: atual, novo: false, estendeu: estendeu };
	}
	if (kind === 'write') {
		const minhaLeitura = tmLockMeu(p, proj, n, 'read');
		if (minhaLeitura) {
			delete K[tmLockKeyOf(minhaLeitura)];
			tmAudit('lock-upgrade', { arquivo: p, agente: n });
		}
	}
	if (Object.keys(K).length >= (Number(TM.cfg.lockMax) || 400))
		throw new Error(
			`Limite de ${TM.cfg.lockMax || 400} travas ao mesmo tempo. Peca aos agentes para soltarem o que ja terminaram (file_unlock).`,
		);
	const k = tmLockKey(p, proj, kind, n);
	const l = {
		path: p,
		key: k,
		proj: proj,
		projName: o.projName ? String(o.projName).slice(0, 40) : '',
		agent: n,
		team: t ? t.name : '',
		kind: kind,
		mode: o.mode === 'manual' ? 'manual' : 'auto',
		at: tmNow(),
		until: tmNow() + dur,
		renews: 0,
		grace: false,
		note: o.note ? String(o.note).slice(0, 120) : '',
		ctxId: o.ctxId == null ? null : o.ctxId,
		ctxIds: o.ctxId == null ? [] : [o.ctxId],
	};
	K[k] = l;
	TM.stats.locksTaken = (TM.stats.locksTaken | 0) + 1;
	if (kind === 'read') TM.stats.readLocks = (TM.stats.readLocks | 0) + 1;
	tmAudit('lock', {
		arquivo: p,
		agente: n,
		tipo: tmLockTipo(l),
		modo: l.mode,
		prazo: tmSegTxt(dur / 1000),
		motivo: l.note,
		projeto: l.projName || proj,
	});
	return { lock: l, novo: true, estendeu: true };
}

function tmLockRelease(nome, path, opts) {
	const o = opts || {};
	const K = tmLocks();
	const p = tmNormPath(path);
	const todas = tmLocksOn(p, o.proj);
	if (!todas.length) return { soltou: false, arquivo: p, motivo: 'nao estava travado' };
	const n = tmAgNome(nome);
	const kind = tmLockKindArg(o.kind);
	const minhas = n
		? todas.filter(function (l) {
				return tmAgKey(l.agent) === tmAgKey(n) && (!kind || tmLockKind(l) === kind);
			})
		: [];
	const alvo = o.forcarUsuario ? todas : minhas;
	if (!alvo.length)
		throw new Error(
			`A trava de "${p}" nao e sua: ${tmLockDesc(todas[0])} So o dono dela ou o usuario podem solta-la.`,
		);
	alvo.forEach(function (l) {
		delete K[tmLockKeyOf(l)];
	});
	tmAudit(o.forcarUsuario ? 'lock-force' : 'unlock', {
		arquivo: p,
		agente: alvo[0].agent,
		quantas: alvo.length,
		porUsuario: !!o.forcarUsuario,
	});
	return { soltou: true, arquivo: p, de: alvo[0].agent, quantas: alvo.length };
}
