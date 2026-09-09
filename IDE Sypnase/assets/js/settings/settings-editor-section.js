(function (root) {
    'use strict';

    const controls = root.SynapseSettingsControls;
    const store = root.SynapseSettingsStore;
    const checkbox = root.SynapseSettingsCheckbox;

    function autocompleteRow() {
      const field = checkbox.create(store.get('autocompleteEnabled') !== false, (value) =>
        store.set('autocompleteEnabled', value),
      );
      return controls.createRow(
        'Autocompletar',
        'Sugestoes automaticas de codigo enquanto voce digita.',
        field,
      );
    }

    function syntaxHighlightRow() {
      const field = checkbox.create(store.get('syntaxHighlightEnabled') !== false, (value) =>
        store.set('syntaxHighlightEnabled', value),
      );
      return controls.createRow(
        'Realce de sintaxe',
        'Colore palavras-chave, textos, numeros e comentarios.',
        field,
      );
    }

    function create() {
      const section = controls.createSection('Editor de codigo');
      section.body.appendChild(autocompleteRow());
      section.body.appendChild(syntaxHighlightRow());
      return section.element;
    }

    root.SynapseSettingsEditorSection = Object.freeze({
        id: 'editor',
        label: 'Editor',
        create,
    });
})(typeof globalThis !== 'undefined' ? globalThis : window);
