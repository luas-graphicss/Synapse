(function () {
    'use strict';

    let clipboard = null;
    const deletedBatches = new WeakMap();
    const pendingDeletions = new WeakSet();
    const files = window.SynapseExplorerFiles;
    const selection = window.SynapseExplorerSelection;

    function selectedPaths(project = activeProject()) {
      return project ? [...selection.state(project).selected] : [];
    }

    function ensureWritable(project, paths) {
      if (typeof tmBloqueioEscrita !== 'function') return;
      for (const path of paths) {
        if (tmBloqueioEscrita(path, '', project.id)) {
          throw new Error(
            'O arquivo "' + path + '" está em uso. Tente novamente quando for liberado.',
          );
        }
      }
    }

    function finish(project, paths) {
      selection.replace(project, paths);
      if (project === activeProject()) {
        if (!project.openFile) editorToEmpty();
        fsChanged(project, project.openFile);
        window.SynapseExplorer?.refresh();
      }
      if (typeof devAutoSync === 'function') devAutoSync(project);
    }

    function safely(action) {
      try {
        return action();
      } catch (error) {
        toast('Operação não concluída', error.message, 'err');
        return false;
      }
    }

    function copy(cut = false) {
      const project = activeProject();
      const paths = selectedPaths(project);
      if (!project || !paths.length) return;
      clipboard = {
        project,
        paths: files.roots(project, paths),
        cut,
        content: cut ? null : files.capture(project, paths),
      };
      window.SynapseExplorer?.refresh();
      toast(
        cut ? 'Itens recortados' : 'Itens copiados',
        paths.length + ' item(ns). Escolha a pasta e cole.',
        'ok',
      );
    }

    function transferTo(project, source, destination, move, duplicate = false) {
      return safely(() => {
          const plan = files.planTransfer(project, source, destination, move, duplicate);
          if (!plan.mapping.size) return false;
          ensureWritable(project, [
              ...(move ? source.files.keys() : []),
              ...[...source.files.keys()].map(plan.remap),
          ]);
          makeSnapshot(project, move ? 'Explorer: before move' : 'Explorer: before copy');
          const paths = files.transfer(project, source, plan, move);
          if (move) {
            const expanded = [...openDirs].map(plan.remap);
            openDirs.clear();
            expanded.forEach((path) => openDirs.add(path));
          }
          for (const path of paths) {
            let directory = files.directoryOf(path);
            while (directory) {
              openDirs.add(directory);
              directory = files.directoryOf(directory);
            }
          }
          finish(project, paths);
          return true;
      });
    }

    function paste(destination) {
      const project = activeProject();
      if (!project || !clipboard) return;
      if (clipboard.cut && clipboard.project !== project) {
        toast('Recorte em outro projeto', 'Use copiar para transferir itens entre projetos.', 'warn');
        return;
      }
      const source = clipboard.cut ? files.capture(project, clipboard.paths) : clipboard.content;
      if (clipboard.cut && source.roots.length !== clipboard.paths.length) {
        toast(
          'Recorte desatualizado',
          'Um dos itens não existe mais. Selecione os itens novamente.',
          'warn',
        );
        return;
      }
      if (transferTo(project, source, destination, clipboard.cut) && clipboard.cut) clipboard = null;
      window.SynapseExplorer?.refresh();
    }

    function duplicate() {
      const project = activeProject();
      if (!project) return;
      transferTo(project, files.capture(project, selectedPaths(project)), '', false, true);
    }

    function move(paths, destination, projectId) {
      const project = activeProject();
      if (!project || project.id !== projectId) return;
      const source = files.capture(project, paths);
      if (source.roots.length !== paths.length) {
        toast('Seleção desatualizada', 'Os itens mudaram. Selecione-os novamente.', 'warn');
        return;
      }
      transferTo(project, source, destination, true);
    }

    async function remove() {
      const project = activeProject();
      if (!project) return;
      const paths = files.roots(project, selectedPaths(project));
      if (!paths.length) return;
      if (pendingDeletions.has(project)) return;
      pendingDeletions.add(project);
      const initial = files.capture(project, paths);
      const summary = paths.slice(0, 5).join('\n') + (paths.length > 5 ? '\n…' : '');
      let confirmed;
      try {
        confirmed = await uiConfirm(
          'Excluir ' + paths.length + ' item(ns)?',
          summary +
          '\n\nPastas incluem todo o conteúdo. Uma cópia de recuperação será mantida nesta sessão.',
          'Excluir',
          true,
        );
      } finally {
        pendingDeletions.delete(project);
      }
      if (activeProject() === project && document.activeElement === document.body)
      document.getElementById('tree')?.focus({ preventScroll: true });
      if (!confirmed || activeProject() !== project) return;
      safely(() => {
          const current = files.capture(project, paths);
          const changed =
          current.files.size !== initial.files.size ||
          [...initial.files].some(([path, file]) => {
              const actual = current.files.get(path);
              return (
                !actual ||
                actual.text !== file.text ||
                actual.data?.length !== file.data?.length ||
                (file.data && file.data.some((byte, index) => byte !== actual.data[index]))
              );
          }) ||
          [...current.emptyDirs].join('\n') !== [...initial.emptyDirs].join('\n');
          if (changed)
          throw new Error(
            'Os itens mudaram durante a confirmação. Nada foi excluído; confira a seleção e tente novamente.',
          );
          ensureWritable(project, current.files.keys());
          makeSnapshot(project, 'Explorer: before delete');
          deletedBatches.set(project, {
              ...current,
              entry: project.entry,
              detectedEntry: project.detect?.entry,
          });
          files.remove(project, paths);
          for (const path of [...openDirs])
          if (paths.some((root) => files.contains(root, path))) openDirs.delete(path);
          finish(project, []);
          toast(
            'Itens excluídos',
            'Ctrl/Cmd+Z no explorer recupera este lote, inclusive arquivos binários.',
            'ok',
          );
      });
    }

    function undoDelete() {
      const project = activeProject();
      const batch = project && deletedBatches.get(project);
      if (!batch) return;
      safely(() => {
          const available = new Set([...project.files.keys(), ...files.directories(project)]);
          for (const root of batch.roots) {
            if (available.has(root) || [...project.files.keys()].some((path) => root.startsWith(path + '/')))
            throw new Error('Já existe um item em "' + root + '". Nada foi sobrescrito.');
          }
          ensureWritable(project, batch.files.keys());
          for (const [path, file] of batch.files) {
            project.files.set(path, file);
            project.dirty.add(path);
          }
          project.emptyDirs ||= new Set();
          for (const path of batch.emptyDirs) project.emptyDirs.add(path);
          if (!project.entry && batch.entry && project.files.has(batch.entry))
          project.entry = batch.entry;
          if (project.detect && !project.detect.entry && project.files.has(batch.detectedEntry))
          project.detect.entry = batch.detectedEntry;
          deletedBatches.delete(project);
          for (const path of batch.roots) {
            let directory = files.directoryOf(path);
            while (directory) {
              openDirs.add(directory);
              directory = files.directoryOf(directory);
            }
          }
          finish(project, batch.roots);
      });
    }

    window.SynapseExplorerActions = Object.freeze({
        selectedPaths,
        copy,
        paste,
        duplicate,
        move,
        remove,
        undoDelete,
        canPaste: () => !!clipboard,
        canUndo: (project) => deletedBatches.has(project),
        isCut: (project, path) =>
        clipboard?.cut &&
        clipboard.project === project &&
        clipboard.paths.some((root) => files.contains(root, path)),
    });
})();
