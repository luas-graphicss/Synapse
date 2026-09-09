'use strict';

const blenderCursorState = {
  position: [0, 0, 0],
  listeners: [],
};

function blenderCursorPosition() {
  return blenderCursorState.position.slice();
}

function blenderOnCursorChange(listener) {
  if (typeof listener !== 'function') return;
  blenderCursorState.listeners.push(listener);
}

function blenderNotifyCursorChange() {
  blenderCursorState.listeners.forEach((listener) => {
      try {
        listener(blenderCursorPosition());
      } catch (error) {
        ignorarErro(error, 'blenderNotifyCursorChange');
      }
  });
}

function blenderSetCursorPosition(point) {
  if (!Array.isArray(point) || point.length < 3) return false;
  for (let axis = 0; axis < 3; axis++) {
    const value = Number(point[axis]);
    blenderCursorState.position[axis] = isFinite(value) ? value : 0;
  }
  blenderNotifyCursorChange();
  return true;
}

function blenderResetCursorPosition() {
  return blenderSetCursorPosition([0, 0, 0]);
}
