'use strict';

const BLENDER_SIDE_WIDTH_VARIABLE = '--blender-side-width';
const BLENDER_SIDE_WIDTH_STORAGE_NAME = 'sideWidth';
const BLENDER_DEFAULT_SIDE_WIDTH = 318;
const BLENDER_MINIMUM_SIDE_WIDTH = 210;
const BLENDER_MINIMUM_VIEWPORT_WIDTH = 320;

function blenderMaximumSideWidth(workspace) {
  const available = Math.round(workspace.getBoundingClientRect().width - BLENDER_MINIMUM_VIEWPORT_WIDTH);
  return Math.max(BLENDER_MINIMUM_SIDE_WIDTH, available);
}

function blenderApplySideWidth(workspace, width) {
  const clamped = Math.round(
    blenderClampSize(width, BLENDER_MINIMUM_SIDE_WIDTH, blenderMaximumSideWidth(workspace)),
  );
  workspace.style.setProperty(BLENDER_SIDE_WIDTH_VARIABLE, `${clamped}px`);
  return clamped;
}

function blenderApplyWorkspaceWidthResize() {
  const workspace = document.querySelector('.mod3d-workspace');
  const side = workspace ? workspace.querySelector('.mod3d-paineis') : null;
  if (!workspace || !side) return null;
  if (workspace.querySelector('.blender-workspace-splitter')) return null;
  const savedWidth = blenderReadAreaSize(BLENDER_SIDE_WIDTH_STORAGE_NAME);
  blenderApplySideWidth(workspace, savedWidth || BLENDER_DEFAULT_SIDE_WIDTH);
  const splitter = blenderCreateAreaSplitter({
      orientation: 'vertical',
      growth: -1,
      extraClass: 'blender-workspace-splitter',
      label: blenderTranslate('Arraste para redimensionar os painéis'),
      readSize: () => side.getBoundingClientRect().width,
      onResize: (size) => blenderApplySideWidth(workspace, size),
      onFinish: () => blenderSaveAreaSize(BLENDER_SIDE_WIDTH_STORAGE_NAME, side.getBoundingClientRect().width),
      onReset: () => {
        blenderApplySideWidth(workspace, BLENDER_DEFAULT_SIDE_WIDTH);
        blenderForgetAreaSize(BLENDER_SIDE_WIDTH_STORAGE_NAME);
      },
  });
  workspace.insertBefore(splitter, side);
  window.addEventListener('resize', () => {
      const currentWidth = side.getBoundingClientRect().width;
      if (currentWidth > 0) blenderApplySideWidth(workspace, currentWidth);
  });
  return splitter;
}
