(function (root) {
    'use strict';

    function createGroupTitle(name) {
      const title = document.createElement('p');
      title.className = 'docs-nav-group-title';
      title.textContent = name;
      return title;
    }

    function createItem(category, currentIdentifier) {
      const item = document.createElement('a');
      item.className = 'docs-nav-item';
      item.href = `./${category.file}`;
      item.textContent = category.title;
      item.setAttribute('data-docs-nav-id', category.id);
      if (category.id === currentIdentifier) {
        item.classList.add('docs-nav-item-current');
        item.setAttribute('aria-current', 'page');
      }
      return item;
    }

    function render() {
      const sidebar = document.querySelector('.docs-sidebar');
      if (!sidebar) return;
      const catalog = root.SynapseDocsCatalog;
      const currentIdentifier = root.SynapseDocsCurrentCategory.identifier();
      const categories = catalog.list();
      catalog.groups().forEach((groupName) => {
          const group = document.createElement('div');
          group.className = 'docs-nav-group';
          group.appendChild(createGroupTitle(groupName));
          categories
          .filter((category) => category.group === groupName)
          .forEach((category) => group.appendChild(createItem(category, currentIdentifier)));
          sidebar.appendChild(group);
      });
    }

    root.SynapseDocsSidebar = Object.freeze({ render });
})(typeof globalThis !== 'undefined' ? globalThis : window);
