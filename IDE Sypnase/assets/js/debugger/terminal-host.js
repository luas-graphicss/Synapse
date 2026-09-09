(function () {
    'use strict';

    async function synchronizeSources(project) {
      const files = termFilesOf(project);
      const batches = [[]];
      let batchSize = 0;
      for (const file of files) {
        const size = (file.text?.length || file.b64?.length || 0) + file.path.length + 32;
        if (batchSize && batchSize + size > 30 * 1024 * 1024) {
          batches.push([]);
          batchSize = 0;
        }
        batches[batches.length - 1].push(file);
        batchSize += size;
      }
      const locked = new Set();
      let result;
      for (const [index, batch] of batches.entries()) {
        result = await window.termApi('sync', {
            project: termProjName(project),
            files: batch,
            prune: index === batches.length - 1,
            allPaths: Array.from(project.files.keys()),
        });
        for (const file of result.locked || []) locked.add(file);
      }
      return { ...result, locked: Array.from(locked) };
    }

    function createTerminalHost(callbacks) {
      let reservation = false;
      return {
        assertPermission(command) {
          if (typeof termAssertAllowed !== 'function')
          throw new Error('The local terminal is unavailable.');
          termAssertAllowed(command);
        },
        assertAvailable(command) {
          this.assertPermission(command);
          if (!window.SynapseDebug.paths.isLoopback(new URL(termBase()).hostname)) {
            throw new Error(
              'Automatic launch requires a relay on this computer (localhost). Use Attach for other targets.',
            );
          }
          if (TERM.busy || (typeof TM !== 'undefined' && TM.cmd?.busy))
          throw new Error('The terminal is busy. Finish its current command first.');
        },
        reserve() {
          reservation = true;
          TERM.busy = true;
          termPromptState();
        },
        release(record) {
          if (!reservation) return;
          reservation = false;
          TERM.busy = false;
          if (TERM.cur?.procId === record.processId) TERM.cur = null;
          if (record.processId) delete TERM.echoed[record.processId];
          termPromptState();
        },
        projectName: (project) => termProjName(project),
        sync: synchronizeSources,
        api: (action, body) => window.termApi(action, body),
        started(record) {
          TERM.cur = { procId: record.processId };
          if (typeof tmCmdNoteProc === 'function')
          tmCmdNoteProc(record.processId, 'user', record.command, record.project);
          termEcho('sys', `Debugger · ${record.project.name}`);
        },
        onOutput: callbacks.onOutput,
        onError: callbacks.onError,
        async finished(record) {
          if (record.processId && typeof window.termApplyChanges === 'function')
          await window.termApplyChanges(record.project);
          callbacks.onFinished();
        },
      };
    }

    window.SynapseDebug.createTerminalHost = createTerminalHost;
})();
