(function (root) {
    'use strict';

    const source = root.SynapseHoverHintSource;
    const view = root.SynapseHoverTooltipView;
    if (!source || !view) return;

    const OPEN_DELAY = 380;
    const FOCUS_DELAY = 120;

    let openTimer = 0;
    let currentElement = null;

    function cancel() {
      clearTimeout(openTimer);
      openTimer = 0;
    }

    function hide() {
      cancel();
      currentElement = null;
      view.hide();
    }

    function schedule(hint, delay) {
      cancel();
      currentElement = hint.element;
      openTimer = setTimeout(() => {
          if (currentElement === hint.element) view.show(hint);
        }, delay);
    }

    function openFrom(target, delay) {
      const hint = source.resolve(target);
      if (!hint) {
        hide();
        return;
      }
      if (hint.element === currentElement && view.isVisible()) return;
      schedule(hint, delay);
    }

    document.addEventListener('pointerover', (event) => {
        if (event.pointerType === 'touch') return;
        openFrom(event.target, OPEN_DELAY);
    });
    document.addEventListener('pointerout', (event) => {
        if (currentElement && !currentElement.contains(event.relatedTarget)) hide();
    });
    document.addEventListener('pointerdown', hide, true);
    document.addEventListener('focusin', (event) => openFrom(event.target, FOCUS_DELAY));
    document.addEventListener('focusout', hide);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') hide();
    });
    document.addEventListener('scroll', hide, true);
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('resize', hide);
    window.addEventListener('blur', hide);
})(typeof globalThis !== 'undefined' ? globalThis : window);
