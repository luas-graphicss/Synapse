'use strict';

function nodeHasEditableMesh(node) {
  return Boolean(node && node.tipo === 'malha' && node.edicao);
}

function editableMeshVersionOfNode(node) {
  return nodeHasEditableMesh(node) ? node.edicao.versao : 0;
}

function editableMeshGeometryOfNode(node) {
  if (!nodeHasEditableMesh(node)) return null;
  node.malha = mod3dMalhaEdTriangular(node.edicao);
  return node.malha;
}
