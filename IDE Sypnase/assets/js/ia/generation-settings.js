'use strict';

(function () {
    const defaults = Object.freeze({
        thinking: 'auto',
        reasoningEffort: 'auto',
        thinkingBudget: 2048,
        reasoningControl: 'effort',
        topP: null,
        topK: null,
        seed: null,
        frequencyPenalty: null,
        presencePenalty: null,
        stopSequences: [],
        instructions: '',
        toolsEnabled: true,
        parallelTools: true,
    });

    function optionalNumber(value, minimum, maximum, integer = false) {
      if (value === '' || value == null) return null;
      const number = Number(value);
      if (!Number.isFinite(number)) return null;
      const bounded = Math.min(maximum, Math.max(minimum, number));
      return integer ? Math.trunc(bounded) : bounded;
    }

    function normalize(settings = {}) {
      const source = settings && typeof settings === 'object' ? settings : {};
      const sequences = Array.isArray(source.stopSequences)
      ? source.stopSequences
      : String(source.stopSequences || '').split('\n');
      return {
        thinking: ['auto', 'enabled', 'disabled'].includes(source.thinking)
        ? source.thinking
        : 'auto',
        reasoningEffort: ['auto', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'].includes(
          source.reasoningEffort,
        )
        ? source.reasoningEffort
        : 'auto',
        thinkingBudget:
        optionalNumber(source.thinkingBudget, 128, 65536, true) ?? defaults.thinkingBudget,
        reasoningControl: source.reasoningControl === 'budget' ? 'budget' : 'effort',
        topP: optionalNumber(source.topP, 0.01, 1),
        topK: optionalNumber(source.topK, 1, 500, true),
        seed: optionalNumber(source.seed, 0, 2147483647, true),
        frequencyPenalty: optionalNumber(source.frequencyPenalty, -2, 2),
        presencePenalty: optionalNumber(source.presencePenalty, -2, 2),
        stopSequences: sequences
        .map((value) => String(value).slice(0, 200))
        .filter(Boolean)
        .slice(0, 4),
        instructions: String(source.instructions || '').slice(0, 12000),
        toolsEnabled: source.toolsEnabled !== false,
        parallelTools: source.parallelTools !== false,
      };
    }

    window.SynapseAIGenerationSettings = Object.freeze({ defaults, normalize, optionalNumber });
})();
