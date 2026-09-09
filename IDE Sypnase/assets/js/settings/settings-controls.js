(function (root) {
    'use strict';

    function createElement(tag, className, text) {
      const element = document.createElement(tag);
      if (className) element.className = className;
      if (text) element.textContent = text;
      return element;
    }

    function createSection(title) {
      const element = createElement('section', 'settings-section');
      const head = createElement('div', 'settings-section-head');
      head.appendChild(createElement('h3', 'settings-section-title', title));
      head.appendChild(createElement('span', 'settings-section-rule'));
      const body = createElement('div', 'settings-section-body');
      element.appendChild(head);
      element.appendChild(body);
      return { element, head, body };
    }

    function createRow(label, description, control) {
      const row = createElement('div', 'settings-row');
      const text = createElement('div', 'settings-row-text');
      text.appendChild(createElement('span', 'settings-row-label', label));
      if (description) text.appendChild(createElement('span', 'settings-row-description', description));
      const holder = createElement('div', 'settings-row-control');
      if (control) holder.appendChild(control);
      row.appendChild(text);
      row.appendChild(holder);
      return row;
    }

    function createButton(label, variant, action) {
      const button = createElement('button', 'settings-button', label);
      button.type = 'button';
      if (variant) button.classList.add(variant);
      if (typeof action === 'function') button.addEventListener('click', action);
      return button;
    }

    function createSearchField(placeholder, onInput) {
      const input = document.createElement('input');
      input.type = 'search';
      input.className = 'settings-search';
      input.placeholder = placeholder;
      input.spellcheck = false;
      input.addEventListener('input', () => onInput(input.value));
      return input;
    }

    root.SynapseSettingsControls = Object.freeze({
        createElement,
        createSection,
        createRow,
        createButton,
        createSearchField,
    });
})(typeof globalThis !== 'undefined' ? globalThis : window);
