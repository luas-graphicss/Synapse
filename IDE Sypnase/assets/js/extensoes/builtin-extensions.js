(function (root) {
	'use strict';

	const SOURCE = 'builtin';
	const BASE_PATH = 'assets/extensoes/embutidas/';
	const MANIFEST_FILE = 'synapse-extension.json';
	const EXTRA_FILES = ['README.md', 'CHANGELOG.md', 'LICENSE'];
	const BINARY_FILE = /\.(png|jpe?g|gif|webp|avif|ico|bmp|woff2?|ttf|otf)$/i;
	const BUILTIN_IDS = Object.freeze(['synapse.bug-report', 'synapse.sort-lines', 'synapse.todo-highlighter']);

	const loaded = new Map();
	let bootstrapPromise = null;

	function registry() {
		return root.SynapseExtensions;
	}

	function output() {
		return root.SynapseExtensionOutput;
	}

	function baseUrl() {
		try {
			return new URL(BASE_PATH, document.baseURI).href;
		} catch (error) {
			return BASE_PATH;
		}
	}

	async function fetchText(url, optional) {
		try {
			const response = await fetch(url, { cache: 'no-cache' });
			if (!response.ok) {
				if (optional) return null;
				throw new Error(`HTTP ${response.status}`);
			}
			return await response.text();
		} catch (error) {
			if (optional) return null;
			throw error;
		}
	}

	async function fetchBytes(url, optional) {
		try {
			const response = await fetch(url, { cache: 'no-cache' });
			if (!response.ok) {
				if (optional) return null;
				throw new Error(`HTTP ${response.status}`);
			}
			return new Uint8Array(await response.arrayBuffer());
		} catch (error) {
			if (optional) return null;
			throw error;
		}
	}

	function collectPaths(manifest) {
		const paths = new Set([manifest.main]);
		if (manifest.icon) paths.add(manifest.icon);
		const contributes = manifest.contributes || {};
		(contributes.grammars || []).forEach((entry) => entry && entry.path && paths.add(entry.path));
		(contributes.snippets || []).forEach((entry) => entry && entry.path && paths.add(entry.path));
		(contributes.themes || []).forEach((entry) => entry && entry.path && paths.add(entry.path));
		(contributes.iconThemes || []).forEach((entry) => entry && entry.path && paths.add(entry.path));
		(contributes.languages || []).forEach((entry) => entry && entry.configuration && paths.add(entry.configuration));
		(Array.isArray(manifest.files) ? manifest.files : []).forEach((path) => paths.add(path));
		return [...paths].map((path) => String(path).replace(/^\.\//, ''));
	}

	async function loadOne(id) {
		const folder = baseUrl() + id + '/';
		const manifestText = await fetchText(folder + MANIFEST_FILE, false);
		const manifest = JSON.parse(manifestText);
		if (manifest.id !== id) throw new Error(`manifesto declara "${manifest.id}", esperado "${id}".`);
		const files = new Map();
		files.set(MANIFEST_FILE, manifestText);
		const required = collectPaths(manifest);
		for (const path of required) {
			const optional = path === manifest.icon;
			const content = BINARY_FILE.test(path) ? await fetchBytes(folder + path, optional) : await fetchText(folder + path, optional);
			if (content !== null) files.set(path, content);
		}
		for (const path of EXTRA_FILES) {
			const text = await fetchText(folder + path, true);
			if (text !== null) files.set(path, text);
		}
		const summary = await registry().register({ manifest: { ...manifest, builtin: true }, files, source: SOURCE, folder: BASE_PATH + id + '/' });
		loaded.set(id, { id, manifest, folder: BASE_PATH + id + '/', status: summary.status });
		return summary;
	}

	async function loadAll() {
		if (!registry()) return [];
		const results = [];
		for (const id of BUILTIN_IDS) {
			try {
				results.push(await loadOne(id));
			} catch (error) {
				loaded.set(id, { id, manifest: null, folder: BASE_PATH + id + '/', status: 'error', error: error && error.message ? error.message : String(error) });
				if (output()) output().error(id, `Extensão embutida não carregou: ${error && error.message ? error.message : error}`);
			}
		}
		return results;
	}

	function bootstrap() {
		if (bootstrapPromise) return bootstrapPromise;
		bootstrapPromise = loadAll();
		return bootstrapPromise;
	}

	function isBuiltin(id) {
		return BUILTIN_IDS.includes(String(id || ''));
	}

	function list() {
		return BUILTIN_IDS.map((id) => {
			const entry = loaded.get(id);
			return entry ? { ...entry } : { id, manifest: null, folder: BASE_PATH + id + '/', status: 'pending' };
		});
	}

	function ready() {
		return bootstrapPromise || Promise.resolve([]);
	}

	root.SynapseBuiltinExtensions = Object.freeze({
		SOURCE,
		BASE_PATH,
		BUILTIN_IDS,
		isBuiltin,
		bootstrap,
		ready,
		list,
		reload: loadOne,
	});

	if (document.readyState === 'complete') setTimeout(bootstrap, 0);
	else root.addEventListener('load', () => setTimeout(bootstrap, 0), { once: true });
})(window);
