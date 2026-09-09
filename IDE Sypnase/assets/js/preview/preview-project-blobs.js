(function (root) {
    'use strict';

    function clearCache(project, cacheName) {
      const cache = project[cacheName];
      if (cache && typeof cache.clear === 'function') cache.clear();
    }

    function revokeEveryUrl(project) {
      for (const url of [...project.blobs]) {
        try {
          root.URL.revokeObjectURL(url);
        } catch (error) {
          ignorarErro(error, 'previewProjectBlobs');
        }
      }
      project.blobs.clear();
    }

    function releaseAll(project) {
      if (!project || !project.blobs) return;
      root.SynapsePreviewResources.reset(project);
      root.SynapsePreviewBlobUsage.clear(project);
      revokeEveryUrl(project);
      clearCache(project, 'blobCache');
      clearCache(project, 'cssBlobCache');
      project.lastHtml = null;
      project.previewDirty = true;
    }

    root.SynapsePreviewProjectBlobs = Object.freeze({ releaseAll });
})(globalThis);
