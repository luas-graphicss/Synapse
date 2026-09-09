(function () {
    'use strict';

    function reportBuildFailure(project, error) {
      hidePreviewLoading();
      setStatus('err', 'Falha ao montar o preview');
      const detail = (error && error.message) || String(error);
      try {
        logErr(project, 'Falha ao montar o preview: ' + detail);
      } catch (loggingError) {
        ignorarErro(loggingError, 'previewStart');
      }
      registro.aviso('[Synapse] preview do projeto falhou:', error);
    }

    function startPreviewBuild(project) {
      let building = null;
      try {
        building = buildPreview(project);
      } catch (error) {
        reportBuildFailure(project, error);
        return;
      }
      if (building && typeof building.catch === 'function') {
        building.catch((error) => reportBuildFailure(project, error));
      }
    }

    window.SynapsePreviewStart = Object.freeze({ startPreviewBuild });
})();
