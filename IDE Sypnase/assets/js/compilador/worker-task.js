(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.SYNAPSE_WORKER_TASK = api;
})(globalThis, function () {
    'use strict';
    function canceledError() {
      return Object.assign(new Error('Worker operation canceled.'), { name: 'AbortError', cancelado: true });
    }
    function run(url, payload, options = {}) {
      return new Promise((resolve, reject) => {
          if (options.signal?.aborted) {
            reject(canceledError());
            return;
          }
          let worker;
          try {
            worker = options.createWorker ? options.createWorker(url) : new Worker(url);
          } catch (error) {
            reject(new Error('An isolated Worker is unavailable: ' + error.message));
            return;
          }
          let settled = false;
          let outputBytes = 0;
          let timer;
          function finish(error, result) {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            options.signal?.removeEventListener('abort', abort);
            worker.onmessage = worker.onerror = worker.onmessageerror = null;
            try { worker.terminate(); }
            catch (failure) { error ||= failure; }
            if (error) reject(error);
            else resolve(result);
          }
          const abort = () => finish(canceledError());
          options.signal?.addEventListener('abort', abort, { once: true });
          timer = setTimeout(
            () => finish(Object.assign(new Error('Worker time limit exceeded; execution terminated.'), { tempoEsgotado: true })),
            Math.max(100, Math.min(120000, options.timeoutMs || 10000)),
          );
          worker.onmessage = ({ data }) => {
            if (settled) return;
            try {
              if (data?.tipo === 'saida') {
                const text = String(data.texto || '');
                outputBytes += new TextEncoder().encode(text).byteLength;
                if (outputBytes > 1048576) throw new Error('Worker output exceeds 1 MiB.');
                options.onOutput?.(data.fluxo, text);
              } else if (data?.tipo === 'fim' || data?.tipo === 'compilado') finish(null, data);
              else if (data?.tipo === 'falha') finish(Object.assign(new Error(data.texto || 'Worker failed.'), { tempoEsgotado: !!data.tempoEsgotado }));
            } catch (error) { finish(error); }
          };
          worker.onerror = (event) => {
            event.preventDefault?.();
            finish(new Error(event.message || 'Worker failed.'));
          };
          worker.onmessageerror = () => finish(new Error('Worker message could not be decoded.'));
          try { worker.postMessage(payload); }
          catch (error) { finish(error); }
      });
    }
    return { run, canceledError };
});
