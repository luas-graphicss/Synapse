(function (root) {
    'use strict';

    const SHORTCUT_GROUPS = [
      { id: 'workspace', label: 'Area de trabalho' },
      { id: 'editor', label: 'Editor' },
      { id: 'files', label: 'Arquivos' },
      { id: 'panels', label: 'Paineis e ferramentas' },
      { id: 'layout', label: 'Layout' },
    ];

    const SHORTCUTS = [
      {
        id: 'workspace.commandPalette',
        label: 'Paleta de comandos',
        group: 'workspace',
        defaultBinding: 'Mod+K',
        worksWithOverlay: true,
      },
      {
        id: 'workspace.quickOpen',
        label: 'Abertura rapida de arquivo',
        group: 'workspace',
        defaultBinding: 'Mod+P',
        worksWithOverlay: true,
      },
      {
        id: 'workspace.history',
        label: 'Historico do projeto',
        group: 'workspace',
        defaultBinding: 'Mod+H',
        worksWithOverlay: true,
      },
      {
        id: 'workspace.openSettings',
        label: 'Abrir configuracoes',
        group: 'workspace',
        defaultBinding: 'Mod+,',
        worksWithOverlay: true,
      },
      {
        id: 'workspace.toggleSidebar',
        label: 'Mostrar ou ocultar o explorador',
        group: 'workspace',
        defaultBinding: 'Mod+B',
      },
      {
        id: 'workspace.toggleTheme',
        label: 'Alternar tema claro e escuro',
        group: 'workspace',
        defaultBinding: 'Mod+Alt+L',
      },
      {
        id: 'editor.findInFile',
        label: 'Localizar no arquivo',
        group: 'editor',
        defaultBinding: 'Mod+F',
        worksWithOverlay: true,
      },
      {
        id: 'editor.findInProject',
        label: 'Localizar no projeto',
        group: 'editor',
        defaultBinding: 'Mod+Shift+F',
        worksWithOverlay: true,
      },
      {
        id: 'editor.replaceInProject',
        label: 'Substituir no projeto',
        group: 'editor',
        defaultBinding: 'Mod+Shift+H',
        worksWithOverlay: true,
      },
      {
        id: 'editor.formatFile',
        label: 'Formatar arquivo atual',
        group: 'editor',
        defaultBinding: 'Alt+Shift+F',
        worksWithOverlay: true,
      },
      {
        id: 'editor.requestCompletion',
        label: 'Pedir sugestoes de codigo',
        group: 'editor',
        defaultBinding: 'Mod+Space',
      },
      {
        id: 'files.nextFile',
        label: 'Proximo arquivo aberto',
        group: 'files',
        defaultBinding: 'Alt+ArrowRight',
      },
      {
        id: 'files.previousFile',
        label: 'Arquivo aberto anterior',
        group: 'files',
        defaultBinding: 'Alt+ArrowLeft',
      },
      {
        id: 'files.closeFile',
        label: 'Fechar arquivo atual',
        group: 'files',
        defaultBinding: 'Alt+W',
      },
      {
        id: 'panels.refreshPreview',
        label: 'Atualizar preview',
        group: 'panels',
        defaultBinding: 'Mod+S',
      },
      {
        id: 'panels.toggleConsole',
        label: 'Console e DevTools',
        group: 'panels',
        defaultBinding: 'Mod+`',
      },
      {
        id: 'panels.toggleTerminal',
        label: 'Terminal',
        group: 'panels',
        defaultBinding: 'Mod+Alt+T',
      },
      {
        id: 'panels.toggleDebugger',
        label: 'Depurador',
        group: 'panels',
        defaultBinding: 'Mod+Shift+D',
      },
      {
        id: 'panels.toggleBuildSystem',
        label: 'Build e Run',
        group: 'panels',
        defaultBinding: 'Mod+Alt+B',
      },
      {
        id: 'panels.toggleAssistant',
        label: 'Assistente de IA',
        group: 'panels',
        defaultBinding: 'Mod+Alt+I',
      },
      {
        id: 'panels.toggleMcp',
        label: 'Painel MCP',
        group: 'panels',
        defaultBinding: 'Mod+Alt+M',
      },
      { id: 'layout.split', label: 'Layout dividido', group: 'layout', defaultBinding: 'Mod+1' },
      { id: 'layout.editor', label: 'Somente editor', group: 'layout', defaultBinding: 'Mod+2' },
      { id: 'layout.preview', label: 'Somente preview', group: 'layout', defaultBinding: 'Mod+3' },
    ];

    function list() {
      return SHORTCUTS.map((shortcut) => ({ ...shortcut }));
    }

    function find(identifier) {
      const found = SHORTCUTS.find((shortcut) => shortcut.id === identifier);
      return found ? { ...found } : null;
    }

    function groups() {
      return SHORTCUT_GROUPS.map((group) => ({ ...group }));
    }

    root.SynapseShortcutCatalog = Object.freeze({ list, find, groups });
})(typeof globalThis !== 'undefined' ? globalThis : window);
