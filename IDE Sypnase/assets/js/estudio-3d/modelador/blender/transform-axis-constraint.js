'use strict';

const BLENDER_AXIS_LETTERS = Object.freeze(['x', 'y', 'z']);

function blenderAxisIndex(letter) {
  return BLENDER_AXIS_LETTERS.indexOf(letter);
}

function blenderFreeAxisConstraint() {
  return { axes: [true, true, true], orientation: '', plane: false, letter: '' };
}

function blenderSingleAxisConstraint(letter, orientation) {
  const axes = [false, false, false];
  axes[blenderAxisIndex(letter)] = true;
  return { axes, orientation, plane: false, letter };
}

function blenderPlaneAxisConstraint(letter, orientation) {
  const axes = [true, true, true];
  axes[blenderAxisIndex(letter)] = false;
  return { axes, orientation, plane: true, letter };
}

function blenderConstraintIsFree(constraint) {
  return constraint.axes[0] && constraint.axes[1] && constraint.axes[2];
}

function blenderNextAxisConstraint(constraint, letter, planeRequested) {
  if (blenderAxisIndex(letter) === -1) return constraint;
  const repeated = constraint.letter === letter && constraint.plane === planeRequested;
  if (repeated && constraint.orientation === 'global') {
    return planeRequested
    ? blenderPlaneAxisConstraint(letter, 'local')
    : blenderSingleAxisConstraint(letter, 'local');
  }
  if (repeated && constraint.orientation === 'local') return blenderFreeAxisConstraint();
  return planeRequested
  ? blenderPlaneAxisConstraint(letter, 'global')
  : blenderSingleAxisConstraint(letter, 'global');
}

function blenderConstraintLabel(constraint) {
  if (blenderConstraintIsFree(constraint)) return '';
  const axisName = constraint.letter.toUpperCase();
  if (constraint.plane) return `${constraint.orientation} ${axisName} plane`;
  return `${constraint.orientation} ${axisName}`;
}
