'use strict';

const IMPORTED_TEXTURE_FOLDER = 'texturas-do-modelador';
const IMPORTED_TEXTURE_MAX_FILE_BYTES = 25165824;
const IMPORTED_TEXTURE_ACCEPT = 'image/png,image/jpeg,image/webp';

function importedTextureFileName(rawName) {
  const lastPart = String(rawName || '').split(/[\\/]/).pop();
  const cleanName = lastPart.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^[-.]+/, '');
  const withoutExtension = cleanName.replace(/\.[a-zA-Z0-9]+$/, '');
  const baseName = withoutExtension.slice(0, 60) || 'textura';
  return baseName + '.png';
}

function importedTexturePath(rawName) {
  return IMPORTED_TEXTURE_FOLDER + '/' + importedTextureFileName(rawName);
}

function rememberImportedTextureInList(path, byteLength) {
  const others = mod3dTexturas.lista.filter((item) => item.caminho !== path);
  mod3dTexturas.lista = others.concat([{ caminho: path, bytes: byteLength }]);
}

async function importTextureFile(file) {
  if (!file) return { error: 'sem-arquivo' };
  if (file.size > IMPORTED_TEXTURE_MAX_FILE_BYTES) return { error: 'grande-demais' };
  let bytes = null;
  try {
    bytes = await imageFileToPngBytes(file);
  } catch (erro) {
    ignorarErro(erro, 'importTextureFile');
    return { error: 'leitura' };
  }
  if (!bytes || !bytes.length) return { error: 'leitura' };
  const path = importedTexturePath(file.name);
  const entry = mod3dGuardarTexturaNoCache(path, bytes, 'image/png');
  entry.modelerOverride = true;
  await mod3dPintarImagemDaTextura(entry);
  if (!entry.imagem) return { error: 'falha' };
  rememberImportedTextureInList(path, bytes.length);
  if (typeof mod3dProjectDocument !== 'undefined' && mod3dProjectDocument) {
    mod3dProjectDocument.changed();
  }
  mod3dTexturas.recado = '';
  mod3dTexturasTocar();
  return { path };
}
