(function (root, factory) {
	'use strict';
	const api = factory();
	if (typeof module === 'object' && module.exports) module.exports = api;
	else root.SYNAPSE_BUILD_DIAGNOSTICS = api;
})(globalThis, function () {
	'use strict';

	function stripAnsi(value) {
		return String(value ?? '')
			.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
			.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
			.replace(/\r/g, '');
	}

	function normalizePath(value) {
		return String(value ?? '')
			.trim()
			.replace(/^['"]|['"]$/g, '')
			.replace(/\\/g, '/')
			.replace(/^\.\//, '');
	}

	function normalizeDiagnostic(value = {}) {
		const rawSeverity = String(value.severity || value.level || 'error').toLowerCase();
		const severity = /warn|aviso/.test(rawSeverity)
			? 'warning'
			: /note|info/.test(rawSeverity)
				? 'info'
				: 'error';
		return {
			severity,
			message: stripAnsi(value.message || value.text || 'Unknown compiler diagnostic').slice(
				0,
				8000,
			),
			file: normalizePath(value.file || value.path),
			line:
				Number.isInteger(Number(value.line)) && Number(value.line) > 0 ? Number(value.line) : null,
			column:
				Number.isInteger(Number(value.column)) && Number(value.column) > 0
					? Number(value.column)
					: null,
			code: String(value.code || ''),
			source: String(value.source || 'Build'),
		};
	}

	function retainDiagnostics(items, maximum = 500) {
		const normalized = items.map(normalizeDiagnostic);
		if (normalized.length <= maximum) return normalized;
		const priority = { error: 0, warning: 1, info: 2 };
		return normalized
			.map((diagnostic, index) => ({ diagnostic, index }))
			.sort(
				(left, right) =>
					priority[left.diagnostic.severity] - priority[right.diagnostic.severity] ||
					left.index - right.index,
			)
			.slice(0, maximum)
			.sort((left, right) => left.index - right.index)
			.map((entry) => entry.diagnostic);
	}

	function parseLine(text, source = 'Compiler') {
		const line = stripAnsi(text).trimEnd();
		let match = line.match(
			/^(.+?)\((\d+)(?:,\s*(\d+))?(?:,\d+,\d+)?\)\s*:\s*(fatal error|error|warning|note)\s*([A-Za-z]+\d+)?\s*:\s*(.+)$/i,
		);
		if (match)
			return normalizeDiagnostic({
				file: match[1],
				line: match[2],
				column: match[3],
				severity: match[4],
				code: match[5],
				message: match[6],
				source,
			});
		match = line.match(
			/^(.+?):(\d+)(?::(\d+))?(?::|\s+-)\s*(fatal error|error|warning|note)(?:\s+([A-Za-z]+\d+))?:\s*(.+)$/i,
		);
		if (match)
			return normalizeDiagnostic({
				file: match[1],
				line: match[2],
				column: match[3],
				severity: match[4],
				code: match[5],
				message: match[6],
				source,
			});
		match = line.match(
			/^\s*(?:[✘▲]\s*)?(?:\[(ERROR|WARNING)\]|(fatal error|error|warning|warn|note)(?:\[([^\]]+)\])?)\s*:?\s+(.+)$/i,
		);
		if (match)
			return normalizeDiagnostic({
				severity: match[1] || match[2],
				code: match[3],
				message: match[4],
				source,
			});
		match = line.match(/^(.+?\.(?:go|java|kt|swift)):(\d+)(?::(\d+))?:\s*(.+)$/i);
		if (match)
			return normalizeDiagnostic({
				file: match[1],
				line: match[2],
				column: match[3],
				message: match[4],
				source,
			});
		match = line.match(/^(?:npm|pnpm)\s+(ERR!|error|WARN|warn)\s+(.+)$/i);
		if (match)
			return normalizeDiagnostic({
				severity: /warn/i.test(match[1]) ? 'warning' : 'error',
				message: match[2],
				source,
			});
		match = line.match(
			/^CMake (Error|Warning)(?:\s+\(([^)]+)\))?(?: at (.+?):(\d+) \(([^)]+)\))?:\s*(.*)$/i,
		);
		if (match)
			return normalizeDiagnostic({
				severity: match[1],
				file: match[3],
				line: match[4],
				message: match[6] || (match[5] ? match[5] + ':' : 'CMake ' + match[1]),
				source,
			});
		return null;
	}

	function createParser(source = 'Compiler') {
		let remainder = '';
		let pending = null;
		let diagnostics = [];
		let multilineMessage = false;
		const keys = new Set();
		const maximumDiagnostics = 500;

		function commit() {
			if (!pending) return;
			const key = JSON.stringify(pending);
			if (!keys.has(key)) {
				if (diagnostics.length < maximumDiagnostics) {
					keys.add(key);
					diagnostics.push(pending);
				} else {
					diagnostics = retainDiagnostics([...diagnostics, pending], maximumDiagnostics);
					keys.clear();
					for (const diagnostic of diagnostics) keys.add(JSON.stringify(diagnostic));
				}
			}
			pending = null;
			multilineMessage = false;
		}

		function consume(line) {
			const clean = stripAnsi(line);
			if (pending && multilineMessage) {
				if (!clean.trim()) return;
				if (/^\s+\S/.test(clean)) {
					pending.message = (pending.message + '\n' + clean.trim()).slice(0, 8000);
					return;
				}
				commit();
			}
			const location = clean.match(/^\s*(?:(?:-->|:::|at)\s+)?(.+?):(\d+):(\d+):?\s*$/);
			if (pending && !pending.file && location) {
				pending.file = normalizePath(location[1]);
				pending.line = Number(location[2]);
				pending.column = Number(location[3]);
				commit();
				return;
			}
			const pythonLocation = clean.match(/^\s*File "(.+)", line (\d+)/);
			if (pythonLocation) {
				commit();
				pending = normalizeDiagnostic({
					file: pythonLocation[1],
					line: pythonLocation[2],
					message: 'Python traceback',
					source,
				});
				return;
			}
			if (pending && /^\w*(?:Error|Exception):/.test(clean)) {
				pending.message = clean;
				commit();
				return;
			}
			const parsed = parseLine(clean, source);
			if (parsed) {
				commit();
				pending = parsed;
				multilineMessage = /^CMake (Error|Warning)/i.test(clean);
			}
		}

		return {
			push(chunk) {
				const lines = (remainder + String(chunk ?? '')).split('\n');
				remainder = lines.pop().slice(-16000);
				for (const line of lines) consume(line);
				return this.snapshot();
			},
			finish() {
				if (remainder) consume(remainder);
				remainder = '';
				commit();
				return diagnostics.map((diagnostic) => ({ ...diagnostic }));
			},
			snapshot() {
				return retainDiagnostics(
					pending && !keys.has(JSON.stringify(pending)) ? [...diagnostics, pending] : diagnostics,
					maximumDiagnostics,
				);
			},
		};
	}

	function canonicalPath(value) {
		const normalized = normalizePath(value);
		if (/^[a-z][a-z\d+.-]*:/i.test(normalized) && !/^[a-z]:\//i.test(normalized)) return null;
		const segments = [];
		for (const segment of normalized.split('/')) {
			if (!segment || segment === '.') continue;
			if (segment === '..') {
				if (!segments.length || /^[a-z]:$/i.test(segments.at(-1))) return null;
				segments.pop();
			} else segments.push(segment);
		}
		return (
			(normalized.startsWith('//') ? '//' : normalized.startsWith('/') ? '/' : '') +
			segments.join('/')
		);
	}

	function resolveProjectPath(file, paths, directory = '') {
		let normalized = canonicalPath(file);
		const projectRoot = canonicalPath(directory)?.replace(/\/$/, '') || '';
		if (!normalized) return null;
		const windowsPath =
			/^[a-z]:\//i.test(projectRoot || normalized) || projectRoot.startsWith('//');
		const compare = (value) => (windowsPath ? value.toLowerCase() : value);
		const absolute = /^(?:\/|[a-z]:\/)/i.test(normalized);
		if (absolute) {
			if (!projectRoot || !compare(normalized).startsWith(compare(projectRoot) + '/')) return null;
			normalized = normalized.slice(projectRoot.length + 1);
		}
		const available = Array.from(paths);
		if (available.includes(normalized)) return normalized;
		const matches = available.filter(
			(path) =>
				compare(normalized) === compare(path) ||
				(!absolute && compare(normalized).endsWith('/' + compare(path))),
		);
		return matches.length === 1 ? matches[0] : null;
	}

	return {
		stripAnsi,
		normalizePath,
		normalizeDiagnostic,
		retainDiagnostics,
		parseLine,
		createParser,
		resolveProjectPath,
	};
});
