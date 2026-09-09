(function () {
    'use strict';

    const catalog = window.SynapseEditorLanguages;
    const ranking = window.SynapseCompletionRanking;
    const inactiveTokenTypes = new Set(['string', 'comment', 'regex']);
    const wordCharacters = /[$_\u200c\u200d\p{ID_Continue}]/u;
    const markupWordCharacters = /[\w:.$-]/;
    const cssWordCharacters = /[\w$-]/;

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
      const prefix = source.slice(start, position);
      const precedingText = source.slice(0, start);
      const candidates = new Map();
      const normalizedPrefix = markupLanguage ? prefix.toLowerCase() : prefix;

      function add(label, kind, priority = 2) {
        if (typeof label !== 'string' || !label || label.length > 160) return;
        const comparison = markupLanguage ? label.toLowerCase() : label;
        if (label === source.slice(start, end)) return;
        if (ranking.match(normalizedPrefix, comparison) === null) return;
        if (candidates.has(label) && candidates.get(label).priority <= priority) return;
        candidates.set(label, { label, insertText: label, kind, priority });
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

      let trigger = '';
      if (language === 'html') {
        const unfinishedTag = /<\/?[\w:.-]*$/.exec(source.slice(0, position));
        if (unfinishedTag) {
          trigger = '<';
          addWords(catalog.htmlTags, 'tag');
          for (const token of tokens)
          if (token.type === 'tag') add(source.slice(token.start, token.end), 'tag', 1);
        } else if (/<[A-Za-z][^<>]*\s[^<>]*$/.test(source.slice(0, position))) {
          if (/[\w:-]+\s*=\s*[^\s<>]*$/.test(source.slice(0, position))) return null;
          addWords(catalog.htmlAttributes, 'attribute');
          if (fileLanguage === 'jsx' || fileLanguage === 'tsx')
          addWords('className htmlFor onClick onChange onSubmit onInput key ref', 'attribute', 1);
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
          addWords(catalog.cssProperties, 'property');
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

      if (!explicit && prefix.length < 2 && !trigger) return null;
      const items = ranking.sort([...candidates.values()], normalizedPrefix).slice(0, 40);
      return items.length ? { start, end, position, prefix, language, items } : null;
    }

    window.SynapseCompletionProvider = Object.freeze({ getCompletions });
})();
