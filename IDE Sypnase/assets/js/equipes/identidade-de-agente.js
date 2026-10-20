'use strict';
const TM_ENL_DEFAULT = {
	ativo: true,
	porEquipe: 1,
	prefixo: 'agente',
	nativas: false,
	soProjeto: true,
	unicos: true,
};
const TM_ENL_LIMITS = {
	porEquipeMin: 1,
	porEquipeMax: 50,
	prefixo: 24,
	log: 60,
	dupWindowMs: 120000,
	reentraMs: 20000,
	nome: 40,
};

function tmAgSlugTraco(x) {
	let v = String(x == null ? '' : x).trim();
	try {
		v = v.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
	} catch (e) {
		ignorarErro(e, 'tmAgSlugTraco');
	}
	return v
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+/, '')
		.replace(/-+$/, '')
		.slice(0, TM_ENL_LIMITS.nome);
}
function tmEnlSane(x) {
	const o = x && typeof x === 'object' && !Array.isArray(x) ? x : {};
	const q = Math.floor(Number(o.porEquipe));
	const pre = tmAgSlugTraco(o.prefixo === undefined ? TM_ENL_DEFAULT.prefixo : o.prefixo).slice(
		0,
		TM_ENL_LIMITS.prefixo,
	);
	return {
		ativo: o.ativo === undefined ? TM_ENL_DEFAULT.ativo : !!o.ativo,
		porEquipe:
			isFinite(q) && q >= TM_ENL_LIMITS.porEquipeMin && q <= TM_ENL_LIMITS.porEquipeMax
				? q
				: TM_ENL_DEFAULT.porEquipe,
		prefixo: pre || TM_ENL_DEFAULT.prefixo,
		nativas: !!o.nativas,
		soProjeto: o.soProjeto === undefined ? TM_ENL_DEFAULT.soProjeto : !!o.soProjeto,
		unicos: o.unicos === undefined ? TM_ENL_DEFAULT.unicos : !!o.unicos,
	};
}
function tmEnlCfg() {
	if (!TM.cfg.enlist || typeof TM.cfg.enlist !== 'object' || Array.isArray(TM.cfg.enlist))
		TM.cfg.enlist = tmEnlSane(null);
	return TM.cfg.enlist;
}
function tmAgNomeLivre(base) {
	const A = tmAgents();
	const raiz = tmAgNome(base) || 'agente';
	if (!A[tmAgKey(raiz)]) return raiz;
	for (let i = 2; i <= TM_AGENT_MAX + 2; i++) {
		const corte = Math.max(1, TM_ENL_LIMITS.nome - (String(i).length + 1));
		const tent = raiz.slice(0, corte) + '-' + i;
		if (!A[tmAgKey(tent)]) return tent;
	}
	return raiz.slice(0, 28) + '-' + tmNow().toString(36);
}
function tmAgVisto(nome) {
	const a = tmAgent(nome);
	let t = a ? Number(a.lastSeen) || 0 : 0;
	try {
		const S = typeof AG !== 'undefined' && AG && AG.seen ? AG.seen : null;
		if (S)
			Object.keys(S).forEach(function (k) {
				if (tmAgKey(k) === tmAgKey(nome)) {
					const v = Number(S[k]) || 0;
					if (v > t) t = v;
				}
			});
	} catch (e) {
		ignorarErro(e, 'tmAgVisto');
	}
	return t;
}
function tmAgDuplicado(nome) {
	if (!tmEnlCfg().unicos) return false;
	const a = tmAgent(nome);
	if (!a) return false;
	return tmNow() - tmAgVisto(nome) < TM_ENL_LIMITS.dupWindowMs;
}
function tmAgOutroAgente(a) {
	if (!a || !tmEnlCfg().unicos) return false;
	if (tmNow() - tmAgVisto(a.name) >= TM_ENL_LIMITS.dupWindowMs) return false;
	return (
		(Number(a.writes) || 0) > 0 || tmNow() - (Number(a.joinedAt) || 0) > TM_ENL_LIMITS.reentraMs
	);
}

function tmAgentsSync() {
	const ts = TM.teams && typeof TM.teams === 'object' ? TM.teams : (TM.teams = {});
	Object.keys(ts).forEach(function (id) {
		const t = ts[id];
		if (!t) return;
		if (!t.caps || typeof t.caps !== 'object')
			t.caps = { writeAny: false, writeOwnerless: false, manageTeams: false, review: false };
		t.agents = [];
	});
	const A = tmAgents();
	const lista = [];
	Object.keys(A).forEach(function (k) {
		const a = A[k];
		if (!a || typeof a !== 'object' || !tmAgNome(a.name)) {
			delete A[k];
			return;
		}
		a.name = tmAgNome(a.name);
		const kk = tmAgKey(a.name);
		if (kk !== k) {
			delete A[k];
			if (!A[kk]) {
				A[kk] = a;
			} else {
				tmAudit('agent-duplicado', { agente: a.name, mantido: A[kk].name });
				return;
			}
		}
		a.teamId = String(a.teamId || '');
		a.joinedAt = Number(a.joinedAt) || 0;
		a.lastSeen = Number(a.lastSeen) || 0;
		a.writes = Number(a.writes) || 0;
		a.denied = Number(a.denied) || 0;
		lista.push(a);
	});
	lista.sort(function (x, y) {
		return (x.joinedAt || 0) - (y.joinedAt || 0);
	});
	lista.forEach(function (a) {
		const t = a.teamId ? ts[a.teamId] : null;
		if (!t) {
			if (a.teamId) tmAudit('agent-orfao', { agente: a.name, equipe: String(a.teamId) });
			a.teamId = '';
			a.joinedAt = 0;
			return;
		}
		if (!Array.isArray(t.agents)) t.agents = [];
		if (t.maxAgents && t.agents.length >= t.maxAgents) {
			tmAudit('agent-excedente', { agente: a.name, equipe: t.name, limite: t.maxAgents });
			a.teamId = '';
			a.joinedAt = 0;
			return;
		}
		t.agents.push(a.name);
	});
	return lista.length;
}

function tmTeamMode() {
	let m = String((TM.cfg && TM.cfg.teamMode) || 'auto');
	if (!tmModoValido(m)) {
		m = 'auto';
		try {
			TM.cfg.teamMode = 'auto';
		} catch (e) {
			ignorarErro(e, 'tmTeamMode');
		}
	}
	if (m !== 'auto') return m;
	return tmTeams().some(function (t) {
		return !t.native;
	})
		? 'on'
		: 'off';
}
function tmRegimeAtivo() {
	return tmTeamMode() !== 'off';
}

function tmAgentCanWrite(nome, path, proj) {
	const p = tmNormPath(path);
	const n = tmAgNome(nome);
	if (!n)
		return {
			ok: false,
			motivo: `Alteracao em "${p}" recusada: a chamada nao disse QUEM e voce. Este site tem Equipes ativas \
— informe agent="seu-nome" em TODAS as chamadas e entre na sua equipe com team_join. Leitura continua \
liberada.`,
		};
	const t = tmAgentTeam(n);
	if (!t)
		return {
			ok: false,
			motivo: `O agente "${n}" nao esta em nenhuma equipe, entao nao pode alterar "${p}". Peca ao usuario \
o nome da sua equipe e use team_join (ex.: team="Fisica"). Voce continua podendo LER qualquer arquivo.`,
		};
	return tmTeamCanWrite(t, p, proj);
}

function tmAgSlug(x) {
	let v = String(x == null ? '' : x)
		.trim()
		.replace(/^[\s"'`«»]+/, '')
		.replace(/[\s"'`«»]+$/, '');
	try {
		v = v.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
	} catch (e) {
		ignorarErro(e, 'tmAgSlug');
	}
	return v.toLowerCase().replace(/[^a-z0-9]+/g, '');
}
function tmTeamHumano(ref) {
	const cru = String(ref == null ? '' : ref).trim();
	const limpo = cru.replace(/^[\s"'`«»]+/, '').replace(/[\s"'`«»]+$/, '');
	const t = tmTeam(limpo) || tmTeam(cru);
	if (t) return t;
	const lista = tmTeams();
	const alvo = tmAgSlug(cru);
	if (alvo) {
		const cand = lista.filter(function (x) {
			return tmAgSlug(x.name) === alvo;
		});
		if (cand.length === 1) return cand[0];
		if (cand.length > 1)
			throw new Error(
				'Existe mais de uma equipe parecida com "' +
					cru +
					'": ' +
					cand
						.map(function (x) {
							return `"${x.name}"`;
						})
						.join(', ') +
					'. Pergunte ao usuario qual delas e use o nome exato.',
			);
	}
	throw new Error(
		'Nao existe equipe "' +
			cru +
			'". Equipes disponiveis: ' +
			(lista
				.map(function (x) {
					return `"${x.name}"`;
				})
				.join(', ') || '(nenhuma)') +
			'. Confirme o nome com o usuario.',
	);
}

function tmTeamPreflight(ctx) {
	if (!ctx || ctx.probe || ctx.writesAll) return true;
	const modo = tmTeamMode();
	if (modo === 'off') return true;
	const vistos = {},
		alvos = [];
	const add = function (p) {
		const n = tmNormPath(p);
		if (!n) return;
		const k = n.toLowerCase();
		if (vistos[k]) return;
		vistos[k] = 1;
		alvos.push(n);
	};
	try {
		ctx.allow.forEach(add);
	} catch (e) {
		ignorarErro(e, 'tmTeamPreflight');
	}
	try {
		(ctx.prefixes || []).forEach(add);
	} catch (e) {
		ignorarErro(e, 'tmTeamPreflight');
	}
	if (!alvos.length) return true;
	const nome = ctx.agent || '',
		ruins = [];
	alvos.forEach(function (p) {
		const v = tmAgentCanWrite(nome, p, ctx.projId);
		if (!v.ok) ruins.push({ path: p, motivo: v.motivo });
	});
	if (!ruins.length) return true;
	const info = {
		tool: ctx.tool,
		agent: nome || '(sem nome)',
		recusados: ruins
			.map(function (r) {
				return r.path;
			})
			.slice(0, 12),
		total: alvos.length,
	};
	if (modo === 'shadow') {
		TM.stats.teamShadow = (TM.stats.teamShadow | 0) + 1;
		tmAudit('team-shadow-preflight', info);
		return true;
	}
	TM.stats.teamPreflight = (TM.stats.teamPreflight | 0) + 1;
	TM.stats.teamDenied = (TM.stats.teamDenied | 0) + 1;
	const a = tmAgent(nome);
	if (a) a.denied++;
	ctx.teamBlocked = (ctx.teamBlocked | 0) + 1;
	tmAudit('team-preflight-deny', info);
	const linhas = ruins
		.slice(0, 6)
		.map(function (r) {
			return '- ' + r.path;
		})
		.join('\n');
	throw new Error(
		'Chamada recusada INTEIRA, nada foi alterado (' +
			ruins.length +
			' de ' +
			alvos.length +
			' caminho(s) nao sao da sua equipe):\n' +
			linhas +
			(ruins.length > 6 ? `\n- (+${ruins.length - 6} outros)` : '') +
			'\n\n' +
			ruins[0].motivo,
	);
}

function tmTeamGate(ctx, path, op) {
	if (!ctx || ctx.probe) return true;
	try {
		const topo = TM.active[TM.active.length - 1];
		if (
			topo &&
			topo !== ctx &&
			topo.agent &&
			ctx.agent &&
			tmAgKey(topo.agent) !== tmAgKey(ctx.agent)
		)
			tmAudit('ctx-cruzado', {
				path: tmNormPath(path),
				autorizou: ctx.agent,
				executando: topo.agent,
				tool: ctx.tool,
			});
	} catch (e) {
		ignorarErro(e, 'tmTeamGate');
	}
	const modo = tmTeamMode();
	if (modo === 'off') return true;
	const agente = ctx.agent || '';
	const v = tmAgentCanWrite(agente, path, ctx.projId);
	const a = tmAgent(agente);
	if (v.ok) {
		if (a) {
			a.writes++;
			a.lastSeen = tmNow();
		}
		return true;
	}
	if (a) a.denied++;
	const info = {
		tool: ctx.tool,
		agent: agente || '(sem nome)',
		path: tmNormPath(path),
		op: op,
		motivo: v.motivo,
	};
	if (ctx.writesAll && modo !== 'shadow') {
		let dono = null;
		try {
			dono = tmOwnerOf(path, ctx.projId);
		} catch (e) {
			ignorarErro(e, 'tmTeamGate');
		}
		if (dono) {
			TM.stats.teamShadow = (TM.stats.teamShadow | 0) + 1;
			tmAudit('team-terminal-cross', info);
		}
		return true;
	}
	if (modo === 'shadow') {
		TM.stats.teamShadow = (TM.stats.teamShadow | 0) + 1;
		tmAudit('team-shadow-deny', info);
		return true;
	}
	TM.stats.teamDenied = (TM.stats.teamDenied | 0) + 1;
	tmAudit('team-deny', info);
	ctx.teamBlocked = (ctx.teamBlocked | 0) + 1;
	throw new Error(v.motivo);
}

function tmTeamAlvos(t) {
	const d = (t.dirs || []).slice(0, 10).map(function (x) {
		return x + '/ (pasta inteira)';
	});
	const f = (t.files || []).slice(0, 14);
	const all = d.concat(f);
	const extra = (t.files || []).length + (t.dirs || []).length - all.length;
	return all.join(', ') + (extra > 0 ? ` e mais ${extra} caminho(s)` : '');
}
function tmWelcome(t, a, jaEstava) {
	const L = [];
	L.push(
		(jaEstava ? 'Voce JA estava registrado na equipe "' : 'Voce entrou na equipe "') +
			t.name +
			'".' +
			(t.desc ? ' Descricao: ' + t.desc : ''),
	);
	if (t.caps.plan) {
		L.push('Voce entrou na Equipe PLANEJADOR / DIVISOR (equipe nativa do site, uma vaga so).');
		L.push(
			'SEU TRABALHO: ajudar o usuario com os sistemas que ele precisa fazer. Voce PLANEJA o ' +
				'sistema que ele pediu, escolhendo a arquitetura que mais combina com o projeto e que ' +
				'seja profissional, e DIVIDE esse sistema entre as equipes que ja existem.',
		);
		L.push(
			'VOCE NAO ALTERA ARQUIVO NENHUM. Ler o projeto e sempre liberado (list_files, read_file, search, outline, review_deps); gravar, nunca — quem grava sao as equipes que voce instruir.',
		);
		L.push('COMO TRABALHAR:');
		L.push(
			'1) Entenda o pedido e o projeto: use plan_split (devolve, em uma chamada, as equipes ' +
				'deste projeto, os arquivos/pastas de cada uma, os arquivos globais e os arquivos sem ' +
				'dono) e leia o codigo que importa com outline/read_file.',
		);
		L.push(
			'2) Planeje a arquitetura: modulos, responsabilidades, fluxo de dados e o CONTRATO entre ' +
				'as partes — nome exato de cada funcao/classe/evento/rota, parametros, retorno e formato ' +
				'dos dados. Esse contrato e o que impede uma equipe de errar a API da outra.',
		);
		L.push(
			'3) Analise QUAIS equipes vao mexer no sistema pedido: so as donas dos arquivos envolvidos.',
		);
		L.push(
			'4) Escreva UM PROMPT PARA CADA equipe escolhida e entregue todos ao usuario, um bloco por equipe, com o nome da equipe no titulo. O usuario vai rodar todas em PARALELO, um agente por prompt.',
		);
		L.push(
			`CADA PROMPT PRECISA TER: (a) a entrada — team_join team="<equipe>" project="${tmTeamProjNome(t) || '<projeto>'}" \
e agent="<nome-do-agente>" em TODAS as chamadas; (b) o que essa equipe vai construir; (c) os arquivos \
exatos que ela pode alterar (os dela + os globais); (d) o contrato de API ja fechado, copiado IGUAL \
em todos os prompts; (e) o que ela NAO deve mexer (arquivo de outra equipe e so leitura); (f) file_lock \
antes de reescrever e file_unlock ao terminar.`,
		);
		L.push(
			'FIM DE TODO PROMPT (obrigatorio): mande o agente chamar review_submit files=[arquivos ' +
				'alterados] note="o que mudou" e depois msg_send team="Integrador Revisor" com a LISTA ' +
				'DOS ARQUIVOS QUE ELE ALTEROU, pedindo que o revisor revise esses arquivos JUNTO com os ' +
				'das outras equipes, que tambem vao mandar mensagem. Assim tudo e conferido junto e o ' +
				'sistema fecha compativel.',
		);
		L.push(
			'Quando todas as equipes que voce dividiu terminarem, o sistema que o usuario pediu esta feito. Feche a sua entrega dizendo isso, com a ordem de execucao e as dependencias entre os prompts.',
		);
		L.push(
			'Se faltar equipe para alguma parte do sistema, nao invente: peca ao usuario (ou ao agente Gerenciador, por msg_send) para criar a equipe com os arquivos certos antes de rodar os prompts.',
		);
		L.push(
			`ARQUIVOS GLOBAIS deste projeto (qualquer equipe pode alterar): ${tmGlobalsTxt(tmTeamProj(t))}.`,
		);
		if (tmTeamProj(t))
			L.push(
				`Esta equipe trabalha no projeto "${tmTeamProjNome(t)}": passe project="${tmTeamProjNome(t)}" nas chamadas.`,
			);
		L.push(
			t.allowLeave
				? 'A saida desta equipe esta LIBERADA pelo usuario: voce pode usar team_leave.'
				: 'Voce NAO pode sair desta equipe por conta propria: so o usuario libera a saida.',
		);
		L.push(`Identifique-se com agent="${a.name}" em TODAS as chamadas.`);
		L.push(
			'CONVERSA: list_agents mostra quem esta ativo e de que equipe; msg_send fala com um ' +
				'agente (to="nome"), com uma equipe (team="nome") ou com todos; msg_inbox le o que ' +
				'chegou. Quando alguem te manda recado voce recebe uma NOTIFICACAO automatica no comeco ' +
				'da proxima resposta de ferramenta — leia e responda.',
		);
		return L.join('\n');
	}
	if (t.caps.writeAny) {
		L.push(
			'Esta e a equipe nativa Integrador Revisor: voce pode alterar QUALQUER arquivo do ' +
				'projeto. Use isso apenas para verificar compatibilidade entre as mudancas das outras ' +
				'equipes e corrigir o que quebrou.',
		);
	} else if (t.caps.manageTeams) {
		L.push(
			'Esta e a equipe nativa Gerenciador: voce administra as equipes do usuario e pode alterar arquivos que nao pertencem a nenhuma equipe.',
		);
		L.push(
			'Suas ferramentas de administracao (so voce pode usar): team_create (criar equipe ja com ' +
				'os arquivos), team_add_files / team_remove_files (definir o que cada equipe altera), ' +
				'team_rename, team_set_desc, team_allow_leave (liberar a saida de uma equipe), ' +
				'team_delete e team_remove_agent (tirar um agente da equipe dele).',
		);
		L.push(
			'Toda equipe pertence a UM projeto: informe project="nome do projeto" no team_create e nas demais chamadas. A posse dos arquivos so vale dentro daquele projeto.',
		);
	} else {
		L.push(
			`Voce so pode ALTERAR os caminhos desta equipe: ${(t.files || []).length + (t.dirs || []).length ? tmTeamAlvos(t) : '(nenhum ainda — peca ao usuario para adicionar arquivos a sua equipe)'}.`,
		);
		L.push(
			'Voce PODE LER qualquer arquivo do projeto, inclusive de outras equipes. Ler: sempre. Alterar: so o que e seu.',
		);
		L.push(
			'Arquivo que nao pertence a nenhuma equipe tambem NAO pode ser alterado por voce — so pelo Gerenciador ou pelo Integrador Revisor. A unica excecao sao os ARQUIVOS GLOBAIS abaixo.',
		);
	}
	L.push('Pastas valem para tudo que esta dentro delas, inclusive arquivos criados depois.');
	L.push(
		`ARQUIVOS GLOBAIS (o Gerenciador define com team_global_add; veja com team_globals): ${tmGlobalsTxt(tmTeamProj(t))}. \
Esses caminhos nao tem dono e QUALQUER equipe registrada pode altera-los (README, changelog, docs). \
Avise as outras por msg_send quando mexer em um global.`,
	);
	if (tmTeamProj(t))
		L.push(
			`Esta equipe trabalha no projeto "${tmTeamProjNome(t)}": passe project="${tmTeamProjNome(t)}" nas chamadas de arquivo. Em outro projeto voce nao altera nada.`,
		);
	L.push(
		t.allowLeave
			? 'A saida desta equipe esta LIBERADA pelo usuario: voce pode usar team_leave.'
			: 'Voce NAO pode sair desta equipe por conta propria: entrou, ficou. So o usuario libera a saida.',
	);
	L.push(
		`Identifique-se com agent="${a.name}" em TODAS as chamadas. Sem esse nome o site nao reconhece sua equipe e recusa a alteracao.`,
	);
	L.push(
		'Ao TERMINAR um bloco de trabalho, chame review_submit com os arquivos que voce alterou ' +
			'(files=[...], note="o que mudou"): o Integrador Revisor confere se a sua mudanca ' +
			'continua compativel com a das outras equipes. Antes de mexer em algo, review_deps ' +
			'mostra quem depende daquele arquivo.',
	);
	L.push(
		'TRAVAS: LER junto pode, GRAVAR nao. Varios agentes leem o mesmo arquivo ao mesmo tempo sem esperar ninguem; o que nao pode e ALTERAR um arquivo que outro agente esta lendo ou reescrevendo agora.',
	);
	L.push(
		'Voce NAO precisa pedir trava para trabalhar: o site trava sozinho no seu nome quando a ' +
			'chamada entra e solta assim que a resposta sai. Leu, respondeu, liberou; editou, ' +
			'respondeu, liberou (ai o arquivo ja aceita leitura e novas edicoes na hora).',
	);
	L.push(
		'Se OUTRO agente gravar o arquivo depois da sua ultima leitura, a sua gravacao e ' +
			'recusada com aviso: leia de novo (read_file) e refaca em cima da versao nova. Assim ' +
			'nenhum trabalho some sem ninguem ver.',
	);
	L.push(
		`Por isso trava nao tem prazo de minutos no dia a dia: dura o tempo da chamada, mais ${TM.cfg.lockReadGraceSeconds || 0}s \
de sobra na leitura. Se uma chamada morrer no meio, a trava dela e varrida sozinha - nunca fique esperando \
10 min por nada.`,
	);
	L.push(
		'file_lock e so para o caso especial de segurar um arquivo ENTRE varias chamadas ' +
			'(refatoracao grande): mode="escrita" (exclusiva) ou mode="leitura" (outros leem junto, ' +
			'ninguem grava). Ai sim conta em minutos e voce solta com file_unlock.',
	);
	L.push(
		'O site recusa a chamada INTEIRA se algum alvo estiver na mao de outro agente - nada ' +
			'fica pela metade. Se isso acontecer, espere alguns segundos e repita: quase sempre era ' +
			'so a chamada do outro terminando.',
	);
	L.push('Veja quem esta com o que agora em file_locks.');
	L.push(
		'Consulte suas permissoes a qualquer momento com team_status (aceita path para saber de quem e um arquivo).',
	);
	L.push(
		'CONVERSA: voce nao trabalha sozinho. list_agents mostra quem esta ativo agora, de que ' +
			'equipe e o que cada um esta segurando; msg_send manda recado para UM agente (to="nome"),' +
			' para uma EQUIPE inteira (team="nome") ou para todos (sem to e sem team); msg_inbox le ' +
			'o que chegou para voce. Precisa de um arquivo de outra equipe? Peca por msg_send em vez ' +
			'de tentar gravar e levar recusa.',
	);
	L.push(
		`NOTIFICACAO: quando chega recado, a proxima resposta de QUALQUER ferramenta (inclusive uma que termine \
em erro) comeca com UMA linha [NOTIFICACAO] com quantas estao sem ler. Leia com ${ntRotulo('msg_inbox')} \
e responda com ${ntRotulo('msg_send')}. Use sempre o MESMO agent="seu-nome": e por ele que eu sei que \
a notificacao e sua.`,
	);
	return L.join('\n');
}
function tmAgentJoin(nome, teamRef, opts) {
	const o = opts || {};
	const n = tmAgNome(nome);
	if (!n)
		throw new Error(
			'Informe o parametro agent com o SEU nome (ex.: agent="agente-fisica") para entrar em uma equipe. Esse nome identifica voce em todas as chamadas.',
		);
	const t = tmTeamHumano(teamRef);
	tmAgentsSync();
	const A = tmAgents();
	let nUsar = n,
		apelido = '',
		k = tmAgKey(n);
	let a = A[k];
	if (a && a.teamId === t.id && !tmAgOutroAgente(a)) {
		a.lastSeen = tmNow();
		tmAgSave();
		return { agente: a, equipe: t, novo: false, mensagem: tmWelcome(t, a, true) };
	}
	let antes = a && a.teamId ? TM.teams[a.teamId] || null : null;
	if (a && antes && !o.forcarUsuario && tmAgDuplicado(nUsar)) {
		apelido = nUsar;
		nUsar = tmAgNomeLivre(nUsar);
		k = tmAgKey(nUsar);
		a = A[k] || null;
		antes = null;
		tmAudit('agent-nome-duplicado', { pedido: apelido, virou: nUsar });
	}
	if (antes && !antes.allowLeave && !o.forcarUsuario)
		throw new Error(
			`Voce ja esta na equipe "${antes.name}" e a saida nao esta liberada (entrou, ficou). Peca ao usuario \
para ativar "permitir agente sair dessa equipe" na equipe "${antes.name}" antes de trocar.`,
		);
	const vagasOcupadas = (t.agents || []).filter(function (x) {
		return tmAgKey(x) !== k;
	}).length;
	if (t.maxAgents && vagasOcupadas >= t.maxAgents)
		throw new Error(
			`A equipe "${t.name}" aceita no maximo ${t.maxAgents} agente(s) e ja esta ocupada por: ${(t.agents || []).join(', ')}.${t.native ? ' Essa e uma equipe nativa do site.' : ''} \
Peca ao usuario para liberar a vaga.`,
		);
	if (!a) {
		if (Object.keys(A).length >= TM_AGENT_MAX)
			throw new Error(
				`Limite de ${TM_AGENT_MAX} agentes registrados atingido. Peca ao usuario para remover agentes inativos no painel de Equipes.`,
			);
		a = {
			name: nUsar,
			teamId: '',
			joinedAt: 0,
			lastSeen: tmNow(),
			writes: 0,
			denied: 0,
			createdAt: tmNow(),
		};
		A[k] = a;
	}
	a.name = nUsar;
	a.teamId = t.id;
	a.joinedAt = tmNow();
	a.lastSeen = tmNow();
	tmAgentsSync();
	tmAgSave();
	tmAudit('agent-join', {
		agente: a.name,
		equipe: t.name,
		saiuDe: antes ? antes.name : '',
		porUsuario: !!o.forcarUsuario,
	});
	try {
		agRecord({
			agent: a.name,
			tool: 'team_join',
			project: '',
			hint: 'entrou na equipe ' + t.name,
			ok: 1,
		});
	} catch (e) {
		ignorarErro(e, 'tmAgentJoin');
	}
	const avisoNome = apelido
		? `ATENCAO - NOME TROCADO: ja existe outro agente ativo chamado "${apelido}". Como dois agentes nao \
podem ter o mesmo nome, VOCE agora e "${a.name}". Use agent="${a.name}" em TODAS as proximas chamadas.${String.fromCharCode(10)}${String.fromCharCode(10)}`
		: '';
	return {
		agente: a,
		equipe: t,
		novo: true,
		renomeado: apelido ? a.name : '',
		mensagem: avisoNome + tmWelcome(t, a, false),
	};
}
function tmEnlLog() {
	if (!Array.isArray(TM.enlistLog)) TM.enlistLog = [];
	return TM.enlistLog;
}
function tmEnlDiag(projId) {
	const cfg = tmEnlCfg();
	tmAgentsSync();
	const pid = String(projId || '');
	const dentro = [],
		fora = [];
	tmTeams().forEach(function (t) {
		const n = (t.agents || []).length;
		if (t.native && !cfg.nativas) {
			fora.push({ t: t, motivo: 'nativa' });
			return;
		}
		if (cfg.soProjeto && pid && tmTeamProj(t) && tmTeamProj(t) !== pid) {
			fora.push({ t: t, motivo: 'de outro projeto' });
			return;
		}
		if (t.maxAgents && n >= t.maxAgents) {
			fora.push({ t: t, motivo: `lotada (${n}/${t.maxAgents})` });
			return;
		}
		dentro.push(t);
	});
	dentro.sort(function (x, y) {
		const d = Number(x.createdAt || x.at || 0) - Number(y.createdAt || y.at || 0);
		return d || String(x.name || '').localeCompare(String(y.name || ''));
	});
	const temEscopo = function (t) {
		return t.caps && t.caps.writeAny ? true : (t.files || []).length + (t.dirs || []).length > 0;
	};
	const comEscopo = dentro.filter(temEscopo);
	const semEscopo = dentro.filter(function (t) {
		return !temEscopo(t);
	});
	const pool = comEscopo.length ? comEscopo : semEscopo;
	if (comEscopo.length)
		semEscopo.forEach(function (t) {
			fora.push({ t: t, motivo: 'sem arquivos ainda' });
		});
	return { pool: pool, fora: fora, dentro: dentro };
}
function tmEnlElegiveis(projId) {
	return tmEnlDiag(projId).pool;
}
function tmEnlEscolher(projId) {
	const cfg = tmEnlCfg();
	const d = tmEnlDiag(projId);
	const lista = d.pool;
	if (!lista.length) return null;
	const conta = function (t) {
		return (t.agents || []).length;
	};
	const abaixo = lista.filter(function (t) {
		return conta(t) < cfg.porEquipe;
	});
	const pool = abaixo.length ? abaixo : lista;
	let melhor = pool[0];
	pool.forEach(function (t) {
		if (conta(t) < conta(melhor)) melhor = t;
	});
	return { team: melhor, estourou: !abaixo.length, elegiveis: lista.length, diag: d };
}
function tmEnlNome(t) {
	const cfg = tmEnlCfg();
	const base = ((cfg.prefixo ? cfg.prefixo + '-' : '') + tmAgSlugTraco(t.name)).slice(
		0,
		TM_ENL_LIMITS.nome,
	);
	return tmAgNomeLivre(base || 'agente');
}
function tmEnlist(o) {
	const op = o || {};
	const cfg = tmEnlCfg();
	const NL = String.fromCharCode(10);
	if (!cfg.ativo)
		throw new Error(
			'O alistamento automatico esta DESLIGADO no painel de Equipes deste site. Peca ao usuario para ligar em Equipes > Alistamento automatico, ou entre direto com team_join team="nome da equipe".',
		);
	const pedido = tmAgNome(op.nome);
	tmAgentsSync();
	if (pedido) {
		const ja = tmAgent(pedido);
		if (ja && ja.teamId && TM.teams[ja.teamId]) {
			const tt = TM.teams[ja.teamId];
			ja.lastSeen = tmNow();
			tmAgSave();
			return {
				nome: ja.name,
				agente: ja,
				equipe: tt,
				jaEstava: true,
				estourou: false,
				mensagem: `Voce JA esta alistado na equipe "${tt.name}" com o nome "${ja.name}". Nada foi mudado - continue usando agent="${ja.name}".${NL}${NL}${tmWelcome(tt, ja, true)}`,
			};
		}
		if (ja && !ja.teamId) {
			try {
				tmAgentRemove(pedido);
			} catch (e) {
				delete tmAgents()[tmAgKey(pedido)];
			}
		}
	}
	const esc = tmEnlEscolher(op.proj || '');
	if (!esc) {
		const dg = tmEnlDiag(op.proj || '');
		const pq = dg.fora
			.slice(0, 6)
			.map(function (f) {
				return `- "${f.t.name}": ${f.motivo}`;
			})
			.join(NL);
		throw new Error(
			'Nao ha equipe disponivel para alistar' +
				(op.projNome ? ` no projeto "${op.projNome}"` : '') +
				'.' +
				(pq
					? NL + 'Equipes fora do sorteio agora:' + NL + pq
					: ' Nenhuma equipe foi criada ainda.') +
				NL +
				'Peca ao usuario para criar uma equipe COM arquivos (ou liberar uma vaga) no painel de Equipes e tente de novo.',
		);
	}
	const t = esc.team;
	const A = tmAgents();
	if (Object.keys(A).length >= TM_AGENT_MAX)
		throw new Error(
			`Limite de ${TM_AGENT_MAX} agentes registrados atingido. Peca ao usuario para remover agentes inativos no painel de Equipes.`,
		);
	const nome = tmEnlNome(t);
	const a = {
		name: nome,
		teamId: t.id,
		joinedAt: tmNow(),
		lastSeen: tmNow(),
		writes: 0,
		denied: 0,
		createdAt: tmNow(),
		enlisted: 1,
	};
	A[tmAgKey(nome)] = a;
	tmAgentsSync();
	tmAgSave();
	const reg = {
		at: tmNow(),
		nome: nome,
		equipe: t.name,
		pedido: pedido || '',
		estourou: !!esc.estourou,
		proj: op.projNome || '',
	};
	const L = tmEnlLog();
	L.push(reg);
	if (L.length > TM_ENL_LIMITS.log) L.splice(0, L.length - TM_ENL_LIMITS.log);
	tmAudit('agent-enlist', reg);
	try {
		agRecord({
			agent: nome,
			tool: 'team_enlist',
			project: op.projNome || '',
			hint: 'alistado na equipe ' + t.name,
			ok: 1,
		});
	} catch (e) {
		ignorarErro(e, 'tmEnlist');
	}
	const cab = [
		'ALISTADO: o site te colocou na equipe "' +
			t.name +
			'"' +
			(tmTeamProj(t) ? ` (projeto "${tmTeamProjNome(t)}")` : '') +
			'.',
		'SEU NOME AGORA E: ' +
			nome +
			' - use agent="' +
			nome +
			'" em TODAS as proximas chamadas' +
			(pedido && tmAgKey(pedido) !== tmAgKey(nome)
				? ` (voce tinha se apresentado como "${pedido}")`
				: '') +
			'.',
		`Distribuicao: o usuario pediu ${cfg.porEquipe} agente(s) por equipe e havia ${esc.elegiveis} equipe(s) \
no sorteio - ${esc.estourou ? 'todas ja tinham batido o alvo, entao voce foi para a mais vazia (passar do alvo aqui e o esperado, nao e erro).' : 'esta era a equipe com menos gente.'}`,
		'',
	].join(NL);
	return {
		nome: nome,
		agente: a,
		equipe: t,
		estourou: !!esc.estourou,
		jaEstava: false,
		mensagem: cab + tmWelcome(t, a, false),
	};
}
function tmEnlistSelfCheck() {
	const p = [];
	try {
		const c = tmEnlCfg();
		if (!(c.porEquipe >= TM_ENL_LIMITS.porEquipeMin && c.porEquipe <= TM_ENL_LIMITS.porEquipeMax))
			p.push('alistamento: alvo por equipe fora do limite');
		if (!c.prefixo) p.push('alistamento: prefixo de nome vazio');
		if (tmAgSlugTraco('Runtime de Jogo') !== 'runtime-de-jogo')
			p.push('alistamento: nome de equipe com espaco nao virou traco');
		const vistos = {};
		const A = tmAgents();
		Object.keys(A).forEach(function (k) {
			const nm = tmAgKey(A[k] && A[k].name);
			if (nm !== k)
				p.push(`registro de agente com chave torta: "${k}" guarda "${String(A[k] && A[k].name)}"`);
			if (vistos[nm]) p.push('dois agentes registrados com o mesmo nome: ' + nm);
			vistos[nm] = 1;
		});
		Object.keys(TM.teams || {}).forEach(function (id) {
			const t = TM.teams[id];
			if (t && t.maxAgents && (t.agents || []).length > t.maxAgents)
				p.push(`equipe "${t.name}" passou do proprio limite de agentes`);
		});
		if (!tmAgNomeLivre('agente')) p.push('alistamento: gerador de nome livre nao devolveu nada');
	} catch (e) {
		p.push('autodiagnostico do alistamento quebrou: ' + String((e && e.message) || e));
	}
	if (p.length) {
		try {
			tmAudit('selfcheck-fail', { parte: 'enlist', problemas: p.slice(0, 8) });
		} catch (e) {
			ignorarErro(e, 'tmEnlistSelfCheck');
		}
	}
	return p;
}

function tmAgentLeave(nome, opts) {
	const o = opts || {};
	const n = tmAgNome(nome);
	const a = tmAgent(n);
	if (!a) throw new Error(`O agente "${n}" nao esta registrado. Nada a fazer.`);
	const t = a.teamId ? TM.teams[a.teamId] || null : null;
	if (!t) {
		a.teamId = '';
		tmAgentsSync();
		return { equipe: null, mensagem: 'Voce nao estava em nenhuma equipe.' };
	}
	if (!t.allowLeave && !o.forcarUsuario)
		throw new Error(
			`A equipe "${t.name}" nao permite saida. Peca ao usuario para ativar "permitir agente sair dessa equipe" no painel de Equipes.`,
		);
	a.teamId = '';
	a.joinedAt = 0;
	a.lastSeen = tmNow();
	try {
		tmLockReleaseAgent(a.name, 'saiu da equipe');
	} catch (e) {
		ignorarErro(e, 'tmAgentLeave');
	}
	tmAgentsSync();
	tmAgSave();
	tmAudit('agent-leave', { agente: a.name, equipe: t.name, porUsuario: !!o.forcarUsuario });
	return {
		equipe: t,
		mensagem: `Voce saiu da equipe "${t.name}". Sem equipe voce nao pode alterar nenhum arquivo (ler continua liberado). Use team_join para entrar em outra.`,
	};
}
function tmAgentRemove(nome) {
	const k = tmAgKey(nome);
	const A = tmAgents();
	const a = k ? A[k] : null;
	if (!a) return { removido: false, agente: tmAgNome(nome) };
	const t = a.teamId ? TM.teams[a.teamId] || null : null;
	try {
		tmLockReleaseAgent(a.name, 'removido pelo usuario');
	} catch (e) {
		ignorarErro(e, 'tmAgentRemove');
	}
	delete A[k];
	try {
		if (typeof AG !== 'undefined' && AG.claims) {
			let soltou = 0;
			Object.keys(AG.claims).forEach(function (pid) {
				const c = AG.claims[pid];
				if (c && c.agent && tmAgKey(c.agent) === k) {
					delete AG.claims[pid];
					soltou++;
				}
			});
			if (soltou) {
				tmAudit('agent-reserva-solta', { agente: a.name, projetos: soltou });
				try {
					mcpRenderAgents();
				} catch (e) {
					ignorarErro(e, 'tmAgentRemove');
				}
			}
		}
	} catch (e) {
		ignorarErro(e, 'tmAgentRemove');
	}
	tmAgentsSync();
	tmAgSave();
	tmAudit('agent-remove', { agente: a.name, equipe: t ? t.name : '' });
	return { removido: true, agente: a.name, equipe: t ? t.name : '' };
}
