(function (root) {
    'use strict';

    const drag = root.SynapseColorPickerDrag;
    const SCREEN_MARGIN = 12;

    function clampPosition(value, size, limit) {
      const maximum = Math.max(SCREEN_MARGIN, limit - size - SCREEN_MARGIN);
      return Math.min(Math.max(value, SCREEN_MARGIN), maximum);
    }

    function moveTo(element, left, top) {
      const bounds = element.getBoundingClientRect();
      element.style.left = Math.round(clampPosition(left, bounds.width, root.innerWidth)) + 'px';
      element.style.top = Math.round(clampPosition(top, bounds.height, root.innerHeight)) + 'px';
    }

    function placeNear(element, anchorBounds) {
      const bounds = element.getBoundingClientRect();
      if (!anchorBounds) {
        moveTo(
          element,
          (root.innerWidth - bounds.width) / 2,
          (root.innerHeight - bounds.height) / 2,
        );
        return;
      }
      const spaceBelow = root.innerHeight - anchorBounds.bottom - SCREEN_MARGIN * 2;
      const fitsBelow = spaceBelow >= bounds.height;
      const top = fitsBelow
      ? anchorBounds.bottom + SCREEN_MARGIN
      : anchorBounds.top - bounds.height - SCREEN_MARGIN;
      moveTo(element, anchorBounds.left, top);
    }

    function keepInsideScreen(element) {
      const bounds = element.getBoundingClientRect();
      moveTo(element, bounds.left, bounds.top);
    }

    function enableDragging(element, handle) {
      let grabOffsetX = 0;
      let grabOffsetY = 0;
      handle.addEventListener('pointerdown', (event) => {
          const bounds = element.getBoundingClientRect();
          grabOffsetX = event.clientX - bounds.left;
          grabOffsetY = event.clientY - bounds.top;
      });
      drag.track(handle, (event) => {
          moveTo(element, event.clientX - grabOffsetX, event.clientY - grabOffsetY);
      });
    }

    root.SynapseColorPickerWindow = Object.freeze({ placeNear, keepInsideScreen, enableDragging });
})(typeof globalThis !== 'undefined' ? globalThis : window);
