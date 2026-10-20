(function () {
	'use strict';

	const catalog = window.SynapseEditorLanguages;
	const ranking = window.SynapseCompletionRanking;
	const inactiveTokenTypes = new Set(['string', 'comment', 'regex']);
	const wordCharacters = /[$_\u200c\u200d\p{ID_Continue}]/u;
	const markupWordCharacters = /[\w:.$-]/;
	const cssWordCharacters = /[\w$-]/;
	const voidTags = new Set(
		'area base br col embed hr img input link meta param source track wbr'.split(' '),
	);
	const booleanAttributes = new Set(
		'async autofocus autoplay checked controls default defer disabled formnovalidate hidden inert ismap itemscope loop multiple muted nomodule novalidate open playsinline readonly required reversed selected'.split(
			' ',
		),
	);
	const extraTags =
		'a abbr address area article aside audio b base bdi bdo blockquote body br button canvas caption circle cite code col colgroup data datalist dd defs del details dfn dialog div dl dt ellipse em embed fieldset figcaption figure footer form g h1 h2 h3 h4 h5 h6 head header hgroup hr html i iframe img input ins kbd label legend li line linearGradient link main map mark menu meta meter nav noscript object ol optgroup option output p param path picture polygon polyline pre progress q radialGradient rect rp rt ruby s samp script search section select slot small source span stop strong style sub summary sup svg table tbody td template text textarea tfoot th thead time title tr track tspan u ul use var video wbr'.split(
			' ',
		);
	const extraAttributes =
		'accept accesskey action allow charset cite cols colspan contenteditable coords crossorigin datetime decoding defer dir download draggable enctype enterkeyhint form headers high href hreflang inert inputmode integrity kind label list low minlength playsinline poster preload referrerpolicy rowspan sandbox scope shape size sizes slot span spellcheck srcdoc srclang start translate usemap wrap'.split(
			' ',
		);
	const tagCatalog = Object.freeze([...new Set([...(catalog.htmlTags || []), ...extraTags])]);
	const attributeCatalog = Object.freeze([
		...new Set([...(catalog.htmlAttributes || []), ...extraAttributes]),
	]);

	function openTagStack(source, limit) {
		const pattern = /<(\/?)([A-Za-z][\w:.-]*)((?:"[^"]*"|'[^']*'|[^<>])*)>/g;
		const before = source.slice(0, limit);
		const stack = [];
		let found = pattern.exec(before);
		while (found) {
			const name = found[2];
			const lower = name.toLowerCase();
			if (found[1]) {
				const index = stack.map((entry) => entry.toLowerCase()).lastIndexOf(lower);
				if (index >= 0) stack.splice(index);
			} else if (!voidTags.has(lower) && !/\/\s*$/.test(found[3])) stack.push(name);
			found = pattern.exec(before);
		}
		return stack.reverse();
	}

	function getCompletions({ source = '', path = '', position = 0, explicit = false } = {}) {
		if (typeof source !== 'string' || catalog.isLarge(source)) return null;
		if (!Number.isInteger(position) || position < 0 || position > source.length) return null;
		const fileLanguage = catalog.fromPath(path);
		if (fileLanguage === 'text') return null;
		const tokens = window.SynapseSyntaxTokenizer.tokenize(source, fileLanguage);
		let language = fileLanguage;
		for (const token of tokens) {
			if (token.start >= position && !(token.type === 'context' && token.start === position)) break;
			language = token.language;
			const isJsonKey = token.type === 'attribute' && /^(?:json|jsonc)$/.test(token.language);
			if (
				(inactiveTokenTypes.has(token.type) || isJsonKey) &&
				(position < token.end || (position === token.end && !token.closed))
			)
				return null;
		}
		if (language === 'text') return null;
		const markupLanguage = language === 'html' || language === 'css';
		const wordPattern =
			language === 'css'
				? cssWordCharacters
				: language === 'html'
					? markupWordCharacters
					: wordCharacters;
		let start = position;
		let end = position;
		while (start > 0 && wordPattern.test(source[start - 1])) start--;
		while (end < source.length && wordPattern.test(source[end])) end++;
		const currentWord = source.slice(start, end);
		let replaceStart = start;
		let prefix = source.slice(start, position);
		let normalizedPrefix = markupLanguage ? prefix.toLowerCase() : prefix;
		const precedingText = source.slice(0, start);
		const candidates = new Map();

		function add(label, kind, priority = 2, extra = null) {
			if (typeof label !== 'string' || !label || label.length > 160) return;
			const comparison = markupLanguage ? label.toLowerCase() : label;
			if (!extra?.allowExact && label === currentWord) return;
			if (ranking.match(normalizedPrefix, comparison) === null) return;
			const existing = candidates.get(label);
			if (existing && existing.priority <= priority) return;
			const item = { label, insertText: extra?.insertText ?? label, kind, priority };
			if (Number.isInteger(extra?.caretOffset)) item.caretOffset = extra.caretOffset;
			candidates.set(label, item);
		}

		function addWords(words, kind, priority = 2) {
			for (const word of typeof words === 'string' ? words.split(' ') : words)
				add(word, kind, priority);
		}

		function documentWords(allowMember = false) {
			let visited = 0;
			for (const token of tokens) {
				if (++visited > 40000) break;
				if (token.start <= position && token.end >= position) continue;
				if (
					token.language !== language ||
					!['identifier', 'function', 'attribute'].includes(token.type)
				)
					continue;
				const value = source.slice(token.start, token.end);
				if (language === 'css' && !value.startsWith('--')) continue;
				if (!allowMember && /\.\s*$/.test(source.slice(Math.max(0, token.start - 8), token.start)))
					continue;
				add(value, 'local', 1);
			}
		}

		function tagSnippet(name, followedByClose) {
			if (followedByClose) return { insertText: `<${name}`, allowExact: true };
			if (voidTags.has(name.toLowerCase()))
				return { insertText: `<${name}>`, allowExact: true };
			return {
				insertText: `<${name}></${name}>`,
				caretOffset: name.length + 2,
				allowExact: true,
			};
		}

		function addTags(followedByClose) {
			for (const name of tagCatalog) add(name, 'tag', 2, tagSnippet(name, followedByClose));
			for (const token of tokens)
				if (token.type === 'tag') {
					const name = source.slice(token.start, token.end);
					if (/^[A-Za-z][\w:.-]*$/.test(name)) add(name, 'tag', 1, tagSnippet(name, followedByClose));
				}
		}

		function addAttributes(priority = 2) {
			for (const name of attributeCatalog) {
				if (booleanAttributes.has(name) || name.endsWith('-'))
					add(name, 'attribute', priority);
				else
					add(name, 'attribute', priority, {
						insertText: `${name}=""`,
						caretOffset: name.length + 2,
					});
			}
		}

		let trigger = '';
		if (language === 'html') {
			const before = source.slice(0, position);
			const insideTag = before.lastIndexOf('<') > before.lastIndexOf('>');
			const openIndex = before.lastIndexOf('<');
			const inside = insideTag ? before.slice(openIndex) : '';
			const tagName = insideTag ? /^<(\/?)([A-Za-z][\w:.-]*)?$/.exec(inside) : null;
			const followedByClose = /^[^<>]*>/.test(source.slice(end));
			if (tagName) {
				trigger = '<';
				replaceStart = openIndex;
				prefix = tagName[2] || '';
				normalizedPrefix = prefix.toLowerCase();
				if (tagName[1]) {
					let priority = 0;
					for (const name of openTagStack(source, openIndex)) {
						add(name, 'tag', Math.min(priority, 2), {
							allowExact: true,
							insertText: followedByClose ? `</${name}` : `</${name}>`,
						});
						priority++;
					}
				} else addTags(followedByClose);
			} else if (insideTag && /^<[A-Za-z][\w:.-]*[\s\S]*$/.test(inside)) {
				if (/[\w:-]+\s*=\s*[^\s<>]*$/.test(before)) return null;
				addAttributes();
				if (fileLanguage === 'jsx' || fileLanguage === 'tsx')
					addWords('className htmlFor onClick onChange onSubmit onInput key ref', 'attribute', 1);
			} else if (!insideTag && (explicit || /^[A-Za-z][\w-]*$/.test(prefix))) {
				addTags(false);
			} else return null;
		} else if (language === 'css') {
			const contextText = tokens
				.filter((token) => token.start < start && token.language === 'css')
				.map((token) =>
					inactiveTokenTypes.has(token.type)
						? ' '.repeat(Math.min(token.end, start) - token.start)
						: source.slice(token.start, Math.min(token.end, start)),
				)
				.join('');
			const delimiter = Math.max(
				contextText.lastIndexOf('{'),
				contextText.lastIndexOf('}'),
				contextText.lastIndexOf(';'),
			);
			const declaration = contextText.slice(delimiter + 1);
			const property = /([-\w]+)\s*:[^:;{}]*$/.exec(declaration);
			if (property && contextText.lastIndexOf('{') > contextText.lastIndexOf('}')) {
				trigger = ':';
				addWords(catalog.cssValues[property[1]] || '', 'value', 1);
				addWords('inherit initial unset revert var calc min max clamp auto none', 'value');
				documentWords();
			} else if (
				contextText.lastIndexOf('{') > contextText.lastIndexOf('}') ||
				prefix.startsWith('--')
			) {
				const followedByColon = /^\s*:/.test(source.slice(end));
				for (const name of catalog.cssProperties)
					add(
						name,
						'property',
						2,
						followedByColon || name.startsWith('--') ? null : { insertText: `${name}: ` },
					);
				documentWords();
			} else return null;
		} else if (language === 'json' || language === 'jsonc') {
			addWords(catalog.keywords.json, 'value');
		} else {
			const member = /([$_\p{ID_Start}][$_\p{ID_Continue}]*)\s*(?:\?\.|\.)\s*$/u.exec(
				precedingText,
			);
			if (member) {
				trigger = '.';
				addWords(catalog.javascriptMembers[member[1]] || '', 'member', 1);
				for (let index = 2; index < tokens.length; index++) {
					const token = tokens[index];
					if (!['identifier', 'function'].includes(token.type)) continue;
					const beforeToken = source.slice(
						Math.max(0, token.start - member[1].length - 8),
						token.start,
					);
					if (beforeToken.trimEnd().endsWith(`${member[1]}.`))
						add(source.slice(token.start, token.end), 'member', 1);
				}
			} else {
				addWords(catalog.keywords[language.startsWith('ts') ? 'ts' : 'js'], 'keyword');
				addWords(catalog.javascriptGlobals, 'global');
				documentWords();
			}
		}

		if (!explicit && !prefix.length && !trigger) return null;
		const items = ranking.sort([...candidates.values()], normalizedPrefix).slice(0, 40);
		return items.length
			? { start: replaceStart, end, position, prefix, language, items }
			: null;
	}

	window.SynapseCompletionProvider = Object.freeze({ getCompletions });
})();
