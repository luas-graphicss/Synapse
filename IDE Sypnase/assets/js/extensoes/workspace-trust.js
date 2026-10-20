(function (root) {
	'use strict';

	const KEY = 'ext-workspace-trust';
	const CONFIG_PATH = '.synapse/extensions.json';
	const listeners = new Set();
	let store = { projects: {} };
	let loading = null;

	function tr(text) {
		return typeof root.tr === 'function' ? root.tr(text) : text;
	}

	function kvGet(key) {
		return typeof root.sdbGet === 'function' ? root.sdbGet(key) : Promise.resolve(null);
	}

	function kvPut(key, value) {
		return typeof root.sdbPut === 'function' ? root.sdbPut(key, value) : Promise.resolve(false);
	}

	function audit() {
		return root.SynapseExtensionAudit;
	}

	function projects() {
		return root.State && Array.isArray(root.State.projects) ? root.State.projects : [];
	}

	function activeProject() {
		return typeof root.activeProject === 'function' ? root.activeProject() : null;
	}

	function projectById(projectId) {
		if (!projectId) return null;
		return projects().find((project) => String(project.id) === String(projectId)) || null;
	}

	function load() {
		if (loading) return loading;
		loading = kvGet(KEY)
			.then((stored) => {
				if (stored && typeof stored === 'object' && stored.projects && typeof stored.projects === 'object') store = { projects: { ...stored.projects } };
				return store;
			})
			.catch(() => store);
		return loading;
	}

	function projectRestrictedByConfig(project) {
		if (!project || !project.files || typeof project.files.get !== 'function') return false;
		const entry = project.files.get(CONFIG_PATH);
		const text = entry && typeof entry.text === 'string' ? entry.text : typeof entry === 'string' ? entry : '';
		if (!text) return false;
		try {
			const parsed = JSON.parse(text);
			return parsed && (parsed.restricted === true || parsed.trust === 'restricted');
		} catch (error) {
			return false;
		}
	}

	function emit(project) {
		listeners.forEach((listener) => {
			try {
				listener(project);
			} catch (error) {}
		});
	}

	function stateOf(projectId) {
		const project = projectById(projectId);
		const stored = store.projects[String(projectId)];
		if (projectRestrictedByConfig(project)) return { trusted: false, source: 'config' };
		if (stored && typeof stored.trusted === 'boolean') return { trusted: stored.trusted, source: 'user', at: stored.at || 0 };
		return { trusted: true, source: 'default' };
	}

	function isTrusted(projectId) {
		const id = projectId === undefined ? (activeProject() ? activeProject().id : null) : projectId;
		if (id === null || id === undefined) return true;
		return stateOf(id).trusted;
	}

	function isActiveTrusted() {
		return isTrusted(undefined);
	}

	async function setTrusted(projectId, trusted) {
		await load();
		const id = String(projectId);
		const project = projectById(id);
		if (projectRestrictedByConfig(project) && trusted) return { ok: false, reason: tr('Este projeto declara "restricted": true em .synapse/extensions.json e não pode ser marcado como confiável.') };
		store.projects[id] = { trusted: !!trusted, name: project ? project.name : '', at: Date.now() };
		await kvPut(KEY, store);
		if (audit()) audit().security('', trusted ? 'trust.granted' : 'trust.restricted', `${project ? project.name : id}: ${trusted ? tr('projeto marcado como confiável') : tr('projeto restrito')}`, { projectId: id });
		emit(project);
		return { ok: true, trusted: !!trusted };
	}

	function supportsUntrusted(manifest) {
		const capabilities = manifest && manifest.capabilities && manifest.capabilities.untrustedWorkspaces;
		if (!capabilities) return false;
		return capabilities.supported === true || capabilities.supported === 'limited';
	}

	function allowsExtension(manifest, projectId, source) {
		if (source === 'builtin') return { allowed: true };
		const id = projectId === undefined || projectId === null ? (activeProject() ? activeProject().id : null) : projectId;
		if (id === null || id === undefined) return { allowed: true };
		const state = stateOf(id);
		if (state.trusted) return { allowed: true };
		if (supportsUntrusted(manifest)) return { allowed: true, limited: manifest.capabilities.untrustedWorkspaces.supported === 'limited' };
		return { allowed: false, reason: tr('Projeto restrito: a extensão não declara suporte a projetos não confiáveis (capabilities.untrustedWorkspaces).') };
	}

	function describe(projectId) {
		const id = projectId === undefined ? (activeProject() ? activeProject().id : null) : projectId;
		const state = id === null || id === undefined ? { trusted: true, source: 'default' } : stateOf(id);
		return {
			projectId: id,
			trusted: state.trusted,
			source: state.source,
			label: state.trusted ? tr('Projeto confiável') : tr('Projeto restrito'),
			explanation: state.trusted
				? tr('Todas as extensões habilitadas podem ser ativadas neste projeto.')
				: state.source === 'config'
					? tr('Restrito por .synapse/extensions.json. Só extensões que suportam projetos não confiáveis são ativadas.')
					: tr('Só extensões que declaram suporte a projetos não confiáveis são ativadas.'),
		};
	}

	async function prompt(projectId) {
		const project = projectId === undefined ? activeProject() : projectById(projectId);
		if (!project) {
			if (typeof root.toast === 'function') root.toast(tr('Nenhum projeto aberto'), tr('Abra um projeto para gerenciar a confiança.'), 'warn');
			return null;
		}
		const current = describe(project.id);
		if (typeof root.uiDialog !== 'function') return null;
		const result = await root.uiDialog({
			title: tr('Confiança do projeto'),
			message: `${project.name}\n${current.label} — ${current.explanation}\n\n${tr('Em projetos restritos, extensões de terceiros não são ativadas, a menos que declarem suporte explícito. Use isso ao abrir projetos de origem desconhecida.')}`,
			buttons: [
				{ id: 'cancel', label: tr('Cancelar') },
				{ id: 'restrict', label: tr('Restringir'), primary: !current.trusted },
				{ id: 'trust', label: tr('Confiar'), primary: current.trusted },
			],
		});
		if (!result || result.act === 'cancel') return null;
		const outcome = await setTrusted(project.id, result.act === 'trust');
		if (!outcome.ok && typeof root.toast === 'function') root.toast(tr('Não foi possível alterar'), outcome.reason, 'warn');
		else if (typeof root.toast === 'function') root.toast(tr('Confiança do projeto'), result.act === 'trust' ? tr('Projeto marcado como confiável.') : tr('Projeto restrito: extensões sem suporte foram desativadas.'), 'ok');
		return outcome;
	}

	function onDidChange(listener) {
		listeners.add(listener);
		return () => listeners.delete(listener);
	}

	function registerCommands() {
		const registry = root.SynapseExtensions;
		if (registry && typeof registry.registerPaletteCommand === 'function') {
			registry.registerPaletteCommand(() => ({ id: 'synapse.extensions.trust', label: tr('Extensões: Confiança do projeto…'), hint: tr('confiar ou restringir extensões neste projeto'), icon: 'lock', run: () => prompt() }));
		}
		if (root.SynapseNativeShortcuts && typeof root.SynapseNativeShortcuts.register === 'function') {
			root.SynapseNativeShortcuts.register([{ id: 'synapse.extensions.trust', label: tr('Confiança do projeto'), defaultBinding: '', category: tr('Extensões'), run: () => prompt() }]);
		}
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', registerCommands, { once: true });
	else setTimeout(registerCommands, 0);
	load();

	root.SynapseWorkspaceTrust = Object.freeze({
		CONFIG_PATH,
		load,
		isTrusted,
		isActiveTrusted,
		stateOf,
		setTrusted,
		supportsUntrusted,
		allowsExtension,
		describe,
		prompt,
		onDidChange,
	});
})(window);
