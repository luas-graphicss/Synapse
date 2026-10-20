(function () {
	'use strict';

	const tree = document.getElementById('tree');
	if (!tree) return;
	const selection = window.SynapseExplorerSelection;
	const actions = window.SynapseExplorerActions;
	const files = window.SynapseExplorerFiles;
	const virtual = window.SynapseVirtualTree;
	let selectionMode = false;

	function rowPath(row) {
		return row?.dataset.file ?? row?.dataset.dir ?? null;
	}

	function contextDirectory() {
		const project = activeProject();
		if (!project) return '';
		const path = selection.state(project).focused;
		if (!path) return '';
		return project.files.has(path) ? files.directoryOf(path) : path;
	}

	function refresh() {
		const project = activeProject();
		const mountedRows = [...tree.querySelectorAll('.row[data-file],.row[data-dir]')];
		if (!project) {
			tree.removeAttribute('aria-activedescendant');
			updateStatus(0);
			return;
		}
		const visiblePaths = virtual ? virtual.visiblePaths() : mountedRows.map(rowPath);
		const current = selection.synchronize(project, visiblePaths);
		const total = String(visiblePaths.length);
		for (const row of mountedRows) {
			const path = rowPath(row);
			row.id = 'explorer-item-' + encodeURIComponent(path);
			row.setAttribute('role', 'treeitem');
			row.setAttribute('aria-level', String(path.split('/').length));
			row.setAttribute('aria-selected', String(current.selected.has(path)));
			row.setAttribute('aria-label', path);
			if (row.dataset.index !== undefined) {
				row.setAttribute('aria-posinset', String(Number(row.dataset.index) + 1));
				row.setAttribute('aria-setsize', total);
			}
			if (row.dataset.dir !== undefined)
				row.setAttribute('aria-expanded', String(row.classList.contains('open')));
			row.classList.toggle('sel', current.selected.has(path));
			row.classList.toggle('explorer-focused', current.focused === path);
			row.classList.toggle('explorer-cut', !!actions.isCut(project, path));
		}
		if (current.focused)
			tree.setAttribute(
				'aria-activedescendant',
				'explorer-item-' + encodeURIComponent(current.focused),
			);
		else tree.removeAttribute('aria-activedescendant');
		updateStatus(current.selected.size);
	}

	function updateStatus(count) {
		const status = document.getElementById('explorerSelectionStatus');
		if (!status) return;
		const text =
			count > 1 ? count + ' itens selecionados' : selectionMode ? 'Seleção múltipla ativa' : '';
		if (status.textContent !== text) status.textContent = text;
		status.hidden = !text;
	}

	function focusPath(path, options = {}) {
		const project = activeProject();
		if (!project) return;
		selection.select(project, path, options);
		if (virtual) virtual.reveal(path);
		refresh();
		tree.focus({ preventScroll: true });
		if (!virtual)
			tree
				.querySelector('.row[data-file="' + CSS.escape(path) + '"],.row[data-dir="' + CSS.escape(path) + '"]')
				?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
	}

	function toggleDirectory(path, open) {
		if (open ?? !openDirs.has(path)) openDirs.add(path);
		else openDirs.delete(path);
		renderTree();
		refresh();
		tree.focus({ preventScroll: true });
	}

	function renameFocused() {
		const project = activeProject();
		const current = project && selection.state(project);
		if (!current?.focused || current.selected.size !== 1) return;
		const path = current.focused;
		if (project.files.has(path)) window.ctxRenameFile(path);
		else window.ctxRenameFolder(path);
	}

	function click(event) {
		if (event.target.closest('.ex-inline')) return;
		const project = activeProject();
		const row = event.target.closest('.row[data-file],.row[data-dir]');
		if (!project) return;
		if (!row) {
			if (!event.ctrlKey && !event.metaKey && !event.shiftKey) selection.clear(project);
			refresh();
			tree.focus({ preventScroll: true });
			return;
		}
		const path = rowPath(row);
		const multiple = event.ctrlKey || event.metaKey || event.shiftKey || selectionMode;
		focusPath(path, {
			toggle: event.ctrlKey || event.metaKey || selectionMode,
			range: event.shiftKey,
			additive: event.ctrlKey || event.metaKey,
		});
		if (multiple) {
			event.stopPropagation();
			return;
		}
		if (row.dataset.dir !== undefined) toggleDirectory(path);
		else {
			openFileInEditor(path);
			tree.focus({ preventScroll: true });
		}
	}

	tree.tabIndex = 0;
	tree.setAttribute('role', 'tree');
	tree.setAttribute('aria-label', 'Arquivos do projeto');
	tree.setAttribute('aria-multiselectable', 'true');
	const status = document.createElement('div');
	status.id = 'explorerSelectionStatus';
	status.className = 'explorer-selection-status';
	status.setAttribute('role', 'status');
	status.hidden = true;
	tree.after(status);
	const selectButton = document.createElement('button');
	selectButton.id = 'exSelectBtn';
	selectButton.type = 'button';
	selectButton.className = 'tbtn';
	selectButton.title = 'Seleção múltipla';
	selectButton.setAttribute('aria-label', 'Seleção múltipla');
	selectButton.setAttribute('aria-pressed', 'false');
	selectButton.innerHTML = iconSvg('selectAll');
	document.querySelector('.ex-actions')?.append(selectButton);
	selectButton.addEventListener('click', () => {
		selectionMode = !selectionMode;
		selectButton.setAttribute('aria-pressed', String(selectionMode));
		selectButton.classList.toggle('on', selectionMode);
		refresh();
	});
	new MutationObserver(refresh).observe(tree, { childList: true, subtree: true });
	window.SynapseExplorer = Object.freeze({
		refresh,
		click,
		rowPath,
		contextDirectory,
		renameFocused,
		focusPath,
		toggleDirectory,
		contextMenu: (event) => window.SynapseExplorerMenu?.open(event),
		selectionMode: () => selectionMode,
	});
	refresh();
})();
