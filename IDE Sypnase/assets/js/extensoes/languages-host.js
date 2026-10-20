(function (root) {
	'use strict';

	const MAX_COMPLETION_ITEMS = 200;
	const MAX_DIAGNOSTICS_PER_FILE = 500;
	const MAX_SNIPPETS_PER_LANGUAGE = 400;
	const MAX_GRAMMAR_BYTES = 512 * 1024;
	const PROVIDER_TIMEOUT_MS = 3000;
	const FORMAT_TIMEOUT_MS = 8000;
	const HOVER_DELAY_MS = 350;
	const COMPLETION_KINDS = ['text', 'method', 'function', 'constructor', 'field', 'variable', 'class', 'interface', 'module', 'property', 'unit', 'value', 'enum', 'keyword', 'snippet', 'color', 'file', 'reference', 'folder', 'enumMember', 'constant', 'struct', 'event', 'operator', 'typeParameter', 'user', 'issue'];
	const SYMBOL_KINDS = ['file', 'module', 'namespace', 'package', 'class', 'method', 'property', 'field', 'constructor', 'enum', 'interface', 'function', 'variable', 'constant', 'string', 'number', 'boolean', 'array', 'object', 'key', 'null', 'enumMember', 'struct', 'event', 'operator', 'typeParameter'];
	const PROVIDER_KINDS = new Set(['completion', 'hover', 'definition', 'formatting', 'codeAction', 'documentSymbol']);

	const records = new Map();
	const providers = new Map();
	const diagnosticCollections = new Map();
	const diagnosticsByPath = new Map();
	let providerSequence = 0;
	let completionRegistration = null;
	let hoverWidget = null;
	let hoverTimer = 0;
	let hoverSequence = 0;
	let lastHoverKey = '';
	let paletteRegistered = false;
	let bound = false;

	function rpc() {
		return root.SynapseExtensionRpc;
	}

	function fail(code, message, data) {
		const api = rpc();
		return new api.RpcError(api.ERROR_CODES[code] || code, message, data);
	}

	function registry() {
		return root.SynapseExtensions;
	}

	function output() {
		return root.SynapseExtensionOutput;
	}

	function editorHost() {
		return root.SynapseExtensionEditor;
	}

	function workspaceHost() {
		return root.SynapseExtensionWorkspace;
	}

	function windowHost() {
		return root.SynapseExtensionWindow;
	}

	function languages() {
		return root.SynapseEditorLanguages;
	}

	function grammars() {
		return root.SynapseLanguageGrammars;
	}

	function elements() {
		return typeof el !== 'undefined' ? el : null;
	}

	function warn(id, message) {
		if (output()) output().warn(id, message);
	}

	function ownerOf(id) {
		return 'ext:' + id;
	}

	function recordFor(id) {
		let record = records.get(id);
		if (!record) {
			record = { languages: [], grammars: [], snippets: new Map(), configurations: new Map(), apiConfigurations: new Map() };
			records.set(id, record);
		}
		return record;
	}

	function normalizeLanguageId(value) {
		return String(value || '').trim().toLowerCase();
	}

	function languageOf(path) {
		const catalog = languages();
		return catalog ? catalog.fromPath(path) : 'text';
	}

	function activeDocument() {
		const project = typeof root.activeProject === 'function' ? root.activeProject() : null;
		if (!project || !project.openFile) return null;
		const entry = project.files.get(project.openFile);
		if (!entry || !entry.isText || typeof entry.text !== 'string') return null;
		const ui = elements();
		if (!ui || ui.editorGrid.classList.contains('hidden')) return null;
		return { project, path: project.openFile, entry, text: entry.text, languageId: languageOf(project.openFile) };
	}

	function lineStarts(text) {
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

	function positionAt(text, starts, offset) {
		const clamped = Math.max(0, Math.min(text.length, offset));
		const line = lineIndexAt(starts, clamped);
		return { line, character: clamped - starts[line] };
	}

	function offsetAt(text, starts, position) {
		const line = Math.max(0, Math.min(starts.length - 1, Number(position && position.line) || 0));
		const lineStart = starts[line];
		const lineEnd = line + 1 < starts.length ? starts[line + 1] - 1 : text.length;
		return lineStart + Math.max(0, Math.min(lineEnd - lineStart, Number(position && position.character) || 0));
	}

	function toSourceOffset(displayOffset) {
		const folding = root.EditorFolding;
		const projection = folding && typeof folding.projection === 'function' ? folding.projection() : null;
		return projection ? projection.toSourceOffset(displayOffset) : displayOffset;
	}

	function toDisplayOffset(sourceOffset) {
		const folding = root.EditorFolding;
		const projection = folding && typeof folding.projection === 'function' ? folding.projection() : null;
		return projection ? projection.toDisplayOffset(sourceOffset) : sourceOffset;
	}

	function globToRegExp(pattern) {
		let source = '^';
		const text = String(pattern || '');
		for (let index = 0; index < text.length; index += 1) {
			const char = text[index];
			if (char === '*') {
				if (text[index + 1] === '*') {
					source += text[index + 2] === '/' ? '(?:.*/)?' : '.*';
					index += text[index + 2] === '/' ? 2 : 1;
				} else source += '[^/]*';
			} else if (char === '?') source += '[^/]';
			else if (char === '{') {
				const close = text.indexOf('}', index);
				if (close === -1) source += '\\{';
				else {
					source += '(?:' + text.slice(index + 1, close).split(',').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')';
					index = close;
				}
			} else source += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		}
		return new RegExp(source + '$');
	}

	function normalizeSelector(raw) {
		const list = Array.isArray(raw) ? raw : [raw];
		return list
			.map((entry) => {
				if (typeof entry === 'string') return { language: normalizeLanguageId(entry) };
				if (!entry || typeof entry !== 'object') return null;
				const selector = {};
				if (entry.language) selector.language = normalizeLanguageId(entry.language);
				if (entry.pattern) {
					try {
						selector.pattern = globToRegExp(String(entry.pattern).replace(/^\*\*\//, ''));
						selector.patternSource = String(entry.pattern);
					} catch (error) {
						return null;
					}
				}
				return selector.language || selector.pattern ? selector : null;
			})
			.filter(Boolean);
	}

	function selectorMatches(selectors, languageId, path) {
		return selectors.some((selector) => {
			if (selector.language && selector.language !== '*' && selector.language !== languageId) return false;
			if (selector.pattern && !selector.pattern.test(path) && !selector.pattern.test(path.split('/').pop())) return false;
			return true;
		});
	}

	function providersFor(kind, languageId, path) {
		const list = [];
		providers.forEach((provider) => {
			if (provider.kind !== kind) return;
			const item = registry() ? registry().get(provider.extensionId) : null;
			if (!item || item.status !== 'active') return;
			if (selectorMatches(provider.selectors, languageId, path)) list.push(provider);
		});
		return list;
	}

	function hasProviders(kind, languageId, path) {
		return providersFor(kind, languageId, path).length > 0;
	}

	function documentPayload(active) {
		const host = workspaceHost();
		if (host) {
			const payload = host.describeDocument(active.project, active.path, true);
			if (payload && !payload.tooLarge) return payload;
			return null;
		}
		return { uri: 'synapse:/projeto/' + active.path, path: active.path, languageId: active.languageId, version: 1, isDirty: false, eol: active.text.includes('\r\n') ? 2 : 1, text: active.text };
	}

	function request(provider, params, options) {
		const api = registry();
		if (!api || typeof api.requestExtension !== 'function') return Promise.resolve(null);
		return api
			.requestExtension(provider.extensionId, 'languages.provide', { handle: provider.handle, kind: provider.kind, ...params }, { timeoutMs: options && options.timeoutMs !== undefined ? options.timeoutMs : PROVIDER_TIMEOUT_MS, signal: options && options.signal })
			.catch((error) => {
				const code = error && error.code;
				if (code !== rpc().ERROR_CODES.CANCELLED && code !== rpc().ERROR_CODES.TIMEOUT) warn(provider.extensionId, `${provider.kind}: ${error && error.message ? error.message : error}`);
				else if (code === rpc().ERROR_CODES.TIMEOUT) warn(provider.extensionId, `Provider "${provider.kind}" excedeu ${options && options.timeoutMs ? options.timeoutMs : PROVIDER_TIMEOUT_MS} ms e foi ignorado.`);
				return null;
			});
	}

	function readJson(item, path, label) {
		const normalized = String(path || '').replace(/^\.\//, '');
		const text = item.files.get(normalized);
		if (typeof text !== 'string') {
			warn(item.id, `${label}: arquivo "${normalized}" não encontrado na extensão.`);
			return null;
		}
		if (text.length > MAX_GRAMMAR_BYTES) {
			warn(item.id, `${label}: "${normalized}" excede ${MAX_GRAMMAR_BYTES / 1024} KB.`);
			return null;
		}
		try {
			return JSON.parse(text);
		} catch (error) {
			warn(item.id, `${label}: JSON inválido em "${normalized}" (${error.message}).`);
			return null;
		}
	}

	function sanitizeConfiguration(raw) {
		if (!raw || typeof raw !== 'object') return null;
		const configuration = {};
		if (raw.comments && typeof raw.comments === 'object') {
			configuration.comments = {};
			if (typeof raw.comments.lineComment === 'string' && raw.comments.lineComment) configuration.comments.lineComment = raw.comments.lineComment.slice(0, 8);
			if (Array.isArray(raw.comments.blockComment) && raw.comments.blockComment.length === 2) configuration.comments.blockComment = [String(raw.comments.blockComment[0]).slice(0, 8), String(raw.comments.blockComment[1]).slice(0, 8)];
		}
		const pairs = (list) =>
			(Array.isArray(list) ? list : [])
				.map((pair) => (Array.isArray(pair) ? { open: String(pair[0]), close: String(pair[1]) } : pair && typeof pair === 'object' ? { open: String(pair.open), close: String(pair.close), notIn: Array.isArray(pair.notIn) ? pair.notIn.map(String) : undefined } : null))
				.filter((pair) => pair && pair.open && pair.close && pair.open.length <= 4 && pair.close.length <= 4)
				.slice(0, 32);
		if (raw.brackets) configuration.brackets = pairs(raw.brackets);
		if (raw.autoClosingPairs) configuration.autoClosingPairs = pairs(raw.autoClosingPairs);
		if (raw.surroundingPairs) configuration.surroundingPairs = pairs(raw.surroundingPairs);
		if (raw.wordPattern) {
			try {
				const source = typeof raw.wordPattern === 'string' ? raw.wordPattern : raw.wordPattern.pattern;
				const flags = typeof raw.wordPattern === 'object' && raw.wordPattern.flags ? String(raw.wordPattern.flags).replace(/[^imsu]/g, '') : '';
				configuration.wordPattern = new RegExp(String(source).slice(0, 500), flags + 'g');
			} catch (error) {
				configuration.wordPatternError = error.message;
			}
		}
		if (raw.folding && typeof raw.folding === 'object') {
			configuration.folding = {};
			if (raw.folding.markers && typeof raw.folding.markers === 'object') {
				try {
					configuration.folding.markers = { start: new RegExp(String(raw.folding.markers.start).slice(0, 300)), end: new RegExp(String(raw.folding.markers.end).slice(0, 300)) };
				} catch (error) {
					configuration.folding.markersError = error.message;
				}
			}
			if (raw.folding.offSide !== undefined) configuration.folding.offSide = !!raw.folding.offSide;
			if (raw.folding.brackets !== undefined) configuration.folding.brackets = !!raw.folding.brackets;
		}
		if (Array.isArray(raw.quotes)) configuration.quotes = raw.quotes.map(String).filter((quote) => quote.length === 1).slice(0, 4);
		return configuration;
	}

	function configurationFor(languageId) {
		const id = normalizeLanguageId(languageId);
		let found = null;
		records.forEach((record, extensionId) => {
			const item = registry() ? registry().get(extensionId) : null;
			if (!item) return;
			if (record.apiConfigurations.has(id)) found = record.apiConfigurations.get(id);
			else if (!found && record.configurations.has(id)) found = record.configurations.get(id);
		});
		return found;
	}

	function escapeRegExp(text) {
		return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	function commentsFor(path) {
		const languageId = languageOf(path);
		const configuration = configurationFor(languageId);
		const grammar = grammars() ? grammars().get(languageId) : null;
		if (!configuration && !(grammar && grammar.owner !== 'builtin')) return null;
		const lineComment = configuration && configuration.comments && configuration.comments.lineComment ? configuration.comments.lineComment : grammar && grammar.lineComments.length ? grammar.lineComments[0] : '';
		const blockComment = configuration && configuration.comments && configuration.comments.blockComment ? configuration.comments.blockComment : grammar && grammar.blockComments.length ? grammar.blockComments[0] : null;
		const quotes = configuration && configuration.quotes ? configuration.quotes : grammar ? [...grammar.quotes] : ['"', "'"];
		const parts = [];
		if (blockComment) parts.push(escapeRegExp(blockComment[0]) + '[\\s\\S]*?(?:' + escapeRegExp(blockComment[1]) + '|$)');
		if (lineComment) parts.push(escapeRegExp(lineComment) + '[^\\n\\r]*');
		quotes.forEach((quote) => parts.push(escapeRegExp(quote) + '(?:\\\\[\\s\\S]|[^' + escapeRegExp(quote) + '\\\\\\n])*' + escapeRegExp(quote) + '?'));
		if (!parts.length) return null;
		return { languageId, lineComment, blockComment, quotes, maskExpression: new RegExp(parts.join('|'), 'g') };
	}

	function foldingFor(pathOrLanguage) {
		const catalog = languages();
		if (!catalog) return null;
		const value = String(pathOrLanguage || '');
		let languageId = catalog.normalize(value);
		if (languageId === 'text') languageId = catalog.fromPath(value.includes('.') ? value : 'file.' + value);
		const configuration = configurationFor(languageId);
		const grammar = grammars() ? grammars().get(languageId) : null;
		if (!configuration && !(grammar && grammar.owner !== 'builtin')) return null;
		const folding = configuration && configuration.folding ? configuration.folding : {};
		const brackets = folding.brackets !== undefined ? folding.brackets : grammar ? grammar.balanced : !!(configuration && configuration.brackets && configuration.brackets.length);
		return {
			languageId,
			markers: folding.markers || null,
			brackets,
			indentation: folding.offSide === true || (!brackets && !folding.markers),
			lineComments: !!(grammar && grammar.lineComments.length) || !!(configuration && configuration.comments && configuration.comments.lineComment),
		};
	}

	const DEFAULT_BRACKETS = Object.freeze([{ open: '{', close: '}' }, { open: '[', close: ']' }, { open: '(', close: ')' }]);

	function editingFor(path) {
		const languageId = languageOf(path);
		const configuration = configurationFor(languageId);
		const grammar = grammars() ? grammars().get(languageId) : null;
		if (!configuration && !(grammar && grammar.owner !== 'builtin')) return null;
		const brackets = configuration && configuration.brackets && configuration.brackets.length ? configuration.brackets : grammar && !grammar.balanced ? [] : [...DEFAULT_BRACKETS];
		const quotes = configuration && configuration.quotes ? configuration.quotes : grammar ? [...grammar.quotes] : ['"', "'"];
		const quotePairs = quotes.map((quote) => ({ open: quote, close: quote, notIn: ['string', 'comment'] }));
		const autoClosingPairs = configuration && configuration.autoClosingPairs ? configuration.autoClosingPairs : brackets.concat(quotePairs);
		const surroundingPairs = configuration && configuration.surroundingPairs ? configuration.surroundingPairs : autoClosingPairs.map((pair) => ({ open: pair.open, close: pair.close }));
		return { languageId, brackets, autoClosingPairs, surroundingPairs, wordPattern: configuration && configuration.wordPattern ? configuration.wordPattern : null };
	}

	function repaint() {
		const active = activeDocument();
		if (!active) return;
		if (typeof root.paintEditor === 'function') root.paintEditor(active.path, active.text);
		if (root.SynapseIntelligence && root.SynapseIntelligence.controller) root.SynapseIntelligence.controller.refresh();
	}

	function registerLanguages(item, record) {
		const catalog = languages();
		if (!catalog) return;
		item.manifest.contributes.languages.forEach((definition, index) => {
			if (!definition || typeof definition !== 'object') return;
			const id = normalizeLanguageId(definition.id);
			try {
				record.languages.push(catalog.registerLanguage({ id, extensions: definition.extensions, aliases: definition.aliases, filenames: definition.filenames }, ownerOf(item.id)));
			} catch (error) {
				warn(item.id, `contributes.languages[${index}]: ${error.message}`);
				return;
			}
			let raw = null;
			if (typeof definition.configuration === 'string') raw = readJson(item, definition.configuration, `contributes.languages[${index}].configuration`);
			else if (definition.configuration && typeof definition.configuration === 'object') raw = definition.configuration;
			const configuration = sanitizeConfiguration(raw);
			if (configuration) {
				if (configuration.wordPatternError) warn(item.id, `contributes.languages[${index}].configuration.wordPattern: ${configuration.wordPatternError}`);
				if (configuration.folding && configuration.folding.markersError) warn(item.id, `contributes.languages[${index}].configuration.folding.markers: ${configuration.folding.markersError}`);
				record.configurations.set(id, configuration);
			}
		});
	}

	const grammarCache = new Map();
	const GRAMMAR_CACHE_LIMIT = 64;

	function cachedGrammar(item, path, label) {
		const key = `${item.id}@${item.manifest.version || ''}:${String(path || '').replace(/^\.\//, '')}`;
		if (grammarCache.has(key)) {
			const hit = grammarCache.get(key);
			grammarCache.delete(key);
			grammarCache.set(key, hit);
			return hit;
		}
		const definition = readJson(item, path, label);
		if (definition && typeof definition === 'object') {
			grammarCache.set(key, definition);
			if (grammarCache.size > GRAMMAR_CACHE_LIMIT) grammarCache.delete(grammarCache.keys().next().value);
		}
		return definition;
	}

	function registerGrammars(item, record) {
		const catalog = grammars();
		if (!catalog) return;
		item.manifest.contributes.grammars.forEach((entry, index) => {
			if (!entry || typeof entry !== 'object') return;
			const language = normalizeLanguageId(entry.language);
			const definition = entry.path ? cachedGrammar(item, entry.path, `contributes.grammars[${index}]`) : entry.grammar;
			if (!definition || typeof definition !== 'object') return;
			try {
				const registration = catalog.register({ ...definition, language, extensions: definition.extensions || entry.extensions || [] }, ownerOf(item.id));
				registration.grammar.errors.forEach((message) => warn(item.id, `contributes.grammars[${index}]: ${message}`));
				record.grammars.push(registration);
			} catch (error) {
				warn(item.id, `contributes.grammars[${index}]: ${error.message}`);
			}
		});
	}

	function parseSnippetFile(item, raw, language, index) {
		const list = [];
		if (!raw || typeof raw !== 'object') return list;
		Object.keys(raw).forEach((name) => {
			const entry = raw[name];
			if (!entry || typeof entry !== 'object') return;
			const body = Array.isArray(entry.body) ? entry.body.map(String).join('\n') : typeof entry.body === 'string' ? entry.body : '';
			if (!body) return;
			const prefixes = (Array.isArray(entry.prefix) ? entry.prefix : [entry.prefix]).map((prefix) => String(prefix || '').trim()).filter(Boolean);
			if (!prefixes.length) return;
			const scope = typeof entry.scope === 'string' && entry.scope.trim() ? entry.scope.split(',').map(normalizeLanguageId) : null;
			if (scope && !scope.includes(language) && !scope.includes('*')) return;
			prefixes.forEach((prefix) => list.push({ name: String(name).slice(0, 120), prefix: prefix.slice(0, 80), body: body.slice(0, 20000), description: typeof entry.description === 'string' ? entry.description.slice(0, 300) : '', extensionId: item.id }));
		});
		if (list.length > MAX_SNIPPETS_PER_LANGUAGE) {
			warn(item.id, `contributes.snippets[${index}]: mais de ${MAX_SNIPPETS_PER_LANGUAGE} snippets; excedentes ignorados.`);
			list.length = MAX_SNIPPETS_PER_LANGUAGE;
		}
		return list;
	}

	function registerSnippets(item, record) {
		item.manifest.contributes.snippets.forEach((entry, index) => {
			if (!entry || typeof entry !== 'object') return;
			const language = normalizeLanguageId(entry.language);
			const raw = readJson(item, entry.path, `contributes.snippets[${index}]`);
			const list = parseSnippetFile(item, raw, language, index);
			if (!list.length) return;
			const existing = record.snippets.get(language) || [];
			record.snippets.set(language, existing.concat(list));
		});
	}

	function register(item) {
		const record = recordFor(item.id);
		registerLanguages(item, record);
		registerGrammars(item, record);
		registerSnippets(item, record);
		if (record.languages.length || record.grammars.length) repaint();
		ensureCompletionProvider();
	}

	function unregister(item) {
		const record = records.get(item.id);
		if (!record) return;
		record.grammars.forEach((registration) => registration.dispose());
		record.languages.forEach((registration) => registration.dispose());
		if (languages()) languages().unregisterOwner(ownerOf(item.id));
		if (grammars()) grammars().unregisterOwner(ownerOf(item.id));
		records.delete(item.id);
		if (record.languages.length || record.grammars.length) repaint();
	}

	function disposeAll(id) {
		[...providers.values()].forEach((provider) => {
			if (provider.extensionId === id) providers.delete(provider.handle);
		});
		[...diagnosticCollections.keys()].forEach((key) => {
			if (key.startsWith(id + ':')) diagnosticCollections.delete(key);
		});
		const record = records.get(id);
		if (record) record.apiConfigurations.clear();
		rebuildDiagnostics();
		hideHover();
	}

	function snippetsFor(languageId) {
		const list = [];
		records.forEach((record, extensionId) => {
			const item = registry() ? registry().get(extensionId) : null;
			if (!item) return;
			const own = record.snippets.get(languageId);
			if (own) list.push(...own);
			const any = record.snippets.get('*');
			if (any) list.push(...any);
		});
		return list;
	}

	function snippetVariables(active, start) {
		const starts = lineStarts(active.text);
		const position = positionAt(active.text, starts, start);
		const lineEnd = position.line + 1 < starts.length ? starts[position.line + 1] - 1 : active.text.length;
		const basename = active.path.split('/').pop();
		const dot = basename.lastIndexOf('.');
		const now = new Date();
		return {
			TM_SELECTED_TEXT: '',
			TM_CURRENT_LINE: active.text.slice(starts[position.line], lineEnd),
			TM_CURRENT_WORD: '',
			TM_LINE_INDEX: String(position.line),
			TM_LINE_NUMBER: String(position.line + 1),
			TM_FILENAME: basename,
			TM_FILENAME_BASE: dot > 0 ? basename.slice(0, dot) : basename,
			TM_DIRECTORY: active.path.includes('/') ? active.path.slice(0, active.path.lastIndexOf('/')) : '',
			TM_FILEPATH: active.path,
			RELATIVE_FILEPATH: active.path,
			WORKSPACE_NAME: active.project.name || '',
			CURRENT_YEAR: String(now.getFullYear()),
			CURRENT_MONTH: String(now.getMonth() + 1).padStart(2, '0'),
			CURRENT_DATE: String(now.getDate()).padStart(2, '0'),
			CURRENT_HOUR: String(now.getHours()).padStart(2, '0'),
			CURRENT_MINUTE: String(now.getMinutes()).padStart(2, '0'),
			CURRENT_SECOND: String(now.getSeconds()).padStart(2, '0'),
			LINE_COMMENT: (commentsFor(active.path) || {}).lineComment || '//',
			BLOCK_COMMENT_START: '/*',
			BLOCK_COMMENT_END: '*/',
		};
	}

	function expandSnippet(body, active, start) {
		const host = editorHost();
		const indent = (/^[ \t]*/.exec(active.text.slice(active.text.lastIndexOf('\n', start - 1) + 1, start)) || [''])[0];
		if (!host || typeof host.parseSnippet !== 'function') {
			const plain = body.replace(/\$\{\d+:([^}]*)\}/g, '$1').replace(/\$\{?\d+\}?/g, '');
			return { text: plain.split('\n').join('\n' + indent), caretOffset: plain.length };
		}
		const parsed = host.parseSnippet(body, snippetVariables(active, start));
		const lines = parsed.text.split('\n');
		let text = lines[0];
		const adjust = (offset) => {
			let consumed = lines[0].length + 1;
			let delta = 0;
			for (let index = 1; index < lines.length && offset >= consumed; index += 1) {
				delta += indent.length;
				consumed += lines[index].length + 1;
			}
			return offset + delta;
		};
		for (let index = 1; index < lines.length; index += 1) text += '\n' + indent + lines[index];
		let caret = parsed.cursor;
		if (caret < 0) {
			const numbers = [...parsed.tabstops.keys()].sort((a, b) => a - b);
			caret = numbers.length ? parsed.tabstops.get(numbers[0]).start : parsed.text.length;
		}
		return { text, caretOffset: adjust(caret) };
	}

	function wordRangeAt(text, position, configuration) {
		const lineStart = text.lastIndexOf('\n', position - 1) + 1;
		const lineEndIndex = text.indexOf('\n', position);
		const lineEnd = lineEndIndex === -1 ? text.length : lineEndIndex;
		const line = text.slice(lineStart, lineEnd);
		const column = position - lineStart;
		const pattern = configuration && configuration.wordPattern ? new RegExp(configuration.wordPattern.source, configuration.wordPattern.flags.includes('g') ? configuration.wordPattern.flags : configuration.wordPattern.flags + 'g') : /[\p{L}\p{N}_$]+/gu;
		let match;
		while ((match = pattern.exec(line))) {
			if (match[0].length === 0) {
				pattern.lastIndex += 1;
				continue;
			}
			if (match.index <= column && match.index + match[0].length >= column) return { start: lineStart + match.index, end: lineStart + column, full: lineStart + match.index + match[0].length };
			if (match.index > column) break;
		}
		return { start: position, end: position, full: position };
	}

	function completionKindName(kind) {
		if (typeof kind === 'string') return kind;
		return COMPLETION_KINDS[Number(kind)] || 'text';
	}

	function convertCompletionItem(raw, active, defaults, provider) {
		if (!raw || typeof raw !== 'object') return null;
		const label = typeof raw.label === 'string' ? raw.label : raw.label && typeof raw.label.label === 'string' ? raw.label.label : '';
		if (!label) return null;
		let start = defaults.start;
		let end = defaults.end;
		const starts = defaults.starts;
		if (raw.range) {
			const range = raw.range.inserting || raw.range;
			if (range && range.start && range.end) {
				start = offsetAt(active.text, starts, range.start);
				end = offsetAt(active.text, starts, range.end);
			}
		}
		let insertText = typeof raw.insertText === 'string' ? raw.insertText : raw.insertText && typeof raw.insertText.value === 'string' ? raw.insertText.value : label;
		let caretOffset = insertText.length;
		if (raw.isSnippet || (raw.insertText && typeof raw.insertText === 'object' && raw.insertText.snippet)) {
			const expanded = expandSnippet(insertText, active, start);
			insertText = expanded.text;
			caretOffset = expanded.caretOffset;
		}
		return {
			label: label.slice(0, 160),
			insertText,
			caretOffset,
			kind: completionKindName(raw.kind),
			detail: typeof raw.detail === 'string' ? raw.detail.slice(0, 300) : '',
			documentation: typeof raw.documentation === 'string' ? raw.documentation.slice(0, 2000) : raw.documentation && typeof raw.documentation.value === 'string' ? raw.documentation.value.slice(0, 2000) : '',
			filterText: typeof raw.filterText === 'string' ? raw.filterText : label,
			sortText: typeof raw.sortText === 'string' ? raw.sortText : label,
			start: Math.min(start, end),
			end: Math.max(start, end),
			extensionId: provider ? provider.extensionId : undefined,
		};
	}

	function rankItems(items, prefix) {
		const lower = prefix.toLowerCase();
		const scored = items
			.map((item) => {
				const filter = (item.filterText || item.label).toLowerCase();
				let score = 0;
				if (!lower) score = 3;
				else if (filter.startsWith(lower)) score = 3;
				else if (filter.includes(lower)) score = 2;
				else if (fuzzyMatches(filter, lower)) score = 1;
				return { item, score };
			})
			.filter((entry) => entry.score > 0);
		scored.sort((a, b) => b.score - a.score || a.item.sortText.localeCompare(b.item.sortText));
		return scored.map((entry) => entry.item);
	}

	function fuzzyMatches(text, query) {
		let index = 0;
		for (const char of query) {
			index = text.indexOf(char, index);
			if (index === -1) return false;
			index += 1;
		}
		return true;
	}

	async function completeWithExtensions(requestContext) {
		const active = activeDocument();
		if (!active || active.path !== requestContext.path || active.text.replace(/\r\n?/g, '\n') !== requestContext.source.replace(/\r\n?/g, '\n')) return null;
		const position = toSourceOffset(requestContext.position);
		const configuration = configurationFor(active.languageId);
		const word = wordRangeAt(active.text, position, configuration);
		const prefix = active.text.slice(word.start, position);
		const matching = providersFor('completion', active.languageId, active.path);
		const snippets = snippetsFor(active.languageId);
		if (!matching.length && !snippets.length) return null;
		const previous = active.text[position - 1] || '';
		const triggered = matching.filter((provider) => provider.triggers.includes(previous));
		if (!requestContext.explicit && !prefix && !triggered.length && !/[\p{L}\p{N}_$]/u.test(previous)) return null;
		const starts = lineStarts(active.text);
		const defaults = { start: word.start, end: position, starts };
		const items = [];
		if (prefix || requestContext.explicit) {
			snippets.forEach((snippet) => {
				if (!requestContext.explicit && !snippet.prefix.toLowerCase().startsWith(prefix.toLowerCase())) return;
				const expanded = expandSnippet(snippet.body, active, word.start);
				items.push({ label: snippet.prefix, insertText: expanded.text, caretOffset: expanded.caretOffset, kind: 'snippet', detail: snippet.name, documentation: snippet.description, filterText: snippet.prefix, sortText: '~' + snippet.prefix, start: word.start, end: position, extensionId: snippet.extensionId });
			});
		}
		if (matching.length) {
			const payload = documentPayload(active);
			if (payload) {
				const positionInfo = positionAt(active.text, starts, position);
				const context = { triggerKind: requestContext.explicit ? 1 : triggered.length ? 2 : 1, triggerCharacter: triggered.length ? previous : undefined };
				const results = await Promise.all(matching.map((provider) => request(provider, { document: payload, position: positionInfo, context }, { signal: requestContext.signal })));
				results.forEach((result, index) => {
					const list = Array.isArray(result) ? result : result && Array.isArray(result.items) ? result.items : [];
					list.slice(0, MAX_COMPLETION_ITEMS).forEach((raw) => {
						const converted = convertCompletionItem(raw, active, defaults, matching[index]);
						if (converted) items.push(converted);
					});
				});
			}
		}
		if (requestContext.signal && requestContext.signal.aborted) return { items: [] };
		if (!items.length) return matching.length ? { items: [] } : null;
		const seen = new Set();
		const unique = items.filter((item) => {
			const key = item.label + '\u0000' + item.insertText;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
		const ranked = rankItems(unique, prefix).slice(0, MAX_COMPLETION_ITEMS);
		if (!ranked.length) return { items: [] };
		return {
			start: toDisplayOffset(word.start),
			end: requestContext.position,
			position: requestContext.position,
			prefix,
			language: active.languageId,
			items: ranked.map((item) => ({ ...item, start: toDisplayOffset(item.start), end: toDisplayOffset(item.end) })),
		};
	}

	function ensureCompletionProvider() {
		if (completionRegistration || !root.SynapseAutocomplete) return;
		completionRegistration = root.SynapseAutocomplete.registerProvider({
			id: 'extensions',
			supports(documentInfo) {
				const languageId = languageOf(documentInfo && documentInfo.path);
				return hasProviders('completion', languageId, documentInfo.path) || snippetsFor(languageId).length > 0;
			},
			complete: completeWithExtensions,
		});
	}

	function renderMarkdown(container, value) {
		const text = typeof value === 'string' ? value : value && typeof value.value === 'string' ? value.value : value && typeof value.language === 'string' ? '```' + value.language + '\n' + String(value.value || '') + '\n```' : '';
		if (!text.trim()) return false;
		const blocks = text.split(/```[^\n]*\n?/);
		blocks.forEach((block, index) => {
			if (!block.trim()) return;
			if (index % 2 === 1) {
				const pre = document.createElement('pre');
				pre.textContent = block.replace(/\n$/, '');
				container.appendChild(pre);
				return;
			}
			block.split(/\n{2,}/).forEach((paragraph) => {
				if (!paragraph.trim()) return;
				const node = document.createElement('p');
				const parts = paragraph.split(/(`[^`]+`|\*\*[^*]+\*\*)/);
				parts.forEach((part) => {
					if (!part) return;
					if (part.startsWith('`') && part.endsWith('`')) {
						const code = document.createElement('code');
						code.textContent = part.slice(1, -1);
						node.appendChild(code);
					} else if (part.startsWith('**') && part.endsWith('**')) {
						const strong = document.createElement('strong');
						strong.textContent = part.slice(2, -2);
						node.appendChild(strong);
					} else node.appendChild(document.createTextNode(part.replace(/\\([\\`*_{}[\]()#+\-.!])/g, '$1')));
				});
				container.appendChild(node);
			});
		});
		return container.childNodes.length > 0;
	}

	function ensureHoverWidget() {
		const ui = elements();
		if (!ui) return null;
		if (hoverWidget && hoverWidget.isConnected) return hoverWidget;
		hoverWidget = document.createElement('div');
		hoverWidget.className = 'ext-hover';
		hoverWidget.setAttribute('role', 'tooltip');
		hoverWidget.hidden = true;
		hoverWidget.addEventListener('mousedown', (event) => event.preventDefault());
		ui.editorPane.appendChild(hoverWidget);
		return hoverWidget;
	}

	function hideHover() {
		clearTimeout(hoverTimer);
		hoverTimer = 0;
		hoverSequence += 1;
		lastHoverKey = '';
		if (hoverWidget) hoverWidget.hidden = true;
	}

	function metrics() {
		const ui = elements();
		const style = getComputedStyle(ui.codeHl);
		const probe = document.createElement('span');
		probe.textContent = 'MMMMMMMMMM';
		probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;left:-9999px;top:0;font:' + style.font;
		ui.codeHl.parentElement.appendChild(probe);
		const width = probe.getBoundingClientRect().width / 10;
		probe.remove();
		const lineHeight = parseFloat(getComputedStyle(ui.editorGrid).lineHeight);
		const textareaStyle = getComputedStyle(ui.codeTa);
		return { charWidth: width || 7, lineHeight: Number.isFinite(lineHeight) && lineHeight > 0 ? lineHeight : 20, paddingLeft: parseFloat(textareaStyle.paddingLeft) || 0, paddingTop: parseFloat(textareaStyle.paddingTop) || 0, tabSize: Number(ui.codeTa.style.tabSize) || Number(textareaStyle.tabSize) || 2 };
	}

	function displayOffsetFromPoint(clientX, clientY) {
		const ui = elements();
		const rect = ui.codeTa.getBoundingClientRect();
		const measure = metrics();
		const x = clientX - rect.left + ui.codeTa.scrollLeft - measure.paddingLeft;
		const y = clientY - rect.top + ui.codeTa.scrollTop - measure.paddingTop;
		if (x < -measure.charWidth || y < 0) return -1;
		const text = ui.codeTa.value;
		const line = Math.floor(y / measure.lineHeight);
		const lines = text.split('\n');
		if (line >= lines.length) return -1;
		const column = Math.max(0, Math.round(x / measure.charWidth));
		const lineText = lines[line];
		let visual = 0;
		let index = 0;
		while (index < lineText.length && visual < column) {
			visual += lineText.charCodeAt(index) === 9 ? measure.tabSize - (visual % measure.tabSize) : 1;
			index += 1;
		}
		if (index >= lineText.length && column > visual) return -1;
		let offset = 0;
		for (let current = 0; current < line; current += 1) offset += lines[current].length + 1;
		return offset + index;
	}

	function positionHover(widget, sourceOffset) {
		const ui = elements();
		const measure = metrics();
		const display = toDisplayOffset(sourceOffset);
		const text = ui.codeTa.value;
		const lineStart = text.lastIndexOf('\n', display - 1) + 1;
		const line = text.slice(0, lineStart).split('\n').length - 1;
		const lineText = text.slice(lineStart, display);
		let visual = 0;
		for (let index = 0; index < lineText.length; index += 1) visual += lineText.charCodeAt(index) === 9 ? measure.tabSize - (visual % measure.tabSize) : 1;
		const taRect = ui.codeTa.getBoundingClientRect();
		const paneRect = ui.editorPane.getBoundingClientRect();
		const left = taRect.left - paneRect.left + measure.paddingLeft + visual * measure.charWidth - ui.codeTa.scrollLeft;
		const top = taRect.top - paneRect.top + measure.paddingTop + (line + 1) * measure.lineHeight - ui.codeTa.scrollTop + 4;
		widget.style.left = Math.max(4, Math.min(left, paneRect.width - 40)) + 'px';
		widget.style.top = Math.max(4, top) + 'px';
		widget.style.maxWidth = Math.max(160, Math.min(520, paneRect.width - 16)) + 'px';
		widget.hidden = false;
		const widgetRect = widget.getBoundingClientRect();
		if (widgetRect.right > paneRect.right - 4) widget.style.left = Math.max(4, paneRect.width - widgetRect.width - 8) + 'px';
		if (widgetRect.bottom > paneRect.bottom - 4) widget.style.top = Math.max(4, top - measure.lineHeight - widgetRect.height - 8) + 'px';
	}

	async function showHoverAt(sourceOffset, options) {
		const active = activeDocument();
		if (!active) return false;
		const matching = providersFor('hover', active.languageId, active.path);
		if (!matching.length) return false;
		const payload = documentPayload(active);
		if (!payload) return false;
		const starts = lineStarts(active.text);
		const position = positionAt(active.text, starts, sourceOffset);
		const key = active.path + ':' + sourceOffset + ':' + active.entry.text.length;
		if (!options.force && key === lastHoverKey && hoverWidget && !hoverWidget.hidden) return true;
		const sequence = ++hoverSequence;
		const controller = new AbortController();
		const results = await Promise.all(matching.map((provider) => request(provider, { document: payload, position }, { signal: controller.signal })));
		if (sequence !== hoverSequence) return false;
		const current = activeDocument();
		if (!current || current.path !== active.path || current.text !== active.text) return false;
		const widget = ensureHoverWidget();
		if (!widget) return false;
		widget.replaceChildren();
		let rendered = false;
		let anchor = sourceOffset;
		results.forEach((result) => {
			if (!result || typeof result !== 'object') return;
			const contents = Array.isArray(result.contents) ? result.contents : [result.contents];
			contents.forEach((content) => {
				const section = document.createElement('div');
				section.className = 'ext-hover-section';
				if (renderMarkdown(section, content)) {
					widget.appendChild(section);
					rendered = true;
				}
			});
			if (result.range && result.range.start) anchor = Math.min(anchor, offsetAt(active.text, starts, result.range.start));
		});
		if (!rendered) {
			widget.hidden = true;
			return false;
		}
		lastHoverKey = key;
		positionHover(widget, anchor);
		return true;
	}

	function onEditorMouseMove(event) {
		const ui = elements();
		if (!ui || event.target !== ui.codeTa) return;
		const active = activeDocument();
		if (!active || !hasProviders('hover', active.languageId, active.path)) return;
		clearTimeout(hoverTimer);
		const clientX = event.clientX;
		const clientY = event.clientY;
		hoverTimer = setTimeout(() => {
			const displayOffset = displayOffsetFromPoint(clientX, clientY);
			if (displayOffset < 0) {
				if (hoverWidget && !hoverWidget.hidden && lastHoverKey) hideHover();
				return;
			}
			const sourceOffset = toSourceOffset(displayOffset);
			const word = wordRangeAt(active.text, sourceOffset, configurationFor(active.languageId));
			if (word.start === word.full) {
				if (hoverWidget && !hoverWidget.hidden) hideHover();
				return;
			}
			showHoverAt(word.start, { force: false });
		}, HOVER_DELAY_MS);
	}

	function hoverAtCaret() {
		const ui = elements();
		const active = activeDocument();
		if (!ui || !active) return Promise.resolve(false);
		return showHoverAt(toSourceOffset(ui.codeTa.selectionStart), { force: true });
	}

	function locationsFrom(result) {
		const list = Array.isArray(result) ? result : result ? [result] : [];
		return list
			.map((entry) => {
				if (!entry || typeof entry !== 'object') return null;
				const uri = entry.uri || entry.targetUri;
				const range = entry.range || entry.targetSelectionRange || entry.targetRange;
				if (!uri || !range || !range.start) return null;
				const host = workspaceHost();
				const path = host ? host.relativeOf(String(uri)) : String(uri).replace(/^synapse:\/projeto\//, '');
				return { path, range };
			})
			.filter(Boolean);
	}

	function revealLocation(location) {
		const host = editorHost();
		const project = typeof root.activeProject === 'function' ? root.activeProject() : null;
		if (!project || !project.files.has(location.path)) {
			if (typeof root.toast === 'function') root.toast('Definição não encontrada', location.path, 'warn');
			return false;
		}
		if (typeof root.openFileInEditor === 'function' && project.openFile !== location.path) root.openFileInEditor(location.path);
		if (host) {
			try {
				host.handlers['editor.setSelections']({ selections: [{ anchor: location.range.start, active: location.range.end || location.range.start }], reveal: true });
			} catch (error) {
				return false;
			}
		}
		const ui = elements();
		if (ui) ui.codeTa.focus({ preventScroll: true });
		return true;
	}

	async function goToDefinition() {
		const ui = elements();
		const active = activeDocument();
		if (!ui || !active) return false;
		const matching = providersFor('definition', active.languageId, active.path);
		if (!matching.length) return false;
		const payload = documentPayload(active);
		if (!payload) return false;
		const starts = lineStarts(active.text);
		const position = positionAt(active.text, starts, toSourceOffset(ui.codeTa.selectionStart));
		const results = await Promise.all(matching.map((provider) => request(provider, { document: payload, position }, {})));
		const locations = results.flatMap(locationsFrom);
		if (!locations.length) {
			if (typeof root.toast === 'function') root.toast('Nenhuma definição encontrada', '', '');
			return true;
		}
		if (locations.length === 1 || !windowHost()) return revealLocation(locations[0]);
		const picked = await windowHost().showQuickPick({ items: locations.map((location) => ({ label: location.path, description: `linha ${Number(location.range.start.line) + 1}` })), options: { placeHolder: 'Escolha a definição' } }, {});
		if (picked === null || picked === undefined) return true;
		return revealLocation(locations[Array.isArray(picked) ? picked[0] : picked]);
	}

	function applyTextEdits(text, edits) {
		const starts = lineStarts(text);
		const normalized = (Array.isArray(edits) ? edits : [])
			.map((edit) => {
				if (!edit || !edit.range || !edit.range.start) return null;
				const start = offsetAt(text, starts, edit.range.start);
				const end = offsetAt(text, starts, edit.range.end || edit.range.start);
				return { start: Math.min(start, end), end: Math.max(start, end), text: String(edit.newText === undefined ? edit.text || '' : edit.newText) };
			})
			.filter(Boolean)
			.sort((a, b) => b.start - a.start || b.end - a.end);
		for (let index = 1; index < normalized.length; index += 1) {
			if (normalized[index].end > normalized[index - 1].start) throw new Error('Edições sobrepostas.');
		}
		let next = text;
		normalized.forEach((edit) => {
			next = next.slice(0, edit.start) + edit.text + next.slice(edit.end);
		});
		return next;
	}

	function replaceActiveText(active, next) {
		if (next === active.text) return false;
		const ui = elements();
		let prefix = 0;
		const limit = Math.min(active.text.length, next.length);
		while (prefix < limit && active.text[prefix] === next[prefix]) prefix += 1;
		let suffix = 0;
		while (suffix < limit - prefix && active.text[active.text.length - 1 - suffix] === next[next.length - 1 - suffix]) suffix += 1;
		const documents = root.SynapseEditorDocuments;
		if (root.EditorFolding && typeof root.EditorFolding.expandBeforeInput === 'function' && ui.codeTa.classList.contains('folded')) root.EditorFolding.expandBeforeInput();
		const caret = Math.min(ui.codeTa.selectionStart, next.length);
		if (documents && typeof documents.applyEdit === 'function') {
			documents.applyEdit({ start: prefix, end: active.text.length - suffix, text: next.slice(prefix, next.length - suffix), selectionStart: caret, selectionEnd: caret });
			return true;
		}
		const host = editorHost();
		if (host) {
			const starts = lineStarts(active.text);
			host.handlers['editor.edit']({ edits: [{ start: positionAt(active.text, starts, prefix), end: positionAt(active.text, starts, active.text.length - suffix), text: next.slice(prefix, next.length - suffix) }] });
			return true;
		}
		return false;
	}

	async function formatWithExtensions() {
		const active = activeDocument();
		if (!active) return false;
		const matching = providersFor('formatting', active.languageId, active.path);
		if (!matching.length) return false;
		const payload = documentPayload(active);
		if (!payload) return false;
		const ui = elements();
		const tabSize = Number(ui.codeTa.style.tabSize) || 2;
		const indentation = root.SynapseIndentation;
		const unit = indentation && typeof indentation.detectIndentation === 'function' ? indentation.detectIndentation(active.text) : '  ';
		const options = { tabSize, insertSpaces: unit !== '\t' };
		const provider = matching[matching.length - 1];
		const result = await request(provider, { document: payload, options }, { timeoutMs: FORMAT_TIMEOUT_MS });
		if (result === null || result === undefined) return true;
		const current = activeDocument();
		if (!current || current.path !== active.path || current.text !== active.text) return true;
		let next;
		try {
			next = applyTextEdits(active.text, result);
		} catch (error) {
			warn(provider.extensionId, `formatting: ${error.message}`);
			if (typeof root.toast === 'function') root.toast('Falha ao formatar', error.message, 'err');
			return true;
		}
		if (!replaceActiveText(active, next)) {
			if (typeof root.toast === 'function') root.toast('Já está formatado', 'Nenhuma mudança necessária', 'ok');
			return true;
		}
		const item = registry() ? registry().get(provider.extensionId) : null;
		if (typeof root.toast === 'function') root.toast('Código formatado', item ? `por ${item.name}` : '', 'ok');
		return true;
	}

	function diagnosticsAtRange(path, range, text) {
		const list = diagnosticsByPath.get(path) || [];
		const starts = lineStarts(text);
		const start = offsetAt(text, starts, range.start);
		const end = offsetAt(text, starts, range.end || range.start);
		return list.filter((entry) => {
			const entryStart = offsetAt(text, starts, entry.range.start);
			const entryEnd = offsetAt(text, starts, entry.range.end || entry.range.start);
			return entryStart <= end && entryEnd >= start;
		});
	}

	async function applyCodeAction(action, provider) {
		const active = activeDocument();
		if (!active) return false;
		if (action.edit && action.edit.changes) {
			const changes = action.edit.changes;
			const ownEdits = [];
			const host = workspaceHost();
			Object.keys(changes).forEach((uri) => {
				const path = host ? host.relativeOf(uri) : String(uri).replace(/^synapse:\/projeto\//, '');
				if (path === active.path) ownEdits.push(...changes[uri]);
			});
			if (ownEdits.length) {
				try {
					replaceActiveText(active, applyTextEdits(active.text, ownEdits));
				} catch (error) {
					warn(provider.extensionId, `codeAction: ${error.message}`);
					return false;
				}
			}
			const others = Object.keys(changes).filter((uri) => (host ? host.relativeOf(uri) : uri) !== active.path);
			if (others.length && host) {
				const item = registry() ? registry().get(provider.extensionId) : null;
				const descriptor = { id: provider.extensionId, manifest: item || { name: provider.extensionId }, capabilities: root.SynapseExtensionPermissions.capabilitiesFor({ id: provider.extensionId, permissions: item ? item.permissions : [] }) };
				if (descriptor.capabilities.has('workspace.write')) {
					try {
						await host.handlers['workspace.applyEdit']({ edit: { changes: Object.fromEntries(others.map((uri) => [uri, changes[uri]])) }, label: action.title }, { descriptor });
					} catch (error) {
						warn(provider.extensionId, `codeAction: ${error.message}`);
					}
				} else warn(provider.extensionId, 'codeAction: edições em outros arquivos exigem a permissão "workspace.write".');
			}
		}
		if (action.command && registry()) {
			const command = typeof action.command === 'string' ? action.command : action.command.command;
			const args = typeof action.command === 'object' && Array.isArray(action.command.arguments) ? action.command.arguments : [];
			await registry().executeCommand(command, ...args).catch(() => {});
		}
		return true;
	}

	async function showCodeActions() {
		const ui = elements();
		const active = activeDocument();
		if (!ui || !active) return false;
		const matching = providersFor('codeAction', active.languageId, active.path);
		if (!matching.length) return false;
		const payload = documentPayload(active);
		if (!payload) return false;
		const starts = lineStarts(active.text);
		const range = { start: positionAt(active.text, starts, toSourceOffset(ui.codeTa.selectionStart)), end: positionAt(active.text, starts, toSourceOffset(ui.codeTa.selectionEnd)) };
		const context = { diagnostics: diagnosticsAtRange(active.path, range, active.text).map((entry) => entry.raw), triggerKind: 1 };
		const results = await Promise.all(matching.map((provider) => request(provider, { document: payload, range, context }, {})));
		const actions = [];
		results.forEach((result, index) => {
			(Array.isArray(result) ? result : []).forEach((raw) => {
				if (!raw || typeof raw !== 'object') return;
				const title = typeof raw.title === 'string' ? raw.title : raw.command && typeof raw.command.title === 'string' ? raw.command.title : '';
				if (!title) return;
				actions.push({ title, action: raw.title ? raw : { title, command: raw }, provider: matching[index] });
			});
		});
		if (!actions.length) {
			if (typeof root.toast === 'function') root.toast('Nenhuma ação de código disponível', '', '');
			return true;
		}
		if (!windowHost()) return true;
		const picked = await windowHost().showQuickPick({ items: actions.map((entry) => ({ label: entry.title, description: entry.action.kind ? String(entry.action.kind) : '' })), options: { placeHolder: 'Ações de código' } }, {});
		if (picked === null || picked === undefined) return true;
		const chosen = actions[Array.isArray(picked) ? picked[0] : picked];
		if (chosen) await applyCodeAction(chosen.action, chosen.provider);
		return true;
	}

	function flattenSymbols(list, depth, into) {
		(Array.isArray(list) ? list : []).forEach((symbol) => {
			if (!symbol || typeof symbol !== 'object' || typeof symbol.name !== 'string') return;
			const range = symbol.selectionRange || symbol.range || (symbol.location && symbol.location.range);
			if (!range || !range.start) return;
			into.push({ name: symbol.name, detail: typeof symbol.detail === 'string' ? symbol.detail : symbol.containerName || '', kind: typeof symbol.kind === 'number' ? SYMBOL_KINDS[symbol.kind] || 'symbol' : String(symbol.kind || 'symbol'), range, depth });
			if (Array.isArray(symbol.children) && depth < 6) flattenSymbols(symbol.children, depth + 1, into);
		});
	}

	async function showDocumentSymbols() {
		const active = activeDocument();
		if (!active) return false;
		const matching = providersFor('documentSymbol', active.languageId, active.path);
		if (!matching.length) return false;
		const payload = documentPayload(active);
		if (!payload) return false;
		const results = await Promise.all(matching.map((provider) => request(provider, { document: payload }, {})));
		const symbols = [];
		results.forEach((result) => flattenSymbols(result, 0, symbols));
		if (!symbols.length) {
			if (typeof root.toast === 'function') root.toast('Nenhum símbolo encontrado', '', '');
			return true;
		}
		if (!windowHost()) return true;
		const picked = await windowHost().showQuickPick({ items: symbols.map((symbol) => ({ label: '\u00a0\u00a0'.repeat(symbol.depth) + symbol.name, description: symbol.kind + (symbol.detail ? ' · ' + symbol.detail : ''), detail: `linha ${Number(symbol.range.start.line) + 1}` })), options: { placeHolder: 'Ir para símbolo', matchOnDescription: true } }, {});
		if (picked === null || picked === undefined) return true;
		const chosen = symbols[Array.isArray(picked) ? picked[0] : picked];
		if (chosen) revealLocation({ path: active.path, range: chosen.range });
		return true;
	}

	function severityName(value) {
		if (value === 0 || value === 'error') return 'error';
		if (value === 1 || value === 'warning') return 'warning';
		if (value === 2 || value === 'information' || value === 'info') return 'info';
		if (value === 3 || value === 'hint') return 'hint';
		return 'warning';
	}

	const SEVERITY_ORDER = Object.freeze({ error: 0, warning: 1, info: 2, hint: 3 });

	function diagnosticKey(entry) {
		const start = entry.range.start;
		const end = entry.range.end || start;
		return [start.line, start.character, end.line, end.character, entry.severity, entry.code, entry.message].join('\u0000');
	}

	function compareDiagnostics(first, second) {
		return SEVERITY_ORDER[first.severity] - SEVERITY_ORDER[second.severity] || first.range.start.line - second.range.start.line || first.range.start.character - second.range.start.character;
	}

	function rebuildDiagnostics() {
		diagnosticsByPath.clear();
		const seenByPath = new Map();
		diagnosticCollections.forEach((collection, key) => {
			const extensionId = key.slice(0, key.indexOf(':'));
			const collectionName = key.slice(key.indexOf(':') + 1);
			collection.forEach((list, path) => {
				const target = diagnosticsByPath.get(path) || [];
				let seen = seenByPath.get(path);
				if (!seen) {
					seen = new Set();
					seenByPath.set(path, seen);
				}
				list.forEach((raw) => {
					const entry = { raw, extensionId, collectionName, range: raw.range, message: String(raw.message || ''), severity: severityName(raw.severity), code: raw.code && typeof raw.code === 'object' ? String(raw.code.value) : raw.code !== undefined && raw.code !== null ? String(raw.code) : '', source: typeof raw.source === 'string' ? raw.source : '' };
					const id = diagnosticKey(entry);
					if (seen.has(id)) return;
					seen.add(id);
					target.push(entry);
				});
				diagnosticsByPath.set(path, target);
			});
		});
		diagnosticsByPath.forEach((target) => target.sort(compareDiagnostics));
		root.dispatchEvent(new CustomEvent('synapse:extension-diagnostics'));
	}

	function diagnosticsFor(path, normalizedText) {
		const list = diagnosticsByPath.get(path);
		if (!list || !list.length || typeof normalizedText !== 'string') return [];
		const starts = lineStarts(normalizedText);
		return list.slice(0, MAX_DIAGNOSTICS_PER_FILE).map((entry) => {
			const start = offsetAt(normalizedText, starts, entry.range.start);
			const end = Math.max(start, offsetAt(normalizedText, starts, entry.range.end || entry.range.start));
			const position = positionAt(normalizedText, starts, start);
			const item = registry() ? registry().get(entry.extensionId) : null;
			return {
				path,
				start,
				length: Math.max(1, end - start),
				line: position.line + 1,
				column: position.character + 1,
				severity: entry.severity === 'error' ? 'error' : 'warning',
				code: entry.code || entry.source || (item ? item.name : entry.extensionId),
				message: entry.source && entry.code ? `${entry.message} (${entry.source})` : entry.message,
				source: 'ext:' + entry.extensionId,
			};
		});
	}

	function sanitizeDiagnostics(list) {
		return (Array.isArray(list) ? list : [])
			.filter((raw) => raw && typeof raw === 'object' && raw.range && raw.range.start && typeof raw.message === 'string')
			.slice(0, MAX_DIAGNOSTICS_PER_FILE)
			.map((raw) => ({ range: { start: { line: Number(raw.range.start.line) || 0, character: Number(raw.range.start.character) || 0 }, end: { line: Number((raw.range.end || raw.range.start).line) || 0, character: Number((raw.range.end || raw.range.start).character) || 0 } }, message: raw.message.slice(0, 1000), severity: raw.severity, code: raw.code, source: typeof raw.source === 'string' ? raw.source.slice(0, 60) : undefined }));
	}

	const handlers = {
		'languages.registerProvider': (params, context) => {
			const kind = String(params.kind || '');
			if (!PROVIDER_KINDS.has(kind)) throw fail('INVALID_PARAMS', `Tipo de provider desconhecido "${kind}".`);
			const selectors = normalizeSelector(params.selector);
			if (!selectors.length) throw fail('INVALID_PARAMS', 'DocumentSelector inválido: informe um id de linguagem ou { language, pattern }.');
			const handle = String(params.handle || 'p' + ++providerSequence);
			providers.set(handle, { handle, kind, extensionId: context.descriptor.id, selectors, triggers: (Array.isArray(params.triggers) ? params.triggers : []).map(String).filter((char) => char.length === 1).slice(0, 16), hasResolve: !!params.hasResolve });
			ensureCompletionProvider();
			return { handle };
		},
		'languages.unregisterProvider': (params, context) => {
			const provider = providers.get(String(params.handle || ''));
			if (provider && provider.extensionId === context.descriptor.id) providers.delete(provider.handle);
			return null;
		},
		'languages.setConfiguration': (params, context) => {
			const languageId = normalizeLanguageId(params.languageId);
			if (!languageId) throw fail('INVALID_PARAMS', 'languageId obrigatório.');
			const record = recordFor(context.descriptor.id);
			if (params.configuration === null) record.apiConfigurations.delete(languageId);
			else {
				const configuration = sanitizeConfiguration(params.configuration);
				if (!configuration) throw fail('INVALID_PARAMS', 'LanguageConfiguration inválida.');
				record.apiConfigurations.set(languageId, configuration);
			}
			return null;
		},
		'languages.diagnostics.set': (params, context) => {
			const key = context.descriptor.id + ':' + String(params.collection || 'default');
			let collection = diagnosticCollections.get(key);
			if (!collection) {
				collection = new Map();
				diagnosticCollections.set(key, collection);
			}
			const host = workspaceHost();
			const entries = Array.isArray(params.entries) ? params.entries : [{ uri: params.uri, diagnostics: params.diagnostics }];
			entries.forEach((entry) => {
				if (!entry || !entry.uri) return;
				const path = host ? host.relativeOf(String(entry.uri)) : String(entry.uri).replace(/^synapse:\/projeto\//, '');
				const list = sanitizeDiagnostics(entry.diagnostics);
				if (list.length) collection.set(path, list);
				else collection.delete(path);
			});
			rebuildDiagnostics();
			return null;
		},
		'languages.diagnostics.clear': (params, context) => {
			const key = context.descriptor.id + ':' + String(params.collection || 'default');
			const collection = diagnosticCollections.get(key);
			if (collection) collection.clear();
			rebuildDiagnostics();
			return null;
		},
		'languages.diagnostics.dispose': (params, context) => {
			diagnosticCollections.delete(context.descriptor.id + ':' + String(params.collection || 'default'));
			rebuildDiagnostics();
			return null;
		},
		'languages.list': () => (languages() ? languages().list() : []),
	};

	function registerPalette() {
		if (paletteRegistered || !registry() || typeof registry().registerPaletteCommand !== 'function') return;
		paletteRegistered = true;
		const activeHas = (kind) => {
			const active = activeDocument();
			return !!active && hasProviders(kind, active.languageId, active.path);
		};
		registry().registerPaletteCommand(() => ({ id: 'ext-lang-hover', label: 'Extensões: Mostrar informações no cursor', hint: 'extensão hover · Ctrl+K Ctrl+I', icon: 'info', on: activeHas('hover'), run: () => hoverAtCaret() }));
		registry().registerPaletteCommand(() => ({ id: 'ext-lang-definition', label: 'Extensões: Ir para definição', hint: 'extensão definição · F12', icon: 'goto', on: activeHas('definition'), run: () => goToDefinition() }));
		registry().registerPaletteCommand(() => ({ id: 'ext-lang-format', label: 'Extensões: Formatar documento com extensão', hint: 'extensão formatador', icon: 'format', on: activeHas('formatting'), run: () => formatWithExtensions() }));
		registry().registerPaletteCommand(() => ({ id: 'ext-lang-actions', label: 'Extensões: Ações de código', hint: 'extensão ações · Ctrl+.', icon: 'lightbulb', on: activeHas('codeAction'), run: () => showCodeActions() }));
		registry().registerPaletteCommand(() => ({ id: 'ext-lang-symbols', label: 'Extensões: Ir para símbolo no arquivo', hint: 'extensão símbolos · Ctrl+Shift+O', icon: 'symbol', on: activeHas('documentSymbol'), run: () => showDocumentSymbols() }));
	}

	function isScriptHandledByCore(path) {
		const intelligence = root.SynapseIntelligence;
		return !!(intelligence && intelligence.projectModel && intelligence.projectModel.isSupported(path));
	}

	function onKeyDown(event) {
		const ui = elements();
		if (!ui || event.defaultPrevented || event.isComposing || event.keyCode === 229) return;
		if (event.key === 'Escape' && hoverWidget && !hoverWidget.hidden) {
			hideHover();
			return;
		}
		if (event.target !== ui.codeTa) return;
		const active = activeDocument();
		if (!active) return;
		const plain = !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
		const control = (event.ctrlKey || event.metaKey) && !event.altKey;
		if (event.key === 'F12' && plain && !isScriptHandledByCore(active.path) && hasProviders('definition', active.languageId, active.path)) {
			event.preventDefault();
			event.stopImmediatePropagation();
			goToDefinition();
			return;
		}
		if (control && !event.shiftKey && event.key === '.' && hasProviders('codeAction', active.languageId, active.path)) {
			event.preventDefault();
			event.stopImmediatePropagation();
			showCodeActions();
			return;
		}
		if (control && event.shiftKey && event.key.toLowerCase() === 'o' && hasProviders('documentSymbol', active.languageId, active.path)) {
			event.preventDefault();
			event.stopImmediatePropagation();
			showDocumentSymbols();
			return;
		}
		if (control && !event.shiftKey && event.key.toLowerCase() === 'k') {
			chordPending = Date.now();
			return;
		}
		if (control && !event.shiftKey && event.key.toLowerCase() === 'i' && chordPending && Date.now() - chordPending < 1500 && hasProviders('hover', active.languageId, active.path)) {
			chordPending = 0;
			event.preventDefault();
			event.stopImmediatePropagation();
			hoverAtCaret();
			return;
		}
		if (!control) chordPending = 0;
		if (hoverWidget && !hoverWidget.hidden && !control) hideHover();
	}

	let chordPending = 0;

	function onEditorClick(event) {
		const ui = elements();
		if (!ui || event.target !== ui.codeTa) return;
		if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
		const active = activeDocument();
		if (!active || isScriptHandledByCore(active.path) || !hasProviders('definition', active.languageId, active.path)) return;
		event.preventDefault();
		event.stopImmediatePropagation();
		goToDefinition();
	}

	function onFormatClick(event) {
		const active = activeDocument();
		if (!active || !hasProviders('formatting', active.languageId, active.path)) return;
		event.preventDefault();
		event.stopImmediatePropagation();
		formatWithExtensions();
	}

	function bind() {
		if (bound) return;
		const ui = elements();
		if (!ui) return;
		bound = true;
		document.addEventListener('keydown', onKeyDown, true);
		ui.codeTa.addEventListener('click', onEditorClick, true);
		ui.codeTa.addEventListener('mousemove', onEditorMouseMove, { passive: true });
		ui.codeTa.addEventListener('mouseleave', () => {
			clearTimeout(hoverTimer);
			hoverTimer = 0;
		});
		ui.codeTa.addEventListener('input', hideHover);
		ui.codeTa.addEventListener('scroll', hideHover, { passive: true });
		ui.editorScroll.addEventListener('scroll', hideHover, { passive: true });
		ui.codeTa.addEventListener('blur', () => setTimeout(() => {
			if (document.activeElement !== ui.codeTa) hideHover();
		}, 0));
		if (ui.fmtBtn) ui.fmtBtn.addEventListener('click', onFormatClick, true);
		root.addEventListener('synapse:editor-painted', hideHover);
		ensureCompletionProvider();
		registerPalette();
		setTimeout(registerPalette, 0);
	}

	root.SynapseExtensionLanguages = Object.freeze({
		handlers,
		register,
		unregister,
		disposeAll,
		configurationFor,
		commentsFor,
		foldingFor,
		editingFor,
		snippetsFor,
		diagnosticsFor,
		hasProviders,
		hoverAtCaret,
		goToDefinition,
		formatWithExtensions,
		showCodeActions,
		showDocumentSymbols,
		providers() {
			return [...providers.values()].map((provider) => ({ handle: provider.handle, kind: provider.kind, extensionId: provider.extensionId, selectors: provider.selectors.map((selector) => ({ language: selector.language, pattern: selector.patternSource })) }));
		},
	});

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
	else bind();
})(window);
