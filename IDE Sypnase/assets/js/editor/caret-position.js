(function () {
    'use strict';

    const copiedProperties = [
      'fontFamily',
      'fontSize',
      'fontWeight',
      'fontStyle',
      'fontVariant',
      'fontVariantLigatures',
      'lineHeight',
      'letterSpacing',
      'textIndent',
      'textTransform',
      'tabSize',
      'paddingTop',
      'paddingRight',
      'paddingBottom',
      'paddingLeft',
      'borderTopWidth',
      'borderLeftWidth',
      'boxSizing',
      'direction',
    ];
    let mirror = null;

    function measure(textarea) {
      if (!mirror) {
        mirror = document.createElement('div');
        mirror.className = 'editor-caret-mirror';
        mirror.setAttribute('aria-hidden', 'true');
        mirror.setAttribute('data-i18n', 'off');
        document.body.appendChild(mirror);
      }
      const style = getComputedStyle(textarea);
      const bounds = textarea.getBoundingClientRect();
      for (const property of copiedProperties) mirror.style[property] = style[property];
      mirror.style.width = `${bounds.width}px`;
      mirror.style.whiteSpace = textarea.wrap === 'off' ? 'pre' : 'pre-wrap';
      mirror.style.overflowWrap = textarea.wrap === 'off' ? 'normal' : 'break-word';
      const marker = document.createElement('span');
      marker.textContent = '\u200b';
      mirror.replaceChildren(
        document.createTextNode(textarea.value.slice(0, textarea.selectionStart)),
        marker,
      );
      const markerBounds = marker.getBoundingClientRect();
      const mirrorBounds = mirror.getBoundingClientRect();
      return {
        left: bounds.left + markerBounds.left - mirrorBounds.left - textarea.scrollLeft,
        top: bounds.top + markerBounds.top - mirrorBounds.top - textarea.scrollTop,
        height: parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.5,
      };
    }

    window.SynapseCaretPosition = Object.freeze({ measure });
})();
