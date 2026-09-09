(function (root) {
    'use strict';

    function filePaths(project) {
      const files = project?.files;
      if (!files) return [];
      return typeof files.keys === 'function' ? Array.from(files.keys()) : Object.keys(files);
    }

    function sample(project, limit = 60) {
      const count = Number.isFinite(Number(limit)) ? Math.max(0, Math.floor(Number(limit))) : 60;
      return filePaths(project).sort().slice(0, count);
    }

    function describe(project) {
      return {
        projeto: project?.name || '',
        projetoId: project?.id || '',
        arquivos: filePaths(project).length,
        aberto: project?.openFile || '',
      };
    }

    root.SynapseAIProjectContext = Object.freeze({ describe, sample });
})(globalThis);
