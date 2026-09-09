(function () {
    'use strict';

    let scheduledFrame = null;

    function dimensions(state, devices, viewport) {
      if (viewport) return { width: viewport.w, height: viewport.h, border: false };
      if (state.device === 'responsive' || !Object.hasOwn(devices, state.device)) return null;
      const preset = devices[state.device];
      const custom = state.customDevice === state.device;
      const width = custom ? state.customW : preset.w;
      const height = custom ? state.customH : preset.h;
      return {
        width: state.rotated ? height : width,
        height: state.rotated ? width : height,
        border: !custom && !!preset.border,
      };
    }

    function fit(stageWidth, stageHeight, width, height, border = 0) {
      if (
        ![stageWidth, stageHeight, width, height].every(
          (value) => Number.isFinite(value) && value > 0,
        )
      )
      return null;
      return Math.min(
        1,
        Math.max(0, (stageWidth - 44) / (width + border)),
        Math.max(0, (stageHeight - 44) / (height + border)),
      );
    }

    function refit() {
      if (scheduledFrame !== null) {
        cancelAnimationFrame(scheduledFrame);
        scheduledFrame = null;
      }
      if (!document.hidden && typeof applyDevice === 'function') applyDevice();
    }

    function schedule() {
      if (scheduledFrame !== null || document.hidden) return;
      scheduledFrame = requestAnimationFrame(() => {
          scheduledFrame = null;
          refit();
      });
    }

    function initialize() {
      const stage = document.getElementById('stage');
      if (!stage) return;
      if (typeof ResizeObserver === 'function') new ResizeObserver(refit).observe(stage);
      window.addEventListener('resize', schedule, { passive: true });
      window.addEventListener('pageshow', refit);
      window.addEventListener('load', refit, { once: true });
      window.visualViewport?.addEventListener('resize', schedule, { passive: true });
      document.addEventListener('visibilitychange', refit);
      if (document.fonts) document.fonts.ready.then(refit, (error) => ignorarErro(error, 'viewportGeometry'));
      refit();
    }

    window.SynapseViewportGeometry = Object.freeze({ dimensions, fit, schedule });
    if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
    else initialize();
})();
