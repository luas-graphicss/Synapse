(function (root) {
    'use strict';

    const PANEL_ID = 'settingsPanel';
    const controls = root.SynapseSettingsControls;

    let panel = null;
    let navElement = null;
    let contentElement = null;
    let activeSectionId = '';
    let keyListenerAttached = false;

    function iconMarkup(name) {
      return typeof root.iconSvg === 'function' ? root.iconSvg(name) : '';
    }

    function sectionModules() {
      return [
        root.SynapseSettingsAppearanceSection,
        root.SynapseSettingsEditorSection,
        root.SynapseSettingsShortcutsSection,
      ].filter(Boolean);
    }

    function isOpen() {
      return !!panel && !panel.hidden;
    }

    function createCloseButton() {
      const button = controls.createElement('button', 'settings-close');
      button.type = 'button';
      button.title = 'Fechar';
      button.setAttribute('aria-label', 'Fechar configuracoes');
      button.innerHTML = iconMarkup('close');
      button.addEventListener('click', closePanel);
      return button;
    }

    function createHead() {
      const head = controls.createElement('header', 'settings-head');
      head.appendChild(controls.createElement('span', 'settings-head-title', 'Configuracoes'));
      head.appendChild(createCloseButton());
      return head;
    }

    function createFooter() {
      const footer = controls.createElement('footer', 'settings-foot');
      footer.appendChild(controls.createButton('Restaurar tudo', 'ghost', resetEverything));
      footer.appendChild(controls.createButton('Fechar', 'primary', closePanel));
      return footer;
    }

    function selectSection(identifier) {
      activeSectionId = identifier;
      for (const button of navElement.children)
      button.classList.toggle('on', button.dataset.sectionId === identifier);
      for (const pane of contentElement.children)
      pane.hidden = pane.dataset.sectionId !== identifier;
    }

    function createNavItem(section) {
      const button = controls.createElement('button', 'settings-nav-item', section.label);
      button.type = 'button';
      button.dataset.sectionId = section.id;
      button.addEventListener('click', () => selectSection(section.id));
      return button;
    }

    function createPane(section) {
      const pane = controls.createElement('div', 'settings-pane');
      pane.dataset.sectionId = section.id;
      pane.hidden = true;
      pane.appendChild(section.create());
      return pane;
    }

    function build() {
      const backdrop = controls.createElement('div', 'settings-backdrop');
      backdrop.id = PANEL_ID;
      backdrop.hidden = true;
      const shell = controls.createElement('div', 'settings-shell');
      shell.setAttribute('role', 'dialog');
      shell.setAttribute('aria-modal', 'true');
      shell.setAttribute('aria-label', 'Configuracoes da IDE');
      navElement = controls.createElement('nav', 'settings-nav');
      contentElement = controls.createElement('div', 'settings-content');
      const sections = sectionModules();
      for (const section of sections) {
        navElement.appendChild(createNavItem(section));
        contentElement.appendChild(createPane(section));
      }
      const body = controls.createElement('div', 'settings-body');
      body.appendChild(navElement);
      body.appendChild(contentElement);
      shell.appendChild(createHead());
      shell.appendChild(body);
      shell.appendChild(createFooter());
      backdrop.appendChild(shell);
      backdrop.addEventListener('pointerdown', (event) => {
          if (event.target === backdrop) closePanel();
      });
      document.body.appendChild(backdrop);
      panel = backdrop;
      const known = sections.some((section) => section.id === activeSectionId);
      const firstSection = sections.length ? sections[0].id : '';
      selectSection(known ? activeSectionId : firstSection);
    }

    function handleKeys(event) {
      if (!isOpen() || event.key !== 'Escape') return;
      if (root.SynapseColorPicker && root.SynapseColorPicker.isOpen()) return;
      if (root.SynapseShortcutCapture && root.SynapseShortcutCapture.isActive()) return;
      event.preventDefault();
      closePanel();
    }

    function openPanel() {
      if (!panel) build();
      panel.hidden = false;
      document.body.classList.add('settings-panel-open');
      if (!keyListenerAttached) {
        root.addEventListener('keydown', handleKeys, true);
        keyListenerAttached = true;
      }
      const activeButton = navElement.querySelector('.settings-nav-item.on');
      if (activeButton) activeButton.focus({ preventScroll: true });
      return true;
    }

    function closePanel() {
      if (!panel) return false;
      panel.hidden = true;
      document.body.classList.remove('settings-panel-open');
      if (root.SynapseShortcutCapture) root.SynapseShortcutCapture.stop();
      return true;
    }

    function togglePanel() {
      if (isOpen()) return closePanel();
      return openPanel();
    }

    function rebuild() {
      const wasOpen = isOpen();
      if (panel) {
        panel.remove();
        panel = null;
      }
      build();
      if (wasOpen) panel.hidden = false;
    }

    function resetEverything() {
      if (root.SynapseSettingsStore) root.SynapseSettingsStore.reset();
      if (root.SynapseShortcutBindings) root.SynapseShortcutBindings.resetAll();
      rebuild();
      if (typeof root.toast === 'function')
      root.toast('Configuracoes restauradas', 'Valores padrao aplicados', '');
    }

    root.SynapseSettingsPanel = Object.freeze({
        open: openPanel,
        close: closePanel,
        toggle: togglePanel,
        isOpen,
    });
})(typeof globalThis !== 'undefined' ? globalThis : window);
