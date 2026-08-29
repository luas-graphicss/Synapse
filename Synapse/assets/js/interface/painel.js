'use strict';
function mcpRenderLog() {
	const box = $('#mcpLog');
	if (!box) return;
	box.innerHTML = MCP.log.length
		? MCP.log
				.map(
					(l) =>
						`<div class="mcp-log-item${l.kind === 'err' ? ' err' : ''}"><span class="t">${fmtLogTime(l.t).slice(0, 8)}</span><span>${esc(l.text)}</span></div>`,
				)
				.join('')
		: '<div class="mcp-empty">Nenhuma chamada ainda</div>';
}
function mcpRenderPanel() {
	const btn = $('#mcpBtn');
	if (!btn) return;
	const map = {
		online: ['ok', 'Conectado — pronto para receber o agente do Notion'],
		connecting: ['warn', 'Conectando ao relay…'],
		error: ['err', 'Sem conexão com o relay — confira a URL e o servidor'],
		off: ['', 'Inativo — ative para gerar a URL do Notion'],
	};
	let st = map[MCP.status] || map.off;
	try {
		const flv = typeof window.__flvUI === 'function' ? window.__flvUI() : null;
		if (MCP.active && flv && flv.online) {
			if (MCP.status !== 'online') {
				if (flv.portao && flv.portao.ok)
					st = [
						'ok',
						'Failover ativo — portão desviando pela URL única; pronto para receber agentes',
					];
				else if (flv.portao && flv.portao.sondado)
					st = ['err', 'URL única fora do ar — portão sem resposta; confira o deploy do portão'];
				else if (flv.portao) st = ['warn', 'Failover: verificando o portão da URL única…'];
				else
					st = [
						'err',
						'Nó principal fora (borda?) — SEM portão a URL única não atende; sessão preservada na reserva. Configure o portão (menu MCP).',
					];
			} else if (flv.ativa === 'reserva')
				st = ['ok', 'Nó de reserva atendendo — principal reconectado, retornando ao normal'];
		} else if (MCP.active && MCP.status !== 'online' && flv && flv.ligada) {
			st = [st[0], st[1] + ' · nós de reserva configurados, conectando…'];
		}
	} catch (e) {
		ignorarErro(e, 'mcpRenderPanel');
	}
	const sd = $('#mcpSdot');
	if (sd) sd.className = 'mcp-sdot' + (st[0] ? ' ' + st[0] : '');
	const stx = $('#mcpStatusText');
	if (stx) {
		let _ap = '';
		try {
			_ap = appStatusTexto();
		} catch (e) {
			ignorarErro(e, 'mcpRenderPanel');
		}
		stx.textContent =
			(_ap ? _ap + ' · ' : '') + st[1] + (MCP.calls ? ` · ${MCP.calls} chamada(s)` : '');
	}
	const ind = $('#mcpInd');
	if (ind) ind.className = 'mcp-ind' + (MCP.active && st[0] ? ' ' + st[0] : '');
	btn.classList.toggle('on', MCP.active);
	btn.title = MCP.active
		? `MCP ativo (${st[1]})`
		: 'MCP para Notion — deixe um agente de IA editar este projeto';
	const tg = $('#mcpToggle');
	if (tg) tg.textContent = MCP.active ? 'Desativar MCP' : 'Ativar MCP';
	const ub = $('#mcpUrlBox');
	if (ub) ub.classList.toggle('hidden', !MCP.active);
	const uf = $('#mcpUrlOut');
	if (uf) uf.value = MCP.active ? mcpPublicUrl() : '';
	mcpRenderLog();
	mcpRenderAgents();
}

const TMUI = {
	open: false,
	view: 'lista',
	teamId: null,
	sel: {},
	busca: '',
	erro: '',
	rendering: false,
	nome: '',
	desc: '',
	_conf: null,
};

function tmUIEl(id) {
	try {
		return document.getElementById(id);
	} catch (e) {
		return null;
	}
}
function tmUIEsc(s) {
	return typeof esc === 'function' ? esc(s) : String(s == null ? '' : s);
}
function tmUIToast(t, s, k) {
	try {
		if (typeof toast === 'function') toast(t, s, k);
	} catch (e) {
		ignorarErro(e, 'tmUIToast');
	}
}

function tmUITipo(t) {
	if (!t) return '';
	if (t.caps && t.caps.writeAny) return 'nativa - revisor';
	if (t.caps && t.caps.manageTeams) return 'nativa - gerenciador';
	if (t.caps && t.caps.plan) return 'nativa - planejador';
	return '';
}
function tmUIProj() {
	try {
		return typeof activeProject === 'function' ? activeProject() : null;
	} catch (e) {
		return null;
	}
}

function tmUIArvore() {
	const proj = tmUIProj();
	const itens = [];
	if (!proj) return itens;
	const dirs = {};
	const arquivos = [];
	try {
		proj.files.forEach(function (v, path) {
			arquivos.push(path);
			const partes = String(path).split('/');
			let acc = '';
			for (let i = 0; i < partes.length - 1; i++) {
				acc = acc ? acc + '/' + partes[i] : partes[i];
				dirs[acc] = 1;
			}
		});
		if (proj.emptyDirs && proj.emptyDirs.forEach)
			proj.emptyDirs.forEach(function (d) {
				if (d) dirs[String(d)] = 1;
			});
	} catch (e) {
		ignorarErro(e, 'tmUIArvore');
	}
	Object.keys(dirs).forEach(function (d) {
		itens.push({ path: d, dir: true });
	});
	arquivos.forEach(function (f) {
		itens.push({ path: f, dir: false });
	});
	itens.sort(function (a, b) {
		return a.path.toLowerCase() < b.path.toLowerCase()
			? -1
			: a.path.toLowerCase() > b.path.toLowerCase()
				? 1
				: 0;
	});
	return itens;
}

function tmUIDono(path, exceto) {
	try {
		const d = tmOwnerOf(path);
		if (!d || !d.team) return null;
		if (exceto && d.team.id === exceto) return null;
		return d.team;
	} catch (e) {
		return null;
	}
}
function tmUIConflitoPasta(path, exceto) {
	try {
		const k = String(tmKey(path) || '').toLowerCase();
		if (!k) return null;
		const memo = TMUI._conf;
		const ck = k + '|' + (exceto || '');
		if (memo && Object.prototype.hasOwnProperty.call(memo, ck)) return memo[ck];
		const ix = tmIndex();
		let achou = null;
		const olha = function (mapa) {
			if (achou || !mapa || !mapa.forEach) return;
			mapa.forEach(function (d, chave) {
				if (achou) return;
				if (exceto && d.team && d.team.id === exceto) return;
				if (
					String(chave)
						.toLowerCase()
						.indexOf(k + '/') === 0
				)
					achou = d.team;
			});
		};
		olha(ix.files);
		olha(ix.dirs);
		if (memo) memo[ck] = achou;
		return achou;
	} catch (e) {
		ignorarErro(e, 'tmUIConflitoPasta');
	}
	return null;
}

function tmUICobertoPorPasta(path) {
	const k = String(path).toLowerCase();
	let melhor = null;
	Object.keys(TMUI.sel).forEach(function (p) {
		if (!TMUI.sel[p] || !TMUI.sel[p].dir) return;
		const pk = p.toLowerCase();
		if (k === pk || k.indexOf(pk + '/') !== 0) return;
		if (!melhor || p.length > melhor.length) melhor = p;
	});
	return melhor;
}
function tmUIPodaSel() {
	let n = 0;
	Object.keys(TMUI.sel).forEach(function (p) {
		if (tmUICobertoPorPasta(p)) {
			delete TMUI.sel[p];
			n++;
		}
	});
	return n;
}

function tmUIListaHtml() {
	let modo = 'desligado';
	try {
		modo = tmTeamMode();
	} catch (e) {
		ignorarErro(e, 'tmUIListaHtml');
	}
	const equipes = (function () {
		try {
			return tmTeams();
		} catch (e) {
			return [];
		}
	})();
	const minhas = equipes.filter(function (t) {
		return !t.native;
	});
	const nativas = equipes.filter(function (t) {
		return !!t.native;
	});
	const agentes = (function () {
		try {
			return tmAgentList().length;
		} catch (e) {
			return 0;
		}
	})();
	const h = [];
	h.push('<div class="tm-sec">Equipes de agentes</div>');
	const ligado = modo === 'on';
	h.push(
		'<div class="tmui-status"><span class="tmui-dot' +
			(ligado ? ' on' : '') +
			'"></span>' +
			(ligado
				? `Regime ligado - ${minhas.length} equipe(s) sua(s), ${agentes} agente(s) registrado(s)`
				: minhas.length
					? `Regime DESLIGADO - suas ${minhas.length} equipe(s) continuam guardadas, mas agora nenhum arquivo esta protegido`
					: 'Nenhuma equipe sua ainda - o site funciona como antes ate voce criar a primeira') +
			'</div>',
	);
	h.push(
		'<div class="mcp-row"><button class="btn primary" id="tmuiNova" style="flex:1">+ Criar nova equipe</button></div>',
	);
	const cfgE = (function () {
		try {
			return tmEnlCfg();
		} catch (e) {
			return { ativo: false, porEquipe: 1 };
		}
	})();
	h.push(
		'<div class="mcp-row"><button class="btn" id="tmuiAlist" style="flex:1">Alistamento automatico &#183; ' +
			(cfgE.ativo ? `ligado, ${cfgE.porEquipe} por equipe` : 'desligado') +
			'</button></div>',
	);

	h.push('<div class="tmui-lista">');
	if (!minhas.length) h.push('<div class="mcp-empty">Voce ainda nao criou nenhuma equipe.</div>');
	minhas.concat(nativas).forEach(function (t) {
		const tipo = tmUITipo(t);
		const alvos = (t.files || []).length + (t.dirs || []).length;
		const vagas = t.maxAgents ? t.agents.length + '/' + t.maxAgents : String(t.agents.length);
		h.push(
			'<button class="tmui-item" data-team="' +
				tmUIEsc(t.id) +
				'">' +
				'<span class="tmui-nome">' +
				tmUIEsc(t.name) +
				(tipo ? `<span class="tmui-tag">${tmUIEsc(tipo)}</span>` : '') +
				'</span>' +
				'<span class="tmui-sub">' +
				vagas +
				' agente(s) - ' +
				alvos +
				' caminho(s)' +
				(t.allowLeave ? ' - saida liberada' : '') +
				'</span>' +
				'</button>',
		);
	});
	h.push('</div>');
	const glob = (function () {
		try {
			const p = tmUIProj();
			return tmGlobalsDo(p ? p.id : '');
		} catch (e) {
			return [];
		}
	})();
	h.push('<div class="tm-sec">Arquivos globais</div>');
	if (!glob.length) h.push('<div class="mcp-empty">Nenhum arquivo global neste projeto.</div>');
	else {
		h.push('<div class="tmui-lista">');
		glob.slice(0, 30).forEach(function (g) {
			h.push(
				`<div class="tmui-item" style="cursor:default"><span class="tmui-nome">${tmUIEsc(g.path)}${g.dir ? '<span class="tmui-tag">pasta</span>' : ''}</span>\
<span class="tmui-sub">sem dono - qualquer equipe pode alterar</span></div>`,
			);
		});
		if (glob.length > 30)
			h.push(`<div class="mcp-empty">e mais ${glob.length - 30} caminho(s)...</div>`);
		h.push('</div>');
	}
	h.push(
		'<div class="mcp-hint">Arquivo global nao tem dono: <b>todas</b> as equipes podem altera-lo (README, changelog, docs). ' +
			'Quem define e o agente da equipe <b>Gerenciador</b>, com <code>team_global_add</code> / <code>team_global_remove</code>.</div>',
	);
	h.push(
		`<div class="mcp-hint">As equipes <b>Integrador Revisor</b>, <b>Gerenciador</b> e <b>Planejador / \
Divisor</b> sao do site e nao podem ser apagadas (uma vaga cada). O Planejador nao altera arquivos: \
ele planeja o sistema e entrega um prompt por equipe para voce rodar em paralelo. Para um agente entrar, \
peca a ele: <code>entre na equipe "nome" e se registre</code>.</div>`,
	);
	return h.join('');
}

function tmUIDetalheHtml() {
	const t = (function () {
		try {
			return tmTeam(TMUI.teamId);
		} catch (e) {
			return null;
		}
	})();
	if (!t)
		return '<div class="mcp-empty">Essa equipe nao existe mais.</div><div class="mcp-row"><button class="btn" id="tmuiVoltar" style="flex:1">Voltar</button></div>';
	const tipo = tmUITipo(t);
	const h = [];
	h.push(
		'<div class="tmui-head"><button class="tmui-back" id="tmuiVoltar" title="Voltar para a lista">&#8592;</button>' +
			'<span class="tmui-titulo">' +
			tmUIEsc(t.name) +
			'</span>' +
			(tipo ? `<span class="tmui-tag">${tmUIEsc(tipo)}</span>` : '') +
			'</div>',
	);
	if (t.desc) h.push(`<div class="mcp-hint" style="margin-top:0">${tmUIEsc(t.desc)}</div>`);

	if (t.caps && t.caps.writeAny)
		h.push(
			'<div class="tmui-aviso">Equipe nativa: um agente so. Ele pode alterar QUALQUER arquivo para consertar incompatibilidades entre as equipes.</div>',
		);
	else if (t.caps && t.caps.manageTeams)
		h.push(
			'<div class="tmui-aviso">Equipe nativa: o agente daqui administra suas equipes pelo MCP e mexe em arquivos sem dono. Preencher e opcional.</div>',
		);

	h.push(
		`<label class="tmui-check"><input type="checkbox" id="tmuiSaida"${t.allowLeave ? ' checked' : ''}/><span>Permitir que o agente saia desta equipe</span></label>`,
	);
	h.push(
		'<div class="mcp-hint" style="margin-top:2px">Desligado, quem entra fica ate voce liberar. Isso evita agente pulando de equipe no meio da tarefa.</div>',
	);

	h.push(
		`<div class="tm-sec" style="margin-top:12px">Agentes nesta equipe (${t.agents.length})</div>`,
	);
	if (!t.agents.length) h.push('<div class="mcp-empty">Nenhum agente entrou ainda.</div>');
	else {
		h.push('<div class="tmui-lista">');
		t.agents.forEach(function (k) {
			const a = (function () {
				try {
					return tmAgent(k);
				} catch (e) {
					return null;
				}
			})();
			const nome = a ? a.name : k;
			const trav = (function () {
				try {
					return tmLocksDoAgente(nome).length;
				} catch (e) {
					return 0;
				}
			})();
			h.push(
				'<div class="tmui-ag"><span class="tmui-agn">' +
					tmUIEsc(nome) +
					'</span>' +
					'<span class="tmui-sub">' +
					(a && a.writes ? a.writes + ' alteracao(oes)' : 'sem alteracoes') +
					(trav ? ` - ${trav} arquivo(s) travado(s)` : '') +
					'</span>' +
					'<button class="tmui-x" data-rmag="' +
					tmUIEsc(nome) +
					'" title="Remover este agente da equipe">&#215;</button></div>',
			);
		});
		h.push('</div>');
	}

	const dirs = t.dirs || [],
		files = t.files || [];
	h.push(
		`<div class="tm-sec" style="margin-top:12px">Arquivos que esta equipe pode alterar (${dirs.length}${files.length})</div>`,
	);
	if (t.caps && (t.caps.writeAny || t.caps.manageTeams))
		h.push(
			'<div class="mcp-hint" style="margin-top:0">Esta equipe nativa nao depende de lista de arquivos.</div>',
		);
	if (!dirs.length && !files.length)
		h.push(
			'<div class="mcp-empty">Nenhum caminho ainda - o agente desta equipe nao consegue alterar nada.</div>',
		);
	else {
		h.push('<div class="tmui-lista">');
		dirs.forEach(function (p) {
			h.push(
				`<div class="tmui-path"><span class="tmui-pico">&#128193;</span><span class="tmui-pnome" title="${tmUIEsc(p)}">${tmUIEsc(p)}/ \
<i>(pasta inteira)</i></span><button class="tmui-x" data-rmpath="${tmUIEsc(p)}" title="Tirar da equipe">\
&#215;</button></div>`,
			);
		});
		files.forEach(function (p) {
			h.push(
				`<div class="tmui-path"><span class="tmui-pico">&#128196;</span><span class="tmui-pnome" title="${tmUIEsc(p)}">${tmUIEsc(p)}</span>\
<button class="tmui-x" data-rmpath="${tmUIEsc(p)}" title="Tirar da equipe">&#215;</button></div>`,
			);
		});
		h.push('</div>');
	}
	h.push(
		'<div class="mcp-row"><button class="btn" id="tmuiAddPaths" style="flex:1">+ Adicionar arquivos</button></div>',
	);

	if (!t.native) {
		h.push('<div class="menu-sep"></div>');
		h.push(
			'<div class="mcp-row"><button class="btn tmui-danger" id="tmuiApagar" style="flex:1">Apagar equipe</button></div>',
		);
	}
	return h.join('');
}
function tmUIAlistHtml() {
	const c = tmEnlCfg();
	const proj = tmUIProj();
	const diag = (function () {
		try {
			return tmEnlDiag(proj ? proj.id : '');
		} catch (e) {
			return { pool: [], fora: [], dentro: [] };
		}
	})();
	const eleg = diag.pool;
	const prox = (function () {
		try {
			const e = tmEnlEscolher(proj ? proj.id : '');
			return e ? { equipe: e.team.name, nome: tmEnlNome(e.team), estourou: e.estourou } : null;
		} catch (e) {
			return null;
		}
	})();
	let vagas = 0;
	eleg.forEach(function (t) {
		vagas += Math.max(0, c.porEquipe - (t.agents || []).length);
	});
	const exemplo =
		(c.prefixo ? c.prefixo + '-' : '') + (eleg.length ? tmAgSlugTraco(eleg[0].name) : 'fisica');
	const h = [];
	h.push(
		'<div class="tmui-head"><button class="tmui-back" id="tmuiVoltar" title="Voltar para a lista">&#8592;</button>' +
			'<span class="tmui-titulo">Alistamento automatico</span></div>',
	);
	h.push(
		'<div class="mcp-hint" style="margin-top:0">O agente chama <code>team_enlist</code> e o site ja o encaixa em uma equipe, com nome novo. ' +
			'Ninguem fica esperando: a distribuicao acontece na propria chamada.</div>',
	);
	h.push(
		`<label class="tmui-check"><input type="checkbox" id="tmuiAlistOn"${c.ativo ? ' checked' : ''}/><span>Aceitar agentes se alistando sozinhos</span></label>`,
	);
	h.push('<label class="mcp-lab" for="tmuiAlistQtd">Quantos agentes por equipe</label>');
	h.push(
		`<input class="mcp-in" id="tmuiAlistQtd" type="number" min="1" max="50" step="1" value="${c.porEquipe}"/>`,
	);
	h.push(
		'<div class="mcp-hint">O site completa TODAS as equipes ate esse numero antes de ' +
			'repetir. Depois que todas batem o alvo, ele continua pela equipe mais vazia: passar do ' +
			'alvo nesse ponto e o esperado, nao e erro.</div>',
	);
	h.push('<label class="mcp-lab" for="tmuiAlistPre">Prefixo do nome do agente</label>');
	h.push(
		`<input class="mcp-in" id="tmuiAlistPre" maxlength="24" spellcheck="false" autocomplete="off" value="${tmUIEsc(c.prefixo)}"/>`,
	);
	h.push(
		`<div class="mcp-hint">Fica assim: <code>${tmUIEsc(exemplo)}</code>. Espaco no nome da equipe vira \
<code>-</code>; o segundo agente da mesma equipe recebe <code>${tmUIEsc(exemplo + '-2')}</code>.</div>`,
	);
	h.push(
		`<label class="tmui-check"><input type="checkbox" id="tmuiAlistProj"${c.soProjeto ? ' checked' : ''}/><span>So equipes do projeto aberto</span></label>`,
	);
	h.push(
		`<label class="tmui-check"><input type="checkbox" id="tmuiAlistNat"${c.nativas ? ' checked' : ''}/>\
<span>Incluir as equipes nativas (Gerenciador e Integrador Revisor)</span></label>`,
	);
	h.push(
		`<label class="tmui-check"><input type="checkbox" id="tmuiAlistUni"${c.unicos ? ' checked' : ''}/><span>Renomear quem chegar com nome ja usado (agente-fisica-2)</span></label>`,
	);
	h.push('<div class="mcp-hint">Tudo aqui vale na hora: nao existe botao de salvar.</div>');
	h.push('<div class="menu-sep"></div>');
	h.push(
		'<div class="tmui-conta">' +
			eleg.length +
			' equipe(s) no sorteio &#183; ' +
			vagas +
			' vaga(s) ate o alvo de ' +
			c.porEquipe +
			' por equipe' +
			(diag.fora.length ? ` &#183; ${diag.fora.length} fora` : '') +
			'</div>',
	);
	if (prox)
		h.push(
			`<div class="mcp-hint" style="margin-top:0">Proximo a se alistar vai para <b>${tmUIEsc(prox.equipe)}</b>\
 como <code>${tmUIEsc(prox.nome)}</code>${prox.estourou ? ' (todas ja bateram o alvo)' : ''}.</div>`,
		);
	if (!eleg.length)
		h.push(
			'<div class="mcp-empty">Nenhuma equipe elegivel agora. Crie equipes, abra o projeto delas ou desmarque "so equipes do projeto aberto".</div>',
		);
	eleg.slice(0, 14).forEach(function (t) {
		const n = (t.agents || []).length;
		h.push(
			`<div class="tmui-path"><span class="tmui-pico">&#128101;</span><span class="tmui-pnome" title="${tmUIEsc(t.name)}">${tmUIEsc(t.name)}</span>\
<span class="tmui-motivo">${n}/${c.porEquipe}${n >= c.porEquipe ? ' - cheia' : ''}</span></div>`,
		);
	});
	if (diag.fora.length) {
		h.push(
			`<div class="tm-sec" style="margin-top:12px">Fora do sorteio (${diag.fora.length})</div>`,
		);
		diag.fora.slice(0, 10).forEach(function (f) {
			h.push(
				`<div class="tmui-path"><span class="tmui-pnome">${tmUIEsc(f.t.name)}</span><span class="tmui-motivo">${tmUIEsc(f.motivo)}</span></div>`,
			);
		});
	}
	const log = (function () {
		try {
			return tmEnlLog();
		} catch (e) {
			return [];
		}
	})();
	if (log.length) {
		h.push('<div class="menu-sep"></div>');
		h.push('<div class="tm-sec" style="margin-top:12px">Ultimos alistamentos desta sessao</div>');
		log
			.slice(-8)
			.reverse()
			.forEach(function (e) {
				h.push(
					`<div class="tmui-path"><span class="tmui-pnome">${tmUIEsc(e.nome)}</span><span class="tmui-motivo">${tmUIEsc(e.equipe)}${e.estourou ? ' (alem do alvo)' : ''}</span></div>`,
				);
			});
	}
	return h.join('');
}
function tmUIDigitando() {
	try {
		const el = document.activeElement;
		if (!el) return false;
		const tag = String(el.tagName || '').toUpperCase();
		if (tag !== 'INPUT' && tag !== 'TEXTAREA') return false;
		const body = tmUIEl('tmuiBody');
		return !!(body && body.contains && body.contains(el));
	} catch (e) {
		return false;
	}
}
function tmUIRenderIdle() {
	if (tmUIDigitando()) return false;
	tmUIRender();
	return true;
}

function tmUIAlistSalvar(silencioso) {
	const c = tmEnlCfg();
	const on = tmUIEl('tmuiAlistOn'),
		qtd = tmUIEl('tmuiAlistQtd'),
		pre = tmUIEl('tmuiAlistPre'),
		pj = tmUIEl('tmuiAlistProj'),
		nat = tmUIEl('tmuiAlistNat'),
		uni = tmUIEl('tmuiAlistUni');
	const novo = tmEnlSane({
		ativo: on ? on.checked : c.ativo,
		porEquipe: qtd ? qtd.value : c.porEquipe,
		prefixo: pre ? pre.value : c.prefixo,
		soProjeto: pj ? pj.checked : c.soProjeto,
		nativas: nat ? nat.checked : c.nativas,
		unicos: uni ? uni.checked : c.unicos,
	});
	TM.cfg.enlist = novo;
	tmAgSave();
	try {
		tmAudit('enlist-cfg', novo);
	} catch (e) {
		ignorarErro(e, 'tmUIAlistSalvar');
	}
	if (!silencioso) {
		tmUIToast(
			'Alistamento atualizado',
			novo.ativo
				? novo.porEquipe + ' agente(s) por equipe'
				: 'agentes nao podem mais se alistar sozinhos',
			'ok',
		);
		tmUIRender();
	}
	return novo;
}

function tmUICriarHtml() {
	const editando = TMUI.view === 'addpaths';
	const t = editando
		? (function () {
				try {
					return tmTeam(TMUI.teamId);
				} catch (e) {
					return null;
				}
			})()
		: null;
	const h = [];
	h.push(
		'<div class="tmui-head"><button class="tmui-back" id="tmuiVoltar" title="Voltar">&#8592;</button>' +
			'<span class="tmui-titulo">' +
			(editando ? `Adicionar arquivos a "${tmUIEsc(t ? t.name : '')}"` : 'Criar nova equipe') +
			'</span></div>',
	);
	if (!editando) {
		h.push('<label class="mcp-lab" for="tmuiNome">Nome da equipe</label>');
		h.push(
			`<input class="mcp-in" id="tmuiNome" maxlength="60" placeholder="Fisica, Runtime, Design..." spellcheck="false" autocomplete="off" value="${tmUIEsc(TMUI.nome || '')}"/>`,
		);
		h.push('<label class="mcp-lab" for="tmuiDesc">Descricao (opcional)</label>');
		h.push(
			`<input class="mcp-in" id="tmuiDesc" maxlength="400" placeholder="O que esta equipe cuida" autocomplete="off" value="${tmUIEsc(TMUI.desc || '')}"/>`,
		);
	}
	h.push('<label class="mcp-lab">Arquivos e pastas que esta equipe podera ALTERAR</label>');
	h.push(
		`<input class="mcp-in" id="tmuiBusca" placeholder="Filtrar por nome..." spellcheck="false" autocomplete="off" value="${tmUIEsc(TMUI.busca)}"/>`,
	);
	h.push(`<div class="tmui-picker" id="tmuiPicker">${tmUIPickerHtml()}</div>`);
	h.push(
		`<div class="tmui-erro${TMUI.erro ? '' : ' hidden'}" id="tmuiErro">${tmUIEsc(TMUI.erro)}</div>`,
	);
	h.push(
		`<div class="mcp-row"><button class="btn primary" id="tmuiConcluir" style="flex:1">${editando ? 'Adicionar a equipe' : 'Criar equipe'}</button>\
<button class="btn" id="tmuiCancelar">Cancelar</button></div>`,
	);
	h.push(
		'<div class="mcp-hint">Marcar uma pasta cobre tudo que esta dentro dela, inclusive arquivos criados depois. ' +
			'Caminho que ja e de outra equipe aparece travado: um arquivo so pode ter um dono.</div>',
	);
	return h.join('');
}

function tmUIPickerHtml() {
	TMUI._conf = {};
	tmUIPodaSel();
	const proj = tmUIProj();
	if (!proj)
		return '<div class="mcp-empty">Nenhum projeto aberto. Abra o projeto para escolher os arquivos da equipe.</div>';
	const itens = tmUIArvore();
	if (!itens.length) return '<div class="mcp-empty">Este projeto ainda nao tem arquivos.</div>';
	const q = String(TMUI.busca || '')
		.trim()
		.toLowerCase();
	const filtrados = q
		? itens.filter(function (x) {
				return x.path.toLowerCase().includes(q);
			})
		: itens;
	if (!filtrados.length)
		return `<div class="mcp-empty">Nenhum caminho com "${tmUIEsc(TMUI.busca)}".</div>`;
	const MAX = 400;
	const mostra = filtrados.slice(0, MAX);
	const exceto = TMUI.view === 'addpaths' ? TMUI.teamId : null;
	const h = [];
	mostra.forEach(function (x) {
		const depth = x.path.split('/').length - 1;
		const nome = x.path.split('/').pop();
		const dono = tmUIDono(x.path, exceto);
		const dentro = !dono && x.dir ? tmUIConflitoPasta(x.path, exceto) : null;
		const pai = tmUICobertoPorPasta(x.path);
		const marcado = !!TMUI.sel[x.path] && !pai;
		const travado = !!dono || !!dentro || !!pai;
		const motivo = dono
			? `ja e da equipe "${dono.name}"`
			: dentro
				? `contem arquivos da equipe "${dentro.name}"`
				: pai
					? 'coberto pela pasta ' + pai
					: '';
		h.push(
			'<label class="tmui-row' +
				(travado ? ' travado' : '') +
				'" title="' +
				tmUIEsc(x.path + (motivo ? ' - ' + motivo : '')) +
				'">' +
				'<input type="checkbox" data-pick="' +
				tmUIEsc(x.path) +
				'" data-dir="' +
				(x.dir ? '1' : '0') +
				'"' +
				(marcado ? ' checked' : '') +
				(travado ? ' disabled' : '') +
				'/>' +
				'<span class="tmui-ind" style="width:' +
				depth * 11 +
				'px"></span>' +
				'<span class="tmui-pico">' +
				(x.dir ? '&#128193;' : '&#128196;') +
				'</span>' +
				'<span class="tmui-pnome">' +
				tmUIEsc(nome) +
				(x.dir ? '/' : '') +
				'</span>' +
				(motivo ? `<span class="tmui-motivo">${tmUIEsc(motivo)}</span>` : '') +
				'</label>',
		);
	});
	if (filtrados.length > MAX)
		h.push(
			`<div class="mcp-empty">Mostrando ${MAX} de ${filtrados.length} caminhos. Use o filtro acima para achar o resto.</div>`,
		);
	const n = Object.keys(TMUI.sel).length;
	h.push(
		`<div class="tmui-conta">${n ? n + ' caminho(s) marcado(s)' : 'nenhum caminho marcado ainda'}</div>`,
	);
	return h.join('');
}

function tmUIRenderPicker() {
	const p = tmUIEl('tmuiPicker');
	if (!p) return;
	p.innerHTML = tmUIPickerHtml();
}
