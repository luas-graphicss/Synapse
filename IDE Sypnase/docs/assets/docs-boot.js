(function (root) {
    'use strict';

    function start() {
      root.SynapseDocsSidebar.render();
      root.SynapseDocsFilter.attach();
      root.SynapseDocsOutline.render();
      root.SynapseDocsPager.render();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})(typeof globalThis !== 'undefined' ? globalThis : window);
