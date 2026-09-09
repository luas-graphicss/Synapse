'use strict';

function blenderMeshPivotPoint(worldPoints) {
  const pivot = blenderCurrentTransformPivot();
  if (pivot === 'cursor') return blenderCursorPosition();
  if (pivot === 'boundingBoxCenter') return blenderBoundsCenter(worldPoints);
  if (pivot === 'activeElement') return worldPoints[worldPoints.length - 1].slice();
  return blenderMedianPoint(worldPoints);
}

function blenderCaptureMeshTransformStart() {
  if (typeof mod3dEdicaoAtiva !== 'function' || !mod3dEdicaoAtiva()) return null;
  const node = mod3dNoDaEdicao();
  const mesh = mod3dMalhaDaEdicao();
  if (!node || !mesh || node.travado) return null;
  const vertices = Array.from(mod3dVerticesDaSelecao());
  if (!vertices.length) return null;
  const worldMatrix = mod3dMatrizMundialDoNo(node);
  const basePoints = vertices.map((vertex) => mod3dMalhaEdPonto(mesh, vertex));
  return {
    kind: 'mesh',
    nodeId: node.id,
    mesh,
    vertices,
    basePoints,
    worldPoints: basePoints.map((point) => mod3dPontoPorMat(worldMatrix, point)),
    worldInverse: mod3dMatInversa(worldMatrix) || mod3dMatIdentidade(),
    snapshot: mod3dMalhaEdInstantaneo(mesh),
    selection: mod3dSelecaoDaMalhaGuardada(),
    pivot: blenderMeshPivotPoint(basePoints.map((point) => mod3dPontoPorMat(worldMatrix, point))),
    localAxes: blenderMatrixAxes(worldMatrix),
  };
}

function blenderTouchMeshEdit(start) {
  const node = mod3dNoPorId(start.nodeId);
  mod3dMalhaEdTocar(start.mesh);
  if (node) mod3dMarcarNoSujo(node);
  mod3dEdicao.projecao = null;
  if (typeof mod3dPintarMalhaNoPalco === 'function') mod3dPintarMalhaNoPalco();
  mod3dMarcarSujo();
}

function blenderWriteMeshLocalPoints(start, localPoints) {
  localPoints.forEach((point, order) => {
      mod3dMalhaEdMover(start.mesh, start.vertices[order], point[0], point[1], point[2]);
  });
  blenderTouchMeshEdit(start);
}

function blenderWriteMeshWorldPoints(start, worldPoints) {
  blenderWriteMeshLocalPoints(
    start,
    worldPoints.map((point) => mod3dPontoPorMat(start.worldInverse, point))
  );
}

function blenderApplyMeshTranslation(start, worldVector) {
  blenderWriteMeshWorldPoints(
    start,
    start.worldPoints.map((point) => blenderAddVectors(point, worldVector))
  );
}

function blenderApplyMeshRotation(start, worldAxis, degrees) {
  const spin = mod3dMatDeEixoAngulo(worldAxis, (degrees * Math.PI) / 180);
  blenderWriteMeshWorldPoints(
    start,
    start.worldPoints.map((point) => blenderRotatePointAround(point, start.pivot, spin))
  );
}

function blenderApplyMeshScale(start, factors, axisVectors) {
  blenderWriteMeshWorldPoints(
    start,
    start.worldPoints.map((point) =>
      blenderScalePointAround(point, start.pivot, factors, axisVectors)
    )
  );
}

function blenderRestoreMeshTransform(start) {
  blenderWriteMeshLocalPoints(start, start.basePoints.map((point) => point.slice()));
}

function blenderCommitMeshTransform(start, label) {
  mod3dGuardarPassoDaMalha(
    start.nodeId,
    label,
    start.snapshot,
    mod3dMalhaEdInstantaneo(start.mesh),
    start.selection,
    mod3dSelecaoDaMalhaGuardada()
  );
  mod3dCenaTocar();
  mod3dEdicaoTocar();
}
