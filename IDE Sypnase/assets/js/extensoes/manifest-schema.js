(function (root) {
	'use strict';

	const ID_PATTERN = '^[a-z0-9][a-z0-9-]*\\.[a-z0-9][a-z0-9-]*$';
	const PUBLISHER_PATTERN = '^[a-z0-9][a-z0-9-]*$';
	const SEMVER_PATTERN = '^\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$';
	const COMMAND_PATTERN = '^[A-Za-z0-9_][A-Za-z0-9_.-]*$';
	const RELATIVE_PATH_PATTERN = '^(?!/)(?!.*(?:^|/)\\.\\.(?:/|$))[^\\\\<>:"|?*]+$';
	const ACTIVATION_PATTERN = '^(?:\\*|onStartupFinished|onCommand:[^\\s]+|onLanguage:[^\\s]+|onView:[^\\s]+|workspaceContains:[^\\s]+)$';
	const PERMISSION_PATTERN = '^(?:workspace\\.read|workspace\\.write|workspace\\.all|editor|webview|clipboard|preview|mcp|network:self|network:https://[^\\s/]+)$';
	const LANGUAGE_ID_PATTERN = '^[a-z][a-z0-9_+.#-]{0,39}$';
	const MCP_TOOL_NAME_PATTERN = '^[a-z][a-z0-9_]{0,47}$';
	const CATEGORIES = ['Linguagens', 'Temas', 'Formatadores', 'Snippets', 'Depuradores', 'Outros'];
	const MENU_ITEMS = {
		type: 'array',
		items: {
			type: 'object',
			required: ['command'],
			properties: {
				command: { type: 'string', pattern: COMMAND_PATTERN },
				when: { type: 'string', maxLength: 300 },
				group: { type: 'string', maxLength: 60, hint: 'ex.: "navigation", "1_modificacao@2"' },
			},
		},
	};

	const SCHEMA = {
		type: 'object',
		required: ['id', 'name', 'version', 'publisher', 'main'],
		properties: {
			id: { type: 'string', pattern: ID_PATTERN, hint: 'use o formato "publisher.nome" em minúsculas, ex.: "ana.hello-world"' },
			name: { type: 'string', minLength: 1, maxLength: 80 },
			version: { type: 'string', pattern: SEMVER_PATTERN, hint: 'use semver, ex.: "1.0.0"' },
			publisher: { type: 'string', pattern: PUBLISHER_PATTERN, hint: 'use apenas minúsculas, números e hífens' },
			description: { type: 'string', maxLength: 300 },
			engines: { type: 'object', properties: { synapse: { type: 'string', minLength: 1 } } },
			extensionPack: { type: 'array', items: { type: 'string', pattern: ID_PATTERN, hint: 'IDs de extensões do registro instaladas junto com este pack' } },
			extensionDependencies: { type: 'array', items: { type: 'string', pattern: ID_PATTERN, hint: 'IDs de extensões obrigatórias, ativadas antes desta' } },
			main: { type: 'string', pattern: RELATIVE_PATH_PATTERN, hint: 'caminho relativo à pasta da extensão, ex.: "dist/extension.js"' },
			icon: { type: 'string', pattern: RELATIVE_PATH_PATTERN, hint: 'imagem quadrada PNG, JPG, WebP ou SVG dentro do pacote, ex.: "media/icon.png"' },
			categories: { type: 'array', items: { type: 'string', enum: CATEGORIES } },
			activationEvents: {
				type: 'array',
				items: { type: 'string', pattern: ACTIVATION_PATTERN, hint: 'valores aceitos: "onStartupFinished", "onCommand:<id>", "onLanguage:<id>", "onView:<id>", "workspaceContains:<glob>" ou "*"' },
			},
			permissions: {
				type: 'array',
				items: { type: 'string', pattern: PERMISSION_PATTERN, hint: 'valores aceitos: workspace.read, workspace.write, workspace.all, editor, webview, clipboard, preview, mcp, network:https://<host>' },
			},
			contributes: {
				type: 'object',
				properties: {
					commands: {
						type: 'array',
						items: {
							type: 'object',
							required: ['command', 'title'],
							properties: {
								command: { type: 'string', pattern: COMMAND_PATTERN },
								title: { type: 'string', minLength: 1, maxLength: 120 },
								category: { type: 'string', maxLength: 60 },
								icon: { type: 'string' },
							},
						},
					},
					keybindings: {
						type: 'array',
						items: {
							type: 'object',
							required: ['command', 'key'],
							properties: {
								command: { type: 'string', pattern: COMMAND_PATTERN },
								key: { type: 'string', minLength: 1, maxLength: 60, hint: 'ex.: "ctrl+alt+m", "shift+f9"' },
								mac: { type: 'string', maxLength: 60 },
								when: { type: 'string', maxLength: 300 },
							},
						},
					},
					menus: {
						type: 'object',
						properties: {
							'editor/context': MENU_ITEMS,
							'explorer/context': MENU_ITEMS,
							commandPalette: MENU_ITEMS,
						},
					},
					languages: {
						type: 'array',
						items: {
							type: 'object',
							required: ['id'],
							properties: {
								id: { type: 'string', pattern: LANGUAGE_ID_PATTERN, hint: 'minúsculas, começando por letra, ex.: "zig"' },
								extensions: { type: 'array', items: { type: 'string', minLength: 1, maxLength: 20, hint: 'ex.: ".zig"' } },
								aliases: { type: 'array', items: { type: 'string', minLength: 1, maxLength: 40 } },
								filenames: { type: 'array', items: { type: 'string', minLength: 1, maxLength: 80 } },
							},
						},
					},
					grammars: {
						type: 'array',
						items: {
							type: 'object',
							required: ['language', 'path'],
							properties: {
								language: { type: 'string', pattern: LANGUAGE_ID_PATTERN },
								path: { type: 'string', pattern: RELATIVE_PATH_PATTERN, hint: 'JSON com a gramática, ex.: "grammars/zig.json"' },
							},
						},
					},
					themes: {
						type: 'array',
						items: {
							type: 'object',
							required: ['label', 'path'],
							properties: {
								label: { type: 'string', minLength: 1, maxLength: 60 },
								uiTheme: { type: 'string', enum: ['dark', 'light'] },
								path: { type: 'string', pattern: RELATIVE_PATH_PATTERN, hint: 'JSON com os tokens do tema, ex.: "themes/noite-ferro.json"' },
							},
						},
					},
					iconThemes: {
						type: 'array',
						items: {
							type: 'object',
							required: ['id', 'label', 'path'],
							properties: {
								id: { type: 'string', pattern: COMMAND_PATTERN },
								label: { type: 'string', minLength: 1, maxLength: 60 },
								path: { type: 'string', pattern: RELATIVE_PATH_PATTERN, hint: 'JSON com iconDefinitions/fileExtensions/fileNames' },
							},
						},
					},
					snippets: {
						type: 'array',
						items: {
							type: 'object',
							required: ['language', 'path'],
							properties: {
								language: { type: 'string', minLength: 1, maxLength: 40 },
								path: { type: 'string', pattern: RELATIVE_PATH_PATTERN, hint: 'JSON no formato { "nome": { "prefix", "body", "description" } }' },
							},
						},
					},
					configuration: { type: 'object', properties: { title: { type: 'string', maxLength: 80 }, properties: { type: 'object' } } },
					views: {
						type: 'object',
						properties: {
							sidebar: {
								type: 'array',
								items: {
									type: 'object',
									required: ['id', 'name'],
									properties: {
										id: { type: 'string', pattern: COMMAND_PATTERN, hint: 'ex.: "exemplo.painel"' },
										name: { type: 'string', minLength: 1, maxLength: 80 },
										icon: { type: 'string', maxLength: 200 },
										when: { type: 'string', maxLength: 300 },
									},
								},
							},
						},
					},
					mcpTools: {
						type: 'array',
						items: {
							type: 'object',
							required: ['name', 'description'],
							properties: {
								name: { type: 'string', pattern: MCP_TOOL_NAME_PATTERN, hint: 'minúsculas, dígitos e "_", começando por letra' },
								title: { type: 'string', maxLength: 80 },
								description: { type: 'string', minLength: 1, maxLength: 600 },
								readOnly: { type: 'boolean' },
								inputSchema: { type: 'object' },
							},
						},
					},
					statusBar: {
						type: 'array',
						items: {
							type: 'object',
							required: ['id'],
							properties: {
								id: { type: 'string', pattern: COMMAND_PATTERN },
								alignment: { type: 'string', enum: ['left', 'right'] },
								priority: { type: 'number' },
								text: { type: 'string', maxLength: 200 },
								tooltip: { type: 'string', maxLength: 300 },
								command: { type: 'string', pattern: COMMAND_PATTERN },
							},
						},
					},
				},
			},
			repository: { type: 'string', maxLength: 500 },
			license: { type: 'string', maxLength: 80 },
			capabilities: {
				type: 'object',
				properties: {
					untrustedWorkspaces: {
						type: 'object',
						required: ['supported'],
						properties: {
							supported: { hint: 'true, false ou "limited"' },
							description: { type: 'string', maxLength: 300 },
						},
					},
				},
			},
		},
	};

	function typeOf(value) {
		if (value === null) return 'null';
		if (Array.isArray(value)) return 'array';
		return typeof value;
	}

	function describePath(path) {
		return path.length ? path.join('.') : '(raiz)';
	}

	function validateNode(schema, value, path, errors) {
		const actualType = typeOf(value);
		if (schema.type && actualType !== schema.type) {
			errors.push({
				path: describePath(path),
				message: `Esperado ${schema.type}, encontrado ${actualType}.` + (schema.hint ? ' Dica: ' + schema.hint + '.' : ''),
			});
			return;
		}
		if (schema.type === 'string') {
			if (schema.minLength !== undefined && value.length < schema.minLength) {
				errors.push({ path: describePath(path), message: `Deve ter pelo menos ${schema.minLength} caractere(s).` });
			}
			if (schema.maxLength !== undefined && value.length > schema.maxLength) {
				errors.push({ path: describePath(path), message: `Deve ter no máximo ${schema.maxLength} caracteres.` });
			}
			if (schema.enum && !schema.enum.includes(value)) {
				errors.push({ path: describePath(path), message: `Valor "${value}" inválido. Aceitos: ${schema.enum.join(', ')}.` });
			}
			if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
				errors.push({ path: describePath(path), message: `Valor "${value}" fora do formato esperado.` + (schema.hint ? ' Dica: ' + schema.hint + '.' : '') });
			}
			return;
		}
		if (schema.type === 'array') {
			if (schema.items) value.forEach((item, index) => validateNode(schema.items, item, path.concat(String(index)), errors));
			return;
		}
		if (schema.type === 'object') {
			(schema.required || []).forEach((key) => {
				if (!(key in value)) errors.push({ path: describePath(path.concat(key)), message: 'Campo obrigatório ausente.' });
			});
			if (schema.properties) {
				Object.keys(schema.properties).forEach((key) => {
					if (key in value) validateNode(schema.properties[key], value[key], path.concat(key), errors);
				});
			}
		}
	}

	function crossChecks(manifest, errors) {
		if (typeof manifest.id === 'string' && typeof manifest.publisher === 'string' && manifest.id.includes('.')) {
			const prefix = manifest.id.split('.')[0];
			if (prefix !== manifest.publisher) {
				errors.push({ path: 'publisher', message: `Deve coincidir com o prefixo do id ("${prefix}").` });
			}
		}
		const commands = manifest.contributes && Array.isArray(manifest.contributes.commands) ? manifest.contributes.commands : [];
		const seen = new Set();
		commands.forEach((entry, index) => {
			if (!entry || typeof entry.command !== 'string') return;
			if (seen.has(entry.command)) {
				errors.push({ path: `contributes.commands.${index}.command`, message: `Comando "${entry.command}" declarado mais de uma vez.` });
			}
			seen.add(entry.command);
		});
		const keybindings = manifest.contributes && Array.isArray(manifest.contributes.keybindings) ? manifest.contributes.keybindings : [];
		keybindings.forEach((entry, index) => {
			if (!entry || typeof entry.command !== 'string') return;
			if (commands.length && !seen.has(entry.command)) {
				errors.push({ path: `contributes.keybindings.${index}.command`, message: `O comando "${entry.command}" não está em contributes.commands.` });
			}
		});
		const statusBar = manifest.contributes && Array.isArray(manifest.contributes.statusBar) ? manifest.contributes.statusBar : [];
		const statusIds = new Set();
		statusBar.forEach((entry, index) => {
			if (!entry || typeof entry.id !== 'string') return;
			if (statusIds.has(entry.id)) errors.push({ path: `contributes.statusBar.${index}.id`, message: `Item "${entry.id}" declarado mais de uma vez.` });
			statusIds.add(entry.id);
		});
		const languages = manifest.contributes && Array.isArray(manifest.contributes.languages) ? manifest.contributes.languages : [];
		const languageIds = new Set();
		languages.forEach((entry, index) => {
			if (!entry || typeof entry.id !== 'string') return;
			if (languageIds.has(entry.id)) errors.push({ path: `contributes.languages.${index}.id`, message: `Linguagem "${entry.id}" declarada mais de uma vez.` });
			languageIds.add(entry.id);
			if (typeof entry.configuration === 'string' && !new RegExp(RELATIVE_PATH_PATTERN).test(entry.configuration)) {
				errors.push({ path: `contributes.languages.${index}.configuration`, message: 'Use um caminho relativo para o JSON de configuração da linguagem.' });
			}
		});
		const untrusted = manifest.capabilities && manifest.capabilities.untrustedWorkspaces;
		if (untrusted && typeof untrusted === 'object' && 'supported' in untrusted && untrusted.supported !== true && untrusted.supported !== false && untrusted.supported !== 'limited') {
			errors.push({ path: 'capabilities.untrustedWorkspaces.supported', message: 'Use true, false ou "limited".' });
		}
		if (Array.isArray(manifest.activationEvents)) {
			manifest.activationEvents.forEach((event, index) => {
				if (typeof event !== 'string' || !event.startsWith('onCommand:')) return;
				const command = event.slice('onCommand:'.length);
				if (commands.length && !seen.has(command)) {
					errors.push({ path: `activationEvents.${index}`, message: `O comando "${command}" não está em contributes.commands.` });
				}
			});
		}
	}

	function normalize(manifest) {
		const contributes = manifest.contributes && typeof manifest.contributes === 'object' ? manifest.contributes : {};
		return Object.freeze({
			id: manifest.id,
			name: manifest.name,
			version: manifest.version,
			publisher: manifest.publisher,
			description: typeof manifest.description === 'string' ? manifest.description : '',
			engines: manifest.engines && typeof manifest.engines === 'object' ? { ...manifest.engines } : { synapse: '*' },
			extensionPack: Array.isArray(manifest.extensionPack) ? [...new Set(manifest.extensionPack.map(String))].filter((id) => id !== manifest.id) : [],
			extensionDependencies: Array.isArray(manifest.extensionDependencies) ? [...new Set(manifest.extensionDependencies.map(String))].filter((id) => id !== manifest.id) : [],
			builtin: manifest.builtin === true,
			main: manifest.main.replace(/^\.\//, ''),
			icon: typeof manifest.icon === 'string' ? manifest.icon : null,
			categories: Array.isArray(manifest.categories) ? [...manifest.categories] : ['Outros'],
			activationEvents: Array.isArray(manifest.activationEvents) ? [...manifest.activationEvents] : [],
			permissions: Array.isArray(manifest.permissions) ? [...manifest.permissions] : [],
			contributes: {
				commands: Array.isArray(contributes.commands) ? contributes.commands.map((entry) => ({ ...entry })) : [],
				keybindings: Array.isArray(contributes.keybindings) ? [...contributes.keybindings] : [],
				menus: contributes.menus && typeof contributes.menus === 'object' ? { ...contributes.menus } : {},
				languages: Array.isArray(contributes.languages) ? [...contributes.languages] : [],
				grammars: Array.isArray(contributes.grammars) ? [...contributes.grammars] : [],
				themes: Array.isArray(contributes.themes) ? contributes.themes.map((entry) => ({ ...entry })) : [],
				iconThemes: Array.isArray(contributes.iconThemes) ? contributes.iconThemes.map((entry) => ({ ...entry })) : [],
				snippets: Array.isArray(contributes.snippets) ? [...contributes.snippets] : [],
				configuration: contributes.configuration && typeof contributes.configuration === 'object' ? JSON.parse(JSON.stringify(contributes.configuration)) : null,
				views: contributes.views && typeof contributes.views === 'object' ? { sidebar: Array.isArray(contributes.views.sidebar) ? contributes.views.sidebar.map((entry) => ({ ...entry })) : [] } : { sidebar: [] },
				statusBar: Array.isArray(contributes.statusBar) ? contributes.statusBar.map((entry) => ({ ...entry })) : [],
				mcpTools: Array.isArray(contributes.mcpTools) ? contributes.mcpTools.map((entry) => JSON.parse(JSON.stringify(entry))) : [],
			},
			repository: typeof manifest.repository === 'string' ? manifest.repository : '',
			license: typeof manifest.license === 'string' ? manifest.license : '',
			capabilities: {
				untrustedWorkspaces: {
					supported: manifest.capabilities && manifest.capabilities.untrustedWorkspaces ? manifest.capabilities.untrustedWorkspaces.supported : false,
					description: manifest.capabilities && manifest.capabilities.untrustedWorkspaces && typeof manifest.capabilities.untrustedWorkspaces.description === 'string' ? manifest.capabilities.untrustedWorkspaces.description : '',
				},
			},
		});
	}

	function validate(manifest) {
		const errors = [];
		if (typeOf(manifest) !== 'object') {
			return { ok: false, errors: [{ path: '(raiz)', message: 'O manifesto deve ser um objeto JSON.' }], manifest: null };
		}
		validateNode(SCHEMA, manifest, [], errors);
		if (!errors.length) crossChecks(manifest, errors);
		return { ok: !errors.length, errors, manifest: errors.length ? null : normalize(manifest) };
	}

	function parse(text) {
		let json;
		try {
			json = JSON.parse(String(text));
		} catch (error) {
			return {
				ok: false,
				errors: [{ path: '(raiz)', message: 'JSON inválido: ' + error.message + '. Verifique vírgulas, aspas e chaves.' }],
				manifest: null,
			};
		}
		return validate(json);
	}

	function formatErrors(errors) {
		return errors.map((error) => `${error.path}: ${error.message}`).join('\n');
	}

	root.SynapseExtensionManifest = Object.freeze({
		FILE_NAME: 'synapse-extension.json',
		CATEGORIES: Object.freeze([...CATEGORIES]),
		SCHEMA: Object.freeze(SCHEMA),
		validate,
		parse,
		normalize,
		formatErrors,
	});
})(typeof self !== 'undefined' ? self : window);
