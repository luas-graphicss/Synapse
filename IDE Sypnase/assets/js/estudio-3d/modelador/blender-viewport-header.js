'use strict';

function blenderScenePanelState() {
  if (typeof mod3dPainelDaCena !== 'object' || !mod3dPainelDaCena) return null;
  return mod3dPainelDaCena;
}

function blenderMeshPanelState() {
  if (typeof mod3dPainelDaMalha !== 'object' || !mod3dPainelDaMalha) return null;
  return mod3dPainelDaMalha;
}

function blenderBuildModeGroup(header) {
  const mesh = blenderMeshPanelState();
  if (!mesh) return;
  if (mesh.entrar) {
    const group = blenderHeaderGroup('blender-mode-group');
    group.appendChild(
      blenderWrapWithIcon(mesh.entrar, BLENDER_HEADER_FIELD_ICONS.interactionMode, 'blender-mode-field'),
    );
    header.appendChild(group);
  }
  if (!Array.isArray(mesh.modos) || !mesh.modos.length) return;
  const modes = blenderHeaderGroup('blender-select-mode-group');
  mesh.modos.forEach((mode) => {
      blenderTurnButtonIntoIcon(mode.botao, BLENDER_MESH_MODE_ICONS[mode.chave] || 'vertex');
      modes.appendChild(mode.botao);
  });
  header.appendChild(modes);
}

function blenderBuildTransformGroup(header) {
  const scene = blenderScenePanelState();
  const modes = scene ? scene.modos : null;
  if (!modes) return;
  const group = blenderHeaderGroup('blender-transform-group');
  if (modes.espaco) {
    modes.espaco.classList.add('blender-orientation-button');
    group.appendChild(modes.espaco);
  }
  const snapToggle = modes.ligado ? modes.ligado.closest('.mod3d-check') : null;
  if (snapToggle) {
    snapToggle.classList.add('blender-snap-toggle');
    blenderHideControlText(snapToggle);
    blenderPrependIcon(snapToggle, BLENDER_HEADER_FIELD_ICONS.snapToggle);
    group.appendChild(snapToggle);
  }
  const popover = blenderCreatePopover(
    BLENDER_HEADER_FIELD_ICONS.snapSettings,
    blenderTranslate('Encaixar'),
  );
  [modes.passo, modes.angulo, modes.escala].forEach((field) => {
      const row = field ? field.closest('.mod3d-numero') : null;
      if (row) popover.body.appendChild(row);
  });
  if (popover.body.childElementCount) group.appendChild(popover.anchor);
  if (group.childElementCount) header.appendChild(group);
}

function blenderBuildObjectGroups(header) {
  const scene = blenderScenePanelState();
  const buttons = scene ? scene.botoes : null;
  if (!buttons) return;
  const add = blenderHeaderGroup('blender-add-group');
  if (buttons.tipos) add.appendChild(buttons.tipos);
  if (buttons.adicionar) {
    blenderPrependIcon(buttons.adicionar, BLENDER_HEADER_FIELD_ICONS.addObject);
    add.appendChild(buttons.adicionar);
  }
  if (add.childElementCount) header.appendChild(add);
  const actions = blenderHeaderGroup('blender-object-group');
  Object.keys(BLENDER_OBJECT_ACTION_ICONS).forEach((key) => {
      if (!buttons[key]) return;
      actions.appendChild(blenderTurnButtonIntoIcon(buttons[key], BLENDER_OBJECT_ACTION_ICONS[key]));
  });
  if (actions.childElementCount) header.appendChild(actions);
  const history = blenderHeaderGroup('blender-history-group');
  Object.keys(BLENDER_HISTORY_ACTION_ICONS).forEach((key) => {
      if (!buttons[key]) return;
      history.appendChild(blenderTurnButtonIntoIcon(buttons[key], BLENDER_HISTORY_ACTION_ICONS[key]));
  });
  if (history.childElementCount) header.appendChild(history);
}

function blenderMoveViewGroups(header) {
  const hud = document.querySelector('.mod3d-hud-topo');
  if (!hud) return;
  Array.from(hud.querySelectorAll('.mod3d-hud-grupo')).forEach((source, index) => {
      const group = blenderHeaderGroup(index === 0 ? 'blender-view-group' : 'blender-data-group');
      while (source.firstChild) group.appendChild(source.firstChild);
      if (index > 0) header.appendChild(blenderHeaderSeparator());
      header.appendChild(group);
  });
  hud.remove();
  const units = header.querySelector('.mod3d-viewseletor:not(.mod3d-viewseletor-largo)');
  if (units) blenderWrapWithIcon(units, BLENDER_HEADER_FIELD_ICONS.measureUnit, 'blender-field-with-icon');
  const references = header.querySelector('.mod3d-viewseletor-largo');
  if (references) {
    blenderWrapWithIcon(references, BLENDER_HEADER_FIELD_ICONS.referenceModel, 'blender-field-with-icon');
  }
}

function blenderViewportHudState() {
  if (typeof mod3dCena !== 'object' || !mod3dCena) return null;
  return mod3dCena.hud || null;
}

function blenderFrameSceneButton(header, hud) {
  const viewButtons = hud.vistas ? Array.from(hud.vistas.values()) : [];
  const headerButtons = Array.from(header.querySelectorAll('.blender-view-group .mod3d-viewbotao'));
  return (
    headerButtons.filter(
      (button) =>
      viewButtons.indexOf(button) < 0 && button !== hud.grade2 && button !== hud.projecao,
    )[0] || null
  );
}

function blenderIconifyViewActions(header) {
  const hud = blenderViewportHudState();
  if (!hud) return;
  const frameScene = blenderFrameSceneButton(header, hud);
  if (frameScene) blenderTurnButtonIntoIcon(frameScene, BLENDER_VIEW_ACTION_ICONS.frameScene);
  if (hud.grade2) blenderTurnButtonIntoIcon(hud.grade2, BLENDER_VIEW_ACTION_ICONS.toggleGrid);
  if (hud.carregar) blenderTurnButtonIntoIcon(hud.carregar, BLENDER_VIEW_ACTION_ICONS.loadReference);
  if (hud.limpar) blenderTurnButtonIntoIcon(hud.limpar, BLENDER_VIEW_ACTION_ICONS.clearReference);
}

function blenderBuildViewportHeader() {
  const stage = document.querySelector('.mod3d-palco');
  if (!stage || stage.querySelector('.blender-viewport-header')) return null;
  const header = document.createElement('div');
  header.className = 'blender-area-header blender-viewport-header';
  blenderBuildModeGroup(header);
  header.appendChild(blenderHeaderSeparator());
  blenderBuildTransformGroup(header);
  header.appendChild(blenderHeaderSeparator());
  blenderBuildObjectGroups(header);
  header.appendChild(blenderHeaderSpacer());
  blenderMoveViewGroups(header);
  blenderIconifyViewActions(header);
  stage.insertBefore(header, stage.firstChild);
  return header;
}
