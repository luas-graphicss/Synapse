(function (root) {
    'use strict';

    function create(checked, onChange) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'settings-checkbox';
      button.setAttribute('role', 'checkbox');
      button.setAttribute('aria-checked', checked ? 'true' : 'false');
      button.addEventListener('click', () => {
          const nextValue = button.getAttribute('aria-checked') !== 'true';
          button.setAttribute('aria-checked', nextValue ? 'true' : 'false');
          onChange(nextValue);
      });
      return button;
    }

    root.SynapseSettingsCheckbox = Object.freeze({ create });
})(typeof globalThis !== 'undefined' ? globalThis : window);
