(function (root) {
	'use strict';

	const ERROR_CODES = Object.freeze({
		PERMISSION_DENIED: 'PermissionDenied',
		METHOD_NOT_FOUND: 'MethodNotFound',
		TIMEOUT: 'Timeout',
		CANCELLED: 'Cancelled',
		INVALID_PARAMS: 'InvalidParams',
		HOST_ERROR: 'HostError',
		EXTENSION_ERROR: 'ExtensionError',
		DISPOSED: 'Disposed',
		PAYLOAD_TOO_LARGE: 'PayloadTooLarge',
		UNRESPONSIVE: 'Unresponsive',
	});

	function estimateSize(value, limit) {
		const seen = new Set();
		const stack = [value];
		let total = 0;
		while (stack.length) {
			const current = stack.pop();
			if (current === null || current === undefined) {
				total += 4;
			} else if (typeof current === 'string') {
				total += current.length * 2;
			} else if (typeof current === 'number' || typeof current === 'bigint') {
				total += 8;
			} else if (typeof current === 'boolean') {
				total += 4;
			} else if (ArrayBuffer.isView(current) || current instanceof ArrayBuffer) {
				total += current.byteLength;
			} else if (typeof current === 'object') {
				if (seen.has(current)) continue;
				seen.add(current);
				if (Array.isArray(current)) {
					total += 8;
					for (let index = 0; index < current.length; index++) stack.push(current[index]);
				} else if (current instanceof Map) {
					current.forEach((entry, key) => {
						stack.push(key);
						stack.push(entry);
					});
				} else if (current instanceof Set) {
					current.forEach((entry) => stack.push(entry));
				} else {
					for (const key of Object.keys(current)) {
						total += key.length * 2;
						stack.push(current[key]);
					}
				}
			}
			if (limit && total > limit) return total;
		}
		return total;
	}

	class RpcError extends Error {
		constructor(code, message, data) {
			super(message || code);
			this.name = 'RpcError';
			this.code = code;
			this.data = data;
		}

		toJSON() {
			return { code: this.code, message: this.message, data: this.data };
		}

		static from(value) {
			if (value instanceof RpcError) return value;
			if (value && typeof value === 'object' && typeof value.code === 'string') {
				return new RpcError(value.code, value.message, value.data);
			}
			const message = value && value.message ? value.message : String(value);
			const error = new RpcError(ERROR_CODES.HOST_ERROR, message);
			if (value && value.stack) error.data = { stack: String(value.stack) };
			return error;
		}
	}

	function createEndpoint(port, options) {
		options = options || {};
		const handlers = new Map();
		const pending = new Map();
		const running = new Map();
		const defaultTimeout = options.timeoutMs === undefined ? 30000 : options.timeoutMs;
		const prefix = options.idPrefix || 'r';
		const onError = typeof options.onError === 'function' ? options.onError : () => {};
		const maxMessageBytes = options.maxMessageBytes > 0 ? options.maxMessageBytes : 0;
		let sequence = 0;
		let disposed = false;

		function oversized(payload) {
			if (!maxMessageBytes) return 0;
			const size = estimateSize(payload, maxMessageBytes);
			return size > maxMessageBytes ? size : 0;
		}

		function tooLarge(method, size, direction) {
			return new RpcError(ERROR_CODES.PAYLOAD_TOO_LARGE, `Mensagem "${method}" ${direction} com ~${Math.round(size / 1024)} KB excede o limite de ${Math.round(maxMessageBytes / 1024)} KB.`, { method, size, limit: maxMessageBytes });
		}

		function post(message) {
			try {
				port.postMessage(message);
			} catch (error) {
				onError(error);
			}
		}

		function on(method, handler) {
			handlers.set(method, handler);
			return () => handlers.delete(method);
		}

		function settle(id, result, error) {
			const entry = pending.get(id);
			if (!entry) return;
			pending.delete(id);
			if (entry.timer) clearTimeout(entry.timer);
			if (entry.signal && entry.onAbort) entry.signal.removeEventListener('abort', entry.onAbort);
			if (error) entry.reject(error);
			else entry.resolve(result);
		}

		function call(method, params, callOptions) {
			callOptions = callOptions || {};
			if (disposed) {
				return Promise.reject(new RpcError(ERROR_CODES.DISPOSED, 'Canal RPC encerrado.'));
			}
			const outgoing = oversized(params);
			if (outgoing) return Promise.reject(tooLarge(method, outgoing, 'enviada'));
			const id = prefix + ++sequence;
			const timeoutMs = callOptions.timeoutMs === undefined ? defaultTimeout : callOptions.timeoutMs;
			return new Promise((resolve, reject) => {
				const entry = { resolve, reject, timer: null, signal: callOptions.signal || null, onAbort: null };
				if (timeoutMs > 0) {
					entry.timer = setTimeout(() => {
						post({ type: 'cancel', id });
						settle(id, null, new RpcError(ERROR_CODES.TIMEOUT, `Tempo esgotado em "${method}" após ${timeoutMs} ms.`));
					}, timeoutMs);
				}
				if (entry.signal) {
					if (entry.signal.aborted) {
						reject(new RpcError(ERROR_CODES.CANCELLED, `Chamada "${method}" cancelada.`));
						return;
					}
					entry.onAbort = () => {
						post({ type: 'cancel', id });
						settle(id, null, new RpcError(ERROR_CODES.CANCELLED, `Chamada "${method}" cancelada.`));
					};
					entry.signal.addEventListener('abort', entry.onAbort, { once: true });
				}
				pending.set(id, entry);
				post({ type: 'call', id, method, params: params === undefined ? null : params });
			});
		}

		function notify(method, params) {
			if (disposed) return;
			const outgoing = oversized(params);
			if (outgoing) {
				onError(tooLarge(method, outgoing, 'enviada'));
				return;
			}
			post({ type: 'notify', method, params: params === undefined ? null : params });
		}

		async function handleCall(message) {
			const handler = handlers.get(message.method);
			if (!handler) {
				post({
					type: 'result',
					id: message.id,
					error: new RpcError(ERROR_CODES.METHOD_NOT_FOUND, `Método RPC desconhecido: ${message.method}`).toJSON(),
				});
				return;
			}
			const incoming = oversized(message.params);
			if (incoming) {
				const error = tooLarge(message.method, incoming, 'recebida');
				onError(error);
				post({ type: 'result', id: message.id, error: error.toJSON() });
				return;
			}
			const controller = new AbortController();
			running.set(message.id, controller);
			try {
				const result = await handler(message.params, { signal: controller.signal, method: message.method });
				if (!controller.signal.aborted) {
					const outgoing = oversized(result);
					if (outgoing) throw tooLarge(message.method, outgoing, 'de resposta');
					post({ type: 'result', id: message.id, result: result === undefined ? null : result });
				}
			} catch (error) {
				if (!controller.signal.aborted) {
					post({ type: 'result', id: message.id, error: RpcError.from(error).toJSON() });
				}
			} finally {
				running.delete(message.id);
			}
		}

		function handleNotify(message) {
			const handler = handlers.get(message.method);
			if (!handler) return;
			const incoming = oversized(message.params);
			if (incoming) {
				onError(tooLarge(message.method, incoming, 'recebida'));
				return;
			}
			Promise.resolve()
				.then(() => handler(message.params, { method: message.method }))
				.catch(onError);
		}

		function onMessage(event) {
			const message = event.data;
			if (!message || typeof message !== 'object' || typeof message.type !== 'string') return;
			if (message.type === 'call') handleCall(message);
			else if (message.type === 'notify') handleNotify(message);
			else if (message.type === 'result') {
				if (message.error) settle(message.id, null, RpcError.from(message.error));
				else settle(message.id, message.result, null);
			} else if (message.type === 'cancel') {
				const controller = running.get(message.id);
				if (controller) controller.abort();
			}
		}

		port.addEventListener('message', onMessage);
		if (typeof port.start === 'function') port.start();

		function dispose() {
			if (disposed) return;
			disposed = true;
			port.removeEventListener('message', onMessage);
			for (const id of [...pending.keys()]) {
				settle(id, null, new RpcError(ERROR_CODES.DISPOSED, 'Canal RPC encerrado.'));
			}
			for (const controller of running.values()) controller.abort();
			running.clear();
			handlers.clear();
		}

		return {
			call,
			notify,
			on,
			dispose,
			get disposed() {
				return disposed;
			},
			get pendingCount() {
				return pending.size;
			},
		};
	}

	root.SynapseExtensionRpc = Object.freeze({ ERROR_CODES, RpcError, createEndpoint, estimateSize });
})(typeof self !== 'undefined' ? self : window);
