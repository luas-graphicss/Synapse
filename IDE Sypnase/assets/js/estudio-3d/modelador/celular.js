'use strict';

const MOD3D_TOUCH_MAX_WIDTH = 620;
const MOD3D_TOUCH_HANDLE_SCALE = 2.4;
const MOD3D_TOUCH_BODY_CLASS = 'mod3d-movel';
const MOD3D_DRAWER_OPEN_CLASS = 'mod3d-gaveta-aberta';

let mod3dTouchLayout = false;
let mod3dDrawerButton = null;
let mod3dTouchLayerInstalled = false;

function mod3dTouchLayoutActive() {
  try {
    if (window.innerWidth <= MOD3D_TOUCH_MAX_WIDTH) return true;
    if (typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(pointer: coarse)').matches;
  } catch (error) {
    ignorarErro(error, 'mod3dTouchLayoutActive');
    return false;
  }
}

function mod3dTouchHandleScale() {
  return mod3dTouchLayout ? MOD3D_TOUCH_HANDLE_SCALE : 1;
}

function mod3dDrawerIsOpen() {
  return document.body.classList.contains(MOD3D_DRAWER_OPEN_CLASS);
}

function mod3dSetDrawerOpen(open) {
  document.body.classList.toggle(MOD3D_DRAWER_OPEN_CLASS, open);
  if (mod3dDrawerButton) {
    mod3dDrawerButton.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
}

function mod3dToggleDrawer() {
  mod3dSetDrawerOpen(!mod3dDrawerIsOpen());
}

function mod3dMeasureTouchLayout() {
  mod3dTouchLayout = mod3dTouchLayoutActive();
  document.body.classList.toggle(MOD3D_TOUCH_BODY_CLASS, mod3dTouchLayout);
  if (mod3dDrawerButton) mod3dDrawerButton.hidden = !mod3dTouchLayout;
  if (!mod3dTouchLayout) mod3dSetDrawerOpen(false);
}

function mod3dInstallTouchLayer() {
  if (mod3dTouchLayerInstalled) return;
  const topBar = document.querySelector('.mod3d-topo');
  const panels = document.querySelector('.mod3d-paineis');
  if (!topBar || !panels) return;
  mod3dTouchLayerInstalled = true;
  panels.id = 'mod3dPaineis';
  mod3dDrawerButton = mod3dNo('button', 'mod3d-botao mod3d-gaveta-botao');
  mod3dDrawerButton.type = 'button';
  mod3dDrawerButton.textContent = mod3dTexto('Painéis');
  mod3dDrawerButton.setAttribute('aria-controls', panels.id);
  mod3dDrawerButton.setAttribute('aria-expanded', 'false');
  mod3dDrawerButton.addEventListener('click', mod3dToggleDrawer);
  topBar.appendChild(mod3dDrawerButton);
  document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && mod3dDrawerIsOpen()) mod3dSetDrawerOpen(false);
  });
  window.addEventListener('resize', mod3dMeasureTouchLayout);
  mod3dMeasureTouchLayout();
  if (!window.SYNAPSE_I18N || typeof window.SYNAPSE_I18N.on !== 'function') return;
  window.SYNAPSE_I18N.on(() => {
      mod3dDrawerButton.textContent = mod3dTexto('Painéis');
  });
}

if (mod3dPapel() === 'modelador') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mod3dInstallTouchLayer);
  } else {
    mod3dInstallTouchLayer();
  }
}
