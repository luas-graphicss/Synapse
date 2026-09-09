'use strict';

(function () {
    function mergeReasoningDetails(target, updates) {
      for (const update of updates || []) {
        const existing = update.id ? target.findIndex((item) => item?.id === update.id) : -1;
        const index = Number.isInteger(update.index)
        ? update.index
        : existing >= 0
        ? existing
        : target.length;
        const previous = target[index] || {};
        const merged = { ...previous, ...update };
        for (const field of ['text', 'summary', 'data']) {
          if (typeof update[field] === 'string') {
            merged[field] = String(previous[field] || '') + update[field];
          }
        }
        target[index] = merged;
      }
    }

    async function converse(connection, request, hooks) {
      const body = window.SynapseAIRequestOptions.apply(connection, request, {
          model: connection.modelo,
          messages: iaMsgsOpenAI(request, connection),
          stream: !!request.stream,
          max_tokens: request.maxTokens || connection.maxTokens,
          ...(request.ferramentas?.length ? { tools: request.ferramentas, tool_choice: 'auto' } : {}),
      });
      if (!body.tools) delete body.tool_choice;
      if (body.stream && window.SynapseAIModelCapabilities.resolve(connection).streamUsage) {
        body.stream_options = { include_usage: true };
      }
      const response = await fetch(`${iaBaseDe(connection)}/chat/completions`, {
          method: 'POST',
          headers: iaCabecalhos(connection, 'openai'),
          body: JSON.stringify(body),
          signal: request.sinal,
      });
      if (!response.ok) throw await iaFalhaHttp(response);
      let text = '';
      let reason = '';
      let usage = null;
      const rawUsage = {};
      let reasoningContent = '';
      let reasoningText = '';
      const reasoningDetails = [];
      const toolCalls = [];
      const reasoning = window.SynapseAIProviderProtocol.reasoningEmitter(hooks, !!request.stream);

      function absorbUsage(raw) {
        if (!raw) return;
        Object.assign(
          rawUsage,
          Object.fromEntries(Object.entries(raw).filter(([, value]) => value != null)),
        );
        usage = window.SynapseAIProviderUsage.normalize(rawUsage);
        if (usage) hooks.aoUso?.(usage);
      }

      function absorbReasoning(message) {
        const visible = message.reasoning_content || message.reasoning;
        if (typeof message.reasoning_content === 'string') {
          reasoningContent += message.reasoning_content;
        }
        if (typeof message.reasoning === 'string') reasoningText += message.reasoning;
        if (typeof visible === 'string') {
          reasoning.emit(visible);
        } else {
          for (const detail of message.reasoning_details || []) {
            if (detail.type === 'reasoning.text') reasoning.emit(detail.text, detail.index);
            if (detail.type === 'reasoning.summary') reasoning.emit(detail.summary, detail.index);
          }
        }
        mergeReasoningDetails(reasoningDetails, message.reasoning_details);
      }

      if (!body.stream) {
        const payload = await response.json();
        if (payload.error) throw new Error(String(payload.error.message || 'Falha do provedor.'));
        if (!Array.isArray(payload.choices) || !payload.choices[0]?.message) {
          throw new Error(
            'A API não retornou uma mensagem OpenAI válida. Confira o formato da conexão e o modelo.',
          );
        }
        const choice = payload.choices?.[0] || {};
        const message = choice.message || {};
        absorbReasoning(message);
        reasoning.end();
        text = typeof message.content === 'string' ? message.content : '';
        if (text) hooks.aoTexto?.(text);
        reason = choice.finish_reason || '';
        absorbUsage(payload.usage);
        for (const [index, call] of (message.tool_calls || []).entries()) {
          toolCalls.push({
              id: call.id || `call_${index}`,
              nome: call.function?.name,
              args: window.SynapseAIProviderProtocol.toolArguments(call.function?.arguments),
          });
        }
      } else {
        const partialCalls = [];
        await window.SynapseAIStreamReader.read(response, (payload) => {
            absorbUsage(payload.usage || payload.x_groq?.usage);
            const choice = payload.choices?.[0] || {};
            if (choice.finish_reason) reason = choice.finish_reason;
            const delta = choice.delta || {};
            absorbReasoning(delta);
            if (delta.content || delta.tool_calls?.length || choice.finish_reason) reasoning.end();
            if (typeof delta.content === 'string') {
              text += delta.content;
              hooks.aoTexto?.(delta.content);
            }
            for (const call of delta.tool_calls || []) {
              const index = call.index || 0;
              const partial = partialCalls[index] || {
                id: '',
                name: '',
                arguments: '',
                announced: false,
              };
              if (call.id) partial.id = call.id;
              if (call.function?.name) partial.name += call.function.name;
              if (call.function?.arguments) partial.arguments += call.function.arguments;
              if (partial.name && !partial.announced) {
                partial.announced = true;
                hooks.aoFerramenta?.(partial.name, index);
              }
              partialCalls[index] = partial;
            }
        });
        if (!reason) {
          throw new Error(
            'O fluxo terminou sem confirmação do provedor. Nenhuma ferramenta parcial foi executada.',
          );
        }
        for (const [index, call] of partialCalls.entries()) {
          if (call) {
            toolCalls.push({
                id: call.id || `call_${index}`,
                nome: call.name,
                args: window.SynapseAIProviderProtocol.toolArguments(call.arguments),
            });
          }
        }
      }
      if (toolCalls.length && ['length', 'content_filter'].includes(reason)) {
        throw new Error(
          'O provedor interrompeu as chamadas de ferramentas. Nenhuma ação incompleta foi executada.',
        );
      }
      reasoning.end();
      const payload = {};
      if (reasoningContent) payload.reasoning_content = reasoningContent;
      if (reasoningText) payload.reasoning = reasoningText;
      if (reasoningDetails.length) payload.reasoning_details = reasoningDetails.filter(Boolean);
      return {
        texto: text,
        motivo: reason,
        uso: usage,
        chamadas: toolCalls,
        providerState: window.SynapseAIProviderProtocol.save(connection, payload),
      };
    }

    window.SynapseAIOpenAIProvider = Object.freeze({ converse });
})();
