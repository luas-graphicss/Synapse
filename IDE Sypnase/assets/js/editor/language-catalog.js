(function () {
	'use strict';

	const javascriptKeywords =
		'as async await break case catch class const continue debugger default delete do else export extends false finally for from function get if import in instanceof let new null of return set static super switch this throw true try typeof undefined var void while with yield';
	const typescriptKeywords =
		'abstract any asserts bigint boolean constructor declare enum global implements infer interface is keyof module namespace never number object override private protected public readonly require satisfies string symbol type unique unknown';
	const grammarCatalog = window.SynapseLanguageGrammars;
	const builtinAliases = {
		javascript: 'js',
		mjs: 'js',
		cjs: 'js',
		jsx: 'jsx',
		typescript: 'ts',
		mts: 'ts',
		cts: 'ts',
		tsx: 'tsx',
		htm: 'html',
		xml: 'html',
		svg: 'html',
		vue: 'html',
		svelte: 'html',
		scss: 'css',
		less: 'css',
		webmanifest: 'json',
		jsonc: 'jsonc',
	};
	const builtinLanguages = ['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json', 'jsonc'];
	const LANGUAGE_ID = /^[a-z][a-z0-9_+.#-]{0,39}$/;

	const aliases = new Map(Object.entries(builtinAliases));
	const filenames = new Map();
	const supportedLanguages = new Set(builtinLanguages);
	const contributed = new Map();
	const listeners = new Set();
	let version = 0;

	function syncGrammarAliases() {
		if (!grammarCatalog) return;
		Object.entries(grammarCatalog.extensionAliases).forEach(([key, language]) => {
			if (!aliases.has(key) || aliases.get(key) === language) aliases.set(key, language);
		});
		grammarCatalog.languages.forEach((language) => supportedLanguages.add(language));
	}

	function notify(change) {
		version += 1;
		listeners.forEach((listener) => {
			try {
				listener(change);
			} catch (error) {
				if (typeof window.ignorarErro === 'function') window.ignorarErro(error, 'editorLanguages.listener');
			}
		});
	}

	function grammar(language) {
		if (!grammarCatalog) return null;
		return grammarCatalog.get(normalize(language));
	}

	const keywords = Object.freeze({
		js: Object.freeze(javascriptKeywords.split(' ')),
		ts: Object.freeze(`${javascriptKeywords} ${typescriptKeywords}`.split(' ')),
		json: Object.freeze(['true', 'false', 'null']),
	});
	const htmlTags = Object.freeze(
		'a article aside audio body br button canvas code details dialog div em fieldset figure footer form h1 h2 h3 head header hr html iframe img input label li link main meta nav ol option p picture pre progress script section select small source span strong style summary table tbody td template textarea th thead title tr ul video'.split(
			' ',
		),
	);
	const htmlAttributes = Object.freeze(
		'alt aria-label aria-labelledby aria-describedby aria-expanded aria-hidden aria-live aria-pressed autocomplete autofocus checked class content controls data- disabled for height hidden href id lang loading max maxlength method min multiple name pattern placeholder readonly rel required role rows selected src srcset step style tabindex target title type value width'.split(
			' ',
		),
	);
	const cssProperties = Object.freeze(
		'align-content align-items align-self animation animation-delay animation-duration animation-name appearance aspect-ratio backdrop-filter background background-color background-image background-position background-size border border-color border-radius border-style border-width bottom box-shadow box-sizing color column-gap content cursor display fill filter flex flex-basis flex-direction flex-grow flex-shrink flex-wrap font font-family font-size font-style font-weight gap grid grid-area grid-auto-flow grid-column grid-row grid-template-columns grid-template-rows height inset isolation justify-content left letter-spacing line-height list-style margin margin-block margin-bottom margin-inline margin-left margin-right margin-top max-height max-width min-height min-width object-fit object-position opacity order outline outline-color outline-offset overflow overflow-x overflow-y padding padding-block padding-bottom padding-inline padding-left padding-right padding-top place-items pointer-events position resize right rotate row-gap scroll-behavior stroke text-align text-decoration text-overflow text-transform top touch-action transform transform-origin transition transition-duration transition-property translate user-select vertical-align visibility white-space width word-break z-index'.split(
			' ',
		),
	);
	const cssValues = Object.freeze({
		display: 'block inline inline-block flex inline-flex grid inline-grid none contents flow-root',
		position: 'relative absolute fixed sticky static',
		'align-items': 'center start end flex-start flex-end stretch baseline',
		'justify-content':
			'center start end flex-start flex-end space-between space-around space-evenly',
		'flex-direction': 'row column row-reverse column-reverse',
		'flex-wrap': 'wrap nowrap wrap-reverse',
		overflow: 'auto hidden visible scroll clip',
		'box-sizing': 'border-box content-box',
		'font-weight': 'normal bold bolder lighter',
		'text-align': 'left right center justify start end',
		'white-space': 'normal nowrap pre pre-wrap pre-line break-spaces',
		color: 'transparent currentColor black white red green blue rebeccapurple',
		'background-color': 'transparent currentColor black white',
		cursor: 'auto default pointer text move grab grabbing not-allowed crosshair',
		visibility: 'visible hidden collapse',
	});
	const javascriptGlobals = Object.freeze(
		'Array ArrayBuffer Boolean Date Error Event FormData Headers JSON Map Math Number Object Promise RegExp Request Response Set String Symbol URL URLSearchParams WeakMap WeakSet addEventListener cancelAnimationFrame clearInterval clearTimeout console document fetch globalThis localStorage navigator performance queueMicrotask removeEventListener requestAnimationFrame sessionStorage setInterval setTimeout structuredClone window'.split(
			' ',
		),
	);
	const javascriptMembers = Object.freeze({
		console:
			'assert clear count debug dir error group groupEnd info log table time timeEnd trace warn',
		document:
			'activeElement addEventListener body createDocumentFragment createElement createTextNode documentElement getElementById head querySelector querySelectorAll removeEventListener title',
		window:
			'addEventListener alert cancelAnimationFrame clearInterval clearTimeout document innerHeight innerWidth location matchMedia navigator open removeEventListener requestAnimationFrame setInterval setTimeout',
		Math: 'abs ceil cos floor hypot max min PI pow random round sign sin sqrt tan trunc',
		JSON: 'parse stringify',
		Object: 'assign create entries freeze fromEntries getOwnPropertyNames hasOwn is keys values',
		Array: 'from isArray of',
		Promise: 'all allSettled any race reject resolve',
		localStorage: 'clear getItem key length removeItem setItem',
		sessionStorage: 'clear getItem key length removeItem setItem',
		performance: 'mark measure now',
	});

	function normalize(language) {
		const name = String(language || '').toLowerCase();
		const normalized = aliases.get(name) || name;
		return supportedLanguages.has(normalized) ? normalized : 'text';
	}

	function fromPath(path) {
		const filename = String(path || '')
			.split(/[\\/]/)
			.pop()
			.toLowerCase();
		if (/^(?:tsconfig|jsconfig)(?:\.[\w-]+)?\.json$/.test(filename)) return 'jsonc';
		if (filenames.has(filename)) return normalize(filenames.get(filename));
		return normalize(
			filename.includes('.') ? filename.slice(filename.lastIndexOf('.') + 1) : filename,
		);
	}

	function isLarge(source) {
		if (source.length > 250000) return true;
		let lineCount = 1;
		for (
			let offset = source.indexOf('\n');
			offset >= 0;
			offset = source.indexOf('\n', offset + 1)
		) {
			if (++lineCount > 7000) return true;
		}
		return false;
	}

	function isBuiltin(language) {
		const id = String(language || '').toLowerCase();
		if (builtinLanguages.includes(id) || id === 'text') return true;
		const known = grammarCatalog ? grammarCatalog.get(id) : null;
		return !!known && known.owner === 'builtin';
	}

	function registerLanguage(definition, owner) {
		const id = String((definition && definition.id) || '').toLowerCase();
		if (!LANGUAGE_ID.test(id)) throw new Error(`id de linguagem inválido "${id}".`);
		if (isBuiltin(id) && !contributed.has(id)) throw new Error(`A linguagem "${id}" é nativa e não pode ser redefinida.`);
		if (contributed.has(id)) unregisterLanguage(id);
		const record = { id, owner: owner || 'api', aliases: [], filenames: [], extensions: [] };
		const addAlias = (key) => {
			const alias = String(key || '').toLowerCase().replace(/^\./, '');
			if (!alias || (aliases.has(alias) && aliases.get(alias) !== id && isBuiltin(aliases.get(alias)))) return;
			aliases.set(alias, id);
			record.aliases.push(alias);
		};
		supportedLanguages.add(id);
		addAlias(id);
		(Array.isArray(definition.extensions) ? definition.extensions : []).forEach((extension) => {
			addAlias(extension);
			record.extensions.push(String(extension).replace(/^\./, '').toLowerCase());
		});
		(Array.isArray(definition.aliases) ? definition.aliases : []).forEach(addAlias);
		(Array.isArray(definition.filenames) ? definition.filenames : []).forEach((name) => {
			const filename = String(name || '').toLowerCase();
			if (!filename) return;
			filenames.set(filename, id);
			record.filenames.push(filename);
		});
		record.label = definition.aliases && definition.aliases.length ? String(definition.aliases[0]) : id;
		contributed.set(id, record);
		notify({ type: 'language', id, owner: record.owner });
		return Object.freeze({
			id,
			dispose() {
				unregisterLanguage(id);
			},
		});
	}

	function unregisterLanguage(id) {
		const record = contributed.get(String(id || '').toLowerCase());
		if (!record) return false;
		record.aliases.forEach((alias) => {
			if (aliases.get(alias) === record.id) aliases.delete(alias);
		});
		record.filenames.forEach((filename) => {
			if (filenames.get(filename) === record.id) filenames.delete(filename);
		});
		contributed.delete(record.id);
		if (!(grammarCatalog && grammarCatalog.has(record.id))) supportedLanguages.delete(record.id);
		notify({ type: 'language', id: record.id, owner: record.owner, removed: true });
		return true;
	}

	function unregisterOwner(owner) {
		let removed = 0;
		[...contributed.values()].forEach((record) => {
			if (record.owner === owner && unregisterLanguage(record.id)) removed += 1;
		});
		return removed;
	}

	function onDidChange(listener) {
		if (typeof listener !== 'function') return () => {};
		listeners.add(listener);
		return () => listeners.delete(listener);
	}

	function list() {
		return [...supportedLanguages].map((id) => {
			const record = contributed.get(id);
			return { id, builtin: !record, owner: record ? record.owner : 'builtin', label: record ? record.label : id, extensions: record ? [...record.extensions] : [] };
		});
	}

	syncGrammarAliases();
	if (grammarCatalog) {
		grammarCatalog.onDidChange((change) => {
			if (change && change.removed) {
				if (!contributed.has(change.language)) {
					supportedLanguages.delete(change.language);
					[...aliases.entries()].forEach(([key, value]) => {
						if (value === change.language && !builtinAliases[key]) aliases.delete(key);
					});
				}
			} else syncGrammarAliases();
			notify({ type: 'grammar', id: change ? change.language : null });
		});
	}

	window.SynapseEditorLanguages = Object.freeze({
		normalize,
		fromPath,
		isLarge,
		grammar,
		isBuiltin,
		registerLanguage,
		unregisterLanguage,
		unregisterOwner,
		onDidChange,
		list,
		get version() {
			return version;
		},
		keywords,
		htmlTags,
		htmlAttributes,
		cssProperties,
		cssValues,
		javascriptGlobals,
		javascriptMembers,
	});
})();
