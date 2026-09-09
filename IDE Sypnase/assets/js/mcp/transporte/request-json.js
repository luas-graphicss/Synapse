(function installJsonRequest(root) {
    'use strict';
    root.SynapseMcpRequestJson = async function requestJson(url, options, timeoutMs) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        if (!response.ok) {
          const error = new Error(`HTTP ${response.status}`);
          error.status = response.status;
          throw error;
        }
        return await response.json();
      } finally {
        clearTimeout(timer);
      }
    };
})(window);
