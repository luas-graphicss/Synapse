(function (root) {
	'use strict';

	const MAX_CLIPBOARD_BYTES = 1024 * 1024;
	const MAX_FETCH_BODY_BYTES = 10 * 1024 * 1024;
	const MAX_FETCH_TIMEOUT_MS = 120000;
	const FETCH_METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
	const FORBIDDEN_HEADERS = new Set(['cookie', 'cookie2', 'host', 'origin', 'referer', 'connection', 'content-length', 'transfer-encoding', 'upgrade', 'via', 'keep-alive', 'te', 'trailer', 'set-cookie', 'proxy-authorization']);

	function rpc() {
		return root.SynapseExtensionRpc;
	}

	function fail(code, message, data) {
		const api = rpc();
		return new api.RpcError(api.ERROR_CODES[code] || code, message, data);
	}

	function normalizePath(path) {
		const parts = [];
		String(path || '')
			.replace(/\\/g, '/')
			.split('/')
			.forEach((segment) => {
				if (!segment || segment === '.') return;
				if (segment === '..') throw fail('INVALID_PARAMS', 'Caminhos com ".." não são permitidos.');
				parts.push(segment);
			});
		if (!parts.length) throw fail('INVALID_PARAMS', 'Caminho vazio.');
		return parts.join('/');
	}

	function byteLength(text) {
		return new TextEncoder().encode(text).length;
	}

	function windowApi() {
		return root.SynapseExtensionWindow;
	}

	function configurationApi() {
		return root.SynapseExtensionConfiguration;
	}

	function audit() {
		return root.SynapseExtensionAudit;
	}

	function bytesToBase64(bytes) {
		let binary = '';
		const chunk = 0x8000;
		for (let index = 0; index < bytes.length; index += chunk) binary += String.fromCharCode.apply(null, bytes.subarray(index, index + chunk));
		return btoa(binary);
	}

	function base64ToBytes(text) {
		const binary = atob(String(text || ''));
		const bytes = new Uint8Array(binary.length);
		for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
		return bytes;
	}

	function allowedOrigin(context, url) {
		const capabilities = context.descriptor.capabilities;
		return !!(capabilities && typeof capabilities.allowsOrigin === 'function' && capabilities.allowsOrigin(url.origin));
	}

	async function networkFetch(params, context) {
		let url;
		try {
			url = new URL(String(params.url || ''));
		} catch (error) {
			throw fail('INVALID_PARAMS', 'URL inválida em network.fetch.');
		}
		const sameOrigin = url.origin === root.location.origin;
		if (url.protocol !== 'https:' && !sameOrigin) throw fail('PERMISSION_DENIED', `network.fetch só aceita https (recebido ${url.protocol}).`, { method: 'network.fetch', permission: 'network' });
		if (!allowedOrigin(context, url)) {
			throw fail('PERMISSION_DENIED', `A extensão "${context.descriptor.id}" tentou acessar ${url.origin} sem declarar "network:${url.origin}".`, { method: 'network.fetch', permission: `network:${url.origin}` });
		}
		const method = String(params.method || 'GET').toUpperCase();
		if (!FETCH_METHODS.has(method)) throw fail('INVALID_PARAMS', `Método HTTP "${method}" não permitido.`);
		const headers = new Headers();
		(Array.isArray(params.headers) ? params.headers : []).forEach((pair) => {
			if (!Array.isArray(pair) || pair.length !== 2) return;
			const name = String(pair[0]).toLowerCase();
			if (FORBIDDEN_HEADERS.has(name) || name.startsWith('sec-') || name.startsWith('proxy-')) return;
			try {
				headers.set(name, String(pair[1]));
			} catch (error) {}
		});
		let body = undefined;
		if (params.body && typeof params.body === 'object' && method !== 'GET' && method !== 'HEAD') {
			if (params.body.kind === 'text') body = String(params.body.text || '');
			else if (params.body.kind === 'base64') body = base64ToBytes(params.body.base64);
		}
		const timeoutMs = Math.min(Math.max(Number(params.timeoutMs) || 30000, 1000), MAX_FETCH_TIMEOUT_MS);
		const maxBytes = Math.min(Math.max(Number(params.maxBytes) || MAX_FETCH_BODY_BYTES, 1024), MAX_FETCH_BODY_BYTES);
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeoutMs);
		const onAbort = () => controller.abort();
		if (context.signal) context.signal.addEventListener('abort', onAbort, { once: true });
		try {
			const response = await fetch(url.href, {
				method,
				headers,
				body,
				redirect: params.redirect === 'error' || params.redirect === 'manual' ? params.redirect : 'follow',
				credentials: 'omit',
				mode: 'cors',
				cache: 'no-store',
				referrerPolicy: 'no-referrer',
				signal: controller.signal,
			});
			let finalUrl = url;
			try {
				finalUrl = new URL(response.url || url.href);
			} catch (error) {}
			if (finalUrl.origin !== url.origin && !allowedOrigin(context, finalUrl)) {
				throw fail('PERMISSION_DENIED', `Requisição redirecionada para ${finalUrl.origin}, origem não declarada pela extensão.`, { method: 'network.fetch', permission: `network:${finalUrl.origin}` });
			}
			const declared = Number(response.headers.get('content-length'));
			if (declared && declared > maxBytes) throw fail('INVALID_PARAMS', `Resposta de ${Math.round(declared / 1024)} KB excede o limite de ${Math.round(maxBytes / 1024)} KB.`);
			const buffer = new Uint8Array(await response.arrayBuffer());
			if (buffer.length > maxBytes) throw fail('INVALID_PARAMS', `Resposta de ${Math.round(buffer.length / 1024)} KB excede o limite de ${Math.round(maxBytes / 1024)} KB.`);
			const responseHeaders = [];
			response.headers.forEach((value, key) => {
				if (key === 'set-cookie' || key === 'set-cookie2') return;
				responseHeaders.push([key, value]);
			});
			return { status: response.status, statusText: response.statusText, url: response.url || url.href, redirected: !!response.redirected, headers: responseHeaders, body: buffer.length ? bytesToBase64(buffer) : '' };
		} catch (error) {
			if (error && error.name === 'RpcError') throw error;
			if (controller.signal.aborted) throw fail('TIMEOUT', `network.fetch para ${url.origin} excedeu ${timeoutMs} ms ou foi cancelado.`);
			throw fail('HOST_ERROR', `Falha de rede em ${url.origin}: ${error && error.message ? error.message : error}`);
		} finally {
			clearTimeout(timer);
			if (context.signal) context.signal.removeEventListener('abort', onAbort);
		}
	}

	function createHandlers(services) {
		const registry = services.registry;
		const output = services.output;

		const handlers = {
			'window.showMessage': (params, context) => {
				const kind = params.kind === 'err' ? 'err' : params.kind === 'warn' ? 'warn' : 'info';
				const level = kind === 'err' ? 'error' : kind === 'warn' ? 'warn' : 'info';
				output[level](context.descriptor.id, params.message);
				return windowApi().showMessage(params, context);
			},
			'window.showQuickPick': (params, context) => windowApi().showQuickPick(params, context),
			'window.showInputBox': (params, context) => windowApi().showInputBox(params, context),
			'window.setStatusBarMessage': (params, context) => windowApi().setStatusBarMessage(params, context),
			'statusBar.create': (params, context) => windowApi().createStatusItem(params, context),
			'statusBar.update': (params, context) => windowApi().updateStatusItem(params, context),
			'statusBar.dispose': (params, context) => windowApi().disposeStatusItem(params, context),
			'progress.begin': (params, context) => windowApi().progressBegin(params, context),
			'progress.report': (params, context) => windowApi().progressReport(params, context),
			'progress.end': (params, context) => windowApi().progressEnd(params, context),
			'output.append': (params, context) => {
				output.info(context.descriptor.id, `[${params.channel}] ${params.text}`);
			},
			'output.clear': (params, context) => {
				output.clear(context.descriptor.id);
			},
			'output.show': () => {
				output.show();
			},
			'commands.registered': (params, context) => {
				registry.trackWorkerCommand(context.descriptor.id, params.command, true);
			},
			'commands.unregistered': (params, context) => {
				registry.trackWorkerCommand(context.descriptor.id, params.command, false);
			},
			'commands.execute': (params) => registry.executeCommand(params.command, ...(Array.isArray(params.args) ? params.args : [])),
			'commands.list': (params) => registry.commandIds(!!(params && params.filterInternal)),
			'state.update': (params, context) => {
				const result = registry.updateState(context.descriptor.id, params.scope, params.key, params.value);
				if (result && result.ok === false) throw fail('HOST_ERROR', result.reason);
				return null;
			},
			'configuration.get': () => configurationApi().snapshot(),
			'configuration.update': (params, context) => {
				const configuration = configurationApi();
				const key = String(params.key || '');
				const owner = configuration.ownerOf(key);
				if (!owner) throw fail('HOST_ERROR', `Configuração "${key}" não está registrada por nenhuma extensão.`);
				if (owner !== context.descriptor.id) {
					throw fail('PERMISSION_DENIED', `A extensão "${context.descriptor.id}" não pode alterar "${key}", contribuída por "${owner}".`, { method: 'configuration.update', permission: 'configuration' });
				}
				const result = configuration.set(key, params.value, 'ext:' + context.descriptor.id);
				if (!result.ok) throw fail('INVALID_PARAMS', result.reason);
				return result.value;
			},
			'env.clipboard.readText': async () => {
				if (!navigator.clipboard || typeof navigator.clipboard.readText !== 'function') throw fail('HOST_ERROR', 'Área de transferência indisponível neste navegador.');
				try {
					return await navigator.clipboard.readText();
				} catch (error) {
					throw fail('HOST_ERROR', 'O navegador negou a leitura da área de transferência.');
				}
			},
			'env.clipboard.writeText': async (params) => {
				const text = String(params.text === undefined ? '' : params.text);
				if (byteLength(text) > MAX_CLIPBOARD_BYTES) throw fail('INVALID_PARAMS', 'Texto excede 1 MB.');
				if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') throw fail('HOST_ERROR', 'Área de transferência indisponível neste navegador.');
				try {
					await navigator.clipboard.writeText(text);
				} catch (error) {
					throw fail('HOST_ERROR', 'O navegador negou a escrita na área de transferência.');
				}
				return true;
			},
			'env.openExternal': async (params, context) => {
				const policy = root.SynapseUrlPolicy;
				const target = policy ? policy.navigationUrl(params.uri, '') : '';
				if (!target) throw fail('INVALID_PARAMS', `URL recusada pela política de navegação: "${String(params.uri).slice(0, 120)}".`);
				let allowed = true;
				if (typeof root.uiDialog === 'function') {
					const result = await root.uiDialog({
						title: 'Abrir link externo',
						message: `${context.descriptor.manifest.name} quer abrir:\n${target}`,
						buttons: [
							{ id: 'cancel', label: 'Cancelar' },
							{ id: 'open', label: 'Abrir', primary: true },
						],
					});
					allowed = result && result.act === 'open';
				}
				if (!allowed) return false;
				const opened = root.open(target, '_blank', 'noopener,noreferrer');
				return !!opened;
			},
			'network.fetch': networkFetch,
			...root.SynapseExtensionWorkspace.handlers,
			...root.SynapseExtensionEditor.handlers,
			...(root.SynapseExtensionLanguages ? root.SynapseExtensionLanguages.handlers : {}),
			...(root.SynapseExtensionWebviews ? root.SynapseExtensionWebviews.handlers : {}),
			...(root.SynapseExtensionPreview ? root.SynapseExtensionPreview.handlers : {}),
			...(root.SynapseExtensionTestRunner ? root.SynapseExtensionTestRunner.handlers : {}),
			...(root.SynapseExtensionDevHost ? root.SynapseExtensionDevHost.handlers : {}),
			...(root.SynapseExtensionCompat ? root.SynapseExtensionCompat.handlers : {}),
			...(root.SynapseExtensionMcpTools ? root.SynapseExtensionMcpTools.handlers : {}),
			'workspace.readFile': (params, context) => root.SynapseExtensionWorkspace.handlers['workspace.fs.readFile']({ path: params.path }, context).text,
			'workspace.stat': (params, context) => root.SynapseExtensionWorkspace.handlers['workspace.fs.stat'](params, context),
			'workspace.writeFile': (params, context) => root.SynapseExtensionWorkspace.handlers['workspace.fs.writeFile'](params, context),
		};

		const permissions = root.SynapseExtensionPermissions;
		const guarded = {};
		Object.keys(handlers).forEach((method) => {
			guarded[method] = async (params, context) => {
				const denied = permissions.check(context.descriptor.capabilities, method);
				if (denied) {
					if (audit()) audit().denied(context.descriptor.id, method, denied);
					registry.reportPermissionDenied(context.descriptor.id, denied);
					throw denied;
				}
				const started = performance.now();
				try {
					const result = await handlers[method](params || {}, context);
					if (audit()) audit().record({ extensionId: context.descriptor.id, method, params, durationMs: performance.now() - started, ok: true });
					return result;
				} catch (error) {
					if (audit()) {
						const code = error && error.code ? String(error.code) : 'Error';
						if (code === 'PermissionDenied') audit().denied(context.descriptor.id, method, error);
						else audit().record({ extensionId: context.descriptor.id, method, params, durationMs: performance.now() - started, ok: false, code, error: error && error.message ? error.message : String(error) });
						if (code === 'PermissionDenied' && method === 'network.fetch') registry.reportPermissionDenied(context.descriptor.id, error);
					}
					throw error;
				}
			};
		});
		return guarded;
	}

	root.SynapseExtensionHostApi = Object.freeze({ createHandlers, normalizePath });
})(window);

