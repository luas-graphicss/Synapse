'use strict';

const MOD3D_KEYMAP_STORAGE_KEY = 'synapse:modelador3d:keymap';
const MOD3D_KEYMAP_DEFAULT = 'synapse';
const MOD3D_KEYMAP_OPTIONS = Object.freeze([
    Object.freeze({ name: 'synapse', label: 'Padrão do Synapse' }),
    Object.freeze({ name: 'blender', label: 'Estilo Blender' }),
]);
const MOD3D_SHORTCUT_TRANSFORM_MODES = Object.freeze({
    move: 'mover',
    rotate: 'girar',
    scale: 'escalar',
});
const MOD3D_SHORTCUT_VIEWS = Object.freeze({
    viewFront: 'frente',
    viewSide: 'lado',
    viewTop: 'topo',
    viewFree: 'livre',
});
const MOD3D_SHORTCUT_LABELS = Object.freeze({
    move: 'Mover a seleção',
    rotate: 'Girar a seleção',
    scale: 'Escalar a seleção',
    frameScene: 'Enquadrar a cena',
    toggleGrid: 'Ligar ou desligar a grade',
    viewFront: 'Vista frente',
    viewSide: 'Vista lado',
    viewTop: 'Vista topo',
    viewFree: 'Vista livre',
    toggleProjection: 'Alternar perspectiva e ortográfica',
    toggleEditMode: 'Entrar ou sair do modo de edição',
    duplicateSelection: 'Duplicar a seleção',
    deleteSelection: 'Apagar a seleção',
    undo: 'Desfazer',
    redo: 'Refazer',
    shortcutSheet: 'Abrir a folha de atalhos',
});
const MOD3D_SHORTCUT_ORDER = Object.freeze([
    'move',
    'rotate',
    'scale',
    'frameScene',
    'toggleGrid',
    'viewFront',
    'viewSide',
    'viewTop',
    'viewFree',
    'toggleProjection',
    'toggleEditMode',
    'duplicateSelection',
    'deleteSelection',
    'undo',
    'redo',
    'shortcutSheet',
]);
const MOD3D_EDIT_MODE_SHORTCUTS = Object.freeze(['toggleEditMode', 'shortcutSheet']);
const MOD3D_KEYMAPS = Object.freeze({
    synapse: Object.freeze([
        Object.freeze({ key: 'w', action: 'move' }),
        Object.freeze({ key: 'e', action: 'rotate' }),
        Object.freeze({ key: 'r', action: 'scale' }),
        Object.freeze({ key: 'f', action: 'frameScene' }),
        Object.freeze({ key: 'g', action: 'toggleGrid' }),
        Object.freeze({ key: '1', action: 'viewFront' }),
        Object.freeze({ key: '3', action: 'viewSide' }),
        Object.freeze({ key: '7', action: 'viewTop' }),
        Object.freeze({ key: '0', action: 'viewFree' }),
        Object.freeze({ key: '5', action: 'toggleProjection' }),
        Object.freeze({ key: 'alt+e', action: 'toggleEditMode' }),
        Object.freeze({ key: 'ctrl+d', action: 'duplicateSelection' }),
        Object.freeze({ key: 'delete', action: 'deleteSelection' }),
        Object.freeze({ key: 'ctrl+z', action: 'undo' }),
        Object.freeze({ key: 'ctrl+shift+z', action: 'redo' }),
        Object.freeze({ key: 'shift+/', action: 'shortcutSheet' }),
    ]),
    blender: Object.freeze([
        Object.freeze({ key: 'g', action: 'move' }),
        Object.freeze({ key: 'r', action: 'rotate' }),
        Object.freeze({ key: 's', action: 'scale' }),
        Object.freeze({ key: 'shift+c', action: 'frameScene' }),
        Object.freeze({ key: 'shift+g', action: 'toggleGrid' }),
        Object.freeze({ key: '1', action: 'viewFront' }),
        Object.freeze({ key: '3', action: 'viewSide' }),
        Object.freeze({ key: '7', action: 'viewTop' }),
        Object.freeze({ key: '0', action: 'viewFree' }),
        Object.freeze({ key: '5', action: 'toggleProjection' }),
        Object.freeze({ key: 'alt+e', action: 'toggleEditMode' }),
        Object.freeze({ key: 'shift+d', action: 'duplicateSelection' }),
        Object.freeze({ key: 'x', action: 'deleteSelection' }),
        Object.freeze({ key: 'ctrl+z', action: 'undo' }),
        Object.freeze({ key: 'ctrl+shift+z', action: 'redo' }),
        Object.freeze({ key: 'shift+/', action: 'shortcutSheet' }),
    ]),
});
const MOD3D_KEY_LABELS = Object.freeze({
    ctrl: 'Ctrl',
    alt: 'Alt',
    shift: 'Shift',
    delete: 'Delete',
});

let mod3dKeymapName = '';
let mod3dShortcutSheet = null;
let mod3dShortcutOpener = null;
let mod3dShortcutsInstalled = false;

function mod3dReadKeymapName() {
  if (mod3dKeymapName) return mod3dKeymapName;
  const saved = mod3dLerLocal(MOD3D_KEYMAP_STORAGE_KEY);
  mod3dKeymapName = MOD3D_KEYMAPS[saved] ? saved : MOD3D_KEYMAP_DEFAULT;
  return mod3dKeymapName;
}

function mod3dShortcutBindings() {
  return MOD3D_KEYMAPS[mod3dReadKeymapName()];
}

function mod3dChooseKeymap(name) {
  if (!MOD3D_KEYMAPS[name] || name === mod3dReadKeymapName()) return;
  mod3dKeymapName = name;
  mod3dGravarLocal(MOD3D_KEYMAP_STORAGE_KEY, name);
  mod3dPaintShortcutSheet();
}

function mod3dShortcutActionForKey(key) {
  const binding = mod3dShortcutBindings().find((item) => item.key === key);
  return binding ? binding.action : '';
}

function mod3dShortcutKeysForAction(action) {
  return mod3dShortcutBindings()
  .filter((binding) => binding.action === action)
  .map((binding) => mod3dShortcutKeyLabel(binding.key))
  .join(' · ');
}

function mod3dShortcutKeyLabel(key) {
  return key
  .split('+')
  .map((part) => MOD3D_KEY_LABELS[part] || part.toUpperCase())
  .join(' + ');
}

function mod3dShortcutKeyName(event) {
  const key = String(event.key || '').toLowerCase();
  if (!key || key === 'shift' || key === 'control' || key === 'alt' || key === 'meta') return '';
  const parts = [];
  if (event.ctrlKey || event.metaKey) parts.push('ctrl');
  if (event.altKey) parts.push('alt');
  if (event.shiftKey) parts.push('shift');
  if (key === '?') parts.push('/');
  else if (key === 'backspace') parts.push('delete');
  else parts.push(key);
  return parts.join('+');
}

function mod3dShortcutAllowsTarget(target) {
  if (!target || typeof target.closest !== 'function') return true;
  if (target.isContentEditable) return false;
  return !target.closest('input, select, textarea');
}

function mod3dRunShortcutAction(action) {
  if (action === 'shortcutSheet') {
    mod3dToggleShortcutSheet();
    return true;
  }
  if (!mod3dCena.camera) return false;
  if (MOD3D_SHORTCUT_TRANSFORM_MODES[action]) {
    mod3dDefinirModo(MOD3D_SHORTCUT_TRANSFORM_MODES[action]);
    mod3dCenaTocar();
  } else if (MOD3D_SHORTCUT_VIEWS[action]) {
    mod3dTrocarVista(MOD3D_SHORTCUT_VIEWS[action]);
  } else if (action === 'frameScene') {
    mod3dEnquadrarCena();
  } else if (action === 'toggleGrid') {
    mod3dAlternarGrade();
  } else if (action === 'toggleProjection') {
    mod3dCena.camera.alternarProjecao();
  } else if (action === 'toggleEditMode') {
    mod3dAlternarEdicao();
  } else if (action === 'duplicateSelection') {
    mod3dDuplicarSelecao();
  } else if (action === 'deleteSelection') {
    mod3dApagarSelecao();
  } else if (action === 'undo') {
    mod3dDesfazer();
  } else if (action === 'redo') {
    mod3dRefazer();
  } else {
    return false;
  }
  mod3dMarcarSujo();
  mod3dPintarHud();
  return true;
}

function mod3dPaintShortcutSheet() {
  if (!mod3dShortcutSheet) return;
  const sheet = mod3dShortcutSheet;
  sheet.title.textContent = mod3dTexto('Atalhos do teclado');
  sheet.dialog.setAttribute('aria-label', mod3dTexto('Atalhos do teclado'));
  sheet.closeButton.textContent = mod3dTexto('Fechar');
  sheet.keymapLabel.textContent = mod3dTexto('Mapa de teclas');
  sheet.note.textContent = mod3dTexto('No modo de edição valem os atalhos da malha.');
  Array.from(sheet.keymapSelect.options).forEach((option, index) => {
      option.textContent = mod3dTexto(MOD3D_KEYMAP_OPTIONS[index].label);
  });
  sheet.keymapSelect.value = mod3dReadKeymapName();
  sheet.list.textContent = '';
  MOD3D_SHORTCUT_ORDER.forEach((action) => {
      const keys = mod3dShortcutKeysForAction(action);
      if (!keys) return;
      const row = mod3dNo('div', 'mod3d-atalho-linha');
      row.appendChild(mod3dNo('span', 'mod3d-atalho-acao', mod3dTexto(MOD3D_SHORTCUT_LABELS[action])));
      row.appendChild(mod3dNo('kbd', 'mod3d-atalho-tecla', keys));
      sheet.list.appendChild(row);
  });
}

function mod3dBuildShortcutSheet() {
  const overlay = mod3dNo('div', 'mod3d-atalhos-fundo');
  const dialog = mod3dNo('section', 'mod3d-atalhos');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.tabIndex = -1;

  const header = mod3dNo('header', 'mod3d-atalhos-topo');
  const title = mod3dNo('h2', 'mod3d-atalhos-titulo');
  const closeButton = mod3dNo('button', 'mod3d-botao');
  closeButton.type = 'button';
  closeButton.addEventListener('click', mod3dCloseShortcutSheet);
  header.append(title, closeButton);

  const keymapRow = mod3dNo('div', 'mod3d-atalhos-mapa');
  const keymapLabel = mod3dNo('label', 'mod3d-rotulo');
  keymapLabel.setAttribute('for', 'mod3dMapaDeTeclas');
  const keymapSelect = document.createElement('select');
  keymapSelect.id = 'mod3dMapaDeTeclas';
  keymapSelect.className = 'mod3d-seletor';
  MOD3D_KEYMAP_OPTIONS.forEach((choice) => {
      const option = document.createElement('option');
      option.value = choice.name;
      keymapSelect.appendChild(option);
  });
  keymapSelect.addEventListener('change', () => mod3dChooseKeymap(keymapSelect.value));
  keymapRow.append(keymapLabel, keymapSelect);

  const list = mod3dNo('div', 'mod3d-atalhos-lista');
  const note = mod3dNo('p', 'mod3d-atalhos-aviso');
  dialog.append(header, keymapRow, list, note);
  overlay.appendChild(dialog);
  overlay.addEventListener('click', (event) => {
      if (event.target === overlay) mod3dCloseShortcutSheet();
  });
  dialog.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      mod3dCloseShortcutSheet();
      event.stopPropagation();
  });
  return { overlay, dialog, title, closeButton, keymapLabel, keymapSelect, list, note };
}

function mod3dOpenShortcutSheet() {
  if (mod3dShortcutSheet) return;
  mod3dShortcutOpener = document.activeElement;
  mod3dShortcutSheet = mod3dBuildShortcutSheet();
  document.body.appendChild(mod3dShortcutSheet.overlay);
  mod3dPaintShortcutSheet();
  mod3dShortcutSheet.dialog.focus();
}

function mod3dCloseShortcutSheet() {
  if (!mod3dShortcutSheet) return;
  mod3dShortcutSheet.overlay.remove();
  mod3dShortcutSheet = null;
  if (mod3dShortcutOpener && typeof mod3dShortcutOpener.focus === 'function') {
    mod3dShortcutOpener.focus();
  }
  mod3dShortcutOpener = null;
}

function mod3dToggleShortcutSheet() {
  if (mod3dShortcutSheet) mod3dCloseShortcutSheet();
  else mod3dOpenShortcutSheet();
}

function mod3dHandleShortcutKey(event) {
  if (event.defaultPrevented) return;
  if (
    typeof blenderInteractionOwnsKeyboard === 'function' &&
    blenderInteractionOwnsKeyboard(event)
  ) {
    return;
  }
  if (!mod3dShortcutAllowsTarget(event.target)) return;
  const key = mod3dShortcutKeyName(event);
  if (!key) return;
  const action = mod3dShortcutActionForKey(key);
  if (!action) return;
  if (mod3dShortcutSheet && action !== 'shortcutSheet') return;
  if (mod3dEdicaoAtiva() && MOD3D_EDIT_MODE_SHORTCUTS.indexOf(action) === -1) return;
  if (!mod3dRunShortcutAction(action)) return;
  event.preventDefault();
  event.stopPropagation();
}

function mod3dInstallShortcuts() {
  if (mod3dShortcutsInstalled) return;
  mod3dShortcutsInstalled = true;
  document.addEventListener('keydown', mod3dHandleShortcutKey, true);
  const topBar = document.querySelector('.mod3d-topo');
  if (!topBar) return;
  const button = mod3dNo('button', 'mod3d-botao mod3d-atalhos-botao');
  button.type = 'button';
  mod3dPaintShortcutButton(button);
  button.addEventListener('click', mod3dToggleShortcutSheet);
  topBar.appendChild(button);
  if (!window.SYNAPSE_I18N || typeof window.SYNAPSE_I18N.on !== 'function') return;
  window.SYNAPSE_I18N.on(() => {
      mod3dPaintShortcutButton(button);
      mod3dPaintShortcutSheet();
  });
}

function mod3dPaintShortcutButton(button) {
  button.textContent = mod3dTexto('Atalhos');
  button.title = mod3dTexto('Atalhos do teclado');
  button.setAttribute('aria-label', mod3dTexto('Atalhos do teclado'));
}

if (mod3dPapel() === 'modelador') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mod3dInstallShortcuts);
  } else {
    mod3dInstallShortcuts();
  }
}
