(function () {
    'use strict';

    const debug = window.SynapseDebug;
    let view;
    let renderer;
    let bridge;
    let launcher;
    let pending = false;
    let currentProject = null;
    let operation = 0;
    let errorMessage = '';
    let scheduled = false;
    let inspectionLocation = '';
    let breakpointSyncKey = '';
    let navigationSequence = 0;
    let requestedOpen = false;

    function diagnostic(error) {
      if (typeof ignorarErro === 'function') ignorarErro(error, 'debugger');
    }

    function output(kind, text) {
      if (!view) return;
      view.output.textContent = (
        view.output.textContent +
        (view.output.textContent ? '\n' : '') +
        `[${kind}] ${text}`
      ).slice(-20000);
    }

    function showError(error) {
      errorMessage = error?.message || String(error);
      output('error', errorMessage);
      scheduleRender();
    }

    const session = new debug.DebugSession({
        onChange: () => scheduleRender(),
        onOutput: output,
    });

    function project() {
      return typeof activeProject === 'function' ? activeProject() : null;
    }

    function synchronizeBreakpoints(active) {
      if (
        session.project !== active ||
        !session.connection?.opened ||
        session.connection.closed ||
        session.state === 'connecting'
      ) {
        breakpointSyncKey = '';
        return;
      }
      const breakpoints = debug.preferences.forProject(active).breakpoints;
      const key = JSON.stringify([
          session.generation,
          breakpoints.map((entry) => [entry.path, entry.line, entry.enabled, session.sourceChanged(entry.path)]),
      ]);
      if (key === breakpointSyncKey) return;
      breakpointSyncKey = key;
      session.syncBreakpoints(breakpoints).catch(showError);
    }

    function scheduleRender() {
      if (!view || scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
          scheduled = false;
          const active = project();
          if (active !== currentProject) {
            currentProject = active;
            errorMessage = '';
            inspectionLocation = '';
            breakpointSyncKey = '';
            navigationSequence++;
            view.endpoint.value = '';
            view.output.textContent = '';
            if (
              (session.project && session.project !== active) ||
              (launcher?.record?.project !== active && launcher?.record)
            ) {
              stop().catch(showError);
            }
          }
          if (debug.preferences.observeSources(active) && typeof saveSession === 'function') saveSession();
          synchronizeBreakpoints(active);
          renderer.render(active, pending, errorMessage);
          bridge.refresh(active);
          const frame =
          session.project === active && session.state === 'paused'
          ? session.frames[session.selectedFrame]
          : null;
          const locationKey = frame ? `${session.pauseRevision}:${frame.callFrameId}` : '';
          if (frame?.path && locationKey !== inspectionLocation) {
            inspectionLocation = locationKey;
            verifyAndNavigate(frame, session.pauseRevision).catch(showError);
          }
      });
    }

    async function verifyAndNavigate(frame, revision) {
      if (session.sourceChanged(frame.path)) return;
      let verified;
      try {
        verified = await session.verifySource(frame);
      } catch (error) {
        if (session.pauseRevision === revision && session.project === project()) throw error;
        return;
      }
      if (
        session.state !== 'paused' ||
        session.pauseRevision !== revision ||
        session.project !== project()
      )
      return;
      if (verified) navigate(frame.path, frame.line, false, revision);
      else
      errorMessage =
      'A fonte executada é diferente do arquivo da IDE. Nenhuma linha será marcada; confira a raiz das fontes ou o JavaScript gerado.';
      scheduleRender();
    }

    function persist() {
      if (typeof saveSession === 'function') saveSession();
      breakpointSyncKey = '';
      scheduleRender();
    }

    function navigate(path, line, focus = true, revision = null) {
      const active = project();
      const source = active?.files.get(path);
      if (!source) return;
      const sequence = ++navigationSequence;
      const previousFocus = document.activeElement;
      if (active.openFile !== path && typeof openFileInEditor === 'function') openFileInEditor(path);
      requestAnimationFrame(() => {
          if (
            sequence !== navigationSequence || project() !== active ||
            active.openFile !== path || active.files.get(path) !== source
          ) return;
          if (
            revision !== null &&
            (session.state !== 'paused' || session.pauseRevision !== revision || session.sourceChanged(path))
          ) return;
          if (typeof jumpToLine === 'function') jumpToLine(line);
          if (!focus && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
      });
    }

    function toggleBreakpoint(line) {
      try {
        const active = project();
        if (!debug.preferences.toggleBreakpoint(active, active?.openFile, line)) return;
        persist();
      } catch (error) {
        showError(error);
      }
    }

    function setOpen(open) {
      requestedOpen = open;
      if (!view) return;
      view.panel.hidden = !open;
      document.getElementById('debugBtn')?.setAttribute('aria-expanded', String(open));
      if (open) {
        scheduleRender();
        view.panel.querySelector('[data-debug-action="close"]').focus({ preventScroll: true });
      } else document.getElementById('debugBtn')?.focus({ preventScroll: true });
    }

    async function start(attach) {
      const active = project();
      if (!active || pending || ['running', 'paused', 'connecting'].includes(session.state)) return;
      const preferences = debug.preferences.forProject(active);
      const token = ++operation;
      pending = true;
      errorMessage = '';
      view.output.textContent = '';
      scheduleRender();
      try {
        let target;
        if (attach) {
          target = {
            endpoint: debug.paths.inspectorEndpoint(view.endpoint.value),
            root: debug.paths.sourceRoot(view.root.value),
          };
          preferences.sourceRoot = target.root;
        } else {
          preferences.entry = view.entry.value;
          target = await launcher.start(active, preferences.entry);
        }
        if (token !== operation || active !== project()) {
          await launcher.stop();
          return;
        }
        await session.connect({ ...target, project: active, waitForDebugger: true });
        if (token !== operation || active !== project()) {
          await stop();
          return;
        }
        persist();
        view.setup.container.open = false;
        if (!attach)
        launcher
        .monitor(() => {
            if (session.project === active && token === operation) return session.disconnect();
            return undefined;
        })
        .catch(showError);
      } catch (error) {
        await launcher.stop().catch(diagnostic);
        if (token === operation) showError(error);
      } finally {
        if (token === operation) pending = false;
        scheduleRender();
      }
    }

    async function stop() {
      ++operation;
      navigationSequence++;
      pending = false;
      errorMessage = '';
      const results = await Promise.allSettled([session.disconnect(), launcher.stop()]);
      for (const result of results) if (result.status === 'rejected') showError(result.reason);
      scheduleRender();
    }

    async function action(name) {
      if (name === 'close') return setOpen(false);
      if (name === 'launch') return start(false);
      if (name === 'attach') return start(true);
      if (name === 'stop') return stop();
      if (['resume', 'pause', 'stepOver', 'stepInto', 'stepOut'].includes(name)) {
        errorMessage = '';
        await session.control(name);
      }
    }

    function handleShortcut(event) {
      if (event.defaultPrevented || event.repeat || event.isComposing) return;
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        setOpen(view.panel.hidden);
        return;
      }
      const editing = event.target === bridge.textarea;
      if (event.key === 'F9' && editing && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
        event.preventDefault();
        toggleBreakpoint(bridge.cursorLine());
        return;
      }
      if (view.panel.hidden && !['running', 'paused'].includes(session.state)) return;
      const commands = {
        F5: event.shiftKey ? 'stop' : session.state === 'paused' ? 'resume' : 'launch',
        F6: 'pause',
        F10: 'stepOver',
        F11: event.shiftKey ? 'stepOut' : 'stepInto',
      };
      if (event.key === 'Escape' && view.panel.contains(event.target)) {
        event.preventDefault();
        setOpen(false);
      } else if (commands[event.key] && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        event.stopImmediatePropagation();
        action(commands[event.key]).catch(showError);
      }
    }

    function initialize() {
      if (document.getElementById('debugPanel')) return;
      view = debug.createPanel();
      const launchButton = debug.dom.button('Debugger · Ctrl+Shift+D', 'toggle', 'debug', false);
      launchButton.id = 'debugBtn';
      launchButton.className = 'tbtn debug-launcher';
      launchButton.setAttribute('aria-controls', view.panel.id);
      launchButton.setAttribute('aria-expanded', 'false');
      const terminalButton = document.getElementById('termBtn');
      if (terminalButton) terminalButton.before(launchButton);
      else (document.querySelector('.toolbar') || document.body).append(launchButton);
      launchButton.addEventListener('click', () => setOpen(view.panel.hidden));
      launcher = new debug.NodeLauncher(
        debug.createTerminalHost({
            onOutput: (text) => output('node', text),
            onError: showError,
            onFinished: scheduleRender,
        }),
      );
      bridge = new debug.EditorBridge(session, toggleBreakpoint);
      renderer = new debug.PanelRenderer(view, session, {
          hasProcess: () => !!launcher.record,
          diagnostic,
          navigate,
          selectFrame: (index) => session.selectFrame(index),
          enableBreakpoint: (breakpoint) => {
            const key = debug.paths.breakpointKey(breakpoint);
            const current = debug.preferences.forProject(project()).breakpoints.find(
              (entry) => debug.paths.breakpointKey(entry) === key,
            );
            if (current) current.enabled = !current.enabled;
            persist();
          },
          removeBreakpoint: (breakpoint) => {
            const preferences = debug.preferences.forProject(project());
            const key = debug.paths.breakpointKey(breakpoint);
            preferences.breakpoints = preferences.breakpoints.filter(
              (entry) => debug.paths.breakpointKey(entry) !== key,
            );
            persist();
          },
          removeWatch: (expression) => {
            const preferences = debug.preferences.forProject(project());
            preferences.watches = preferences.watches.filter((entry) => entry !== expression);
            persist();
          },
      });
      view.panel.addEventListener('click', (event) => {
          const control = event.target.closest('[data-debug-action]');
          if (control && !control.disabled) action(control.dataset.debugAction).catch(showError);
      });
      view.watchForm.addEventListener('submit', (event) => {
          event.preventDefault();
          try {
            if (!project()) throw new Error('Open a project first.');
            debug.preferences.addWatch(project(), view.watchInput.value);
            view.watchInput.value = '';
            persist();
          } catch (error) {
            showError(error);
          }
      });
      view.breakpointForm.addEventListener('submit', (event) => {
          event.preventDefault();
          toggleBreakpoint(Number(view.lineInput.value));
      });
      view.entry.addEventListener('change', () => {
          debug.preferences.forProject(project()).entry = view.entry.value;
          persist();
      });
      window.addEventListener('synapse:editor-painted', scheduleRender);
      window.addEventListener('resize', () => bridge.refresh(project()));
      document.addEventListener('keydown', handleShortcut, true);
      const observer = new MutationObserver(scheduleRender);
      for (const id of ['tabs', 'editorTabs']) {
        const target = document.getElementById(id);
        if (target) observer.observe(target, { childList: true, subtree: true });
      }
      window.addEventListener('pagehide', () => {
          stop().catch(diagnostic);
      });
      if (requestedOpen) setOpen(true);
      scheduleRender();
    }

    window.SynapseDebugger = Object.freeze({
        open: () => setOpen(true),
        close: () => setOpen(false),
        session,
        toggleBreakpoint,
        refresh: scheduleRender,
        beforeSourceEdit: (active, path, previousText, nextText) =>
        debug.preferences.rebase(active, path, previousText, nextText),
    });
    if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
    else initialize();
})();
