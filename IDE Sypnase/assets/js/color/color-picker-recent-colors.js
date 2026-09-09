(function (root) {
    'use strict';

    const STORAGE_KEY = 'aurora.recentColors';
    const MAXIMUM_COLORS = 8;

    function reportError(error) {
      if (typeof root.ignorarErro === 'function') root.ignorarErro(error, 'recentColors');
    }

    function readStoredColors() {
      try {
        const stored = JSON.parse(root.localStorage.getItem(STORAGE_KEY) || '[]');
        if (!Array.isArray(stored)) return [];
        return stored.filter((value) => typeof value === 'string');
      } catch (error) {
        reportError(error);
        return [];
      }
    }

    function writeStoredColors(colors) {
      try {
        root.localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
      } catch (error) {
        reportError(error);
      }
    }

    function list() {
      return readStoredColors();
    }

    function remember(hex) {
      const color = String(hex).toLowerCase();
      const colors = readStoredColors().filter((value) => value.toLowerCase() !== color);
      colors.unshift(color);
      writeStoredColors(colors.slice(0, MAXIMUM_COLORS));
    }

    root.SynapseRecentColors = Object.freeze({ list, remember });
})(typeof globalThis !== 'undefined' ? globalThis : window);
