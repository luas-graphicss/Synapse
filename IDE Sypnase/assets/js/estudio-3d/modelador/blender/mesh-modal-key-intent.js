'use strict';

function blenderMeshModalAcceptsNumberKey(key) {
  if (key.length === 1 && key >= '0' && key <= '9') return true;
  return key === '.' || key === ',' || key === '-' || key === 'Backspace';
}

function blenderMeshModalKeyIntent(event) {
  const key = String(event.key || '');
  if (key === 'Escape') return { kind: 'cancel' };
  if (key === 'Enter' || key === ' ') return { kind: 'confirm' };
  if (key === 'ArrowUp') return { kind: 'segments', delta: 1 };
  if (key === 'ArrowDown') return { kind: 'segments', delta: -1 };
  if (blenderMeshModalAcceptsNumberKey(key)) return { kind: 'number', key };
  return { kind: 'none' };
}
