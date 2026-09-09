(function (root) {
    'use strict';

    const ENDPOINT_PATH = 'api/bug-report';
    const REQUEST_TIMEOUT_MS = 15000;

    async function failureCode(response) {
      try {
        const payload = await response.json();
        return String(payload.erro || response.status);
      } catch (error) {
        return String(response.status);
      }
    }

    async function send(message) {
      const address = root.SynapseSupportSiteBase.resolve(ENDPOINT_PATH);
      if (!address) return { delivered: false, failure: 'sem-endereco' };
      const controller = new AbortController();
      const timer = root.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(address, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ assunto: message.subject, texto: message.body }),
            signal: controller.signal,
        });
        if (!response.ok) return { delivered: false, failure: await failureCode(response) };
        return { delivered: true, failure: '' };
      } catch (error) {
        return { delivered: false, failure: 'falha-de-rede' };
      } finally {
        root.clearTimeout(timer);
      }
    }

    root.SynapseBugReportTransport = Object.freeze({ send });
})(typeof globalThis !== 'undefined' ? globalThis : window);
