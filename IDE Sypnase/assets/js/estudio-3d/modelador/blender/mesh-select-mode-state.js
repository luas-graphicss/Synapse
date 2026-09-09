'use strict';

const BLENDER_MESH_SELECT_MODES = Object.freeze([
    Object.freeze({ id: 'vertex', label: 'Vertex', key: '1' }),
    Object.freeze({ id: 'edge', label: 'Edge', key: '2' }),
    Object.freeze({ id: 'face', label: 'Face', key: '3' }),
]);

const blenderMeshSelectModeState = {
  current: 'vertex',
  listeners: [],
};

function blenderMeshSelectModeById(modeId) {
  for (let index = 0; index < BLENDER_MESH_SELECT_MODES.length; index++) {
    if (BLENDER_MESH_SELECT_MODES[index].id === modeId) return BLENDER_MESH_SELECT_MODES[index];
  }
  return null;
}

function blenderMeshSelectModeForKey(key) {
  for (let index = 0; index < BLENDER_MESH_SELECT_MODES.length; index++) {
    if (BLENDER_MESH_SELECT_MODES[index].key === key) return BLENDER_MESH_SELECT_MODES[index].id;
  }
  return '';
}

function blenderCurrentMeshSelectMode() {
  return blenderMeshSelectModeState.current;
}

function blenderMeshSelectModeLabel(modeId) {
  const mode = blenderMeshSelectModeById(modeId);
  return mode ? mode.label : '';
}

function blenderOnMeshSelectModeChange(listener) {
  if (typeof listener !== 'function') return;
  blenderMeshSelectModeState.listeners.push(listener);
}

function blenderSetMeshSelectMode(modeId) {
  if (!blenderMeshSelectModeById(modeId)) return false;
  if (blenderMeshSelectModeState.current === modeId) return false;
  blenderMeshSelectModeState.current = modeId;
  blenderMeshSelectModeState.listeners.forEach((listener) => {
      try {
        listener(modeId);
      } catch (error) {
        ignorarErro(error, 'blenderSetMeshSelectMode');
      }
  });
  return true;
}
