'use strict';

const BLENDER_TRANSFORM_ORIENTATIONS = Object.freeze([
    Object.freeze({ id: 'global', label: 'Global', available: true }),
    Object.freeze({ id: 'local', label: 'Local', available: true }),
    Object.freeze({ id: 'normal', label: 'Normal', available: false }),
    Object.freeze({ id: 'gimbal', label: 'Gimbal', available: false }),
    Object.freeze({ id: 'view', label: 'View', available: false }),
    Object.freeze({ id: 'cursor', label: 'Cursor', available: false }),
]);

const blenderTransformOrientationState = {
  current: 'global',
  listeners: [],
};

function blenderTransformOrientationById(orientationId) {
  for (let index = 0; index < BLENDER_TRANSFORM_ORIENTATIONS.length; index++) {
    if (BLENDER_TRANSFORM_ORIENTATIONS[index].id === orientationId) {
      return BLENDER_TRANSFORM_ORIENTATIONS[index];
    }
  }
  return null;
}

function blenderAvailableTransformOrientations() {
  return BLENDER_TRANSFORM_ORIENTATIONS.filter((orientation) => orientation.available);
}

function blenderCurrentTransformOrientation() {
  return blenderTransformOrientationState.current;
}

function blenderTransformOrientationLabel(orientationId) {
  const orientation = blenderTransformOrientationById(orientationId);
  return orientation ? orientation.label : '';
}

function blenderOnTransformOrientationChange(listener) {
  if (typeof listener !== 'function') return;
  blenderTransformOrientationState.listeners.push(listener);
}

function blenderSetTransformOrientation(orientationId) {
  const orientation = blenderTransformOrientationById(orientationId);
  if (!orientation || !orientation.available) return false;
  if (blenderTransformOrientationState.current === orientationId) return false;
  blenderTransformOrientationState.current = orientationId;
  blenderTransformOrientationState.listeners.forEach((listener) => {
      try {
        listener(orientationId);
      } catch (error) {
        ignorarErro(error, 'blenderSetTransformOrientation');
      }
  });
  return true;
}

function blenderCycleTransformOrientation() {
  const available = blenderAvailableTransformOrientations();
  let index = 0;
  for (let position = 0; position < available.length; position++) {
    if (available[position].id === blenderTransformOrientationState.current) index = position;
  }
  const next = available[(index + 1) % available.length];
  blenderSetTransformOrientation(next.id);
  return next.id;
}
