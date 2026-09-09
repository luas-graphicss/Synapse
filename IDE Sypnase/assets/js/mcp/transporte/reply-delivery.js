(function installReplyDelivery(root) {
    'use strict';

    const limits = {
      attemptMs: 2000,
      deliveryMs: 9000,
      socketAckMs: 500,
      attempts: 3,
      httpConcurrency: 3,
      batchCount: 32,
      batchBytes: 2097152,
      pendingCount: 192,
      pendingBytes: 33554432,
    };
    const pending = new Map();
    const groups = new Map();
    const socketDispatchers = new WeakMap();
    const metrics = {
      acknowledged: 0,
      expired: 0,
      failed: 0,
      retries: 0,
      httpBatches: 0,
      socketAcks: 0,
    };
    let pendingBytes = 0;

    function finish(entry, error, expired = false) {
      if (entry.done) return;
      entry.done = true;
      clearTimeout(entry.expirationTimer);
      clearTimeout(entry.socketTimer);
      entry.removeSocketListener?.();
      pending.delete(entry.key);
      pendingBytes -= entry.bytes;
      groups.get(entry.url)?.queue.delete(entry.key);
      if (error) {
        metrics.failed++;
        entry.reject(error);
      } else {
        metrics.acknowledged++;
        if (expired) metrics.expired++;
        entry.resolve(!expired);
      }
    }

    function schedule(group, delay = 0) {
      if (group.timer || group.running >= limits.httpConcurrency || !group.queue.size) return;
      group.timer = setTimeout(() => {
          group.timer = 0;
          flush(group);
        }, delay);
    }

    function queueHttp(entry) {
      if (entry.done) return;
      let group = groups.get(entry.url);
      if (!group) {
        group = {
          url: entry.url,
          headers: entry.headers,
          queue: new Map(),
          running: 0,
          timer: 0,
        };
        groups.set(entry.url, group);
      }
      group.queue.set(entry.key, entry);
      schedule(group);
    }

    function cleanupGroup(group) {
      if (group.queue.size || group.running) return;
      clearTimeout(group.timer);
      group.timer = 0;
      if (groups.get(group.url) === group) groups.delete(group.url);
    }

    function flush(group) {
      while (group.running < limits.httpConcurrency && group.queue.size) {
        const batch = takeBatch(group);
        if (!batch.length) break;
        group.running++;
        deliverBatch(group, batch);
      }
      cleanupGroup(group);
    }

    function takeBatch(group) {
      const batch = [];
      let bytes = 0;
      for (const [key, entry] of group.queue) {
        if (entry.done) {
          group.queue.delete(key);
          continue;
        }
        if (
          batch.length &&
          (batch.length >= limits.batchCount || bytes + entry.bytes > limits.batchBytes)
        )
        break;
        group.queue.delete(key);
        batch.push(entry);
        bytes += entry.bytes;
      }
      return batch;
    }

    async function deliverBatch(group, batch) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), limits.attemptMs);
      let retryable = true;
      try {
        metrics.httpBatches++;
        for (const entry of batch) entry.attempts++;
        const response = await fetch(group.url, {
            method: 'POST',
            headers: group.headers,
            body: `{"batch":[${batch.map((entry) => entry.serialized).join(',')}]}`,
            signal: controller.signal,
        });
        if (!response.ok) {
          retryable = response.status === 408 || response.status === 429 || response.status >= 500;
          throw new Error(`Reply delivery rejected with HTTP ${response.status}`);
        }
        const acknowledgment = await response.json();
        const valid =
        acknowledgment &&
        (Array.isArray(acknowledgment.ids) ||
          acknowledgment.delivered + acknowledgment.expired === batch.length ||
          Number.isFinite(acknowledgment.recebidas));
        if (!valid) throw new Error('Relay did not acknowledge the response batch');
        for (const entry of batch) {
          if (acknowledgment.ep != null && entry.epoch != null && acknowledgment.ep !== entry.epoch) {
            finish(
              entry,
              new Error('Origin relay restarted; this response cannot be applied to the new epoch'),
            );
          } else if (!Array.isArray(acknowledgment.ids) || acknowledgment.ids.includes(entry.reqId)) {
            finish(
              entry,
              null,
              acknowledgment.expiredIds?.includes(entry.reqId) ||
              acknowledgment.expired === batch.length ||
              acknowledgment.recebidas === 0,
            );
          } else throw new Error('Relay acknowledgment omitted a response identifier');
        }
      } catch (error) {
        for (const entry of batch) {
          if (entry.done) continue;
          if (!retryable || entry.attempts >= limits.attempts || Date.now() >= entry.expiresAt)
          finish(entry, error);
          else {
            metrics.retries++;
            group.queue.set(entry.key, entry);
          }
        }
      } finally {
        clearTimeout(timer);
        group.running--;
        if (group.queue.size) schedule(group, 100);
        cleanupGroup(group);
      }
    }

    function subscribeSocket(entry, socket) {
      let dispatcher = socketDispatchers.get(socket);
      if (!dispatcher) {
        const entries = new Map();
        const onMessage = (event) => {
          let message;
          try {
            message = JSON.parse(event.data);
          } catch {
            return;
          }
          if (message?.t !== 'ack' || !Array.isArray(message.ids)) return;
          for (const requestId of message.ids) {
            for (const pendingEntry of [...(entries.get(requestId) || [])]) {
              if (
                message.ep != null &&
                pendingEntry.epoch != null &&
                message.ep !== pendingEntry.epoch
              )
              continue;
              metrics.socketAcks++;
              finish(
                pendingEntry,
                null,
                message.expiredIds?.includes(requestId) || message.expired === message.ids.length,
              );
            }
          }
        };
        const onClose = () => {
          for (const pendingEntry of [...entries.values()].flatMap((group) => [...group])) {
            clearTimeout(pendingEntry.socketTimer);
            pendingEntry.removeSocketListener?.();
            queueHttp(pendingEntry);
          }
        };
        dispatcher = { entries, onMessage, onClose };
        socketDispatchers.set(socket, dispatcher);
        socket.addEventListener('message', onMessage);
        socket.addEventListener('close', onClose);
        socket.addEventListener('error', onClose);
      }
      if (!dispatcher.entries.has(entry.reqId)) dispatcher.entries.set(entry.reqId, new Set());
      dispatcher.entries.get(entry.reqId).add(entry);
      entry.removeSocketListener = () => {
        const matches = dispatcher.entries.get(entry.reqId);
        matches?.delete(entry);
        if (!matches?.size) dispatcher.entries.delete(entry.reqId);
        if (dispatcher.entries.size) return;
        socket.removeEventListener('message', dispatcher.onMessage);
        socket.removeEventListener('close', dispatcher.onClose);
        socket.removeEventListener('error', dispatcher.onClose);
        if (socketDispatchers.get(socket) === dispatcher) socketDispatchers.delete(socket);
      };
    }

    function trySocket(entry, socket) {
      if (
        !socket ||
        socket.readyState !== 1 ||
        socket.bufferedAmount > limits.batchBytes ||
        typeof socket.addEventListener !== 'function'
      )
      return false;
      subscribeSocket(entry, socket);
      try {
        socket.send(entry.serialized);
        if (!entry.done) entry.socketTimer = setTimeout(() => queueHttp(entry), limits.socketAckMs);
        return true;
      } catch {
        entry.removeSocketListener();
        return false;
      }
    }

    function createResponder(context) {
      const baseUrl = String(context.baseUrl || '').replace(/\/+$/, '');
      const url = `${baseUrl}/bridge/${encodeURIComponent(context.sessionId)}/${encodeURIComponent(context.token)}/reply`;
      const socket = context.socket || null;
      const headers = {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        ...(context.headers || {}),
      };
      return function respond(reqId, body, packet) {
        const epoch = packet?.ep ?? null;
        const key = `${url}|${epoch}|${typeof reqId}:${reqId}`;
        const existing = pending.get(key);
        if (existing) return existing.promise;
        const serialized = JSON.stringify({ t: 'reply', reqId, ep: epoch, body });
        const bytes = serialized.length * 2;
        if (pending.size >= limits.pendingCount || pendingBytes + bytes > limits.pendingBytes)
        return Promise.reject(
          new Error(
            'Reply outbox capacity reached; inspect operation status without repeating the original mutation',
          ),
        );
        const entry = {
          key,
          url,
          headers,
          reqId,
          epoch,
          serialized,
          bytes,
          attempts: 0,
          done: false,
          expiresAt: Date.now() + limits.deliveryMs,
          socketTimer: 0,
          expirationTimer: 0,
        };
        entry.promise = new Promise((resolve, reject) => {
            entry.resolve = resolve;
            entry.reject = reject;
        });
        pending.set(key, entry);
        pendingBytes += bytes;
        entry.expirationTimer = setTimeout(
          () =>
          finish(
            entry,
            new Error('Reply could not be acknowledged; inspect operation status before retrying'),
          ),
          limits.deliveryMs,
        );
        if (!trySocket(entry, socket)) queueHttp(entry);
        return entry.promise;
      };
    }

    root.SynapseMcpReplyDelivery = Object.freeze({
        createResponder,
        state: () => ({
            ...metrics,
            pending: pending.size,
            pendingBytes,
            httpGroups: groups.size,
            httpInFlight: [...groups.values()].reduce((total, group) => total + group.running, 0),
        }),
    });
    root.mcpEnviarResposta = (reqId, body, packet) =>
    createResponder({ baseUrl: mcpBase(), sessionId: MCP.sid, token: MCP.token, socket: MCP.ws })(
      reqId,
      body,
      packet,
    );
})(window);
