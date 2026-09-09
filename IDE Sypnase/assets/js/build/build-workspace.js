(function (root) {
	'use strict';
	if (root.SYNAPSE_BUILD) return;
	const storageKey = 'synapse.build.settings.v1';
	const profiles = root.SYNAPSE_BUILD_PROFILES;
	const diagnostics = root.SYNAPSE_BUILD_DIAGNOSTICS;
	const reportError = (error) => ignorarErro(error, 'build-system');

	function loadSettings(project) {
		try {
			return JSON.parse(localStorage.getItem(storageKey) || '{}')[project.id] || {};
		} catch (error) {
			reportError(error);
			return {};
		}
	}

	function saveSettings(project, settings) {
		profiles.resolve(project.files, settings);
		const stored = JSON.parse(localStorage.getItem(storageKey) || '{}');
		stored[project.id] = settings;
		localStorage.setItem(storageKey, JSON.stringify(stored));
	}

	async function runPreview(project, artifact, signal) {
		if (artifact?.kind !== 'browser')
			throw new Error('A successful browser Build is required before Run.');
		if (project !== activeProject())
			throw new Error('The active project changed. Run from the intended project.');
		if (
			!Array.from(project.files.keys()).some((path) => /\.(?:html?|jsx|tsx)$/i.test(path)) &&
			!project.files.has('package.json')
		)
			throw new Error(
				'No browser entry point found. Add index.html or configure a Relay Run command.',
			);
		const cancel = () => {
			project.buildToken = (project.buildToken || 0) + 1;
		};
		signal.addEventListener('abort', cancel, { once: true });
		try {
			const sourceSnapshot = profiles.snapshot(project.files, 'browser');
			const result = await buildPreview(project, {
				browserOnly: true,
				shouldMount: () =>
					!signal.aborted &&
					project === activeProject() &&
					profiles.isCurrent(sourceSnapshot, project.files, 'browser'),
			});
			if (signal.aborted || project !== activeProject())
				throw new Error('Preview launch was canceled or its project changed.');
			if (!result?.ok) return result;
			if (State.layout === 'editor') setLayout('split');
			return result;
		} finally {
			signal.removeEventListener('abort', cancel);
		}
	}

	async function runWasiPreview(project, artifact, signal, output, freshBuild) {
		const sourceSnapshot = profiles.snapshot(project.files, 'wasi');
		const shouldMount = () => !signal.aborted && project === activeProject() && profiles.isCurrent(sourceSnapshot, project.files, 'wasi');
		if (!shouldMount()) throw new Error('The active project changed or Run was canceled.');
		if (shouldMount()) {
			if (State.layout === 'editor') setLayout('split');
			el.previewEmpty?.classList.add('hidden');
			el.device?.classList.remove('hidden');
			if (typeof hidePreviewLoading === 'function') hidePreviewLoading();
			if (typeof hidePreviewError === 'function') hidePreviewError();
		}
		return root.SYNAPSE_NATIVE_PREVIEW.preview({ arquivos: project.files, artifact, frame: el.frame, signal, freshBuild, shouldMount, aoSaida: (stream, text) => output(text), aoLog: (entry) => output(entry.texto + '\n') });
	}

	function acquireTerminal(project) {
		if (TERM.busy)
			throw new Error('The terminal is busy. Wait for the current command or stop it first.');
		TERM.busy = true;
		project.explicitBuildInProgress = true;
		termPromptState();
		return () => {
			TERM.busy = false;
			project.explicitBuildInProgress = false;
			termPromptState();
		};
	}

	const browser = root.SYNAPSE_BUILD_BROWSER.createBrowserAdapter({
		profiles,
		loadCompiler: () => loadBabel(),
		inspectFile: (path, text) => lintFile(path, text),
		runPreview,
	});
	const relay = root.SYNAPSE_BUILD_RELAY.createRelayAdapter({
		diagnostics,
		assertAllowed: (command) => termAssertAllowed(command),
		request: (action, body) => termApi(action, body),
		sync: (project) => termSync(project),
		projectName: (project) => termProjName(project),
		acquire: acquireTerminal,
		importChanges: (project) => termApplyChanges(project),
	});
	const controller = root.SYNAPSE_BUILD_CONTROLLER.createController({
		profiles,
		diagnostics,
		adapters: { browser, relay, ...(root.SYNAPSE_BUILD_WASI ? { wasi: root.SYNAPSE_BUILD_WASI.createWasiAdapter({ artifacts: root.SYNAPSE_WASI_ARTIFACTS, compiler: root.SYNAPSE_NATIVE_PREVIEW, diagnostics, runPreview: runWasiPreview }), 'wasi-relay': root.SYNAPSE_BUILD_WASI.createWasiRelayAdapter({ artifacts: root.SYNAPSE_WASI_ARTIFACTS, compiler: root.SYNAPSE_NATIVE_PREVIEW, diagnostics, relay, runPreview: runWasiPreview }) } : {}) },
		reportError,
	});
	const panel = root.SYNAPSE_BUILD_PANEL.createPanel({
		document,
		profiles,
		controller,
		text: root.SYNAPSE_BUILD_TEXT,
		getProject: () => activeProject(),
		loadSettings,
		saveSettings,
		resolveFile: (project, diagnostic) =>
			diagnostics.resolveProjectPath(
				diagnostic.file,
				project.files.keys(),
				controller.getState(project).directory,
			),
		openFile(project, path, diagnostic) {
			if (project !== activeProject()) return;
			if (State.layout === 'preview') setLayout('split');
			openFileInEditor(path);
			jumpToLine(diagnostic.line || 1);
			if (diagnostic.column && el.codeTa) {
				const offset =
					el.codeTa.selectionStart +
					Math.min(
						diagnostic.column - 1,
						(el.codeTa.value.split('\n')[(diagnostic.line || 1) - 1] || '').length,
					);
				el.codeTa.setSelectionRange(offset, offset);
			}
		},
	});
	const trigger = document.createElement('button');
	trigger.id = 'buildSystemBtn';
	trigger.type = 'button';
	trigger.className = 'tbtn';
	trigger.textContent = 'Build';
	trigger.title = root.SYNAPSE_BUILD_TEXT.get(document.documentElement.lang).open;
	trigger.setAttribute('aria-haspopup', 'dialog');
	trigger.setAttribute('aria-controls', 'buildSystemDialog');
	trigger.addEventListener('click', () => panel.open());
	const reload = document.getElementById('reloadBtn');
	if (reload?.parentElement) reload.before(trigger);
	else document.querySelector('.toolbar')?.appendChild(trigger);
	document.addEventListener('keydown', (event) => {
		if (
			!(event.ctrlKey || event.metaKey) ||
			!event.shiftKey ||
			event.altKey ||
			event.key.toLowerCase() !== 'b' ||
			event.repeat ||
			!activeProject()
		)
			return;
		event.preventDefault();
		panel.open();
		panel.execute('build');
	});
	root.SYNAPSE_BUILD = {
		open: () => panel.open(),
		execute: (action) => {
			panel.open();
			return panel.execute(action);
		},
		getState: (project) => controller.getState(project || activeProject()),
		stop: () => controller.stop(activeProject()),
		commands: () =>
			['build', 'run', 'clean', 'rebuild'].map((action) => ({
				id: 'build-system-' + action,
				label: 'Build & Run: ' + action[0].toUpperCase() + action.slice(1),
				hint: 'compiler',
				icon: 'term',
				on: !!activeProject(),
				run: () => root.SYNAPSE_BUILD.execute(action),
			})),
	};
})(globalThis);
