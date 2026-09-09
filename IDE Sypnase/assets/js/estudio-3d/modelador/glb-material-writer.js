'use strict';

function mod3dCreateGlbMaterialWriter(binary, resources, textureMode) {
  const materials = [];
  const images = [];
  const textures = [];
  const materialIndices = new Map();
  const textureIndices = new Map();
  const dependencies = [];

  function registerTexture(material) {
    if (!material.textura) return -1;
    const path = mod3dGlbTexturePath(material.textura);
    const embed =
    textureMode === 'embed' || (textureMode === 'material' && material.embutir !== false);
    const key = `${embed ? 'embedded' : 'referenced'}:${path}`;
    if (textureIndices.has(key)) return textureIndices.get(key);
    const image = { name: path };
    if (embed) {
      const resource = resources && resources.get(path);
      const bytes = resource ? resource.bytes : mod3dBytesDaTextura(path);
      const info = mod3dGlbImageInfo(bytes);
      image.bufferView = binary.appendBytes(bytes);
      image.mimeType = info.mimeType;
    } else {
      if (!/\.(png|jpe?g|jfif)$/i.test(path))
      throw new Error('Referenced textures must be PNG or JPEG');
      image.uri = path.split('/').map(encodeURIComponent).join('/');
      dependencies.push(path);
    }
    const index = textures.length;
    images.push(image);
    textures.push({ source: images.length - 1, sampler: 0 });
    textureIndices.set(key, index);
    return index;
  }

  function registerMaterial(material) {
    const textureIndex = registerTexture(material);
    const output = mod3dMaterialGltf(material, textureIndex);
    const key = JSON.stringify(output);
    if (materialIndices.has(key)) return materialIndices.get(key);
    const index = materials.length;
    materials.push(output);
    materialIndices.set(key, index);
    return index;
  }

  return { registerMaterial, materials, images, textures, dependencies };
}
