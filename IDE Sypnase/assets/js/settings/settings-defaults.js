(function (root) {
    'use strict';

    const DEFAULT_VALUES = {
      interfaceFontSize: 12,
      editorFontSize: 11.5,
      editorLineSpacing: 'normal',
      editorFontFamily: 'default',
      editorSyntaxTheme: 'aurora',
      autocompleteEnabled: true,
      syntaxHighlightEnabled: true,
    };

    const LINE_SPACING_OPTIONS = [
      { id: 'compact', label: 'Compacto', ratio: 1.35 },
      { id: 'normal', label: 'Normal', ratio: 1.55 },
      { id: 'relaxed', label: 'Espacoso', ratio: 1.85 },
    ];

    const EDITOR_FONT_FAMILIES = [
      { id: 'default', label: 'Padrao da IDE', stack: '' },
      {
        id: 'jetbrains',
        label: 'JetBrains Mono',
        stack: "'JetBrains Mono', 'Fira Code', monospace",
      },
      { id: 'fira', label: 'Fira Code', stack: "'Fira Code', 'JetBrains Mono', monospace" },
      { id: 'consolas', label: 'Consolas', stack: "Consolas, 'Courier New', monospace" },
      { id: 'courier', label: 'Courier New', stack: "'Courier New', Courier, monospace" },
      {
        id: 'system',
        label: 'Mono do sistema',
        stack: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      },
    ];

    const EDITOR_SYNTAX_THEMES = [
      { id: 'aurora', label: 'Aurora' },
      { id: 'neon', label: 'Neon' },
      { id: 'solar', label: 'Solar' },
      { id: 'pastel', label: 'Pastel' },
      { id: 'mono', label: 'Monocromatico' },
    ];

    const INTERFACE_FONT_SIZE_RANGE = { minimum: 11, maximum: 17, step: 0.5 };
    const EDITOR_FONT_SIZE_RANGE = { minimum: 9, maximum: 22, step: 0.5 };

    function lineSpacingRatio(identifier) {
      const found = LINE_SPACING_OPTIONS.find((option) => option.id === identifier);
      return found ? found.ratio : 1.55;
    }

    function editorFontStack(identifier) {
      const found = EDITOR_FONT_FAMILIES.find((option) => option.id === identifier);
      return found ? found.stack : '';
    }

    root.SynapseSettingsDefaults = Object.freeze({
        values: Object.freeze({ ...DEFAULT_VALUES }),
        lineSpacingOptions: Object.freeze(LINE_SPACING_OPTIONS),
        editorFontFamilies: Object.freeze(EDITOR_FONT_FAMILIES),
        editorSyntaxThemes: Object.freeze(EDITOR_SYNTAX_THEMES),
        interfaceFontSizeRange: Object.freeze(INTERFACE_FONT_SIZE_RANGE),
        editorFontSizeRange: Object.freeze(EDITOR_FONT_SIZE_RANGE),
        lineSpacingRatio,
        editorFontStack,
    });
})(typeof globalThis !== 'undefined' ? globalThis : window);
