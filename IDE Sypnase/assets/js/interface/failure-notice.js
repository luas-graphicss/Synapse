(function (root) {
    'use strict';

    const reporter = root.SynapseFailureReport;
    if (!reporter) return;

    const MAXIMUM_VISIBLE = 3;
    const DETAIL_LIMIT = 900;

    let stack = null;

    function container() {
      if (stack && stack.isConnected) return stack;
      stack = document.createElement('div');
      stack.className = 'failure-notices';
      stack.id = 'failureNotices';
      stack.setAttribute('role', 'region');
      stack.setAttribute('aria-label', 'Falhas recentes');
      document.body.append(stack);
      return stack;
    }

    function line(className, text) {
      if (!text) return null;
      const node = document.createElement('div');
      node.className = className;
      node.textContent = text;
      return node;
    }

    function scopeText(report) {
      return [report.step, report.target].filter(Boolean).join(' · ');
    }

    function detailBlock(report) {
      if (!report.detail || report.detail === report.reason) return null;
      const wrapper = document.createElement('details');
      wrapper.className = 'failure-notice-detail';
      const summary = document.createElement('summary');
      summary.textContent = 'Detalhe tecnico';
      const body = document.createElement('pre');
      body.textContent = report.detail.slice(0, DETAIL_LIMIT);
      wrapper.append(summary, body);
      return wrapper;
    }

    function actions(report, card) {
      const row = document.createElement('div');
      row.className = 'failure-notice-actions';
      const copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'failure-notice-action';
      copy.textContent = 'Copiar relatorio';
      copy.setAttribute('data-hint', 'Copia titulo, motivo e detalhe tecnico desta falha.');
      copy.addEventListener('click', () => {
          navigator.clipboard
          ?.writeText(reporter.toPlainText(report))
          .then(() => {
              copy.textContent = 'Copiado';
          })
          .catch((error) => root.ignorarErro?.(error, 'failureNotice.copy'));
      });
      const dismiss = document.createElement('button');
      dismiss.type = 'button';
      dismiss.className = 'failure-notice-action';
      dismiss.textContent = 'Fechar';
      dismiss.setAttribute('data-hint', 'Remove este aviso de falha.');
      dismiss.addEventListener('click', () => card.remove());
      row.append(copy, dismiss);
      return row;
    }

    function build(report) {
      const card = document.createElement('article');
      card.className = 'failure-notice';
      card.setAttribute('role', 'alert');
      const head = document.createElement('div');
      head.className = 'failure-notice-head';
      const title = document.createElement('div');
      title.className = 'failure-notice-title';
      title.textContent = report.title;
      const code = document.createElement('span');
      code.className = 'failure-notice-code';
      code.textContent = report.code;
      head.append(title, code);
      const body = document.createElement('div');
      body.className = 'failure-notice-body';
      body.append(
        ...[
          line('failure-notice-scope', scopeText(report)),
          line('failure-notice-reason', report.reason),
          line('failure-notice-hint', report.hint),
          detailBlock(report),
          actions(report, card),
        ].filter(Boolean),
      );
      card.append(head, body);
      return card;
    }

    function present(error, context) {
      try {
        const report = reporter.describe(error, context);
        const host = container();
        host.append(build(report));
        while (host.children.length > MAXIMUM_VISIBLE) host.firstElementChild.remove();
        root.registro?.erro?.(reporter.toPlainText(report));
        return report;
      } catch (failure) {
        root.ignorarErro?.(failure, 'failureNotice.present');
        return null;
      }
    }

    function clear() {
      if (stack && stack.isConnected) stack.replaceChildren();
    }

    root.SynapseFailureNotice = Object.freeze({ present, clear });
})(typeof globalThis !== 'undefined' ? globalThis : window);
