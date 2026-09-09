(function () {
    'use strict';

    const state = { caseSensitive: false, regex: false, wholeWord: false, scope: 'project', scopePath: null, result: null, selected: 0, version: 0, job: null, timer: null, wired: false, replacing: false, returnFocus: null };
    let controls;
    let resultSnapshot = null;

    function isOpen() {
      return !el.frBack.classList.contains('hidden');
    }

    function cancelSearch() {
      state.version++;
      clearTimeout(state.timer);
      state.job?.cancel();
      state.job = null;
    }

    function queryOptions() {
      return { query: el.frFind.value, caseSensitive: state.caseSensitive, regex: state.regex, wholeWord: state.wholeWord };
    }

    function collectSources(project) {
      return [...project.files].filter(([path, entry]) => entry.isText && typeof entry.text === 'string' && (state.scope === 'project' || path === state.scopePath)).sort(([first], [second]) => first.localeCompare(second)).map(([path, entry]) => ({ path, text: entry.text, entry }));
    }

    function sourcesUnchanged(project, sources) {
      if (activeProject() !== project) return false;
      return sources.every((source) => project.files.get(source.path) === source.entry && source.entry.text === source.text);
    }

    function resultsAreCurrent() {
      const snapshot = resultSnapshot;
      if (snapshot && sourcesUnchanged(snapshot.project, snapshot.sources) && snapshot.project.files.size === snapshot.fileCount && snapshot.query === JSON.stringify(queryOptions())) return true;
      if (isOpen()) renderFindReplace();
      return false;
    }

    function setButtonStates(busy = false) {
      const available = !!state.result?.items.length && !busy && !state.replacing;
      [controls.previous, controls.next, controls.replaceOne, el.frReplaceAll].forEach((button) => { button.disabled = !available; });
      [el.frFind, el.frRepl, el.frCase, el.frRegex, controls.wholeWord, controls.scope].forEach((control) => { control.disabled = state.replacing; });
      el.frBack.setAttribute('aria-busy', String(busy || state.replacing));
    }

    function showMessage(message, invalid = false) {
      el.frCount.textContent = message;
      el.frFind.setAttribute('aria-invalid', String(invalid));
      el.frList.innerHTML = '<div class="cmdk-empty">' + esc(message) + '</div>';
    }

    function renderSelection() {
      const result = state.result;
      if (!result) return;
      const position = result.items.length ? state.selected + 1 : 0;
      el.frCount.textContent = position + ' / ' + result.total + ' ocorrências · ' + result.fileCount + ' arquivo(s)' + (result.truncated ? ' · mostrando as primeiras ' + result.items.length : '');
      el.frList.querySelectorAll('[data-match-index]').forEach((button, index) => {
          button.classList.toggle('selected', index === state.selected);
          button.setAttribute('aria-current', index === state.selected ? 'true' : 'false');
      });
    }

    function renderResults(result, followUp) {
      state.result = result;
      const anchor = followUp?.anchor;
      state.selected = anchor
      ? Math.max(0, result.items.findIndex((item) => item.path === anchor.path ? item.index >= anchor.index : item.path.localeCompare(anchor.path) > 0))
      : Math.min(state.selected, Math.max(0, result.items.length - 1));
      el.frFind.setAttribute('aria-invalid', 'false');
      el.frList.innerHTML = result.items.length ? result.items.map((item, index) => '<button type="button" class="fr-file fr-match" data-match-index="' + index + '" aria-label="' + esc(item.path + ', linha ' + item.line + ', coluna ' + item.column) + '"><span class="ff-name">' + esc(item.path) + '<span class="fr-location">:' + item.line + ':' + item.column + '</span></span><span class="fr-snippet">' + esc(item.preview) + '</span></button>').join('') : '<div class="cmdk-empty">Nenhuma ocorrência</div>';
      renderSelection();
      setButtonStates();
      if (anchor && result.items.length) {
        el.frList.querySelector('[data-match-index="' + state.selected + '"]')?.scrollIntoView({ block: 'nearest' });
        revealMatch(result.items[state.selected]);
      }
      if (followUp?.focus?.isConnected && document.activeElement === document.body) {
        const target = followUp.focus.disabled ? el.frRepl : followUp.focus;
        target.focus({ preventScroll: true });
      }
    }

    async function performSearch(version, followUp) {
      if (!isOpen() || version !== state.version) return;
      const project = activeProject();
      if (!project || !el.frFind.value) {
        showMessage(project ? 'Digite algo para buscar' : 'Importe um projeto primeiro');
        setButtonStates();
        return;
      }
      const sources = collectSources(project);
      const fileCount = project.files.size;
      const options = queryOptions();
      const job = window.SynapseSearchService.run({ ...options, files: sources.map(({ path, text }) => ({ path, text })) });
      state.job = job;
      try {
        const result = await job.promise;
        if (version !== state.version || !isOpen()) return;
        if (!sourcesUnchanged(project, sources) || project.files.size !== fileCount) { renderFindReplace(); return; }
        resultSnapshot = { project, sources, fileCount, query: JSON.stringify(options) };
        renderResults(result, followUp);
      } catch (error) {
        if (version !== state.version || error.name === 'AbortError') return;
        state.result = null;
        showMessage(error.message, true);
        setButtonStates();
      } finally {
        if (state.job === job) state.job = null;
      }
    }

    function renderFindReplace(debounce = false, followUp = null) {
      if (!state.wired) wireFindReplace();
      cancelSearch();
      state.result = null;
      resultSnapshot = null;
      state.selected = 0;
      setButtonStates(true);
      showMessage(el.frFind.value ? 'Buscando…' : 'Digite algo para buscar');
      const version = state.version;
      if (debounce) state.timer = setTimeout(() => performSearch(version, followUp), 160);
      else void performSearch(version, followUp);
    }

    function openFindReplace(open, options = {}) {
      if (!state.wired) wireFindReplace();
      if (open) {
        if (!isOpen()) state.returnFocus = document.activeElement;
        state.scope = options.scope || 'project';
        state.scopePath = activeProject()?.openFile || null;
        controls.scope.value = state.scope;
        if (document.activeElement === el.codeTa && !el.codeTa.readOnly) {
          const selection = el.codeTa.value.slice(el.codeTa.selectionStart, el.codeTa.selectionEnd);
          if (selection && selection.length <= 200 && !selection.includes('\n')) {
            el.frFind.value = selection;
            state.regex = false;
          }
        }
        el.frBack.classList.remove('hidden');
        State.paletteOpen = true;
        updateOptions();
        renderFindReplace();
        (options.replace ? el.frRepl : el.frFind).focus();
      } else {
        cancelSearch();
        state.replacing = false;
        el.frBack.classList.add('hidden');
        State.paletteOpen = false;
        setButtonStates();
        if (state.returnFocus?.isConnected) state.returnFocus.focus({ preventScroll: true });
      }
    }

    function updateOptions() {
      [[el.frCase, state.caseSensitive], [el.frRegex, state.regex], [controls.wholeWord, state.wholeWord]].forEach(([button, pressed]) => {
          button.classList.toggle('on', pressed);
          button.setAttribute('aria-pressed', String(pressed));
      });
      el.frFind.placeholder = state.scope === 'file' ? 'Buscar no arquivo atual…' : 'Buscar em todos os arquivos…';
    }

    function revealMatch(item, focusEditor = false) {
      if (!resultsAreCurrent()) return;
      const project = activeProject();
      const entry = project?.files.get(item.path);
      if (!entry) return;
      const expectedText = entry.text;
      openFileInEditor(item.path);
      clearFolds();
      const start = entry.text.slice(0, item.index).replace(/\r\n?/g, '\n').length;
      const end = entry.text.slice(0, item.end).replace(/\r\n?/g, '\n').length;
      requestAnimationFrame(() => {
          if (activeProject() !== project || project.openFile !== item.path || project.files.get(item.path) !== entry || entry.text !== expectedText) return;
          if (focusEditor) el.codeTa.focus({ preventScroll: true });
          el.codeTa.setSelectionRange(start, end);
          const lineHeight = parseFloat(getComputedStyle(el.codeTa).lineHeight) || 20;
          el.editorScroll.scrollTop = Math.max(0, (item.line - 1) * lineHeight - el.editorScroll.clientHeight / 3);
          window.SynapseEditorDocuments.rememberView();
      });
    }

    function moveSelection(direction) {
      const items = state.result?.items;
      if (!items?.length || state.replacing || !resultsAreCurrent()) return;
      state.selected = (state.selected + direction + items.length) % items.length;
      renderSelection();
      el.frList.querySelector('[data-match-index="' + state.selected + '"]')?.scrollIntoView({ block: 'nearest' });
      revealMatch(items[state.selected]);
    }

    function rememberVersion(entry) {
      entry.history = entry.history || [];
      if (entry.history.at(-1)?.text !== entry.text) entry.history.push({ t: Date.now(), text: entry.text });
      if (entry.history.length > 40) entry.history.splice(0, entry.history.length - 40);
    }

    function replacementAnchor(current, patch, sourceText) {
      const nextText = patch?.after ?? sourceText;
      let index = current.end + (patch ? patch.after.length - patch.before.length : 0);
      if (current.index === current.end) index += nextText.codePointAt(index) > 0xffff ? 2 : 1;
      return { path: current.path, index };
    }

    async function replaceMatches(mode) {
      if (state.replacing || !state.result?.items.length || !resultsAreCurrent()) return;
      const project = activeProject();
      if (!project) return;
      const current = state.result.items[state.selected];
      const followUp = { focus: document.activeElement, anchor: null };
      cancelSearch();
      const version = state.version;
      const sources = collectSources(project);
      const projectFileCount = project.files.size;
      state.replacing = true;
      setButtonStates(true);
      const job = window.SynapseSearchService.run({ ...queryOptions(), files: sources.map(({ path, text }) => ({ path, text })), mode, replacement: el.frRepl.value, path: current.path, index: current.index });
      state.job = job;
      try {
        const result = await job.promise;
        if (version !== state.version || !isOpen()) return;
        if (!result.patches.length) {
          if (mode === 'replace-one' && sourcesUnchanged(project, sources)) {
            followUp.anchor = replacementAnchor(current, null, project.files.get(current.path).text);
          }
          toast('Nenhuma alteração', 'O texto já corresponde à substituição ou a ocorrência mudou.', '');
          return;
        }
        const count = result.patches.reduce((total, patch) => total + patch.count, 0);
        if (mode === 'replace-all' && state.scope === 'project') {
          const confirmed = await uiConfirm('Substituir em todo o projeto?', count + ' ocorrência(s) em ' + result.patches.length + ' arquivo(s). As versões anteriores ficarão no histórico.', 'Substituir tudo', true);
          if (!confirmed) return;
        }
        if (version !== state.version || !isOpen()) return;
        if (!sourcesUnchanged(project, sources) || project.files.size !== projectFileCount) {
          toast('Os arquivos mudaram', 'Nada foi substituído. Confira os resultados atualizados e tente novamente.', 'warn');
          return;
        }
        if (mode === 'replace-one') {
          followUp.anchor = replacementAnchor(current, result.patches.find((patch) => patch.path === current.path), project.files.get(current.path).text);
        }
        for (const patch of result.patches) {
          const entry = project.files.get(patch.path);
          if (patch.path === project.openFile) {
            window.EditorFolding?.expandBeforeInput();
            window.SynapseEditorDocuments.rememberView();
          }
          window.SynapseDebugger?.beforeSourceEdit(project, patch.path, entry.text, patch.after);
          rememberVersion(entry);
          window.SynapseEditorDocuments.recordInput(project, entry, patch.after);
          entry.text = patch.after;
          entry.data = null;
          project.dirty.add(patch.path);
          if (patch.path === project.openFile) {
            clearFolds();
            el.codeTa.value = patch.after;
            paintEditor(patch.path, patch.after);
            el.editorDirty.classList.add('on');
            window.SynapseEditorDocuments.activate(project, entry);
          }
        }
        renderEditorTabs();
        scheduleBuild(project);
        saveSession();
        toast('Substituição concluída', count + ' ocorrência(s) em ' + result.patches.length + ' arquivo(s)', 'ok');
      } catch (error) {
        if (version === state.version && error.name !== 'AbortError') toast('Falha na substituição', error.message, 'err');
      } finally {
        state.replacing = false;
        if (version === state.version) {
          state.job = null;
          if (isOpen()) renderFindReplace(false, followUp);
        } else setButtonStates();
      }
    }

    function wireFindReplace() {
      if (state.wired) return;
      state.wired = true;
      controls = { scope: document.getElementById('frScope'), wholeWord: document.getElementById('frWholeWord'), previous: document.getElementById('frPrevious'), next: document.getElementById('frNext'), replaceOne: document.getElementById('frReplaceOne'), close: document.getElementById('frClose') };
      if (el.frIcon) el.frIcon.innerHTML = iconSvg('search');
      el.frFind.addEventListener('input', (event) => { if (!event.isComposing) renderFindReplace(true); });
      el.frFind.addEventListener('compositionend', () => renderFindReplace(true));
      [[el.frCase, 'caseSensitive'], [el.frRegex, 'regex'], [controls.wholeWord, 'wholeWord']].forEach(([button, key]) => button.addEventListener('click', () => { state[key] = !state[key]; updateOptions(); renderFindReplace(); }));
      controls.scope.addEventListener('change', () => {
          state.scope = controls.scope.value;
          state.scopePath = activeProject()?.openFile || null;
          updateOptions();
          renderFindReplace();
      });
      controls.previous.addEventListener('click', () => moveSelection(-1));
      controls.next.addEventListener('click', () => moveSelection(1));
      controls.replaceOne.addEventListener('click', () => replaceMatches('replace-one'));
      el.frReplaceAll.addEventListener('click', () => replaceMatches('replace-all'));
      controls.close.addEventListener('click', () => openFindReplace(false));
      el.frList.addEventListener('click', (event) => {
          const button = event.target.closest('[data-match-index]');
          const item = button && state.result?.items[Number(button.dataset.matchIndex)];
          if (!item || state.replacing || !resultsAreCurrent()) return;
          openFindReplace(false);
          revealMatch(item, true);
      });
      el.frBack.addEventListener('click', (event) => { if (event.target === el.frBack) openFindReplace(false); });
      el.frBack.addEventListener('keydown', (event) => {
          if (event.isComposing) return;
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            openFindReplace(false);
          } else if (event.key === 'Enter' && (event.target === el.frFind || event.target === el.frRepl)) {
            event.preventDefault();
            if (event.target === el.frRepl) void replaceMatches('replace-one');
            else moveSelection(event.shiftKey ? -1 : 1);
          } else if (event.key === 'Tab') {
            const focusable = [...el.frBack.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled)')].filter((element) => element.getClientRects().length);
            const boundary = event.shiftKey ? focusable[0] : focusable.at(-1);
            if (document.activeElement === boundary) {
              event.preventDefault();
              (event.shiftKey ? focusable.at(-1) : focusable[0])?.focus();
            }
          }
      });
      document.getElementById('findInFileBtn')?.addEventListener('click', () => { closeOverlays(); openFindReplace(true, { scope: 'file' }); });
    }

    window.openFindReplace = openFindReplace;
    window.renderFindReplace = renderFindReplace;
    window.frBuildRegex = () => { try { return window.SynapseSearchCore.buildExpression(queryOptions()); } catch { return false; } };
    window.frDoReplaceAll = () => replaceMatches('replace-all');
    window.wireFindReplace = wireFindReplace;
})();
