'use strict';

const BLENDER_DISTANCE_DECIMALS = 4;
const BLENDER_ANGLE_DECIMALS = 2;

function blenderFormatHeaderNumber(value, decimals) {
  const number = Number(value);
  return (isFinite(number) ? number : 0).toFixed(decimals);
}

function blenderFreeAxisAmountsText(amounts, constraint) {
  const parts = [];
  for (let axis = 0; axis < 3; axis++) {
    if (!constraint.axes[axis]) continue;
    parts.push(blenderFormatHeaderNumber(amounts[axis], BLENDER_DISTANCE_DECIMALS));
  }
  return parts.join(' ');
}

function blenderTranslationHeaderText(amounts, constraint) {
  const distance = Math.hypot(amounts[0], amounts[1], amounts[2]);
  if (blenderConstraintIsFree(constraint)) {
    return (
      'D: ' +
      blenderFreeAxisAmountsText(amounts, constraint) +
      ' (' +
      blenderFormatHeaderNumber(distance, BLENDER_DISTANCE_DECIMALS) +
      ')'
    );
  }
  if (constraint.plane) {
    return (
      'D: ' +
      blenderFreeAxisAmountsText(amounts, constraint) +
      ' along ' +
      blenderConstraintLabel(constraint)
    );
  }
  const value = blenderFormatHeaderNumber(amounts[blenderAxisIndex(constraint.letter)], BLENDER_DISTANCE_DECIMALS);
  return 'D: ' + value + ' (' + value + ') along ' + blenderConstraintLabel(constraint);
}

function blenderRotationHeaderText(degrees, constraint) {
  const value = blenderFormatHeaderNumber(degrees, BLENDER_ANGLE_DECIMALS);
  if (blenderConstraintIsFree(constraint) || constraint.plane) return 'Rot: ' + value + '\u00B0';
  return 'Rot: ' + value + '\u00B0 along ' + blenderConstraintLabel(constraint);
}

function blenderScaleHeaderText(factors, constraint) {
  if (blenderConstraintIsFree(constraint)) {
    return 'Scale: ' + blenderFormatHeaderNumber(factors[0], BLENDER_DISTANCE_DECIMALS);
  }
  const parts = [];
  for (let axis = 0; axis < 3; axis++) {
    if (!constraint.axes[axis]) continue;
    parts.push(
      BLENDER_AXIS_LETTERS[axis].toUpperCase() +
      ': ' +
      blenderFormatHeaderNumber(factors[axis], BLENDER_DISTANCE_DECIMALS)
    );
  }
  return 'Scale ' + parts.join(' ');
}

function blenderModalTransformHeaderText(session, values) {
  const typed = blenderNumericInputIsActive(session.numeric)
  ? ' [' + blenderNumericInputText(session.numeric) + ']'
  : '';
  if (session.type === BLENDER_TRANSFORM_TYPES.translate) {
    return blenderTranslationHeaderText(values.amounts, session.constraint) + typed;
  }
  if (session.type === BLENDER_TRANSFORM_TYPES.rotate) {
    return blenderRotationHeaderText(values.degrees, session.constraint) + typed;
  }
  return blenderScaleHeaderText(values.factors, session.constraint) + typed;
}
