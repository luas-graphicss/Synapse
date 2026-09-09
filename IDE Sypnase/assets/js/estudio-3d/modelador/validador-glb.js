'use strict';

let mod3dGlbValidationSequence = 0;

function mod3dGlbOutputWarnings(report, images) {
  const warnings = [];
  if (report.bytes > 10 * 1024 * 1024) warnings.push('large-file');
  if (report.triangles > 200000) warnings.push('many-triangles');
  if (report.vertices > 100000) warnings.push('many-vertices');
  if (report.materials > 32) warnings.push('many-materials');
  if (images.some((image) => image.width > 4096 || image.height > 4096))
  warnings.push('large-texture');
  if (images.some((image) => image.external)) warnings.push('external-textures');
  return warnings;
}

function mod3dCheckGlbExpected(json, report, loaded, expected, conversion) {
  if (!expected) return;
  mod3dAssertGlb(expected.version === 1, 'validation contract version');
  for (const property of ['vertices', 'triangles', 'textures'])
  mod3dAssertGlb(report[property] === expected[property], `${property} changed during export`);
  mod3dAssertGlb(loaded.geo.vertCount === expected.expandedVertices, 'source vertex count changed');
  mod3dAssertGlb(
    expected.bounds && Array.isArray(expected.bounds.min) && Array.isArray(expected.bounds.max),
    'missing source bounds',
  );
  const sourceMin = mod3dGlbVector(expected.bounds.min, 3, 'source minimum');
  const sourceMax = mod3dGlbVector(expected.bounds.max, 3, 'source maximum');
  const magnitude = Math.max(0.0001, ...sourceMin.map(Math.abs), ...sourceMax.map(Math.abs));
  const tolerance = magnitude * 0.00002;
  for (let axis = 0; axis < 3; axis++) {
    mod3dAssertGlb(
      Math.abs(loaded.bboxMin[axis] - sourceMin[axis]) <= tolerance &&
      Math.abs(loaded.bboxMax[axis] - sourceMax[axis]) <= tolerance,
      'source bounding box changed',
    );
  }
  mod3dAssertGlb(
    JSON.stringify(json.materials) === JSON.stringify(expected.materials),
    'source materials changed',
  );
  mod3dAssertGlb(
    Array.isArray(expected.nodes) && expected.nodes.length > 0,
    'missing source nodes',
  );
  const converted = conversion.metersPerUnit !== 1 || conversion.upAxis !== 'Y';
  mod3dAssertGlb(
    json.nodes.length === expected.nodes.length + (converted ? 2 : 0),
    'source node count changed',
  );
  mod3dAssertGlb(
    JSON.stringify(json.nodes.slice(0, expected.nodes.length)) === JSON.stringify(expected.nodes),
    'source transforms or hierarchy changed',
  );
  const roots = converted
  ? json.nodes[json.nodes.length - 2].children || []
  : json.scenes[json.scene].nodes;
  mod3dAssertGlb(JSON.stringify(roots) === JSON.stringify(expected.roots), 'source roots changed');
}

function mod3dValidateGlb(bytes, options) {
  const settings = options || {};
  const conversion = mod3dGlbExportOptions(settings.conversion);
  const { json, bin } = mod3dReadStrictGlb(bytes);
  mod3dAssertGlb(
    !json.extensionsRequired || json.extensionsRequired.length === 0,
    'unsupported required extensions',
  );
  mod3dAssertGlb(
    !json.animations && !json.skins && json.scenes && json.scenes.length === 1,
    'unsupported scene profile',
  );
  const accessors = mod3dValidateGlbAccessors(json, bin);
  const counts = mod3dValidateGlbPrimitives(json, accessors);
  mod3dValidateGlbHierarchy(json);
  const images = mod3dValidateGlbAppearance(json, bin, settings.project);
  const path = '__modeler_validation__.glb';
  const project = {
    id: `modeler-validation-${++mod3dGlbValidationSequence}`,
    files: new Map([
        [path, { data: bytes, isText: false, text: null, size: bytes.length, ver: 0 }],
    ]),
  };
  let loaded;
  const previousCache = EST3D.cache;
  EST3D.cache = new Map();
  try {
    loaded = est3dLoad(project, path);
  } finally {
    EST3D.cache = previousCache;
  }
  mod3dAssertGlb(
    loaded &&
    loaded.geo &&
    loaded.geo.triCount === counts.triangles &&
    loaded.geo.vertCount === counts.triangles * 3,
    'Studio geometry round trip',
  );
  mod3dGlbVector(loaded.bboxMin, 3, 'Studio minimum');
  mod3dGlbVector(loaded.bboxMax, 3, 'Studio maximum');
  const report = {
    ...counts,
    bytes: bytes.length,
    nodes: json.nodes.length,
    meshes: json.meshes.length,
    materials: json.materials.length,
    textures: (json.textures || []).length,
    externalTextures: images.filter((image) => image.external).length,
    expandedVertices: loaded.geo.vertCount,
    removedVertices: loaded.geo.vertCount - counts.vertices,
    bounds: { min: loaded.bboxMin.slice(), max: loaded.bboxMax.slice() },
    validated: true,
  };
  mod3dCheckGlbExpected(json, report, loaded, settings.expected, conversion);
  report.warnings = mod3dGlbOutputWarnings(report, images);
  return report;
}

function mod3dFinalizeGlbExport(request, project) {
  const conversion = mod3dGlbExportOptions(request.conversion);
  const json = JSON.parse(JSON.stringify(request.json));
  if (conversion.metersPerUnit !== 1 || conversion.upAxis !== 'Y') {
    const rotation =
    conversion.upAxis === 'Z' ? [-90, 0, 0] : conversion.upAxis === 'X' ? [0, 0, 90] : [0, 0, 0];
    est3dBakeGltfJson(json, [0, 0, 0], rotation, conversion.metersPerUnit);
  }
  const bytes = est3dPackGLB(json, request.bin);
  const report = mod3dValidateGlb(bytes, { project, expected: request.expected, conversion });
  return { bytes, report };
}
