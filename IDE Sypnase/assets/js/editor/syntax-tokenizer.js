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
    const regexPredecessors = new Set([
        '',
        '=',
        '(',
        '[',
        '{',
        ',',
        ':',
        ';',
        '!',
        '?',
        '&',
        '|',
        'return',
        'throw',
        'case',
        'yield',
        '=>',
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
        return match && expression.lastIndex <= end ? match[0] : '';
      }

      function readQuoted(start, end, tokenLanguage, allowEscapes = true) {
        const quote = source[start];
        let cursor = start + 1;
        let closed = false;
        while (cursor < end) {
          if (allowEscapes && source[cursor] === '\\') {
            cursor = Math.min(end, cursor + 2);
            continue;
          }
          if (source[cursor] === quote) {
            cursor++;
            closed = true;
            break;
          }
          if (allowEscapes && source[cursor] === '\n') break;
          cursor++;
        }
        emit('string', start, cursor, tokenLanguage, closed);
        return cursor;
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
            (tokenLanguage === 'jsx' || tokenLanguage === 'tsx') &&
            character === '<' &&
            /[A-Za-z>]/.test(source[cursor + 1] || '') &&
            !/^(?:literal|identifier)$/.test(previousValue)
          ) {
            cursor = scanMarkup(cursor, end, tokenLanguage, depth + 1, true);
            previousValue = 'literal';
            continue;
          }
          const numericValue = matchAt(scriptNumber, cursor, end);
          if (numericValue) {
            emit('number', cursor, cursor + numericValue.length, tokenLanguage);
            cursor += numericValue.length;
            previousValue = 'literal';
            continue;
          }
          const word = matchAt(identifier, cursor, end);
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
          const operator = source.startsWith('=>', cursor) ? '=>' : character;
          emit('punctuation', cursor, cursor + operator.length, tokenLanguage);
          cursor += operator.length;
          previousValue = operator;
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
            const number = matchAt(jsonNumber, cursor, end);
            const word = number ? '' : matchAt(identifier, cursor, end);
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

      function scanCss(start, end) {
        const firstTokenIndex = tokens.length;
        let cursor = start;
        while (cursor < end) {
          if (source.startsWith('/*', cursor)) {
            cursor = readComment(cursor, end, 'css', '*/');
            continue;
          }
          if (source[cursor] === '"' || source[cursor] === "'") {
            cursor = readQuoted(cursor, end, 'css');
            continue;
          }
          const number = matchAt(
            /(?:#[\da-fA-F]{3,8}\b|[+-]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][+-]?\d+)?(?:%|[a-zA-Z]+)?)/y,
            cursor,
            end,
          );
          const word = number ? '' : matchAt(cssIdentifier, cursor, end);
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
            cursor = readQuoted(cursor, end, 'html', false);
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

      function scanMarkup(start, end, scriptLanguage = '', depth = 0, singleElement = false) {
        let cursor = start;
        let nesting = 0;
        while (cursor < end) {
          if (source.startsWith('<!--', cursor)) {
            cursor = readComment(cursor, end, 'html', '-->');
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
              const openingText = source.slice(tagStart, cursor);
              const embeddedLanguage =
              tag.name === 'style'
              ? 'css'
              : tag.name !== 'script'
              ? 'text'
              : /\btype\s*=\s*["']?(?:application\/(?:ld\+)?json|importmap)\b/i.test(
                openingText,
              )
              ? 'json'
              : /\blang\s*=\s*["']?ts\b/i.test(openingText)
                ? 'ts'
                : /\btype\s*=\s*["']?text\/(?!javascript|ecmascript)/i.test(openingText)
                  ? 'text'
                  : 'js';
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

          function generalWordType(word, wordEnd, end, grammar) {
            const lookup = grammar.ignoreCase ? word.toLowerCase() : word;
            if (grammar.keywords.has(lookup)) return 'keyword';
            let nextOffset = wordEnd;
            while (nextOffset < end && /[^\S\n]/.test(source[nextOffset])) nextOffset++;
            if (grammar.keyAssignment && source[nextOffset] === grammar.keyAssignment) return 'attribute';
            if (source[nextOffset] === '(') return 'function';
            return 'identifier';
          }

          function scanGeneral(start, end, tokenLanguage, grammar) {
            let cursor = start;
            while (cursor < end) {
              const character = source[cursor];
              if (/\s/.test(character)) {
                const whitespaceStart = cursor++;
                while (cursor < end && /\s/.test(source[cursor])) cursor++;
                emit('text', whitespaceStart, cursor, tokenLanguage);
                continue;
              }
              const lineComment = grammar.lineComments.find((marker) =>
                source.startsWith(marker, cursor),
              );
              if (lineComment) {
                cursor = readLineComment(cursor, end, tokenLanguage, lineComment.length);
                continue;
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
              if (
                grammar.tripleQuotes &&
                (source.startsWith('"""', cursor) || source.startsWith("'''", cursor))
              ) {
                cursor = readTripleQuoted(cursor, end, tokenLanguage);
                continue;
              }
              if (grammar.quotes.includes(character)) {
                cursor =
                character === '`'
                ? readRawQuoted(cursor, end, tokenLanguage)
                : readQuoted(cursor, end, tokenLanguage);
                continue;
              }
              if (grammar.preprocessor && character === '#' && isLineStart(cursor)) {
                cursor = readDirective(cursor, end, tokenLanguage);
                continue;
              }
              const numericValue = matchAt(generalNumber, cursor, end);
              if (numericValue) {
                emit('number', cursor, cursor + numericValue.length, tokenLanguage);
                cursor += numericValue.length;
                continue;
              }
              const word = matchAt(identifier, cursor, end);
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

          function scan(start, end, tokenLanguage, depth = 0) {
            if (tokenLanguage === 'html') return scanMarkup(start, end, '', depth);
            if (tokenLanguage === 'css') return scanCss(start, end);
            if (tokenLanguage === 'json' || tokenLanguage === 'jsonc')
            return scanJson(start, end, tokenLanguage);
            if (tokenLanguage === 'text') return emit('text', start, end, tokenLanguage);
            const grammar = languages.grammar(tokenLanguage);
            if (grammar) return scanGeneral(start, end, tokenLanguage, grammar);
            return scanScript(start, end, tokenLanguage, depth);
          }

          scan(0, source.length, language);
          return tokens;
        }

        window.SynapseSyntaxTokenizer = Object.freeze({ tokenize });
    })();
