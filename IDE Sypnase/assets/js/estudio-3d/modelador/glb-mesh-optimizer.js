'use strict';

function mod3dExportTextureCoordinate(coordinate, material, axis) {
  const scaled = coordinate * material.repetir[axis] + material.deslocar[axis];
  const isVerticalAxis = axis === 1;
  return isVerticalAxis ? verticalTextureCoordinateForGltf(scaled) : scaled;
}

function mod3dValidateExportGroups(mesh, materialCount) {
  const vertexCount = mesh.positions.length / 3;
  if (!Number.isInteger(vertexCount) || vertexCount % 3 !== 0 || vertexCount === 0) {
    throw new Error('Export requires complete triangles');
  }
  const groups = mesh.groups.length
  ? mesh.groups.map((group) => ({ ...group }))
  : [{ start: 0, count: vertexCount, material: 0 }];
  groups.sort((left, right) => left.start - right.start);
  let nextVertex = 0;
  for (const group of groups) {
    if (
      !Number.isInteger(group.start) ||
      !Number.isInteger(group.count) ||
      !Number.isInteger(group.material) ||
      group.start !== nextVertex ||
      group.count <= 0 ||
      group.count % 3 !== 0 ||
      group.material < 0 ||
      group.material >= materialCount
    ) {
      throw new Error('Invalid, overlapping or incomplete material groups');
    }
    nextVertex += group.count;
  }
  if (nextVertex !== vertexCount) throw new Error('Material groups do not cover the mesh');
  return groups;
}

function mod3dExportFloat(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Non-finite mesh attribute');
  }
  const rounded = Math.fround(value);
  if (!Number.isFinite(rounded)) throw new Error('Mesh attribute exceeds Float32 range');
  return Object.is(rounded, -0) ? 0 : rounded;
}

function mod3dExportFaceNormal(positions, vertex) {
  const offset = Math.floor(vertex / 3) * 9;
  const first = [
    positions[offset + 3] - positions[offset],
    positions[offset + 4] - positions[offset + 1],
    positions[offset + 5] - positions[offset + 2],
  ];
  const second = [
    positions[offset + 6] - positions[offset],
    positions[offset + 7] - positions[offset + 1],
    positions[offset + 8] - positions[offset + 2],
  ];
  const normal = [
    first[1] * second[2] - first[2] * second[1],
    first[2] * second[0] - first[0] * second[2],
    first[0] * second[1] - first[1] * second[0],
  ];
  const length = Math.hypot(...normal);
  if (!Number.isFinite(length) || length === 0) throw new Error('Degenerate export triangle');
  return normal.map((value) => mod3dExportFloat(value / length));
}

function mod3dOptimizeGlbMesh(mesh, materials, materialIndices, pivot) {
  const vertexCount = mesh.positions.length / 3;
  const groups = mod3dValidateExportGroups(mesh, materials.length);
  if (mesh.normals && mesh.normals.length !== mesh.positions.length) {
    throw new Error('Normal count does not match positions');
  }
  if (mesh.colors && mesh.colors.length !== mesh.positions.length) {
    throw new Error('Vertex color count does not match positions');
  }
  const grouped = new Map();
  for (const group of groups) {
    const materialIndex = materialIndices[group.material];
    if (!grouped.has(materialIndex)) grouped.set(materialIndex, []);
    grouped.get(materialIndex).push(group);
  }
  const output = [];
  for (const [materialIndex, materialGroups] of grouped) {
    const hasTexture = materialGroups.some((group) => Boolean(materials[group.material].textura));
    if (hasTexture && (!mesh.uv || mesh.uv.length !== vertexCount * 2)) {
      throw new Error('Textured material requires complete UV coordinates');
    }
    const hasColors = Boolean(mesh.colors && mesh.colors.some((value) => value !== 1));
    const positions = [];
    const normals = [];
    const uv = hasTexture ? [] : null;
    const colors = hasColors ? [] : null;
    const indices = [];
    const vertexIndices = new Map();
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const group of materialGroups) {
      const material = materials[group.material];
      for (let vertex = group.start; vertex < group.start + group.count; vertex++) {
        const position = [0, 1, 2].map((axis) =>
          mod3dExportFloat(mesh.positions[vertex * 3 + axis] - pivot[axis]),
        );
        const sourceNormal = mesh.normals
        ? [mesh.normals[vertex * 3], mesh.normals[vertex * 3 + 1], mesh.normals[vertex * 3 + 2]]
        : mod3dExportFaceNormal(mesh.positions, vertex);
        const normalLength = Math.hypot(...sourceNormal);
        if (!Number.isFinite(normalLength) || normalLength === 0)
        throw new Error('Invalid export normal');
        const normal = sourceNormal.map((value) => mod3dExportFloat(value / normalLength));
        const textureCoordinates = hasTexture
        ? [0, 1].map((axis) =>
          mod3dExportFloat(
            mod3dExportTextureCoordinate(mesh.uv[vertex * 2 + axis], material, axis),
          ),
        )
        : [];
        const color = hasColors
        ? [0, 1, 2].map((axis) => mod3dExportFloat(mesh.colors[vertex * 3 + axis]))
        : [];
        if (color.some((value) => value < 0 || value > 1))
        throw new Error('Vertex color is outside the glTF range');
        const key = [...position, ...normal, ...textureCoordinates, ...color].join('|');
        let index = vertexIndices.get(key);
        if (index === undefined) {
          index = positions.length / 3;
          vertexIndices.set(key, index);
          positions.push(...position);
          normals.push(...normal);
          if (uv) uv.push(...textureCoordinates);
          if (colors) colors.push(...color);
          for (let axis = 0; axis < 3; axis++) {
            min[axis] = Math.min(min[axis], position[axis]);
            max[axis] = Math.max(max[axis], position[axis]);
          }
        }
        indices.push(index);
      }
    }
    output.push({
        positions,
        normals,
        uv,
        colors,
        indices,
        material: materialIndex,
        bounds: { min, max },
        componentType: positions.length / 3 <= 65535 ? 5123 : 5125,
    });
  }
  return output;
}
