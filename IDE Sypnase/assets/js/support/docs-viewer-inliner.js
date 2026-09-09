(function (root) {
    'use strict';

    const STYLESHEET_SELECTOR = 'link[rel="stylesheet"][href]';
    const SCRIPT_SELECTOR = 'script[src]';
    const DOCUMENT_PREFIX = '<!doctype html>';

    function fetchText(fileUrl) {
      return root.SynapseDocsViewerFetcher.fetchText(fileUrl);
    }

    function absoluteUrl(reference, pageUrl) {
      return new URL(reference, pageUrl).href;
    }

    function inlineStylesheets(pageDocument, pageUrl) {
      const links = Array.from(pageDocument.querySelectorAll(STYLESHEET_SELECTOR));
      return Promise.all(
        links.map(function (link) {
            return fetchText(absoluteUrl(link.getAttribute('href'), pageUrl)).then(function (styleText) {
                const style = pageDocument.createElement('style');
                style.textContent = styleText;
                link.replaceWith(style);
            });
        }),
      );
    }

    function inlineScripts(pageDocument, pageUrl) {
      const scripts = Array.from(pageDocument.querySelectorAll(SCRIPT_SELECTOR));
      return Promise.all(
        scripts.map(function (script) {
            return fetchText(absoluteUrl(script.getAttribute('src'), pageUrl)).then(function (codeText) {
                const inlineScript = pageDocument.createElement('script');
                inlineScript.textContent = codeText;
                script.replaceWith(inlineScript);
            });
        }),
      );
    }

    function inline(pageHtml, pageUrl) {
      const pageDocument = new DOMParser().parseFromString(pageHtml, 'text/html');
      return Promise.all([
          inlineStylesheets(pageDocument, pageUrl),
          inlineScripts(pageDocument, pageUrl),
      ]).then(function () {
          return DOCUMENT_PREFIX + pageDocument.documentElement.outerHTML;
      });
    }

    root.SynapseDocsViewerInliner = Object.freeze({ inline });
})(typeof globalThis !== 'undefined' ? globalThis : window);
