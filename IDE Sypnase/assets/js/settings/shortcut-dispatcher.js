(function (root) {
    'use strict';

    const EDITABLE_SELECTOR =
    'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

    function isTypingTarget(target) {
      if (!target || typeof target.closest !== 'function') return false;
      return !!target.closest(EDITABLE_SELECTOR);
    }

    function isCapturingShortcut() {
      return !!root.SynapseShortcutCapture && root.SynapseShortcutCapture.isActive();
    }

    function handle(event) {
      if (!root.SynapseShortcutBindings || isCapturingShortcut()) return null;
      const shortcut = root.SynapseShortcutBindings.resolve(event);
      if (!shortcut) return null;
      const needsModifier = isTypingTarget(event.target);
      if (needsModifier && !root.SynapseShortcutFormat.hasModifier(shortcut.binding)) return null;
      return shortcut;
    }

    function runOwnedCommand(shortcut) {
      if (!shortcut || !root.SynapseShortcutCommands) return false;
      return root.SynapseShortcutCommands.run(shortcut.id);
    }

    root.SynapseShortcutDispatcher = Object.freeze({ handle, runOwnedCommand });
})(typeof globalThis !== 'undefined' ? globalThis : window);
