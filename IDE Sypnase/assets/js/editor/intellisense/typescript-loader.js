(function (root) {
    'use strict';

    const version = '5.9.2';
    const origins = Object.freeze(['https://cdn.jsdelivr.net/npm/', 'https://unpkg.com/']);
    const libraries = new Map();
    const requests = new Map();
    let loadedOrigin = null;

    function dependencyUrl(origin, file) {
      if (!origins.includes(origin) || !/^(?:typescript\.js|lib(?:\.[\w.]+)?\.d\.ts)$/.test(file))
      throw new Error('Unsupported language dependency');
      return `${origin}typescript@${version}/lib/${file}`;
    }
    async function loadLibrary(name) {
      if (libraries.has(name)) return;
      if (requests.has(name)) return requests.get(name);
      const request = (async () => {
          let failure;
          for (const origin of [loadedOrigin, ...origins].filter(
              (value, index, values) => value && values.indexOf(value) === index,
          )) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 12000);
            try {
              const response = await fetch(dependencyUrl(origin, name), {
                  signal: controller.signal,
                  credentials: 'omit',
                  referrerPolicy: 'no-referrer',
              });
              if (!response.ok) throw new Error(`Language dependency returned HTTP ${response.status}`);
              const text = await response.text();
              if (!text.includes('///') || text.length > 4000000)
              throw new Error('Invalid language declaration');
              libraries.set(name, text);
              return;
            } catch (error) {
              failure = error;
            } finally {
              clearTimeout(timer);
            }
          }
          throw failure || new Error('Language declarations are unavailable');
      })();
      requests.set(name, request);
      try {
        await request;
      } finally {
        requests.delete(name);
      }
    }
    async function ensureLibraries(initialNames) {
      const visited = new Set();
      const queue = [...initialNames];
      while (queue.length) {
        const batch = [...new Set(queue.splice(0, 6))].filter((name) => !visited.has(name));
        batch.forEach((name) => visited.add(name));
        await Promise.all(batch.map(loadLibrary));
        for (const name of batch) {
          const text = libraries.get(name);
          for (const match of text.matchAll(/<reference\s+lib=["']([\w.]+)["']/g)) {
                const dependency = `lib.${match[1]}.d.ts`;
                if (!visited.has(dependency)) queue.push(dependency);
              }
            }
          }
          return libraries;
        }
        async function load() {
          let failure;
          for (const origin of origins) {
            try {
              root.importScripts(dependencyUrl(origin, 'typescript.js'));
              if (root.ts?.version !== version || typeof root.ts.createLanguageService !== 'function')
              throw new Error('Unexpected TypeScript language service');
              loadedOrigin = origin;
              return { typescript: root.ts, libraries };
            } catch (error) {
              failure = error;
            }
          }
          throw failure || new Error('TypeScript is unavailable');
        }
        root.SynapseTypeScriptLoader = Object.freeze({ load, ensureLibraries });
    })(globalThis);
