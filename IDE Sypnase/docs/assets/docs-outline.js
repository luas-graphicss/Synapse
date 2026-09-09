(function (root) {
    'use strict';

    const CURRENT_CLASS = 'docs-outline-link-current';
    const OUTLINE_TITLE = 'Nesta página';

    function slug(text, index) {
      const base = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
      return base || `secao-${index + 1}`;
    }

    function headings() {
      return [...document.querySelectorAll('.docs-article h2, .docs-article h3')];
    }

    function createLink(heading) {
      const link = document.createElement('a');
      link.className =
      heading.tagName === 'H3'
      ? 'docs-outline-link docs-outline-link-nested'
      : 'docs-outline-link';
      link.href = `#${heading.id}`;
      link.textContent = heading.textContent;
      return link;
    }

    function highlight(links, activeId) {
      links.forEach((link) => {
          link.classList.toggle(CURRENT_CLASS, link.getAttribute('href') === `#${activeId}`);
      });
    }

    function watchSections(items, links) {
      if (!root.IntersectionObserver) return;
      const observer = new root.IntersectionObserver(
        (entries) => {
          const visible = entries.filter((entry) => entry.isIntersecting);
          if (!visible.length) return;
          highlight(links, visible[0].target.id);
        },
        { rootMargin: '-70px 0px -70% 0px', threshold: 0 },
      );
      items.forEach((item) => observer.observe(item));
    }

    function render() {
      const outline = document.querySelector('.docs-outline');
      if (!outline) return;
      const items = headings();
      if (!items.length) return;
      const title = document.createElement('p');
      title.className = 'docs-outline-title';
      title.textContent = OUTLINE_TITLE;
      outline.appendChild(title);
      const links = items.map((heading, index) => {
          if (!heading.id) heading.id = slug(heading.textContent, index);
          const link = createLink(heading);
          outline.appendChild(link);
          return link;
      });
      watchSections(items, links);
    }

    root.SynapseDocsOutline = Object.freeze({ render });
})(typeof globalThis !== 'undefined' ? globalThis : window);
