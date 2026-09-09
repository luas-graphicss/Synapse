(function (root) {
    'use strict';

    const store = root.SynapseSettingsStore;
    const documentElement = document.documentElement;

    function isAutocompleteEnabled() {
      return store.get('autocompleteEnabled') !== false;
    }

    function isSyntaxHighlightEnabled() {
      return store.get('syntaxHighlightEnabled') !== false;
    }

    function apply(settings) {
      documentElement.setAttribute(
        'data-syntax-highlight',
        settings.syntaxHighlightEnabled === false ? 'off' : 'on',
      );
      documentElement.setAttribute(
        'data-autocomplete',
        settings.autocompleteEnabled === false ? 'off' : 'on',
      );
      if (settings.autocompleteEnabled === false && root.SynapseAutocomplete)
      root.SynapseAutocomplete.dismiss();
    }

    root.SynapseEditorFeatureSettings = Object.freeze({
        apply,
        isAutocompleteEnabled,
        isSyntaxHighlightEnabled,
    });

    apply(store.all());
    store.subscribe(apply);
})(typeof globalThis !== 'undefined' ? globalThis : window);
