(function (root) {
    'use strict';

    const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
    const BUTTON_ID = 'supportBtn';
    const MENU_ID = 'supportMenu';
    const OPEN_CLASS = 'open';

    function importButtonWrap() {
      const importButton = document.getElementById('importBtn');
      if (!importButton) return null;
      return importButton.closest('.menu-wrap') || importButton.parentElement;
    }

    function createSupportIcon() {
      const icon = document.createElementNS(SVG_NAMESPACE, 'svg');
      icon.setAttribute('class', 'icon');
      icon.setAttribute('viewBox', '0 0 24 24');
      icon.setAttribute('fill', 'none');
      icon.setAttribute('stroke', 'currentColor');
      icon.setAttribute('stroke-width', '1.8');
      icon.setAttribute('stroke-linecap', 'round');
      icon.setAttribute('aria-hidden', 'true');
      const ring = document.createElementNS(SVG_NAMESPACE, 'circle');
      ring.setAttribute('cx', '12');
      ring.setAttribute('cy', '12');
      ring.setAttribute('r', '8.5');
      const mark = document.createElementNS(SVG_NAMESPACE, 'path');
      mark.setAttribute('d', 'M9.5 9.4a2.6 2.6 0 0 1 5 1c0 1.7-2.4 2-2.4 3.6');
      const dot = document.createElementNS(SVG_NAMESPACE, 'path');
      dot.setAttribute('d', 'M12.1 17.2h.01');
      icon.appendChild(ring);
      icon.appendChild(mark);
      icon.appendChild(dot);
      return icon;
    }

    function createButton(labels) {
      const button = document.createElement('button');
      button.type = 'button';
      button.id = BUTTON_ID;
      button.className = 'btn support-btn';
      button.setAttribute('aria-haspopup', 'menu');
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-controls', MENU_ID);
      button.setAttribute('title', labels.supportButtonHint);
      button.setAttribute('data-hint', labels.supportButtonHint);
      const text = document.createElement('span');
      text.className = 'support-btn-text';
      text.textContent = labels.supportButtonText;
      button.appendChild(createSupportIcon());
      button.appendChild(text);
      return button;
    }

    function createMenuItem(text, detail, onActivate) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'support-menu-item';
      item.setAttribute('role', 'menuitem');
      const title = document.createElement('span');
      title.className = 'support-menu-item-text';
      title.textContent = text;
      const hint = document.createElement('span');
      hint.className = 'support-menu-item-detail';
      hint.textContent = detail;
      item.appendChild(title);
      item.appendChild(hint);
      item.addEventListener('click', onActivate);
      return item;
    }

    function createMenu(labels, actions) {
      const menu = document.createElement('div');
      menu.id = MENU_ID;
      menu.className = 'support-menu';
      menu.setAttribute('role', 'menu');
      const heading = document.createElement('div');
      heading.className = 'support-menu-heading';
      heading.textContent = labels.menuHeading;
      menu.appendChild(heading);
      menu.appendChild(
        createMenuItem(
          labels.documentationItemText,
          labels.documentationItemDetail,
          actions.openDocumentation,
        ),
      );
      menu.appendChild(
        createMenuItem(labels.bugReportItemText, labels.bugReportItemDetail, actions.openBugReport),
      );
      return menu;
    }

    function install() {
      const wrap = importButtonWrap();
      if (!wrap || !wrap.parentElement) return;
      if (document.getElementById(BUTTON_ID)) return;
      const labels = root.SynapseSupportLabels;
      const container = document.createElement('div');
      container.className = 'support-menu-wrap';
      const button = createButton(labels);

      function closeMenu() {
        menu.classList.remove(OPEN_CLASS);
        button.setAttribute('aria-expanded', 'false');
      }

      function openMenu() {
        menu.classList.add(OPEN_CLASS);
        button.setAttribute('aria-expanded', 'true');
      }

      const menu = createMenu(labels, {
          openDocumentation: () => {
            closeMenu();
            root.SynapseSupportDocsNavigation.open();
          },
          openBugReport: () => {
            closeMenu();
            root.SynapseBugReportController.open();
          },
      });

      button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (menu.classList.contains(OPEN_CLASS)) closeMenu();
          else openMenu();
      });
      menu.addEventListener('click', (event) => event.stopPropagation());
      document.addEventListener('click', (event) => {
          if (!container.contains(event.target)) closeMenu();
      });
      document.addEventListener('keydown', (event) => {
          if (event.key === 'Escape') closeMenu();
      });
      container.appendChild(button);
      container.appendChild(menu);
      wrap.parentElement.insertBefore(container, wrap);
    }

    function watchTopbar() {
      const actions = document.querySelector('.topbar-actions');
      if (!actions) return;
      const observer = new MutationObserver(() => install());
      observer.observe(actions, { childList: true });
    }

    function start() {
      install();
      watchTopbar();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})(typeof globalThis !== 'undefined' ? globalThis : window);
