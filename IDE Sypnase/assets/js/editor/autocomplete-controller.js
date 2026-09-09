(function () {
    'use strict';

    const textarea = document.getElementById('codeTa');
    if (!textarea || window.SynapseAutocomplete) return;
    const menu = window.SynapseAutocompleteMenu.createMenu(textarea, acceptSuggestion, loadDetail);
    const providers = new Map();
    let snapshot = null;
    let timer = 0;
    let sequence = 0;
    let detailSequence = 0;
    let requestController = null;
    let composing = false;
    let accepting = false;
    let menuPointerDown = false;

    function getDocument() {
      const features = window.SynapseEditorFeatureSettings;
      if (features && !features.isAutocompleteEnabled()) return null;
      const project = activeProject();
      const file = project?.files.get(project.openFile);
      const grid = document.getElementById('editorGrid');
      if (
        !file?.isText ||
        typeof file.text !== 'string' ||
        file.text.replace(/\r\n?/g, '\n') !== textarea.value ||
        textarea.readOnly ||
        textarea.disabled ||
        !grid?.getClientRects().length ||
        textarea.selectionStart !== textarea.selectionEnd
      )
      return null;
      return {
        project,
        file,
        path: project.openFile,
        source: textarea.value,
        position: textarea.selectionStart,
      };
    }

    function matchesDocument(captured) {
      const current = getDocument();
      return (
        !!current &&
        !!captured &&
        current.project === captured.project &&
        current.file === captured.file &&
        current.path === captured.path &&
        current.source === captured.source &&
        current.position === captured.position
      );
    }

    function dismiss() {
      clearTimeout(timer);
      timer = 0;
      sequence++;
      detailSequence++;
      requestController?.abort();
      requestController = null;
      snapshot = null;
      menu.close();
    }

    async function requestSuggestions(explicit = false) {
      dismiss();
      if (composing || accepting || document.activeElement !== textarea) return;
      if (explicit && !textarea.readOnly && !textarea.disabled)
      window.EditorFolding?.expandBeforeInput();
      const captured = getDocument();
      if (!captured) return;
      const requestSequence = sequence;
      const controller = new AbortController();
      requestController = controller;
      let result = null;
      let selectedProvider = null;
      try {
        for (const provider of [...providers.values()].reverse()) {
          if (!provider.supports(captured)) continue;
          result = await provider.complete({ ...captured, explicit, signal: controller.signal });
          if (controller.signal.aborted || requestSequence !== sequence || !matchesDocument(captured))
          return;
          if (result !== null && result !== undefined) {
            selectedProvider = provider;
            break;
          }
        }
        if (result === null || result === undefined) {
          result = window.SynapseCompletionProvider.getCompletions({ ...captured, explicit });
        }
        if (
          controller.signal.aborted ||
          requestSequence !== sequence ||
          !matchesDocument(captured) ||
          document.activeElement !== textarea
        )
        return;
        if (!result?.items?.length) return;
        snapshot = { ...captured, result, provider: selectedProvider };
        menu.show(result);
      } catch (error) {
        if (!controller.signal.aborted) window.ignorarErro?.(error, 'autocomplete.request');
      } finally {
        if (requestController === controller) requestController = null;
      }
    }

    function scheduleSuggestions() {
      dismiss();
      if (composing || accepting) return;
      const captured = getDocument();
      queueMicrotask(() => {
          if (!composing && matchesDocument(captured) && document.activeElement === textarea)
          timer = setTimeout(() => requestSuggestions(), 100);
      });
    }

    async function loadDetail(item) {
      const captured = snapshot;
      if (!captured?.provider?.resolve || !matchesDocument(captured)) return;
      const currentSequence = ++detailSequence;
      try {
        const result = await captured.provider.resolve(item, captured);
        if (currentSequence === detailSequence && snapshot === captured && matchesDocument(captured))
        menu.updateDetail(item, result);
      } catch (error) {
        window.ignorarErro?.(error, 'autocomplete.detail');
      }
    }

    function acceptSuggestion(index = menu.selectedIndex) {
      if (!matchesDocument(snapshot) || composing) return dismiss();
      const item = snapshot.result.items[index];
      if (!item) return;
      const start = item.start ?? snapshot.result.start;
      const end = item.end ?? snapshot.result.end;
      const source = textarea.value;
      if (
        !Number.isInteger(start) ||
        !Number.isInteger(end) ||
        start < 0 ||
        end < start ||
        end > source.length ||
        typeof item.insertText !== 'string'
      )
      return dismiss();
      accepting = true;
      dismiss();
      try {
        textarea.focus({ preventScroll: true });
        const selectionEnd = start + item.insertText.length;
        const documents = window.SynapseEditorDocuments;
        if (documents?.applyEdit) {
          documents.applyEdit({
              start,
              end,
              text: item.insertText,
              selectionStart: selectionEnd,
              selectionEnd,
          });
          return;
        }
        textarea.setSelectionRange(start, end);
        if (typeof document.execCommand === 'function') {
          try {
            document.execCommand('insertText', false, item.insertText);
          } catch (error) {
            window.ignorarErro?.(error, 'autocomplete.insert');
          }
        }
        if (textarea.value === source) {
          textarea.setRangeText(item.insertText, start, end, 'end');
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
      } finally {
        accepting = false;
      }
    }

    function registerProvider(provider) {
      if (
        !provider ||
        typeof provider.id !== 'string' ||
        !provider.id ||
        typeof provider.supports !== 'function' ||
        typeof provider.complete !== 'function'
      )
      throw new TypeError('Invalid completion provider');
      dismiss();
      providers.set(provider.id, provider);
      return Object.freeze({
          dispose() {
            if (providers.get(provider.id) === provider) {
              dismiss();
              providers.delete(provider.id);
            }
          },
      });
    }

    textarea.addEventListener('input', scheduleSuggestions);
    textarea.addEventListener('compositionstart', () => {
        composing = true;
        dismiss();
    });
    textarea.addEventListener('compositionend', () => {
        composing = false;
        scheduleSuggestions();
    });
    textarea.addEventListener(
      'keydown',
      (event) => {
        if (event.defaultPrevented || event.isComposing || composing || event.keyCode === 229) return;
        if (
          (event.ctrlKey || event.metaKey) &&
          !event.altKey &&
          (event.code === 'Space' || event.key === ' ')
        ) {
          if (textarea.readOnly || textarea.disabled) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          requestSuggestions(true);
          return;
        }
        if (event.key === 'Escape') {
          const wasOpen = menu.isOpen;
          dismiss();
          if (wasOpen) event.preventDefault();
          return;
        }
        if (!menu.isOpen) return;
        if (!matchesDocument(snapshot)) {
          dismiss();
          return;
        }
        if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return dismiss();
        if (['ArrowDown', 'ArrowUp', 'Enter', 'Tab'].includes(event.key)) {
          event.preventDefault();
          event.stopImmediatePropagation();
          if (event.key === 'ArrowDown') menu.move(1);
          else if (event.key === 'ArrowUp') menu.move(-1);
          else acceptSuggestion();
        } else if (
          ['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)
        )
        dismiss();
      },
      true,
    );
    textarea.addEventListener('blur', () => {
        if (!menuPointerDown) dismiss();
    });
    document.addEventListener(
      'pointerdown',
      (event) => {
        menuPointerDown = menu.contains(event.target);
        if (event.target !== textarea && !menuPointerDown) dismiss();
      },
      true,
    );
    document.addEventListener(
      'pointerup',
      () => {
        menuPointerDown = false;
      },
      true,
    );
    document.addEventListener(
      'pointercancel',
      () => {
        menuPointerDown = false;
        dismiss();
      },
      true,
    );
    document.addEventListener('selectionchange', () => {
        if (snapshot && !matchesDocument(snapshot)) dismiss();
    });
    function repositionSuggestions() {
      if (!menu.isOpen) return;
      const captured = snapshot;
      requestAnimationFrame(() => {
          if (snapshot !== captured || !menu.isOpen) return;
          if (matchesDocument(captured)) menu.position();
          else dismiss();
      });
    }
    document
    .getElementById('editorScroll')
    ?.addEventListener('scroll', repositionSuggestions, { passive: true });
    textarea.addEventListener('scroll', repositionSuggestions, { passive: true });
    window.addEventListener('resize', repositionSuggestions);
    const resizeObserver = new ResizeObserver(repositionSuggestions);
    const editorPane = document.getElementById('editorPane');
    if (editorPane) resizeObserver.observe(editorPane);
    resizeObserver.observe(textarea);
    window.visualViewport?.addEventListener('resize', repositionSuggestions);
    window.visualViewport?.addEventListener('scroll', repositionSuggestions);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) dismiss();
    });
    window.addEventListener('pagehide', dismiss);

    const observer = new MutationObserver(() => {
        if (snapshot && !matchesDocument(snapshot)) dismiss();
    });
    observer.observe(textarea, { attributes: true, attributeFilter: ['readonly', 'disabled'] });
    for (const identifier of ['editorGrid', 'editorPane', 'editorTitle', 'codeHl']) {
      const element = document.getElementById(identifier);
      if (element)
      observer.observe(element, {
          attributes: true,
          attributeFilter: ['class', 'style'],
          childList: true,
          subtree: true,
      });
    }

    const button = document.createElement('button');
    button.id = 'autocompleteBtn';
    button.type = 'button';
    button.className = 'eh-btn editor-autocomplete-trigger';
    button.innerHTML = typeof iconSvg === 'function' ? iconSvg('completion') : 'ABC';
    function refreshLabels() {
      button.title =
      (window.SynapseIntelligence?.label?.('suggestions') || 'Sugestões de código') +
      ' (Ctrl/⌘ + Space)';
      button.setAttribute('aria-label', button.title);
      dismiss();
    }
    refreshLabels();
    document.addEventListener('synapse:idioma', refreshLabels);
    button.addEventListener('click', () => {
        textarea.focus({ preventScroll: true });
        requestSuggestions(true);
    });
    document.getElementById('fmtBtn')?.before(button);
    document.getElementById('codeHl')?.setAttribute('aria-hidden', 'true');
    window.SynapseAutocomplete = Object.freeze({
        request: requestSuggestions,
        dismiss,
        registerProvider,
    });
})();
