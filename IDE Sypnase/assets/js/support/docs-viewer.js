(function (root) {
    'use strict';

    function pageAddress(pagePath) {
      return root.SynapseSupportSiteBase.resolve(pagePath) || pagePath;
    }

    function openExternal(externalUrl) {
      root.open(externalUrl, '_blank');
    }

    function attachLinks(address) {
      const frame = root.SynapseDocsViewerOverlay.frameElement();
      frame.addEventListener('load', function whenLoaded() {
          frame.removeEventListener('load', whenLoaded);
          root.SynapseDocsViewerLinks.attach(frame.contentDocument, address, {
              openPage: openPage,
              closeViewer: root.SynapseDocsViewerOverlay.hide,
              openExternal: openExternal,
          });
      });
    }

    function openPage(pagePath) {
      const address = pageAddress(pagePath);
      return root.SynapseDocsViewerFetcher.fetchText(address)
      .then(function (pageHtml) {
          return root.SynapseDocsViewerInliner.inline(pageHtml, address);
      })
      .then(function (documentHtml) {
          attachLinks(address);
          root.SynapseDocsViewerOverlay.show(documentHtml);
          return true;
      })
      .catch(function (error) {
          console.error(error);
          return false;
      });
    }

    root.SynapseDocsViewer = Object.freeze({ openPage, close: root.SynapseDocsViewerOverlay.hide });
})(typeof globalThis !== 'undefined' ? globalThis : window);
