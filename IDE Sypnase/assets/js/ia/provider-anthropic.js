'use strict';

(function () {
    async function converse(connection, request, hooks) {
      const body = window.SynapseAIRequestOptions.apply(connection, request, {
          model: connection.modelo,
          system: request.sistema,
          messages: iaMsgsAnthropic(request, connection),
          max_tokens: request.maxTokens || connection.maxTokens || 8192,
          stream: !!request.stream,
          ...(request.ferramentas?.length ? { tools: request.ferramentas } : {}),
      });
      const response = await fetch(`${iaBaseDe(connection)}/messages`, {
          method: 'POST',
          headers: iaCabecalhos(connection, 'anthropic'),
          body: JSON.stringify(body),
          signal: request.sinal,
      });
      if (!response.ok) throw await iaFalhaHttp(response);
      let text = '';
      let reason = '';
      let usage = null;
      const rawUsage = {};
      const blocks = [];
      const argumentFragments = new Map();
      const reasoning = window.SynapseAIProviderProtocol.reasoningEmitter(hooks, !!request.stream);

      function absorbUsage(raw) {
        if (!raw) return;
        Object.assign(rawUsage, raw);
        usage = window.SynapseAIProviderUsage.normalize(rawUsage, 'anthropic');
        if (usage) hooks.aoUso?.(usage);
      }

      if (!body.stream) {
        const payload = await response.json();
        if (payload.error) throw new Error(String(payload.error.message || 'Falha do provedor.'));
        if (!Array.isArray(payload.content)) {
          throw new Error(
            'A API não retornou uma mensagem Anthropic válida. Confira o formato da conexão e o modelo.',
          );
        }
        blocks.push(...(payload.content || []));
        for (const [index, block] of blocks.entries()) {
          if (block.type === 'thinking') {
            reasoning.emit(block.thinking, index);
            reasoning.end(index);
          }
          if (block.type === 'text') text += block.text || '';
        }
        if (text) hooks.aoTexto?.(text);
        reason = payload.stop_reason || '';
        absorbUsage(payload.usage);
      } else {
        let stopped = false;
        await window.SynapseAIStreamReader.read(response, (payload, event) => {
            const type = event || payload.type;
            if (type === 'message_start') absorbUsage(payload.message?.usage);
            if (type === 'content_block_start') {
              const block = { ...payload.content_block };
              blocks[payload.index] = block;
              if (block.type === 'thinking') reasoning.emit(block.thinking, payload.index);
              if (block.type === 'text' && block.text) {
                text += block.text;
                hooks.aoTexto?.(block.text);
              }
              if (block.type === 'tool_use') hooks.aoFerramenta?.(block.name, payload.index);
            }
            if (type === 'content_block_delta') {
              const block = blocks[payload.index];
              if (!block) throw new Error('O provedor enviou um bloco sem início de streaming.');
              const delta = payload.delta || {};
              if (delta.type === 'text_delta') {
                text += delta.text || '';
                block.text = String(block.text || '') + (delta.text || '');
                hooks.aoTexto?.(delta.text || '');
              }
              if (delta.type === 'thinking_delta') {
                block.thinking = String(block.thinking || '') + (delta.thinking || '');
                reasoning.emit(delta.thinking, payload.index);
              }
              if (delta.type === 'signature_delta') {
                block.signature = String(block.signature || '') + (delta.signature || '');
              }
              if (delta.type === 'input_json_delta') {
                argumentFragments.set(
                  payload.index,
                  (argumentFragments.get(payload.index) || '') + (delta.partial_json || ''),
                );
              }
            }
            if (type === 'content_block_stop') reasoning.end(payload.index);
            if (type === 'message_delta') {
              if (payload.delta?.stop_reason) reason = payload.delta.stop_reason;
              absorbUsage(payload.usage);
            }
            if (type === 'message_stop') stopped = true;
        });
        if (!stopped && !reason) {
          throw new Error('O fluxo terminou antes da confirmação do provedor.');
        }
      }
      reasoning.end();
      for (const [index, fragments] of argumentFragments) {
        blocks[index].input = window.SynapseAIProviderProtocol.toolArguments(fragments);
      }
      const calls = blocks
      .filter((block) => block?.type === 'tool_use')
      .map((block, index) => ({
            id: block.id || `call_${index}`,
            nome: block.name,
            args: window.SynapseAIProviderProtocol.toolArguments(block.input),
      }));
      if (calls.length && reason === 'max_tokens') {
        throw new Error(
          'O limite de saída interrompeu as ferramentas. Nenhuma ação incompleta foi executada.',
        );
      }
      return {
        texto: text,
        motivo: reason,
        uso: usage,
        chamadas: calls,
        providerState: window.SynapseAIProviderProtocol.save(connection, {
            blocks: blocks.filter(Boolean),
        }),
      };
    }

    window.SynapseAIAnthropicProvider = Object.freeze({ converse });
})();
