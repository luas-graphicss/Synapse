(function (root) {
    'use strict';

    function createHeader(labels, onClose) {
      const header = document.createElement('header');
      header.className = 'bug-report-header';
      const text = document.createElement('div');
      const title = document.createElement('h2');
      title.className = 'bug-report-title';
      title.textContent = labels.dialogTitle;
      const subtitle = document.createElement('p');
      subtitle.className = 'bug-report-subtitle';
      subtitle.textContent = labels.dialogSubtitle;
      text.appendChild(title);
      text.appendChild(subtitle);
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'bug-report-close';
      close.textContent = 'X';
      close.setAttribute('aria-label', labels.closeText);
      close.addEventListener('click', onClose);
      header.appendChild(text);
      header.appendChild(close);
      return header;
    }

    function createEnvironment(labels, entries) {
      const section = document.createElement('section');
      section.className = 'bug-report-environment';
      const heading = document.createElement('h3');
      heading.className = 'bug-report-environment-heading';
      heading.textContent = labels.environmentHeading;
      const list = document.createElement('dl');
      list.className = 'bug-report-environment-list';
      entries.forEach((entry) => {
          const term = document.createElement('dt');
          term.className = 'bug-report-environment-term';
          term.textContent = entry.label;
          const value = document.createElement('dd');
          value.className = 'bug-report-environment-value';
          value.textContent = entry.value;
          list.appendChild(term);
          list.appendChild(value);
      });
      section.appendChild(heading);
      section.appendChild(list);
      return section;
    }

    function createFooter(labels) {
      const footer = document.createElement('footer');
      footer.className = 'bug-report-footer';
      const status = document.createElement('p');
      status.className = 'bug-report-status';
      status.setAttribute('role', 'status');
      const actions = document.createElement('div');
      actions.className = 'bug-report-actions';
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'bug-report-action';
      cancel.textContent = labels.cancelText;
      const submit = document.createElement('button');
      submit.type = 'button';
      submit.className = 'bug-report-action bug-report-action-primary';
      submit.textContent = labels.submitText;
      actions.appendChild(cancel);
      actions.appendChild(submit);
      footer.appendChild(status);
      footer.appendChild(actions);
      return { footer, status, cancel, submit };
    }

    function open(options) {
      const labels = options.labels;
      const overlay = document.createElement('div');
      overlay.className = 'bug-report-overlay';
      const dialog = document.createElement('section');
      dialog.className = 'bug-report-dialog';
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-label', labels.dialogTitle);
      const body = document.createElement('div');
      body.className = 'bug-report-body';
      body.appendChild(options.formElement);
      body.appendChild(createEnvironment(labels, options.environmentEntries));
      const footerParts = createFooter(labels);

      function close() {
        document.removeEventListener('keydown', onKeyDown, true);
        overlay.remove();
        if (options.onClose) options.onClose();
      }

      function onKeyDown(event) {
        if (event.key === 'Escape') {
          event.preventDefault();
          close();
        }
      }

      function setStatus(text, state) {
        footerParts.status.textContent = text;
        footerParts.status.className = state
        ? `bug-report-status ${state}`
        : 'bug-report-status';
      }

      function setBusy(busy) {
        footerParts.submit.disabled = busy;
        footerParts.cancel.disabled = busy;
      }

      const session = { close, setStatus, setBusy };
      dialog.appendChild(createHeader(labels, close));
      dialog.appendChild(body);
      dialog.appendChild(footerParts.footer);
      overlay.appendChild(dialog);
      footerParts.cancel.addEventListener('click', close);
      footerParts.submit.addEventListener('click', () => options.onSubmit(session));
      overlay.addEventListener('mousedown', (event) => {
          if (event.target === overlay) close();
      });
      document.addEventListener('keydown', onKeyDown, true);
      document.body.appendChild(overlay);
      return session;
    }

    root.SynapseBugReportDialog = Object.freeze({ open });
})(typeof globalThis !== 'undefined' ? globalThis : window);
