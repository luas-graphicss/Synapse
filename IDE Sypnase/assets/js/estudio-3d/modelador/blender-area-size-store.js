'use strict';

const BLENDER_AREA_SIZE_STORAGE_PREFIX = 'synapse.blenderAreaSize.';

function blenderReadAreaSize(name) {
  try {
    const stored = Number(localStorage.getItem(BLENDER_AREA_SIZE_STORAGE_PREFIX + name));
    return Number.isFinite(stored) && stored > 0 ? stored : 0;
  } catch (erro) {
    return 0;
  }
}

function blenderSaveAreaSize(name, size) {
  if (!Number.isFinite(size) || size <= 0) return false;
  try {
    localStorage.setItem(BLENDER_AREA_SIZE_STORAGE_PREFIX + name, String(Math.round(size)));
    return true;
  } catch (erro) {
    return false;
  }
}

function blenderForgetAreaSize(name) {
  try {
    localStorage.removeItem(BLENDER_AREA_SIZE_STORAGE_PREFIX + name);
    return true;
  } catch (erro) {
    return false;
  }
}
