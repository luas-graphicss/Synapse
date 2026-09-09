(function (root) {
    'use strict';

    const DOCS_HOME_PATH = 'docs/index.html';
    const SERVER_PROTOCOLS = ['http:', 'https:'];

    function address() {
      return root.SynapseSupportSiteBase.resolve(DOCS_HOME_PATH) || DOCS_HOME_PATH;
    }

    function isServedByHttpServer() {
      return SERVER_PROTOCOLS.indexOf(root.location.protocol) > -1;
    }

    function openInBrowserTab() {
      return Boolean(root.open(address(), '_blank'));
    }

    function open() {
      if (isServedByHttpServer()) return openInBrowserTab();
      root.SynapseDocsViewer.openPage(DOCS_HOME_PATH);
      return true;
    }

    root.SynapseSupportDocsNavigation = Object.freeze({ address, open });
})(typeof globalThis !== 'undefined' ? globalThis : window);
