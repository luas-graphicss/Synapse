'use strict';

const BLENDER_SPLITTER_DRAGGING_CLASS = 'is-dragging';

function blenderSplitterPointerPosition(orientation, event) {
  return orientation === 'vertical' ? event.clientX : event.clientY;
}

function blenderCreateAreaSplitter(settings) {
  const splitter = document.createElement('div');
  const classNames = ['blender-area-splitter', `blender-area-splitter-${settings.orientation}`];
  if (settings.extraClass) classNames.push(settings.extraClass);
  splitter.className = classNames.join(' ');
  splitter.setAttribute('role', 'separator');
  splitter.setAttribute(
    'aria-orientation',
    settings.orientation === 'vertical' ? 'vertical' : 'horizontal',
  );
  if (settings.label) {
    splitter.title = settings.label;
    splitter.setAttribute('aria-label', settings.label);
  }
  let dragging = false;
  let startPointer = 0;
  let startSize = 0;
  let requestedSize = 0;
  let frameRequest = 0;
  function applyRequestedSize() {
    frameRequest = 0;
    settings.onResize(requestedSize);
  }
  function scheduleResize() {
    if (frameRequest) return;
    frameRequest = window.requestAnimationFrame(applyRequestedSize);
  }
  function cancelScheduledResize() {
    if (!frameRequest) return;
    window.cancelAnimationFrame(frameRequest);
    frameRequest = 0;
  }
  function stopDragging(event) {
    if (!dragging) return;
    dragging = false;
    splitter.classList.remove(BLENDER_SPLITTER_DRAGGING_CLASS);
    if (splitter.hasPointerCapture(event.pointerId)) splitter.releasePointerCapture(event.pointerId);
    cancelScheduledResize();
    settings.onResize(requestedSize);
    if (settings.onFinish) settings.onFinish();
  }
  splitter.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      dragging = true;
      startPointer = blenderSplitterPointerPosition(settings.orientation, event);
      startSize = settings.readSize();
      requestedSize = startSize;
      splitter.classList.add(BLENDER_SPLITTER_DRAGGING_CLASS);
      splitter.setPointerCapture(event.pointerId);
      event.preventDefault();
  });
  splitter.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      const moved = blenderSplitterPointerPosition(settings.orientation, event) - startPointer;
      requestedSize = startSize + moved * settings.growth;
      scheduleResize();
  });
  splitter.addEventListener('pointerup', stopDragging);
  splitter.addEventListener('pointercancel', stopDragging);
  if (settings.onReset) splitter.addEventListener('dblclick', settings.onReset);
  return splitter;
}
