(function (root) {
	'use strict';

	const KEY = 'keyboard-shortcuts';
	const CHORD_TIMEOUT = 1200;
	const EXPORT_VERSION = 1;

	let container = null;
	let searchTerm = '';
	let keyFilter = '';
	let recordingFilter = false;
	let showOnly = 'all';
	let sortBy = 'group';
	let editingId = null;
	let chordTimer = 0;
	let chordPending = false;

	function tr(text) {
		return typeof root.tr === 'function' ? root.tr(text) : text;
	}

	function esc(text) {
		return typeof root.escaparHtml === 'function' ? root.escaparHtml(String(text == null ? '' : text)) : String(text == null ? '' : text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
	}

	function icon(name, className) {
		return typeof root.iconSvg === 'function' ? root.iconSvg(name, className) : '';
	}

	function toast(title, message, kind) {
		if (typeof root.toast === 'function') root.toast(title, message, kind);
	}

	function bindings() {
		return root.SynapseShortcutBindings;
	}

	function catalog() {
		return root.SynapseShortcutCatalog;
	}

	function format() {
		return root.SynapseShortcutFormat;
	}

	function capture() {
		return root.SynapseShortcutCapture;
	}

	function panels() {
		return root.SynapseHostPanels;
	}

	function groupLabel(id) {
		const group = catalog() ? catalog().groups().find((entry) => entry.id === id) : null;
		return group ? tr(group.label) : id;
	}

	function keyTokens(binding) {
		return String(binding || '')
			.split('+')
			.filter(Boolean)
			.map((token) => token.toLowerCase());
	}

	function matches(shortcut) {
		if (showOnly === 'customized' && !shortcut.customized) return false;
		if (showOnly === 'unbound' && shortcut.binding) return false;
		if (showOnly === 'conflicts' && !bindings().conflict(shortcut.id, shortcut.binding)) return false;
		if (showOnly === 'extensions' && shortcut.group !== 'extensions') return false;
		if (keyFilter) {
			const wanted = keyTokens(keyFilter);
			const have = keyTokens(shortcut.binding);
			if (!wanted.every((token) => have.includes(token))) return false;
		}
		if (!searchTerm) return true;
		const hay = `${shortcut.label} ${shortcut.id} ${shortcut.source || ''} ${groupLabel(shortcut.group)} ${format().toLabel(shortcut.binding)} ${shortcut.when || ''}`.toLowerCase();
		return searchTerm
			.toLowerCase()
			.split(/\s+/)
			.filter(Boolean)
			.every((word) => hay.includes(word));
	}

	function sorted(list) {
		const copy = list.slice();
		copy.sort((a, b) => {
			if (sortBy === 'label') return a.label.localeCompare(b.label);
			if (sortBy === 'binding') return format().toLabel(a.binding).localeCompare(format().toLabel(b.binding));
			if (sortBy === 'source') return String(a.source || 'Synapse').localeCompare(String(b.source || 'Synapse')) || a.label.localeCompare(b.label);
			const groups = catalog().groups().map((group) => group.id);
			return groups.indexOf(a.group) - groups.indexOf(b.group) || a.label.localeCompare(b.label);
		});
		return copy;
	}

	function keyMarkup(binding, extraClass) {
		if (!binding) return `<span class="ks-unbound">${esc(tr('sem atalho'))}</span>`;
		return format()
			.toLabel(binding)
			.split(' + ')
			.map((part) => `<kbd class="ks-key${extraClass ? ' ' + extraClass : ''}">${esc(part)}</kbd>`)
			.join('<span class="ks-plus">+</span>');
	}

	function rowMarkup(shortcut) {
		const conflict = shortcut.binding ? bindings().conflict(shortcut.id, shortcut.binding) : null;
		const editing = editingId === shortcut.id;
		const classes = ['ks-row', shortcut.customized ? 'customized' : '', conflict ? 'conflict' : '', editing ? 'editing' : ''].filter(Boolean).join(' ');
		const bindingCell = editing
			? `<span class="ks-capture" aria-live="assertive">${esc(tr('Pressione as teclas…'))} <span class="ks-hint">Esc ${esc(tr('cancela'))}</span></span>`
			: `<button type="button" class="ks-binding" data-act="edit" title="${esc(tr('Clique para alterar'))}">${keyMarkup(shortcut.binding)}</button>`;
		const info = [];
		if (shortcut.customized) info.push(`<span class="ks-tag">${esc(tr('personalizado'))}</span>`);
		if (conflict) info.push(`<span class="ks-tag ks-tag-conflict" title="${esc(conflict.label)}">${icon('warn')} ${esc(tr('conflita com'))} “${esc(conflict.label)}”</span>`);
		if (shortcut.customized && shortcut.defaultBinding && shortcut.defaultBinding !== shortcut.binding) info.push(`<span class="ks-tag ks-tag-default">${esc(tr('padrão'))}: ${esc(format().toLabel(shortcut.defaultBinding))}</span>`);
		return (
			`<tr class="${classes}" data-id="${esc(shortcut.id)}">` +
			`<td class="ks-col-cmd"><div class="ks-label">${esc(shortcut.label)}</div><div class="ks-id xd-mono">${esc(shortcut.id)}</div>${info.length ? `<div class="ks-info">${info.join('')}</div>` : ''}</td>` +
			`<td class="ks-col-key">${bindingCell}</td>` +
			`<td class="ks-col-when xd-mono xd-muted">${esc(shortcut.when || '')}</td>` +
			`<td class="ks-col-src">${esc(shortcut.source || 'Synapse')}</td>` +
			`<td class="ks-col-act">` +
			(shortcut.binding ? `<button type="button" class="xv-gear" data-act="clear" title="${esc(tr('Remover atalho'))}" aria-label="${esc(tr('Remover atalho'))}">${icon('close')}</button>` : '') +
			(shortcut.customized ? `<button type="button" class="xv-gear" data-act="reset" title="${esc(tr('Restaurar padrão'))}" aria-label="${esc(tr('Restaurar padrão'))}">${icon('reload')}</button>` : '') +
			`<button type="button" class="xv-gear" data-act="copy" title="${esc(tr('Copiar ID'))}" aria-label="${esc(tr('Copiar ID'))}">${icon('copy')}</button>` +
			`</td>` +
			`</tr>`
		);
	}

	function groupedRows(list) {
		if (sortBy !== 'group') return list.map(rowMarkup).join('');
		const out = [];
		let last = null;
		list.forEach((shortcut) => {
			if (shortcut.group !== last) {
				last = shortcut.group;
				out.push(`<tr class="ks-group"><th colspan="5">${esc(groupLabel(shortcut.group))}</th></tr>`);
			}
			out.push(rowMarkup(shortcut));
		});
		return out.join('');
	}

	function toolbarMarkup(total, shown) {
		const filters = [
			['all', tr('Todos')],
			['customized', tr('Personalizados')],
			['unbound', tr('Sem atalho')],
			['conflicts', tr('Conflitos')],
			['extensions', tr('Extensões')],
		];
		return (
			`<header class="ks-head">` +
			`<div class="ks-title"><h1>${esc(tr('Atalhos de teclado'))}</h1><span class="xd-muted">${shown}/${total}</span></div>` +
			`<div class="ks-tools">` +
			`<button type="button" class="xv-btn" data-act="export">${icon('export')} ${esc(tr('Exportar JSON'))}</button>` +
			`<button type="button" class="xv-btn" data-act="import">${icon('import')} ${esc(tr('Importar JSON'))}</button>` +
			`<button type="button" class="xv-btn xv-btn-danger" data-act="reset-all">${esc(tr('Restaurar todos'))}</button>` +
			`</div>` +
			`</header>` +
			`<div class="ks-filters">` +
			`<div class="xv-search ks-search">${icon('search', 'xv-search-icon')}<input type="search" class="xv-search-input" data-role="search" value="${esc(searchTerm)}" placeholder="${esc(tr('Buscar por comando, ID, origem ou tecla'))}" aria-label="${esc(tr('Buscar atalhos'))}" autocomplete="off" spellcheck="false" /></div>` +
			`<button type="button" class="xv-btn${recordingFilter ? ' active' : ''}" data-act="record-filter" aria-pressed="${recordingFilter}" title="${esc(tr('Digite uma combinação para filtrar por tecla'))}">${icon('command')} ${recordingFilter ? esc(tr('Gravando…')) : keyFilter ? keyMarkup(keyFilter, 'small') : esc(tr('Filtrar por tecla'))}</button>` +
			(keyFilter ? `<button type="button" class="xv-gear" data-act="clear-key-filter" aria-label="${esc(tr('Limpar filtro de tecla'))}">${icon('close')}</button>` : '') +
			`<div class="ks-chips" role="group" aria-label="${esc(tr('Mostrar'))}">${filters.map(([id, label]) => `<button type="button" class="ks-chip${showOnly === id ? ' active' : ''}" data-show="${id}" aria-pressed="${showOnly === id}">${esc(label)}</button>`).join('')}</div>` +
			`</div>`
		);
	}

	function render(preserveFocus) {
		if (!container) return;
		const all = bindings().list();
		const list = sorted(all.filter(matches));
		const active = document.activeElement;
		const searchHadFocus = active && active.dataset && active.dataset.role === 'search';
		const cursor = searchHadFocus ? active.selectionStart : null;
		const th = (key, label) => `<th><button type="button" class="xr-sort${sortBy === key ? ' active' : ''}" data-sort="${key}">${esc(label)}${sortBy === key ? icon('drop', 'xr-sort-ico') : ''}</button></th>`;
		container.innerHTML =
			`<div class="ks-root">` +
			toolbarMarkup(all.length, list.length) +
			(list.length
				? `<table class="xd-table ks-table"><thead><tr>${th('label', tr('Comando'))}${th('binding', tr('Atalho'))}<th>${esc(tr('Quando'))}</th>${th('source', tr('Origem'))}<th></th></tr></thead><tbody>${groupedRows(list)}</tbody></table>`
				: `<p class="xd-empty">${esc(tr('Nenhum atalho corresponde ao filtro.'))}</p>`) +
			`<p class="ks-foot xd-muted">${esc(tr('Clique em um atalho para gravar uma nova combinação. Atalhos em conflito são destacados; ao gravar sobre um atalho já usado, o anterior é removido.'))}</p>` +
			`</div>`;
		if (searchHadFocus && !preserveFocus) {
			const input = container.querySelector('[data-role="search"]');
			if (input) {
				input.focus();
				try {
					input.setSelectionRange(cursor, cursor);
				} catch (error) {}
			}
		}
	}

	function stopEditing() {
		if (capture() && capture().isActive()) capture().stop();
		editingId = null;
	}

	function startEditing(id) {
		const shortcut = bindings().list().find((entry) => entry.id === id);
		if (!shortcut || !capture()) return;
		stopEditing();
		editingId = id;
		render(true);
		capture().start({
			onCapture: (binding) => {
				editingId = null;
				if (!format().hasModifier(binding) && !/^F\d{1,2}$/.test(format().parse(binding).key)) {
					toast(tr('Atalho inválido'), tr('Use pelo menos Ctrl/Cmd ou Alt, ou uma tecla F1–F12.'), 'warn');
					return render();
				}
				const conflicting = bindings().conflict(id, binding);
				bindings().assign(id, binding);
				if (conflicting) {
					bindings().assign(conflicting.id, '');
					toast(tr('Atalho reatribuído'), `“${conflicting.label}” ${tr('ficou sem atalho')}`, 'warn');
				} else toast(tr('Atalho atualizado'), `${shortcut.label}: ${format().toLabel(binding)}`, 'ok');
				render();
			},
			onCancel: () => {
				editingId = null;
				render();
			},
		});
	}

	function startKeyFilter() {
		if (!capture()) return;
		stopEditing();
		recordingFilter = true;
		render(true);
		capture().start({
			onCapture: (binding) => {
				recordingFilter = false;
				keyFilter = binding;
				render();
			},
			onCancel: () => {
				recordingFilter = false;
				render();
			},
		});
	}

	function exportJson() {
		const customized = bindings()
			.list()
			.filter((shortcut) => shortcut.customized)
			.reduce((acc, shortcut) => ((acc[shortcut.id] = shortcut.binding), acc), {});
		const payload = { version: EXPORT_VERSION, exportedAt: new Date().toISOString(), app: 'synapse', bindings: customized };
		const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = 'synapse-keybindings.json';
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
		toast(tr('Atalhos exportados'), `${Object.keys(customized).length} ${tr('personalização(ões)')}`, 'ok');
	}

	function parseImport(text) {
		const parsed = JSON.parse(text);
		const source = parsed && typeof parsed === 'object' && parsed.bindings && typeof parsed.bindings === 'object' ? parsed.bindings : Array.isArray(parsed) ? Object.fromEntries(parsed.filter((entry) => entry && typeof entry.command === 'string').map((entry) => [entry.command, typeof entry.key === 'string' ? entry.key : ''])) : parsed;
		if (!source || typeof source !== 'object') throw new Error(tr('Formato não reconhecido.'));
		const result = { applied: 0, skipped: [] };
		Object.keys(source).forEach((id) => {
			const binding = source[id];
			if (typeof binding !== 'string' || !catalog().find(id)) return void result.skipped.push(id);
			if (binding && !format().parse(binding)) return void result.skipped.push(id);
			result.applied++;
			bindings().assign(id, binding);
		});
		return result;
	}

	function importJson() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'application/json,.json';
		input.addEventListener('change', async () => {
			const file = input.files && input.files[0];
			if (!file) return;
			try {
				const result = parseImport(await file.text());
				toast(tr('Atalhos importados'), `${result.applied} ${tr('aplicado(s)')}${result.skipped.length ? `, ${result.skipped.length} ${tr('ignorado(s)')}` : ''}`, result.skipped.length ? 'warn' : 'ok');
				render();
			} catch (error) {
				toast(tr('Falha ao importar'), error && error.message ? error.message : String(error), 'err');
			}
		});
		input.click();
	}

	async function resetAll() {
		const ok = typeof root.uiConfirm === 'function' ? await root.uiConfirm(tr('Restaurar todos os atalhos'), tr('Todas as personalizações serão descartadas.'), tr('Restaurar'), true) : confirm(tr('Restaurar todos os atalhos?'));
		if (!ok) return;
		bindings().resetAll();
		toast(tr('Atalhos restaurados'), '', 'ok');
		render();
	}

	function onClick(event) {
		const sort = event.target.closest('[data-sort]');
		if (sort) {
			sortBy = sort.dataset.sort;
			return render();
		}
		const chip = event.target.closest('[data-show]');
		if (chip) {
			showOnly = chip.dataset.show;
			return render();
		}
		const button = event.target.closest('[data-act]');
		if (!button) return;
		const act = button.dataset.act;
		const row = button.closest('.ks-row');
		const id = row ? row.dataset.id : '';
		if (act === 'edit') return startEditing(id);
		if (act === 'clear') {
			bindings().assign(id, '');
			return render();
		}
		if (act === 'reset') {
			bindings().clear(id);
			return render();
		}
		if (act === 'copy') {
			navigator.clipboard && navigator.clipboard.writeText(id).then(() => toast(tr('ID copiado'), id, 'ok')).catch(() => {});
			return;
		}
		if (act === 'export') return exportJson();
		if (act === 'import') return importJson();
		if (act === 'reset-all') return resetAll();
		if (act === 'record-filter') return recordingFilter ? (capture().stop(), (recordingFilter = false), render()) : startKeyFilter();
		if (act === 'clear-key-filter') {
			keyFilter = '';
			return render();
		}
	}

	function onInput(event) {
		if (event.target.dataset.role !== 'search') return;
		searchTerm = event.target.value;
		render();
	}

	function onKeydown(event) {
		const row = event.target.closest('.ks-row');
		if (row && event.key === 'Enter' && event.target.classList.contains('ks-binding')) {
			event.preventDefault();
			startEditing(row.dataset.id);
		}
	}

	function bind(node) {
		node.addEventListener('click', onClick);
		node.addEventListener('input', onInput);
		node.addEventListener('keydown', onKeydown);
	}

	function open(options) {
		if (!panels() || !bindings()) return;
		if (options && typeof options.search === 'string') searchTerm = options.search;
		panels().open({
			key: KEY,
			title: tr('Atalhos de teclado'),
			subtitle: 'Ctrl+K Ctrl+S',
			icon: 'command',
			render: (node) => {
				if (container !== node) {
					container = node;
					bind(node);
				}
				render();
				const input = node.querySelector('[data-role="search"]');
				if (input && !(options && options.focus === false)) setTimeout(() => input.focus(), 30);
			},
			onShow: () => render(),
			onClose: () => {
				stopEditing();
				container = null;
			},
		});
	}

	function isEditableTarget(target) {
		if (!target) return false;
		const tag = target.tagName;
		return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable || !!target.closest('.cm-editor, .monaco-editor');
	}

	function onChordKey(event) {
		if (capture() && capture().isActive()) return;
		const mod = event.ctrlKey || event.metaKey;
		if (!mod || event.altKey) {
			if (chordPending && !['Control', 'Meta', 'Shift'].includes(event.key)) resetChord();
			return;
		}
		const key = String(event.key).toLowerCase();
		if (chordPending && key === 's') {
			event.preventDefault();
			event.stopImmediatePropagation();
			resetChord();
			open();
			return;
		}
		if (key === 'k' && !event.shiftKey && !isEditableTarget(event.target)) {
			chordPending = true;
			clearTimeout(chordTimer);
			chordTimer = setTimeout(resetChord, CHORD_TIMEOUT);
			return;
		}
		if (chordPending && !['control', 'meta', 'shift'].includes(key)) resetChord();
	}

	function resetChord() {
		chordPending = false;
		clearTimeout(chordTimer);
		chordTimer = 0;
	}

	function register() {
		root.addEventListener('keydown', onChordKey, true);
		if (bindings() && typeof bindings().subscribe === 'function') bindings().subscribe(() => container && !editingId && render());
		if (root.SynapseNativeShortcuts && typeof root.SynapseNativeShortcuts.register === 'function') {
			root.SynapseNativeShortcuts.register([{ id: 'workspace.keyboardShortcuts', label: tr('Abrir atalhos de teclado'), group: 'workspace', defaultBinding: '', worksWithOverlay: true, run: () => open() }]);
		}
		const registry = root.SynapseExtensions;
		if (registry && typeof registry.registerPaletteCommand === 'function') {
			registry.registerPaletteCommand(() => ({ id: 'workspace.keyboardShortcuts', label: tr('Preferências: Atalhos de teclado'), hint: 'Ctrl+K Ctrl+S', icon: 'command', run: () => open() }));
		}
		document.addEventListener('synapse:language-changed', () => container && render());
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', register, { once: true });
	else register();

	root.SynapseKeyboardShortcutsEditor = Object.freeze({ open, exportJson, importJson, parseImport });
})(window);
