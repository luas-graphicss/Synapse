(function (root) {
    'use strict';

    const ANSI_ESCAPE_SEQUENCE = /\u001b\[[0-9;?]*[ -/]*[@-~]|\u001b[@-Z\\-_]|\u009b[0-9;?]*[ -/]*[@-~]/g;
      const WINDOWS_LINE_BREAK = /\r\n?/g;
      const REMOVABLE_LOW_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;
      const HIGH_CONTROL = /[\u0080-\u009f]/;
      const OUTSIDE_LATIN1 = /[^\u0000-\u00ff]/;
      const UTF8_READ_AS_LATIN1 = /[\u00c2-\u00f4][\u0080-\u00bf]/;
      const REPLACEMENT_CHARACTER_RUN = /\ufffd{2,}/g;
      const TRAILING_WHITESPACE = /[ \t]+$/gm;

      const CODE_PAGE_850_HIGH_RANGE = [
        '\u00c7\u00fc\u00e9\u00e2\u00e4\u00e0\u00e5\u00e7\u00ea\u00eb\u00e8\u00ef\u00ee\u00ec\u00c4\u00c5',
        '\u00c9\u00e6\u00c6\u00f4\u00f6\u00f2\u00fb\u00f9\u00ff\u00d6\u00dc\u00f8\u00a3\u00d8\u00d7\u0192',
        '\u00e1\u00ed\u00f3\u00fa\u00f1\u00d1\u00aa\u00ba\u00bf\u00ae\u00ac\u00bd\u00bc\u00a1\u00ab\u00bb',
        '\u2591\u2592\u2593\u2502\u2524\u00c1\u00c2\u00c0\u00a9\u2563\u2551\u2557\u255d\u00a2\u00a5\u2510',
        '\u2514\u2534\u252c\u251c\u2500\u253c\u00e3\u00c3\u255a\u2554\u2569\u2566\u2560\u2550\u256c\u00a4',
        '\u00f0\u00d0\u00ca\u00cb\u00c8\u0131\u00cd\u00ce\u00cf\u2518\u250c\u2588\u2584\u00a6\u00cc\u2580',
        '\u00d3\u00df\u00d4\u00d2\u00f5\u00d5\u00b5\u00fe\u00de\u00da\u00db\u00d9\u00fd\u00dd\u00af\u00b4',
        '\u00ad\u00b1\u2017\u00be\u00b6\u00a7\u00f7\u00b8\u00b0\u00a8\u00b7\u00b9\u00b3\u00b2\u25a0\u00a0',
      ].join('');

      const FIRST_HIGH_BYTE = 128;

      function removeAnsiSequences(text) {
        return text.replace(ANSI_ESCAPE_SEQUENCE, '');
      }

      function normalizeLineBreaks(text) {
        return text.replace(WINDOWS_LINE_BREAK, '\n');
      }

      function looksLikeSingleByteText(text) {
        return !OUTSIDE_LATIN1.test(text);
      }

      function toSingleByteArray(text) {
        const bytes = new Uint8Array(text.length);
        for (let index = 0; index < text.length; index++) bytes[index] = text.charCodeAt(index);
        return bytes;
      }

      function repairUtf8ReadAsLatin1(text) {
        if (!UTF8_READ_AS_LATIN1.test(text) || !looksLikeSingleByteText(text)) return text;
        try {
          return new TextDecoder('utf-8', { fatal: true }).decode(toSingleByteArray(text));
        } catch {
          return text;
        }
      }

      function repairOemCodePageReadAsLatin1(text) {
        if (!HIGH_CONTROL.test(text) || !looksLikeSingleByteText(text)) return text;
        let repaired = '';
        for (let index = 0; index < text.length; index++) {
          const code = text.charCodeAt(index);
          repaired +=
          code >= FIRST_HIGH_BYTE ? CODE_PAGE_850_HIGH_RANGE[code - FIRST_HIGH_BYTE] : text[index];
        }
        return repaired;
      }

      function removeRemainingControlCharacters(text) {
        return text.replace(REMOVABLE_LOW_CONTROL, '').replace(HIGH_CONTROL, '');
      }

      function collapseReplacementCharacters(text) {
        return text.replace(REPLACEMENT_CHARACTER_RUN, '\ufffd');
      }

      function trimTrailingWhitespace(text) {
        return text.replace(TRAILING_WHITESPACE, '');
      }

      function repair(value) {
        if (typeof value !== 'string' || !value) return value;
        let text = removeAnsiSequences(value);
        text = normalizeLineBreaks(text);
        text = repairUtf8ReadAsLatin1(text);
        text = repairOemCodePageReadAsLatin1(text);
        text = removeRemainingControlCharacters(text);
        text = collapseReplacementCharacters(text);
        return trimTrailingWhitespace(text);
      }

      function needsRepair(value) {
        if (typeof value !== 'string' || !value) return false;
        return repair(value) !== value;
      }

      root.SynapseAgentTextEncoding = Object.freeze({ repair, needsRepair });
  })(typeof globalThis !== 'undefined' ? globalThis : window);
