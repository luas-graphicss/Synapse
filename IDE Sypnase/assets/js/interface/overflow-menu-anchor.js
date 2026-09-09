(function (root) {
    'use strict';

    const VIEWPORT_MARGIN = 8;
    const FALLBACK_MENU_WIDTH = 260;
    const FALLBACK_MENU_HEIGHT = 200;

    function clampValue(value, minimum, maximum) {
      if (maximum < minimum) return minimum;
      if (value < minimum) return minimum;
      if (value > maximum) return maximum;
      return value;
    }

    function measureMenu(menu) {
      const bounds = menu.getBoundingClientRect();
      return {
        width: bounds.width || FALLBACK_MENU_WIDTH,
        height: bounds.height || FALLBACK_MENU_HEIGHT,
      };
    }

    function anchorToTrigger(menu, trigger) {
      if (!menu || !trigger) return;
      const triggerBounds = trigger.getBoundingClientRect();
      const menuSize = measureMenu(menu);
      const left = clampValue(
        triggerBounds.left,
        VIEWPORT_MARGIN,
        root.innerWidth - menuSize.width - VIEWPORT_MARGIN,
      );
      const spaceBelowTrigger = root.innerHeight - triggerBounds.bottom - VIEWPORT_MARGIN * 2;
      const spaceAboveTrigger = triggerBounds.top - VIEWPORT_MARGIN * 2;
      const shouldOpenAboveTrigger =
      menuSize.height > spaceBelowTrigger && spaceAboveTrigger > spaceBelowTrigger;
      const preferredTop = shouldOpenAboveTrigger
      ? triggerBounds.top - menuSize.height - VIEWPORT_MARGIN
      : triggerBounds.bottom + VIEWPORT_MARGIN;
      const visibleMenuHeight = Math.min(
        menuSize.height,
        root.innerHeight - VIEWPORT_MARGIN * 2,
      );
      const top = clampValue(
        preferredTop,
        VIEWPORT_MARGIN,
        root.innerHeight - visibleMenuHeight - VIEWPORT_MARGIN,
      );
      menu.style.setProperty('--workspace-menu-top', Math.round(top) + 'px');
      menu.style.setProperty('--workspace-menu-left', Math.round(left) + 'px');
    }

    root.SynapseOverflowMenuAnchor = Object.freeze({ anchorToTrigger });
})(typeof globalThis !== 'undefined' ? globalThis : window);
