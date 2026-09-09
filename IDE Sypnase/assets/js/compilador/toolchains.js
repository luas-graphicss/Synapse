(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.SYNAPSE_TOOLCHAINS = api;
})(globalThis, function () {
    'use strict';
    const registry = new Map();
    function canceledError() { return Object.assign(new Error('Toolchain download canceled.'), { name: 'AbortError', cancelado: true }); }
    function checkCanceled(signal) { if (signal?.aborted) throw canceledError(); }
    function validateDefinition(definition) {
      if (!definition?.id || !definition.versao || !Array.isArray(definition.recursos) || !definition.recursos.length) throw new Error('Toolchain identity, version and resources are required.');
      const names = new Set();
      for (const resource of definition.recursos) {
        if (!resource.nome || names.has(resource.nome) || !/^[a-f\d]{64}$/i.test(resource.sha256 || '') || !Number.isInteger(resource.bytes) || resource.bytes <= 0 || resource.bytes > 134217728 || !Array.isArray(resource.urls) || !resource.urls.length || resource.urls.some((url) => typeof url !== 'string' || !url.trim() || /^(?:javascript|data|file):/i.test(url))) throw new Error('Toolchain resource requires a unique name, pinned size, SHA-256 and safe URLs.');
        names.add(resource.nome);
      }
      return definition;
    }
    function registrar(definition) {
      validateDefinition(definition);
      const registered = Object.freeze({ ...definition, recursos: Object.freeze(definition.recursos.map((resource) => Object.freeze({ ...resource, urls: Object.freeze([...resource.urls]) }))) });
      registry.set(registered.id, registered);
      return registered;
    }
    async function sha256hex(bytes) {
      if (!globalThis.crypto?.subtle?.digest) throw new Error('SHA-256 verification requires a secure context.');
      return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (value) => value.toString(16).padStart(2, '0')).join('');
    }
    function cacheRequest(mode, operation) {
      return new Promise((resolve) => {
          let database;
          let settled = false;
          const finish = (value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            database?.close();
            resolve(value ?? null);
          };
          const timer = setTimeout(() => finish(null), 1500);
          try {
            const request = indexedDB.open('synapse-toolchains', 1);
            request.onupgradeneeded = () => {
              const store = request.result;
              if (!store.objectStoreNames.contains('recursos')) store.createObjectStore('recursos', { keyPath: 'chave' });
            };
            request.onerror = request.onblocked = () => finish(null);
            request.onsuccess = () => {
              database = request.result;
              if (settled) { database.close(); return; }
              try {
                const transaction = database.transaction('recursos', mode);
                const result = operation(transaction.objectStore('recursos'));
                transaction.oncomplete = () => finish(result?.result);
                transaction.onerror = transaction.onabort = () => finish(null);
              } catch { finish(null); }
            };
          } catch { finish(null); }
      });
    }
    async function verified(bytes, resource) {
      return bytes?.byteLength === resource.bytes && await sha256hex(bytes) === resource.sha256.toLowerCase();
    }
    async function download(url, resource, signal, onProgress) {
      const controller = new AbortController();
      const abort = () => controller.abort();
      checkCanceled(signal);
      signal?.addEventListener('abort', abort, { once: true });
      let reader;
      let idleTimer;
      let timedOut = false;
      const timeout = () => { timedOut = true; controller.abort(); };
      const deadline = setTimeout(timeout, 60000);
      const resetIdle = () => { clearTimeout(idleTimer); idleTimer = setTimeout(timeout, 20000); };
      try {
        resetIdle();
        const response = await fetch(url, { signal: controller.signal, credentials: 'omit' });
        if (!response.ok) throw new Error('HTTP ' + response.status + ' for ' + url);
        if (Number(response.headers.get('content-length')) > resource.bytes) throw new Error('Toolchain exceeds its pinned size.');
        const chunks = [];
        let count = 0;
        if (response.body?.getReader) {
          reader = response.body.getReader();
          while (true) {
            const item = await reader.read();
            checkCanceled(signal);
            if (item.done) break;
            count += item.value.length;
            if (count > resource.bytes) throw new Error('Toolchain exceeds its pinned size.');
            chunks.push(item.value);
            resetIdle();
            onProgress(count);
          }
        } else {
          const chunk = new Uint8Array(await response.arrayBuffer());
          chunks.push(chunk);
          count = chunk.length;
        }
        if (count !== resource.bytes) throw new Error('Toolchain size does not match the catalog.');
        const bytes = new Uint8Array(count);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        if (!await verified(bytes, resource)) throw new Error('SHA-256 integrity check failed for ' + resource.nome);
        checkCanceled(signal);
        return bytes;
      } catch (error) {
        if (signal?.aborted) throw canceledError();
        if (timedOut) throw new Error('Toolchain download timed out.');
        throw error;
      } finally {
        clearTimeout(deadline);
        clearTimeout(idleTimer);
        signal?.removeEventListener('abort', abort);
        controller.abort();
        reader?.cancel().catch(() => {});
      }
    }
    async function carregar(id, options = {}) {
      const definition = validateDefinition(typeof id === 'string' ? registry.get(id) : id);
      if (!globalThis.crypto?.subtle?.digest) throw new Error('SHA-256 verification requires a secure context.');
      const started = Date.now();
      const arquivos = Object.create(null);
      let doCache = true;
      let loadedBytes = 0;
      const total = definition.recursos.reduce((sum, resource) => sum + resource.bytes, 0);
      const progress = (fase, recurso, count = 0) => options.aoProgresso?.({ fase, recurso, carregado: loadedBytes + count, total, pct: Math.round((loadedBytes + count) / total * 100) });
      for (const resource of definition.recursos) {
        checkCanceled(options.sinal);
        const key = definition.id + '@' + definition.versao + '/' + resource.nome;
        const cached = options.ignorarCache ? null : await cacheRequest('readonly', (store) => store.get(key));
        checkCanceled(options.sinal);
        let bytes = cached?.dados instanceof ArrayBuffer ? new Uint8Array(cached.dados) : null;
        if (!bytes || !await verified(bytes, resource)) {
          if (cached) await cacheRequest('readwrite', (store) => store.delete(key));
          doCache = false;
          bytes = null;
          const failures = [];
          for (const url of resource.urls) {
            checkCanceled(options.sinal);
            try {
              progress('baixando', resource.nome);
              bytes = await download(url, resource, options.sinal, (count) => progress('baixando', resource.nome, count));
              break;
            } catch (error) {
              checkCanceled(options.sinal);
              failures.push(error.message);
            }
          }
          if (!bytes) throw new Error('All toolchain mirrors failed: ' + failures.join(' | '));
          checkCanceled(options.sinal);
          await cacheRequest('readwrite', (store) => store.put({ chave: key, dados: bytes.buffer, bytes: bytes.length, quando: Date.now(), meta: { sha256: resource.sha256 } }));
        }
        checkCanceled(options.sinal);
        arquivos[resource.nome] = bytes;
        loadedBytes += bytes.length;
        progress('cache', resource.nome);
      }
      progress('pronto', null);
      return { id: definition.id, versao: definition.versao, nome: definition.nome || definition.id, arquivos, doCache, ms: Date.now() - started };
    }
    async function estaEmCache(id) {
      const definition = typeof id === 'string' ? registry.get(id) : id;
      if (!definition) return false;
      try {
        for (const resource of validateDefinition(definition).recursos) {
          const row = await cacheRequest('readonly', (store) => store.get(definition.id + '@' + definition.versao + '/' + resource.nome));
          if (!row?.dados || !await verified(new Uint8Array(row.dados), resource)) return false;
        }
        return true;
      } catch { return false; }
    }
    const listarCache = async () => (await cacheRequest('readonly', (store) => store.getAll()) || []).map(({ chave, bytes, quando }) => ({ chave, bytes, quando }));
    async function limparCache(prefix) {
      if (!prefix) await cacheRequest('readwrite', (store) => store.clear());
      else for (const key of await cacheRequest('readonly', (store) => store.getAllKeys()) || []) if (key.startsWith(prefix)) await cacheRequest('readwrite', (store) => store.delete(key));
      return true;
    }
    return {
      registrar, obter: (id) => registry.get(id) || null, listar: () => [...registry.values()], carregar, estaEmCache, _sha256hex: sha256hex,
      cache: { listar: listarCache, tamanho: async () => (await listarCache()).reduce((sum, row) => sum + (row.bytes || 0), 0), limpar: limparCache },
    };
});
