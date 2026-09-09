'use strict';

function mod3dGlbExportOptions(options) {
  const source = options || {};
  const metersPerUnit = source.metersPerUnit === undefined ? 1 : source.metersPerUnit;
  const upAxis = source.upAxis || 'Y';
  const textureMode = source.textureMode || 'material';
  if (!Number.isFinite(metersPerUnit) || metersPerUnit <= 0 || metersPerUnit > 1000000) {
    throw new Error('Invalid source unit scale');
  }
  if (!['Y', 'Z', 'X'].includes(upAxis)) throw new Error('Unsupported source up axis');
  if (!['material', 'embed', 'reference'].includes(textureMode))
  throw new Error('Invalid texture export mode');
  return { selectionOnly: source.selectionOnly === true, textureMode, metersPerUnit, upAxis };
}

function mod3dGlbConvertPoint(point, conversion) {
  let converted = point;
  if (conversion.upAxis === 'Z') converted = [point[0], point[2], -point[1]];
  if (conversion.upAxis === 'X') converted = [-point[1], point[0], point[2]];
  return converted.map((value) => value * conversion.metersPerUnit);
}

function mod3dGlbSceneOrder(graph) {
  const ordered = [];
  const visited = new Set();
  function visit(id, parent) {
    const node = graph.nos.get(id);
    if (!node || visited.has(id) || node.pai !== parent) throw new Error('Invalid scene hierarchy');
    visited.add(id);
    ordered.push(node);
    for (const child of node.filhos) visit(child, id);
  }
  for (const root of graph.raizes) visit(root, '');
  if (visited.size !== graph.nos.size) throw new Error('Scene contains unreachable nodes');
  return ordered;
}

function mod3dCaptureGlbScene(options) {
  const settings = mod3dGlbExportOptions(options);
  const ordered = mod3dGlbSceneOrder(mod3dGrafo);
  if (!ordered.length) return null;
  const geometryIds = new Set();
  const selectedIds = new Set(mod3dGrafo.selecao);
  if (settings.selectionOnly && !ordered.some((node) => selectedIds.has(node.id))) {
    throw new Error('Select at least one object to export');
  }
  for (const node of ordered) {
    if (!settings.selectionOnly || selectedIds.has(node.id) || geometryIds.has(node.pai)) {
      geometryIds.add(node.id);
    }
  }
  const includedIds = new Set(geometryIds);
  for (const id of geometryIds) {
    let parentId = mod3dGrafo.nos.get(id).pai;
    while (parentId) {
      includedIds.add(parentId);
      parentId = mod3dGrafo.nos.get(parentId).pai;
    }
  }
  const included = ordered.filter((node) => includedIds.has(node.id));
  const indices = new Map(included.map((node, index) => [node.id, index]));
  const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  let sourceVertices = 0;
  const nodes = included.map((node) => {
      const localMesh = geometryIds.has(node.id) ? mod3dMalhaLocalDoNo(node) : null;
      const mesh =
      localMesh && localMesh.pos && localMesh.pos.length
      ? {
        positions: new Float32Array(localMesh.pos),
        normals: localMesh.nrm ? new Float32Array(localMesh.nrm) : null,
        uv: localMesh.uv ? new Float32Array(localMesh.uv) : null,
        colors: localMesh.cor ? new Float32Array(localMesh.cor) : null,
        groups: (localMesh.grupos || []).map((group) => ({
              start: group.inicio,
              count: group.conta,
              material: group.material,
        })),
      }
      : null;
      if (mesh) {
        const matrix = mod3dMatrizMundialDoNo(node);
        sourceVertices += mesh.positions.length / 3;
        for (let offset = 0; offset < mesh.positions.length; offset += 3) {
          const point = [0, 1, 2].map((axis) =>
            mod3dExportFloat(mesh.positions[offset + axis] - node.pivo[axis]),
          );
          const world = mod3dGlbConvertPoint(mod3dPontoPorMat(matrix, point), settings);
          for (let axis = 0; axis < 3; axis++) {
            bounds.min[axis] = Math.min(bounds.min[axis], world[axis]);
            bounds.max[axis] = Math.max(bounds.max[axis], world[axis]);
          }
        }
      }
      const translation = node.pos.slice();
      const rotation = mod3dQuatDeGraus(node.rot);
      const scale = node.esc.slice();
      if (
        ![...translation, ...rotation, ...scale, ...node.pivo].every(Number.isFinite) ||
        scale.some((value) => value === 0)
      ) {
        throw new Error('Invalid scene transform');
      }
      return {
        name: node.nome,
        translation,
        rotation,
        scale,
        pivot: node.pivo.slice(),
        children: node.filhos.filter((id) => indices.has(id)).map((id) => indices.get(id)),
        materials: mesh
        ? mod3dMateriaisDoNo(node).map((material, index) => mod3dMaterialSeguro(material, index))
        : [],
        mesh,
      };
  });
  if (!sourceVertices) return null;
  return {
    nodes,
    roots: included
    .filter((node) => !includedIds.has(node.pai))
    .map((node) => indices.get(node.id)),
    bounds,
    sourceVertices,
    settings,
  };
}
