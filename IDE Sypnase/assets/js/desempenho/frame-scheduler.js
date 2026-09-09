(function () {
    'use strict';

    function create(callback) {
      let scheduled = 0;

      function run() {
        scheduled = 0;
        callback();
      }

      return function schedule() {
        if (scheduled) return;
        if (document.hidden) {
          scheduled = setTimeout(run, 0);
          return;
        }
        scheduled = requestAnimationFrame(run);
      };
    }

    window.SynapseFrameScheduler = Object.freeze({ create });
})();
