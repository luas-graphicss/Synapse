(function (root) {
    'use strict';

    const presets = root.SynapseSettingsDefaults;
    const store = root.SynapseSettingsStore;
    const documentElement = document.documentElement;

    function clamp(value, range, fallback) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return fallback;
      return Math.min(range.maximum, Math.max(range.minimum, numeric));
    }

    function applyInterfaceFontSize(value) {
      const size = clamp(
        value,
        presets.interfaceFontSizeRange,
        presets.values.interfaceFontSize,
      );
      documentElement.style.setProperty('--interface-font-size', size + 'px');
    }

    function applyEditorFontSize(value, spacing) {
      const size = clamp(value, presets.editorFontSizeRange, presets.values.editorFontSize);
      const ratio = presets.lineSpacingRatio(spacing);
      const lineHeight = Math.round(size * ratio * 10) / 10;
      documentElement.style.setProperty('--editor-code-font-size', size + 'px');
      documentElement.style.setProperty('--editor-code-line-height', lineHeight + 'px');
    }

    function applyEditorFontFamily(identifier) {
      const stack = presets.editorFontStack(identifier);
      if (stack) documentElement.style.setProperty('--editor-code-font-family', stack);
      else documentElement.style.removeProperty('--editor-code-font-family');
    }

    function applySyntaxTheme(identifier) {
      const known = presets.editorSyntaxThemes.some((option) => option.id === identifier);
      documentElement.setAttribute(
        'data-syntax-theme',
        known ? identifier : presets.values.editorSyntaxTheme,
      );
    }

    function apply(settings) {
      applyInterfaceFontSize(settings.interfaceFontSize);
      applyEditorFontSize(settings.editorFontSize, settings.editorLineSpacing);
      applyEditorFontFamily(settings.editorFontFamily);
      applySyntaxTheme(settings.editorSyntaxTheme);
    }

    root.SynapseAppearanceSettings = Object.freeze({ apply });

    apply(store.all());
    store.subscribe(apply);
})(typeof globalThis !== 'undefined' ? globalThis : window);
