(function (root) {
    'use strict';

    const matchingBrackets = { '{': '}', '[': ']', '(': ')' };
    const voidElements = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));

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
      const hashComments = /\.(?:py|pyw|yaml|yml|sh|bash|rb)$/i.test(path);
      const expressions = hashComments
      ? /#[^\n\r]*|"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|"(?:\\[\s\S]|[^"\\])*"?|'(?:\\[\s\S]|[^'\\])*'?/g
: /<!--[\s\S]*?(?:-->|$)|<!\[CDATA\[[\s\S]*?(?:\]\]>|$)|\/\/[^\n\r]*|\/\*[\s\S]*?(?:\*\/|$)|"(?:\\[\s\S]|[^"\\])*"?|'(?:\\[\s\S]|[^'\\])*'?|`(?:\\[\s\S]|[^`\\])*`?/g;
return text.replace(expressions, (token) => {
    const masked = token.replace(/[^\n\r]/g, ' ');
    const lineComment = token.startsWith(hashComments ? '#' : '//');
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
  const openingBracket = masked.at(-1);
  let shouldIndent = Object.hasOwn(matchingBrackets, openingBracket);
  const closingPattern = shouldIndent ? matchingBrackets[openingBracket] : '';
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
  if (start !== end || !Object.values(matchingBrackets).includes(character)) return null;
  const lineStart = start === 0 ? 0 : text.lastIndexOf('\n', start - 1) + 1;
  const prefix = text.slice(lineStart, start);
  if (!/^[\t ]+$/.test(prefix)) return null;
  if (!maskLiterals(text.slice(0, start) + '\u0000', path).endsWith('\u0000')) return null;
  const masked = maskLiterals(text.slice(0, lineStart), path);
  let depth = 0;
  for (let index = masked.length - 1; index >= 0; index--) {
    if (masked[index] === character) depth++;
    else if (matchingBrackets[masked[index]] === character) {
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

root.SynapseIndentation = Object.freeze({ detectIndentation, createNewlineEdit, createTabEdit, createClosingEdit });
})(globalThis);
