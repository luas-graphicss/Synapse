'use strict';

function mod3dValidateImportBuffers(json, binary, project, path) {
  let total = 0;
  return (json.buffers || []).map((buffer) => {
      mod3dSourceInteger(buffer.byteLength, 0, 33554432, 'buffer length');
      let bytes = binary;
      if (buffer.uri) {
        if (/^data:application\/(octet-stream|gltf-buffer);base64,/.test(buffer.uri)) {
          const encoded = buffer.uri.slice(buffer.uri.indexOf(',') + 1);
          mod3dSourceAssert(
            encoded.length <= 44739244 && /^[A-Za-z0-9+/]*={0,2}$/.test(encoded),
            'Invalid imported data URI',
          );
          bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
        } else {
          const relative = mod3dModelerProjectPath(decodeURIComponent(buffer.uri));
          const directory = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
          const target = directory + relative;
          mod3dModelerProjectPath(target);
          mod3dSourceAssert(project.files.has(target), `Missing relative buffer: ${target}`);
          bytes = mod3dProjectFileBytes(project.files.get(target));
        }
      }
      mod3dSourceAssert(
        bytes && bytes.length >= buffer.byteLength,
        'Missing or truncated glTF buffer',
      );
      total += bytes.length;
      mod3dSourceAssert(total <= 67108864, 'Imported buffer memory limit exceeded');
      return bytes;
  });
}

function mod3dValidateImportGltf(json, binary, project, path) {
  mod3dCheckImportGltf(json);
  const buffers = mod3dValidateImportBuffers(json, binary, project, path);
  const views = json.bufferViews || [];
  const accessors = json.accessors || [];
  for (const view of views) {
    mod3dSourceInteger(view.buffer, 0, buffers.length - 1, 'buffer index');
    mod3dSourceInteger(view.byteOffset || 0, 0, buffers[view.buffer].length, 'buffer view offset');
    mod3dSourceInteger(view.byteLength, 0, buffers[view.buffer].length, 'buffer view length');
    mod3dSourceAssert(
      (view.byteOffset || 0) + view.byteLength <= json.buffers[view.buffer].byteLength,
      'Buffer view exceeds declared buffer',
    );
  }
  for (const accessor of accessors) {
    mod3dSourceInteger(accessor.bufferView, 0, views.length - 1, 'accessor buffer view');
    const view = views[accessor.bufferView];
    const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 }[
      accessor.type
    ];
    const bytes = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }[accessor.componentType];
    mod3dSourceAssert(components && bytes, 'Unsupported accessor type');
    const offset = accessor.byteOffset || 0;
    const stride = view.byteStride || bytes * components;
    mod3dSourceInteger(offset, 0, view.byteLength, 'accessor offset');
    mod3dSourceInteger(stride, bytes * components, 252, 'accessor stride');
    mod3dSourceAssert(offset % bytes === 0 && stride % bytes === 0, 'Misaligned accessor');
    const end = accessor.count
    ? offset + (accessor.count - 1) * stride + bytes * components
    : offset;
    mod3dSourceAssert(end <= view.byteLength, 'Accessor exceeds buffer view');
  }
  const read = gltfMakeRead(json, buffers);
  const meshSizes = (json.meshes || []).map((mesh) => {
      let indices = 0;
      for (const primitive of mesh.primitives || []) {
        const positionIndex = primitive.attributes && primitive.attributes.POSITION;
        mod3dSourceInteger(positionIndex, 0, accessors.length - 1, 'position accessor');
        const position = accessors[positionIndex];
        mod3dSourceAssert(
          position.type === 'VEC3' && position.componentType === 5126 && !position.normalized,
          'Only float VEC3 positions are supported',
        );
        for (const value of read(positionIndex).array) {
          mod3dSourceNumber(value, -1000000, 1000000, 'imported coordinate');
        }
        if (primitive.indices === undefined) indices += position.count;
        else {
          mod3dSourceInteger(primitive.indices, 0, accessors.length - 1, 'index accessor');
          const accessor = accessors[primitive.indices];
          mod3dSourceAssert(
            accessor.type === 'SCALAR' && [5121, 5123, 5125].includes(accessor.componentType),
            'Unsupported triangle index type',
          );
          for (const value of read(primitive.indices).array) {
            mod3dSourceInteger(value, 0, position.count - 1, 'triangle index');
          }
          indices += accessor.count;
        }
        mod3dSourceAssert(indices % 3 === 0 && indices <= 600000, 'Imported triangle limit exceeded');
      }
      return indices;
  });
  const nodes = json.nodes || [];
  let indices = 0;
  for (const node of nodes) {
    for (const [field, length] of [
        ['matrix', 16],
        ['translation', 3],
        ['rotation', 4],
        ['scale', 3],
    ]) {
      if (node[field]) mod3dSourceVector(node[field], length, -1000000, 1000000, `node ${field}`);
    }
    if (node.mesh !== undefined) {
      mod3dSourceInteger(node.mesh, 0, meshSizes.length - 1, 'node mesh');
      indices += meshSizes[node.mesh];
    }
  }
  mod3dSourceAssert(indices <= 600000, 'Instanced geometry exceeds 200,000 triangles');
  const children = new Set(nodes.flatMap((node) => node.children || []));
  if (!json.scenes || !json.scenes.length) {
    json.scenes = [
      { nodes: nodes.map((node, index) => index).filter((index) => !children.has(index)) },
    ];
    json.scene = 0;
  }
  mod3dSourceInteger(json.scene || 0, 0, json.scenes.length - 1, 'default scene');
  for (const scene of json.scenes) {
    mod3dSourceAssert(
      Array.isArray(scene.nodes) && new Set(scene.nodes).size === scene.nodes.length,
      'Invalid scene roots',
    );
    for (const index of scene.nodes) {
      mod3dSourceInteger(index, 0, nodes.length - 1, 'scene root');
      mod3dSourceAssert(!children.has(index), 'Scene root has a parent');
    }
  }
  return { json, buffers };
}

function mod3dValidateImportText(extension, bytes) {
  if (extension === '.stl' && bytes.length >= 84) {
    const triangles = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(
      80,
      true,
    );
    if (84 + triangles * 50 === bytes.length) {
      mod3dSourceInteger(triangles, 1, 200000, 'STL triangle count');
      return;
    }
  }
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (extension === '.stl') {
    const vertices = text.match(/\bvertex\b/g) || [];
    mod3dSourceAssert(
      vertices.length > 0 && vertices.length % 3 === 0 && vertices.length <= 600000,
      'Invalid STL vertex count',
    );
    return;
  }
  let vertices = 0;
  let triangles = 0;
  for (const line of text.split(/\r?\n/)) {
    const fields = line.trim().split(/\s+/);
    if (fields[0] === 'v') {
      mod3dSourceVector(fields.slice(1, 4).map(Number), 3, -1000000, 1000000, 'OBJ vertex');
      vertices += 1;
      mod3dSourceAssert(vertices <= 300000, 'OBJ vertex limit exceeded');
    } else if (fields[0] === 'f') {
      const corners = fields.slice(1);
      mod3dSourceAssert(corners.length >= 3 && corners.length <= 64, 'Unsupported OBJ face size');
      for (const corner of corners) {
        const index = Number(corner.split('/')[0]);
        mod3dSourceInteger(index, -vertices, vertices, 'OBJ face index');
        mod3dSourceAssert(index !== 0, 'OBJ indices start at one');
      }
      triangles += corners.length - 2;
      mod3dSourceAssert(triangles <= 200000, 'OBJ triangle limit exceeded');
    }
  }
}
