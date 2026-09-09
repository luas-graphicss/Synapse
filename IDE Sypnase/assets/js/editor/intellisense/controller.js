(function (root) {
    'use strict';

    const namespace = root.SynapseIntelligence;
    const scriptUrl = document.currentScript?.src || root.location.href;
    let workerUrl = null;
    let syntaxWorkerUrl = null;
    try {
      workerUrl =
      root.SynapseEditorWorkerResources?.url('./language.worker.js', scriptUrl) ||
      new URL('./language.worker.js', scriptUrl).href;
      syntaxWorkerUrl =
      root.SynapseEditorWorkerResources?.url('./syntax.worker.js', scriptUrl) ||
      new URL('./syntax.worker.js', scriptUrl).href;
    } catch (error) {
      root.ignorarErro?.(error, 'intellisense.workerUrl');
    }

    function initialize() {
      if (!root.el?.codeTa || namespace.controller) return;
      const elements = root.el;
      const textarea = elements.codeTa;
      const model = namespace.projectModel;
      const listeners = [];
      let epoch = 0;
      let composing = false;
      let disposed = false;
      let diagnosticTimer = null;
      let syntaxTimer = null;
      let structureTimer = null;
      let semanticEpoch = -1;
      let lastContext = null;
      let viewState = { state: 'empty', items: [] };
      let clientStatus = 'idle';

      function context() {
        const project = root.activeProject?.();
        const path = project?.openFile;
        const file = project?.files.get(path);
        if (!file || typeof file.text !== 'string') return null;
        return {
          project,
          file,
          path,
          source: file.text,
          text: model.normalizeText(file.text),
          epoch,
          position: textarea.selectionStart,
          end: textarea.selectionEnd,
          readOnly: textarea.readOnly,
          disabled: textarea.disabled,
        };
      }

      function isCurrent(captured, requireCaret = false) {
        const current = context();
        return (
          !disposed &&
          !!current &&
          captured.epoch === epoch &&
          captured.project === current.project &&
          captured.file === current.file &&
          captured.path === current.path &&
          captured.source === current.source &&
          (!requireCaret ||
            (!composing &&
              !textarea.readOnly &&
              !textarea.disabled &&
              captured.text === textarea.value &&
              captured.position === textarea.selectionStart &&
              captured.end === textarea.selectionEnd))
        );
      }

      function updateView(next) {
        if (disposed) return;
        viewState = { ...viewState, message: undefined, ...next };
        diagnostics.update(viewState);
      }

      function announce(key) {
        updateView({ message: namespace.label(key) });
      }
      const client = namespace.createClient(
        workerUrl,
        (status) => {
          clientStatus = status.state;
          if (
            viewState.path &&
            model.isSupported(viewState.path) &&
            viewState.text.length <= model.limits.fileCharacters
          )
          updateView({
              state: viewState.syntaxChecked
              ? status.state === 'unavailable'
              ? 'syntaxOnly'
              : viewState.state
              : status.state === 'ready'
              ? 'checking'
              : status.state,
              error: status.message,
          });
        },
        syntaxWorkerUrl,
      );
      const navigation = namespace.createNavigation({
          elements,
          client,
          context,
          isCurrent,
          announce,
          onChange: () => diagnostics.refresh(),
          refresh: () => refreshContext(),
      });
      const diagnostics = namespace.createDiagnosticView(elements, {
          suggest: () => {
            textarea.focus({ preventScroll: true });
            root.SynapseAutocomplete?.request(true);
          },
          definition: navigation.goToDefinition,
          back: navigation.goBack,
          retry: () => {
            client.reset();
            clientStatus = 'idle';
            refreshContext(true);
          },
          navigate: navigation.navigate,
          canGoBack: navigation.canGoBack,
      });
      const completionProvider = namespace.createCompletionProvider({
          client,
          context,
          isCurrent,
          isUnavailable: () => clientStatus === 'unavailable',
          isComposing: () => composing,
      });
      const completionRegistration = root.SynapseAutocomplete?.registerProvider(completionProvider);

      function refreshContext(workspaceChanged = false) {
        if (disposed) return;
        const current = context();
        const changed =
        workspaceChanged ||
        current?.project !== lastContext?.project ||
        current?.file !== lastContext?.file ||
        current?.path !== lastContext?.path ||
        current?.source !== lastContext?.source ||
        current?.readOnly !== lastContext?.readOnly ||
        current?.disabled !== lastContext?.disabled;
        if (!changed) {
          diagnostics.drawMarkers();
          return;
        }
        if (current?.project !== lastContext?.project) navigation.reset();
        lastContext = current;
        epoch++;
        root.SynapseAutocomplete?.dismiss();
        for (const method of ['syntax', 'diagnostics', 'definitions', 'completions', 'details'])
        client.cancel(method);
        clearTimeout(diagnosticTimer);
        clearTimeout(syntaxTimer);
        clearTimeout(structureTimer);
        semanticEpoch = -1;
        viewState = {
          items: [],
          text: current?.text || '',
          path: current?.path || null,
          script: !!current && model.isScript(current.path),
          state: 'empty',
        };
        if (!current) {
          client.reset();
          clientStatus = 'idle';
          updateView({ state: 'empty' });
          return;
        }
        if (
          [...current.project.files].some(
            ([path, file]) =>
            model.isSupported(path) &&
            typeof file.text === 'string' &&
            file.text.length <= model.limits.fileCharacters,
          )
        )
        client.warmup();
        if (!model.isSupported(current.path)) {
          if (!hasStructureAnalysis(current)) {
            updateView({ state: 'unsupported' });
            return;
          }
          updateView({ state: 'checking' });
          if (!composing) structureTimer = setTimeout(requestStructureDiagnostics, 40);
          return;
        }
        if (current.source.length > model.limits.fileCharacters) {
          updateView({ state: 'large', script: false });
          return;
        }
        updateView({ state: clientStatus === 'unavailable' ? 'unavailable' : 'checking' });
        if (!composing) {
          structureTimer = setTimeout(requestStructureDiagnostics, 40);
          syntaxTimer = setTimeout(requestSyntaxDiagnostics, 80);
          diagnosticTimer = setTimeout(requestDiagnostics, 400);
        }
      }

      function hasStructureAnalysis(captured) {
        const analyzer = root.SynapseStructureDiagnostics;
        return !!analyzer && !!captured && analyzer.supports(captured.path);
      }

      function requestStructureDiagnostics() {
        const captured = context();
        if (!captured || composing || disposed || semanticEpoch === epoch) return;
        const result = root.SynapseStructureDiagnostics?.analyze(captured.path, captured.text);
        const supported = model.isSupported(captured.path);
        if (!result) {
          if (!supported) updateView({ state: 'unsupported' });
          return;
        }
        if (supported && !result.items.length) return;
        updateView({
            state: supported ? viewState.state : 'structure',
            items: result.items,
            total: result.total,
        });
      }

      async function requestSyntaxDiagnostics() {
        const captured = context();
        if (!captured || composing || disposed) return;
        const result = await client.request('syntax', null, {
            path: captured.path,
            text: captured.text,
        });
        if (!result || composing || !isCurrent(captured)) return;
        if (result.error) {
          if (semanticEpoch !== epoch)
          updateView({ state: 'unavailable', items: [], error: result.error });
          return;
        }
        if (semanticEpoch === epoch) return;
        updateView({
            state: clientStatus === 'unavailable' ? 'syntaxOnly' : 'syntax',
            syntaxChecked: true,
            items: result.items,
            total: result.total,
        });
      }

      async function requestDiagnostics() {
        const captured = context();
        if (!captured || composing || disposed) return;
        const snapshot = model.createSnapshot(captured.project, captured.path);
        if (!snapshot) return;
        const result = await client.request('diagnostics', snapshot, { path: captured.path });
        if (!result || composing || !isCurrent(captured)) return;
        if (result.error) {
          updateView({
              state: viewState.syntaxChecked ? 'syntaxOnly' : 'unavailable',
              error: result.error,
          });
          return;
        }
        semanticEpoch = epoch;
        updateView({
            state: 'ready',
            items: result.items,
            total: result.total,
            omitted: snapshot.omitted,
            configurationErrors: result.configurationErrors,
        });
      }

      function listen(target, name, handler, options) {
        target.addEventListener(name, handler, options);
        listeners.push(() => target.removeEventListener(name, handler, options));
      }
      const host = namespace.observeHost(refreshContext);
      listen(textarea, 'input', () => refreshContext());
      listen(textarea, 'compositionstart', () => {
          composing = true;
          epoch++;
          clearTimeout(diagnosticTimer);
          clearTimeout(syntaxTimer);
          clearTimeout(structureTimer);
          client.cancel('diagnostics');
          client.cancel('syntax');
          updateView({ items: [], total: 0, state: 'checking', syntaxChecked: false });
      });
      listen(textarea, 'compositionend', () => {
          composing = false;
          refreshContext(true);
      });
      listen(
        textarea,
        'keydown',
        (event) => {
          if (event.defaultPrevented || composing || event.isComposing || event.keyCode === 229)
          return;
          if (
            event.key === 'F12' &&
            !event.shiftKey &&
            !event.altKey &&
            !event.ctrlKey &&
            !event.metaKey
          ) {
            event.preventDefault();
            event.stopImmediatePropagation();
            navigation.goToDefinition();
          } else if (event.altKey && event.key === 'ArrowLeft' && navigation.canGoBack()) {
            event.preventDefault();
            event.stopImmediatePropagation();
            navigation.goBack();
          }
        },
        true,
      );
      listen(textarea, 'click', (event) => {
          if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && !composing) {
            event.preventDefault();
            navigation.goToDefinition();
          }
      });
      listen(document, 'keydown', (event) => {
          if (
            !event.defaultPrevented &&
            !event.isComposing &&
            (event.ctrlKey || event.metaKey) &&
            event.shiftKey &&
            !event.altKey &&
            event.key.toLowerCase() === 'm' &&
            elements.editorPane.contains(event.target)
          ) {
            event.preventDefault();
            diagnostics.toggle();
          }
      });
      listen(root, 'synapse:editor-painted', () => refreshContext());
      listen(root, 'resize', () => diagnostics.drawMarkers());
      listen(document, 'synapse:idioma', () => diagnostics.refresh());
      listen(root, 'pagehide', () => {
          clearTimeout(diagnosticTimer);
          clearTimeout(syntaxTimer);
          clearTimeout(structureTimer);
          epoch++;
          client.reset();
          clientStatus = 'idle';
      });
      listen(root, 'pageshow', (event) => {
          if (event.persisted) refreshContext(true);
      });
      namespace.controller = Object.freeze({
          refresh: () => refreshContext(true),
          suggest: () => {
            textarea.focus({ preventScroll: true });
            return root.SynapseAutocomplete?.request(true);
          },
          goToDefinition: navigation.goToDefinition,
          showProblems: () => diagnostics.toggle(true),
          dispose() {
            disposed = true;
            epoch++;
            clearTimeout(diagnosticTimer);
            clearTimeout(syntaxTimer);
            clearTimeout(structureTimer);
            listeners.forEach((remove) => remove());
            completionRegistration?.dispose();
            navigation.reset();
            host.dispose();
            client.dispose();
            diagnostics.dispose();
            delete namespace.controller;
          },
      });
      refreshContext(true);
    }

    if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
    else initialize();
})(globalThis);
