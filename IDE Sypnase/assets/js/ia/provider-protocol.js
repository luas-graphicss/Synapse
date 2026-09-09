'use strict';

(function () {
    function identity(connection) {
      return [connection.formato || 'openai', iaBaseDe(connection), connection.modelo || ''].join(
        '|',
      );
    }

    function save(connection, payload) {
      return { identity: identity(connection), payload };
    }

    function restore(message, connection) {
      return message.providerState?.identity === identity(connection)
      ? message.providerState.payload
      : null;
    }

    function toolArguments(value) {
      if (value == null || value === '') return {};
      let parsed = value;
      if (typeof value === 'string') {
        try {
          parsed = JSON.parse(value);
        } catch {
          throw new Error(
            'A API retornou argumentos incompletos de ferramenta. Nenhuma ação foi executada.',
          );
        }
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(
          'A API retornou argumentos inválidos de ferramenta. Nenhuma ação foi executada.',
        );
      }
      return parsed;
    }

    function reasoningEmitter(hooks, streaming) {
      let current = null;
      let sequence = 0;

      function end(id) {
        if (current == null || (id != null && String(id) !== current)) return;
        hooks.aoRaciocinioFim?.({ id: current, measurable: streaming });
        current = null;
      }

      function emit(text, id) {
        if (!text) return;
        const next = id == null ? current || `reasoning-${++sequence}` : String(id);
        if (next !== current) end();
        const started = current == null;
        current = next;
        hooks.aoRaciocinio?.(String(text), { id: current, started, measurable: streaming });
      }

      return { emit, end };
    }

    window.SynapseAIProviderProtocol = Object.freeze({
        identity,
        save,
        restore,
        reasoningEmitter,
        toolArguments,
    });
})();
