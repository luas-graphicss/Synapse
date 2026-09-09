'use strict';
let __folds = new Set();

(function () {
    const fileStates = new WeakMap();
    let currentFile = null;
    let currentPath = '';
    let currentState = null;
    let currentProjection = null;
    let pendingView = null;
    let gutterMarkup = '';

    function normalize(text) {
      return String(text || '').replace(/\r\n?/g, '\n');
    }

    function activeTextFile() {
      const project = activeProject();
      const file = project && project.files.get(project.openFile);
      return file && typeof file.text === 'string' ? { project, file } : null;
    }

    function captureView() {
      const textarea = el.codeTa;
      const projection = currentProjection;
      const projected = projection && textarea.value === projection.text;
      const selection = projected
      ? projection.toSourceRange(textarea.selectionStart, textarea.selectionEnd)
      : { start: textarea.selectionStart, end: textarea.selectionEnd };
      const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 20;
      const topLine = Math.max(0, Math.floor(el.editorScroll.scrollTop / lineHeight));
      return {
        start: selection.start,
        end: selection.end,
        direction: textarea.selectionDirection,
        topLine: projected
        ? projection.visibleLines[Math.min(topLine, projection.visibleLines.length - 1)]
        : topLine,
        topRemainder: el.editorScroll.scrollTop % lineHeight,
        left: el.editorScroll.scrollLeft,
        lineHeight,
      };
    }

    function activate(file, path) {
      if (file === currentFile && path === currentPath) return;
      if (currentState && currentProjection) currentState.view = captureView();
      currentFile = file;
      currentPath = path;
      currentProjection = null;
      currentState = fileStates.get(file);
      if (!currentState) {
        currentState = {
          source: normalize(file.text),
          regions: null,
          folds: new Set(),
          view: {
            start: 0,
            end: 0,
            direction: 'none',
            topLine: 0,
            topRemainder: 0,
            left: 0,
            lineHeight: 20,
          },
        };
        fileStates.set(file, currentState);
      }
      __folds = currentState.folds;
      pendingView = currentState.view;
    }

    function deactivate() {
      if (currentState && currentProjection) currentState.view = captureView();
      currentFile = null;
      currentState = null;
      currentProjection = null;
      pendingView = null;
      __folds = new Set();
      updateButton(null, false);
    }

    function prepare(path, text, largeDocument) {
      const active = activeTextFile();
      if (!active || active.project.openFile !== path) return null;
      activate(active.file, path);
      const source = normalize(text);
      if (!pendingView) pendingView = captureView();
      if (currentState.source !== source) {
        currentState.source = source;
        currentState.regions = null;
        __folds.clear();
      }
      if (largeDocument) __folds.clear();
      if (
        !currentState.regions ||
        currentState.largeDocument !== largeDocument ||
        currentState.path !== path
      ) {
        currentState.regions = largeDocument
        ? new Map()
        : window.EditorFoldRegions.compute(source, path);
        currentState.largeDocument = largeDocument;
        currentState.path = path;
      }
      for (const line of __folds) if (!currentState.regions.has(line)) __folds.delete(line);
      const projection = window.EditorFoldProjection.create(source, currentState.regions, __folds);
      projection.view = pendingView;
      pendingView = null;
      updateButton(projection, largeDocument);
      return projection;
    }

    function updateButton(projection, largeDocument) {
      if (!el.foldBtn) return;
      const hasFolds = Boolean(projection && projection.collapsedLines.size);
      el.foldBtn.disabled = !projection || !projection.regions.size;
      el.foldBtn.classList.toggle('on', hasFolds);
      el.foldBtn.setAttribute('aria-pressed', String(hasFolds));
      el.foldBtn.setAttribute(
        'aria-label',
        hasFolds ? 'Expandir todos os blocos' : 'Recolher todos os blocos',
      );
      el.foldBtn.title = largeDocument
      ? 'Dobras desativadas em arquivos grandes'
      : hasFolds
      ? 'Expandir todos os blocos'
      : 'Recolher todos os blocos';
    }

    function renderGutter(projection) {
      const focused = document.activeElement && document.activeElement.closest('[data-fold]');
      const focusedLine = focused && focused.dataset.fold;
      const markup = projection.visibleLines
      .map((line) => {
          const foldable = projection.regions.has(line);
          const folded = foldable && projection.collapsedLines.has(line);
          const hiddenCount = folded ? projection.regions.get(line) - line : 0;
          const label = `${folded ? 'Expandir' : 'Recolher'} bloco na linha ${line + 1}`;
          const control = foldable
          ? `<button type="button" class="foldctl" data-fold="${line}" aria-expanded="${!folded}" aria-controls="codeTa" aria-label="${label}" title="${label}"><svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false"><path fill="currentColor" d="${folded ? 'M4 2l5 4-5 4z' : 'M2 4l4 5 4-5z'}"></path></svg></button>`
          : '<span class="fold-spacer" aria-hidden="true"></span>';
          return `<div class="gln${folded ? ' folded' : ''}">${control}<span class="gnum">${line + 1}</span><span class="foldn${folded ? '' : ' fold-empty'}" aria-hidden="true">${hiddenCount || ''}</span></div>`;
      })
      .join('');
      if (markup === gutterMarkup && el.gutter.innerHTML) return;
      gutterMarkup = markup;
      el.gutter.innerHTML = markup;
      if (focusedLine != null) {
        const replacement = el.gutter.querySelector(`[data-fold="${focusedLine}"]`);
        if (replacement) replacement.focus({ preventScroll: true });
      }
    }

    function apply(projection) {
      const textarea = el.codeTa;
      if (textarea.value !== projection.text) textarea.value = projection.text;
      textarea.readOnly = false;
      textarea.classList.toggle('folded', projection.collapsedLines.size > 0);
      const selectionStart = projection.toDisplayOffset(projection.view.start);
      const selectionEnd = projection.toDisplayOffset(projection.view.end);
      if (
        textarea.selectionStart !== selectionStart ||
        textarea.selectionEnd !== selectionEnd ||
        textarea.selectionDirection !== projection.view.direction
      ) {
        textarea.setSelectionRange(selectionStart, selectionEnd, projection.view.direction);
      }
      renderGutter(projection);
      let visibleTop = 0;
      while (
        visibleTop + 1 < projection.visibleLines.length &&
        projection.visibleLines[visibleTop + 1] <= projection.view.topLine
      ) {
        visibleTop += 1;
      }
      el.editorScroll.scrollTop =
      visibleTop * projection.view.lineHeight + projection.view.topRemainder;
      el.editorScroll.scrollLeft = projection.view.left;
      currentProjection = projection;
    }

    function ensureCurrent() {
      const active = activeTextFile();
      if (!active) return null;
      if (
        currentFile !== active.file ||
        !currentProjection ||
        currentProjection.source !== normalize(active.file.text)
      ) {
        window.paintEditorNow(active.project.openFile, active.file.text);
      }
      return active;
    }

    function repaint(active) {
      window.paintEditorNow(active.project.openFile, active.file.text);
    }

    function clearFolds() {
      const active = activeTextFile();
      if (!active) {
        deactivate();
        return;
      }
      if (currentFile !== active.file) activate(active.file, active.project.openFile);
      if (!pendingView) pendingView = captureView();
      __folds.clear();
      repaint(active);
    }

    function toggleFold(line) {
      const active = ensureCurrent();
      if (!active || !Number.isInteger(line) || !currentProjection.regions.has(line)) return false;
      pendingView = captureView();
      if (__folds.has(line)) __folds.delete(line);
      else __folds.add(line);
      repaint(active);
      return true;
    }

    function foldAll() {
      const active = ensureCurrent();
      if (!active || !currentProjection.regions.size) return;
      pendingView = captureView();
      if (__folds.size) __folds.clear();
      else for (const line of currentProjection.regions.keys()) __folds.add(line);
      repaint(active);
    }

    function expandBeforeInput() {
      const active = ensureCurrent();
      if (active && __folds.size) clearFolds();
    }

    function copyFoldedSelection(event) {
      if (event.defaultPrevented || !ensureCurrent() || !__folds.size) return;
      const textarea = el.codeTa;
      if (textarea.selectionStart === textarea.selectionEnd) return;
      if (!event.clipboardData) {
        expandBeforeInput();
        return;
      }
      const selection = currentProjection.toSourceRange(
        textarea.selectionStart,
        textarea.selectionEnd,
      );
      event.clipboardData.setData(
        'text/plain',
        currentProjection.source.slice(selection.start, selection.end),
      );
      event.preventDefault();
    }

    function recoverInput() {
      const active = activeTextFile();
      if (!active || !currentProjection) return false;
      if (currentFile !== active.file || currentProjection.source !== normalize(active.file.text)) {
        clearFolds();
        toast('Arquivo atualizado', 'O conteúdo mudou fora do editor. Repita a edição.', 'warn');
        return false;
      }
      if (!__folds.size) return true;
      const recovered = window.EditorFoldProjection.recoverInput(currentProjection, el.codeTa.value);
      clearFolds();
      if (!recovered) {
        toast('Blocos expandidos', 'Repita a edição com o código completo visível.', 'warn');
        return false;
      }
      el.codeTa.value = recovered.text;
      el.codeTa.setSelectionRange(recovered.caret, recovered.caret);
      return true;
    }

    function handleShortcut(event) {
      if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.altKey || event.isComposing) {
        return;
      }
      if (event.code !== 'BracketLeft' && event.code !== 'BracketRight') return;
      const active = ensureCurrent();
      if (!active) return;
      event.preventDefault();
      const offset = currentProjection.toSourceOffset(el.codeTa.selectionStart);
      const line = currentProjection.source.slice(0, offset).split('\n').length - 1;
      let candidate = -1;
      for (const [start, end] of currentProjection.regions) {
        const eligible = event.code === 'BracketLeft' ? !__folds.has(start) : __folds.has(start);
        if (eligible && start <= line && end >= line && start > candidate) candidate = start;
      }
      if (candidate >= 0) toggleFold(candidate);
    }

    el.gutter.addEventListener('click', (event) => {
        const control = event.target.closest('[data-fold]');
        if (!control) return;
        event.preventDefault();
        toggleFold(Number(control.dataset.fold));
    });
    el.codeTa.addEventListener('copy', copyFoldedSelection);
    el.codeTa.addEventListener('cut', expandBeforeInput, true);
    el.codeTa.addEventListener('beforeinput', expandBeforeInput, true);
    el.codeTa.addEventListener(
      'keydown',
      (event) => {
        const modifier = event.ctrlKey || event.metaKey;
        const editingKey =
        !modifier &&
        !event.altKey &&
        (event.key.length === 1 || ['Tab', 'Enter', 'Backspace', 'Delete'].includes(event.key));
        const historyKey = modifier && !event.altKey && ['z', 'y'].includes(event.key.toLowerCase());
        if (editingKey || historyKey) expandBeforeInput();
      },
      true,
    );
    el.codeTa.addEventListener('compositionstart', expandBeforeInput);
    el.codeTa.addEventListener('keydown', handleShortcut);
    el.foldBtn.addEventListener('click', foldAll);
    el.foldBtn.setAttribute('aria-controls', 'codeTa');
    el.codeTa.setAttribute('aria-label', 'Editor de código');
    el.codeTa.title = 'Ao editar, os blocos recolhidos são expandidos para preservar o código.';
    updateButton(null, false);

    window.clearFolds = clearFolds;
    window.toggleFold = toggleFold;
    window.foldAll = foldAll;
    window.computeFoldRegions = (text, language) => window.EditorFoldRegions.compute(text, language);
    window.EditorFolding = Object.freeze({
        activate,
        deactivate,
        prepare,
        apply,
        expandBeforeInput,
        recoverInput,
        displayText: () => (currentProjection ? currentProjection.text : ''),
    });
})();
