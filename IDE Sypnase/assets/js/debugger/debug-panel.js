(function () {
    'use strict';

    const debug = window.SynapseDebug;
    const { element, button, input, section } = debug.dom;

    function createPanel() {
      const panel = element('aside', 'debug-panel');
      panel.id = 'debugPanel';
      panel.hidden = true;
      panel.setAttribute('aria-label', 'Debugger');
      const header = element('header', 'debug-header');
      const heading = element('div', 'debug-heading');
      heading.append(
        element('h2', '', 'Debugger'),
        element('span', 'debug-engine', 'V8 · Inspector'),
      );
      const close = button('Fechar debugger', 'close', 'close', false);
      header.append(heading, close);
      const status = element('div', 'debug-status', 'Desconectado');
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      const controls = element('div', 'debug-controls');
      controls.setAttribute('role', 'toolbar');
      controls.setAttribute('aria-label', 'Controles de depuração');
      const actions = [
        ['resume', 'Continuar · F5', 'Continuar'],
        ['pause', 'Pausar · F6', 'Pausar'],
        ['stepOver', 'Step over · F10', 'Over'],
        ['stepInto', 'Step into · F11', 'Into'],
        ['stepOut', 'Step out · Shift+F11', 'Out'],
        ['stop', 'Parar/desconectar · Shift+F5', 'Parar'],
      ];
      for (const [action, label, shortLabel] of actions) {
        const control = button(label, action, action, false);
        control.append(element('span', '', shortLabel));
        controls.append(control);
      }
      const scroll = element('div', 'debug-scroll');
      const setup = section('Executar e conectar');
      const projectName = element('div', 'debug-project');
      const entryLabel = element('label', 'debug-label', 'Entrada JavaScript · Node.js local');
      const entry = element('select', 'debug-input');
      entry.id = 'debugEntry';
      entryLabel.htmlFor = entry.id;
      const launch = button('Iniciar depuração', 'launch', 'resume');
      launch.classList.add('debug-primary');
      launch.id = 'debugLaunch';
      const help = element(
        'p',
        'debug-help',
        'Executa no seu computador. Requer relay local, Node.js e permissão de terminal. O preview não é alterado.',
      );
      const advanced = element('details', 'debug-advanced');
      advanced.append(element('summary', '', 'Conectar a navegador ou Node existente'));
      const endpoint = input('WebSocket do alvo Inspector');
      endpoint.id = 'debugEndpoint';
      const root = input('Raiz das fontes: URL ou pasta absoluta');
      root.id = 'debugSourceRoot';
      const attach = button('Conectar ao alvo', 'attach', 'debug');
      attach.id = 'debugAttach';
      advanced.append(
        element(
          'p',
          'debug-help',
          'Use um alvo separado, nunca a aba desta IDE. Para Chrome, autorize somente a origem desta IDE em --remote-allow-origins. Não exponha a porta Inspector à internet.',
        ),
        endpoint,
        root,
        attach,
      );
      setup.content.append(projectName, entryLabel, entry, launch, help, advanced);
      const notice = element('p', 'debug-notice');
      notice.hidden = true;
      notice.setAttribute('role', 'alert');
      const location = element('div', 'debug-location');
      const variables = section('Variáveis');
      variables.content.id = 'debugVariables';
      const stack = section('Call stack');
      stack.content.id = 'debugStack';
      const watch = section('Watch');
      const watchForm = element('form', 'debug-form');
      const watchInput = input('Expressão para observar');
      watchInput.id = 'debugWatchInput';
      watchInput.maxLength = debug.preferences.limits.expression;
      const addWatch = button('Adicionar watch', 'addWatch', 'plus', false);
      addWatch.type = 'submit';
      watchForm.append(watchInput, addWatch);
      const watchValues = element('div', 'debug-watch-values');
      watchValues.id = 'debugWatchValues';
      watch.content.append(
        watchForm,
        element('p', 'debug-help', 'Avaliadas no frame selecionado, sem efeitos colaterais.'),
        watchValues,
      );
      const breakpoints = section('Breakpoints');
      const breakpointForm = element('form', 'debug-form');
      const lineInput = input('Linha no arquivo aberto', 'number');
      lineInput.id = 'debugBreakpointLine';
      lineInput.min = '1';
      lineInput.step = '1';
      lineInput.required = true;
      const addBreakpoint = button('Alternar breakpoint', 'addBreakpoint', 'plus', false);
      addBreakpoint.type = 'submit';
      breakpointForm.append(lineInput, addBreakpoint);
      const breakpointValues = element('div', 'debug-breakpoint-values');
      breakpointValues.id = 'debugBreakpoints';
      breakpoints.content.append(
        element(
          'p',
          'debug-help',
          'Clique no número da linha ou pressione F9. Círculo vazio: ainda não confirmado pelo runtime.',
        ),
        breakpointForm,
        breakpointValues,
      );
      const output = section('Saída de depuração');
      output.container.open = false;
      const outputText = element('pre', 'debug-output');
      outputText.id = 'debugOutput';
      output.content.append(outputText);
      scroll.append(
        setup.container,
        notice,
        location,
        variables.container,
        stack.container,
        watch.container,
        breakpoints.container,
        output.container,
        element(
          'p',
          'debug-help debug-footnote',
          'Linhas do JavaScript executado. TypeScript/JSX, source maps e o iframe interno não são traduzidos por este debugger.',
        ),
      );
      panel.append(header, status, controls, scroll);
      (document.querySelector('.app > .body') || document.body).append(panel);
      return {
        panel,
        setup,
        status,
        controls,
        entry,
        launch,
        attach,
        endpoint,
        root,
        projectName,
        notice,
        location,
        variables: variables.content,
        stack: stack.content,
        watch: watchValues,
        watchForm,
        watchInput,
        breakpointForm,
        lineInput,
        breakpoints: breakpointValues,
        output: outputText,
      };
    }

    debug.createPanel = createPanel;
})();
