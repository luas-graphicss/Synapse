(function (root) {
    'use strict';

    const maximumItems = 100;
    const openingBrackets = Object.freeze({ '(': ')', '[': ']', '{': '}' });
    const closingBrackets = Object.freeze({ ')': '(', ']': '[', '}': '{' });
    const quoteCharacters = new Set(['"', "'", '`']);
    const blockCommentOpeners = Object.freeze(['/*', '<!--', '--[[']);
    const balancedLanguages = new Set([
        'js',
        'jsx',
        'ts',
        'tsx',
        'json',
        'jsonc',
        'css',
        'csharp',
        'java',
        'cpp',
        'go',
        'rust',
        'python',
        'php',
        'swift',
        'kotlin',
        'dart',
        'lua',
    ]);
    const voidElements = new Set([
        'area',
        'base',
        'br',
        'col',
        'embed',
        'hr',
        'img',
        'input',
        'link',
        'meta',
        'param',
        'source',
        'track',
        'wbr',
    ]);

    function languageOf(path) {
      const languages = root.SynapseEditorLanguages;
      return languages ? languages.fromPath(path) : 'text';
    }

    function supports(path) {
      return !!root.SynapseSyntaxTokenizer && languageOf(path) !== 'text';
    }

    function createPositionResolver(text) {
      const lineStarts = [0];
      for (let index = 0; index < text.length; index++)
      if (text[index] === '\n') lineStarts.push(index + 1);
      return function positionAt(offset) {
        let low = 0;
        let high = lineStarts.length - 1;
        while (low < high) {
          const middle = Math.ceil((low + high) / 2);
          if (lineStarts[middle] <= offset) low = middle;
          else high = middle - 1;
        }
        return { line: low + 1, column: offset - lineStarts[low] + 1 };
      };
    }

    function createItem(path, start, length, position, code, message) {
      return {
        path,
        start,
        length,
        line: position.line,
        column: position.column,
        severity: 'error',
        code,
        message,
      };
    }

    function isUnterminatedString(token, text) {
      if (token.type !== 'string' || token.closed !== false) return false;
      if (!quoteCharacters.has(text[token.start])) return false;
      return token.end >= text.length || text[token.end] === '\n' || text[token.end] === '\r';
    }

    function isUnterminatedComment(token, text) {
      if (token.type !== 'comment' || token.closed !== false) return false;
      return blockCommentOpeners.some((opener) => text.startsWith(opener, token.start));
    }

    function collectUnterminatedTokens(tokens, text, path, positionAt, items) {
      for (const token of tokens) {
        if (isUnterminatedString(token, text))
        items.push(
          createItem(
            path,
            token.start,
            1,
            positionAt(token.start),
            'STRUCTURE_UNTERMINATED_STRING',
            'Unterminated string',
          ),
        );
        else if (isUnterminatedComment(token, text))
        items.push(
          createItem(
            path,
            token.start,
            2,
            positionAt(token.start),
            'STRUCTURE_UNTERMINATED_COMMENT',
            'Unterminated comment',
          ),
        );
      }
    }

    function collectBracketProblems(tokens, text, path, positionAt, items) {
      const stack = [];
      for (const token of tokens) {
        if (token.type !== 'punctuation' || token.end - token.start !== 1) continue;
        if (!balancedLanguages.has(token.language)) continue;
        const character = text[token.start];
        if (openingBrackets[character]) {
          stack.push({ character, start: token.start });
          continue;
        }
        const expected = closingBrackets[character];
        if (!expected) continue;
        if (!stack.length || stack[stack.length - 1].character !== expected) {
          items.push(
            createItem(
              path,
              token.start,
              1,
              positionAt(token.start),
              'STRUCTURE_UNEXPECTED_BRACKET',
              'Unexpected closing "' + character + '"',
            ),
          );
          continue;
        }
        stack.pop();
      }
      for (const pending of stack)
      items.push(
        createItem(
          path,
          pending.start,
          1,
          positionAt(pending.start),
          'STRUCTURE_MISSING_BRACKET',
          'Missing closing "' + openingBrackets[pending.character] + '"',
        ),
      );
    }

    function isSelfClosingTag(tokens, tagIndex, text) {
      for (let index = tagIndex + 1; index < tokens.length; index++) {
        const token = tokens[index];
        if (token.type !== 'punctuation' || token.language !== 'html') continue;
        const punctuation = text.slice(token.start, token.end);
        if (punctuation === '/>') return true;
        if (punctuation === '>') return false;
      }
      return false;
    }

    function lastOpenIndex(stack, name) {
      for (let index = stack.length - 1; index >= 0; index--) if (stack[index] === name) return index;
      return -1;
    }

    function collectMarkupProblems(tokens, text, path, positionAt, items) {
      const stack = [];
      for (let index = 0; index < tokens.length; index++) {
        const token = tokens[index];
        if (token.type !== 'tag' || token.language !== 'html') continue;
        const name = text.slice(token.start, token.end).toLowerCase();
        if (!name || voidElements.has(name)) continue;
        const opener = tokens[index - 1];
        const isClosing = !!opener && text.slice(opener.start, opener.end).includes('/');
        if (!isClosing) {
          if (!isSelfClosingTag(tokens, index, text)) stack.push(name);
          continue;
        }
        const openIndex = lastOpenIndex(stack, name);
        if (openIndex < 0) {
          items.push(
            createItem(
              path,
              token.start,
              Math.max(1, token.end - token.start),
              positionAt(token.start),
              'STRUCTURE_UNMATCHED_TAG',
              'Closing tag "' + name + '" has no matching opening tag',
            ),
          );
          continue;
        }
        stack.length = openIndex;
      }
    }

    function analyze(path, text) {
      const languages = root.SynapseEditorLanguages;
      const tokenizer = root.SynapseSyntaxTokenizer;
      if (!languages || !tokenizer || typeof text !== 'string') return null;
      const language = languages.fromPath(path);
      if (language === 'text' || languages.isLarge(text)) return null;
      const tokens = tokenizer.tokenize(text, language);
      const positionAt = createPositionResolver(text);
      const items = [];
      collectUnterminatedTokens(tokens, text, path, positionAt, items);
      collectBracketProblems(tokens, text, path, positionAt, items);
      if (language === 'html') collectMarkupProblems(tokens, text, path, positionAt, items);
      items.sort((first, second) => first.start - second.start);
      return { language, total: items.length, items: items.slice(0, maximumItems) };
    }

    root.SynapseStructureDiagnostics = Object.freeze({ supports, analyze });
})(globalThis);
