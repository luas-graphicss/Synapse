(function installSessionFlushCoordinator(root) {
    'use strict';

    function create(options) {
      let active = null;
      let queued = null;
      let scheduled = false;
      let lastSuccess = null;
      const metrics = { started: 0, coalesced: 0, reused: 0 };
      const schedule = options.schedule || ((callback) => setTimeout(callback, 0));

      function covered(sequence) {
        return (
          lastSuccess &&
          options.getSavedSequence() >= sequence &&
          (options.canReuse ? options.canReuse(lastSuccess) : true)
        );
      }

      function scheduleNext() {
        if (active || !queued) return;
        if (queued.immediate) return void drain();
        if (scheduled) return;
        scheduled = true;
        schedule(drain);
      }

      async function drain() {
        scheduled = false;
        if (active || !queued) return;
        const batch = queued;
        queued = null;
        if (!batch.force && covered(batch.sequence)) {
          metrics.reused++;
          batch.resolve(lastSuccess);
          scheduleNext();
          return;
        }
        active = batch;
        batch.sequence = options.getSequence();
        metrics.started++;
        try {
          const result = await options.flush(batch.reason);
          if (result?.ok && Number.isFinite(result.rev)) lastSuccess = result;
          else lastSuccess = null;
          batch.resolve(result);
        } catch (error) {
          lastSuccess = null;
          batch.reject(error);
        } finally {
          active = null;
          scheduleNext();
        }
      }

      function request(reason, { force = false, immediate = false } = {}) {
        const sequence = options.getSequence();
        if (!force && active && active.sequence >= sequence) {
          metrics.coalesced++;
          return active.promise;
        }
        if (!force && covered(sequence)) {
          metrics.reused++;
          return Promise.resolve(lastSuccess);
        }
        if (queued) {
          const batch = queued;
          batch.sequence = Math.max(batch.sequence, sequence);
          batch.force ||= force;
          batch.immediate ||= immediate;
          metrics.coalesced++;
          scheduleNext();
          return batch.promise;
        }
        const batch = { sequence, reason, force, immediate };
        batch.promise = new Promise((resolve, reject) => {
            batch.resolve = resolve;
            batch.reject = reject;
        });
        queued = batch;
        scheduleNext();
        return batch.promise;
      }

      return Object.freeze({
          request,
          state: () => ({ ...metrics, active: Number(!!active), queued: Number(!!queued) }),
      });
    }

    root.SynapseSessionFlushCoordinator = Object.freeze({ create });
})(globalThis);
