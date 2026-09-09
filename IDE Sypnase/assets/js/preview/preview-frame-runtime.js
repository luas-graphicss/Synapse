(function (root) {
    'use strict';

    let presentation = null;
    let visibleResources = null;
    let pendingRequest = null;

    function releaseVisibleResources() {
      visibleResources?.();
      visibleResources = null;
    }

    function getPresentation() {
      if (!presentation) {
        presentation = root.SynapsePreviewFrames.create({
            getFrame: () => root.el.frame,
            setFrame: (frame) => {
              root.el.frame = frame;
            },
            onExternalNavigation: releaseVisibleResources,
            prepareFrame: (frame) => {
              frame.setAttribute(
                'sandbox',
                'allow-scripts allow-same-origin allow-forms allow-popups allow-pointer-lock allow-modals',
              );
              frame.setAttribute('allow', root.SynapsePreviewPermissions.allowValue());
            },
        });
      }
      return presentation;
    }

    function load(
      html,
      { project = activeProject(), token = project?.buildToken, force = false } = {},
    ) {
      const isCurrent = () =>
      project &&
      root.State.active === project.id &&
      root.State.layout !== 'editor' &&
      project.buildToken === token;
      if (!isCurrent()) return Promise.resolve({ status: 'canceled', reason: 'stale' });
      const releaseResources = root.SynapsePreviewResources.retain(project);
      const request = { project, token };
      pendingRequest = request;
      const result = getPresentation().load(html, { key: project.id, isCurrent, force });
      return result.then((outcome) => {
          if (pendingRequest === request) pendingRequest = null;
          if (outcome.status === 'committed') {
            releaseVisibleResources();
            visibleResources = releaseResources;
          } else {
            releaseResources();
          }
          if (outcome.status === 'failed' && isCurrent()) {
            logErr(
              project,
              'Preview update failed: ' + outcome.reason + '. The previous preview was kept.',
            );
            setStatus('err', 'Preview update failed');
          }
          return outcome;
      });
    }

    function cancel(project) {
      if (project && pendingRequest?.project !== project) return;
      presentation?.cancel();
      pendingRequest = null;
    }

    function reset() {
      presentation?.reset();
      pendingRequest = null;
      releaseVisibleResources();
    }

    function projectForSource(source) {
      const project = pendingRequest?.project;
      if (
        !project ||
        project.id !== root.State.active ||
        project.buildToken !== pendingRequest.token ||
        root.State.layout === 'editor'
      )
      return null;
      return presentation?.isPendingSource(source) ? project : null;
    }

    root.SynapsePreviewRuntime = Object.freeze({ load, cancel, reset, projectForSource });
})(globalThis);
