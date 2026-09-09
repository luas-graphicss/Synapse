(function () {
    'use strict';

    const tree = document.getElementById('tree');
    const controller = window.SynapseExplorer;
    const selection = window.SynapseExplorerSelection;
    const actions = window.SynapseExplorerActions;

    function open(event) {
      if (event.target.closest('.ex-inline')) return;
      const project = activeProject();
      if (!project) return;
      event.preventDefault();
      const keyboard = event.type === 'keydown';
      const row = keyboard
      ? tree.querySelector('.explorer-focused')
      : event.target.closest('.row[data-file],.row[data-dir]');
      if (row) {
        const path = controller.rowPath(row);
        controller.focusPath(path, { focusOnly: selection.state(project).selected.has(path) });
      } else {
        selection.clear(project);
        selection.state(project).focused = null;
      }
      const paths = actions.selectedPaths(project);
      const directory = row ? controller.contextDirectory() : '';
      function action(run) {
        return () => {
          if (project !== activeProject()) return;
          selection.replace(project, paths);
          run();
        };
      }
      const items = [
        { label: paths.length > 1 ? paths.length + ' itens selecionados' : paths[0] || project.name },
      ];
      if (paths.length === 1) {
        items.push({
            icon: 'eye',
            text: 'Abrir',
            run: action(() =>
              project.files.has(paths[0])
              ? openFileInEditor(paths[0])
              : controller.toggleDirectory(paths[0], true),
            ),
        });
        items.push({ icon: 'edit', text: 'Renomear · F2', run: action(controller.renameFocused) });
      }
      if (paths.length) {
        items.push({ icon: 'copy', text: 'Copiar · Ctrl/Cmd+C', run: action(() => actions.copy()) });
        items.push({
            icon: 'cut',
            text: 'Recortar · Ctrl/Cmd+X',
            run: action(() => actions.copy(true)),
        });
        items.push({ icon: 'copy', text: 'Duplicar', run: action(actions.duplicate) });
      }
      if (actions.canPaste())
      items.push({
          icon: 'paste',
          text: 'Colar aqui · Ctrl/Cmd+V',
          run: action(() => actions.paste(directory)),
      });
      items.push({ sep: true });
      items.push({
          icon: 'newfile',
          text: 'Novo arquivo aqui',
          run: action(() => window.ctxNewFile(directory)),
      });
      items.push({
          icon: 'newdir',
          text: 'Nova pasta aqui',
          run: action(() => window.ctxNewFolder(directory)),
      });
      if (actions.canUndo(project))
      items.push({
          icon: 'undo',
          text: 'Desfazer exclusão · Ctrl/Cmd+Z',
          run: action(actions.undoDelete),
      });
      if (paths.length)
      items.push(
        { sep: true },
        {
          icon: 'trash',
          text: 'Excluir seleção · Delete',
          danger: true,
          run: action(actions.remove),
        },
      );
      const bounds = row?.getBoundingClientRect() || tree.getBoundingClientRect();
      showCtxMenu(event.clientX || bounds.left + 12, event.clientY || bounds.top + 12, items);
      const menu = document.querySelector('.ctxmenu');
      if (!menu) return;
      menu.setAttribute('role', 'menu');
      const buttons = [...menu.querySelectorAll('button')];
      buttons.forEach((button) => button.setAttribute('role', 'menuitem'));
      buttons[0]?.focus();
      menu.addEventListener('keydown', (keyEvent) => {
          const index = buttons.indexOf(document.activeElement);
          const offset = keyEvent.key === 'ArrowUp' ? -1 : 1;
          if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(keyEvent.key)) {
            keyEvent.preventDefault();
            buttons[
              keyEvent.key === 'Home'
              ? 0
              : keyEvent.key === 'End'
              ? buttons.length - 1
              : (index + offset + buttons.length) % buttons.length
            ]?.focus();
          } else if (keyEvent.key === 'Escape') {
            keyEvent.preventDefault();
            hideCtxMenu();
            tree.focus();
          }
      });
      menu.addEventListener('click', () => {
          if (document.activeElement === document.body) tree.focus();
      });
    }

    window.SynapseExplorerMenu = Object.freeze({ open });
})();
