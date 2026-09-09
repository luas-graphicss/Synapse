(function (root, factory) {
	'use strict';
	const api = factory();
	if (typeof module === 'object' && module.exports) module.exports = api;
	else root.SYNAPSE_BUILD_RELAY = api;
})(globalThis, function () {
	'use strict';

	function createRelayAdapter(dependencies) {
		const sessions = new WeakMap();
		const pause =
			dependencies.pause ||
			((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
		const timeout = dependencies.requestTimeout || 30000;
		const stopTimeout = dependencies.stopTimeout || 10000;

		async function bounded(promise, signal, maximumWait = timeout) {
			let timer;
			let abort;
			try {
				return await Promise.race([
					promise,
					new Promise((resolve, reject) => {
						timer = setTimeout(
							() =>
								reject(
									new Error(
										'Relay request timed out. No command was retried; check the terminal before starting again.',
									),
								),
							maximumWait,
						);
						abort = () => reject(new Error('Operation canceled.'));
						if (signal?.aborted) abort();
						else signal?.addEventListener('abort', abort, { once: true });
					}),
				]);
			} finally {
				clearTimeout(timer);
				signal?.removeEventListener('abort', abort);
			}
		}

		function request(action, body, signal, maximumWait) {
			return bounded(dependencies.request(action, body), signal, maximumWait);
		}

		async function stopProcess(processId) {
			try {
				const result = await request('kill', { procId: processId });
				if (result?.ok !== true)
					throw new Error(result?.error || 'Relay did not acknowledge the stop request.');
				if (result.done === true || result.info === 'ja finalizado') return;
				const deadline = Date.now() + stopTimeout;
				while (Date.now() < deadline) {
					const remaining = Math.max(1, deadline - Date.now());
					const status = await request(
						'out',
						{
							procId: processId,
							from: 0,
							wait: Math.min(250, remaining),
							fim: true,
						},
						undefined,
						remaining,
					);
					if (status?.done === true) return;
					if (status?.done !== false) throw new Error('Relay returned an invalid process status.');
					await pause(Math.min(100, Math.max(0, deadline - Date.now())));
				}
				throw new Error('The process is still running after the stop request.');
			} catch (cause) {
				const error = new Error(
					'Could not confirm that the process stopped. Check the terminal. ' + cause.message,
				);
				error.stopFailed = true;
				throw error;
			}
		}

		async function executeCommand(context, command) {
			context.checkCanceled();
			dependencies.assertAllowed(command);
			context.output('> ' + command + '\n');
			const session = sessions.get(context);
			let started;
			session.safeToImport = false;
			try {
				started = await request('run', { project: session.projectName, command });
				if (!started?.procId) throw new Error('Relay returned no process identifier.');
			} catch (cause) {
				const error = new Error(
					'Could not confirm command startup. It was not retried; check the terminal. ' +
						cause.message,
				);
				error.stopFailed = true;
				throw error;
			}
			if (started.reused) {
				const error = new Error(
					'This command is already running in the terminal. Wait for it to finish before building again.',
				);
				error.stopFailed = true;
				throw error;
			}
			const processId = started.procId;
			let offset = 0;
			let processDone = false;
			try {
				while (true) {
					context.checkCanceled();
					const result = await request('out', { procId: processId, from: offset }, context.signal);
					if (
						typeof result?.text !== 'string' ||
						typeof result.done !== 'boolean' ||
						!Number.isInteger(result.next) ||
						result.next < 0
					)
						throw new Error('Relay returned an invalid compiler output response.');
					if (result.text) {
						context.output(result.text);
						context.diagnostics(session.parser.push(result.text));
					}
					offset = result.next;
					if (result?.done) {
						processDone = true;
						session.safeToImport = true;
						context.diagnostics(session.parser.finish());
						context.output('\nExit code: ' + String(result.code) + '\n');
						if (result.code !== 0)
							throw new Error(
								'Command failed with exit code ' + String(result.code) + ': ' + command,
							);
						break;
					}
					await pause(200);
				}
			} catch (error) {
				if (!processDone) {
					await stopProcess(processId);
					session.safeToImport = true;
				}
				throw error;
			}
		}

		async function executeCommands(context, action) {
			const commands = context.profile.commands[action];
			if (!commands.length)
				throw new Error('Configure a ' + action + ' command for this compiler in Build settings.');
			for (const command of commands) await executeCommand(context, command);
		}

		return {
			async begin(context) {
				dependencies.assertAllowed();
				const actions =
					context.action === 'rebuild'
						? ['clean', 'build']
						: context.action === 'run'
							? ['build', 'run']
							: [context.action];
				for (const action of actions) {
					if (!context.profile.commands[action]?.length)
						throw new Error(
							'Configure a ' + action + ' command for this compiler in Build settings.',
						);
					for (const command of context.profile.commands[action])
						dependencies.assertAllowed(command);
				}
				const release = dependencies.acquire ? dependencies.acquire(context.project) : () => {};
				let pending = true;
				const synchronization = Promise.resolve()
					.then(() => dependencies.sync(context.project))
					.finally(() => {
						pending = false;
					});
				try {
					const synchronized = await bounded(synchronization, context.signal);
					context.checkCanceled();
					if (synchronized?.locked?.length)
						throw new Error(
							'Build stopped: some source files could not be synchronized to disk. Retry after the files are available.',
						);
					context.directory(synchronized?.dir || '');
					sessions.set(context, {
						release,
						safeToImport: true,
						projectName: dependencies.projectName(context.project),
						parser: dependencies.diagnostics.createParser(context.profile.label),
					});
				} catch (error) {
					if (pending) synchronization.then(release, release);
					else release();
					throw error;
				}
			},
			async build(context) {
				await executeCommands(context, 'build');
				return { kind: 'relay', profile: context.profile.id };
			},
			async run(context) {
				await executeCommands(context, 'run');
			},
			async clean(context) {
				await executeCommands(context, 'clean');
				context.output(
					'Configured Clean command completed. File changes follow that command and the existing disk synchronization policy.\n',
				);
			},
			async end(context) {
				const session = sessions.get(context);
				if (!session) return;
				let pending = false;
				let importing;
				try {
					if (!session.safeToImport) {
						context.output(
							'Disk import skipped because process completion is unconfirmed. Check the terminal before starting another operation.\n',
						);
						return;
					}
					if (dependencies.importChanges) {
						pending = true;
						importing = Promise.resolve()
							.then(() => dependencies.importChanges(context.project))
							.finally(() => {
								pending = false;
							});
						const result = await bounded(importing);
						if (result) context.output(String(result) + '\n');
					}
				} finally {
					if (pending) importing.then(session.release, session.release);
					else session.release();
					sessions.delete(context);
				}
			},
		};
	}

	return { createRelayAdapter };
});
