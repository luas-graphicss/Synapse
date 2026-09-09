(function (root) {
    'use strict';

    const BUTTON_ID = 'aiCompletionToggleBtn';
    const STORAGE_KEY = 'synapse.editor.aiCompletion';
    const HINT_ATTRIBUTE = 'data-hint';
    const ENABLED_HINT = 'Autocomplete com IA ativado (beta). Clique para desativar.';
    const DISABLED_HINT = 'Autocomplete com IA desativado (beta). Clique para ativar.';

    function completionProvider() {
      return root.SYNAPSE_AI_COMPLETION || null;
    }

    function reportError(error, context) {
      if (typeof root.ignorarErro === 'function') root.ignorarErro(error, context);
    }

    function readPreference() {
      try {
        return localStorage.getItem(STORAGE_KEY) === 'on';
      } catch (error) {
        reportError(error, 'aiCompletionToggle.read');
        return false;
      }
    }

    function writePreference(enabled) {
      try {
        localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
      } catch (error) {
        reportError(error, 'aiCompletionToggle.write');
      }
    }

    function applyToProvider(enabled) {
      const provider = completionProvider();
      if (!provider) return;
      if (enabled) provider.enable();
      else provider.disable();
    }

    function unavailableReason() {
      const provider = completionProvider();
      if (!provider || typeof provider.status !== 'function') return '';
      const status = provider.status();
      return status && status.unavailableReason ? status.unavailableReason : '';
    }

    function buttonHint(enabled) {
      if (!enabled) return DISABLED_HINT;
      const reason = unavailableReason();
      return reason ? ENABLED_HINT + ' ' + reason : ENABLED_HINT;
    }

    function paintButton(button, enabled) {
      button.classList.toggle('on', enabled);
      button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
      button.removeAttribute('title');
      button.setAttribute(HINT_ATTRIBUTE, buttonHint(enabled));
    }

    function createButton() {
      const button = document.createElement('button');
      button.type = 'button';
      button.id = BUTTON_ID;
      button.className = 'eh-btn';
      button.setAttribute('aria-label', 'Autocomplete com IA');
      if (typeof root.iconSvg === 'function') button.innerHTML = root.iconSvg('aiCompletion');
      else button.textContent = 'IA';
      if (root.SynapseBetaBadge) root.SynapseBetaBadge.attach(button, 'Beta');
      return button;
    }

    function placeButton(button) {
      const head = document.querySelector('.editor-head');
      if (!head) return false;
      const reference = document.getElementById('autocompleteBtn') || document.getElementById('fmtBtn');
      if (reference && reference.parentElement === head) reference.after(button);
      else head.appendChild(button);
      return true;
    }

    function install() {
      if (!completionProvider()) return;
      if (document.getElementById(BUTTON_ID)) return;
      const button = createButton();
      if (!placeButton(button)) return;
      let enabled = readPreference();
      applyToProvider(enabled);
      paintButton(button, enabled);
      button.addEventListener('click', () => {
          enabled = !enabled;
          writePreference(enabled);
          applyToProvider(enabled);
          paintButton(button, enabled);
      });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
    else install();
})(typeof globalThis !== 'undefined' ? globalThis : window);
