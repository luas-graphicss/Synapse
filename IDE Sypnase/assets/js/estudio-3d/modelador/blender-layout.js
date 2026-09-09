'use strict';

function blenderApplyModelerLayout() {
  const body = document.body;
  if (!body || !body.classList.contains('mod3d-corpo')) return false;
  if (body.classList.contains('blender-layout')) return false;
  body.classList.add('blender-layout');
  blenderBuildTopbar();
  blenderBuildViewportHeader();
  blenderBuildViewportToolbar();
  blenderBuildProperties();
  blenderBuildOutliner();
  blenderMakePanelsCollapsible();
  blenderBuildStatusBar();
  blenderWatchSliderFill();
  blenderApplyWorkspaceWidthResize();
  blenderApplySideStackResize();
  blenderWatchHeaderScroll();
  return true;
}

if (typeof mod3dPapel === 'function' && mod3dPapel() === 'modelador') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', blenderApplyModelerLayout);
  } else {
    blenderApplyModelerLayout();
  }
}
