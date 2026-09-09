(function () {
    'use strict';

    const debug = window.SynapseDebug;
    const { element, button } = debug.dom;
    const states = {
      idle: 'Desconectado',
      connecting: 'Conectando…',
      running: 'Executando',
      paused: 'Pausado',
      disconnected: 'Conexão encerrada',
      error: 'Não foi possível depurar',
    };
    const scopeNames = {
      local: 'Local',
      closure: 'Closure',
      block: 'Bloco',
      script: 'Script',
      global: 'Global',
      module: 'Módulo',
      catch: 'Catch',
      with: 'With',
    };

    function empty(container, text) {
      container.replaceChildren(element('p', 'debug-empty', text));
    }

    function replaceInteractiveChildren(container, children) {
      const focused = document.activeElement;
      const focusKey = container.contains(focused) ? focused.dataset.debugKey : null;
      container.replaceChildren(...children);
      if (!focusKey) return;
      const controls = Array.from(container.querySelectorAll('[data-debug-key]'));
      const replacement =
      controls.find((control) => control.dataset.debugKey === focusKey) || controls[0];
      replacement?.focus({ preventScroll: true });
    }

    function valueRow(session, name, value, label, revision, depth = 0) {
      const expandable = !!value?.objectId && depth < 5;
      const row = element(expandable ? 'details' : 'div', 'debug-value');
      const title = element(expandable ? 'summary' : 'div', 'debug-value-title');
      title.append(
        element('span', 'debug-value-name', name),
        element('code', 'debug-value-description', label),
      );
      row.append(title);
      if (!expandable) return row;
      let loaded = false;
      row.addEventListener('toggle', async () => {
          if (!row.open || loaded) return;
          loaded = true;
          const children = element('div', 'debug-value-children');
          row.append(children);
          empty(children, 'Carregando…');
          try {
            const properties = await debug.inspection.properties(session, value.objectId, revision);
            if (!row.isConnected) return;
            children.replaceChildren(
              ...properties.map((property) =>
                valueRow(session, property.name, property.value, property.label, revision, depth + 1),
              ),
            );
            if (!properties.length) empty(children, 'Sem propriedades próprias.');
            if (properties.length === 200)
            children.append(
              element(
                'p',
                'debug-help',
                'Exibindo até 200 propriedades. Use watch para acessar um item específico.',
              ),
            );
          } catch (error) {
            if (row.isConnected) empty(children, error.message);
          }
      });
      return row;
    }

    class PanelRenderer {
      constructor(view, session, actions) {
        this.view = view;
        this.session = session;
        this.actions = actions;
        this.inspectionKey = '';
        this.watchGroup = '';
        this.watchConnection = null;
        this.renderSequence = 0;
        this.stackKey = '';
        this.breakpointKey = '';
      }

      render(project, pending, error = '') {
        const view = this.view;
        const session = this.session;
        const belongs = session.project === project;
        const state = belongs ? session.state : 'idle';
        view.status.dataset.state = state;
        view.status.textContent = pending
        ? 'Preparando sessão…'
        : session.pauseRequested && belongs
        ? 'Pausa solicitada · aguardando JavaScript'
        : states[state] || state;
        view.projectName.textContent = project ? project.name : 'Abra um projeto para depurar.';
        const preferences = debug.preferences.forProject(project);
        const entries = project
        ? Array.from(project.files.keys()).filter(debug.paths.isJavaScript).sort()
        : [];
        const entryKey = JSON.stringify([project?.id, entries]);
        const changedProject = this.renderedProject !== project;
        if (changedProject) {
          this.renderedProject = project;
          view.root.value = preferences.sourceRoot;
        }
        if (this.entryKey !== entryKey || changedProject) {
          this.entryKey = entryKey;
          const previousEntry = changedProject ? '' : view.entry.value;
          view.entry.replaceChildren(
            ...entries.map((path) => {
                const option = element('option', '', path);
                option.value = path;
                return option;
            }),
          );
          if (!entries.length) view.entry.append(element('option', '', 'Nenhuma entrada JavaScript'));
          view.entry.value =
          [previousEntry, preferences.entry, project?.openFile, entries[0]].find((path) =>
            entries.includes(path),
          ) || '';
        }
        const connected = ['connecting', 'running', 'paused'].includes(state);
        view.entry.disabled = connected || pending || !entries.length;
        view.launch.disabled = connected || pending || !entries.length;
        view.attach.disabled = connected || pending || !project;
        view.endpoint.disabled = connected || pending;
        view.root.disabled = connected || pending;
        for (const control of view.controls.children) {
          const action = control.dataset.debugAction;
          control.disabled =
          action === 'stop'
          ? !(connected || pending || this.actions.hasProcess())
          : pending ||
          session.busy ||
          (action === 'pause'
            ? state !== 'running' || session.pauseRequested
            : state !== 'paused');
        }
        const frame = state === 'paused' ? session.frames[session.selectedFrame] : null;
        const changed = frame?.path && session.sourceChanged(frame.path);
        view.notice.textContent =
        error ||
        (belongs ? session.message : '') ||
        (changed
          ? 'O arquivo foi alterado depois do início. Reinicie a depuração; a linha de execução não será marcada em uma fonte diferente.'
          : '');
        view.notice.hidden = !view.notice.textContent;
        view.location.textContent = frame
        ? `${frame.functionName || '(anônimo)'} · ${frame.path || frame.url || 'Fonte externa'}:${frame.line}`
        : 'Pause a execução para inspecionar o estado.';
        view.location.hidden = !frame;
        this.renderStack(frame ? session.frames : []);
        this.renderBreakpoints(project, preferences, belongs);
        const inspectionKey = JSON.stringify([
            project?.id,
            state,
            session.pauseRevision,
            preferences.watches,
        ]);
        if (this.inspectionKey !== inspectionKey || changedProject) {
          this.inspectionKey = inspectionKey;
          this.renderInspection(project, frame);
        }
      }

      renderStack(frames) {
        const stackKey = JSON.stringify([
            this.session.generation,
            this.session.pauseRevision,
            this.session.selectedFrame,
            frames.map((frame) => frame.callFrameId),
        ]);
        if (this.stackKey === stackKey) return;
        this.stackKey = stackKey;
        if (!frames.length) return empty(this.view.stack, 'Nenhum frame pausado.');
        replaceInteractiveChildren(
          this.view.stack,
          frames.map((frame, index) => {
              const row = button(frame.functionName || '(anônimo)', 'frame', null);
              row.classList.add('debug-frame');
              row.dataset.debugKey = `frame:${frame.callFrameId}`;
              row.setAttribute('aria-pressed', String(index === this.session.selectedFrame));
              row.append(
                element(
                  'span',
                  'debug-frame-location',
                  `${frame.path || frame.url || 'Fonte externa'}:${frame.line}:${frame.column}`,
                ),
              );
              row.addEventListener('click', () => this.actions.selectFrame(index));
              return row;
          }),
        );
      }

      renderBreakpoints(project, preferences, belongs) {
        const entries = preferences.breakpoints.map((breakpoint) => {
            const native = belongs
            ? this.session.breakpoints.get(debug.paths.breakpointKey(breakpoint))
            : null;
            const sourceError =
            belongs && ['running', 'paused'].includes(this.session.state)
            ? this.session.breakpointSourceError(breakpoint.path)
            : '';
            const resolved = !sourceError && native?.locations?.[0];
            const status = !breakpoint.enabled
            ? 'Desativado'
            : sourceError ||
            native?.error ||
            (resolved ? `Confirmado · linha ${resolved.lineNumber + 1}` : 'Pendente');
            return { breakpoint, resolved, status };
        });
        const breakpointKey = JSON.stringify([
            project?.id,
            entries.map(({ breakpoint, resolved, status }) => [
                breakpoint.path,
                breakpoint.line,
                breakpoint.enabled,
                !!resolved,
                status,
            ]),
        ]);
        if (this.breakpointKey === breakpointKey) return;
        this.breakpointKey = breakpointKey;
        if (!entries.length) return empty(this.view.breakpoints, 'Nenhum breakpoint.');
        replaceInteractiveChildren(
          this.view.breakpoints,
          entries.map(({ breakpoint, resolved, status }) => {
              const key = debug.paths.breakpointKey(breakpoint);
              const row = element('div', 'debug-breakpoint');
              const toggle = button(
                breakpoint.enabled ? 'Desativar breakpoint' : 'Ativar breakpoint',
                'toggleBreakpoint',
                null,
                false,
              );
              toggle.dataset.debugKey = `${key}:toggle`;
              toggle.setAttribute('aria-pressed', String(breakpoint.enabled));
              const dot = element('span', 'debug-breakpoint-dot');
              dot.dataset.verified = String(!!resolved && breakpoint.enabled);
              toggle.append(dot);
              toggle.addEventListener('click', () => this.actions.enableBreakpoint(breakpoint));
              const link = button(`${breakpoint.path}:${breakpoint.line}`, 'openBreakpoint', null);
              link.dataset.debugKey = `${key}:open`;
              link.classList.add('debug-breakpoint-location');
              link.append(element('small', '', status));
              link.addEventListener('click', () =>
                this.actions.navigate(breakpoint.path, breakpoint.line),
              );
              const remove = button('Remover breakpoint', 'removeBreakpoint', 'close', false);
              remove.dataset.debugKey = `${key}:remove`;
              remove.addEventListener('click', () => this.actions.removeBreakpoint(breakpoint));
              row.append(toggle, link, remove);
              return row;
          }),
        );
      }

      async renderInspection(project, frame) {
        const sequence = ++this.renderSequence;
        const session = this.session;
        const previousConnection = this.watchConnection;
        const previousGroup = this.watchGroup;
        this.watchConnection = session.connection;
        this.watchGroup = `synapse-debug-watch-${sequence}`;
        if (previousGroup && previousConnection?.opened && !previousConnection.closed)
        previousConnection
        .request('Runtime.releaseObjectGroup', { objectGroup: previousGroup })
        .catch((error) => this.actions.diagnostic(error));
        const preferences = debug.preferences.forProject(project);
        if (!frame) empty(this.view.variables, 'As variáveis aparecem ao pausar.');
        else {
          const revision = session.pauseRevision;
          this.view.variables.replaceChildren(
            ...(frame.scopeChain || []).map((scope) =>
              valueRow(
                session,
                scopeNames[scope.type] || scope.type,
                scope.object,
                scope.name || scopeNames[scope.type] || scope.type,
                revision,
              ),
            ),
          );
          if (frame.this)
          this.view.variables.append(
            valueRow(session, 'this', frame.this, debug.inspection.describe(frame.this), revision),
          );
        }
        if (!preferences.watches.length)
        return empty(this.view.watch, 'Adicione uma expressão, como total ou user.name.');
        const revision = session.pauseRevision;
        const group = this.watchGroup;
        this.view.watch.replaceChildren(
          ...preferences.watches.map((expression) => {
              const row = element('div', 'debug-watch');
              const content = element('div', 'debug-watch-content');
              content.append(
                valueRow(
                  session,
                  expression,
                  null,
                  frame ? 'Avaliando…' : 'Aguardando pausa',
                  revision,
                ),
              );
              const remove = button('Remover watch', 'removeWatch', 'close', false);
              remove.addEventListener('click', () => this.actions.removeWatch(expression));
              row.append(content, remove);
              if (frame)
              debug.inspection
              .watch(session, expression, revision, group)
              .then((result) => {
                  if (sequence !== this.renderSequence) return;
                  content.replaceChildren(
                    valueRow(session, expression, result.value, result.label, revision),
                  );
                  row.classList.toggle('debug-watch-error', !!result.error);
              })
              .catch((error) => {
                  if (sequence === this.renderSequence)
                  content.replaceChildren(
                    valueRow(session, expression, null, error.message, revision),
                  );
              });
              return row;
          }),
        );
      }
    }

    debug.PanelRenderer = PanelRenderer;
})();
