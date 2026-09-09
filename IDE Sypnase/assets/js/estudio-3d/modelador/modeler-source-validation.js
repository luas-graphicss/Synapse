'use strict';

const MOD3D_SOURCE_FORMAT = 'synapse-modeler';
const MOD3D_SOURCE_VERSION = 1;
const MOD3D_SOURCE_EXTENSION = '.model3d.json';
const MOD3D_SOURCE_MAX_BYTES = 33554432;
const MOD3D_SOURCE_FILE_MAX_BYTES = 25165824;
const MOD3D_SOURCE_HISTORY_BYTES = 8388608;
const MOD3D_SOURCE_NODE_TYPES = Object.freeze([
    'grupo',
    'malha',
    'cubo',
    'esfera',
    'cilindro',
    'cone',
    'plano',
    'toro',
    'rampa',
]);

function mod3dSourceAssert(condition, message) {
  if (!condition) throw new Error(message);
}

function mod3dSourceClone(value) {
  return JSON.parse(
    JSON.stringify(value, (key, item) => {
        if (ArrayBuffer.isView(item)) return Array.from(item);
        return item;
    }),
  );
}

function mod3dSourceNumber(value, minimum, maximum, label) {
  mod3dSourceAssert(
    Number.isFinite(value) && value >= minimum && value <= maximum,
    `Invalid ${label}`,
  );
}

function mod3dSourceVector(value, length, minimum, maximum, label) {
  mod3dSourceAssert(Array.isArray(value) && value.length === length, `Invalid ${label}`);
  for (const component of value) mod3dSourceNumber(component, minimum, maximum, label);
}

function mod3dSourceInteger(value, minimum, maximum, label) {
  mod3dSourceNumber(value, minimum, maximum, label);
  mod3dSourceAssert(Number.isInteger(value), `Invalid ${label}`);
}

function mod3dSourcePlainData(value) {
  let visited = 0;
  const ancestors = new Set();
  function visit(item, depth) {
    visited += 1;
    mod3dSourceAssert(visited <= 12000000 && depth <= 128, 'Source complexity limit exceeded');
    if (item === null || typeof item === 'boolean' || typeof item === 'string') return;
    if (typeof item === 'number') {
      mod3dSourceAssert(Number.isFinite(item), 'Non-finite source value');
      return;
    }
    mod3dSourceAssert(
      typeof item === 'object' && !ancestors.has(item),
      'Cyclic source or non-data value',
    );
    mod3dSourceAssert(
      Array.isArray(item) || Object.prototype.toString.call(item) === '[object Object]',
      'Source must contain plain data',
    );
    ancestors.add(item);
    for (const key of Object.keys(item)) {
      mod3dSourceAssert(
        !['__proto__', 'prototype', 'constructor'].includes(key),
        'Unsafe source key',
      );
      visit(item[key], depth + 1);
    }
    ancestors.delete(item);
  }
  visit(value, 0);
}

function mod3dValidateSourceMesh(mesh, materialCount, budget) {
  if (mesh === null) return;
  mod3dSourceAssert(
    mesh && Array.isArray(mesh.positions) && mesh.positions.length % 3 === 0,
    'Invalid mesh positions',
  );
  const vertexCount = mesh.positions.length / 3;
  mod3dSourceInteger(vertexCount, 0, 300000, 'vertex count');
  for (const value of mesh.positions) {
    mod3dSourceNumber(value, -1000000, 1000000, 'vertex position');
  }
  mod3dSourceAssert(Array.isArray(mesh.faces) && mesh.faces.length <= 400000, 'Invalid mesh faces');
  for (const field of ['smooth', 'uv', 'materialIndices']) {
    mod3dSourceAssert(
      Array.isArray(mesh[field]) && mesh[field].length === mesh.faces.length,
      `Invalid mesh ${field}`,
    );
  }
  let faceCount = 0;
  mesh.faces.forEach((face, index) => {
      mod3dSourceAssert(typeof mesh.smooth[index] === 'boolean', 'Invalid smooth flag');
      mod3dSourceInteger(
        mesh.materialIndices[index],
        0,
        Math.max(0, materialCount - 1),
        'face material',
      );
      if (face === null) {
        mod3dSourceAssert(mesh.uv[index] === null, 'Deleted face has UV data');
        return;
      }
      mod3dSourceAssert(
        Array.isArray(face) && face.length >= 3 && face.length <= 64,
        'Invalid face size',
      );
      mod3dSourceAssert(new Set(face).size === face.length, 'Repeated face vertex');
      for (const vertex of face) mod3dSourceInteger(vertex, 0, vertexCount - 1, 'face vertex');
      if (mesh.uv[index] !== null) {
        mod3dSourceVector(mesh.uv[index], face.length * 2, -1000000, 1000000, 'face UV');
      }
      faceCount += 1;
  });
  mod3dSourceAssert(faceCount <= 200000, 'Live mesh face limit exceeded');
  mod3dSourceAssert(['plano', 'suave', 'angulo'].includes(mesh.shading), 'Invalid shading mode');
  mod3dSourceNumber(mesh.smoothAngle, 0, 180, 'smoothing angle');
  if (mesh.colors !== null) {
    mod3dSourceVector(mesh.colors, mesh.positions.length, 0, 1, 'vertex colors');
  }
  budget.vertices += vertexCount;
  budget.faces += faceCount;
  mod3dSourceAssert(
    budget.vertices <= 600000 && budget.faces <= 400000,
    'Scene geometry limit exceeded',
  );
}

function mod3dValidateSourceMaterial(material) {
  mod3dSourceAssert(
    material && typeof material.nome === 'string' && material.nome.length <= 40,
    'Invalid material name',
  );
  mod3dSourceVector(material.cor, 3, 0, 1, 'material color');
  for (const field of ['opacidade', 'metal', 'rugosidade', 'emissao']) {
    mod3dSourceNumber(material[field], 0, 1, field);
  }
  mod3dSourceAssert(
    typeof material.faceDupla === 'boolean' && typeof material.embutir === 'boolean',
    'Invalid material flag',
  );
  mod3dSourceAssert(
    typeof material.textura === 'string' && material.textura.length <= 400,
    'Invalid texture path',
  );
  if (material.textura) mod3dModelerProjectPath(material.textura);
  mod3dSourceVector(material.repetir, 2, -64, 64, 'texture scale');
  mod3dSourceVector(material.deslocar, 2, -64, 64, 'texture offset');
}

function mod3dValidateSceneDocument(scene) {
  mod3dSourceAssert(
    scene && Array.isArray(scene.nodes) && scene.nodes.length <= 400,
    'Invalid scene nodes',
  );
  mod3dSourceAssert(
    Array.isArray(scene.roots) && Array.isArray(scene.selection),
    'Invalid scene lists',
  );
  mod3dSourceInteger(scene.nextId, 0, 1000000000, 'node sequence');
  const nodes = new Map();
  const budget = { vertices: 0, faces: 0 };
  for (const node of scene.nodes) {
    mod3dSourceAssert(
      node && typeof node.id === 'string' && /^[\w-]{1,80}$/.test(node.id) && !nodes.has(node.id),
      'Invalid or duplicate node ID',
    );
    mod3dSourceAssert(typeof node.name === 'string' && node.name.length <= 48, 'Invalid node name');
    mod3dSourceAssert(MOD3D_SOURCE_NODE_TYPES.includes(node.type), 'Unsupported node type');
    mod3dSourceAssert(
      typeof node.parent === 'string' && Array.isArray(node.children),
      'Invalid node hierarchy',
    );
    mod3dSourceVector(node.position, 3, -100000, 100000, 'node position');
    mod3dSourceVector(node.rotation, 3, -100000, 100000, 'node rotation');
    mod3dSourceVector(node.scale, 3, -1000, 1000, 'node scale');
    mod3dSourceAssert(
      node.scale.every((value) => Math.abs(value) >= 0.001),
      'Singular node scale',
    );
    mod3dSourceVector(node.pivot, 3, -100000, 100000, 'node pivot');
    mod3dSourceVector(node.color, 3, 0, 1, 'node color');
    mod3dSourceAssert(
      typeof node.visible === 'boolean' && typeof node.locked === 'boolean',
      'Invalid node flags',
    );
    mod3dSourceAssert(
      node.parameters && typeof node.parameters === 'object' && !Array.isArray(node.parameters),
      'Invalid primitive parameters',
    );
    for (const value of Object.values(node.parameters)) {
      mod3dSourceNumber(value, 0, 1000000, 'primitive parameter');
    }
    mod3dSourceAssert(
      ['plana', 'cubica', 'cilindrica', 'esferica'].includes(node.uvProjection),
      'Invalid UV projection',
    );
    mod3dSourceAssert(
      Array.isArray(node.materials) && node.materials.length <= 12,
      'Invalid material list',
    );
    node.materials.forEach(mod3dValidateSourceMaterial);
    mod3dValidateSourceMesh(node.mesh, node.materials.length, budget);
    mod3dSourceAssert(node.type !== 'malha' || node.mesh !== null, 'Editable mesh is missing');
    mod3dSourceAssert(
      node.type !== 'grupo' || node.mesh === null,
      'Group cannot contain mesh data',
    );
    const generatedId = /^no-(\d+)$/.exec(node.id);
    if (generatedId) {
      mod3dSourceAssert(
        Number(generatedId[1]) <= scene.nextId,
        'Node sequence would overwrite an existing node',
      );
    }
    nodes.set(node.id, node);
  }
  const visited = new Set();
  const pending = scene.roots.map((id) => ({ id, parent: '', depth: 0 }));
  while (pending.length) {
    const entry = pending.pop();
    const node = nodes.get(entry.id);
    mod3dSourceAssert(
      node && !visited.has(entry.id) && node.parent === entry.parent && entry.depth < 100,
      'Invalid or cyclic scene hierarchy',
    );
    visited.add(entry.id);
    for (const child of node.children) {
      pending.push({ id: child, parent: node.id, depth: entry.depth + 1 });
    }
  }
  mod3dSourceAssert(visited.size === nodes.size, 'Unreachable scene node');
  mod3dSourceAssert(
    scene.selection.every((id) => nodes.has(id)) &&
    new Set(scene.selection).size === scene.selection.length,
    'Invalid object selection',
  );
  return scene;
}

function mod3dValidateSourceDocument(source) {
  mod3dSourcePlainData(source);
  mod3dSourceAssert(
    source && source.format === MOD3D_SOURCE_FORMAT,
    'Not a modeler source document',
  );
  mod3dSourceAssert(
    source.version === MOD3D_SOURCE_VERSION,
    'Unsupported source version. Open it with a compatible editor; the original file was not changed.',
  );
  mod3dSourceAssert(
    typeof source.documentId === 'string' && /^[\w-]{1,80}$/.test(source.documentId),
    'Invalid document identity',
  );
  mod3dValidateSceneDocument(source.scene);
  if (typeof mod3dValidateTextureDocument === 'function') {
    mod3dValidateTextureDocument(source.textures);
  }
  mod3dSourceAssert(
    source.history && Array.isArray(source.history.steps) && source.history.steps.length <= 100,
    'Invalid source history',
  );
  mod3dSourceInteger(source.history.index, -1, source.history.steps.length - 1, 'history cursor');
  mod3dSourceInteger(source.history.omitted, 0, 1000000000, 'omitted history count');
  for (const step of source.history.steps) {
    mod3dSourceAssert(
      typeof step.label === 'string' &&
      step.label.length <= 120 &&
      typeof step.key === 'string' &&
      step.key.length <= 200,
      'Invalid history label',
    );
    mod3dValidateSceneDocument(step.before);
    mod3dValidateSceneDocument(step.after);
  }
  mod3dSourceAssert(
    new TextEncoder().encode(JSON.stringify(source.history)).length <= MOD3D_SOURCE_HISTORY_BYTES,
    'Source history limit exceeded',
  );
  return source;
}
