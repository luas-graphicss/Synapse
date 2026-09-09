'use strict';

(function () {
    function apply(connection, request, body) {
      const settings = window.SynapseAIGenerationSettings.normalize(connection.generation);
      const capabilities = window.SynapseAIModelCapabilities.resolve(connection);
      const format = connection.formato || 'openai';
      const options = format === 'gemini' ? body.generationConfig : body;
      delete options.temperature;
      if (capabilities.temperature) {
        options.temperature = Math.min(
          capabilities.temperatureMax,
          Math.max(0, Number(connection.temp) || 0),
        );
      }
      if (settings.topP != null && capabilities.topP) {
        delete options.temperature;
        options[format === 'gemini' ? 'topP' : 'top_p'] = settings.topP;
      }
      if (settings.topK != null && capabilities.topK) {
        options[format === 'gemini' ? 'topK' : 'top_k'] = settings.topK;
      }
      if (settings.seed != null && capabilities.seed) {
        options[connection.prov === 'mistral' ? 'random_seed' : 'seed'] = settings.seed;
      }
      if (settings.frequencyPenalty != null && capabilities.penalties) {
        options.frequency_penalty = settings.frequencyPenalty;
      }
      if (settings.presencePenalty != null && capabilities.penalties) {
        options.presence_penalty = settings.presencePenalty;
      }
      if (settings.stopSequences.length && capabilities.stop) {
        options[
          format === 'anthropic' ? 'stop_sequences' : format === 'gemini' ? 'stopSequences' : 'stop'
        ] = settings.stopSequences;
      }
      if (!settings.toolsEnabled || !capabilities.tools) delete body.tools;
      if (body.tools?.length && capabilities.parallelTools) {
        body.parallel_tool_calls = settings.parallelTools;
      }
      if (capabilities.completionTokens) {
        body.max_completion_tokens = body.max_tokens;
        delete body.max_tokens;
      }
      if (settings.thinking === 'disabled' && capabilities.thinkingRequired) {
        throw new Error(
          'Este modelo exige raciocínio. Use o modo automático ou escolha um modelo que permita desativá-lo.',
        );
      }
      const mode = capabilities.thinking;
      if (mode === 'openai') {
        if (!capabilities.thinkingActive) body.reasoning_effort = 'none';
        else if (capabilities.efforts.includes(settings.reasoningEffort)) {
          body.reasoning_effort = settings.reasoningEffort;
        }
      }
      if (mode === 'anthropic-budget' && settings.thinking !== 'auto') {
        if (settings.thinking === 'disabled') body.thinking = { type: 'disabled' };
        else {
          if (body.max_tokens <= capabilities.budgetMin) {
            throw new Error(
              'Aumente os tokens de saída para mais de 1.024 antes de ativar o raciocínio.',
            );
          }
          body.thinking = {
            type: 'enabled',
            display: 'summarized',
            budget_tokens: Math.min(
              body.max_tokens - 1,
              Math.max(capabilities.budgetMin, settings.thinkingBudget),
            ),
          };
        }
      }
      if (mode === 'anthropic-adaptive') {
        if (capabilities.thinkingActive) {
          body.thinking = { type: 'adaptive', display: 'summarized' };
          if (capabilities.efforts.includes(settings.reasoningEffort)) {
            body.output_config = { effort: settings.reasoningEffort };
          }
        } else if (settings.thinking === 'disabled') body.thinking = { type: 'disabled' };
      }
      if (mode === 'gemini-budget') {
        options.thinkingConfig = { includeThoughts: true };
        if (settings.thinking === 'disabled') options.thinkingConfig.thinkingBudget = 0;
        if (settings.thinking === 'enabled') {
          options.thinkingConfig.thinkingBudget = Math.min(
            capabilities.budgetMax,
            Math.max(capabilities.budgetMin, settings.thinkingBudget),
          );
        }
      }
      if (mode === 'gemini-level') {
        options.thinkingConfig = { includeThoughts: true };
        if (capabilities.efforts.includes(settings.reasoningEffort)) {
          options.thinkingConfig.thinkingLevel = settings.reasoningEffort;
        }
      }
      if (mode === 'deepseek-alias' && settings.thinking !== 'auto') {
        body.model = settings.thinking === 'enabled' ? 'deepseek-reasoner' : 'deepseek-chat';
      }
      if (mode === 'deepseek') {
        if (settings.thinking !== 'auto') body.thinking = { type: settings.thinking };
        if (capabilities.thinkingActive && capabilities.efforts.includes(settings.reasoningEffort)) {
          body.reasoning_effort = settings.reasoningEffort;
        }
      }
      if (mode === 'openrouter') {
        body.reasoning = { exclude: false };
        if (settings.thinking !== 'auto') body.reasoning.enabled = settings.thinking === 'enabled';
        if (
          capabilities.thinkingActive &&
          settings.reasoningControl === 'budget' &&
          capabilities.supportsThinkingBudget
        ) {
          if (body.max_tokens <= capabilities.budgetMin) {
            throw new Error(
              'Aumente o limite de saída para reservar tokens à resposta além do raciocínio.',
            );
          }
          body.reasoning.max_tokens = Math.min(
            body.max_tokens - 1,
            Math.max(capabilities.budgetMin, settings.thinkingBudget),
          );
        } else if (
          capabilities.thinkingActive &&
          capabilities.efforts.includes(settings.reasoningEffort)
        ) {
          body.reasoning.effort = settings.reasoningEffort;
        }
      }
      return body;
    }

    window.SynapseAIRequestOptions = Object.freeze({ apply });
})();
