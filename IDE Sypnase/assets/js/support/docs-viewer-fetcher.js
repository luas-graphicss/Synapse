(function (root) {
    'use strict';

    function fetchText(fileUrl) {
      return fetch(fileUrl).then(function (response) {
          if (!response.ok) throw new Error('Could not load ' + fileUrl);
          return response.text();
      });
    }

    root.SynapseDocsViewerFetcher = Object.freeze({ fetchText });
})(typeof globalThis !== 'undefined' ? globalThis : window);
