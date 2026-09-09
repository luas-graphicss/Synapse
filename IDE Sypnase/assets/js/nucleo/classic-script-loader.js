(function (root) {
    'use strict';

    const loaderScript = document.currentScript;
    const virtualResources = root.__LP_MAP__;
    const loaderPath = loaderScript ? root.__LP_SRC__?.[loaderScript.src] : null;
    const virtualOrigin = 'https://aurora.local/';
    const virtualBase = loaderPath
    ? new URL('../../../', new URL(loaderPath, virtualOrigin))
    : new URL('/', virtualOrigin);
    const loadedGroups = new WeakSet();

    function findVirtualResource(resourcePath) {
      return virtualResources[resourcePath] || virtualResources[resourcePath.replace(/^\//, '')];
        }

        function resolveScriptUrl(reference) {
          if (!virtualResources) return new URL(reference, document.baseURI).href;
          const resourcePath = decodeURIComponent(new URL(reference, virtualBase).pathname);
          const resource = findVirtualResource(resourcePath);
          if (!resource?.u) throw new Error('Startup script is missing: ' + resourcePath);
          return resource.u;
        }

        function load(group) {
          if (!(group instanceof HTMLTemplateElement) || !group.hasAttribute('data-synapse-scripts')) {
            throw new TypeError('A startup script group is required.');
          }
          if (loadedGroups.has(group)) return;
          if (document.readyState !== 'loading') {
            throw new Error('Startup scripts must run while the document is being parsed.');
          }
          const scripts = Array.from(group.content.children, (sourceScript) => {
              if (sourceScript.tagName !== 'SCRIPT' || !sourceScript.hasAttribute('src')) {
                throw new TypeError('Startup groups accept external classic scripts only.');
              }
              const scriptType = (sourceScript.getAttribute('type') || '').toLowerCase();
              if (scriptType && !['text/javascript', 'application/javascript'].includes(scriptType)) {
                throw new TypeError('Unsupported startup script type: ' + scriptType);
              }
              if (sourceScript.hasAttribute('async') || sourceScript.hasAttribute('defer')) {
                throw new TypeError('Startup scripts must preserve parser execution order.');
              }
              const script = sourceScript.cloneNode(true);
              script.setAttribute('src', resolveScriptUrl(sourceScript.getAttribute('src')));
              script.setAttribute('type', 'text/javascript');
              return script.outerHTML;
          });
          loadedGroups.add(group);
          document.write(scripts.join('\n'));
        }

        root.SynapseClassicScripts = Object.freeze({ load });
    })(window);
