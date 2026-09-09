(function (root) {
    'use strict';

    const PANEL_ID = 'projectFormatProgress';

    let panel = null;
    let counterText = null;
    let progressFill = null;
    let cancelHandler = null;

    function createPanel() {
      const element = document.createElement('div');
      element.id = PANEL_ID;
      element.className = 'project-format-progress';
      element.setAttribute('role', 'status');
      element.setAttribute('aria-live', 'polite');

      const title = document.createElement('div');
      title.className = 'project-format-progress-title';
      title.textContent = 'Formatando o projeto';

      counterText = document.createElement('div');
      counterText.className = 'project-format-progress-counter';

      const track = document.createElement('div');
      track.className = 'project-format-progress-track';

      progressFill = document.createElement('div');
      progressFill.className = 'project-format-progress-fill';
      track.appendChild(progressFill);

      const cancelButton = document.createElement('button');
      cancelButton.type = 'button';
      cancelButton.className = 'project-format-progress-cancel';
      cancelButton.textContent = 'Cancelar';
      cancelButton.addEventListener('click', () => {
          if (cancelHandler) cancelHandler();
      });

      element.appendChild(title);
      element.appendChild(counterText);
      element.appendChild(track);
      element.appendChild(cancelButton);
      document.body.appendChild(element);
      return element;
    }

    function ensurePanel() {
      if (!panel) panel = createPanel();
      return panel;
    }

    function show(total) {
      ensurePanel().classList.add('on');
      update(0, total);
    }

    function update(processed, total) {
      if (!panel) return;
      const safeTotal = total > 0 ? total : 1;
      const percent = Math.round((processed / safeTotal) * 100);
      counterText.textContent = processed + ' / ' + total + ' arquivos';
      progressFill.style.width = percent + '%';
    }

    function hide() {
      if (!panel) return;
      panel.classList.remove('on');
    }

    function onCancel(handler) {
      cancelHandler = handler;
    }

    root.SynapseProjectFormatProgress = Object.freeze({
        show: show,
        update: update,
        hide: hide,
        onCancel: onCancel,
    });
})(typeof globalThis !== 'undefined' ? globalThis : window);
