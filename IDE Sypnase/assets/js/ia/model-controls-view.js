'use strict';

(function () {
    function input(id, label, value, attributes = '', helper = '') {
      return `<div class="ai-field"><label for="${id}">${label}</label><input class="ia-in" id="${id}" data-ai-setting="${id}" value="${iaEsc(value ?? '')}" ${attributes}><small>${helper}</small></div>`;
    }

    function optionalControls(connection, settings, capabilities) {
      const controls = [];
      if (capabilities.topP) {
        controls.push(
          input(
            'aiTopP',
            'Top P',
            settings.topP,
            'type="number" min="0.01" max="1" step="0.01" placeholder="Padrão da API"',
            'Preencher substitui a temperatura.',
          ),
        );
      }
      if (capabilities.topK) {
        controls.push(
          input(
            'aiTopK',
            'Top K',
            settings.topK,
            'type="number" min="1" max="500" step="1" placeholder="Padrão da API"',
          ),
        );
      }
      if (capabilities.seed) {
        controls.push(
          input(
            'aiSeed',
            'Seed',
            settings.seed,
            'type="number" min="0" max="2147483647" step="1" placeholder="Aleatória"',
            'Reprodutibilidade quando suportada; não garante resposta idêntica.',
          ),
        );
      }
      if (capabilities.penalties) {
        controls.push(
          input(
            'aiFrequencyPenalty',
            'Penalidade de frequência',
            settings.frequencyPenalty,
            'type="number" min="-2" max="2" step="0.1" placeholder="Padrão da API"',
          ),
        );
        controls.push(
          input(
            'aiPresencePenalty',
            'Penalidade de presença',
            settings.presencePenalty,
            'type="number" min="-2" max="2" step="0.1" placeholder="Padrão da API"',
          ),
        );
      }
      return `<details class="ai-settings-disclosure"><summary>Amostragem avançada</summary><div class="ai-settings-content"><div class="ai-field-grid">${controls.join('') || '<p class="ai-helper">Este modelo não expõe controles adicionais de amostragem nesta integração.</p>'}</div>${capabilities.stop ? `<div class="ai-field"><label for="aiStopSequences">Sequências de parada</label><textarea id="aiStopSequences" class="ia-in" data-ai-setting="aiStopSequences" rows="3" placeholder="Uma por linha, até 4">${iaEsc(settings.stopSequences.join('\n'))}</textarea><small>Interrompe a geração ao encontrar uma sequência. Pode cortar código ou respostas.</small></div>` : ''}</div></details>`;
    }

    function thinkingControls(connection, settings, capabilities) {
      if (capabilities.thinking === 'unsupported') {
        return `<p class="ai-helper">Raciocínio configurável não identificado para este modelo.${connection.prov === 'openrouter' ? ' Use Atualizar catálogo para consultar as capacidades atuais.' : ' Não enviaremos parâmetros de thinking não reconhecidos.'}</p>`;
      }
      const options = [
        ['auto', 'Padrão do modelo'],
        ['enabled', 'Ativado'],
        ...(!capabilities.thinkingRequired ? [['disabled', 'Desativado']] : []),
      ];
      const selected =
      capabilities.thinkingRequired && settings.thinking === 'disabled'
      ? 'auto'
      : settings.thinking;
      const selection = `<div class="ai-field"><label for="aiThinking">Modo de raciocínio</label><select class="ia-sel" id="aiThinking" data-ai-setting="aiThinking">${options.map(([value, label]) => `<option value="${value}"${value === selected ? ' selected' : ''}>${label}</option>`).join('')}</select><small>${capabilities.thinkingRequired ? 'Este modelo não permite desativar o raciocínio.' : 'Ative para tarefas complexas ou desative para reduzir latência, quando permitido.'}</small></div>`;
      const budgetSelected =
      capabilities.thinking === 'openrouter' &&
      settings.reasoningControl === 'budget' &&
      capabilities.supportsThinkingBudget;
      const control =
      capabilities.thinking === 'openrouter' && capabilities.supportsThinkingBudget
      ? `<div class="ai-field"><label for="aiReasoningControl">Controle do raciocínio</label><select class="ia-sel" id="aiReasoningControl" data-ai-setting="aiReasoningControl"><option value="effort"${!budgetSelected ? ' selected' : ''}>Esforço / padrão do modelo</option><option value="budget"${budgetSelected ? ' selected' : ''}>Orçamento de tokens</option></select><small>Use um controle de cada vez para evitar parâmetros conflitantes.</small></div>`
      : '';
      const effort = capabilities.efforts.length
      ? `<div class="ai-field"><label for="aiReasoningEffort">Esforço de raciocínio</label><select class="ia-sel" id="aiReasoningEffort" data-ai-setting="aiReasoningEffort"${!capabilities.thinkingActive || budgetSelected ? ' disabled' : ''}>${['auto', ...capabilities.efforts].map((value) => `<option value="${value}"${settings.reasoningEffort === value ? ' selected' : ''}>${{ auto: 'Padrão do modelo', minimal: 'Mínimo', low: 'Baixo', medium: 'Médio', high: 'Alto', xhigh: 'Muito alto', max: 'Máximo' }[value]}</option>`).join('')}</select></div>`
      : '';
      const budgetEnabled =
      capabilities.thinking === 'openrouter'
      ? budgetSelected && capabilities.thinkingActive
      : settings.thinking === 'enabled';
      const budgetMaximum =
      capabilities.thinking === 'gemini-budget'
      ? capabilities.budgetMax
      : Math.max(
        capabilities.budgetMin,
        Math.min(capabilities.budgetMax, connection.maxTokens - 1),
      );
      const budget = capabilities.supportsThinkingBudget
      ? input(
        'aiThinkingBudget',
        'Orçamento de raciocínio',
        settings.thinkingBudget,
        `type="number" min="${capabilities.budgetMin}" max="${budgetMaximum}" step="1"${!budgetEnabled ? ' disabled' : ''}`,
        'Os tokens de raciocínio podem contar no limite de saída. Reserve espaço para a resposta final.',
      )
      : '';
      const visibility = capabilities.reasoningVisible
      ? 'O conteúdo fornecido pela API aparece em uma caixa Thinking expansível na conversa.'
      : 'Esta API não expõe o texto do raciocínio. Não mostraremos pensamentos inventados.';
      return `${selection}${control}<div class="ai-field-grid">${effort}${budget}</div><p class="ai-helper">${visibility}</p>`;
    }

    function render() {
      const target = document.getElementById('iaViewModel');
      if (!target) return;
      const connection = iaConexaoAtiva();
      if (!connection) {
        target.innerHTML =
        '<div class="ai-page"><h2>Configure seu modelo</h2><p class="ai-helper">Adicione uma conexão para personalizar o assistente.</p><button class="ia-btn pri" type="button" data-act="cfg">Adicionar conexão</button></div>';
        return;
      }
      if (connection.formato === 'notion-agents') {
        target.innerHTML =
        '<div class="ai-page"><h2>Agente do Notion</h2><p class="ai-helper">O modelo e seus parâmetros são gerenciados pelo agente no Notion. Esta conexão não expõe temperatura, thinking ou saldo pela API de chat.</p><button class="ia-btn" type="button" data-act="cfg">Configurar conexão</button></div>';
        return;
      }
      const settings = window.SynapseAIGenerationSettings.normalize(connection.generation);
      const capabilities = window.SynapseAIModelCapabilities.resolve(connection);
      const provider = iaProvedor(connection.prov);
      const names = [
        ...new Set([
            ...(IA.modelosCache[connection.id] || provider.modelos || []),
            connection.modelo,
        ]),
      ];
      const temperature = input(
        'aiTemperature',
        'Temperatura',
        connection.temp,
        `type="number" min="0" max="${capabilities.temperatureMax}" step="0.1"${!capabilities.temperature || (capabilities.topP && settings.topP != null) ? ' disabled' : ''}`,
        !capabilities.temperature
        ? 'Controlada pelo modelo neste modo.'
        : capabilities.topP && settings.topP != null
        ? 'Remova Top P para usar a temperatura.'
        : 'Menor: mais focado. Maior: mais variado.',
      );
      const output = input(
        'aiMaxTokens',
        'Limite de saída',
        connection.maxTokens,
        `type="number" min="256" max="${capabilities.outputLimit || 131072}" step="1"`,
        'Por resposta da API, não por tarefa inteira.',
      );
      target.innerHTML = `<div class="ai-page"><div class="ai-page-heading"><h2>Modelo e comportamento</h2><p>Ajustes salvos por conexão. A execução atual usa uma configuração fixa.</p></div><fieldset class="ai-settings-fieldset"${IA_CHAT.rodando ? ' disabled' : ''}><section class="ai-settings-section"><div class="ai-section-heading"><h3>${iaEsc(connection.nome)}</h3><button class="ia-btn" type="button" data-ai-model-refresh>Atualizar catálogo</button></div><div class="ai-field"><label for="aiModelName">Modelo</label><input id="aiModelName" class="ia-in" data-ai-setting="aiModelName" list="aiModelCatalog" value="${iaEsc(connection.modelo)}" spellcheck="false"><datalist id="aiModelCatalog">${names.map((name) => `<option value="${iaEsc(name)}"></option>`).join('')}</datalist><small>${capabilities.contextWindow ? `Janela anunciada: ${capabilities.contextWindow.toLocaleString('pt-BR')} tokens.` : 'Use o identificador exato fornecido pelo provedor.'}</small></div>${!capabilities.known ? '<p class="ai-helper">Compatibilidade não confirmada por catálogo. Servidores compatíveis podem aceitar apenas parte dos parâmetros.</p>' : ''}<div class="ai-field-grid">${temperature}${output}</div></section><section class="ai-settings-section"><h3>Thinking</h3>${thinkingControls(connection, settings, capabilities)}</section>${optionalControls(connection, settings, capabilities)}<section class="ai-settings-section"><h3>Comportamento</h3><label class="ai-check"><input type="checkbox" id="aiToolsEnabled" data-ai-setting="aiToolsEnabled"${settings.toolsEnabled ? ' checked' : ''}${!capabilities.tools ? ' disabled' : ''}><span>Permitir ferramentas do projeto<small>Desativar impede ações no projeto. A política de aprovação continua valendo.</small></span></label>${capabilities.parallelTools ? `<label class="ai-check"><input type="checkbox" id="aiParallelTools" data-ai-setting="aiParallelTools"${settings.parallelTools ? ' checked' : ''}><span>Permitir múltiplas chamadas por resposta<small>A execução local permanece sequencial para respeitar aprovações e arquivos.</small></span></label>` : ''}<div class="ai-field"><label for="aiInstructions">Instruções adicionais</label><textarea class="ia-in" id="aiInstructions" data-ai-setting="aiInstructions" maxlength="12000" rows="4" placeholder="Ex.: código em inglês, respostas objetivas e testes antes de concluir.">${iaEsc(settings.instructions)}</textarea><small>Enviadas junto às instruções do projeto em cada requisição. Não inclua chaves ou senhas.</small></div></section></fieldset><div id="aiModelStatus" class="ai-helper" role="status">${IA_CHAT.rodando ? 'Aguarde o fim da tarefa para alterar o modelo.' : 'Alterações são salvas automaticamente.'}</div><button class="ia-btn" type="button" data-act="cfg">Conexões e permissões</button></div>`;
    }

    function status(message) {
      const target = document.getElementById('aiModelStatus');
      if (target) target.textContent = message;
    }

    function persist(connection) {
      const view = document.getElementById('iaViewModel');
      const scrollTop = view?.scrollTop || 0;
      const focusedId = view?.contains(document.activeElement) ? document.activeElement.id : '';
      const expanded = [...(view?.querySelectorAll('details') || [])].map((element) => element.open);
      iaSalvarConexao(connection);
      window.SynapseAIUsageView.invalidate();
      iaAtualizarBarra();
      render();
      for (const [index, element] of [...(view?.querySelectorAll('details') || [])].entries()) {
        element.open = !!expanded[index];
      }
      if (focusedId) document.getElementById(focusedId)?.focus({ preventScroll: true });
      if (view) view.scrollTop = scrollTop;
      status('Ajuste salvo para a próxima execução.');
    }

    function change(event) {
      const target = event.target;
      if (!target.dataset.aiSetting) return false;
      if (IA_CHAT.rodando) return true;
      if (!target.checkValidity()) {
        target.reportValidity();
        return true;
      }
      const active = iaConexaoAtiva();
      if (!active) return true;
      const connection = {
        ...active,
        generation: window.SynapseAIGenerationSettings.normalize(active.generation),
      };
      const map = {
        aiThinking: 'thinking',
        aiReasoningEffort: 'reasoningEffort',
        aiReasoningControl: 'reasoningControl',
        aiThinkingBudget: 'thinkingBudget',
        aiTopP: 'topP',
        aiTopK: 'topK',
        aiSeed: 'seed',
        aiFrequencyPenalty: 'frequencyPenalty',
        aiPresencePenalty: 'presencePenalty',
        aiStopSequences: 'stopSequences',
        aiInstructions: 'instructions',
        aiToolsEnabled: 'toolsEnabled',
        aiParallelTools: 'parallelTools',
      };
      if (target.id === 'aiModelName') {
        if (!target.value.trim()) {
          status('Informe um modelo válido.');
          return true;
        }
        connection.modelo = target.value.trim();
        connection.generation.thinking = 'auto';
        connection.generation.reasoningEffort = 'auto';
      } else if (target.id === 'aiTemperature') connection.temp = Number(target.value);
      else if (target.id === 'aiMaxTokens') connection.maxTokens = Number(target.value);
      else if (map[target.id]) {
        connection.generation[map[target.id]] =
        target.type === 'checkbox' ? target.checked : target.value;
      }
      connection.generation = window.SynapseAIGenerationSettings.normalize(connection.generation);
      const capabilities = window.SynapseAIModelCapabilities.resolve(connection);
      if (
        capabilities.thinking === 'anthropic-budget' &&
        capabilities.thinkingActive &&
        connection.maxTokens <= 1024
      ) {
        status('Aumente o limite de saída para mais de 1.024 tokens antes de ativar Thinking.');
        target.value =
        target.id === 'aiMaxTokens' ? active.maxTokens : active.generation?.thinking || 'auto';
        return true;
      }
      persist(connection);
      return true;
    }

    async function refresh() {
      const connection = iaConexaoAtiva();
      if (!connection || IA_CHAT.rodando) return;
      status('Consultando modelos e capacidades…');
      try {
        const names = await iaListarModelos(connection);
        if (iaConexaoAtiva()?.id !== connection.id) return;
        render();
        iaAtualizarBarra();
        status(
          `${names.length} modelos carregados. Capacidades atualizadas quando fornecidas pela API.`,
        );
      } catch (error) {
        status(iaErroAmigavel(error, connection));
      }
    }

    function toggle() {
      const active = iaConexaoAtiva();
      if (!active || IA_CHAT.rodando) return;
      const capabilities = window.SynapseAIModelCapabilities.resolve(active);
      if (capabilities.thinking === 'unsupported' || capabilities.thinkingRequired) {
        iaVista('model');
        return;
      }
      const connection = {
        ...active,
        generation: window.SynapseAIGenerationSettings.normalize(active.generation),
      };
      connection.generation.thinking = capabilities.thinkingActive ? 'disabled' : 'enabled';
      if (
        capabilities.thinking === 'anthropic-budget' &&
        connection.generation.thinking === 'enabled' &&
        connection.maxTokens <= 1024
      ) {
        iaVista('model');
        status('Aumente o limite de saída para mais de 1.024 tokens antes de ativar Thinking.');
        return;
      }
      persist(connection);
    }

    window.SynapseAIModelControlsView = Object.freeze({ render, change, refresh, toggle });
})();
