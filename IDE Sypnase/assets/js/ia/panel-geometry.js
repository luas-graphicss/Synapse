(function (root) {
    'use strict';

    function finiteNumber(value, fallback) {
      return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
    }

    function clamp(value, minimum, maximum) {
      return Math.min(Math.max(value, minimum), maximum);
    }

    function resolve(geometry, viewport, chrome = {}) {
      const saved = geometry && typeof geometry === 'object' ? geometry : {};
      const viewportWidth = Math.max(1, finiteNumber(viewport.width, 390));
      const viewportHeight = Math.max(1, finiteNumber(viewport.height, 844));
      const headerHeight = Math.max(1, finiteNumber(chrome.headerHeight, 44));
      const margin = Math.min(8, viewportWidth / 4, viewportHeight / 4);
      const availableWidth = viewportWidth - margin * 2;
      const availableHeight = viewportHeight - margin * 2;
      const mode = saved.modo === 'dock' ? 'dock' : 'float';
      const minimized = saved.min === true;

      if (mode === 'dock') {
        const top = clamp(finiteNumber(chrome.top, 46), 0, viewportHeight - 1);
        const bottom = clamp(finiteNumber(chrome.bottom, 26), 0, viewportHeight - top - 1);
        const maximumWidth = viewportWidth <= 720 ? viewportWidth : viewportWidth - 80;
        const width = clamp(
          finiteNumber(saved.dockW, 400),
          Math.min(320, maximumWidth),
          maximumWidth,
        );
        return {
          mode,
          minimized,
          left: viewportWidth - width,
          top,
          width,
          height: minimized ? Math.min(headerHeight, viewportHeight - top) : viewportHeight - top - bottom,
        };
      }

      const width = clamp(finiteNumber(saved.w, 440), Math.min(320, availableWidth), availableWidth);
      const height = minimized
      ? Math.min(headerHeight, availableHeight)
      : clamp(finiteNumber(saved.h, 600), Math.min(420, availableHeight), availableHeight);
      return {
        mode,
        minimized,
        left: clamp(
          finiteNumber(saved.x, viewportWidth - width - 18),
          margin,
          viewportWidth - width - margin,
        ),
        top: clamp(
          finiteNumber(saved.y, viewportHeight - height - 40),
          margin,
          viewportHeight - height - margin,
        ),
        width,
        height,
      };
    }

    root.SynapseChatGeometry = Object.freeze({ resolve });
})(globalThis);
