'use strict';

function vertexNormalOfMesh(mesh, vertex) {
  const faces = mod3dMalhaEdFacesDoVertice(mesh, vertex);
  let x = 0;
  let y = 0;
  let z = 0;
  faces.forEach((face) => {
      const area = Math.max(mod3dMalhaEdAreaDaFace(mesh, face), 1e-9);
      const normal = mod3dMalhaEdNormalDaFace(mesh, face);
      x += normal[0] * area;
      y += normal[1] * area;
      z += normal[2] * area;
  });
  const length = Math.hypot(x, y, z);
  if (!(length > 1e-9)) return null;
  return [x / length, y / length, z / length];
}

function shrinkFattenMeshSelection(mesh, selection, distance) {
  const step = Number(distance);
  if (!isFinite(step) || step === 0) return { mudou: false, recado: 'Informe uma distância' };
  const vertices = Array.from(selection.vertices || []);
  if (!vertices.length) return { mudou: false, recado: 'Nada selecionado' };
  const normals = new Map();
  vertices.forEach((vertex) => {
      const normal = vertexNormalOfMesh(mesh, vertex);
      if (normal) normals.set(vertex, normal);
  });
  if (!normals.size) return { mudou: false, recado: 'A seleção não tem faces' };
  normals.forEach((normal, vertex) => {
      const point = mod3dMalhaEdPonto(mesh, vertex);
      mod3dMalhaEdMover(
        mesh,
        vertex,
        point[0] + normal[0] * step,
        point[1] + normal[1] * step,
        point[2] + normal[2] * step,
      );
  });
  return { vertices };
}

function runShrinkFattenOnSelection(distance) {
  return mod3dRodarOperacaoDeMalha('Encolher/Engordar', (mesh, selection) =>
    shrinkFattenMeshSelection(mesh, selection, distance),
  );
}
