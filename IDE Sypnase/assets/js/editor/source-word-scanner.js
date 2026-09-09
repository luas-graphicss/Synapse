(function () {
    'use strict';

    const maximumSourceLength = 250000;
    const maximumWords = 4000;
    const memberLookBehind = 64;
    const memberPattern = /([\w$]+)\s*([.:])\s*$/;
    const digitStartPattern = /^\d/;

    function findLineEnd(source, start) {
      const lineBreak = source.indexOf('\n', start);
      return lineBreak === -1 ? source.length : lineBreak;
    }

    function readQuoted(source, start, quote, escapeCharacter) {
      let index = start + 1;
      while (index !== source.length) {
        const character = source[index];
        if (character === escapeCharacter) {
          index += 2;
          continue;
        }
        if (character === '\n') return { end: index, closed: false };
        if (character === quote) return { end: index + 1, closed: true };
        index += 1;
      }
      return { end: source.length, closed: false };
    }

    function isCaretInside(position, start, end, closed) {
      if (position === start || start > position) return false;
      return closed ? end > position : end >= position;
    }

    function receiverBefore(source, start, profile) {
      const before = source.slice(Math.max(0, start - memberLookBehind), start);
      const member = memberPattern.exec(before);
      if (!member || !profile.memberOperators.includes(member[2])) return { name: '', operator: '' };
      return { name: member[1], operator: member[2] };
    }

    function scan({ source = '', profile = null, position = -1 } = {}) {
      if (typeof source !== 'string' || !profile || source.length > maximumSourceLength) return null;
      const wordPattern = profile.wordPattern;
      const words = new Map();
      let caretInText = false;
      let index = 0;

      function registerWord(text, start, end) {
        if (position >= start && end >= position) return;
        if (text.length === 1 || digitStartPattern.test(text)) return;
        const distance = Math.abs(start - position);
        const existing = words.get(text);
        if (existing) {
          existing.count += 1;
          if (existing.distance > distance) existing.distance = distance;
          return;
        }
        if (words.size === maximumWords) return;
        words.set(text, {
            text,
            count: 1,
            distance,
            receiver: receiverBefore(source, start, profile).name,
        });
      }

      while (index !== source.length) {
        const blockComment = profile.blockComments.find((pair) => source.startsWith(pair[0], index));
        if (blockComment) {
          const closingIndex = source.indexOf(blockComment[1], index + blockComment[0].length);
          const closed = closingIndex !== -1;
          const end = closed ? closingIndex + blockComment[1].length : source.length;
          if (isCaretInside(position, index, end, closed)) caretInText = true;
          index = end;
          continue;
        }
        const lineComment = profile.lineComments.find((marker) => source.startsWith(marker, index));
        if (lineComment) {
          const end = findLineEnd(source, index);
          if (isCaretInside(position, index, end, false)) caretInText = true;
          index = end;
          continue;
        }
        const character = source[index];
        if (profile.quotes.includes(character)) {
          const quoted = readQuoted(source, index, character, profile.escapeCharacter);
          if (isCaretInside(position, index, quoted.end, quoted.closed)) caretInText = true;
          index = quoted.end;
          continue;
        }
        if (wordPattern.test(character)) {
          let end = index;
          while (end !== source.length && wordPattern.test(source[end])) end += 1;
          registerWord(source.slice(index, end), index, end);
          index = end;
          continue;
        }
        index += 1;
      }
      return { caretInText, words: [...words.values()] };
    }

    function caretContext({ source = '', profile = null, position = 0 } = {}) {
      if (typeof source !== 'string' || !profile) return null;
      if (!Number.isInteger(position) || 0 > position || position > source.length) return null;
      const wordPattern = profile.wordPattern;
      let start = position;
      let end = position;
      while (start !== 0 && wordPattern.test(source[start - 1])) start -= 1;
      while (end !== source.length && wordPattern.test(source[end])) end += 1;
      const member = receiverBefore(source, start, profile);
      return {
        start,
        end,
        prefix: source.slice(start, position),
        word: source.slice(start, end),
        receiver: member.name,
        operator: member.operator,
      };
    }

    window.SynapseSourceWordScanner = Object.freeze({ scan, caretContext });
})();
