(function (root) {
    'use strict';

    const HIDDEN_CLASS = 'docs-nav-item-hidden';
    const PLACEHOLDER_TEXT = 'filtrar categorias';
    const EMPTY_TEXT = 'nenhuma categoria com esse termo';

    function createInput() {
      const wrap = document.createElement('div');
      wrap.className = 'docs-filter';
      const input = document.createElement('input');
      input.type = 'search';
      input.className = 'docs-filter-input';
      input.placeholder = PLACEHOLDER_TEXT;
      input.setAttribute('aria-label', PLACEHOLDER_TEXT);
      wrap.appendChild(input);
      return { wrap, input };
    }

    function createEmptyNotice() {
      const notice = document.createElement('p');
      notice.className = 'docs-nav-empty';
      notice.textContent = EMPTY_TEXT;
      notice.hidden = true;
      return notice;
    }

    function matches(item, term) {
      return item.textContent.toLowerCase().includes(term);
    }

    function attach() {
      const sidebar = document.querySelector('.docs-sidebar');
      if (!sidebar) return;
      const field = createInput();
      const notice = createEmptyNotice();
      sidebar.insertBefore(field.wrap, sidebar.firstChild);
      sidebar.appendChild(notice);
      field.input.addEventListener('input', () => {
          const term = field.input.value.trim().toLowerCase();
          const items = [...sidebar.querySelectorAll('.docs-nav-item')];
          let visibleCount = 0;
          items.forEach((item) => {
              const visible = !term || matches(item, term);
              item.classList.toggle(HIDDEN_CLASS, !visible);
              if (visible) visibleCount += 1;
          });
          notice.hidden = visibleCount > 0;
      });
    }

    root.SynapseDocsFilter = Object.freeze({ attach });
})(typeof globalThis !== 'undefined' ? globalThis : window);
