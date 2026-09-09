(function (root) {
    'use strict';

    const projects = new WeakMap();

    function getUsage(project) {
      let usage = projects.get(project);
      if (!usage) {
        usage = { buildingUrls: new Set(), publishedUrls: new Set() };
        projects.set(project, usage);
      }
      return usage;
    }

    function startBuild(project) {
      if (!project) return;
      getUsage(project).buildingUrls.clear();
    }

    function trackBuildUrl(project, url) {
      if (!project || !url) return;
      getUsage(project).buildingUrls.add(url);
    }

    function publishBuild(project) {
      if (!project) return;
      const usage = getUsage(project);
      usage.publishedUrls = new Set(usage.buildingUrls);
      usage.buildingUrls = new Set();
    }

    function usedUrls(project) {
      const usage = projects.get(project);
      if (!usage) return [];
      return [...usage.buildingUrls, ...usage.publishedUrls];
    }

    function clear(project) {
      projects.delete(project);
    }

    root.SynapsePreviewBlobUsage = Object.freeze({
        startBuild,
        trackBuildUrl,
        publishBuild,
        usedUrls,
        clear,
    });
})(globalThis);
