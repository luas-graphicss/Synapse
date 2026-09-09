'use strict';

function blenderBuildViewportToolbar() {
  const viewport = document.querySelector('.mod3d-viewport');
  if (!viewport || viewport.querySelector('.blender-toolbar')) return null;
  if (typeof mod3dPainelDaCena !== 'object' || !mod3dPainelDaCena) return null;
  const modes = mod3dPainelDaCena.modos;
  if (!modes || !modes.modos) return null;
  const toolbar = document.createElement('div');
  toolbar.className = 'blender-toolbar';
  modes.modos.forEach((button, key) => {
      blenderTurnButtonIntoIcon(button, BLENDER_TRANSFORM_TOOL_ICONS[key] || 'move');
      button.classList.add('blender-toolbar-button');
      toolbar.appendChild(button);
  });
  if (!toolbar.childElementCount) return null;
  viewport.appendChild(toolbar);
  return toolbar;
}
