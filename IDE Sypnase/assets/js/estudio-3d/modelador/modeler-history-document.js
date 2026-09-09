'use strict';

let mod3dHistoryBaseline = null;
let mod3dHistoryOmitted = 0;

function mod3dResetHistoryDocument() {
  mod3dHistoryBaseline = mod3dCaptureSceneDocument();
  mod3dHistoryOmitted = 0;
}

function mod3dRecordHistoryDocument(step, merged) {
  const after = mod3dCaptureSceneDocument();
  const before = merged && step.sourceStep ? step.sourceStep.before : mod3dHistoryBaseline;
  step.sourceStep = {
    label: String(step.rotulo || 'Change').slice(0, 120),
    key: String(step.chave || '').slice(0, 200),
    before: before || after,
    after,
  };
  mod3dHistoryBaseline = after;
  let bytes = 0;
  for (let index = mod3dHistorico.pilha.length - 1; index >= 0; index -= 1) {
    const entry = mod3dHistorico.pilha[index];
    if (!entry.sourceStep) continue;
    bytes += new TextEncoder().encode(JSON.stringify(entry.sourceStep)).length;
    if (bytes <= MOD3D_SOURCE_HISTORY_BYTES - 1024) continue;
    delete entry.sourceStep;
    mod3dHistoryOmitted += 1;
  }
}

function mod3dRefreshHistoryBaseline() {
  mod3dHistoryBaseline = mod3dCaptureSceneDocument();
}

function mod3dCaptureHistoryDocument() {
  const stack = mod3dHistorico.pilha;
  let first = stack.length;
  while (first > 0 && stack[first - 1].sourceStep) first -= 1;
  if (mod3dHistorico.indice < first - 1) {
    return { steps: [], index: -1, omitted: mod3dHistoryOmitted + stack.length };
  }
  return {
    steps: stack.slice(first).map((step) => step.sourceStep),
    index: mod3dHistorico.indice - first,
    omitted: Math.max(mod3dHistoryOmitted, first),
  };
}

function mod3dRestoreHistoryDocument(history) {
  mod3dHistorico.pilha = history.steps.map((entry) => {
      const sourceStep = mod3dSourceClone(entry);
      return {
        rotulo: entry.label,
        chave: entry.key,
        marca: -Infinity,
        sourceStep,
        desfazer: () => mod3dRestoreSceneDocument(sourceStep.before),
        refazer: () => mod3dRestoreSceneDocument(sourceStep.after),
      };
  });
  mod3dHistorico.indice = history.index;
  mod3dHistorico.grupo = '';
  mod3dHistoryOmitted = history.omitted;
  mod3dRefreshHistoryBaseline();
  mod3dHistoricoTocar();
}
