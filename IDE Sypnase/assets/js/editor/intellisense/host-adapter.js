(function (root) {
    'use strict';

    function observeHost(onChange) {
      const originals = new Map();
      let pending = false;
      let workspaceChanged = false;
      let disposed = false;
      const fileOperations = new Set(['fsChanged', 'mcpAfterWrite', 'mcpBulkChanged']);

      function notify(changed = false) {
        workspaceChanged ||= changed;
        if (pending || disposed) {
          return;
        }
        pending = true;
        queueMicrotask(() => {
            pending = false;
            if (disposed) {
              return;
            }
            const changed = workspaceChanged;
            workspaceChanged = false;
            onChange(changed);
        });
      }

      for (const name of [
          'paintEditor',
          'openFileInEditor',
          'closeTab',
          'editorToEmpty',
          'renderAll',
          'fsChanged',
          'mcpAfterWrite',
          'mcpBulkChanged',
      ]) {
        const original = root[name];
        if (typeof original !== 'function') {
          continue;
        }
        function wrapped(...args) {
          const result = original.apply(this, args);
          if (!fileOperations.has(name) || args[0]?.id === root.State?.active) {
            notify(fileOperations.has(name));
          }
          return result;
        }
        Object.assign(wrapped, original);
        originals.set(name, { original, wrapped });
        root[name] = wrapped;
      }

      return Object.freeze({
          notify,
          dispose() {
            disposed = true;
            for (const [name, entry] of originals) {
              if (root[name] === entry.wrapped) {
                root[name] = entry.original;
              }
            }
          },
      });
    }

    root.SynapseIntelligence.observeHost = observeHost;
})(globalThis);
