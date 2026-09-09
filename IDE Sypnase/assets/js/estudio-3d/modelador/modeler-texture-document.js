'use strict';

const MOD3D_TEXTURE_DOCUMENT_LIMIT = 8388608;

function mod3dValidateTextureDocument(textures) {
  if (textures === undefined) return [];
  mod3dSourceAssert(
    Array.isArray(textures) && textures.length <= 200,
    'Invalid source texture overrides',
  );
  const paths = new Set();
  let total = 0;
  let pixels = 0;
  for (const texture of textures) {
    mod3dModelerProjectPath(texture.path);
    mod3dSourceAssert(!paths.has(texture.path), 'Duplicate source texture override');
    paths.add(texture.path);
    const bytes = mod3dSourceFromBase64(texture.data);
    total += bytes.length;
    mod3dSourceAssert(
      total <= MOD3D_TEXTURE_DOCUMENT_LIMIT,
      'Resized textures exceed 8 MiB; reduce their dimensions',
    );
    const image = mod3dGlbImageInfo(bytes);
    mod3dSourceAssert(image.mimeType === 'image/png', 'Source texture override must be PNG');
    pixels += image.width * image.height;
    mod3dSourceAssert(
      image.width <= 4096 && image.height <= 4096 && pixels <= 16777216,
      'Source texture pixel budget exceeded',
    );
  }
  return textures;
}

function mod3dCaptureTextureDocument() {
  if (typeof mod3dTexturas === 'undefined') return [];
  const paths = new Set(
    Array.from(mod3dGrafo.nos.values()).flatMap((node) =>
      (node.materiais || []).flatMap((material) => materialTextureMapPaths(material)),
    ),
  );
  const textures = [];
  for (const path of paths) {
    const entry = mod3dTexturas.cache.get(path);
    if (entry && entry.project === mod3dDestino && entry.modelerOverride) {
      textures.push({ path, data: mod3dSourceBase64(entry.bytes) });
    }
  }
  mod3dValidateTextureDocument(textures);
  return textures;
}

function mod3dRestoreTextureDocument(textures) {
  if (typeof mod3dTexturas === 'undefined') return;
  for (const [path, entry] of mod3dTexturas.cache) {
    if (!entry.modelerOverride) continue;
    if (entry.url) URL.revokeObjectURL(entry.url);
    mod3dTexturas.cache.delete(path);
  }
  for (const texture of textures || []) {
    const entry = mod3dGuardarTexturaNoCache(
      texture.path,
      mod3dSourceFromBase64(texture.data),
      'image/png',
      mod3dDestino,
    );
    entry.modelerOverride = true;
    void mod3dPintarImagemDaTextura(entry);
  }
}
