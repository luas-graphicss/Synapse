(function (root) {
    'use strict';

    function createCaretPosition(textarea) {
      const mirror = document.createElement('div');
      mirror.className = 'intellisense-caret-mirror';
      mirror.setAttribute('aria-hidden', 'true');
      document.body.appendChild(mirror);
      const properties = [
        'fontFamily',
        'fontSize',
        'fontWeight',
        'fontStyle',
        'lineHeight',
        'letterSpacing',
        'tabSize',
        'textTransform',
        'paddingTop',
        'paddingRight',
        'paddingBottom',
        'paddingLeft',
        'borderTopWidth',
        'borderRightWidth',
        'borderBottomWidth',
        'borderLeftWidth',
        'boxSizing',
        'wordSpacing',
      ];

      function measure(position = textarea.selectionStart) {
        const style = getComputedStyle(textarea);
        for (const property of properties) {
          mirror.style[property] = style[property];
        }
        mirror.style.width = textarea.clientWidth + 'px';
        mirror.textContent = textarea.value.slice(0, position);
        const marker = document.createElement('span');
        marker.textContent = '\u200b';
        mirror.appendChild(marker);
        const markerBounds = marker.getBoundingClientRect();
        const mirrorBounds = mirror.getBoundingClientRect();
        const bounds = textarea.getBoundingClientRect();
        return {
          left: bounds.left + markerBounds.left - mirrorBounds.left - textarea.scrollLeft,
          top: bounds.top + markerBounds.top - mirrorBounds.top - textarea.scrollTop,
          height: parseFloat(style.lineHeight) || 20,
        };
      }

      return Object.freeze({ measure, dispose: () => mirror.remove() });
    }

    root.SynapseIntelligence.createCaretPosition = createCaretPosition;
})(globalThis);
