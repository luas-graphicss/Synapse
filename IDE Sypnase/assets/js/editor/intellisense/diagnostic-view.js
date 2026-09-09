(function (root) {
    'use strict';

    const namespace = root.SynapseIntelligence;

    function createOffsetMapper(rawText, normalizedText) {
      if (rawText === normalizedText) return (offset) => offset;
      const offsets = new Int32Array(normalizedText.length + 1);
      let rawIndex = 0;
      for (let index = 0; index < normalizedText.length; index++) {
        const character = normalizedText[index];
        while (
          rawIndex < rawText.length &&
          rawText[rawIndex] !== character &&
          !(character === '\n' && rawText[rawIndex] === '\r')
        )
        rawIndex++;
        offsets[index] = rawIndex;
        rawIndex++;
      }
      offsets[normalizedText.length] = rawText.length;
      return (offset) => offsets[Math.max(0, Math.min(normalizedText.length, offset))];
    }

    function createDiagnosticView(elements, actions) {
      const { editorPane, editorTabs, codeTa, gutter } = elements;
      const toolbar = document.createElement('div');
      toolbar.className = 'intellisense-toolbar';
      toolbar.setAttribute('data-i18n', 'off');
      toolbar.setAttribute('role', 'group');
      toolbar.setAttribute('aria-label', 'IntelliSense');
      const status = document.createElement('span');
      status.id = 'intellisenseStatus';
      status.className = 'intellisense-status';
      status.setAttribute('role', 'status');
      const controls = document.createElement('div');
      controls.className = 'intellisense-actions';
      const buttons = {};
      for (const key of ['suggest', 'definition', 'back', 'problems', 'retry']) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'intellisense-button';
        button.dataset.intellisenseAction = key;
        button.addEventListener('click', () => (key === 'problems' ? toggle() : actions[key]()));
        buttons[key] = button;
        controls.appendChild(button);
      }
      buttons.suggest.hidden = !!root.SynapseAutocomplete;
      toolbar.append(status, controls);
      editorTabs.after(toolbar);
      const panel = document.createElement('section');
      panel.id = 'intellisenseProblems';
      panel.className = 'intellisense-problems';
      panel.setAttribute('data-i18n', 'off');
      panel.hidden = true;
      const heading = document.createElement('div');
      heading.className = 'intellisense-problems-heading';
      const title = document.createElement('strong');
      const close = document.createElement('button');
      close.type = 'button';
      close.textContent = '×';
      close.addEventListener('click', () => toggle(false));
      heading.append(title, close);
      const list = document.createElement('div');
      list.className = 'intellisense-problem-list';
      panel.append(heading, list);
      editorPane.appendChild(panel);
      buttons.problems.setAttribute('aria-controls', panel.id);
      buttons.problems.setAttribute('aria-expanded', 'false');
      const overlay = document.createElement('pre');
      overlay.className = 'intellisense-diagnostics-overlay';
      overlay.setAttribute('aria-hidden', 'true');
      overlay.setAttribute('data-i18n', 'off');
      codeTa.parentElement.appendChild(overlay);
      const gutterTitles = new WeakMap();
      let current = { state: 'empty', items: [], text: '', path: null };
      let markerPending = false;
      let disposed = false;

      function toggle(open = panel.hidden) {
        panel.hidden = !open;
        buttons.problems.setAttribute('aria-expanded', String(open));
        if (open) refresh();
        else codeTa.focus({ preventScroll: true });
      }
      function clearMarkers() {
        overlay.replaceChildren();
        gutter.querySelectorAll('[data-intellisense-line]').forEach((line) => {
            line.classList.remove('intellisense-line-error', 'intellisense-line-warning');
            line.removeAttribute('data-intellisense-line');
            const previous = gutterTitles.get(line);
            if (previous && line.title === previous.assigned) {
              if (previous.original === null) line.removeAttribute('title');
              else line.setAttribute('title', previous.original);
            }
            gutterTitles.delete(line);
        });
      }
      function drawMarkers() {
        markerPending = false;
        if (disposed) return;
        buttons.suggest.disabled = !current.script || codeTa.readOnly || codeTa.disabled;
        buttons.definition.disabled =
        !current.script || codeTa.readOnly || codeTa.disabled || current.state === 'unavailable';
        clearMarkers();
        if (!current.path || codeTa.readOnly || codeTa.disabled || !current.items.length) return;
        const rawText = codeTa.value;
        if (namespace.projectModel.normalizeText(rawText) !== current.text) return;
        const toRawOffset = createOffsetMapper(rawText, current.text);
        const style = getComputedStyle(codeTa);
        for (const property of [
            'fontFamily',
            'fontSize',
            'fontWeight',
            'lineHeight',
            'letterSpacing',
            'tabSize',
            'fontStyle',
            'fontStretch',
            'fontKerning',
            'fontVariantLigatures',
            'fontVariantNumeric',
            'fontFeatureSettings',
            'fontVariationSettings',
            'wordSpacing',
            'textRendering',
            'textIndent',
            'textTransform',
            'direction',
            'padding',
            'boxSizing',
        ])
        overlay.style[property] = style[property];
        positionMarkers();
        const markerText = rawText + '\u00a0';
        let cursor = 0;
        const orderedItems = [...current.items].sort(
          (first, second) => first.start - second.start || (first.severity === 'error' ? -1 : 1),
        );
        for (const item of orderedItems) {
          const itemStart = toRawOffset(item.start);
          const start = Math.max(cursor, itemStart);
          const characterLength = markerText.codePointAt(itemStart) > 0xffff ? 2 : 1;
          const end = Math.min(
            markerText.length,
            Math.max(toRawOffset(item.start + item.length), itemStart + characterLength),
          );
          if (end <= start) continue;
          overlay.appendChild(document.createTextNode(markerText.slice(cursor, start)));
          const range = document.createElement('span');
          range.className = 'intellisense-range-' + item.severity;
          range.textContent = markerText.slice(start, end);
          overlay.appendChild(range);
          cursor = end;
        }
        overlay.appendChild(document.createTextNode(markerText.slice(cursor) + '\n'));
        const lines = new Map();
        for (const item of current.items) {
          if (!lines.has(item.line)) lines.set(item.line, []);
          lines.get(item.line).push(item);
        }
        gutter.querySelectorAll('.gln').forEach((line) => {
            const issues = lines.get(Number(line.querySelector('.gnum')?.textContent));
            if (!issues) return;
            const assigned = issues.map((item) => `${item.code}: ${item.message}`).join('\n');
            gutterTitles.set(line, { original: line.getAttribute('title'), assigned });
            line.dataset.intellisenseLine = 'true';
            line.classList.add(
              issues.some((item) => item.severity === 'error')
              ? 'intellisense-line-error'
              : 'intellisense-line-warning',
            );
            line.title = assigned;
        });
      }
      function positionMarkers() {
        overlay.style.left = `${codeTa.offsetLeft + codeTa.clientLeft - codeTa.scrollLeft}px`;
        overlay.style.top = `${codeTa.offsetTop + codeTa.clientTop - codeTa.scrollTop}px`;
      }
      function queueMarkers() {
        if (markerPending || disposed) return;
        markerPending = true;
        queueMicrotask(drawMarkers);
      }
      function refresh() {
        if (disposed) return;
        const translate = namespace.label;
        for (const [key, button] of Object.entries(buttons)) button.textContent = translate(key);
        const count = current.total ?? current.items.length;
        buttons.problems.textContent =
        translate('problems') +
        (current.state === 'ready' || current.state === 'structure' || current.syntaxChecked
          ? ` · ${count}`
          : '');
        buttons.problems.dataset.severity = current.items.some((item) => item.severity === 'error')
        ? 'error'
        : 'none';
        buttons.retry.hidden = !['unavailable', 'syntaxOnly'].includes(current.state);
        buttons.back.disabled = !actions.canGoBack();
        buttons.suggest.title = translate('suggest') + ' (Ctrl+Space)';
        buttons.definition.title = translate('definition') + ' (F12)';
        buttons.back.title = translate('back') + ' (Alt+←)';
        buttons.problems.title = translate('problems') + ' (Ctrl/⌘+Shift+M)';
        const statusKey =
        current.state !== 'ready'
        ? current.state
        : current.configurationErrors?.length
        ? 'config'
        : current.omitted
        ? 'partial'
        : 'ready';
        status.textContent = current.message || translate(statusKey);
        status.title = current.error || translate('download');
        status.dataset.state = current.state;
        title.textContent = translate('problems') + ' · ' + translate('currentFile');
        close.setAttribute('aria-label', translate('close'));
        codeTa.setAttribute('aria-label', translate('editor'));
        toolbar.title = translate('help');
        list.replaceChildren();
        const appendNote = (text) => {
          const note = document.createElement('p');
          note.className = 'intellisense-problem-note';
          note.textContent = text;
          list.appendChild(note);
        };
        if (current.omitted) appendNote(`${translate('partial')} · ${current.omitted}`);
        for (const message of current.configurationErrors || [])
        appendNote(`${translate('config')}: ${message}`);
        if (!current.items.length && !current.configurationErrors?.length)
        appendNote(
          translate(['ready', 'structure'].includes(current.state) ? 'clean' : current.state),
        );
        const expectedText = current.text;
        for (const item of current.items) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'intellisense-problem';
          button.dataset.severity = item.severity;
          const location = document.createElement('span');
          location.className = 'intellisense-problem-location';
          location.textContent = `${item.severity === 'error' ? '×' : '!'} ${item.path}:${item.line}:${item.column} · ${item.code}`;
          const message = document.createElement('span');
          message.textContent = item.message;
          button.append(location, message);
          button.addEventListener('click', () => actions.navigate(item, expectedText));
          list.appendChild(button);
        }
        if (count > current.items.length) appendNote(`${current.items.length} / ${count}`);
        queueMarkers();
      }
      const observer = new MutationObserver(queueMarkers);
      observer.observe(gutter, { childList: true });
      const resizeObserver =
      typeof ResizeObserver === 'function' ? new ResizeObserver(queueMarkers) : null;
      resizeObserver?.observe(codeTa);
      const geometryObserver = new MutationObserver(queueMarkers);
      for (const element of [codeTa, document.documentElement, document.body]) {
        if (element)
        geometryObserver.observe(element, {
            attributes: true,
            attributeFilter: ['class', 'style'],
        });
      }
      codeTa.addEventListener('scroll', positionMarkers, { passive: true });
      root.addEventListener('resize', queueMarkers);
      document.fonts?.addEventListener('loadingdone', queueMarkers);
      function update(next) {
        if (next.path !== current.path || next.text !== current.text || !next.items?.length)
        clearMarkers();
        current = { items: [], text: '', ...next };
        refresh();
      }
      panel.addEventListener('keydown', (event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            toggle(false);
          }
      });
      return Object.freeze({
          update,
          refresh,
          toggle,
          drawMarkers,
          elements: { toolbar, panel, status },
          dispose() {
            disposed = true;
            observer.disconnect();
            resizeObserver?.disconnect();
            geometryObserver.disconnect();
            codeTa.removeEventListener('scroll', positionMarkers);
            root.removeEventListener('resize', queueMarkers);
            document.fonts?.removeEventListener('loadingdone', queueMarkers);
            clearMarkers();
            toolbar.remove();
            panel.remove();
            overlay.remove();
          },
      });
    }
    namespace.createDiagnosticView = createDiagnosticView;
})(globalThis);
