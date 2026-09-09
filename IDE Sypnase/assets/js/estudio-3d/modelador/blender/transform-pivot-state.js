'use strict';

const BLENDER_TRANSFORM_PIVOTS = Object.freeze([
    Object.freeze({ id: 'boundingBoxCenter', label: 'Bounding Box Center' }),
    Object.freeze({ id: 'cursor', label: '3D Cursor' }),
    Object.freeze({ id: 'individualOrigins', label: 'Individual Origins' }),
    Object.freeze({ id: 'medianPoint', label: 'Median Point' }),
    Object.freeze({ id: 'activeElement', label: 'Active Element' }),
]);

const blenderTransformPivotState = {
  current: 'medianPoint',
  listeners: [],
};

function blenderTransformPivotIndex(pivotId) {
  for (let index = 0; index < BLENDER_TRANSFORM_PIVOTS.length; index++) {
    if (BLENDER_TRANSFORM_PIVOTS[index].id === pivotId) return index;
  }
  return -1;
}

function blenderCurrentTransformPivot() {
  return blenderTransformPivotState.current;
}

function blenderTransformPivotLabel(pivotId) {
  const index = blenderTransformPivotIndex(pivotId);
  return index === -1 ? '' : BLENDER_TRANSFORM_PIVOTS[index].label;
}

function blenderOnTransformPivotChange(listener) {
  if (typeof listener !== 'function') return;
  blenderTransformPivotState.listeners.push(listener);
}

function blenderSetTransformPivot(pivotId) {
  if (blenderTransformPivotIndex(pivotId) === -1) return false;
  if (blenderTransformPivotState.current === pivotId) return false;
  blenderTransformPivotState.current = pivotId;
  blenderTransformPivotState.listeners.forEach((listener) => {
      try {
        listener(pivotId);
      } catch (error) {
        ignorarErro(error, 'blenderSetTransformPivot');
      }
  });
  return true;
}

function blenderCycleTransformPivot() {
  const index = blenderTransformPivotIndex(blenderTransformPivotState.current);
  const next = BLENDER_TRANSFORM_PIVOTS[(index + 1) % BLENDER_TRANSFORM_PIVOTS.length];
  blenderSetTransformPivot(next.id);
  return next.id;
}
