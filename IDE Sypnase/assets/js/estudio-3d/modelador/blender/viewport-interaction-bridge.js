'use strict';

const blenderInteractionState = { pointer: null };

function blenderViewportMode() {
  if (typeof mod3dEdicaoAtiva === 'function' && mod3dEdicaoAtiva()) return 'edit';
  return 'object';
}

function blenderSyncInteractionMode() {
  blenderSetInteractionMode(blenderViewportMode());
}

function blenderViewportCenterPointer() {
  const canvas = typeof mod3dCena === 'object' && mod3dCena ? mod3dCena.canvas : null;
  if (!canvas) return { x: 0, y: 0 };
  return { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 };
}

function blenderCurrentPointer() {
  return blenderInteractionState.pointer || blenderViewportCenterPointer();
}

function blenderRememberPointer(event) {
  if (typeof mod3dPontoNaTela !== 'function') return;
  const point = mod3dPontoNaTela(event);
  if (point) blenderInteractionState.pointer = { x: point.x, y: point.y };
}

function blenderRefreshViewportAfterOperator() {
  if (typeof mod3dMarcarSujo === 'function') mod3dMarcarSujo();
  if (typeof mod3dPintarHud === 'function') mod3dPintarHud();
}

function blenderHandleModalTransformKey(event) {
  const session = blenderModalTransformSession();
  if (!session) return false;
  const intent = blenderModalTransformKeyIntent(event);
  if (intent.kind === 'none') return false;
  if (intent.kind === 'cancel') return blenderCancelModalTransform();
  if (intent.kind === 'confirm') return blenderConfirmModalTransform();
  if (intent.kind === 'axis') {
    blenderModalSessionUseConstraint(
      session,
      blenderNextAxisConstraint(session.constraint, intent.letter, intent.plane)
    );
    return blenderApplyModalTransform();
  }
  blenderModalSessionUseNumeric(session, blenderNumericInputApplyKey(session.numeric, intent.key));
  return blenderApplyModalTransform();
}

function blenderHandleMeshModalKey(event) {
  const session = blenderMeshModalOperatorSession();
  if (!session) return false;
  const intent = blenderMeshModalKeyIntent(event);
  if (intent.kind === 'none') return false;
  if (intent.kind === 'cancel') return blenderCancelMeshModalOperator();
  if (intent.kind === 'confirm') return blenderConfirmMeshModalOperator();
  if (intent.kind === 'segments') {
    blenderMeshModalSessionChangeSegments(session, intent.delta);
    return blenderUpdateMeshModalOperator();
  }
  blenderMeshModalSessionTypeKey(session, intent.key);
  return blenderUpdateMeshModalOperator();
}

function blenderHandleViewportKeyDown(event) {
  if (!event || event.defaultPrevented) return false;
  if (blenderForeignModalIsRunning()) return false;
  if (blenderMeshModalOperatorIsRunning()) return blenderHandleMeshModalKey(event);
  if (blenderModalTransformIsRunning()) return blenderHandleModalTransformKey(event);
  blenderSyncInteractionMode();
  const operatorId = blenderResolveKeymapOperator(
    BLENDER_DEFAULT_KEYMAP,
    event,
    blenderCurrentInteractionMode()
  );
  if (!operatorId) return false;
  const handled = blenderRunOperator(operatorId, { pointer: blenderCurrentPointer(), event });
  if (handled) blenderRefreshViewportAfterOperator();
  return handled;
}

function blenderHandleViewportPointerDown(event) {
  blenderRememberPointer(event);
  if (blenderForeignModalIsRunning()) return false;
  if (blenderMeshModalOperatorIsRunning()) {
    if (event.button === 2) return blenderCancelMeshModalOperator();
    return blenderConfirmMeshModalOperator();
  }
  if (!blenderModalTransformIsRunning()) return false;
  if (event.button === 2) return blenderCancelModalTransform();
  if (event.button === 0) return blenderConfirmModalTransform();
  return false;
}

function blenderHandleMeshModalPointerMove(event) {
  const session = blenderMeshModalOperatorSession();
  if (!session) return false;
  blenderMeshModalSessionSetSnap(session, event.ctrlKey === true);
  blenderMeshModalSessionSetPrecision(session, event.shiftKey === true);
  blenderMeshModalSessionMovePointer(session, blenderCurrentPointer());
  return blenderUpdateMeshModalOperator();
}

function blenderHandleViewportWheel(event) {
  if (blenderForeignModalIsRunning()) return false;
  const session = blenderMeshModalOperatorSession();
  if (!session) return false;
  if (!session.definition.usesSegments) return true;
  blenderMeshModalSessionChangeSegments(session, event.deltaY < 0 ? 1 : -1);
  return blenderUpdateMeshModalOperator();
}

function blenderHandleViewportPointerMove(event) {
  blenderRememberPointer(event);
  if (blenderForeignModalIsRunning()) return false;
  if (blenderMeshModalOperatorIsRunning()) return blenderHandleMeshModalPointerMove(event);
  const session = blenderModalTransformSession();
  if (!session) return false;
  blenderModalSessionSetSnap(session, event.ctrlKey === true);
  blenderModalSessionSetPrecision(session, event.shiftKey === true);
  return blenderUpdateModalTransform(blenderCurrentPointer());
}

function blenderInteractionOwnsKeyboard(event) {
  if (blenderForeignModalIsRunning()) return true;
  if (blenderMeshModalOperatorIsRunning()) return true;
  if (blenderModalTransformIsRunning()) return true;
  const canvas = typeof mod3dCena === 'object' && mod3dCena ? mod3dCena.canvas : null;
  return Boolean(canvas && event && event.target === canvas);
}
