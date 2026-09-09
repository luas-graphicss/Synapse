(function () {
    'use strict';

    function create(options) {
      return {
        id: options.id,
        name: options.name,
        kind: options.kind,
        files: options.files,
        detect: options.detect,
        entry: options.detect.entry,
        openFile: null,
        openTabs: [],
        dirty: new Set(),
        emptyDirs: new Set(),
        blobs: new Set(),
        popout: null,
        channel: null,
        logs: [],
        snapshots: [],
        snapSeq: 0,
        debuggerState: null,
        runtimeMode: options.detect.type,
      };
    }

    window.SynapseProjectRecord = Object.freeze({ create });
})();
