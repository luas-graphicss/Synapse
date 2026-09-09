'use strict';

const MOD3D_AUTOSAVE_DATABASE = 'synapse-modeler-drafts';
const MOD3D_AUTOSAVE_STORE = 'documents';

function mod3dCreateAutosaveStore(databaseFactory) {
  let connection = null;
  let opening = null;

  function open() {
    if (connection) return Promise.resolve(connection);
    if (opening) return opening;
    opening = new Promise((resolve, reject) => {
        if (databaseFactory === undefined) databaseFactory = globalThis.indexedDB;
        if (!databaseFactory) {
          reject(new Error('IndexedDB is unavailable. Save the editable source to the project.'));
          return;
        }
        const request = databaseFactory.open(MOD3D_AUTOSAVE_DATABASE, 1);
        request.onupgradeneeded = () => {
          const store = request.result.createObjectStore(MOD3D_AUTOSAVE_STORE, { keyPath: 'key' });
          store.createIndex('scope', 'scope', { unique: false });
        };
        request.onerror = () =>
        reject(request.error || new Error('Could not open local recovery storage'));
        request.onblocked = () =>
        reject(new Error('Local recovery database upgrade is blocked by another modeler tab'));
        request.onsuccess = () => {
          connection = request.result;
          connection.onversionchange = () => {
            connection.close();
            connection = null;
            opening = null;
          };
          resolve(connection);
        };
    }).catch((error) => {
        opening = null;
        throw error;
    });
    return opening;
  }

  async function transact(mode, operation) {
    const database = await open();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(MOD3D_AUTOSAVE_STORE, mode);
        let result;
        transaction.oncomplete = () => resolve(result);
        transaction.onabort = () =>
        reject(transaction.error || new Error('Local autosave transaction aborted'));
        transaction.onerror = () =>
        reject(transaction.error || new Error('Local autosave failed; storage may be full'));
        try {
          operation(transaction.objectStore(MOD3D_AUTOSAVE_STORE), (value) => {
              result = value;
          });
        } catch (error) {
          transaction.abort();
          reject(error);
        }
    });
  }

  return {
    async put(record) {
      mod3dSourceAssert(
        record && typeof record.key === 'string' && typeof record.scope === 'string',
        'Invalid draft identity',
      );
      mod3dValidateSourceDocument(record.document);
      mod3dSourceAssert(
        new TextEncoder().encode(JSON.stringify(record)).length <= MOD3D_SOURCE_MAX_BYTES,
        'Local recovery record limit exceeded',
      );
      return transact('readwrite', (store, done) => {
          store.put(record);
          done(record.updatedAt);
      });
    },
    get(key) {
      return transact('readonly', (store, done) => {
          const request = store.get(key);
          request.onsuccess = () => done(request.result || null);
      });
    },
    list(scope) {
      return transact('readonly', (store, done) => {
          const records = [];
          const request = store.index('scope').openCursor(scope);
          request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor) {
              done(records.sort((left, right) => right.updatedAt - left.updatedAt));
              return;
            }
            const record = cursor.value;
            records.push({
                key: record.key,
                documentId: record.document.documentId,
                updatedAt: record.updatedAt,
                modelPath: record.modelPath || '',
                sourcePath: record.sourcePath || '',
                writerId: record.writerId,
            });
            cursor.continue();
          };
      });
    },
    remove(key) {
      return transact('readwrite', (store) => store.delete(key));
    },
    close() {
      if (connection) connection.close();
      connection = null;
      opening = null;
    },
  };
}

function mod3dCreateAutosaveScheduler(options) {
  let timer = null;
  let firstChange = 0;
  let generation = 0;
  let completed = 0;
  let saving = Promise.resolve();
  let disposed = false;
  const status = (state) => {
    if (typeof options.onStatus === 'function') options.onStatus(state);
  };

  function flush() {
    if (timer) clearTimeout(timer);
    timer = null;
    firstChange = 0;
    if (disposed || generation === completed) return saving;
    const current = generation;
    let record;
    try {
      record = options.capture();
    } catch (error) {
      status({ state: 'error', error: error.message || String(error) });
      return Promise.resolve(false);
    }
    if (!record) return saving;
    status({ state: 'saving', key: record.key });
    saving = saving
    .catch(() => undefined)
    .then(() => options.store.put(record))
    .then(() => {
        completed = Math.max(completed, current);
        status({
            state: current === generation ? 'saved' : 'pending',
            updatedAt: record.updatedAt,
            key: record.key,
        });
        return true;
    })
    .catch((error) => {
        status({ state: 'error', error: error.message || String(error), key: record.key });
        return false;
    });
    return saving;
  }

  return {
    changed() {
      if (disposed) return;
      generation += 1;
      if (!firstChange) firstChange = Date.now();
      if (timer) clearTimeout(timer);
      const remaining = Math.max(0, 1500 - (Date.now() - firstChange));
      timer = setTimeout(
        flush,
        Math.min(options.delay === undefined ? 250 : options.delay, remaining),
      );
      status({ state: 'pending' });
    },
    flush,
    pending: () => generation !== completed,
    dispose() {
      disposed = true;
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
