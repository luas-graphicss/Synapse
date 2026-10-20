(function (root) {
	'use strict';

	const DEFAULT_REGISTRY = { owner: 'synapse-ide', repo: 'synapse-extensions', branch: 'main', enabled: true, remote: true, local: 'assets/extensoes/registro/' };
	const CONFIG_KEY = 'ext-registry:config';
	const INDEX_KEY = 'ext-registry:index';
	const META_KEY = 'ext-registry:meta';
	const BLOCKLIST_KEY = 'ext-registry:blocklist';
	const PUBLISHER_KEY_PREFIX = 'ext-registry:publisher:';
	const PUBLISHER_TTL_MS = 24 * 60 * 60 * 1000;
	const FETCH_TIMEOUT_MS = 15000;
	const LOCAL_TIMEOUT_MS = 8000;
	const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;
	const STALE_AFTER_MS = 30 * 60 * 1000;
	const ABSOLUTE_URL = /^(https?:|data:|blob:)/i;

	let config = null;
	let cachedIndex = null;
	let cachedMeta = null;
	let loading = null;
	let timer = 0;
	let cachedBlocklist = null;
	let blocklistLoading = null;
	const listeners = new Set();
	const configListeners = new Set();
	const blocklistListeners = new Set();
	const publisherCache = new Map();

	function kvGet(key) {
		return typeof root.sdbGet === 'function' ? root.sdbGet(key) : Promise.resolve(null);
	}

	function kvPut(key, value) {
		return typeof root.sdbPut === 'function' ? root.sdbPut(key, value) : Promise.resolve(false);
	}

	function pkg() {
		return root.SynapseExtensionPackage;
	}

	function output() {
		return root.SynapseExtensionOutput;
	}

	function log(level, message) {
		if (output() && typeof output()[level] === 'function') output()[level]('registro', message);
	}

	async function loadConfig() {
		if (config) return config;
		const stored = await kvGet(CONFIG_KEY).catch(() => null);
		config = { ...DEFAULT_REGISTRY, ...(root.SYNAPSE_EXTENSIONS_REGISTRY || {}), ...(stored && typeof stored === 'object' ? stored : {}) };
		return config;
	}

	function emitConfig(cfg) {
		configListeners.forEach((listener) => {
			try {
				listener(cfg);
			} catch (error) {}
		});
	}

	async function configure(next) {
		const current = await loadConfig();
		config = { ...current, ...(next || {}) };
		await kvPut(CONFIG_KEY, config);
		cachedIndex = null;
		cachedMeta = null;
		emitConfig({ ...config });
		return config;
	}

	function isEnabled() {
		return !config || config.enabled !== false;
	}

	async function setEnabled(flag) {
		return configure({ enabled: flag !== false });
	}

	function onDidChangeConfig(listener) {
		configListeners.add(listener);
		return () => configListeners.delete(listener);
	}

	function sources(cfg, file) {
		const name = file || 'index.json';
		return [
			`https://${cfg.owner}.github.io/${cfg.repo}/${name}`,
			`https://cdn.jsdelivr.net/gh/${cfg.owner}/${cfg.repo}@${cfg.branch}/${name}`,
			`https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch}/${name}`,
		];
	}

	function localBase(cfg) {
		const path = cfg && typeof cfg.local === 'string' ? cfg.local.trim() : '';
		if (!path) return '';
		try {
			return new URL(path.endsWith('/') ? path : path + '/', document.baseURI).href;
		} catch (error) {
			return '';
		}
	}

	function localSources(cfg, file) {
		const base = localBase(cfg);
		return base ? [base + (file || 'index.json')] : [];
	}

	function absoluteUrl(value, base) {
		if (typeof value !== 'string' || !value.trim()) return '';
		if (ABSOLUTE_URL.test(value)) return value;
		try {
			return new URL(value.replace(/^\.\//, ''), base || document.baseURI).href;
		} catch (error) {
			return '';
		}
	}

	function remoteEnabled(cfg) {
		return !cfg || cfg.remote !== false;
	}

	function withTimeout(promise, ms, label) {
		return new Promise((resolve, reject) => {
			const id = setTimeout(() => reject(new Error(`${label}: tempo esgotado (${ms} ms)`)), ms);
			promise.then(
				(value) => {
					clearTimeout(id);
					resolve(value);
				},
				(error) => {
					clearTimeout(id);
					reject(error);
				},
			);
		});
	}

	async function fetchFirst(urls, options) {
		options = options || {};
		const errors = [];
		for (const url of urls) {
			try {
				const headers = {};
				if (options.etag && url === urls[0]) headers['If-None-Match'] = options.etag;
				const response = await withTimeout(fetch(url, { headers, cache: 'no-cache', mode: 'cors' }), options.timeout || FETCH_TIMEOUT_MS, url);
				if (response.status === 304) return { notModified: true, url };
				if (!response.ok) {
					errors.push(`${url} → HTTP ${response.status}`);
					continue;
				}
				return { response, url };
			} catch (error) {
				errors.push(`${url} → ${error && error.message ? error.message : error}`);
			}
		}
		throw new Error('Nenhuma fonte respondeu:\n' + errors.join('\n'));
	}

	function normalizeEntry(entry, base, origin) {
		const versions = entry.versions.map((version) => (version && version.url ? { ...version, url: absoluteUrl(version.url, base) } : version));
		return {
			...entry,
			icon: entry.icon ? absoluteUrl(entry.icon, base) : '',
			origin: entry.origin || origin || 'remote',
			versions,
			latest: entry.latest || versions.map((version) => version.version).sort(pkg().compareVersions).pop(),
		};
	}

	function normalizeIndex(raw, base, origin) {
		const list = Array.isArray(raw) ? raw : raw && Array.isArray(raw.extensions) ? raw.extensions : [];
		const entries = list.filter((entry) => entry && typeof entry.id === 'string' && Array.isArray(entry.versions) && entry.versions.length).map((entry) => normalizeEntry(entry, base, origin));
		return { generatedAt: raw && raw.generatedAt ? raw.generatedAt : null, extensions: entries };
	}

	function mergeIndexes(local, remote) {
		const map = new Map();
		(local ? local.extensions : []).forEach((entry) => map.set(entry.id, entry));
		(remote ? remote.extensions : []).forEach((entry) => map.set(entry.id, entry));
		return { generatedAt: (remote && remote.generatedAt) || (local && local.generatedAt) || null, extensions: [...map.values()] };
	}

	function emit(index) {
		listeners.forEach((listener) => {
			try {
				listener(index);
			} catch (error) {}
		});
	}

	async function readCache() {
		if (cachedIndex) return cachedIndex;
		const [index, meta] = await Promise.all([kvGet(INDEX_KEY).catch(() => null), kvGet(META_KEY).catch(() => null)]);
		cachedMeta = meta && typeof meta === 'object' ? meta : { etag: null, fetchedAt: 0, source: null };
		cachedIndex = index && typeof index === 'object' ? normalizeIndex(index) : null;
		return cachedIndex;
	}

	async function fetchLocalIndex(cfg) {
		const urls = localSources(cfg);
		if (!urls.length) return null;
		const result = await fetchFirst(urls, { timeout: LOCAL_TIMEOUT_MS });
		const index = normalizeIndex(await result.response.json(), localBase(cfg), 'local');
		return { ...index, url: result.url };
	}

	async function fetchRemoteIndex(cfg) {
		if (!remoteEnabled(cfg)) return null;
		const result = await fetchFirst(sources(cfg), { timeout: FETCH_TIMEOUT_MS });
		const index = normalizeIndex(await result.response.json(), null, 'remote');
		return { ...index, url: result.url };
	}

	function reasonOf(settled) {
		if (!settled || settled.status !== 'rejected') return '';
		const error = settled.reason;
		return error && error.message ? error.message : String(error);
	}

	async function fetchIndex(options) {
		options = options || {};
		if (loading) return loading;
		loading = (async () => {
			const cfg = await loadConfig();
			if (cfg.enabled === false) throw new Error('Marketplace desativado. Use "Extensões: Ativar marketplace" para voltar a buscar extensões.');
			const cached = await readCache();
			const fresh = cached && cachedMeta && Date.now() - (cachedMeta.fetchedAt || 0) < STALE_AFTER_MS;
			if (cached && fresh && !options.force) return cached;
			const [localResult, remoteResult] = await Promise.allSettled([fetchLocalIndex(cfg), fetchRemoteIndex(cfg)]);
			const local = localResult.status === 'fulfilled' ? localResult.value : null;
			const remote = remoteResult.status === 'fulfilled' ? remoteResult.value : null;
			const remoteError = reasonOf(remoteResult);
			const localError = reasonOf(localResult);
			if (!local && !remote) {
				const error = new Error([localError, remoteError].filter(Boolean).join('\n') || 'Nenhuma fonte de registro configurada.');
				if (cached) {
					log('warn', `Sem rede para o registro; usando índice em cache. ${error.message}`);
					return cached;
				}
				throw error;
			}
			const index = mergeIndexes(local, remote);
			cachedIndex = index;
			cachedMeta = {
				etag: null,
				fetchedAt: Date.now(),
				source: remote ? remote.url : local.url,
				localSource: local ? local.url : null,
				remoteSource: remote ? remote.url : null,
				remoteError: remoteEnabled(cfg) && !remote ? remoteError : null,
				localCount: local ? local.extensions.length : 0,
				remoteCount: remote ? remote.extensions.length : 0,
			};
			await Promise.all([kvPut(INDEX_KEY, { generatedAt: index.generatedAt, extensions: index.extensions }), kvPut(META_KEY, cachedMeta)]);
			log('info', `Índice atualizado: ${index.extensions.length} extensão(ões) (${cachedMeta.localCount} local, ${cachedMeta.remoteCount} remoto).`);
			if (cachedMeta.remoteError) log('warn', `Registro remoto indisponível; mostrando só o registro local. ${cachedMeta.remoteError.split('\n')[0]}`);
			emit(index);
			fetchBlocklist({ force: true }).catch(() => {});
			return index;
		})();
		try {
			return await loading;
		} finally {
			loading = null;
		}
	}

	function normalizeBlocklist(raw) {
		const list = Array.isArray(raw) ? raw : raw && Array.isArray(raw.entries) ? raw.entries : raw && Array.isArray(raw.blocked) ? raw.blocked : [];
		const entries = list
			.filter((entry) => entry && typeof entry.id === 'string')
			.map((entry) => ({
				id: entry.id,
				versions: Array.isArray(entry.versions) ? entry.versions.map(String) : [],
				sha256: Array.isArray(entry.sha256) ? entry.sha256.map((hash) => String(hash).toLowerCase()) : typeof entry.sha256 === 'string' ? [entry.sha256.toLowerCase()] : [],
				reason: typeof entry.reason === 'string' ? entry.reason : '',
				url: typeof entry.url === 'string' && /^https:\/\//.test(entry.url) ? entry.url : '',
				at: entry.at || entry.blockedAt || null,
			}));
		return { generatedAt: raw && raw.generatedAt ? raw.generatedAt : null, entries };
	}

	function emitBlocklist(blocklist) {
		blocklistListeners.forEach((listener) => {
			try {
				listener(blocklist);
			} catch (error) {}
		});
	}

	async function readBlocklistCache() {
		if (cachedBlocklist) return cachedBlocklist;
		const stored = await kvGet(BLOCKLIST_KEY).catch(() => null);
		cachedBlocklist = stored && typeof stored === 'object' ? normalizeBlocklist(stored.data || stored) : { generatedAt: null, entries: [], fetchedAt: 0 };
		if (stored && stored.fetchedAt) cachedBlocklist.fetchedAt = stored.fetchedAt;
		return cachedBlocklist;
	}

	async function fetchBlocklistFrom(urls) {
		const result = await fetchFirst(urls, { timeout: FETCH_TIMEOUT_MS });
		return normalizeBlocklist(await result.response.json());
	}

	async function fetchBlocklist(options) {
		options = options || {};
		if (blocklistLoading) return blocklistLoading;
		blocklistLoading = (async () => {
			const cfg = await loadConfig();
			const cached = await readBlocklistCache();
			const fresh = cached && Date.now() - (cached.fetchedAt || 0) < STALE_AFTER_MS;
			if (fresh && !options.force) return cached;
			const attempts = [];
			if (localSources(cfg).length) attempts.push(fetchBlocklistFrom(localSources(cfg, 'blocklist.json')).catch(() => null));
			if (remoteEnabled(cfg)) attempts.push(fetchBlocklistFrom(sources(cfg, 'blocklist.json')).catch(() => null));
			const results = (await Promise.all(attempts)).filter(Boolean);
			if (!results.length) {
				cachedBlocklist = cached || { generatedAt: null, entries: [], fetchedAt: 0 };
				cachedBlocklist.fetchedAt = Date.now();
				return cachedBlocklist;
			}
			const merged = new Map();
			results.forEach((list) => list.entries.forEach((entry) => merged.set(`${entry.id}|${entry.versions.join(',')}|${entry.sha256.join(',')}`, entry)));
			const blocklist = { generatedAt: results.map((list) => list.generatedAt).filter(Boolean).sort().pop() || null, entries: [...merged.values()], fetchedAt: Date.now() };
			const changed = JSON.stringify(blocklist.entries) !== JSON.stringify(cached ? cached.entries : []);
			cachedBlocklist = blocklist;
			await kvPut(BLOCKLIST_KEY, { data: { generatedAt: blocklist.generatedAt, entries: blocklist.entries }, fetchedAt: blocklist.fetchedAt });
			if (changed) {
				log('warn', `Lista de bloqueio atualizada: ${blocklist.entries.length} entrada(s).`);
				emitBlocklist(blocklist);
			}
			return blocklist;
		})();
		try {
			return await blocklistLoading;
		} finally {
			blocklistLoading = null;
		}
	}

	function matchBlock(entry, version, sha256) {
		if (!entry.versions.length && !entry.sha256.length) return true;
		if (version && entry.versions.includes(String(version))) return true;
		if (sha256 && entry.sha256.includes(String(sha256).toLowerCase())) return true;
		return false;
	}

	async function isBlocked(id, version, sha256) {
		const blocklist = await readBlocklistCache();
		return blockedIn(blocklist, id, version, sha256);
	}

	function blockedIn(blocklist, id, version, sha256) {
		if (!blocklist || !Array.isArray(blocklist.entries)) return null;
		return blocklist.entries.find((entry) => entry.id === id && matchBlock(entry, version, sha256)) || null;
	}

	function onDidUpdateBlocklist(listener) {
		blocklistListeners.add(listener);
		return () => blocklistListeners.delete(listener);
	}

	function publisherKeyPath(publisher) {
		return `registry/${encodeURIComponent(String(publisher || '').toLowerCase())}/publisher.json`;
	}

	async function fetchPublisherKey(publisher, options) {
		options = options || {};
		const name = String(publisher || '').toLowerCase();
		if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) return null;
		const signing = root.SynapseExtensionSigning;
		if (!signing) return null;
		const memory = publisherCache.get(name);
		if (memory && !options.force && Date.now() - memory.fetchedAt < PUBLISHER_TTL_MS) return memory.key;
		const storageKey = PUBLISHER_KEY_PREFIX + name;
		const stored = await kvGet(storageKey).catch(() => null);
		if (stored && !options.force && Date.now() - (stored.fetchedAt || 0) < PUBLISHER_TTL_MS) {
			const parsed = stored.key ? signing.parsePublisherJson(stored.key) : null;
			publisherCache.set(name, { key: parsed, fetchedAt: stored.fetchedAt });
			return parsed;
		}
		const cfg = await loadConfig();
		const urls = [...localSources(cfg, publisherKeyPath(name)), ...(remoteEnabled(cfg) ? sources(cfg, publisherKeyPath(name)) : [])];
		if (!urls.length) return null;
		try {
			const result = await fetchFirst(urls, { timeout: FETCH_TIMEOUT_MS });
			const raw = await result.response.json();
			const parsed = signing.parsePublisherJson(raw);
			if (parsed && parsed.publisher && parsed.publisher !== name) {
				log('warn', `publisher.json de ${name} declara outro publisher ("${parsed.publisher}"); chave ignorada.`);
				return null;
			}
			publisherCache.set(name, { key: parsed, fetchedAt: Date.now() });
			await kvPut(storageKey, { key: parsed ? raw : null, fetchedAt: Date.now() });
			return parsed;
		} catch (error) {
			if (/HTTP 404/.test(String(error && error.message))) {
				publisherCache.set(name, { key: null, fetchedAt: Date.now() });
				await kvPut(storageKey, { key: null, fetchedAt: Date.now() });
				return null;
			}
			if (stored && stored.key) return signing.parsePublisherJson(stored.key);
			throw error;
		}
	}

	function tokens(text) {
		return String(text || '')
			.toLowerCase()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.split(/[^a-z0-9+#.]+/)
			.filter((token) => token.length > 1);
	}

	function score(entry, query) {
		const haystack = tokens([entry.id, entry.displayName, entry.name, entry.publisher, entry.description, ...(entry.tags || []), ...(entry.categories || [])].join(' '));
		let total = 0;
		for (const term of query) {
			if (entry.id.toLowerCase() === term || (entry.name || '').toLowerCase() === term) total += 10;
			else if (haystack.includes(term)) total += 4;
			else if (haystack.some((token) => token.startsWith(term))) total += 2;
			else if (haystack.some((token) => token.includes(term))) total += 1;
			else return 0;
		}
		return total;
	}

	async function search(text, options) {
		const index = await fetchIndex(options);
		const query = tokens(text);
		const list = index.extensions.slice();
		if (!query.length) return list.sort((a, b) => String(a.displayName || a.id).localeCompare(String(b.displayName || b.id)));
		return list
			.map((entry) => ({ entry, score: score(entry, query) }))
			.filter((item) => item.score > 0)
			.sort((a, b) => b.score - a.score)
			.map((item) => item.entry);
	}

	async function find(id) {
		const index = await fetchIndex();
		return index.extensions.find((entry) => entry.id === id) || null;
	}

	function versionOf(entry, version) {
		const wanted = version || entry.latest;
		return entry.versions.find((item) => item.version === wanted) || null;
	}

	function downloadUrls(entry, versionInfo) {
		const urls = [];
		if (versionInfo.url) urls.push(absoluteUrl(versionInfo.url));
		const gh = pkg().githubOwner(entry.repository);
		if (gh && entry.origin !== 'local') {
			const tag = versionInfo.tag || `v${versionInfo.version}`;
			const file = versionInfo.url ? versionInfo.url.split('/').pop() : `${entry.id}-${versionInfo.version}.sx`;
			urls.push(`https://cdn.jsdelivr.net/gh/${gh.owner}/${gh.repo}@${tag}/dist/${file}`);
			urls.push(`https://cdn.jsdelivr.net/gh/${gh.owner}/${gh.repo}@${tag}/${file}`);
		}
		return [...new Set(urls.filter(Boolean))];
	}

	async function downloadBytes(urls, options) {
		const result = await fetchFirst(urls, { timeout: 60000, ...(options || {}) });
		const buffer = await result.response.arrayBuffer();
		return { bytes: new Uint8Array(buffer), url: result.url };
	}

	async function releaseAssets(owner, repo, tag) {
		const attempts = [
			async () => {
				const response = await withTimeout(fetch(`https://api.github.com/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(tag)}`, { headers: { Accept: 'application/vnd.github+json' } }), FETCH_TIMEOUT_MS, 'GitHub API');
				if (!response.ok) throw new Error(`GitHub API HTTP ${response.status}`);
				const json = await response.json();
				return (json.assets || []).filter((asset) => /\.sx$/i.test(asset.name)).map((asset) => asset.browser_download_url);
			},
			async () => {
				const response = await withTimeout(fetch(`https://data.jsdelivr.com/v1/package/gh/${owner}/${repo}@${encodeURIComponent(tag)}/flat`), FETCH_TIMEOUT_MS, 'jsDelivr API');
				if (!response.ok) throw new Error(`jsDelivr API HTTP ${response.status}`);
				const json = await response.json();
				return (json.files || []).filter((file) => /\.sx$/i.test(file.name)).map((file) => `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${tag}${file.name}`);
			},
		];
		const errors = [];
		for (const attempt of attempts) {
			try {
				const urls = await attempt();
				if (urls.length) return urls;
			} catch (error) {
				errors.push(error.message);
			}
		}
		throw new Error(`Nenhum .sx encontrado em ${owner}/${repo}@${tag}. ${errors.join(' · ')}`);
	}

	function parseReference(text) {
		const value = String(text || '').trim();
		if (!value) return null;
		if (/^https?:\/\//i.test(value)) {
			const release = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/releases\/tag\/([^/?#]+)/i.exec(value);
			if (release) return { type: 'github', owner: release[1].toLowerCase(), repo: release[2], tag: decodeURIComponent(release[3]) };
			return { type: 'url', url: value };
		}
		const gh = /^(?:github:)?([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)@([^\s]+)$/.exec(value);
		if (gh) return { type: 'github', owner: gh[1].toLowerCase(), repo: gh[2], tag: gh[3] };
		const plain = /^([a-z0-9][a-z0-9-]*\.[a-z0-9][a-z0-9-]*)(?:@([^\s]+))?$/.exec(value);
		if (plain) return { type: 'registry', id: plain[1], version: plain[2] || null };
		return null;
	}

	function isStale() {
		return !cachedMeta || Date.now() - (cachedMeta.fetchedAt || 0) > REFRESH_INTERVAL_MS;
	}

	function schedulePeriodicRefresh(callback) {
		if (timer) clearInterval(timer);
		timer = setInterval(() => {
			if (navigator.onLine === false || !isEnabled()) return;
			fetchIndex({ force: true })
				.then((index) => callback && callback(index))
				.catch(() => {});
		}, REFRESH_INTERVAL_MS);
		root.addEventListener('online', () => {
			if (isStale() && isEnabled()) fetchIndex({ force: true }).then((index) => callback && callback(index)).catch(() => {});
		});
	}

	function onDidUpdateIndex(listener) {
		listeners.add(listener);
		return () => listeners.delete(listener);
	}

	function meta() {
		return cachedMeta ? { ...cachedMeta } : null;
	}

	root.SynapseExtensionMarketplace = Object.freeze({
		DEFAULT_REGISTRY: Object.freeze({ ...DEFAULT_REGISTRY }),
		loadConfig,
		configure,
		isEnabled,
		setEnabled,
		onDidChangeConfig,
		sources,
		localSources,
		localBase,
		absoluteUrl,
		fetchIndex,
		readCache,
		search,
		find,
		versionOf,
		downloadUrls,
		downloadBytes,
		releaseAssets,
		parseReference,
		schedulePeriodicRefresh,
		onDidUpdateIndex,
		meta,
		isStale,
		fetchBlocklist,
		readBlocklistCache,
		isBlocked,
		blockedIn,
		onDidUpdateBlocklist,
		fetchPublisherKey,
		publisherKeyPath,
	});
})(window);
