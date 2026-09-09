(function (root) {
    'use strict';

    const namespace = root.SynapseIntelligence;

    function createNavigation({ elements, client, context, isCurrent, announce, onChange, refresh }) {
      const textarea = elements.codeTa;
      const model = namespace.projectModel;
      const backStack = [];
      let sequence = 0;

      function unfold() {
        if (textarea.readOnly || textarea.disabled) return false;
        root.EditorFolding?.expandBeforeInput();
        refresh();
        return true;
      }

      function navigate(location, expectedText, remember = true) {
        if (!unfold()) return;
        const current = context();
        const file = current?.project.files.get(location.path);
        const text = typeof file?.text === 'string' ? model.normalizeText(file.text) : null;
        if (
          text === null ||
          (expectedText !== undefined && expectedText !== text) ||
          !Number.isInteger(location.start) ||
          location.start < 0 ||
          location.start > text.length
        ) {
          announce('changed');
          return;
        }
        const origin = {
          path: current.path,
          start: current.position,
          length: current.end - current.position,
          text: current.text,
        };
        root.SynapseAutocomplete?.dismiss();
        const requestSequence = ++sequence;
        root.openFileInEditor(location.path);
        root.EditorFolding?.expandBeforeInput();
        requestAnimationFrame(() => {
            if (
              requestSequence !== sequence ||
              root.activeProject?.() !== current.project ||
              current.project.openFile !== location.path ||
              current.project.files.get(location.path) !== file ||
              typeof file.text !== 'string' ||
              model.normalizeText(file.text) !== text ||
              textarea.value !== text ||
              textarea.readOnly ||
              textarea.disabled
            )
            return;
            const position = location.start;
            textarea.focus({ preventScroll: true });
            textarea.setSelectionRange(
              position,
              Math.min(text.length, position + Math.max(0, location.length || 0)),
            );
            const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 20;
            elements.editorScroll.scrollTop = Math.max(
              0,
              (model.positionAt(text, position).line - 3) * lineHeight,
            );
            const point = root.SynapseCaretPosition?.measure(textarea);
            const bounds = elements.editorScroll.getBoundingClientRect();
            if (point && (point.left < bounds.left + 48 || point.left > bounds.right - 32))
            elements.editorScroll.scrollLeft += point.left - bounds.left - 64;
            root.SynapseEditorDocuments?.rememberView();
            if (remember) {
              backStack.push(origin);
              if (backStack.length > 50) backStack.shift();
            }
            onChange();
        });
      }

      async function goToDefinition() {
        root.SynapseAutocomplete?.dismiss();
        if (!unfold()) return;
        textarea.focus({ preventScroll: true });
        const captured = context();
        if (!captured || !model.isScript(captured.path) || captured.text !== textarea.value) return;
        const requestSequence = ++sequence;
        const snapshot = model.createSnapshot(captured.project, captured.path);
        const result = await client.request('definitions', snapshot, {
            path: captured.path,
            position: captured.position,
        });
        if (!result || requestSequence !== sequence || !isCurrent(captured, true)) return;
        if (result.error) {
          announce('unavailable');
          return;
        }
        if (!result.locations.length) {
          announce(result.external ? 'external' : 'noDefinition');
          return;
        }
        const location = result.locations[0];
        const expectedText = snapshot.files.find((file) => file.path === location.path)?.text;
        navigate(location, expectedText);
      }

      function goBack() {
        if (textarea.readOnly || textarea.disabled) return;
        const location = backStack.pop();
        if (location) navigate(location, location.text, false);
        onChange();
      }

      function reset() {
        sequence++;
        backStack.length = 0;
      }

      return Object.freeze({
          navigate,
          goToDefinition,
          goBack,
          reset,
          canGoBack: () => backStack.length > 0,
      });
    }

    namespace.createNavigation = createNavigation;
})(globalThis);
