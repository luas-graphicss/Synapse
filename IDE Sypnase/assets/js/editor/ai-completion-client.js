(function (root) {
    'use strict';

    const ENDPOINT = '/api/ai/completion';
    const PREFIX_CHARACTERS = 3000;
    const SUFFIX_CHARACTERS = 1200;

    function contextFrom(captured) {
      const source = typeof captured.source === 'string' ? captured.source : '';
      const position = Number.isInteger(captured.position) ? captured.position : source.length;
      return {
        path: String(captured.path || captured.file || ''),
        prefix: source.slice(Math.max(0, position - PREFIX_CHARACTERS), position),
        suffix: source.slice(position, position + SUFFIX_CHARACTERS),
      };
    }

    async function failureFrom(response) {
      const payload = await response.json().catch(() => null);
      const reported = payload && payload.error && payload.error.message;
      const failure = new Error(reported || response.statusText || 'Falha no proxy de IA.');
      failure.status = response.status;
      failure.statusText = response.statusText;
      failure.code = (payload && payload.error && payload.error.code) || '';
      return failure;
    }

    async function requestSuggestions(captured, signal) {
      const response = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(contextFrom(captured)),
          signal,
      });
      if (!response.ok) throw await failureFrom(response);
      const payload = await response.json();
      return Array.isArray(payload.suggestions) ? payload.suggestions : [];
    }

    root.SynapseAiCompletionClient = Object.freeze({ requestSuggestions, contextFrom });
})(typeof globalThis !== 'undefined' ? globalThis : window);
