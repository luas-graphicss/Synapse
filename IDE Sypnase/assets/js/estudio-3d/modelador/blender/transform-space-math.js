'use strict';

const BLENDER_WORLD_AXES = Object.freeze([
    Object.freeze([1, 0, 0]),
    Object.freeze([0, 1, 0]),
    Object.freeze([0, 0, 1]),
]);

function blenderMatrixAxes(matrix) {
  if (!matrix) return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  return [
    mod3dNormalizarVetor([matrix[0], matrix[1], matrix[2]]),
    mod3dNormalizarVetor([matrix[4], matrix[5], matrix[6]]),
    mod3dNormalizarVetor([matrix[8], matrix[9], matrix[10]]),
  ];
}

function blenderAddVectors(first, second) {
  return [first[0] + second[0], first[1] + second[1], first[2] + second[2]];
}

function blenderSubtractVectors(first, second) {
  return [first[0] - second[0], first[1] - second[1], first[2] - second[2]];
}

function blenderDotVectors(first, second) {
  return first[0] * second[0] + first[1] * second[1] + first[2] * second[2];
}

function blenderMedianPoint(points) {
  if (!points.length) return [0, 0, 0];
  const total = [0, 0, 0];
  points.forEach((point) => {
      total[0] += point[0];
      total[1] += point[1];
      total[2] += point[2];
  });
  return [total[0] / points.length, total[1] / points.length, total[2] / points.length];
}

function blenderBoundsCenter(points) {
  if (!points.length) return [0, 0, 0];
  const minimum = points[0].slice();
  const maximum = points[0].slice();
  points.forEach((point) => {
      for (let axis = 0; axis < 3; axis++) {
        if (point[axis] < minimum[axis]) minimum[axis] = point[axis];
        if (point[axis] > maximum[axis]) maximum[axis] = point[axis];
      }
  });
  return [
    (minimum[0] + maximum[0]) / 2,
    (minimum[1] + maximum[1]) / 2,
    (minimum[2] + maximum[2]) / 2,
  ];
}

function blenderRotatePointAround(point, pivot, rotation) {
  const offset = blenderSubtractVectors(point, pivot);
  return blenderAddVectors(pivot, mod3dVetorPorMat(rotation, offset));
}

function blenderScalePointAround(point, pivot, factors, axisVectors) {
  const offset = blenderSubtractVectors(point, pivot);
  const result = pivot.slice();
  for (let axis = 0; axis < 3; axis++) {
    const direction = axisVectors[axis];
    const amount = blenderDotVectors(offset, direction) * factors[axis];
    result[0] += direction[0] * amount;
    result[1] += direction[1] * amount;
    result[2] += direction[2] * amount;
  }
  return result;
}
