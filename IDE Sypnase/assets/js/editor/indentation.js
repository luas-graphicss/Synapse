(function (root) {
	'use strict';

	const matchingBrackets = { '{': '}', '[': ']', '(': ')' };
	const voidElements = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
	const defaultWordCharacter = /[\w$]/;

	function editingFor(path) {
		const host = root.SynapseExtensionLanguages;
		return host && typeof host.editingFor === 'function' ? host.editingFor(path) : null;
	}

	function bracketsFor(path) {
		const contributed = editingFor(path);
		if (!contributed || !contributed.brackets.length) return matchingBrackets;
		const map = {};
		contributed.brackets.forEach((pair) => {
			map[pair.open] = pair.close;
		});
		return map;
	}

	function isWordCharacter(character, contributed) {
		if (!character) return false;
		const pattern = contributed && contributed.wordPattern;
		if (!pattern) return defaultWordCharacter.test(character);
		const anchored = new RegExp('^(?:' + pattern.source + ')$', pattern.flags.replace(/g/g, ''));
		return anchored.test(character) || anchored.test('a' + character);
	}

	function detectIndentation(text) {
		let previousWidth = 0;
		let tabLines = 0;
		let spaceLines = 0;
		const widths = new Map();
		for (const line of text.split('\n', 200)) {
			if (!line.trim()) continue;
			const prefix = line.match(/^[\t ]*/)[0];
			if (prefix.includes('\t')) tabLines++;
			else if (prefix.length) {
				spaceLines++;
				const difference = prefix.length - previousWidth;
				if (difference > 0 && difference <= 8) widths.set(difference, (widths.get(difference) || 0) + 1);
			}
			previousWidth = prefix.length;
		}
		if (tabLines > spaceLines) return '\t';
		const candidates = [...widths].sort((first, second) => second[1] - first[1] || first[0] - second[0]);
		return ' '.repeat(candidates[0]?.[0] || 2);
	}

	function maskLiterals(text, path, allowTrailingLineComment = false) {
		const contributed = root.SynapseExtensionLanguages?.commentsFor(path);
		const hashComments = /\.(?:py|pyw|yaml|yml|sh|bash|rb)$/i.test(path);
		const lineCommentMarker = contributed ? contributed.lineComment : hashComments ? '#' : '//';
		const expressions = contributed
			? contributed.maskExpression
			: hashComments
				? /#[^\n\r]*|"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|"(?:\\[\s\S]|[^"\\])*"?|'(?:\\[\s\S]|[^'\\])*'?/g
				: /<!--[\s\S]*?(?:-->|$)|<!\[CDATA\[[\s\S]*?(?:\]\]>|$)|\/\/[^\n\r]*|\/\*[\s\S]*?(?:\*\/|$)|"(?:\\[\s\S]|[^"\\])*"?|'(?:\\[\s\S]|[^'\\])*'?|`(?:\\[\s\S]|[^`\\])*`?/g;
		return text.replace(expressions, (token) => {
			const masked = token.replace(/[^\n\r]/g, ' ');
			const lineComment = !!lineCommentMarker && token.startsWith(lineCommentMarker);
			return allowTrailingLineComment && lineComment && token.endsWith('\u0000')
				? masked.slice(0, -1) + '\u0000'
				: masked;
		});
	}

	function createNewlineEdit(text, start, end, path = '', unit = detectIndentation(text)) {
		const lineStart = start === 0 ? 0 : text.lastIndexOf('\n', start - 1) + 1;
		const prefix = text.slice(lineStart, start);
		const indentation = prefix.match(/^[\t ]*/)[0];
		const masked = maskLiterals(text.slice(0, start), path).slice(lineStart).trimEnd();
		const insideLiteral = !maskLiterals(text.slice(0, start) + '\u0000', path, true).endsWith('\u0000');
		const brackets = bracketsFor(path);
		const openingBracket = Object.keys(brackets).find((open) => masked.endsWith(open)) || '';
		let shouldIndent = !!openingBracket;
		const closingPattern = shouldIndent ? brackets[openingBracket] : '';
		let closingTagName = null;
		const markup = /\.(?:html?|xml|svg|vue|svelte|jsx|tsx)$/i.test(path);
		if (markup) {
			const tag = masked.match(/<([A-Za-z][\w:.-]*)(?:\s[^<>]*)?>\s*$/);
			if (tag && !voidElements.has(tag[1].toLowerCase()) && !/\/\s*>\s*$/.test(tag[0])) {
				shouldIndent = true;
				closingTagName = tag[1];
			}
		}
		if (/\.(?:py|pyw|yaml|yml)$/i.test(path) && masked.endsWith(':')) shouldIndent = true;
		if (prefix.trim() === '' || insideLiteral) shouldIndent = false;
		const rightSide = text.slice(end);
		const trailingWhitespace = rightSide.match(/^[\t ]*/)[0];
		const closingText = rightSide.slice(trailingWhitespace.length);
		const closingTag = closingText.match(/^<\/([A-Za-z][\w:.-]*)\s*>/);
		const caseInsensitiveTags = /\.(?:html?|vue|svelte)$/i.test(path);
		const tagNamesMatch = closingTagName && closingTag && (caseInsensitiveTags
			? closingTagName.toLowerCase() === closingTag[1].toLowerCase()
			: closingTagName === closingTag[1]);
		const hasMatchingClose = shouldIndent && (closingTagName ? tagNamesMatch : closingPattern && closingText.startsWith(closingPattern));
		const newline = text.includes('\r\n') ? '\r\n' : '\n';
		const insertion = newline + indentation + (shouldIndent ? unit : '');
		return {
			start,
			end: end + (hasMatchingClose ? trailingWhitespace.length : 0),
			text: insertion + (hasMatchingClose ? newline + indentation : ''),
			selectionStart: start + insertion.length,
			selectionEnd: start + insertion.length,
		};
	}

	function createTabEdit(text, start, end, outdent = false, unit = detectIndentation(text)) {
		const lineStart = start === 0 ? 0 : text.lastIndexOf('\n', start - 1) + 1;
		if (start === end && !outdent) {
			const column = start - lineStart;
			const insertion = unit === '\t' ? unit : ' '.repeat(unit.length - column % unit.length);
			return { start, end, text: insertion, selectionStart: start + insertion.length, selectionEnd: start + insertion.length };
		}
		const inclusiveEnd = end > start && text[end - 1] === '\n' ? end - 1 : end;
		const nextNewline = text.indexOf('\n', inclusiveEnd);
		const blockEnd = nextNewline < 0 ? text.length : nextNewline;
		const block = text.slice(lineStart, blockEnd);
		const edits = [];
		let offset = lineStart;
		const replacement = block.split('\n').map((line) => {
			const removed = outdent ? (line.startsWith('\t') ? 1 : Math.min(unit === '\t' ? 2 : unit.length, line.match(/^ */)[0].length)) : 0;
			edits.push({ offset, removed, added: outdent ? 0 : unit.length });
			offset += line.length + 1;
			return outdent ? line.slice(removed) : unit + line;
		}).join('\n');
		function remap(position) {
			let mapped = position;
			for (const edit of edits) {
				if (edit.offset > position) break;
				mapped += edit.added - Math.min(edit.removed, position - edit.offset);
			}
			return mapped;
		}
		return { start: lineStart, end: blockEnd, text: replacement, selectionStart: remap(start), selectionEnd: remap(end) };
	}

	function createClosingEdit(text, start, end, character, path = '') {
		const brackets = bracketsFor(path);
		const opening = Object.keys(brackets).find((open) => open.length === 1 && brackets[open] === character);
		if (start !== end || typeof character !== 'string' || character.length !== 1 || !opening) return null;
		const lineStart = start === 0 ? 0 : text.lastIndexOf('\n', start - 1) + 1;
		const prefix = text.slice(lineStart, start);
		if (!/^[\t ]+$/.test(prefix)) return null;
		if (!maskLiterals(text.slice(0, start) + '\u0000', path).endsWith('\u0000')) return null;
		const masked = maskLiterals(text.slice(0, lineStart), path);
		let depth = 0;
		for (let index = masked.length - 1; index >= 0; index--) {
			if (masked[index] === character) depth++;
			else if (masked[index] === opening) {
				if (depth > 0) { depth--; continue; }
				const openingLine = text.lastIndexOf('\n', index - 1) + 1;
				const indentation = text.slice(openingLine, index).match(/^[\t ]*/)[0];
				if (indentation.length >= prefix.length) return null;
				const insertion = indentation + character;
				return { start: lineStart, end, text: insertion, selectionStart: lineStart + insertion.length, selectionEnd: lineStart + insertion.length };
			}
		}
		return null;
	}

	function createTagCloseEdit(text, start, end, character, path = '') {
		if (character !== '>' || start !== end) return null;
		if (!/\.(?:html?|xml|svg|vue|svelte|jsx|tsx)$/i.test(path)) return null;
		const before = text.slice(0, start);
		const openIndex = before.lastIndexOf('<');
		if (openIndex < 0 || before.lastIndexOf('>') > openIndex) return null;
		if (before.lastIndexOf('<!--') > before.lastIndexOf('-->')) return null;
		const lower = before.toLowerCase();
		if (lower.lastIndexOf('<script') < openIndex && lower.lastIndexOf('<script') > lower.lastIndexOf('</script')) return null;
		if (lower.lastIndexOf('<style') < openIndex && lower.lastIndexOf('<style') > lower.lastIndexOf('</style')) return null;
		const opening = /^<([A-Za-z][\w:.-]*)((?:"[^"]*"|'[^']*'|[^<>])*)$/.exec(before.slice(openIndex));
		if (!opening) return null;
		const name = opening[1];
		const attributes = opening[2];
		if (/\/\s*$/.test(attributes)) return null;
		if (voidElements.has(name.toLowerCase())) return null;
		let quote = '';
		for (const character of attributes) {
			if (quote) {
				if (character === quote) quote = '';
			} else if (character === '"' || character === "'") quote = character;
		}
		if (quote) return null;
		const rest = text.slice(end);
		const closingPattern = new RegExp(`^\\s*<\\/${name.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')}\\s*>`, 'i');
		if (closingPattern.test(rest)) return null;
		const insertion = `></${name}>`;
		return { start, end, text: insertion, selectionStart: start + 1, selectionEnd: start + 1 };
	}

	function literalContext(text, start, path) {
		const prefix = text.slice(0, start) + '\u0000';
		const outsideEverything = maskLiterals(prefix, path).endsWith('\u0000');
		const outsideOrLineComment = maskLiterals(prefix, path, true).endsWith('\u0000');
		return { insideString: !outsideOrLineComment, insideComment: !outsideEverything && outsideOrLineComment };
	}

	function createAutoClosingEdit(text, start, end, character, path = '') {
		if (typeof character !== 'string' || character.length !== 1) return null;
		const contributed = editingFor(path);
		if (!contributed) return null;
		if (start !== end) {
			const surrounding = contributed.surroundingPairs.find((pair) => pair.open === character);
			if (!surrounding) return null;
			const wrapped = surrounding.open + text.slice(start, end) + surrounding.close;
			return { start, end, text: wrapped, selectionStart: start + surrounding.open.length, selectionEnd: start + wrapped.length - surrounding.close.length };
		}
		const context = literalContext(text, start, path);
		const next = text[start] || '';
		const skipsOver = next === character && contributed.autoClosingPairs.some((pair) => pair.close === character && (pair.open !== pair.close || context.insideString));
		if (skipsOver) return { start, end: end + 1, text: character, selectionStart: start + 1, selectionEnd: start + 1 };
		const pair = contributed.autoClosingPairs.find((candidate) => candidate.open === character);
		if (!pair) return null;
		const notIn = pair.notIn || [];
		if (notIn.includes('string') && context.insideString) return null;
		if (notIn.includes('comment') && context.insideComment) return null;
		if (next && !/[\s)\]}>,;:]/.test(next)) return null;
		if (pair.open === pair.close) {
			const previous = text[start - 1] || '';
			if (previous === pair.open || isWordCharacter(previous, contributed)) return null;
		}
		const insertion = pair.open + pair.close;
		return { start, end, text: insertion, selectionStart: start + pair.open.length, selectionEnd: start + pair.open.length };
	}

	root.SynapseIndentation = Object.freeze({ detectIndentation, createNewlineEdit, createTabEdit, createClosingEdit, createTagCloseEdit, createAutoClosingEdit });
})(globalThis);
