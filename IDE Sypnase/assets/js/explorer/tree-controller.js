(function () {
    'use strict';

    const tree = document.getElementById('tree');
    if (!tree) return;
    const selection = window.SynapseExplorerSelection;
    const actions = window.SynapseExplorerActions;
    const files = window.SynapseExplorerFiles;
    let selectionMode = false;
    let visibleRows = [];

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
      visibleRows = [...tree.querySelectorAll('.row[data-file],.row[data-dir]')].filter((row) => {
          for (let parent = row.parentElement; parent && parent !== tree; parent = parent.parentElement) {
            if (parent.hidden || parent.style.display === 'none') return false;
          }
          return true;
      });
      if (!project) {
        tree.removeAttribute('aria-activedescendant');
        updateStatus(0);
        return;
      }
      const current = selection.synchronize(project, visibleRows.map(rowPath));
      for (const row of tree.querySelectorAll('.row[data-file],.row[data-dir]')) {
        const path = rowPath(row);
        row.id = 'explorer-item-' + encodeURIComponent(path);
        row.setAttribute('role', 'treeitem');
        row.setAttribute('aria-level', String(path.split('/').length));
        row.setAttribute('aria-selected', String(current.selected.has(path)));
        row.setAttribute('aria-label', path);
        if (row.dataset.dir !== undefined) {
          const group = row.nextElementSibling;
          if (group?.classList.contains('children')) {
            row.setAttribute(
              'aria-expanded',
              String(group.style.display !== 'none' && !group.hidden),
            );
            group.id = row.id + '-children';
            group.setAttribute('role', 'group');
            row.setAttribute('aria-owns', group.id);
          }
        }
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
      refresh();
      tree.focus({ preventScroll: true });
      visibleRows
      .find((row) => rowPath(row) === path)
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
