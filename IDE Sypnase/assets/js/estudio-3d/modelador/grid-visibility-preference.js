'use strict';

const GRID_VISIBILITY_STORAGE_KEY = 'synapse:modelador3d:gridVisible';

function readGridVisibilityPreference() {
  if (typeof mod3dLerLocal !== 'function') return true;
  return mod3dLerLocal(GRID_VISIBILITY_STORAGE_KEY) !== '0';
}

function writeGridVisibilityPreference(visible) {
  if (typeof mod3dGravarLocal !== 'function') return;
  mod3dGravarLocal(GRID_VISIBILITY_STORAGE_KEY, visible ? '1' : '0');
}
