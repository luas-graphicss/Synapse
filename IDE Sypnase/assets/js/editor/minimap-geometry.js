(function () {
    'use strict';

    function clamp(value, minimum, maximum) {
      return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
    }

    function measure(viewportHeight, contentHeight, lineCount, scrollTop) {
      const height = Math.max(0, viewportHeight);
      const trackHeight = Math.min(height, Math.max(1, lineCount) * 3);
      const maximumScroll = Math.max(0, contentHeight - height);
      const thumbHeight = Math.min(
        trackHeight,
        Math.max(Math.min(12, trackHeight / 2), (trackHeight * height) / Math.max(1, contentHeight)),
      );
      const thumbTravel = Math.max(0, trackHeight - thumbHeight);
      const thumbTop = maximumScroll
      ? (clamp(scrollTop, 0, maximumScroll) / maximumScroll) * thumbTravel
      : 0;
      return { trackHeight, maximumScroll, thumbHeight, thumbTravel, thumbTop };
    }

    function scrollAtPointer(metrics, pointerY, grabOffset = metrics.thumbHeight / 2) {
      if (!metrics.thumbTravel || !metrics.maximumScroll) return 0;
      return clamp((pointerY - grabOffset) / metrics.thumbTravel, 0, 1) * metrics.maximumScroll;
    }

    window.EditorMinimapGeometry = Object.freeze({ measure, scrollAtPointer });
})();
