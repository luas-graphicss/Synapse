(function () {
    'use strict';

    const debug = window.SynapseDebug;

    class EditorBridge {
      constructor(session, toggleBreakpoint) {
        this.session = session;
        this.toggleBreakpoint = toggleBreakpoint;
        this.gutter = document.getElementById('gutter');
        this.textarea = document.getElementById('codeTa');
        this.highlight = document.createElement('div');
        this.highlight.className = 'debug-current-line';
        this.highlight.hidden = true;
        this.highlight.setAttribute('aria-hidden', 'true');
        document.querySelector('.code-wrap')?.append(this.highlight);
        this.gutter?.addEventListener('click', (event) => {
            if (event.target.closest('[data-fold]')) return;
            const line = Number(event.target.closest('.gln')?.querySelector('.gnum')?.textContent);
            if (Number.isSafeInteger(line) && line > 0) this.toggleBreakpoint(line);
        });
      }

      cursorLine() {
        if (!this.textarea) return 0;
        const visibleIndex =
        this.textarea.value.slice(0, this.textarea.selectionStart).split('\n').length - 1;
        const projection = window.EditorFolding?.displayText();
        if (projection !== undefined && projection !== this.textarea.value) return visibleIndex + 1;
        const number = this.gutter?.children[visibleIndex]?.querySelector('.gnum');
        return number ? Number(number.textContent) : visibleIndex + 1;
      }

      refresh(project) {
        if (!this.gutter) return;
        const path = project?.openFile;
        const supported = !!project && debug.paths.isJavaScript(path);
        this.gutter.classList.toggle('debug-gutter', supported);
        this.highlight.hidden = true;
        const session = this.session;
        const belongs = session.project === project;
        const current =
        belongs && session.state === 'paused' ? session.frames[session.selectedFrame] : null;
        const markCurrent =
        !!current &&
        current.path === path &&
        !session.sourceChanged(path) &&
        session.verifiedSources?.get(current.location.scriptId) === true;
        const breakpoints = new Map(
          debug.preferences
          .forProject(project)
          .breakpoints.filter((entry) => entry.path === path)
          .map((entry) => [entry.line, entry]),
        );
        for (const [index, row] of Array.from(this.gutter.children).entries()) {
          const number = row.querySelector('.gnum');
          const line = Number(number?.textContent);
          const breakpoint = supported ? breakpoints.get(line) : null;
          if (breakpoint) {
            const native = belongs
            ? session.breakpoints.get(debug.paths.breakpointKey(breakpoint))
            : null;
            row.dataset.debugBreakpoint = !breakpoint.enabled
            ? 'disabled'
            : native?.locations.length && !session.sourceChanged(path)
            ? 'verified'
            : 'pending';
          } else delete row.dataset.debugBreakpoint;
          const isCurrent = supported && markCurrent && current.line === line;
          if (isCurrent) {
            row.dataset.debugCurrent = 'true';
            const lineHeight = parseFloat(getComputedStyle(this.textarea).lineHeight) || 20;
            const top = parseFloat(getComputedStyle(this.highlight.parentElement).paddingTop) || 10;
            this.highlight.style.top = `${top + index * lineHeight}px`;
            this.highlight.style.height = `${lineHeight}px`;
            this.highlight.hidden = false;
          } else delete row.dataset.debugCurrent;
          if (number)
          number.title = supported
          ? `${breakpoint ? 'Remover' : 'Adicionar'} breakpoint · linha ${line} · F9`
          : '';
        }
      }
    }

    debug.EditorBridge = EditorBridge;
})();
