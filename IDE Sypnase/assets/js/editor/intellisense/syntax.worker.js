(function (root) {
    'use strict';

    root.exports = {};
    try {
      root.importScripts('../../../vendor/babel-parser-7.24.1.js');
      const parser = root.exports;
      delete root.exports;
      root.importScripts('./local-script-diagnostics.js');
      root.addEventListener('message', (event) => {
          const message = event.data || {};
          try {
            if (message.method !== 'syntax') throw new TypeError('Unsupported syntax request');
            const result = root.SynapseLocalScriptDiagnostics.analyze(
              parser,
              message.path,
              message.text,
            );
            root.postMessage({ type: 'result', id: message.id, result });
          } catch (error) {
            root.postMessage({ type: 'error', id: message.id, message: error.message });
          }
      });
      root.postMessage({ type: 'ready' });
    } catch (error) {
      delete root.exports;
      root.postMessage({ type: 'unavailable', message: error.message });
    }
})(self);
