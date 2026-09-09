(function () {
    'use strict';

    const maximumFiles = 24;
    const maximumFileLength = 120000;
    const maximumWords = 1500;
    const cache = new WeakMap();

    function listFilesWithSameLanguage(project, path, profile) {
      const profiles = window.SynapseLanguageProfiles;
      const sources = [];
      for (const [filePath, file] of project.files) {
        if (sources.length === maximumFiles) break;
        if (filePath === path || !file || typeof file.text !== 'string') continue;
        if (file.text.length > maximumFileLength) continue;
        if (profiles.fromPath(filePath).id !== profile.id) continue;
        sources.push({ path: filePath, text: file.text });
      }
      return sources;
    }

    function signatureOf(sources) {
      return sources.map((source) => `${source.path}:${source.text.length}`).join('|');
    }

    function collect({ project = null, path = '', profile = null } = {}) {
      const scanner = window.SynapseSourceWordScanner;
      if (!project || !project.files || !profile || !scanner) return [];
      if (profile.id === 'text') return [];
      const sources = listFilesWithSameLanguage(project, path, profile);
      const signature = signatureOf(sources);
      const cached = cache.get(project);
      if (cached && cached.signature === signature) return cached.words;
      const words = new Map();
      for (const source of sources) {
        const scanned = scanner.scan({ source: source.text, profile, position: -1 });
        if (!scanned) continue;
        for (const word of scanned.words) {
          const existing = words.get(word.text);
          if (existing) {
            existing.count += word.count;
            continue;
          }
          if (words.size === maximumWords) break;
          words.set(word.text, { text: word.text, count: word.count });
        }
      }
      const collected = [...words.values()];
      cache.set(project, { signature, words: collected });
      return collected;
    }

    window.SynapseProjectWordCollector = Object.freeze({ collect });
})();
