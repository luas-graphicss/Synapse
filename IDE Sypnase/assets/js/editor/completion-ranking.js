(function () {
    'use strict';

    const exactPrefixScore = 1000;
    const ignoredCasePrefixScore = 820;
    const initialsScore = 640;
    const subsequenceScore = 420;
    const gapPenalty = 6;
    const maximumGapPenalty = 260;
    const priorityPenalty = 45;
    const defaultPriority = 2;
    const defaultDistance = 4000;
    const distanceDivisor = 500;
    const maximumDistancePenalty = 40;
    const repetitionBonus = 4;
    const maximumRepetitionBonus = 32;
    const lengthDivisor = 10;

    function isWordBoundary(label, index) {
      if (index === 0) return true;
      const previous = label[index - 1];
      const current = label[index];
      if (previous === '_' || previous === '-' || previous === '.') return true;
      return (
        previous === previous.toLowerCase() &&
        current === current.toUpperCase() &&
        current !== current.toLowerCase()
      );
    }

    function findSubsequence(prefix, label) {
      const lowerLabel = label.toLowerCase();
      let searchIndex = 0;
      let gaps = 0;
      let boundaries = 0;
      for (const character of prefix.toLowerCase()) {
        const found = lowerLabel.indexOf(character, searchIndex);
        if (found === -1) return null;
        gaps += found - searchIndex;
        if (isWordBoundary(label, found)) boundaries += 1;
        searchIndex = found + 1;
      }
      return { gaps, boundaries };
    }

    function match(prefix, label) {
      if (typeof label !== 'string' || !label) return null;
      const text = typeof prefix === 'string' ? prefix : '';
      if (!text) return 0;
      if (text.length > label.length) return null;
      if (label.startsWith(text)) return exactPrefixScore;
      if (label.toLowerCase().startsWith(text.toLowerCase())) return ignoredCasePrefixScore;
      const found = findSubsequence(text, label);
      if (!found) return null;
      const base = found.boundaries === text.length ? initialsScore : subsequenceScore;
      return base - Math.min(found.gaps * gapPenalty, maximumGapPenalty);
    }

    function score(item, prefix) {
      const matched = match(prefix, item?.label);
      if (matched === null) return null;
      const priority = Number.isFinite(item.priority) ? item.priority : defaultPriority;
      const distance = Number.isFinite(item.distance) ? item.distance : defaultDistance;
      const repetitions = Number.isFinite(item.count) ? item.count : 0;
      return (
        matched -
        priority * priorityPenalty -
        Math.min(distance / distanceDivisor, maximumDistancePenalty) +
        Math.min(repetitions * repetitionBonus, maximumRepetitionBonus) -
        item.label.length / lengthDivisor
      );
    }

    function sort(items, prefix = '') {
      return items
      .map((item) => ({ item, value: score(item, prefix) }))
      .filter((entry) => entry.value !== null)
      .sort(
        (first, second) =>
        second.value - first.value ||
        first.item.label.localeCompare(second.item.label, 'en'),
      )
      .map((entry) => entry.item);
    }

    window.SynapseCompletionRanking = Object.freeze({ match, sort });
})();
