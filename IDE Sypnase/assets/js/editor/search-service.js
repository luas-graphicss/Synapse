(function () {
    'use strict';

    const scriptUrl = document.currentScript?.src || location.href;
    const maximumExecutionMilliseconds = 2000;

    function run(options) {
      let worker;
      let timer;
      let rejectJob;
      let settled = false;
      function cleanup() {
        settled = true;
        clearTimeout(timer);
        worker?.terminate();
      }
      const promise = new Promise((resolve, reject) => {
          rejectJob = reject;
          try {
            const workerUrl =
            window.SynapseEditorWorkerResources?.url('search-worker.js', scriptUrl) ||
            new URL('search-worker.js', scriptUrl).href;
            worker = new Worker(workerUrl);
            worker.onmessage = (event) => {
              cleanup();
              const message = event.data;
              if (message && message.ok) resolve(message.result);
              else reject(new Error((message && message.error) || 'A busca isolada devolveu uma resposta invalida.'));
            };
            worker.onerror = (event) => {
              cleanup();
              event.preventDefault();
              reject(new Error('Não foi possível executar a busca isolada. Verifique o carregamento do worker.'));
            };
            timer = setTimeout(() => {
                cleanup();
                reject(new Error('A busca demorou demais e foi interrompida. Refine a expressão.'));
              }, maximumExecutionMilliseconds);
            worker.postMessage(options);
          } catch (error) {
            cleanup();
            reject(error);
          }
      });
      return {
        promise,
        cancel() {
          if (settled) return;
          cleanup();
          rejectJob(new DOMException('Busca cancelada', 'AbortError'));
        },
      };
    }

    window.SynapseSearchService = Object.freeze({ run });
})();
