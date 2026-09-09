(function () {
    'use strict';

    function runSteps(steps) {
      const failures = [];
      for (const step of steps) {
        try {
          step.run();
        } catch (error) {
          failures.push({ name: step.name, error: error });
        }
      }
      return failures;
    }

    window.SynapseGuardedSteps = Object.freeze({ runSteps });
})();
