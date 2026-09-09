(function (root) {
    'use strict';

    const CODE_EDITOR_ID = 'codeTa';
    const NATIVE_HISTORY_SELECTOR = 'input, textarea, [contenteditable=""], [contenteditable="true"]';

    function editorDocuments() {
      return root.SynapseEditorDocuments || null;
    }

    function codeEditor() {
      return document.getElementById(CODE_EDITOR_ID);
    }

    function isUndoCombination(event) {
      const key = (event.key || '').toLowerCase();
      return key === 'z' && !event.shiftKey;
    }

    function isRedoCombination(event) {
      const key = (event.key || '').toLowerCase();
      if (key === 'y') return true;
      return key === 'z' && event.shiftKey;
    }

    function hasNativeHistory(target) {
      if (!target || typeof target.closest !== 'function') return false;
      const field = target.closest(NATIVE_HISTORY_SELECTOR);
      if (!field) return false;
      return field.id !== CODE_EDITOR_ID;
    }

    function isCodeEditorUsable() {
      const editor = codeEditor();
      if (!editor || editor.readOnly || editor.disabled) return false;
      return !!editor.offsetParent;
    }

    function focusCodeEditor() {
      const editor = codeEditor();
      if (!editor) return;
      if (document.activeElement !== editor) editor.focus({ preventScroll: true });
    }

    function runCodeEditorHistory(shouldRedo) {
      const documents = editorDocuments();
      if (!documents || !isCodeEditorUsable()) return;
      focusCodeEditor();
      if (shouldRedo) documents.redo();
      else documents.undo();
    }

    document.addEventListener(
      'keydown',
      (event) => {
        if (event.defaultPrevented || event.isComposing || event.altKey) return;
        if (!event.ctrlKey && !event.metaKey) return;
        const shouldRedo = isRedoCombination(event);
        if (!shouldRedo && !isUndoCombination(event)) return;
        if (event.target === codeEditor() || hasNativeHistory(event.target)) return;
        event.preventDefault();
        runCodeEditorHistory(shouldRedo);
      },
      true,
    );
})(typeof globalThis !== 'undefined' ? globalThis : window);
