'use strict';

const BLENDER_INTERACTION_MODES = Object.freeze([
    Object.freeze({ id: 'object', label: 'Object Mode', available: true }),
    Object.freeze({ id: 'edit', label: 'Edit Mode', available: true }),
    Object.freeze({ id: 'sculpt', label: 'Sculpt Mode', available: false }),
    Object.freeze({ id: 'vertexPaint', label: 'Vertex Paint', available: false }),
    Object.freeze({ id: 'weightPaint', label: 'Weight Paint', available: false }),
    Object.freeze({ id: 'texturePaint', label: 'Texture Paint', available: false }),
]);

const blenderInteractionModeState = {
  current: 'object',
  listeners: [],
};

function blenderInteractionModeById(modeId) {
  for (let index = 0; index < BLENDER_INTERACTION_MODES.length; index++) {
    if (BLENDER_INTERACTION_MODES[index].id === modeId) return BLENDER_INTERACTION_MODES[index];
  }
  return null;
}

function blenderInteractionModeIsAvailable(modeId) {
  const mode = blenderInteractionModeById(modeId);
  return Boolean(mode && mode.available);
}

function blenderInteractionModeLabel(modeId) {
  const mode = blenderInteractionModeById(modeId);
  return mode ? mode.label : '';
}

function blenderCurrentInteractionMode() {
  return blenderInteractionModeState.current;
}

function blenderOnInteractionModeChange(listener) {
  if (typeof listener !== 'function') return;
  blenderInteractionModeState.listeners.push(listener);
}

function blenderSetInteractionMode(modeId) {
  if (!blenderInteractionModeIsAvailable(modeId)) return false;
  if (blenderInteractionModeState.current === modeId) return false;
  blenderInteractionModeState.current = modeId;
  blenderInteractionModeState.listeners.forEach((listener) => {
      try {
        listener(modeId);
      } catch (error) {
        ignorarErro(error, 'blenderSetInteractionMode');
      }
  });
  return true;
}
