(function (root) {
    'use strict';

    const controls = root.SynapseSettingsControls;
    const store = root.SynapseSettingsStore;
    const presets = root.SynapseSettingsDefaults;
    const numberField = root.SynapseSettingsNumberField;
    const dropdown = root.SynapseSettingsDropdown;

    function interfaceFontRow() {
      const range = presets.interfaceFontSizeRange;
      const field = numberField.create({
          label: 'Tamanho da fonte da interface',
          minimum: range.minimum,
          maximum: range.maximum,
          step: range.step,
          value: store.get('interfaceFontSize'),
          unit: 'px',
          onChange: (value) => store.set('interfaceFontSize', value),
      });
      return controls.createRow(
        'Tamanho da fonte da interface',
        'Menus, explorador de arquivos, abas e paineis.',
        field,
      );
    }

    function editorFontSizeRow() {
      const range = presets.editorFontSizeRange;
      const field = numberField.create({
          label: 'Tamanho da fonte do editor',
          minimum: range.minimum,
          maximum: range.maximum,
          step: range.step,
          value: store.get('editorFontSize'),
          unit: 'px',
          onChange: (value) => store.set('editorFontSize', value),
      });
      return controls.createRow(
        'Tamanho da fonte do editor',
        'Codigo, numeros de linha e sugestoes.',
        field,
      );
    }

    function lineSpacingRow() {
      const field = dropdown.create(
        presets.lineSpacingOptions,
        store.get('editorLineSpacing'),
        (identifier) => store.set('editorLineSpacing', identifier),
      );
      return controls.createRow(
        'Espacamento entre linhas',
        'Altura das linhas dentro do editor.',
        field,
      );
    }

    function editorFontFamilyRow() {
      const options = presets.editorFontFamilies.map((option) => ({
            id: option.id,
            label: option.label,
            fontFamily: option.stack,
      }));
      const field = dropdown.create(options, store.get('editorFontFamily'), (identifier) =>
        store.set('editorFontFamily', identifier),
      );
      return controls.createRow('Fonte do editor', 'Familia usada para escrever codigo.', field);
    }

    function syntaxThemeRow() {
      const field = dropdown.create(
        presets.editorSyntaxThemes,
        store.get('editorSyntaxTheme'),
        (identifier) => store.set('editorSyntaxTheme', identifier),
      );
      return controls.createRow(
        'Estilo do editor de codigo',
        'Paleta de cores das palavras-chave, textos e comentarios.',
        field,
      );
    }

    function create() {
      const section = controls.createSection('Fontes e aparencia');
      section.body.appendChild(interfaceFontRow());
      section.body.appendChild(editorFontSizeRow());
      section.body.appendChild(lineSpacingRow());
      section.body.appendChild(editorFontFamilyRow());
      section.body.appendChild(syntaxThemeRow());
      return section.element;
    }

    root.SynapseSettingsAppearanceSection = Object.freeze({
        id: 'appearance',
        label: 'Aparencia',
        create,
    });
})(typeof globalThis !== 'undefined' ? globalThis : window);
