(function (root, factory) {
	'use strict';
	const api = factory();
	if (typeof module === 'object' && module.exports) module.exports = api;
	else root.SYNAPSE_BUILD_BROWSER = api;
})(globalThis, function () {
	'use strict';

	function compilerOptions(path) {
		const extension = path.split('.').pop().toLowerCase();
		const presets = [];
		if (extension === 'ts' || extension === 'tsx')
			presets.push(['typescript', { allExtensions: true, isTSX: extension === 'tsx' }]);
		if (extension === 'jsx' || extension === 'tsx') presets.push(['react', { runtime: 'classic' }]);
		return {
			filename: path,
			sourceType: 'unambiguous',
			presets,
			babelrc: false,
			configFile: false,
			comments: false,
		};
	}

	function fromCompilerError(error, path) {
		const location = error.loc || {};
		return {
			severity: 'error',
			file: path,
			line: location.line || error.lineNumber,
			column: Number.isFinite(location.column) ? location.column + 1 : null,
			message: error.message || String(error),
			source: 'Babel',
		};
	}

	function createBrowserAdapter(dependencies) {
		const pause = dependencies.pause || (() => new Promise((resolve) => setTimeout(resolve, 0)));

		async function loadCompiler(signal) {
			let timer;
			let abort;
			try {
				return await Promise.race([
					Promise.resolve().then(() => dependencies.loadCompiler()),
					new Promise((resolve, reject) => {
						timer = setTimeout(() => reject(new Error('Browser compiler download timed out.')), dependencies.compilerTimeout || 60000);
						abort = () => reject(new Error('Operation canceled.'));
						if (signal.aborted) abort();
						else signal.addEventListener('abort', abort, { once: true });
					}),
				]);
			} finally {
				clearTimeout(timer);
				signal.removeEventListener('abort', abort);
			}
		}

		async function build(context) {
			const diagnostics = [];
			const compiled = new Map();
			const sources = Array.from(context.project.files).filter(
				([path, file]) =>
					!dependencies.profiles.isGenerated(path) &&
					file?.text != null &&
					/\.(?:[cm]?js|jsx|tsx?|json|css|html?)$/i.test(path),
			);
			if (!sources.length)
				throw new Error(
					'No browser source files found. Choose a Relay compiler profile for native languages.',
				);
			const requiresTranspilation = sources.some(
				([path]) => /\.(?:tsx?|jsx)$/i.test(path) && !/\.d\.ts$/i.test(path),
			);
			let compiler = null;
			if (requiresTranspilation) {
				context.output('Loading the JavaScript / TypeScript / JSX compiler...\n');
				compiler = await loadCompiler(context.signal);
				context.checkCanceled();
				if (typeof compiler?.transform !== 'function')
					throw new Error('Babel is unavailable. The build was not completed.');
			}
			for (const [path, file] of sources) {
				context.checkCanceled();
				if (/\.d\.ts$/i.test(path)) continue;
				const text = String(file.text);
				if (/\.(?:tsx?|jsx)$/i.test(path)) {
					try {
						const result = compiler.transform(text, compilerOptions(path));
						if (typeof result?.code !== 'string')
							throw new Error('Compiler returned no JavaScript.');
						compiled.set(path, result.code);
					} catch (error) {
						diagnostics.push(fromCompilerError(error, path));
					}
				} else {
					const issues = await dependencies.inspectFile(path, text);
					for (const issue of issues) {
						if (typeof issue !== 'string') diagnostics.push({ ...issue, file: issue.file || path });
						else {
							const location = issue.match(
								/(?:line|linha)\s+(\d+)(?:,?\s*(?:column|coluna)\s+(\d+))?/i,
							);
							diagnostics.push({
								severity: 'error',
								message: issue,
								file: path,
								line: location?.[1],
								column: location?.[2],
								source: 'Syntax checker',
							});
						}
					}
					compiled.set(path, text);
				}
				context.diagnostics(diagnostics);
				await pause();
			}
			if (requiresTranspilation) {
				diagnostics.push({
					severity: 'warning',
					source: 'TypeScript / JSX',
					message:
						'Browser Build transpiles syntax only. For TypeScript type checking or a production bundle, use a Relay build command such as tsc --noEmit or npm run build.',
				});
				context.diagnostics(diagnostics);
			}
			context.output(
				'Checked ' + sources.length + ' source files. No project code was executed.\n',
			);
			if (diagnostics.some((diagnostic) => diagnostic.severity === 'error'))
				throw new Error('Browser build failed. Fix the reported errors before running.');
			return { kind: 'browser', compiled, checkedFiles: sources.length };
		}

		return {
			build,
			async run(context, artifact) {
				context.checkCanceled();
				const result = await dependencies.runPreview(context.project, artifact, context.signal);
				context.checkCanceled();
				if (!result?.ok)
					throw new Error(
						result?.error?.message || result?.error || 'Preview build did not complete.',
					);
				context.output('Preview started. Runtime output remains available in Console.\n');
			},
			async clean(context) {
				context.checkCanceled();
				context.output(
					'Cleared browser build results. Source files, downloaded compilers and the current preview were preserved.\n',
				);
			},
		};
	}

	return { createBrowserAdapter, compilerOptions, fromCompilerError };
});
