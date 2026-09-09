(function (root, factory) {
	'use strict';
	const api = factory();
	if (typeof module === 'object' && module.exports) module.exports = api;
	else root.SYNAPSE_BUILD_CONTROLLER = api;
})(globalThis, function () {
	'use strict';

	function createController(dependencies) {
		const records = new WeakMap();
		const listeners = new Set();
		const maximumOutput = 64000;
		const clock = dependencies.now || Date.now;

		function recordFor(project) {
			if (!records.has(project))
				records.set(project, {
					action: null,
					phase: 'idle',
					busy: false,
					diagnostics: [],
					output: '',
					artifact: null,
					startedAt: null,
					duration: 0,
					abortController: null,
					directory: '',
					profile: null,
				});
			return records.get(project);
		}

		function getState(project) {
			if (!project) return { phase: 'idle', busy: false, diagnostics: [], output: '', duration: 0 };
			const record = recordFor(project);
			return {
				action: record.action,
				phase: record.phase,
				busy: record.busy,
				diagnostics: record.diagnostics.map((diagnostic) => ({ ...diagnostic })),
				output: record.output,
				duration: record.duration,
				directory: record.directory,
				profile: record.profile
					? {
							...record.profile,
							commands: Object.fromEntries(
								Object.entries(record.profile.commands).map(([action, commands]) => [
									action,
									commands.slice(),
								]),
							),
						}
					: null,
				hasArtifact: !!record.artifact,
			};
		}

		function notify(project) {
			for (const listener of listeners) {
				try {
					listener(project, getState(project));
				} catch (error) {
					dependencies.reportError?.(error);
				}
			}
		}

		function append(project, text) {
			const record = recordFor(project);
			const combined = record.output + String(text ?? '');
			record.output =
				combined.length > maximumOutput
					? '[Earlier output omitted]\n' + combined.slice(-maximumOutput)
					: combined;
			notify(project);
		}

		function setPhase(project, phase) {
			recordFor(project).phase = phase;
			notify(project);
		}

		function throwIfAborted(signal) {
			if (!signal.aborted) return;
			const error = new Error('Operation canceled.');
			error.name = 'AbortError';
			throw error;
		}

		async function execute(project, action, settings = {}) {
			if (!project?.files) throw new Error('Open a project first.');
			if (!['build', 'run', 'clean', 'rebuild'].includes(action))
				throw new Error('Unknown build action.');
			const record = recordFor(project);
			if (record.busy) return { ok: false, busy: true };
			record.busy = true;
			record.action = action;
			record.phase = 'preparing';
			record.startedAt = clock();
			record.duration = 0;
			record.output = '';
			record.diagnostics = [];
			record.directory = '';
			record.profile = null;
			record.abortController = new AbortController();
			const signal = record.abortController.signal;
			let adapter = null;
			let context = null;
			let acquired = false;
			let outcome = { ok: false };
			notify(project);
			try {
				const profile = dependencies.profiles.resolve(project.files, settings);
				record.profile = profile;
				adapter = dependencies.adapters[profile.mode];
				if (!adapter) throw new Error('Build backend unavailable: ' + profile.mode);
				context = {
					project,
					profile,
					signal,
					action,
					output: (text) => {
						if (!signal.aborted) append(project, text);
					},
					diagnostics: (items) => {
						if (!signal.aborted) {
							record.diagnostics = dependencies.diagnostics.retainDiagnostics(items);
							notify(project);
						}
					},
					directory: (value) => {
						record.directory = value;
					},
					checkCanceled: () => throwIfAborted(signal),
				};
				const sourceSnapshot = dependencies.profiles.snapshot(project.files, profile.mode);
				if (adapter.begin) {
					await adapter.begin(context);
					acquired = true;
				}
				throwIfAborted(signal);
				if (action === 'clean' || action === 'rebuild') {
					record.artifact = null;
					setPhase(project, 'cleaning');
					await adapter.clean(context);
					throwIfAborted(signal);
				}
				if (action !== 'clean') {
					record.artifact = null;
					setPhase(project, 'building');
					const artifact = await adapter.build(context);
					throwIfAborted(signal);
					if (record.diagnostics.some((item) => item.severity === 'error'))
						throw new Error('Build failed. See compiler diagnostics.');
					if (!artifact) throw new Error('The compiler did not return a build result.');
					if (!dependencies.profiles.isCurrent(sourceSnapshot, project.files, profile.mode))
						throw new Error('Source files changed during the build. Build again before running.');
					record.artifact = artifact;
					if (action === 'run') {
						setPhase(project, 'running');
						await adapter.run(context, artifact);
						throwIfAborted(signal);
					}
				}
				setPhase(project, 'finalizing');
				outcome = { ok: true };
			} catch (error) {
				record.artifact = null;
				const canceled = signal.aborted && !error.stopFailed;
				record.phase = canceled ? 'canceled' : 'failed';
				if (!canceled) {
					const diagnostic = dependencies.diagnostics.normalizeDiagnostic({
						severity: 'error',
						message: error.message || String(error),
						file: error.file,
						line: error.line,
						column: error.column,
						source: 'Build system',
					});
					if (!record.diagnostics.some((item) => item.severity === 'error'))
						record.diagnostics.push(diagnostic);
				}
				append(
					project,
					'\n' + (canceled ? 'Operation canceled.' : error.message || String(error)) + '\n',
				);
				outcome = { ok: false, canceled, error: error.message || String(error) };
			} finally {
				if (acquired && adapter.end) {
					try {
						await adapter.end(context);
					} catch (error) {
						record.phase = 'failed';
						record.artifact = null;
						const message = 'Could not synchronize build results: ' + error.message;
						record.diagnostics.push(
							dependencies.diagnostics.normalizeDiagnostic({ message, source: 'Relay' }),
						);
						append(project, '\n' + message + '\n');
						outcome = { ok: false, error: message };
					}
				}
				if (outcome.ok && signal.aborted) {
					outcome = { ok: false, canceled: true };
					record.artifact = null;
					record.phase = 'canceled';
				} else if (outcome.ok) record.phase = 'succeeded';
				record.diagnostics = dependencies.diagnostics.retainDiagnostics(record.diagnostics);
				record.duration = Math.max(0, clock() - record.startedAt);
				record.busy = false;
				record.abortController = null;
				notify(project);
			}
			return outcome;
		}

		function stop(project) {
			if (!project) return false;
			const record = recordFor(project);
			if (!record.busy || !record.abortController) return false;
			record.phase = 'stopping';
			record.abortController.abort();
			notify(project);
			return true;
		}

		return {
			execute,
			stop,
			getState,
			subscribe(listener) {
				listeners.add(listener);
				return () => listeners.delete(listener);
			},
		};
	}

	return { createController };
});
