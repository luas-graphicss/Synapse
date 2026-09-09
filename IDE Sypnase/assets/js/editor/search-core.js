(function (root) {
    'use strict';

    const maximumDisplayedMatches = 1000;
    const maximumProcessedMatches = 1000000;

    function buildExpression(options) {
      if (!options.query) return null;
      const source = options.regex ? options.query : options.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const wordBoundary = '[\\p{L}\\p{N}\\p{M}_$]';
      const pattern = options.wholeWord ? '(?<!' + wordBoundary + ')(?:' + source + ')(?!' + wordBoundary + ')' : source;
      return new RegExp(pattern, 'gmu' + (options.caseSensitive ? '' : 'i'));
    }

    function advanceIndex(text, index) {
      const codePoint = text.codePointAt(index);
      return index + (codePoint > 0xffff ? 2 : 1);
    }

    function expandReplacement(template, match, text) {
      return template.replace(/\$(\$|&|`|'|<[^>]*>|\d{1,2})/g, (token, symbol) => {
			if (symbol === '$') return '$';
			if (symbol === '&') return match[0];
			if (symbol === '`') return text.slice(0, match.index);
          if (symbol === "'") return text.slice(match.index + match[0].length);
          if (symbol.startsWith('<')) return match.groups ? match.groups[symbol.slice(1, -1)] || '' : token;
          const group = Number(symbol);
          if (group > 0 && group < match.length) return match[group] || '';
          const firstDigit = Number(symbol[0]);
          if (symbol.length === 2 && firstDigit > 0 && firstDigit < match.length) return (match[firstDigit] || '') + symbol[1];
          return token;
      });
    }

    function execute(options) {
      const expression = buildExpression(options);
      const result = { items: [], total: 0, fileCount: 0, truncated: false, patches: [] };
      if (!expression) return result;
      for (const file of options.files || []) {
        if (typeof file.text !== 'string') continue;
        expression.lastIndex = 0;
        let match;
        let count = 0;
        let line = 1;
        let lineStart = 0;
        let nextLine = file.text.indexOf('\n');
        let selectedMatch = null;
        while ((match = expression.exec(file.text))) {
          count++;
          result.total++;
          if (result.total > maximumProcessedMatches) throw new Error('A busca excedeu o limite de ocorrências. Refine a expressão.');
          if (options.mode === 'replace-one' && file.path === options.path && match.index === options.index) selectedMatch = match;
          if (result.items.length < maximumDisplayedMatches) {
            while (nextLine >= 0 && nextLine < match.index) {
              line++;
              lineStart = nextLine + 1;
              nextLine = file.text.indexOf('\n', lineStart);
            }
            result.items.push({ path: file.path, index: match.index, end: match.index + match[0].length, line, column: match.index - lineStart + 1, preview: file.text.slice(lineStart, nextLine < 0 ? undefined : nextLine).slice(0, 180) });
          }
          if (match[0].length === 0) expression.lastIndex = advanceIndex(file.text, expression.lastIndex);
        }
        if (count) result.fileCount++;
        let after = file.text;
        let replacedCount = 0;
        if (options.mode === 'replace-all' && count) {
          expression.lastIndex = 0;
          after = file.text.replace(expression, options.regex ? options.replacement : () => options.replacement);
          replacedCount = count;
        } else if (options.mode === 'replace-one' && selectedMatch) {
          const replacement = options.regex ? expandReplacement(options.replacement, selectedMatch, file.text) : options.replacement;
          after = file.text.slice(0, selectedMatch.index) + replacement + file.text.slice(selectedMatch.index + selectedMatch[0].length);
          replacedCount = 1;
        }
        if (after !== file.text) result.patches.push({ path: file.path, before: file.text, after, count: replacedCount });
      }
      result.truncated = result.total > result.items.length;
      return result;
    }

    root.SynapseSearchCore = Object.freeze({ buildExpression, execute });
})(globalThis);
