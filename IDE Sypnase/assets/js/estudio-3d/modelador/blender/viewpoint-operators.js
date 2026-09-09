'use strict';

const BLENDER_VIEWPOINTS = Object.freeze({
    front: Object.freeze({ theta: 0, phi: 0, axis: 2, sign: 1, name: 'Front' }),
    back: Object.freeze({ theta: Math.PI, phi: 0, axis: 2, sign: -1, name: 'Back' }),
    right: Object.freeze({ theta: Math.PI / 2, phi: 0, axis: 0, sign: 1, name: 'Right' }),
    left: Object.freeze({ theta: -Math.PI / 2, phi: 0, axis: 0, sign: -1, name: 'Left' }),
    top: Object.freeze({ theta: 0, phi: Math.PI / 2, axis: 1, sign: 1, name: 'Top' }),
    bottom: Object.freeze({ theta: 0, phi: -Math.PI / 2, axis: 1, sign: -1, name: 'Bottom' }),
});
const BLENDER_POLE_VIEW_AXIS = 1;
const BLENDER_ORBIT_STEP_RADIANS = (15 * Math.PI) / 180;
const BLENDER_ANGLE_TOLERANCE = 0.002;

function blenderSameAngle(first, second) {
  const full = Math.PI * 2;
  let difference = Math.abs((first - second) % full);
  if (difference > Math.PI) difference = full - difference;
  return difference < BLENDER_ANGLE_TOLERANCE;
}

function blenderApplyViewpoint(camera, viewpointId) {
  const target = BLENDER_VIEWPOINTS[viewpointId];
  if (!camera || !target) return false;
  if (typeof camera.definirEixoDaVista === 'function') {
    return camera.definirEixoDaVista(target.axis, target.sign) === true;
  }
  const state = camera.estado();
  camera.orbitar(state.theta - target.theta, target.phi - state.phi);
  if (!camera.estado().orto) camera.alternarProjecao();
  return true;
}

function blenderOrbitView(camera, direction) {
  if (!camera) return false;
  if (direction === 'left') {
    camera.orbitar(-BLENDER_ORBIT_STEP_RADIANS, 0);
    return true;
  }
  if (direction === 'right') {
    camera.orbitar(BLENDER_ORBIT_STEP_RADIANS, 0);
    return true;
  }
  if (direction === 'up') {
    camera.orbitar(0, BLENDER_ORBIT_STEP_RADIANS);
    return true;
  }
  if (direction === 'down') {
    camera.orbitar(0, -BLENDER_ORBIT_STEP_RADIANS);
    return true;
  }
  return false;
}

function blenderFlipView(camera) {
  if (!camera) return false;
  const state = camera.estado();
  camera.orbitar(-Math.PI, -2 * state.phi);
  return true;
}

function blenderToggleViewProjection(camera) {
  if (!camera) return false;
  camera.alternarProjecao();
  return true;
}

function blenderViewpointMatches(state, target) {
  if (target.axis === BLENDER_POLE_VIEW_AXIS) return blenderSameAngle(state.phi, target.phi);
  return blenderSameAngle(state.theta, target.theta) && blenderSameAngle(state.phi, target.phi);
}

function blenderViewpointLabel(camera) {
  if (!camera) return '';
  const state = camera.estado();
  const projection = state.orto ? 'Orthographic' : 'Perspective';
  const names = Object.keys(BLENDER_VIEWPOINTS);
  for (let index = 0; index < names.length; index++) {
    const target = BLENDER_VIEWPOINTS[names[index]];
    if (blenderViewpointMatches(state, target)) {
      return target.name + ' ' + projection;
    }
  }
  return 'User ' + projection;
}
