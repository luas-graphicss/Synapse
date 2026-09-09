(function (root) {
    'use strict';

    const namespace = root.SynapseIntelligence;
    const semanticMethods = Object.freeze(['definitions', 'completions', 'details', 'diagnostics']);

    function createClient(workerUrl, onStatus, syntaxWorkerUrl = null) {
      const syntaxClient = syntaxWorkerUrl ? createClient(syntaxWorkerUrl, () => undefined) : null;
      let worker = null;
      let ready = false;
      let sequence = 0;
      let generation = 0;
      let activeSemantic = null;
      let activeSyntax = null;
      let previousSnapshot = null;
      let startupTimer = null;
      let stopped = false;
      let disposed = false;
      const pending = new Map();

      function clear() {
        generation++;
        clearTimeout(startupTimer);
        startupTimer = null;
        for (const request of [activeSyntax, activeSemantic]) {
          if (!request) continue;
          clearTimeout(request.timer);
          request.resolve(null);
        }
        activeSyntax = null;
        activeSemantic = null;
        for (const request of pending.values()) request.resolve(null);
        pending.clear();
        worker?.terminate();
        worker = null;
        ready = false;
        previousSnapshot = null;
      }
      function fail(message) {
        clear();
        stopped = true;
        if (!disposed) onStatus({ state: 'unavailable', message });
      }
      function start() {
        if (worker || stopped || disposed) return;
        try {
          if (!workerUrl)
          throw new Error('Serve the editor over HTTP(S) to enable its language worker');
          const instance = new Worker(workerUrl, { name: 'synapse-intellisense' });
          worker = instance;
          const currentGeneration = ++generation;
          const isCurrent = () =>
          worker === instance && generation === currentGeneration && !disposed;
          onStatus({ state: 'loading' });
          startupTimer = setTimeout(() => {
              if (isCurrent()) fail('Language service initialization timed out');
            }, 45000);
          instance.addEventListener('error', (event) => {
              event.preventDefault();
              if (isCurrent()) fail(event.message || 'Language worker failed');
          });
          instance.addEventListener('messageerror', () => {
              if (isCurrent()) fail('Language worker returned an invalid message');
          });
          instance.addEventListener('message', (event) => {
              if (!isCurrent()) return;
              const message = event.data || {};
              if (message.type === 'unavailable') {
                fail(message.message);
                return;
              }
              if (message.type === 'ready') {
                if (ready) return;
                clearTimeout(startupTimer);
                ready = true;
                onStatus({ state: 'ready' });
                pump();
                return;
              }
              const request = [activeSyntax, activeSemantic].find(
                (candidate) => candidate?.id === message.id,
              );
              if (!request) return;
              if (message.type !== 'error' && message.type !== 'result') {
                fail('Language worker returned an invalid response');
                return;
              }
              clearTimeout(request.timer);
              if (request === activeSyntax) activeSyntax = null;
              else {
                activeSemantic = null;
                previousSnapshot = message.type === 'result' ? request.snapshot : null;
              }
              request.resolve(message.type === 'error' ? { error: message.message } : message.result);
              pump();
          });
        } catch (error) {
          fail(error.message);
        }
      }
      function send(method) {
        const request = pending.get(method);
        pending.delete(method);
        if (method === 'syntax') activeSyntax = request;
        else activeSemantic = request;
        request.timer = setTimeout(() => {
            if (activeSemantic !== request && activeSyntax !== request) return;
            if (request.cancelled) {
              if (activeSyntax === request) activeSyntax = null;
              else activeSemantic = null;
              pump();
              return;
            }
            fail('Language analysis timed out');
          }, 20000);
        try {
          const message = { ...request.payload, id: request.id, method };
          if (method !== 'syntax')
          message.update = namespace.projectModel.createPatch(previousSnapshot, request.snapshot);
          worker.postMessage(message);
        } catch (error) {
          fail(error.message);
        }
      }
      function pump() {
        if (!worker || !ready || disposed) return;
        if (!activeSyntax && pending.has('syntax')) send('syntax');
        if (!worker || activeSemantic) return;
        const method = semanticMethods.find((name) => pending.has(name));
        if (method) send(method);
      }
      function request(method, snapshot, payload) {
        if (method === 'syntax' && syntaxClient && /\.(?:[cm]?[jt]s|[jt]sx)$/i.test(payload?.path))
        return syntaxClient.request(method, snapshot, payload);
        if (
          stopped ||
          disposed ||
          (method !== 'syntax' && (!snapshot || !semanticMethods.includes(method)))
        )
        return Promise.resolve(null);
        return new Promise((resolve) => {
            pending.get(method)?.resolve(null);
            pending.set(method, { id: ++sequence, method, snapshot, payload, resolve });
            start();
            pump();
        });
      }
      function cancel(method) {
        if (method === 'syntax') syntaxClient?.cancel(method);
        pending.get(method)?.resolve(null);
        pending.delete(method);
        for (const request of [activeSyntax, activeSemantic]) {
          if (request?.method !== method) continue;
          request.cancelled = true;
          request.resolve(null);
          request.resolve = () => undefined;
        }
      }
      function reset() {
        syntaxClient?.reset();
        clear();
        stopped = false;
      }
      function dispose() {
        syntaxClient?.dispose();
        disposed = true;
        clear();
        stopped = true;
      }
      function warmup() {
        syntaxClient?.warmup();
        start();
      }
      return Object.freeze({ request, cancel, reset, dispose, warmup });
    }
    namespace.createClient = createClient;
})(globalThis);
