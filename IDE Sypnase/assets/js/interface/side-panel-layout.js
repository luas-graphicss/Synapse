(function () {
    const MIN_EDITOR_WIDTH = 220;

    function editorPane() {
      return document.getElementById('editorPane');
    }

    function keepEditorShrinkable() {
      const pane = editorPane();
      if (!pane || pane.style.display === 'none') return;
      const width = Math.max(MIN_EDITOR_WIDTH, Math.round(pane.getBoundingClientRect().width));
      pane.style.flex = '1 1 ' + width + 'px';
      pane.style.width = '';
      if (typeof window.applyDevice === 'function') window.applyDevice();
    }

    function watchSidePanel(panel) {
      new MutationObserver(() => {
          if (!panel.hidden) keepEditorShrinkable();
      }).observe(panel, { attributes: true, attributeFilter: ['hidden'] });
      if (!panel.hidden) keepEditorShrinkable();
    }

    function watchSidePanelCreation() {
      const existing = document.getElementById('debugPanel');
      if (existing) {
        watchSidePanel(existing);
        return;
      }
      const host = document.querySelector('.app > .body') || document.body;
      const observer = new MutationObserver(() => {
          const panel = document.getElementById('debugPanel');
          if (!panel) return;
          observer.disconnect();
          watchSidePanel(panel);
      });
      observer.observe(host, { childList: true });
    }

    if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', watchSidePanelCreation);
    else watchSidePanelCreation();
})();
