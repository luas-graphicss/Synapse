(function (root) {
    'use strict';

    const projects = new WeakMap();

    function getState(project) {
      let state = projects.get(project);
      if (!state) {
        state = { references: new Map(), retired: new Set() };
        projects.set(project, state);
      }
      return state;
    }

    function revoke(project, url) {
      root.URL.revokeObjectURL(url);
      project.blobs.delete(url);
    }

    function retire(project, url) {
      if (!url) return;
      const state = projects.get(project);
      if (state?.references.has(url)) state.retired.add(url);
      else revoke(project, url);
    }

    function retain(project) {
      const state = getState(project);
      const urls = [...(project.blobs || [])].filter((url) => !state.retired.has(url));
      for (const url of urls) {
        state.references.set(url, (state.references.get(url) || 0) + 1);
      }
      let released = false;
      return function release() {
        if (released || projects.get(project) !== state) return;
        released = true;
        for (const url of urls) {
          const remaining = (state.references.get(url) || 0) - 1;
          if (remaining > 0) {
            state.references.set(url, remaining);
            continue;
          }
          state.references.delete(url);
          if (state.retired.delete(url)) revoke(project, url);
        }
      };
    }

    function reset(project) {
      projects.delete(project);
    }

    root.SynapsePreviewResources = Object.freeze({ retain, retire, reset });
})(globalThis);
