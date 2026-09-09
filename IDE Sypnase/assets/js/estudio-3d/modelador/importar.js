'use strict';

function mod3dCheckImportGltf(json) {
  mod3dSourcePlainData(json);
  mod3dSourceAssert(
    json && json.asset && json.asset.version === '2.0',
    'Only glTF 2.0 is supported',
  );
  mod3dSourceAssert(
    !json.extensionsRequired || json.extensionsRequired.length === 0,
    'Required glTF extensions are unsupported. Export without compression.',
  );
  mod3dSourceAssert(
    (!json.skins || json.skins.length === 0) && (!json.animations || json.animations.length === 0),
    'Animated or skinned assets cannot be imported for editing',
  );
  const nodes = json.nodes || [];
  mod3dSourceAssert(nodes.length <= 400, 'Too many imported nodes');
  const visited = new Set();
  const parents = new Set();
  for (const node of nodes) {
    for (const child of node.children || []) {
      mod3dSourceInteger(child, 0, nodes.length - 1, 'child node');
      mod3dSourceAssert(!parents.has(child), 'Shared or cyclic glTF hierarchy');
      parents.add(child);
    }
  }
  function visit(index, ancestors) {
    mod3dSourceAssert(!ancestors.has(index) && ancestors.size < 100, 'Cyclic glTF hierarchy');
    if (visited.has(index)) return;
    ancestors.add(index);
    for (const child of nodes[index].children || []) visit(child, ancestors);
    ancestors.delete(index);
    visited.add(index);
  }
  for (let index = 0; index < nodes.length; index++) visit(index, new Set());
  let elements = 0;
  for (const accessor of json.accessors || []) {
    mod3dSourceInteger(accessor.count, 0, 600000, 'accessor count');
    mod3dSourceAssert(!accessor.sparse, 'Sparse accessors are unsupported');
    elements += accessor.count;
  }
  mod3dSourceAssert(elements <= 4000000, 'Imported geometry exceeds memory limit');
  for (const mesh of json.meshes || []) {
    for (const primitive of mesh.primitives || []) {
      mod3dSourceAssert(
        primitive.mode === undefined || primitive.mode === 4,
        'Only triangle primitives are supported',
      );
      mod3dSourceAssert(!primitive.targets, 'Morph targets are unsupported');
    }
  }
  for (const buffer of json.buffers || []) {
    mod3dSourceInteger(buffer.byteLength, 0, 33554432, 'buffer size');
    if (
      buffer.uri &&
      !buffer.uri.startsWith('data:application/octet-stream;base64,') &&
      !buffer.uri.startsWith('data:application/gltf-buffer;base64,')
    ) {
      mod3dModelerProjectPath(decodeURIComponent(buffer.uri));
    }
  }
}

function mod3dImportedMesh(geometry) {
  const source = geometry.pos;
  mod3dSourceAssert(
    source && source.length > 0 && source.length % 9 === 0 && source.length <= 1800000,
    'Imported mesh is empty or exceeds 200,000 triangles',
  );
  const positions = [];
  const faces = [];
  const vertices = new Map();
  const center = geometry.center || [0, 0, 0];
  for (let offset = 0; offset < source.length; offset += 9) {
    const face = [];
    for (let corner = 0; corner < 3; corner++) {
      const point = [0, 1, 2].map((axis) => source[offset + corner * 3 + axis] + center[axis]);
      mod3dSourceVector(point, 3, -1000000, 1000000, 'imported position');
      const key = point.join(',');
      if (!vertices.has(key)) {
        mod3dSourceAssert(vertices.size < 300000, 'Imported vertex limit exceeded');
        vertices.set(key, vertices.size);
        positions.push(...point);
      }
      face.push(vertices.get(key));
    }
    mod3dSourceAssert(new Set(face).size === 3, 'Imported mesh has collapsed triangles');
    faces.push(face);
  }
  return {
    positions,
    faces,
    smooth: faces.map(() => false),
    uv: faces.map(() => null),
    materialIndices: faces.map(() => 0),
    colors: null,
    shading: 'plano',
    smoothAngle: 32,
  };
}

async function mod3dImportProjectModel(project, path) {
  mod3dModelerProjectPath(path);
  const extension = mod3dModelerFileExtension(path);
  mod3dSourceAssert(
    ['.glb', '.gltf', '.obj', '.stl'].includes(extension),
    'Unsupported import format',
  );
  const file = project.files.get(path);
  const bytes = mod3dProjectFileBytes(file);
  mod3dSourceAssert(bytes.length <= 33554432, 'Import file exceeds 32 MiB');
  let geometry;
  if (extension === '.glb' || extension === '.gltf') {
    const parts =
    extension === '.glb'
    ? mod3dReadStrictGlb(bytes)
    : { json: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)), bin: null };
    const checked = mod3dValidateImportGltf(parts.json, parts.bin, project, path);
    geometry = parseGLTFJson(
      checked.json,
      parts.bin,
      (uri) => checked.buffers[checked.json.buffers.findIndex((buffer) => buffer.uri === uri)],
    );
  } else {
    mod3dValidateImportText(extension, bytes);
    geometry = load3D(extension, { data: bytes, isText: false }, project, path);
  }
  const mesh = mod3dImportedMesh(geometry);
  const modelPath = extension === '.glb' ? path : path.slice(0, -extension.length) + '.glb';
  const documentId = mod3dNovoId();
  const source = {
    format: MOD3D_SOURCE_FORMAT,
    version: MOD3D_SOURCE_VERSION,
    documentId,
    scene: {
      nodes: [
        {
          id: 'no-1',
          name: path.split('/').pop().slice(0, 48),
          type: 'malha',
          parent: '',
          children: [],
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          pivot: [0, 0, 0],
          parameters: {},
          color: [0.62, 0.68, 0.82],
          visible: true,
          locked: false,
          materials: [],
          uvProjection: 'cubica',
          mesh,
        },
      ],
      roots: ['no-1'],
      selection: ['no-1'],
      nextId: 1,
    },
    history: { steps: [], index: -1, omitted: 0 },
  };
  return {
    text: await mod3dEncodeSource(source),
    imported: true,
    modelPath,
    sourcePath: '',
    warnings: [
      'Geometry import: transforms are baked; materials, UVs and custom normals are not imported. The original file is unchanged.',
    ],
    binding: {
      project: project.id,
      modelPath: extension === '.glb' ? path : '',
      sourcePath: '',
      modelRevision: extension === '.glb' ? mod3dModelerFileRevision(file) : null,
      sourceRevision: null,
      documentId,
    },
  };
}
