(function () {
    'use strict';

    const tokenClasses = Object.freeze({
        keyword: 'tk-key',
        string: 'tk-str',
        regex: 'tk-str',
        number: 'tk-num',
        comment: 'tk-com',
        tag: 'tk-tag',
        attribute: 'tk-attr',
        punctuation: 'tk-punc',
        function: 'tk-fn',
    });
    const escapedCharacters = Object.freeze({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    });

    function escapeMarkup(value) {
      return value.replace(/[&<>"']/g, (character) => escapedCharacters[character]);
        }

        function highlight(input, language) {
          const source = String(input ?? '');
          if (window.SynapseEditorLanguages.isLarge(source)) return escapeMarkup(source);
          const tokens = window.SynapseSyntaxTokenizer.tokenize(source, language);
          if (tokens.length > 40000) return escapeMarkup(source);
          return tokens
          .map((token) => {
              const text = escapeMarkup(source.slice(token.start, token.end));
              const className = tokenClasses[token.type];
              return className && text ? `<span class="${className}">${text}</span>` : text;
          })
          .join('');
        }

        window.SynapseSyntaxHighlighter = Object.freeze({ highlight });
        window.SynapseSyntax = Object.freeze({
            highlight,
            highlightScript: (source) => highlight(source, 'js'),
            highlightCss: (source) => highlight(source, 'css'),
            highlightJson: (source) => highlight(source, 'json'),
            highlightHtml: (source) => highlight(source, 'html'),
        });
    })();
