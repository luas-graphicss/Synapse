'use strict';

const BLENDER_PRECISION_FACTOR = 0.1;
const BLENDER_TRANSLATION_SNAP = 1;
const BLENDER_ROTATION_SNAP_DEGREES = 5;
const BLENDER_SCALE_SNAP = 0.1;

function blenderSnapValue(value, step) {
  if (!step) return value;
  return Math.round(value / step) * step;
}

function blenderPointerDelta(session) {
  return {
    x: session.pointer.x - session.startPointer.x,
    y: session.pointer.y - session.startPointer.y,
  };
}

function blenderScreenTranslation(session, viewRight, viewUp, metersPerPixel) {
  const delta = blenderPointerDelta(session);
  const step = metersPerPixel * (session.precision ? BLENDER_PRECISION_FACTOR : 1);
  return [
    (viewRight[0] * delta.x - viewUp[0] * delta.y) * step,
    (viewRight[1] * delta.x - viewUp[1] * delta.y) * step,
    (viewRight[2] * delta.x - viewUp[2] * delta.y) * step,
  ];
}

function blenderTypedTranslationAmounts(session) {
  const amounts = [0, 0, 0];
  if (!blenderConstraintIsFree(session.constraint) && !session.constraint.plane) {
    amounts[blenderAxisIndex(session.constraint.letter)] = blenderNumericInputValue(session.numeric, 0, 0);
    return amounts;
  }
  let field = 0;
  for (let axis = 0; axis < 3; axis++) {
    if (!session.constraint.axes[axis]) continue;
    amounts[axis] = blenderNumericInputValue(session.numeric, field, 0);
    field += 1;
  }
  return amounts;
}

function blenderTranslationAmounts(session, worldDelta, axisVectors) {
  if (blenderNumericInputIsActive(session.numeric)) return blenderTypedTranslationAmounts(session);
  const amounts = [0, 0, 0];
  for (let axis = 0; axis < 3; axis++) {
    if (!session.constraint.axes[axis]) continue;
    amounts[axis] = blenderDotVectors(worldDelta, axisVectors[axis]);
    if (session.snap) amounts[axis] = blenderSnapValue(amounts[axis], BLENDER_TRANSLATION_SNAP);
  }
  return amounts;
}

function blenderTranslationVector(amounts, axisVectors) {
  const vector = [0, 0, 0];
  for (let axis = 0; axis < 3; axis++) {
    const direction = axisVectors[axis];
    vector[0] += direction[0] * amounts[axis];
    vector[1] += direction[1] * amounts[axis];
    vector[2] += direction[2] * amounts[axis];
  }
  return vector;
}

function blenderPointerAngleDegrees(session) {
  const startAngle = Math.atan2(
    session.startPointer.y - session.center.y,
    session.startPointer.x - session.center.x
  );
  const currentAngle = Math.atan2(
    session.pointer.y - session.center.y,
    session.pointer.x - session.center.x
  );
  return ((currentAngle - startAngle) * 180) / Math.PI;
}

function blenderRotationDegrees(session) {
  if (blenderNumericInputIsActive(session.numeric)) {
    return blenderNumericInputValue(session.numeric, 0, 0);
  }
  let degrees = blenderPointerAngleDegrees(session);
  if (session.precision) degrees *= BLENDER_PRECISION_FACTOR;
  if (session.snap) degrees = blenderSnapValue(degrees, BLENDER_ROTATION_SNAP_DEGREES);
  return degrees;
}

function blenderPointerScaleFactor(session) {
  const startDistance = Math.max(
    1,
    Math.hypot(session.startPointer.x - session.center.x, session.startPointer.y - session.center.y)
  );
  const distance = Math.hypot(
    session.pointer.x - session.center.x,
    session.pointer.y - session.center.y
  );
  return distance / startDistance;
}

function blenderScaleFieldForAxis(constraint, axis) {
  if (!constraint.axes[axis]) return -1;
  if (!blenderConstraintIsFree(constraint) && !constraint.plane) return 0;
  let field = 0;
  for (let index = 0; index < 3; index++) {
    if (!constraint.axes[index]) continue;
    if (index === axis) return field;
    field += 1;
  }
  return -1;
}

function blenderTypedScaleFactors(session) {
  const factors = [1, 1, 1];
  const uniform = blenderNumericInputValue(session.numeric, 0, 1);
  for (let axis = 0; axis < 3; axis++) {
    const field = blenderScaleFieldForAxis(session.constraint, axis);
    if (field < 0) continue;
    factors[axis] = blenderNumericInputHasValue(session.numeric, field)
    ? blenderNumericInputValue(session.numeric, field, 1)
    : uniform;
  }
  return factors;
}

function blenderScaleFactors(session) {
  const factors = [1, 1, 1];
  if (blenderNumericInputIsActive(session.numeric)) return blenderTypedScaleFactors(session);
  let factor = blenderPointerScaleFactor(session);
  if (session.precision) factor = 1 + (factor - 1) * BLENDER_PRECISION_FACTOR;
  if (session.snap) factor = blenderSnapValue(factor, BLENDER_SCALE_SNAP);
  for (let axis = 0; axis < 3; axis++) {
    factors[axis] = session.constraint.axes[axis] ? factor : 1;
  }
  return factors;
}
