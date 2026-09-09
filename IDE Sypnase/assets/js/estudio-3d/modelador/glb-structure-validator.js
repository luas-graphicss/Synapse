'use strict';

function mod3dAssertGlb(condition, message) {
  if (!condition) throw new Error(`Invalid GLB: ${message}`);
}

function mod3dGlbInteger(value, minimum) {
  return Number.isSafeInteger(value) && value >= minimum;
}

function mod3dGlbReference(items, index, label) {
  mod3dAssertGlb(
    Array.isArray(items) && mod3dGlbInteger(index, 0) && index < items.length,
    `${label} reference`,
  );
  return items[index];
}

function mod3dGlbVector(value, length, label) {
  mod3dAssertGlb(
    Array.isArray(value) && value.length === length && value.every(Number.isFinite),
    label,
  );
  return value;
}

function mod3dGlbNear(actual, expected, relativeTolerance) {
  return (
    Number.isFinite(actual) &&
    Number.isFinite(expected) &&
    Math.abs(actual - expected) <=
    (relativeTolerance || 0.00002) * Math.max(0.0001, Math.abs(actual), Math.abs(expected))
  );
}

function mod3dReadStrictGlb(bytes) {
  mod3dAssertGlb(
    bytes instanceof Uint8Array && bytes.length >= 28 && bytes.length <= MOD3D_GLB_MAX_BYTES,
    'file size',
  );
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  mod3dAssertGlb(
    view.getUint32(0, true) === 0x46546c67 && view.getUint32(4, true) === 2,
    'header or version',
  );
  mod3dAssertGlb(view.getUint32(8, true) === bytes.length, 'declared length');
  let offset = 12;
  let chunkIndex = 0;
  while (offset < bytes.length) {
    mod3dAssertGlb(offset + 8 <= bytes.length, 'truncated chunk header');
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    mod3dAssertGlb(
      length > 0 && length % 4 === 0 && offset + length + 8 <= bytes.length,
      'chunk alignment or range',
    );
    mod3dAssertGlb(
      type === (chunkIndex === 0 ? 0x4e4f534a : 0x004e4942) && chunkIndex < 2,
      'chunk order',
    );
    offset += length + 8;
    chunkIndex++;
  }
  mod3dAssertGlb(chunkIndex === 2, 'missing binary chunk');
  const parts = est3dGlbParts(bytes);
  mod3dAssertGlb(
    parts.json && parts.json.asset && parts.json.asset.version === '2.0',
    'asset version',
  );
  return parts;
}

function mod3dValidateGlbAccessors(json, bin) {
  mod3dAssertGlb(
    Array.isArray(json.buffers) && json.buffers.length === 1,
    'one internal buffer required',
  );
  const buffer = json.buffers[0];
  mod3dAssertGlb(
    buffer.uri === undefined &&
    mod3dGlbInteger(buffer.byteLength, 1) &&
    buffer.byteLength <= bin.length &&
    bin.length - buffer.byteLength <= 3,
    'binary buffer length',
  );
  for (let index = buffer.byteLength; index < bin.length; index++)
  mod3dAssertGlb(bin[index] === 0, 'binary padding');
  mod3dAssertGlb(
    Array.isArray(json.bufferViews) && Array.isArray(json.accessors),
    'missing accessors',
  );
  for (const view of json.bufferViews) {
    const offset = view.byteOffset === undefined ? 0 : view.byteOffset;
    mod3dAssertGlb(
      view.buffer === 0 &&
      mod3dGlbInteger(offset, 0) &&
      offset % 4 === 0 &&
      mod3dGlbInteger(view.byteLength, 1) &&
      offset + view.byteLength <= buffer.byteLength,
      'bufferView alignment or range',
    );
    mod3dAssertGlb(
      view.target === undefined || view.target === 34962 || view.target === 34963,
      'bufferView target',
    );
    if (view.byteStride !== undefined)
    mod3dAssertGlb(
      mod3dGlbInteger(view.byteStride, 4) && view.byteStride <= 252 && view.byteStride % 4 === 0,
      'bufferView stride',
    );
  }
  const data = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  return json.accessors.map((accessor) => {
      const view = mod3dGlbReference(json.bufferViews, accessor.bufferView, 'accessor bufferView');
      const components = MOD3D_GLB_COMPONENTS[accessor.type];
      const size = accessor.componentType === 5123 ? 2 : 4;
      mod3dAssertGlb(
        components &&
        [5123, 5125, 5126].includes(accessor.componentType) &&
        accessor.sparse === undefined &&
        accessor.normalized !== true,
        'unsupported accessor encoding',
      );
      const offset = accessor.byteOffset === undefined ? 0 : accessor.byteOffset;
      const stride = view.byteStride || size * components;
      mod3dAssertGlb(
        mod3dGlbInteger(accessor.count, 1) &&
        mod3dGlbInteger(offset, 0) &&
        offset % size === 0 &&
        stride >= size * components,
        'accessor alignment or count',
      );
      mod3dAssertGlb(
        offset + (accessor.count - 1) * stride + size * components <= view.byteLength,
        'accessor exceeds its bufferView',
      );
      if (accessor.type !== 'SCALAR')
      mod3dAssertGlb(offset % 4 === 0 && stride % 4 === 0, 'vertex attribute alignment');
      const base = (view.byteOffset || 0) + offset;
      const read = (index, component) => {
        const position = base + index * stride + component * size;
        if (accessor.componentType === 5126) return data.getFloat32(position, true);
        if (accessor.componentType === 5123) return data.getUint16(position, true);
        return data.getUint32(position, true);
      };
      for (let index = 0; index < accessor.count; index++) {
        for (let component = 0; component < components; component++)
        mod3dAssertGlb(Number.isFinite(read(index, component)), 'non-finite accessor value');
      }
      return { accessor, view, read, components };
  });
}

function mod3dValidateGlbPrimitives(json, accessors) {
  mod3dAssertGlb(Array.isArray(json.meshes) && json.meshes.length > 0, 'missing meshes');
  let vertices = 0;
  let triangles = 0;
  let primitives = 0;
  let index16 = 0;
  let index32 = 0;
  for (const mesh of json.meshes) {
    mod3dAssertGlb(Array.isArray(mesh.primitives) && mesh.primitives.length > 0, 'empty mesh');
    for (const primitive of mesh.primitives) {
      mod3dAssertGlb(
        primitive.mode === undefined || primitive.mode === 4,
        'triangle topology required',
      );
      mod3dAssertGlb(
        primitive.attributes && !primitive.targets && !primitive.extensions,
        'unsupported primitive',
      );
      mod3dGlbReference(json.materials, primitive.material, 'material');
      const position = mod3dGlbReference(
        accessors,
        primitive.attributes.POSITION,
        'position accessor',
      );
      mod3dAssertGlb(
        position.accessor.type === 'VEC3' && position.accessor.componentType === 5126,
        'position encoding',
      );
      const min = mod3dGlbVector(position.accessor.min, 3, 'position minimum');
      const max = mod3dGlbVector(position.accessor.max, 3, 'position maximum');
      const observedMin = [Infinity, Infinity, Infinity];
      const observedMax = [-Infinity, -Infinity, -Infinity];
      for (let index = 0; index < position.accessor.count; index++) {
        for (let axis = 0; axis < 3; axis++) {
          const value = position.read(index, axis);
          observedMin[axis] = Math.min(observedMin[axis], value);
          observedMax[axis] = Math.max(observedMax[axis], value);
        }
      }
      mod3dAssertGlb(
        min.every((value, axis) => value === observedMin[axis]) &&
        max.every((value, axis) => value === observedMax[axis]),
        'position bounds',
      );
      for (const [semantic, accessorIndex] of Object.entries(primitive.attributes)) {
        mod3dAssertGlb(
          ['POSITION', 'NORMAL', 'TEXCOORD_0', 'COLOR_0'].includes(semantic),
          'unsupported vertex attribute',
        );
        const attribute = mod3dGlbReference(accessors, accessorIndex, semantic);
        mod3dAssertGlb(
          attribute.accessor.componentType === 5126 &&
          attribute.accessor.count === position.accessor.count &&
          attribute.view.target === 34962,
          'attribute layout or count',
        );
        mod3dAssertGlb(
          attribute.accessor.type === (semantic === 'TEXCOORD_0' ? 'VEC2' : 'VEC3'),
          'attribute shape',
        );
        if (semantic === 'NORMAL') {
          for (let index = 0; index < attribute.accessor.count; index++)
          mod3dAssertGlb(
            Math.abs(
              Math.hypot(
                attribute.read(index, 0),
                attribute.read(index, 1),
                attribute.read(index, 2),
              ) - 1,
            ) < 0.0001,
            'normal length',
          );
        }
        if (semantic === 'COLOR_0') {
          for (let index = 0; index < attribute.accessor.count; index++)
          for (let channel = 0; channel < 3; channel++)
          mod3dAssertGlb(
            attribute.read(index, channel) >= 0 && attribute.read(index, channel) <= 1,
            'vertex color range',
          );
        }
      }
      mod3dAssertGlb(primitive.attributes.NORMAL !== undefined, 'missing normal attribute');
      const indices = mod3dGlbReference(accessors, primitive.indices, 'index accessor');
      mod3dAssertGlb(
        indices.accessor.type === 'SCALAR' &&
        [5123, 5125].includes(indices.accessor.componentType) &&
        indices.accessor.count % 3 === 0 &&
        indices.view.target === 34963 &&
        indices.view.byteStride === undefined,
        'index encoding or topology',
      );
      const restartIndex = indices.accessor.componentType === 5123 ? 65535 : 4294967295;
      for (let index = 0; index < indices.accessor.count; index++)
      mod3dAssertGlb(
        indices.read(index, 0) < position.accessor.count &&
        indices.read(index, 0) !== restartIndex,
        'index out of range or reserved',
      );
      vertices += position.accessor.count;
      triangles += indices.accessor.count / 3;
      primitives++;
      if (indices.accessor.componentType === 5123) index16++;
      else index32++;
    }
  }
  return { vertices, triangles, primitives, index16, index32 };
}

function mod3dValidateGlbHierarchy(json) {
  mod3dAssertGlb(
    Array.isArray(json.nodes) && json.nodes.length > 0 && json.nodes.length <= 1000,
    'node count',
  );
  const scene = mod3dGlbReference(json.scenes, json.scene, 'scene');
  mod3dAssertGlb(Array.isArray(scene.nodes) && scene.nodes.length > 0, 'scene roots');
  const visited = new Set();
  const meshReferences = new Set();
  function visit(index) {
    const node = mod3dGlbReference(json.nodes, index, 'node');
    mod3dAssertGlb(!visited.has(index), 'cyclic or multiply parented node');
    visited.add(index);
    mod3dAssertGlb(
      node.matrix === undefined && node.skin === undefined && node.weights === undefined,
      'unsupported node transform',
    );
    mod3dGlbVector(node.translation === undefined ? [0, 0, 0] : node.translation, 3, 'translation');
    const rotation = mod3dGlbVector(
      node.rotation === undefined ? [0, 0, 0, 1] : node.rotation,
      4,
      'rotation',
    );
    const scale = mod3dGlbVector(node.scale === undefined ? [1, 1, 1] : node.scale, 3, 'scale');
    mod3dAssertGlb(
      Math.abs(Math.hypot(...rotation) - 1) < 0.00001 && scale.every((value) => value !== 0),
      'rotation normalization or singular scale',
    );
    if (node.mesh !== undefined) {
      mod3dGlbReference(json.meshes, node.mesh, 'mesh');
      mod3dAssertGlb(
        !meshReferences.has(node.mesh),
        'instanced meshes are outside the modeler export profile',
      );
      meshReferences.add(node.mesh);
    }
    if (node.children !== undefined) {
      mod3dAssertGlb(Array.isArray(node.children), 'node children');
      for (const child of node.children) visit(child);
    }
  }
  for (const root of scene.nodes) visit(root);
  mod3dAssertGlb(
    visited.size === json.nodes.length && meshReferences.size === json.meshes.length,
    'unreachable scene data',
  );
}
