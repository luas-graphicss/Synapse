'use strict';

const MOD3D_DOCUMENT_TRANSFER_PREFIX = 'document-transfer-';
const MOD3D_DOCUMENT_TRANSFER_CHUNK = 524288;
const MOD3D_DOCUMENT_TRANSFER_LIMIT = 41943040;
const MOD3D_DOCUMENT_TRANSFER_TIMEOUT = 45000;

function mod3dCreateDocumentTransport(channel, options = {}) {
  const receiving = new Map();
  const pending = new Map();
  const completed = new Set();
  let disposed = false;

  function finishRequest(id, result) {
    const request = pending.get(id);
    if (!request) return;
    pending.delete(id);
    clearTimeout(request.timeout);
    request.resolve(result);
  }

  function send(id, kind, payload, via) {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    mod3dSourceAssert(
      bytes.length <= MOD3D_DOCUMENT_TRANSFER_LIMIT,
      'Document transfer limit exceeded',
    );
    const dispatch = (suffix, data) =>
    via
    ? channel.responder(via, MOD3D_DOCUMENT_TRANSFER_PREFIX + suffix, data)
    : channel.enviar(MOD3D_DOCUMENT_TRANSFER_PREFIX + suffix, data);
    if (
      !dispatch('start', { id, kind, length: bytes.length, checksum: mod3dResumoDosBytes(bytes) })
    ) {
      return false;
    }
    for (let offset = 0; offset < bytes.length; offset += MOD3D_DOCUMENT_TRANSFER_CHUNK) {
      if (
        !dispatch('chunk', {
            id,
            offset,
            bytes: bytes.slice(offset, offset + MOD3D_DOCUMENT_TRANSFER_CHUNK),
        })
      ) {
        return false;
      }
    }
    return dispatch('end', { id });
  }

  function discard(id) {
    const transfer = receiving.get(id);
    if (transfer) clearTimeout(transfer.timeout);
    receiving.delete(id);
  }

  async function deliver(transfer) {
    const id = transfer.id;
    try {
      mod3dSourceAssert(
        transfer.offset === transfer.bytes.length &&
        mod3dResumoDosBytes(transfer.bytes) === transfer.checksum,
        'Incomplete or corrupted document transfer',
      );
      const payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(transfer.bytes));
      if (transfer.kind === 'response') {
        finishRequest(id, payload);
        return;
      }
      mod3dSourceAssert(!completed.has(id), 'Document request already processed');
      completed.add(id);
      while (completed.size > 120) completed.delete(completed.values().next().value);
      const result = await options.onRequest(payload);
      if (!disposed) send(id, 'response', { ok: true, ...result }, transfer.via);
    } catch (error) {
      const result = { ok: false, error: error.message || String(error) };
      if (transfer.kind === 'response') finishRequest(id, result);
      else if (!disposed) send(id, 'response', result, transfer.via);
    }
  }

  function receive(envelope, via) {
    if (
      disposed ||
      !envelope ||
      typeof envelope.tipo !== 'string' ||
      !envelope.tipo.startsWith(MOD3D_DOCUMENT_TRANSFER_PREFIX)
    ) {
      return false;
    }
    const data = envelope.dados || {};
    const id = data.id;
    if (typeof id !== 'string' || !/^[\w-]{1,80}$/.test(id)) return true;
    try {
      if (envelope.tipo === MOD3D_DOCUMENT_TRANSFER_PREFIX + 'start') {
        mod3dSourceAssert(
          !receiving.has(id) && receiving.size < 4,
          'Concurrent document transfer limit exceeded',
        );
        mod3dSourceAssert(
          data.kind === 'response'
          ? pending.has(id)
          : data.kind === 'request' && typeof options.onRequest === 'function',
          'Unsolicited document transfer',
        );
        mod3dSourceInteger(data.length, 1, MOD3D_DOCUMENT_TRANSFER_LIMIT, 'document transfer size');
        mod3dSourceAssert(
          typeof data.checksum === 'string' && /^[0-9a-f]{8}$/.test(data.checksum),
          'Invalid document checksum',
        );
        receiving.set(id, {
            id,
            kind: data.kind,
            via,
            checksum: data.checksum,
            bytes: new Uint8Array(data.length),
            offset: 0,
            timeout: setTimeout(() => discard(id), MOD3D_DOCUMENT_TRANSFER_TIMEOUT),
        });
        return true;
      }
      const transfer = receiving.get(id);
      if (!transfer) return true;
      if (envelope.tipo === MOD3D_DOCUMENT_TRANSFER_PREFIX + 'chunk') {
        const bytes = mod3dComoBytes(data.bytes);
        mod3dSourceAssert(
          bytes &&
          bytes.length > 0 &&
          bytes.length <= MOD3D_DOCUMENT_TRANSFER_CHUNK &&
          data.offset === transfer.offset &&
          transfer.offset + bytes.length <= transfer.bytes.length,
          'Out-of-order document block',
        );
        transfer.bytes.set(bytes, transfer.offset);
        transfer.offset += bytes.length;
      } else if (envelope.tipo === MOD3D_DOCUMENT_TRANSFER_PREFIX + 'end') {
        discard(id);
        void deliver(transfer);
      }
    } catch (error) {
      const transfer = receiving.get(id);
      discard(id);
      const result = { ok: false, error: error.message || String(error) };
      if (pending.has(id)) finishRequest(id, result);
      else if (transfer && transfer.kind === 'request') send(id, 'response', result, via);
    }
    return true;
  }

  return {
    receive,
    request(action, data = {}) {
      if (disposed || !channel || !channel.ligado()) {
        return Promise.resolve({
            ok: false,
            error: 'Editor is offline. The local draft is unchanged.',
        });
      }
      return new Promise((resolve) => {
          const id = mod3dNovoId();
          pending.set(id, {
              resolve,
              timeout: setTimeout(() => {
                  discard(id);
                  finishRequest(id, {
                      ok: false,
                      error: 'No confirmation received. Check the project before retrying.',
                  });
                }, MOD3D_DOCUMENT_TRANSFER_TIMEOUT),
          });
          try {
            if (!send(id, 'request', { action, ...data })) {
              finishRequest(id, { ok: false, error: 'Document transport disconnected' });
            }
          } catch (error) {
            finishRequest(id, { ok: false, error: error.message || String(error) });
          }
      });
    },
    dispose() {
      disposed = true;
      for (const id of receiving.keys()) discard(id);
      for (const id of pending.keys()) {
        finishRequest(id, { ok: false, error: 'Document channel closed' });
      }
    },
  };
}
