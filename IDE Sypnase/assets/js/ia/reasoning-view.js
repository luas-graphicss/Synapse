'use strict';

(function () {
    function duration(milliseconds) {
      if (milliseconds == null) return 'tempo não informado';
      const seconds = Math.max(0, milliseconds) / 1000;
      if (seconds < 60) {
        return `${seconds.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`;
      }
      return `${Math.floor(seconds / 60)} min ${Math.floor(seconds % 60)} s`;
    }

    function number(value) {
      return value == null ? 'Não informado' : Number(value).toLocaleString('pt-BR');
    }

    function update(message, block, finished = false) {
      if (!message || !block) return;
      let container = message.querySelector('.ai-reasoning-list');
      if (!container) {
        container = document.createElement('div');
        container.className = 'ai-reasoning-list';
        message.insertBefore(container, message.querySelector('.ia-md'));
      }
      let disclosure = [...container.querySelectorAll('details')].find(
        (item) => item.dataset.reasoningId === block.id,
      );
      if (!disclosure) {
        disclosure = document.createElement('details');
        disclosure.className = 'ai-reasoning';
        disclosure.dataset.reasoningId = block.id;
        disclosure.innerHTML = `<summary><span class="ai-reasoning-icon">${iaIcone('raio')}</span><span class="ai-reasoning-title"></span><time></time></summary><div class="ai-reasoning-content"><p class="ai-helper">Conteúdo disponibilizado pela API. O tempo é o intervalo observado no streaming, não o tempo interno do modelo.</p><div class="ai-reasoning-text"></div></div>`;
        container.appendChild(disclosure);
      }
      disclosure.dataset.startedAt = String(block.startedAt || '');
      disclosure.dataset.measurable = String(block.measurable !== false);
      disclosure.dataset.finished = String(finished || block.endedAt != null);
      disclosure.querySelector('.ai-reasoning-title').textContent =
      finished || block.endedAt != null ? 'Thinking concluído' : 'Thinking…';
      disclosure.querySelector('time').textContent =
      block.measurable === false
      ? 'sem medição'
      : duration(block.ms ?? Date.now() - block.startedAt);
      disclosure.querySelector('.ai-reasoning-text').textContent = block.text || '';
    }

    function tick(root) {
      for (const element of root?.querySelectorAll(
          '.ai-reasoning[data-finished="false"][data-measurable="true"]',
        ) || []) {
        element.querySelector('time').textContent = duration(
          Date.now() - Number(element.dataset.startedAt),
        );
      }
    }

    function summary(metrics) {
      const element = document.createElement('div');
      element.className = 'ai-task-summary';
      element.setAttribute('role', 'status');
      const labels = {
        completed: 'Tarefa concluída',
        interrupted: 'Tarefa interrompida',
        limited: 'Limite atingido',
        error: 'Execução com erro',
      };
      const tokenLabel = metrics.usageReported
      ? `${number(metrics.total)} tokens${metrics.usageComplete ? '' : ' confirmados · parcial'}`
      : 'Tokens não informados pela API';
      element.innerHTML = `<span>${iaEsc(labels[metrics.status] || 'Resumo da tarefa')}</span><strong>${iaEsc(duration(metrics.ms))}</strong><span>${iaEsc(tokenLabel)}</span>`;
      element.title = `Entrada: ${number(metrics.entrada)} · Saída (inclui raciocínio): ${number(metrics.saida)} · ${metrics.passos || 0} requisições · ${metrics.chamadas || 0} ferramentas. Tempo total observado, incluindo ferramentas e espera por aprovação.`;
      return element;
    }

    window.SynapseAIReasoningView = Object.freeze({ update, tick, summary, duration, number });
})();
