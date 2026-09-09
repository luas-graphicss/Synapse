(function (root) {
    'use strict';

    const savedOptions = new WeakMap();
    let view = null;
    let project = null;
    let runner = null;
    let catalog = null;
    let presetError = '';
    let previewAction = 'build';

    function text(key) {
      return root.SYNAPSE_CMAKE_LABELS.text(key);
    }

    function selectOptions(control, choices, selected, emptyLabel) {
      control.replaceChildren();
      const add = (label, value) => {
        const option = document.createElement('option');
        option.textContent = label;
        option.value = value;
        control.appendChild(option);
      };
      if (emptyLabel) add(emptyLabel, '');
      for (const choice of choices) add(choice.label ?? choice.name ?? choice, choice.name ?? choice);
      control.value = selected || '';
      if (control.selectedIndex < 0 && control.options.length) control.selectedIndex = 0;
    }

    function options() {
      const result = Object.fromEntries(
        Object.entries(view.fields).map(([key, field]) => [key, field.value]),
      );
      if (result.mode !== 'presets') {
        result.configurePreset = '';
        result.buildPreset = '';
        result.testPreset = '';
      }
      return result;
    }

    function showStatus(status, message) {
      view.status.dataset.status = status;
      view.status.textContent = message;
    }

    function refreshPresetLinks() {
      const selected = view.fields.configurePreset.value;
      for (const [fieldName, catalogName] of [
          ['buildPreset', 'buildPresets'],
          ['testPreset', 'testPresets'],
      ]) {
        const entries = (catalog?.[catalogName] || []).filter(
          (preset) => preset.configurePreset === selected,
        );
        selectOptions(
          view.fields[fieldName],
          entries,
          view.fields[fieldName].value,
          entries.length ? null : text('selectPreset'),
        );
      }
    }

    function loadPresets(preferred = {}) {
      presetError = '';
      catalog = null;
      try {
        catalog = root.SYNAPSE_CMAKE_PRESETS.read(project.files, view.fields.sourceDirectory.value);
      } catch (error) {
        presetError = error.message;
      }
      selectOptions(
        view.fields.configurePreset,
        catalog?.configurePresets || [],
        preferred.configurePreset,
        text('selectPreset'),
      );
      if (!preferred.configurePreset && catalog?.configurePresets.length)
      view.fields.configurePreset.value = catalog.configurePresets[0].name;
      refreshPresetLinks();
      for (const name of ['buildPreset', 'testPreset']) {
        if ([...view.fields[name].options].some((entry) => entry.value === preferred[name]))
        view.fields[name].value = preferred[name];
      }
      view.notice.textContent = text('requirements') + (presetError ? `\n${presetError}` : '');
    }

    function updateControls() {
      if (!project || view.form.hidden) return;
      const busy = runner.isRunning();
      const presetMode = view.fields.mode.value === 'presets';
      view.manual.hidden = presetMode;
      view.advanced.hidden = presetMode;
      view.presets.hidden = !presetMode;
      for (const field of Object.values(view.fields)) field.disabled = busy;
      view.buttons.cancel.hidden = !busy;
      let preview = [];
      let firstError = '';
      for (const action of ['configure', 'build', 'test', 'clean']) {
        try {
          if (presetMode && (presetError || !view.fields.configurePreset.value))
          throw new Error(presetError || text('selectPreset'));
          const steps = root.SYNAPSE_CMAKE_COMMANDS.plan(project.files, options(), action);
          view.buttons[action].disabled = busy;
          view.buttons[action].title = steps.map((step) => step.command).join('\n');
          if (action === 'configure' || action === previewAction) preview = steps;
        } catch (error) {
          view.buttons[action].disabled = true;
          view.buttons[action].title = error.message;
          if (!firstError) firstError = error.message;
        }
      }
      view.planned.textContent = preview.length
      ? preview.map((step) => step.command).join('\n')
      : firstError;
      if (!busy && !preview.length) showStatus('failed', firstError);
    }

    function onTaskEvent(event) {
      if (event.status === 'running') {
        showStatus('running', `${text('running')}: ${text(event.step.action)}…`);
        view.output.textContent = '';
      } else if (event.status === 'output') {
        view.output.textContent = event.output.slice(-16000);
        view.outputDetails.hidden = !event.output;
      } else if (event.status === 'failed') showStatus('failed', event.message);
      else showStatus(event.status, text(event.status));
      updateControls();
    }

    async function execute(action) {
      if (runner.isRunning()) return;
      try {
        previewAction = action;
        const steps = root.SYNAPSE_CMAKE_COMMANDS.plan(project.files, options(), action);
        view.planned.textContent = steps.map((step) => step.command).join('\n');
        savedOptions.set(project, options());
        await runner.run(project, steps, onTaskEvent);
      } catch (error) {
        showStatus('failed', error.message);
      } finally {
        updateControls();
      }
    }

    function ensureView() {
      if (view) return;
      view = root.SYNAPSE_CMAKE_VIEW.create();
      runner = root.SYNAPSE_CMAKE_RELAY.create();
      selectOptions(
        view.fields.mode,
        [
          { name: 'manual', label: text('manual') },
          { name: 'presets', label: text('presets') },
        ],
        'manual',
      );
      selectOptions(view.fields.configuration, root.SYNAPSE_CMAKE_COMMANDS.configurations, 'Debug');
      view.form.addEventListener('input', () => {
          if (!runner.isRunning()) showStatus('ready', text('ready'));
          updateControls();
      });
      view.form.addEventListener('change', (event) => {
          if (event.target === view.fields.sourceDirectory) {
            view.fields.buildDirectory.value = root.SYNAPSE_CMAKE_PROJECT.joinPath(
              view.fields.sourceDirectory.value,
              'build',
            );
            loadPresets();
          }
          if (event.target === view.fields.configurePreset) refreshPresetLinks();
          updateControls();
          if (project) savedOptions.set(project, options());
      });
      for (const action of ['configure', 'build', 'test', 'clean'])
      view.buttons[action].addEventListener('click', () => execute(action));
      view.buttons.cancel.addEventListener('click', async () => {
          try {
            await runner.cancel();
          } catch (error) {
            showStatus('failed', error.message);
          }
      });
      view.dialog.addEventListener('close', () => {
          if (project) savedOptions.set(project, options());
      });
    }

    function open(selectedProject) {
      ensureView();
      if (!runner.isRunning()) {
        project = selectedProject || activeProject();
        previewAction = 'build';
        const candidates = root.SYNAPSE_CMAKE_PROJECT.discover(project?.files);
        view.projectName.textContent = project?.name || '';
        view.empty.hidden = candidates.length > 0;
        view.form.hidden = !candidates.length;
        view.notice.textContent = text('requirements');
        view.outputDetails.hidden = true;
        view.output.textContent = '';
        if (candidates.length) {
          const previous = savedOptions.get(project) || {};
          const primary = root.SYNAPSE_CMAKE_PROJECT.primary(project.files) || candidates[0];
          selectOptions(
            view.fields.sourceDirectory,
            candidates.map((candidate) => candidate.sourceDirectory),
            previous.sourceDirectory || primary.sourceDirectory,
          );
          const defaults = {
            mode: 'manual',
            buildDirectory: root.SYNAPSE_CMAKE_PROJECT.joinPath(
              view.fields.sourceDirectory.value,
              'build',
            ),
            configuration: 'Debug',
            generator: '',
            jobs: '2',
            target: '',
            toolchainFile: '',
            cacheEntries: '',
          };
          for (const [name, value] of Object.entries({ ...defaults, ...previous })) {
            if (name !== 'sourceDirectory' && view.fields[name]) view.fields[name].value = value;
          }
          loadPresets(previous);
          showStatus('ready', text('ready'));
          updateControls();
        }
      }
      if (!view.dialog.open) view.dialog.showModal();
    }

    function initialize() {
      if (document.getElementById('cmakeBtn')) return;
      const toolbar = document.querySelector('.topbar-actions');
      const terminalButton = document.getElementById('termBtn');
      if (!toolbar && !terminalButton) return;
      const button = document.createElement('button');
      button.id = 'cmakeBtn';
      button.type = 'button';
      button.className = toolbar ? 'top-ico cmake-trigger' : 'tbtn cmake-trigger';
      button.title = text('title');
      button.setAttribute('aria-label', text('title'));
      button.setAttribute('aria-haspopup', 'dialog');
      button.textContent = 'CMake';
      button.addEventListener('click', () => open());
      if (toolbar) toolbar.appendChild(button);
      else terminalButton.after(button);
    }

    root.SYNAPSE_CMAKE = Object.freeze({ open });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
    else initialize();
})(globalThis);
