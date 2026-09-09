(function (root) {
    'use strict';

    const OWN_SCRIPT_PATH = 'assets/js/support/support-site-base.js';
    const LOADABLE_PREFIXES = ['http://', 'https://'];

    function baseFromLoadedScripts() {
      const scripts = document.querySelectorAll('script[src]');
      for (const script of scripts) {
        const address = script.src || '';
        const pathStart = address.indexOf(OWN_SCRIPT_PATH);
        if (pathStart > 0) return address.slice(0, pathStart);
      }
      return '';
    }

    function baseFromDocumentAddress() {
      try {
        return new URL('.', document.baseURI).href;
      } catch (error) {
        return '';
      }
    }

    function isLoadable(base) {
      return LOADABLE_PREFIXES.some((prefix) => base.startsWith(prefix));
    }

    function siteBase() {
      const candidates = [baseFromLoadedScripts(), baseFromDocumentAddress()];
      return candidates.find((candidate) => candidate && isLoadable(candidate)) || '';
    }

    function resolve(relativePath) {
      const base = siteBase();
      if (!base) return '';
      try {
        return new URL(relativePath, base).href;
      } catch (error) {
        return '';
      }
    }

    root.SynapseSupportSiteBase = Object.freeze({ resolve });
})(typeof globalThis !== 'undefined' ? globalThis : window);
