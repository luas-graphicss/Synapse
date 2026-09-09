(function () {
    'use strict';

    const maximumHighlightedCharacters = 250000;
    const maximumHighlightedLines = 7000;
    let pendingPaint = null;
    let paintScheduled = false;

    function isLargeDocument(text) {
      const characterLimit =
      Number.isFinite(window.__PERF_BIG_CHARS) && window.__PERF_BIG_CHARS > 0
      ? window.__PERF_BIG_CHARS
      : maximumHighlightedCharacters;
      const lineLimit =
      Number.isFinite(window.__PERF_BIG_LINES) && window.__PERF_BIG_LINES > 0
      ? window.__PERF_BIG_LINES
      : maximumHighlightedLines;
      if (text.length > characterLimit) return true;
      let lineCount = 1;
      for (let index = text.indexOf('\n'); index >= 0; index = text.indexOf('\n', index + 1)) {
        lineCount += 1;
        if (lineCount > lineLimit) return true;
      }
      return false;
    }

    function synchronizeTextScroll() {
      const { scrollLeft, scrollTop } = el.codeTa;
      el.codeHl.style.transform =
      scrollLeft || scrollTop ? `translate(${-scrollLeft}px, ${-scrollTop}px)` : '';
    }

    function paintEditorNow(path, text) {
      const project = activeProject();
      const file = project && project.files.get(path);
      if (!file || project.openFile !== path || typeof file.text !== 'string' || file.text !== text) {
        return;
      }
      const largeDocument = isLargeDocument(text);
      const projection = window.EditorFolding.prepare(path, text, largeDocument);
      if (!projection) return;
      const specificLanguage = window.SynapseEditorLanguages?.fromPath(path);
      const language =
      specificLanguage && specificLanguage !== 'text' ? specificLanguage : Core.langOf(path);
      if (largeDocument) el.codeHl.textContent = `${projection.text}\n`;
      else el.codeHl.innerHTML = `${highlight(projection.text, language)}\n`;
      el.codeTa.style.height = 'auto';
      el.codeTa.style.height = `${el.codeHl.scrollHeight}px`;
      window.EditorFolding.apply(projection);
      synchronizeTextScroll();
      window.drawMinimap(projection.text, language);
      window.dispatchEvent(new CustomEvent('synapse:editor-painted'));
    }

    function paintEditor(path, text) {
      const project = activeProject();
      pendingPaint = { project, file: project && project.files.get(path), path, text };
      if (paintScheduled) return;
      paintScheduled = true;
      const flush = () => {
        paintScheduled = false;
        const request = pendingPaint;
        pendingPaint = null;
        if (!request || !request.file || request.project !== activeProject()) return;
        if (request.project.files.get(request.path) !== request.file) return;
        paintEditorNow(request.path, request.file.text);
      };
      if (document.hidden) setTimeout(flush, 0);
      else requestAnimationFrame(flush);
    }

    function commitInput() {
      if (el.codeTa.readOnly || !window.EditorFolding.recoverInput()) return;
      const project = activeProject();
      if (!project || !project.openFile) return;
      const file = project.files.get(project.openFile);
      if (!file || typeof file.text !== 'string') return;
      window.SynapseEditorDocuments?.recordInput(project, file, el.codeTa.value);
      window.SynapseDebugger?.beforeSourceEdit(project, project.openFile, file.text, el.codeTa.value);
      file.text = el.codeTa.value;
      file.data = null;
      const alreadyDirty = project.dirty.has(project.openFile);
      project.dirty.add(project.openFile);
      el.editorDirty.classList.add('on');
      if (!alreadyDirty) renderEditorTabs();
      paintEditor(project.openFile, file.text);
      scheduleBuild(project);
      scheduleSnapshot(project, project.openFile);
      saveSession();
    }

    el.codeTa.addEventListener('scroll', synchronizeTextScroll, { passive: true });
    el.codeTa.addEventListener('input', commitInput);
    el.codeTa.addEventListener('keydown', (event) => {
        if (window.SynapseEditorDocuments) return;
        if (
          event.defaultPrevented ||
          event.key !== 'Tab' ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey ||
          event.isComposing
        ) {
          return;
        }
        if (el.codeTa.readOnly) return;
        event.preventDefault();
        window.EditorFolding.expandBeforeInput();
        el.codeTa.setRangeText('  ', el.codeTa.selectionStart, el.codeTa.selectionEnd, 'end');
        el.codeTa.dispatchEvent(new Event('input', { bubbles: true }));
    });

    window.__isBigDoc = isLargeDocument;
    window.paintEditor = paintEditor;
    window.paintEditorNow = paintEditorNow;
})();
