(function (root, factory) {
	'use strict';
	const api = factory();
	if (typeof module === 'object' && module.exports) module.exports = api;
	else root.SYNAPSE_BUILD_PANEL = api;
})(globalThis, function () {
	'use strict';

	function createPanel(options) {
		const document = options.document;
		const dialog = document.createElement('dialog');
		dialog.id = 'buildSystemDialog';
		dialog.className = 'build-dialog';
		dialog.setAttribute('aria-labelledby', 'buildDialogTitle');
		dialog.innerHTML =
			'<header class="build-header"><div><h2 id="buildDialogTitle"></h2><p data-text="subtitle"></p></div><button type="button" data-close></button></header><div class="build-content"><div class="build-context"><div class="build-project"><small data-text="project"></small><strong data-project></strong></div><label class="build-profile"><span data-text="profile"></span><select data-profile></select></label></div><p class="build-help" data-help></p><div class="build-actions"><button type="button" data-action="build"></button><button type="button" data-action="run"></button><button type="button" data-action="clean"></button><button type="button" data-action="rebuild"></button><button type="button" data-action="stop"></button></div><div class="build-status" role="status" aria-live="polite"><strong data-status></strong><span data-duration></span></div><details class="build-settings"><summary data-text="settings"></summary><div class="build-settings-body"><p class="build-help" data-text="settingsHelp"></p><label>Build<textarea data-command="build" rows="2" spellcheck="false"></textarea></label><label>Run<textarea data-command="run" rows="2" spellcheck="false"></textarea></label><label>Clean<textarea data-command="clean" rows="2" spellcheck="false"></textarea></label><p class="build-help" data-text="cleanHint"></p></div></details><section><div class="build-filter-row"><h3 data-text="diagnostics"></h3><select data-filter></select><input type="search" data-search /></div><div class="build-counts" data-counts></div><p class="build-help" data-diagnostic-limit hidden></p><ul class="build-diagnostics" data-diagnostics></ul></section><section class="build-output"><h3 data-text="output"></h3><pre data-output tabindex="0"></pre></section><div class="build-footer" data-text="shortcuts"></div></div>';
		document.body.appendChild(dialog);
		const find = (selector) => dialog.querySelector(selector);
		const profileSelect = find('[data-profile]');
		const filterSelect = find('[data-filter]');
		const search = find('[data-search]');
		const actionButtons = Array.from(dialog.querySelectorAll('[data-action]'));
		const commandInputs = Array.from(dialog.querySelectorAll('[data-command]'));
		let project = null;
		let profile = null;
		let text = options.text.get(document.documentElement.lang);
		let renderHandle = null;
		let projectPoll = null;
		let settingsError = '';
		let settingsDirty = false;
		let actionNotice = '';

		function localize() {
			text = options.text.get(document.documentElement.lang);
			find('#buildDialogTitle').textContent = text.title;
			for (const node of dialog.querySelectorAll('[data-text]'))
				node.textContent = text[node.dataset.text];
			find('[data-close]').textContent = text.close;
			search.placeholder = text.filter;
			search.setAttribute('aria-label', text.filter);
			filterSelect.setAttribute('aria-label', text.diagnostics);
			const currentFilter = filterSelect.value || 'all';
			filterSelect.replaceChildren();
			for (const severity of ['all', 'error', 'warning', 'info']) {
				const option = document.createElement('option');
				option.value = severity;
				option.textContent = text[severity];
				filterSelect.appendChild(option);
			}
			filterSelect.value = currentFilter;
			for (const button of actionButtons) {
				button.textContent = text[button.dataset.action];
				button.title = text[button.dataset.action + 'Title'] || text.stop;
			}
		}

		function hydrateSettings() {
			settingsDirty = false;
			const settings = project ? options.loadSettings(project) : {};
			profileSelect.replaceChildren();
			const automatic = document.createElement('option');
			automatic.value = 'auto';
			automatic.textContent = text.automatic;
			profileSelect.appendChild(automatic);
			for (const [id, definition] of Object.entries(options.profiles.definitions)) {
				const option = document.createElement('option');
				option.value = id;
				option.textContent = definition.label;
				profileSelect.appendChild(option);
			}
			profileSelect.value = settings.profile || 'auto';
			settingsError = '';
			try {
				profile = project ? options.profiles.resolve(project.files, settings) : null;
			} catch (error) {
				profile = null;
				settingsError = error.message;
			}
			for (const input of commandInputs) {
				input.value = (profile?.commands[input.dataset.command] || []).join('\n');
				input.placeholder = text.noCommand;
			}
		}

		function updateSettings(resetCommands = false) {
			if (!project || project !== options.getProject()) {
				render();
				return false;
			}
			settingsDirty = true;
			actionNotice = '';
			const settings = { profile: profileSelect.value };
			if (!resetCommands)
				settings.commands = Object.fromEntries(
					commandInputs.map((input) => [input.dataset.command, input.value]),
				);
			try {
				profile = options.profiles.resolve(project.files, settings);
				options.saveSettings(project, settings);
				hydrateSettings();
			} catch (error) {
				settingsError = error.message;
			}
			render();
			return !settingsError;
		}

		function renderDiagnostics(items) {
			const diagnosticProject = project;
			const limitNotice = find('[data-diagnostic-limit]');
			limitNotice.hidden = items.length < 500;
			limitNotice.textContent = text.diagnosticLimit;
			const counts = { error: 0, warning: 0, info: 0 };
			for (const item of items) counts[item.severity]++;
			const counter = find('[data-counts]');
			counter.replaceChildren();
			for (const severity of Object.keys(counts)) {
				const label = document.createElement('span');
				label.textContent = text[severity] + ': ' + counts[severity];
				counter.appendChild(label);
			}
			const query = search.value.trim().toLowerCase();
			const visible = items.filter(
				(item) =>
					(filterSelect.value === 'all' || item.severity === filterSelect.value) &&
					(!query ||
						(item.message + ' ' + item.file + ' ' + item.code).toLowerCase().includes(query)),
			);
			const list = find('[data-diagnostics]');
			list.replaceChildren();
			if (!visible.length) {
				const empty = document.createElement('li');
				empty.className = 'build-empty';
				empty.textContent = items.length ? text.noMatches : text.noDiagnostics;
				list.appendChild(empty);
			}
			for (const diagnostic of visible) {
				const row = document.createElement('li');
				row.className = 'build-diagnostic';
				row.dataset.severity = diagnostic.severity;
				const heading = document.createElement('strong');
				heading.textContent =
					text[diagnostic.severity] + (diagnostic.code ? ' · ' + diagnostic.code : '');
				const message = document.createElement('p');
				message.textContent = diagnostic.message;
				const source = document.createElement('small');
				source.textContent = diagnostic.source;
				row.append(heading, message, source);
				if (diagnostic.file) {
					const path = options.resolveFile(project, diagnostic);
					const location = document.createElement(path ? 'button' : 'p');
					location.textContent =
						diagnostic.file +
						(diagnostic.line ? ':' + diagnostic.line : '') +
						(diagnostic.column ? ':' + diagnostic.column : '');
					if (path) {
						location.type = 'button';
						location.title = text.openFile;
						location.addEventListener('click', () => {
							if (diagnosticProject !== options.getProject()) {
								render();
								return;
							}
							dialog.close();
							options.openFile(diagnosticProject, path, diagnostic);
						});
					}
					row.appendChild(location);
				}
				list.appendChild(row);
			}
		}

		function render() {
			if (!dialog.open) return;
			const active = options.getProject();
			if (active !== project) {
				project = active;
				hydrateSettings();
				actionNotice = '';
			}
			const state = options.controller.getState(project);
			find('[data-project]').textContent = project?.name || text.emptyProject;
			const help = find('[data-help]');
			help.textContent =
				settingsError ||
				actionNotice ||
				(profile?.mode === 'wasi' ? text.wasiHelp : profile?.mode === 'wasi-relay' ? text.wasiRelayHelp : profile?.mode === 'browser' ? text.browserHelp : text.relayHelp);
			if (settingsError || actionNotice) help.setAttribute('role', 'alert');
			else help.removeAttribute('role');
			find('[data-status]').textContent = settingsError
				? text.invalidSettings
				: text[state.phase] || state.phase;
			find('.build-status').dataset.phase = settingsError ? 'failed' : state.phase;
			find('[data-duration]').textContent = state.duration
				? (state.duration / 1000).toFixed(2) + ' ' + text.seconds
				: ['relay', 'wasi-relay'].includes(profile?.mode)
					? text.relay
					: text.browser;
			for (const button of actionButtons)
				button.disabled =
					!project ||
					(button.dataset.action === 'stop'
						? !state.busy || state.phase === 'stopping'
						: state.busy || !!settingsError);
			profileSelect.disabled = !project || state.busy;
			for (const input of commandInputs)
				input.disabled = !project || state.busy || ['browser', 'wasi'].includes(profile?.mode) || (profile?.mode === 'wasi-relay' && input.dataset.command === 'run');
			renderDiagnostics(state.diagnostics);
			const output = find('[data-output]');
			const atBottom = output.scrollHeight - output.clientHeight - output.scrollTop < 50;
			output.textContent = state.output || text.noOutput;
			if (atBottom) output.scrollTop = output.scrollHeight;
		}

		function scheduleRender() {
			if (!dialog.open || renderHandle) return;
			renderHandle = setTimeout(() => {
				renderHandle = null;
				render();
			}, 50);
		}

		async function execute(action) {
			const active = options.getProject();
			if (active !== project) {
				project = active;
				hydrateSettings();
				actionNotice = text.projectChanged;
				render();
				return { ok: false, projectChanged: true, error: actionNotice };
			}
			if (!project) {
				render();
				return { ok: false, error: text.emptyProject };
			}
			if (action === 'stop') return { ok: options.controller.stop(project) };
			if (options.controller.getState(project).busy) return { ok: false, busy: true };
			actionNotice = '';
			if (settingsDirty) updateSettings();
			if (settingsError) {
				render();
				return { ok: false, error: settingsError };
			}
			try {
				return await options.controller.execute(project, action, options.loadSettings(project));
			} catch (error) {
				settingsError = error.message;
				return { ok: false, error: settingsError };
			} finally {
				render();
			}
		}

		for (const button of actionButtons)
			button.addEventListener('click', () => execute(button.dataset.action));
		profileSelect.addEventListener('change', () => updateSettings(true));
		for (const input of commandInputs) {
			input.addEventListener('input', () => {
				settingsDirty = true;
				settingsError = '';
				actionNotice = '';
				scheduleRender();
			});
			input.addEventListener('change', () => updateSettings());
		}
		filterSelect.addEventListener('change', render);
		search.addEventListener('input', scheduleRender);
		find('[data-close]').addEventListener('click', () => dialog.close());
		dialog.addEventListener('close', () => {
			clearInterval(projectPoll);
			projectPoll = null;
		});
		const unsubscribe = options.controller.subscribe(scheduleRender);
		localize();

		return {
			open() {
				const active = options.getProject();
				const refreshSettings = !dialog.open || active !== project;
				project = active;
				localize();
				if (refreshSettings) {
					hydrateSettings();
					actionNotice = '';
				}
				if (!dialog.open) {
					dialog.showModal();
					projectPoll = setInterval(() => {
						if (options.getProject() !== project) scheduleRender();
					}, 250);
				}
				render();
			},
			execute,
			refresh: scheduleRender,
			destroy() {
				unsubscribe();
				clearInterval(projectPoll);
				clearTimeout(renderHandle);
				dialog.remove();
			},
		};
	}

	return { createPanel };
});
