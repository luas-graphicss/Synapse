(function (root) {
	'use strict';

	const SOURCE_PREFIX = 'ext:';

	function project() {
		return typeof root.activeProject === 'function' ? root.activeProject() : null;
	}

	function push(level, extensionId, text) {
		const target = project();
		const source = SOURCE_PREFIX + extensionId;
		if (target && typeof root.pushLog === 'function') {
			root.pushLog(target, level, String(text), source);
			return;
		}
		const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
		console[method](`[${source}] ${text}`);
	}

	function info(extensionId, text) {
		push('log', extensionId, text);
	}

	function warn(extensionId, text) {
		push('warn', extensionId, text);
	}

	function error(extensionId, text) {
		push('error', extensionId, text);
	}

	function command(extensionId, text) {
		push('cmd', extensionId, text);
	}

	function show() {
		if (typeof root.openConsole === 'function' && root.State && !root.State.consoleOpen) root.openConsole(true);
	}

	function clear(extensionId) {
		const target = project();
		if (!target) return;
		const source = SOURCE_PREFIX + extensionId;
		target.logs = target.logs.filter((log) => log.src !== source);
		if (typeof root.renderConsole === 'function') root.renderConsole();
	}

	root.SynapseExtensionOutput = Object.freeze({ SOURCE_PREFIX, info, warn, error, command, show, clear });
})(window);
