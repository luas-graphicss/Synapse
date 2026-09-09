'use strict';

(function () {
    function number(value) {
      if (value == null || value === '' || typeof value === 'boolean') return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
    }

    function normalize(raw, format = 'openai') {
      if (!raw || typeof raw !== 'object') return null;
      let input = number(raw.prompt_tokens ?? raw.input_tokens);
      let output = number(raw.completion_tokens ?? raw.output_tokens);
      let total = number(raw.total_tokens);
      let reasoning = number(
        raw.completion_tokens_details?.reasoning_tokens ??
        raw.output_tokens_details?.reasoning_tokens,
      );
      let cached = number(
        raw.prompt_tokens_details?.cached_tokens ??
        raw.cache_read_input_tokens ??
        raw.prompt_cache_hit_tokens,
      );
      const cacheWrite = number(raw.cache_creation_input_tokens);
      if (format === 'anthropic' && input != null) input += (cached || 0) + (cacheWrite || 0);
      if (format === 'gemini') {
        input = number(raw.promptTokenCount);
        reasoning = number(raw.thoughtsTokenCount);
        cached = number(raw.cachedContentTokenCount);
        output = number(raw.candidatesTokenCount);
        if (output != null) output += reasoning || 0;
        total = number(raw.totalTokenCount);
      }
      if (input == null && output == null && total == null) return null;
      if (total == null && input != null && output != null) total = input + output;
      return {
        entrada: input,
        saida: output,
        total,
        reasoning,
        cache: cached,
        cacheWrite,
        cost: number(raw.cost),
        complete: total != null && input != null && output != null,
      };
    }

    window.SynapseAIProviderUsage = Object.freeze({ normalize, number });
})();
