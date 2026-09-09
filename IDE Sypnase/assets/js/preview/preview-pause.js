(function (root) {
    'use strict';

    let pausedProjectId = null;

    function isPaused() {
      return pausedProjectId !== null;
    }

    function pause(project) {
      if (!project || isPaused()) return false;
      pausedProjectId = project.id;
      project.lastHtml = null;
      project.previewDirty = true;
      root.SynapsePreviewMountReset.clearMountedPreview(project);
      return true;
    }

    function resume(project) {
      if (!isPaused()) return false;
      pausedProjectId = null;
      if (project && typeof root.buildPreview === 'function') root.buildPreview(project);
      return true;
    }

    root.SynapsePreviewPause = Object.freeze({ pause, resume, isPaused });
})(globalThis);
