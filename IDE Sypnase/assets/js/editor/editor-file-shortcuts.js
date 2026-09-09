(function (root) {
    'use strict';

    const CODE_EDITOR_ID = 'codeTa';
    const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';
    const MAXIMUM_INDEXED_FILES = 9;

    function currentProject() {
      return typeof root.activeProject === 'function' ? root.activeProject() : null;
    }

    function openFilePaths() {
      const project = currentProject();
      if (!project || !Array.isArray(project.openTabs)) return [];
      const files = project.files;
      if (files && typeof files.has === 'function') {
        return project.openTabs.filter((path) => files.has(path));
      }
      return project.openTabs.slice();
    }

    function focusedElement() {
      return document.activeElement;
    }

    function isCodeEditorFocused() {
      const focused = focusedElement();
      return !!focused && focused.id === CODE_EDITOR_ID;
    }

    function isEditableFocused() {
      const focused = focusedElement();
      if (!focused || typeof focused.closest !== 'function') return false;
      return !!focused.closest(EDITABLE_SELECTOR);
    }

    function isPageBodyFocused() {
      const focused = focusedElement();
      if (!focused) return true;
      return focused === document.body || focused === document.documentElement;
    }

    function openFileAtIndex(index) {
      const paths = openFilePaths();
      if (index < 0 || index >= paths.length) return false;
      if (typeof root.openFileInEditor !== 'function') return false;
      root.openFileInEditor(paths[index]);
      return true;
    }

    function openFileByOffset(offset) {
      const paths = openFilePaths();
      if (paths.length < 2) return false;
      const project = currentProject();
      const currentIndex = project ? paths.indexOf(project.openFile) : -1;
      const startIndex = currentIndex < 0 ? 0 : currentIndex;
      const nextIndex = (startIndex + offset + paths.length) % paths.length;
      return openFileAtIndex(nextIndex);
    }

    function closeCurrentFile() {
      const project = currentProject();
      if (!project || !project.openFile) return false;
      if (typeof root.closeTab !== 'function') return false;
      root.closeTab(project.openFile);
      return true;
    }

    function arrowOffset(key) {
      if (key === 'ArrowLeft') return -1;
      if (key === 'ArrowRight') return 1;
      return 0;
    }

    function pageOffset(key) {
      if (key === 'PageUp') return -1;
      if (key === 'PageDown') return 1;
      return 0;
    }

    function canSwitchFileWithAlt() {
      return isCodeEditorFocused() || !isEditableFocused();
    }

    function handleArrowFileSwitch(event) {
      const offset = arrowOffset(event.key);
      if (!offset || event.shiftKey) return false;
      if (event.altKey) {
        if (!canSwitchFileWithAlt()) return false;
        return openFileByOffset(offset);
      }
      if (event.ctrlKey || event.metaKey) return false;
      if (!isPageBodyFocused()) return false;
      return openFileByOffset(offset);
    }

    function handlePageFileSwitch(event) {
      const offset = pageOffset(event.key);
      if (!offset || event.shiftKey) return false;
      if (!event.ctrlKey && !event.metaKey && !event.altKey) return false;
      return openFileByOffset(offset);
    }

    function handleIndexedFileSwitch(event) {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false;
      const position = Number(event.key);
      if (!Number.isInteger(position)) return false;
      if (position < 1 || position > MAXIMUM_INDEXED_FILES) return false;
      return openFileAtIndex(position - 1);
    }

    function handleCloseFile(event) {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false;
      if ((event.key || '').toLowerCase() !== 'w') return false;
      return closeCurrentFile();
    }

    const HANDLERS = [
      handleArrowFileSwitch,
      handlePageFileSwitch,
      handleIndexedFileSwitch,
      handleCloseFile,
    ];

    document.addEventListener('keydown', (event) => {
        if (event.defaultPrevented || event.isComposing) return;
        if (window.SynapseShortcutBindings?.hasCustomFileNavigation()) return;
        for (const handler of HANDLERS) {
          if (handler(event)) {
            event.preventDefault();
            return;
          }
        }
    });
})(typeof globalThis !== 'undefined' ? globalThis : window);
