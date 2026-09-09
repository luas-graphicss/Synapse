'use strict';

const SynapseZipGuard = (function () {
    const MAXIMUM_ENTRIES = 20000;
    const MAXIMUM_NAME_LENGTH = 400;
    const MAXIMUM_ENTRY_BYTES = 64 * 1024 * 1024;
    const MAXIMUM_ARCHIVE_BYTES = 512 * 1024 * 1024;
    const MAXIMUM_EXPANSION_RATIO = 2000;
    const WINDOWS_DRIVE_START = /^[a-z]:/i;

    function hasControlCharacters(text) {
      for (let index = 0; index < text.length; index++) {
        const code = text.charCodeAt(index);
        if (code <= 31 || code === 127) return true;
      }
      return false;
    }

    function normalizeSeparators(name) {
      return String(name == null ? '' : name).replace(/\\/g, '/');
    }

    function isSafeEntryName(name) {
      const path = normalizeSeparators(name);
      if (!path || path.length > MAXIMUM_NAME_LENGTH) return false;
      if (hasControlCharacters(path)) return false;
      if (path.startsWith('/') || WINDOWS_DRIVE_START.test(path)) return false;
      return !path.split('/').some((part) => part === '..');
    }

    function safeEntries(entries) {
      const list = Array.isArray(entries) ? entries : [];
      if (list.length > MAXIMUM_ENTRIES) {
        throw new Error(`ZIP: arquivo com ${list.length} entradas acima do limite de ${MAXIMUM_ENTRIES}.`);
      }
      const safe = [];
      for (const entry of list) {
        if (!entry || !isSafeEntryName(entry.name)) continue;
        safe.push(Object.assign({}, entry, { name: normalizeSeparators(entry.name) }));
      }
      return safe;
    }

    function checkDeclaredSize(entry) {
      const declaredBytes = Number(entry && entry.size) || 0;
      const compressedBytes = Number(entry && entry.compSize) || 0;
      const name = (entry && entry.name) || 'entrada';
      if (declaredBytes > MAXIMUM_ENTRY_BYTES) {
        throw new Error(`ZIP: "${name}" ultrapassa o limite de 64 MB por arquivo.`);
      }
      if (compressedBytes > 0 && declaredBytes / compressedBytes > MAXIMUM_EXPANSION_RATIO) {
        throw new Error(`ZIP: "${name}" tem taxa de expansao suspeita e foi recusado.`);
      }
    }

    function createExpansionBudget() {
      let usedBytes = 0;
      return {
        add(entryName, byteLength) {
          const amount = Number(byteLength) || 0;
          if (amount > MAXIMUM_ENTRY_BYTES) {
            throw new Error(`ZIP: "${entryName}" ultrapassa o limite de 64 MB por arquivo.`);
          }
          usedBytes += amount;
          if (usedBytes > MAXIMUM_ARCHIVE_BYTES) {
            throw new Error('ZIP: conteudo descompactado ultrapassa o limite de 512 MB.');
          }
          return usedBytes;
        },
      };
    }

    return {
      isSafeEntryName,
      safeEntries,
      checkDeclaredSize,
      createExpansionBudget,
      maximumEntries: MAXIMUM_ENTRIES,
      maximumEntryBytes: MAXIMUM_ENTRY_BYTES,
      maximumArchiveBytes: MAXIMUM_ARCHIVE_BYTES,
    };
})();

window.SynapseZipGuard = SynapseZipGuard;
