(function (root) {
	'use strict';

	const URI_SCHEME = 'synapse-extension://';
	const items = new Map();
	const paletteCommands = [];
	const ENABLEMENT_KEY = 'ext-enablement';
	const FAILURE_WINDOW_MS = 60000;
	const FAILURE_THRESHOLD = 5;
	const PROBE_TIMEOUT_MS = 3000;
	const MAX_ICON_BYTES = 1024 * 1024;
	const ICON_MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml', ico: 'image/x-icon', bmp: 'image/bmp' };
	const changeListeners = new Set();
	const projectListeners = new Set();
	let startupFinished = false;
	let enablement = { global: [], projects: {} };
	let enablementLoading = null;

	function activation() {
		return root.SynapseExtensionActivation;
	}

	function output() {
		return root.SynapseExtensionOutput;
	}

	function storage() {
		return root.SynapseExtensionStorage;
	}

	function configuration() {
		return root.SynapseExtensionConfiguration;
	}

	function keybindings() {
		return root.SynapseExtensionKeybindings;
	}

	function windowApi() {
		return root.SynapseExtensionWindow;
	}

	function menus() {
		return root.SynapseExtensionMenus;
	}

	function workspaceHost() {
		return root.SynapseExtensionWorkspace;
	}

	function editorHost() {
		return root.SynapseExtensionEditor;
	}

	function languagesHost() {
		return root.SynapseExtensionLanguages;
	}

	function webviewsHost() {
		return root.SynapseExtensionWebviews;
	}

	function themesHost() {
		return root.SynapseExtensionThemes;
	}

	function trust() {
		return root.SynapseWorkspaceTrust;
	}

	function audit() {
		return root.SynapseExtensionAudit;
	}

	function compat() {
		return root.SynapseExtensionCompat;
	}

	function dependencies() {
		return root.SynapseExtensionDependencies;
	}

	function mcpTools() {
		return root.SynapseExtensionMcpTools;
	}

	function toast(title, message, kind) {
		if (typeof root.toast === 'function') root.toast(title, message, kind || 'warn');
	}

	function stateSlot() {
		const state = root.State;
		if (!state) return null;
		if (!state.extensions) state.extensions = { items: [], errors: [], startupFinished: false };
		return state.extensions;
	}

	function base64Of(bytes) {
		let binary = '';
		for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(offset, offset + 0x8000));
		return btoa(binary);
	}

	function buildIconUrl(item) {
		const path = String(item.manifest.icon || '').replace(/^\.\//, '');
		if (!path) return '';
		if (/^(https?:|data:image\/|blob:)/i.test(path)) return path;
		const value = item.files.get(path);
		if (value === undefined || value === null) return '';
		const mime = ICON_MIME[path.split('.').pop().toLowerCase()];
		if (!mime) return '';
		if (typeof value === 'string') return mime === 'image/svg+xml' ? `data:${mime};charset=utf-8,${encodeURIComponent(value)}` : '';
		const bytes = value instanceof Uint8Array ? value : new Uint8Array(value.buffer || value);
		if (!bytes.length || bytes.length > MAX_ICON_BYTES) return '';
		try {
			return `data:${mime};base64,${base64Of(bytes)}`;
		} catch (error) {
			return '';
		}
	}

	function iconUrlOf(item) {
		if (item.iconUrl === undefined) item.iconUrl = buildIconUrl(item);
		return item.iconUrl;
	}

	function summary(item) {
		return {
			id: item.id,
			name: item.manifest.name,
			version: item.manifest.version,
			publisher: item.manifest.publisher,
			source: item.source,
			projectId: item.projectId,
			folder: item.folder,
			status: item.status,
			error: item.error ? item.error.message : null,
			activationTimeMs: item.activationTimeMs,
			enabled: item.status !== 'disabled',
			enablementScope: enablementOf(item.id),
			blocked: item.blocked ? { ...item.blocked } : null,
			quarantine: item.quarantine ? { ...item.quarantine } : null,
			restricted: item.status === 'restricted',
			untrustedSupport: trust() ? trust().supportsUntrusted(item.manifest) : false,
			failures: item.failures.length,
			description: item.manifest.description || '',
			categories: Array.isArray(item.manifest.categories) ? [...item.manifest.categories] : [],
			license: item.manifest.license || '',
			repository: item.manifest.repository || '',
			icon: iconUrlOf(item),
			iconPath: item.manifest.icon || '',
			activationEvents: item.activationEvents.map((event) => event.raw),
			permissions: [...item.manifest.permissions],
			commands: [...item.commands.keys()],
			menus: menus() ? menus().list(item.id) : [],
			builtin: item.source === 'builtin',
			extensionPack: [...(item.manifest.extensionPack || [])],
			extensionDependencies: [...(item.manifest.extensionDependencies || [])],
			unmetDependencies: dependencies() ? dependencies().unmetDependencies(item.manifest) : [],
			supportWarning: compat() ? compat().supportProblem(item.manifest) : null,
			deprecations: compat() ? compat().listFor(item.id) : [],
			mcpTools: mcpTools() ? mcpTools().listFor(item.id).map((tool) => tool.publicName) : [],
		};
	}

	function syncState() {
		const slot = stateSlot();
		if (slot) {
			slot.items = [...items.values()].map(summary);
			slot.startupFinished = startupFinished;
		}
		changeListeners.forEach((listener) => {
			try {
				listener();
			} catch (error) {}
		});
	}

	function onDidChange(listener) {
		changeListeners.add(listener);
		return () => changeListeners.delete(listener);
	}

	function onDidChangeProject(listener) {
		projectListeners.add(listener);
		return () => projectListeners.delete(listener);
	}

	function kvGet(key) {
		return typeof root.sdbGet === 'function' ? root.sdbGet(key) : Promise.resolve(null);
	}

	function kvPut(key, value) {
		return typeof root.sdbPut === 'function' ? root.sdbPut(key, value) : Promise.resolve(false);
	}

	function loadEnablement() {
		if (enablementLoading) return enablementLoading;
		enablementLoading = kvGet(ENABLEMENT_KEY)
			.then((stored) => {
				if (stored && typeof stored === 'object') {
					enablement = {
						global: Array.isArray(stored.global) ? stored.global.filter((entry) => typeof entry === 'string') : [],
						projects: stored.projects && typeof stored.projects === 'object' ? stored.projects : {},
					};
				}
				return enablement;
			})
			.catch(() => enablement);
		return enablementLoading;
	}

	function activeProjectId() {
		const project = typeof root.activeProject === 'function' ? root.activeProject() : null;
		return project ? String(project.id) : '';
	}

	function enablementOf(id) {
		if (enablement.global.includes(id)) return 'global';
		const projectId = activeProjectId();
		const list = projectId ? enablement.projects[projectId] : null;
		if (Array.isArray(list) && list.includes(id)) return 'workspace';
		return null;
	}

	function isEnabled(id) {
		return enablementOf(id) === null;
	}

	const GATED = new Set(['disabled', 'blocked', 'restricted']);

	function trustVerdict(item) {
		if (!trust()) return { allowed: true };
		const project = projectFor(item.id);
		return trust().allowsExtension(item.manifest, project ? project.id : null, item.source);
	}

	function gateOf(item) {
		if (item.blocked) return 'blocked';
		if (enablementOf(item.id) !== null) return 'disabled';
		if (!trustVerdict(item).allowed) return 'restricted';
		return null;
	}

	function gateMessage(item, gate) {
		if (gate === 'blocked') return `Bloqueada pelo registro${item.blocked && item.blocked.reason ? ': ' + item.blocked.reason : '.'}`;
		if (gate === 'restricted') return trustVerdict(item).reason || 'Projeto restrito.';
		return 'Desabilitada.';
	}

	async function applyEnablement(item) {
		const gate = gateOf(item);
		if (gate && item.status !== gate) {
			if (!GATED.has(item.status)) {
				await deactivate(item.id);
				unregisterContributions(item);
			}
			setStatus(item, gate);
			output().command(item.id, gateMessage(item, gate));
			return true;
		}
		if (!gate && GATED.has(item.status)) {
			registerContributions(item);
			setStatus(item, 'inactive');
			output().command(item.id, 'Habilitada.');
			await evaluateActivation(item);
			return true;
		}
		return false;
	}

	function pruneFailures(item, now) {
		item.failures = item.failures.filter((t) => now - t < FAILURE_WINDOW_MS);
	}

	async function quarantine(item, reason, code) {
		if (item.quarantine) return;
		item.quarantine = { reason, code: code || 'instability', t: Date.now(), failures: item.failures.length };
		item.failures = [];
		const message = `Extensão ${item.manifest.name} foi desativada por instabilidade: ${reason}`;
		output().error(item.id, message);
		if (audit()) audit().security(item.id, 'kill-switch', message, { severity: 'error', code: item.quarantine.code });
		toast('Extensão desativada por instabilidade', `${item.manifest.name}: ${reason}`, 'err');
		if (item.host) {
			try {
				item.host.terminate();
			} catch (error) {}
			item.host = null;
		}
		if (windowApi()) windowApi().disposeAll(item.id);
		if (workspaceHost()) workspaceHost().disposeAll(item.id);
		if (editorHost()) editorHost().disposeAll(item.id);
		if (languagesHost()) languagesHost().disposeAll(item.id);
		if (webviewsHost()) webviewsHost().disposeAll(item.id);
		item.workerCommands.clear();
		item.error = { message, phase: 'kill-switch', t: Date.now() };
		setStatus(item, 'error');
	}

	async function probeAfterTimeout(item, error) {
		if (!item.host || !error || error.code !== root.SynapseExtensionRpc.ERROR_CODES.TIMEOUT) return false;
		const alive = await item.host.probe(PROBE_TIMEOUT_MS);
		if (alive) return false;
		await quarantine(item, `não respondeu em ${PROBE_TIMEOUT_MS} ms após "${error.data && error.data.method ? error.data.method : 'chamada'}" expirar (loop infinito ou travamento).`, 'unresponsive');
		return true;
	}

	function setBlocked(id, info) {
		const item = items.get(id);
		if (!item) return false;
		const next = info && typeof info === 'object' ? { reason: String(info.reason || ''), url: String(info.url || ''), versions: Array.isArray(info.versions) ? info.versions.slice() : [], at: Date.now() } : null;
		const changed = !!next !== !!item.blocked;
		item.blocked = next;
		if (next && audit()) audit().security(item.id, 'blocklist', `Bloqueada pelo registro: ${next.reason || 'sem motivo informado'}`, { severity: 'error', code: 'blocklist' });
		applyEnablement(item)
			.then(() => syncState())
			.catch(() => {});
		return changed;
	}

	async function setEnabled(id, enabled, scope) {
		await loadEnablement();
		const projectId = activeProjectId();
		const workspace = scope === 'workspace' && !!projectId;
		if (enabled) {
			enablement.global = enablement.global.filter((entry) => entry !== id);
			Object.keys(enablement.projects).forEach((key) => {
				const list = (enablement.projects[key] || []).filter((entry) => entry !== id);
				if (list.length) enablement.projects[key] = list;
				else delete enablement.projects[key];
			});
		} else if (workspace) {
			const list = enablement.projects[projectId] || [];
			if (!list.includes(id)) list.push(id);
			enablement.projects[projectId] = list;
		} else if (!enablement.global.includes(id)) enablement.global.push(id);
		await kvPut(ENABLEMENT_KEY, enablement);
		const item = items.get(id);
		if (item) await applyEnablement(item);
		syncState();
		return { id, enabled: !!enabled, scope: enabled ? null : workspace ? 'workspace' : 'global' };
	}

	function recordError(item, error, phase) {
		const message = error && error.message ? error.message : String(error);
		item.error = { message, phase: phase || 'runtime', t: Date.now() };
		const slot = stateSlot();
		if (slot) {
			slot.errors.push({ id: item.id, message, phase: item.error.phase, t: item.error.t });
			if (slot.errors.length > 200) slot.errors.splice(0, slot.errors.length - 200);
		}
		output().error(item.id, `[${item.error.phase}] ${message}`);
		if (error && error.data && error.data.stack) output().info(item.id, String(error.data.stack).split('\n').slice(0, 6).join('\n'));
		const now = item.error.t;
		item.failures.push(now);
		pruneFailures(item, now);
		syncState();
		if (item.failures.length >= FAILURE_THRESHOLD && !item.quarantine && (item.status === 'active' || item.status === 'activating')) {
			quarantine(item, `${item.failures.length} falhas em ${Math.round(FAILURE_WINDOW_MS / 1000)} s (última: ${message.slice(0, 120)})`, 'instability').catch(() => {});
		}
	}

	function setStatus(item, status) {
		item.status = status;
		syncState();
	}

	function uiKind() {
		const html = document.documentElement.classList;
		return html.contains('aurora-mobile') || html.contains('aurora-narrow') ? 'celular' : 'desktop';
	}

	function env(item) {
		const project = projectFor(item.id);
		return {
			language: document.documentElement.lang || 'pt',
			appVersion: String(root.SYNAPSE_VERSION || root.APP_VERSION || ''),
			appRoot: String(root.location.href).split(/[?#]/)[0].replace(/[^/]*$/, ''),
			uiKind: uiKind(),
			projectName: project ? project.name : '',
			projectId: project ? project.id : null,
		};
	}

	function projectFor(id) {
		const item = items.get(id);
		const state = root.State;
		if (!state) return null;
		if (item && item.projectId) {
			const own = state.projects.find((project) => project.id === item.projectId);
			if (own) return own;
		}
		return typeof root.activeProject === 'function' ? root.activeProject() : null;
	}

	function commandsOf(manifest) {
		const map = new Map();
		manifest.contributes.commands.forEach((entry) => map.set(entry.command, entry));
		return map;
	}

	function createItem(descriptor) {
		const manifest = descriptor.manifest;
		return {
			id: manifest.id,
			manifest,
			uri: URI_SCHEME + manifest.id + '/',
			source: descriptor.source || 'dev',
			projectId: descriptor.projectId || null,
			folder: descriptor.folder || '',
			files: descriptor.files instanceof Map ? descriptor.files : new Map(Object.entries(descriptor.files || {})),
			capabilities: root.SynapseExtensionPermissions.capabilitiesFor(manifest),
			activationEvents: activation().resolve(manifest),
			commands: commandsOf(manifest),
			workerCommands: new Set(),
			status: 'inactive',
			error: null,
			activationTimeMs: null,
			iconUrl: undefined,
			host: null,
			storage: { global: {}, workspace: {} },
			activating: null,
			failures: [],
			quarantine: null,
			blocked: null,
		};
	}

	function hostDescriptor(item) {
		return {
			id: item.id,
			uri: item.uri,
			manifest: item.manifest,
			files: item.files,
			capabilities: item.capabilities,
			env: env(item),
			colorTheme: themesHost() && typeof themesHost().snapshot === 'function' ? themesHost().snapshot() : null,
			globalState: item.storage.global,
			workspaceState: item.storage.workspace,
			configuration: configuration() ? configuration().snapshot() : {},
			keybindings: keybindings() ? keybindings().listFor(item.id).map((entry) => ({ command: entry.command, binding: entry.binding, when: entry.when })) : [],
			...(workspaceHost() ? workspaceHost().initialPayload(item) : { documents: [], projects: [] }),
			activeEditor: editorHost() ? editorHost().initialPayload(item) : null,
		};
	}

	function handlers() {
		return root.SynapseExtensionHostApi.createHandlers({ registry: api, output: output() });
	}

	async function activate(id, reason) {
		const item = items.get(id);
		if (!item) throw new Error(`Extensão "${id}" não registrada.`);
		if (item.status === 'disabled') throw new Error(`Extensão "${id}" está desabilitada.`);
		if (item.blocked) throw new Error(`Extensão "${id}" está bloqueada pelo registro${item.blocked.reason ? ': ' + item.blocked.reason : '.'}`);
		const verdict = trustVerdict(item);
		if (!verdict.allowed) {
			setStatus(item, 'restricted');
			throw new Error(`Extensão "${id}" não pode ser ativada: ${verdict.reason}`);
		}
		if (item.quarantine && reason !== 'manual') throw new Error(`Extensão "${id}" está em quarentena por instabilidade. Reative manualmente no painel de extensões.`);
		if (item.status === 'active') return item;
		if (item.activating) return item.activating;
		item.activating = (async () => {
			if (reason === 'manual' && item.quarantine) {
				item.quarantine = null;
				item.failures = [];
				if (audit()) audit().security(item.id, 'kill-switch.reset', 'Quarentena removida manualmente.', {});
			}
			item.error = null;
			setStatus(item, 'activating');
			if (dependencies() && item.manifest.extensionDependencies.length) {
				try {
					await dependencies().activateDependencies(item.manifest, reason || null);
				} catch (error) {
					recordError(item, error, 'dependencies');
					setStatus(item, 'error');
					item.activating = null;
					throw error;
				}
			}
			if (storage()) {
				const project = projectFor(item.id);
				item.storage = await storage().load(item.id, project ? project.id : null);
			}
			const host = root.SynapseExtensionHost.create(hostDescriptor(item), handlers(), {
				onError: (error, phase) => recordError(item, error, phase),
			});
			item.host = host;
			try {
				await host.load();
				const result = await host.activate(reason || null);
				item.activationTimeMs = result && typeof result.durationMs === 'number' ? result.durationMs : 0;
				setStatus(item, 'active');
				if (webviewsHost()) webviewsHost().refreshViews();
				output().command(item.id, `Ativada em ${item.activationTimeMs} ms` + (reason ? ` (${reason})` : '') + '.');
				return item;
			} catch (error) {
				recordError(item, error, 'activate');
				setStatus(item, 'error');
				if (webviewsHost()) webviewsHost().refreshViews();
				host.terminate();
				item.host = null;
				if (typeof root.toast === 'function') root.toast('Extensão com erro', `${item.manifest.name}: ${error.message}`, 'err');
				throw error;
			} finally {
				item.activating = null;
			}
		})();
		return item.activating;
	}

	async function deactivate(id) {
		const item = items.get(id);
		if (!item) return false;
		if (item.activating) {
			try {
				await item.activating;
			} catch (error) {
				return false;
			}
		}
		if (item.host) {
			await item.host.deactivate();
			item.host = null;
		}
		if (windowApi()) windowApi().disposeAll(id);
		if (workspaceHost()) workspaceHost().disposeAll(id);
		if (editorHost()) editorHost().disposeAll(id);
		if (languagesHost()) languagesHost().disposeAll(id);
		if (webviewsHost()) webviewsHost().disposeAll(id);
		if (mcpTools()) mcpTools().disposeAll(id);
		if (compat()) compat().clear(id);
		if (storage()) await storage().flush();
		item.workerCommands.clear();
		if (item.status !== 'error') setStatus(item, 'inactive');
		output().command(item.id, 'Desativada.');
		return true;
	}

	async function register(descriptor) {
		const validation = root.SynapseExtensionManifest.validate(descriptor.manifest);
		if (!validation.ok) throw new Error('Manifesto inválido:\n' + root.SynapseExtensionManifest.formatErrors(validation.errors));
		const manifest = validation.manifest;
		if (items.has(manifest.id)) await unregister(manifest.id);
		const item = createItem({ ...descriptor, manifest });
		if (descriptor.blocked) item.blocked = { ...descriptor.blocked };
		items.set(item.id, item);
		await loadEnablement();
		if (trust()) await trust().load();
		const gate = gateOf(item);
		if (gate) item.status = gate;
		else registerContributions(item);
		syncState();
		const events = item.activationEvents.map((event) => activation().describe(event)).join('; ');
		output().command(item.id, `Registrada (${item.source}) v${manifest.version} — ${gate ? gateMessage(item, gate).toLowerCase() : `ativa ${events || 'nunca'}`}`);
		item.capabilities.errors.forEach((message) => output().warn(item.id, message));
		const support = compat() ? compat().supportProblem(manifest) : null;
		if (support) output().warn(item.id, support);
		if (!gate) await evaluateActivation(item);
		return summary(item);
	}

	async function unregister(id) {
		const item = items.get(id);
		if (!item) return false;
		await deactivate(id);
		unregisterContributions(item);
		items.delete(id);
		syncState();
		return true;
	}

	function registerContributions(item) {
		if (configuration() && item.manifest.contributes.configuration) {
			const section = configuration().register(item.id, item.manifest.name, item.manifest.contributes.configuration);
			section.errors.forEach((message) => output().warn(item.id, `contributes.configuration: ${message}`));
		}
		if (keybindings()) keybindings().register(item.id, item.manifest);
		if (menus()) menus().register(item.id, item.manifest);
		if (languagesHost()) languagesHost().register(item);
		if (webviewsHost()) webviewsHost().registerViews(item);
		if (themesHost()) themesHost().register(item);
	}

	function unregisterContributions(item) {
		if (configuration()) configuration().unregister(item.id);
		if (keybindings()) keybindings().unregister(item.id);
		if (menus()) menus().unregister(item.id);
		if (languagesHost()) languagesHost().unregister(item);
		if (webviewsHost()) webviewsHost().unregisterViews(item);
		if (themesHost()) themesHost().unregister(item);
	}

	function broadcast(method, params, predicate) {
		let delivered = 0;
		items.forEach((item) => {
			if (!item.host || item.status !== 'active') return;
			if (typeof predicate === 'function' && !predicate(item)) return;
			if (item.host.notify(method, params)) delivered++;
		});
		return delivered;
	}

	async function evaluateActivation(item) {
		const kinds = activation().KINDS;
		if (item.status !== 'inactive') return;
		if (startupFinished && activation().matches(item.activationEvents, kinds.STARTUP)) {
			await activate(item.id, kinds.STARTUP).catch(() => {});
			return;
		}
		const project = projectFor(item.id);
		if (project && activation().matches(item.activationEvents, kinds.WORKSPACE_CONTAINS, [...project.files.keys()])) {
			await activate(item.id, kinds.WORKSPACE_CONTAINS).catch(() => {});
		}
	}

	async function fireActivationEvent(kind, value) {
		const pending = [...items.values()].filter(
			(item) => item.status === 'inactive' && activation().matches(item.activationEvents, kind, value),
		);
		for (const item of pending) {
			await activate(item.id, value ? `${kind}:${value}` : kind).catch(() => {});
		}
		return pending.length;
	}

	function notifyStartupFinished() {
		if (startupFinished) return;
		startupFinished = true;
		syncState();
		fireActivationEvent(activation().KINDS.STARTUP);
	}

	function notifyFileOpened(path) {
		const languages = root.SynapseEditorLanguages;
		const languageId = languages && typeof languages.fromPath === 'function' ? languages.fromPath(path) : null;
		if (workspaceHost()) workspaceHost().notifyDocumentOpened(typeof root.activeProject === 'function' ? root.activeProject() : null, path);
		if (languageId) fireActivationEvent(activation().KINDS.LANGUAGE, languageId);
	}

	function notifyProjectChanged() {
		if (workspaceHost()) workspaceHost().notifyProjectsChanged();
		[...items.values()].forEach((item) =>
			applyEnablement(item)
				.then(() => evaluateActivation(item))
				.catch(() => {}),
		);
		projectListeners.forEach((listener) => {
			try {
				listener(typeof root.activeProject === 'function' ? root.activeProject() : null);
			} catch (error) {}
		});
	}

	function notifyExtension(id, method, params) {
		const item = items.get(id);
		if (!item || !item.host || item.status !== 'active') return false;
		return item.host.notify(method, params);
	}

	function requestExtension(id, method, params, options) {
		const item = items.get(id);
		if (!item || !item.host || item.status !== 'active') {
			const rpc = root.SynapseExtensionRpc;
			return Promise.reject(new rpc.RpcError(rpc.ERROR_CODES.DISPOSED, `Extensão "${id}" não está em execução.`));
		}
		return item.host.request(method, params, options).catch(async (error) => {
			if (error && error.code === root.SynapseExtensionRpc.ERROR_CODES.TIMEOUT) {
				recordError(item, error, 'request:' + method);
				await probeAfterTimeout(item, error);
			}
			throw error;
		});
	}

	function ownerOf(command) {
		for (const item of items.values()) {
			if (item.commands.has(command) || item.workerCommands.has(command)) return item;
		}
		return null;
	}

	async function executeCommand(command, ...args) {
		const item = ownerOf(command);
		if (!item) throw new Error(`Nenhuma extensão fornece o comando "${command}".`);
		if (item.status !== 'active') await activate(item.id, `${activation().KINDS.COMMAND}:${command}`);
		if (!item.host) throw new Error(`Extensão "${item.id}" não está em execução.`);
		try {
			return await item.host.executeCommand(command, args);
		} catch (error) {
			recordError(item, error, 'command:' + command);
			const killed = await probeAfterTimeout(item, error);
			if (!killed && typeof root.toast === 'function') root.toast('Falha no comando da extensão', `${item.manifest.name}: ${error.message}`, 'err');
			throw error;
		}
	}

	function commandIds(filterInternal) {
		const ids = new Set();
		items.forEach((item) => {
			item.commands.forEach((entry, command) => ids.add(command));
			item.workerCommands.forEach((command) => ids.add(command));
		});
		if (!filterInternal) {
			paletteCommands.forEach((factory) => {
				const entry = typeof factory === 'function' ? factory() : factory;
				if (entry && entry.id) ids.add(entry.id);
			});
		}
		return [...ids];
	}

	function trackWorkerCommand(id, command, registered) {
		const item = items.get(id);
		if (!item) return;
		if (registered) item.workerCommands.add(command);
		else item.workerCommands.delete(command);
		syncState();
	}

	function updateState(id, scope, key, value) {
		const item = items.get(id);
		if (!item) return { ok: false, reason: 'Extensão não registrada.' };
		const bucket = scope === 'workspace' ? item.storage.workspace : item.storage.global;
		if (value === undefined || value === null) delete bucket[key];
		else bucket[key] = value;
		if (!storage()) return { ok: true };
		const project = projectFor(id);
		const result = storage().save(id, scope === 'workspace' ? 'workspace' : 'global', project ? project.id : null, bucket);
		if (!result.ok) {
			delete bucket[key];
			output().warn(id, result.reason);
		}
		return result;
	}

	function reportPermissionDenied(id, error) {
		const item = items.get(id);
		if (!item) return;
		recordError(item, error, 'permissão');
		output().show();
		if (typeof root.toast === 'function') {
			root.toast('Permissão negada', `${item.manifest.name}: ${error.data ? error.data.permission : ''}`, 'warn');
		}
	}

	function paletteEntry(item, command, entry) {
		const title = entry ? (entry.category ? `${entry.category}: ${entry.title}` : entry.title) : command;
		const shortcut = keybindings() ? keybindings().bindingLabel(item.id, command) : '';
		return {
			id: `ext:${item.id}:${command}`,
			label: title,
			hint: `extensão · ${item.manifest.name}` + (shortcut ? ` · ${shortcut}` : ''),
			icon: (entry && entry.icon) || 'command',
			run: () => executeCommand(command).catch(() => {}),
		};
	}

	function commands() {
		const list = paletteCommands.map((factory) => (typeof factory === 'function' ? factory() : factory)).filter(Boolean);
		items.forEach((item) => {
			if (GATED.has(item.status) || item.quarantine) return;
			const inPalette = (command) => !menus() || menus().paletteAllows(item.id, command);
			item.commands.forEach((entry, command) => {
				if (inPalette(command)) list.push(paletteEntry(item, command, entry));
			});
			item.workerCommands.forEach((command) => {
				if (!item.commands.has(command) && inPalette(command)) list.push(paletteEntry(item, command, null));
			});
		});
		return list;
	}

	function registerPaletteCommand(entryOrFactory) {
		paletteCommands.push(entryOrFactory);
		return () => {
			const index = paletteCommands.indexOf(entryOrFactory);
			if (index !== -1) paletteCommands.splice(index, 1);
		};
	}

	function list() {
		return [...items.values()].map(summary);
	}

	function ids() {
		return [...items.keys()];
	}

	function has(id) {
		return items.has(id);
	}

	function get(id) {
		const item = items.get(id);
		return item ? summary(item) : null;
	}

	function manifestOf(id) {
		const item = items.get(id);
		return item ? item.manifest : null;
	}

	function filesOf(id) {
		const item = items.get(id);
		return item ? item.files : null;
	}

	const api = Object.freeze({
		URI_SCHEME,
		register,
		unregister,
		activate,
		deactivate,
		executeCommand,
		fireActivationEvent,
		notifyStartupFinished,
		notifyFileOpened,
		notifyProjectChanged,
		commands,
		commandIds,
		broadcast,
		notifyExtension,
		requestExtension,
		uiKind,
		registerPaletteCommand,
		trackWorkerCommand,
		updateState,
		reportPermissionDenied,
		projectFor,
		list,
		ids,
		has,
		get,
		manifestOf,
		filesOf,
		onDidChange,
		onDidChangeProject,
		setEnabled,
		isEnabled,
		enablementOf,
		loadEnablement,
		setBlocked,
		applyGates: () => Promise.all([...items.values()].map((item) => applyEnablement(item).catch(() => {}))),
		FAILURE_THRESHOLD,
		FAILURE_WINDOW_MS,
		get startupFinished() {
			return startupFinished;
		},
	});

	root.SynapseExtensions = api;
	stateSlot();
	if (workspaceHost()) workspaceHost().bootstrap();

	if (configuration()) {
		configuration().subscribe((change) => {
			if (!change || change.registration || !change.keys || !change.keys.length) return;
			broadcast('configuration.changed', { keys: change.keys, values: configuration().snapshot() });
		});
	}

	if (themesHost() && typeof themesHost().onDidChange === 'function') {
		themesHost().onDidChange((theme) => broadcast('window.colorThemeChanged', theme));
	}

	if (trust() && typeof trust().onDidChange === 'function') {
		trust().onDidChange(() => api.applyGates().then(syncState));
	}

	if (document.readyState === 'complete') setTimeout(notifyStartupFinished, 0);
	else root.addEventListener('load', () => setTimeout(notifyStartupFinished, 0), { once: true });
})(window);
