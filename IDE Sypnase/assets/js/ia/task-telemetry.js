'use strict';

(function () {
    function create({ now = Date.now, onUpdate = () => {}, model = '', connectionName = '' } = {}) {
      const startedAt = now();
      const requests = [];
      let current = null;
      let endedAt = null;
      let status = 'running';
      let tools = 0;

      function snapshot() {
        const usages = requests.map((request) => request.usage).filter(Boolean);
        const sum = (field) =>
        usages.some((usage) => usage[field] != null)
        ? usages.reduce((total, usage) => total + (usage[field] || 0), 0)
        : null;
        const reasoningBlocks = requests.flatMap((request) => request.reasoning);
        const finished = endedAt != null;
        return {
          entrada: sum('entrada'),
          saida: sum('saida'),
          total: usages.length
          ? usages.reduce(
            (total, usage) => total + (usage.total ?? (usage.entrada || 0) + (usage.saida || 0)),
            0,
          )
          : null,
          reasoning: usages.some((usage) => usage.reasoning != null) ? sum('reasoning') : null,
          cache: usages.some((usage) => usage.cache != null) ? sum('cache') : null,
          cacheWrite: usages.some((usage) => usage.cacheWrite != null) ? sum('cacheWrite') : null,
          cost: usages.some((usage) => usage.cost != null) ? sum('cost') : null,
          costComplete:
          requests.length > 0 &&
          requests.every((request) => request.closed && request.usage?.cost != null),
          usageReported: usages.length > 0,
          usageComplete:
          requests.length > 0 &&
          requests.every((request) => request.closed && request.usage?.complete),
          requestsReported: usages.length,
          passos: requests.length,
          chamadas: tools,
          ms: Math.max(0, (endedAt ?? now()) - startedAt),
          startedAt,
          endedAt,
          status,
          model,
          connectionName,
          reasoningMs: reasoningBlocks
          .filter((block) => block.measurable)
          .reduce(
            (total, block) => total + Math.max(0, (block.endedAt ?? now()) - block.startedAt),
            0,
          ),
          finished,
        };
      }

      function publish() {
        const state = snapshot();
        onUpdate(state);
        return state;
      }

      function beginStep() {
        current = { startedAt: now(), endedAt: null, usage: null, closed: false, reasoning: [] };
        requests.push(current);
        publish();
      }

      function updateUsage(usage) {
        if (!current || !usage) return;
        current.usage = { ...usage };
        publish();
      }

      function addReasoning(text, metadata = {}) {
        if (!current) return null;
        const id = String(metadata.id ?? 'reasoning');
        let block = current.reasoning.find((entry) => entry.id === id && entry.endedAt == null);
        if (!block) {
          block = {
            id,
            text: '',
            startedAt: now(),
            endedAt: null,
            measurable: metadata.measurable !== false,
          };
          current.reasoning.push(block);
        }
        block.text += String(text || '');
        return { ...block, ms: block.measurable ? Math.max(0, now() - block.startedAt) : null };
      }

      function endReasoning(metadata = {}) {
        if (!current) return [];
        const closed = [];
        for (const block of current.reasoning) {
          if (block.endedAt != null || (metadata.id != null && block.id !== String(metadata.id))) {
            continue;
          }
          block.endedAt = now();
          closed.push({
              ...block,
              ms: block.measurable ? Math.max(0, block.endedAt - block.startedAt) : null,
          });
        }
        return closed;
      }

      function closeStep(usage, completed = true) {
        if (!current) return null;
        endReasoning();
        if (usage) current.usage = { ...usage };
        current.closed = completed;
        current.endedAt = now();
        publish();
        return {
          ms: current.endedAt - current.startedAt,
          usage: current.usage,
          reasoning: current.reasoning.map((block) => ({
                ...block,
                ms: block.measurable ? block.endedAt - block.startedAt : null,
          })),
        };
      }

      function finish(result = 'completed') {
        endReasoning();
        status = result;
        endedAt = now();
        return publish();
      }

      function countTool() {
        tools++;
        publish();
      }

      return Object.freeze({
          beginStep,
          updateUsage,
          addReasoning,
          endReasoning,
          closeStep,
          finish,
          countTool,
          snapshot,
          publish,
      });
    }

    window.SynapseAITaskTelemetry = Object.freeze({ create });
})();
