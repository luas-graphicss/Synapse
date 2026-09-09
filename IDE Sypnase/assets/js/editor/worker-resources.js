(function (root) {
    'use strict';

    const bootstrapUrls = new Map();

    function url(resourceName, scriptUrl) {
      const sourcePath = root.__LP_SRC__?.[scriptUrl];
      if (!sourcePath) return new URL(resourceName, scriptUrl).href;

      const virtualOrigin = 'https://aurora.local/';
      const sourceUrl = new URL(sourcePath, virtualOrigin);
      const resourceUrl = new URL(resourceName, sourceUrl).href;
      const resources = {};
      for (const [path, resource] of Object.entries(root.__LP_MAP__ || {})) {
        if (resource?.u) resources[new URL(path, virtualOrigin).href] = resource.u;
      }
      const resourceBlobUrl = resources[resourceUrl];
      if (!resourceBlobUrl) throw new Error('Worker resource is missing: ' + resourceName);
      const cached = bootstrapUrls.get(resourceUrl);
      if (cached && cached.resourceBlobUrl === resourceBlobUrl) return cached.bootstrapUrl;
      if (cached) URL.revokeObjectURL(cached.bootstrapUrl);

      const bootstrap = [
        '(function () {',
        `const baseUrl = ${JSON.stringify(resourceUrl)};`,
        `const resources = ${JSON.stringify(resources)};`,
        'const nativeImportScripts = self.importScripts.bind(self);',
        'self.importScripts = function (...references) {',
        'for (const reference of references) {',
        'const resolvedUrl = new URL(String(reference), baseUrl).href;',
        'nativeImportScripts(resources[resolvedUrl] || resolvedUrl);',
        '}',
        '};',
        'self.importScripts(baseUrl);',
        '})();',
      ].join('\n');
      const bootstrapUrl = URL.createObjectURL(new Blob([bootstrap], { type: 'text/javascript' }));
      bootstrapUrls.set(resourceUrl, { resourceBlobUrl, bootstrapUrl });
      return bootstrapUrl;
    }

    root.addEventListener('pagehide', (event) => {
        if (event.persisted) return;
        for (const entry of bootstrapUrls.values()) URL.revokeObjectURL(entry.bootstrapUrl);
        bootstrapUrls.clear();
    });
    root.SynapseEditorWorkerResources = Object.freeze({ url });
})(window);
