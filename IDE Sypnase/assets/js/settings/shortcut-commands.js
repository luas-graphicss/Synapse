(function (root) {
    'use strict';

    function clickElement(identifier) {
      const element = document.getElementById(identifier);
      if (!element) return false;
      element.click();
      return true;
    }

    function openSettings() {
      if (!root.SynapseSettingsPanel) return false;
      root.SynapseSettingsPanel.toggle();
      return true;
    }

    function toggleTheme() {
      if (typeof root.toggleTheme !== 'function') return false;
      root.toggleTheme();
      return true;
    }

    function requestCompletion() {
      const editor = document.getElementById('codeTa');
      if (!editor || !root.SynapseAutocomplete) return false;
      editor.focus({ preventScroll: true });
      root.SynapseAutocomplete.request(true);
      return true;
    }

    function currentProject() {
      return typeof root.activeProject === 'function' ? root.activeProject() : null;
    }

    function openFileByOffset(offset) {
      const project = currentProject();
      if (!project || !Array.isArray(project.openTabs)) return false;
      if (project.openTabs.length < 2 || typeof root.openFileInEditor !== 'function') return false;
      const paths = project.openTabs;
      const currentIndex = paths.indexOf(project.openFile);
      const startIndex = currentIndex < 0 ? 0 : currentIndex;
      const nextIndex = (startIndex + offset + paths.length) % paths.length;
      root.openFileInEditor(paths[nextIndex]);
      return true;
    }

    function closeCurrentFile() {
      const project = currentProject();
      if (!project || !project.openFile || typeof root.closeTab !== 'function') return false;
      root.closeTab(project.openFile);
      return true;
    }

    const COMMAND_ACTIONS = {
      'workspace.openSettings': openSettings,
      'workspace.toggleTheme': toggleTheme,
      'editor.requestCompletion': requestCompletion,
      'files.nextFile': () => openFileByOffset(1),
      'files.previousFile': () => openFileByOffset(-1),
      'files.closeFile': closeCurrentFile,
      'panels.toggleTerminal': () => clickElement('termBtn'),
      'panels.toggleDebugger': () => clickElement('debugBtn'),
      'panels.toggleBuildSystem': () => clickElement('buildSystemBtn'),
      'panels.toggleAssistant': () => clickElement('iaBtn'),
      'panels.toggleMcp': () => clickElement('mcpBtn'),
    };

    function run(commandId) {
      const action = COMMAND_ACTIONS[commandId];
      if (!action) return false;
      try {
        return action() === true;
      } catch (error) {
        if (typeof root.ignorarErro === 'function') root.ignorarErro(error, 'shortcut.command');
        return false;
      }
    }

    root.SynapseShortcutCommands = Object.freeze({ run });
})(typeof globalThis !== 'undefined' ? globalThis : window);
