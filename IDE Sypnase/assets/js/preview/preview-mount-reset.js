(function (root) {
    'use strict';

    const EMPTY_DOCUMENT = '<!DOCTYPE html><html><head></head><body></body></html>';

    function clearMountedPreview(project) {
      root.SynapsePreviewRuntime.cancel(project);
      return root.SynapsePreviewRuntime.load(EMPTY_DOCUMENT, { project, force: true });
    }

    root.SynapsePreviewMountReset = Object.freeze({ clearMountedPreview });
})(globalThis);
