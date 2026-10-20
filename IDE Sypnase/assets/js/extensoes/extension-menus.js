(function (root) {
	'use strict';

	const LOCATIONS = Object.freeze(['editor/context', 'explorer/context', 'commandPalette']);
	const MAX_ITEMS_PER_LOCATION = 12;
	const MAX_SELECTION_CHARS = 10000;
	const contributions = new Map();
	let editorBound = false;

	function registry() {
		return root.SynapseExtensions;
	}

	function output() {
		return root.SynapseExtensionOutput;
	}

	function keybindings() {
		return root.SynapseExtensionKeybindings;
	}

	function whenClause() {
		return root.SynapseWhenClause;
	}

	function activeProject() {
		return typeof root.activeProject === 'function' ? root.activeProject() : null;
	}

	function context(overrides) {
		const base = keybindings() ? keybindings().contextSnapshot() : {};
		return Object.assign(base, overrides || {});
	}

	function allows(when, snapshot) {
		if (!when) return true;
		try {
			return whenClause().evaluate(when, snapshot);
		} catch (error) {
			return false;
		}
	}

	function groupOf(group) {
		const text = String(group || '');
		const at = text.indexOf('@');
		return at === -1 ? text : text.slice(0, at);
	}

	function orderOf(group) {
		const text = String(group || '');
		const at = text.indexOf('@');
		const value = at === -1 ? NaN : Number(text.slice(at + 1));
		return Number.isFinite(value) ? value : 0;
	}

	function compareEntries(a, b) {
		const groupA = groupOf(a.group);
		const groupB = groupOf(b.group);
		if (groupA !== groupB) {
			if (groupA === 'navigation') return -1;
			if (groupB === 'navigation') return 1;
			return groupA.localeCompare(groupB);
		}
		const orderA = orderOf(a.group);
		const orderB = orderOf(b.group);
		if (orderA !== orderB) return orderA - orderB;
		return a.index - b.index;
	}

	function register(extensionId, manifest) {
		unregister(extensionId);
		const menus = manifest.contributes.menus || {};
		const titles = new Map(manifest.contributes.commands.map((entry) => [entry.command, entry]));
		const own = {};
		const problems = [];
		Object.keys(menus).forEach((location) => {
			if (!LOCATIONS.includes(location)) {
				problems.push(`menus["${location}"]: local desconhecido. Use ${LOCATIONS.join(', ')}.`);
				return;
			}
			const list = Array.isArray(menus[location]) ? menus[location] : [];
			const entries = [];
			list.forEach((raw, index) => {
				if (!raw || typeof raw.command !== 'string' || !raw.command.trim()) {
					problems.push(`menus["${location}"][${index}]: exige "command".`);
					return;
				}
				const meta = titles.get(raw.command);
				if (!meta && location !== 'commandPalette') {
					problems.push(`menus["${location}"][${index}]: comando "${raw.command}" não está em contributes.commands.`);
					return;
				}
				const whenError = raw.when ? whenClause().validate(raw.when) : null;
				if (whenError) {
					problems.push(`menus["${location}"][${index}]: ${whenError}`);
					return;
				}
				if (entries.length >= MAX_ITEMS_PER_LOCATION) {
					problems.push(`menus["${location}"]: limite de ${MAX_ITEMS_PER_LOCATION} itens; "${raw.command}" ignorado.`);
					return;
				}
				entries.push({
					extensionId,
					extensionName: manifest.name,
					command: raw.command,
					title: meta ? meta.title : raw.command,
					category: meta && meta.category ? meta.category : '',
					icon: meta && meta.icon ? meta.icon : 'command',
					when: typeof raw.when === 'string' ? raw.when.trim() : '',
					group: typeof raw.group === 'string' ? raw.group.trim() : '',
					index,
				});
			});
			own[location] = entries;
		});
		contributions.set(extensionId, own);
		problems.forEach((problem) => output().warn(extensionId, problem));
		if ((own['editor/context'] || []).length) bindEditor();
		return { problems, counts: Object.fromEntries(Object.keys(own).map((location) => [location, own[location].length])) };
	}

	function unregister(extensionId) {
		return contributions.delete(extensionId);
	}

	function entriesFor(location) {
		const list = [];
		contributions.forEach((own) => {
			(own[location] || []).forEach((entry) => list.push(entry));
		});
		return list;
	}

	function visibleEntries(location, snapshot) {
		return entriesFor(location)
			.filter((entry) => allows(entry.when, snapshot))
			.sort(compareEntries);
	}

	function labelOf(entry) {
		return entry.category ? `${entry.category}: ${entry.title}` : entry.title;
	}

	function menuItems(location, snapshot, args) {
		const list = visibleEntries(location, snapshot);
		const items = [];
		let lastGroup = null;
		list.forEach((entry) => {
			const group = groupOf(entry.group);
			if (lastGroup !== null && group !== lastGroup) items.push({ sep: true });
			lastGroup = group;
			const shortcut = keybindings() ? keybindings().bindingLabel(entry.extensionId, entry.command) : '';
			items.push({
				icon: entry.icon,
				text: labelOf(entry) + (shortcut ? ' · ' + shortcut : ''),
				extensionId: entry.extensionId,
				run: () => {
					registry()
						.executeCommand(entry.command, ...(Array.isArray(args) ? args : []))
						.catch(() => {});
				},
			});
		});
		return items;
	}

	function paletteAllows(extensionId, command) {
		const own = contributions.get(extensionId);
		const entries = own && own.commandPalette ? own.commandPalette.filter((entry) => entry.command === command) : [];
		if (!entries.length) return true;
		const snapshot = context({ paletteOpen: true });
		return entries.every((entry) => allows(entry.when, snapshot));
	}

	function explorerItems(details) {
		const paths = Array.isArray(details.paths) ? details.paths : [];
		const project = details.project || activeProject();
		const first = paths[0] || '';
		const fileName = first.split('/').pop() || '';
		const dot = fileName.lastIndexOf('.');
		const isDirectory = !!first && !!project && !project.files.has(first);
		const snapshot = context({
			view: 'explorer',
			explorerFocus: true,
			explorerResourceIsFolder: isDirectory,
			explorerResourceIsRoot: !first,
			explorerSelectionCount: paths.length,
			resourcePath: first,
			resourceFilename: fileName,
			resourceExtname: dot > 0 ? fileName.slice(dot) : '',
			editorFocus: false,
			editorTextFocus: false,
		});
		return menuItems('explorer/context', snapshot, [{ path: first, paths: [...paths], isDirectory }]);
	}

	function editorTextarea() {
		return document.getElementById('codeTa');
	}

	function editorSnapshot(textarea) {
		return context({
			editorFocus: true,
			editorTextFocus: true,
			editorHasSelection: textarea.selectionStart !== textarea.selectionEnd,
		});
	}

	function editorArgs(textarea) {
		const project = activeProject();
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		return [
			{
				path: project && project.openFile ? project.openFile : '',
				selection: { start, end },
				selectedText: textarea.value.slice(start, Math.min(end, start + MAX_SELECTION_CHARS)),
			},
		];
	}

	function dispatchInput(textarea) {
		textarea.dispatchEvent(new Event('input', { bubbles: true }));
	}

	async function pasteInto(textarea) {
		textarea.focus();
		let text = '';
		if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
			try {
				text = await navigator.clipboard.readText();
			} catch (error) {
				text = '';
			}
		}
		if (!text) {
			if (typeof document.execCommand === 'function') document.execCommand('paste');
			return;
		}
		textarea.setRangeText(text, textarea.selectionStart, textarea.selectionEnd, 'end');
		dispatchInput(textarea);
	}

	function nativeEditorItems(textarea) {
		const hasSelection = textarea.selectionStart !== textarea.selectionEnd;
		const items = [];
		if (hasSelection) {
			items.push({
				icon: 'cut',
				text: 'Recortar',
				run: () => {
					textarea.focus();
					if (typeof document.execCommand === 'function') document.execCommand('cut');
				},
			});
			items.push({
				icon: 'copy',
				text: 'Copiar',
				run: () => {
					textarea.focus();
					if (typeof document.execCommand === 'function') document.execCommand('copy');
				},
			});
		}
		items.push({ icon: 'paste', text: 'Colar', run: () => pasteInto(textarea) });
		items.push({
			icon: 'selectAll',
			text: 'Selecionar tudo',
			run: () => {
				textarea.focus();
				textarea.select();
			},
		});
		return items;
	}

	function enhanceMenu(returnFocus) {
		const menu = document.querySelector('.ctxmenu');
		if (!menu) return;
		menu.setAttribute('role', 'menu');
		const buttons = [...menu.querySelectorAll('button')];
		buttons.forEach((button) => button.setAttribute('role', 'menuitem'));
		if (buttons[0]) buttons[0].focus();
		menu.addEventListener('keydown', (event) => {
			const index = buttons.indexOf(document.activeElement);
			if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
				event.preventDefault();
				const offset = event.key === 'ArrowUp' ? -1 : 1;
				const target = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + offset + buttons.length) % buttons.length;
				if (buttons[target]) buttons[target].focus();
			} else if (event.key === 'Escape') {
				event.preventDefault();
				if (typeof root.hideCtxMenu === 'function') root.hideCtxMenu();
				if (returnFocus) returnFocus.focus();
			}
		});
		menu.addEventListener('click', () => {
			if (document.activeElement === document.body && returnFocus) returnFocus.focus();
		});
	}

	function openEditorMenu(event, textarea) {
		const project = activeProject();
		if (!project || !project.openFile) return false;
		const extensionItems = menuItems('editor/context', editorSnapshot(textarea), editorArgs(textarea));
		if (!extensionItems.length || typeof root.showCtxMenu !== 'function') return false;
		event.preventDefault();
		const items = [{ label: project.openFile.split('/').pop() }].concat(nativeEditorItems(textarea), [{ sep: true }], extensionItems);
		let x = event.clientX;
		let y = event.clientY;
		if (!x && !y) {
			const bounds = textarea.getBoundingClientRect();
			x = bounds.left + 24;
			y = bounds.top + 24;
		}
		root.showCtxMenu(x, y, items);
		enhanceMenu(textarea);
		return true;
	}

	function bindEditor() {
		if (editorBound) return;
		const textarea = editorTextarea();
		if (!textarea) return;
		editorBound = true;
		textarea.addEventListener('contextmenu', (event) => {
			openEditorMenu(event, textarea);
		});
		textarea.addEventListener('keydown', (event) => {
			if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
				if (openEditorMenu(event, textarea)) event.stopPropagation();
			}
		});
	}

	function list(extensionId) {
		const own = contributions.get(extensionId);
		if (!own) return [];
		const result = [];
		Object.keys(own).forEach((location) => {
			own[location].forEach((entry) => result.push({ location, command: entry.command, when: entry.when, group: entry.group }));
		});
		return result;
	}

	root.SynapseExtensionMenus = Object.freeze({ LOCATIONS, register, unregister, menuItems, explorerItems, paletteAllows, list, context });
})(window);
