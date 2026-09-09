(function () {
    'use strict';

    const tree = document.getElementById('tree');
    const controller = window.SynapseExplorer;
    const selection = window.SynapseExplorerSelection;
    const actions = window.SynapseExplorerActions;
    let typeBuffer = '';
    let typeTime = 0;
    let typeProject = null;

    function resetTypeahead() {
      typeBuffer = '';
      typeTime = 0;
      typeProject = null;
    }

    function findByPrefix(project, current, key) {
      const now = performance.now();
      if (typeProject !== project || now - typeTime >= 700) typeBuffer = '';
      typeProject = project;
      typeTime = now;
      const cycling = typeBuffer === key;
      typeBuffer = cycling ? key : typeBuffer + key;
      const focusedIndex = current.visible.indexOf(current.focused);
      const startsAfterFocus = cycling || typeBuffer.length === 1;
      const firstIndex = Math.max(0, focusedIndex + (startsAfterFocus ? 1 : 0));
      for (let offset = 0; offset < current.visible.length; offset++) {
        const path = current.visible[(firstIndex + offset) % current.visible.length];
        const filename = path.slice(path.lastIndexOf('/') + 1).toLowerCase();
        if (filename.startsWith(typeBuffer)) return path;
      }
      return null;
    }

    tree.addEventListener('focusout', resetTypeahead);
    tree.addEventListener('keydown', (event) => {
        if (event.target !== tree || event.altKey || event.isComposing) return;
        const project = activeProject();
        if (!project) return;
        const current = selection.state(project);
        const command = event.ctrlKey || event.metaKey;
        const key = event.key.toLowerCase();
        const commands = {
          a: () => {
            selection.selectAll(project);
            controller.refresh();
          },
          c: () => actions.copy(),
          x: () => actions.copy(true),
          v: () => actions.paste(controller.contextDirectory()),
          z: actions.undoDelete,
        };
        if (command && Object.hasOwn(commands, key) && !event.shiftKey) {
          event.preventDefault();
          event.stopPropagation();
          resetTypeahead();
          commands[key]();
          return;
        }
        if (event.key.length !== 1 || command || event.key === ' ') resetTypeahead();
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          const index = Math.max(0, current.visible.indexOf(current.focused));
          const next =
          event.key === 'Home'
          ? 0
          : event.key === 'End'
          ? current.visible.length - 1
          : Math.max(
            0,
            Math.min(current.visible.length - 1, index + (event.key === 'ArrowUp' ? -1 : 1)),
          );
          controller.focusPath(current.visible[next], {
              range: event.shiftKey,
              additive: command,
              focusOnly: command && !event.shiftKey,
          });
        } else if (event.key === 'ArrowRight' && current.focused) {
          event.preventDefault();
          if (!project.files.has(current.focused)) {
            if (!openDirs.has(current.focused)) controller.toggleDirectory(current.focused, true);
            else {
              const next = current.visible[current.visible.indexOf(current.focused) + 1];
              if (next?.startsWith(current.focused + '/')) controller.focusPath(next);
            }
          }
        } else if (event.key === 'ArrowLeft' && current.focused) {
          event.preventDefault();
          if (!project.files.has(current.focused) && openDirs.has(current.focused))
          controller.toggleDirectory(current.focused, false);
          else controller.focusPath(window.SynapseExplorerFiles.directoryOf(current.focused));
        } else if (event.key === ' ') {
          event.preventDefault();
          controller.focusPath(current.focused, { toggle: true, range: event.shiftKey });
        } else if (event.key === 'Enter' && current.focused) {
          event.preventDefault();
          if (project.files.has(current.focused)) openFileInEditor(current.focused);
          else controller.toggleDirectory(current.focused);
        } else if (event.key === 'F2') {
          event.preventDefault();
          event.stopPropagation();
          controller.renameFocused();
        } else if (event.key === 'Delete' || event.key === 'Backspace') {
          event.preventDefault();
          actions.remove();
        } else if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
          event.preventDefault();
          controller.contextMenu(event);
        } else if (event.key === 'Escape') {
          selection.clear(project);
          controller.refresh();
        } else if (event.key.length === 1 && !command) {
          const match = findByPrefix(project, current, key);
          if (match) {
            event.preventDefault();
            controller.focusPath(match);
          }
        }
    });
})();
