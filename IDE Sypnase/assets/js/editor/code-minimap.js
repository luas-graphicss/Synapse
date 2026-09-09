(function () {
    'use strict';

    const canvas = el.miniMap;
    const scroll = el.editorScroll;
    const cachedCanvas = document.createElement('canvas');
    const maximumSamples = 4000;
    let enabled = false;
    let sourceText = '';
    let sourceLanguage = '';
    let lineCount = 1;
    let samples = [];
    let samplesDirty = false;
    let cacheDirty = true;
    let frameScheduled = false;
    let pointerDrag = null;
    let metrics = window.EditorMinimapGeometry.measure(0, 0, 1, 0);
    let cacheRebuildCount = 0;
    let overlayContext = null;
    let cachedContext = null;
    let themeColors = null;

    function readPreference() {
      try {
        return localStorage.getItem('aurora.minimap') === '1';
      } catch (error) {
        ignorarErro(error, 'readMinimapPreference');
        return false;
      }
    }

    function savePreference(value) {
      try {
        localStorage.setItem('aurora.minimap', value ? '1' : '0');
      } catch (error) {
        ignorarErro(error, 'saveMinimapPreference');
      }
    }

    function updateSamples(text) {
      const lines = text.split('\n');
      lineCount = lines.length;
      const stride = Math.max(1, Math.ceil(lineCount / maximumSamples));
      samples = [];
      for (let start = 0; start < lineCount; start += stride) {
        let sample = null;
        for (let index = start; index < Math.min(lineCount, start + stride); index += 1) {
          const line = lines[index].slice(0, 200).replace(/\t/g, '  ');
          const trimmed = line.trim();
          if (!trimmed || (sample && sample.length >= trimmed.length)) continue;
          sample = {
            line: index,
            indent: line.length - line.trimStart().length,
            length: trimmed.length,
            comment: /^(\/\/|\/\*|\*|<!--|#|--)/.test(trimmed),
          };
        }
        if (sample) samples.push(sample);
      }
      cacheDirty = true;
    }

    function drawMinimap(text, language) {
      if (typeof text === 'string' && text !== sourceText) {
        sourceText = text;
        samplesDirty = true;
      }
      if (typeof language === 'string' && language !== sourceLanguage) {
        sourceLanguage = language;
        cacheDirty = true;
      }
      refreshMinimap();
    }

    function updateVisibility() {
      return layout.synchronize();
    }

    function renderCachedCode(width, height, pixelRatio, colors) {
      if (cachedCanvas.width !== canvas.width || cachedCanvas.height !== canvas.height) {
        cachedCanvas.width = canvas.width;
        cachedCanvas.height = canvas.height;
      }
      if (!cachedContext) cachedContext = cachedCanvas.getContext('2d');
      const context = cachedContext;
      if (!context) return false;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.fillStyle = colors.background;
      context.fillRect(0, 0, width, height);
      const lineHeight = metrics.trackHeight / Math.max(1, lineCount);
      for (const sample of samples) {
        context.fillStyle = sample.comment ? colors.comment : colors.text;
        context.globalAlpha = sample.comment ? 0.55 : 0.8;
        const left = 4 + Math.min(sample.indent, 46) * 0.62;
        const sampleWidth = Math.min(width - left - 4, Math.max(2, sample.length * 0.62));
        if (sampleWidth > 0) {
          context.fillRect(
            left,
            sample.line * lineHeight,
            sampleWidth,
            Math.max(1 / pixelRatio, lineHeight - 0.4),
          );
        }
      }
      context.globalAlpha = 1;
      cacheDirty = false;
      cacheRebuildCount += 1;
      return true;
    }

    function readThemeColors() {
      if (themeColors) return themeColors;
      const styles = getComputedStyle(document.documentElement);
      const color = (name, fallback) => styles.getPropertyValue(name).trim() || fallback;
      themeColors = {
        background: color('--bg', '#191919'),
        text: color('--txt-2', '#b6bcc6'),
        comment: color('--tk-com', '#9b9b9b'),
        accent: color('--acc', '#5e9fe8'),
      };
      return themeColors;
    }

    function renderMinimap() {
      if (!updateVisibility() || document.hidden) return;
      const visibleText = window.EditorFolding.displayText();
      if (visibleText !== sourceText) {
        sourceText = visibleText;
        samplesDirty = true;
      }
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;
      if (samplesDirty) {
        updateSamples(sourceText);
        samplesDirty = false;
      }
      const pixelRatio = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
      const pixelWidth = Math.round(width * pixelRatio);
      const pixelHeight = Math.round(height * pixelRatio);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
        cacheDirty = true;
      }
      metrics = window.EditorMinimapGeometry.measure(
        scroll.clientHeight,
        scroll.scrollHeight,
        lineCount,
        scroll.scrollTop,
      );
      const colors = readThemeColors();
      if (cacheDirty && !renderCachedCode(width, height, pixelRatio, colors)) return;
      if (!overlayContext) overlayContext = canvas.getContext('2d');
      const context = overlayContext;
      if (!context) return;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, pixelWidth, pixelHeight);
      context.drawImage(cachedCanvas, 0, 0);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.fillStyle = colors.accent;
      context.globalAlpha = 0.16;
      context.fillRect(0, metrics.thumbTop, width, metrics.thumbHeight);
      context.globalAlpha = 0.8;
      context.strokeStyle = colors.accent;
      context.lineWidth = 1;
      context.strokeRect(
        0.5,
        metrics.thumbTop + 0.5,
        width - 1,
        Math.max(0, metrics.thumbHeight - 1),
      );
      context.globalAlpha = 1;
      canvas.setAttribute('aria-valuemax', String(Math.round(metrics.maximumScroll)));
      canvas.setAttribute(
        'aria-valuenow',
        String(Math.round(Math.min(metrics.maximumScroll, Math.max(0, scroll.scrollTop)))),
      );
      const percentage = metrics.maximumScroll
      ? Math.round((scroll.scrollTop / metrics.maximumScroll) * 100)
      : 0;
      canvas.setAttribute('aria-valuetext', `${percentage}% do documento`);
    }

    function refreshMinimap() {
      if (frameScheduled) return;
      frameScheduled = true;
      requestAnimationFrame(() => {
          frameScheduled = false;
          renderMinimap();
      });
    }

    function setMinimap(value) {
      enabled = Boolean(value);
      savePreference(enabled);
      el.miniBtn.classList.toggle('on', enabled);
      el.miniBtn.setAttribute('aria-pressed', String(enabled));
      el.miniBtn.setAttribute('aria-label', enabled ? 'Ocultar minimapa' : 'Mostrar minimapa');
      layout.setEnabled(enabled);
    }

    function editorLineHeight() {
      const lineHeight = parseFloat(getComputedStyle(el.codeTa).lineHeight);
      return Number.isFinite(lineHeight) && lineHeight > 0 ? lineHeight : 20;
    }

    function pointerPosition(event) {
      const bounds = canvas.getBoundingClientRect();
      return ((event.clientY - bounds.top) * canvas.clientHeight) / Math.max(1, bounds.height);
    }

    function navigatePointer(event) {
      if (!pointerDrag || event.pointerId !== pointerDrag.id) return;
      metrics = window.EditorMinimapGeometry.measure(
        scroll.clientHeight,
        scroll.scrollHeight,
        lineCount,
        scroll.scrollTop,
      );
      scroll.scrollTop = window.EditorMinimapGeometry.scrollAtPointer(
        metrics,
        pointerPosition(event),
        pointerDrag.offset,
      );
      refreshMinimap();
    }

    function finishPointer(event) {
      if (!pointerDrag || event.pointerId !== pointerDrag.id) return;
      pointerDrag = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    }

    canvas.addEventListener('pointerdown', (event) => {
        if (event.button !== 0 || event.isPrimary === false) return;
        event.preventDefault();
        canvas.focus({ preventScroll: true });
        renderMinimap();
        const position = pointerPosition(event);
        const insideThumb =
        position >= metrics.thumbTop && position <= metrics.thumbTop + metrics.thumbHeight;
        pointerDrag = {
          id: event.pointerId,
          offset: insideThumb ? position - metrics.thumbTop : metrics.thumbHeight / 2,
        };
        try {
          canvas.setPointerCapture(event.pointerId);
        } catch (error) {
          ignorarErro(error, 'captureMinimapPointer');
        }
        navigatePointer(event);
    });
    canvas.addEventListener('pointermove', navigatePointer);
    canvas.addEventListener('pointerup', finishPointer);
    canvas.addEventListener('pointercancel', finishPointer);
    canvas.addEventListener('lostpointercapture', () => {
        pointerDrag = null;
    });
    window.addEventListener('pointerup', finishPointer);
    window.addEventListener('blur', () => {
        pointerDrag = null;
    });
    canvas.addEventListener('keydown', (event) => {
        const maximumScroll = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
        const lineHeight = editorLineHeight();
        const targets = {
          ArrowUp: scroll.scrollTop - lineHeight,
          ArrowDown: scroll.scrollTop + lineHeight,
          PageUp: scroll.scrollTop - scroll.clientHeight,
          PageDown: scroll.scrollTop + scroll.clientHeight,
          Home: 0,
          End: maximumScroll,
        };
        if (!Object.hasOwn(targets, event.key) || event.altKey || event.metaKey || event.ctrlKey) {
          return;
        }
        event.preventDefault();
        scroll.scrollTop = Math.max(0, Math.min(maximumScroll, targets[event.key]));
        refreshMinimap();
    });
    canvas.addEventListener(
      'wheel',
      (event) => {
        if (event.ctrlKey) return;
        event.preventDefault();
        const multiplier =
        event.deltaMode === 1
        ? editorLineHeight()
        : event.deltaMode === 2
        ? scroll.clientHeight
        : 1;
        scroll.scrollTop += event.deltaY * multiplier;
        refreshMinimap();
      },
      { passive: false },
    );

    function invalidateAppearance() {
      themeColors = null;
      cacheDirty = true;
      refreshMinimap();
    }

    const layout = window.EditorMinimapLayout.create({
        canvas,
        scroll,
        grid: el.editorGrid,
        onResize: invalidateAppearance,
    });
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'scrollbar');
    canvas.setAttribute('aria-label', 'Minimapa do código');
    canvas.setAttribute('aria-controls', 'editorScroll');
    canvas.setAttribute('aria-orientation', 'vertical');
    canvas.setAttribute('aria-valuemin', '0');
    el.miniBtn.setAttribute('aria-controls', 'miniMap');
    el.miniBtn.addEventListener('click', () => setMinimap(!enabled));
    scroll.addEventListener('scroll', () => window.refreshMinimap(), { passive: true });
    window.addEventListener('resize', invalidateAppearance);
    if (typeof MutationObserver === 'function') {
      new MutationObserver(invalidateAppearance).observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['class', 'style', 'data-theme'],
      });
    }
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          drawMinimap(el.codeTa.value, sourceLanguage);
          invalidateAppearance();
        }
    });
    window.EditorMinimap = Object.freeze({
        inspect: () => ({
            enabled,
            lineCount,
            sampleCount: samples.length,
            cacheRebuildCount,
            ...metrics,
        }),
    });
    window.drawMinimap = drawMinimap;
    window.refreshMinimap = refreshMinimap;
    window.renderMinimap = renderMinimap;
    window.setMinimap = setMinimap;
    setMinimap(readPreference());
})();
