(function () {
    'use strict';

    function create({ canvas, scroll, grid, onResize }) {
      const panel = scroll.parentElement;
      const viewport = document.createElement('div');
      viewport.className = 'editor-minimap-layout';
      panel.insertBefore(viewport, scroll);
      viewport.append(scroll, canvas);
      let enabled = false;

      function synchronize() {
        const visible = enabled && !grid.classList.contains('hidden') && !grid.hidden;
        viewport.classList.toggle('editor-minimap-visible', visible);
        panel.classList.toggle('editor-minimap-visible', visible);
        canvas.classList.toggle('hidden', !visible);
        const ariaHidden = String(!visible);
        if (canvas.getAttribute('aria-hidden') !== ariaHidden) {
          canvas.setAttribute('aria-hidden', ariaHidden);
        }
        return visible && scroll.clientWidth > 0 && scroll.clientHeight > 0;
      }

      function refresh() {
        synchronize();
        onResize();
      }

      if (typeof ResizeObserver === 'function') {
        const observer = new ResizeObserver(onResize);
        observer.observe(viewport);
        observer.observe(scroll);
        observer.observe(canvas);
      }
      if (typeof MutationObserver === 'function') {
        new MutationObserver(refresh).observe(grid, {
            attributes: true,
            attributeFilter: ['class', 'hidden'],
        });
        new MutationObserver(refresh).observe(panel, {
            attributes: true,
            attributeFilter: ['style', 'hidden'],
        });
      }
      window.addEventListener('pageshow', refresh);
      document.addEventListener('resume', refresh);
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', refresh, { once: true });
      }

      return Object.freeze({
          synchronize,
          setEnabled(value) {
            enabled = Boolean(value);
            refresh();
          },
      });
    }

    window.EditorMinimapLayout = Object.freeze({ create });
})();
