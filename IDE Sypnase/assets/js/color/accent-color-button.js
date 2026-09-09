(function (root) {
    'use strict';

    const ACCENT_BUTTON_SELECTOR = '#tmAccents [data-pick]';
    const REOPEN_GUARD_MS = 400;

    let lastOpenAt = 0;

    function findAccentButton(target) {
      if (!target || typeof target.closest !== 'function') return null;
      return target.closest(ACCENT_BUTTON_SELECTOR);
    }

    function togglePicker(button) {
      const accentPicker = root.SynapseAccentColorPicker;
      if (!accentPicker) return;
      const picker = root.SynapseColorPicker;
      if (picker && picker.isOpen()) {
        picker.close();
        return;
      }
      accentPicker.open(button);
      lastOpenAt = Date.now();
    }

    function handleAccentPointerDown(event) {
      const button = findAccentButton(event.target);
      if (!button) return;
      togglePicker(button);
    }

    function handleAccentClick(event) {
      const button = findAccentButton(event.target);
      if (!button) return;
      if (REOPEN_GUARD_MS > Date.now() - lastOpenAt) return;
      togglePicker(button);
    }

    document.addEventListener('pointerdown', handleAccentPointerDown, true);
    document.addEventListener('click', handleAccentClick, true);

    root.SynapseAccentColorButton = Object.freeze({ selector: ACCENT_BUTTON_SELECTOR });
})(typeof globalThis !== 'undefined' ? globalThis : window);
