(function (root) {
    'use strict';

    const keywords = new Set(('const let var function return if else for while do switch case break continue new class extends super this import export from default async await try catch finally throw typeof instanceof in of delete void yield static get set null true false undefined NaN interface type implements enum public private protected readonly abstract declare namespace as satisfies keyof infer never unknown any boolean number string').split(' '));
    const escapeCharacters = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    const scriptTokens = /\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)|"(?:\\[\s\S]|[^"\\])*"?|'(?:\\[\s\S]|[^'\\])*'?|`(?:\\[\s\S]|[^`\\])*`?|\b(?:0[xX][\da-fA-F_]+n?|0[bB][01_]+n?|0[oO][0-7_]+n?|\d[\d_]*(?:\.[\d_]*)?(?:[eE][+-]?[\d_]+)?n?)\b|\b[A-Za-z_$][\w$]*\b/g;
const jsonTokens = /"(?:\\[\s\S]|[^"\\])*"?|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|\b(?:true|false|null)\b/g;
const cssTokens = /\/\*[\s\S]*?(?:\*\/|$)|"(?:\\[\s\S]|[^"\\])*"?|'(?:\\[\s\S]|[^'\\])*'?|#[\da-fA-F]{3,8}\b|[-+]?(?:\d*\.\d+|\d+)(?:[a-zA-Z]+|%)?|--[\w-]+|[.#@]?[A-Za-z_-][\w-]*/g;

function escapeText(text) {
  return String(text).replace(/[&<>"']/g, (character) => escapeCharacters[character]);
    }

    function wrapToken(text, kind) {
      return kind ? '<span class="tk-' + kind + '">' + escapeText(text) + '</span>' : escapeText(text);
    }

    function renderTokens(source, expression, classify) {
      const output = [];
      let cursor = 0;
      expression.lastIndex = 0;
      for (const match of source.matchAll(expression)) {
        output.push(escapeText(source.slice(cursor, match.index)));
        output.push(wrapToken(match[0], classify(match[0], match.index, source)));
        cursor = match.index + match[0].length;
      }
      output.push(escapeText(source.slice(cursor)));
      return output.join('');
    }

    function highlightScript(source) {
      return renderTokens(source, scriptTokens, (token, offset, text) => {
          if (token.startsWith('//') || token.startsWith('/*')) return 'com';
          if (/^["'`]/.test(token)) return 'str';
              if (/^\d/.test(token)) return 'num';
              if (keywords.has(token)) return 'key';
              return /^\s*\(/.test(text.slice(offset + token.length)) ? 'fn' : '';
            });
          }

          function highlightJson(source) {
            return renderTokens(source, jsonTokens, (token, offset, text) => {
                if (token.startsWith('"')) return /^\s*:/.test(text.slice(offset + token.length)) ? 'attr' : 'str';
                return /^(true|false|null)$/.test(token) ? 'key' : 'num';
            });
          }

          function highlightCss(source) {
            return renderTokens(source, cssTokens, (token, offset, text) => {
                if (token.startsWith('/*')) return 'com';
                if (/^["']/.test(token)) return 'str';
                    if (/^#[\da-fA-F]{3,8}$/.test(token) || /^[-+]?(?:\d|\.\d)/.test(token)) return 'num';
                    if (/^\s*:/.test(text.slice(offset + token.length)) || token.startsWith('--')) return 'attr';
                    return 'tag';
                });
              }

              function findTagEnd(source, offset) {
                let quote = '';
                for (let index = offset; index < source.length; index++) {
                  const character = source[index];
                  if (quote) {
                    if (character === quote) quote = '';
                  } else if (character === '"' || character === "'") quote = character;
                  else if (character === '>') return index + 1;
                }
                return source.length;
              }

              function highlightTag(tag) {
                const opening = tag.match(/^<\/?([A-Za-z][\w:.-]*)/);
                if (!opening) return escapeText(tag);
                const prefixLength = opening[0].length - opening[1].length;
                const attributes = tag.slice(opening[0].length);
                return escapeText(tag.slice(0, prefixLength)) + wrapToken(opening[1], 'tag') + renderTokens(attributes, /"[^\"]*"?|'[^']*'?|[^\s=<>/]+/g, (token) => /^["']/.test(token) ? 'str' : 'attr');
          }

          function highlightHtml(source) {
            const output = [];
            let cursor = 0;
            while (cursor < source.length) {
              const opening = source.indexOf('<', cursor);
              if (opening < 0) {
                output.push(escapeText(source.slice(cursor)));
                break;
              }
              output.push(escapeText(source.slice(cursor, opening)));
              if (source.startsWith('<!--', opening)) {
                const closing = source.indexOf('-->', opening + 4);
                cursor = closing < 0 ? source.length : closing + 3;
                output.push(wrapToken(source.slice(opening, cursor), 'com'));
                continue;
              }
              if (!/^<\/?[A-Za-z!]/.test(source.slice(opening, opening + 4))) {
                output.push('&lt;');
                cursor = opening + 1;
                continue;
              }
              cursor = findTagEnd(source, opening + 1);
              const tag = source.slice(opening, cursor);
              output.push(highlightTag(tag));
              const rawTag = tag.match(/^<(script|style)\b/i);
              if (rawTag && !/\/\s*>$/.test(tag)) {
                const closingExpression = new RegExp('</' + rawTag[1] + '\\s*>', 'gi');
                closingExpression.lastIndex = cursor;
                const closing = closingExpression.exec(source);
                const end = closing ? closing.index : source.length;
                const body = source.slice(cursor, end);
                output.push(rawTag[1].toLowerCase() === 'style' ? highlightCss(body) : highlightScript(body));
                cursor = end;
              }
            }
            return output.join('');
          }

          function highlight(source, language) {
            const renderers = { js: highlightScript, css: highlightCss, json: highlightJson, html: highlightHtml };
            return (renderers[language] || escapeText)(String(source));
          }

          root.SynapseSyntax = Object.freeze({ highlight, highlightScript, highlightCss, highlightJson, highlightHtml });
      })(globalThis);
