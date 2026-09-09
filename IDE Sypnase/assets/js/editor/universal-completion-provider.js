(function () {
    'use strict';

    const autocomplete = window.SynapseAutocomplete;
    const profiles = window.SynapseLanguageProfiles;
    const vocabulary = window.SynapseLanguageVocabulary;
    const scanner = window.SynapseSourceWordScanner;
    const projectWords = window.SynapseProjectWordCollector;
    const ranking = window.SynapseCompletionRanking;
    if (!autocomplete || !profiles || !vocabulary || !scanner || !projectWords || !ranking) return;

    const maximumItems = 40;
    const maximumLabelLength = 160;
    const minimumAutomaticPrefixLength = 2;
    const memberPriority = 0;
    const documentPriority = 1;
    const vocabularyPriority = 2;
    const projectPriority = 3;

    function createCandidateList(currentWord) {
      const candidates = new Map();
      return {
        add(label, kind, priority, statistics) {
          if (typeof label !== 'string' || !label || label === currentWord) return;
          if (label.length > maximumLabelLength) return;
          const existing = candidates.get(label);
          if (existing && priority >= existing.priority) return;
          candidates.set(label, {
              label,
              insertText: label,
              kind,
              priority,
              distance: statistics ? statistics.distance : undefined,
              count: statistics ? statistics.count : undefined,
          });
        },
        size() {
          return candidates.size;
        },
        values() {
          return [...candidates.values()];
        },
      };
    }

    function addMembers(candidates, languageId, receiver, scanned) {
      for (const member of vocabulary.membersFor(languageId, receiver))
      candidates.add(member, 'member', memberPriority);
      for (const word of scanned.words)
      if (word.receiver === receiver) candidates.add(word.text, 'member', memberPriority, word);
    }

    function addWords(candidates, profile, request, scanned) {
      for (const keyword of vocabulary.keywordsFor(profile.id))
      candidates.add(keyword, 'keyword', vocabularyPriority);
      for (const global of vocabulary.globalsFor(profile.id))
      candidates.add(global, 'global', vocabularyPriority);
      for (const word of scanned.words) candidates.add(word.text, 'local', documentPriority, word);
      const collected = projectWords.collect({
          project: request.project,
          path: request.path,
          profile,
      });
      for (const word of collected) candidates.add(word.text, 'project', projectPriority, word);
    }

    function supports(document) {
      const editorLanguages = window.SynapseEditorLanguages;
      if (!editorLanguages) return true;
      return editorLanguages.fromPath(document && document.path) === 'text';
    }

    function complete(request) {
      const source = request && request.source;
      if (typeof source !== 'string') return null;
      const profile = profiles.fromPath(request.path);
      const position = request.position;
      const caret = scanner.caretContext({ source, profile, position });
      if (!caret) return null;
      const scanned = scanner.scan({ source, profile, position });
      if (!scanned || scanned.caretInText) return null;
      const prefix = caret.prefix;
      if (!request.explicit && !caret.receiver && minimumAutomaticPrefixLength > prefix.length)
      return null;
      const candidates = createCandidateList(caret.word);
      if (caret.receiver) addMembers(candidates, profile.id, caret.receiver, scanned);
      if (!caret.receiver || !candidates.size()) addWords(candidates, profile, request, scanned);
      const items = ranking.sort(candidates.values(), prefix).slice(0, maximumItems);
      if (!items.length) return null;
      return {
        start: caret.start,
        end: caret.end,
        position,
        prefix,
        language: profile.id,
        items,
      };
    }

    autocomplete.registerProvider({ id: 'language-words', supports, complete });
})();
