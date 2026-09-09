'use strict';

const BLENDER_TRANSFORM_TYPES = Object.freeze({
    translate: 'translate',
    rotate: 'rotate',
    resize: 'resize',
});

function blenderCreateModalTransformSession(request) {
  return {
    type: request.type,
    startPointer: { x: request.pointer.x, y: request.pointer.y },
    pointer: { x: request.pointer.x, y: request.pointer.y },
    center: { x: request.center.x, y: request.center.y },
    constraint: blenderFreeAxisConstraint(),
    numeric: blenderCreateNumericInput(),
    snap: request.snap === true,
    precision: false,
  };
}

function blenderModalSessionMovePointer(session, pointer) {
  session.pointer.x = pointer.x;
  session.pointer.y = pointer.y;
}

function blenderModalSessionUseConstraint(session, constraint) {
  session.constraint = constraint;
}

function blenderModalSessionUseNumeric(session, numeric) {
  session.numeric = numeric;
}

function blenderModalSessionSetSnap(session, snap) {
  session.snap = snap === true;
}

function blenderModalSessionSetPrecision(session, precision) {
  session.precision = precision === true;
}

function blenderModalSessionUsesNumeric(session) {
  return blenderNumericInputIsActive(session.numeric);
}
