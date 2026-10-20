(function () {
	'use strict';

	const languages = window.SynapseEditorLanguages;
	const keywordSets = {
		js: new Set(languages.keywords.js),
		ts: new Set(languages.keywords.ts),
		json: new Set(languages.keywords.json),
	};
	const scriptNumber =
		/(?:0[xX][\da-fA-F][\da-fA-F_]*n?|0[bB][01][01_]*n?|0[oO][0-7][0-7_]*n?|\d[\d_]*(?:\.[\d_]*)?(?:[eE][+-]?\d[\d_]*)?n?|\.\d[\d_]*(?:[eE][+-]?\d[\d_]*)?)/y;
	const jsonNumber = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
	const generalNumber =
		/(?:0[xX][\da-fA-F][\da-fA-F_]*|0[bB][01][01_]*|0[oO][0-7][0-7_]*|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?)[a-zA-Z_]*/y;
	const identifier = /[$_\p{ID_Start}][$_\u200c\u200d\p{ID_Continue}]*/uy;
	const cssIdentifier = /-?[-_a-zA-Z][\w-]*/y;
	const cssNumber = /(?:#[\da-fA-F]{3,8}\b|[+-]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][+-]?\d+)?(?:%|[a-zA-Z]+)?)/y;
	const rustRawString = /b?r(#*)"/y;
	const cppRawString = /(?:u8|[LuU])?R"([^\s()\\]{0,16})\(/y;
	const csharpVerbatimString = /@\$?"|\$@"/y;
	const luaLongBracket = /\[(=*)\[/y;
	const characterLiteral =
		/'(?:\\(?:u\{[\da-fA-F]+\}|u[\da-fA-F]{4}|U[\da-fA-F]{8}|x[\da-fA-F]+|[0-7]{1,3}|[^\n])|[^'\\\n]){1,4}'/y;
	const generalRegexPredecessors = '=~(,[!?:;{|&';
	const phpOpenTag = /<\?(?:php\b|=|(?=\s))/y;
	const markupLanguages = new Set(['js', 'jsx', 'tsx']);
	const scriptLanguages = new Set(['js', 'jsx', 'ts', 'tsx']);
	const scriptOperator =
		/(?:>>>=|\.\.\.|===|!==|\*\*=|<<=|>>=|>>>|&&=|\|\|=|\?\?=|=>|<=|>=|==|!=|&&|\|\||\?\?|\?\.(?!\d)|\+\+|--|\+=|-=|\*=|\/=|%=|&=|\|=|\^=|<<|>>|\*\*)/y;
	const statementKeywords = new Set(['if', 'while', 'for', 'with']);
	const markupBlockers = new Set([
		'literal',
		'identifier',
		')',
		']',
		'++',
		'--',
		'<',
		'>',
		'<<',
		'>>',
		'>>>',
		'<=',
		'>=',
		'this',
		'super',
		'true',
		'false',
		'null',
		'undefined',
	]);
	const patternLineBudgetMs = 4;
	const patternMaxLineLength = 20000;
	const regexPredecessors = new Set([
		'',
		'=',
		'(',
		'[',
		'{',
		'}',
		',',
		':',
		';',
		'!',
		'?',
		'&',
		'|',
		'+',
		'-',
		'*',
		'%',
		'<',
		'>',
		'^',
		'~',
		'return',
		'throw',
		'case',
		'yield',
		'await',
		'typeof',
		'void',
		'delete',
		'in',
		'of',
		'instanceof',
		'else',
		'do',
		'new',
		'=>',
		')stmt',
		'&&',
		'||',
		'??',
		'==',
		'===',
		'!=',
		'!==',
		'<=',
		'>=',
		'<<',
		'>>',
		'>>>',
		'+=',
		'-=',
		'*=',
		'/=',
		'%=',
		'**',
		'**=',
		'&=',
		'|=',
		'^=',
		'<<=',
		'>>=',
		'>>>=',
		'&&=',
		'||=',
		'??=',
		'...',
	]);

	function tokenize(input, requestedLanguage) {
		const source = String(input ?? '');
		const language = languages.normalize(requestedLanguage);
		if (language === 'text' || languages.isLarge(source)) {
			return [{ type: 'text', start: 0, end: source.length, language: 'text', closed: true }];
		}
		const tokens = [];

		function emit(type, start, end, tokenLanguage, closed = true) {
			if (end < start) return;
			const previous = tokens[tokens.length - 1];
			if (
				type === 'text' &&
				end > start &&
				previous?.type === type &&
				previous.language === tokenLanguage &&
				previous.end === start
			) {
				previous.end = end;
				return;
			}
			tokens.push({ type, start, end, language: tokenLanguage, closed });
		}

		function matchAt(expression, offset, end) {
			expression.lastIndex = offset;
			const match = expression.exec(source);
			return match && expression.lastIndex <= end ? match : null;
		}

		function matchTextAt(expression, offset, end) {
			return matchAt(expression, offset, end)?.[0] || '';
		}

		function readQuoted(start, end, tokenLanguage, allowEscapes = true, multiline = false) {
			const quote = source[start];
			let cursor = start + 1;
			let closed = false;
			while (cursor < end) {
				const character = source[cursor];
				if (allowEscapes && character === '\\') {
					cursor = Math.min(end, cursor + 2);
					continue;
				}
				if (character === quote) {
					cursor++;
					closed = true;
					break;
				}
				if (!multiline && character === '\n') break;
				cursor++;
			}
			emit('string', start, cursor, tokenLanguage, closed);
			return cursor;
		}

		function readDelimited(start, end, tokenLanguage, type, openingLength, terminator) {
			const closingOffset = source.indexOf(terminator, start + openingLength);
			const closed = closingOffset >= 0 && closingOffset + terminator.length <= end;
			const nextOffset = closed ? closingOffset + terminator.length : end;
			emit(type, start, nextOffset, tokenLanguage, closed);
			return nextOffset;
		}

		function readComment(start, end, tokenLanguage, terminator) {
			const closingOffset = source.indexOf(terminator, start + 2);
			const closed = closingOffset >= 0 && closingOffset < end;
			const nextOffset = closed ? Math.min(end, closingOffset + terminator.length) : end;
			emit('comment', start, nextOffset, tokenLanguage, closed);
			return nextOffset;
		}

		function readRegularExpression(start, end, tokenLanguage) {
			let cursor = start + 1;
			let characterClass = false;
			while (cursor < end && source[cursor] !== '\n') {
				if (source[cursor] === '\\') {
					cursor += 2;
					continue;
				}
				if (source[cursor] === '[') characterClass = true;
				if (source[cursor] === ']') characterClass = false;
				if (source[cursor] === '/' && !characterClass) {
					cursor++;
					while (cursor < end && /[a-z]/i.test(source[cursor])) cursor++;
					emit('regex', start, cursor, tokenLanguage);
					return cursor;
				}
				cursor++;
			}
			return start;
		}

		function readTemplate(start, end, tokenLanguage, depth) {
			let cursor = start + 1;
			let segmentStart = start;
			while (cursor < end) {
				if (source[cursor] === '\\') {
					cursor = Math.min(end, cursor + 2);
					continue;
				}
				if (source[cursor] === '`') {
					emit('string', segmentStart, cursor + 1, tokenLanguage);
					return cursor + 1;
				}
				if (source.startsWith('${', cursor)) {
					emit('string', segmentStart, cursor, tokenLanguage, false);
					emit('punctuation', cursor, cursor + 2, tokenLanguage);
					cursor = scanScript(cursor + 2, end, tokenLanguage, depth + 1, true);
					if (source[cursor] !== '}') return cursor;
					emit('punctuation', cursor, cursor + 1, tokenLanguage);
					segmentStart = ++cursor;
					continue;
				}
				cursor++;
			}
			emit('string', segmentStart, end, tokenLanguage, false);
			return end;
		}

		function scanScript(start, end, tokenLanguage, depth = 0, stopAtBrace = false) {
			if (depth > 16) {
				emit('text', start, end, tokenLanguage);
				return end;
			}
			let cursor = start;
			let braceDepth = 0;
			let previousValue = '';
			const parenthesisOpeners = [];
			const keywords = keywordSets[tokenLanguage.startsWith('ts') ? 'ts' : 'js'];
			while (cursor < end) {
				const character = source[cursor];
				if (stopAtBrace && character === '}' && braceDepth === 0) return cursor;
				if (/\s/.test(character)) {
					const whitespaceStart = cursor++;
					while (cursor < end && /\s/.test(source[cursor])) cursor++;
					emit('text', whitespaceStart, cursor, tokenLanguage);
					continue;
				}
				if (source.startsWith('//', cursor) || (cursor === 0 && source.startsWith('#!', cursor))) {
					cursor = readComment(cursor, end, tokenLanguage, '\n');
					continue;
				}
				if (source.startsWith('/*', cursor)) {
					cursor = readComment(cursor, end, tokenLanguage, '*/');
					continue;
				}
				if (character === '"' || character === "'") {
					cursor = readQuoted(cursor, end, tokenLanguage);
					previousValue = 'literal';
					continue;
				}
				if (character === '`') {
					cursor = readTemplate(cursor, end, tokenLanguage, depth);
					previousValue = 'literal';
					continue;
				}
				if (character === '/' && regexPredecessors.has(previousValue)) {
					const regexEnd = readRegularExpression(cursor, end, tokenLanguage);
					if (regexEnd > cursor) {
						cursor = regexEnd;
						previousValue = 'literal';
						continue;
					}
				}
				if (
					markupLanguages.has(tokenLanguage) &&
					character === '<' &&
					/[A-Za-z>]/.test(source[cursor + 1] || '') &&
					!markupBlockers.has(previousValue)
				) {
					cursor = scanMarkup(cursor, end, tokenLanguage, depth + 1, true);
					previousValue = 'literal';
					continue;
				}
				const numericValue = matchTextAt(scriptNumber, cursor, end);
				if (numericValue) {
					emit('number', cursor, cursor + numericValue.length, tokenLanguage);
					cursor += numericValue.length;
					previousValue = 'literal';
					continue;
				}
				const word = matchTextAt(identifier, cursor, end);
				if (word) {
					let nextOffset = cursor + word.length;
					while (nextOffset < end && /\s/.test(source[nextOffset])) nextOffset++;
					const type = keywords.has(word)
						? 'keyword'
						: source[nextOffset] === '('
							? 'function'
							: 'identifier';
					emit(type, cursor, cursor + word.length, tokenLanguage);
					cursor += word.length;
					previousValue = type === 'keyword' ? word : 'identifier';
					continue;
				}
				if (character === '{') braceDepth++;
				if (character === '}') braceDepth--;
				const operator = matchTextAt(scriptOperator, cursor, end) || character;
				emit('punctuation', cursor, cursor + operator.length, tokenLanguage);
				cursor += operator.length;
				if (operator === '(') parenthesisOpeners.push(previousValue);
				previousValue =
					operator === ')' && statementKeywords.has(parenthesisOpeners.pop()) ? ')stmt' : operator;
			}
			return cursor;
		}

		function scanJson(start, end, tokenLanguage) {
			let cursor = start;
			while (cursor < end) {
				if (tokenLanguage === 'jsonc' && source.startsWith('//', cursor)) {
					cursor = readComment(cursor, end, tokenLanguage, '\n');
				} else if (tokenLanguage === 'jsonc' && source.startsWith('/*', cursor)) {
					cursor = readComment(cursor, end, tokenLanguage, '*/');
				} else if (source[cursor] === '"') {
					cursor = readQuoted(cursor, end, tokenLanguage);
					let nextOffset = cursor;
					while (nextOffset < end && /\s/.test(source[nextOffset])) nextOffset++;
					if (source[nextOffset] === ':') tokens[tokens.length - 1].type = 'attribute';
				} else {
					const number = matchTextAt(jsonNumber, cursor, end);
					const word = number ? '' : matchTextAt(identifier, cursor, end);
					const length = (number || word).length || 1;
					const type = number
						? 'number'
						: keywordSets.json.has(word)
							? 'keyword'
							: /[{}\[\],:]/.test(source[cursor])
								? 'punctuation'
								: 'text';
					emit(type, cursor, cursor + length, tokenLanguage);
					cursor += length;
				}
			}
		}

		function readCssUrl(start, end, wordLength) {
			emit('function', start, start + wordLength, 'css');
			emit('punctuation', start + wordLength, start + wordLength + 1, 'css');
			let cursor = start + wordLength + 1;
			let valueStart = cursor;
			while (valueStart < end && /[^\S\n]/.test(source[valueStart])) valueStart++;
			if (valueStart >= end || /["')\n]/.test(source[valueStart])) return cursor;
			let valueEnd = valueStart;
			while (valueEnd < end && source[valueEnd] !== ')' && source[valueEnd] !== '\n') valueEnd++;
			if (valueStart > cursor) emit('text', cursor, valueStart, 'css');
			emit('string', valueStart, valueEnd, 'css');
			return valueEnd;
		}

		function scanCss(start, end) {
			const firstTokenIndex = tokens.length;
			let cursor = start;
			while (cursor < end) {
				if (source.startsWith('/*', cursor)) {
					cursor = readComment(cursor, end, 'css', '*/');
					continue;
				}
				if (source.startsWith('//', cursor)) {
					cursor = readLineComment(cursor, end, 'css', 2);
					continue;
				}
				if (source[cursor] === '"' || source[cursor] === "'") {
					cursor = readQuoted(cursor, end, 'css');
					continue;
				}
				const number = matchTextAt(cssNumber, cursor, end);
				const word = number ? '' : matchTextAt(cssIdentifier, cursor, end);
				if (word && /^(?:url|src)$/i.test(word) && source[cursor + word.length] === '(') {
					cursor = readCssUrl(cursor, end, word.length);
					continue;
				}
				if (number || word) {
					const length = (number || word).length;
					let nextOffset = cursor + length;
					while (nextOffset < end && /\s/.test(source[nextOffset])) nextOffset++;
					const type = number
						? 'number'
						: source[nextOffset] === ':'
							? 'attribute'
							: source[nextOffset] === '('
								? 'function'
								: 'identifier';
					emit(type, cursor, cursor + length, 'css');
					cursor += length;
				} else {
					emit(
						/[{}:;(),@.#]/.test(source[cursor]) ? 'punctuation' : 'text',
						cursor,
						cursor + 1,
						'css',
					);
					cursor++;
				}
			}
			highlightCssSelectors(firstTokenIndex);
		}

		function highlightCssSelectors(firstTokenIndex) {
			let segmentStart = firstTokenIndex;
			for (let index = firstTokenIndex; index < tokens.length; index++) {
				const token = tokens[index];
				if (token.type !== 'punctuation') continue;
				const punctuation = source.slice(token.start, token.end);
				if (punctuation === '{') {
					for (let selectorIndex = segmentStart; selectorIndex < index; selectorIndex++) {
						const selector = tokens[selectorIndex];
						if (
							['identifier', 'attribute'].includes(selector.type) ||
							(selector.type === 'number' && source[selector.start] === '#')
						)
							selector.type = 'tag';
					}
				}
				if (['{', '}', ';'].includes(punctuation)) segmentStart = index + 1;
			}
		}

		function scanTag(start, end, scriptLanguage, depth) {
			const opening = /^<(\/?)([A-Za-z][\w:.-]*|(?=>))/.exec(
				source.slice(start, Math.min(end, start + 256)),
			);
			if (!opening) {
				emit('punctuation', start, start + 1, 'html');
				return { end: start + 1, name: '', closing: false, selfClosing: true, complete: false };
			}
			const name = opening[2].toLowerCase();
			const nameStart = start + 1 + opening[1].length;
			emit('punctuation', start, nameStart, 'html');
			emit('tag', nameStart, start + opening[0].length, 'html');
			let cursor = start + opening[0].length;
			let expectsValue = false;
			while (cursor < end) {
				if (source[cursor] === '>' || source.startsWith('/>', cursor)) {
					const selfClosing = source[cursor] === '/';
					const nextOffset = cursor + (selfClosing ? 2 : 1);
					emit('punctuation', cursor, nextOffset, 'html');
					return { end: nextOffset, name, closing: !!opening[1], selfClosing, complete: true };
				}
				if (source[cursor] === '"' || source[cursor] === "'") {
					cursor = readQuoted(cursor, end, 'html', false, true);
					expectsValue = false;
				} else if (scriptLanguage && source[cursor] === '{') {
					emit('punctuation', cursor, cursor + 1, scriptLanguage);
					cursor = scanScript(cursor + 1, end, scriptLanguage, depth + 1, true);
					if (source[cursor] === '}') {
						emit('punctuation', cursor, cursor + 1, scriptLanguage);
						cursor++;
					}
					expectsValue = false;
				} else if (/\s/.test(source[cursor])) {
					emit('text', cursor, cursor + 1, 'html');
					cursor++;
				} else if (source[cursor] === '=') {
					emit('punctuation', cursor, cursor + 1, 'html');
					cursor++;
					expectsValue = true;
				} else {
					const valueStart = cursor;
					while (cursor < end && !/[\s=>]/.test(source[cursor]) && !source.startsWith('/>', cursor))
						cursor++;
					if (cursor === valueStart) cursor++;
					emit(expectsValue ? 'string' : 'attribute', valueStart, cursor, 'html', cursor < end);
					expectsValue = false;
				}
			}
			return { end: cursor, name, closing: !!opening[1], selfClosing: false, complete: false };
		}

		function embeddedScriptLanguage(tagName, openingText) {
			if (tagName === 'style') return 'css';
			if (tagName !== 'script') return 'text';
			if (/\btype\s*=\s*["']?(?:application\/(?:ld\+)?json|importmap)\b/i.test(openingText))
				return 'json';
			if (/\blang\s*=\s*["']?tsx?\b/i.test(openingText)) return 'ts';
			if (/\btype\s*=\s*["']?text\/(?!javascript|ecmascript)/i.test(openingText)) return 'text';
			return 'js';
		}

		function scanMarkup(start, end, scriptLanguage = '', depth = 0, singleElement = false) {
			let cursor = start;
			let nesting = 0;
			while (cursor < end) {
				if (source.startsWith('<!--', cursor)) {
					cursor = readComment(cursor, end, 'html', '-->');
				} else if (source.startsWith('<![CDATA[', cursor)) {
					cursor = readDelimited(cursor, end, 'html', 'string', 9, ']]>');
				} else if (source.startsWith('<?', cursor)) {
					cursor = readDelimited(cursor, end, 'html', 'keyword', 2, '?>');
				} else if (/^<!doctype\b/i.test(source.slice(cursor, cursor + 10))) {
					const closingOffset = source.indexOf('>', cursor);
					const nextOffset = closingOffset >= 0 ? Math.min(end, closingOffset + 1) : end;
					emit('keyword', cursor, nextOffset, 'html');
					cursor = nextOffset;
				} else if (source[cursor] === '<') {
					const tagStart = cursor;
					const tag = scanTag(cursor, end, scriptLanguage, depth);
					cursor = tag.end;
					if (!tag.closing && !tag.selfClosing) nesting++;
					if (tag.closing) nesting--;
					if (singleElement && nesting <= 0) return cursor;
					if (
						!scriptLanguage &&
						!tag.closing &&
						!tag.selfClosing &&
						tag.complete &&
						['script', 'style', 'textarea', 'title'].includes(tag.name)
					) {
						const closingPattern = new RegExp(`</${tag.name}(?=[\\s>/])`, 'ig');
						closingPattern.lastIndex = cursor;
						const closingMatch = closingPattern.exec(source);
						const contentEnd = closingMatch ? Math.min(end, closingMatch.index) : end;
						const embeddedLanguage = embeddedScriptLanguage(
							tag.name,
							source.slice(tagStart, cursor),
						);
						emit('context', cursor, cursor, embeddedLanguage);
						scan(cursor, contentEnd, embeddedLanguage, depth + 1);
						cursor = contentEnd;
					}
				} else if (scriptLanguage && source[cursor] === '{') {
					emit('punctuation', cursor, cursor + 1, scriptLanguage);
					cursor = scanScript(cursor + 1, end, scriptLanguage, depth + 1, true);
					if (source[cursor] === '}') {
						emit('punctuation', cursor, cursor + 1, scriptLanguage);
						cursor++;
					}
				} else {
					const textStart = cursor++;
					while (
						cursor < end &&
						source[cursor] !== '<' &&
						!(scriptLanguage && source[cursor] === '{')
					)
						cursor++;
					emit('text', textStart, cursor, 'html');
				}
			}
			return cursor;
		}

		function isLineStart(offset) {
			for (let index = offset - 1; index >= 0; index--) {
				if (source[index] === '\n') return true;
				if (!/[^\S\n]/.test(source[index])) return false;
			}
			return true;
		}

		function previousSignificantCharacter(offset) {
			for (let index = offset - 1; index >= 0; index--) {
				if (source[index] === '\n') return '';
				if (!/[^\S\n]/.test(source[index])) return source[index];
			}
			return '';
		}

		function readLineComment(start, end, tokenLanguage, markerLength) {
			let cursor = Math.min(end, start + markerLength);
			while (cursor < end && source[cursor] !== '\n') cursor++;
			emit('comment', start, cursor, tokenLanguage);
			return cursor;
		}

		function readDirective(start, end, tokenLanguage) {
			let cursor = start;
			while (cursor < end && source[cursor] !== '\n') cursor++;
			emit('keyword', start, cursor, tokenLanguage);
			return cursor;
		}

		function readDelimitedComment(start, end, tokenLanguage, openingLength, terminator) {
			const closingOffset = source.indexOf(terminator, start + openingLength);
			const closed = closingOffset >= 0 && closingOffset < end;
			const nextOffset = closed ? Math.min(end, closingOffset + terminator.length) : end;
			emit('comment', start, nextOffset, tokenLanguage, closed);
			return nextOffset;
		}

		function readRawQuoted(start, end, tokenLanguage) {
			const quote = source[start];
			const closingOffset = source.indexOf(quote, start + 1);
			const closed = closingOffset >= 0 && closingOffset < end;
			const nextOffset = closed ? closingOffset + 1 : end;
			emit('string', start, nextOffset, tokenLanguage, closed);
			return nextOffset;
		}

		function readTripleQuoted(start, end, tokenLanguage) {
			const marker = source.slice(start, start + 3);
			const closingOffset = source.indexOf(marker, start + 3);
			const closed = closingOffset >= 0 && closingOffset + 3 <= end;
			const nextOffset = closed ? closingOffset + 3 : end;
			emit('string', start, nextOffset, tokenLanguage, closed);
			return nextOffset;
		}

		function readVerbatimQuoted(start, end, tokenLanguage, openingLength) {
			let cursor = start + openingLength;
			let closed = false;
			while (cursor < end) {
				if (source[cursor] === '"') {
					if (source[cursor + 1] === '"' && cursor + 1 < end) {
						cursor += 2;
						continue;
					}
					cursor++;
					closed = true;
					break;
				}
				cursor++;
			}
			emit('string', start, cursor, tokenLanguage, closed);
			return cursor;
		}

		function readRawString(cursor, end, tokenLanguage, grammar) {
			if (grammar.rawStringStyle === 'rust') {
				const match = matchAt(rustRawString, cursor, end);
				if (!match) return cursor;
				return readDelimited(cursor, end, tokenLanguage, 'string', match[0].length, '"' + match[1]);
			}
			if (grammar.rawStringStyle === 'cpp') {
				const match = matchAt(cppRawString, cursor, end);
				if (!match) return cursor;
				return readDelimited(
					cursor,
					end,
					tokenLanguage,
					'string',
					match[0].length,
					')' + match[1] + '"',
				);
			}
			if (grammar.rawStringStyle === 'csharp') {
				const match = matchAt(csharpVerbatimString, cursor, end);
				if (!match) return cursor;
				return readVerbatimQuoted(cursor, end, tokenLanguage, match[0].length);
			}
			if (grammar.rawStringStyle === 'lua') {
				const match = matchAt(luaLongBracket, cursor, end);
				if (!match) return cursor;
				return readDelimited(cursor, end, tokenLanguage, 'string', match[0].length, ']' + match[1] + ']');
			}
			return cursor;
		}

		function readHeredocBodies(cursor, end, tokenLanguage, pendingHeredocs) {
			for (const terminator of pendingHeredocs) {
				const pattern = new RegExp('^[ \\t]*' + terminator + '[ \\t]*;?[ \\t]*(?=\\n|$)', 'gm');
				pattern.lastIndex = cursor;
				const match = pattern.exec(source);
				if (!match || match.index >= end) {
					emit('string', cursor, end, tokenLanguage, false);
					cursor = end;
					break;
				}
				const bodyEnd = Math.min(end, match.index + match[0].length);
				emit('string', cursor, bodyEnd, tokenLanguage);
				cursor = bodyEnd;
			}
			pendingHeredocs.length = 0;
			return cursor;
		}

		function previousWord(offset) {
			let index = offset;
			while (index > 0 && /[^\S\n]/.test(source[index - 1])) index--;
			let wordStart = index;
			while (wordStart > 0 && /[\w$]/.test(source[wordStart - 1])) wordStart--;
			return source.slice(wordStart, index);
		}

		function regexAllowedAt(offset, grammar) {
			const previous = previousSignificantCharacter(offset);
			if (previous === '' || generalRegexPredecessors.includes(previous)) return true;
			const word = previousWord(offset);
			return !!word && grammar.keywords.has(grammar.ignoreCase ? word.toLowerCase() : word);
		}

		function quoteStartsString(cursor, grammar) {
			if (!grammar.valueQuotes) return true;
			const previous = previousSignificantCharacter(cursor);
			return previous === '' || grammar.valueQuotes.includes(previous);
		}

		function isLifetime(cursor, end, grammar) {
			if (!grammar.lifetimes || source[cursor] !== "'") return 0;
			const word = matchTextAt(identifier, cursor + 1, end);
			if (!word || source[cursor + 1 + word.length] === "'") return 0;
			return 1 + word.length;
		}

		function isDigitSeparator(cursor, grammar) {
			return (
				!!grammar.digitSeparatorQuote &&
				source[cursor] === "'" &&
				/[\da-fA-F]/.test(source[cursor - 1] || '') &&
				/[\da-fA-F]/.test(source[cursor + 1] || '')
			);
		}

		function lineCommentAt(cursor, grammar) {
			const marker = grammar.lineComments.find((candidate) => source.startsWith(candidate, cursor));
			if (!marker) return '';
			if (grammar.commentNeedsSpace && cursor > 0 && !/\s/.test(source[cursor - 1])) return '';
			return marker;
		}

		function generalWordType(word, wordEnd, end, grammar) {
			const lookup = grammar.ignoreCase ? word.toLowerCase() : word;
			if (grammar.keywords.has(lookup)) return 'keyword';
			let nextOffset = wordEnd;
			while (nextOffset < end && /[^\S\n]/.test(source[nextOffset])) nextOffset++;
			if (grammar.keyAssignment && source[nextOffset] === grammar.keyAssignment) return 'attribute';
			if (source[nextOffset] === '(') return 'function';
			return 'identifier';
		}

		function scanGeneral(start, end, tokenLanguage, grammar, stopAt = '') {
			let cursor = start;
			const pendingHeredocs = [];
			while (cursor < end) {
				if (stopAt && source.startsWith(stopAt, cursor)) return cursor;
				const character = source[cursor];
				if (/\s/.test(character)) {
					const whitespaceStart = cursor;
					if (pendingHeredocs.length) {
						while (cursor < end && /[^\S\n]/.test(source[cursor])) cursor++;
						if (source[cursor] === '\n' && cursor < end) {
							cursor++;
							emit('text', whitespaceStart, cursor, tokenLanguage);
							cursor = readHeredocBodies(cursor, end, tokenLanguage, pendingHeredocs);
						} else emit('text', whitespaceStart, cursor, tokenLanguage);
						continue;
					}
					cursor++;
					while (cursor < end && /\s/.test(source[cursor])) cursor++;
					emit('text', whitespaceStart, cursor, tokenLanguage);
					continue;
				}
				if (grammar.rawStringStyle === 'lua' && source.startsWith('--[', cursor)) {
					const level = matchAt(luaLongBracket, cursor + 2, end);
					if (level) {
						cursor = readDelimited(
							cursor,
							end,
							tokenLanguage,
							'comment',
							2 + level[0].length,
							']' + level[1] + ']',
						);
						continue;
					}
				}
				const blockComment = grammar.blockComments.find((pair) =>
					source.startsWith(pair[0], cursor),
				);
				if (blockComment) {
					cursor = readDelimitedComment(
						cursor,
						end,
						tokenLanguage,
						blockComment[0].length,
						blockComment[1],
					);
					continue;
				}
				const lineComment = lineCommentAt(cursor, grammar);
				if (lineComment) {
					cursor = readLineComment(cursor, end, tokenLanguage, lineComment.length);
					continue;
				}
				if (grammar.heredoc && character === '<') {
					const match = matchAt(grammar.heredoc, cursor, end);
					if (match) {
						pendingHeredocs.push(match.slice(1).find((group) => group !== undefined));
						emit('keyword', cursor, cursor + match[0].length, tokenLanguage);
						cursor += match[0].length;
						continue;
					}
				}
				if (
					grammar.tripleQuotes &&
					(source.startsWith('"""', cursor) || source.startsWith("'''", cursor))
				) {
					cursor = readTripleQuoted(cursor, end, tokenLanguage);
					continue;
				}
				if (grammar.rawStringStyle) {
					const rawEnd = readRawString(cursor, end, tokenLanguage, grammar);
					if (rawEnd > cursor) {
						cursor = rawEnd;
						continue;
					}
				}
				const lifetimeLength = isLifetime(cursor, end, grammar);
				if (lifetimeLength) {
					emit('identifier', cursor, cursor + lifetimeLength, tokenLanguage);
					cursor += lifetimeLength;
					continue;
				}
				if (grammar.charLiterals && character === "'" && !isDigitSeparator(cursor, grammar)) {
					const literal = matchTextAt(characterLiteral, cursor, end);
					if (literal) {
						emit('string', cursor, cursor + literal.length, tokenLanguage);
						cursor += literal.length;
						continue;
					}
				}
				if (grammar.regexLiterals && character === '/' && regexAllowedAt(cursor, grammar)) {
					const regexEnd = readRegularExpression(cursor, end, tokenLanguage);
					if (regexEnd > cursor) {
						cursor = regexEnd;
						continue;
					}
				}
				if (grammar.quotes.includes(character)) {
					if (isDigitSeparator(cursor, grammar) || !quoteStartsString(cursor, grammar)) {
						emit('punctuation', cursor, cursor + 1, tokenLanguage);
						cursor++;
						continue;
					}
					if (character === '`') cursor = readRawQuoted(cursor, end, tokenLanguage);
					else {
						const raw = character === "'" && grammar.rawSingleQuotes;
						cursor = readQuoted(cursor, end, tokenLanguage, !raw, grammar.multilineStrings);
					}
					continue;
				}
				if (grammar.preprocessor && character === '#' && isLineStart(cursor)) {
					cursor = readDirective(cursor, end, tokenLanguage);
					continue;
				}
				const numericValue = matchTextAt(generalNumber, cursor, end);
				if (numericValue) {
					emit('number', cursor, cursor + numericValue.length, tokenLanguage);
					cursor += numericValue.length;
					continue;
				}
				const word = matchTextAt(identifier, cursor, end);
				if (word) {
					emit(
						generalWordType(word, cursor + word.length, end, grammar),
						cursor,
						cursor + word.length,
						tokenLanguage,
					);
					cursor += word.length;
					continue;
				}
				emit('punctuation', cursor, cursor + 1, tokenLanguage);
				cursor++;
			}
			return cursor;
		}

		function scanEmbeddedMarkup(start, end, tokenLanguage, grammar, depth) {
			let cursor = start;
			while (cursor < end) {
				let opening = source.indexOf('<?', cursor);
				let tag = null;
				while (opening >= 0 && opening < end) {
					tag = matchAt(phpOpenTag, opening, end);
					if (tag) break;
					opening = source.indexOf('<?', opening + 2);
				}
				if (!tag || opening < 0 || opening >= end) {
					scanMarkup(cursor, end, '', depth);
					return end;
				}
				if (opening > cursor) scanMarkup(cursor, opening, '', depth);
				emit('keyword', opening, opening + tag[0].length, tokenLanguage);
				cursor = scanGeneral(opening + tag[0].length, end, tokenLanguage, grammar, '?>');
				if (cursor < end && source.startsWith('?>', cursor)) {
					emit('keyword', cursor, cursor + 2, tokenLanguage);
					cursor += 2;
				}
			}
			return cursor;
		}

		function emitCaptures(pattern, match, start, tokenLanguage) {
			const matchEnd = start + match[0].length;
			if (!pattern.captures || !match.indices) {
				if (matchEnd > start) emit(pattern.type, start, matchEnd, tokenLanguage);
				return;
			}
			let position = start;
			for (let group = 1; group < match.indices.length; group += 1) {
				const span = match.indices[group];
				if (!span || span[0] < position || span[1] <= span[0]) continue;
				if (span[0] > position) emit(pattern.type, position, span[0], tokenLanguage);
				emit(pattern.captures[group] || pattern.type, span[0], span[1], tokenLanguage);
				position = span[1];
			}
			if (matchEnd > position) emit(pattern.captures[0] || pattern.type, position, matchEnd, tokenLanguage);
		}

		function scanPatterns(start, end, tokenLanguage, grammar) {
			const patterns = grammar.patterns;
			let cursor = start;
			let block = null;
			while (cursor < end) {
				const newline = source.indexOf('\n', cursor);
				const lineEnd = newline === -1 || newline > end ? end : newline;
				const started = performance.now();
				let position = cursor;
				if (lineEnd - position > patternMaxLineLength) {
					emit(block ? block.type : 'text', position, lineEnd, tokenLanguage, !block);
					position = lineEnd;
				}
				while (position < lineEnd) {
					if (performance.now() - started > patternLineBudgetMs) {
						emit(block ? block.type : 'text', position, lineEnd, tokenLanguage, !block);
						position = lineEnd;
						break;
					}
					if (block) {
						block.end.lastIndex = position;
						const closing = block.end.exec(source);
						if (closing && closing.index + closing[0].length <= lineEnd) {
							emit(block.type, position, closing.index + closing[0].length, tokenLanguage);
							position = closing.index + closing[0].length;
							block = null;
						} else {
							emit(block.type, position, lineEnd, tokenLanguage, false);
							position = lineEnd;
						}
						continue;
					}
					let matched = false;
					for (const pattern of patterns) {
						if (pattern.kind === 'block') {
							pattern.begin.lastIndex = position;
							const opening = pattern.begin.exec(source);
							if (!opening || opening[0].length === 0 || pattern.begin.lastIndex > lineEnd) continue;
							const after = pattern.begin.lastIndex;
							pattern.end.lastIndex = after;
							const closing = pattern.end.exec(source);
							if (closing && closing.index + closing[0].length <= lineEnd) {
								emit(pattern.type, position, closing.index + closing[0].length, tokenLanguage);
								position = closing.index + closing[0].length;
							} else {
								if (pattern.multiline) block = pattern;
								emit(pattern.type, position, lineEnd, tokenLanguage, false);
								position = lineEnd;
							}
							matched = true;
							break;
						}
						pattern.regex.lastIndex = position;
						const match = pattern.regex.exec(source);
						if (!match || match[0].length === 0 || pattern.regex.lastIndex > lineEnd) continue;
						emitCaptures(pattern, match, position, tokenLanguage);
						position = pattern.regex.lastIndex;
						matched = true;
						break;
					}
					if (!matched) {
						emit('text', position, position + 1, tokenLanguage);
						position += 1;
					}
				}
				cursor = lineEnd;
				if (cursor < end) {
					emit(block ? block.type : 'text', cursor, cursor + 1, tokenLanguage, !block);
					cursor += 1;
				}
			}
			return cursor;
		}

		function scan(start, end, tokenLanguage, depth = 0) {
			if (tokenLanguage === 'html') return scanMarkup(start, end, '', depth);
			if (tokenLanguage === 'css') return scanCss(start, end);
			if (tokenLanguage === 'json' || tokenLanguage === 'jsonc')
				return scanJson(start, end, tokenLanguage);
			if (tokenLanguage === 'text') return emit('text', start, end, tokenLanguage);
			const grammar = languages.grammar(tokenLanguage);
			if (grammar?.patterns) return scanPatterns(start, end, tokenLanguage, grammar);
			if (grammar?.embeddedMarkup && source.indexOf('<?', start) >= 0)
				return scanEmbeddedMarkup(start, end, tokenLanguage, grammar, depth);
			if (grammar) return scanGeneral(start, end, tokenLanguage, grammar);
			if (scriptLanguages.has(tokenLanguage)) return scanScript(start, end, tokenLanguage, depth);
			return emit('text', start, end, tokenLanguage);
		}

		scan(0, source.length, language);
		return tokens;
	}

	window.SynapseSyntaxTokenizer = Object.freeze({ tokenize });
})();
