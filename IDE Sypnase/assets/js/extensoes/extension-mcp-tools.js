(function (root) {
	'use strict';

	const PREFIX = 'ext_';
	const NAME_PATTERN = /^[a-z][a-z0-9_]{0,47}$/;
	const CALL_TIMEOUT_MS = 60000;
	const MAX_TOOLS_PER_EXTENSION = 24;
	const MAX_RESULT_CHARS = 200000;

	const tools = new Map();
	const listeners = new Set();

	function registry() {
		return root.SynapseExtensions;
	}

	function output() {
		return root.SynapseExtensionOutput;
	}

	function audit() {
		return root.SynapseExtensionAudit;
	}

	function rpc() {
		return root.SynapseExtensionRpc;
	}

	function fail(code, message, data) {
		const api = rpc();
		return new api.RpcError(api.ERROR_CODES[code] || code, message, data);
	}

	function catalog() {
		if (typeof MCP_TOOLS !== 'undefined' && Array.isArray(MCP_TOOLS)) return MCP_TOOLS;
		return typeof root.MCP_TOOLS !== 'undefined' && Array.isArray(root.MCP_TOOLS) ? root.MCP_TOOLS : null;
	}

	function slug(text) {
		return String(text || '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_+|_+$/g, '');
	}

	function publicName(extensionId, name) {
		return `${PREFIX}${slug(extensionId)}__${name}`;
	}

	function emit() {
		listeners.forEach((listener) => {
			try {
				listener(list());
			} catch (error) {}
		});
	}

	function sanitizeSchema(schema) {
		if (!schema || typeof schema !== 'object') return { type: 'object', properties: {} };
		try {
			const clone = JSON.parse(JSON.stringify(schema));
			if (clone.type !== 'object') clone.type = 'object';
			if (!clone.properties || typeof clone.properties !== 'object') clone.properties = {};
			return clone;
		} catch (error) {
			return { type: 'object', properties: {} };
		}
	}

	function textOf(result) {
		if (result && typeof result === 'object' && Array.isArray(result.content)) return result;
		const text = typeof result === 'string' ? result : JSON.stringify(result === undefined ? null : result, null, 2);
		return { content: [{ type: 'text', text: text.length > MAX_RESULT_CHARS ? text.slice(0, MAX_RESULT_CHARS) + '\n…[truncado]' : text }] };
	}

	async function invoke(record, args) {
		if (!registry()) throw new Error('Registro de extensões indisponível.');
		const started = performance.now();
		const item = registry().get(record.extensionId);
		if (!item || item.status !== 'active') {
			await registry().activate(record.extensionId, `mcp:${record.name}`);
		}
		try {
			const result = await registry().requestExtension(record.extensionId, 'mcp.callTool', { name: record.name, args: args || {} }, { timeoutMs: CALL_TIMEOUT_MS });
			if (audit()) audit().record({ extensionId: record.extensionId, method: `mcp.tool:${record.name}`, params: args, durationMs: performance.now() - started, ok: true });
			record.calls += 1;
			record.lastCallAt = Date.now();
			return textOf(result);
		} catch (error) {
			if (audit()) audit().record({ extensionId: record.extensionId, method: `mcp.tool:${record.name}`, params: args, durationMs: performance.now() - started, ok: false, error: error && error.message ? error.message : String(error) });
			throw error;
		}
	}

	function publish(record) {
		const list = catalog();
		if (!list) return;
		const existing = list.findIndex((tool) => tool.name === record.publicName);
		const definition = {
			name: record.publicName,
			title: record.title,
			desc: `${record.description} [extensão ${record.extensionId}]`,
			schema: record.inputSchema,
			annotations: { readOnlyHint: !!record.readOnly, destructiveHint: false, openWorldHint: false, extension: record.extensionId },
			run: (args) => invoke(record, args),
			__extension: record.extensionId,
		};
		if (existing >= 0) list.splice(existing, 1, definition);
		else list.push(definition);
	}

	function unpublish(publicToolName) {
		const list = catalog();
		if (!list) return;
		const index = list.findIndex((tool) => tool.name === publicToolName);
		if (index >= 0) list.splice(index, 1);
	}

	function register(extensionId, params) {
		const name = String((params && params.name) || '').trim();
		if (!NAME_PATTERN.test(name)) throw fail('INVALID_PARAMS', `mcp.registerTool: nome "${name}" inválido (use minúsculas, dígitos e "_", começando por letra).`);
		const ownTools = [...tools.values()].filter((record) => record.extensionId === extensionId);
		if (ownTools.length >= MAX_TOOLS_PER_EXTENSION && !ownTools.some((record) => record.name === name)) {
			throw fail('INVALID_PARAMS', `mcp.registerTool: limite de ${MAX_TOOLS_PER_EXTENSION} ferramentas por extensão.`);
		}
		const manifest = registry() ? registry().manifestOf(extensionId) : null;
		const declared = manifest && manifest.contributes && Array.isArray(manifest.contributes.mcpTools) ? manifest.contributes.mcpTools.find((entry) => entry.name === name) : null;
		const record = {
			extensionId,
			name,
			publicName: publicName(extensionId, name),
			title: String((params && params.title) || (declared && declared.title) || name),
			description: String((params && params.description) || (declared && declared.description) || `Ferramenta "${name}" da extensão ${extensionId}.`).slice(0, 600),
			inputSchema: sanitizeSchema((params && params.inputSchema) || (declared && declared.inputSchema)),
			readOnly: !!((params && params.readOnly) || (declared && declared.readOnly)),
			calls: 0,
			lastCallAt: 0,
			registeredAt: Date.now(),
		};
		tools.set(record.publicName, record);
		publish(record);
		if (output()) output().command(extensionId, `Ferramenta MCP "${record.publicName}" disponível para agentes.`);
		emit();
		return { name: record.publicName };
	}

	function unregister(extensionId, name) {
		const key = publicName(extensionId, String(name || ''));
		const record = tools.get(key);
		if (!record) return false;
		tools.delete(key);
		unpublish(key);
		emit();
		return true;
	}

	function disposeAll(extensionId) {
		[...tools.values()].filter((record) => record.extensionId === extensionId).forEach((record) => {
			tools.delete(record.publicName);
			unpublish(record.publicName);
		});
		emit();
	}

	function list() {
		return [...tools.values()].map((record) => ({ ...record, inputSchema: JSON.parse(JSON.stringify(record.inputSchema)) }));
	}

	function listFor(extensionId) {
		return list().filter((record) => record.extensionId === extensionId);
	}

	function helpText() {
		const entries = list();
		if (!entries.length) return '';
		const grouped = new Map();
		entries.forEach((record) => {
			if (!grouped.has(record.extensionId)) grouped.set(record.extensionId, []);
			grouped.get(record.extensionId).push(record);
		});
		const blocks = [...grouped.entries()].map(([extensionId, records]) => {
			const lines = records.map((record) => {
				const props = Object.keys(record.inputSchema.properties || {});
				const required = Array.isArray(record.inputSchema.required) ? record.inputSchema.required : [];
				const params = props.length ? ` Parâmetros: ${props.map((key) => (required.includes(key) ? key + '*' : key)).join(', ')}.` : '';
				return `  - ${record.publicName}: ${record.description}${params}`;
			});
			return `Extensão ${extensionId}:\n${lines.join('\n')}`;
		});
		return '--- Ferramentas contribuídas por extensões ---\nEstas ferramentas são fornecidas por extensões instaladas nesta IDE (permissão "mcp"). Elas rodam no sandbox da extensão e podem ser removidas se a extensão for desinstalada. Nomes seguem o padrão ext_<publisher>_<nome>__<ferramenta>.\n\n' + blocks.join('\n\n');
	}

	function onDidChange(listener) {
		listeners.add(listener);
		return () => listeners.delete(listener);
	}

	const handlers = Object.freeze({
		'mcp.registerTool': (params, context) => register(context.descriptor.id, params),
		'mcp.unregisterTool': (params, context) => unregister(context.descriptor.id, params && params.name),
		'mcp.listTools': (params, context) => listFor(context.descriptor.id).map((record) => ({ name: record.name, publicName: record.publicName })),
	});

	root.SynapseExtensionMcpTools = Object.freeze({
		PREFIX,
		publicName,
		register,
		unregister,
		disposeAll,
		list,
		listFor,
		helpText,
		onDidChange,
		handlers,
	});
})(window);
