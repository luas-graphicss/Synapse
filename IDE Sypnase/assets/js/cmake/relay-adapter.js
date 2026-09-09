(function (root) {
    'use strict';

    function create() {
      return root.SYNAPSE_CMAKE_RUNNER.create({
          assertReady(project, steps) {
            if (TERM.busy) throw new Error('The terminal is busy. Wait or stop its current task.');
            for (const step of steps) termAssertAllowed(step.command);
            this.assertProject(project);
          },
          assertProject(project) {
            if (!project?.files?.size) throw new Error('The CMake project is no longer available.');
          },
          setBusy(busy) {
            TERM.busy = busy;
            termPromptState();
            if (busy) termOpen(true);
          },
          start(project, command) {
            return termStart(project, command, 'user');
          },
          wait(project, processId) {
            return termWait(project, processId, 1500);
          },
          stop(processId) {
            return termApi('kill', { procId: processId });
          },
      });
    }

    root.SYNAPSE_CMAKE_RELAY = Object.freeze({ create });
})(globalThis);
