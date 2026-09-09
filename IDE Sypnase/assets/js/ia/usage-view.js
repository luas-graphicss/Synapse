'use strict';

(function () {
    let state = null;
    let identity = '';
    let controller = null;
    let requestVersion = 0;

    function connectionIdentity(connection) {
      return connection ? `${connection.id}|${connection.prov}|${connection.base}` : '';
    }

    function amount(value, currency) {
      try {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 4,
        }).format(value);
      } catch {
        return `${Number(value).toLocaleString('pt-BR')} ${currency}`;
      }
    }

    function metricsMarkup() {
      const metrics = IA_CHAT.stats || {};
      const format = window.SynapseAIReasoningView;
      const rows = [
        ['Entrada', metrics.usageReported ? metrics.entrada : null],
        ['Saída, incluindo raciocínio', metrics.usageReported ? metrics.saida : null],
        ['Raciocínio, quando discriminado', metrics.reasoning],
        ['Entrada lida do cache', metrics.cache],
      ];
      const total = metrics.usageReported ? format.number(metrics.total) : '—';
      return `<div class="ai-usage-total"><span>Tokens da tarefa${metrics.model ? ` · ${iaEsc(metrics.model)}` : ''}</span><strong>${iaEsc(total)}</strong><small>${metrics.usageReported ? (metrics.usageComplete ? 'Uso informado pela API' : 'Contagem parcial confirmada pela API') : 'Aguardando informações do provedor'}</small></div><dl class="ai-usage-breakdown">${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${iaEsc(format.number(value))}</dd></div>`).join('')}<div><dt>Tempo total observado</dt><dd>${metrics.passos ? iaEsc(format.duration(metrics.ms)) : '—'}</dd></div><div><dt>Requisições / ferramentas</dt><dd>${metrics.passos || 0} / ${metrics.chamadas || 0}</dd></div>${metrics.cost != null ? `<div><dt>Custo informado${metrics.costComplete ? '' : ' (parcial)'}</dt><dd>${iaEsc(amount(metrics.cost, 'USD'))}</dd></div>` : ''}</dl>`;
    }

    function balanceMarkup(connection) {
      const capability = window.SynapseAIAccountUsage.support(connection);
      if (!capability.supported) {
        return `<div class="ai-notice">${iaIcone('alerta')}<p>${iaEsc(capability.reason)}</p></div>`;
      }
      if (!state || state.status === 'idle') {
        return '<p class="ai-helper">Atualize para consultar o saldo diretamente no provedor.</p>';
      }
      if (state.status === 'loading') {
        return '<p class="ai-helper" role="status">Consultando o provedor…</p>';
      }
      if (state.status === 'error') {
        return `<div class="ai-notice" role="status">${iaIcone('alerta')}<p>${iaEsc(state.message)}</p></div>`;
      }
      const balances = (state.balances || [])
      .map(
        (balance) =>
        `<div class="ai-balance-value"><strong>${iaEsc(amount(balance.remaining, balance.currency))}</strong><span>${state.kind === 'key-limit' ? 'Limite restante desta chave' : 'Saldo disponível'}</span></div>`,
      )
      .join('');
      const missing = !balances
      ? '<p class="ai-helper">O provedor não informou um saldo restante. Uma chave sem limite configurado não significa créditos ilimitados.</p>'
      : '';
      const unavailable =
      state.available === false
      ? '<p class="ai-helper ai-warning">O provedor informou saldo insuficiente para novas chamadas.</p>'
      : '';
      const spent =
      state.spent != null
      ? `<p class="ai-helper">Uso acumulado desta chave: ${iaEsc(amount(state.spent, 'USD'))}.</p>`
      : '';
      return `${balances}${missing}${unavailable}${spent}<p class="ai-helper">${iaEsc(state.notice)}</p><p class="ai-helper">Consultado às ${new Date(state.checkedAt).toLocaleTimeString('pt-BR')}. Use Atualizar para conferir alterações.</p>`;
    }

    function render() {
      const target = document.getElementById('iaViewUsage');
      if (!target) return;
      const connection = iaConexaoAtiva();
      if (connectionIdentity(connection) !== identity) invalidate();
      identity = connectionIdentity(connection);
      const capability = window.SynapseAIAccountUsage.support(connection);
      const dashboard = connection ? iaProvedor(connection.prov).painel : '';
      target.innerHTML = `<div class="ai-page"><div class="ai-page-heading"><h2>Uso e créditos</h2><p>Consumo da tarefa e disponibilidade da sua conexão.</p></div><section class="ai-settings-section" aria-label="Uso da tarefa"><div id="aiUsageMetrics">${metricsMarkup()}</div><p class="ai-helper">Atualizado conforme a API envia dados. Alguns provedores só informam tokens ao final; números ausentes não são estimados. Uso acumulado não é a ocupação atual da janela de contexto.</p></section><section class="ai-settings-section"><div class="ai-section-heading"><h3>Saldo do provedor</h3><button class="ia-btn" data-ai-balance-refresh type="button" ${!capability.supported || state?.status === 'loading' ? 'disabled' : ''}>Atualizar</button></div><p class="ai-helper">${iaEsc(connection?.nome || 'Nenhuma conexão selecionada')}</p><div id="aiBalanceContent">${balanceMarkup(connection)}</div>${dashboard ? `<a class="ai-provider-link" href="https://${iaEsc(dashboard)}" target="_blank" rel="noopener noreferrer">Abrir painel do provedor ↗</a>` : ''}</section></div>`;
    }

    function updateMetrics() {
      const target = document.getElementById('aiUsageMetrics');
      if (target) target.innerHTML = metricsMarkup();
    }

    async function refresh() {
      const connection = iaConexaoAtiva();
      if (!window.SynapseAIAccountUsage.support(connection).supported) return;
      controller?.abort();
      controller = new AbortController();
      const version = ++requestVersion;
      identity = connectionIdentity(connection);
      state = { status: 'loading' };
      render();
      try {
        const result = await window.SynapseAIAccountUsage.load(
          { ...connection },
          { signal: controller.signal },
        );
        if (version !== requestVersion || identity !== connectionIdentity(iaConexaoAtiva())) return;
        state = result;
      } catch (error) {
        if (version !== requestVersion || error.name === 'AbortError') return;
        state = { status: 'error', message: error.message };
      } finally {
        if (version === requestVersion && IA_UI.vista === 'usage') render();
      }
    }

    function invalidate() {
      controller?.abort();
      requestVersion++;
      state = null;
      identity = '';
    }

    window.SynapseAIUsageView = Object.freeze({ render, refresh, updateMetrics, invalidate });
})();
