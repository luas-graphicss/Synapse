'use strict';

(function () {
    async function converse(connection, request, hooks) {
      const model = String(connection.modelo || '').replace(/^models\//, '');
        const method = request.stream ? 'streamGenerateContent?alt=sse' : 'generateContent';
        const body = window.SynapseAIRequestOptions.apply(connection, request, {
            contents: iaMsgsGemini(request, connection),
            systemInstruction: { parts: [{ text: request.sistema }] },
            generationConfig: { maxOutputTokens: request.maxTokens || connection.maxTokens || 8192 },
            ...(request.ferramentas?.length ? { tools: request.ferramentas } : {}),
        });
        const response = await fetch(
          `${iaBaseDe(connection)}/models/${encodeURIComponent(model)}:${method}`,
          {
            method: 'POST',
            headers: iaCabecalhos(connection, 'gemini'),
            body: JSON.stringify(body),
            signal: request.sinal,
          },
        );
        if (!response.ok) throw await iaFalhaHttp(response);
        let text = '';
        let reason = '';
        let usage = null;
        const rawUsage = {};
        const calls = [];
        const parts = [];
        const reasoning = window.SynapseAIProviderProtocol.reasoningEmitter(hooks, !!request.stream);

        function absorb(payload) {
          if (payload.error) throw new Error(String(payload.error.message || 'Falha do provedor.'));
          if (!request.stream && !payload.candidates?.length && !payload.promptFeedback?.blockReason) {
            throw new Error(
              'A API não retornou uma mensagem Gemini válida. Confira o formato da conexão e o modelo.',
            );
          }
          if (payload.usageMetadata) {
            Object.assign(
              rawUsage,
              Object.fromEntries(
                Object.entries(payload.usageMetadata).filter(([, value]) => value != null),
              ),
            );
            usage = window.SynapseAIProviderUsage.normalize(rawUsage, 'gemini');
            if (usage) hooks.aoUso?.(usage);
          }
          if (payload.promptFeedback?.blockReason) {
            throw new Error(`O provedor bloqueou este pedido: ${payload.promptFeedback.blockReason}.`);
          }
          const candidate = payload.candidates?.[0] || {};
          if (candidate.finishReason) reason = candidate.finishReason;
          for (const part of candidate.content?.parts || []) {
            parts.push(part);
            if (part.thought && part.text) reasoning.emit(part.text);
            else if (part.text) {
              reasoning.end();
              text += part.text;
              hooks.aoTexto?.(part.text);
            }
            if (part.functionCall) {
              reasoning.end();
              const index = calls.length;
              calls.push({
                  id: part.functionCall.id || `call_${index}_${part.functionCall.name}`,
                  nome: part.functionCall.name,
                  args: window.SynapseAIProviderProtocol.toolArguments(part.functionCall.args),
              });
              hooks.aoFerramenta?.(part.functionCall.name, index);
            }
          }
          if (candidate.finishReason) reasoning.end();
        }

        if (request.stream) await window.SynapseAIStreamReader.read(response, absorb);
        else absorb(await response.json());
        if (request.stream && !reason) throw new Error('O fluxo terminou sem confirmação do provedor.');
        if (calls.length && reason !== 'STOP') {
          throw new Error(
            'O provedor não concluiu as chamadas de ferramentas. Nenhuma ação incompleta foi executada.',
          );
        }
        reasoning.end();
        return {
          texto: text,
          motivo: reason,
          uso: usage,
          chamadas: calls,
          providerState: window.SynapseAIProviderProtocol.save(connection, { parts }),
        };
      }

      window.SynapseAIGeminiProvider = Object.freeze({ converse });
  })();
