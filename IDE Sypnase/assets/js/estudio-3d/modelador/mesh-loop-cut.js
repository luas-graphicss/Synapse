'use strict';

const MESH_LOOP_CUT_MINIMUM_CUTS = 1;
const MESH_LOOP_CUT_MAXIMUM_CUTS = 12;
const MESH_LOOP_CUT_MINIMUM_FACTOR = 0.02;
const MESH_LOOP_CUT_MAXIMUM_FACTOR = 0.98;

function loopCutSafeCuts(cuts) {
  const total = Math.round(Number(cuts));
  if (!isFinite(total)) return MESH_LOOP_CUT_MINIMUM_CUTS;
  return Math.min(MESH_LOOP_CUT_MAXIMUM_CUTS, Math.max(MESH_LOOP_CUT_MINIMUM_CUTS, total));
}

function loopCutSafeSlide(slide) {
  const value = Number(slide);
  if (!isFinite(value)) return 0;
  return Math.min(1, Math.max(-1, value));
}

function loopCutFactors(cuts, slide) {
  const total = loopCutSafeCuts(cuts);
  const offset = loopCutSafeSlide(slide);
  const gap = 1 / (total + 1);
  const factors = [];
  for (let index = 0; index < total; index++) {
    const placed = (index + 1) * gap + offset * gap * 0.96;
    const limited = Math.min(MESH_LOOP_CUT_MAXIMUM_FACTOR, Math.max(MESH_LOOP_CUT_MINIMUM_FACTOR, placed));
    factors.push(limited);
  }
  return factors;
}

function loopCutCreateEdgeVertices(mesh, fromVertex, toVertex, factors) {
  const start = mod3dMalhaEdPonto(mesh, fromVertex);
  const end = mod3dMalhaEdPonto(mesh, toVertex);
  const created = [];
  for (let index = 0; index < factors.length; index++) {
    const factor = factors[index];
    const vertex = mod3dMalhaEdVertice(
      mesh,
      start[0] + (end[0] - start[0]) * factor,
      start[1] + (end[1] - start[1]) * factor,
      start[2] + (end[2] - start[2]) * factor,
    );
    if (vertex < 0) return null;
    created.push(vertex);
  }
  return created;
}

function loopCutEdgeEntry(mesh, entries, edgeKey, fromVertex, toVertex, factors) {
  const found = entries.get(edgeKey);
  if (found) return found;
  const created = loopCutCreateEdgeVertices(mesh, fromVertex, toVertex, factors);
  if (!created) return null;
  const entry = { from: fromVertex, vertices: created };
  entries.set(edgeKey, entry);
  return entry;
}

function loopCutVerticesFrom(entry, fromVertex) {
  if (entry.from === fromVertex) return entry.vertices.slice();
  return entry.vertices.slice().reverse();
}

function loopCutSequence(mesh, entries, edgeKey, fromVertex, toVertex, factors) {
  const entry = loopCutEdgeEntry(mesh, entries, edgeKey, fromVertex, toVertex, factors);
  if (!entry) return null;
  return [fromVertex].concat(loopCutVerticesFrom(entry, fromVertex), [toVertex]);
}

function loopCutQuadCorners(mesh, face, entryKey) {
  const ring = mesh.faces[face];
  if (!ring || ring.length !== 4) return null;
  for (let index = 0; index < 4; index++) {
    if (mod3dChaveDaAresta(ring[index], ring[(index + 1) % 4]) !== entryKey) continue;
    return {
      entryStart: ring[index],
      entryEnd: ring[(index + 1) % 4],
      exitEnd: ring[(index + 2) % 4],
      exitStart: ring[(index + 3) % 4],
    };
  }
  return null;
}

function loopCutSplitQuad(mesh, entries, quad, factors) {
  const corners = loopCutQuadCorners(mesh, quad.face, quad.entrada);
  if (!corners) return 0;
  const smooth = mesh.suave[quad.face] === true;
  const entrySequence = loopCutSequence(
    mesh,
    entries,
    quad.entrada,
    corners.entryStart,
    corners.entryEnd,
    factors,
  );
  const exitSequence = loopCutSequence(
    mesh,
    entries,
    quad.saida,
    corners.exitStart,
    corners.exitEnd,
    factors,
  );
  if (!entrySequence || !exitSequence) return -1;
  let created = 0;
  for (let step = 0; step < entrySequence.length - 1; step++) {
    const ring = [
      entrySequence[step],
      entrySequence[step + 1],
      exitSequence[step + 1],
      exitSequence[step],
    ];
    if (mod3dMalhaEdFace(mesh, ring, smooth) >= 0) created += 1;
  }
  if (!created) return 0;
  mod3dMalhaEdApagarFace(mesh, quad.face);
  return created;
}

function loopCutInsertIntoNeighbours(mesh, entries, adjacency, cutFaces) {
  entries.forEach((entry, edgeKey) => {
      const edge = adjacency.arestas.get(edgeKey);
      if (!edge) return;
      edge.faces.forEach((face) => {
          if (cutFaces.has(face)) return;
          const ring = mesh.faces[face];
          if (!ring) return;
          for (let index = 0; index < ring.length; index++) {
            if (mod3dChaveDaAresta(ring[index], ring[(index + 1) % ring.length]) !== edgeKey) continue;
            const inserted = loopCutVerticesFrom(entry, ring[index]);
            mesh.faces[face] = ring.slice(0, index + 1).concat(inserted, ring.slice(index + 1));
            break;
          }
      });
  });
}

function loopCutCreatedVertices(entries) {
  const chosen = [];
  entries.forEach((entry) => {
      entry.vertices.forEach((vertex) => chosen.push(vertex));
  });
  return chosen;
}

function loopCutMeshSelection(mesh, selection, cuts, slide) {
  const chosenEdges = Array.from(selection.arestas || []);
  if (!chosenEdges.length) return { mudou: false, recado: 'Escolha uma aresta' };
  const ring = mod3dAnelDeCorte(mesh, chosenEdges[0]);
  if (!ring) return { mudou: false, recado: 'O corte precisa de um anel de quads' };
  const adjacency = mod3dMalhaEdAdjacencia(mesh);
  const factors = loopCutFactors(cuts, slide);
  const entries = new Map();
  const cutFaces = new Set();
  let created = 0;
  let reachedLimit = false;
  ring.quads.forEach((quad) => {
      if (reachedLimit) return;
      const made = loopCutSplitQuad(mesh, entries, quad, factors);
      if (made < 0) {
        reachedLimit = true;
        return;
      }
      if (made > 0) {
        created += made;
        cutFaces.add(quad.face);
      }
  });
  if (reachedLimit) return { mudou: false, recado: 'A malha chegou ao limite' };
  if (!created) return { mudou: false, recado: 'Nada para cortar' };
  loopCutInsertIntoNeighbours(mesh, entries, adjacency, cutFaces);
  return { vertices: loopCutCreatedVertices(entries), modo: 'aresta' };
}
