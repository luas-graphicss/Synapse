'use strict';
function forgeSrc() {
	if (typeof window !== 'undefined' && typeof window.AURORA_FORGE_SRC === 'string')
		return window.AURORA_FORGE_SRC;
	const el = document.getElementById('aurora-forge-src');
	if (!el)
		throw new Error('Biblioteca AuroraForge nao encontrada (bloco aurora-forge-src ausente).');
	return el.textContent;
}
const FORGE = { api: null };
function forgeApi() {
	if (FORGE.api) return FORGE.api;
	const exportado = compilarModuloIsolado(forgeSrc(), 'AuroraForge');
	const temApiPropria = exportado && exportado.mesh;
	const globalDisponivel = typeof AuroraForge !== 'undefined' ? AuroraForge : exportado;
	FORGE.api = temApiPropria ? exportado : globalDisponivel;
	return FORGE.api;
}
function forgeSlug(x) {
	x = String(x || '')
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9_-]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60);
	return x || 'asset';
}
function __forgeWorkerMain() {
	self.onmessage = async function (ev) {
		const logs = [];
		function push() {
			if (logs.length >= 80) return;
			let parts = [],
				i,
				x,
				st;
			for (i = 0; i < arguments.length; i++) {
				x = arguments[i];
				try {
					st = typeof x === 'string' ? x : JSON.stringify(x);
				} catch (e) {
					st = String(x);
				}
				parts.push(st);
			}
			logs.push(String(parts.join(' ')).slice(0, 400));
		}
		console.log = push;
		console.warn = push;
		console.error = push;
		const F = self.AuroraForge;
		F.log = push;
		try {
			const code = String((ev.data && ev.data.code) || '');
			const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
			const fn = new AsyncFn('F', 'log', '"use strict";\n' + code);
			let res = await fn(F, push);
			if (res && res.__isMesh) {
				const mw = F.model({ name: res.name || 'asset' });
				mw.add(res);
				res = mw;
			}
			const outs = [];
			if (res && res.__isModel) outs.push({ path: '', model: res });
			else if (res && typeof res === 'object' && !Array.isArray(res)) {
				for (let k in res) {
					let v = res[k];
					if (v && v.__isMesh) {
						const m2 = F.model({ name: v.name || k });
						m2.add(v);
						v = m2;
					}
					if (v && v.__isModel) outs.push({ path: k, model: v });
				}
			}
			if (!outs.length)
				throw new Error(
					'O code deve terminar com "return model" (crie com F.model e model.add(mesh, material)) ou um objeto {"assets/x.glb": model}. Recebi: ' +
						(res === undefined ? 'undefined - faltou o return no final' : typeof res),
				);
			const files = [],
				reports = [],
				transfer = [];
			for (let i2 = 0; i2 < outs.length; i2++) {
				const bytes = F.toGLB(outs[i2].model);
				files.push({
					path: outs[i2].path,
					bytes: bytes.buffer,
					len: bytes.length,
					name: outs[i2].model.name || 'asset',
				});
				reports.push({ path: outs[i2].path, report: F.report(outs[i2].model) });
				transfer.push(bytes.buffer);
			}
			self.postMessage({ ok: true, files: files, reports: reports, logs: logs }, transfer);
		} catch (e) {
			self.postMessage({
				ok: false,
				error: String((e && e.stack) || e).slice(0, 4000),
				logs: logs,
			});
		}
	};
}
function forgeWorkerRun(code, timeoutMs) {
	return new Promise(function (resolve, reject) {
		let url = null,
			w = null,
			done = false,
			timer = null;
		function fim() {
			if (timer) clearTimeout(timer);
			try {
				if (w) w.terminate();
			} catch (e) {
				ignorarErro(e, 'fim');
			}
			try {
				if (url) URL.revokeObjectURL(url);
			} catch (e) {
				ignorarErro(e, 'fim');
			}
		}
		try {
			const runner = `(${__forgeWorkerMain.toString()})();`;
			url = URL.createObjectURL(
				new Blob([forgeSrc(), '\n;\n', runner], { type: 'text/javascript' }),
			);
			w = new Worker(url);
		} catch (e) {
			fim();
			reject(new Error('Nao consegui criar o worker do Forge: ' + ((e && e.message) || e)));
			return;
		}
		timer = setTimeout(function () {
			if (done) return;
			done = true;
			fim();
			reject(
				new Error(
					'Forge: tempo esgotado. Simplifique o code (menos subdivide/CSG/segmentos) ou aumente timeout_s (max 120).',
				),
			);
		}, timeoutMs);
		w.onmessage = function (ev) {
			if (done) return;
			done = true;
			const d = ev.data;
			fim();
			if (d && d.ok) resolve(d);
			else
				reject(
					new Error(
						String((d && d.error) || 'Erro desconhecido no Forge') +
							(d && d.logs && d.logs.length
								? '\n\n[logs do code]\n' + d.logs.join('\n').slice(0, 1500)
								: ''),
					),
				);
		};
		w.onerror = function (ev) {
			if (done) return;
			done = true;
			fim();
			reject(
				new Error('Forge: erro ao iniciar o worker: ' + ((ev && ev.message) || 'desconhecido')),
			);
		};
		try {
			w.postMessage({ code: String(code || '') });
		} catch (e) {
			if (!done) {
				done = true;
				fim();
				reject(new Error('Forge: falha ao enviar o code ao worker: ' + ((e && e.message) || e)));
			}
		}
	});
}
MCP_TOOLS.push(
	{
		name: 'model3d_forge',
		title: 'Estudio 3D: Forge - modelar por codigo',
		desc:
			'MODELAGEM 3D DE VERDADE por codigo (nao e empilhar primitivas): executa seu JavaScript ' +
			'com a biblioteca AuroraForge (F) em sandbox e salva o resultado como .glb no projeto, ' +
			'ja devolvendo a ficha tecnica com IMAGEM (7 vistas + medidas + avisos de validacao) ' +
			'para QA imediato - leia, corrija o code e chame de novo (iterar e barato; sobrescrever ' +
			'cria snapshot). Recursos: lathe/extrude/sweep/loft, CSG, deformadores, selecao com ' +
			'falloff, UVs, texturas procedurais, PBR completo embutido no GLB, RIG (esqueleto livre ' +
			'ou humanoide pronto, pesos automaticos + pintura manual), ANIMACOES por keyframes ' +
			'(clips nomeados no .glb) e SOFTBODY (particulas/molas/pinos em extras). APRENDA ' +
			'PRIMEIRO com a acao docs. Alternativa terminal: install_cli=true instala ' +
			'tools/forge.mjs para rodar com node via run_command.',
		schema: {
			type: 'object',
			properties: {
				code: {
					type: 'string',
					description:
						'Codigo JS executado com F (AuroraForge) e log(). DEVE terminar com return model ' +
						'(F.model + model.add(mesh, material)) ou {"assets/a.glb": modelA, ...}. Exemplo minimo: ' +
						'const m=F.model({name:"barril"}); m.add(F.lathe([[0,0],[0.3,0],[0.36,0.45],[0.3,0.9],[0,' +
						'0.9]],{seg:36}), F.material({baseColor:"#8a6a45",roughness:0.85})); m.alignBottom(0); ' +
						'return m;',
				},
				path: {
					type: 'string',
					description:
						'Caminho do .glb de saida. Padrao: assets/forge/{name}.glb. Sobrescrever cria snapshot automatico.',
				},
				name: { type: 'string', description: 'Nome do asset para o caminho padrao.' },
				inspect: {
					type: 'boolean',
					description: 'Anexar a ficha tecnica com imagem do resultado (padrao true).',
				},
				unit: { type: 'string', description: 'Unidade exibida na ficha (padrao m).' },
				timeout_s: {
					type: 'number',
					description: 'Limite de execucao do code em segundos (padrao 20, max 120).',
				},
				install_cli: {
					type: 'boolean',
					description:
						'Nao executa code: instala tools/forge.mjs (biblioteca ESM) + tools/forge-exemplo.mjs para uso via terminal Node (run_command).',
				},
				agent: MCP_AGENT_PROP,
				project: MCP_PROJECT_PROP,
			},
			required: [],
		},
		run: async (a) => {
			const proj = mcpProj(a);
			if (a && a.install_cli) {
				const lib = forgeSrc() + '\nexport default AuroraForge;\nexport{AuroraForge};\n';
				const demo = [
					'// AuroraForge pelo terminal (Node). Rode: run_command {command:"node tools/forge-exemplo.mjs"}',
					'// O .glb e gravado em assets/forge/ dentro do projeto (relay local).',
					'import F from "./forge.mjs";',
					'import fs from "node:fs";',
					'const m=F.model({name:"caneca"});',
					'const corpo=F.lathe([[0,0],[0.038,0],[0.04,0.002],[0.04,0.09],[0.036,0.095],[0.034,0.09],[0.034,0.01],[0,0.008]],{seg:48});',
					'm.add(corpo,F.material({name:"ceramica",baseColor:"#e8e2d8",roughness:0.35}));',
					'm.alignBottom(0);',
					'console.log(F.report(m));',
					'const glb=F.toGLB(m);',
					'fs.mkdirSync("assets/forge",{recursive:true});',
					'fs.writeFileSync("assets/forge/caneca.glb",glb);',
					'console.log("salvo: assets/forge/caneca.glb ("+glb.length+" bytes)");',
				].join('\n');
				const alvo = [
					['tools/forge.mjs', lib],
					['tools/forge-exemplo.mjs', demo],
				];
				for (const par of alvo) {
					const p = par[0],
						txt = par[1];
					let f = proj.files.get(p);
					if (f) {
						if (!f.isText || f.text == null)
							throw new Error(`Ja existe um arquivo binario em ${p} - apague-o antes.`);
						mcpHist(f);
						f.text = txt;
						f.data = null;
					} else {
						f = newFileEntry(p);
						f.isText = true;
						f.text = txt;
						f.data = null;
						f.history = [{ t: Date.now(), text: txt }];
						proj.files.set(p, f);
					}
					mcpAfterWrite(proj, p);
				}
				return `Forge CLI instalado no projeto ${proj.name}:\n- tools/forge.mjs (${mvSize(lib.length)}, \
biblioteca completa em ESM)\n- tools/forge-exemplo.mjs (exemplo pronto)\n\nTerminal: run_command {command:"node \
tools/forge-exemplo.mjs"} gera assets/forge/caneca.glb; confira com model3d {action:"inspect"}.\nO runtime \
garantido do relay e Node (nao ha Python embutido). Manual da API: model3d {action:"docs"}.`;
			}
			const code = String((a && a.code) || '');
			if (!code.trim())
				throw new Error(
					'Informe code (JS que termina com return model) - ou install_cli:true para o fluxo terminal. Aprenda a API com model3d {action:"docs"}.',
				);
			const tSec = Math.min(120, Math.max(3, Number(a && a.timeout_s) || 20));
			const res = await forgeWorkerRun(code, tSec * 1000);
			const saved = [];
			const seen = new Set();
			for (const it of res.files) {
				let p = String(it.path || '').trim();
				if (!p) p = String((a && a.path) || '').trim();
				if (!p) p = `assets/forge/${forgeSlug((a && a.name) || it.name)}.glb`;
				p = mcpNorm(p);
				if (!/\.glb$/i.test(p)) p += '.glb';
				if (!validRelPath(p)) throw new Error('Caminho invalido: ' + p);
				if (seen.has(p))
					throw new Error(
						`Dois modelos com o mesmo caminho: ${p} - use chaves diferentes no objeto retornado.`,
					);
				seen.add(p);
				const bytes = new Uint8Array(it.bytes);
				const existed = proj.files.has(p);
				if (existed) {
					try {
						makeSnapshot(proj, 'forge: antes de sobrescrever ' + p);
					} catch (e) {
						ignorarErro(e, 'run');
					}
				}
				const f = makeFileEntry(p, bytes);
				proj.files.set(p, f);
				mcpAfterWrite(proj, p);
				saved.push({ path: p, len: bytes.length, existed: existed });
			}
			let txt = '';
			for (const sv of saved)
				txt +=
					(sv.existed ? 'Sobrescrito (snapshot criado): ' : 'Salvo: ') +
					sv.path +
					' (' +
					mvSize(sv.len) +
					')\n';
			for (const r of res.reports) txt += `\n${r.report}\n`;
			if (res.logs && res.logs.length)
				txt += `\n[logs do code]\n${String(res.logs.join('\n')).slice(0, 2000)}\n`;
			txt +=
				'\nItere: ajuste o code e chame de novo no mesmo path (sobrescreve com snapshot). A ficha mostra geometria e medidas; texturas/PBR vao embutidas no GLB (nao aparecem na ficha).';
			if (a && a.inspect === false) return txt;
			try {
				try {
					est3dStud(proj, { path: saved[0].path });
				} catch (e) {
					ignorarErro(e, 'run');
				}
				const sheet = est3dRenderSheet(proj, saved[0].path, { unit: (a && a.unit) || undefined });
				return est3dContent(sheet, txt + '\n' + est3dText(sheet));
			} catch (e) {
				return (
					txt +
					'\n(Ficha visual indisponivel agora: ' +
					String((e && e.message) || e) +
					' - tente model3d {action:"inspect", path:"' +
					saved[0].path +
					'"}.)'
				);
			}
		},
	},
	{
		name: 'model3d_docs',
		title: 'Estudio 3D: manual do AuroraForge',
		desc:
			'Manual da biblioteca de modelagem 3D por codigo (usada pela acao forge). Sem topic: ' +
			'visao geral + indice + fluxo de trabalho. topic aceita: fluxo, mesh, editar, csg, uv, ' +
			'textura, material, rig, animacao, softbody, exportar, validar, terminal, exemplos (5 ' +
			'assets completos passo a passo, incluindo boneco riggado com animacao e bandeira ' +
			'softbody).',
		schema: {
			type: 'object',
			properties: {
				topic: {
					type: 'string',
					description: 'Topico do manual (ex.: exemplos). Vazio = indice + fluxo.',
				},
				agent: MCP_AGENT_PROP,
				project: MCP_PROJECT_PROP,
			},
			required: [],
		},
		run: async (a) => {
			return forgeApi().docs((a && a.topic) || '');
		},
	},
);

MCP_TOOLS.push(
	{
		name: 'team_join',
		title: 'Entrar em uma equipe',
		desc:
			'Registra VOCE (parametro agent) em uma equipe de trabalho do site e devolve as regras ' +
			'dela. Havendo equipes ativas, so agente registrado altera arquivos: sem equipe voce le ' +
			'tudo mas nao grava nada. Entrar e definitivo - so sai se o usuario liberar a saida. Use ' +
			'quando o usuario disser algo como "entre na equipe Fisica e se registre ali".',
		schema: {
			type: 'object',
			properties: {
				team: {
					type: 'string',
					description: 'Nome da equipe, exatamente como o usuario falou (aceita tambem o id)',
				},
				agent: MCP_AGENT_PROP,
				project: MCP_PROJECT_PROP,
			},
			required: ['team'],
		},
		run: async (a) => {
			const r = tmAgentJoin(agName(a), a && a.team);
			try {
				mcpRenderAgents();
			} catch (e) {
				ignorarErro(e, 'run');
			}
			return r.mensagem;
		},
	},
	{
		name: 'team_status',
		title: 'Minha equipe e minhas permissoes',
		desc:
			'Mostra em qual equipe voce esta, o que pode alterar, quem sao os colegas, as outras ' +
			'equipes e o modo do regime. Com path, diz de quem e aquele arquivo e se VOCE pode ' +
			'altera-lo - consulte ANTES de gravar em algo novo.',
		schema: {
			type: 'object',
			properties: {
				path: {
					type: 'string',
					description: 'Opcional: caminho relativo para checar a posse (ex.: src/fisica/agua.js)',
				},
				agent: MCP_AGENT_PROP,
				project: MCP_PROJECT_PROP,
			},
			required: [],
		},
		run: async (a) => {
			const p = tmAdminProj(a);
			return tmAgentStatus(agName(a), a && a.path ? a.path : '', p ? p.id : '');
		},
	},
	{
		name: 'team_list',
		title: 'Listar equipes e agentes',
		desc: 'Lista as equipes do projeto, os arquivos/pastas de cada uma, os agentes registrados e se a saida esta liberada. Com all=true mostra as equipes de todos os projetos.',
		schema: {
			type: 'object',
			properties: {
				all: {
					type: 'boolean',
					description: 'Mostrar tambem as equipes dos outros projetos (padrao: so o projeto atual)',
				},
				agent: MCP_AGENT_PROP,
				project: MCP_PROJECT_PROP,
			},
			required: [],
		},
		run: async (a) => {
			tmAgentsSync();
			const _pj = tmAdminProj(a);
			const pid = _pj ? String(_pj.id) : '';
			const todas = tmTeams();
			const ts =
				pid && !(a && a.all)
					? todas.filter(function (t) {
							return !tmTeamProj(t) || tmTeamProj(t) === pid;
						})
					: todas;
			if (!todas.length)
				return 'Nenhuma equipe criada ainda. O agente Gerenciador cria com team_create, ou o usuario cria no painel de Equipes.';
			if (!ts.length)
				return `Nenhuma equipe no projeto "${_pj ? _pj.name : ''}" ainda (existem ${todas.length} em outros projetos - veja com all=true). O Gerenciador cria com team_create.`;
			const L = [
				`Regime de Equipes: ${tmTeamMode()} (off = nada bloqueado, shadow = so auditoria, on = posse obrigatoria)`,
			];
			if (pid && !(a && a.all))
				L.push(
					`Projeto: "${_pj ? _pj.name : ''}" (${ts.length} de ${todas.length} equipes; use all=true para ver as outras)`,
				);
			ts.forEach(function (t) {
				L.push('');
				L.push(
					'- Equipe "' +
						t.name +
						'"' +
						(t.native ? ' [nativa]' : '') +
						' - projeto: ' +
						(tmTeamProj(t) ? `"${tmTeamProjNome(t)}"` : '(qualquer)') +
						(t.desc ? ' - ' + t.desc : ''),
				);
				L.push(
					`  agentes: ${(t.agents || []).join(', ') || '(nenhum)'}${t.maxAgents ? ' - maximo ' + t.maxAgents : ''}`,
				);
				L.push(
					`  pode alterar: ${t.caps.writeAny ? 'qualquer arquivo do projeto' : (t.files || []).length + (t.dirs || []).length ? tmTeamAlvos(t) : '(nada ainda)'}${t.caps.writeOwnerless && !t.caps.writeAny ? ' + arquivos sem dono' : ''}`,
				);
				L.push('  saida liberada: ' + (t.allowLeave ? 'sim' : 'nao'));
			});
			L.push('');
			L.push(
				'Regra geral: ler qualquer arquivo e sempre permitido; alterar, so os caminhos da sua equipe.',
			);
			L.push(
				`Arquivos GLOBAIS deste projeto (sem dono, qualquer equipe altera): ${tmGlobalsTxt(pid)}.`,
			);
			return L.join('\n');
		},
	},
	{
		name: 'team_leave',
		title: 'Sair da equipe',
		desc: 'Sai da sua equipe atual. So funciona se o usuario tiver ativado "permitir agente sair dessa equipe". Sem equipe voce nao consegue alterar nada.',
		schema: {
			type: 'object',
			properties: { agent: MCP_AGENT_PROP, project: MCP_PROJECT_PROP },
			required: [],
		},
		run: async (a) => {
			const r = tmAgentLeave(agName(a));
			try {
				mcpRenderAgents();
			} catch (e) {
				ignorarErro(e, 'run');
			}
			return r.mensagem;
		},
	},
	{
		name: 'team_enlist',
		title: 'Alistar-se (o site escolhe a equipe)',
		desc:
			'Nao sabe em qual equipe entrar? Aliste-se. O site te coloca NA HORA na equipe que mais ' +
			'precisa de gente, seguindo a regra de distribuicao que o usuario configurou no painel, ' +
			'e te da um nome novo com o nome dessa equipe (ex.: agente-fisica; espaco no nome da ' +
			'equipe vira -). Ninguem fica esperando em fila: a resposta ja vem com a equipe, o SEU ' +
			'NOVO NOME e as regras. A partir dai use SEMPRE agent="{nome devolvido}". Se voce ja ' +
			'estiver em uma equipe, nada muda.',
		schema: {
			type: 'object',
			properties: { agent: MCP_AGENT_PROP, project: MCP_PROJECT_PROP },
			required: [],
		},
		run: async (a) => {
			const p = tmAdminProj(a);
			const r = tmEnlist({ nome: agName(a), proj: p ? p.id : '', projNome: p ? p.name : '' });
			try {
				mcpRenderAgents();
			} catch (e) {
				ignorarErro(e, 'run');
			}
			try {
				tmUIRenderIdle();
			} catch (e) {
				ignorarErro(e, 'run');
			}
			return r.mensagem;
		},
	},
);

function tmRequirePlanner(nome, acao) {
	const n = tmAgNome(nome);
	const pl = tmNativeTeam('planner');
	const nomeP = (pl && pl.name) || 'Planejador / Divisor';
	if (!n)
		throw new Error(
			`Informe agent="seu-nome": so o agente da equipe nativa "${nomeP}" pode ${acao}.`,
		);
	tmAgentsSync();
	const t = tmAgentTeam(n);
	if (!t || !t.caps || !t.caps.plan) {
		try {
			tmAudit('planner-deny', { agente: n, acao: acao, equipe: t ? t.name : '' });
		} catch (e) {
			ignorarErro(e, 'tmRequirePlanner');
		}
		throw new Error(
			'So o agente da equipe nativa "' +
				nomeP +
				'" pode ' +
				acao +
				'. Voce ' +
				(t ? `esta na equipe "${t.name}"` : 'nao esta em nenhuma equipe') +
				'. Entre com team_join team="' +
				nomeP +
				'" (a vaga e unica) se o usuario quiser que VOCE planeje e divida o sistema.',
		);
	}
	return t;
}
function tmPlanDossie(a) {
	const p = tmAdminProj(a);
	const pid = p ? String(p.id) : '';
	const L = [];
	L.push(
		'DOSSIE DE PLANEJAMENTO' +
			(p ? ` - projeto "${p.name}"` : ' - (nenhum projeto informado: passe project="nome")'),
	);
	L.push(`Regime de Equipes: ${tmTeamMode()}.`);
	const todas = tmTeams();
	const ts = pid
		? todas.filter(function (t) {
				return !tmTeamProj(t) || tmTeamProj(t) === pid;
			})
		: todas;
	L.push('');
	L.push(`EQUIPES QUE VOCE PODE ACIONAR (${ts.length}):`);
	if (!ts.length)
		L.push(
			'  (nenhuma equipe ainda - peca ao usuario ou ao Gerenciador para criar as equipes antes de dividir o sistema)',
		);
	ts.forEach(function (t) {
		const vagas = t.maxAgents ? Math.max(0, t.maxAgents - (t.agents || []).length) : null;
		L.push(
			'  - "' +
				t.name +
				'"' +
				(t.native ? ` [nativa: ${t.native}]` : '') +
				(t.desc ? ' - ' + t.desc : ''),
		);
		L.push(
			`      altera: ${t.caps.writeAny ? 'qualquer arquivo' : t.caps.plan ? 'nada (so planeja)' : (t.files || []).length + (t.dirs || []).length ? tmTeamAlvos(t) : '(nenhum caminho ainda)'}${t.caps.writeOwnerless && !t.caps.writeAny ? ' + arquivos sem dono' : ''}`,
		);
		L.push(
			'      agentes: ' +
				((t.agents || []).join(', ') || '(nenhum)') +
				(t.maxAgents ? ` - maximo ${t.maxAgents}, vagas livres: ${vagas}` : ''),
		);
	});
	L.push('');
	L.push(
		'ARQUIVOS GLOBAIS (qualquer equipe pode alterar - cite no prompt de quem for mexer): ' +
			tmGlobalsTxt(pid),
	);
	const semDono = [];
	try {
		const sets = tmProjSets(p);
		sets.arquivos.forEach(function (k) {
			if (semDono.length >= 40) return;
			if (tmOwnerOf(k, pid)) return;
			if (tmIsGlobal(k, pid)) return;
			semDono.push(k);
		});
	} catch (e) {
		ignorarErro(e, 'tmPlanDossie');
	}
	L.push(
		`ARQUIVOS SEM DONO${semDono.length >= 40 ? ' (primeiros 40)' : ''}: ${semDono.join(', ') || '(nenhum)'}. \
Ninguem alem do Gerenciador e do Integrador Revisor altera esses: se o sistema precisa deles, peca ao \
Gerenciador para dar dono ou torna-los globais ANTES de rodar os prompts.`,
	);
	L.push('');
	L.push(
		'COMO ENTREGAR: um bloco de prompt por equipe, com (1) team_join team="<equipe>"' +
			(p ? ` project="${p.name}"` : '') +
			(' e agent="{nome}", (2) o que construir, (3) os arquivos exatos que ela pode alterar, (4)' +
				' o CONTRATO de API copiado igual em todos os prompts (nomes, parametros, retorno, ' +
				'eventos), (5) o que nao mexer, (6) file_lock/file_unlock.'),
	);
	L.push(
		`FECHAMENTO OBRIGATORIO DE CADA PROMPT: review_submit files=[...] note="..." e depois msg_send team="${(tmNativeTeam('reviewer') || {}).name || 'Integrador Revisor'}" \
com a lista dos arquivos alterados, pedindo revisao JUNTO com os arquivos das outras equipes.`,
	);
	L.push(
		'Lembre o usuario de rodar todos os prompts EM PARALELO: quando as equipes terminarem, o sistema esta feito.',
	);
	return L.join('\n');
}
MCP_TOOLS.push(
	{
		name: 'team_globals',
		title: 'Ver os arquivos globais',
		desc:
			'Lista os ARQUIVOS GLOBAIS do projeto: caminhos sem dono que QUALQUER equipe registrada ' +
			'pode alterar (README, changelog, docs). Qualquer agente pode consultar. Quem define e o ' +
			'agente Gerenciador, com team_global_add / team_global_remove.',
		schema: {
			type: 'object',
			properties: { agent: MCP_AGENT_PROP, project: MCP_PROJECT_PROP },
			required: [],
		},
		run: async (a) => {
			const p = tmAdminProj(a);
			const pid = p ? String(p.id) : '';
			const L = tmGlobalsDo(pid);
			if (!L.length)
				return (
					'Nenhum arquivo global' +
					(p ? ` no projeto "${p.name}"` : '') +
					' ainda. O agente Gerenciador cria com team_global_add paths=["README.md","docs/"]. Arquivo global nao tem dono e qualquer equipe pode altera-lo.'
				);
			return (
				'ARQUIVOS GLOBAIS' +
				(p ? ` do projeto "${p.name}"` : '') +
				' (' +
				L.length +
				') - sem dono, TODAS as equipes podem alterar:\n' +
				L.map(function (g) {
					return `  - ${g.path}${g.dir ? '/ (pasta inteira, inclusive arquivos criados depois)' : ''}`;
				}).join('\n') +
				'\nAvise as outras equipes por msg_send quando mexer em um arquivo global: mais de uma equipe pode estar editando o mesmo arquivo. Use file_lock antes de reescrever.'
			);
		},
	},
	{
		name: 'team_global_add',
		title: 'Tornar arquivos globais (so Gerenciador)',
		desc:
			'Marca caminhos como GLOBAIS: eles deixam de precisar de dono e QUALQUER equipe ' +
			'registrada passa a poder altera-los (README, changelog, docs, notas). Termine com "/" ' +
			'para valer a pasta inteira. Caminho que ja pertence a uma equipe NAO pode virar global: ' +
			'tire dela antes com team_remove_files. So o agente da equipe nativa Gerenciador usa.',
		schema: {
			type: 'object',
			properties: {
				paths: {
					type: 'array',
					items: { type: 'string' },
					description: 'Caminhos que ficam globais (ex.: ["README.md","docs/"])',
				},
				path: { type: 'string', description: 'Um caminho so, se preferir' },
				agent: MCP_AGENT_PROP,
				project: MCP_PROJECT_PROP,
			},
			required: [],
		},
		run: async (a) => {
			tmRequireManager(agName(a), 'definir arquivos globais');
			const p = tmAdminProj(a);
			const r = tmGlobalAdd(tmAdminPaths(a), p ? p.id : '');
			tmAdminSalvar();
			return (
				'Arquivos globais atualizados' +
				(p ? ` no projeto "${p.name}"` : '') +
				': ' +
				(r.adicionados.length
					? r.adicionados
							.map(function (e) {
								return e.path + (e.dir ? '/' : '');
							})
							.join(', ')
					: '(nenhum novo)') +
				(r.jaEram ? ` - ${r.jaEram} ja era(m) global(is)` : '') +
				'.\nAgora QUALQUER equipe registrada pode alterar esses caminhos. Lista completa: ' +
				tmGlobalsTxt(p ? p.id : '') +
				'.\nAvise as equipes por msg_send (sem to e sem team vai para todos) para elas usarem file_lock antes de mexer.'
			);
		},
	},
	{
		name: 'team_global_remove',
		title: 'Tirar arquivos da lista global (so Gerenciador)',
		desc:
			'Tira caminhos da lista de arquivos globais. Eles voltam a ser "sem dono" (so ' +
			'Gerenciador e Integrador Revisor alteram) ate voce dar dono a alguma equipe com ' +
			'team_add_files. So o agente da equipe nativa Gerenciador usa.',
		schema: {
			type: 'object',
			properties: {
				paths: {
					type: 'array',
					items: { type: 'string' },
					description: 'Caminhos que deixam de ser globais',
				},
				path: { type: 'string', description: 'Um caminho so, se preferir' },
				agent: MCP_AGENT_PROP,
				project: MCP_PROJECT_PROP,
			},
			required: [],
		},
		run: async (a) => {
			tmRequireManager(agName(a), 'tirar arquivos da lista global');
			const p = tmAdminProj(a);
			const r = tmGlobalRemove(tmAdminPaths(a), p ? p.id : '');
			tmAdminSalvar();
			return (
				'Removidos da lista global: ' +
				r.removidos +
				' caminho(s)' +
				(r.naoEncontrados.length ? ` (nao estavam na lista: ${r.naoEncontrados.join(', ')})` : '') +
				'.\nGlobais agora: ' +
				tmGlobalsTxt(p ? p.id : '') +
				'.'
			);
		},
	},
	{
		name: 'plan_split',
		title: 'Dossie para planejar e dividir (so Planejador)',
		desc:
			'Devolve, em UMA chamada, tudo que o Planejador / Divisor precisa para dividir um ' +
			'sistema: as equipes do projeto com os arquivos e pastas de cada uma, quantos agentes ' +
			'cabem, os arquivos globais, os arquivos sem dono e o formato do prompt que cada equipe ' +
			'deve receber. So o agente da equipe nativa Planejador / Divisor usa.',
		schema: {
			type: 'object',
			properties: { agent: MCP_AGENT_PROP, project: MCP_PROJECT_PROP },
			required: [],
		},
		run: async (a) => {
			tmRequirePlanner(agName(a), 'usar o dossie de planejamento');
			return tmPlanDossie(a);
		},
	},
);
MCP_TOOLS.push(
	{
		name: 'team_create',
		title: 'Criar equipe (so Gerenciador)',
		desc:
			'Cria uma equipe NO PROJETO informado e ja define os arquivos/pastas que ela pode ' +
			'alterar. Pasta cobre tudo que esta dentro, inclusive arquivos criados depois; o mesmo ' +
			'caminho nao pode pertencer a duas equipes do mesmo projeto. So o agente da equipe ' +
			'nativa Gerenciador usa esta ferramenta.',
		schema: {
			type: 'object',
			properties: {
				name: { type: 'string', description: 'Nome da equipe (ex.: Fisica)' },
				desc: { type: 'string', description: 'Descricao curta do que a equipe cuida' },
				paths: {
					type: 'array',
					items: { type: 'string' },
					description:
						'Arquivos e pastas da equipe (termine com / para forcar pasta). Pode vir vazio e usar team_add_files depois',
				},
				allow_leave: {
					type: 'boolean',
					description: 'Permitir que o agente saia sozinho (padrao: nao)',
				},
				max_agents: {
					type: 'integer',
					minimum: 1,
					description: 'Limite de agentes na equipe (opcional)',
				},
				agent: MCP_AGENT_PROP,
				project: MCP_PROJECT_PROP,
			},
			required: ['name'],
		},
		run: async (a) => {
			tmRequireManager(agName(a), 'criar equipes');
			const p = tmAdminProj(a);
			const t = tmTeamCreate({
				name: a && a.name,
				desc: a && a.desc,
				paths: tmAdminPaths(a),
				proj: p ? p.id : '',
				projName: p ? p.name : '',
			});
			if (a && a.allow_leave) tmTeamAllowLeave(t.id, true);
			if (a && a.max_agents) {
				t.maxAgents = Math.max(1, Math.floor(Number(a.max_agents) || 1));
				try {
					tmTouch();
				} catch (e) {
					ignorarErro(e, 'run');
				}
			}
			tmAdminSalvar();
			const NL = String.fromCharCode(10);
			return (
				'Equipe criada (id ' +
				t.id +
				').' +
				NL +
				tmAdminResumo(t) +
				NL +
				NL +
				'Diga ao agente responsavel: team_join team="' +
				t.name +
				'"' +
				(p ? ` project="${p.name}"` : '') +
				'.'
			);
		},
	},
	{
		name: 'team_add_files',
		title: 'Dar arquivos a uma equipe (so Gerenciador)',
		desc: 'Acrescenta arquivos e pastas ao que uma equipe pode ALTERAR. Recusa a chamada inteira se algum caminho ja pertencer a outra equipe do mesmo projeto.',
		schema: {
			type: 'object',
			properties: {
				team: { type: 'string', description: 'Nome ou id da equipe' },
				paths: {
					type: 'array',
					items: { type: 'string' },
					description: 'Caminhos a dar (termine com / para forcar pasta)',
				},
				path: { type: 'string', description: 'Atalho: um unico caminho' },
				agent: MCP_AGENT_PROP,
				project: MCP_PROJECT_PROP,
			},
			required: ['team'],
		},
		run: async (a) => {
			tmRequireManager(agName(a), 'mudar os arquivos de uma equipe');
			const alvo = tmAdminPaths(a);
			if (!alvo.length)
				throw new Error(
					'Diga quais caminhos dar: paths:["src/fisica","src/agua.js"] ou path:"src/fisica/".',
				);
			tmPathsAdd(a && a.team, alvo);
			const t = tmTeam(a && a.team);
			tmAdminSalvar();
			return `Arquivos atualizados.${String.fromCharCode(10)}${tmAdminResumo(t)}`;
		},
	},
	{
		name: 'team_remove_files',
		title: 'Tirar arquivos de uma equipe (so Gerenciador)',
		desc: 'Tira arquivos ou pastas de uma equipe. O caminho volta a nao ter dono (so Gerenciador e Integrador Revisor alteram) ate ser dado a outra equipe.',
		schema: {
			type: 'object',
			properties: {
				team: { type: 'string', description: 'Nome ou id da equipe' },
				paths: { type: 'array', items: { type: 'string' }, description: 'Caminhos a tirar' },
				path: { type: 'string', description: 'Atalho: um unico caminho' },
				agent: MCP_AGENT_PROP,
				project: MCP_PROJECT_PROP,
			},
			required: ['team'],
		},
		run: async (a) => {
			tmRequireManager(agName(a), 'mudar os arquivos de uma equipe');
			const alvo = tmAdminPaths(a);
			if (!alvo.length)
				throw new Error('Diga quais caminhos tirar: paths:["src/fisica"] ou path:"src/agua.js".');
			const r = tmPathsRemove(a && a.team, alvo) || {};
			const t = tmTeam(a && a.team);
			tmAdminSalvar();
			const NL = String.fromCharCode(10);
			const nf =
				r.naoEncontrados && r.naoEncontrados.length
					? NL + 'Nao eram desta equipe: ' + r.naoEncontrados.join(', ')
					: '';
			return `Tirei ${(r.removidos && r.removidos.length) || 0} caminho(s).${nf}${NL}${tmAdminResumo(t)}`;
		},
	},
	{
		name: 'team_rename',
		title: 'Renomear equipe (so Gerenciador)',
		desc: 'Muda o nome de uma equipe comum (equipe nativa nao pode ser renomeada).',
		schema: {
			type: 'object',
			properties: {
				team: { type: 'string', description: 'Nome ou id atual' },
				new_name: { type: 'string', description: 'Novo nome' },
				agent: MCP_AGENT_PROP,
				project: MCP_PROJECT_PROP,
			},
			required: ['team', 'new_name'],
		},
		run: async (a) => {
			tmRequireManager(agName(a), 'renomear equipes');
			const antes = tmTeam(a && a.team);
			const nomeAntes = antes ? antes.name : String(a && a.team);
			tmTeamRename(a && a.team, a && a.new_name);
			const t = tmTeam(a && a.team) || antes;
			tmAdminSalvar();
			return `Equipe "${nomeAntes}" agora se chama "${t.name}". Avise os agentes dela: o team_join passa a usar o nome novo.`;
		},
	},
	{
		name: 'team_set_desc',
		title: 'Mudar a descricao da equipe (so Gerenciador)',
		desc: 'Atualiza a descricao que os agentes leem ao entrar na equipe.',
		schema: {
			type: 'object',
			properties: {
				team: { type: 'string', description: 'Nome ou id da equipe' },
				desc: { type: 'string', description: 'Nova descricao (ate 400 caracteres)' },
				agent: MCP_AGENT_PROP,
				project: MCP_PROJECT_PROP,
			},
			required: ['team', 'desc'],
		},
		run: async (a) => {
			tmRequireManager(agName(a), 'mudar a descricao de uma equipe');
			tmTeamSetDesc(a && a.team, a && a.desc);
			const t = tmTeam(a && a.team);
			tmAdminSalvar();
			return `Descricao da equipe "${t.name}" atualizada: ${t.desc || '(vazia)'}`;
		},
	},
	{
		name: 'team_allow_leave',
		title: 'Liberar ou travar a saida da equipe (so Gerenciador)',
		desc: 'Liga/desliga o "permitir agente sair dessa equipe". Com a saida travada, o agente que entrou nao sai sozinho.',
		schema: {
			type: 'object',
			properties: {
				team: { type: 'string', description: 'Nome ou id da equipe' },
				allow: { type: 'boolean', description: 'true = pode sair, false = nao pode' },
				agent: MCP_AGENT_PROP,
				project: MCP_PROJECT_PROP,
			},
			required: ['team', 'allow'],
		},
		run: async (a) => {
			tmRequireManager(agName(a), 'liberar a saida de uma equipe');
			tmTeamAllowLeave(a && a.team, !!(a && a.allow));
			const t = tmTeam(a && a.team);
			tmAdminSalvar();
			return `Saida da equipe "${t.name}": ${t.allowLeave ? 'LIBERADA (os agentes podem usar team_leave)' : 'TRAVADA (so o usuario ou o Gerenciador liberam)'}.`;
		},
	},
	{
		name: 'team_remove_agent',
		title: 'Tirar um agente da equipe (so Gerenciador)',
		desc: 'Remove um agente da equipe dele. Ele perde a permissao de alterar arquivos (continua lendo tudo) e as travas que estiver segurando sao soltas.',
		schema: {
			type: 'object',
			properties: {
				name: { type: 'string', description: 'Nome do agente a remover' },
				agent: MCP_AGENT_PROP,
				project: MCP_PROJECT_PROP,
			},
			required: ['name'],
		},
		run: async (a) => {
			const eu = agName(a);
			tmRequireManager(eu, 'remover agentes de equipes');
			const alvo = String((a && a.name) || '').trim();
			if (!alvo)
				throw new Error(
					'Diga o nome do agente: name="agente-fisica". Veja os nomes com list_agents.',
				);
			if (tmAgKey(alvo) === tmAgKey(eu))
				throw new Error(
					'Voce nao pode se remover: isso deixaria o Gerenciador vazio e ninguem administraria as equipes. Peca ao usuario.',
				);
			const r = tmAgentRemove(alvo) || {};
			tmAdminSalvar();
			if (!r.removido) return `O agente "${alvo}" nao estava em nenhuma equipe. Nada mudou.`;
			return `Agente "${alvo}" removido da equipe "${(r.equipe && r.equipe.name) || '?'}". Ele continua \
lendo o projeto, mas nao altera mais nada ate entrar em outra equipe. As travas dele foram soltas.`;
		},
	},
	{
		name: 'team_delete',
		title: 'Apagar equipe (so Gerenciador)',
		desc: 'Apaga uma equipe comum (nativa nao pode ser apagada). Os agentes dela ficam sem equipe e param de poder alterar arquivos; os arquivos em si nao sao apagados, so voltam a nao ter dono.',
		schema: {
			type: 'object',
			properties: {
				team: { type: 'string', description: 'Nome ou id da equipe' },
				agent: MCP_AGENT_PROP,
				project: MCP_PROJECT_PROP,
			},
			required: ['team'],
		},
		run: async (a) => {
			tmRequireManager(agName(a), 'apagar equipes');
			const t = tmTeam(a && a.team);
			if (!t)
				throw new Error(`Nao existe equipe "${String((a && a.team) || '')}". Veja com team_list.`);
			const nome = t.name,
				qtd = (t.agents || []).length,
				cam = (t.files || []).length + (t.dirs || []).length;
			tmTeamDelete(t.id);
			tmAdminSalvar();
			return `Equipe "${nome}" apagada. ${qtd} agente(s) ficaram sem equipe e ${cam} caminho(s) voltaram \
a nao ter dono. Crie a nova equipe com team_create e mande os agentes darem team_join de novo.`;
		},
	},
);
try {
	__agProps = false;
	agEnsureProps();
} catch (e) {
	ignorarErro(e, 'forge');
}

MCP_TOOLS.push(
	{
		name: 'file_lock',
		title: 'Travar arquivos',
		desc:
			'Reserva arquivos para voce. mode="escrita" (padrao) = exclusiva: enquanto durar, nenhum ' +
			'outro agente le nem altera esses arquivos - use antes de reescrever algo grande. ' +
			'mode="leitura" = compartilhada: os outros continuam podendo LER junto, mas ninguem ' +
			'consegue GRAVAR neles enquanto voce estuda o codigo. Padrao 10 min na escrita e 2 min ' +
			'na leitura; chamar de novo renova. Voce NAO precisa dele para uma leitura ou edicao ' +
			'normal: o site ja trava sozinho na entrada da chamada e solta na resposta - use ' +
			'file_lock so para segurar o arquivo ENTRE varias chamadas. Tudo ou nada: se um dos ' +
			'arquivos ja estiver na mao de outro agente, nenhum e travado.',
		schema: {
			type: 'object',
			properties: {
				paths: {
					type: 'array',
					items: { type: 'string' },
					description: 'Caminhos dos arquivos (max. 200)',
				},
				path: { type: 'string', description: 'Atalho: um unico caminho' },
				note: { type: 'string', description: 'Motivo curto - os outros agentes veem isso' },
				mode: {
					type: 'string',
					enum: ['escrita', 'leitura'],
					description:
						'escrita (padrao) = exclusiva; leitura = compartilhada, outros leem junto mas ninguem grava',
				},
				minutes: {
					type: 'integer',
					minimum: 1,
					maximum: 240,
					description: 'Prazo em minutos (padrao 10 na escrita, 2 na leitura)',
				},
				agent: MCP_AGENT_PROP,
				project: MCP_PROJECT_PROP,
			},
			required: [],
		},
		run: async (a) => {
			const nome = agName(a);
			if (!nome)
				throw new Error('Informe agent="seu-nome" para travar arquivos: a trava precisa ter dono.');
			const ps = tmPathsArg(a);
			if (!ps.length)
				throw new Error(
					'Nao entendi quais arquivos travar. Use paths:["src/a.js","src/b.js"] ou path:"src/a.js".',
				);
			if (ps.length > 200) throw new Error('Maximo de 200 arquivos por chamada.');
			tmLocksGC();
			const _pj = agProjQuiet(a);
			const projId = _pj ? String(_pj.id) : '';
			const projName = _pj ? String(_pj.name || '') : '';
			const kind = tmLockKindArg(a && a.mode) === 'read' ? 'read' : 'write';
			const presos = ps
				.map(function (p) {
					return kind === 'read'
						? tmBloqueioLeitura(p, nome, projId)
						: tmBloqueioEscrita(p, nome, projId);
				})
				.filter(Boolean);
			if (presos.length)
				throw new Error(
					`Nada foi travado (${presos.length} de ${ps.length}${kind === 'read' ? ' estao sendo REESCRITOS por outro agente' : ' ja estao na mao de outro agente'}):${String.fromCharCode(10)}${presos
						.slice(0, 5)
						.map(function (l) {
							return '- ' + tmLockDesc(l);
						})
						.join(
							String.fromCharCode(10),
						)}${String.fromCharCode(10)}Regra: varios agentes podem LER o mesmo arquivo ao mesmo tempo; ESCREVER e um de cada vez.`,
				);
			const novasQtd = ps.filter(function (p) {
				return !tmLockMeu(p, projId, nome, kind);
			}).length;
			if (novasQtd > tmLocksLivres())
				throw new Error(
					`Nada foi travado: seriam ${novasQtd} travas novas e so ha ${tmLocksLivres()} vaga(s) de ${TM.cfg.lockMax || 400}. \
Peca aos agentes para soltarem o que ja terminaram (file_unlock).`,
				);
			let novas = 0,
				renovadas = 0;
			ps.forEach(function (p) {
				const r = tmLockAcquire(nome, p, {
					kind: kind,
					mode: 'manual',
					note: a.note,
					minutes: a.minutes,
					proj: projId,
					projName: projName,
				});
				if (r.novo) novas++;
				else renovadas++;
			});
			tmAgSave();
			try {
				mcpRenderAgents();
			} catch (e) {
				ignorarErro(e, 'run');
			}
			const min = Math.max(
				1,
				Math.min(
					240,
					Number(a.minutes) ||
						(kind === 'read'
							? Number(TM.cfg.lockReadMinutes) || 2
							: Number(TM.cfg.lockMinutes) || 10),
				),
			);
			const NL = String.fromCharCode(10);
			return `Travei ${ps.length} arquivo(s) para voce por ${min} min em modo ${kind === 'read' ? 'LEITURA (compartilhada)' : 'ESCRITA (exclusiva)'} \
(${novas} novas, ${renovadas} renovadas):${NL}${ps.slice(0, 20).join(NL)}${ps.length > 20 ? NL + '... e mais ' + (ps.length - 20) : ''}${NL}${NL}${kind === 'read' ? 'Os outros agentes continuam podendo LER esses arquivos junto com voce, mas nenhum consegue GRAVAR neles' : 'Nenhum outro agente le ou altera esses arquivos'} \
ate voce chamar file_unlock (ou o prazo acabar). Solte assim que terminar: arquivo preso sem necessidade \
trava o time inteiro.`;
		},
	},
	{
		name: 'file_unlock',
		title: 'Destravar arquivos',
		desc:
			'Solta as travas que voce pegou com file_lock e tambem as marcas de leitura que suas ' +
			'ultimas leituras deixaram. Sem paths, solta TODAS as suas. Assim que voce solta, os ' +
			'outros agentes voltam a poder GRAVAR nesses arquivos (e a ler a versao nova, se era ' +
			'trava de escrita).',
		schema: {
			type: 'object',
			properties: {
				paths: {
					type: 'array',
					items: { type: 'string' },
					description: 'Caminhos a soltar (vazio = todos os seus)',
				},
				path: { type: 'string', description: 'Atalho: um unico caminho' },
				agent: MCP_AGENT_PROP,
				project: MCP_PROJECT_PROP,
			},
		},
		run: async (a) => {
			const nome = agName(a);
			if (!nome) throw new Error('Informe agent="seu-nome".');
			tmLocksGC();
			const _pj = agProjQuiet(a);
			const projId = _pj ? String(_pj.id) : '';
			const pedidos = tmPathsArg(a);
			let ps = pedidos.length
				? pedidos.map(function (p) {
						return { path: p, proj: projId };
					})
				: tmLocksDoAgente(nome).map(function (l) {
						return { path: l.path, proj: l.proj };
					});
			if (!ps.length) return 'Voce nao tem nenhum arquivo travado no momento.';
			const erros = [];
			let n = 0;
			ps.forEach(function (x) {
				try {
					if (tmLockRelease(nome, x.path, { proj: x.proj }).soltou) n++;
				} catch (e) {
					erros.push(String((e && e.message) || e));
				}
			});
			tmAgSave();
			try {
				mcpRenderAgents();
			} catch (e) {
				ignorarErro(e, 'run');
			}
			return `Soltei ${n} trava(s). Os outros agentes ja podem ler a versao atualizada desses arquivos.${erros.length ? String.fromCharCode(10) + 'Nao consegui soltar ' + erros.length + ': ' + erros[0] : ''}`;
		},
	},
	{
		name: 'file_locks',
		title: 'Ver arquivos travados',
		desc:
			'Mostra quais arquivos estao ocupados agora, quem esta LENDO e quem esta ESCREVENDO, por ' +
			'que e por quanto tempo. Com path, responde se voce pode ler e se pode gravar naquele ' +
			'arquivo. Consulte antes de planejar uma tarefa grande, para nao brigar por arquivo.',
		schema: {
			type: 'object',
			properties: {
				path: { type: 'string', description: 'Conferir um arquivo especifico (opcional)' },
				agent: MCP_AGENT_PROP,
				project: MCP_PROJECT_PROP,
			},
		},
		run: async (a) => {
			tmLocksGC();
			if (a && a.path) {
				const _pj = agProjQuiet(a);
				const p = tmNormPath(a.path);
				const pj = _pj ? String(_pj.id) : '';
				const ls = tmLocksOn(p, pj);
				if (!ls.length)
					return `O arquivo "${p}" esta LIVRE: pode ler, e alterar se ele for da sua equipe.`;
				const eu = tmAgKey(agName(a));
				const escritor =
					ls.filter(function (l) {
						return tmLockKind(l) === 'write';
					})[0] || null;
				const leitores = ls.filter(function (l) {
					return tmLockKind(l) === 'read';
				});
				const R = [];
				if (escritor)
					R.push(
						(tmAgKey(escritor.agent) === eu ? 'ESCRITA (sua): ' : 'ESCRITA: ') +
							tmLockDesc(escritor),
					);
				if (leitores.length)
					R.push(
						`LEITURA por ${leitores.length} agente(s): ${leitores
							.map(function (l) {
								return (
									l.agent +
									(tmAgKey(l.agent) === eu ? ' (voce)' : '') +
									' - mais ' +
									tmLockPrazoTxt(l)
								);
							})
							.join(', ')}`,
					);
				R.push(
					!escritor || tmAgKey(escritor.agent) === eu
						? 'LER: pode agora (leitura e compartilhada).'
						: 'LER: nao agora - o arquivo esta sendo reescrito.',
				);
				R.push(
					ls.every(function (l) {
						return tmAgKey(l.agent) === eu;
					})
						? 'GRAVAR: pode - as travas sao suas. Solte com file_unlock quando terminar.'
						: `GRAVAR: nao enquanto essas travas existirem. ${tmLockEspera(
								ls.filter(function (l) {
									return tmAgKey(l.agent) !== eu;
								})[0] || ls[0],
							)}, ou combine por post_message.`,
				);
				return R.join(String.fromCharCode(10));
			}
			return tmLocksReport();
		},
	},
);
try {
	__agProps = false;
	agEnsureProps();
} catch (e) {
	ignorarErro(e, 'forge');
}

const TERM = {
	open: false,
	allow: false,
	hist: [],
	hi: 0,
	cur: null,
	busy: false,
	echoed: {},
	greeted: false,
};
function termLoadCfg() {
	try {
		TERM.allow = localStorage.getItem('aurora.mcp.term') === '1';
	} catch (e) {
		ignorarErro(e, 'termLoadCfg');
	}
	try {
		const l = localStorage.getItem('aurora.mcp.termlist');
		TERM.allowList = l
			? l
					.split('\n')
					.map(function (s) {
						return s.trim();
					})
					.filter(Boolean)
			: [];
	} catch (e) {
		TERM.allowList = [];
	}
}
function termSaveCfg() {
	try {
		localStorage.setItem('aurora.mcp.term', TERM.allow ? '1' : '0');
	} catch (e) {
		ignorarErro(e, 'termSaveCfg');
	}
	try {
		localStorage.setItem('aurora.mcp.termlist', (TERM.allowList || []).join('\n'));
	} catch (e) {
		ignorarErro(e, 'termSaveCfg');
	}
}
const DEV = { map: {} };
const DEP = { map: {} };
function devScanPort(text) {
	const m = /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\\[[^\\]]*\\]):(\d{2,5})/i.exec(
		text || '',
	);
	if (m) return Number(m[1]);
	const m2 = /(?:^|[^\w])(?:port|porta)\D{0,12}(\d{2,5})/i.exec(text || '');
	return m2 ? Number(m2[1]) : null;
}
function devBridgeSrc() {
	return CONSOLE_HOOK + '\n;\n' + VISION_HOOK;
}
async function devRegister(proj, procId, port) {
	const r = await termApi('devreg', {
		project: termProjName(proj),
		port: port,
		bridge: devBridgeSrc(),
	});
	const url = termBase() + '/dev/' + MCP.sid + '/' + MCP.token + '/' + (r.key || 'projeto') + '/';
	DEV.map[proj.id] = { procId: procId, port: port, url: url, t: Date.now() };
	logCmd(proj, `▶ Dev server conectado (porta ${port}) — preview via relay: ${url}`);
	if (proj.id === State.active) devShowFrame(proj);
	return url;
}
function devShowFrame(proj) {
	const dvi = DEV.map[proj.id];
	if (!dvi || !dvi.url) return false;
	if (proj.id !== State.active) return true;
	try {
		el.frame.removeAttribute('srcdoc');
	} catch (e) {
		ignorarErro(e, 'devShowFrame');
	}
	el.frame.src = dvi.url;
	hidePreviewLoading();
	hidePreviewError();
	el.previewEmpty.classList.add('hidden');
	el.device.classList.remove('hidden');
	setStatus('ok', `Preview no dev server (porta ${dvi.port})`);
	return true;
}
function devAutoSync(proj) {
	const dvi = DEV.map[proj.id];
	if (!dvi) return;
	clearTimeout(dvi.syncT);
	dvi.syncT = setTimeout(() => {
		termSync(proj)
			.then(() => {
				logCmd(proj, '⇅ Projeto sincronizado para o dev server (hot-reload)');
			})
			.catch((e) => {
				logCmd(proj, 'Falha ao sincronizar para o dev server: ' + ((e && e.message) || e));
			});
	}, 400);
}
function termAssertAllowed(cmd) {
	if (!TERM.allow)
		throw new Error(
			'O terminal esta desativado. Peca ao usuario para marcar \\"Permitir que o agente execute comandos (terminal)\\" no menu MCP do Synapse (icone MCP na barra superior).',
		);
	if (!termBase()) throw new Error(TERM_FALTA);
	if (cmd != null && TERM.allowList && TERM.allowList.length > 0) {
		const c = String(cmd).trimStart();
		const ok2 = TERM.allowList.some(function (p) {
			return c === p || c.startsWith(p + ' ') || c.startsWith(p + '\t');
		});
		if (!ok2)
			throw new Error(
				`Comando bloqueado pela allowlist: "${c.split(/\s/)[0]}". Prefixos permitidos: ${TERM.allowList.join(', ')}. \
Peça ao usuário para adicionar o prefixo na lista de comandos permitidos no menu MCP.`,
			);
	}
}
const TERM_NET_ACTS = ['fetchurl', 'fetchjson'];
async function termPost(base, action, body) {
	const r = await fetch(base + '/bridge/' + MCP.sid + '/' + MCP.token + '/' + action, {
		method: 'POST',
		headers: MCP_HDRS(),
		body: JSON.stringify(body || {}),
	});
	let j = null;
	try {
		j = await r.json();
	} catch (e) {
		ignorarErro(e, 'termPost');
	}
	if (!r.ok) throw new Error((j && j.error) || 'Relay: HTTP ' + r.status);
	return j || {};
}
async function termApi(action, body) {
	if (TERM_NET_ACTS.includes(action)) {
		const nuvem = mcpBase();
		if (/^https?:\/\//i.test(nuvem)) {
			try {
				return await termPost(nuvem, action, body);
			} catch (e) {
				if (!termBase()) throw e;
			}
		}
		const b2 = termBase();
		if (!b2) throw new Error(TERM_FALTA);
		return termPost(b2, action, body);
	}
	const base = termBase();
	if (!base) throw new Error(TERM_FALTA);
	try {
		return await termPost(base, action, body);
	} catch (e) {
		COMPL.ok = false;
		try {
			complSondar(true);
		} catch (_e) {
			ignorarErro(_e, 'termApi');
		}
		throw new Error(String((e && e.message) || e) + ' (complemento local em ' + base + ')');
	}
}
