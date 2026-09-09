(function (raiz, fabrica) {
    'use strict';
    const api = fabrica();
    if (typeof module === 'object' && module && module.exports) module.exports = api;
    else raiz.SynapseBrowserToolchainFallback = api;
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    function catalog() {
      const source = globalThis.SYNAPSE_CATALOGO;
      return source && typeof source.obter === 'function' ? source : null;
    }

    function entryFor(toolchainId) {
      const source = catalog();
      if (!source || !toolchainId) return null;
      return source.obter(toolchainId) || null;
    }

    function runsInBrowser(toolchainId) {
      const entry = entryFor(toolchainId);
      if (!entry) return true;
      return entry.execution !== 'unavailable';
    }

    function relayToolchainFor(toolchainId) {
      const entry = entryFor(toolchainId);
      if (!entry || entry.execution !== 'unavailable' || !entry.relayFallback) return null;
      const fallback = entryFor(entry.relayFallback);
      if (!fallback || fallback.execution !== 'relay') return null;
      return fallback;
    }

    function relayToolchainIdFor(toolchainId) {
      const fallback = relayToolchainFor(toolchainId);
      return fallback ? fallback.id : '';
    }

    return { runsInBrowser, relayToolchainFor, relayToolchainIdFor };
});
