'use strict';

const BLENDER_MODAL_HEADER_CLASS = 'blender-modal-header';

function blenderModalTransformHeaderElement() {
  const box = typeof mod3dCena === 'object' && mod3dCena ? mod3dCena.caixa : null;
  if (!box || typeof document !== 'object') return null;
  let element = box.querySelector('.' + BLENDER_MODAL_HEADER_CLASS);
  if (!element) {
    element = document.createElement('div');
    element.className = BLENDER_MODAL_HEADER_CLASS;
    element.hidden = true;
    box.appendChild(element);
  }
  return element;
}

function blenderPaintModalTransformHeader(text) {
  const element = blenderModalTransformHeaderElement();
  if (!element) return false;
  element.textContent = text;
  element.hidden = !text;
  return true;
}

function blenderClearModalTransformHeader() {
  return blenderPaintModalTransformHeader('');
}
