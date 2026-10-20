(function (root) {
	'use strict';

	const maximumCharacters = 250000;
	const maximumItems = 150;
	const supportedPath = /\.(?:[cm]?[jt]s|[jt]sx)$/i;
	const basePlugins = Object.freeze([
		'decorators-legacy',
		'decoratorAutoAccessors',
		'explicitResourceManagement',
		'importAttributes',
	]);

	function pluginsFor(extension) {
		const plugins = [...basePlugins];
		if (['ts', 'tsx', 'mts', 'cts'].includes(extension))
			plugins.push(['typescript', { disallowAmbiguousJSXLike: ['mts', 'cts'].includes(extension) }]);
		if (['js', 'jsx', 'tsx'].includes(extension)) plugins.push('jsx');
		return plugins;
	}

	function sourceTypeFor(extension) {
		if (extension === 'mjs' || extension === 'mts') return 'module';
		if (extension === 'cjs') return 'script';
		return 'unambiguous';
	}

	function parse(parser, source, plugins, sourceType) {
		return parser.parse(source, {
			sourceType,
			allowReturnOutsideFunction: true,
			allowAwaitOutsideFunction: true,
			allowNewTargetOutsideFunction: true,
			allowUndeclaredExports: true,
			attachComment: false,
			errorRecovery: true,
			plugins,
		});
	}

	function collectErrors(parser, source, plugins, sourceType) {
		try {
			const result = parse(parser, source, plugins, sourceType);
			if (
				sourceType === 'unambiguous' &&
				result.errors.length &&
				result.program.sourceType === 'script'
			) {
				try {
					const asScript = parse(parser, source, plugins, 'script');
					if (asScript.errors.length < result.errors.length) return asScript.errors;
				} catch (error) {
					if (!Number.isInteger(error.pos)) throw error;
				}
			}
			return result.errors;
		} catch (error) {
			if (!Number.isInteger(error.pos)) throw error;
			return [error];
		}
	}

	function analyze(parser, path, text) {
		if (typeof path !== 'string' || !supportedPath.test(path))
			throw new TypeError('Unsupported script document');
		if (typeof text !== 'string' || text.length > maximumCharacters)
			throw new RangeError('Syntax document exceeds the analysis limit');
		const source = text.replace(/\r\n?/g, '\n');
		const extension = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
		const errors = collectErrors(parser, source, pluginsFor(extension), sourceTypeFor(extension));
		const items = errors.slice(0, maximumItems).map((error) => {
			const start = Math.max(0, Math.min(source.length, error.pos ?? source.length));
			const prefix = source.slice(0, start);
			return {
				path,
				start,
				length: start === source.length ? 0 : source.codePointAt(start) > 0xffff ? 2 : 1,
				line: prefix.split('\n').length,
				column: start - prefix.lastIndexOf('\n'),
				severity: 'error',
				code: 'SYNTAX_' + (error.reasonCode || 'UnexpectedToken'),
				message: error.message.replace(/ \(\d+:\d+\)$/, ''),
			};
		});
		return { items, total: errors.length, configurationErrors: [] };
	}

	root.SynapseLocalScriptDiagnostics = Object.freeze({ analyze });
})(globalThis);
