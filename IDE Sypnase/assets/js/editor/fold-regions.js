(function () {
    'use strict';

    const bracketPairs = { '}': '{', ']': '[', ')': '(' };
    const voidElements = new Set(
      'area base br col embed hr img input link meta param source track wbr'.split(' '),
    );
    const expressionKeywords = new Set(
      'return throw yield await case delete void typeof new in of'.split(' '),
    );

    function addRegion(regions, startLine, endLine) {
      if (endLine > startLine) regions.set(startLine, Math.max(endLine, regions.get(startLine) || 0));
    }

    function indentationWidth(line) {
      let width = 0;
      for (const character of line) {
        if (character === ' ') width += 1;
        else if (character === '\t') width += 2 - (width % 2);
        else break;
      }
      return width;
    }

    function collectIndentedRegions(lines, regions) {
      const stack = [];
      let previousLine = -1;
      let previousIndent = 0;
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        if (!lines[lineIndex].trim()) continue;
        const indent = indentationWidth(lines[lineIndex]);
        while (stack.length && indent <= stack[stack.length - 1].indent) {
          addRegion(regions, stack.pop().line, previousLine);
        }
        if (previousLine >= 0 && indent > previousIndent) {
          stack.push({ line: previousLine, indent: previousIndent });
        }
        previousLine = lineIndex;
        previousIndent = indent;
      }
      while (stack.length) addRegion(regions, stack.pop().line, previousLine);
    }

    function collectBracketRegions(text, regions, allowRegex, allowLineComments) {
      const stack = [];
      let line = 0;
      let quote = '';
      let blockCommentStart = -1;
      let lineComment = false;
      let regexLiteral = false;
      let regexClass = false;
      let expectsExpression = true;
      let previousWord = '';
      for (let index = 0; index < text.length; index += 1) {
        const character = text[index];
        const next = text[index + 1];
        if (character === '\n') {
          line += 1;
          lineComment = false;
          regexLiteral = false;
          if (quote !== '`') quote = '';
          continue;
        }
        if (lineComment) continue;
        if (blockCommentStart >= 0) {
          if (character === '*' && next === '/') {
            addRegion(regions, blockCommentStart, line - 1);
            blockCommentStart = -1;
            index += 1;
          }
          continue;
        }
        if (quote || regexLiteral) {
          if (character === '\\') {
            if (next === '\n') line += 1;
            index += 1;
            continue;
          }
          if (quote) {
            if (character === quote) quote = '';
          } else if (character === '[') regexClass = true;
          else if (character === ']') regexClass = false;
          else if (character === '/' && !regexClass) regexLiteral = false;
          continue;
        }
        if (character === '/' && next === '*') {
          blockCommentStart = line;
          index += 1;
          continue;
        }
        if (allowLineComments && character === '/' && next === '/') {
          lineComment = true;
          index += 1;
          continue;
        }
        if (character === '"' || character === "'" || character === '`') {
          quote = character;
          expectsExpression = false;
          continue;
        }
        if (allowRegex && character === '/' && expectsExpression) {
          regexLiteral = true;
          regexClass = false;
          expectsExpression = false;
          continue;
        }
        if (/[\w$]/.test(character)) {
          let end = index + 1;
          while (end < text.length && /[\w$]/.test(text[end])) end += 1;
          previousWord = text.slice(index, end);
          expectsExpression = expressionKeywords.has(previousWord);
          index = end - 1;
          continue;
        }
        if ('{[('.includes(character)) {
          stack.push({
              character,
              line,
              control: character === '(' && /^(if|while|for|with|switch|catch)$/.test(previousWord),
          });
          expectsExpression = true;
        } else if (bracketPairs[character]) {
          const opening = stack[stack.length - 1];
          if (opening && opening.character === bracketPairs[character]) {
            stack.pop();
            addRegion(regions, opening.line, line - 1);
          }
          expectsExpression = character === '}' || Boolean(opening && opening.control);
        } else if (!/\s/.test(character)) {
          expectsExpression = '=,:;!?&|+*-/%^~<>'.includes(character);
        }
        if (!/\s/.test(character)) previousWord = '';
      }
    }

    function collectMarkupRegions(text, regions) {
      const stack = [];
      const tags =
      /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\/?([A-Za-z][\w:.-]*)\b(?:[^>"']|"[^"]*"|'[^']*')*>/g;
          let previousOffset = 0;
          let line = 0;
          let rawElement = '';
          for (const match of text.matchAll(tags)) {
            for (let index = previousOffset; index < match.index; index += 1) {
              if (text[index] === '\n') line += 1;
            }
            const startLine = line;
            for (const character of match[0]) if (character === '\n') line += 1;
            previousOffset = match.index + match[0].length;
            const name = (match[1] || '').toLowerCase();
            const closing = match[0].startsWith('</');
            if (rawElement && !(closing && name === rawElement)) continue;
            if (!name) {
              addRegion(regions, startLine, line - 1);
              continue;
            }
            if (closing) {
              const opening = stack[stack.length - 1];
              if (opening && opening.name === name) {
                stack.pop();
                addRegion(regions, opening.line, startLine - 1);
              }
              rawElement = '';
            } else if (!voidElements.has(name) && !/\/\s*>$/.test(match[0])) {
              stack.push({ name, line: startLine });
              if (name === 'script' || name === 'style' || name === 'textarea') rawElement = name;
            }
          }
        }

        function compute(text, language = '') {
          const regions = new Map();
          if (typeof text !== 'string' || !text) return regions;
          const normalized = text.replace(/\r\n?/g, '\n');
          const extension = String(language).toLowerCase().split('.').pop();
          if (/^(html?|xml|svg|vue|svelte)$/.test(extension)) {
            collectMarkupRegions(normalized, regions);
          } else if (
            /^(js|mjs|cjs|jsx|ts|tsx|javascript|typescript|json|jsonc|css|scss|less|c|h|cpp|hpp|cs|java|rs|go|dart|glsl)$/.test(
              extension,
            )
          ) {
            collectBracketRegions(
              normalized,
              regions,
              /^(js|mjs|cjs|jsx|ts|tsx|javascript|typescript)$/.test(extension),
              extension !== 'css',
            );
          } else {
            collectIndentedRegions(normalized.split('\n'), regions);
          }
          return regions;
        }

        window.EditorFoldRegions = Object.freeze({ compute, indentationWidth });
    })();
