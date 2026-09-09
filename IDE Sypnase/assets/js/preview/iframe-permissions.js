(function (root) {
    'use strict';

    const requestedFeatures = ['fullscreen'];

    function allowValue(documentContext = document) {
      const policy = documentContext.featurePolicy || documentContext.permissionsPolicy;
      if (typeof policy?.features !== 'function') return requestedFeatures.join('; ');
      const supportedFeatures = new Set(policy.features());
      const allowedFeatures = requestedFeatures.filter((feature) => supportedFeatures.has(feature));
      return allowedFeatures.join('; ');
    }

    root.SynapsePreviewPermissions = Object.freeze({ allowValue });
})(globalThis);
