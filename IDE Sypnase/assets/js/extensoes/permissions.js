(function (root) {
	'use strict';

	const KNOWN = Object.freeze({
		'workspace.read': { risk: 'baixo', label: 'Ler arquivos do projeto ativo' },
		'workspace.write': { risk: 'médio', label: 'Criar e alterar arquivos do projeto ativo' },
		'workspace.all': { risk: 'médio', label: 'Acessar todos os projetos abertos' },
		editor: { risk: 'baixo', label: 'Ler seleção, editar e decorar o documento ativo do editor' },
		webview: { risk: 'médio', label: 'Exibir interface própria em painéis isolados' },
		clipboard: { risk: 'médio', label: 'Ler e escrever na área de transferência' },
		preview: { risk: 'alto', label: 'Injetar código e controlar o preview' },
		mcp: { risk: 'alto', label: 'Expor ferramentas para agentes MCP' },
		network: { risk: 'alto', label: 'Acessar a rede em origens declaradas' },
	});

	const METHOD_PERMISSIONS = Object.freeze({
		'workspace.readFile': 'workspace.read',
		'workspace.findFiles': 'workspace.read',
		'workspace.stat': 'workspace.read',
		'workspace.writeFile': 'workspace.write',
		'workspace.fs.readFile': 'workspace.read',
		'workspace.fs.readDirectory': 'workspace.read',
		'workspace.fs.stat': 'workspace.read',
		'workspace.fs.writeFile': 'workspace.write',
		'workspace.fs.createDirectory': 'workspace.write',
		'workspace.fs.delete': 'workspace.write',
		'workspace.fs.rename': 'workspace.write',
		'workspace.applyEdit': 'workspace.write',
		'workspace.openTextDocument': 'workspace.read',
		'workspace.textDocuments': 'workspace.read',
		'workspace.watch': 'workspace.read',
		'workspace.unwatch': 'workspace.read',
		'editor.activeDocument': 'editor',
		'editor.selection': 'editor',
		'editor.active': 'editor',
		'editor.edit': 'editor',
		'editor.insertSnippet': 'editor',
		'editor.setSelections': 'editor',
		'editor.revealRange': 'editor',
		'editor.show': 'editor',
		'editor.decorations.create': 'editor',
		'editor.decorations.set': 'editor',
		'editor.decorations.dispose': 'editor',
		'env.clipboard.readText': 'clipboard',
		'env.clipboard.writeText': 'clipboard',
		'preview.injectScript': 'preview',
		'preview.reload': 'preview',
		'preview.setViewport': 'preview',
		'preview.getViewport': 'preview',
		'preview.state': 'preview',
		'webview.create': 'webview',
		'webview.setHtml': 'webview',
		'webview.setTitle': 'webview',
		'webview.setOptions': 'webview',
		'webview.postMessage': 'webview',
		'webview.reveal': 'webview',
		'webview.dispose': 'webview',
		'webview.registerViewProvider': 'webview',
		'webview.unregisterViewProvider': 'webview',
		'webview.view.show': 'webview',
		'webview.view.setDescription': 'webview',
		'mcp.registerTool': 'mcp',
		'mcp.unregisterTool': 'mcp',
		'mcp.listTools': 'mcp',
		'network.fetch': 'network',
	});

	function parse(list) {
		const granted = new Set();
		const networkOrigins = [];
		const errors = [];
		(Array.isArray(list) ? list : []).forEach((raw) => {
			const permission = String(raw || '').trim();
			if (!permission) return;
			if (permission === 'network:self') {
				networkOrigins.push(root.location.origin);
				granted.add('network');
				return;
			}
			if (permission.startsWith('network:')) {
				const origin = permission.slice('network:'.length);
				try {
					const url = new URL(origin);
					if (url.protocol !== 'https:') throw new Error('protocolo');
					networkOrigins.push(url.origin);
					granted.add('network');
				} catch (error) {
					errors.push(`Permissão de rede inválida "${permission}": use network:https://<host>.`);
				}
				return;
			}
			if (!KNOWN[permission]) {
				errors.push(`Permissão desconhecida "${permission}".`);
				return;
			}
			granted.add(permission);
			if (permission === 'workspace.all') {
				granted.add('workspace.read');
			}
		});
		return { granted, networkOrigins, errors };
	}

	function capabilitiesFor(manifest) {
		const parsed = parse(manifest && manifest.permissions);
		return Object.freeze({
			extensionId: manifest ? manifest.id : '',
			granted: parsed.granted,
			networkOrigins: Object.freeze(parsed.networkOrigins),
			errors: Object.freeze(parsed.errors),
			has(permission) {
				return parsed.granted.has(permission);
			},
			allowsOrigin(origin) {
				return parsed.networkOrigins.includes(origin);
			},
		});
	}

	function requiredFor(method) {
		return METHOD_PERMISSIONS[method] || null;
	}

	function denialMessage(extensionId, method, permission) {
		return (
			`A extensão "${extensionId}" chamou "${method}" sem declarar a permissão "${permission}". ` +
			`Adicione "${permission}" ao campo "permissions" do synapse-extension.json.`
		);
	}

	function check(capabilities, method) {
		const permission = requiredFor(method);
		if (!permission) return null;
		if (capabilities && capabilities.has(permission)) return null;
		const rpc = root.SynapseExtensionRpc;
		const message = denialMessage(capabilities ? capabilities.extensionId : '?', method, permission);
		return new rpc.RpcError(rpc.ERROR_CODES.PERMISSION_DENIED, message, { method, permission });
	}

	function describe(permission) {
		const key = permission.startsWith('network:') ? 'network' : permission;
		const info = KNOWN[key];
		if (!info) return { permission, risk: 'desconhecido', label: permission };
		const target = permission === 'network:self' ? 'mesma origem da IDE' : permission.slice('network:'.length);
		return { permission, risk: info.risk, label: info.label + (key === 'network' ? ` (${target})` : '') };
	}

	root.SynapseExtensionPermissions = Object.freeze({
		KNOWN,
		METHOD_PERMISSIONS,
		parse,
		capabilitiesFor,
		requiredFor,
		check,
		describe,
		denialMessage,
	});
})(typeof self !== 'undefined' ? self : window);
