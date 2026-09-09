(function (root) {
    'use strict';

    const DEFAULT_FILES_PER_CHUNK = 20;
    const HISTORY_LIMIT = 40;

    let running = false;
    let canceled = false;

    function reportIgnoredError(error, context) {
      if (typeof root.ignorarErro === 'function') root.ignorarErro(error, context);
    }

    function chunkSizeFor(total) {
      if (total > 4000) return 8;
      if (total > 1000) return 12;
      return DEFAULT_FILES_PER_CHUNK;
    }

    function newSummary(skippedCount) {
      return {
        changedCount: 0,
        unchangedCount: 0,
        failedCount: 0,
        skippedCount: skippedCount,
        openFileChanged: false,
      };
    }

    function rememberPreviousText(file) {
      if (!file.history) file.history = [];
      const lastEntry = file.history[file.history.length - 1];
      if (!lastEntry || lastEntry.text !== file.text) {
        file.history.push({ t: Date.now(), text: file.text });
      }
      if (file.history.length > HISTORY_LIMIT) {
        file.history.splice(0, file.history.length - HISTORY_LIMIT);
      }
    }

    function formatOneFile(project, path, summary) {
      const file = project.files.get(path);
      if (!file || file.isText !== true || typeof file.text !== 'string') {
        summary.skippedCount++;
        return;
      }
      let formatted;
      try {
        formatted = formatCode(file.text, Core.extname(path));
      } catch (error) {
        reportIgnoredError(error, 'projectFormatRunner.format:' + path);
        summary.failedCount++;
        return;
      }
      if (formatted === file.text) {
        summary.unchangedCount++;
        return;
      }
      rememberPreviousText(file);
      file.text = formatted;
      file.data = null;
      project.dirty.add(path);
      summary.changedCount++;
      if (path === project.openFile) summary.openFileChanged = true;
    }

    function refreshOpenFile(project) {
      const file = project.files.get(project.openFile);
      if (!file || typeof file.text !== 'string') return;
      clearFolds();
      el.codeTa.value = file.text;
      paintEditor(project.openFile, file.text);
      el.editorDirty.classList.add('on');
    }

    function applyProjectChanges(project, summary) {
      if (summary.openFileChanged) refreshOpenFile(project);
      renderEditorTabs();
      renderTree();
      scheduleBuild(project);
      saveSession();
    }

    function describe(summary) {
      const parts = [summary.changedCount + ' formatado(s)'];
      if (summary.unchangedCount) parts.push(summary.unchangedCount + ' sem mudanca');
      if (summary.failedCount) parts.push(summary.failedCount + ' com erro');
      if (summary.skippedCount) parts.push(summary.skippedCount + ' ignorado(s)');
      return parts.join(' · ');
    }

    function announce(summary) {
      if (canceled) {
        toast('Formatacao cancelada', describe(summary), 'warn');
        return;
      }
      if (summary.changedCount) {
        toast('Projeto formatado', describe(summary), 'ok');
        return;
      }
      toast('Ja esta formatado', describe(summary), 'ok');
    }

    function cancel() {
      canceled = true;
    }

    function isRunning() {
      return running;
    }

    async function run() {
      if (running) {
        toast('Formatacao em andamento', 'Aguarde o fim da formatacao atual', '');
        return;
      }
      const project = activeProject();
      if (!project) {
        toast('Nada para formatar', 'Abra um projeto primeiro', '');
        return;
      }
      const candidates = root.SynapseProjectFormatCandidates.collect(project);
      if (!candidates.selected.length) {
        toast('Nada para formatar', 'Nenhum arquivo de codigo compativel no projeto', '');
        return;
      }
      const progress = root.SynapseProjectFormatProgress;
      const summary = newSummary(candidates.skipped.length);
      running = true;
      canceled = false;
      progress.onCancel(cancel);
      progress.show(candidates.selected.length);
      try {
        await root.SynapseChunkedWork.forEachInChunks(
          candidates.selected,
          (path) => {
            if (canceled) return;
            formatOneFile(project, path, summary);
          },
          {
            chunkSize: chunkSizeFor(candidates.selected.length),
            onProgress: (processed, total) => {
              if (activeProject() !== project) canceled = true;
              progress.update(processed, total);
            },
          },
        );
      } catch (error) {
        reportIgnoredError(error, 'projectFormatRunner.run');
      } finally {
        progress.hide();
        running = false;
      }
      if (summary.changedCount) applyProjectChanges(project, summary);
      announce(summary);
    }

    root.SynapseProjectFormatRunner = Object.freeze({
        run: run,
        cancel: cancel,
        isRunning: isRunning,
    });
})(typeof globalThis !== 'undefined' ? globalThis : window);
