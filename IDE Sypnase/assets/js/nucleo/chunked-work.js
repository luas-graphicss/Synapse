(function () {
    'use strict';

    const DEFAULT_CHUNK_SIZE = 100;

    function releaseToInterface() {
      return new Promise((resolve) => {
          if (document.hidden) {
            setTimeout(resolve, 0);
            return;
          }
          requestAnimationFrame(() => setTimeout(resolve, 0));
      });
    }

    async function forEachInChunks(items, handleItem, options) {
      const settings = options || {};
      const chunkSize = settings.chunkSize > 0 ? settings.chunkSize : DEFAULT_CHUNK_SIZE;
      const reportProgress = settings.onProgress || null;
      const total = items.length;
      let processed = 0;
      for (const item of items) {
        handleItem(item, processed);
        processed++;
        if (processed % chunkSize === 0 && processed < total) {
          if (reportProgress) reportProgress(processed, total);
          await releaseToInterface();
        }
      }
      if (reportProgress) reportProgress(processed, total);
    }

    window.SynapseChunkedWork = Object.freeze({ forEachInChunks });
})();
