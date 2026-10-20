(function (root) {
	'use strict';

	const MAX_ENTRIES = 1000;
	const MAX_DETAIL = 160;
	const entries = [];
	const listeners = new Set();
	const counters = new Map();
	let sequence = 0;
	let flushTimer = 0;

	const CATEGORIES = Object.freeze({
		READ: 'arquivo:leitura',
		WRITE: 'arquivo:escrita',
		NETWORK: 'rede',
		EDITOR: 'editor',
		PREVIEW: 'preview',
		WEBVIEW: 'webview',
		UI: 'interface',
		COMMANDS: 'comandos',
		CONFIG: 'configuracao',
		STATE: 'estado',
		LANGUAGES: 'linguagens',
		MCP: 'mcp',
		SYSTEM: 'sistema',
		SECURITY: 'seguranca',
		OTHER: 'outro',
	});

	const CATEGORY_LABELS = Object.freeze({
		'arquivo:leitura': 'Leitura de arquivos',
		'arquivo:escrita': 'Escrita de arquivos',
		rede: 'Rede',
		editor: 'Editor',
		preview: 'Preview',
		webview: 'Webview',
		interface: 'Interface',
		comandos: 'Comandos',
		configuracao: 'Configuração',
		estado: 'Estado',
		linguagens: 'Linguagens',
		mcp: 'MCP',
		sistema: 'Sistema',
		seguranca: 'Segurança',
		outro: 'Outro',
	});

	const WRITE_METHODS = new Set(['workspace.writeFile', 'workspace.fs.writeFile', 'workspace.fs.createDirectory', 'workspace.fs.delete', 'workspace.fs.rename', 'workspace.applyEdit']);

	function categoryOf(method) {
		const name = String(method || '');
		if (WRITE_METHODS.has(name)) return CATEGORIES.WRITE;
		if (name.startsWith('workspace.')) return CATEGORIES.READ;
		if (name === 'network.fetch') return CATEGORIES.NETWORK;
		if (name.startsWith('editor.')) return CATEGORIES.EDITOR;
		if (name.startsWith('preview.')) return CATEGORIES.PREVIEW;
		if (name.startsWith('webview.')) return CATEGORIES.WEBVIEW;
		if (name.startsWith('window.') || name.startsWith('statusBar.') || name.startsWith('progress.') || name.startsWith('output.') || name.startsWith('env.')) return CATEGORIES.UI;
		if (name.startsWith('commands.')) return CATEGORIES.COMMANDS;
		if (name.startsWith('configuration.')) return CATEGORIES.CONFIG;
		if (name.startsWith('state.')) return CATEGORIES.STATE;
		if (name.startsWith('languages.')) return CATEGORIES.LANGUAGES;
		if (name.startsWith('mcp.')) return CATEGORIES.MCP;
		if (name.startsWith('host.')) return CATEGORIES.SYSTEM;
		return CATEGORIES.OTHER;
	}

	function clip(value) {
		const text = String(value === undefined || value === null ? '' : value);
		return text.length > MAX_DETAIL ? text.slice(0, MAX_DETAIL - 1) + '…' : text;
	}

	function detailOf(method, params) {
		if (!params || typeof params !== 'object') return '';
		if (typeof params.url === 'string') return clip(`${params.method ? params.method + ' ' : ''}${params.url}`);
		if (typeof params.path === 'string') return clip(params.path);
		if (typeof params.uri === 'string') return clip(params.uri);
		if (params.edit && Array.isArray(params.edit.entries)) return clip(params.edit.entries.map((entry) => entry.uri || entry.path).filter(Boolean).join(', '));
		if (Array.isArray(params.edits)) return clip(`${params.edits.length} edição(ões)`);
		if (typeof params.command === 'string') return clip(params.command);
		if (typeof params.key === 'string') return clip(params.key);
		if (typeof params.message === 'string') return clip(params.message);
		if (typeof params.channel === 'string') return clip(`[${params.channel}]`);
		if (typeof params.title === 'string') return clip(params.title);
		if (typeof params.languageId === 'string') return clip(params.languageId);
		if (typeof params.handle === 'string') return clip(params.handle);
		return '';
	}

	function bump(extensionId, category, ok) {
		const key = extensionId || '?';
		const slot = counters.get(key) || { total: 0, failed: 0, byCategory: {} };
		slot.total++;
		if (!ok) slot.failed++;
		slot.byCategory[category] = (slot.byCategory[category] || 0) + 1;
		counters.set(key, slot);
	}

	function schedule() {
		if (flushTimer) return;
		flushTimer = setTimeout(() => {
			flushTimer = 0;
			listeners.forEach((listener) => {
				try {
					listener();
				} catch (error) {}
			});
		}, 120);
	}

	function push(entry) {
		entry.seq = ++sequence;
		entries.push(entry);
		if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
		bump(entry.id, entry.category, entry.ok);
		schedule();
		return entry;
	}

	function record(input) {
		const method = String(input.method || '');
		return push({
			t: input.t || Date.now(),
			kind: 'rpc',
			id: String(input.extensionId || ''),
			method,
			category: input.category || categoryOf(method),
			detail: input.detail !== undefined ? clip(input.detail) : detailOf(method, input.params),
			durationMs: typeof input.durationMs === 'number' ? Math.round(input.durationMs * 10) / 10 : null,
			ok: input.ok !== false,
			code: input.code || null,
			error: input.error ? clip(input.error) : null,
		});
	}

	function denied(extensionId, method, error) {
		return push({
			t: Date.now(),
			kind: 'negado',
			id: String(extensionId || ''),
			method: String(method || ''),
			category: CATEGORIES.SECURITY,
			detail: clip(error && error.data && error.data.permission ? `permissão ${error.data.permission}` : ''),
			durationMs: null,
			ok: false,
			code: error && error.code ? error.code : 'PermissionDenied',
			error: error && error.message ? clip(error.message) : null,
		});
	}

	function security(extensionId, event, message, data) {
		return push({
			t: Date.now(),
			kind: 'seguranca',
			id: String(extensionId || ''),
			method: String(event || ''),
			category: CATEGORIES.SECURITY,
			detail: clip(message || ''),
			durationMs: null,
			ok: !(data && data.severity === 'error'),
			code: data && data.code ? String(data.code) : null,
			error: data && data.severity === 'error' ? clip(message || '') : null,
			data: data && typeof data === 'object' ? JSON.parse(JSON.stringify(data)) : null,
		});
	}

	function list(filter) {
		filter = filter || {};
		let result = entries;
		if (filter.extensionId) result = result.filter((entry) => entry.id === filter.extensionId);
		if (filter.category) result = result.filter((entry) => entry.category === filter.category);
		if (filter.kind) result = result.filter((entry) => entry.kind === filter.kind);
		if (filter.onlyProblems) result = result.filter((entry) => !entry.ok);
		if (filter.since) result = result.filter((entry) => entry.t >= filter.since);
		const limit = filter.limit > 0 ? filter.limit : 0;
		const copy = result.slice(limit ? -limit : 0);
		return filter.newestFirst === false ? copy : copy.reverse();
	}

	function stats(extensionId) {
		if (extensionId) {
			const slot = counters.get(extensionId);
			return slot ? { total: slot.total, failed: slot.failed, byCategory: { ...slot.byCategory } } : { total: 0, failed: 0, byCategory: {} };
		}
		const all = {};
		counters.forEach((slot, id) => {
			all[id] = { total: slot.total, failed: slot.failed, byCategory: { ...slot.byCategory } };
		});
		return all;
	}

	function extensionIds() {
		return [...new Set(entries.map((entry) => entry.id).filter(Boolean))].sort();
	}

	function clear(extensionId) {
		if (extensionId) {
			for (let index = entries.length - 1; index >= 0; index--) if (entries[index].id === extensionId) entries.splice(index, 1);
			counters.delete(extensionId);
		} else {
			entries.length = 0;
			counters.clear();
		}
		schedule();
	}

	function exportJson(filter) {
		const rows = list({ ...(filter || {}), limit: 0, newestFirst: false });
		return JSON.stringify(
			{
				exportedAt: new Date().toISOString(),
				app: 'Synapse IDE',
				appVersion: String(root.SYNAPSE_VERSION || root.APP_VERSION || ''),
				count: rows.length,
				stats: stats(filter && filter.extensionId ? filter.extensionId : undefined),
				entries: rows,
			},
			null,
			2,
		);
	}

	function subscribe(listener) {
		listeners.add(listener);
		return () => listeners.delete(listener);
	}

	root.SynapseExtensionAudit = Object.freeze({
		MAX_ENTRIES,
		CATEGORIES,
		CATEGORY_LABELS,
		categoryOf,
		record,
		denied,
		security,
		list,
		stats,
		extensionIds,
		clear,
		exportJson,
		subscribe,
		get size() {
			return entries.length;
		},
	});
})(window);
