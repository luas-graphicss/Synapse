(function (root) {
    'use strict';

    const TRIGGER_ID = 'formatMenuTrigger';
    const TRIGGER_HINT =
    'Abre o menu do formatador: arquivo atual ou todos os arquivos do projeto.';

    function formatButton() {
      return document.getElementById('fmtBtn');
    }

    function openMenuElement() {
      return document.querySelector('.ctxmenu');
    }

    function menuItems() {
      return [
        { label: 'Formatar' },
        {
          icon: 'format',
          text: 'Formatar arquivo atual · Shift+Alt+F',
          run: () => formatActiveFile(),
        },
        { sep: true },
        {
          icon: 'format',
          text: 'Formatar todos os arquivos do projeto',
          run: () => root.SynapseProjectFormatRunner.run(),
        },
      ];
    }

    function wireMenuKeyboard(menu, trigger) {
      const buttons = [...menu.querySelectorAll('button')];
      buttons.forEach((button) => button.setAttribute('role', 'menuitem'));
      if (buttons[0]) buttons[0].focus();
      menu.addEventListener('keydown', (event) => {
          const currentIndex = buttons.indexOf(document.activeElement);
          const step = event.key === 'ArrowUp' ? buttons.length - 1 : 1;
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const nextIndex = (currentIndex + step + buttons.length) % buttons.length;
            if (buttons[nextIndex]) buttons[nextIndex].focus();
            return;
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            hideCtxMenu();
            trigger.setAttribute('aria-expanded', 'false');
            trigger.focus();
          }
      });
    }

    function openMenu(trigger) {
      const bounds = trigger.getBoundingClientRect();
      showCtxMenu(bounds.left - 6, bounds.bottom + 8, menuItems());
      trigger.setAttribute('aria-expanded', 'true');
      const menu = openMenuElement();
      if (!menu) return;
      menu.classList.add('format-context-menu');
      menu.setAttribute('role', 'menu');
      wireMenuKeyboard(menu, trigger);
    }

    function toggleMenu(trigger) {
      if (openMenuElement()) {
        hideCtxMenu();
        trigger.setAttribute('aria-expanded', 'false');
        return;
      }
      openMenu(trigger);
    }

    function watchMenuState(trigger) {
      const syncTriggerState = () => {
        if (!openMenuElement()) trigger.setAttribute('aria-expanded', 'false');
      };
      for (const eventName of ['click', 'keydown', 'blur', 'resize']) {
        root.addEventListener(eventName, syncTriggerState);
      }
    }

    function createTrigger() {
      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.id = TRIGGER_ID;
      trigger.className = 'format-menu-trigger';
      trigger.setAttribute('aria-label', 'Mais opcoes de formatacao');
      trigger.setAttribute('aria-haspopup', 'menu');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('data-hint', TRIGGER_HINT);
      trigger.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          toggleMenu(trigger);
      });
      return trigger;
    }

    function install() {
      const button = formatButton();
      if (!button || !button.parentElement) return;
      if (document.getElementById(TRIGGER_ID)) return;
      const group = document.createElement('span');
      group.className = 'format-button-group';
      button.parentElement.insertBefore(group, button);
      group.appendChild(button);
      const trigger = createTrigger();
      group.appendChild(trigger);
      watchMenuState(trigger);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
    else install();
})(typeof globalThis !== 'undefined' ? globalThis : window);
