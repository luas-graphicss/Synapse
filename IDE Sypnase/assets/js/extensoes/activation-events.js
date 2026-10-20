(function (root) {
	'use strict';

	const KINDS = Object.freeze({
		STARTUP: 'onStartupFinished',
		COMMAND: 'onCommand',
		LANGUAGE: 'onLanguage',
		VIEW: 'onView',
		WORKSPACE_CONTAINS: 'workspaceContains',
		ALWAYS: '*',
	});

	function globToRegExp(glob) {
		let source = '';
		for (let index = 0; index < glob.length; index++) {
			const char = glob[index];
			if (char === '*') {
				if (glob[index + 1] === '*') {
					index++;
					if (glob[index + 1] === '/') {
						index++;
						source += '(?:.*/)?';
					} else source += '.*';
				} else source += '[^/]*';
			} else if (char === '?') source += '[^/]';
			else if (char === '{') {
				const end = glob.indexOf('}', index);
				if (end === -1) source += '\\{';
				else {
					const options = glob.slice(index + 1, end).split(',').map((option) => option.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
					source += '(?:' + options.join('|') + ')';
					index = end;
				}
			} else if (/[.+^${}()|[\]\\]/.test(char)) source += '\\' + char;
			else source += char;
		}
		return new RegExp('^' + source + '$');
	}

	function parseOne(raw) {
		const text = String(raw || '').trim();
		if (!text) return null;
		if (text === KINDS.ALWAYS) return { kind: KINDS.ALWAYS, value: null, raw: text };
		if (text === KINDS.STARTUP) return { kind: KINDS.STARTUP, value: null, raw: text };
		const separator = text.indexOf(':');
		if (separator === -1) return null;
		const kind = text.slice(0, separator);
		const value = text.slice(separator + 1);
		if (![KINDS.COMMAND, KINDS.LANGUAGE, KINDS.VIEW, KINDS.WORKSPACE_CONTAINS].includes(kind) || !value) return null;
		const event = { kind, value, raw: text };
		if (kind === KINDS.WORKSPACE_CONTAINS) event.matcher = globToRegExp(value.replace(/^\.?\//, ''));
		return event;
	}

	function parse(list) {
		return (Array.isArray(list) ? list : []).map(parseOne).filter(Boolean);
	}

	function implicitEvents(manifest) {
		const events = [];
		const commands = manifest && manifest.contributes ? manifest.contributes.commands || [] : [];
		commands.forEach((entry) => {
			if (entry && typeof entry.command === 'string') events.push(`${KINDS.COMMAND}:${entry.command}`);
		});
		return events;
	}

	function resolve(manifest) {
		const declared = manifest && Array.isArray(manifest.activationEvents) ? manifest.activationEvents : [];
		const merged = new Set(declared.concat(implicitEvents(manifest)));
		if (!declared.length) merged.add(KINDS.STARTUP);
		return parse([...merged]);
	}

	function matches(events, kind, value) {
		return events.some((event) => {
			if (event.kind === KINDS.ALWAYS) return true;
			if (event.kind !== kind) return false;
			if (kind === KINDS.STARTUP) return true;
			if (kind === KINDS.WORKSPACE_CONTAINS) {
				const paths = Array.isArray(value) ? value : [value];
				return paths.some((path) => event.matcher.test(String(path || '')));
			}
			return event.value === value;
		});
	}

	function describe(event) {
		if (event.kind === KINDS.ALWAYS) return 'sempre ao iniciar';
		if (event.kind === KINDS.STARTUP) return 'ao terminar a inicialização';
		if (event.kind === KINDS.COMMAND) return `ao executar o comando "${event.value}"`;
		if (event.kind === KINDS.LANGUAGE) return `ao abrir um arquivo ${event.value}`;
		if (event.kind === KINDS.VIEW) return `ao abrir a view "${event.value}"`;
		return `quando o projeto contém "${event.value}"`;
	}

	root.SynapseExtensionActivation = Object.freeze({ KINDS, parse, resolve, matches, implicitEvents, describe, globToRegExp });
})(typeof self !== 'undefined' ? self : window);
