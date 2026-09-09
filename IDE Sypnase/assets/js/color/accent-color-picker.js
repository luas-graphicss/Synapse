(function (root) {
    'use strict';

    const PICKER_TITLE = 'Cor de destaque';
    const FALLBACK_ACCENT = '#6aa3ff';

    function currentAccent() {
      if (typeof root.getComputedAcc !== 'function') return FALLBACK_ACCENT;
      const accent = root.SynapseColorConversion.normalizeHex(root.getComputedAcc());
      return accent || FALLBACK_ACCENT;
    }

    function previewAccent(hex) {
      if (typeof root.setAccentLive === 'function') root.setAccentLive(hex);
    }

    function saveAccent(hex) {
      if (typeof root.applyAccent === 'function') root.applyAccent(hex);
      if (typeof root.syncPickerTo === 'function') root.syncPickerTo(hex);
    }

    function openAccentColorPicker(anchor) {
      if (!root.SynapseColorPicker) return false;
      root.SynapseColorPicker.open({
          anchor: anchor || null,
          title: PICKER_TITLE,
          color: currentAccent(),
          preview: previewAccent,
          commit: saveAccent,
      });
      return true;
    }

    root.openAccentColorPicker = openAccentColorPicker;
    root.SynapseAccentColorPicker = Object.freeze({ open: openAccentColorPicker });
})(typeof globalThis !== 'undefined' ? globalThis : window);
