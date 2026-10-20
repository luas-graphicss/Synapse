'use strict';
function tmDepReal(proj, path) {
	const n = tmNormPath(path);
	if (!n || !proj || !proj.files) return '';
	try {
		if (proj.files.has(n)) return n;
	} catch (e) {
		ignorarErro(e, 'tmDepReal');
	}
	const idx = tmDepIndex(proj);
	return idx[n.toLowerCase()] || '';
}

function tmDepGrafoVazio() {
	return {
		deps: {},
		dependentes: {},
		quebrados: [],
		escaneados: {},
		arquivos: 0,
		lidos: 0,
		parcial: false,
		stamp: '',
		ts: 0,
	};
}
function tmDepLido(g, real) {
	return !!(g && g.escaneados && g.escaneados[real]);
}

function tmDepGrafo(proj, forcar) {
	if (!proj || !proj.files) return tmDepGrafoVazio();
	if (!TM.depCache || typeof TM.depCache !== 'object') TM.depCache = {};
	const id = String(proj.id || ''),
		stamp = tmDepStamp(proj),
		c = TM.depCache[id];
	if (!forcar && c && c.stamp === stamp && tmNow() - c.ts < TM_REVIEW_LIMITS.cacheMs) return c.g;
	const idx = tmDepIndex(proj),
		lista = Object.keys(idx).map(function (k) {
			return idx[k];
		});
	const g = tmDepGrafoVazio();
	g.arquivos = lista.length;
	g.parcial = lista.length > TM_REVIEW_LIMITS.grafoMax;
	const alvo = g.parcial ? lista.slice(0, TM_REVIEW_LIMITS.grafoMax) : lista;
	alvo.forEach(function (k) {
		if (!tmDepTipo(k)) return;
		let f = null;
		try {
			f = proj.files.get(k);
		} catch (e) {
			ignorarErro(e, 'tmDepGrafo');
		}
		if (!f || f.isText === false || typeof f.text !== 'string') return;
		g.lidos++;
		g.escaneados[k] = 1;
		const vistos = {};
		tmDepRefs(k, f.text).forEach(function (sp) {
			const r = tmDepResolve(idx, k, sp);
			if (!r) return;
			if (r.faltando) {
				if (g.quebrados.length < TM_REVIEW_LIMITS.quebradosMax)
					g.quebrados.push({ de: k, ref: sp, esperado: r.faltando });
				return;
			}
			if (r.path === k || vistos[r.path]) return;
			vistos[r.path] = 1;
			(g.deps[k] = g.deps[k] || []).push(r.path);
			(g.dependentes[r.path] = g.dependentes[r.path] || []).push(k);
		});
	});
	g.stamp = stamp;
	g.ts = tmNow();
	TM.depCache[id] = { stamp: stamp, ts: g.ts, g: g };
	return g;
}
function tmDepInvalida(projId) {
	if (!TM.depCache) return;
	if (projId) delete TM.depCache[String(projId)];
	else TM.depCache = {};
}
function tmDependentesDe(proj, path) {
	const g = tmDepGrafo(proj),
		real = tmDepReal(proj, path) || tmNormPath(path);
	return (g.dependentes[real] || []).slice();
}
function tmDepsDe(proj, path) {
	const g = tmDepGrafo(proj),
		real = tmDepReal(proj, path) || tmNormPath(path);
	return (g.deps[real] || []).slice();
}
function tmDonoNome(path) {
	const d = tmOwnerOf(path);
	return d && d.team ? d.team.name : '';
}
function tmDonoInfo(path) {
	const d = tmOwnerOf(path);
	return d && d.team ? { id: String(d.team.id || ''), name: String(d.team.name || '') } : null;
}

function tmReviewRisco(proj, caminhos, autorNome, ignorarId) {
	const R = {
		arquivos: [],
		cruzados: [],
		quebrados: [],
		travados: [],
		duplicados: [],
		semDono: [],
		fora: [],
		naoLidos: [],
		parcial: false,
		semProjeto: !proj,
		total: 0,
	};
	const lista = (caminhos || []).map(tmNormPath).filter(Boolean);
	R.total = lista.length;
	if (!proj) {
		lista.forEach(function (p) {
			R.arquivos.push({
				path: p,
				existe: false,
				dono: tmDonoNome(p),
				dependentes: [],
				deps: [],
				lido: false,
			});
		});
		return R;
	}
	const g = tmDepGrafo(proj);
	R.parcial = g.parcial;
	const projId = String(proj.id || '');
	const alterado = {};
	lista.forEach(function (p) {
		alterado[tmKey(p)] = 1;
	});

	lista.forEach(function (p) {
		const real = tmDepReal(proj, p),
			existe = !!real,
			chave = real || p;
		const donoI = tmDonoInfo(p),
			dono = donoI ? donoI.name : '';
		const deps = (g.deps[chave] || []).slice();
		const dependentes = (g.dependentes[chave] || []).slice();
		const lido = existe ? tmDepLido(g, chave) : false;
		R.arquivos.push({
			path: p,
			real: real,
			existe: existe,
			dono: dono,
			donoId: donoI ? donoI.id : '',
			deps: deps,
			dependentes: dependentes,
			lido: lido,
		});
		if (!lido && existe) R.naoLidos.push(p);
		if (!dono) R.semDono.push(p);
		dependentes.forEach(function (d) {
			if (alterado[tmKey(d)]) return;
			const dI = tmDonoInfo(d),
				donoD = dI ? dI.name : '';
			const outra = (!!dI && !!donoI && dI.id !== donoI.id) || (!!dI && !donoI) || (!dI && !!donoI);
			R.cruzados.push({
				alterado: p,
				dependente: d,
				equipe: donoD || '(sem dono)',
				outraEquipe: outra,
			});
		});
		try {
			const l = typeof tmLockOf === 'function' ? tmLockOf(p, projId) : null;
			if (l)
				R.travados.push({
					path: p,
					agente: l.agent,
					ate: l.until,
					seu: tmAgKey(l.agent) === tmAgKey(autorNome || ''),
				});
		} catch (e) {
			ignorarErro(e, 'tmReviewRisco');
		}
		tmReviewsAbertos().forEach(function (r) {
			if (ignorarId && r.id === ignorarId) return;
			if (String(r.proj || '') !== projId) return;
			if (
				r.files.some(function (x) {
					return tmKey(x) === tmKey(p);
				})
			)
				R.duplicados.push({ path: p, pedido: r.num, por: r.by, equipe: r.teamName });
		});
	});

	g.quebrados.forEach(function (q) {
		const daMudanca = !!alterado[tmKey(q.de)];
		const paraMudanca = lista.some(function (p) {
			const k = tmKey(p),
				e = tmKey(q.esperado);
			return k === e || k.indexOf(e + '.') === 0 || k.indexOf(e + '/') === 0;
		});
		if (daMudanca || paraMudanca)
			R.quebrados.push({ de: q.de, ref: q.ref, esperado: q.esperado, culpaDaMudanca: paraMudanca });
	});

	R.arquivos.forEach(function (a) {
		if (!a.existe) R.fora.push(a.path);
	});
	return R;
}

function tmRiscoGrave(R) {
	return (
		R.quebrados.length > 0 ||
		R.cruzados.filter(function (c) {
			return c.outraEquipe;
		}).length > 0 ||
		R.duplicados.length > 0
	);
}

function tmRevQuando(ts) {
	const s = Math.max(0, Math.round((tmNow() - ts) / 1000));
	if (s < 60) return `ha ${s}s`;
	const m = Math.round(s / 60);
	if (m < 60) return `ha ${m} min`;
	const h = Math.round(m / 60);
	if (h < 48) return `ha ${h} h`;
	return `ha ${Math.round(h / 24)} dia(s)`;
}
function tmRevLinha(r) {
	return (
		'#' +
		r.num +
		'  [' +
		r.status.toUpperCase() +
		']  ' +
		r.files.length +
		' arquivo(s)  por "' +
		(r.by || '(sem nome)') +
		'"' +
		(r.teamName ? ` da equipe "${r.teamName}"` : '') +
		(r.projName ? ` no projeto "${r.projName}"` : '') +
		'  ' +
		tmRevQuando(r.at) +
		(r.nota ? '\n     nota: ' + r.nota : '')
	);
}

function tmReviewDossie(r, proj) {
	const L = [];
	L.push(`PEDIDO DE REVISAO #${r.num}  (id ${r.id})`);
	L.push(
		'situacao: ' +
			r.status.toUpperCase() +
			'   aberto ' +
			tmRevQuando(r.at) +
			' por "' +
			(r.by || '(sem nome)') +
			'"' +
			(r.teamName ? ` da equipe "${r.teamName}"` : ''),
	);
	if (r.projName) L.push('projeto: ' + r.projName);
	if (r.nota) L.push('nota de quem pediu: ' + r.nota);
	L.push('');
	const R = tmReviewRisco(proj, r.files, r.by, r.id);
	L.push(`ARQUIVOS ALTERADOS (${r.files.length}):`);
	R.arquivos.forEach(function (a) {
		L.push(
			' - ' +
				a.path +
				(a.existe ? '' : '   [NAO EXISTE MAIS no projeto: apagado ou renomeado]') +
				(a.dono ? `   dono: equipe "${a.dono}"` : '   [sem dono]') +
				(a.existe && !a.lido
					? '   [NAO LIDO nesta varredura: numeros abaixo nao valem para ele]'
					: `   depende de ${a.deps.length}, usado por ${a.dependentes.length}`),
		);
	});
	L.push('');
	if (R.semProjeto) {
		if (r.proj) {
			L.push(
				'AVISO: o projeto deste pedido nao esta aberto agora, entao NAO foi possivel conferir',
			);
			L.push(
				`dependencias. Abra o projeto "${r.projName || '(sem nome)'}" e chame review_get de novo antes de decidir.`,
			);
		} else {
			L.push('AVISO: este pedido foi aberto sem projeto identificado, entao NAO da para conferir');
			L.push(
				'dependencia nenhuma - analisar o projeto que esta aberto agora daria um parecer sobre',
			);
			L.push(
				`outros arquivos. Peca a "${r.by || 'quem pediu'}" para reabrir o pedido informando project.`,
			);
		}
		L.push('');
		L.push('Decidir assim e decidir no escuro: so aprove se voce mesmo conferir os arquivos.');
		return L.join('\n');
	}
	const cruzadosOutros = R.cruzados.filter(function (c) {
		return c.outraEquipe;
	});
	L.push(
		`RISCO 1 - QUEM USA ESSES ARQUIVOS E NAO FOI ALTERADO JUNTO: ${R.cruzados.length} (${cruzadosOutros.length} de OUTRA equipe)`,
	);
	if (!R.cruzados.length)
		L.push(
			R.parcial
				? '  nenhum ENTRE OS ARQUIVOS LIDOS. O projeto passou do limite de leitura, entao isto NAO e prova de que ninguem usa.'
				: '  nenhum. Nenhum outro arquivo do projeto importa o que foi mexido.',
		);
	R.cruzados.slice(0, 40).forEach(function (c) {
		L.push(
			`  ${c.outraEquipe ? '[OUTRA EQUIPE] ' : '[mesma equipe] '}${c.dependente}  ->  usa  ${c.alterado}   (equipe "${c.equipe}")`,
		);
	});
	if (R.cruzados.length > 40) L.push(`  (+${R.cruzados.length - 40} outros)`);
	L.push('');
	L.push('RISCO 2 - IMPORTS QUE NAO APONTAM PARA ARQUIVO NENHUM: ' + R.quebrados.length);
	if (!R.quebrados.length) L.push('  nenhum.');
	R.quebrados.slice(0, 30).forEach(function (q) {
		L.push(
			`  ${q.de} importa "${q.ref}" -> nao existe (${q.esperado})${q.culpaDaMudanca ? '   [aponta para um arquivo DESTE pedido]' : ''}`,
		);
	});
	L.push('');
	if (R.duplicados.length) {
		L.push('RISCO 3 - MESMO ARQUIVO EM OUTRO PEDIDO ABERTO: ' + R.duplicados.length);
		R.duplicados.slice(0, 20).forEach(function (d) {
			L.push(
				'  ' +
					d.path +
					' tambem esta no pedido #' +
					d.pedido +
					' de "' +
					d.por +
					'"' +
					(d.equipe ? ` (${d.equipe})` : ''),
			);
		});
		L.push('');
	}
	if (R.travados.length) {
		L.push(
			'ATENCAO - ARQUIVOS AINDA TRAVADOS (trabalho pode nao ter terminado): ' + R.travados.length,
		);
		R.travados.slice(0, 20).forEach(function (t) {
			L.push(`  ${t.path} travado por "${t.agente}"${t.seu ? ' (o proprio autor do pedido)' : ''}`);
		});
		L.push('');
	}
	if (R.fora.length)
		L.push(
			`OBS: ${R.fora.length} caminho(s) do pedido nao existe(m) mais. Se foi renomeacao, confira quem apontava para eles.`,
		);
	if (R.naoLidos.length)
		L.push(
			`OBS: ${R.naoLidos.length} arquivo(s) do pedido nao foi(ram) lido(s) pelo motor (projeto grande, \
arquivo binario ou tipo sem imports): ${R.naoLidos.slice(0, 5).join(', ')}${R.naoLidos.length > 5 ? ' ...' : ''}.`,
		);
	if (R.parcial)
		L.push(
			`OBS: projeto muito grande - o grafo leu apenas os primeiros ${TM_REVIEW_LIMITS.grafoMax} arquivos.`,
		);
	if (R.semDono.length) L.push(`OBS: ${R.semDono.length} arquivo(s) sem equipe dona.`);
	L.push('');
	L.push('O QUE CONFERIR ANTES DE DECIDIR:');
	L.push(' 1. Para cada item de OUTRA EQUIPE no risco 1, abra o arquivo e veja se a assinatura,');
	L.push('    o nome exportado ou o formato de dados que ele espera continua igual.');
	L.push(
		' 2. Todo import quebrado do risco 2 e erro certo em tempo de execucao: reprove ou corrija.',
	);
	L.push(' 3. Se houver arquivo no risco 3, decida os dois pedidos juntos ou reprove um.');
	L.push(
		' 4. Voce PODE corrigir voce mesmo (ADR-0039): a equipe do Revisor escreve em qualquer arquivo.',
	);
	L.push('');
	L.push(
		`Decida com review_decide {id:"${r.num}", decision:"aprovado" ou "reprovado", parecer:"..."}.`,
	);
	if (r.status !== 'aberto')
		L.push(
			'ESTE PEDIDO JA FOI ' +
				r.status.toUpperCase() +
				(r.reviewer ? ` por "${r.reviewer}"` : '') +
				(r.parecer ? '\nparecer: ' + r.parecer : ''),
		);
	return L.join('\n');
}

function tmReviewsReport() {
	const L = tmReviews();
	if (!L.length)
		return 'Nenhum pedido de revisao ainda. Quando uma equipe terminar uma tarefa, ela chama review_submit com os arquivos que alterou.';
	const abertos = L.filter(function (r) {
		return r.status === 'aberto';
	});
	const out = [`REVISOES: ${abertos.length} aberto(s), ${L.length} no historico.`, ''];
	if (abertos.length) {
		out.push('ABERTOS:');
		abertos.forEach(function (r) {
			out.push(tmRevLinha(r));
		});
		out.push('');
	}
	const fechados = L.filter(function (r) {
		return r.status !== 'aberto';
	})
		.slice(-10)
		.reverse();
	if (fechados.length) {
		out.push('ULTIMOS DECIDIDOS:');
		fechados.forEach(function (r) {
			out.push(tmRevLinha(r) + (r.reviewer ? `\n     por "${r.reviewer}"` : ''));
		});
	}
	const rev = tmNativeTeam('reviewer');
	const quem = rev && rev.agents && rev.agents[0] ? rev.agents[0] : '';
	out.push('');
	out.push(
		quem
			? `Revisor de plantao: "${quem}".`
			: 'ATENCAO: nenhum agente esta na equipe "Integrador Revisor". Os pedidos ficam abertos ate alguem entrar la com team_join.',
	);
	return out.join('\n');
}

function tmEhRevisor(nome) {
	const t = typeof tmAgentTeam === 'function' ? tmAgentTeam(nome) : null;
	return !!(t && t.caps && t.caps.review);
}

function tmReviewsSelfCheck() {
	const p = [],
		vistos = {};
	try {
		tmReviews().forEach(function (r) {
			if (!r || !r.id) {
				p.push('pedido de revisao sem identificador');
				return;
			}
			if (vistos[String(r.id).toLowerCase()])
				p.push('dois pedidos com o mesmo identificador: ' + r.id);
			vistos[String(r.id).toLowerCase()] = 1;
			if (!TM_REVIEW_STATUS[r.status])
				p.push(`pedido #${r.num} com situacao invalida: ${r.status}`);
			if (!Array.isArray(r.files) || !r.files.length) p.push(`pedido #${r.num} sem arquivo`);
			if (r.status !== 'aberto' && !r.decidedAt)
				p.push(`pedido #${r.num} decidido sem data da decisao`);
			if (r.status === 'aberto' && r.reviewer)
				p.push(`pedido #${r.num} esta aberto mas ja tem revisor gravado`);
		});
		if (tmReviews().length > TM_REVIEW_LIMITS.historico)
			p.push('historico de revisoes acima do teto: ' + tmReviews().length);
		const rev = tmNativeTeam('reviewer');
		if (rev && !rev.caps.review)
			p.push('a equipe nativa do Revisor perdeu a capacidade de revisar');
		if (rev && rev.maxAgents !== 1) p.push('a equipe do Revisor deixou de ser de UM agente');
	} catch (e) {
		p.push('excecao no selfcheck de revisoes: ' + ((e && e.message) || e));
	}
	return p;
}

const TM_REVIEW_TOOLS = [
	{
		name: 'review_submit',
		title: 'Pedir revisao de integracao',
		desc:
			'Terminou uma tarefa? Mande aqui os arquivos que voce ALTEROU para o Integrador Revisor ' +
			'conferir compatibilidade e dependencias. Use sempre que fechar um bloco de trabalho, ' +
			'principalmente se outros arquivos do projeto usam o que voce mexeu. So aceita arquivos ' +
			'da SUA equipe.',
		schema: {
			type: 'object',
			properties: {
				files: {
					type: 'array',
					items: { type: 'string' },
					description: 'Caminhos dos arquivos alterados (max. 200)',
				},
				path: { type: 'string', description: 'Atalho: um unico arquivo' },
				note: {
					type: 'string',
					description: 'O que voce mudou, em uma ou duas frases - o revisor le isso',
				},
				agent: MCP_AGENT_PROP,
				project: MCP_PROJECT_PROP,
			},
			required: [],
		},
		run: async (a) => {
			const nome = agName(a);
			if (!nome)
				throw new Error(
					'Diga quem voce e: informe o parametro agent (o mesmo nome que voce usa nas outras chamadas).',
				);
			const listaFiles =
				a && a.files != null && !(Array.isArray(a.files) && !a.files.length) ? a.files : null;
			const lista = tmPathsArg({
				paths: listaFiles != null ? listaFiles : (a && a.paths) || null,
				path: (a && a.path) || null,
			});
			if (!lista.length)
				throw new Error('Informe os arquivos alterados em files (ou um unico em path).');
			if (lista.length > TM_REVIEW_LIMITS.arquivos)
				throw new Error(
					`Maximo de ${TM_REVIEW_LIMITS.arquivos} arquivos por pedido. Divida em pedidos menores por assunto.`,
				);
			const ruins = lista
				.map(function (p) {
					return { p: p, erro: tmPathValid(p) };
				})
				.filter(function (x) {
					return x.erro;
				});
			if (ruins.length) throw new Error(`Caminho invalido: ${ruins[0].p} (${ruins[0].erro})`);
			const time = typeof tmAgentTeam === 'function' ? tmAgentTeam(nome) : null;
			if (tmTeamMode() !== 'off') {
				if (!time)
					throw new Error(
						'Voce nao esta em equipe nenhuma, entao nao tem alteracao sua para revisar. Entre na sua equipe com team_join.',
					);
				const fora = [];
				lista.forEach(function (p) {
					const v = tmTeamCanWrite(time, p);
					if (!v.ok) fora.push(p + ' -> ' + v.motivo);
				});
				if (fora.length)
					throw new Error(
						'Voce so pode pedir revisao de arquivos que a SUA equipe pode alterar. Fora da sua equipe (' +
							fora.length +
							'):\n- ' +
							fora.slice(0, 6).join('\n- ') +
							(fora.length > 6 ? `\n- (+${fora.length - 6} outros)` : ''),
					);
			}
			const proj = agProjQuiet(a);
			const r = {
				id: tmReviewId(),
				num: tmReviewNum(),
				at: tmNow(),
				by: nome,
				team: time ? time.id : '',
				teamName: time ? time.name : '',
				proj: proj ? String(proj.id) : '',
				projName: proj ? String(proj.name || '') : '',
				files: lista,
				nota: String((a && a.note) || '').slice(0, TM_REVIEW_LIMITS.nota),
				status: 'aberto',
				reviewer: '',
				parecer: '',
				problemas: [],
				decidedAt: 0,
			};
			tmReviews().push(r);
			tmReviewsSane();
			const salvo = tmReviewFind(r.id);
			if (!salvo)
				throw new Error(
					'O pedido nao foi registrado: a limpeza do historico recusou os caminhos enviados. Confira os caminhos com list_files e tente de novo.',
				);
			r.num = salvo.num;
			tmTouch();
			tmAgSave();
			tmAudit('review-open', {
				pedido: r.num,
				por: nome,
				equipe: r.teamName,
				arquivos: lista.length,
			});
			const R = tmReviewRisco(proj, lista, nome, r.id);
			const cruz = R.cruzados.filter(function (c) {
				return c.outraEquipe;
			}).length;
			const rev = tmNativeTeam('reviewer');
			const quem = rev && rev.agents && rev.agents[0] ? rev.agents[0] : '';
			return (
				'Pedido de revisao #' +
				r.num +
				' aberto com ' +
				lista.length +
				' arquivo(s).\n' +
				'Levantamento automatico: ' +
				R.cruzados.length +
				' arquivo(s) do projeto usam o que voce mexeu (' +
				cruz +
				' de outra equipe), ' +
				R.quebrados.length +
				' import quebrado, ' +
				R.duplicados.length +
				' arquivo(s) em outro pedido aberto.\n' +
				(R.travados.length
					? `Voce ainda tem ${R.travados.length} desses arquivos travados - solte com file_unlock para o revisor poder ler.\n`
					: '') +
				(quem
					? `O revisor "${quem}" ve o dossie completo com review_get {id:"${r.num}"}.`
					: 'ATENCAO: ainda nao ha agente na equipe "Integrador Revisor". Avise o usuario: o pedido fica aberto ate alguem entrar la.')
			);
		},
	},

	{
		name: 'review_list',
		title: 'Ver pedidos de revisao',
		desc: 'Lista os pedidos de revisao abertos e os ultimos decididos, com quem pediu, de que equipe e quantos arquivos. Qualquer agente pode consultar.',
		schema: {
			type: 'object',
			properties: {
				status: {
					type: 'string',
					enum: ['aberto', 'aprovado', 'reprovado', 'cancelado', 'todos'],
					description: 'Filtro (padrao: resumo com abertos + ultimos decididos)',
				},
				agent: MCP_AGENT_PROP,
				project: MCP_PROJECT_PROP,
			},
			required: [],
		},
		run: async (a) => {
			const f = String((a && a.status) || '').trim();
			if (!f || f === 'todos') return tmReviewsReport();
			const L = tmReviews().filter(function (r) {
				return r.status === f;
			});
			if (!L.length) return `Nenhum pedido com a situacao "${f}".`;
			return L.length + ' pedido(s) "' + f + '":\n' + L.map(tmRevLinha).join('\n');
		},
	},

	{
		name: 'review_get',
		title: 'Abrir um pedido de revisao',
		desc:
			'Mostra o dossie completo de um pedido: arquivos alterados, quem no projeto depende ' +
			'deles (e de que equipe), imports quebrados, arquivos ainda travados e conflito com ' +
			'outros pedidos. E isto que o Integrador Revisor le antes de aprovar.',
		schema: {
			type: 'object',
			properties: {
				id: { type: 'string', description: 'Numero do pedido (ex.: "3") ou o id completo' },
				agent: MCP_AGENT_PROP,
				project: MCP_PROJECT_PROP,
			},
			required: ['id'],
		},
		run: async (a) => {
			const r = tmReviewFind(a && a.id);
			if (!r)
				throw new Error(
					`Nao achei o pedido "${String((a && a.id) || '')}". Veja os numeros com review_list.`,
				);
			let proj = agProjQuiet(a);
			if (proj && r.proj && String(proj.id) !== r.proj) proj = null;
			if (proj && !r.proj) proj = null;
			if (!proj && r.proj) {
				try {
					proj =
						(State.projects || []).filter(function (p) {
							return String(p.id) === r.proj;
						})[0] || null;
				} catch (e) {
					proj = null;
				}
			}
			return tmReviewDossie(r, proj);
		},
	},

	{
		name: 'review_decide',
		title: 'Aprovar ou reprovar (so o Revisor)',
		desc:
			'Registra a decisao do Integrador Revisor sobre um pedido: aprovado ou reprovado, com o ' +
			'parecer e a lista de problemas encontrados. Somente o agente registrado na equipe ' +
			'nativa "Integrador Revisor" pode usar.',
		schema: {
			type: 'object',
			properties: {
				id: { type: 'string', description: 'Numero do pedido ou id completo' },
				decision: {
					type: 'string',
					enum: ['aprovado', 'reprovado'],
					description: 'aprovado = compativel, pode seguir; reprovado = quebra algo',
				},
				parecer: { type: 'string', description: 'Explique a decisao: o que conferiu e por que' },
				problems: {
					type: 'array',
					items: { type: 'string' },
					description: 'Problemas encontrados, um por item (obrigatorio quando reprovar)',
				},
				agent: MCP_AGENT_PROP,
				project: MCP_PROJECT_PROP,
			},
			required: ['id', 'decision'],
		},
		run: async (a) => {
			const nome = agName(a);
			if (!nome) throw new Error('Informe o parametro agent.');
			if (!tmEhRevisor(nome)) {
				const rev = tmNativeTeam('reviewer');
				const quem = rev && rev.agents && rev.agents[0] ? rev.agents[0] : '';
				tmAudit('review-deny', { quem: nome, motivo: 'nao e o revisor' });
				throw new Error(
					'So o agente da equipe nativa "Integrador Revisor" decide pedidos de revisao.' +
						(quem
							? ` Hoje quem esta la e "${quem}".`
							: ' Ninguem esta nessa equipe ainda: peca ao usuario para colocar um agente la.') +
						' Voce pode ler o dossie com review_get e comentar por post_message, mas nao aprovar.',
				);
			}
			const r = tmReviewFind(a && a.id);
			if (!r) throw new Error(`Nao achei o pedido "${String((a && a.id) || '')}".`);
			if (r.status !== 'aberto')
				throw new Error(
					'O pedido #' +
						r.num +
						' ja foi ' +
						r.status +
						(r.reviewer ? ` por "${r.reviewer}"` : '') +
						'. Um pedido so e decidido uma vez: peca um pedido novo se houve alteracao depois.',
				);
			const d = String((a && a.decision) || '')
				.trim()
				.toLowerCase();
			if (d !== 'aprovado' && d !== 'reprovado')
				throw new Error('decision deve ser "aprovado" ou "reprovado".');
			const problemas = (Array.isArray(a && a.problems) ? a.problems : [])
				.map(function (x) {
					return String(x).slice(0, 300);
				})
				.filter(Boolean)
				.slice(0, TM_REVIEW_LIMITS.problemas);
			const parecer = String((a && a.parecer) || '').slice(0, TM_REVIEW_LIMITS.parecer);
			if (d === 'reprovado' && !problemas.length && !parecer.trim())
				throw new Error(
					'Para reprovar, diga o que esta errado: preencha problems (um problema por item) ou pelo menos o parecer. Quem pediu precisa saber o que consertar.',
				);
			r.status = d;
			r.reviewer = nome;
			r.parecer = parecer;
			r.problemas = problemas;
			r.decidedAt = tmNow();
			tmTouch();
			tmAgSave();
			tmAudit('review-decide', {
				pedido: r.num,
				decisao: d,
				revisor: nome,
				problemas: problemas.length,
			});
			return (
				'Pedido #' +
				r.num +
				' marcado como ' +
				d.toUpperCase() +
				'.' +
				(d === 'reprovado'
					? `\nQuem pediu ("${r.by}") precisa corrigir ${problemas.length || 'os'} problema(s) e abrir um \
pedido novo. Avise por post_message se for urgente.\nVoce tambem pode corrigir voce mesmo: a equipe \
do Revisor escreve em qualquer arquivo (ADR-0039).`
					: `\nCompatibilidade conferida. A equipe "${r.teamName || '?'}" pode seguir.`)
			);
		},
	},

	{
		name: 'review_cancel',
		title: 'Cancelar um pedido seu',
		desc: 'Cancela um pedido de revisao que voce mesmo abriu e que ainda nao foi decidido (por exemplo: voce percebeu que faltava alterar mais um arquivo). O Revisor tambem pode cancelar.',
		schema: {
			type: 'object',
			properties: {
				id: { type: 'string' },
				reason: { type: 'string', description: 'Motivo curto' },
				agent: MCP_AGENT_PROP,
				project: MCP_PROJECT_PROP,
			},
			required: ['id'],
		},
		run: async (a) => {
			const nome = agName(a);
			if (!nome)
				throw new Error(
					'Informe o parametro agent (seu nome). So o autor do pedido ou o Integrador Revisor podem cancelar.',
				);
			const r = tmReviewFind(a && a.id);
			if (!r) throw new Error(`Nao achei o pedido "${String((a && a.id) || '')}".`);
			if (r.status !== 'aberto')
				throw new Error(`O pedido #${r.num} ja foi ${r.status}: nao da para cancelar.`);
			if (tmAgKey(r.by) !== tmAgKey(nome) && !tmEhRevisor(nome))
				throw new Error(`Voce so cancela pedido seu. O #${r.num} e de "${r.by}".`);
			r.status = 'cancelado';
			r.reviewer = '';
			r.decidedAt = tmNow();
			r.parecer = String((a && a.reason) || `cancelado por "${nome || '?'}"`).slice(
				0,
				TM_REVIEW_LIMITS.parecer,
			);
			tmTouch();
			tmAgSave();
			tmAudit('review-cancel', { pedido: r.num, por: nome });
			return `Pedido #${r.num} cancelado.`;
		},
	},

	{
		name: 'review_deps',
		title: 'Quem depende deste arquivo',
		desc: 'Antes de mexer em um arquivo, veja quem no projeto importa ele (e de que equipe) e de quem ele depende. Serve para nao quebrar o trabalho de outra equipe sem perceber. Qualquer agente pode usar.',
		schema: {
			type: 'object',
			properties: {
				path: { type: 'string', description: 'Caminho do arquivo' },
				refresh: {
					type: 'boolean',
					description: 'Reler o projeto do zero em vez de usar a leitura recente',
				},
				agent: MCP_AGENT_PROP,
				project: MCP_PROJECT_PROP,
			},
			required: ['path'],
		},
		run: async (a) => {
			const proj = mcpProj(a),
				p = tmNormPath(a && a.path);
			if (!p) throw new Error('Informe o caminho em path.');
			if (a && a.refresh) tmDepInvalida(proj.id);
			const g = tmDepGrafo(proj),
				real = tmDepReal(proj, p);
			if (!real)
				return `O arquivo "${p}" nao existe no projeto "${proj.name}". Confira o caminho com list_files.`;
			const usam = g.dependentes[real] || [],
				usa = g.deps[real] || [];
			const donoI = tmDonoInfo(real),
				dono = donoI ? donoI.name : '';
			const L = [real + (dono ? `   dono: equipe "${dono}"` : '   [sem dono]'), ''];
			L.push(`QUEM USA ESTE ARQUIVO (${usam.length}):`);
			if (!usam.length)
				L.push(
					g.parcial
						? `  nenhum ENTRE OS ARQUIVOS LIDOS. O projeto passou de ${TM_REVIEW_LIMITS.grafoMax} arquivos: isto NAO prova que ninguem usa.`
						: '  ninguem importa ele. Alterar aqui nao quebra outro arquivo por dependencia direta.',
				);
			usam.slice(0, 60).forEach(function (d) {
				const dI = tmDonoInfo(d),
					dn = dI ? dI.name : '';
				const outra =
					(!!dI && !!donoI && dI.id !== donoI.id) || (!!dI && !donoI) || (!dI && !!donoI);
				L.push(
					'  ' +
						d +
						(dn
							? `   (equipe "${dn}"${outra ? ' - OUTRA EQUIPE' : ''})`
							: `   (sem dono${outra ? ' - FORA DA SUA EQUIPE' : ''})`),
				);
			});
			if (usam.length > 60) L.push(`  (+${usam.length - 60} outros)`);
			L.push('');
			L.push(`DO QUE ELE DEPENDE (${usa.length}):`);
			if (!usa.length)
				L.push(
					tmDepLido(g, real)
						? '  nada dentro do projeto.'
						: '  este arquivo NAO foi lido pelo motor (projeto grande, binario ou tipo sem imports): a lista esta vazia por falta de leitura, nao por falta de dependencia.',
				);
			usa.slice(0, 60).forEach(function (d) {
				const dn = tmDonoNome(d);
				L.push('  ' + d + (dn ? `   (equipe "${dn}")` : ''));
			});
			const meus = g.quebrados.filter(function (q) {
				return q.de === real;
			});
			if (meus.length) {
				L.push('');
				L.push(`IMPORTS QUEBRADOS NESTE ARQUIVO (${meus.length}):`);
				meus.slice(0, 15).forEach(function (q) {
					L.push(`  "${q.ref}" nao existe (${q.esperado})`);
				});
			}
			if (g.parcial)
				L.push(`\nOBS: projeto grande - li os primeiros ${TM_REVIEW_LIMITS.grafoMax} arquivos.`);
			return L.join('\n');
		},
	},
];
