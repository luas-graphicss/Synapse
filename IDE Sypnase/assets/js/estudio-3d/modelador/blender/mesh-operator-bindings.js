'use strict';

const BLENDER_MESH_SELECT_MODE_KEYS = Object.freeze({
    vertex: 'vertice',
    edge: 'aresta',
    face: 'face',
});

function blenderApplyMeshSelectMode(modeId) {
  const key = BLENDER_MESH_SELECT_MODE_KEYS[modeId];
  if (!key || typeof mod3dDefinirModoDeMalha !== 'function') return false;
  mod3dDefinirModoDeMalha(key);
  blenderSetMeshSelectMode(modeId);
  return true;
}

function blenderRegisterMeshSelectOperators() {
  blenderRegisterOperator('mesh.select_mode_vertex', () => blenderApplyMeshSelectMode('vertex'));
  blenderRegisterOperator('mesh.select_mode_edge', () => blenderApplyMeshSelectMode('edge'));
  blenderRegisterOperator('mesh.select_mode_face', () => blenderApplyMeshSelectMode('face'));
  blenderRegisterOperator('mesh.select_all', () => {
      if (typeof mod3dSelecionarTudoNaMalha !== 'function') return false;
      mod3dSelecionarTudoNaMalha();
      return true;
  });
  blenderRegisterOperator('mesh.select_none', () => {
      if (typeof mod3dLimparSelecaoDeMalha !== 'function') return false;
      mod3dLimparSelecaoDeMalha();
      mod3dEdicaoTocar();
      return true;
  });
  blenderRegisterOperator('mesh.select_all_inverse', () => {
      if (typeof mod3dInverterSelecaoDeMalha !== 'function') return false;
      mod3dInverterSelecaoDeMalha();
      return true;
  });
  blenderRegisterOperator('mesh.select_more', () => {
      if (typeof mod3dCrescerSelecaoDeMalha !== 'function') return false;
      mod3dCrescerSelecaoDeMalha();
      return true;
  });
  blenderRegisterOperator('mesh.select_less', () => {
      if (typeof mod3dEncolherSelecaoDeMalha !== 'function') return false;
      mod3dEncolherSelecaoDeMalha();
      return true;
  });
  blenderRegisterOperator('mesh.select_linked', () => {
      if (typeof mod3dSelecionarLigadosNaMalha !== 'function') return false;
      mod3dSelecionarLigadosNaMalha();
      return true;
  });
}

function blenderRegisterMeshEditOperators() {
  blenderRegisterOperator('mesh.extrude_region_and_move', (context) =>
    blenderStartMeshModalOperator('extrude', context ? context.pointer : null),
  );
  blenderRegisterOperator('transform.shrink_fatten', (context) =>
    blenderStartMeshModalOperator('shrinkFatten', context ? context.pointer : null),
  );
  blenderRegisterOperator('mesh.inset_faces', (context) =>
    blenderStartMeshModalOperator('inset', context ? context.pointer : null),
  );
  blenderRegisterOperator('mesh.bevel', (context) =>
    blenderStartMeshModalOperator('bevel', context ? context.pointer : null),
  );
  blenderRegisterOperator('mesh.subdivide', () => {
      if (typeof mod3dSubdividirSelecao !== 'function') return false;
      mod3dSubdividirSelecao();
      return true;
  });
  blenderRegisterOperator('mesh.loopcut_slide', (context) =>
    blenderStartMeshModalOperator('loopCut', context ? context.pointer : null),
  );
  blenderRegisterOperator('mesh.bridge_edge_loops', () => {
      if (typeof mod3dPontearSelecao !== 'function') return false;
      mod3dPontearSelecao();
      return true;
  });
  blenderRegisterOperator('mesh.edge_rotate', () => {
      if (typeof mod3dGirarArestaNaSelecao !== 'function') return false;
      mod3dGirarArestaNaSelecao();
      return true;
  });
  blenderRegisterOperator('mesh.merge', () => {
      if (typeof mod3dFundirSelecao !== 'function') return false;
      mod3dFundirSelecao();
      return true;
  });
  blenderRegisterOperator('mesh.edge_face_add', () => {
      if (typeof mod3dPreencherBuracoNaSelecao !== 'function') return false;
      mod3dPreencherBuracoNaSelecao();
      return true;
  });
  blenderRegisterOperator('mesh.delete', () => {
      if (typeof mod3dApagarSelecaoDeMalha !== 'function') return false;
      mod3dApagarSelecaoDeMalha();
      return true;
  });
  blenderRegisterOperator('mesh.normals_make_consistent', () => {
      if (typeof mod3dRecalcularNormaisDaEdicao !== 'function') return false;
      mod3dRecalcularNormaisDaEdicao();
      return true;
  });
  blenderRegisterOperator('mesh.flip_normals', () => {
      if (typeof mod3dInverterNormaisDaEdicao !== 'function') return false;
      mod3dInverterNormaisDaEdicao();
      return true;
  });
}

function blenderRegisterMeshOperators() {
  blenderRegisterMeshSelectOperators();
  blenderRegisterMeshEditOperators();
}
