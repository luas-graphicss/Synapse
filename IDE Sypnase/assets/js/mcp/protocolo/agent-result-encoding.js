(function (root) {
    'use strict';

    const encoding = root.SynapseAgentTextEncoding;
    if (!encoding || typeof root.wafCodificarResultado !== 'function') return;
    if (root.wafCodificarResultado.repairsAgentText) return;

    function repairContentItem(item) {
      if (!item || item.type !== 'text' || typeof item.text !== 'string') return item;
      const repaired = encoding.repair(item.text);
      if (repaired === item.text) return item;
      return Object.assign({}, item, { text: repaired });
    }

    function repairResult(result) {
      if (!result || !Array.isArray(result.content)) return result;
      const content = result.content.map(repairContentItem);
      const changed = content.some((item, index) => item !== result.content[index]);
      if (!changed) return result;
      return Object.assign({}, result, { content });
    }

    const encodeWithoutRepair = root.wafCodificarResultado;

    function encodeWithRepair(result, force) {
      try {
        return encodeWithoutRepair(repairResult(result), force);
      } catch (error) {
        root.ignorarErro?.(error, 'agent-result-encoding');
        return encodeWithoutRepair(result, force);
      }
    }

    encodeWithRepair.repairsAgentText = true;
    root.wafCodificarResultado = encodeWithRepair;
})(typeof globalThis !== 'undefined' ? globalThis : window);
