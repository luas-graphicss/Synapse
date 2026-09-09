(function installCallLifecycle(root) {
    'use strict';

    const managed = new WeakMap();
    const operations = new Map();
    const completed = new Map();
    const limits = {
      retentionMs: 600000,
      completedCount: 128,
      resultBytes: 2097152,
      totalBytes: 16777216,
    };
    const instance =
    root.crypto?.randomUUID?.() ||
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    let sequence = 0;
    let retainedBytes = 0;

    function prune() {
      for (const [id, record] of completed) {
        if (
          Date.now() - record.completedAt <= limits.retentionMs &&
          completed.size <= limits.completedCount &&
          retainedBytes <= limits.totalBytes
        )
        break;
        retainedBytes -= record.bytes;
        completed.delete(id);
        operations.delete(id);
      }
    }

    function describe(record) {
      return {
        operation_id: record.id,
        status: record.status,
        completed: record.status === 'completed',
        retry_original: false,
      };
    }

    function pendingResponse(record, id) {
      record.exposed = true;
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: `Operation is still running, not completed or cancelled. Do not repeat it. Retrieve the actual result using call_status with operation_id="${record.id}" and the same agent.`,
            },
          ],
          structuredContent: describe(record),
        },
      };
    }

    function send(reply, packet, response) {
      try {
        Promise.resolve(reply(packet.reqId, response, packet)).catch((error) =>
          root.ignorarErro?.(error, 'call-response'),
        );
      } catch (error) {
        root.ignorarErro?.(error, 'call-response');
      }
    }

    function pending(message, id) {
      const record = managed.get(message);
      if (!record) return null;
      return Array.isArray(message)
      ? message
      .filter((item) => item?.id !== undefined)
      .map((item) => pendingResponse(record, item.id))
      : pendingResponse(record, id);
    }

    async function execute(packet, handler, reply, budgetMs) {
      prune();
      const message = packet.body;
      const children = Array.isArray(message) ? message : [message];
      const record = {
        id: `${instance}-${++sequence}`,
        status: 'running',
        exposed: false,
        bytes: 0,
        completedAt: 0,
        response: null,
        agents: new Set(children.map((item) => String(item?.params?.arguments?.agent || ''))),
      };
      operations.set(record.id, record);
      for (const item of [message, ...children])
      if (item && typeof item === 'object') managed.set(item, record);
      let responded = false;
      const timer = setTimeout(
        () => {
          responded = true;
          send(reply, packet, pending(message, message?.id ?? null));
        },
        Math.max(1, budgetMs),
      );
      let response;
      try {
        response = await handler();
      } catch (error) {
        const failure = (item) => ({
            jsonrpc: '2.0',
            id: item?.id ?? null,
            error: { code: -32603, message: String(error?.message || error) },
        });
        response = Array.isArray(message)
        ? children.filter((item) => item?.id !== undefined).map(failure)
        : failure(message);
      } finally {
        clearTimeout(timer);
        for (const item of [message, ...children])
        if (item && typeof item === 'object') managed.delete(item);
      }
      record.status = 'completed';
      record.completedAt = Date.now();
      if (record.exposed) {
        try {
          const serialized = JSON.stringify(response);
          if (serialized.length * 2 <= limits.resultBytes) {
            record.bytes = serialized.length * 2;
            record.response = response;
          }
        } catch {
          record.bytes = 0;
        }
        retainedBytes += record.bytes;
        completed.set(record.id, record);
        prune();
      } else operations.delete(record.id);
      if (!responded) send(reply, packet, response);
      return response;
    }

    function decodeResponse(response) {
      if (Array.isArray(response)) return response.map(decodeResponse);
      if (response?.result?._waf !== 'codificado' || typeof root.wafDecodificarArgs !== 'function')
      return response;
      return { ...response, result: root.wafDecodificarArgs(response.result, true) };
    }

    function status(args) {
      prune();
      const record = operations.get(String(args?.operation_id || ''));
      if (!record || !record.agents.has(String(args?.agent || '')))
      throw new Error(
        'Operation not found for this agent, or the retained result expired. Inspect its target before repeating a mutation.',
      );
      const result = describe(record);
      if (result.completed) {
        if (record.response != null) result.response = decodeResponse(record.response);
        else
        result.result_omitted =
        'Operation completed. Its result exceeded the retention limit or was empty. Read its target or process output without repeating the mutation.';
      }
      return result;
    }

    root.SynapseMcpCallLifecycle = Object.freeze({
        execute,
        pending,
        status,
        isManaged: (message) => !!message && managed.has(message),
        state: () => ({
            running: operations.size - completed.size,
            retained: completed.size,
            retainedBytes,
        }),
    });
})(window);
