(function (root) {
    'use strict';

    const THEME_STORAGE_KEY = 'aurora.theme';
    const FALLBACK_THEME = 'dark';
    const THEME_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

    function themeName(storedValue) {
      return THEME_NAME_PATTERN.test(storedValue) ? storedValue : FALLBACK_THEME;
    }

    function apply(storedValue) {
      document.documentElement.setAttribute('data-theme', themeName(storedValue));
    }

    function start() {
      const preference = root.SynapseDocsIdePreference;
      apply(preference.read(THEME_STORAGE_KEY));
      preference.watch(THEME_STORAGE_KEY, apply);
    }

    start();
})(typeof globalThis !== 'undefined' ? globalThis : window);
