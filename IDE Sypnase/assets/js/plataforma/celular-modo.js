(function (root) {
	'use strict';

	const STORAGE_KEY = 'synapse.settings.preferences';
	const SETTING_KEY = 'mobileLayoutMode';
	const MODES = ['auto', 'phone', 'desktop'];
	const documentElement = document.documentElement;
	const listeners = new Set();
	let current = readStored();
	let storeBound = false;

	function reportError(error, context) {
		if (typeof root.ignorarErro === 'function') root.ignorarErro(error, 'celular-modo.' + context);
	}

	function normalize(value) {
		return MODES.includes(value) ? value : 'auto';
	}

	function readStored() {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			const parsed = raw ? JSON.parse(raw) : null;
			return normalize(parsed && parsed[SETTING_KEY]);
		} catch (error) {
			reportError(error, 'read');
			return 'auto';
		}
	}

	function reflect() {
		documentElement.setAttribute('data-mobile-mode', current);
	}

	function notify() {
		for (const listener of [...listeners]) {
			try {
				listener(current);
			} catch (error) {
				reportError(error, 'listener');
			}
		}
	}

	function update(value) {
		const next = normalize(value);
		if (next === current) return;
		current = next;
		reflect();
		notify();
	}

	function set(value) {
		const next = normalize(value);
		if (root.SynapseSettingsStore) root.SynapseSettingsStore.set(SETTING_KEY, next);
		update(next);
	}

	function resolve(detectedMobile) {
		if (current === 'phone') return true;
		if (current === 'desktop') return false;
		return !!detectedMobile;
	}

	function bindStore() {
		if (storeBound || !root.SynapseSettingsStore) return;
		storeBound = true;
		update(root.SynapseSettingsStore.get(SETTING_KEY));
		root.SynapseSettingsStore.subscribe((settings) => update(settings[SETTING_KEY]));
	}

	function subscribe(listener) {
		listeners.add(listener);
		return () => listeners.delete(listener);
	}

	reflect();

	root.addEventListener('storage', (event) => {
		if (event.key === STORAGE_KEY || event.key === null) update(readStored());
	});

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', bindStore, { once: true });
	} else {
		bindStore();
	}
	root.addEventListener('load', bindStore, { once: true });

	root.SynapseMobileMode = Object.freeze({
		modes: Object.freeze(MODES.slice()),
		get: () => current,
		set,
		resolve,
		subscribe,
		bindStore,
	});
})(typeof globalThis !== 'undefined' ? globalThis : window);
