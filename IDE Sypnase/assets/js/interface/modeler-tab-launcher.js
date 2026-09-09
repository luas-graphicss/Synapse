(function () {
    'use strict';

    const TOOLS_MENU_ID = 'workspaceToolsBtnMenu';
    const MODELER_BUTTON_ID = 'modelador3dBtn';
    const MODELER_ACTION_LABEL = 'Blepse 3D';
    const MODELER_ACTION_TITLE = 'Blepse 3D — abrir em nova aba e gravar no projeto';
    const MODELER_ACTION_ICON =
    '<svg class="icon" viewBox="0 0 24 24"><path d="M12 3l8 4.5v9l-8 4.5-8-4.5v-9z"></path><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"></path></svg>';

    const BETA_BADGE_LABEL = 'Beta';
    const MODELER_CLICK_BOUND_FLAG = 'modelerOpenBound';

    function attachBetaBadge(button) {
      if (!globalThis.SynapseBetaBadge) return;
      globalThis.SynapseBetaBadge.attach(button, BETA_BADGE_LABEL);
    }

    function openModelerTab() {
      if (typeof mod3dAbrirAba !== 'function') return;
      mod3dAbrirAba();
    }

    function bindOpenModelerTab(button) {
      if (button.dataset[MODELER_CLICK_BOUND_FLAG] === 'true') return;
      button.dataset[MODELER_CLICK_BOUND_FLAG] = 'true';
      button.addEventListener('click', openModelerTab);
    }

    function createModelerButton() {
      const button = document.createElement('button');
      button.type = 'button';
      button.id = MODELER_BUTTON_ID;
      button.className = 'top-ico';
      button.title = MODELER_ACTION_TITLE;
      button.setAttribute('aria-label', MODELER_ACTION_LABEL);
      button.innerHTML = MODELER_ACTION_ICON;
      return button;
    }

    function labelModelerButton(button) {
      button.classList.add('workspace-menu-action');
      if (button.querySelector('.workspace-action-label')) return;
      const label = document.createElement('span');
      label.className = 'workspace-action-label';
      label.textContent = MODELER_ACTION_LABEL;
      button.appendChild(label);
    }

    function placeModelerActionInToolsMenu() {
      const menu = document.getElementById(TOOLS_MENU_ID);
      if (!menu) return false;
      const button = document.getElementById(MODELER_BUTTON_ID) || createModelerButton();
      if (button.parentElement !== menu) menu.appendChild(button);
      bindOpenModelerTab(button);
      labelModelerButton(button);
      attachBetaBadge(button);
      return true;
    }

    function watchTopbarActions() {
      if (placeModelerActionInToolsMenu()) return;
      const topbarActions = document.querySelector('.topbar-actions');
      if (!topbarActions) return;
      const observer = new MutationObserver(() => {
          if (placeModelerActionInToolsMenu()) observer.disconnect();
      });
      observer.observe(topbarActions, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', watchTopbarActions);
    } else {
      watchTopbarActions();
    }
})();
