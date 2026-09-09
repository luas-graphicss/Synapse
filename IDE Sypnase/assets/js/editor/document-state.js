(function () {
    'use strict';

    const projectStates = new WeakMap();
    const maximumHistoryLength = 80;
    const maximumHistoryCharacters = 2000000;
    let displayed = null;
    let replaying = false;

    function getState(project, entry) {
      if (!projectStates.has(project)) projectStates.set(project, new WeakMap());
      const states = projectStates.get(project);
      if (!states.has(entry)) states.set(entry, { text: entry.text, start: 0, end: 0, direction: 'none', top: 0, left: 0, undo: [], redo: [] });
      const state = states.get(entry);
      if (state.text !== entry.text) {
        state.text = entry.text;
        state.undo = [];
        state.redo = [];
      }
      return state;
    }

    function rememberView() {
      if (!displayed || el.codeTa.readOnly || el.codeTa.classList.contains('folded') || el.editorGrid.classList.contains('hidden')) return;
      const state = displayed.state;
      state.start = el.codeTa.selectionStart;
      state.end = el.codeTa.selectionEnd;
      state.direction = el.codeTa.selectionDirection;
      state.top = el.editorScroll.scrollTop;
      state.left = el.editorScroll.scrollLeft;
    }

    function activate(project, entry) {
      const state = getState(project, entry);
      displayed = { project, entry, state };
      const selection = { start: state.start, end: state.end, direction: state.direction, top: state.top, left: state.left };
      function restoreView() {
        if (displayed?.entry !== entry || displayed.project !== project || el.codeTa.readOnly || el.codeTa.classList.contains('folded')) return;
        el.codeTa.setSelectionRange(selection.start, selection.end, selection.direction);
        el.editorScroll.scrollTop = selection.top;
        el.editorScroll.scrollLeft = selection.left;
      }
      restoreView();
      requestAnimationFrame(() => {
          if (displayed?.entry !== entry || displayed.project !== project || el.codeTa.readOnly || el.codeTa.classList.contains('folded')) return;
          el.editorScroll.scrollTop = selection.top;
          el.editorScroll.scrollLeft = selection.left;
      });
    }

    function snapshot(state) {
      return { text: state.text, start: state.start, end: state.end, direction: state.direction };
    }

    function trimHistory(history) {
      let characters = 0;
      for (let index = history.length - 1; index >= 0; index--) {
        characters += history[index].text.length;
        if (characters > maximumHistoryCharacters || history.length - index > maximumHistoryLength) {
          history.splice(0, index + 1);
          break;
        }
      }
    }

    function recordInput(project, entry, nextText) {
      const state = getState(project, entry);
      if (!replaying && state.text !== nextText) {
        state.undo.push(snapshot(state));
        trimHistory(state.undo);
        state.redo = [];
      }
      state.text = nextText;
      if (displayed?.project === project && displayed.entry === entry) {
        state.start = el.codeTa.selectionStart;
        state.end = el.codeTa.selectionEnd;
        state.direction = el.codeTa.selectionDirection;
      }
    }

    function applyEdit(edit) {
      if (!edit || el.codeTa.readOnly || !displayed) return false;
      if (activeProject() !== displayed.project || displayed.project.files.get(displayed.project.openFile) !== displayed.entry) return false;
      const expectedText = el.codeTa.value;
      window.EditorFolding?.expandBeforeInput();
      if (el.codeTa.value !== expectedText) return false;
      rememberView();
      el.codeTa.setRangeText(edit.text, edit.start, edit.end, 'preserve');
      el.codeTa.setSelectionRange(edit.selectionStart, edit.selectionEnd, edit.direction || 'none');
      el.codeTa.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }

    function travelHistory(direction) {
      const project = activeProject();
      const entry = project?.files.get(project.openFile);
      if (!entry?.isText || displayed?.entry !== entry || displayed.project !== project || el.codeTa.readOnly) return false;
      window.EditorFolding?.expandBeforeInput();
      rememberView();
      const state = getState(project, entry);
      const source = direction === 'undo' ? state.undo : state.redo;
      const target = direction === 'undo' ? state.redo : state.undo;
      const previous = source.pop();
      if (!previous) return false;
      target.push(snapshot(state));
      trimHistory(target);
      replaying = true;
      try {
        applyEdit({ start: 0, end: el.codeTa.value.length, text: previous.text, selectionStart: previous.start, selectionEnd: previous.end, direction: previous.direction });
      } finally {
        replaying = false;
      }
      return true;
    }

    function detach() {
      rememberView();
      displayed = null;
    }

    el.codeTa.addEventListener('beforeinput', rememberView);
    window.SynapseEditorDocuments = Object.freeze({ rememberView, activate, detach, recordInput, applyEdit, undo: () => travelHistory('undo'), redo: () => travelHistory('redo') });
})();
