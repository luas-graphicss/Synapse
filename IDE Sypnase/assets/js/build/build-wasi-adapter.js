(function (root, factory) {
	'use strict';
	const api = factory();
	if (typeof module === 'object' && module.exports) module.exports = api;
	else root.SYNAPSE_BUILD_WASI = api;
})(globalThis, function () {
	'use strict';
	function createWasiAdapter(dependencies) {
		return {
			async build(context) {
				context.checkCanceled();
				if (context.profile.id === 'wasi-artifact') return dependencies.artifacts.find(context.project.files);
				const parser = dependencies.diagnostics.createParser('WCC');
				try {
					return await dependencies.compiler.compile(context.project.files, {
						signal: context.signal,
						onOutput: (stream, text) => {
							context.output(text);
							context.diagnostics(parser.push(text.replace(/\/project\//g, '')));
						},
					});
				} finally { context.diagnostics(parser.finish()); }
			},
			async run(context, artifact) {
				context.checkCanceled();
				const result = await dependencies.runPreview(context.project, artifact, context.signal, context.output, context.profile.mode === 'wasi-relay');
				context.checkCanceled();
				if (!result?.ok) throw new Error(result?.motivo || 'WASI preview did not complete successfully.');
			},
			async clean(context) {
				context.checkCanceled();
				context.output('In-memory artifact discarded. Sources, imported binaries and compiler cache were preserved.\n');
			},
		};
	}
	function createWasiRelayAdapter(dependencies) {
		const sessions = new WeakMap();
		const adapter = createWasiAdapter(dependencies);
		return {
			async begin(context) {
				const inner = { ...context, action: context.action === 'run' ? 'build' : context.action };
				await dependencies.relay.begin(inner);
				sessions.set(context, inner);
			},
			async build(context) {
				const inner = sessions.get(context);
				await dependencies.relay.build(inner);
				context.checkCanceled();
				sessions.delete(context);
				await dependencies.relay.end(inner);
				context.checkCanceled();
				return dependencies.artifacts.find(context.project.files, { directory: context.profile.artifactDirectory, path: context.profile.artifactPath });
			},
			run: adapter.run,
			clean(context) { return dependencies.relay.clean(sessions.get(context)); },
			async end(context) {
				const inner = sessions.get(context);
				if (inner) {
					sessions.delete(context);
					await dependencies.relay.end(inner);
				}
			},
		};
	}
	return { createWasiAdapter, createWasiRelayAdapter };
});
