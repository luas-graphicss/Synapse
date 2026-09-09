(function (root) {
    'use strict';

    const labels = {
      title: ['Projetos CMake', 'CMake projects'],
      close: ['Fechar', 'Close'],
      source: ['Pasta de origem', 'Source directory'],
      mode: ['Configuração', 'Configuration mode'],
      manual: ['Opções da IDE', 'IDE options'],
      presets: ['Presets do projeto', 'Project presets'],
      configurePreset: ['Preset de configuração', 'Configure preset'],
      buildPreset: ['Preset de compilação', 'Build preset'],
      testPreset: ['Preset de testes', 'Test preset'],
      selectPreset: ['Selecione um preset', 'Select a preset'],
      buildDirectory: ['Pasta de build (relativa ao projeto)', 'Build directory (project-relative)'],
      configuration: ['Tipo de build', 'Build configuration'],
      generator: ['Gerador (opcional)', 'Generator (optional)'],
      defaultGenerator: ['Padrão do CMake', 'CMake default'],
      jobs: ['Tarefas paralelas', 'Parallel jobs'],
      target: ['Target (opcional)', 'Target (optional)'],
      allTargets: ['Padrão do projeto ou preset', 'Project or preset default'],
      advanced: ['Opções avançadas', 'Advanced options'],
      toolchain: ['Toolchain (arquivo do projeto)', 'Toolchain (project file)'],
      cache: ['Variáveis de cache — uma por linha', 'Cache entries — one per line'],
      configure: ['Configurar', 'Configure'],
      build: ['Compilar', 'Build'],
      test: ['Testar', 'Test'],
      clean: ['Limpar build', 'Clean build'],
      cancel: ['Interromper', 'Stop task'],
      commands: ['Comandos planejados', 'Planned commands'],
      output: ['Saída da última etapa', 'Latest step output'],
      ready: ['Pronto. Nenhum comando executado.', 'Ready. No commands executed.'],
      running: ['Executando', 'Running'],
      succeeded: ['Concluído sem erros.', 'Completed successfully.'],
      cancelled: ['Operação interrompida.', 'Task stopped.'],
      failed: ['Falha', 'Failed'],
      empty: [
        'Importe uma pasta ou ZIP com CMakeLists.txt. Projetos apenas com bibliotecas também são aceitos.',
        'Import a folder or ZIP containing CMakeLists.txt. Library-only projects are supported.',
      ],
      requirements: [
        'Requer Relay local, CMake 3.21+, compilador C/C++ e um gerador instalado. O terminal precisa estar autorizado no menu MCP. A importação nunca executa um build automaticamente.',
        'Requires the local Relay, CMake 3.21+, a C/C++ compiler and an installed generator. Authorize the terminal in the MCP menu. Importing never runs a build automatically.',
      ],
      workflow: [
        'Compilar configura antes do build. Testar configura, compila e executa CTest. Limpar usa apenas o target clean, sem apagar fontes ou cache.',
        'Build configures first. Test configures, builds and runs CTest. Clean uses only the clean target, preserving sources and cache.',
      ],
      native: [
        'Binários nativos rodam no computador do Relay, não no preview web. Para preview, gere e importe uma saída web compatível (por exemplo, com Emscripten).',
        'Native binaries run on the Relay computer, not in the web preview. For preview, generate and import a compatible web output (for example, with Emscripten).',
      ],
      presetNote: [
        'Gerador, cache, ambiente e paralelismo vêm dos presets. Build e testes exigem presets associados à configuração escolhida. Condições e macros são avaliadas pelo CMake instalado.',
        'Generator, cache, environment and parallelism come from presets. Build and test require presets linked to the selected configuration. Conditions and macros are evaluated by the installed CMake.',
      ],
    };

    function text(key) {
      const portuguese = String(document.documentElement.lang || 'pt')
      .toLowerCase()
      .startsWith('pt');
      return labels[key]?.[portuguese ? 0 : 1] || key;
    }

    root.SYNAPSE_CMAKE_LABELS = Object.freeze({ text });
})(globalThis);
