(function (root) {
	'use strict';

	const actions = new Map();

	function catalog() {
		return root.SynapseShortcutCatalog;
	}

	function bindings() {
		return root.SynapseShortcutBindings;
	}

	function register(entries) {
		const list = (Array.isArray(entries) ? entries : [entries]).filter((entry) => entry && typeof entry.id === 'string' && typeof entry.run === 'function');
		if (!list.length) return 0;
		catalog().register(
			list.map((entry) => ({
				id: entry.id,
				label: entry.label || entry.id,
				group: entry.group || 'workspace',
				defaultBinding: entry.defaultBinding || '',
				worksWithOverlay: entry.worksWithOverlay !== false,
				source: entry.source || 'Synapse',
				when: entry.when || '',
			})),
		);
		list.forEach((entry) => actions.set(entry.id, entry.run));
		if (bindings()) bindings().refresh();
		return list.length;
	}

	function unregister(ids) {
		const list = Array.isArray(ids) ? ids : [ids];
		list.forEach((id) => actions.delete(id));
		catalog().unregister(list);
		if (bindings()) bindings().refresh();
	}

	function run(id) {
		const action = actions.get(id);
		if (!action) return false;
		try {
			return action() === true;
		} catch (error) {
			if (typeof root.ignorarErro === 'function') root.ignorarErro(error, 'shortcut.native');
			return false;
		}
	}

	function has(id) {
		return actions.has(id);
	}

	root.SynapseNativeShortcuts = Object.freeze({ register, unregister, run, has });
})(typeof globalThis !== 'undefined' ? globalThis : window);
