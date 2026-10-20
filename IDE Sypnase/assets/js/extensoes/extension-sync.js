(function (root) {
	'use strict';

	const FORMAT = 'synapse.extensions-sync';
	const FORMAT_VERSION = 1;
	const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
	const FETCH_TIMEOUT_MS = 20000;

	function registry() {
		return root.SynapseExtensions;
	}

	function installer() {
		return root.SynapseExtensionInstaller;
	}

	function configuration() {
		return root.SynapseExtensionConfiguration;
	}

	function output() {
		return root.SynapseExtensionOutput;
	}

	function toast(title, message, kind) {
		if (typeof root.toast === 'function') root.toast(title, message, kind || 'ok');
	}

	function appVersion() {
		return String(root.SYNAPSE_VERSION || root.APP_VERSION || '');
	}

	function ownedConfiguration() {
		if (!configuration() || typeof configuration().snapshot !== 'function') return {};
		const snapshot = configuration().snapshot() || {};
		const result = {};
		Object.keys(snapshot).forEach((key) => {
			const owner = typeof configuration().ownerOf === 'function' ? configuration().ownerOf(key) : null;
			if (owner) result[key] = snapshot[key];
		});
		return result;
	}

	function snapshot() {
		const installed = installer() ? installer().list() : [];
		const extensions = (registry() ? registry().list() : [])
			.filter((item) => item.source !== 'builtin' && item.source !== 'dev')
			.map((item) => {
				const record = installed.find((entry) => entry.id === item.id);
				return {
					id: item.id,
					version: item.version,
					enabled: item.enabled,
					enablementScope: item.enablementScope || 'global',
					url: record && record.url ? record.url : null,
				};
			});
		return {
			format: FORMAT,
			formatVersion: FORMAT_VERSION,
			exportedAt: new Date().toISOString(),
			synapse: appVersion(),
			extensions,
			configuration: ownedConfiguration(),
		};
	}

	function serialize() {
		return JSON.stringify(snapshot(), null, 2);
	}

	function fileName() {
		return `synapse-extensoes-${new Date().toISOString().slice(0, 10)}.json`;
	}

	function download() {
		const text = serialize();
		const blob = new Blob([text], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = fileName();
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
		setTimeout(() => URL.revokeObjectURL(url), 2000);
		return text;
	}

	async function copyToClipboard() {
		const text = serialize();
		await navigator.clipboard.writeText(text);
		return text;
	}

	function parse(text) {
		if (typeof text !== 'string' || !text.trim()) throw new Error('Arquivo vazio.');
		if (text.length > MAX_IMPORT_BYTES) throw new Error('Arquivo grande demais para importar.');
		let data;
		try {
			data = JSON.parse(text);
		} catch (error) {
			throw new Error('JSON inválido.');
		}
		if (!data || data.format !== FORMAT) throw new Error('Este JSON não é uma exportação de extensões da Synapse.');
		if (Number(data.formatVersion) > FORMAT_VERSION) throw new Error(`Formato v${data.formatVersion} é mais novo que o suportado (v${FORMAT_VERSION}).`);
		return {
			extensions: Array.isArray(data.extensions) ? data.extensions.filter((entry) => entry && typeof entry.id === 'string') : [],
			configuration: data.configuration && typeof data.configuration === 'object' ? data.configuration : {},
			exportedAt: data.exportedAt || '',
			synapse: data.synapse || '',
		};
	}

	function normalizeUrl(text) {
		const raw = String(text || '').trim();
		let url;
		try {
			url = new URL(raw);
		} catch (error) {
			throw new Error('URL inválida.');
		}
		if (url.protocol !== 'https:') throw new Error('Só é possível importar de URLs https.');
		if (url.hostname === 'gist.github.com') {
			const parts = url.pathname.split('/').filter(Boolean);
			if (parts.length >= 2) return `https://gist.githubusercontent.com/${parts[0]}/${parts[1]}/raw`;
		}
		if (url.hostname === 'github.com' && url.pathname.includes('/blob/')) {
			return url.href.replace('https://github.com/', 'https://raw.githubusercontent.com/').replace('/blob/', '/');
		}
		return url.href;
	}

	async function fetchFromUrl(text) {
		const url = normalizeUrl(text);
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
		try {
			const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
			if (!response.ok) throw new Error(`HTTP ${response.status} ao baixar ${url}`);
			return await response.text();
		} finally {
			clearTimeout(timer);
		}
	}

	function describe(plan) {
		const present = new Set(registry() ? registry().list().map((item) => item.id) : []);
		const toInstall = plan.extensions.filter((entry) => !present.has(entry.id));
		const toToggle = plan.extensions.filter((entry) => present.has(entry.id));
		const keys = Object.keys(plan.configuration);
		return {
			toInstall,
			toToggle,
			configurationKeys: keys,
			text: [`${toInstall.length} extensão(ões) para instalar`, `${toToggle.length} já instalada(s) (estado será sincronizado)`, `${keys.length} configuração(ões)`].join('\n'),
		};
	}

	async function apply(plan, options) {
		options = options || {};
		const summary = describe(plan);
		const result = { installed: [], failed: [], toggled: 0, configured: 0 };
		for (const entry of summary.toInstall) {
			try {
				if (!installer()) throw new Error('Instalador indisponível.');
				await installer().installFromRegistry(entry.id, undefined, { silent: true, origin: 'sync-import' });
				result.installed.push(entry.id);
			} catch (error) {
				result.failed.push({ id: entry.id, error: error && error.message ? error.message : String(error) });
			}
		}
		if (registry()) {
			for (const entry of plan.extensions) {
				const item = registry().get(entry.id);
				if (!item || item.source === 'builtin') continue;
				if (typeof entry.enabled === 'boolean' && item.enabled !== entry.enabled) {
					try {
						await registry().setEnabled(entry.id, entry.enabled, 'global');
						result.toggled += 1;
					} catch (error) {}
				}
			}
		}
		if (configuration() && typeof configuration().set === 'function') {
			Object.keys(plan.configuration).forEach((key) => {
				try {
					const outcome = configuration().set(key, plan.configuration[key], 'sync-import');
					if (!outcome || outcome.ok !== false) result.configured += 1;
				} catch (error) {}
			});
		}
		if (output()) {
			output().command('synapse.sync', `Importação: ${result.installed.length} instalada(s), ${result.toggled} alternada(s), ${result.configured} configuração(ões).`);
			result.failed.forEach((entry) => output().warn('synapse.sync', `Falha ao instalar ${entry.id}: ${entry.error}`));
		}
		if (!options.silent) {
			if (result.failed.length) toast('Importação parcial', `${result.failed.length} extensão(ões) não puderam ser instaladas.`, 'warn');
			else toast('Extensões sincronizadas', `${result.installed.length} instalada(s), ${result.configured} configuração(ões) aplicada(s).`, 'ok');
		}
		return result;
	}

	async function confirmImport(plan, origin) {
		const summary = describe(plan);
		if (typeof root.uiConfirm !== 'function') return true;
		const when = plan.exportedAt ? `Exportado em ${new Date(plan.exportedAt).toLocaleString()}${plan.synapse ? ` (Synapse ${plan.synapse})` : ''}.` : '';
		return root.uiConfirm('Importar extensões', `${origin ? `Origem: ${origin}\n` : ''}${when}\n\n${summary.text}\n\nCada extensão nova passa pelas mesmas verificações de uma instalação normal.`, 'Importar', false);
	}

	async function importText(text, origin) {
		const plan = parse(text);
		const approved = await confirmImport(plan, origin);
		if (!approved) return null;
		return apply(plan, {});
	}

	async function importFromUrl(url) {
		const text = await fetchFromUrl(url);
		return importText(text, normalizeUrl(url));
	}

	function pickFile() {
		return new Promise((resolve) => {
			const input = document.createElement('input');
			input.type = 'file';
			input.accept = 'application/json,.json';
			input.addEventListener('change', () => {
				const file = input.files && input.files[0];
				if (!file) return resolve(null);
				file.text().then((text) => resolve({ text, name: file.name })).catch(() => resolve(null));
			});
			input.click();
		});
	}

	async function importFromFile() {
		const picked = await pickFile();
		if (!picked) return null;
		return importText(picked.text, picked.name);
	}

	async function importInteractive() {
		if (typeof root.uiPrompt === 'function') {
			const answer = await root.uiPrompt('Importar extensões', 'Cole uma URL https (arquivo raw ou Gist) ou deixe vazio para escolher um arquivo .json.', '');
			if (answer === null || answer === undefined) return null;
			if (String(answer).trim()) return importFromUrl(answer);
		}
		return importFromFile();
	}

	root.SynapseExtensionSync = Object.freeze({
		FORMAT,
		FORMAT_VERSION,
		snapshot,
		serialize,
		download,
		copyToClipboard,
		parse,
		describe,
		importText,
		importFromUrl,
		importFromFile,
		importInteractive,
	});
})(window);
