(function () {
    'use strict';

    let allowTabExit = false;
    const documents = window.SynapseEditorDocuments;
    const indentation = window.SynapseIndentation;

    function currentFilePath() {
      return activeProject()?.openFile || '';
    }

    function insertNewline() {
      documents.applyEdit(indentation.createNewlineEdit(el.codeTa.value, el.codeTa.selectionStart, el.codeTa.selectionEnd, currentFilePath()));
    }

    el.codeTa.setAttribute('aria-label', 'Editor de código');
    el.codeTa.setAttribute('autocapitalize', 'off');
    el.codeTa.setAttribute('autocomplete', 'off');
    el.codeTa.setAttribute('autocorrect', 'off');
    el.codeTa.title = 'Tab: indentar · Shift+Tab: desindentar · Esc e Tab: sair do editor';
    el.codeTa.addEventListener('keydown', (event) => {
        if (event.isComposing || event.keyCode === 229 || event.defaultPrevented) return;
        if (event.key === 'Escape') { allowTabExit = true; return; }
        if (event.key === 'Tab' && allowTabExit) { allowTabExit = false; return; }
        allowTabExit = false;
        if (el.codeTa.readOnly) return;
        const modifier = event.ctrlKey || event.metaKey;
        const key = event.key.toLowerCase();
        if (modifier && !event.altKey && (key === 'z' || key === 'y')) {
          event.preventDefault();
          if (key === 'y' || event.shiftKey) documents.redo();
          else documents.undo();
          return;
        }
        if (modifier || event.altKey) return;
        if (event.key === 'Tab') {
          event.preventDefault();
          documents.applyEdit(indentation.createTabEdit(el.codeTa.value, el.codeTa.selectionStart, el.codeTa.selectionEnd, event.shiftKey));
        } else if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          insertNewline();
        } else {
          const edit = indentation.createClosingEdit(el.codeTa.value, el.codeTa.selectionStart, el.codeTa.selectionEnd, event.key, currentFilePath());
          if (edit) { event.preventDefault(); documents.applyEdit(edit); }
        }
    });
    el.codeTa.addEventListener('beforeinput', (event) => {
        if (!event.cancelable || event.isComposing || event.defaultPrevented || el.codeTa.readOnly) return;
        if (event.inputType === 'insertLineBreak' || event.inputType === 'insertParagraph') {
          event.preventDefault();
          insertNewline();
        } else if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
          event.preventDefault();
          if (event.inputType === 'historyUndo') documents.undo();
          else documents.redo();
        }
    });
})();
