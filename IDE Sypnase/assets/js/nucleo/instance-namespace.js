(function (root) {
    'use strict';

    const EMBEDDED_NAMESPACE_SUFFIX = 'embedded';

    function isEmbeddedInAnotherPage() {
      try {
        return root.top !== root.self;
      } catch (error) {
        return true;
      }
    }

    function namespaceSuffix() {
      return isEmbeddedInAnotherPage() ? EMBEDDED_NAMESPACE_SUFFIX : '';
    }

    function scopedName(baseName) {
      const suffix = namespaceSuffix();
      return suffix ? baseName + '.' + suffix : baseName;
    }

    root.SynapseInstanceNamespace = {
      isEmbeddedInAnotherPage: isEmbeddedInAnotherPage,
      namespaceSuffix: namespaceSuffix,
      scopedName: scopedName,
    };
})(window);
