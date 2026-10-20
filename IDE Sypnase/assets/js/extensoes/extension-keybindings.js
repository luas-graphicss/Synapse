(function (root) {
	'use strict';

	const GROUP_ID = 'extensions';
	const KEY_NAMES = Object.freeze({
		enter: 'Enter',
		return: 'Enter',
		space: 'Space',
		tab: 'Tab',
		escape: 'Escape',
		esc: 'Escape',
		backspace: 'Backspace',
		delete: 'Delete',
		del: 'Delete',
		insert: 'Insert',
		home: 'Home',
		end: 'End',
		pageup: 'PageUp',
		pagedown: 'PageDown',
		up: 'ArrowUp',
		down: 'ArrowDown',
		left: 'ArrowLeft',
		right: 'ArrowRight',
	});
	const MODIFIERS = Object.freeze({ ctrl: 'Mod', cmd: 'Mod', meta: 'Mod', win: 'Mod', mod: 'Mod', alt: 'Alt', option: 'Alt', shift: 'Shift' });
	const entries = new Map();

	function catalog() {
		return root.SynapseShortcutCatalog;
	}

	function bindings() {
		return root.SynapseShortcutBindings;
	}

	function registry() {
		return root.SynapseExtensions;
	}

	function output() {
		return root.SynapseExtensionOutput;
	}

	function shortcutId(extensionId, command) {
		return `ext:${extensionId}:${command}`;
	}

	function convertKey(raw) {
		const text = String(raw || '').trim().toLowerCase();
		if (!text) return { binding: '', error: 'Atalho vazio.' };
		if (/\s/.test(text)) return { binding: '', error: `Acordes (duas combinações) não são suportados: "${raw}".` };
		const parts = text.split('+');
		let key = parts.pop();
		if (key === '') {
			key = '+';
			parts.pop();
		}
		const modifiers = new Set();
		for (const part of parts) {
			const modifier = MODIFIERS[part];
			if (!modifier) return { binding: '', error: `Modificador desconhecido "${part}" em "${raw}".` };
			modifiers.add(modifier);
		}
		let normalized;
		if (KEY_NAMES[key]) normalized = KEY_NAMES[key];
		else if (/^f([1-9]|1[0-9]|2[0-4])$/.test(key)) normalized = key.toUpperCase();
		else if (key.length === 1) normalized = key.toUpperCase();
		else return { binding: '', error: `Tecla desconhecida "${key}" em "${raw}".` };
		const ordered = ['Mod', 'Alt', 'Shift'].filter((modifier) => modifiers.has(modifier));
		return { binding: ordered.concat(normalized).join('+'), error: null };
	}

	function contextSnapshot() {
		const state = root.State || {};
		const project = typeof root.activeProject === 'function' ? root.activeProject() : null;
		const openFile = project && project.openFile ? project.openFile : '';
		const editor = document.getElementById('codeTa');
		const active = document.activeElement;
		const languages = root.SynapseEditorLanguages;
		const languageId = openFile && languages && typeof languages.fromPath === 'function' ? languages.fromPath(openFile) : '';
		const fileName = openFile.split('/').pop() || '';
		const dot = fileName.lastIndexOf('.');
		const html = document.documentElement.classList;
		const configuration = root.SynapseExtensionConfiguration;
		return {
			editorFocus: !!editor && active === editor,
			editorTextFocus: !!editor && active === editor,
			editorHasSelection: !!editor && editor.selectionStart !== editor.selectionEnd,
			editorLangId: languageId || '',
			resourceExtname: dot > 0 ? fileName.slice(dot) : '',
			resourceFilename: fileName,
			resourcePath: openFile,
			hasProject: !!project,
			paletteOpen: !!state.paletteOpen,
			isMobile: html.contains('aurora-mobile') || html.contains('aurora-narrow'),
			isDesktop: !(html.contains('aurora-mobile') || html.contains('aurora-narrow')),
			isTouch: html.contains('aurora-touch'),
			view: '',
			lookup(name) {
				if (name.startsWith('config.') && configuration) return configuration.get(name.slice('config.'.length));
				return undefined;
			},
		};
	}

	function whenAllows(entry) {
		if (!entry.when) return true;
		try {
			return root.SynapseWhenClause.evaluate(entry.when, contextSnapshot());
		} catch (error) {
			return false;
		}
	}

	function register(extensionId, manifest) {
		unregister(extensionId);
		const list = Array.isArray(manifest.contributes.keybindings) ? manifest.contributes.keybindings : [];
		const titles = new Map(manifest.contributes.commands.map((entry) => [entry.command, entry]));
		const catalogEntries = [];
		const problems = [];
		list.forEach((raw, index) => {
			if (!raw || typeof raw.command !== 'string' || typeof raw.key !== 'string') {
				problems.push(`keybindings[${index}]: exige "command" e "key".`);
				return;
			}
			const converted = convertKey(raw.key);
			if (converted.error) {
				problems.push(`keybindings[${index}]: ${converted.error}`);
				return;
			}
			const whenError = raw.when ? root.SynapseWhenClause.validate(raw.when) : null;
			if (whenError) {
				problems.push(`keybindings[${index}]: ${whenError}`);
				return;
			}
			const id = shortcutId(extensionId, raw.command);
			if (catalogEntries.some((entry) => entry.id === id)) {
				problems.push(`keybindings[${index}]: comando "${raw.command}" tem mais de um atalho; só o primeiro é usado.`);
				return;
			}
			const meta = titles.get(raw.command);
			const label = meta ? (meta.category ? `${meta.category}: ${meta.title}` : meta.title) : raw.command;
			catalogEntries.push({
				id,
				label,
				group: GROUP_ID,
				defaultBinding: converted.binding,
				worksWithOverlay: false,
				extensionId,
				command: raw.command,
				when: typeof raw.when === 'string' ? raw.when.trim() : '',
				source: manifest.name,
			});
		});
		if (catalogEntries.length) {
			entries.set(extensionId, catalogEntries);
			catalog().register(catalogEntries);
			if (bindings()) bindings().refresh();
		}
		problems.forEach((problem) => output().warn(extensionId, problem));
		return { count: catalogEntries.length, problems };
	}

	function unregister(extensionId) {
		const own = entries.get(extensionId);
		if (!own) return false;
		entries.delete(extensionId);
		catalog().unregister(own.map((entry) => entry.id));
		if (bindings()) bindings().refresh();
		return true;
	}

	function run(id) {
		if (typeof id !== 'string' || !id.startsWith('ext:')) return false;
		const entry = catalog().find(id);
		if (!entry || !entry.extensionId) return false;
		if (!whenAllows(entry)) return false;
		registry()
			.executeCommand(entry.command)
			.catch(() => {});
		return true;
	}

	function bindingLabel(extensionId, command) {
		const id = shortcutId(extensionId, command);
		const api = bindings();
		if (!api || !catalog().find(id)) return '';
		const binding = api.bindingOf(id);
		return binding ? root.SynapseShortcutFormat.toLabel(binding) : '';
	}

	function listFor(extensionId) {
		return (entries.get(extensionId) || []).map((entry) => ({
			...entry,
			binding: bindings() ? bindings().bindingOf(entry.id) : entry.defaultBinding,
		}));
	}

	root.SynapseExtensionKeybindings = Object.freeze({ GROUP_ID, register, unregister, run, convertKey, contextSnapshot, bindingLabel, listFor, shortcutId });
})(window);
