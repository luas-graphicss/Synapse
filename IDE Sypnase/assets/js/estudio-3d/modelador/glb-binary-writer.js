'use strict';

const MOD3D_GLB_MAX_BYTES = 50 * 1024 * 1024;
const MOD3D_GLB_COMPONENTS = Object.freeze({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 });

function mod3dCreateGlbBinaryWriter() {
  const chunks = [];
  const bufferViews = [];
  const accessors = [];
  let byteLength = 0;

  function appendBytes(bytes, target) {
    const byteOffset = Math.ceil(byteLength / 4) * 4;
    if (!bytes.length || byteOffset + bytes.length > MOD3D_GLB_MAX_BYTES) {
      throw new Error('Export buffer exceeds the Studio limit');
    }
    const view = { buffer: 0, byteOffset, byteLength: bytes.length };
    if (target) view.target = target;
    const index = bufferViews.length;
    bufferViews.push(view);
    chunks.push({ byteOffset, bytes });
    byteLength = byteOffset + bytes.length;
    return index;
  }

  function appendAccessor(values, type, componentType, bounds) {
    const components = MOD3D_GLB_COMPONENTS[type];
    const componentBytes = componentType === 5123 ? 2 : 4;
    if (!components || !values.length || values.length % components !== 0) {
      throw new Error('Invalid export attribute length');
    }
    const bytes = new Uint8Array(values.length * componentBytes);
    const data = new DataView(bytes.buffer);
    for (let index = 0; index < values.length; index++) {
      const value = values[index];
      if (!Number.isFinite(value)) throw new Error('Non-finite export attribute');
      const offset = index * componentBytes;
      if (componentType === 5126) data.setFloat32(offset, value, true);
      else if (componentType === 5123) data.setUint16(offset, value, true);
      else if (componentType === 5125) data.setUint32(offset, value, true);
      else throw new Error('Unsupported export component type');
    }
    const accessor = {
      bufferView: appendBytes(bytes, type === 'SCALAR' ? 34963 : 34962),
      componentType,
      count: values.length / components,
      type,
    };
    if (bounds) {
      accessor.min = bounds.min.slice();
      accessor.max = bounds.max.slice();
    }
    accessors.push(accessor);
    return accessors.length - 1;
  }

  function finish() {
    const binary = new Uint8Array(byteLength);
    for (const chunk of chunks) binary.set(chunk.bytes, chunk.byteOffset);
    chunks.length = 0;
    return binary;
  }

  return { appendBytes, appendAccessor, finish, bufferViews, accessors };
}
