(function () {
    'use strict';

    const tree = document.getElementById('tree');
    const controller = window.SynapseExplorer;
    const selection = window.SynapseExplorerSelection;
    const actions = window.SynapseExplorerActions;
    const files = window.SynapseExplorerFiles;

    function clear() {
      __drag = null;
      tree.classList.remove('drop-root');
      tree
      .querySelectorAll('.dragging,.drop-into')
      .forEach((row) => row.classList.remove('dragging', 'drop-into'));
    }

    tree.addEventListener('dragstart', (event) => {
        const project = activeProject();
        const row = event.target.closest('.row[data-file],.row[data-dir]');
        if (!project || !row || event.target.closest('.ex-inline')) return;
        const path = controller.rowPath(row);
        if (!selection.state(project).selected.has(path)) controller.focusPath(path);
        __drag = { projectId: project.id, paths: files.roots(project, actions.selectedPaths(project)) };
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('application/x-synapse-files', JSON.stringify(__drag));
        tree.querySelectorAll('.row.sel').forEach((entry) => entry.classList.add('dragging'));
    });
    tree.addEventListener('dragover', (event) => {
        if (!__drag || activeProject()?.id !== __drag.projectId) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'move';
        tree.querySelectorAll('.drop-into').forEach((row) => row.classList.remove('drop-into'));
        const row = event.target.closest('.row[data-dir]');
        row?.classList.add('drop-into');
        tree.classList.toggle('drop-root', !row);
        const bounds = tree.getBoundingClientRect();
        if (event.clientY < bounds.top + 28) tree.scrollTop -= 18;
        if (event.clientY > bounds.bottom - 28) tree.scrollTop += 18;
    });
    tree.addEventListener('drop', (event) => {
        if (!__drag) return;
        event.preventDefault();
        event.stopPropagation();
        const row = event.target.closest('.row[data-dir],.row[data-file]');
        const destination = row?.dataset.dir ?? files.directoryOf(row?.dataset.file || '');
        const currentDrag = __drag;
        clear();
        actions.move(currentDrag.paths, destination, currentDrag.projectId);
    });
    tree.addEventListener('dragend', clear);
    tree.addEventListener('dragleave', (event) => {
        if (!tree.contains(event.relatedTarget)) {
          tree.classList.remove('drop-root');
          tree.querySelectorAll('.drop-into').forEach((row) => row.classList.remove('drop-into'));
        }
    });
    window.addEventListener('blur', clear);
})();
