(function (root) {
    'use strict';

    const DOCS_FOLDER_PATH = 'docs/';
    const SITE_HOME_PATH = 'index.html';
    const PAGE_EXTENSION = '.html';

    function siteAddress(relativePath) {
      return root.SynapseSupportSiteBase.resolve(relativePath);
    }

    function withoutFragment(address) {
      return address.split('#')[0];
    }

    function clickedAnchor(event) {
      const node = event.target;
      if (!node || typeof node.closest !== 'function') return null;
      return node.closest('a[href]');
    }

    function anchorTarget(anchor, pageAddress) {
      try {
        return new URL(anchor.getAttribute('href'), pageAddress);
      } catch (error) {
        return null;
      }
    }

    function isSamePage(target, pageAddress) {
      return withoutFragment(target.href) === withoutFragment(pageAddress);
    }

    function isDocsPage(target) {
      const folder = siteAddress(DOCS_FOLDER_PATH);
      return Boolean(folder) && target.href.startsWith(folder) && target.pathname.endsWith(PAGE_EXTENSION);
    }

    function isSiteHome(target) {
      const home = siteAddress(SITE_HOME_PATH);
      return Boolean(home) && withoutFragment(target.href) === home;
    }

    function scrollToFragment(frameDocument, fragment) {
      if (!fragment) return;
      const section = frameDocument.getElementById(fragment.slice(1));
      if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function attach(frameDocument, pageAddress, handlers) {
      frameDocument.addEventListener('click', function (event) {
          const anchor = clickedAnchor(event);
          if (!anchor) return;
          const target = anchorTarget(anchor, pageAddress);
          if (!target) return;
          event.preventDefault();
          if (isSamePage(target, pageAddress)) {
            scrollToFragment(frameDocument, target.hash);
            return;
          }
          if (isDocsPage(target)) {
            handlers.openPage(target.href);
            return;
          }
          if (isSiteHome(target)) {
            handlers.closeViewer();
            return;
          }
          handlers.openExternal(target.href);
      });
    }

    root.SynapseDocsViewerLinks = Object.freeze({ attach });
})(typeof globalThis !== 'undefined' ? globalThis : window);
