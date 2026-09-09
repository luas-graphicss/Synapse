'use strict';

function blenderAllObjectIds() {
  if (typeof mod3dGrafo !== 'object' || !mod3dGrafo || !mod3dGrafo.nos) return [];
  return Array.from(mod3dGrafo.nos.keys());
}

function blenderSelectedObjectIds() {
  if (typeof mod3dGrafo !== 'object' || !mod3dGrafo || !Array.isArray(mod3dGrafo.selecao)) return [];
  return mod3dGrafo.selecao.slice();
}

function blenderRegisterObjectOperators() {
  blenderRegisterOperator('object.editmode_toggle', () => {
      if (typeof mod3dAlternarEdicao !== 'function') return false;
      mod3dAlternarEdicao();
      blenderSetInteractionMode(blenderViewportMode());
      return true;
  });
  blenderRegisterOperator('object.select_all', () => {
      if (typeof mod3dSelecionarNos !== 'function') return false;
      mod3dSelecionarNos(blenderAllObjectIds());
      mod3dCenaTocar();
      return true;
  });
  blenderRegisterOperator('object.select_none', () => {
      if (typeof mod3dSelecionarNos !== 'function') return false;
      mod3dSelecionarNos([]);
      mod3dCenaTocar();
      return true;
  });
  blenderRegisterOperator('object.select_all_inverse', () => {
      if (typeof mod3dSelecionarNos !== 'function') return false;
      const selected = blenderSelectedObjectIds();
      mod3dSelecionarNos(blenderAllObjectIds().filter((id) => selected.indexOf(id) === -1));
      mod3dCenaTocar();
      return true;
  });
  blenderRegisterOperator('object.duplicate_move', (context) => {
      if (typeof mod3dDuplicarSelecao !== 'function') return false;
      mod3dDuplicarSelecao();
      return blenderStartModalTransform(BLENDER_TRANSFORM_TYPES.translate, context.pointer);
  });
  blenderRegisterOperator('object.delete', () => {
      if (typeof mod3dApagarSelecao !== 'function') return false;
      mod3dApagarSelecao();
      return true;
  });
  blenderRegisterOperator('ed.undo', () => {
      if (typeof mod3dDesfazer !== 'function') return false;
      mod3dDesfazer();
      return true;
  });
  blenderRegisterOperator('ed.redo', () => {
      if (typeof mod3dRefazer !== 'function') return false;
      mod3dRefazer();
      return true;
  });
}
