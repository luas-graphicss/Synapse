(function () {
    'use strict';
    const catalog = window.SynapseFileIconCatalog;
    const cache = new Map();
    const resolve = catalog.resolve;
    function escape(value) {
      return value.replace(
        /[&<>"']/g,
          (character) =>
          ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
        );
      }

      function render(path) {
        const icon = resolve(path);
        const key = icon.name + ':' + icon.label;
        if (!cache.has(key)) {
          const label = escape(icon.label);
          const size = icon.label.length > 2 ? 7 : icon.label.length > 1 ? 9 : 12;
          const symbol =
          icon.name === 'react'
          ? '<g class="language-symbol" transform="translate(12 14.5)" fill="none" stroke="currentColor" stroke-width=".75"><ellipse rx="4.8" ry="1.9"/><ellipse rx="4.8" ry="1.9" transform="rotate(60)"/><ellipse rx="4.8" ry="1.9" transform="rotate(120)"/><circle r=".8" fill="currentColor" stroke="none"/></g>'
          : `<text x="12" y="16.7" text-anchor="middle" fill="currentColor" stroke="none" font-family="Arial,sans-serif" font-size="${size}" font-weight="700">${label}</text>`;
          cache.set(
            key,
            `<svg class="icon file-language-icon" data-language="${icon.name}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" style="color:${icon.color}"><path d="M5 2.75h9.5L19 7.25V21H5Z" fill="currentColor" fill-opacity=".08" stroke="currentColor" stroke-width="1.2"/><path d="M14 3v5h5" fill="none" stroke="currentColor" stroke-width="1.2"/>${symbol}</svg>`,
          );
        }
        return cache.get(key);
      }

      window.SynapseFileIcons = Object.freeze({ resolve, render, extensions: catalog.extensions });
  })();
