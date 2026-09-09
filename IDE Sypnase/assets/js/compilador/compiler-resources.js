(function (root) {
    'use strict';
    const script = document.currentScript;
    const sourcePath = root.__LP_SRC__?.[script?.src];
    const virtualOrigin = 'https://aurora.local/';
    function resolve(reference) {
      if (sourcePath && root.__LP_MAP__) {
        const path = decodeURIComponent(new URL(reference, new URL(sourcePath, virtualOrigin)).pathname);
        const resource = root.__LP_MAP__[path] || root.__LP_MAP__[path.replace(/^\//, '')];
            if (!resource?.u) throw new Error('Compiler resource is missing: ' + path);
            return resource.u;
          }
          return new URL(reference, script.src).href;
        }
        async function runWorker(name, payload, options) {
          let bootstrap;
          try {
            let url = resolve(name);
            if (sourcePath && root.__LP_MAP__) {
              const names = ['native-build-config.js', 'wasi.js', 'toolchain-archive.js', 'compiler-filesystem.js', 'c-compiler-core.js'];
              const imports = Object.fromEntries(names.map((entry) => [entry, resolve(entry)]));
              const source = 'const importMap=' + JSON.stringify(imports) + ';const originalImportScripts=importScripts;self.importScripts=(...paths)=>originalImportScripts(...paths.map(path=>{if(!importMap[path])throw new Error("Unknown compiler import: "+path);return importMap[path]}));originalImportScripts(' + JSON.stringify(url) + ');';
              bootstrap = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
              url = bootstrap;
            }
            return await root.SYNAPSE_WORKER_TASK.run(url, payload, options);
          } finally {
            if (bootstrap) URL.revokeObjectURL(bootstrap);
          }
        }
        root.SYNAPSE_COMPILER_RESOURCES = { resolve, runWorker };
    })(globalThis);
