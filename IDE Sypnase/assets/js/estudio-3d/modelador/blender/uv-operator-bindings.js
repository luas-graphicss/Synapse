'use strict';

const BLENDER_UV_PROJECTION_OPERATORS = Object.freeze({
    'uv.project_from_view': 'plana',
    'uv.cube_project': 'cubica',
    'uv.cylinder_project': 'cilindrica',
    'uv.sphere_project': 'esferica',
});

function blenderRepaintUvEditor() {
  if (typeof mod3dPintarEditorUv === 'function') mod3dPintarEditorUv();
}

function blenderMeshEditIsActive() {
  return typeof mod3dEdicaoAtiva === 'function' && mod3dEdicaoAtiva() === true;
}

function blenderRunUvProjection(projectionKey) {
  if (!blenderMeshEditIsActive()) return false;
  if (typeof mod3dProjetarUvDaSelecao !== 'function') return false;
  mod3dProjetarUvDaSelecao(projectionKey);
  blenderRepaintUvEditor();
  return true;
}

function blenderRunUvUnwrap() {
  if (!blenderMeshEditIsActive()) return false;
  if (typeof mod3dDesdobrarUvDaSelecao !== 'function') return false;
  mod3dDesdobrarUvDaSelecao(MOD3D_ANGULO_DA_ILHA_PADRAO);
  blenderRepaintUvEditor();
  return true;
}

function blenderRegisterUvOperators() {
  blenderRegisterOperator('uv.unwrap', () => blenderRunUvUnwrap());
  Object.keys(BLENDER_UV_PROJECTION_OPERATORS).forEach((operatorId) => {
      blenderRegisterOperator(operatorId, () =>
        blenderRunUvProjection(BLENDER_UV_PROJECTION_OPERATORS[operatorId])
      );
  });
}
