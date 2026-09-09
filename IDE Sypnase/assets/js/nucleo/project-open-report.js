(function () {
    'use strict';

    function describeFailure(failure) {
      const error = failure.error;
      const detail = (error && error.message) || String(error);
      return 'Etapa "' + failure.name + '" falhou ao abrir o projeto: ' + detail;
    }

    function reportFailures(project, failures) {
      if (!failures.length) return;
      hidePreviewLoading();
      for (const failure of failures) {
        registro.aviso('[Synapse] abertura de projeto:', failure.name, failure.error);
      }
      try {
        setStatus('err', 'Projeto aberto com falhas');
        for (const failure of failures) logErr(project, describeFailure(failure));
        toast('Projeto aberto com falhas', describeFailure(failures[0]), 'err');
      } catch (error) {
        ignorarErro(error, 'projectOpenReport');
      }
    }

    window.SynapseProjectOpenReport = Object.freeze({ reportFailures });
})();
