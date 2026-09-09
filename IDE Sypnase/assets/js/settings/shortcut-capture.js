(function (root) {
    'use strict';

    const format = root.SynapseShortcutFormat;
    let listener = null;

    function isActive() {
      return listener !== null;
    }

    function stop() {
      if (!listener) return;
      root.removeEventListener('keydown', listener, true);
      listener = null;
    }

    function start(options) {
      const settings = options || {};
      stop();
      listener = (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.key === 'Escape') {
          stop();
          if (typeof settings.onCancel === 'function') settings.onCancel();
          return;
        }
        const binding = format.fromEvent(event);
        if (!binding) return;
        stop();
        if (typeof settings.onCapture === 'function') settings.onCapture(binding);
      };
      root.addEventListener('keydown', listener, true);
    }

    root.SynapseShortcutCapture = Object.freeze({ start, stop, isActive });
})(typeof globalThis !== 'undefined' ? globalThis : window);
