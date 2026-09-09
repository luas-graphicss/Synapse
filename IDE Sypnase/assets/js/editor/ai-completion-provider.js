(function (root) {
    'use strict';

    const autocomplete = root.SynapseAutocomplete;
    const client = root.SynapseAiCompletionClient;
    if (!autocomplete || !client) return;

    const PROVIDER_ID = 'openrouter-ai';
    const DISABLING_CODES = ['chave_ausente', 'origem_nao_permitida', 'metodo_nao_permitido'];

    const state = { enabled: true, unavailableReason: '' };

    function localCompletions(captured) {
      try {
        return root.SynapseCompletionProvider?.getCompletions(captured) || null;
      } catch (error) {
        root.ignorarErro?.(error, 'aiCompletion.local');
        return null;
      }
    }

    function shouldDisable(error) {
      return DISABLING_CODES.includes(error && error.code);
    }

    function reportFailure(error, captured) {
      root.SynapseFailureNotice?.present(error, {
          title: 'A IA do autocomplete nao respondeu',
          step: 'Sugestao de codigo',
          target: String(captured.path || captured.file || ''),
      });
    }

    function toItems(suggestions, position) {
      return suggestions
      .filter((suggestion) => suggestion && typeof suggestion.insertText === 'string')
      .map((suggestion, order) => ({
            label: suggestion.label || suggestion.insertText,
            insertText: suggestion.insertText,
            kind: 'ai',
            priority: order,
            position,
      }));
    }

    function supports(captured) {
      return state.enabled && !!captured.explicit && typeof captured.source === 'string';
    }

    async function complete(captured) {
      const fallback = localCompletions(captured);
      const position = Number.isInteger(captured.position)
      ? captured.position
      : String(captured.source || '').length;
      try {
        const suggestions = await client.requestSuggestions(captured, captured.signal);
        const items = toItems(suggestions, position);
        if (!items.length) return fallback;
        return {
          start: position,
          end: position,
          position,
          prefix: '',
          language: fallback?.language || 'text',
          items,
        };
      } catch (error) {
        if (error && error.name === 'AbortError') return fallback;
        if (shouldDisable(error)) {
          state.enabled = false;
          state.unavailableReason = error.message || '';
        }
        reportFailure(error, captured);
        return fallback;
      }
    }

    autocomplete.registerProvider({ id: PROVIDER_ID, supports, complete });

    root.SYNAPSE_AI_COMPLETION = Object.freeze({
        id: PROVIDER_ID,
        enable() {
          state.enabled = true;
          state.unavailableReason = '';
        },
        disable() {
          state.enabled = false;
        },
        status() {
          return { enabled: state.enabled, unavailableReason: state.unavailableReason };
        },
    });
})(typeof globalThis !== 'undefined' ? globalThis : window);
