(function () {
    'use strict';

    function createMenu(textarea, onSelect, onHighlight = () => undefined) {
      const container = document.createElement('div');
      container.id = 'editorAutocomplete';
      container.className = 'editor-autocomplete';
      container.hidden = true;
      container.setAttribute('data-i18n', 'off');
      const list = document.createElement('div');
      list.id = 'editorAutocompleteList';
      list.className = 'editor-autocomplete-list';
      list.setAttribute('role', 'listbox');
      const detail = document.createElement('div');
      detail.className = 'editor-autocomplete-detail';
      detail.hidden = true;
      const signature = document.createElement('pre');
      const documentation = document.createElement('p');
      detail.append(signature, documentation);
      const footer = document.createElement('div');
      footer.className = 'editor-autocomplete-footer';
      const announcement = document.createElement('div');
      announcement.className = 'editor-autocomplete-status';
      announcement.setAttribute('role', 'status');
      announcement.setAttribute('aria-live', 'polite');
      container.append(list, detail, footer);
      document.body.append(container, announcement);
      let items = [];
      let selectedIndex = 0;
      const label = (key, fallback) => window.SynapseIntelligence?.label?.(key) || fallback;

      textarea.setAttribute('role', 'combobox');
      textarea.setAttribute('aria-label', label('editor', 'Editor de código'));
      textarea.setAttribute('aria-autocomplete', 'list');
      textarea.setAttribute('aria-haspopup', 'listbox');
      textarea.setAttribute('aria-controls', list.id);
      textarea.setAttribute('aria-expanded', 'false');
      textarea.setAttribute('autocomplete', 'off');
      textarea.setAttribute('autocapitalize', 'off');

      function close() {
        container.hidden = true;
        detail.hidden = true;
        items = [];
        list.replaceChildren();
        textarea.setAttribute('aria-expanded', 'false');
        textarea.removeAttribute('aria-activedescendant');
        announcement.textContent = '';
      }

      function select(index) {
        if (!items.length) return;
        selectedIndex = (index + items.length) % items.length;
        Array.from(list.children).forEach((option, optionIndex) =>
          option.setAttribute('aria-selected', String(optionIndex === selectedIndex)),
        );
        const option = list.children[selectedIndex];
        textarea.setAttribute('aria-activedescendant', option.id);
        if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop;
        if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight)
        list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight;
        detail.hidden = true;
        signature.textContent = '';
        documentation.textContent = '';
        onHighlight(items[selectedIndex]);
      }

      function position() {
        if (container.hidden) return;
        const caret = window.SynapseCaretPosition.measure(textarea);
        const viewport = window.visualViewport;
        const viewportLeft = viewport?.offsetLeft || 0;
        const viewportTop = viewport?.offsetTop || 0;
        const viewportWidth = viewport?.width || window.innerWidth;
        const viewportHeight = viewport?.height || window.innerHeight;
        const editorBounds = document.getElementById('editorScroll').getBoundingClientRect();
        const visibleTop = Math.max(editorBounds.top, viewportTop);
        const visibleBottom = Math.min(editorBounds.bottom, viewportTop + viewportHeight);
        const visibleLeft = Math.max(editorBounds.left, viewportLeft);
        const visibleRight = Math.min(editorBounds.right, viewportLeft + viewportWidth);
        if (
          caret.top + caret.height < visibleTop ||
          caret.top > visibleBottom ||
          caret.left < visibleLeft ||
          caret.left > visibleRight
        ) {
          close();
          return;
        }
        const margin = 8;
        const width = Math.min(410, viewportWidth - margin * 2);
        const below = viewportTop + viewportHeight - margin - caret.top - caret.height - 4;
        const above = caret.top - viewportTop - margin - 4;
        const openBelow = below >= Math.min(240, above);
        const availableHeight = Math.max(0, openBelow ? below : above);
        if (availableHeight < 96) {
          close();
          return;
        }
        container.style.width = `${width}px`;
        container.style.maxHeight = `${Math.min(380, availableHeight)}px`;
        container.style.left = `${Math.min(Math.max(viewportLeft + margin, caret.left), viewportLeft + viewportWidth - width - margin)}px`;
        const height = container.getBoundingClientRect().height;
        const preferredTop = openBelow ? caret.top + caret.height + 4 : caret.top - height - 4;
        container.style.top = `${Math.max(viewportTop + margin, Math.min(preferredTop, viewportTop + viewportHeight - height - margin))}px`;
      }

      function show(result) {
        const previousLabel = items[selectedIndex]?.label;
        items = result.items;
        if (!items.length) return close();
        const suggestionsLabel = label('suggestions', 'Sugestões de código');
        list.setAttribute('aria-label', suggestionsLabel);
        footer.textContent = label('accept', '↑↓ escolher · Enter / Tab inserir · Esc fechar');
        list.replaceChildren(
          ...items.map((item, index) => {
              const option = document.createElement('div');
              option.id = `editorCompletionOption${index}`;
              option.className = 'editor-autocomplete-option';
              option.setAttribute('role', 'option');
              option.dataset.completionIndex = String(index);
              const name = document.createElement('span');
              name.className = 'editor-autocomplete-label';
              const matched = document.createElement('strong');
              const prefixLength = result.prefix?.length || 0;
              matched.textContent = item.label.slice(0, prefixLength);
              name.append(matched, document.createTextNode(item.label.slice(prefixLength)));
              const kind = document.createElement('span');
              kind.className = 'editor-autocomplete-kind';
              kind.textContent = item.kind;
              option.append(name, kind);
              return option;
          }),
        );
        container.hidden = false;
        textarea.setAttribute('aria-controls', list.id);
        textarea.setAttribute('aria-expanded', 'true');
        announcement.textContent = `${suggestionsLabel}: ${items.length}`;
        position();
        select(
          Math.max(
            0,
            items.findIndex((item) => item.label === previousLabel),
          ),
        );
      }

      function updateDetail(item, result) {
        if (container.hidden || items[selectedIndex] !== item || !result) return;
        signature.textContent = result.signature || '';
        documentation.textContent = result.documentation || '';
        detail.hidden = !signature.textContent && !documentation.textContent;
        position();
      }

      container.addEventListener('pointerdown', (event) => {
          if (event.pointerType !== 'touch') event.preventDefault();
      });
      container.addEventListener('click', (event) => {
          const option = event.target.closest('[data-completion-index]');
          if (option) onSelect(Number(option.dataset.completionIndex));
      });
      return Object.freeze({
          show,
          close,
          position,
          updateDetail,
          move: (direction) => select(selectedIndex + direction),
          get selectedIndex() {
            return selectedIndex;
          },
          get isOpen() {
            return !container.hidden;
          },
          contains: (target) => container.contains(target),
      });
    }
    window.SynapseAutocompleteMenu = Object.freeze({ createMenu });
})();
