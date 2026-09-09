(function (root) {
    'use strict';

    root.importScripts(
      './typescript-loader.js',
      './typescript-service.js',
      './syntax-diagnostics.js',
    );
    let service;
    let typescript;
    const initialization = root.SynapseTypeScriptLoader.load()
    .then((dependencies) => {
        typescript = dependencies.typescript;
        service = root.SynapseTypeScriptService.create(
          dependencies.typescript,
          dependencies.libraries,
        );
        root.postMessage({ type: 'ready' });
    })
    .catch((error) => {
        root.postMessage({ type: 'unavailable', message: String(error.message || error) });
    });

    async function ensureRequestLibraries() {
      let timer;
      try {
        await Promise.race([
            root.SynapseTypeScriptLoader.ensureLibraries(service.requiredLibraries()),
            new Promise((resolve, reject) => {
                timer = setTimeout(() => reject(new Error('Type library loading timed out')), 12000);
            }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    }

    root.addEventListener('message', async (event) => {
        const { id, method, update, path, text, position, item } = event.data || {};
        if (
          !Number.isInteger(id) ||
          !['syntax', 'completions', 'details', 'definitions', 'diagnostics'].includes(method)
        ) {
          return;
        }
        try {
          await initialization;
          if (!service) {
            throw new Error('Language service did not initialize');
          }
          if (method === 'syntax') {
            const result = root.SynapseSyntaxDiagnostics.analyze(typescript, path, text);
            root.postMessage({ type: 'result', id, result });
            return;
          }
          service.synchronize(update);
          await ensureRequestLibraries();
          const result = service[method](path, position, item);
          root.postMessage({ type: 'result', id, result });
        } catch (error) {
          root.postMessage({ type: 'error', id, message: String(error.message || error) });
        }
    });
})(globalThis);
