(function (root) {
    'use strict';

    function createOption(option, selectedId) {
      const element = document.createElement('option');
      element.value = option.id;
      element.textContent = option.label;
      if (option.fontFamily) element.style.fontFamily = option.fontFamily;
      if (option.id === selectedId) element.selected = true;
      return element;
    }

    function create(options, selectedId, onChange) {
      const field = document.createElement('div');
      field.className = 'settings-dropdown';
      const select = document.createElement('select');
      select.className = 'settings-dropdown-input';
      for (const option of options) select.appendChild(createOption(option, selectedId));
      select.addEventListener('change', () => onChange(select.value));
      field.appendChild(select);
      return field;
    }

    root.SynapseSettingsDropdown = Object.freeze({ create });
})(typeof globalThis !== 'undefined' ? globalThis : window);
