(function (root) {
    'use strict';

    const namespace = root.SynapseIntelligence;

    function createCompletionView(textarea, caret, onAccept, onSelect) {
      const panel = document.createElement('div');
      panel.className = 'intellisense-completion';
      panel.setAttribute('data-i18n', 'off');
      panel.hidden = true;
      const list = document.createElement('div');
      list.id = 'intellisenseSuggestions';
      list.className = 'intellisense-options';
      list.setAttribute('role', 'listbox');
      const detail = document.createElement('div');
      detail.className = 'intellisense-detail';
      const signature = document.createElement('pre');
      const documentation = document.createElement('p');
      detail.append(signature, documentation);
      const hint = document.createElement('div');
      hint.className = 'intellisense-hint';
      panel.append(list, detail, hint);
      document.body.appendChild(panel);
      textarea.setAttribute('role', 'combobox');
      textarea.setAttribute('aria-autocomplete', 'list');
      textarea.setAttribute('aria-controls', list.id);
      textarea.setAttribute('aria-haspopup', 'listbox');
      textarea.setAttribute('aria-expanded', 'false');
      let items = [];
      let selected = 0;

      function position() {
        if (panel.hidden) {
          return;
        }
        const point = caret.measure();
        const viewport = root.visualViewport;
        const viewportLeft = viewport?.offsetLeft || 0;
        const viewportTop = viewport?.offsetTop || 0;
        const width = viewport?.width || root.innerWidth;
        const height = viewport?.height || root.innerHeight;
        panel.style.width = Math.min(410, width - 24) + 'px';
        const availableBelow = viewportTop + height - point.top - point.height - 16;
        const availableAbove = point.top - viewportTop - 16;
        const placeAbove = availableBelow < 220 && availableAbove > availableBelow;
        const available = Math.max(80, placeAbove ? availableAbove : availableBelow);
        panel.style.maxHeight = Math.min(380, available, height - 24) + 'px';
        const bounds = panel.getBoundingClientRect();
        panel.style.left =
        Math.max(
          viewportLeft + 12,
          Math.min(point.left, viewportLeft + width - bounds.width - 12),
        ) + 'px';
        const top = placeAbove ? point.top - bounds.height - 6 : point.top + point.height + 6;
        panel.style.top =
        Math.max(viewportTop + 12, Math.min(top, viewportTop + height - bounds.height - 12)) + 'px';
      }

      function select(index) {
        if (!items.length) {
          return;
        }
        selected = (index + items.length) % items.length;
        Array.from(list.children).forEach((element, itemIndex) =>
          element.setAttribute('aria-selected', String(itemIndex === selected)),
        );
        const element = list.children[selected];
        textarea.setAttribute('aria-activedescendant', element.id);
        element.scrollIntoView({ block: 'nearest' });
        signature.textContent = items[selected].kind;
        documentation.textContent = '';
        onSelect(items[selected]);
      }

      function show(nextItems) {
        items = nextItems;
        if (!items.length) {
          hide();
          return;
        }
        list.replaceChildren();
        list.setAttribute('aria-label', namespace.label('suggestions'));
        hint.textContent = namespace.label('accept');
        items.forEach((item, index) => {
            const option = document.createElement('div');
            option.id = 'intellisenseOption' + index;
            option.setAttribute('role', 'option');
            option.dataset.index = String(index);
            option.className = 'intellisense-option';
            const name = document.createElement('span');
            name.className = 'intellisense-name';
            name.textContent = item.name;
            const kind = document.createElement('span');
            kind.className = 'intellisense-kind';
            kind.textContent = item.kind;
            option.append(name, kind);
            list.appendChild(option);
        });
        panel.hidden = false;
        textarea.setAttribute('aria-expanded', 'true');
        position();
        select(0);
      }

      function hide() {
        panel.hidden = true;
        textarea.setAttribute('aria-expanded', 'false');
        textarea.removeAttribute('aria-activedescendant');
        items = [];
      }

      list.addEventListener('mousedown', (event) => event.preventDefault());
      list.addEventListener('click', (event) => {
          const option = event.target.closest('[data-index]');
          if (option && items[Number(option.dataset.index)]) {
            onAccept(items[Number(option.dataset.index)]);
          }
      });

      function updateDetail(item, result) {
        if (panel.hidden || items[selected] !== item || !result) {
          return;
        }
        signature.textContent = result.signature || item.kind;
        documentation.textContent = result.documentation || '';
        position();
      }

      return Object.freeze({
          show,
          hide,
          position,
          updateDetail,
          contains: (element) => panel.contains(element),
          isOpen: () => !panel.hidden,
          move: (direction) => select(selected + direction),
          accept: () => items[selected] && onAccept(items[selected]),
          dispose: () => panel.remove(),
      });
    }

    namespace.createCompletionView = createCompletionView;
})(globalThis);
