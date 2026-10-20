(function (root) {
	'use strict';

	const hostScriptUrl = document.currentScript ? document.currentScript.src : '';
	const WORKER_FILE = 'extension-host.worker.js';
	const MAX_MESSAGE_BYTES = 8 * 1024 * 1024;
	const noop = () => {};

	function workerUrl() {
		const resources = root.SynapseEditorWorkerResources;
		if (resources && hostScriptUrl) return resources.url(WORKER_FILE, hostScriptUrl);
		return new URL(WORKER_FILE, hostScriptUrl || document.baseURI).href;
	}

	function create(descriptor, handlers, options) {
		options = options || {};
		const rpc = root.SynapseExtensionRpc;
		const onError = typeof options.onError === 'function' ? options.onError : noop;
		const onStatus = typeof options.onStatus === 'function' ? options.onStatus : noop;
		let worker = null;
		let endpoint = null;
		let status = 'created';
		let lastError = null;

		function setStatus(next, error) {
			status = next;
			lastError = error || null;
			onStatus(next, error || null);
		}

		function requireEndpoint() {
			if (!endpoint || endpoint.disposed) {
				throw new rpc.RpcError(rpc.ERROR_CODES.DISPOSED, `Extension Host de "${descriptor.id}" não está em execução.`);
			}
			return endpoint;
		}

		function spawn() {
			worker = new Worker(workerUrl(), { name: 'synapse-ext:' + descriptor.id });
			endpoint = rpc.createEndpoint(worker, {
				idPrefix: 'h',
				timeoutMs: options.timeoutMs || 15000,
				maxMessageBytes: options.maxMessageBytes || MAX_MESSAGE_BYTES,
				onError: (error) => onError(error, 'rpc'),
			});
			Object.keys(handlers || {}).forEach((method) => {
				endpoint.on(method, (params, context) => handlers[method](params, { ...context, descriptor, host }));
			});
			endpoint.on('host.error', (params) => {
				const error = new Error(params && params.message ? params.message : 'Erro na extensão');
				if (params && params.stack) error.stack = params.stack;
				onError(error, (params && params.phase) || 'runtime');
			});
			worker.addEventListener('error', (event) => {
				if (typeof event.preventDefault === 'function') event.preventDefault();
				const error = event.error || new Error(event.message || 'Falha no worker da extensão');
				onError(error, 'worker');
				setStatus('error', error);
			});
			worker.addEventListener('messageerror', () => {
				onError(new Error('Mensagem não serializável recebida do worker.'), 'worker');
			});
		}

		function terminate() {
			if (endpoint) endpoint.dispose();
			if (worker) worker.terminate();
			endpoint = null;
			worker = null;
			if (status !== 'error') setStatus('terminated');
		}

		async function load() {
			if (worker) terminate();
			spawn();
			setStatus('loading');
			try {
				const result = await endpoint.call('host.load', {
					id: descriptor.id,
					uri: descriptor.uri,
					manifest: descriptor.manifest,
					files: Object.fromEntries(descriptor.files),
					networkOrigins: descriptor.capabilities && descriptor.capabilities.networkOrigins ? [...descriptor.capabilities.networkOrigins] : [],
					env: descriptor.env || {},
					globalState: descriptor.globalState || {},
					workspaceState: descriptor.workspaceState || {},
					configuration: descriptor.configuration || {},
					keybindings: descriptor.keybindings || [],
					documents: descriptor.documents || [],
					projects: descriptor.projects || [],
					activeEditor: descriptor.activeEditor || null,
				});
				setStatus('loaded');
				return result;
			} catch (error) {
				setStatus('error', error);
				terminate();
				throw error;
			}
		}

		async function activate(reason) {
			requireEndpoint();
			setStatus('activating');
			try {
				const result = await endpoint.call('host.activate', { reason: reason || null }, { timeoutMs: options.activationTimeoutMs || 10000 });
				setStatus('active');
				return result;
			} catch (error) {
				setStatus('error', error);
				throw error;
			}
		}

		async function deactivate() {
			if (!endpoint || endpoint.disposed) return { ok: false };
			setStatus('deactivating');
			try {
				return await endpoint.call('host.deactivate', {}, { timeoutMs: options.deactivationTimeoutMs || 5000 });
			} catch (error) {
				onError(error, 'deactivate');
				return { ok: false };
			} finally {
				terminate();
			}
		}

		function executeCommand(command, args) {
			return requireEndpoint().call(
				'host.executeCommand',
				{ command, args: Array.isArray(args) ? args : [] },
				{ timeoutMs: options.commandTimeoutMs || 60000 },
			);
		}

		function request(method, params, callOptions) {
			return requireEndpoint().call(method, params === undefined ? {} : params, callOptions || {});
		}

		function notify(method, params) {
			if (!endpoint || endpoint.disposed) return false;
			endpoint.notify(method, params === undefined ? {} : params);
			return true;
		}

		function ping() {
			return requireEndpoint().call('host.ping', {}, { timeoutMs: 3000 });
		}

		async function probe(timeoutMs) {
			if (!endpoint || endpoint.disposed) return false;
			try {
				await endpoint.call('host.ping', {}, { timeoutMs: timeoutMs || 3000 });
				return true;
			} catch (error) {
				return false;
			}
		}

		const host = Object.freeze({
			id: descriptor.id,
			descriptor,
			load,
			activate,
			deactivate,
			executeCommand,
			request,
			notify,
			ping,
			probe,
			terminate,
			get status() {
				return status;
			},
			get error() {
				return lastError;
			},
			get running() {
				return !!worker && !!endpoint && !endpoint.disposed;
			},
		});
		return host;
	}

	root.SynapseExtensionHost = Object.freeze({ create, workerUrl });
})(window);
