'use strict';

function blenderKeymapEntryMatches(entry, event, mode) {
  if (entry.mode !== 'any' && entry.mode !== mode) return false;
  if (entry.code) {
    if (event.code !== entry.code) return false;
  } else if (String(event.key || '').toLowerCase() !== entry.key) {
    return false;
  }
  if (Boolean(entry.ctrl) !== (event.ctrlKey === true || event.metaKey === true)) return false;
  if (Boolean(entry.shift) !== (event.shiftKey === true)) return false;
  if (Boolean(entry.alt) !== (event.altKey === true)) return false;
  return true;
}

function blenderFindKeymapOperator(entries, event, mode, wantCode, wantMode) {
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    if (wantCode !== Boolean(entry.code)) continue;
    if (!wantCode && entry.mode !== wantMode) continue;
    if (blenderKeymapEntryMatches(entry, event, mode)) return entry.operator;
  }
  return '';
}

function blenderResolveKeymapOperator(entries, event, mode) {
  const byCode = blenderFindKeymapOperator(entries, event, mode, true, '');
  if (byCode) return byCode;
  const byMode = blenderFindKeymapOperator(entries, event, mode, false, mode);
  if (byMode) return byMode;
  return blenderFindKeymapOperator(entries, event, mode, false, 'any');
}

function blenderKeymapEntriesForMode(entries, mode) {
  return entries.filter((entry) => entry.mode === 'any' || entry.mode === mode);
}
