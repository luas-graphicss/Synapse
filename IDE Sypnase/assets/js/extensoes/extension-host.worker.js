'use strict';

importScripts('rpc-protocol.js');

(function (self) {
	const rpc = self.SynapseExtensionRpc;
	const ERROR_CODES = rpc.ERROR_CODES;
	const RpcError = rpc.RpcError;
	const URI_PREFIX = 'synapse:/projeto/';
	const MAX_GUTTER_SVG_BYTES = 16 * 1024;
	const MAX_MESSAGE_BYTES = 8 * 1024 * 1024;
	const MAX_FETCH_BODY_BYTES = 10 * 1024 * 1024;
	const FETCH_TIMEOUT_MS = 30000;

	const state = {
		descriptor: null,
		files: new Map(),
		module: null,
		context: null,
		active: false,
		env: {},
		colorTheme: null,
		configuration: {},
		keybindings: [],
		projects: [],
		activeEditor: null,
		networkOrigins: [],
	};
	const commands = new Map();
	const mcpTools = new Map();
	const blobUrls = new Map();
	const inputValidators = new Map();
	const progressTokens = new Map();
	const documents = new Map();
	const watchers = new Map();
	const decorationTypes = new Map();
	const languageProviders = new Map();
	const diagnosticCollections = new Map();
	const nativeImportScripts = self.importScripts.bind(self);
	const nativePostMessage = self.postMessage.bind(self);
	const nativeAddEventListener = self.addEventListener.bind(self);
	const nativeRemoveEventListener = self.removeEventListener.bind(self);
	const nativeFetch = typeof self.fetch === 'function' ? self.fetch.bind(self) : null;
	const rpcPort = Object.freeze({
		postMessage: nativePostMessage,
		addEventListener: nativeAddEventListener,
		removeEventListener: nativeRemoveEventListener,
	});
	let handleSequence = 0;

	function nextHandle(prefix) {
		return `${prefix}${++handleSequence}`;
	}

	function reportError(error, phase) {
		endpoint.notify('host.error', {
			phase: phase || 'runtime',
			message: error && error.message ? error.message : String(error),
			stack: error && error.stack ? String(error.stack) : '',
		});
	}

	const endpoint = rpc.createEndpoint(rpcPort, {
		idPrefix: 'w',
		timeoutMs: 30000,
		maxMessageBytes: MAX_MESSAGE_BYTES,
		onError: (error) => reportError(error, 'rpc'),
	});

	function denied(what, hint) {
		return new RpcError(ERROR_CODES.PERMISSION_DENIED, `${what} não está disponível para extensões.${hint ? ' ' + hint : ''}`, { permission: 'sandbox', what });
	}

	function deniedFn(what, hint) {
		return function () {
			throw denied(what, hint);
		};
	}

	function deniedClass(what, hint) {
		return class {
			constructor() {
				throw denied(what, hint);
			}
		};
	}

	function define(target, name, value) {
		try {
			Object.defineProperty(target, name, { value, writable: false, configurable: false, enumerable: false });
		} catch (error) {}
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

	async function serializeBody(body) {
		if (body === undefined || body === null) return null;
		if (typeof body === 'string') return { kind: 'text', text: body };
		if (body instanceof URLSearchParams) return { kind: 'text', text: body.toString(), contentType: 'application/x-www-form-urlencoded;charset=UTF-8' };
		if (body instanceof ArrayBuffer) return { kind: 'base64', base64: bytesToBase64(new Uint8Array(body)) };
		if (ArrayBuffer.isView(body)) return { kind: 'base64', base64: bytesToBase64(new Uint8Array(body.buffer, body.byteOffset, body.byteLength)) };
		if (typeof Blob !== 'undefined' && body instanceof Blob) return { kind: 'base64', base64: bytesToBase64(new Uint8Array(await body.arrayBuffer())), contentType: body.type || '' };
		if (typeof FormData !== 'undefined' && body instanceof FormData) throw new RpcError(ERROR_CODES.INVALID_PARAMS, 'FormData não é suportado em fetch de extensões; envie JSON ou URLSearchParams.');
		throw new RpcError(ERROR_CODES.INVALID_PARAMS, 'Corpo da requisição não suportado.');
	}

	function requestUrl(input) {
		if (typeof Request !== 'undefined' && input instanceof Request) return input.url;
		if (input instanceof URL) return input.href;
		return String(input);
	}

	async function sandboxFetch(input, init) {
		const url = requestUrl(input);
		if (/^(blob|data):/i.test(url) && nativeFetch) return nativeFetch(input, init);
		let parsed;
		try {
			parsed = new URL(url);
		} catch (error) {
			throw new RpcError(ERROR_CODES.INVALID_PARAMS, `URL inválida em fetch: "${String(url).slice(0, 120)}". Extensões só podem usar URLs absolutas https.`);
		}
		if (parsed.protocol !== 'https:') throw denied(`fetch para "${parsed.protocol}//"`, 'Só https é permitido.');
		if (!state.networkOrigins.includes(parsed.origin)) {
			throw new RpcError(ERROR_CODES.PERMISSION_DENIED, `fetch bloqueado para ${parsed.origin}: declare "network:${parsed.origin}" em "permissions" no synapse-extension.json.`, { permission: `network:${parsed.origin}`, method: 'network.fetch' });
		}
		const request = typeof Request !== 'undefined' && input instanceof Request ? input : null;
		const options = init || {};
		const method = String(options.method || (request && request.method) || 'GET').toUpperCase();
		const headers = [];
		const source = options.headers || (request && request.headers) || null;
		if (source) new Headers(source).forEach((value, key) => headers.push([key, value]));
		const signal = options.signal || (request && request.signal) || null;
		if (signal && signal.aborted) throw new RpcError(ERROR_CODES.CANCELLED, 'fetch cancelado.');
		const body = await serializeBody(options.body !== undefined ? options.body : request && method !== 'GET' && method !== 'HEAD' ? await request.arrayBuffer() : null);
		if (body && body.contentType && !headers.some(([key]) => key.toLowerCase() === 'content-type')) headers.push(['content-type', body.contentType]);
		const timeoutMs = Number.isFinite(options.timeoutMs) ? Math.min(Math.max(options.timeoutMs, 1000), 120000) : FETCH_TIMEOUT_MS;
		const result = await endpoint.call('network.fetch', { url: parsed.href, method, headers, body, redirect: options.redirect || 'follow', timeoutMs, maxBytes: MAX_FETCH_BODY_BYTES }, { timeoutMs: timeoutMs + 5000, signal: signal || undefined });
		const status = Number(result.status) || 200;
		const nullBody = status === 101 || status === 204 || status === 205 || status === 304 || method === 'HEAD';
		const bytes = result.body ? base64ToBytes(result.body) : new Uint8Array(0);
		const response = new Response(nullBody ? null : bytes, { status, statusText: String(result.statusText || ''), headers: Array.isArray(result.headers) ? result.headers : [] });
		try {
			Object.defineProperty(response, 'url', { value: String(result.url || parsed.href) });
			Object.defineProperty(response, 'redirected', { value: !!result.redirected });
		} catch (error) {}
		return response;
	}

	function lockdown() {
		define(self, 'fetch', function fetch(input, init) {
			return sandboxFetch(input, init);
		});
		define(self, 'postMessage', deniedFn('self.postMessage', 'Use a API synapse para falar com a IDE.'));
		define(self, 'addEventListener', function addEventListener(type, ...rest) {
			if (type === 'message' || type === 'messageerror') throw denied(`self.addEventListener("${type}")`);
			return nativeAddEventListener(type, ...rest);
		});
		define(self, 'removeEventListener', function removeEventListener(type, ...rest) {
			if (type === 'message' || type === 'messageerror') return undefined;
			return nativeRemoveEventListener(type, ...rest);
		});
		try {
			Object.defineProperty(self, 'onmessage', {
				configurable: false,
				get: () => null,
				set: () => {
					throw denied('self.onmessage');
				},
			});
		} catch (error) {}
		define(self, 'XMLHttpRequest', deniedClass('XMLHttpRequest', 'Use fetch com a permissão network:<origem>.'));
		define(self, 'WebSocket', deniedClass('WebSocket'));
		define(self, 'EventSource', deniedClass('EventSource'));
		define(self, 'WebTransport', deniedClass('WebTransport'));
		define(self, 'Worker', deniedClass('Worker aninhado'));
		define(self, 'SharedWorker', deniedClass('SharedWorker'));
		define(self, 'BroadcastChannel', deniedClass('BroadcastChannel'));
		const storageHint = 'Use context.globalState / context.workspaceState.';
		define(self, 'indexedDB', Object.freeze({ open: deniedFn('indexedDB', storageHint), deleteDatabase: deniedFn('indexedDB', storageHint), databases: deniedFn('indexedDB', storageHint), cmp: deniedFn('indexedDB', storageHint) }));
		define(self, 'caches', Object.freeze({ open: deniedFn('caches', storageHint), match: deniedFn('caches', storageHint), has: deniedFn('caches', storageHint), delete: deniedFn('caches', storageHint), keys: deniedFn('caches', storageHint) }));
		if (self.navigator) {
			define(self.navigator, 'storage', Object.freeze({ getDirectory: deniedFn('navigator.storage', storageHint), estimate: deniedFn('navigator.storage', storageHint), persist: deniedFn('navigator.storage', storageHint), persisted: deniedFn('navigator.storage', storageHint) }));
			define(self.navigator, 'locks', Object.freeze({ request: deniedFn('navigator.locks'), query: deniedFn('navigator.locks') }));
			define(self.navigator, 'serviceWorker', undefined);
		}
	}

	class Disposable {
		constructor(callOnDispose) {
			this._callOnDispose = typeof callOnDispose === 'function' ? callOnDispose : null;
		}

		dispose() {
			const callback = this._callOnDispose;
			this._callOnDispose = null;
			if (callback) callback();
		}

		static from(...disposables) {
			return new Disposable(() => {
				disposables.forEach((item) => {
					if (item && typeof item.dispose === 'function') item.dispose();
				});
			});
		}
	}

	class EventEmitter {
		constructor() {
			this._listeners = new Set();
			this.event = (listener, thisArg, disposables) => {
				const bound = thisArg ? listener.bind(thisArg) : listener;
				this._listeners.add(bound);
				const disposable = new Disposable(() => this._listeners.delete(bound));
				if (Array.isArray(disposables)) disposables.push(disposable);
				return disposable;
			};
		}

		fire(value) {
			[...this._listeners].forEach((listener) => {
				try {
					listener(value);
				} catch (error) {
					reportError(error, 'event');
				}
			});
		}

		dispose() {
			this._listeners.clear();
		}
	}

	class CancellationTokenSource {
		constructor() {
			this._emitter = new EventEmitter();
			this.token = {
				isCancellationRequested: false,
				onCancellationRequested: this._emitter.event,
			};
		}

		cancel() {
			if (this.token.isCancellationRequested) return;
			this.token.isCancellationRequested = true;
			this._emitter.fire();
		}

		dispose() {
			this._emitter.dispose();
		}
	}

	const StatusBarAlignment = Object.freeze({ Left: 1, Right: 2 });
	const ProgressLocation = Object.freeze({ Notification: 15, Window: 10 });
	const UIKind = Object.freeze({ Desktop: 1, Web: 2, Celular: 3 });
	const ConfigurationTarget = Object.freeze({ Global: 1, Workspace: 2 });
	const FileType = Object.freeze({ Unknown: 0, File: 1, Directory: 2, SymbolicLink: 64 });
	const EndOfLine = Object.freeze({ LF: 1, CRLF: 2 });
	const TextEditorRevealType = Object.freeze({ Default: 0, InCenter: 1, InCenterIfOutsideViewport: 2, AtTop: 3 });
	const TextEditorSelectionChangeKind = Object.freeze({ Keyboard: 1, Mouse: 2, Command: 3 });
	const DecorationRangeBehavior = Object.freeze({ OpenOpen: 0, ClosedClosed: 1, OpenClosed: 2, ClosedOpen: 3 });
	const FileChangeType = Object.freeze({ Changed: 1, Created: 2, Deleted: 3 });
	const ViewColumn = Object.freeze({ Active: -1, Beside: -2, One: 1 });
	const ColorThemeKind = Object.freeze({ Light: 1, Dark: 2 });
	const CompletionItemKind = Object.freeze({ Text: 0, Method: 1, Function: 2, Constructor: 3, Field: 4, Variable: 5, Class: 6, Interface: 7, Module: 8, Property: 9, Unit: 10, Value: 11, Enum: 12, Keyword: 13, Snippet: 14, Color: 15, File: 16, Reference: 17, Folder: 18, EnumMember: 19, Constant: 20, Struct: 21, Event: 22, Operator: 23, TypeParameter: 24, User: 25, Issue: 26 });
	const CompletionTriggerKind = Object.freeze({ Invoke: 0, TriggerCharacter: 1, TriggerForIncompleteCompletions: 2 });
	const DiagnosticSeverity = Object.freeze({ Error: 0, Warning: 1, Information: 2, Hint: 3 });
	const DiagnosticTag = Object.freeze({ Unnecessary: 1, Deprecated: 2 });
	const SymbolKind = Object.freeze({ File: 0, Module: 1, Namespace: 2, Package: 3, Class: 4, Method: 5, Property: 6, Field: 7, Constructor: 8, Enum: 9, Interface: 10, Function: 11, Variable: 12, Constant: 13, String: 14, Number: 15, Boolean: 16, Array: 17, Object: 18, Key: 19, Null: 20, EnumMember: 21, Struct: 22, Event: 23, Operator: 24, TypeParameter: 25 });
	const CodeActionTriggerKind = Object.freeze({ Invoke: 1, Automatic: 2 });

	const configurationEmitter = new EventEmitter();
	const colorThemeEmitter = new EventEmitter();
	const documentOpenEmitter = new EventEmitter();
	const documentChangeEmitter = new EventEmitter();
	const documentCloseEmitter = new EventEmitter();
	const documentSaveEmitter = new EventEmitter();
	const filesCreatedEmitter = new EventEmitter();
	const filesDeletedEmitter = new EventEmitter();
	const filesRenamedEmitter = new EventEmitter();
	const projectOpenEmitter = new EventEmitter();
	const projectCloseEmitter = new EventEmitter();
	const activeProjectEmitter = new EventEmitter();
	const activeEditorEmitter = new EventEmitter();
	const selectionEmitter = new EventEmitter();
	const visibleRangesEmitter = new EventEmitter();

	function cloneable(value) {
		if (value === undefined) return null;
		try {
			return JSON.parse(JSON.stringify(value));
		} catch (error) {
			return null;
		}
	}

	function normalizePath(path) {
		const parts = [];
		String(path || '')
			.replace(/\\/g, '/')
			.split('/')
			.forEach((segment) => {
				if (!segment || segment === '.') return;
				if (segment === '..') parts.pop();
				else parts.push(segment);
			});
		return parts.join('/');
	}

	class Uri {
		constructor(scheme, authority, path, query, fragment) {
			this.scheme = scheme || 'synapse';
			this.authority = authority || '';
			this.path = path || '/';
			this.query = query || '';
			this.fragment = fragment || '';
			Object.freeze(this);
		}

		get fsPath() {
			if (this.scheme !== 'synapse') return this.path;
			return this.path.replace(/^\/projeto\/?/, '');
		}

		with(change) {
			change = change || {};
			return new Uri(
				change.scheme === undefined ? this.scheme : change.scheme,
				change.authority === undefined ? this.authority : change.authority,
				change.path === undefined ? this.path : change.path,
				change.query === undefined ? this.query : change.query,
				change.fragment === undefined ? this.fragment : change.fragment,
			);
		}

		toString() {
			let text = this.scheme + ':' + (this.authority ? '//' + this.authority : '') + this.path;
			if (this.query) text += '?' + this.query;
			if (this.fragment) text += '#' + this.fragment;
			return text;
		}

		toJSON() {
			return { $mid: 1, scheme: this.scheme, authority: this.authority, path: this.path, query: this.query, fragment: this.fragment, external: this.toString() };
		}

		static file(path) {
			return new Uri('synapse', '', '/projeto/' + normalizePath(path));
		}

		static parse(value) {
			if (value instanceof Uri) return value;
			const text = String(value || '');
			const match = /^([a-z][a-z0-9+.-]*):(?:\/\/([^/?#]*))?([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/i.exec(text);
			if (!match) return Uri.file(text);
			const scheme = match[1].toLowerCase();
			let path = match[3] || '/';
			if (scheme === 'synapse') path = '/projeto/' + normalizePath(path.replace(/^\/projeto\/?/, ''));
			return new Uri(scheme, match[2] || '', path, match[4] || '', match[5] || '');
		}

		static joinPath(base, ...segments) {
			const uri = Uri.parse(base);
			return uri.with({ path: '/' + normalizePath(uri.path + '/' + segments.join('/')) });
		}

		static from(components) {
			return new Uri(components.scheme, components.authority, components.path, components.query, components.fragment);
		}

		static isUri(value) {
			return value instanceof Uri;
		}
	}

	function relativePathOf(value) {
		if (value instanceof Uri) {
			if (value.scheme !== 'synapse') throw new Error(`Uri "${value.toString()}" está fora do projeto.`);
			return value.fsPath;
		}
		if (value && typeof value === 'object' && typeof value.path === 'string' && typeof value.scheme === 'string') return Uri.from(value).fsPath;
		if (value && typeof value === 'object' && value.uri) return relativePathOf(value.uri);
		const text = String(value === undefined || value === null ? '' : value).trim();
		if (text.startsWith(URI_PREFIX)) return normalizePath(text.slice(URI_PREFIX.length));
		if (/^[a-z][a-z0-9+.-]*:/i.test(text)) throw new Error(`Uri "${text}" está fora do projeto.`);
		return normalizePath(text);
	}

	class Position {
		constructor(line, character) {
			this.line = Math.max(0, Number(line) || 0);
			this.character = Math.max(0, Number(character) || 0);
			Object.freeze(this);
		}

		isBefore(other) {
			return this.line < other.line || (this.line === other.line && this.character < other.character);
		}

		isBeforeOrEqual(other) {
			return this.isBefore(other) || this.isEqual(other);
		}

		isAfter(other) {
			return other.isBefore(this);
		}

		isAfterOrEqual(other) {
			return other.isBeforeOrEqual(this);
		}

		isEqual(other) {
			return !!other && this.line === other.line && this.character === other.character;
		}

		compareTo(other) {
			if (this.line !== other.line) return this.line - other.line;
			return this.character - other.character;
		}

		translate(lineDeltaOrChange, characterDelta) {
			if (lineDeltaOrChange && typeof lineDeltaOrChange === 'object') {
				return new Position(this.line + (lineDeltaOrChange.lineDelta || 0), this.character + (lineDeltaOrChange.characterDelta || 0));
			}
			return new Position(this.line + (Number(lineDeltaOrChange) || 0), this.character + (Number(characterDelta) || 0));
		}

		with(lineOrChange, character) {
			if (lineOrChange && typeof lineOrChange === 'object') {
				return new Position(lineOrChange.line === undefined ? this.line : lineOrChange.line, lineOrChange.character === undefined ? this.character : lineOrChange.character);
			}
			return new Position(lineOrChange === undefined ? this.line : lineOrChange, character === undefined ? this.character : character);
		}

		toJSON() {
			return { line: this.line, character: this.character };
		}

		static from(value) {
			if (value instanceof Position) return value;
			return new Position(value && value.line, value && value.character);
		}
	}

	class Range {
		constructor(startOrLine, startCharacterOrEnd, endLine, endCharacter) {
			let start;
			let end;
			if (typeof startOrLine === 'number') {
				start = new Position(startOrLine, startCharacterOrEnd);
				end = new Position(endLine, endCharacter);
			} else {
				start = Position.from(startOrLine);
				end = Position.from(startCharacterOrEnd);
			}
			if (start.isAfter(end)) [start, end] = [end, start];
			this.start = start;
			this.end = end;
		}

		get isEmpty() {
			return this.start.isEqual(this.end);
		}

		get isSingleLine() {
			return this.start.line === this.end.line;
		}

		contains(positionOrRange) {
			if (positionOrRange instanceof Range) return this.contains(positionOrRange.start) && this.contains(positionOrRange.end);
			const position = Position.from(positionOrRange);
			return this.start.isBeforeOrEqual(position) && this.end.isAfterOrEqual(position);
		}

		isEqual(other) {
			return !!other && this.start.isEqual(other.start) && this.end.isEqual(other.end);
		}

		intersection(other) {
			const start = this.start.isAfter(other.start) ? this.start : other.start;
			const end = this.end.isBefore(other.end) ? this.end : other.end;
			if (start.isAfter(end)) return undefined;
			return new Range(start, end);
		}

		union(other) {
			return new Range(this.start.isBefore(other.start) ? this.start : other.start, this.end.isAfter(other.end) ? this.end : other.end);
		}

		with(startOrChange, end) {
			if (startOrChange && typeof startOrChange === 'object' && !(startOrChange instanceof Position) && ('start' in startOrChange || 'end' in startOrChange)) {
				return new Range(startOrChange.start || this.start, startOrChange.end || this.end);
			}
			return new Range(startOrChange || this.start, end || this.end);
		}

		toJSON() {
			return { start: this.start.toJSON(), end: this.end.toJSON() };
		}

		static from(value) {
			if (value instanceof Range) return value;
			if (!value) return new Range(0, 0, 0, 0);
			return new Range(value.start || value.anchor, value.end || value.active || value.start);
		}
	}

	class Selection extends Range {
		constructor(anchorOrLine, activeOrCharacter, activeLine, activeCharacter) {
			let anchor;
			let active;
			if (typeof anchorOrLine === 'number') {
				anchor = new Position(anchorOrLine, activeOrCharacter);
				active = new Position(activeLine, activeCharacter);
			} else {
				anchor = Position.from(anchorOrLine);
				active = Position.from(activeOrCharacter);
			}
			super(anchor, active);
			this.anchor = anchor;
			this.active = active;
		}

		get isReversed() {
			return this.anchor.isAfter(this.active);
		}

		toJSON() {
			return { anchor: this.anchor.toJSON(), active: this.active.toJSON(), start: this.start.toJSON(), end: this.end.toJSON() };
		}

		static from(value) {
			if (value instanceof Selection) return value;
			if (!value) return new Selection(0, 0, 0, 0);
			return new Selection(value.anchor || value.start, value.active || value.end || value.start);
		}
	}

	class TextEdit {
		constructor(range, newText) {
			this.range = Range.from(range);
			this.newText = String(newText === undefined ? '' : newText);
			this.newEol = undefined;
		}

		static replace(range, newText) {
			return new TextEdit(range, newText);
		}

		static insert(position, newText) {
			return new TextEdit(new Range(position, position), newText);
		}

		static delete(range) {
			return new TextEdit(range, '');
		}

		static setEndOfLine(eol) {
			const edit = new TextEdit(new Range(0, 0, 0, 0), '');
			edit.newEol = eol;
			return edit;
		}
	}

	class SnippetString {
		constructor(value) {
			this.value = String(value || '');
			this._tabstop = 1;
		}

		appendText(text) {
			this.value += String(text).replace(/\$|\}|\\/g, '\\$&');
			return this;
		}

		appendTabstop(number) {
			this.value += '$' + (number === undefined ? this._tabstop++ : number);
			return this;
		}

		appendPlaceholder(value, number) {
			const index = number === undefined ? this._tabstop++ : number;
			if (typeof value === 'function') {
				const nested = new SnippetString();
				nested._tabstop = this._tabstop;
				value(nested);
				this._tabstop = nested._tabstop;
				value = nested.value;
			} else value = String(value).replace(/\$|\}|\\/g, '\\$&');
			this.value += '${' + index + ':' + value + '}';
			return this;
		}

		appendChoice(values, number) {
			this.value += '${' + (number === undefined ? this._tabstop++ : number) + '|' + values.map((item) => String(item).replace(/[|,\\]/g, '\\$&')).join(',') + '|}';
			return this;
		}

		appendVariable(name, defaultValue) {
			if (typeof defaultValue === 'function') {
				const nested = new SnippetString();
				nested._tabstop = this._tabstop;
				defaultValue(nested);
				this._tabstop = nested._tabstop;
				defaultValue = nested.value;
			}
			this.value += '${' + name + (defaultValue ? ':' + defaultValue : '') + '}';
			return this;
		}
	}

	class WorkspaceEdit {
		constructor() {
			this._documents = new Map();
			this._operations = [];
			this.label = '';
		}

		get size() {
			return this._documents.size + this._operations.length;
		}

		_bucket(uri) {
			const key = relativePathOf(uri);
			if (!this._documents.has(key)) this._documents.set(key, { path: key, edits: [], version: undefined, createIfMissing: false });
			return this._documents.get(key);
		}

		replace(uri, range, newText, metadata) {
			this._bucket(uri).edits.push(new TextEdit(range, newText));
			return this;
		}

		insert(uri, position, newText) {
			return this.replace(uri, new Range(position, position), newText);
		}

		delete(uri, range) {
			return this.replace(uri, range, '');
		}

		has(uri) {
			return this._documents.has(relativePathOf(uri));
		}

		set(uri, edits) {
			const bucket = this._bucket(uri);
			bucket.edits = (Array.isArray(edits) ? edits : []).map((edit) => (edit instanceof TextEdit ? edit : new TextEdit(edit.range, edit.newText)));
			return this;
		}

		get(uri) {
			const bucket = this._documents.get(relativePathOf(uri));
			return bucket ? [...bucket.edits] : [];
		}

		expectVersion(uri, version) {
			this._bucket(uri).version = version;
			return this;
		}

		createFile(uri, options) {
			options = options || {};
			this._operations.push({ kind: 'create', path: relativePathOf(uri), contents: options.contents instanceof Uint8Array ? new TextDecoder().decode(options.contents) : String(options.contents || ''), options: { overwrite: !!options.overwrite, ignoreIfExists: !!options.ignoreIfExists } });
			return this;
		}

		deleteFile(uri, options) {
			options = options || {};
			this._operations.push({ kind: 'delete', path: relativePathOf(uri), options: { recursive: options.recursive !== false, ignoreIfNotExists: !!options.ignoreIfNotExists } });
			return this;
		}

		renameFile(oldUri, newUri, options) {
			options = options || {};
			this._operations.push({ kind: 'rename', from: relativePathOf(oldUri), to: relativePathOf(newUri), options: { overwrite: !!options.overwrite, ignoreIfNotExists: !!options.ignoreIfNotExists } });
			return this;
		}

		entries() {
			return [...this._documents.values()].map((bucket) => [Uri.file(bucket.path), [...bucket.edits]]);
		}

		toJSON() {
			return {
				label: this.label,
				documentChanges: [...this._documents.values()].filter((bucket) => bucket.edits.length).map((bucket) => ({
					uri: URI_PREFIX + bucket.path,
					version: bucket.version,
					createIfMissing: bucket.createIfMissing,
					edits: bucket.edits.map((edit) => ({ range: edit.range.toJSON(), newText: edit.newText })),
				})),
				fileOperations: this._operations.map((operation) => ({ ...operation })),
			};
		}
	}

	class FileSystemError extends Error {
		constructor(messageOrUri, code) {
			super(typeof messageOrUri === 'string' ? messageOrUri : String(messageOrUri || ''));
			this.name = 'FileSystemError';
			this.code = code || 'Unknown';
		}

		static FileNotFound(uri) {
			return new FileSystemError(`Arquivo não encontrado: ${uri || ''}`, 'FileNotFound');
		}

		static FileExists(uri) {
			return new FileSystemError(`Arquivo já existe: ${uri || ''}`, 'FileExists');
		}

		static FileNotADirectory(uri) {
			return new FileSystemError(`Não é uma pasta: ${uri || ''}`, 'FileNotADirectory');
		}

		static FileIsADirectory(uri) {
			return new FileSystemError(`É uma pasta: ${uri || ''}`, 'FileIsADirectory');
		}

		static NoPermissions(uri) {
			return new FileSystemError(`Sem permissão: ${uri || ''}`, 'NoPermissions');
		}

		static Unavailable(uri) {
			return new FileSystemError(`Indisponível: ${uri || ''}`, 'Unavailable');
		}
	}

	function translateFsError(error, uri) {
		if (error && error.data && error.data.code) {
			const code = error.data.code;
			if (typeof FileSystemError[code] === 'function') {
				const translated = FileSystemError[code](uri);
				translated.message = error.message;
				return translated;
			}
			const generic = new FileSystemError(error.message, code);
			return generic;
		}
		return error;
	}

	function lineStartsOf(text) {
		const starts = [0];
		for (let index = text.indexOf('\n'); index >= 0; index = text.indexOf('\n', index + 1)) starts.push(index + 1);
		return starts;
	}

	function lineIndexAt(starts, offset) {
		let lower = 0;
		let upper = starts.length - 1;
		while (lower < upper) {
			const middle = Math.ceil((lower + upper) / 2);
			if (starts[middle] <= offset) lower = middle;
			else upper = middle - 1;
		}
		return lower;
	}

	class TextDocument {
		constructor(payload) {
			this._path = payload.path || '';
			this.uri = payload.untitled ? Uri.parse(payload.uri) : Uri.file(this._path);
			this.fileName = this._path || payload.uri;
			this.isUntitled = !!payload.untitled;
			this.languageId = payload.languageId || 'plaintext';
			this.version = payload.version || 1;
			this.isDirty = !!payload.isDirty;
			this.isClosed = false;
			this.eol = payload.eol === 2 ? EndOfLine.CRLF : EndOfLine.LF;
			this._tooLarge = !!payload.tooLarge;
			this._text = typeof payload.text === 'string' ? payload.text : '';
			this._starts = null;
		}

		get _lineStarts() {
			if (!this._starts) this._starts = lineStartsOf(this._text);
			return this._starts;
		}

		get lineCount() {
			return this._lineStarts.length;
		}

		get isTooLarge() {
			return this._tooLarge;
		}

		_update(payload) {
			if (payload.version !== undefined) this.version = payload.version;
			if (payload.isDirty !== undefined) this.isDirty = !!payload.isDirty;
			if (payload.languageId) this.languageId = payload.languageId;
			if (typeof payload.text === 'string') {
				this._text = payload.text;
				this._tooLarge = false;
			} else if (payload.change && !this._tooLarge) {
				const change = payload.change;
				this._text = this._text.slice(0, change.rangeOffset) + change.text + this._text.slice(change.rangeOffset + change.rangeLength);
			} else if (payload.tooLarge) {
				this._tooLarge = true;
				this._text = '';
			}
			this._starts = null;
		}

		getText(range) {
			if (!range) return this._text;
			const normalized = this.validateRange(Range.from(range));
			return this._text.slice(this.offsetAt(normalized.start), this.offsetAt(normalized.end));
		}

		lineAt(lineOrPosition) {
			const line = typeof lineOrPosition === 'number' ? lineOrPosition : Position.from(lineOrPosition).line;
			const starts = this._lineStarts;
			if (line < 0 || line >= starts.length) throw new Error(`Linha ${line} fora do documento (${starts.length} linhas).`);
			const start = starts[line];
			const end = line + 1 < starts.length ? starts[line + 1] - 1 : this._text.length;
			let text = this._text.slice(start, end);
			if (text.endsWith('\r')) text = text.slice(0, -1);
			const firstNonWhitespace = /^\s*/.exec(text)[0].length;
			return Object.freeze({
				lineNumber: line,
				text,
				range: new Range(line, 0, line, text.length),
				rangeIncludingLineBreak: new Range(line, 0, line + 1 < starts.length ? line + 1 : line, line + 1 < starts.length ? 0 : text.length),
				firstNonWhitespaceCharacterIndex: firstNonWhitespace,
				isEmptyOrWhitespace: firstNonWhitespace === text.length,
			});
		}

		offsetAt(position) {
			const target = Position.from(position);
			const starts = this._lineStarts;
			const line = Math.max(0, Math.min(starts.length - 1, target.line));
			const lineStart = starts[line];
			const lineEnd = line + 1 < starts.length ? starts[line + 1] - 1 : this._text.length;
			return lineStart + Math.max(0, Math.min(lineEnd - lineStart, target.character));
		}

		positionAt(offset) {
			const clamped = Math.max(0, Math.min(this._text.length, Number(offset) || 0));
			const starts = this._lineStarts;
			const line = lineIndexAt(starts, clamped);
			return new Position(line, clamped - starts[line]);
		}

		validatePosition(position) {
			return this.positionAt(this.offsetAt(position));
		}

		validateRange(range) {
			const normalized = Range.from(range);
			return new Range(this.validatePosition(normalized.start), this.validatePosition(normalized.end));
		}

		getWordRangeAtPosition(position, regex) {
			const target = this.validatePosition(position);
			const line = this.lineAt(target.line).text;
			const pattern = regex instanceof RegExp ? new RegExp(regex.source, regex.flags.replace('g', '') + 'g') : /[\p{L}\p{N}_$]+/gu;
			let match;
			while ((match = pattern.exec(line))) {
				if (match.index <= target.character && match.index + match[0].length >= target.character) {
					if (match[0].length === 0) break;
					return new Range(target.line, match.index, target.line, match.index + match[0].length);
				}
				if (match[0].length === 0) pattern.lastIndex += 1;
			}
			return undefined;
		}

		save() {
			return Promise.resolve(!this.isUntitled);
		}

		toJSON() {
			return { uri: this.uri.toString(), languageId: this.languageId, version: this.version, isDirty: this.isDirty, lineCount: this.lineCount };
		}
	}

	function documentFor(payload) {
		if (!payload) return null;
		const key = payload.untitled ? payload.uri : payload.path;
		let document = documents.get(key);
		if (!document) {
			document = new TextDocument(payload);
			documents.set(key, document);
		} else document._update(payload);
		return document;
	}

	function closeDocument(path) {
		const document = documents.get(path);
		if (!document) return null;
		documents.delete(path);
		document.isClosed = true;
		return document;
	}

	function createMemento(scope, initial) {
		const cache = new Map(Object.entries(initial || {}));
		return Object.freeze({
			keys: () => [...cache.keys()],
			get: (key, defaultValue) => (cache.has(key) ? cache.get(key) : defaultValue),
			update: (key, value) => {
				if (value === undefined) cache.delete(key);
				else cache.set(key, value);
				return endpoint.call('state.update', { scope, key, value: cloneable(value) });
			},
		});
	}

	function extensionBlobUrl(relativePath) {
		const path = normalizePath(relativePath);
		if (blobUrls.has(path)) return blobUrls.get(path);
		if (!state.files.has(path)) {
			throw new RpcError(ERROR_CODES.EXTENSION_ERROR, `Arquivo "${path}" não existe na pasta da extensão.`);
		}
		const url = URL.createObjectURL(new Blob([state.files.get(path)], { type: 'text/javascript' }));
		blobUrls.set(path, url);
		return url;
	}

	self.importScripts = function (...references) {
		references.forEach((reference) => {
			const text = String(reference);
			if (text.startsWith('blob:')) {
				nativeImportScripts(text);
				return;
			}
			if (/^[a-z]+:/i.test(text)) {
				throw new RpcError(ERROR_CODES.PERMISSION_DENIED, `importScripts bloqueado para "${text}": só arquivos da própria extensão podem ser carregados.`);
			}
			nativeImportScripts(extensionBlobUrl(text));
		});
	};

	function requireRegistered(command) {
		const entry = commands.get(command);
		if (!entry) {
			throw new RpcError(ERROR_CODES.EXTENSION_ERROR, `Comando "${command}" não está registrado nesta extensão.`);
		}
		return entry;
	}

	function messageItems(rawItems) {
		let options = {};
		let items = rawItems;
		if (items.length && items[0] && typeof items[0] === 'object' && !('title' in items[0]) && ('modal' in items[0] || 'detail' in items[0])) {
			options = items[0];
			items = items.slice(1);
		}
		return { options, items };
	}

	function message(kind) {
		return async (text, ...rawItems) => {
			const { options, items } = messageItems(rawItems);
			const payload = items.map((item) => (item && typeof item === 'object' ? { title: String(item.title), isCloseAffordance: !!item.isCloseAffordance } : { title: String(item) }));
			const index = await endpoint.call('window.showMessage', { kind, message: String(text), items: payload, modal: !!options.modal, detail: options.detail ? String(options.detail) : '' }, { timeoutMs: 0 });
			return index === null || index === undefined ? undefined : items[index];
		};
	}

	async function showQuickPick(itemsOrPromise, options, token) {
		const source = await itemsOrPromise;
		if (token && token.isCancellationRequested) return undefined;
		const list = Array.isArray(source) ? source : [];
		const payload = list.map((item) =>
			item && typeof item === 'object'
				? { label: String(item.label), description: item.description ? String(item.description) : '', detail: item.detail ? String(item.detail) : '', picked: !!item.picked, kind: item.kind === -1 ? 'separator' : 'item' }
				: { label: String(item) },
		);
		const clean = options ? cloneable({ title: options.title, placeHolder: options.placeHolder, canPickMany: !!options.canPickMany, matchOnDescription: !!options.matchOnDescription, matchOnDetail: !!options.matchOnDetail }) : {};
		const result = await endpoint.call('window.showQuickPick', { items: payload, options: clean }, { timeoutMs: 0 });
		if (!Array.isArray(result)) return undefined;
		const picked = result.map((index) => list[index]).filter((item) => item !== undefined);
		return clean.canPickMany ? picked : picked[0];
	}

	async function showInputBox(options, token) {
		options = options || {};
		const inputToken = nextHandle('in');
		const validate = typeof options.validateInput === 'function';
		if (validate) inputValidators.set(inputToken, options.validateInput);
		try {
			const clean = cloneable({ title: options.title, prompt: options.prompt, value: options.value, placeHolder: options.placeHolder, password: !!options.password, ignoreFocusOut: !!options.ignoreFocusOut, valueSelection: options.valueSelection, okLabel: options.okLabel });
			const result = await endpoint.call('window.showInputBox', { token: inputToken, validate, options: clean }, { timeoutMs: 0 });
			return result === null || result === undefined ? undefined : String(result);
		} finally {
			inputValidators.delete(inputToken);
		}
	}

	function createStatusBarItem(idOrAlignment, alignmentOrPriority, maybePriority) {
		let id = null;
		let alignment = idOrAlignment;
		let priority = alignmentOrPriority;
		if (typeof idOrAlignment === 'string') {
			id = idOrAlignment;
			alignment = alignmentOrPriority;
			priority = maybePriority;
		}
		const handle = nextHandle('sb');
		const record = { text: '', tooltip: '', command: undefined, color: undefined, backgroundColor: undefined, accessibilityInformation: undefined, visible: false, priority };
		let disposed = false;
		let created = endpoint.call('statusBar.create', {
			handle,
			id,
			alignment: alignment === StatusBarAlignment.Right || alignment === 'right' ? 'right' : 'left',
			priority: typeof priority === 'number' ? priority : undefined,
		});
		created.catch((error) => reportError(error, 'statusBar'));
		let pendingPatch = null;
		let flushTimer = null;

		function flush() {
			flushTimer = null;
			if (disposed || !pendingPatch) return;
			const patch = pendingPatch;
			pendingPatch = null;
			created.then(() => endpoint.call('statusBar.update', { handle, patch })).catch((error) => reportError(error, 'statusBar'));
		}

		function queue(key, value) {
			if (disposed) return;
			pendingPatch = pendingPatch || {};
			pendingPatch[key] = value;
			if (!flushTimer) flushTimer = setTimeout(flush, 0);
		}

		function define(key, serialize) {
			Object.defineProperty(item, key, {
				enumerable: true,
				get: () => record[key],
				set: (value) => {
					record[key] = value;
					queue(key, serialize ? serialize(value) : cloneable(value));
				},
			});
		}

		const item = {
			id: id || handle,
			alignment: alignment === StatusBarAlignment.Right || alignment === 'right' ? StatusBarAlignment.Right : StatusBarAlignment.Left,
			show() {
				record.visible = true;
				queue('visible', true);
			},
			hide() {
				record.visible = false;
				queue('visible', false);
			},
			dispose() {
				if (disposed) return;
				disposed = true;
				if (flushTimer) clearTimeout(flushTimer);
				created.then(() => endpoint.call('statusBar.dispose', { handle })).catch(() => {});
			},
		};
		define('text', (value) => String(value === undefined || value === null ? '' : value));
		define('tooltip', (value) => String(value === undefined || value === null ? '' : value));
		define('command', (value) => (typeof value === 'string' ? value : value && typeof value === 'object' ? cloneable({ command: value.command, arguments: value.arguments }) : null));
		define('color', (value) => (typeof value === 'string' ? value : ''));
		define('backgroundColor', (value) => (value && typeof value === 'object' && typeof value.id === 'string' ? (value.id.includes('error') ? 'error' : value.id.includes('warning') ? 'warning' : '') : typeof value === 'string' ? value : ''));
		define('accessibilityInformation', (value) => cloneable(value));
		define('priority', (value) => (typeof value === 'number' ? value : undefined));
		return item;
	}

	function setStatusBarMessage(text, hideAfterOrPromise) {
		const timeoutMs = typeof hideAfterOrPromise === 'number' ? hideAfterOrPromise : undefined;
		endpoint.call('window.setStatusBarMessage', { message: String(text), timeoutMs }).catch((error) => reportError(error, 'statusBar'));
		if (hideAfterOrPromise && typeof hideAfterOrPromise.then === 'function') {
			hideAfterOrPromise.then(
				() => endpoint.call('window.setStatusBarMessage', { message: '', timeoutMs: 1 }).catch(() => {}),
				() => endpoint.call('window.setStatusBarMessage', { message: '', timeoutMs: 1 }).catch(() => {}),
			);
		}
		return new Disposable(() => endpoint.call('window.setStatusBarMessage', { message: '', timeoutMs: 1 }).catch(() => {}));
	}

	async function withProgress(options, task) {
		options = options || {};
		if (typeof task !== 'function') throw new TypeError('withProgress: task deve ser uma função.');
		const token = nextHandle('pg');
		const source = new CancellationTokenSource();
		progressTokens.set(token, source);
		const location = options.location === ProgressLocation.Notification || options.location === 'notification' ? 'notification' : 'window';
		await endpoint.call('progress.begin', { token, title: options.title ? String(options.title) : '', location, cancellable: !!options.cancellable });
		const progress = Object.freeze({
			report(value) {
				value = value || {};
				endpoint.call('progress.report', { token, message: value.message !== undefined ? String(value.message) : undefined, increment: typeof value.increment === 'number' ? value.increment : undefined }).catch(() => {});
			},
		});
		try {
			return await task(progress, source.token);
		} finally {
			progressTokens.delete(token);
			source.dispose();
			endpoint.call('progress.end', { token }).catch(() => {});
		}
	}

	function sectionKey(section, key) {
		if (!section) return String(key);
		return `${section}.${key}`;
	}

	function getConfiguration(section) {
		const prefix = section ? String(section) : '';
		const values = state.configuration;
		function resolve(key) {
			const full = sectionKey(prefix, key);
			if (Object.prototype.hasOwnProperty.call(values, full)) return values[full];
			return undefined;
		}
		const configuration = {
			get(key, defaultValue) {
				const value = resolve(key);
				return value === undefined ? defaultValue : cloneable(value);
			},
			has(key) {
				return resolve(key) !== undefined;
			},
			inspect(key) {
				const value = resolve(key);
				return value === undefined ? undefined : { key: sectionKey(prefix, key), globalValue: cloneable(value) };
			},
			update(key, value) {
				return endpoint.call('configuration.update', { key: sectionKey(prefix, key), value: value === undefined ? undefined : cloneable(value) }).then((next) => {
					state.configuration[sectionKey(prefix, key)] = next;
					return true;
				});
			},
		};
		Object.keys(values).forEach((full) => {
			if (prefix && !full.startsWith(prefix + '.')) return;
			const rest = prefix ? full.slice(prefix.length + 1) : full;
			if (!(rest in configuration)) {
				Object.defineProperty(configuration, rest, { enumerable: true, get: () => cloneable(values[full]) });
			}
		});
		return Object.freeze(configuration);
	}

	function uriParam(value) {
		return URI_PREFIX + relativePathOf(value);
	}

	function bytesOf(content) {
		if (content instanceof Uint8Array) return content;
		if (content instanceof ArrayBuffer) return new Uint8Array(content);
		return new TextEncoder().encode(String(content === undefined || content === null ? '' : content));
	}

	function base64Of(bytes) {
		let binary = '';
		for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(index, index + 0x8000));
		return btoa(binary);
	}

	function bytesFromBase64(base64) {
		const binary = atob(base64 || '');
		const bytes = new Uint8Array(binary.length);
		for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
		return bytes;
	}

	async function fsCall(method, params, uri) {
		try {
			return await endpoint.call(method, params, { timeoutMs: 60000 });
		} catch (error) {
			throw translateFsError(error, uri);
		}
	}

	const fs = Object.freeze({
		async readFile(uri) {
			const result = await fsCall('workspace.fs.readFile', { path: uriParam(uri), binary: true }, uri);
			if (result && result.kind === 'binary') return bytesFromBase64(result.base64);
			return new TextEncoder().encode(result && typeof result.text === 'string' ? result.text : '');
		},
		async readText(uri) {
			const result = await fsCall('workspace.fs.readFile', { path: uriParam(uri), binary: true }, uri);
			if (result && result.kind === 'binary') return new TextDecoder().decode(bytesFromBase64(result.base64));
			return result && typeof result.text === 'string' ? result.text : '';
		},
		writeFile(uri, content, options) {
			const isText = typeof content === 'string';
			const payload = { path: uriParam(uri), options: cloneable(options || {}) };
			if (isText) payload.content = content;
			else payload.base64 = base64Of(bytesOf(content));
			return fsCall('workspace.fs.writeFile', payload, uri).then(() => undefined);
		},
		readDirectory(uri) {
			return fsCall('workspace.fs.readDirectory', { path: uriParam(uri) }, uri);
		},
		stat(uri) {
			return fsCall('workspace.fs.stat', { path: uriParam(uri) }, uri).then((result) => ({ type: result.type, ctime: result.ctime, mtime: result.mtime, size: result.size, permissions: undefined }));
		},
		createDirectory(uri) {
			return fsCall('workspace.fs.createDirectory', { path: uriParam(uri) }, uri).then(() => undefined);
		},
		delete(uri, options) {
			return fsCall('workspace.fs.delete', { path: uriParam(uri), options: cloneable(options || { recursive: false }) }, uri).then(() => undefined);
		},
		rename(oldUri, newUri, options) {
			return fsCall('workspace.fs.rename', { from: uriParam(oldUri), to: uriParam(newUri), options: cloneable(options || {}) }, oldUri).then(() => undefined);
		},
		copy(source, target, options) {
			return fs.readFile(source).then((bytes) => fs.writeFile(target, bytes, { overwrite: !!(options && options.overwrite) }));
		},
		isWritableFileSystem(scheme) {
			return scheme === 'synapse';
		},
	});

	function createFileSystemWatcher(globPattern, ignoreCreateEvents, ignoreChangeEvents, ignoreDeleteEvents) {
		const glob = globPattern && typeof globPattern === 'object' && globPattern.pattern ? String(globPattern.pattern) : String(globPattern || '**/*');
		const handle = nextHandle('fw');
		const create = new EventEmitter();
		const change = new EventEmitter();
		const remove = new EventEmitter();
		watchers.set(handle, { create, change, remove });
		endpoint.call('workspace.watch', { handle, glob, ignoreCreate: !!ignoreCreateEvents, ignoreChange: !!ignoreChangeEvents, ignoreDelete: !!ignoreDeleteEvents }).catch((error) => reportError(error, 'watcher'));
		return Object.freeze({
			ignoreCreateEvents: !!ignoreCreateEvents,
			ignoreChangeEvents: !!ignoreChangeEvents,
			ignoreDeleteEvents: !!ignoreDeleteEvents,
			onDidCreate: create.event,
			onDidChange: change.event,
			onDidDelete: remove.event,
			dispose() {
				if (!watchers.has(handle)) return;
				watchers.delete(handle);
				create.dispose();
				change.dispose();
				remove.dispose();
				endpoint.call('workspace.unwatch', { handle }).catch(() => {});
			},
		});
	}

	async function openTextDocument(uriOrOptions) {
		if (uriOrOptions && typeof uriOrOptions === 'object' && !(uriOrOptions instanceof Uri) && !('scheme' in uriOrOptions) && ('content' in uriOrOptions || 'language' in uriOrOptions)) {
			const payload = await endpoint.call('workspace.openTextDocument', { untitled: true, name: nextHandle('untitled-'), content: String(uriOrOptions.content || ''), language: uriOrOptions.language ? String(uriOrOptions.language) : 'plaintext' });
			return documentFor(payload);
		}
		const path = relativePathOf(uriOrOptions);
		const existing = documents.get(path);
		if (existing && !existing.isTooLarge) return existing;
		const payload = await fsCall('workspace.openTextDocument', { path }, uriOrOptions);
		return documentFor(payload);
	}

	async function applyEdit(edit) {
		const payload = edit instanceof WorkspaceEdit ? edit.toJSON() : edit && typeof edit.toJSON === 'function' ? edit.toJSON() : cloneable(edit);
		const result = await endpoint.call('workspace.applyEdit', { edit: payload }, { timeoutMs: 120000 });
		return !!(result && result.applied);
	}

	function workspaceFolders() {
		const name = state.env.projectName || '';
		return [Object.freeze({ uri: Uri.parse('synapse:/projeto/'), name, index: 0 })];
	}

	function asRelativePath(pathOrUri) {
		try {
			return relativePathOf(pathOrUri);
		} catch (error) {
			return String(pathOrUri);
		}
	}

	function selectionsFrom(list) {
		return (Array.isArray(list) ? list : []).map((item) => Selection.from(item));
	}

	function rangesFrom(list) {
		return (Array.isArray(list) ? list : []).map((item) => Range.from(item));
	}

	function serializeRange(range) {
		const normalized = Range.from(range);
		return normalized.toJSON();
	}

	class TextEditorEdit {
		constructor(document) {
			this._document = document;
			this._edits = [];
			this._finalized = false;
		}

		_push(range, text) {
			if (this._finalized) throw new Error('TextEditorEdit já foi aplicado; use editor.edit novamente.');
			const normalized = this._document.validateRange(Range.from(range));
			this._edits.push({ start: normalized.start.toJSON(), end: normalized.end.toJSON(), text: String(text === undefined ? '' : text) });
		}

		replace(location, value) {
			if (location instanceof Position || (location && !('start' in location) && 'line' in location)) this._push(new Range(location, location), value);
			else this._push(location, value);
		}

		insert(location, value) {
			this._push(new Range(location, location), value);
		}

		delete(location) {
			this._push(location, '');
		}

		setEndOfLine(eol) {
			const text = this._document.getText();
			const converted = eol === EndOfLine.CRLF ? text.replace(/\r?\n/g, '\r\n') : text.replace(/\r\n/g, '\n');
			if (converted !== text) this._push(new Range(this._document.positionAt(0), this._document.positionAt(text.length)), converted);
		}
	}

	class TextEditor {
		constructor(snapshot) {
			this._snapshot = snapshot;
			this.document = documentFor(snapshot.document);
			this.viewColumn = ViewColumn.One;
		}

		_refresh(snapshot) {
			this._snapshot = snapshot;
			if (snapshot.document) this.document = documentFor(snapshot.document);
		}

		get selections() {
			return selectionsFrom(this._snapshot.selections);
		}

		set selections(value) {
			const list = (Array.isArray(value) ? value : [value]).filter(Boolean).map((item) => Selection.from(item).toJSON());
			this._snapshot = { ...this._snapshot, selections: list };
			endpoint.call('editor.setSelections', { path: this._snapshot.path, selections: list }).catch((error) => reportError(error, 'editor'));
		}

		get selection() {
			return this.selections[0] || new Selection(0, 0, 0, 0);
		}

		set selection(value) {
			this.selections = [value];
		}

		get visibleRanges() {
			return rangesFrom(this._snapshot.visibleRanges);
		}

		get options() {
			return { ...(this._snapshot.options || { tabSize: 2, insertSpaces: true }), cursorStyle: 1, lineNumbers: 1 };
		}

		async edit(callback, options) {
			if (typeof callback !== 'function') throw new TypeError('editor.edit: callback deve ser uma função.');
			const builder = new TextEditorEdit(this.document);
			callback(builder);
			builder._finalized = true;
			if (!builder._edits.length) return true;
			try {
				const result = await endpoint.call('editor.edit', { path: this._snapshot.path, version: this.document.version, edits: builder._edits, selectAfter: !!(options && options.selectAfter) }, { timeoutMs: 60000 });
				return !!(result && result.applied);
			} catch (error) {
				if (error && error.data && (error.data.code === 'VersionMismatch' || error.data.code === 'EditorChanged')) return false;
				throw error;
			}
		}

		async insertSnippet(snippet, location, options) {
			const source = snippet instanceof SnippetString ? snippet.value : String(snippet && snippet.value !== undefined ? snippet.value : snippet);
			const params = { path: this._snapshot.path, snippet: source };
			if (location instanceof Position || (location && 'line' in location && !('start' in location))) params.position = Position.from(location).toJSON();
			else if (location && ('start' in location || 'anchor' in location)) params.range = serializeRange(location);
			else if (Array.isArray(location) && location.length) {
				const first = location[0];
				if (first instanceof Position || ('line' in first && !('start' in first))) params.position = Position.from(first).toJSON();
				else params.range = serializeRange(first);
			}
			try {
				const result = await endpoint.call('editor.insertSnippet', params, { timeoutMs: 60000 });
				return !!(result && result.applied);
			} catch (error) {
				if (error && error.data && error.data.code === 'EditorChanged') return false;
				throw error;
			}
		}

		setDecorations(decorationType, ranges) {
			if (!decorationType || !decorationType._handle) throw new TypeError('setDecorations: tipo de decoração inválido; use window.createTextEditorDecorationType.');
			const list = (Array.isArray(ranges) ? ranges : []).map((item) => {
				if (item && typeof item === 'object' && 'range' in item) {
					return {
						range: serializeRange(item.range),
						hoverMessage: item.hoverMessage ? (typeof item.hoverMessage === 'object' && item.hoverMessage.value !== undefined ? String(item.hoverMessage.value) : String(item.hoverMessage)) : '',
						renderOptions: item.renderOptions ? cloneable(item.renderOptions) : undefined,
					};
				}
				return { range: serializeRange(item) };
			});
			endpoint.call('editor.decorations.set', { handle: decorationType._handle, path: this._snapshot.path, ranges: list }).catch((error) => reportError(error, 'decorations'));
		}

		revealRange(range, revealType) {
			endpoint.call('editor.revealRange', { path: this._snapshot.path, range: serializeRange(range), type: Number(revealType) || 0 }).catch((error) => reportError(error, 'editor'));
		}

		show(column) {
			endpoint.call('editor.show', { path: this._snapshot.path, preserveFocus: true }).catch((error) => reportError(error, 'editor'));
		}

		hide() {}
	}

	let activeEditor = null;

	function syncActiveEditor(snapshot) {
		if (!snapshot) {
			activeEditor = null;
			return null;
		}
		if (activeEditor && activeEditor._snapshot.path === snapshot.path && activeEditor._snapshot.projectId === snapshot.projectId) activeEditor._refresh(snapshot);
		else activeEditor = new TextEditor(snapshot);
		return activeEditor;
	}

	function createTextEditorDecorationType(options) {
		options = options && typeof options === 'object' ? { ...options } : {};
		const handle = nextHandle('dt');
		const iconSource = options.gutterIconPath;
		if (iconSource !== undefined && iconSource !== null) {
			let iconPath = iconSource instanceof Uri ? iconSource.path : String(iconSource);
			if (state.descriptor && iconPath.startsWith(state.descriptor.uri)) iconPath = iconPath.slice(state.descriptor.uri.length);
			if (!/^[a-z]+:/i.test(iconPath)) {
				const svg = state.files.get(normalizePath(iconPath));
				if (typeof svg === 'string' && svg.length <= MAX_GUTTER_SVG_BYTES) options.gutterIconSvg = svg;
			}
		}
		delete options.gutterIconPath;
		const type = Object.freeze({
			key: handle,
			_handle: handle,
			dispose() {
				if (!decorationTypes.has(handle)) return;
				decorationTypes.delete(handle);
				endpoint.call('editor.decorations.dispose', { handle }).catch(() => {});
			},
		});
		decorationTypes.set(handle, type);
		endpoint.call('editor.decorations.create', { handle, options: cloneable(options) }).catch((error) => reportError(error, 'decorations'));
		return type;
	}

	async function showTextDocument(documentOrUri, columnOrOptions, preserveFocus) {
		const path = documentOrUri instanceof TextDocument ? documentOrUri._path : relativePathOf(documentOrUri);
		const options = columnOrOptions && typeof columnOrOptions === 'object' ? columnOrOptions : { preserveFocus: !!preserveFocus };
		const params = { path, preserveFocus: options.preserveFocus !== false };
		if (options.selection) params.selection = Selection.from(options.selection).toJSON();
		const snapshot = await endpoint.call('editor.show', params, { timeoutMs: 30000 });
		return syncActiveEditor(snapshot);
	}

	class MarkdownString {
		constructor(value, supportThemeIcons) {
			this.value = value === undefined ? '' : String(value);
			this.isTrusted = false;
			this.supportThemeIcons = !!supportThemeIcons;
			this.supportHtml = false;
		}

		appendText(value) {
			this.value += String(value).replace(/[\\`*_{}[\]()#+\-.!]/g, '\\$&');
			return this;
		}

		appendMarkdown(value) {
			this.value += String(value);
			return this;
		}

		appendCodeblock(code, language) {
			this.value += '\n```' + (language || '') + '\n' + String(code) + '\n```\n';
			return this;
		}

		toJSON() {
			return { value: this.value };
		}
	}

	class CompletionItem {
		constructor(label, kind) {
			this.label = label;
			this.kind = kind;
		}

		toJSON() {
			const insertText = this.insertText instanceof SnippetString ? { value: this.insertText.value, snippet: true } : this.insertText;
			return {
				label: typeof this.label === 'string' ? this.label : this.label && this.label.label,
				kind: this.kind,
				detail: this.detail,
				documentation: this.documentation instanceof MarkdownString ? this.documentation.value : this.documentation,
				sortText: this.sortText,
				filterText: this.filterText,
				insertText,
				isSnippet: this.insertText instanceof SnippetString,
				range: this.range ? (this.range.inserting ? { inserting: Range.from(this.range.inserting).toJSON(), replacing: Range.from(this.range.replacing).toJSON() } : Range.from(this.range).toJSON()) : undefined,
				preselect: !!this.preselect,
				commitCharacters: this.commitCharacters,
			};
		}
	}

	class CompletionList {
		constructor(items, isIncomplete) {
			this.items = Array.isArray(items) ? items : [];
			this.isIncomplete = !!isIncomplete;
		}
	}

	class Hover {
		constructor(contents, range) {
			this.contents = Array.isArray(contents) ? contents : [contents];
			this.range = range ? Range.from(range) : undefined;
		}

		toJSON() {
			return { contents: this.contents.map((content) => (content instanceof MarkdownString ? { value: content.value } : typeof content === 'string' ? content : content && typeof content === 'object' ? { language: content.language, value: content.value } : String(content))), range: this.range ? this.range.toJSON() : undefined };
		}
	}

	class Location {
		constructor(uri, rangeOrPosition) {
			this.uri = Uri.from(uri);
			this.range = rangeOrPosition instanceof Range ? rangeOrPosition : rangeOrPosition ? new Range(Position.from(rangeOrPosition), Position.from(rangeOrPosition)) : new Range(0, 0, 0, 0);
		}

		toJSON() {
			return { uri: this.uri.toString(), range: this.range.toJSON() };
		}
	}

	class Diagnostic {
		constructor(range, message, severity) {
			this.range = Range.from(range);
			this.message = String(message);
			this.severity = severity === undefined ? DiagnosticSeverity.Error : severity;
			this.source = undefined;
			this.code = undefined;
			this.tags = undefined;
			this.relatedInformation = undefined;
		}

		toJSON() {
			return { range: this.range.toJSON(), message: this.message, severity: this.severity, source: this.source, code: this.code && typeof this.code === 'object' ? { value: this.code.value } : this.code, tags: this.tags };
		}
	}

	class CodeActionKind {
		constructor(value) {
			this.value = String(value || '');
		}

		append(part) {
			return new CodeActionKind(this.value ? this.value + '.' + part : part);
		}

		contains(other) {
			return other.value === this.value || other.value.startsWith(this.value + '.');
		}

		intersects(other) {
			return this.contains(other) || other.contains(this);
		}

		toJSON() {
			return this.value;
		}
	}
	CodeActionKind.Empty = new CodeActionKind('');
	CodeActionKind.QuickFix = new CodeActionKind('quickfix');
	CodeActionKind.Refactor = new CodeActionKind('refactor');
	CodeActionKind.RefactorExtract = new CodeActionKind('refactor.extract');
	CodeActionKind.RefactorInline = new CodeActionKind('refactor.inline');
	CodeActionKind.RefactorRewrite = new CodeActionKind('refactor.rewrite');
	CodeActionKind.Source = new CodeActionKind('source');
	CodeActionKind.SourceOrganizeImports = new CodeActionKind('source.organizeImports');
	CodeActionKind.SourceFixAll = new CodeActionKind('source.fixAll');

	class CodeAction {
		constructor(title, kind) {
			this.title = String(title);
			this.kind = kind;
			this.edit = undefined;
			this.command = undefined;
			this.diagnostics = undefined;
			this.isPreferred = false;
		}

		toJSON() {
			return { title: this.title, kind: this.kind ? this.kind.value : undefined, edit: this.edit ? this.edit.toJSON() : undefined, command: this.command, isPreferred: !!this.isPreferred };
		}
	}

	class DocumentSymbol {
		constructor(name, detail, kind, range, selectionRange) {
			this.name = String(name);
			this.detail = detail === undefined ? '' : String(detail);
			this.kind = kind;
			this.range = Range.from(range);
			this.selectionRange = selectionRange ? Range.from(selectionRange) : this.range;
			this.children = [];
		}

		toJSON() {
			return { name: this.name, detail: this.detail, kind: this.kind, range: this.range.toJSON(), selectionRange: this.selectionRange.toJSON(), children: this.children.map((child) => (child && typeof child.toJSON === 'function' ? child.toJSON() : child)) };
		}
	}

	class SymbolInformation {
		constructor(name, kind, containerNameOrRange, locationOrUri) {
			this.name = String(name);
			this.kind = kind;
			if (locationOrUri instanceof Location) {
				this.containerName = String(containerNameOrRange || '');
				this.location = locationOrUri;
			} else {
				this.containerName = '';
				this.location = new Location(locationOrUri || Uri.file(''), containerNameOrRange);
			}
		}

		toJSON() {
			return { name: this.name, kind: this.kind, containerName: this.containerName, location: this.location.toJSON() };
		}
	}

	function serializeResult(value) {
		if (value === undefined || value === null) return null;
		if (Array.isArray(value)) return value.map(serializeResult);
		if (value instanceof CompletionList) return { items: value.items.map(serializeResult), isIncomplete: value.isIncomplete };
		if (value && typeof value.toJSON === 'function') return cloneable(value.toJSON());
		if (value instanceof RegExp) return { pattern: value.source, flags: value.flags };
		if (value && typeof value === 'object') {
			const out = {};
			Object.keys(value).forEach((key) => {
				out[key] = serializeResult(value[key]);
			});
			return out;
		}
		return cloneable(value);
	}

	function serializeLanguageConfiguration(configuration) {
		if (!configuration || typeof configuration !== 'object') return null;
		const out = {};
		if (configuration.comments) out.comments = { lineComment: configuration.comments.lineComment, blockComment: configuration.comments.blockComment };
		if (configuration.brackets) out.brackets = configuration.brackets;
		if (configuration.autoClosingPairs) out.autoClosingPairs = configuration.autoClosingPairs;
		if (configuration.surroundingPairs) out.surroundingPairs = configuration.surroundingPairs;
		if (configuration.wordPattern) out.wordPattern = configuration.wordPattern instanceof RegExp ? { pattern: configuration.wordPattern.source, flags: configuration.wordPattern.flags } : configuration.wordPattern;
		if (configuration.folding) {
			out.folding = { offSide: configuration.folding.offSide, brackets: configuration.folding.brackets };
			if (configuration.folding.markers) out.folding.markers = { start: configuration.folding.markers.start instanceof RegExp ? configuration.folding.markers.start.source : configuration.folding.markers.start, end: configuration.folding.markers.end instanceof RegExp ? configuration.folding.markers.end.source : configuration.folding.markers.end };
		}
		if (configuration.quotes) out.quotes = configuration.quotes;
		return cloneable(out);
	}

	function registerLanguageProvider(kind, selector, provider, extra) {
		if (!provider || typeof provider !== 'object') throw new TypeError(`languages.${kind}: provider deve ser um objeto.`);
		if (selector === undefined || selector === null || (Array.isArray(selector) && !selector.length)) throw new TypeError(`languages.${kind}: DocumentSelector obrigatório.`);
		const handle = nextHandle('lp');
		const entry = { handle, kind, provider, disposed: false };
		languageProviders.set(handle, entry);
		endpoint
			.call('languages.registerProvider', { handle, kind, selector: cloneable(selector), triggers: extra && extra.triggers, hasResolve: !!(extra && extra.hasResolve) })
			.catch((error) => {
				languageProviders.delete(handle);
				reportError(error, 'languages.' + kind);
			});
		return new Disposable(() => {
			if (entry.disposed) return;
			entry.disposed = true;
			languageProviders.delete(handle);
			endpoint.call('languages.unregisterProvider', { handle }).catch(() => {});
		});
	}

	function createDiagnosticCollection(name) {
		const collection = String(name || state.descriptor.manifest.name).slice(0, 80);
		if (diagnosticCollections.has(collection)) return diagnosticCollections.get(collection);
		const entries = new Map();
		let disposed = false;
		function serializeList(list) {
			return (Array.isArray(list) ? list : []).map((diagnostic) => (diagnostic instanceof Diagnostic ? diagnostic.toJSON() : cloneable(diagnostic)));
		}
		function push(pairs) {
			if (disposed) return;
			endpoint.call('languages.diagnostics.set', { collection, entries: pairs.map(([uri, list]) => ({ uri, diagnostics: serializeList(list) })) }).catch((error) => reportError(error, 'diagnostics'));
		}
		const api = Object.freeze({
			name: collection,
			set(uriOrEntries, diagnostics) {
				if (disposed) throw new Error(`DiagnosticCollection "${collection}" já foi descartada.`);
				if (Array.isArray(uriOrEntries)) {
					const pairs = uriOrEntries.map(([uri, list]) => [Uri.from(uri).toString(), Array.isArray(list) ? list : []]);
					pairs.forEach(([uri, list]) => (list.length ? entries.set(uri, list) : entries.delete(uri)));
					push(pairs);
					return;
				}
				const uri = Uri.from(uriOrEntries).toString();
				const list = Array.isArray(diagnostics) ? diagnostics : [];
				if (list.length) entries.set(uri, list);
				else entries.delete(uri);
				push([[uri, list]]);
			},
			delete(uri) {
				api.set(uri, []);
			},
			clear() {
				entries.clear();
				if (!disposed) endpoint.call('languages.diagnostics.clear', { collection }).catch(() => {});
			},
			get(uri) {
				return entries.get(Uri.from(uri).toString());
			},
			has(uri) {
				return entries.has(Uri.from(uri).toString());
			},
			forEach(callback, thisArg) {
				entries.forEach((list, uri) => callback.call(thisArg, Uri.parse(uri), list, api));
			},
			dispose() {
				if (disposed) return;
				disposed = true;
				entries.clear();
				diagnosticCollections.delete(collection);
				endpoint.call('languages.diagnostics.dispose', { collection }).catch(() => {});
			},
		});
		diagnosticCollections.set(collection, api);
		return api;
	}

	const MIME_BY_EXTENSION = Object.freeze({
		html: 'text/html', htm: 'text/html', css: 'text/css', js: 'text/javascript', mjs: 'text/javascript', json: 'application/json',
		svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', ico: 'image/x-icon', bmp: 'image/bmp',
		woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf', mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', glb: 'model/gltf-binary', txt: 'text/plain', md: 'text/markdown',
	});
	const MAX_WEBVIEW_ASSET_BYTES = 2 * 1024 * 1024;
	const webviews = new Map();
	const webviewViewProviders = new Map();
	const previewReloadEmitter = new EventEmitter();

	function webviewAssetUri(target) {
		const relative = typeof target === 'string' ? target : target && typeof target.path === 'string' ? target.path : String(target || '');
		const prefix = state.descriptor ? state.descriptor.uri : '';
		const path = normalizePath(prefix && relative.startsWith(prefix) ? relative.slice(prefix.length) : relative);
		if (!state.files.has(path)) throw new Error(`asWebviewUri: "${path}" não existe na pasta da extensão.`);
		const bytes = bytesOf(state.files.get(path));
		if (bytes.length > MAX_WEBVIEW_ASSET_BYTES) throw new Error(`asWebviewUri: "${path}" excede 2 MB.`);
		const extension = path.includes('.') ? path.slice(path.lastIndexOf('.') + 1).toLowerCase() : '';
		const mime = MIME_BY_EXTENSION[extension] || 'application/octet-stream';
		return `data:${mime};base64,${base64Of(bytes)}`;
	}

	function webviewNonce() {
		const bytes = new Uint8Array(16);
		crypto.getRandomValues(bytes);
		return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
	}

	function createWebviewSurface(handle, info, kind) {
		const messageEmitter = new EventEmitter();
		const record = { handle, kind, html: '', disposed: false, messageEmitter, cspSource: info && info.cspSource ? info.cspSource : '', nonce: info && info.nonce ? info.nonce : '', options: { enableScripts: true, retainContextWhenHidden: true } };
		const webview = {
			get html() {
				return record.html;
			},
			set html(value) {
				record.html = String(value === undefined || value === null ? '' : value);
				if (!record.disposed) endpoint.call('webview.setHtml', { handle, html: record.html }).catch((error) => reportError(error, 'webview.html'));
			},
			get options() {
				return { ...record.options };
			},
			set options(value) {
				record.options = { ...record.options, ...(value && typeof value === 'object' ? { enableScripts: value.enableScripts !== false, retainContextWhenHidden: value.retainContextWhenHidden !== false } : {}) };
				if (!record.disposed) endpoint.call('webview.setOptions', { handle, options: record.options }).catch((error) => reportError(error, 'webview.options'));
			},
			get cspSource() {
				return record.cspSource;
			},
			get nonce() {
				return record.nonce;
			},
			onDidReceiveMessage: messageEmitter.event,
			postMessage(message) {
				if (record.disposed) return Promise.resolve(false);
				return endpoint.call('webview.postMessage', { handle, data: cloneable(message) }).then((delivered) => !!delivered);
			},
			asWebviewUri: webviewAssetUri,
		};
		webviews.set(handle, record);
		return { record, webview };
	}

	function colorThemeOf(raw) {
		const source = raw && typeof raw === 'object' ? raw : {};
		const uiTheme = source.kind === 'light' ? 'light' : 'dark';
		return Object.freeze({
			kind: uiTheme === 'light' ? ColorThemeKind.Light : ColorThemeKind.Dark,
			uiTheme,
			id: typeof source.id === 'string' ? source.id : 'dark',
			label: typeof source.label === 'string' ? source.label : '',
			extensionId: typeof source.extensionId === 'string' ? source.extensionId : null,
			followsSystem: !!source.followsSystem,
		});
	}

	function createWebviewPanel(viewType, title, showOptions, options) {
		if (typeof viewType !== 'string' || !viewType.trim()) throw new TypeError('createWebviewPanel: viewType obrigatório.');
		const handle = nextHandle('wv');
		const show = showOptions && typeof showOptions === 'object' ? showOptions : { viewColumn: showOptions };
		const clean = options && typeof options === 'object' ? { enableScripts: options.enableScripts !== false, retainContextWhenHidden: options.retainContextWhenHidden !== false } : { enableScripts: true, retainContextWhenHidden: true };
		const userNonce = webviewNonce();
		const surface = createWebviewSurface(handle, { nonce: userNonce, cspSource: `'nonce-${userNonce}'` }, 'panel');
		surface.record.options = clean;
		const disposeEmitter = new EventEmitter();
		const viewStateEmitter = new EventEmitter();
		let currentTitle = String(title || viewType);
		let active = true;
		let visible = true;
		surface.record.setViewState = (nextActive, nextVisible) => {
			active = !!nextActive;
			visible = !!nextVisible;
			viewStateEmitter.fire(Object.freeze({ webviewPanel: panel }));
		};
		surface.record.onDisposed = () => {
			if (surface.record.disposed) return;
			surface.record.disposed = true;
			webviews.delete(handle);
			disposeEmitter.fire(undefined);
			disposeEmitter.dispose();
			viewStateEmitter.dispose();
			surface.record.messageEmitter.dispose();
		};
		const panel = Object.freeze({
			viewType,
			webview: surface.webview,
			get title() {
				return currentTitle;
			},
			set title(value) {
				currentTitle = String(value || '');
				if (!surface.record.disposed) endpoint.call('webview.setTitle', { handle, title: currentTitle }).catch((error) => reportError(error, 'webview.title'));
			},
			get active() {
				return active;
			},
			get visible() {
				return visible;
			},
			viewColumn: ViewColumn.One,
			onDidDispose: disposeEmitter.event,
			onDidChangeViewState: viewStateEmitter.event,
			reveal(viewColumn, preserveFocus) {
				if (surface.record.disposed) return;
				endpoint.call('webview.reveal', { handle, preserveFocus: !!(typeof viewColumn === 'boolean' ? viewColumn : preserveFocus) }).catch((error) => reportError(error, 'webview.reveal'));
			},
			dispose() {
				if (surface.record.disposed) return;
				endpoint.call('webview.dispose', { handle }).catch(() => {});
				surface.record.onDisposed();
			},
		});
		endpoint
			.call('webview.create', { handle, viewType, title: currentTitle, showOptions: { preserveFocus: !!show.preserveFocus, viewColumn: show.viewColumn }, options: clean, nonce: userNonce })
			.then((result) => {
				if (result && result.cspSource) surface.record.cspSource = result.cspSource;
				if (result && result.nonce) surface.record.nonce = result.nonce;
				if (surface.record.html && !surface.record.disposed) endpoint.call('webview.setHtml', { handle, html: surface.record.html }).catch(() => {});
			})
			.catch((error) => {
				reportError(error, 'webview.create');
				surface.record.onDisposed();
			});
		return panel;
	}

	function registerWebviewViewProvider(viewId, provider, options) {
		const id = String(viewId || '').trim();
		if (!id) throw new TypeError('registerWebviewViewProvider: viewId obrigatório.');
		if (!provider || typeof provider.resolveWebviewView !== 'function') throw new TypeError('registerWebviewViewProvider: provider.resolveWebviewView obrigatório.');
		if (webviewViewProviders.has(id)) throw new Error(`Provider para a view "${id}" já registrado.`);
		webviewViewProviders.set(id, { provider, options: options || {} });
		endpoint.call('webview.registerViewProvider', { viewId: id }).catch((error) => reportError(error, 'webview.view'));
		return new Disposable(() => {
			webviewViewProviders.delete(id);
			endpoint.call('webview.unregisterViewProvider', { viewId: id }).catch(() => {});
		});
	}

	const preview = Object.freeze({
		onDidReload: previewReloadEmitter.event,
		injectScript(source) {
			return endpoint.call('preview.injectScript', { source: String(source) });
		},
		reload(options) {
			return endpoint.call('preview.reload', { full: !!(options && options.full) });
		},
		setViewport(options) {
			const clean = typeof options === 'string' ? { preset: options } : cloneable(options) || {};
			return endpoint.call('preview.setViewport', clean);
		},
		getViewport() {
			return endpoint.call('preview.getViewport', {});
		},
		getState() {
			return endpoint.call('preview.state', {});
		},
	});

	const TEST_FILE_PATTERN = /^test\/.*\.test\.js$/;
	const testState = { root: null, stack: [] };

	function newSuite(name, parent) {
		return { name, parent, cases: [], children: [], beforeEach: [], afterEach: [], beforeAll: [], afterAll: [] };
	}

	function rootSuite() {
		if (!testState.root) testState.root = newSuite('', null);
		return testState.root;
	}

	function currentSuite() {
		return testState.stack.length ? testState.stack[testState.stack.length - 1] : rootSuite();
	}

	function assertionError(message) {
		const error = new Error(message);
		error.name = 'AssertionError';
		return error;
	}

	function formatValue(value) {
		if (typeof value === 'function') return '[function ' + (value.name || 'anônima') + ']';
		if (value instanceof Error) return value.name + ': ' + value.message;
		try {
			const json = JSON.stringify(value);
			return json === undefined ? String(value) : json.length > 200 ? json.slice(0, 197) + '…' : json;
		} catch (error) {
			return String(value);
		}
	}

	function deepEqual(a, b) {
		if (Object.is(a, b)) return true;
		if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
		if (Array.isArray(a) !== Array.isArray(b)) return false;
		if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
		if (a instanceof RegExp && b instanceof RegExp) return String(a) === String(b);
		const keysA = Object.keys(a);
		const keysB = Object.keys(b);
		if (keysA.length !== keysB.length) return false;
		return keysA.every((key) => Object.prototype.hasOwnProperty.call(b, key) && deepEqual(a[key], b[key]));
	}

	function matches(text, expected) {
		if (expected === undefined) return true;
		if (expected instanceof RegExp) return expected.test(text);
		return text.includes(String(expected));
	}

	function expectation(actual, negated) {
		const verify = (pass, description) => {
			if (pass === negated) throw assertionError((negated ? 'Esperava que NÃO: ' : 'Esperava que: ') + description);
		};
		const api = {
			toBe: (expected) => verify(Object.is(actual, expected), formatValue(actual) + ' fosse ' + formatValue(expected)),
			toEqual: (expected) => verify(deepEqual(actual, expected), formatValue(actual) + ' fosse igual a ' + formatValue(expected)),
			toBeTruthy: () => verify(!!actual, formatValue(actual) + ' fosse verdadeiro'),
			toBeFalsy: () => verify(!actual, formatValue(actual) + ' fosse falso'),
			toBeDefined: () => verify(actual !== undefined, 'o valor estivesse definido'),
			toBeUndefined: () => verify(actual === undefined, formatValue(actual) + ' fosse undefined'),
			toBeNull: () => verify(actual === null, formatValue(actual) + ' fosse null'),
			toContain: (item) => {
				const has = typeof actual === 'string' ? actual.includes(String(item)) : Array.isArray(actual) ? actual.some((entry) => deepEqual(entry, item)) : false;
				verify(has, formatValue(actual) + ' contivesse ' + formatValue(item));
			},
			toHaveLength: (length) => verify(!!actual && actual.length === length, formatValue(actual) + ' tivesse tamanho ' + length + ' (tem ' + (actual && actual.length) + ')'),
			toBeGreaterThan: (value) => verify(actual > value, formatValue(actual) + ' fosse maior que ' + value),
			toBeLessThan: (value) => verify(actual < value, formatValue(actual) + ' fosse menor que ' + value),
			toMatch: (pattern) => verify(matches(String(actual), pattern), formatValue(actual) + ' casasse com ' + String(pattern)),
			toThrow: (expected) => {
				if (typeof actual !== 'function') throw assertionError('toThrow exige uma função.');
				let thrown = null;
				try {
					actual();
				} catch (error) {
					thrown = error;
				}
				const message = thrown ? (thrown && thrown.message ? thrown.message : String(thrown)) : '';
				verify(!!thrown && matches(message, expected), 'a função lançasse' + (expected !== undefined ? ' erro casando com ' + String(expected) : '') + (thrown ? ' (lançou: ' + message + ')' : ' (não lançou)'));
			},
			rejects: async (expected) => {
				let thrown = null;
				try {
					await (typeof actual === 'function' ? actual() : actual);
				} catch (error) {
					thrown = error;
				}
				const message = thrown ? (thrown && thrown.message ? thrown.message : String(thrown)) : '';
				verify(!!thrown && matches(message, expected), 'a promise rejeitasse' + (expected !== undefined ? ' com ' + String(expected) : '') + (thrown ? ' (rejeitou: ' + message + ')' : ' (resolveu)'));
			},
			resolves: async () => {
				let thrown = null;
				try {
					await (typeof actual === 'function' ? actual() : actual);
				} catch (error) {
					thrown = error;
				}
				verify(!thrown, 'a promise resolvesse' + (thrown ? ' (rejeitou: ' + (thrown.message || thrown) + ')' : ''));
			},
		};
		Object.defineProperty(api, 'not', { get: () => expectation(actual, !negated) });
		return api;
	}

	function defineCase(name, body, skipped) {
		if (typeof name !== 'string' || !name.trim()) throw new TypeError('it: nome do caso obrigatório.');
		currentSuite().cases.push({ name, body: typeof body === 'function' ? body : null, skipped: !!skipped || typeof body !== 'function' });
	}

	function hookAdder(kind) {
		return (body) => {
			if (typeof body !== 'function') throw new TypeError(kind + ': função obrigatória.');
			currentSuite()[kind].push(body);
		};
	}

	async function runCase(entry, prefix, inherited, results) {
		const name = prefix ? prefix + ' > ' + entry.name : entry.name;
		if (entry.skipped) {
			results.push({ name, status: 'skipped', durationMs: 0 });
			return;
		}
		const started = performance.now();
		try {
			for (const hook of inherited.beforeEach) await hook();
			await entry.body();
			for (const hook of inherited.afterEach) await hook();
			results.push({ name, status: 'passed', durationMs: Math.round(performance.now() - started) });
		} catch (error) {
			results.push({ name, status: 'failed', durationMs: Math.round(performance.now() - started), error: error && error.message ? error.message : String(error), stack: error && error.stack ? String(error.stack) : '' });
		}
	}

	async function runSuite(suite, prefix, inherited, results) {
		const scope = { beforeEach: inherited.beforeEach.concat(suite.beforeEach), afterEach: suite.afterEach.concat(inherited.afterEach) };
		const label = prefix ? (suite.name ? prefix + ' > ' + suite.name : prefix) : suite.name;
		try {
			for (const hook of suite.beforeAll) await hook();
		} catch (error) {
			results.push({ name: (label || '(raiz)') + ' > beforeAll', status: 'failed', durationMs: 0, error: error && error.message ? error.message : String(error) });
			return;
		}
		for (const entry of suite.cases) await runCase(entry, label, scope, results);
		for (const child of suite.children) await runSuite(child, label, scope, results);
		try {
			for (const hook of suite.afterAll) await hook();
		} catch (error) {
			results.push({ name: (label || '(raiz)') + ' > afterAll', status: 'failed', durationMs: 0, error: error && error.message ? error.message : String(error) });
		}
	}

	function loadTestFiles(pattern) {
		testState.root = null;
		testState.stack = [];
		const matcher = pattern instanceof RegExp ? pattern : TEST_FILE_PATTERN;
		const loaded = [];
		[...state.files.keys()]
			.filter((path) => matcher.test(path))
			.sort()
			.forEach((path) => {
				const source = state.files.get(path);
				if (typeof source !== 'string') return;
				const evaluate = new Function('synapse', 'require', 'module', 'exports', source + '\n//# sourceURL=synapse-extension-test/' + path);
				evaluate(synapse, self.require, self.module, self.module.exports);
				loaded.push(path);
			});
		return loaded;
	}

	async function runTests() {
		const started = performance.now();
		const results = [];
		await runSuite(rootSuite(), '', { beforeEach: [], afterEach: [] }, results);
		const report = {
			total: results.length,
			passed: results.filter((entry) => entry.status === 'passed').length,
			failed: results.filter((entry) => entry.status === 'failed').length,
			skipped: results.filter((entry) => entry.status === 'skipped').length,
			durationMs: Math.round(performance.now() - started),
			cases: results,
		};
		endpoint.notify('test.report', report);
		return report;
	}

	const testApi = Object.freeze({
		describe(name, body) {
			if (typeof name !== 'string' || !name.trim()) throw new TypeError('describe: nome obrigatório.');
			if (typeof body !== 'function') throw new TypeError('describe: função obrigatória.');
			const suite = newSuite(name, currentSuite());
			currentSuite().children.push(suite);
			testState.stack.push(suite);
			try {
				body();
			} finally {
				testState.stack.pop();
			}
		},
		it: (name, body) => defineCase(name, body, false),
		test: (name, body) => defineCase(name, body, false),
		skip: (name, body) => defineCase(name, body, true),
		beforeEach: hookAdder('beforeEach'),
		afterEach: hookAdder('afterEach'),
		beforeAll: hookAdder('beforeAll'),
		afterAll: hookAdder('afterAll'),
		expect: (actual) => expectation(actual, false),
		run: runTests,
	});

	const synapse = Object.freeze({
		version: '2.4.0',
		MarkdownString,
		CompletionItem,
		CompletionList,
		CompletionItemKind,
		CompletionTriggerKind,
		Hover,
		Location,
		Diagnostic,
		DiagnosticSeverity,
		DiagnosticTag,
		CodeAction,
		CodeActionKind,
		CodeActionTriggerKind,
		DocumentSymbol,
		SymbolInformation,
		SymbolKind,
		Disposable,
		EventEmitter,
		CancellationTokenSource,
		Uri,
		Position,
		Range,
		Selection,
		TextEdit,
		WorkspaceEdit,
		SnippetString,
		FileSystemError,
		StatusBarAlignment,
		ProgressLocation,
		ColorThemeKind,
		UIKind,
		ConfigurationTarget,
		FileType,
		EndOfLine,
		TextEditorRevealType,
		TextEditorSelectionChangeKind,
		DecorationRangeBehavior,
		FileChangeType,
		ViewColumn,
		commands: Object.freeze({
			registerCommand(command, callback, thisArg) {
				if (typeof command !== 'string' || !command.trim()) throw new TypeError('registerCommand: id do comando obrigatório.');
				if (typeof callback !== 'function') throw new TypeError('registerCommand: callback deve ser uma função.');
				if (commands.has(command)) throw new Error(`Comando "${command}" já registrado.`);
				commands.set(command, { callback, thisArg });
				endpoint.notify('commands.registered', { command });
				return new Disposable(() => {
					commands.delete(command);
					endpoint.notify('commands.unregistered', { command });
				});
			},
			registerTextEditorCommand(command, callback, thisArg) {
				return synapse.commands.registerCommand(command, async (...args) => {
					const editor = activeEditor;
					if (!editor) return undefined;
					let result;
					const applied = await editor.edit((builder) => {
						result = callback.call(thisArg, editor, builder, ...args);
					});
					return applied ? result : undefined;
				});
			},
			executeCommand(command, ...args) {
				return endpoint.call('commands.execute', { command: String(command), args: args.map(cloneable) }, { timeoutMs: 0 });
			},
			getCommands(filterInternal) {
				return endpoint.call('commands.list', { filterInternal: !!filterInternal });
			},
		}),
		window: Object.freeze({
			showInformationMessage: message('info'),
			showWarningMessage: message('warn'),
			showErrorMessage: message('err'),
			showQuickPick,
			showInputBox,
			createStatusBarItem,
			setStatusBarMessage,
			withProgress,
			showTextDocument,
			createTextEditorDecorationType,
			createWebviewPanel,
			registerWebviewViewProvider,
			get activeTextEditor() {
				return activeEditor || undefined;
			},
			get visibleTextEditors() {
				return activeEditor ? [activeEditor] : [];
			},
			onDidChangeActiveTextEditor: activeEditorEmitter.event,
			onDidChangeTextEditorSelection: selectionEmitter.event,
			get activeColorTheme() {
				return colorThemeOf(state.colorTheme);
			},
			onDidChangeActiveColorTheme: colorThemeEmitter.event,
			onDidChangeTextEditorVisibleRanges: visibleRangesEmitter.event,
			createOutputChannel(name) {
				const channel = String(name || state.descriptor.manifest.name);
				return Object.freeze({
					name: channel,
					append: (text) => endpoint.notify('output.append', { channel, text: String(text), newline: false }),
					appendLine: (text) => endpoint.notify('output.append', { channel, text: String(text), newline: true }),
					clear: () => endpoint.notify('output.clear', { channel }),
					show: () => endpoint.notify('output.show', { channel }),
					hide: () => {},
					dispose: () => {},
				});
			},
		}),
		workspace: Object.freeze({
			fs,
			readFile: (path) => endpoint.call('workspace.fs.readFile', { path: uriParam(path) }).then((result) => (result && typeof result.text === 'string' ? result.text : '')),
			writeFile: (path, content) => endpoint.call('workspace.fs.writeFile', { path: uriParam(path), content: String(content) }),
			findFiles: (glob, exclude, maxResults) => endpoint.call('workspace.findFiles', { glob: String(glob || '**/*'), exclude: exclude ? String(exclude) : undefined, maxResults }).then((paths) => paths.map((path) => Uri.file(path))),
			findFilePaths: (glob, exclude, maxResults) => endpoint.call('workspace.findFiles', { glob: String(glob || '**/*'), exclude: exclude ? String(exclude) : undefined, maxResults }),
			stat: (path) => endpoint.call('workspace.fs.stat', { path: uriParam(path) }),
			getConfiguration,
			onDidChangeConfiguration: configurationEmitter.event,
			openTextDocument,
			applyEdit,
			createFileSystemWatcher,
			asRelativePath,
			get textDocuments() {
				return [...documents.values()].filter((document) => !document.isClosed);
			},
			get workspaceFolders() {
				return workspaceFolders();
			},
			getWorkspaceFolder(uri) {
				try {
					relativePathOf(uri);
					return workspaceFolders()[0];
				} catch (error) {
					return undefined;
				}
			},
			get projects() {
				return state.projects.map((project) => ({ ...project }));
			},
			listProjects: () => endpoint.call('workspace.projects', {}),
			onDidOpenTextDocument: documentOpenEmitter.event,
			onDidChangeTextDocument: documentChangeEmitter.event,
			onDidCloseTextDocument: documentCloseEmitter.event,
			onDidSaveTextDocument: documentSaveEmitter.event,
			onDidCreateFiles: filesCreatedEmitter.event,
			onDidDeleteFiles: filesDeletedEmitter.event,
			onDidRenameFiles: filesRenamedEmitter.event,
			onDidOpenProject: projectOpenEmitter.event,
			onDidCloseProject: projectCloseEmitter.event,
			onDidChangeActiveProject: activeProjectEmitter.event,
			get name() {
				return state.env.projectName || '';
			},
		}),
		languages: Object.freeze({
			registerCompletionItemProvider(selector, provider, ...triggerCharacters) {
				if (typeof provider.provideCompletionItems !== 'function') throw new TypeError('registerCompletionItemProvider: provider.provideCompletionItems obrigatório.');
				return registerLanguageProvider('completion', selector, provider, { triggers: triggerCharacters.map(String), hasResolve: typeof provider.resolveCompletionItem === 'function' });
			},
			registerHoverProvider(selector, provider) {
				if (typeof provider.provideHover !== 'function') throw new TypeError('registerHoverProvider: provider.provideHover obrigatório.');
				return registerLanguageProvider('hover', selector, provider);
			},
			registerDefinitionProvider(selector, provider) {
				if (typeof provider.provideDefinition !== 'function') throw new TypeError('registerDefinitionProvider: provider.provideDefinition obrigatório.');
				return registerLanguageProvider('definition', selector, provider);
			},
			registerDocumentFormattingEditProvider(selector, provider) {
				if (typeof provider.provideDocumentFormattingEdits !== 'function') throw new TypeError('registerDocumentFormattingEditProvider: provider.provideDocumentFormattingEdits obrigatório.');
				return registerLanguageProvider('formatting', selector, provider);
			},
			registerCodeActionsProvider(selector, provider) {
				if (typeof provider.provideCodeActions !== 'function') throw new TypeError('registerCodeActionsProvider: provider.provideCodeActions obrigatório.');
				return registerLanguageProvider('codeAction', selector, provider);
			},
			registerDocumentSymbolProvider(selector, provider) {
				if (typeof provider.provideDocumentSymbols !== 'function') throw new TypeError('registerDocumentSymbolProvider: provider.provideDocumentSymbols obrigatório.');
				return registerLanguageProvider('documentSymbol', selector, provider);
			},
			createDiagnosticCollection,
			setLanguageConfiguration(languageId, configuration) {
				const id = String(languageId || '').trim().toLowerCase();
				if (!id) throw new TypeError('setLanguageConfiguration: languageId obrigatório.');
				endpoint.call('languages.setConfiguration', { languageId: id, configuration: serializeLanguageConfiguration(configuration) }).catch((error) => reportError(error, 'languages.configuration'));
				return new Disposable(() => {
					endpoint.call('languages.setConfiguration', { languageId: id, configuration: null }).catch(() => {});
				});
			},
			getLanguages() {
				return endpoint.call('languages.list', {}).then((list) => (Array.isArray(list) ? list.map((entry) => entry.id) : []));
			},
			match(selector, document) {
				const list = Array.isArray(selector) ? selector : [selector];
				const path = document && document._path !== undefined ? document._path : '';
				return list.some((entry) => {
					if (typeof entry === 'string') return entry === '*' || entry === document.languageId;
					if (!entry || typeof entry !== 'object') return false;
					if (entry.language && entry.language !== '*' && entry.language !== document.languageId) return false;
					if (entry.pattern) {
						const source = '^' + String(entry.pattern).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*\//g, '(?:.*/)?').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]') + '$';
						if (!new RegExp(source).test(path)) return false;
					}
					return true;
				})
					? 10
					: 0;
			},
		}),
		preview,
		test: testApi,
		keybindings: Object.freeze({
			list() {
				return state.keybindings.map((entry) => ({ ...entry }));
			},
			bindingFor(command) {
				const found = state.keybindings.find((entry) => entry.command === command);
				return found ? found.binding : '';
			},
		}),
		mcp: Object.freeze({
			registerTool(definitionOrName, handler, options) {
				const definition =
					typeof definitionOrName === 'string'
						? { ...(options && typeof options === 'object' ? options : {}), name: definitionOrName, handler }
						: definitionOrName;
				if (!definition || typeof definition !== 'object') throw new TypeError('mcp.registerTool: definição obrigatória.');
				const name = String(definition.name || '').trim();
				if (!name) throw new TypeError('mcp.registerTool: name obrigatório.');
				if (typeof definition.handler !== 'function') throw new TypeError('mcp.registerTool: handler deve ser uma função.');
				if (mcpTools.has(name)) throw new Error(`Ferramenta MCP "${name}" já registrada.`);
				mcpTools.set(name, definition.handler);
				const registration = endpoint.call('mcp.registerTool', {
					name,
					title: definition.title ? String(definition.title) : '',
					description: definition.description ? String(definition.description) : '',
					inputSchema: definition.inputSchema && typeof definition.inputSchema === 'object' ? definition.inputSchema : { type: 'object', properties: {} },
				});
				registration.catch((error) => {
					mcpTools.delete(name);
					endpoint.notify('host.log', { level: 'error', message: `mcp.registerTool(${name}): ${error && error.message ? error.message : error}` });
				});
				return new Disposable(() => {
					mcpTools.delete(name);
					endpoint.call('mcp.unregisterTool', { name }).catch(() => {});
				});
			},
			listTools: () => endpoint.call('mcp.listTools', {}),
		}),
		env: Object.freeze({
			get language() {
				return state.env.language || 'pt';
			},
			get appVersion() {
				return state.env.appVersion || '';
			},
			get uiKind() {
				return state.env.uiKind || 'desktop';
			},
			get appName() {
				return 'Synapse IDE';
			},
			get appRoot() {
				return state.env.appRoot || '';
			},
			get apiVersion() {
				return state.env.apiVersion || '';
			},
			get isMobile() {
				return state.env.uiKind === 'celular';
			},
			clipboard: Object.freeze({
				readText: () => endpoint.call('env.clipboard.readText', {}),
				writeText: (text) => endpoint.call('env.clipboard.writeText', { text: String(text) }),
			}),
			openExternal: (uri) => endpoint.call('env.openExternal', { uri: String(uri) }, { timeoutMs: 0 }),
		}),
	});

	self.synapse = synapse;
	self.require = function (name) {
		if (name === 'synapse' || name === 'vscode') return synapse;
		throw new Error(`require("${name}") indisponível: extensões só podem importar "synapse".`);
	};
	lockdown();

	function disposeSubscriptions() {
		const subscriptions = state.context ? state.context.subscriptions : [];
		while (subscriptions.length) {
			const item = subscriptions.pop();
			try {
				if (item && typeof item.dispose === 'function') item.dispose();
			} catch (error) {
				reportError(error, 'dispose');
			}
		}
	}

	function seedWorkspace(params) {
		documents.clear();
		(Array.isArray(params.documents) ? params.documents : []).forEach((payload) => documentFor(payload));
		state.projects = Array.isArray(params.projects) ? params.projects : [];
		syncActiveEditor(params.activeEditor || null);
	}

	endpoint.on('host.load', (params) => {
		state.descriptor = { id: params.id, uri: params.uri, manifest: params.manifest };
		state.env = params.env || {};
		state.colorTheme = params.colorTheme && typeof params.colorTheme === 'object' ? params.colorTheme : null;
		state.configuration = params.configuration && typeof params.configuration === 'object' ? params.configuration : {};
		state.keybindings = Array.isArray(params.keybindings) ? params.keybindings : [];
		state.networkOrigins = Array.isArray(params.networkOrigins) ? params.networkOrigins.map(String) : [];
		state.files = new Map(Object.entries(params.files || {}));
		seedWorkspace(params);
		const mainPath = normalizePath(params.manifest.main);
		if (!state.files.has(mainPath)) {
			throw new RpcError(ERROR_CODES.EXTENSION_ERROR, `Arquivo principal "${mainPath}" não encontrado na pasta da extensão.`);
		}
		self.module = { exports: {} };
		self.exports = self.module.exports;
		try {
			nativeImportScripts(extensionBlobUrl(mainPath));
		} catch (error) {
			throw new RpcError(ERROR_CODES.EXTENSION_ERROR, `Falha ao carregar "${mainPath}": ${error.message}`, { stack: error.stack ? String(error.stack) : '' });
		}
		const exported = self.module.exports && Object.keys(self.module.exports).length ? self.module.exports : { activate: self.activate, deactivate: self.deactivate };
		state.module = exported;
		state.context = {
			subscriptions: [],
			extensionUri: params.uri,
			extensionPath: params.uri,
			extension: Object.freeze({ id: params.id, packageJSON: params.manifest }),
			globalState: createMemento('global', params.globalState),
			workspaceState: createMemento('workspace', params.workspaceState),
			asAbsolutePath: (relativePath) => params.uri + normalizePath(relativePath),
		};
		return { hasActivate: typeof exported.activate === 'function', hasDeactivate: typeof exported.deactivate === 'function' };
	});

	endpoint.on('host.activate', async () => {
		if (!state.module) throw new RpcError(ERROR_CODES.EXTENSION_ERROR, 'Extensão ainda não carregada.');
		if (state.active) return { alreadyActive: true, commands: [...commands.keys()] };
		const started = performance.now();
		if (typeof state.module.activate === 'function') {
			try {
				await state.module.activate(state.context);
			} catch (error) {
				disposeSubscriptions();
				throw new RpcError(ERROR_CODES.EXTENSION_ERROR, `activate() falhou: ${error && error.message ? error.message : error}`, { stack: error && error.stack ? String(error.stack) : '' });
			}
		}
		state.active = true;
		return { durationMs: Math.round(performance.now() - started), commands: [...commands.keys()] };
	});

	endpoint.on('host.deactivate', async () => {
		if (state.module && typeof state.module.deactivate === 'function' && state.active) {
			try {
				await state.module.deactivate();
			} catch (error) {
				reportError(error, 'deactivate');
			}
		}
		disposeSubscriptions();
		progressTokens.forEach((source) => source.cancel());
		progressTokens.clear();
		watchers.clear();
		decorationTypes.clear();
		languageProviders.clear();
		diagnosticCollections.clear();
		[...webviews.values()].forEach((record) => {
			if (typeof record.onDisposed === 'function') record.onDisposed();
		});
		webviews.clear();
		webviewViewProviders.clear();
		commands.clear();
		mcpTools.clear();
		state.active = false;
		return { ok: true };
	});

	endpoint.on('host.executeCommand', async (params) => {
		const entry = requireRegistered(params.command);
		const args = Array.isArray(params.args) ? params.args : [];
		const result = await entry.callback.apply(entry.thisArg, args);
		return cloneable(result);
	});

	endpoint.on('host.ping', () => ({ active: state.active, commands: [...commands.keys()] }));

	endpoint.on('test.run', async (params) => {
		if (!state.module) throw new RpcError(ERROR_CODES.EXTENSION_ERROR, 'Extensão ainda não carregada.');
		let pattern = null;
		if (params && typeof params.pattern === 'string' && params.pattern) {
			try {
				pattern = new RegExp(params.pattern);
			} catch (error) {
				throw new RpcError(ERROR_CODES.INVALID_PARAMS, 'Padrão de arquivos de teste inválido: ' + error.message);
			}
		}
		let loaded;
		try {
			loaded = loadTestFiles(pattern);
		} catch (error) {
			throw new RpcError(ERROR_CODES.EXTENSION_ERROR, 'Falha ao carregar arquivos de teste: ' + (error && error.message ? error.message : error), { stack: error && error.stack ? String(error.stack) : '' });
		}
		if (!loaded.length) return { total: 0, passed: 0, failed: 0, skipped: 0, durationMs: 0, cases: [], files: [] };
		const report = await runTests();
		return { ...report, files: loaded };
	});

	endpoint.on('languages.provide', async (params, context) => {
		const entry = languageProviders.get(String(params.handle || ''));
		if (!entry || entry.disposed) throw new RpcError(ERROR_CODES.METHOD_NOT_FOUND, `Provider "${params.handle}" não está registrado.`);
		const document = params.document ? documentFor(params.document) : null;
		if (!document) throw new RpcError(ERROR_CODES.INVALID_PARAMS, 'Documento ausente na requisição do provider.');
		const source = new CancellationTokenSource();
		const onAbort = () => source.cancel();
		if (context && context.signal) {
			if (context.signal.aborted) source.cancel();
			else context.signal.addEventListener('abort', onAbort, { once: true });
		}
		const provider = entry.provider;
		try {
			let result;
			switch (entry.kind) {
				case 'completion':
					result = await provider.provideCompletionItems(document, Position.from(params.position), source.token, { triggerKind: params.context && params.context.triggerKind === 2 ? CompletionTriggerKind.TriggerCharacter : CompletionTriggerKind.Invoke, triggerCharacter: params.context ? params.context.triggerCharacter : undefined });
					break;
				case 'hover':
					result = await provider.provideHover(document, Position.from(params.position), source.token);
					break;
				case 'definition':
					result = await provider.provideDefinition(document, Position.from(params.position), source.token);
					break;
				case 'formatting':
					result = await provider.provideDocumentFormattingEdits(document, { tabSize: params.options && params.options.tabSize ? params.options.tabSize : 2, insertSpaces: !params.options || params.options.insertSpaces !== false }, source.token);
					break;
				case 'codeAction':
					result = await provider.provideCodeActions(document, Range.from(params.range), { diagnostics: (params.context && Array.isArray(params.context.diagnostics) ? params.context.diagnostics : []).map((raw) => Object.assign(new Diagnostic(raw.range, raw.message, raw.severity), { code: raw.code, source: raw.source })), only: undefined, triggerKind: CodeActionTriggerKind.Invoke }, source.token);
					break;
				case 'documentSymbol':
					result = await provider.provideDocumentSymbols(document, source.token);
					break;
				default:
					throw new RpcError(ERROR_CODES.INVALID_PARAMS, `Tipo de provider desconhecido "${entry.kind}".`);
			}
			if (source.token.isCancellationRequested) return null;
			return serializeResult(result);
		} catch (error) {
			if (source.token.isCancellationRequested) return null;
			throw new RpcError(ERROR_CODES.EXTENSION_ERROR, `${entry.kind}: ${error && error.message ? error.message : error}`, { stack: error && error.stack ? String(error.stack) : '' });
		} finally {
			if (context && context.signal) context.signal.removeEventListener('abort', onAbort);
			source.dispose();
		}
	});

	endpoint.on('window.validateInput', async (params) => {
		const validator = inputValidators.get(params.token);
		if (!validator) return null;
		try {
			const result = await validator(String(params.value));
			if (!result) return null;
			return typeof result === 'string' ? result : result.message ? String(result.message) : null;
		} catch (error) {
			reportError(error, 'validateInput');
			return null;
		}
	});

	endpoint.on('configuration.changed', (params) => {
		const keys = Array.isArray(params.keys) ? params.keys : [];
		if (params.values && typeof params.values === 'object') state.configuration = params.values;
		configurationEmitter.fire(
			Object.freeze({
				affectsConfiguration(section) {
					const prefix = String(section || '');
					return keys.some((key) => key === prefix || key.startsWith(prefix + '.'));
				},
				keys: [...keys],
			}),
		);
		return null;
	});

	endpoint.on('progress.cancel', (params) => {
		const source = progressTokens.get(params.token);
		if (source) source.cancel();
		return null;
	});

	endpoint.on('mcp.callTool', async (params) => {
		const name = params && params.name;
		const handler = mcpTools.get(name);
		if (!handler) throw new Error(`Ferramenta MCP "${name}" não registrada nesta extensão.`);
		return handler((params && params.args) || {});
	});
	endpoint.on('env.changed', (params) => {
		state.env = { ...state.env, ...(params || {}) };
		return null;
	});

	endpoint.on('window.colorThemeChanged', (params) => {
		state.colorTheme = params && typeof params === 'object' ? params : null;
		colorThemeEmitter.fire(colorThemeOf(state.colorTheme));
		return null;
	});

	endpoint.on('workspace.documentOpened', (params) => {
		const document = documentFor(params.document);
		if (document) documentOpenEmitter.fire(document);
		return null;
	});

	endpoint.on('workspace.documentChanged', (params) => {
		const document = documents.get(params.path);
		if (!document) {
			if (typeof params.text === 'string' || params.tooLarge) {
				const created = documentFor({ path: params.path, uri: params.uri, languageId: undefined, version: params.version, isDirty: params.isDirty, text: params.text, tooLarge: params.tooLarge });
				if (created) documentOpenEmitter.fire(created);
			}
			return null;
		}
		const previousText = document.getText();
		const change = params.change || null;
		let contentChanges = [];
		if (change && !document.isTooLarge) {
			const start = document.positionAt(change.rangeOffset);
			const end = document.positionAt(change.rangeOffset + change.rangeLength);
			contentChanges = [{ range: new Range(start, end), rangeOffset: change.rangeOffset, rangeLength: change.rangeLength, text: change.text }];
		}
		document._update({ version: params.version, isDirty: params.isDirty, change, text: change ? undefined : params.text, tooLarge: params.tooLarge });
		if (!change && typeof params.text === 'string' && previousText !== params.text) {
			contentChanges = [{ range: new Range(new Position(0, 0), document.positionAt(previousText.length)), rangeOffset: 0, rangeLength: previousText.length, text: params.text }];
		}
		documentChangeEmitter.fire(Object.freeze({ document, contentChanges, reason: params.reason === 'undo' ? 1 : params.reason === 'redo' ? 2 : undefined }));
		if (activeEditor && activeEditor._snapshot.path === params.path) activeEditor.document = document;
		return null;
	});

	endpoint.on('workspace.documentClosed', (params) => {
		const document = closeDocument(params.path);
		if (document) documentCloseEmitter.fire(document);
		return null;
	});

	endpoint.on('workspace.documentSaved', (params) => {
		const document = documents.get(params.path);
		if (document) {
			document.isDirty = false;
			documentSaveEmitter.fire(document);
		}
		return null;
	});

	endpoint.on('workspace.fileEvents', (params) => {
		(Array.isArray(params.events) ? params.events : []).forEach((event) => {
			const watcher = watchers.get(event.handle);
			if (!watcher) return;
			const uri = Uri.file(event.path);
			if (event.type === 'create') watcher.create.fire(uri);
			else if (event.type === 'change') watcher.change.fire(uri);
			else if (event.type === 'delete') watcher.remove.fire(uri);
		});
		return null;
	});

	endpoint.on('workspace.filesChanged', (params) => {
		const created = (params.created || []).map((uri) => Uri.parse(uri));
		const deleted = (params.deleted || []).map((uri) => Uri.parse(uri));
		const renamed = (params.renamed || []).map((pair) => ({ oldUri: Uri.parse(pair.oldUri), newUri: Uri.parse(pair.newUri) }));
		if (created.length) filesCreatedEmitter.fire(Object.freeze({ files: created }));
		if (deleted.length) {
			deleted.forEach((uri) => {
				const document = closeDocument(uri.fsPath);
				if (document) documentCloseEmitter.fire(document);
			});
			filesDeletedEmitter.fire(Object.freeze({ files: deleted }));
		}
		if (renamed.length) filesRenamedEmitter.fire(Object.freeze({ files: renamed }));
		return null;
	});

	endpoint.on('workspace.projectsChanged', (params) => {
		if (Array.isArray(params.opened) && params.opened.length) {
			params.opened.forEach((project) => {
				if (!state.projects.some((known) => known.id === project.id)) state.projects.push({ ...project, active: false });
				projectOpenEmitter.fire(Object.freeze({ ...project }));
			});
		}
		if (Array.isArray(params.closed) && params.closed.length) {
			params.closed.forEach((project) => {
				state.projects = state.projects.filter((known) => known.id !== project.id);
				projectCloseEmitter.fire(Object.freeze({ ...project }));
			});
		}
		state.projects.forEach((project) => {
			project.active = !!params.active && project.id === params.active.id;
		});
		if (params.activeChanged) {
			if (params.active) state.env.projectName = params.active.name;
			activeProjectEmitter.fire(Object.freeze(params.active ? { ...params.active } : { id: null, name: '' }));
		}
		return null;
	});

	endpoint.on('webview.message', (params) => {
		const record = webviews.get(String(params.handle || ''));
		if (!record || record.disposed) return null;
		record.messageEmitter.fire(params.data);
		return null;
	});

	endpoint.on('webview.viewState', (params) => {
		const record = webviews.get(String(params.handle || ''));
		if (!record || record.disposed || typeof record.setViewState !== 'function') return null;
		record.setViewState(params.active, params.visible);
		return null;
	});

	endpoint.on('webview.disposed', (params) => {
		const record = webviews.get(String(params.handle || ''));
		if (record && typeof record.onDisposed === 'function') record.onDisposed();
		return null;
	});

	endpoint.on('webview.resolveView', async (params) => {
		const entry = webviewViewProviders.get(String(params.viewId || ''));
		if (!entry) throw new RpcError(ERROR_CODES.METHOD_NOT_FOUND, `Nenhum provider registrado para a view "${params.viewId}".`);
		const handle = String(params.handle);
		const existing = webviews.get(handle);
		if (existing && typeof existing.onDisposed === 'function') existing.onDisposed();
		const surface = createWebviewSurface(handle, params, 'view');
		const disposeEmitter = new EventEmitter();
		const visibilityEmitter = new EventEmitter();
		let visible = true;
		let description = '';
		let title = '';
		surface.record.setViewState = (nextActive, nextVisible) => {
			visible = !!nextVisible;
			visibilityEmitter.fire(undefined);
		};
		surface.record.onDisposed = () => {
			if (surface.record.disposed) return;
			surface.record.disposed = true;
			webviews.delete(handle);
			disposeEmitter.fire(undefined);
			disposeEmitter.dispose();
			visibilityEmitter.dispose();
			surface.record.messageEmitter.dispose();
		};
		const view = Object.freeze({
			viewType: String(params.viewId),
			webview: surface.webview,
			get visible() {
				return visible;
			},
			get title() {
				return title;
			},
			set title(value) {
				title = String(value || '');
				endpoint.call('webview.setTitle', { handle, title }).catch(() => {});
			},
			get description() {
				return description;
			},
			set description(value) {
				description = String(value || '');
				endpoint.call('webview.view.setDescription', { handle, description }).catch(() => {});
			},
			onDidDispose: disposeEmitter.event,
			onDidChangeVisibility: visibilityEmitter.event,
			show(preserveFocus) {
				endpoint.call('webview.view.show', { handle, preserveFocus: !!preserveFocus }).catch(() => {});
			},
		});
		const source = new CancellationTokenSource();
		await entry.provider.resolveWebviewView(view, { state: undefined }, source.token);
		return { ok: true };
	});

	endpoint.on('preview.reloaded', (params) => {
		previewReloadEmitter.fire(Object.freeze({ projectId: params.projectId || null, projectName: params.projectName || '', mode: params.mode || '', url: params.url || '' }));
		return null;
	});

	endpoint.on('editor.activeChanged', (params) => {
		const editor = syncActiveEditor(params.editor || null);
		activeEditorEmitter.fire(editor || undefined);
		return null;
	});

	endpoint.on('editor.selectionChanged', (params) => {
		if (!activeEditor || activeEditor._snapshot.path !== params.path) return null;
		activeEditor._snapshot = { ...activeEditor._snapshot, selections: params.selections };
		selectionEmitter.fire(Object.freeze({ textEditor: activeEditor, selections: activeEditor.selections, kind: params.kind || TextEditorSelectionChangeKind.Keyboard }));
		return null;
	});

	endpoint.on('editor.visibleRangesChanged', (params) => {
		if (!activeEditor || activeEditor._snapshot.path !== params.path) return null;
		activeEditor._snapshot = { ...activeEditor._snapshot, visibleRanges: params.visibleRanges };
		visibleRangesEmitter.fire(Object.freeze({ textEditor: activeEditor, visibleRanges: activeEditor.visibleRanges }));
		return null;
	});

	self.addEventListener('error', (event) => {
		reportError(event.error || new Error(event.message), 'uncaught');
	});
	self.addEventListener('unhandledrejection', (event) => {
		reportError(event.reason || new Error('Promise rejeitada sem tratamento'), 'unhandledrejection');
	});

	endpoint.notify('host.ready', {});
})(self);
