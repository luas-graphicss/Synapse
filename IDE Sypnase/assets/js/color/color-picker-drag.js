(function (root) {
    'use strict';

    function track(element, onPointer) {
      element.addEventListener('pointerdown', (event) => {
          event.preventDefault();
          if (element.tabIndex >= 0) element.focus({ preventScroll: true });
          element.setPointerCapture(event.pointerId);
          onPointer(event);
          const moveListener = (moveEvent) => onPointer(moveEvent);
          const finishListener = () => {
            element.removeEventListener('pointermove', moveListener);
            element.removeEventListener('pointerup', finishListener);
            element.removeEventListener('pointercancel', finishListener);
          };
          element.addEventListener('pointermove', moveListener);
          element.addEventListener('pointerup', finishListener);
          element.addEventListener('pointercancel', finishListener);
      });
    }

    root.SynapseColorPickerDrag = Object.freeze({ track });
})(typeof globalThis !== 'undefined' ? globalThis : window);
