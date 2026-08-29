'use strict';
try {
	if (typeof MCP_TOOLS !== 'undefined' && Array.isArray(MCP_TOOLS)) {
		const jaTem = {};
		MCP_TOOLS.forEach(function (t) {
			jaTem[t.name] = 1;
		});
		TM_REVIEW_TOOLS.forEach(function (t) {
			if (!jaTem[t.name]) MCP_TOOLS.push(t);
		});
		if (typeof agEnsureProps === 'function') {
			__agProps = false;
			agEnsureProps();
		}
	}
} catch (e) {
	try {
		registro.erro('[Synapse Teams] Parte 5 nao conseguiu registrar as ferramentas:', e);
	} catch (_e) {
		ignorarErro(_e, 'catalogo');
	}
}

function tmMsgs() {
	if (!Array.isArray(TM.msgs)) TM.msgs = [];
	return TM.msgs;
}
function tmMsgSeq() {
	const n = Number(TM.msgSeq);
	return isFinite(n) && n > 0 ? Math.floor(n) : 1;
}
function tmMsgTexto(s) {
	return String(s == null ? '' : s)
		.trim()
		.slice(0, TM_MSG_LIMITS.texto);
}
function tmMsgPartir(txt, max) {
	const t = String(txt == null ? '' : txt).trim();
	if (t.length <= max) return t ? [t] : [];
	const out = [];
	let resto = t;
	while (resto.length > max) {
		let corte = resto.lastIndexOf(String.fromCharCode(10), max);
		if (corte < max * 0.5) corte = resto.lastIndexOf(' ', max);
		if (corte < max * 0.5) corte = max;
		out.push(resto.slice(0, corte).trim());
		resto = resto.slice(corte).trim();
	}
	if (resto) out.push(resto);
	return out;
}

function tmMsgDestino(o) {
	const to = tmAgNome(o && o.to);
	const teamRef = String((o && o.team) == null ? '' : o && o.team).trim();
	if (to && teamRef)
		throw new Error(
			'Escolha UM destino: to="agente" OU team="equipe". Com os dois eu nao sei para quem entregar.',
		);
	if (to) {
		const a = tmAgent(to);
		return { tipo: 'agente', para: a ? a.name : to, paraKey: tmAgKey(to), conhecido: !!a };
	}
	if (teamRef) {
		const t = tmTeam(teamRef);
		if (!t) throw new Error(`Nao existe equipe "${teamRef}". Veja as equipes com team_list.`);
		return { tipo: 'equipe', para: t.name, paraKey: t.id };
	}
	return { tipo: 'todos', para: '', paraKey: '' };
}

function tmMsgAlvos(m) {
	if (!m) return [];
	if (m.tipo === 'agente') return m.para ? [m.para] : [];
	const outros = tmAgentList().filter(function (a) {
		return tmAgKey(a.name) !== m.deKey;
	});
	if (m.tipo === 'equipe')
		return outros
			.filter(function (a) {
				return String(a.teamId || '') === m.paraKey;
			})
			.map(function (a) {
				return a.name;
			});
	return outros.map(function (a) {
		return a.name;
	});
}
function tmMsgPraMim(m, key, teamId) {
	if (!m) return false;
	if (!key) return m.tipo === 'todos';
	if (m.deKey === key) return true;
	if (m.tipo === 'agente') return m.paraKey === key;
	if (m.tipo === 'equipe') return !!teamId && m.paraKey === String(teamId);
	return true;
}
function tmMsgLida(m, key) {
	return !!(m && m.lido && m.lido[key]);
}

function tmMsgPoda() {
	const L = tmMsgs();
	const max = TM_MSG_LIMITS.historico;
	if (L.length <= max) return 0;
	let excesso = L.length - max,
		cortadas = 0,
		i = 0;
	while (excesso > 0 && i < L.length - 1) {
		const m = L[i];
		const todosLeram = tmMsgAlvos(m).every(function (n) {
			return tmMsgLida(m, tmAgKey(n));
		});
		if (todosLeram) {
			L.splice(i, 1);
			excesso--;
			cortadas++;
		} else i++;
	}
	if (excesso > 0) {
		const perdidas = L.splice(0, excesso);
		cortadas += perdidas.length;
		tmAudit('msg-perdida', {
			quantas: perdidas.length,
			aviso: 'mensagens NAO lidas descartadas por limite de historico',
		});
	}
	return cortadas;
}

function tmMsgsSane() {
	const L = tmMsgs();
	const out = [];
	const usados = {};
	const probl = [];
	let maior = 0;
	L.forEach(function (m) {
		if (!m || typeof m !== 'object') return;
		const de = tmAgNome(m.de);
		const texto = tmMsgTexto(m.texto);
		if (!de || !texto) return;
		const tipo = m.tipo === 'agente' || m.tipo === 'equipe' ? m.tipo : 'todos';
		m.de = de;
		m.deKey = tmAgKey(de);
		m.texto = texto;
		m.tipo = tipo;
		m.at = Number(m.at) || tmNow();
		m.para = String(m.para == null ? '' : m.para).slice(0, 60);
		m.paraKey = String(m.paraKey == null ? '' : m.paraKey);
		m.proj = String(m.proj == null ? '' : m.proj).slice(0, 60);
		m.equipeDe = String(m.equipeDe == null ? '' : m.equipeDe).slice(0, 60);
		if (!m.lido || typeof m.lido !== 'object' || Array.isArray(m.lido)) m.lido = {};
		if (tipo !== 'todos' && !m.paraKey) {
			probl.push('mensagem endereçada sem destino descartada');
			return;
		}
		if (!m.para)
			m.para =
				tipo === 'equipe'
					? (TM.teams[m.paraKey] && TM.teams[m.paraKey].name) || m.paraKey
					: m.paraKey;
		let id = Math.floor(Number(m.id) || 0);
		if (!(id > 0) || usados[id]) id = 0;
		m.id = id;
		if (id) usados[id] = 1;
		out.push(m);
	});
	out.sort(function (x, y) {
		return (x.at || 0) - (y.at || 0) || (x.id || 0) - (y.id || 0);
	});
	let ant = 0;
	out.forEach(function (m) {
		if (!m.id || m.id <= ant) {
			const velho = m.id;
			m.id = ant + 1;
			probl.push(
				velho
					? `id #${velho} estava fora de ordem e virou #${m.id}`
					: 'mensagem sem id recebeu #' + m.id,
			);
		}
		ant = m.id;
		if (m.id > maior) maior = m.id;
	});
	TM.msgs = out;
	TM.msgSeq = Math.max(tmMsgSeq(), maior + 1);
	tmMsgPoda();
	if (probl.length) tmAudit('msgs-sane', { problemas: probl.slice(0, 20), total: probl.length });
	return probl;
}

function tmMsgSend(o) {
	o = o || {};
	const de = tmAgNome(o.from);
	if (!de)
		throw new Error(
			'Informe agent="seu-nome" para mandar mensagem: recado sem remetente ninguem sabe responder.',
		);
	const bruto = String(o.text == null ? '' : o.text).trim();
	if (!bruto) throw new Error('Mensagem vazia. Escreva o que voce quer dizer.');
	const max = TM_MSG_LIMITS.texto,
		teto = max * TM_MSG_LIMITS.partes;
	if (bruto.length > teto)
		throw new Error(
			`Recado grande demais: ${bruto.length} caracteres, e o teto sao ${teto} (${TM_MSG_LIMITS.partes} \
partes de ${max}). NADA foi enviado. Resuma o recado, ou grave o detalhe em um arquivo do projeto e \
mande so o caminho dele.`,
		);
	const d = tmMsgDestino(o);
	const eq = tmAgentTeam(de);
	const partes = tmMsgPartir(bruto, max),
		N = partes.length;
	const ids = [];
	let primeira = null;
	partes.forEach(function (txt, i) {
		const id = tmMsgSeq();
		TM.msgSeq = id + 1;
		const m = {
			id: id,
			at: tmNow(),
			de: de,
			deKey: tmAgKey(de),
			equipeDe: eq ? eq.name : '',
			tipo: d.tipo,
			para: d.para,
			paraKey: d.paraKey,
			proj: String(o.projName || ''),
			texto: (N > 1 ? `(parte ${i}${1}/${N}) ` : '') + txt,
			lido: {},
		};
		m.lido[m.deKey] = m.at;
		tmMsgs().push(m);
		ids.push(id);
		if (!primeira) primeira = m;
	});
	tmMsgPoda();
	const a = tmAgent(de);
	if (a) {
		a.lastSeen = tmNow();
	}
	tmAudit('msg', { de: de, tipo: d.tipo, para: d.para || 'todos', chars: bruto.length, partes: N });
	try {
		if (typeof mcpRenderAgents === 'function') mcpRenderAgents();
	} catch (e) {
		ignorarErro(e, 'tmMsgSend');
	}
	tmAgSave();
	primeira.partes = N;
	primeira.idsPartes = ids;
	primeira.chars = bruto.length;
	return primeira;
}

function tmMsgInbox(nome, o) {
	o = o || {};
	const n = tmAgNome(nome);
	if (!n)
		throw new Error('Informe agent="seu-nome" para ler suas mensagens: a caixa e por agente.');
	const key = tmAgKey(n);
	const a = tmAgent(n);
	const teamId = a ? String(a.teamId || '') : '';
	const depois = Math.floor(Number(o.afterId) || 0);
	let L = tmMsgs().filter(function (m) {
		return tmMsgPraMim(m, key, teamId) && m.id > depois;
	});
	if (o.apenasNaoLidas)
		L = L.filter(function (m) {
			return !tmMsgLida(m, key);
		});
	const total = L.length;
	const lim = Math.max(1, Math.min(TM_MSG_LIMITS.inbox, Math.floor(Number(o.limit) || 20)));
	L = L.slice(-lim);
	const naoLidas = L.filter(function (m) {
		return !tmMsgLida(m, key);
	}).length;
	if (o.marcar !== false) {
		const t = tmNow();
		L.forEach(function (m) {
			if (!tmMsgLida(m, key)) m.lido[key] = t;
		});
	}
	if (a) a.lastSeen = tmNow();
	tmAgSave();
	try {
		if (typeof mcpRenderAgents === 'function') mcpRenderAgents();
	} catch (e) {
		ignorarErro(e, 'tmMsgInbox');
	}
	return {
		agente: n,
		mensagens: L,
		total: total,
		naoLidas: naoLidas,
		ultimoId: L.length ? L[L.length - 1].id : depois,
	};
}

function tmMsgNaoLidas(nome) {
	const key = tmAgKey(nome);
	if (!key) return 0;
	const a = tmAgent(nome);
	const teamId = a ? String(a.teamId || '') : '';
	return tmMsgs().filter(function (m) {
		return tmMsgPraMim(m, key, teamId) && !tmMsgLida(m, key);
	}).length;
}

const NT = {
	ultimo: '',
	vistos: {},
	JANELA: 15 * 60000,
	MOSTRA: 5,
	TRECHO: 200,
	MAXVISTOS: 200,
	VARRE: 120,
};
function ntLembra(nome) {
	const n = tmAgNome(nome);
	if (!n) return '';
	NT.ultimo = n;
	NT.vistos[tmAgKey(n)] = { nome: n, t: tmNow() };
	const ks = Object.keys(NT.vistos);
	if (ks.length > NT.MAXVISTOS) {
		ks.sort(function (a, b) {
			return (NT.vistos[a].t || 0) - (NT.vistos[b].t || 0);
		});
		ks.slice(0, ks.length - NT.MAXVISTOS).forEach(function (k) {
			delete NT.vistos[k];
		});
	}
	return n;
}
function ntRecentes() {
	const t = tmNow();
	const out = [];
	Object.keys(NT.vistos).forEach(function (k) {
		const v = NT.vistos[k];
		if (v && t - (v.t || 0) <= NT.JANELA) out.push(v.nome);
	});
	return out;
}
function ntQuemSou(args) {
	const dito = ntLembra(agName(args));
	if (dito) return dito;
	const rec = ntRecentes();
	if (rec.length === 1) return rec[0];
	if (!rec.length && NT.ultimo) return NT.ultimo;
	return '';
}
function ntSubFerramenta(tool, name, args) {
	try {
		const g = tool && tool.__group;
		const act = String((args && args.action) || '').trim();
		if (g && g.members && act && Object.prototype.hasOwnProperty.call(g.members, act))
			return g.members[act];
		if (tool && tool.run && tool.run.orig && tool.run.orig.name) return tool.run.orig.name;
	} catch (e) {
		ignorarErro(e, 'ntSubFerramenta');
	}
	return String(name == null ? '' : name);
}
function ntRotulo(sub) {
	try {
		if (typeof MCP_TOOLS === 'undefined' || !Array.isArray(MCP_TOOLS)) return sub;
		for (let i = 0; i < MCP_TOOLS.length; i++) {
			const t = MCP_TOOLS[i];
			if (t && t.name === sub) return sub;
		}
		for (let i = 0; i < MCP_TOOLS.length; i++) {
			const t = MCP_TOOLS[i],
				g = t && t.__group;
			if (!g || !g.members) continue;
			for (const act in g.members) {
				if (Object.prototype.hasOwnProperty.call(g.members, act) && g.members[act] === sub)
					return t.name + ' action="' + act + '"';
			}
		}
	} catch (e) {
		ignorarErro(e, 'ntRotulo');
	}
	return sub;
}
const NT_CAIXA = ['msg_inbox', 'read_messages'];
function tmNotifPend(nome) {
	const key = tmAgKey(nome);
	if (!key) return [];
	const a = tmAgent(nome);
	const teamId = a ? String(a.teamId || '') : '';
	return tmMsgs().filter(function (m) {
		return tmMsgPraMim(m, key, teamId) && !tmMsgLida(m, key) && m.deKey !== key;
	});
}
function ntEscopo(m) {
	if (!m) return '';
	if (m.tipo === 'agente') return 'direto para voce';
	if (m.tipo === 'equipe') return `para a sua equipe "${m.para}"`;
	return 'para todos (quadro geral)';
}
function ntContagem(L) {
	const c = { agente: 0, equipe: 0, todos: 0 };
	L.forEach(function (m) {
		const k = m && (m.tipo === 'agente' || m.tipo === 'equipe') ? m.tipo : 'todos';
		c[k]++;
	});
	const p = [];
	if (c.agente) p.push(c.agente + ' direta(s) para voce');
	if (c.equipe) p.push(c.equipe + ' para a sua equipe');
	if (c.todos) p.push(c.todos + ' no quadro geral');
	return p.join(', ');
}
function tmNotifBanner(nome) {
	let L = [];
	try {
		L = tmNotifPend(nome);
	} catch (e) {
		return '';
	}
	if (!L.length) return '';
	return `[NOTIFICACAO] Voce tem ${L.length} mensagem(ns) nao lida(s), use ${ntRotulo('msg_inbox')} para ler.`;
}
function ntBannerGeral() {
	let L = [];
	try {
		L = tmMsgs().slice(-NT.VARRE);
	} catch (e) {
		return '';
	}
	let pend = 0;
	const destinos = {};
	L.forEach(function (m) {
		let alvos = [];
		try {
			alvos = tmMsgAlvos(m) || [];
		} catch (e) {
			alvos = [];
		}
		const falta = alvos.filter(function (n) {
			const k = tmAgKey(n);
			return k && k !== m.deKey && !tmMsgLida(m, k);
		});
		if (falta.length) {
			pend++;
			falta.forEach(function (n) {
				destinos[tmAgKey(n)] = tmAgNome(n);
			});
		}
	});
	if (!pend) return '';
	return `[NOTIFICACAO] Existe(m) ${pend} mensagem(ns) nao lida(s) no quadro para ${Object.keys(destinos).length} \
agente(s). Repita com agent="seu-nome" e use ${ntRotulo('msg_inbox')} para ler as suas.`;
}
function ntTag(nome, sub) {
	try {
		if (sub && NT_CAIXA.includes(String(sub))) return '';
		const b = nome ? tmNotifBanner(nome) : ntBannerGeral();
		return b ? b + '\n\n' : '';
	} catch (e) {
		return '';
	}
}
function tmNotifAlvos(m) {
	let base = [];
	try {
		base = (tmMsgAlvos(m) || []).slice();
	} catch (e) {
		base = [];
	}
	if (m && m.tipo === 'todos') {
		const vistos = {};
		base.forEach(function (n) {
			vistos[tmAgKey(n)] = 1;
		});
		ntRecentes().forEach(function (n) {
			const k = tmAgKey(n);
			if (k && k !== m.deKey && !vistos[k]) {
				vistos[k] = 1;
				base.push(n);
			}
		});
	}
	return base;
}
function tmNotifTag(nome, sub) {
	return ntTag(nome, sub);
}
function tmMsgLinha(m, key) {
	const alvo = m.tipo === 'todos' ? 'todos' : m.tipo === 'equipe' ? 'equipe ' + m.para : m.para;
	const novo = key && !tmMsgLida(m, key) ? 'NOVA ' : '';
	return (
		novo +
		'#' +
		m.id +
		' [' +
		relTime(m.at) +
		'] ' +
		m.de +
		(m.equipeDe ? ` (${m.equipeDe})` : '') +
		' -> ' +
		alvo +
		(m.proj ? ' · ' + m.proj : '') +
		': ' +
		m.texto
	);
}

function tmAgentsAtivos(o) {
	o = o || {};
	tmAgentsSync();
	const min = Math.max(1, Math.min(1440, Math.floor(Number(o.minutos) || TM_MSG_LIMITS.ativoMin)));
	const corte = tmNow() - min * 60000;
	let filtro = null;
	if (o.team) {
		filtro = tmTeam(o.team);
		if (!filtro) throw new Error(`Nao existe equipe "${String(o.team)}". Veja com team_list.`);
	}
	const porAgente = {};
	try {
		tmLocksGC();
		const K = tmLocks();
		Object.keys(K).forEach(function (k) {
			const l = K[k];
			if (!l) return;
			const kk = tmAgKey(l.agent);
			(porAgente[kk] = porAgente[kk] || []).push(l.path);
		});
	} catch (e) {
		ignorarErro(e, 'tmAgentsAtivos');
	}
	const L = tmAgentList()
		.map(function (a) {
			const t = a.teamId ? TM.teams[a.teamId] || null : null;
			return {
				nome: a.name,
				equipe: t ? t.name : '',
				equipeId: t ? t.id : '',
				nativa: t ? t.native || '' : '',
				ativo: (a.lastSeen || 0) >= corte,
				lastSeen: a.lastSeen || 0,
				escritas: a.writes || 0,
				negadas: a.denied || 0,
				travas: porAgente[tmAgKey(a.name)] || [],
				naoLidas: tmMsgNaoLidas(a.name),
			};
		})
		.filter(function (x) {
			return !filtro || x.equipeId === filtro.id;
		});
	L.sort(function (x, y) {
		return (y.lastSeen || 0) - (x.lastSeen || 0);
	});
	return L.slice(0, TM_MSG_LIMITS.agentes);
}

function tmAgentsTexto(lista, minutos) {
	if (!lista.length)
		return 'Nenhum agente registrado ainda. Um agente aparece aqui depois de entrar em uma equipe com team_join.';
	const ativos = lista.filter(function (x) {
		return x.ativo;
	}).length;
	const L = [`AGENTES (${lista.length} registrados, ${ativos} ativos nos ultimos ${minutos} min):`];
	lista.forEach(function (x) {
		const eq = x.equipe
			? `equipe "${x.equipe}"${x.nativa ? ' [nativa]' : ''}`
			: 'SEM EQUIPE (nao altera nada)';
		L.push(
			(x.ativo ? '* ' : '  ') +
				x.nome +
				'  ' +
				eq +
				'   visto ' +
				(x.lastSeen ? relTime(x.lastSeen) : 'nunca') +
				(x.travas.length
					? `   segurando ${x.travas.length} arquivo(s): ${x.travas.slice(0, 4).join(', ')}${x.travas.length > 4 ? '...' : ''}`
					: '') +
				(x.naoLidas ? `   ${x.naoLidas} mensagem(ns) nao lida(s)` : ''),
		);
	});
	L.push('');
	L.push(
		'* = ativo agora. Fale com um deles com msg_send to="nome", ou com a equipe toda usando team="nome da equipe".',
	);
	return L.join('\n');
}

function tmMsgsSelfCheck() {
	const p = [];
	try {
		const vistos = {};
		tmMsgs().forEach(function (m) {
			if (!m || !m.id) p.push('mensagem sem id no quadro');
			else if (vistos[m.id]) p.push('duas mensagens com o id #' + m.id);
			else vistos[m.id] = 1;
			if (m && m.tipo !== 'todos' && !m.paraKey)
				p.push(`mensagem endereçada sem destino no quadro (#${m && m.id})`);
		});
		let maior = 0,
			fora = 0,
			ant = 0;
		tmMsgs().forEach(function (m) {
			const id = (m && m.id) | 0;
			if (id > maior) maior = id;
			if (id <= ant) fora++;
			ant = id || ant;
		});
		if (maior && tmMsgSeq() <= maior)
			p.push(`TM.msgSeq atras da mensagem mais nova (#${maior}) - o proximo id se repetiria`);
		if (fora)
			p.push(
				fora + ' mensagem(ns) com id fora de ordem no tempo - after_id esconderia recado novo',
			);
		if (tmMsgs().length > TM_MSG_LIMITS.historico)
			p.push('quadro de mensagens acima do teto de ' + TM_MSG_LIMITS.historico);
	} catch (e) {
		p.push('excecao no selfcheck das mensagens: ' + ((e && e.message) || e));
	}
	return p;
}

const TM_MSG_TOOLS = [
	{
		name: 'msg_send',
		title: 'Falar com outro agente',
		desc:
			'Manda um recado para UM agente (to="nome"), para uma EQUIPE inteira (team="nome da ' +
			'equipe") ou para todos (sem to e sem team). Use para pedir mudanca em arquivo de outra ' +
			'equipe, avisar que terminou, pedir para soltarem uma trava ou combinar quem faz o que. ' +
			'Falar nao altera arquivo nenhum: e sempre permitido.',
		schema: {
			type: 'object',
			properties: {
				text: {
					type: 'string',
					description:
						'O recado (ate 4000 caracteres por mensagem; acima disso ele e entregue inteiro, em ate 8 partes numeradas). Seja concreto: arquivo, o que mudou, o que voce precisa',
				},
				to: { type: 'string', description: 'Nome do agente destinatario (opcional)' },
				team: { type: 'string', description: 'Nome ou id da equipe destinataria (opcional)' },
				agent: MCP_AGENT_PROP,
				project: MCP_PROJECT_PROP,
			},
			required: ['text'],
		},
		run: async (a) => {
			const de = agName(a);
			const p = agProjQuiet(a);
			const m = tmMsgSend({
				from: de,
				to: a && a.to,
				team: a && a.team,
				text: a && a.text,
				projName: p ? p.name : '',
			});
			const alvos = typeof tmNotifAlvos === 'function' ? tmNotifAlvos(m) : tmMsgAlvos(m);
			const corte =
				m.partes > 1
					? ` Seu recado tinha ${m.chars} caracteres: foi entregue INTEIRO, em ${m.partes} partes numeradas (#${m.idsPartes.join(', #')}). Nada foi cortado e elas chegam na ordem.`
					: '';
			try {
				agRecord({
					agent: m.de,
					tool: 'msg_send',
					project: m.proj,
					hint: (m.tipo === 'todos' ? 'para todos: ' : `para ${m.para}: `) + m.texto.slice(0, 60),
					ok: 1,
				});
			} catch (e) {
				ignorarErro(e, 'run');
			}
			if (m.tipo === 'agente') {
				if (tmAgKey(m.para) === m.deKey)
					return `Mensagem #${m.id} guardada na SUA propria caixa: voce mandou para voce mesmo. Serve como \
anotacao, mas nenhum outro agente vai ler. Veja com quem falar em list_agents.${corte}`;
				if (!tmAgent(m.para))
					return `Mensagem #${m.id} guardada na caixa de "${m.para}", mas ATENCAO: nenhum agente com esse \
nome esta registrado ainda (ninguem entrou em equipe com ele). Confira o nome em list_agents - se estiver \
certo, a NOTIFICACAO chega no topo da primeira resposta de ferramenta em que ele usar esse nome.${corte}`;
				return `Mensagem #${m.id} entregue na caixa de "${m.para}". Ele recebe uma linha [NOTIFICACAO] no \
comeco da proxima resposta de ferramenta e le o texto completo com ${ntRotulo('msg_inbox')}.${corte}`;
			}
			if (m.tipo === 'equipe')
				return (
					'Mensagem #' +
					m.id +
					' entregue para a equipe "' +
					m.para +
					'"' +
					(alvos.length
						? ` (${alvos.length} agente(s) notificado(s): ${alvos.join(', ')})`
						: ' (nenhum agente nessa equipe agora - o recado fica guardado e notifica quem entrar)') +
					'.' +
					corte
				);
			return (
				'Mensagem #' +
				m.id +
				' publicada no quadro geral' +
				(alvos.length
					? ` (${alvos.length} agente(s) serao notificados na proxima chamada de cada um: ${alvos.join(', ')})`
					: ' (nenhum outro agente apareceu nesta sessao ainda - quem aparecer depois tambem recebe a notificacao)') +
				'.' +
				corte
			);
		},
	},

	{
		name: 'msg_inbox',
		title: 'Ler suas mensagens',
		desc:
			'Le a SUA caixa: recados endereçados a voce, a sua equipe e ao quadro geral, do mais ' +
			'antigo para o mais novo. O que voce le fica marcado como lido. Consulte ao comecar a ' +
			'trabalhar e sempre que terminar uma etapa - e por aqui que outra equipe avisa que mexeu ' +
			'em algo que voce usa.',
		schema: {
			type: 'object',
			properties: {
				unread_only: { type: 'boolean', description: 'Somente as nao lidas (padrao: false)' },
				after_id: { type: 'integer', description: 'So mensagens com id maior que este' },
				limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Quantidade (padrao 20)' },
				mark_read: {
					type: 'boolean',
					description: 'Marcar como lidas o que veio agora (padrao: true)',
				},
				agent: MCP_AGENT_PROP,
				project: MCP_PROJECT_PROP,
			},
			required: [],
		},
		run: async (a) => {
			const r = tmMsgInbox(agName(a), {
				apenasNaoLidas: !!(a && a.unread_only),
				afterId: a && a.after_id,
				limit: a && a.limit,
				marcar: !(a && a.mark_read === false),
			});
			const key = tmAgKey(r.agente);
			if (!r.mensagens.length)
				return `Nenhuma mensagem${a && a.unread_only ? ' nao lida' : ''} para "${r.agente}". Quem quiser falar com voce usa msg_send to="${r.agente}".`;
			const L = [
				'CAIXA DE "' +
					r.agente +
					'" - ' +
					r.mensagens.length +
					' de ' +
					r.total +
					' mensagem(ns)' +
					(r.naoLidas ? `, ${r.naoLidas} nova(s)` : '') +
					':',
			];
			r.mensagens.forEach(function (m) {
				L.push('  ' + tmMsgLinha(m, key));
			});
			L.push('');
			if (r.total > r.mensagens.length)
				L.push(
					`Ficaram ${r.total - r.mensagens.length} mensagem(ns) mais antigas fora desta janela. Veja o que \
falta com unread_only=true - NAO use after_id agora, voce pularia recado nao lido.`,
				);
			else L.push(`Para ver so o que chegar depois, use after_id=${r.ultimoId}.`);
			L.push('Responda com msg_send to="nome-de-quem-mandou".');
			return L.join('\n');
		},
	},

	{
		name: 'list_agents',
		title: 'Quem esta trabalhando agora',
		desc:
			'Lista os agentes registrados: nome, equipe, se estao ativos agora, quais arquivos cada ' +
			'um esta segurando travados e quantas mensagens tem sem ler. Consulte ANTES de mexer em ' +
			'algo que nao e seu ou quando um arquivo estiver travado - assim voce sabe com quem ' +
			'falar.',
		schema: {
			type: 'object',
			properties: {
				team: { type: 'string', description: 'Filtrar por equipe (opcional)' },
				minutes: {
					type: 'integer',
					minimum: 1,
					maximum: 1440,
					description: 'Janela para considerar um agente ativo (padrao 30 min)',
				},
				agent: MCP_AGENT_PROP,
				project: MCP_PROJECT_PROP,
			},
			required: [],
		},
		run: async (a) => {
			const min = Math.max(
				1,
				Math.min(1440, Math.floor(Number(a && a.minutes) || TM_MSG_LIMITS.ativoMin)),
			);
			const lista = tmAgentsAtivos({ team: a && a.team, minutos: min });
			const eu = agName(a);
			if (eu) {
				const meu = tmAgent(eu);
				if (meu) meu.lastSeen = tmNow();
			}
			let txt = tmAgentsTexto(lista, min);
			if (eu) {
				const n = tmMsgNaoLidas(eu);
				if (n) txt += `\nVoce tem ${n} mensagem(ns) sem ler: ${ntRotulo('msg_inbox')}.`;
			}
			return txt;
		},
	},
];

try {
	if (typeof MCP_TOOLS !== 'undefined' && Array.isArray(MCP_TOOLS)) {
		const jaTem = {};
		MCP_TOOLS.forEach(function (t) {
			jaTem[t.name] = 1;
		});
		TM_MSG_TOOLS.forEach(function (t) {
			if (!jaTem[t.name]) MCP_TOOLS.push(t);
		});
		if (typeof agEnsureProps === 'function') {
			__agProps = false;
			agEnsureProps();
		}
	}
} catch (e) {
	try {
		registro.erro('[Synapse Teams] Parte 6 nao conseguiu registrar as ferramentas:', e);
	} catch (_e) {
		ignorarErro(_e, 'catalogo');
	}
}

function wireMcp() {
	const btn = $('#mcpBtn'),
		menu = $('#mcpMenu');
	if (!btn || !menu) return;
	btn.innerHTML = iconSvg('mcp') + '<span class="mcp-ind" id="mcpInd"></span>';
	mcpLoadCfg();
	const relayIn = $('#mcpRelay');
	if (relayIn) relayIn.value = MCP.relay;
	btn.addEventListener('click', (e) => {
		e.stopPropagation();
		menu.classList.toggle('open');
	});
	document.addEventListener('click', () => menu.classList.remove('open'));
	menu.addEventListener('click', (e) => e.stopPropagation());
	if (relayIn)
		relayIn.addEventListener('input', (e) => {
			MCP.relay = e.target.value.trim();
			mcpSaveCfg();
		});
	const pubIn = $('#mcpPub');
	if (pubIn) {
		pubIn.value = MCP.pub || '';
		pubIn.addEventListener('input', (e) => {
			MCP.pub = e.target.value.trim();
			mcpSaveCfg();
			mcpRenderPanel();
		});
	}
	const tg = $('#mcpToggle');
	if (tg)
		tg.addEventListener('click', () => {
			if (MCP.active) mcpDeactivate();
			else mcpActivate();
		});
	const rot = $('#mcpRotate');
	if (rot)
		rot.addEventListener('click', async () => {
			if (
				MCP.active &&
				!(await uiConfirm(
					'Gerar nova URL',
					'A URL única atual deixa de funcionar (a mudança vale para o portão e para todos os nós, que compartilham a mesma sessão) e você precisará colar a nova URL no conector do Notion. Continuar?',
					'Gerar nova URL',
				))
			)
				return;
			mcpNewSession();
			if (MCP.active) mcpConnect();
			try {
				if (window.SYNAPSE_FAILOVER && SYNAPSE_FAILOVER.novaSessao) SYNAPSE_FAILOVER.novaSessao();
			} catch (e) {
				ignorarErro(e, 'wireMcp');
			}
			mcpRenderPanel();
			toast('Nova URL gerada', 'Atualize o conector MCP no Notion — a URL única mudou', 'ok');
		});
	const cp = $('#mcpCopy');
	if (cp)
		cp.addEventListener('click', async () => {
			const url = mcpPublicUrl();
			const ok = () => {
				const o = cp.textContent;
				cp.textContent = 'Copiado!';
				setTimeout(() => {
					cp.textContent = o;
				}, 1400);
			};
			try {
				if (navigator.clipboard && window.isSecureContext) {
					await navigator.clipboard.writeText(url);
					ok();
					return;
				}
				throw new Error('sem clipboard api');
			} catch (e) {
				try {
					const inp = document.getElementById('mcpUrlOut');
					if (inp) {
						inp.removeAttribute('readonly');
						inp.focus();
						inp.select();
						inp.setSelectionRange(0, 99999);
						const done = document.execCommand('copy');
						inp.setAttribute('readonly', '');
						if (done) {
							ok();
							return;
						}
					}
				} catch (e2) {
					ignorarErro(e2, 'wireMcp');
				}
				toast('Copie manualmente', 'Toque e segure no campo da URL para copiar', 'warn');
			}
		});
	const uo = $('#mcpUrlOut');
	if (uo)
		uo.addEventListener('focus', () => {
			try {
				uo.select();
			} catch (e) {
				ignorarErro(e, 'wireMcp');
			}
		});
	const dl = $('#mcpDlRelay');
	if (dl) dl.addEventListener('click', mcpDownloadRelay);
	mcpRenderPanel();
	let auto = false;
	try {
		auto = localStorage.getItem('aurora.mcp.active') === '1';
	} catch (e) {
		ignorarErro(e, 'wireMcp');
	}
	if (auto && /^https?:\/\//i.test(mcpBase())) mcpActivate(true);
}

function wire() {
	hydrateIcons(document);
	window.addEventListener('error', (ev) => {
		try {
			const p = activeProject();
			const m =
				'Erro de JS: ' +
				(ev.message || '') +
				(ev.filename ? ` @ ${ev.filename.split('/').pop()}:${ev.lineno}` : '');
			if (p) logErr(p, m);
			registro.aviso('[Synapse]', m);
		} catch (e) {
			ignorarErro(e, 'wire');
		}
	});
	window.addEventListener('unhandledrejection', (ev) => {
		try {
			const r = ev.reason;
			const m = 'Promessa rejeitada (não tratada): ' + ((r && r.message) || r);
			const p = activeProject();
			if (p) logErr(p, m);
			else {
				try {
					toast('Erro', m, 'err');
				} catch (_) {
					ignorarErro(_, 'wire');
				}
			}
			hidePreviewLoading();
			if (el.stState && /Importando|Compilando|Extraindo|Lendo/.test(el.stState.textContent || ''))
				setStatus('err', 'Falha');
			registro.aviso('[Synapse]', m);
		} catch (e) {
			ignorarErro(e, 'wire');
		}
	});
	const menu = $('#importMenu');
	$('#importBtn').addEventListener('click', (e) => {
		e.stopPropagation();
		menu.classList.toggle('open');
	});
	const xb = $('#exportBtn');
	if (xb) xb.addEventListener('click', () => exportZipDialog());
	document.addEventListener('click', () => menu.classList.remove('open'));
	menu.addEventListener('click', (e) => {
		const it = e.target.closest('[data-imp]');
		if (!it) return;
		const k = it.dataset.imp;
		menu.classList.remove('open');
		if (k === 'zip') $('#fileZip').click();
		else if (k === 'assets') $('#fileAssets').click();
		else if (k === 'folder') $('#fileFolder').click();
		else if (k === 'html') $('#fileHtml').click();
		else if (k === 'sample') loadSample();
	});
	$('#previewEmpty').addEventListener('click', (e) => {
		const it = e.target.closest('[data-imp]');
		if (!it) return;
		const k = it.dataset.imp;
		if (k === 'zip') $('#fileZip').click();
		else if (k === 'folder') $('#fileFolder').click();
		else if (k === 'html') $('#fileHtml').click();
		else if (k === 'sample') loadSample();
	});
	$('#addBtn').addEventListener('click', () => menu.classList.add('open'));
	$('#fileZip').addEventListener('change', (e) => {
		const f = e.target.files[0];
		e.target.value = '';
		if (f) runImport('zip', () => importZipFile(f));
	});
	$('#fileAssets').addEventListener('change', (e) => {
		const f = e.target.files[0];
		e.target.value = '';
		if (f) importAssetsZipFile(f);
	});
	$('#fileHtml').addEventListener('change', (e) => {
		const f = e.target.files[0];
		e.target.value = '';
		if (f) runImport('html', () => importHtmlFile(f));
	});
	$('#fileFolder').addEventListener('change', (e) => {
		const fs = [...e.target.files];
		e.target.value = '';
		if (fs.length) runImport('pasta', () => importFolderFiles(fs));
	});
	$('#deviceSeg').addEventListener('click', (e) => {
		const b = e.target.closest('[data-dev]');
		if (b) setDevice(b.dataset.dev);
	});
	el.dimW.addEventListener('input', setCustomDims);
	el.dimH.addEventListener('input', setCustomDims);
	$('#rotateBtn').addEventListener('click', () => {
		State.rotated = !State.rotated;
		applyDevice();
	});
	$('#layoutSeg').addEventListener('click', (e) => {
		const b = e.target.closest('[data-lay]');
		if (b) setLayout(b.dataset.lay);
	});
	$('#reloadBtn').addEventListener('click', () => {
		const p = activeProject();
		if (p) {
			$('#reloadBtn').firstElementChild.classList.add('spin');
			buildPreview(p);
			setTimeout(() => $('#reloadBtn').firstElementChild.classList.remove('spin'), 500);
		}
	});
	$('#consoleBtn').addEventListener('click', () => openConsole(!State.consoleOpen));
	$('#closeConsole').addEventListener('click', () => openConsole(false));
	$('#clearConsole').addEventListener('click', () => {
		const p = activeProject();
		if (p) {
			p.logs = [];
			renderConsole();
			updateBadge(p);
		}
	});
	$('#popoutBtn').addEventListener('click', openPopout);
	$('#consoleTabs').addEventListener('click', (e) => {
		const b = e.target.closest('[data-f]');
		if (b) {
			State.consoleFilter = b.dataset.f;
			document
				.querySelectorAll('#consoleTabs button')
				.forEach((x) => x.classList.toggle('on', x === b));
			renderConsole();
		}
	});
	$('#consoleSearch').addEventListener('input', (e) => {
		State.consoleSearch = e.target.value;
		renderConsole();
	});
	$('#copyConsole').addEventListener('click', () => {
		const p = activeProject();
		if (!p || !p.logs.length) {
			toast('Console vazio', 'Nada para copiar', '');
			return;
		}
		const txt = p.logs
			.map(
				(l) =>
					'[' +
					fmtLogTime(l.t) +
					'] ' +
					String(l.level).toUpperCase() +
					' ' +
					l.text +
					(l.src ? ` (${l.src})` : ''),
			)
			.join('\n');
		try {
			navigator.clipboard.writeText(txt);
			toast('Console copiado', p.logs.length + ' linha(s) copiada(s)', 'ok');
		} catch (e) {
			toast('Falha ao copiar', 'Seu navegador bloqueou a área de transferência', 'warn');
		}
	});
	$('#collapseBtn').addEventListener('click', () => {
		openDirs.clear();
		renderTree();
	});
	el.exSearch.addEventListener('input', renderTree);
	el.editorScroll.addEventListener('scroll', () => {
		el.gutter.style.transform = `translateX(${el.editorScroll.scrollLeft}px)`;
		refreshMinimap();
	});
	let dragDepth = 0;
	window.addEventListener('dragenter', (e) => {
		if (typeof __drag !== 'undefined' && __drag) return;
		e.preventDefault();
		dragDepth++;
		el.dropzone.classList.add('show');
	});
	window.addEventListener('dragover', (e) => {
		if (typeof __drag !== 'undefined' && __drag) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = 'copy';
	});
	window.addEventListener('dragleave', (e) => {
		e.preventDefault();
		dragDepth--;
		if (dragDepth <= 0) {
			dragDepth = 0;
			el.dropzone.classList.remove('show');
		}
	});
	window.addEventListener('drop', (e) => {
		if (typeof __drag !== 'undefined' && __drag) return;
		e.preventDefault();
		dragDepth = 0;
		el.dropzone.classList.remove('show');
		if (e.dataTransfer) handleDrop(e.dataTransfer);
	});
	initResizer($('#rz1'), el.explorer, 'w', 180, 460);
	initResizer($('#rz2'), el.editorPane, 'w', 220, null, true);
	initResizer($('#rz3'), el.console, 'h', 120, 440, false, true);
	window.addEventListener('resize', applyDevice);
	window.addEventListener('message', (e) => {
		if (!(e.data && e.data.__lp_ready)) return;
		const p = activeProject();
		if (p && p.popout && e.source === p.popout && p.lastHtml) {
			try {
				p.popout.postMessage({ __lp_popout: true, html: p.lastHtml }, '*');
			} catch (_) {
				ignorarErro(_, 'wire');
			}
		}
	});
	$('#cmdkBtn').innerHTML = iconSvg('command');
	$('#cmdkBtn').addEventListener('click', () => openPalette(!State.paletteOpen));
	const tmenu = $('#themeMenu');
	$('#themeBtn').addEventListener('click', (e) => {
		e.stopPropagation();
		tmenu.classList.toggle('open');
	});
	document.addEventListener('click', () => tmenu.classList.remove('open'));
	tmenu.addEventListener('click', (e) => {
		e.stopPropagation();
		const th = e.target.closest('[data-theme]');
		if (th) {
			applyTheme(th.getAttribute('data-theme'));
			return;
		}
		if (e.target.closest('[data-pick]')) {
			const p = pk('tmPicker');
			if (p) {
				const willShow = p.hidden;
				p.hidden = !willShow;
				if (willShow) syncPickerTo(getComputedAcc());
			}
			return;
		}
		const ac = e.target.closest('[data-accent]');
		if (ac) {
			const v = ac.getAttribute('data-accent');
			applyAccent(v);
			if (v) syncPickerTo(v);
		}
	});
	tmenu.addEventListener('input', (e) => {
		if (e.target.id === 'tmHex') {
			let v = e.target.value.trim();
			if (!/^#?[0-9a-fA-F]{6}$/.test(v)) return;
			if (v[0] !== '#') v = '#' + v;
			setAccentLive(v);
			syncPickerTo(v);
			return;
		}
		if (e.target.classList && e.target.classList.contains('tm-range')) {
			const hex = readPicker();
			paintPickerTrack();
			setAccentLive(hex);
		}
	});
	$('#lockBtn').addEventListener('click', lockBtnClick);
	updateLockBtn();
	recInitBtn();
	['mousemove', 'keydown', 'pointerdown', 'touchstart', 'focus'].forEach((ev) =>
		window.addEventListener(ev, resetIdleLock, { passive: true, capture: true }),
	);
	wirePalette();
	wireQuickOpen();
	wireFindReplace();
	wireHistory();
	wireMcp();
	wireTerm();
	el.qopenBtn.innerHTML = iconSvg('search');
	el.qopenBtn.addEventListener('click', () => openQuickOpen(true));
	if (el.fmtBtn) {
		el.fmtBtn.innerHTML = iconSvg('spark');
		el.fmtBtn.addEventListener('click', formatActiveFile);
	}
	el.histBtn.innerHTML = iconSvg('clock');
	el.histBtn.addEventListener('click', openHistory);
	window.addEventListener('keydown', handleShortcut, true);
	applyTheme(loadTheme());
	applyAccent(loadAccent());
	setLayout('split');
	setDevice('responsive');
	renderStatusbar();
	logInit();
	restoreOnBoot();
}
function logInit() {}
function initResizer(handle, target, axis, min, max, flexGrow, invert) {
	let start = 0,
		size = 0,
		drag = false;
	handle.addEventListener('mousedown', (e) => {
		drag = true;
		start = axis === 'w' ? e.clientX : e.clientY;
		size =
			axis === 'w' ? target.getBoundingClientRect().width : target.getBoundingClientRect().height;
		handle.classList.add('drag');
		document.body.style.cursor = axis === 'w' ? 'col-resize' : 'row-resize';
		document.body.style.userSelect = 'none';
		e.preventDefault();
	});
	window.addEventListener('mousemove', (e) => {
		if (!drag) return;
		let delta = (axis === 'w' ? e.clientX : e.clientY) - start;
		if (invert) delta = -delta;
		let v = size + delta;
		if (min) v = Math.max(min, v);
		if (max) v = Math.min(max, v);
		if (flexGrow) {
			target.style.flex = 'none';
			target.style.width = v + 'px';
		} else if (axis === 'w') {
			target.style.width = v + 'px';
		} else {
			target.style.height = v + 'px';
		}
		applyDevice();
	});
	window.addEventListener('mouseup', () => {
		if (drag) {
			drag = false;
			handle.classList.remove('drag');
			document.body.style.cursor = '';
			document.body.style.userSelect = '';
		}
	});
}

if (document.readyState !== 'loading') wire();
else document.addEventListener('DOMContentLoaded', wire);

const M3D_KEYS = {
	SKETCHFAB_TOKEN: '735912fdf9af4931ae94da7284dd46f7',
	POLY_PIZZA_KEY: 'c424bef6a60c4abba537d4b8a69a965e',
};

const M3D_FONTES = {
	polyhaven: {
		nome: 'Poly Haven',
		chave: null,
		fmt: 'glTF + .bin + texturas (arquivos separados)',
		lic: 'CC0 (uso livre, ate comercial)',
		obs: 'modelos PBR de alta qualidade; escolha a resolucao das texturas (1k..8k)',
	},
	khronos: {
		nome: 'Khronos glTF Sample Assets',
		chave: null,
		fmt: 'GLB unico (rig + animacao + texturas embutidos)',
		lic: 'CC0 / CC-BY conforme o modelo',
		obs: 'melhor fonte para testar rig e animacao (Fox, CesiumMan, BrainStem, RiggedFigure...)',
	},
	ambientcg: {
		nome: 'ambientCG',
		chave: null,
		fmt: 'ZIP oficial extraido (modelo + texturas)',
		lic: 'CC0',
		obs: 'props e decoracao escaneados',
	},
	sketchfab: {
		nome: 'Sketchfab',
		chave: 'SKETCHFAB_TOKEN',
		fmt: 'ZIP glTF oficial (rig + animacao + texturas)',
		lic: 'do autor (a busca ja filtra downloadable)',
		obs: 'maior acervo; precisa do token da conta',
	},
	polypizza: {
		nome: 'Poly Pizza',
		chave: 'POLY_PIZZA_KEY',
		fmt: 'GLB unico',
		lic: 'CC0 / CC-BY',
		obs: 'modelos low poly, otimos para jogos',
	},
};

const M3D_CACHE = {};
const M3D_MAX_TOTAL = 90 * 1024 * 1024;
const M3D_MAX_ARQ = 500;

function m3dSlug(t) {
	return (
		String(t == null ? '' : t)
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 48) || 'modelo'
	);
}
function m3dTemChave(f) {
	const c = M3D_FONTES[f] && M3D_FONTES[f].chave;
	return !c || !!String(M3D_KEYS[c] || '').trim();
}
function m3dExigeChave(f) {
	const c = M3D_FONTES[f] && M3D_FONTES[f].chave;
	if (c && !String(M3D_KEYS[c] || '').trim())
		throw new Error(
			`A fonte "${M3D_FONTES[f].nome}" precisa de chave. Peca ao usuario para abrir o index.html, achar \
a constante M3D_KEYS e preencher ${c} (o passo a passo esta em GUIA-APIS-3D.md). As fontes polyhaven, \
khronos e ambientcg funcionam sem chave nenhuma.`,
		);
	return c ? String(M3D_KEYS[c]).trim() : '';
}

async function m3dBaixar(url) {
	if (!/^https?:\/\//i.test(String(url || ''))) throw new Error('URL invalida: ' + url);
	let erroRelay = null;
	if (/^https?:\/\//i.test(mcpBase())) {
		try {
			const r = await termApi('fetchurl', { url: String(url) });
			if (r && r.b64) return { bytes: b64ToBytes(r.b64), mime: r.mime || '' };
		} catch (e) {
			erroRelay = (e && e.message) || String(e);
		}
	}
	try {
		const r2 = await fetch(url, { redirect: 'follow' });
		if (!r2.ok) throw new Error('HTTP ' + r2.status);
		const ab = await r2.arrayBuffer();
		return { bytes: new Uint8Array(ab), mime: r2.headers.get('content-type') || '' };
	} catch (e2) {
		throw new Error(
			`nao consegui baixar ${url}: ${(e2 && e2.message) || e2}${erroRelay ? ' | relay: ' + erroRelay : ''}`,
		);
	}
}
async function m3dJson(url, headers) {
	try {
		const r = await fetch(url, { headers: headers || {} });
		if (!r.ok) throw new Error('HTTP ' + r.status);
		return await r.json();
	} catch (e) {
		if (headers && Object.keys(headers).length)
			throw new Error('a API respondeu com erro: ' + ((e && e.message) || e));
		const b = await m3dBaixar(url);
		return JSON.parse(Core.utf8Decode(b.bytes));
	}
}

function m3dGravar(proj, base, itens) {
	const out = [];
	let total = 0;
	for (const it of itens) total += it.bytes.length;
	if (total > M3D_MAX_TOTAL)
		throw new Error(
			`modelo grande demais (${mvSize(total)}); limite de ${mvSize(M3D_MAX_TOTAL)}. Baixe uma resolucao menor de textura.`,
		);
	if (itens.length > M3D_MAX_ARQ)
		throw new Error(`o pacote tem ${itens.length} arquivos (limite ${M3D_MAX_ARQ}).`);
	for (const it of itens) {
		const rel = String(it.rel || '')
			.replace(/\\/g, '/')
			.replace(/^\/+/, '')
			.replace(/^\.\//, '');
		if (!rel || rel.includes('..')) continue;
		const path = mcpNorm(base + '/' + rel);
		const f = makeFileEntry(path, it.bytes);
		proj.files.set(path, f);
		mcpAfterWrite(proj, path);
		out.push(path + ' (' + mvSize(it.bytes.length) + ')');
	}
	if (!out.length) throw new Error('o pacote veio vazio.');
	return out;
}
async function m3dBaixarLista(lista) {
	const itens = [];
	for (const l of lista) {
		const b = await m3dBaixar(l.url);
		itens.push({ rel: l.rel, bytes: b.bytes });
	}
	return itens;
}
async function m3dDoZip(bytes) {
	const ents = await parseZipAsync(bytes);
	const nomes = ents.map((e) => e.name);
	let raiz = null;
	try {
		raiz = Core.stripCommonRoot(nomes);
	} catch (e) {
		raiz = null;
	}
	return ents
		.filter((e) => !/(^|\/)__MACOSX\//.test(e.name) && !/(^|\/)\.DS_Store$/.test(e.name))
		.map(function (e) {
			let rel = e.name;
			if (raiz && rel.indexOf(raiz + '/') === 0) rel = rel.slice(raiz.length + 1);
			return { rel: rel, bytes: e.data };
		});
}
function m3dEhZip(bytes, mime, url) {
	if (bytes && bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b) return true;
	if (/zip/i.test(String(mime || ''))) return true;
	return /\.zip(\?|$)/i.test(String(url || ''));
}
function m3dResumo(fonte, nome, base, gravados, extra) {
	const principal = gravados.filter(
		(g) => /\.(glb|gltf|fbx|obj)\s/i.test(g) || /\.(glb|gltf|fbx|obj)\(/i.test(g),
	);
	return `Modelo "${nome}" importado de ${M3D_FONTES[fonte] ? M3D_FONTES[fonte].nome : fonte} para ${base}/ \
(${gravados.length} arquivo(s), tudo original: malha, rig, animacoes, materiais e texturas).\n${gravados.map((g) => ' - ' + g).join('\n')}${extra ? '\n' + extra : ''}\nUse \
o caminho relativo no codigo (ex.: new GLTFLoader().load("${base}/...")) e confira escala/pivot com \
model3d_list -> model3d_inspect.`;
}

async function m3dPolyLista() {
	if (!M3D_CACHE.ph) M3D_CACHE.ph = await m3dJson('https://api.polyhaven.com/assets?type=models');
	return M3D_CACHE.ph;
}
async function m3dPolyBusca(q, lim) {
	const all = await m3dPolyLista();
	const t = String(q || '')
		.toLowerCase()
		.trim();
	const out = [];
	for (const id in all) {
		const a = all[id] || {};
		const alvo = (
			id +
			' ' +
			(a.name || '') +
			' ' +
			(a.categories || []).join(' ') +
			' ' +
			(a.tags || []).join(' ')
		).toLowerCase();
		if (t && !alvo.includes(t)) continue;
		out.push({
			id: id,
			nome: a.name || id,
			fonte: 'polyhaven',
			lic: 'CC0',
			info: (a.categories || []).slice(0, 4).join(', '),
		});
		if (out.length >= lim) break;
	}
	return out;
}
async function m3dPolyArquivos(id, res) {
	const f = await m3dJson('https://api.polyhaven.com/files/' + encodeURIComponent(id));
	const cand = [];
	(function anda(no, cam) {
		if (!no || typeof no !== 'object') return;
		if (typeof no.url === 'string') {
			cand.push({
				cam: cam.join('/').toLowerCase(),
				url: no.url,
				inc: no.include && typeof no.include === 'object' ? no.include : null,
			});
			return;
		}
		for (const k in no) anda(no[k], cam.concat(k));
	})(f, []);
	let lista = cand.filter((c) => /\.gltf(\?|$)/i.test(c.url));
	if (!lista.length) lista = cand.filter((c) => /\.glb(\?|$)/i.test(c.url));
	if (!lista.length) lista = cand.filter((c) => /\.fbx(\?|$)/i.test(c.url));
	if (!lista.length) throw new Error(`Poly Haven nao publicou gltf/glb/fbx para "${id}".`);
	const alvo = String(res || '1k').toLowerCase();
	let esc = lista.filter((c) => c.cam.split('/').includes(alvo));
	if (!esc.length) esc = lista.filter((c) => c.cam.includes('1k'));
	if (!esc.length) esc = lista;
	const pick = esc[0];
	const out = [{ rel: pick.url.split('?')[0].split('/').pop(), url: pick.url }];
	if (pick.inc)
		for (const k in pick.inc) {
			const v = pick.inc[k];
			if (v && v.url) out.push({ rel: k, url: v.url });
		}
	return out;
}

const M3D_KH_BASE =
	'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/';
async function m3dKhIndex() {
	if (!M3D_CACHE.kh) M3D_CACHE.kh = await m3dJson(M3D_KH_BASE + 'model-index.json');
	return M3D_CACHE.kh;
}
async function m3dKhBusca(q, lim) {
	const idx = await m3dKhIndex();
	const t = String(q || '')
		.toLowerCase()
		.trim();
	const out = [];
	for (const m of idx) {
		const alvo = (
			(m.name || '') +
			' ' +
			(m.tags || []).join(' ') +
			' ' +
			(m.label || '')
		).toLowerCase();
		if (t && !alvo.includes(t)) continue;
		out.push({
			id: m.name,
			nome: m.name,
			fonte: 'khronos',
			lic: 'CC0/CC-BY',
			info:
				(m.tags || []).slice(0, 4).join(', ') +
				' | variantes: ' +
				Object.keys(m.variants || {}).join(', '),
		});
		if (out.length >= lim) break;
	}
	return out;
}
async function m3dKhArquivos(id) {
	const idx = await m3dKhIndex();
	const m = idx.filter((x) => String(x.name).toLowerCase() === String(id).toLowerCase())[0];
	if (!m)
		throw new Error(
			`modelo "${id}" nao existe no acervo Khronos (use model3d_search source="khronos").`,
		);
	const v = m.variants || {};
	const chave = v['glTF-Binary']
		? 'glTF-Binary'
		: v['glTF-Embedded']
			? 'glTF-Embedded'
			: Object.keys(v)[0];
	if (!chave) throw new Error('modelo sem variantes publicadas.');
	const arq = v[chave];
	const base = M3D_KH_BASE + encodeURIComponent(m.name) + '/' + encodeURIComponent(chave) + '/';
	if (/\.glb$/i.test(arq)) return [{ rel: arq, url: base + arq }];
	const principal = await m3dBaixar(base + arq);
	const itens = [{ rel: arq, bytes: principal.bytes }];
	let j = null;
	try {
		j = JSON.parse(Core.utf8Decode(principal.bytes));
	} catch (e) {
		j = null;
	}
	const refs = [];
	if (j) {
		(j.buffers || []).forEach((b) => {
			if (b && b.uri && b.uri.indexOf('data:') !== 0) refs.push(b.uri);
		});
		(j.images || []).forEach((im) => {
			if (im && im.uri && im.uri.indexOf('data:') !== 0) refs.push(im.uri);
		});
	}
	for (const r of refs) {
		const b = await m3dBaixar(base + r.split('/').map(encodeURIComponent).join('/'));
		itens.push({ rel: decodeURIComponent(r), bytes: b.bytes });
	}
	return itens;
}

async function m3dAcgBusca(q, lim) {
	const j = await m3dJson(
		'https://ambientcg.com/api/v2/full_json?type=3DModel&limit=' +
			Math.min(60, lim * 3) +
			'&q=' +
			encodeURIComponent(q || '') +
			'&include=downloadData',
	);
	const arr = (j && j.foundAssets) || [];
	return arr.slice(0, lim).map((a) => ({
		id: a.assetId,
		nome: a.displayName || a.assetId,
		fonte: 'ambientcg',
		lic: 'CC0',
		info: (a.tags || []).slice(0, 4).join(', '),
	}));
}
async function m3dAcgZip(id) {
	const j = await m3dJson(
		'https://ambientcg.com/api/v2/full_json?id=' + encodeURIComponent(id) + '&include=downloadData',
	);
	const a = ((j && j.foundAssets) || [])[0];
	if (!a) throw new Error(`ambientCG nao encontrou "${id}".`);
	const links = [];
	(function anda(no) {
		if (!no || typeof no !== 'object') return;
		if (typeof no.downloadLink === 'string')
			links.push({ url: no.downloadLink, nome: no.fileName || '', size: Number(no.size) || 0 });
		for (const k in no) anda(no[k]);
	})(a.downloadFolders || a);
	if (!links.length) throw new Error(`ambientCG nao ofereceu download para "${id}".`);
	links.sort((x, y) => x.size - y.size);
	return links[0];
}

async function m3dSkBusca(q, lim) {
	const tk = m3dExigeChave('sketchfab');
	const j = await m3dJson(
		'https://api.sketchfab.com/v3/search?type=models&downloadable=true&count=' +
			Math.min(24, lim) +
			'&q=' +
			encodeURIComponent(q || ''),
		{ Authorization: 'Token ' + tk },
	);
	return ((j && j.results) || []).slice(0, lim).map((m) => ({
		id: m.uid,
		nome: m.name || m.uid,
		fonte: 'sketchfab',
		lic: (m.license && (m.license.label || m.license.slug)) || 'do autor',
		info: `animacoes: ${m.animationCount || 0} | por ${(m.user && m.user.displayName) || '?'}`,
	}));
}
async function m3dSkZip(uid) {
	const tk = m3dExigeChave('sketchfab');
	const j = await m3dJson(
		'https://api.sketchfab.com/v3/models/' + encodeURIComponent(uid) + '/download',
		{ Authorization: 'Token ' + tk },
	);
	const u = j && ((j.gltf && j.gltf.url) || (j.glb && j.glb.url) || (j.source && j.source.url));
	if (!u)
		throw new Error(
			'o Sketchfab nao liberou download para esse modelo (pode nao ser downloadable com a sua conta).',
		);
	return { url: u, nome: uid };
}

async function m3dPpBusca(q, lim) {
	const k = m3dExigeChave('polypizza');
	const j = await m3dJson(
		'https://api.poly.pizza/v1.1/search/' +
			encodeURIComponent(q || '') +
			'?Limit=' +
			Math.min(30, lim),
		{ 'x-auth-token': k },
	);
	return ((j && (j.results || j.Results)) || []).slice(0, lim).map((m) => ({
		id: m.ID || m.id,
		nome: m.Title || m.title || m.ID,
		fonte: 'polypizza',
		lic: m.Licence || m.License || 'CC-BY',
		info: 'download: ' + (m.Download || m.download || '?'),
	}));
}
async function m3dPpArquivo(id) {
	const k = m3dExigeChave('polypizza');
	const j = await m3dJson('https://api.poly.pizza/v1.1/model/' + encodeURIComponent(id), {
		'x-auth-token': k,
	});
	const u = j && (j.Download || j.download);
	if (!u) throw new Error(`Poly Pizza nao devolveu URL de download para "${id}".`);
	return { url: u, nome: j.Title || id };
}

const M3D_TOOLS = [
	{
		name: 'model3d_sources',
		title: '3D web: fontes disponiveis',
		desc:
			'Lista as fontes de modelos 3D que o site sabe importar pelo MCP, quais ja funcionam sem ' +
			'chave (Poly Haven, Khronos glTF Sample Assets, ambientCG e URL direta) e quais dependem ' +
			'de uma chave de API que o usuario precisa colar em M3D_KEYS no index.html (Sketchfab, ' +
			'Poly Pizza). Comece por aqui quando o usuario pedir um modelo 3D da internet.',
		schema: { type: 'object', properties: {} },
		run: async () => {
			const l = [];
			for (const k in M3D_FONTES) {
				const f = M3D_FONTES[k];
				const ok = m3dTemChave(k);
				l.push(
					'- ' +
						k +
						' (' +
						f.nome +
						'): ' +
						(f.chave
							? ok
								? 'chave configurada - PRONTO'
								: `FALTA a chave ${f.chave} em M3D_KEYS (index.html)`
							: 'sem chave - PRONTO') +
						'\n    formato: ' +
						f.fmt +
						' | licenca: ' +
						f.lic +
						'\n    ' +
						f.obs,
				);
			}
			return `Fontes de modelos 3D (model3d_search para achar, model3d_import para baixar completo):\n${l.join('\n')}\n- \
url direta: model3d_import_url baixa qualquer .glb/.gltf/.zip publico (Kenney, Quaternius, Mixamo exportado, \
seu proprio servidor) preservando a estrutura de pastas.\nTudo cai no projeto com os arquivos originais: \
rig, animacoes, materiais e texturas intactos.`;
		},
	},
	{
		name: 'model3d_search',
		title: '3D web: procurar modelo',
		desc:
			'Procura modelos 3D nas fontes suportadas e devolve os ids para usar em model3d_import. ' +
			'source: polyhaven, khronos, ambientcg, sketchfab ou polypizza (as duas ultimas exigem ' +
			'chave). Dica: khronos e a melhor fonte para modelos COM rig e animacao prontos; ' +
			'polyhaven para props PBR realistas; polypizza para low poly.',
		schema: {
			type: 'object',
			properties: {
				query: {
					type: 'string',
					description: 'Termo de busca (ex.: chair, fox, tree). Vazio lista os primeiros.',
				},
				source: {
					type: 'string',
					enum: ['polyhaven', 'khronos', 'ambientcg', 'sketchfab', 'polypizza'],
					description: 'Fonte (padrao: polyhaven)',
				},
				limit: {
					type: 'integer',
					minimum: 1,
					maximum: 40,
					description: 'Quantos resultados (padrao 15)',
				},
			},
			required: [],
		},
		run: async (a) => {
			const src = String(a.source || 'polyhaven').toLowerCase();
			const lim = Math.min(40, Math.max(1, Number(a.limit) || 15));
			let r;
			if (src === 'polyhaven') r = await m3dPolyBusca(a.query, lim);
			else if (src === 'khronos') r = await m3dKhBusca(a.query, lim);
			else if (src === 'ambientcg') r = await m3dAcgBusca(a.query, lim);
			else if (src === 'sketchfab') r = await m3dSkBusca(a.query, lim);
			else if (src === 'polypizza') r = await m3dPpBusca(a.query, lim);
			else throw new Error(`fonte desconhecida: ${src} (use model3d_sources).`);
			if (!r.length)
				return `Nenhum modelo encontrado em ${src} para "${a.query || ''}". Tente outro termo em ingles.`;
			return (
				r.length +
				' resultado(s) em ' +
				src +
				':\n' +
				r
					.map((x) => ` - id: ${x.id} | ${x.nome} | ${x.lic}${x.info ? ' | ' + x.info : ''}`)
					.join('\n') +
				'\n\nImporte com model3d_import source="' +
				src +
				'" id="<id acima>".'
			);
		},
	},
	{
		name: 'model3d_import',
		title: '3D web: importar modelo completo',
		desc:
			'Baixa um modelo 3D COMPLETO da fonte escolhida direto para o projeto, com os arquivos ' +
			'originais: malha, rig/esqueleto, animacoes, materiais e todas as texturas (glTF + .bin ' +
			'+ pasta de texturas, ou o zip oficial extraido mantendo a estrutura). Nada e convertido ' +
			'nem simplificado. Destino padrao: assets/3d/{id}/. Depois use ' +
			'model3d_list/model3d_inspect para conferir escala e pivot.',
		schema: {
			type: 'object',
			properties: {
				source: {
					type: 'string',
					enum: ['polyhaven', 'khronos', 'ambientcg', 'sketchfab', 'polypizza'],
					description: 'Fonte do modelo',
				},
				id: { type: 'string', description: 'id devolvido por model3d_search' },
				dest: {
					type: 'string',
					description: 'Pasta de destino no projeto (padrao assets/3d/{id})',
				},
				resolution: {
					type: 'string',
					description: 'Poly Haven: resolucao das texturas (1k, 2k, 4k, 8k - padrao 1k)',
				},
				project: MCP_PROJECT_PROP,
				agent: MCP_AGENT_PROP,
			},
			required: ['source', 'id'],
		},
		run: async (a) => {
			const proj = mcpProj(a);
			const src = String(a.source || '').toLowerCase();
			const id = String(a.id || '').trim();
			if (!id) throw new Error('informe o id (use model3d_search).');
			const base = mcpNorm(String(a.dest || 'assets/3d/' + m3dSlug(id)));
			let itens = null,
				nome = id,
				extra = '';
			if (src === 'polyhaven') {
				const lista = await m3dPolyArquivos(id, a.resolution || '1k');
				itens = await m3dBaixarLista(lista);
				extra = `Texturas em ${String(a.resolution || '1k')}. O .gltf ja aponta para o .bin e para as texturas pelos caminhos relativos originais.`;
			} else if (src === 'khronos') {
				const r = await m3dKhArquivos(id);
				itens = r[0] && r[0].url ? await m3dBaixarLista(r) : r;
				extra = 'Acervo oficial Khronos: rig e animacoes vem embutidos no arquivo.';
			} else if (src === 'ambientcg') {
				const z = await m3dAcgZip(id);
				const b = await m3dBaixar(z.url);
				itens = m3dEhZip(b.bytes, b.mime, z.url)
					? await m3dDoZip(b.bytes)
					: [{ rel: z.nome || id, bytes: b.bytes }];
			} else if (src === 'sketchfab') {
				const z = await m3dSkZip(id);
				const b = await m3dBaixar(z.url);
				itens = m3dEhZip(b.bytes, b.mime, z.url)
					? await m3dDoZip(b.bytes)
					: [{ rel: id + '.glb', bytes: b.bytes }];
				extra = 'Respeite a licenca do autor no Sketchfab (credito quando exigido).';
			} else if (src === 'polypizza') {
				const f = await m3dPpArquivo(id);
				const b = await m3dBaixar(f.url);
				nome = f.nome || id;
				itens = m3dEhZip(b.bytes, b.mime, f.url)
					? await m3dDoZip(b.bytes)
					: [{ rel: m3dSlug(nome) + '.glb', bytes: b.bytes }];
			} else throw new Error(`fonte desconhecida: ${src} (use model3d_sources).`);
			const gravados = m3dGravar(proj, base, itens);
			return m3dResumo(src, nome, base, gravados, extra);
		},
	},
	{
		name: 'model3d_import_url',
		title: '3D web: importar de uma URL',
		desc:
			'Baixa um modelo 3D de qualquer URL publica (.glb, .gltf, .fbx, .obj ou .zip) e coloca ' +
			'no projeto. Se for .zip, extrai preservando a estrutura de pastas (modelo + texturas + ' +
			'animacoes). Use para Kenney, Quaternius, Mixamo ja exportado, Smithsonian, seu proprio ' +
			'servidor ou qualquer link direto que o usuario mandar.',
		schema: {
			type: 'object',
			properties: {
				url: { type: 'string', description: 'URL publica http(s) do modelo ou do zip' },
				dest: {
					type: 'string',
					description: 'Pasta de destino (padrao assets/3d/{nome do arquivo})',
				},
				name: {
					type: 'string',
					description: 'Nome do arquivo principal quando a URL nao tiver extensao',
				},
				project: MCP_PROJECT_PROP,
				agent: MCP_AGENT_PROP,
			},
			required: ['url'],
		},
		run: async (a) => {
			const proj = mcpProj(a);
			const url = String(a.url || '');
			const arq = decodeURIComponent(url.split('?')[0].split('/').pop() || 'modelo');
			const base = mcpNorm(
				String(a.dest || 'assets/3d/' + m3dSlug(arq.replace(/\.[a-z0-9]+$/i, ''))),
			);
			const b = await m3dBaixar(url);
			const itens = m3dEhZip(b.bytes, b.mime, url)
				? await m3dDoZip(b.bytes)
				: [{ rel: a.name || arq || 'modelo.glb', bytes: b.bytes }];
			const gravados = m3dGravar(proj, base, itens);
			return m3dResumo('url', arq, base, gravados, '');
		},
	},
];

try {
	MCP_TOOLS.push.apply(MCP_TOOLS, M3D_TOOLS);
} catch (e) {
	try {
		registro.aviso('3D import: falha ao registrar', e);
	} catch (e2) {
		ignorarErro(e2, 'catalogo');
	}
}
try {
	['model3d_import', 'model3d_import_url'].forEach(function (n) {
		AG_WRITE.add(n);
	});
} catch (e) {
	ignorarErro(e, 'catalogo');
}
try {
	MCP_INSTRUCTIONS +=
		' MODELOS 3D DA WEB: voce consegue trazer modelos 3D prontos da internet para dentro do ' +
		'projeto sem perder nada. model3d_sources lista as fontes e diz quais ja estao prontas ' +
		'(Poly Haven, Khronos glTF Sample Assets, ambientCG e URL direta funcionam sem chave ' +
		'nenhuma; Sketchfab e Poly Pizza so funcionam depois que o usuario colar a chave em ' +
		'M3D_KEYS no index.html). model3d_search ' +
		'source="polyhaven|khronos|ambientcg|sketchfab|polypizza" query="..." acha o id; ' +
		'model3d_import source=... id=... baixa o modelo COMPLETO para assets/3d/{id}/ com os ' +
		'arquivos originais (glTF + .bin + todas as texturas, ou o zip oficial extraido com a ' +
		'estrutura de pastas preservada) - rig/esqueleto, animacoes, materiais e mapas de ' +
		'textura chegam intactos, nada e convertido. model3d_import_url baixa de qualquer link ' +
		'direto (.glb/.gltf/.fbx/.obj/.zip). Para modelos COM animacao e rig prontos prefira ' +
		'source="khronos" (Fox, CesiumMan, BrainStem, RiggedFigure); para props realistas PBR ' +
		'use polyhaven com resolution="1k" ou "2k". Depois de importar, confira escala e pivot ' +
		'com model3d_list -> model3d_inspect antes de usar no jogo.';
} catch (e) {
	ignorarErro(e, 'catalogo');
}

try {
	setTimeout(appIniciar, 0);
	setTimeout(appIniciar, 600);
	setTimeout(appIniciar, 1800);
	setTimeout(appIniciar, 4000);
	setTimeout(appIniciar, 8000);
} catch (e) {
	ignorarErro(e, 'catalogo');
}

const APPD = { base: '', buscando: false, falhas: 0, timer: null, avisou: false };
const APPD_PORTAS = [8787, 8788, 8789, 8790];
function appdBases() {
	const l = [];
	if (APPD.base) l.push(APPD.base);
	for (const p of APPD_PORTAS) {
		const a = 'http://127.0.0.1:' + p,
			b = 'http://localhost:' + p;
		if (!l.includes(a)) l.push(a);
		if (!l.includes(b)) l.push(b);
	}
	return l;
}
async function appdHealth(base, ms) {
	const ctl = new AbortController();
	const t = setTimeout(() => {
		try {
			ctl.abort();
		} catch (e) {
			ignorarErro(e, 'appdHealth');
		}
	}, ms || 1500);
	try {
		const r = await fetch(base + '/health', {
			method: 'GET',
			cache: 'no-store',
			mode: 'cors',
			credentials: 'omit',
			signal: ctl.signal,
		});
		if (!r.ok) return null;
		const j = await r.json();
		if (!j || j.app !== 'aurora-android') return null;
		return j;
	} catch (e) {
		return null;
	} finally {
		clearTimeout(t);
	}
}
function appdEstado(base, j) {
	return {
		app: 'aurora-android',
		appVersion: j.appVersion || j.version || '?',
		running: true,
		port: j.port || 8787,
		sid: j.sid || '',
		token: j.token || '',
		relayUrl: j.relayUrl || base,
		publicUrl: j.publicUrl || '',
		tunnel: j.tunnel || '',
		mcpUrl: j.mcpUrl || null,
		browserOnline: !!j.browserOnline,
	};
}
async function appdProcurar() {
	if (appPonte()) return null;
	if (APPD.buscando) return null;
	APPD.buscando = true;
	try {
		for (const base of appdBases()) {
			const j = await appdHealth(base, APPD.base === base ? 2500 : 1200);
			if (j && j.sid && j.token) {
				APPD.base = base;
				APPD.falhas = 0;
				appAplicar(appdEstado(base, j));
				return j;
			}
		}
		if (APPD.base) {
			APPD.falhas++;
			if (APPD.falhas >= 3 && APPN.ativo) {
				APPD.base = '';
				APPD.falhas = 0;
				try {
					appAplicar(Object.assign({}, APPN.ultimo || {}, { running: false }));
				} catch (e) {
					ignorarErro(e, 'appdProcurar');
				}
			}
		}
		return null;
	} finally {
		APPD.buscando = false;
	}
}
function appdLoop() {
	clearTimeout(APPD.timer);
	const agenda = () => {
		APPD.timer = setTimeout(appdLoop, APPD.base ? (MCP.active ? 15000 : 5000) : 8000);
	};
	try {
		appdProcurar().then(agenda, agenda);
	} catch (e) {
		agenda();
	}
}
try {
	setTimeout(appdLoop, 400);
	document.addEventListener('visibilitychange', function () {
		if (!document.hidden && !appPonte()) appdLoop();
	});
	window.addEventListener('online', function () {
		if (!appPonte()) appdLoop();
	});
} catch (e) {
	ignorarErro(e, 'catalogo');
}
try {
	const _mcpActivateOriginal = mcpActivate;
	mcpActivate = function (silent) {
		if (
			APPN.ativo ||
			appPonte() ||
			(typeof window.mcpModoAtual === 'function' && window.mcpModoAtual() === 'local') ||
			/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(mcpBase())
		) {
			return _mcpActivateOriginal(silent);
		}
		try {
			mcpLog('ok', 'Procurando o app Synapse Relay neste aparelho (127.0.0.1)...');
		} catch (e) {
			ignorarErro(e, 'catalogo');
		}
		appdProcurar().then(
			function (j) {
				if (j) return;
				try {
					mcpLog(
						'err',
						'App Synapse Relay nao respondeu em 127.0.0.1:8787 - inicie o relay no app (ou use um relay hospedado).',
					);
				} catch (e) {
					ignorarErro(e, 'catalogo');
				}
				_mcpActivateOriginal(silent);
			},
			function () {
				_mcpActivateOriginal(silent);
			},
		);
	};
} catch (e) {
	ignorarErro(e, 'catalogo');
}
try {
	var _mt = document.getElementById('mcpToggle');
	if (_mt)
		_mt.addEventListener(
			'click',
			function () {
				if (MCP.active) mcpMarcarOff();
				else {
					try {
						APPN.userOff = false;
					} catch (e) {
						ignorarErro(e, 'catalogo');
					}
				}
			},
			true,
		);
} catch (e) {
	ignorarErro(e, 'catalogo');
}
