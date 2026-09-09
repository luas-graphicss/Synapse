(function (root) {
    'use strict';

    function identifier() {
      return document.body.getAttribute('data-docs-category') || '';
    }

    function category() {
      return root.SynapseDocsCatalog.find(identifier());
    }

    root.SynapseDocsCurrentCategory = Object.freeze({ identifier, category });
})(typeof globalThis !== 'undefined' ? globalThis : window);
