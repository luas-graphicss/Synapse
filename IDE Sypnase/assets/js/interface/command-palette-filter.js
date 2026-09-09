(function (root) {
    'use strict';

    function translate(text) {
      if (!text) return '';
      const translator = root.SYNAPSE_I18N;
      if (!translator || typeof translator.t !== 'function') return text;
      return translator.t(text);
    }

    function searchableText(command) {
      const label = command.label || '';
      const hint = command.hint || '';
      return [label, hint, translate(label), translate(hint)].join(' ').toLowerCase();
    }

    function filterCommands(commands, query) {
      const term = (query || '').toLowerCase().trim();
      if (!term) return commands;
      return commands.filter((command) => searchableText(command).includes(term));
    }

    root.SynapseCommandPaletteFilter = Object.freeze({ filterCommands });
})(typeof globalThis !== 'undefined' ? globalThis : window);
