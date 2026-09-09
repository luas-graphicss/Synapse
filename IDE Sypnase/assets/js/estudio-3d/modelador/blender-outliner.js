'use strict';

function blenderBuildOutliner() {
  const side = document.querySelector('.mod3d-paineis');
  const tree = document.querySelector('.mod3d-arvore');
  if (!side || !tree || side.querySelector('.blender-outliner')) return null;
  const region = document.createElement('section');
  region.className = 'blender-outliner';
  const header = document.createElement('div');
  header.className = 'blender-area-header blender-outliner-header';
  header.appendChild(blenderIconSvg('outliner'));
  const name = document.createElement('span');
  name.className = 'blender-editor-name';
  name.textContent = blenderTranslate('Cena');
  header.appendChild(name);
  const body = document.createElement('div');
  body.className = 'blender-outliner-body';
  body.appendChild(tree);
  region.appendChild(header);
  region.appendChild(body);
  side.insertBefore(region, side.firstChild);
  return region;
}
