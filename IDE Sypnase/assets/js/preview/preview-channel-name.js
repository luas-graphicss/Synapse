(function (root) {
    'use strict';

    const PROJECT_CHANNEL_PREFIX = 'aurora-lp-';

    function forProject(projectId) {
      const baseName = PROJECT_CHANNEL_PREFIX + projectId;
      const namespace = root.SynapseInstanceNamespace;
      return namespace ? namespace.scopedName(baseName) : baseName;
    }

    root.SynapsePreviewChannelName = {
      forProject: forProject,
    };
})(window);
