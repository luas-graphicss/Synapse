(function () {
    'use strict';

    const debug = window.SynapseDebug;
    const paths = {
      debug:
      'M9 3h6M12 3v3M8 8h8v9a4 4 0 0 1-8 0zM3 10h5M16 10h5M3 16h5M16 16h5M5 4l3 4M19 4l-3 4M12 9v9',
      resume: 'm8 5 11 7-11 7z',
      pause: 'M8 5v14M16 5v14',
      stop: 'M6 6h12v12H6z',
      stepOver: 'M5 10a7 7 0 0 1 14 0M15 8l4 3 3-4M8 19h8',
      stepInto: 'M12 3v12M8 11l4 4 4-4M6 21h12',
      stepOut: 'M12 15V3M8 7l4-4 4 4M6 21h12',
      close: 'm6 6 12 12M6 18 18 6',
      plus: 'M12 5v14M5 12h14',
      remove: 'M5 12h14',
    };

    function element(tag, className, text) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = String(text);
      return node;
    }

    function icon(name) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '1.8');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', paths[name] || paths.debug);
      svg.append(path);
      return svg;
    }

    function button(label, action, symbol, visibleLabel = true) {
      const control = element('button', 'debug-button');
      control.type = 'button';
      control.dataset.debugAction = action;
      control.title = label;
      control.setAttribute('aria-label', label);
      if (symbol) control.append(icon(symbol));
      if (visibleLabel) control.append(element('span', '', label));
      return control;
    }

    function input(label, type = 'text') {
      const field = element('input', 'debug-input');
      field.type = type;
      field.setAttribute('aria-label', label);
      field.placeholder = label;
      field.autocomplete = 'off';
      field.spellcheck = false;
      return field;
    }

    function section(label) {
      const container = element('details', 'debug-section');
      container.open = true;
      container.append(element('summary', '', label));
      const content = element('div', 'debug-section-content');
      container.append(content);
      return { container, content };
    }

    debug.dom = Object.freeze({ element, icon, button, input, section });
})();
