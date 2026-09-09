'use strict';

function mod3dValidateGlbAppearance(json, bin, project) {
  mod3dAssertGlb(Array.isArray(json.materials) && json.materials.length > 0, 'missing materials');
  const images = json.images === undefined ? [] : json.images;
  const textures = json.textures === undefined ? [] : json.textures;
  const samplers = json.samplers === undefined ? [] : json.samplers;
  mod3dAssertGlb(
    Array.isArray(images) && Array.isArray(textures) && Array.isArray(samplers),
    'texture tables',
  );
  const imageInfo = images.map((image) => {
      let bytes;
      if (image.uri !== undefined) {
        mod3dAssertGlb(
          typeof image.uri === 'string' && image.bufferView === undefined,
          'ambiguous image storage',
        );
        const path = mod3dGlbTexturePath(decodeURIComponent(image.uri));
        const file = project && project.files && project.files.get(path);
        mod3dAssertGlb(Boolean(file), `referenced texture missing: ${path}`);
        bytes = fileBytes(file);
      } else {
        const view = mod3dGlbReference(json.bufferViews, image.bufferView, 'image bufferView');
        mod3dAssertGlb(
          view.target === undefined && view.byteStride === undefined,
          'image bufferView layout',
        );
        bytes = bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
      }
      const info = mod3dGlbImageInfo(bytes);
      if (image.uri === undefined)
      mod3dAssertGlb(image.mimeType === info.mimeType, 'image MIME does not match bytes');
      return { ...info, bytes: bytes.length, external: image.uri !== undefined };
  });
  for (const sampler of samplers) {
    mod3dAssertGlb(
      sampler.magFilter === undefined || [9728, 9729].includes(sampler.magFilter),
      'magnification filter',
    );
    mod3dAssertGlb(
      sampler.minFilter === undefined ||
      [9728, 9729, 9984, 9985, 9986, 9987].includes(sampler.minFilter),
      'minification filter',
    );
    for (const property of ['wrapS', 'wrapT'])
    mod3dAssertGlb(
      sampler[property] === undefined || [33071, 33648, 10497].includes(sampler[property]),
      'texture wrapping',
    );
  }
  for (const texture of textures) {
    mod3dGlbReference(images, texture.source, 'texture image');
    if (texture.sampler !== undefined)
    mod3dGlbReference(samplers, texture.sampler, 'texture sampler');
    mod3dAssertGlb(texture.extensions === undefined, 'unsupported texture extension');
  }
  const materialTextures = new Map();
  json.materials.forEach((material, index) => {
      mod3dAssertGlb(
        material && typeof material === 'object' && material.extensions === undefined,
        'unsupported material',
      );
      const pbr = material.pbrMetallicRoughness;
      mod3dAssertGlb(pbr && typeof pbr === 'object', 'missing metallic-roughness material');
      const base = mod3dGlbVector(
        pbr.baseColorFactor === undefined ? [1, 1, 1, 1] : pbr.baseColorFactor,
        4,
        'base color factor',
      );
      mod3dAssertGlb(
        base.every((value) => value >= 0 && value <= 1),
        'base color range',
      );
      for (const property of ['metallicFactor', 'roughnessFactor']) {
        const value = pbr[property] === undefined ? 1 : pbr[property];
        mod3dAssertGlb(Number.isFinite(value) && value >= 0 && value <= 1, property);
      }
      const emission = mod3dGlbVector(
        material.emissiveFactor === undefined ? [0, 0, 0] : material.emissiveFactor,
        3,
        'emissive factor',
      );
      mod3dAssertGlb(
        emission.every((value) => value >= 0 && value <= 1),
        'emissive range',
      );
      mod3dAssertGlb(
        material.alphaMode === undefined || ['OPAQUE', 'MASK', 'BLEND'].includes(material.alphaMode),
        'alpha mode',
      );
      if (material.alphaCutoff !== undefined)
      mod3dAssertGlb(
        Number.isFinite(material.alphaCutoff) && material.alphaCutoff >= 0,
        'alpha cutoff',
      );
      mod3dAssertGlb(
        material.doubleSided === undefined || typeof material.doubleSided === 'boolean',
        'double-sided flag',
      );
      mod3dAssertGlb(
        pbr.metallicRoughnessTexture === undefined &&
        material.normalTexture === undefined &&
        material.occlusionTexture === undefined &&
        material.emissiveTexture === undefined,
        'unsupported material texture slot',
      );
      if (pbr.baseColorTexture !== undefined) {
        mod3dGlbReference(textures, pbr.baseColorTexture.index, 'base color texture');
        mod3dAssertGlb(
          pbr.baseColorTexture.texCoord === undefined || pbr.baseColorTexture.texCoord === 0,
          'texture coordinate set',
        );
        materialTextures.set(index, pbr.baseColorTexture.index);
      }
  });
  for (const mesh of json.meshes) {
    for (const primitive of mesh.primitives) {
      if (materialTextures.has(primitive.material))
      mod3dAssertGlb(
        primitive.attributes.TEXCOORD_0 !== undefined,
        'textured primitive has no UV coordinates',
      );
    }
  }
  return imageInfo;
}
