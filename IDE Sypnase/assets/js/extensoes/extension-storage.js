(function (root) {
	'use strict';

	const KEY_PREFIX = 'ext:';
	const FLUSH_DELAY_MS = 150;
	const MAX_BYTES_PER_SCOPE = 2 * 1024 * 1024;
	const timers = new Map();
	const pendingWrites = new Map();

	function readKv(key) {
		return typeof root.sdbGet === 'function' ? root.sdbGet(key) : Promise.resolve(null);
	}

	function writeKv(key, value) {
		return typeof root.sdbPut === 'function' ? root.sdbPut(key, value) : Promise.resolve(false);
	}

	function deleteKv(key) {
		return typeof root.sdbDel === 'function' ? root.sdbDel(key) : Promise.resolve(false);
	}

	function listKeys() {
		return typeof root.sdbKeys === 'function' ? root.sdbKeys() : Promise.resolve([]);
	}

	function storageKey(extensionId, scope, projectId) {
		if (scope === 'workspace') return `${KEY_PREFIX}${extensionId}:ws:${projectId || 'sem-projeto'}`;
		return `${KEY_PREFIX}${extensionId}:global`;
	}

	function plainObject(value) {
		return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
	}

	function byteLength(value) {
		try {
			return new TextEncoder().encode(JSON.stringify(value)).length;
		} catch (error) {
			return Infinity;
		}
	}

	async function load(extensionId, projectId) {
		const [global, workspace] = await Promise.all([
			readKv(storageKey(extensionId, 'global')).catch(() => null),
			readKv(storageKey(extensionId, 'workspace', projectId)).catch(() => null),
		]);
		return { global: plainObject(global), workspace: plainObject(workspace) };
	}

	function schedule(key, value) {
		pendingWrites.set(key, value);
		if (timers.has(key)) clearTimeout(timers.get(key));
		timers.set(
			key,
			setTimeout(() => {
				timers.delete(key);
				const snapshot = pendingWrites.get(key);
				pendingWrites.delete(key);
				writeKv(key, snapshot).catch((error) => {
					if (typeof root.ignorarErro === 'function') root.ignorarErro(error, 'extension-storage');
				});
			}, FLUSH_DELAY_MS),
		);
	}

	function save(extensionId, scope, projectId, bucket) {
		const key = storageKey(extensionId, scope, projectId);
		const size = byteLength(bucket);
		if (size > MAX_BYTES_PER_SCOPE) {
			return { ok: false, reason: `Estado "${scope}" da extensão excede 2 MB (${Math.round(size / 1024)} KB).` };
		}
		schedule(key, JSON.parse(JSON.stringify(bucket)));
		return { ok: true, bytes: size };
	}

	async function flush() {
		const keys = [...timers.keys()];
		keys.forEach((key) => {
			clearTimeout(timers.get(key));
			timers.delete(key);
		});
		await Promise.all(
			keys.map((key) => {
				const snapshot = pendingWrites.get(key);
				pendingWrites.delete(key);
				return writeKv(key, snapshot).catch(() => false);
			}),
		);
	}

	async function clear(extensionId) {
		const prefix = `${KEY_PREFIX}${extensionId}:`;
		const keys = await listKeys().catch(() => []);
		const own = keys.filter((key) => typeof key === 'string' && key.startsWith(prefix));
		await Promise.all(own.map((key) => deleteKv(key).catch(() => false)));
		return own.length;
	}

	root.addEventListener('pagehide', () => {
		flush().catch(() => {});
	});

	root.SynapseExtensionStorage = Object.freeze({ KEY_PREFIX, MAX_BYTES_PER_SCOPE, storageKey, load, save, flush, clear });
})(window);
