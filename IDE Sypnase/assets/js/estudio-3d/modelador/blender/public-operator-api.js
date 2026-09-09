'use strict';

function blenderInstallOperatorBindings() {
  blenderRegisterTransformOperators();
  blenderRegisterObjectOperators();
  blenderRegisterMeshOperators();
  blenderRegisterUvOperators();
  blenderRegisterViewOperators();
  return blenderRegisteredOperatorIds();
}

function blenderPublicOperatorApi() {
  return {
    run: (operatorId) => blenderRunOperator(operatorId, { pointer: blenderCurrentPointer() }),
    has: (operatorId) => blenderHasOperator(operatorId),
    operators: () => blenderRegisteredOperatorIds(),
    keymap: (mode) => blenderKeymapEntriesForMode(BLENDER_DEFAULT_KEYMAP, mode),
    mode: () => blenderCurrentInteractionMode(),
    modes: () => BLENDER_INTERACTION_MODES,
    setMode: (modeId) => blenderSetInteractionMode(modeId),
    onModeChange: (listener) => blenderOnInteractionModeChange(listener),
    selectMode: () => blenderCurrentMeshSelectMode(),
    selectModes: () => BLENDER_MESH_SELECT_MODES,
    setSelectMode: (modeId) => blenderApplyMeshSelectMode(modeId),
    onSelectModeChange: (listener) => blenderOnMeshSelectModeChange(listener),
    pivot: () => blenderCurrentTransformPivot(),
    pivots: () => BLENDER_TRANSFORM_PIVOTS,
    setPivot: (pivotId) => blenderSetTransformPivot(pivotId),
    orientation: () => blenderCurrentTransformOrientation(),
    orientations: () => BLENDER_TRANSFORM_ORIENTATIONS,
    setOrientation: (orientationId) => blenderSetTransformOrientation(orientationId),
    cursor: () => blenderCursorPosition(),
    setCursor: (point) => blenderSetCursorPosition(point),
    viewLabel: () => blenderViewpointLabel(blenderViewportCamera()),
    uvProjections: () => Object.keys(BLENDER_UV_PROJECTION_OPERATORS),
    modalRunning: () => blenderModalTransformIsRunning(),
  };
}

blenderInstallOperatorBindings();
window.BLENDER_OPERATORS = blenderPublicOperatorApi();
