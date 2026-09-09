'use strict';

function blenderSelectedObjectItems() {
  const ids = typeof mod3dGrafo === 'object' && mod3dGrafo && Array.isArray(mod3dGrafo.selecao)
  ? mod3dGrafo.selecao.slice()
  : [];
  const items = [];
  ids.forEach((id) => {
      const node = mod3dNoPorId(id);
      if (!node || node.travado) return;
      const parentMatrix = mod3dMatrizDoPaiDoNo(node);
      items.push({
          id,
          state: mod3dEstadoDoNo(node),
          rotation: node.rot.slice(),
          scale: node.esc.slice(),
          parentMatrix,
          parentInverse: mod3dMatInversa(parentMatrix) || mod3dMatIdentidade(),
          worldOrigin: mod3dPontoPorMat(parentMatrix, node.pos),
          worldAxes: blenderMatrixAxes(mod3dMatrizMundialDoNo(node)),
      });
  });
  return items;
}

function blenderObjectPivotPoint(items) {
  const origins = items.map((item) => item.worldOrigin);
  const pivot = blenderCurrentTransformPivot();
  if (pivot === 'cursor') return blenderCursorPosition();
  if (pivot === 'activeElement') return origins[0].slice();
  if (pivot === 'boundingBoxCenter') return blenderBoundsCenter(origins);
  return blenderMedianPoint(origins);
}

function blenderCaptureObjectTransformStart() {
  const items = blenderSelectedObjectItems();
  if (!items.length) return null;
  return {
    kind: 'object',
    items,
    pivot: blenderObjectPivotPoint(items),
    localAxes: items[0].worldAxes,
  };
}

function blenderObjectItemPivot(start, item) {
  if (blenderCurrentTransformPivot() === 'individualOrigins') return item.worldOrigin;
  return start.pivot;
}

function blenderPlaceObjectItem(item, worldOrigin) {
  const node = mod3dNoPorId(item.id);
  if (!node) return;
  node.pos = mod3dPosicaoSegura(mod3dPontoPorMat(item.parentInverse, worldOrigin));
  mod3dMarcarNoSujo(node);
}

function blenderApplyObjectTranslation(start, worldVector) {
  start.items.forEach((item) => {
      blenderPlaceObjectItem(item, blenderAddVectors(item.worldOrigin, worldVector));
  });
  mod3dCenaTocar();
}

function blenderApplyObjectRotation(start, worldAxis, degrees) {
  const radians = (degrees * Math.PI) / 180;
  const worldSpin = mod3dMatDeEixoAngulo(worldAxis, radians);
  start.items.forEach((item) => {
      const node = mod3dNoPorId(item.id);
      if (!node) return;
      const parentAxis = mod3dNormalizarVetor(mod3dVetorPorMat(item.parentInverse, worldAxis));
      const parentSpin = mod3dMatDeEixoAngulo(parentAxis, radians);
      const initialLocal = mod3dMatDeTRS([0, 0, 0], item.rotation, [1, 1, 1]);
      node.rot = mod3dRotacaoSegura(
        mod3dGrausDaMatriz(mod3dMatMultiplicar(parentSpin, initialLocal))
      );
      blenderPlaceObjectItem(
        item,
        blenderRotatePointAround(item.worldOrigin, blenderObjectItemPivot(start, item), worldSpin)
      );
  });
  mod3dCenaTocar();
}

function blenderApplyObjectScale(start, factors, axisVectors) {
  start.items.forEach((item) => {
      const node = mod3dNoPorId(item.id);
      if (!node) return;
      node.esc = mod3dEscalaSegura([
          item.scale[0] * factors[0],
          item.scale[1] * factors[1],
          item.scale[2] * factors[2],
      ]);
      blenderPlaceObjectItem(
        item,
        blenderScalePointAround(
          item.worldOrigin,
          blenderObjectItemPivot(start, item),
          factors,
          axisVectors
        )
      );
  });
  mod3dCenaTocar();
}

function blenderRestoreObjectTransform(start) {
  start.items.forEach((item) => mod3dAplicarEstadoNoNo(item.id, item.state));
  mod3dCenaTocar();
}

function blenderCommitObjectTransform(start, label) {
  const steps = [];
  start.items.forEach((item) => {
      const node = mod3dNoPorId(item.id);
      if (!node) return;
      steps.push({ id: item.id, antes: item.state, depois: mod3dEstadoDoNo(node) });
  });
  mod3dPassoDeEstados(label, steps, '');
  mod3dCenaTocar();
}
