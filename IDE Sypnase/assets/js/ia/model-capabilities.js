'use strict';

(function () {
    const catalogs = new Map();

    function catalogKey(connection) {
      return `${connection.prov}|${connection.formato}|${String(connection.base || '').replace(/\/+$/, '')}`;
    }

    function remember(connection, models) {
      if (!Array.isArray(models)) return;
      catalogs.set(
        catalogKey(connection),
        new Map(
          models.map((model) => [
              String(model.id || model.name || '').replace(/^models\//, ''),
                model,
            ]),
          ),
        );
      }

      function metadata(connection) {
        if (!connection) return null;
        const model = String(connection.modelo || '').replace(/^models\//, '');
          const cached = catalogs.get(catalogKey(connection))?.get(model);
          const saved = connection.modelMetadata;
          const source =
          cached ||
          (saved?.id === model && saved?.catalogKey === catalogKey(connection) ? saved : null);
          if (!source) return null;
          return {
            id: model,
            catalogKey: catalogKey(connection),
            supported_parameters: Array.isArray(source.supported_parameters)
            ? source.supported_parameters.filter((value) => typeof value === 'string')
            : undefined,
            reasoning: source.reasoning
            ? {
              mandatory: source.reasoning.mandatory,
              default_enabled: source.reasoning.default_enabled,
              default_effort: source.reasoning.default_effort,
              supported_efforts: source.reasoning.supported_efforts,
              supports_max_tokens: source.reasoning.supports_max_tokens === true,
            }
            : undefined,
            context_length: Number(source.context_length || source.inputTokenLimit) || undefined,
            outputTokenLimit:
            Number(source.top_provider?.max_completion_tokens || source.outputTokenLimit) || undefined,
          };
        }

        function resolve(connection) {
          const source = connection || {};
          const model = String(source.modelo || '')
          .toLowerCase()
          .replace(/^models\//, '');
            const format = source.formato || 'openai';
            const capabilities = {
              known: false,
              temperature: true,
              temperatureMax: format === 'anthropic' ? 1 : 2,
              topP: true,
              topK: format === 'anthropic' || format === 'gemini',
              seed:
              ['openai', 'mistral', 'ollama', 'lmstudio'].includes(source.prov) || format === 'gemini',
              penalties: format === 'openai' && ['openai', 'deepseek', 'mistral'].includes(source.prov),
              stop: true,
              tools: true,
              parallelTools: format === 'openai' && ['openai', 'openrouter'].includes(source.prov),
              streamUsage:
              format === 'openai' &&
              ['openai', 'openrouter', 'deepseek', 'groq', 'xai', 'ollama', 'lmstudio'].includes(
                source.prov,
              ),
              thinking: 'unsupported',
              thinkingDefault: false,
              thinkingRequired: false,
              reasoningVisible: true,
              efforts: [],
              budgetMin: 1024,
              budgetMax: 32768,
              supportsThinkingBudget: false,
              contextWindow: null,
              outputLimit: null,
            };
            if (format === 'notion-agents') {
              return {
                ...capabilities,
                known: true,
                temperature: false,
                topP: false,
                topK: false,
                seed: false,
                penalties: false,
                stop: false,
                tools: false,
              };
            }
            if (source.prov === 'openai') {
              const reasoning = /^(o[134](?:-|$)|gpt-5(?:[.-]|$))/.test(model) && !model.includes('chat');
              capabilities.known = /^(gpt-[345]|o[134])/.test(model);
              if (reasoning) {
                const optional = /^gpt-5\.[1245](?:-|$)/.test(model) && !model.includes('pro');
                const sampling = /^gpt-5\.[124](?:-|$)/.test(model) && optional;
                Object.assign(capabilities, {
                    thinking: 'openai',
                    thinkingDefault: !optional || /^gpt-5\.5(?:-|$)/.test(model),
                    thinkingRequired: !optional,
                    reasoningVisible: false,
                    temperature: sampling,
                    topP: sampling,
                    stop: false,
                    penalties: false,
                    seed: false,
                    completionTokens: true,
                    efforts: ['low', 'medium', 'high'],
                });
                if (/^gpt-5(?:-(?:mini|nano))?(?:-|$)/.test(model)) capabilities.efforts.unshift('minimal');
                if (/^gpt-5\.[245]/.test(model)) capabilities.efforts.push('xhigh');
              }
            }
            if (format === 'anthropic') {
              const currentGeneration =
              /^claude-(?:(?:opus|sonnet)-5(?:-|$)|(?:fable|mythos)-5(?:-1)?(?:-|$)|mythos-preview(?:-|$))/.test(
                model,
              );
              const mandatory = /^claude-(?:(?:fable|mythos)-5(?:-1)?(?:-|$)|mythos-preview(?:-|$))/.test(
                model,
              );
              const adaptive = currentGeneration || /^claude-(?:opus|sonnet)-4-[678](?:-|$)/.test(model);
              const manual = /^claude-(?:3-7-sonnet|(?:sonnet|opus)-4(?:-|$)|haiku-4-5)/.test(model);
              capabilities.known = /^claude-/.test(model);
              if (adaptive || manual) {
                capabilities.thinking = adaptive ? 'anthropic-adaptive' : 'anthropic-budget';
                capabilities.thinkingDefault = currentGeneration;
                capabilities.thinkingRequired = mandatory;
                capabilities.supportsThinkingBudget = !adaptive;
                if (adaptive) capabilities.efforts = ['low', 'medium', 'high'];
                capabilities.outputLimit = adaptive ? 128000 : /4-5/.test(model) ? 64000 : null;
              }
              if (currentGeneration || model.includes('4-7') || model.includes('4-8')) {
                capabilities.temperature = false;
                capabilities.topP = false;
                capabilities.topK = false;
              }
            }
            if (format === 'gemini') {
              capabilities.known = /^gemini-/.test(model);
              if (/^gemini-2\.5-(pro|flash)/.test(model)) {
                Object.assign(capabilities, {
                    thinking: 'gemini-budget',
                    supportsThinkingBudget: true,
                    thinkingDefault: !model.includes('lite'),
                    thinkingRequired: model.includes('pro'),
                    budgetMin: model.includes('pro') ? 128 : model.includes('lite') ? 512 : 128,
                    budgetMax: model.includes('pro') ? 32768 : 24576,
                });
              } else if (/^gemini-3(?:\.|-)/.test(model)) {
                Object.assign(capabilities, {
                    thinking: 'gemini-level',
                    thinkingDefault: true,
                    thinkingRequired: true,
                    efforts: model.includes('flash') ? ['minimal', 'low', 'medium', 'high'] : ['low', 'high'],
                });
              }
            }
            if (source.prov === 'deepseek' && format === 'openai') {
              if (/^deepseek-(?:chat|reasoner)$/.test(model)) {
                Object.assign(capabilities, {
                    known: true,
                    thinking: 'deepseek-alias',
                    thinkingDefault: model === 'deepseek-reasoner',
                });
              } else if (/^deepseek-v[34]/.test(model)) {
                Object.assign(capabilities, {
                    known: true,
                    thinking: 'deepseek',
                    thinkingDefault: true,
                    efforts: /^deepseek-v4/.test(model) ? ['low', 'high', 'max'] : [],
                });
              }
            }
            const modelMetadata = metadata(source);
            if (modelMetadata) {
              capabilities.contextWindow = Number(modelMetadata.context_length) || null;
              capabilities.outputLimit = Number(modelMetadata.outputTokenLimit) || capabilities.outputLimit;
            }
            if (
              source.prov === 'openrouter' &&
              modelMetadata &&
              Array.isArray(modelMetadata.supported_parameters)
            ) {
              const supports = (parameter) => modelMetadata.supported_parameters.includes(parameter);
              Object.assign(capabilities, {
                  known: true,
                  temperature: supports('temperature'),
                  topP: supports('top_p'),
                  topK: supports('top_k'),
                  seed: supports('seed'),
                  penalties: supports('frequency_penalty') && supports('presence_penalty'),
                  stop: supports('stop'),
                  tools: supports('tools'),
                  parallelTools: supports('parallel_tool_calls'),
              });
              if (supports('reasoning') || supports('reasoning_effort')) {
                const reasoning = modelMetadata.reasoning || {};
                const allowedEfforts = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'];
                const efforts =
                reasoning.supported_efforts === null
                ? allowedEfforts
                : Array.isArray(reasoning.supported_efforts)
                ? reasoning.supported_efforts
                : [];
                Object.assign(capabilities, {
                    thinking: 'openrouter',
                    thinkingDefault:
                    reasoning.default_enabled !== false && reasoning.default_effort !== 'none',
                    thinkingRequired: reasoning.mandatory === true,
                    supportsThinkingBudget: reasoning.supports_max_tokens === true,
                    efforts: efforts.filter((effort) => allowedEfforts.includes(effort)),
                    reasoningVisible: !/^openai\/(?:o[134]|gpt-5)/.test(model),
                });
              }
            }
            const settings = window.SynapseAIGenerationSettings.normalize(source.generation);
            const active =
            capabilities.thinkingRequired ||
            settings.thinking === 'enabled' ||
            (settings.thinking === 'auto' && capabilities.thinkingDefault);
            capabilities.thinkingActive = capabilities.thinking !== 'unsupported' && active;
            if (
              capabilities.thinkingActive &&
              ['openai', 'anthropic-budget', 'anthropic-adaptive', 'deepseek', 'deepseek-alias'].includes(
                capabilities.thinking,
              )
            ) {
              capabilities.temperature = false;
              capabilities.topP = false;
              capabilities.topK = false;
              capabilities.penalties = false;
            }
            return capabilities;
          }

          window.SynapseAIModelCapabilities = Object.freeze({ remember, resolve, metadata });
      })();
