(function (root) {
    'use strict';

    const pendingPhrases = [];

    function sendToTranslator(phrases) {
      const translator = root.SYNAPSE_I18N;
      if (!translator || typeof translator.registerPhrases !== 'function') return false;
      translator.registerPhrases(phrases);
      return true;
    }

    function flushPendingPhrases() {
      const queued = pendingPhrases.splice(0, pendingPhrases.length);
      queued.forEach(sendToTranslator);
    }

    function register(phrases) {
      if (sendToTranslator(phrases)) return true;
      pendingPhrases.push(phrases);
      root.addEventListener('load', flushPendingPhrases);
      return false;
    }

    root.SynapsePhraseRegistration = Object.freeze({ register });
})(typeof globalThis !== 'undefined' ? globalThis : window);
