(function (root) {
    'use strict';

    if (root.parent === root || !root.__LP_SRC__ || !root.__LP_MAP__) {
      root.SynapsePreviewSession = null;
      return;
    }

    const records = new Map();
    root.SynapsePreviewSession = Object.freeze({
        get(key) {
          return structuredClone(records.get(key));
        },
        set(key, value) {
          records.set(key, structuredClone(value));
        },
        delete(key) {
          records.delete(key);
        },
        keys() {
          return [...records.keys()];
        },
    });
})(window);
