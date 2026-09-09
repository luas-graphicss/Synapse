(function (root) {
    'use strict';

    const namespace = root.SynapseIntelligence;

    function createCompletionProvider({ client, context, isCurrent, isUnavailable, isComposing }) {
      const model = namespace.projectModel;

      async function complete(request) {
        const captured = context();
        if (!captured || isComposing() || request.signal.aborted) return { items: [] };
        if (isUnavailable()) return null;
        if (
          captured.project !== request.project ||
          captured.file !== request.file ||
          captured.path !== request.path ||
          captured.text !== request.source ||
          captured.position !== request.position
        )
        return { items: [] };
        if (
          !request.explicit &&
          !/[\p{ID_Continue}$.'"/]/u.test(request.source[request.position - 1] || '')
          )
          return { items: [] };
          const snapshot = model.createSnapshot(captured.project, captured.path);
          if (!snapshot) return { items: [] };
          const cancel = () => client.cancel('completions');
          request.signal.addEventListener('abort', cancel, { once: true });
          try {
            const result = await client.request('completions', snapshot, {
                path: captured.path,
                position: captured.position,
            });
            if (request.signal.aborted || !isCurrent(captured, true) || isComposing())
            return { items: [] };
            if (!result || result.error) return null;
            const items = result.items.map((item) => ({
                  label: item.name,
                  insertText: item.insertText,
                  kind: item.kind,
                  start: item.span.start,
                  end: item.span.start + item.span.length,
                  languageItem: item,
                  context: captured,
            }));
            return {
              items,
              prefix: request.source.slice(items[0]?.start ?? request.position, request.position),
              language: 'typescript',
            };
          } finally {
            request.signal.removeEventListener('abort', cancel);
          }
        }

        async function resolve(item) {
          const captured = item.context;
          if (!captured || !isCurrent(captured, true)) return null;
          const result = await client.request(
            'details',
            model.createSnapshot(captured.project, captured.path),
            { path: captured.path, position: captured.position, item: item.languageItem },
          );
          return isCurrent(captured, true) ? result : null;
        }

        return Object.freeze({
            id: 'typescript',
            supports: ({ path }) => model.isScript(path),
            complete,
            resolve,
        });
      }

      namespace.createCompletionProvider = createCompletionProvider;
  })(globalThis);
