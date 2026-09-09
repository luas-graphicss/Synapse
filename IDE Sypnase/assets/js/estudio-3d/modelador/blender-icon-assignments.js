'use strict';

const BLENDER_TOPBAR_ICONS = Object.freeze({
    brand: 'brand',
    project: 'project',
    reload: 'refresh',
});

const BLENDER_MESH_MODE_ICONS = Object.freeze({
    vertice: 'vertex',
    aresta: 'edge',
    face: 'face',
});

const BLENDER_TRANSFORM_TOOL_ICONS = Object.freeze({
    mover: 'move',
    girar: 'rotate',
    escalar: 'scale',
});

const BLENDER_OBJECT_ACTION_ICONS = Object.freeze({
    duplicar: 'duplicate',
    agrupar: 'group',
    apagar: 'trash',
});

const BLENDER_HISTORY_ACTION_ICONS = Object.freeze({
    desfazer: 'undo',
    refazer: 'redo',
});

const BLENDER_VIEW_ACTION_ICONS = Object.freeze({
    frameScene: 'frame',
    toggleGrid: 'grid',
    loadReference: 'import',
    clearReference: 'unlink',
});

const BLENDER_HEADER_FIELD_ICONS = Object.freeze({
    interactionMode: 'edit',
    snapToggle: 'magnet',
    snapSettings: 'chevron',
    addObject: 'plus',
    measureUnit: 'ruler',
    referenceModel: 'image',
});

const BLENDER_EDITOR_ICONS = Object.freeze({
    outliner: 'outliner',
});

const BLENDER_PROPERTY_TAB_ICONS = Object.freeze({
    object: 'object',
    mesh: 'mesh',
    material: 'material',
    uv: 'uv',
    output: 'output',
    project: 'scene',
});

const BLENDER_ICON_ASSIGNMENT_GROUPS = Object.freeze([
    BLENDER_TOPBAR_ICONS,
    BLENDER_MESH_MODE_ICONS,
    BLENDER_TRANSFORM_TOOL_ICONS,
    BLENDER_OBJECT_ACTION_ICONS,
    BLENDER_HISTORY_ACTION_ICONS,
    BLENDER_VIEW_ACTION_ICONS,
    BLENDER_HEADER_FIELD_ICONS,
    BLENDER_EDITOR_ICONS,
    BLENDER_PROPERTY_TAB_ICONS,
]);

function blenderAssignedIconNames() {
  const names = [];
  BLENDER_ICON_ASSIGNMENT_GROUPS.forEach((group) => {
      Object.keys(group).forEach((key) => names.push(group[key]));
  });
  return names;
}

function blenderRepeatedIconNames() {
  const seen = [];
  const repeated = [];
  blenderAssignedIconNames().forEach((name) => {
      if (seen.indexOf(name) < 0) {
        seen.push(name);
        return;
      }
      if (repeated.indexOf(name) < 0) repeated.push(name);
  });
  return repeated;
}
