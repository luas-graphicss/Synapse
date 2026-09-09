(function (root) {
    'use strict';

    const PREVIOUS_DIRECTION_TEXT = 'categoria anterior';
    const NEXT_DIRECTION_TEXT = 'próxima categoria';

    function createLink(category, direction, directionText) {
      const link = document.createElement('a');
      link.className = `docs-pager-link docs-pager-link-${direction}`;
      link.href = `./${category.file}`;
      const label = document.createElement('span');
      label.className = 'docs-pager-direction';
      label.textContent = directionText;
      const title = document.createElement('span');
      title.className = 'docs-pager-title';
      title.textContent = category.title;
      link.appendChild(label);
      link.appendChild(title);
      return link;
    }

    function render() {
      const pager = document.querySelector('.docs-pager');
      if (!pager) return;
      const identifier = root.SynapseDocsCurrentCategory.identifier();
      const sides = root.SynapseDocsCatalog.neighbors(identifier);
      if (sides.previous) {
        pager.appendChild(createLink(sides.previous, 'previous', PREVIOUS_DIRECTION_TEXT));
      } else {
        pager.appendChild(document.createElement('span'));
      }
      if (sides.next) pager.appendChild(createLink(sides.next, 'next', NEXT_DIRECTION_TEXT));
    }

    root.SynapseDocsPager = Object.freeze({ render });
})(typeof globalThis !== 'undefined' ? globalThis : window);
