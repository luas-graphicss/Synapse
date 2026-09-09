(function (root) {
    'use strict';

    function read(storageKey) {
      try {
        return root.localStorage.getItem(storageKey) || '';
      } catch (error) {
        return '';
      }
    }

    function watch(storageKey, listener) {
      function notify() {
        listener(read(storageKey));
      }
      root.addEventListener('storage', (event) => {
          if (event.key && event.key !== storageKey) return;
          notify();
      });
      root.addEventListener('focus', notify);
      document.addEventListener('visibilitychange', () => {
          if (document.hidden) return;
          notify();
      });
    }

    root.SynapseDocsIdePreference = Object.freeze({ read, watch });
})(typeof globalThis !== 'undefined' ? globalThis : window);
