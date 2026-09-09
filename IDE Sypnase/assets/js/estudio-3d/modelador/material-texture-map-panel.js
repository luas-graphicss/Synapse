'use strict';

const materialTextureMapPanel = {
  box: null,
  rows: [],
  notice: null,
  signature: '',
};

function materialTextureMapPanelSlots() {
  return MATERIAL_TEXTURE_MAP_SLOTS;
}

function nodeForTextureMapPanel() {
  return mod3dNoDaEdicao() || mod3dNoSelecionado();
}

function applyTextureMapPath(slotKey, path) {
  const node = nodeForTextureMapPanel();
  if (!node) return;
  mod3dDefinirCampoDoMaterial(
    node,
    mod3dMaterialAtivoDoPainel(node),
    materialTextureMapFieldName(slotKey),
    path,
  );
  if (path) {
    mod3dCarregarTextura(path);
    if (typeof mod3dGarantirUvDoNo === 'function') mod3dGarantirUvDoNo(node);
  }
  mod3dPintarPainelDosMateriais();
}

function importTextureMapFile(slotKey, fileInput) {
  const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
  fileInput.value = '';
  if (!file) return;
  importTextureFile(file).then((result) => {
      if (result.error) {
        materialTextureMapPanel.notice.textContent = mod3dTextoDoErroDaTextura(result.error);
        return;
      }
      materialTextureMapPanel.notice.textContent = '';
      applyTextureMapPath(slotKey, result.path);
  });
}

function buildTextureMapRow(slot) {
  const row = mod3dNo('div', 'mod3d-linha mod3d-linha-mapa');
  row.appendChild(mod3dNo('span', 'mod3d-trio-rotulo', mod3dTexto(slot.label)));
  const select = document.createElement('select');
  select.className = 'mod3d-seletor mod3d-seletor-curto';
  select.title = mod3dTexto(slot.label);
  select.addEventListener('change', () => applyTextureMapPath(slot.key, select.value));
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = IMPORTED_TEXTURE_ACCEPT;
  fileInput.hidden = true;
  fileInput.addEventListener('change', () => importTextureMapFile(slot.key, fileInput));
  const importButton = mod3dPainelBotao('Importar', 'Carrega uma imagem do computador neste mapa');
  importButton.addEventListener('click', () => fileInput.click());
  row.appendChild(select);
  row.appendChild(importButton);
  row.appendChild(fileInput);
  return { slot, row, select, importButton, fileInput };
}

function buildMaterialTextureMapPanel() {
  const box = mod3dNo('div', 'mod3d-textura mod3d-textura-mapas');
  box.appendChild(mod3dNo('span', 'mod3d-trio-rotulo', mod3dTexto('Mapas PBR')));
  const rows = materialTextureMapPanelSlots().map((slot) => buildTextureMapRow(slot));
  rows.forEach((row) => box.appendChild(row.row));
  const notice = mod3dNo('p', 'mod3d-malha-recado', '');
  box.appendChild(notice);
  materialTextureMapPanel.box = box;
  materialTextureMapPanel.rows = rows;
  materialTextureMapPanel.notice = notice;
  materialTextureMapPanel.signature = '';
  return box;
}

function paintMaterialTextureMapPanel(material) {
  const panel = materialTextureMapPanel;
  if (!panel.box) return;
  if (!material) {
    panel.box.classList.remove('on');
    panel.rows.forEach((row) => {
        row.select.disabled = true;
        row.importButton.disabled = true;
    });
    panel.signature = '';
    return;
  }
  panel.box.classList.add('on');
  const maps = safeMaterialTextureMaps(material.textureMaps, material.textura);
  const signature = [
    materialTextureMapsSignature(maps),
    mod3dTexturas.lista.length,
    mod3dTexturasVersao(),
  ].join('|');
  if (signature === panel.signature) return;
  panel.signature = signature;
  panel.rows.forEach((row) => {
      row.select.disabled = false;
      row.importButton.disabled = false;
      mod3dPintarOpcoesDasTexturas(row.select, maps[row.slot.key]);
  });
}
