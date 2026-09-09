(function (root) {
    'use strict';

    const BUTTON_ID = 'settingsBtn';

    function paintIcon(button) {
      if (button.querySelector('svg')) return;
      if (typeof root.iconSvg === 'function') button.innerHTML = root.iconSvg('settings');
    }

    function wireButton() {
      const button = document.getElementById(BUTTON_ID);
      if (!button || button.dataset.settingsWired === '1') return;
      button.dataset.settingsWired = '1';
      paintIcon(button);
      button.addEventListener('click', () => {
          if (root.SynapseSettingsPanel) root.SynapseSettingsPanel.toggle();
      });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireButton);
    else wireButton();
})(typeof globalThis !== 'undefined' ? globalThis : window);
