'use strict';

(function () {
    async function read(response, onEvent) {
      if (!response.body?.getReader) {
        throw new Error('O provedor não retornou um fluxo de resposta legível.');
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finished = false;

      function dispatch(block) {
        let event = '';
        const lines = [];
        for (const line of block.split(/\r?\n/)) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          if (line.startsWith('data:')) lines.push(line.slice(5).trimStart());
        }
        const data = lines.join('\n').trim();
        if (!data) return;
        if (data === '[DONE]') {
          finished = true;
          return;
        }
        let payload;
        try {
          payload = JSON.parse(data);
        } catch {
          throw new Error(
            'O provedor enviou um evento de streaming inválido. A execução foi interrompida para não usar dados incompletos.',
          );
        }
        if (payload.error || event === 'error' || payload.type === 'error') {
          throw new Error(
            String(
              payload.error?.message ||
              payload.message ||
              'Falha informada pelo provedor durante o streaming.',
            ).slice(0, 400),
          );
        }
        onEvent(payload, event);
      }

      try {
        while (!finished) {
          const chunk = await reader.read();
          buffer += chunk.done ? decoder.decode() : decoder.decode(chunk.value, { stream: true });
          const blocks = buffer.split(/\r?\n\r?\n/);
          buffer = blocks.pop() || '';
          for (const block of blocks) {
            dispatch(block);
            if (finished) break;
          }
          if (chunk.done) {
            if (buffer.trim() && !finished) dispatch(buffer);
            break;
          }
        }
        return { finished };
      } finally {
        if (typeof reader.cancel === 'function') {
          try {
            await reader.cancel();
          } catch (error) {
            ignorarErro(error, 'aiStreamCancel');
          }
        }
        if (typeof reader.releaseLock === 'function') reader.releaseLock();
      }
    }

    window.SynapseAIStreamReader = Object.freeze({ read });
})();
