(function () {
    'use strict';

    class InspectorConnection {
      constructor(endpoint, options = {}) {
        this.endpoint = window.SynapseDebug.paths.inspectorEndpoint(endpoint);
        this.options = options;
        this.pending = new Map();
        this.sequence = 0;
        this.closed = false;
        this.opened = false;
      }

      connect() {
        if (this.socket) throw new Error('This Inspector connection has already been used.');
        return new Promise((resolve, reject) => {
            const Socket = this.options.WebSocket || window.WebSocket;
            this.socket = new Socket(this.endpoint);
            this.openReject = reject;
            this.openTimer = setTimeout(
              () => this.fail(new Error('Inspector connection timed out.')),
              this.options.timeout || 10000,
            );
            this.socket.addEventListener('open', () => {
                if (this.closed) return;
                clearTimeout(this.openTimer);
                this.opened = true;
                this.openReject = null;
                resolve(this);
            });
            this.socket.addEventListener('message', (event) => this.receive(event.data));
            this.socket.addEventListener('error', () =>
              this.fail(
                new Error(
                  'Cannot connect to Inspector. Check the target, browser origin permission and local network access.',
                ),
              ),
            );
            this.socket.addEventListener('close', () =>
              this.fail(new Error('Inspector disconnected.')),
            );
        });
      }

      receive(text) {
        if (this.closed) return;
        let message;
        try {
          message = JSON.parse(text);
        } catch {
          this.fail(new Error('Inspector returned invalid JSON.'));
          return;
        }
        if (!message || typeof message !== 'object') return;
        if (typeof message.id === 'number') {
          const pending = this.pending.get(message.id);
          if (!pending) return;
          clearTimeout(pending.timer);
          this.pending.delete(message.id);
          if (message.error)
          pending.reject(new Error(message.error.message || 'Inspector request failed.'));
          else pending.resolve(message.result || {});
        } else if (typeof message.method === 'string') {
          this.options.onEvent?.(message.method, message.params || {});
        }
      }

      request(method, params = {}) {
        if (!this.opened || this.closed)
        return Promise.reject(new Error('Inspector is not connected.'));
        const id = ++this.sequence;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`Inspector request timed out: ${method}`));
              }, this.options.timeout || 10000);
            this.pending.set(id, { resolve, reject, timer });
            try {
              this.socket.send(JSON.stringify({ id, method, params }));
            } catch (error) {
              this.pending.delete(id);
              clearTimeout(timer);
              reject(error);
            }
        });
      }

      fail(error) {
        if (this.closed) return;
        this.closed = true;
        clearTimeout(this.openTimer);
        this.openReject?.(error);
        this.openReject = null;
        for (const pending of this.pending.values()) {
          clearTimeout(pending.timer);
          pending.reject(error);
        }
        this.pending.clear();
        if (this.socket && this.socket.readyState < 2) this.socket.close();
        this.options.onClose?.(error);
      }

      close() {
        this.fail(new Error('Inspector connection closed.'));
      }
    }

    window.SynapseDebug.InspectorConnection = InspectorConnection;
})();
