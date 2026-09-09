(function (root) {
    'use strict';

    const STATUS_REASONS = {
      400: 'A requisicao foi recusada por dados invalidos.',
      401: 'Credencial ausente ou invalida.',
      403: 'Acesso negado pelo servidor ou pela borda de rede.',
      404: 'O recurso pedido nao existe no endereco usado.',
      408: 'O servidor encerrou a espera antes de responder.',
      409: 'O recurso mudou desde a ultima leitura.',
      413: 'O conteudo enviado passou do tamanho aceito.',
      415: 'O formato enviado nao e aceito nesta rota.',
      429: 'Limite de chamadas atingido.',
      500: 'O servidor falhou ao processar a requisicao.',
      502: 'O intermediario nao recebeu resposta valida.',
      503: 'O servico esta indisponivel neste momento.',
      504: 'A origem demorou demais para responder.',
    };

    const STATUS_HINTS = {
      401: 'Revise a chave configurada em Conexoes.',
      403: 'Confirme a origem permitida e as regras do proxy.',
      404: 'Confira o caminho do arquivo ou da rota chamada.',
      413: 'Divida o envio em partes menores.',
      429: 'Repita a mesma chamada em alguns segundos.',
      503: 'Verifique se o Relay esta em execucao.',
      504: 'Tente de novo ou reduza o tamanho do trabalho.',
    };

    const OFFLINE_REASON = 'O navegador esta sem rede.';
    const NETWORK_REASON = 'A conexao falhou antes de o servidor responder.';
    const NETWORK_HINT = 'Confirme o endereco, o Relay ativo e a liberacao de origem.';

    function isOffline() {
      return typeof navigator === 'object' && navigator.onLine === false;
    }

    function textOf(value) {
      if (value === null || value === undefined) return '';
      if (typeof value === 'string') return value.trim();
      if (value instanceof Error) return String(value.message || value.name).trim();
      try {
        return JSON.stringify(value);
      } catch (error) {
        return String(value);
      }
    }

    function fromStatus(status, statusText, detail) {
      return {
        code: `HTTP ${status}`,
        reason: STATUS_REASONS[status] || `O servidor respondeu ${status} ${textOf(statusText)}`.trim(),
        hint: STATUS_HINTS[status] || '',
        detail: textOf(detail),
      };
    }

    function fromAbort() {
      return {
        code: 'CANCELADO',
        reason: 'A operacao foi cancelada antes de terminar.',
        hint: 'Repita a acao quando quiser o resultado.',
        detail: '',
      };
    }

    function fromTimeout(error) {
      return {
        code: 'TEMPO ESGOTADO',
        reason: 'A resposta nao chegou dentro do tempo limite.',
        hint: 'Verifique a conexao e tente novamente.',
        detail: textOf(error),
      };
    }

    function fromNetwork(error) {
      return {
        code: isOffline() ? 'SEM REDE' : 'FALHA DE REDE',
        reason: isOffline() ? OFFLINE_REASON : NETWORK_REASON,
        hint: NETWORK_HINT,
        detail: textOf(error),
      };
    }

    function fromSyntax(error) {
      return {
        code: 'SINTAXE',
        reason: 'O conteudo nao pode ser interpretado.',
        hint: 'Abra o arquivo indicado e corrija a posicao apontada.',
        detail: textOf(error),
      };
    }

    function fromQuota(error) {
      return {
        code: 'ARMAZENAMENTO CHEIO',
        reason: 'O navegador negou a gravacao por falta de espaco.',
        hint: 'Exporte o projeto e limpe dados antigos do site.',
        detail: textOf(error),
      };
    }

    function fromUnknown(error) {
      const message = textOf(error);
      return {
        code: (error && error.name) || 'FALHA',
        reason: message || 'A operacao falhou sem uma mensagem clara.',
        hint: 'Abra o console para ver o registro completo.',
        detail: message,
      };
    }

    function classify(error) {
      if (!error) return fromUnknown(error);
      const status = Number(error.status || error.statusCode || 0);
      if (status >= 400) return fromStatus(status, error.statusText, error.body || error.message);
      if (error.name === 'AbortError') return fromAbort();
      if (error.name === 'TimeoutError' || /timeout|tempo esgotado/i.test(textOf(error)))
      return fromTimeout(error);
      if (error.name === 'QuotaExceededError') return fromQuota(error);
      if (error instanceof SyntaxError) return fromSyntax(error);
      if (error instanceof TypeError && /fetch|network|load failed/i.test(textOf(error)))
      return fromNetwork(error);
      return fromUnknown(error);
    }

    function describe(error, context) {
      const classified = classify(error);
      return Object.freeze({
          title: textOf(context && context.title) || 'A acao nao foi concluida',
          step: textOf(context && context.step),
          target: textOf(context && context.target),
          code: classified.code,
          reason: classified.reason,
          hint: textOf(context && context.hint) || classified.hint,
          detail: classified.detail,
      });
    }

    function toPlainText(report) {
      return [
        `${report.title} (${report.code})`,
        report.step ? `Etapa: ${report.step}` : '',
        report.target ? `Alvo: ${report.target}` : '',
        `Motivo: ${report.reason}`,
        report.hint ? `Sugestao: ${report.hint}` : '',
        report.detail ? `Detalhe: ${report.detail}` : '',
      ]
      .filter(Boolean)
      .join('\n');
    }

    root.SynapseFailureReport = Object.freeze({ describe, toPlainText });
})(typeof globalThis !== 'undefined' ? globalThis : window);
