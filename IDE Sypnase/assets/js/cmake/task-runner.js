(function (root) {
    'use strict';

    function create(host) {
      let current = null;

      async function cancel() {
        if (!current) return false;
        const operation = current;
        operation.cancelled = true;
        if (operation.processId) await host.stop(operation.processId);
        return true;
      }

      async function run(project, steps, onEvent = () => {}) {
        if (current) throw new Error('A CMake task is already running.');
        if (!steps?.length) throw new Error('No CMake commands to run.');
        const sequence = steps.map((step) => Object.freeze({ ...step }));
        host.assertReady(project, sequence);
        const operation = { project, processId: null, cancelled: false };
        current = operation;
        const results = [];
        host.setBusy(true);
        try {
          for (const step of sequence) {
            if (operation.cancelled) break;
            host.assertProject(project);
            onEvent({ status: 'running', step, project });
            operation.processId = await host.start(project, step.command);
            if (operation.cancelled) await host.stop(operation.processId);
            let result;
            do {
              result = await host.wait(project, operation.processId);
              onEvent({ status: 'output', step, project, output: result.out || '' });
            } while (!result.done);
            operation.processId = null;
            results.push({ ...step, code: result.code });
            if (operation.cancelled) break;
            if (result.code !== 0) {
              const error = new Error(
                `CMake ${step.action} failed (exit ${result.code ?? 'unknown'}).`,
              );
              error.results = results;
              throw error;
            }
          }
          const result = { status: operation.cancelled ? 'cancelled' : 'succeeded', results };
          onEvent({ ...result, project });
          return result;
        } catch (error) {
          if (operation.processId) {
            try {
              await host.stop(operation.processId);
            } catch (stopError) {
              error.message += ` The process may still be running; check the terminal before retrying. ${stopError.message}`;
            }
          }
          onEvent({ status: 'failed', project, message: error.message });
          throw error;
        } finally {
          current = null;
          host.setBusy(false);
        }
      }

      return Object.freeze({ run, cancel, isRunning: () => current !== null });
    }

    root.SYNAPSE_CMAKE_RUNNER = Object.freeze({ create });
})(globalThis);
