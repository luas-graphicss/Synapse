'use strict';

function mod3dGlbTexturePath(value) {
  const path = String(value || '');
  if (
    !path ||
    path.length > 400 ||
    /[\u0000-\u001f\\:?#]/.test(path) ||
    path.startsWith('/') ||
    path.split('/').some((part) => !part || part === '.' || part === '..')
  ) {
    throw new Error('Texture must be a relative project file');
  }
  return path;
}

function mod3dGlbPngChecksum(bytes, start, end) {
  let checksum = 0xffffffff;
  for (let offset = start; offset < end; offset++) {
    checksum ^= bytes[offset];
    for (let bit = 0; bit < 8; bit++) checksum = (checksum >>> 1) ^ (checksum & 1 ? 0xedb88320 : 0);
  }
  return (checksum ^ 0xffffffff) >>> 0;
}

function mod3dGlbImageInfo(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 12) {
    throw new Error('Missing or invalid texture bytes');
  }
  if (bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) {
    if (
      bytes.length < 45 ||
      bytes[4] !== 13 ||
      bytes[5] !== 10 ||
      bytes[6] !== 26 ||
      bytes[7] !== 10
    ) {
      throw new Error('Invalid PNG texture');
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(8) !== 13 || view.getUint32(12) !== 0x49484452) {
      throw new Error('Invalid PNG header');
    }
    const width = view.getUint32(16);
    const height = view.getUint32(20);
    let offset = 8;
    let hasPixels = false;
    let complete = false;
    while (offset + 12 <= bytes.length) {
      const length = view.getUint32(offset);
      const type = view.getUint32(offset + 4);
      if (offset + length + 12 > bytes.length) throw new Error('Truncated PNG texture');
      if (
        mod3dGlbPngChecksum(bytes, offset + 4, offset + 8 + length) !==
        view.getUint32(offset + 8 + length)
      ) {
        throw new Error('Invalid PNG checksum');
      }
      if (type === 0x49444154) hasPixels = true;
      if (type === 0x49454e44) {
        complete = length === 0 && offset + 12 === bytes.length;
        break;
      }
      offset += length + 12;
    }
    if (!width || !height || !hasPixels || !complete) throw new Error('Incomplete PNG texture');
    return { mimeType: 'image/png', width, height };
  }
  if (
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[bytes.length - 2] === 255 &&
    bytes[bytes.length - 1] === 217
  ) {
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset++] !== 255) throw new Error('Invalid JPEG marker');
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      const length = bytes[offset] * 256 + bytes[offset + 1];
      if (length < 2 || offset + length > bytes.length) throw new Error('Truncated JPEG texture');
      if ([0xc0, 0xc1, 0xc2].includes(marker) && length >= 8) {
        const width = bytes[offset + 5] * 256 + bytes[offset + 6];
        const height = bytes[offset + 3] * 256 + bytes[offset + 4];
        if (!width || !height) throw new Error('Invalid JPEG dimensions');
        return { mimeType: 'image/jpeg', width, height };
      }
      offset += length;
    }
    throw new Error('Unsupported JPEG texture');
  }
  throw new Error('Portable glTF textures require PNG or JPEG');
}

function mod3dGlbTextureRequests(scene) {
  const requests = new Map();
  for (const node of scene.nodes) {
    if (!node.mesh) continue;
    for (const group of mod3dValidateExportGroups(node.mesh, node.materials.length)) {
      const material = node.materials[group.material];
      if (!material.textura) continue;
      const path = mod3dGlbTexturePath(material.textura);
      const embed =
      scene.settings.textureMode === 'embed' ||
      (scene.settings.textureMode === 'material' && material.embutir !== false);
      const previous = requests.get(path);
      requests.set(path, {
          path,
          embed: embed || Boolean(previous && previous.embed),
          reference: !embed || Boolean(previous && previous.reference),
      });
    }
  }
  return Array.from(requests.values());
}

async function mod3dConvertGlbTextureToPng(bytes) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'image/webp' }));
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error('Texture could not be decoded'));
        image.src = url;
    });
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth * image.naturalHeight > 16777216
    ) {
      throw new Error('Texture exceeds the conversion memory limit');
    }
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Texture conversion is unavailable');
    context.drawImage(image, 0, 0);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    canvas.width = 1;
    canvas.height = 1;
    if (!blob) throw new Error('Texture conversion failed');
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function mod3dPrepareGlbTextures(scene, project, channel, frozenCache) {
  const resources = new Map();
  const cache = frozenCache || new Map(mod3dTexturas.cache);
  for (const request of mod3dGlbTextureRequests(scene)) {
    if (request.reference && !/\.(png|jpe?g|jfif)$/i.test(request.path)) {
      throw new Error('Referenced textures must be PNG or JPEG');
    }
    if (!request.embed) continue;
    const cached = cache.get(request.path);
    let bytes = cached && cached.project === project ? cached.bytes : null;
    if (!bytes) {
      const result = await mod3dPedirTexturaDoProjeto(channel, {
          projeto: project,
          caminho: request.path,
      });
      if (!result || result.erro || !result.bytes) {
        throw new Error(`Texture unavailable: ${request.path}`);
      }
      bytes = result.bytes;
    }
    const isWebp =
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP';
    if (isWebp) bytes = await mod3dConvertGlbTextureToPng(bytes);
    const info = mod3dGlbImageInfo(bytes);
    resources.set(request.path, { bytes, ...info });
  }
  return resources;
}
