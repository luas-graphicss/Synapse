'use strict';

const MATERIAL_TEXTURE_MAP_SLOTS = Object.freeze([
    Object.freeze({ key: 'albedo', label: 'Cor base' }),
    Object.freeze({ key: 'metalness', label: 'Metalicidade' }),
    Object.freeze({ key: 'roughness', label: 'Rugosidade' }),
    Object.freeze({ key: 'normal', label: 'Normal' }),
    Object.freeze({ key: 'occlusion', label: 'Oclusão' }),
    Object.freeze({ key: 'emissive', label: 'Emissão' }),
]);

const MATERIAL_TEXTURE_MAP_FIELD_PREFIX = 'textureMap:';

function materialTextureMapKeys() {
  return MATERIAL_TEXTURE_MAP_SLOTS.map((slot) => slot.key);
}

function safeTextureMapPath(value) {
  if (typeof mod3dCaminhoDaTexturaSeguro !== 'function') return '';
  return mod3dCaminhoDaTexturaSeguro(value);
}

function safeMaterialTextureMaps(rawMaps, albedoFallbackPath) {
  const source = rawMaps && typeof rawMaps === 'object' ? rawMaps : {};
  const maps = {};
  materialTextureMapKeys().forEach((key) => {
      maps[key] = safeTextureMapPath(source[key]);
  });
  if (!maps.albedo) maps.albedo = safeTextureMapPath(albedoFallbackPath);
  return maps;
}

function cloneMaterialTextureMaps(maps) {
  return safeMaterialTextureMaps(maps, '');
}

function materialTextureMapPaths(material) {
  const maps = safeMaterialTextureMaps(
    material ? material.textureMaps : null,
    material ? material.textura : '',
  );
  const paths = [];
  materialTextureMapKeys().forEach((key) => {
      const path = maps[key];
      if (path && paths.indexOf(path) < 0) paths.push(path);
  });
  return paths;
}

function materialTextureMapsSignature(maps) {
  return materialTextureMapKeys()
  .map((key) => (maps && maps[key]) || '')
  .join(',');
}

function materialTextureMapFieldName(key) {
  return MATERIAL_TEXTURE_MAP_FIELD_PREFIX + key;
}

function materialTextureMapKeyFromField(field) {
  const name = String(field || '');
  if (name.indexOf(MATERIAL_TEXTURE_MAP_FIELD_PREFIX) !== 0) return '';
  const key = name.slice(MATERIAL_TEXTURE_MAP_FIELD_PREFIX.length);
  return materialTextureMapKeys().indexOf(key) >= 0 ? key : '';
}
