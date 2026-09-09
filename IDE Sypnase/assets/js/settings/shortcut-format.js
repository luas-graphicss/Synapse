(function (root) {
    'use strict';

    const IGNORED_KEYS = ['Control', 'Meta', 'Alt', 'Shift', 'CapsLock', 'Dead', 'Unidentified'];
    const KEY_LABELS = {
      Space: 'Espaco',
      ArrowLeft: 'Seta esquerda',
      ArrowRight: 'Seta direita',
      ArrowUp: 'Seta cima',
      ArrowDown: 'Seta baixo',
      Escape: 'Esc',
      PageUp: 'Page Up',
      PageDown: 'Page Down',
      '`': 'Crase',
      ',': 'Virgula',
    };

    function isApplePlatform() {
      const identifier = navigator.platform || navigator.userAgent || '';
      return /Mac|iPhone|iPad|iPod/.test(identifier);
    }

    function normalizeKey(key) {
      if (!key) return '';
      if (key === ' ' || key === 'Spacebar') return 'Space';
      if (key.length === 1) return key.toUpperCase();
      return key;
    }

    function fromEvent(event) {
      if (IGNORED_KEYS.includes(event.key)) return '';
      const key = normalizeKey(event.key);
      if (!key) return '';
      const parts = [];
      if (event.ctrlKey || event.metaKey) parts.push('Mod');
      if (event.altKey) parts.push('Alt');
      if (event.shiftKey) parts.push('Shift');
      parts.push(key);
      return parts.join('+');
    }

    function parse(binding) {
      const text = String(binding || '');
      if (!text) return null;
      const segments = text.split('+');
      let key = segments.pop();
      if (key === '') key = '+';
      const modifiers = segments.filter((segment) => segment !== '');
      return {
        key: normalizeKey(key),
        mod: modifiers.includes('Mod'),
        alt: modifiers.includes('Alt'),
        shift: modifiers.includes('Shift'),
      };
    }

    function hasModifier(binding) {
      const parsed = parse(binding);
      return !!parsed && (parsed.mod || parsed.alt);
    }

    function toLabel(binding) {
      const parsed = parse(binding);
      if (!parsed) return '';
      const apple = isApplePlatform();
      const parts = [];
      if (parsed.mod) parts.push(apple ? 'Cmd' : 'Ctrl');
      if (parsed.alt) parts.push(apple ? 'Option' : 'Alt');
      if (parsed.shift) parts.push('Shift');
      parts.push(KEY_LABELS[parsed.key] || parsed.key);
      return parts.join(' + ');
    }

    function matchesEvent(binding, event) {
      const parsed = parse(binding);
      if (!parsed || !parsed.key) return false;
      if (normalizeKey(event.key) !== parsed.key) return false;
      if (parsed.mod !== (event.ctrlKey || event.metaKey)) return false;
      if (parsed.alt !== event.altKey) return false;
      if (parsed.shift !== event.shiftKey) return false;
      return true;
    }

    root.SynapseShortcutFormat = Object.freeze({
        fromEvent,
        parse,
        toLabel,
        matchesEvent,
        hasModifier,
        normalizeKey,
    });
})(typeof globalThis !== 'undefined' ? globalThis : window);
