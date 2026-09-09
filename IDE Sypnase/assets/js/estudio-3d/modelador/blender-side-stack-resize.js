'use strict';

const BLENDER_OUTLINER_HEIGHT_VARIABLE = '--blender-outliner-height';
const BLENDER_OUTLINER_HEIGHT_STORAGE_NAME = 'outlinerHeight';
const BLENDER_DEFAULT_OUTLINER_HEIGHT = 236;
const BLENDER_MINIMUM_OUTLINER_HEIGHT = 96;
const BLENDER_MINIMUM_PROPERTIES_HEIGHT = 180;

function blenderMaximumOutlinerHeight(side) {
  const available = Math.round(side.getBoundingClientRect().height - BLENDER_MINIMUM_PROPERTIES_HEIGHT);
  return Math.max(BLENDER_MINIMUM_OUTLINER_HEIGHT, available);
}

function blenderApplyOutlinerHeight(side, height) {
  const clamped = Math.round(
    blenderClampSize(height, BLENDER_MINIMUM_OUTLINER_HEIGHT, blenderMaximumOutlinerHeight(side)),
  );
  side.style.setProperty(BLENDER_OUTLINER_HEIGHT_VARIABLE, `${clamped}px`);
  return clamped;
}

function blenderApplySideStackResize() {
  const side = document.querySelector('.mod3d-paineis');
  const outliner = side ? side.querySelector('.blender-outliner') : null;
  const properties = side ? side.querySelector('.blender-properties') : null;
  if (!side || !outliner || !properties) return null;
  if (side.querySelector('.blender-side-splitter')) return null;
  const savedHeight = blenderReadAreaSize(BLENDER_OUTLINER_HEIGHT_STORAGE_NAME);
  blenderApplyOutlinerHeight(side, savedHeight || BLENDER_DEFAULT_OUTLINER_HEIGHT);
  const splitter = blenderCreateAreaSplitter({
      orientation: 'horizontal',
      growth: 1,
      extraClass: 'blender-side-splitter',
      label: blenderTranslate('Arraste para redimensionar a cena'),
      readSize: () => outliner.getBoundingClientRect().height,
      onResize: (size) => blenderApplyOutlinerHeight(side, size),
      onFinish: () => blenderSaveAreaSize(BLENDER_OUTLINER_HEIGHT_STORAGE_NAME, outliner.getBoundingClientRect().height),
      onReset: () => {
        blenderApplyOutlinerHeight(side, BLENDER_DEFAULT_OUTLINER_HEIGHT);
        blenderForgetAreaSize(BLENDER_OUTLINER_HEIGHT_STORAGE_NAME);
      },
  });
  side.insertBefore(splitter, properties);
  window.addEventListener('resize', () => {
      const currentHeight = outliner.getBoundingClientRect().height;
      if (currentHeight > 0) blenderApplyOutlinerHeight(side, currentHeight);
  });
  return splitter;
}
