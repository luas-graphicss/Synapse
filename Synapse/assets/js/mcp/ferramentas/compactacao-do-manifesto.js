'use strict';

(function auroraCompact() {
	'use strict';

	const AC = (window.AURORA_COMPACT = window.AURORA_COMPACT || {});
	if (AC.maxActionDesc == null) AC.maxActionDesc = 95;
	if (AC.maxPropDesc == null) AC.maxPropDesc = 110;
	if (AC.hideServerTools == null) AC.hideServerTools = false;

	const GROUPS = [
		{
			name: 'project',
			title: 'Projetos',
			head: 'Gerencia projetos abertos no Synapse.',
			members: {
				status: 'project_status',
				list: 'list_projects',
				use: 'set_active_project',
				create: 'create_project',
				list_disk: 'list_disk_projects',
				open_disk: 'open_project_from_disk',
			},
		},
		{
			name: 'history',
			title: 'Versões e snapshots',
			head: 'Histórico de arquivos e snapshots do projeto. Use antes de desfazer algo.',
			members: {
				versions: 'list_versions',
				read_version: 'read_version',
				diff: 'diff_file',
				restore: 'restore_version',
				snapshot: 'snapshot_project',
				snapshots: 'list_snapshots',
				diff_snapshot: 'diff_snapshot',
				restore_snapshot: 'restore_snapshot',
			},
		},
		{
			name: 'preview',
			title: 'Preview',
			head: 'Controla e inspeciona o iframe de preview.',
			members: {
				refresh: 'refresh_preview',
				viewport: 'set_viewport',
				reset: 'reset_state',
				network: 'network_log',
				console: 'console_logs',
				perf: 'perf_stats',
				audio: 'audio_status',
			},
		},
		{
			name: 'probe',
			title: 'Inspeção do DOM',
			head: 'Lê e verifica o estado da página renderizada. Para clicar/digitar use `interact`.',
			members: {
				query: 'query_dom',
				map: 'ui_map',
				wait: 'wait_for',
				assert: 'assert_state',
				eval: 'eval_js',
			},
		},
		{
			name: 'capture',
			title: 'Captura visual',
			head: 'Tira imagens do preview.',
			members: {
				shot: 'screenshot_preview',
				burst: 'screenshot_burst',
				frames: 'record_frames',
			},
		},
		{
			name: 'lock',
			title: 'Travas e claims',
			head: 'Reserva projeto/arquivos para evitar dois agentes escrevendo no mesmo lugar.',
			members: {
				claim: 'claim_project',
				release: 'release_project',
				claims: 'list_claims',
				lock_file: 'file_lock',
				unlock_file: 'file_unlock',
				locks: 'file_locks',
			},
		},
		{
			name: 'msg',
			title: 'Mensagens entre agentes',
			head: 'Recados e feed de atividade entre agentes que dividem o projeto.',
			members: {
				send: 'msg_send',
				inbox: 'msg_inbox',
				post: 'post_message',
				read: 'read_messages',
				agents: 'list_agents',
				activity: 'agent_activity',
			},
		},
		{
			name: 'team',
			title: 'Equipes',
			head: 'Equipes de agentes e escopo de arquivos de cada uma.',
			members: {
				join: 'team_join',
				status: 'team_status',
				list: 'team_list',
				leave: 'team_leave',
				enlist: 'team_enlist',
				globals: 'team_globals',
				global_add: 'team_global_add',
				global_remove: 'team_global_remove',
				create: 'team_create',
				add_files: 'team_add_files',
				remove_files: 'team_remove_files',
				rename: 'team_rename',
				set_desc: 'team_set_desc',
				allow_leave: 'team_allow_leave',
				remove_agent: 'team_remove_agent',
				delete: 'team_delete',
			},
		},
		{
			name: 'review',
			title: 'Revisão',
			head: 'Fila de revisão de mudanças entre agentes.',
			members: {
				submit: 'review_submit',
				list: 'review_list',
				get: 'review_get',
				decide: 'review_decide',
				cancel: 'review_cancel',
				deps: 'review_deps',
			},
		},
		{
			name: 'model3d',
			title: 'Modelos 3D',
			head: 'Inspeciona, transforma, busca, importa e MODELA modelos 3D por codigo (action=forge cria .glb + ficha com imagem; action=docs ensina a API AuroraForge).',
			members: {
				list: 'model3d_list',
				inspect: 'model3d_inspect',
				set_pivot: 'model3d_set_pivot',
				transform: 'model3d_transform',
				compare: 'model3d_compare',
				apply: 'model3d_apply',
				convert: 'model3d_convert',
				forge: 'model3d_forge',
				docs: 'model3d_docs',
				sources: 'model3d_sources',
				search: 'model3d_search',
				import: 'model3d_import',
				import_url: 'model3d_import_url',
			},
		},
		{
			name: 'asset',
			title: 'Assets',
			head: 'Adiciona arquivos binários ao projeto.',
			members: { from_url: 'add_asset_from_url', base64: 'add_asset_base64' },
		},
		{
			name: 'server',
			title: 'Servidor e terminal',
			head: 'EXIGE relay Node local. Indisponível com o relay Cloudflare.',
			members: {
				start: 'start_dev_server',
				stop: 'stop_dev_server',
				status: 'dev_server_status',
				deploy: 'deploy_static',
				undeploy: 'undeploy_static',
				run: 'run_command',
				output: 'command_output',
				kill: 'stop_command',
			},
		},
	];

	const KEEP_FLAT = [
		'list_files',
		'read_file',
		'read_files',
		'create_file',
		'write_file',
		'write_files',
		'edit_file',
		'outline',
		'rename',
		'delete',
		'search',
		'check_syntax',
		'wait_for_errors',
		'export_zip',
		'interact',
		'run_scenario',
		'plan_split',
	];

	function firstSentence(s, max) {
		if (!s) return '';
		s = String(s).replace(/\s+/g, ' ').trim();
		const m = s.match(/^(.{20,}?)(?:\.\s|\;\s|\s\u2014\s)/);
		if (m) s = m[1];
		if (s.length > max) s = s.slice(0, max - 1).replace(/[\s,;:]+\S*$/, '') + '…';
		return s;
	}

	function clampDesc(s, max) {
		if (!s) return s;
		s = String(s).replace(/\s+/g, ' ').trim();
		if (s.length <= max) return s;
		return s.slice(0, max - 1).replace(/[\s,;:]+\S*$/, '') + '…';
	}

	function shrinkSchema(schema) {
		if (!schema || typeof schema !== 'object') return schema;
		const out = { type: 'object', properties: {} };
		const props = schema.properties || {};
		for (let k in props) {
			if (!Object.prototype.hasOwnProperty.call(props, k)) continue;
			const p = props[k];
			const np = {};
			for (let kk in p) {
				if (Object.prototype.hasOwnProperty.call(p, kk)) np[kk] = p[kk];
			}
			if (np.description) np.description = clampDesc(np.description, AC.maxPropDesc);
			out.properties[k] = np;
		}
		if (schema.required && schema.required.length) out.required = schema.required.slice();
		return out;
	}

	const SHARED = {
		agent: {
			type: 'string',
			description: 'Seu nome de agente. Use sempre o mesmo em todas as chamadas.',
		},
		project: { type: 'string', description: 'ID do projeto. Omita para usar o ativo.' },
	};

	if (typeof MCP_TOOLS === 'undefined' || !Array.isArray(MCP_TOOLS)) {
		registro.aviso('[aurora-compact] MCP_TOOLS nao encontrado — patch ignorado');
		return;
	}

	const ORIG = new Map();
	for (let i = 0; i < MCP_TOOLS.length; i++) ORIG.set(MCP_TOOLS[i].name, MCP_TOOLS[i]);
	AC.original = ORIG;

	function buildGroup(g) {
		const actions = [];
		const lines = [];
		const union = {};
		let found = 0;

		for (var act in g.members) {
			if (!Object.prototype.hasOwnProperty.call(g.members, act)) continue;
			const t = ORIG.get(g.members[act]);
			if (!t) continue;
			found++;
			actions.push(act);
			lines.push(act + ' — ' + firstSentence(t.desc, AC.maxActionDesc));

			const props = (t.schema && t.schema.properties) || {};
			for (var k in props) {
				if (!Object.prototype.hasOwnProperty.call(props, k)) continue;
				if (k === 'agent' || k === 'project') continue;
				if (union[k]) continue;
				const p = props[k];
				const np = {};
				for (let kk in p) {
					if (Object.prototype.hasOwnProperty.call(p, kk)) np[kk] = p[kk];
				}
				if (np.description) np.description = clampDesc(np.description, AC.maxPropDesc);
				union[k] = np;
			}
		}

		if (!found) return null;

		const schema = { type: 'object', properties: {}, required: ['action'] };
		schema.properties.action = { type: 'string', enum: actions };
		for (let uk in union) {
			if (Object.prototype.hasOwnProperty.call(union, uk)) schema.properties[uk] = union[uk];
		}
		schema.properties.agent = SHARED.agent;
		schema.properties.project = SHARED.project;

		return {
			name: g.name,
			title: g.title,
			desc: g.head + '\nAções:\n' + lines.join('\n'),
			schema: schema,
			__group: g,
			run: async function (args) {
				args = args || {};
				const act = String(args.action || '').trim();
				const target = g.members[act];
				if (!target || !ORIG.get(target)) {
					throw new Error(
						`acao "${act}" invalida em ${g.name}. Validas: ${Object.keys(g.members).join(', ')}`,
					);
				}
				const rest = {};
				for (let k in args) {
					if (Object.prototype.hasOwnProperty.call(args, k) && k !== 'action') rest[k] = args[k];
				}
				return ORIG.get(target).run(rest);
			},
		};
	}

	const facade = [];
	const consumed = new Set();

	for (let gi = 0; gi < GROUPS.length; gi++) {
		var g = GROUPS[gi];
		if (g.name === 'server' && AC.hideServerTools) {
			for (let mk in g.members) consumed.add(g.members[mk]);
			continue;
		}
		const built = buildGroup(g);
		if (!built) continue;
		facade.push(built);
		for (let mk2 in g.members) {
			if (Object.prototype.hasOwnProperty.call(g.members, mk2)) consumed.add(g.members[mk2]);
		}
	}

	for (let fi = 0; fi < KEEP_FLAT.length; fi++) {
		const ft = ORIG.get(KEEP_FLAT[fi]);
		if (!ft) continue;
		consumed.add(ft.name);
		const sh = shrinkSchema(ft.schema);
		if (sh && sh.properties) {
			if (sh.properties.agent) sh.properties.agent = SHARED.agent;
			if (sh.properties.project) sh.properties.project = SHARED.project;
		}
		facade.push({
			name: ft.name,
			title: ft.title,
			desc: clampDesc(ft.desc, 300),
			schema: sh,
			run: (function (orig) {
				const w = function (args) {
					return orig.run(args);
				};
				w.orig = orig;
				return w;
			})(ft),
		});
	}

	const leftovers = [];
	for (let li = 0; li < MCP_TOOLS.length; li++) {
		const lt = MCP_TOOLS[li];
		if (consumed.has(lt.name)) continue;
		leftovers.push(lt.name);
		const lsh = shrinkSchema(lt.schema);
		if (lsh && lsh.properties) {
			if (lsh.properties.agent) lsh.properties.agent = SHARED.agent;
			if (lsh.properties.project) lsh.properties.project = SHARED.project;
		}
		facade.push({
			name: lt.name,
			title: lt.title,
			desc: clampDesc(lt.desc, 300),
			schema: lsh,
			run: (function (orig) {
				const w = function (args) {
					return orig.run(args);
				};
				w.orig = orig;
				return w;
			})(lt),
		});
	}

	const LONG = typeof MCP_INSTRUCTIONS === 'string' ? MCP_INSTRUCTIONS : '';

	facade.push({
		name: 'help',
		title: 'Manual do Synapse',
		desc: 'Manual completo do Synapse: fluxo recomendado, regras de coordenação entre agentes e detalhes de cada grupo de ações. Chame uma vez no início de tarefas complexas ou quando uma ação falhar.',
		schema: {
			type: 'object',
			properties: {
				topic: {
					type: 'string',
					description:
						"Filtra o manual por palavra-chave (ex.: 'equipe', 'preview'). Omita para o texto inteiro.",
				},
			},
		},
		run: async function (args) {
			const topic = ((args && args.topic) || '').trim().toLowerCase();
			let txt = LONG;
			if (topic) {
				const hits = LONG.split(/\n{2,}/).filter(function (b) {
					return b.toLowerCase().includes(topic);
				});
				if (hits.length) txt = hits.join('\n\n');
			}
			const names = facade
				.map(function (t) {
					return t.name;
				})
				.join(', ');
			return txt + '\n\n--- Ferramentas disponíveis ---\n' + names;
		},
	});

	const SHORT_INSTRUCTIONS = [
		'Synapse Live Preview: IDE no navegador que compila e roda o projeto do usuário em tempo real.',
		'',
		'Fluxo padrão: `project` (status) -> `list_files` / `outline` -> `read_file` -> `edit_file` ou `write_file` -> `check_syntax` -> `preview` (refresh) -> `capture` (shot) para conferir.',
		'',
		"Ferramentas agrupadas usam o parâmetro `action` (ex.: {action:'refresh'} em `preview`). O enum de cada uma lista as ações válidas.",
		'',
		'Com vários agentes no mesmo projeto: informe sempre o mesmo `agent`, e use `lock` antes de escrever.',
		'',
		"Modelagem 3D real por codigo: `model3d` {action:'docs'} ensina a API; {action:'forge', code:...} modela, salva .glb e devolve imagem de QA.",
		'',
		'Chame `help` para o manual completo.',
	].join('\n');

	const antes = MCP_TOOLS.length;
	MCP_TOOLS.splice.apply(MCP_TOOLS, [0, MCP_TOOLS.length].concat(facade));

	try {
		const _dispatch = mcpDispatch;
		mcpDispatch = async function (method, params) {
			const out = await _dispatch(method, params);
			if (method === 'initialize' && out && typeof out === 'object' && 'instructions' in out) {
				out.instructions = SHORT_INSTRUCTIONS;
			}
			return out;
		};
	} catch (e) {
		registro.aviso('[aurora-compact] nao consegui encurtar as instructions:', e);
	}

	AC.report = function () {
		function size(list) {
			return JSON.stringify(
				list.map(function (t) {
					return { name: t.name, title: t.title, description: t.desc, inputSchema: t.schema };
				}),
			).length;
		}
		const depois = size(MCP_TOOLS) + SHORT_INSTRUCTIONS.length;
		return {
			tools_antes: antes,
			tools_depois: MCP_TOOLS.length,
			chars_depois: depois,
			tokens_depois_aprox: Math.round(depois / 4),
			leftovers: leftovers,
		};
	};

	registro.debug(`[aurora-compact] ${antes} -> ${MCP_TOOLS.length} tools.`, AC.report());
	if (leftovers.length) registro.debug('[aurora-compact] nao agrupadas:', leftovers);
})();
