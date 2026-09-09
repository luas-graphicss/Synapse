(function (root) {
    'use strict';

    const notice = root.SynapseFailureNotice;
    if (!notice) return;

    const REPEAT_WINDOW_MS = 4000;
    const recent = new Map();

    function alreadyReported(signature) {
      const now = Date.now();
      for (const [key, moment] of recent) if (now - moment > REPEAT_WINDOW_MS) recent.delete(key);
      if (recent.has(signature)) return true;
      recent.set(signature, now);
      return false;
    }

    function signatureOf(error, target) {
      return `${target}::${(error && error.message) || String(error)}`;
    }

    function present(error, title, target) {
      if (alreadyReported(signatureOf(error, target))) return;
      notice.present(error, { title, step: 'Execucao da interface', target });
    }

    function fileOf(event) {
      if (!event.filename) return '';
      const name = String(event.filename).split('/').pop();
      return event.lineno ? `${name}:${event.lineno}` : name;
    }

    window.addEventListener('error', (event) => {
        if (!event.error && !event.message) return;
        present(event.error || new Error(event.message), 'Erro nao tratado na interface', fileOf(event));
    });

    window.addEventListener('unhandledrejection', (event) => {
        present(event.reason, 'Uma tarefa em segundo plano falhou', 'promessa sem tratamento');
    });
})(typeof globalThis !== 'undefined' ? globalThis : window);
