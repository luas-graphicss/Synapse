(function () {
    'use strict';

    function indexAtOffset(starts, offset) {
      let lower = 0;
      let upper = starts.length - 1;
      while (lower < upper) {
        const middle = Math.ceil((lower + upper) / 2);
        if (starts[middle] <= offset) lower = middle;
        else upper = middle - 1;
      }
      return lower;
    }

    function create(source, regions, collapsedLines) {
      const normalizedSource = source.replace(/\r\n?/g, '\n');
      const sourceLines = normalizedSource.split('\n');
      const sourceStarts = [];
      let offset = 0;
      for (const line of sourceLines) {
        sourceStarts.push(offset);
        offset += line.length + 1;
      }
      const visibleLines = [];
      const displayStarts = [];
      const displayLines = [];
      offset = 0;
      for (let index = 0; index < sourceLines.length; index += 1) {
        visibleLines.push(index);
        displayStarts.push(offset);
        displayLines.push(sourceLines[index]);
        offset += sourceLines[index].length + 1;
        const end = regions.get(index);
        if (collapsedLines.has(index) && Number.isInteger(end) && end > index) {
          index = Math.min(end, sourceLines.length - 1);
        }
      }
      const text = displayLines.join('\n');

      function toSourceOffset(displayOffset) {
        const clamped = Math.max(0, Math.min(text.length, displayOffset));
        const visibleIndex = indexAtOffset(displayStarts, clamped);
        const sourceLine = visibleLines[visibleIndex];
        return (
          sourceStarts[sourceLine] +
          Math.min(sourceLines[sourceLine].length, clamped - displayStarts[visibleIndex])
        );
      }

      function toDisplayOffset(sourceOffset) {
        const clamped = Math.max(0, Math.min(normalizedSource.length, sourceOffset));
        const sourceLine = indexAtOffset(sourceStarts, clamped);
        const visibleIndex = indexAtOffset(visibleLines, sourceLine);
        const visibleLine = visibleLines[visibleIndex];
        const column =
        visibleLine === sourceLine
        ? clamped - sourceStarts[sourceLine]
        : sourceLines[visibleLine].length;
        return displayStarts[visibleIndex] + Math.min(sourceLines[visibleLine].length, column);
      }

      function toSourceRange(displayStart, displayEnd) {
        const selectsEntireDisplay =
        displayStart === 0 && displayEnd === text.length && displayEnd > displayStart;
        return {
          start: toSourceOffset(displayStart),
          end: selectsEntireDisplay ? normalizedSource.length : toSourceOffset(displayEnd),
        };
      }

      return {
        source: normalizedSource,
        text,
        sourceLines,
        sourceStarts,
        visibleLines,
        displayStarts,
        regions,
        collapsedLines,
        toSourceOffset,
        toDisplayOffset,
        toSourceRange,
      };
    }

    function recoverInput(projection, editedDisplay) {
      const before = projection.text;
      let start = 0;
      while (
        start < before.length &&
        start < editedDisplay.length &&
        before[start] === editedDisplay[start]
      )
      start += 1;
      let oldEnd = before.length;
      let newEnd = editedDisplay.length;
      while (oldEnd > start && newEnd > start && before[oldEnd - 1] === editedDisplay[newEnd - 1]) {
        oldEnd -= 1;
        newEnd -= 1;
      }
      const { start: sourceStart, end: sourceEnd } = projection.toSourceRange(start, oldEnd);
      if (sourceEnd - sourceStart !== oldEnd - start) return null;
      const inserted = editedDisplay.slice(start, newEnd);
      return {
        text: projection.source.slice(0, sourceStart) + inserted + projection.source.slice(sourceEnd),
        caret: sourceStart + inserted.length,
      };
    }

    window.EditorFoldProjection = Object.freeze({ create, recoverInput });
})();
