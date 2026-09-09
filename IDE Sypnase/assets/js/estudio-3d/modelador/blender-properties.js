'use strict';

const BLENDER_PROPERTY_TABS = Object.freeze([
    Object.freeze({ key: 'object', label: 'Objeto', marker: '.mod3d-arvore' }),
    Object.freeze({ key: 'mesh', label: 'Malha', marker: '.mod3d-malha-contagem' }),
    Object.freeze({ key: 'material', label: 'Materiais', marker: '.mod3d-fatias' }),
    Object.freeze({ key: 'uv', label: 'UV', marker: '.mod3d-uv-tela' }),
    Object.freeze({ key: 'output', label: 'Export GLB', marker: '.mod3d-glb-export' }),
    Object.freeze({ key: 'project', label: 'Projeto', marker: '.mod3d-project' }),
]);

function blenderFindPanel(marker) {
  const panels = Array.from(document.querySelectorAll('.mod3d-paineis .mod3d-painel'));
  return panels.filter((panel) => panel.matches(marker) || panel.querySelector(marker))[0] || null;
}

function blenderRepaintPropertyTab(key) {
  if (key === 'uv' && typeof mod3dPintarEditorUv === 'function') mod3dPintarEditorUv();
  if (key === 'material' && typeof mod3dPintarPainelDosMateriais === 'function') mod3dPintarPainelDosMateriais();
}

function blenderShowPropertyTab(key) {
  const region = document.querySelector('.blender-properties');
  if (!region) return false;
  Array.from(region.querySelectorAll('.blender-properties-body > [data-blender-tab]')).forEach((panel) => {
      panel.hidden = panel.dataset.blenderTab !== key;
  });
  Array.from(region.querySelectorAll('.blender-properties-tab')).forEach((tab) => {
      const active = tab.dataset.blenderTab === key;
      tab.classList.toggle('on', active);
      tab.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  blenderRepaintPropertyTab(key);
  return true;
}

function blenderBuildProperties() {
  const side = document.querySelector('.mod3d-paineis');
  if (!side || side.querySelector('.blender-properties')) return null;
  const region = document.createElement('section');
  region.className = 'blender-properties';
  const tabs = document.createElement('nav');
  tabs.className = 'blender-properties-tabs';
  const body = document.createElement('div');
  body.className = 'blender-properties-body';
  BLENDER_PROPERTY_TABS.forEach((entry) => {
      const panel = blenderFindPanel(entry.marker);
      if (!panel) return;
      panel.dataset.blenderTab = entry.key;
      body.appendChild(panel);
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'blender-properties-tab';
      tab.dataset.blenderTab = entry.key;
      const label = blenderTranslate(entry.label);
      tab.title = label;
      tab.setAttribute('aria-label', label);
      tab.appendChild(blenderIconSvg(BLENDER_PROPERTY_TAB_ICONS[entry.key]));
      tab.addEventListener('click', () => blenderShowPropertyTab(entry.key));
      tabs.appendChild(tab);
  });
  if (!body.childElementCount) return null;
  region.appendChild(tabs);
  region.appendChild(body);
  side.appendChild(region);
  blenderShowPropertyTab('object');
  return region;
}
