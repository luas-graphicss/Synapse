'use strict';

function openFileInEditor(path) {
  const project = activeProject();
  const entry = project?.files.get(path);
  if (!entry) return;
  window.SynapseEditorDocuments.rememberView();
  sniffTextEntry(entry);
  project.openFile = path;
  project.openTabs = [...new Set([...(project.openTabs || []), path])].filter((filePath) => project.files.has(filePath));
  renderTree();
  renderEditorTabs();
  el.editorTitle.textContent = Core.basename(path);
  el.editorPath.textContent = Core.dirname(path);
  el.editorTitle.title = path;
  el.editorPath.title = Core.dirname(path);
  el.editorDirty.classList.toggle('on', project.dirty.has(path));
  disposeMedia();
  el.editorEmpty.classList.add('hidden');
  el.editorGrid.classList.toggle('hidden', !entry.isText);
  el.mediaView.classList.toggle('hidden', !!entry.isText);
  if (!entry.isText) {
    window.EditorFolding.deactivate();
    window.SynapseEditorDocuments.detach();
    openMediaPreview(project, path, entry);
  } else {
    window.EditorFolding.activate(entry, path);
    const unit = window.SynapseIndentation.detectIndentation(entry.text || '');
    el.codeTa.style.tabSize = el.codeHl.style.tabSize = String(unit === '\t' ? 2 : unit.length);
    paintEditorNow(path, entry.text);
    window.SynapseEditorDocuments.activate(project, entry);
  }
  saveSession();
}

function renderEditorTabs() {
  const project = activeProject();
  if (project) project.openTabs = [...new Set(project.openTabs || [])].filter((path) => project.files.has(path));
  const paths = project?.openTabs || [];
  el.editorTabs.classList.toggle('hidden', !paths.length);
  el.editorTabs.setAttribute('role', 'tablist');
  el.editorTabs.setAttribute('aria-label', 'Arquivos abertos');
  el.editorTabs.innerHTML = paths.map((path, index) => {
      const active = path === project.openFile;
      const dirty = project.dirty.has(path);
      const duplicateName = paths.some((other) => other !== path && Core.basename(other) === Core.basename(path));
      const label = duplicateName ? path : Core.basename(path);
      return '<div class="etab' + (active ? ' active' : '') + '" role="presentation" data-tab-file="' + esc(path) + '">' +
      '<button type="button" class="etselect" role="tab" id="editor-file-tab-' + index + '" aria-selected="' + active + '" aria-controls="' + (project.files.get(path).isText ? 'editorScroll' : 'mediaView') + '" tabindex="' + (active ? 0 : -1) + '" title="' + esc(path) + '" aria-label="' + esc(path + (dirty ? ', modificado' : '')) + '">' +
      '<span class="etico" aria-hidden="true" style="color:' + colorOfExt(path) + '">' + fileIcon(path, false) + '</span><span class="etname">' + esc(label) + '</span>' +
      (dirty ? '<span class="etdirty" aria-hidden="true"></span>' : '') + '</button>' +
      '<button type="button" class="etclose" data-tab-close="' + esc(path) + '" aria-label="Fechar ' + esc(path) + '" tabindex="' + (active ? 0 : -1) + '">' + iconSvg('close') + '</button></div>';
  }).join('');
  const activeTab = el.editorTabs.querySelector('.etab.active');
  if (activeTab) {
    const selectedButton = activeTab.querySelector('[role="tab"]');
    const activePanel = project.files.get(project.openFile)?.isText ? el.editorScroll : el.mediaView;
    const inactivePanel = activePanel === el.editorScroll ? el.mediaView : el.editorScroll;
    activePanel.setAttribute('role', 'tabpanel');
    activePanel.setAttribute('aria-labelledby', selectedButton.id);
    inactivePanel.removeAttribute('aria-labelledby');
    activeTab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  } else {
    el.editorScroll.removeAttribute('aria-labelledby');
    el.mediaView.removeAttribute('aria-labelledby');
  }
}

function closeTab(path) {
  const project = activeProject();
  const index = project?.openTabs?.indexOf(path) ?? -1;
  if (index < 0) return;
  window.SynapseEditorDocuments.rememberView();
  project.openTabs.splice(index, 1);
  if (project.openFile === path) {
    const nextPath = project.openTabs[index] || project.openTabs[index - 1];
    if (nextPath) openFileInEditor(nextPath);
    else {
      window.SynapseEditorDocuments.detach();
      project.openFile = null;
      disposeMedia();
      clearFolds();
      el.editorGrid.classList.add('hidden');
      el.mediaView.classList.add('hidden');
      if (el.miniMap) el.miniMap.classList.add('hidden');
      el.editorEmpty.classList.remove('hidden');
      el.editorEmpty.innerHTML = '<div>' + iconSvg('code', 'icon') + 'Selecione um arquivo no Explorer para editar</div>';
      el.editorTitle.textContent = 'Nenhum arquivo';
      el.editorTitle.title = '';
      el.editorPath.textContent = '';
      el.editorPath.title = '';
      el.editorDirty.classList.remove('on');
      el.codeTa.value = '';
      el.codeHl.textContent = '';
      el.gutter.textContent = '';
      renderTree();
      renderEditorTabs();
    }
  } else renderEditorTabs();
  saveSession();
}

(function () {
    function focusActiveTab() {
      const activeTab = el.editorTabs.querySelector('[role="tab"][aria-selected="true"]');
      if (activeTab) activeTab.focus({ preventScroll: true });
      else {
        el.editorEmpty.setAttribute('tabindex', '-1');
        el.editorEmpty.focus({ preventScroll: true });
      }
    }

    el.editorTabs.addEventListener('click', (event) => {
        const closeButton = event.target.closest('[data-tab-close]');
        if (closeButton) {
          const restoreFocus = el.editorTabs.contains(document.activeElement);
          closeTab(closeButton.dataset.tabClose);
          if (restoreFocus) focusActiveTab();
          return;
        }
        const tab = event.target.closest('[data-tab-file]');
        if (tab) { openFileInEditor(tab.dataset.tabFile); focusActiveTab(); }
    });
    el.editorTabs.addEventListener('mousedown', (event) => {
        const tab = event.target.closest('[data-tab-file]');
        if (event.button === 1 && tab) {
          event.preventDefault();
          const restoreFocus = el.editorTabs.contains(document.activeElement);
          closeTab(tab.dataset.tabFile);
          if (restoreFocus) focusActiveTab();
        }
    });
    el.editorTabs.addEventListener('keydown', (event) => {
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        const tab = event.target.closest('[data-tab-file]');
        const project = activeProject();
        if (!tab || !project) return;
        const paths = project.openTabs;
        const index = paths.indexOf(tab.dataset.tabFile);
        let destination = index;
        if (event.key === 'ArrowRight') destination = (index + 1) % paths.length;
        else if (event.key === 'ArrowLeft') destination = (index + paths.length - 1) % paths.length;
        else if (event.key === 'Home') destination = 0;
        else if (event.key === 'End') destination = paths.length - 1;
        else if (event.key === 'Delete') {
          event.preventDefault();
          closeTab(tab.dataset.tabFile);
          focusActiveTab();
          return;
        } else return;
        event.preventDefault();
        openFileInEditor(paths[destination]);
        focusActiveTab();
    });
})();
