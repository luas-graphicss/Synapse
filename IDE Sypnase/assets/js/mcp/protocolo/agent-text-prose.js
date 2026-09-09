(function (root) {
    'use strict';

    const WHITESPACE_RUN = /\s+/g;
    const SPACE_BEFORE_PUNCTUATION = / +([,;:.!?])/g;
    const SPACE_AFTER_OPEN_BRACKET = /([([{]) +/g;
          const SPACE_BEFORE_CLOSE_BRACKET = / +([)\]}])/g;
    const REPEATED_OPEN_BRACKET = /([([{]) *\1+/g;
          const REPEATED_CLOSE_BRACKET = /([)\]}]) *\1+/g;
    const REPEATED_SEPARATOR = /([,;:]){2,}/g;
    const REPEATED_DASH = /\u2014{2,}/g;
    const REPEATED_ELLIPSIS = /\u2026{2,}/g;
    const DOTS_BEFORE_ELLIPSIS = /\.+\u2026/g;
    const EMPTY_BRACKET_PAIR = /\(\s*\)|\[\s*\]|\{\s*\}/g;
    const DANGLING_TAIL = /[\s,;:.\-\u2013\u2014([{]+$/;
          const OPEN_TO_CLOSE = { '(': ')', '[': ']', '{': '}' };
          const CLOSE_TO_OPEN = { ')': '(', ']': '[', '}': '{' };
          const ELLIPSIS = '\u2026';
          const EM_DASH = '\u2014';
          const BACKTICK = '`';
          const MINIMUM_SENTENCE_LENGTH = 20;
          const WORD_BOUNDARY_TOLERANCE = 0.6;

          function collapseWhitespace(text) {
            return text.replace(WHITESPACE_RUN, ' ').trim();
          }

          function collapseRepeatedPunctuation(text) {
            return text
            .replace(REPEATED_OPEN_BRACKET, '$1')
            .replace(REPEATED_CLOSE_BRACKET, '$1')
            .replace(REPEATED_SEPARATOR, '$1')
            .replace(REPEATED_DASH, EM_DASH)
            .replace(REPEATED_ELLIPSIS, ELLIPSIS)
            .replace(DOTS_BEFORE_ELLIPSIS, ELLIPSIS);
          }

          function tightenSpacing(text) {
            return text
            .replace(SPACE_BEFORE_PUNCTUATION, '$1')
            .replace(SPACE_AFTER_OPEN_BRACKET, '$1')
            .replace(SPACE_BEFORE_CLOSE_BRACKET, '$1');
          }

          function findUnbalancedBracketPositions(text) {
            const openPositions = [];
            const unbalanced = new Set();
            for (let index = 0; index < text.length; index++) {
              const character = text[index];
              if (OPEN_TO_CLOSE[character]) {
                openPositions.push(index);
                continue;
              }
              if (!CLOSE_TO_OPEN[character]) continue;
              const expectedOpen = CLOSE_TO_OPEN[character];
              let matchedSlot = -1;
              for (let slot = openPositions.length - 1; slot >= 0; slot--) {
                if (text[openPositions[slot]] === expectedOpen) {
                  matchedSlot = slot;
                  break;
                }
              }
              if (matchedSlot === -1) unbalanced.add(index);
              else openPositions.splice(matchedSlot, 1);
            }
            for (const position of openPositions) unbalanced.add(position);
            return unbalanced;
          }

          function dropUnbalancedBrackets(text) {
            const unbalanced = findUnbalancedBracketPositions(text);
            if (!unbalanced.size) return text;
            let result = '';
            for (let index = 0; index < text.length; index++) {
              if (!unbalanced.has(index)) result += text[index];
            }
            return result;
          }

          function clean(value) {
            if (typeof value !== 'string' || !value) return '';
            let text = collapseWhitespace(value);
            text = collapseRepeatedPunctuation(text);
            text = dropUnbalancedBrackets(text);
            text = text.replace(EMPTY_BRACKET_PAIR, '');
            return collapseWhitespace(tightenSpacing(text));
          }

          function clampAtWordBoundary(text, maximumLength) {
            const limit = Math.max(1, maximumLength - 1);
            const head = text.slice(0, limit);
            const lastSpace = head.lastIndexOf(' ');
            const kept = lastSpace > limit * WORD_BOUNDARY_TOLERANCE ? head.slice(0, lastSpace) : head;
            return kept.replace(DANGLING_TAIL, '') + ELLIPSIS;
          }

          function clamp(value, maximumLength) {
            const text = clean(value);
            if (!text || !Number.isFinite(maximumLength) || text.length <= maximumLength) return text;
            return clean(clampAtWordBoundary(text, maximumLength)) + '';
          }

          function sentenceEndIndex(text) {
            let bracketDepth = 0;
            let insideCode = false;
            for (let index = 0; index < text.length; index++) {
              const character = text[index];
              if (character === BACKTICK) insideCode = !insideCode;
              else if (OPEN_TO_CLOSE[character]) bracketDepth++;
              else if (CLOSE_TO_OPEN[character] && bracketDepth > 0) bracketDepth--;
              if (insideCode || bracketDepth > 0 || index < MINIMUM_SENTENCE_LENGTH) continue;
              const nextCharacter = text[index + 1];
              const previousCharacter = text[index - 1];
              const endsStatement = (character === '.' || character === ';') && nextCharacter === ' ';
              const endsClause =
              character === EM_DASH && previousCharacter === ' ' && nextCharacter === ' ';
              if (endsStatement || endsClause) return index;
            }
            return -1;
          }

          function firstSentence(value, maximumLength) {
            const text = clean(value);
            if (!text) return '';
            const endIndex = sentenceEndIndex(text);
            const sentence = endIndex === -1 ? text : text.slice(0, endIndex);
            return clamp(sentence, maximumLength);
          }

          root.SynapseAgentTextProse = Object.freeze({ clean, clamp, firstSentence });
      })(typeof globalThis !== 'undefined' ? globalThis : window);
