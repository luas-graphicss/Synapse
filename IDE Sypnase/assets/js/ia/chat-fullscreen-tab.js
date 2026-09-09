(function () {
    'use strict';

    const PANEL_SELECTOR = '.ia-panel';
    const BUTTON_SELECTOR = '[data-ai-fullscreen]';
    const FULLSCREEN_CLASS = 'ia-fullscreen';
    const OPEN_LABEL = 'Abrir em tela cheia';
    const CLOSE_LABEL = 'Sair da tela cheia';
    const FORM_FIELDS = 'input, textarea, select';
    const HEADER_CONTROLS = 'button, input, select, textarea, summary, a';

    function chatPanel() {
      return document.querySelector(PANEL_SELECTOR);
    }

    function isFullscreen() {
      const panel = chatPanel();
      return !!panel && panel.classList.contains(FULLSCREEN_CLASS);
    }

    function iconMarkup(name) {
      return typeof iaIcone === 'function' ? iaIcone(name) : '';
    }

    function translate(text) {
      return typeof T === 'function' ? T(text) : text;
    }

    function paintButton(button, active) {
      const label = translate(active ? CLOSE_LABEL : OPEN_LABEL);
      button.innerHTML = iconMarkup(active ? 'fullscreenExit' : 'fullscreen');
      button.setAttribute('aria-pressed', String(active));
      button.setAttribute('aria-label', label);
      button.title = label;
    }

    function applyFullscreen(active) {
      const panel = chatPanel();
      if (!panel) return;
      panel.classList.toggle(FULLSCREEN_CLASS, active);
      const button = panel.querySelector(BUTTON_SELECTOR);
      if (button) paintButton(button, active);
    }

    function openFullscreen() {
      if (typeof IA_UI === 'object' && IA_UI && IA_UI.geo && IA_UI.geo.min) {
        IA_UI.geo.min = false;
        if (typeof iaAplicarGeo === 'function') iaAplicarGeo();
      }
      applyFullscreen(true);
    }

    function closeFullscreen() {
      applyFullscreen(false);
      if (typeof iaAplicarGeo === 'function') iaAplicarGeo();
    }

    function toggleFullscreen() {
      if (isFullscreen()) closeFullscreen();
      else openFullscreen();
    }

    function handleClick(event) {
      const target = event.target;
      if (!target || typeof target.closest !== 'function') return;
      if (!target.closest(BUTTON_SELECTOR)) return;
      event.preventDefault();
      event.stopPropagation();
      toggleFullscreen();
    }

    function handleEscape(event) {
      if (event.key !== 'Escape' || !isFullscreen()) return;
      const target = event.target;
      if (target && typeof target.closest === 'function' && target.closest(FORM_FIELDS)) return;
      closeFullscreen();
    }

    function blockHeaderDrag(event) {
      if (!isFullscreen()) return;
      const target = event.target;
      if (!target || typeof target.closest !== 'function') return;
      if (!target.closest('.ia-head')) return;
      if (target.closest(HEADER_CONTROLS)) return;
      event.stopPropagation();
    }

    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleEscape);
    document.addEventListener('pointerdown', blockHeaderDrag, true);
})();
