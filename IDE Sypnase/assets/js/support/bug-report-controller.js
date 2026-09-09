(function (root) {
    'use strict';

    const CLOSE_DELAY_MS = 1600;

    let activeSession = null;

    async function submitReport(session, form, fields, environmentEntries) {
      const labels = root.SynapseSupportLabels;
      const missing = form.missingRequiredNames();
      form.markMissing(missing);
      if (missing.length) {
        session.setStatus(labels.missingFieldsText, 'error');
        form.focusControl(missing[0]);
        return;
      }
      const message = root.SynapseBugReportMessage.build(
        fields,
        form.values(),
        environmentEntries,
      );
      session.setBusy(true);
      session.setStatus(labels.sendingText, 'working');
      const result = await root.SynapseBugReportTransport.send(message);
      session.setBusy(false);
      if (result.delivered) {
        session.setStatus(labels.deliveredText, 'ok');
        root.setTimeout(() => session.close(), CLOSE_DELAY_MS);
        return;
      }
      session.setStatus(labels.fallbackText, 'error');
      root.SynapseBugReportMailto.open(message);
    }

    function open() {
      if (activeSession) return;
      const labels = root.SynapseSupportLabels;
      const fields = root.SynapseBugReportFields.list();
      const form = root.SynapseBugReportForm.create(fields, labels);
      const environmentEntries = root.SynapseBugReportEnvironment.collect();
      activeSession = root.SynapseBugReportDialog.open({
          labels,
          formElement: form.element,
          environmentEntries,
          onSubmit: (session) => {
            submitReport(session, form, fields, environmentEntries);
          },
          onClose: () => {
            activeSession = null;
          },
      });
      form.focusFirstControl();
    }

    root.SynapseBugReportController = Object.freeze({ open });
})(typeof globalThis !== 'undefined' ? globalThis : window);
