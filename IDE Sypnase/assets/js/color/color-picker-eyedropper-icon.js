(function (root) {
    'use strict';

    const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
    const PIPETTE_PATHS = [
      'm2 22 1-1h3l9-9',
      'M3 21v-3l9-9',
      'm15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3z',
    ];

    function createPath(commands) {
      const path = document.createElementNS(SVG_NAMESPACE, 'path');
      path.setAttribute('d', commands);
      return path;
    }

    function create(className) {
      const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
      svg.setAttribute('class', className ? 'icon ' + className : 'icon');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      PIPETTE_PATHS.forEach((commands) => svg.appendChild(createPath(commands)));
      return svg;
    }

    root.SynapseColorPickerEyedropperIcon = Object.freeze({ create });
})(typeof globalThis !== 'undefined' ? globalThis : window);
