'use strict';

(function () {
    function support(connection) {
      if (!connection) {
        return {
          supported: false,
          reason: 'Adicione uma conexão para consultar o consumo e o saldo.',
        };
      }
      if (connection.prov === 'deepseek' && connection.formato === 'openai') {
        return { supported: true, kind: 'balance' };
      }
      if (connection.prov === 'openrouter' && connection.formato === 'openai') {
        return { supported: true, kind: 'key-limit' };
      }
      const local = ['ollama', 'lmstudio'].includes(connection.prov);
      return {
        supported: false,
        reason: local
        ? 'Este servidor local não fornece saldo de créditos. O uso de tokens aparece quando o servidor o informa.'
        : 'Esta integração não oferece consulta de saldo com a chave de chat. Consulte o painel do provedor; os tokens desta tarefa continuam disponíveis quando a API os informa.',
      };
    }

    function money(value) {
      if (value == null || value === '' || typeof value === 'boolean') return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    function parse(connection, payload) {
      if (connection.prov === 'openrouter') {
        const data = payload?.data;
        if (!data || typeof data !== 'object') {
          throw new Error('O provedor não retornou informações válidas da chave.');
        }
        return {
          kind: 'key-limit',
          balances:
          money(data.limit_remaining) == null
          ? []
          : [{ currency: 'USD', remaining: money(data.limit_remaining) }],
          limit: money(data.limit),
          spent: money(data.usage),
          reset: typeof data.limit_reset === 'string' ? data.limit_reset : null,
          freeTier: data.is_free_tier === true,
          notice:
          'Este valor é o limite restante da chave, não o saldo total da conta. A API não informa uma quantidade de tokens restantes.',
        };
      }
      if (!Array.isArray(payload?.balance_infos)) {
        throw new Error('O provedor não retornou um saldo válido.');
      }
      const balances = payload.balance_infos.map((balance) => ({
            currency: String(balance.currency || ''),
            remaining: money(balance.total_balance),
            granted: money(balance.granted_balance),
            toppedUp: money(balance.topped_up_balance),
      }));
      if (balances.some((balance) => !balance.currency || balance.remaining == null)) {
        throw new Error('O saldo retornado pelo provedor está incompleto.');
      }
      return {
        kind: 'balance',
        balances,
        available: typeof payload.is_available === 'boolean' ? payload.is_available : null,
        notice:
        'Saldo informado pelo provedor. Créditos monetários não equivalem a uma quantidade fixa de tokens.',
      };
    }

    async function load(connection, { signal, timeoutMs = 12000 } = {}) {
      const capability = support(connection);
      if (!capability.supported) return { status: 'unsupported', notice: capability.reason };
      if (iaPrecisaChave(connection) && !iaChaveDe(connection)) {
        throw new Error(
          'Adicione uma chave de API válida nos ajustes da conexão para consultar o saldo.',
        );
      }
      const controller = new AbortController();
      let timedOut = false;
      const cancel = () => controller.abort();
      if (signal?.aborted) cancel();
      else signal?.addEventListener('abort', cancel, { once: true });
      const timer = setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs);
      const base = iaBaseDe(connection);
      const endpoint =
      connection.prov === 'deepseek' ? `${base.replace(/\/v1$/, '')}/user/balance` : `${base}/key`;
      try {
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: iaCabecalhos(connection, 'openai'),
            signal: controller.signal,
            cache: 'no-store',
            redirect: 'error',
        });
        if (!response.ok) {
          if ([401, 403].includes(response.status)) {
            throw new Error(
              'A chave não tem acesso à consulta de saldo. Verifique as permissões no painel do provedor.',
            );
          }
          if (response.status === 429) {
            throw new Error(
              'O provedor limitou as consultas de saldo. Aguarde e tente atualizar novamente.',
            );
          }
          throw new Error(`Não foi possível consultar o saldo (HTTP ${response.status}).`);
        }
        return {
          status: 'ready',
          ...parse(connection, await response.json()),
          checkedAt: Date.now(),
        };
      } catch (error) {
        if (timedOut) {
          throw new Error(
            'A consulta demorou demais. Tente atualizar novamente ou abra o painel do provedor.',
          );
        }
        if (error.name === 'AbortError') throw error;
        if (/fetch|network|load failed/i.test(error.message)) {
          throw new Error(
            'Não foi possível consultar o saldo por rede ou CORS. Abra o painel do provedor para conferir os créditos.',
          );
        }
        throw error;
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', cancel);
      }
    }

    window.SynapseAIAccountUsage = Object.freeze({ support, load, parse });
})();
