'use strict';

function blenderClampSize(value, minimum, maximum) {
  if (!Number.isFinite(value)) return minimum;
  if (value < minimum) return minimum;
  if (value > maximum) return maximum;
  return value;
}
