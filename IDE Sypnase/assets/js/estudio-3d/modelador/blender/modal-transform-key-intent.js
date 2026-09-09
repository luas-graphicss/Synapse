'use strict';

function blenderModalTransformKeyIntent(event) {
  const key = String(event.key || '');
  const lower = key.toLowerCase();
  if (key === 'Escape') return { kind: 'cancel' };
  if (key === 'Enter' || key === ' ') return { kind: 'confirm' };
  if (lower === 'x' || lower === 'y' || lower === 'z') {
    return { kind: 'axis', letter: lower, plane: event.shiftKey === true };
  }
  if (blenderNumericInputAcceptsKey(key)) return { kind: 'numeric', key };
  return { kind: 'none' };
}
