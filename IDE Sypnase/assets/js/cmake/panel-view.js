(function (root) {
    'use strict';

    function create() {
      const text = root.SYNAPSE_CMAKE_LABELS.text;
      const dialog = document.createElement('dialog');
      dialog.className = 'cmake-dialog';
      dialog.id = 'cmakeDialog';
      dialog.setAttribute('aria-labelledby', 'cmakeTitle');
      const fields = {};
      const buttons = {};

      function element(tag, className, label) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (label) node.textContent = label;
        return node;
      }

      function field(parent, name, label, type = 'text') {
        const wrapper = element('label', 'cmake-field');
        wrapper.appendChild(element('span', '', text(label)));
        const control = element(
          type === 'select' ? 'select' : type === 'textarea' ? 'textarea' : 'input',
        );
        if (control.tagName === 'INPUT') control.type = type;
        control.id = `cmake-${name}`;
        control.name = name;
        wrapper.htmlFor = control.id;
        wrapper.appendChild(control);
        parent.appendChild(wrapper);
        fields[name] = control;
        return control;
      }

      const header = element('header', 'cmake-header');
      header.appendChild(element('h2', '', text('title'))).id = 'cmakeTitle';
      const close = element('button', 'cmake-close', '×');
      close.type = 'button';
      close.setAttribute('aria-label', text('close'));
      close.addEventListener('click', () => dialog.close());
      header.appendChild(close);
      const projectName = element('p', 'cmake-project');
      const notice = element('p', 'cmake-notice', text('requirements'));
      const empty = element('p', 'cmake-notice', text('empty'));
      empty.hidden = true;
      const form = element('form', 'cmake-form');
      form.addEventListener('submit', (event) => event.preventDefault());
      const selection = element('div', 'cmake-grid');
      field(selection, 'sourceDirectory', 'source', 'select');
      field(selection, 'mode', 'mode', 'select');
      const manual = element('div', 'cmake-grid');
      field(manual, 'buildDirectory', 'buildDirectory');
      field(manual, 'configuration', 'configuration', 'select');
      field(manual, 'generator', 'generator').placeholder = text('defaultGenerator');
      const jobs = field(manual, 'jobs', 'jobs', 'number');
      jobs.min = '1';
      jobs.max = '64';
      jobs.step = '1';
      const presets = element('div', 'cmake-grid');
      field(presets, 'configurePreset', 'configurePreset', 'select');
      field(presets, 'buildPreset', 'buildPreset', 'select');
      field(presets, 'testPreset', 'testPreset', 'select');
      const presetNote = element('p', 'cmake-hint cmake-wide', text('presetNote'));
      presets.appendChild(presetNote);
      const targetRow = element('div');
      field(targetRow, 'target', 'target').placeholder = text('allTargets');
      const advanced = element('details', 'cmake-advanced');
      advanced.appendChild(element('summary', '', text('advanced')));
      field(advanced, 'toolchainFile', 'toolchain').placeholder = 'cmake/toolchain.cmake';
      const cache = field(advanced, 'cacheEntries', 'cache', 'textarea');
      cache.rows = 3;
      cache.placeholder = 'BUILD_TESTING:BOOL=ON';
      cache.spellcheck = false;
      const actions = element('div', 'cmake-actions');
      for (const action of ['configure', 'build', 'test', 'clean', 'cancel']) {
        const button = element('button', action === 'build' ? 'cmake-primary' : '', text(action));
        button.type = 'button';
        button.dataset.cmakeAction = action;
        buttons[action] = button;
        actions.appendChild(button);
      }
      buttons.cancel.hidden = true;
      const status = element('p', 'cmake-status', text('ready'));
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      const commandDetails = element('details', 'cmake-command-details');
      commandDetails.open = true;
      commandDetails.appendChild(element('summary', '', text('commands')));
      const planned = element('pre', 'cmake-code');
      commandDetails.appendChild(planned);
      const outputDetails = element('details', 'cmake-output-details');
      outputDetails.appendChild(element('summary', '', text('output')));
      const output = element('pre', 'cmake-code');
      outputDetails.appendChild(output);
      outputDetails.hidden = true;
      form.append(
        selection,
        manual,
        presets,
        targetRow,
        advanced,
        element('p', 'cmake-hint', text('workflow')),
        actions,
        status,
        commandDetails,
        outputDetails,
      );
      dialog.append(
        header,
        projectName,
        notice,
        empty,
        form,
        element('p', 'cmake-hint', text('native')),
      );
      document.body.appendChild(dialog);
      return {
        dialog,
        projectName,
        notice,
        empty,
        form,
        fields,
        buttons,
        manual,
        presets,
        advanced,
        status,
        planned,
        output,
        outputDetails,
      };
    }

    root.SYNAPSE_CMAKE_VIEW = Object.freeze({ create });
})(globalThis);
