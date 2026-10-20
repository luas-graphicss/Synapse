(function (root) {
	'use strict';

	const SLOW_ACTIVATION_MS = 150;
	const STARTUP_WINDOW_MS = 4000;
	const HISTORY_KEY = 'synapse.extensions.perf.v1';
	const HISTORY_LIMIT = 10;

	const samples = new Map();
	const listeners = new Set();
	const startupAt = performance.now();
	let startupClosesAt = null;

	function registry() {
		return root.SynapseExtensions;
	}

	function kvGet(key) {
		try {
			const raw = root.localStorage.getItem(key);
			return raw ? JSON.parse(raw) : null;
		} catch (error) {
			return null;
		}
	}

	function kvPut(key, value) {
		try {
			root.localStorage.setItem(key, JSON.stringify(value));
		} catch (error) {}
	}

	function history() {
		const data = kvGet(HISTORY_KEY);
		return data && typeof data === 'object' ? data : {};
	}

	function remember(id, durationMs, atStartup) {
		const data = history();
		const entry = data[id] && typeof data[id] === 'object' ? data[id] : { runs: [] };
		entry.runs = (Array.isArray(entry.runs) ? entry.runs : []).concat([{ ms: durationMs, startup: atStartup, t: Date.now() }]).slice(-HISTORY_LIMIT);
		data[id] = entry;
		kvPut(HISTORY_KEY, data);
	}

	function averageOf(id) {
		const entry = history()[id];
		if (!entry || !Array.isArray(entry.runs) || !entry.runs.length) return null;
		return Math.round(entry.runs.reduce((sum, run) => sum + Number(run.ms || 0), 0) / entry.runs.length);
	}

	function inStartupWindow() {
		const limit = startupClosesAt !== null ? startupClosesAt : startupAt + STARTUP_WINDOW_MS;
		return performance.now() <= limit;
	}

	function emit() {
		listeners.forEach((listener) => {
			try {
				listener(report());
			} catch (error) {}
		});
	}

	function observe(list) {
		let changed = false;
		list.forEach((item) => {
			if (item.status !== 'active' || typeof item.activationTimeMs !== 'number') return;
			const known = samples.get(item.id);
			if (known && known.ms === item.activationTimeMs && known.version === item.version) return;
			const atStartup = inStartupWindow();
			samples.set(item.id, { id: item.id, name: item.name, ms: item.activationTimeMs, startup: atStartup, version: item.version, t: Date.now() });
			remember(item.id, item.activationTimeMs, atStartup);
			changed = true;
		});
		if (changed) emit();
	}

	function report() {
		const entries = [...samples.values()].map((sample) => ({ ...sample, average: averageOf(sample.id), slow: sample.ms >= SLOW_ACTIVATION_MS }));
		const startup = entries.filter((entry) => entry.startup);
		return {
			threshold: SLOW_ACTIVATION_MS,
			entries: entries.sort((a, b) => b.ms - a.ms),
			startup: startup.sort((a, b) => b.ms - a.ms),
			slowAtStartup: startup.filter((entry) => entry.slow),
			startupTotalMs: startup.reduce((sum, entry) => sum + entry.ms, 0),
		};
	}

	function slowAtStartup() {
		return report().slowAtStartup;
	}

	function isSlow(id) {
		const sample = samples.get(id);
		return !!(sample && sample.startup && sample.ms >= SLOW_ACTIVATION_MS);
	}

	function onDidChange(listener) {
		listeners.add(listener);
		return () => listeners.delete(listener);
	}

	function bind() {
		if (!registry()) return;
		registry().onDidChange((list) => observe(Array.isArray(list) ? list : registry().list()));
		observe(registry().list());
	}

	root.SynapseExtensionPerf = Object.freeze({
		SLOW_ACTIVATION_MS,
		STARTUP_WINDOW_MS,
		report,
		slowAtStartup,
		isSlow,
		averageOf,
		onDidChange,
	});

	if (root.SynapseExtensions) bind();
	else root.addEventListener('load', bind, { once: true });
	root.addEventListener('load', () => (startupClosesAt = performance.now() + STARTUP_WINDOW_MS), { once: true });
})(window);
