(function () {
    'use strict';

    const actionLabels = {
      settingsBtn: 'Configurações',
      tourBtn: 'Tutorial',
      themeBtn: 'Aparência',
      syncBtn: 'Espelhar projeto',
      recentBtn: 'Projetos recentes',
      lockBtn: 'Proteger projetos',
      teamsBtn: 'Equipes de agentes',
      modelador3dBtn: 'Blepse 3D',
      collapseBtn: 'Recolher pastas',
      addBtn: 'Importar arquivos',
      exProjBtn: 'Opções do projeto',
      exSelectBtn: 'Seleção múltipla',
      buildSystemBtn: 'Build & Run',
      debugBtn: 'Depurador',
      consoleBtn: 'Console / DevTools',
      termBtn: 'Terminal',
      popoutBtn: 'Abrir preview em nova aba',
    };
    const essentialActions = new Set(['importBtn', 'exportBtn', 'cmdkBtn', 'iaBtn', 'mcpBtn']);

    function labelAction(button) {
      button.classList.add('workspace-menu-action');
      if (button.querySelector('.workspace-action-label')) return;
      if (button.textContent.trim()) return;
      const label = document.createElement('span');
      label.className = 'workspace-action-label';
      label.textContent =
      actionLabels[button.id] || button.getAttribute('aria-label') || button.title;
      button.appendChild(label);
    }

    function createOverflowMenu(container, identifier, label, roots, query, compactWidth = 0) {
      if (!roots.length || document.getElementById(identifier)) return;
      const originalChildren = Array.from(container.children);
      const compactLayout = window.matchMedia(query);
      const wrapper = document.createElement('div');
      wrapper.className = 'menu-wrap workspace-overflow';
      const trigger = document.createElement('button');
      trigger.id = identifier;
      trigger.type = 'button';
      trigger.className = container.classList.contains('topbar-actions')
      ? 'top-ico'
      : container.classList.contains('editor-head')
      ? 'eh-btn'
      : 'tbtn';
      trigger.title = label;
      trigger.setAttribute('aria-label', label);
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-controls', identifier + 'Menu');
      const overflowIcons = {
        workspaceToolsBtn: 'workspaceTools',
        explorerToolsBtn: 'fileTools',
        toolbarToolsBtn: 'previewTools',
        editorToolsBtn: 'editorTools',
      };
      trigger.innerHTML = iconSvg(overflowIcons[identifier] || 'more');
      const menu = document.createElement('div');
      menu.id = identifier + 'Menu';
      menu.className = 'menu workspace-tools-menu';
      menu.setAttribute('aria-label', label);
      menu.inert = true;
      let compactMode;

      function menuButtons() {
        return roots.map((root) =>
          root.matches('button') ? root : root.querySelector(':scope > button'),
        );
      }

      function setOpen(open, restoreFocus = false) {
        menu.classList.toggle('open', open);
        menu.inert = !open;
        if (open) positionMenu();
        trigger.setAttribute('aria-expanded', String(open));
        if (!open)
        menu.querySelectorAll('.menu.open').forEach((panel) => panel.classList.remove('open'));
        if (restoreFocus) trigger.focus();
      }

      function positionMenu() {
        window.SynapseOverflowMenuAnchor?.anchorToTrigger(menu, trigger);
      }

      function repositionWhileOpen() {
        if (menu.classList.contains('open')) positionMenu();
      }

      roots.forEach((root) => {
          const button = root.matches('button') ? root : root.querySelector(':scope > button');
          if (button) labelAction(button);
      });
      wrapper.append(trigger, menu);
      container.appendChild(wrapper);

      function synchronizeLayout() {
        const shouldCompact =
        compactLayout.matches ||
        (compactWidth > 0 && container.getBoundingClientRect().width < compactWidth);
        if (compactMode === shouldCompact) {
          if (menu.classList.contains('open')) positionMenu();
          return;
        }
        compactMode = shouldCompact;
        const focusedControl = document.activeElement;
        const shouldRestoreFocus = container.contains(focusedControl);
        setOpen(false);
        wrapper.hidden = !shouldCompact;
        if (shouldCompact) {
          roots.forEach((root) => menu.appendChild(root));
        } else {
          originalChildren.forEach((child) => container.insertBefore(child, wrapper));
        }
        if (shouldRestoreFocus) {
          const focusTarget =
          shouldCompact && menu.contains(focusedControl)
          ? trigger
          : !shouldCompact && focusedControl === trigger
          ? menuButtons().find(
            (button) => button && !button.disabled && button.getClientRects().length,
          )
          : focusedControl;
          if (focusTarget?.getClientRects().length && !focusTarget.closest('[inert]')) {
            focusTarget.focus({ preventScroll: true });
          }
        }
      }

      compactLayout.addEventListener('change', synchronizeLayout);
      if (compactWidth > 0) new ResizeObserver(synchronizeLayout).observe(container);
      window.addEventListener('resize', repositionWhileOpen);
      window.addEventListener('scroll', repositionWhileOpen, true);
      synchronizeLayout();

      trigger.addEventListener('click', (event) => {
          event.stopPropagation();
          setOpen(!menu.classList.contains('open'));
      });
      trigger.addEventListener('keydown', (event) => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
          event.preventDefault();
          setOpen(true);
          const buttons = menuButtons().filter(
            (button) => button && !button.disabled && button.getClientRects().length,
          );
          (event.key === 'ArrowUp' ? buttons.at(-1) : buttons[0])?.focus();
      });
      menu.addEventListener('keydown', (event) => {
          if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
          if (event.target.closest('.menu') !== menu) return;
          const buttons = menuButtons().filter(
            (button) => button && !button.disabled && button.getClientRects().length,
          );
          const currentIndex = buttons.indexOf(document.activeElement);
          if (currentIndex < 0 || !buttons.length) return;
          event.preventDefault();
          const direction = event.key === 'ArrowUp' ? -1 : 1;
          const nextIndex =
          event.key === 'Home'
          ? 0
          : event.key === 'End'
          ? buttons.length - 1
          : (currentIndex + direction + buttons.length) % buttons.length;
          buttons[nextIndex].focus();
      });
      document.addEventListener('pointerdown', (event) => {
          if (!wrapper.contains(event.target)) setOpen(false);
      });
      document.addEventListener('keydown', (event) => {
          if (event.key === 'Escape' && menu.classList.contains('open')) {
            event.preventDefault();
            setOpen(false, true);
          }
      });
      document.addEventListener(
        'click',
        (event) => {
          const button = event.target.closest('button');
          if (!button || !menuButtons().includes(button)) return;
          if (button.nextElementSibling?.classList.contains('menu')) return;
          queueMicrotask(() => setOpen(false, menu.contains(document.activeElement)));
        },
        true,
      );
      wrapper.addEventListener('focusout', (event) => {
          if (event.relatedTarget && !wrapper.contains(event.relatedTarget)) setOpen(false);
      });
      new MutationObserver(() =>
        menuButtons().forEach((button) => button && labelAction(button)),
      ).observe(menu, { childList: true, subtree: true });
    }

    function initializeWorkspaceNavigation() {
      const topbar = document.querySelector('.topbar-actions');
      if (topbar) {
        const secondaryRoots = Array.from(topbar.children).filter((root) => {
            const button = root.matches('button') ? root : root.querySelector(':scope > button');
            return button && !essentialActions.has(button.id);
        });
        createOverflowMenu(
          topbar,
          'workspaceToolsBtn',
          'Mais ferramentas',
          secondaryRoots,
          'all',
        );
      }
      const explorerActions = document.querySelector('.ex-actions');
      if (explorerActions) {
        const secondaryButtons = ['exSelectBtn', 'collapseBtn', 'addBtn', 'exProjBtn']
        .map((identifier) => document.getElementById(identifier))
        .filter(Boolean);
        createOverflowMenu(
          explorerActions,
          'explorerToolsBtn',
          'Mais ações de arquivos',
          secondaryButtons,
          'all',
        );
      }
      const toolbar = document.querySelector('.toolbar');
      if (toolbar) {
        const utilityButtons = ['buildSystemBtn', 'debugBtn', 'consoleBtn', 'termBtn', 'popoutBtn']
        .map((identifier) => document.getElementById(identifier))
        .filter(Boolean);
        createOverflowMenu(
          toolbar,
          'toolbarToolsBtn',
          'Mais ações do preview',
          utilityButtons,
          '(max-width: 900px), (pointer: coarse)',
        );
      }
      const editorHeader = document.querySelector('.editor-head');
      if (editorHeader) {
        const primaryButtons = new Set(['findInFileBtn']);
        const secondaryButtons = Array.from(editorHeader.querySelectorAll(':scope > button')).filter(
          (button) => !primaryButtons.has(button.id),
        );
        createOverflowMenu(
          editorHeader,
          'editorToolsBtn',
          'Mais ações do editor',
          secondaryButtons,
          '(max-width: 900px), (pointer: coarse)',
          440,
        );
      }
      hydrateIcons();
    }

    if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', initializeWorkspaceNavigation);
    else initializeWorkspaceNavigation();
})();
