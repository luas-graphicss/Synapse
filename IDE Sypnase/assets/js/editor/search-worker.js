'use strict';

importScripts('search-core.js');

self.onmessage = function (event) {
  try {
    self.postMessage({ ok: true, result: self.SynapseSearchCore.execute(event.data) });
  } catch (error) {
    self.postMessage({ ok: false, error: error.message || String(error) });
  }
};
