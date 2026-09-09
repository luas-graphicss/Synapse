'use strict';

const BLENDER_TRANSFORM_HISTORY_LABELS = Object.freeze({
    translate: 'Mover',
    rotate: 'Girar',
    resize: 'Escalar',
});

const blenderModalTransform = { session: null, start: null };

function blenderModalTransformIsRunning() {
  return blenderModalTransform.session !== null;
}

function blenderModalTransformSession() {
  return blenderModalTransform.session;
}

function blenderProjectPointToScreen(point) {
  const current = mod3dMatrizesAtuais();
  if (!current) return null;
  const projected = mod3dProjetarPonto(point, current.matrizes, current.tamanho);
  if (!projected) return null;
  return { x: projected.x, y: projected.y };
}

function blenderCaptureTransformStart() {
  const mesh = blenderCaptureMeshTransformStart();
  if (mesh) return mesh;
  return blenderCaptureObjectTransformStart();
}

function blenderViewBasis() {
  const camera = typeof mod3dCena === 'object' && mod3dCena ? mod3dCena.camera : null;
  if (!camera) return null;
  const state = camera.estado();
  return mod3dBaseOrbital(state.theta, state.phi);
}

function blenderViewMetersPerPixel() {
  const camera = typeof mod3dCena === 'object' && mod3dCena ? mod3dCena.camera : null;
  if (!camera) return 0;
  const height = mod3dCena.canvas ? mod3dCena.canvas.clientHeight : 0;
  return camera.metrosPorPixel(Math.max(1, height));
}

function blenderModalTransformAxisVectors() {
  const session = blenderModalTransform.session;
  const start = blenderModalTransform.start;
  const orientation = session && session.constraint.orientation
  ? session.constraint.orientation
  : blenderCurrentTransformOrientation();
  if (orientation !== 'local' || !start || !start.localAxes) return BLENDER_WORLD_AXES;
  return start.localAxes;
}

function blenderRotationAxis(session, basis, axisVectors) {
  if (!blenderConstraintIsFree(session.constraint) && !session.constraint.plane) {
    return axisVectors[blenderAxisIndex(session.constraint.letter)];
  }
  return [-basis.frente[0], -basis.frente[1], -basis.frente[2]];
}

function blenderRunModalTranslation(session, start, basis, axisVectors) {
  const worldDelta = blenderScreenTranslation(
    session,
    basis.direita,
    basis.cima,
    blenderViewMetersPerPixel()
  );
  const amounts = blenderTranslationAmounts(session, worldDelta, axisVectors);
  const vector = blenderTranslationVector(amounts, axisVectors);
  if (start.kind === 'mesh') blenderApplyMeshTranslation(start, vector);
  else blenderApplyObjectTranslation(start, vector);
  return { amounts };
}

function blenderRunModalRotation(session, start, basis, axisVectors) {
  const axis = blenderRotationAxis(session, basis, axisVectors);
  let degrees = blenderRotationDegrees(session);
  if (!blenderNumericInputIsActive(session.numeric)) {
    const towardViewer = [-basis.frente[0], -basis.frente[1], -basis.frente[2]];
    degrees = blenderDotVectors(axis, towardViewer) >= 0 ? -degrees : degrees;
  }
  if (start.kind === 'mesh') blenderApplyMeshRotation(start, axis, degrees);
  else blenderApplyObjectRotation(start, axis, degrees);
  return { degrees };
}

function blenderRunModalScale(session, start, axisVectors) {
  const factors = blenderScaleFactors(session);
  if (start.kind === 'mesh') blenderApplyMeshScale(start, factors, axisVectors);
  else blenderApplyObjectScale(start, factors, axisVectors);
  return { factors };
}

function blenderApplyModalTransform() {
  const session = blenderModalTransform.session;
  const start = blenderModalTransform.start;
  if (!session || !start) return false;
  const basis = blenderViewBasis();
  if (!basis) return false;
  const axisVectors = blenderModalTransformAxisVectors();
  let values = null;
  if (session.type === BLENDER_TRANSFORM_TYPES.translate) {
    values = blenderRunModalTranslation(session, start, basis, axisVectors);
  } else if (session.type === BLENDER_TRANSFORM_TYPES.rotate) {
    values = blenderRunModalRotation(session, start, basis, axisVectors);
  } else {
    values = blenderRunModalScale(session, start, axisVectors);
  }
  blenderPaintModalTransformHeader(blenderModalTransformHeaderText(session, values));
  return true;
}

function blenderStartModalTransform(type, pointer) {
  if (blenderModalTransformIsRunning()) blenderCancelModalTransform();
  if (!pointer) return false;
  const start = blenderCaptureTransformStart();
  if (!start) return false;
  const center = blenderProjectPointToScreen(start.pivot);
  if (!center) return false;
  blenderModalTransform.start = start;
  blenderModalTransform.session = blenderCreateModalTransformSession({
      type,
      pointer,
      center,
      snap: false,
  });
  return blenderApplyModalTransform();
}

function blenderUpdateModalTransform(pointer) {
  const session = blenderModalTransform.session;
  if (!session) return false;
  blenderModalSessionMovePointer(session, pointer);
  return blenderApplyModalTransform();
}

function blenderFinishModalTransform() {
  blenderModalTransform.session = null;
  blenderModalTransform.start = null;
  blenderClearModalTransformHeader();
}

function blenderConfirmModalTransform() {
  const session = blenderModalTransform.session;
  const start = blenderModalTransform.start;
  if (!session || !start) return false;
  const label = BLENDER_TRANSFORM_HISTORY_LABELS[session.type];
  if (start.kind === 'mesh') blenderCommitMeshTransform(start, label);
  else blenderCommitObjectTransform(start, label);
  blenderFinishModalTransform();
  return true;
}

function blenderCancelModalTransform() {
  const start = blenderModalTransform.start;
  if (!start) return false;
  if (start.kind === 'mesh') blenderRestoreMeshTransform(start);
  else blenderRestoreObjectTransform(start);
  blenderFinishModalTransform();
  return true;
}
