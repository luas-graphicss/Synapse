'use strict';

const blenderMeshModalOperatorState = {
  session: null,
  nodeId: '',
  meshSnapshot: null,
  selectionSnapshot: null,
};

function blenderMeshModalOperatorIsRunning() {
  return blenderMeshModalOperatorState.session !== null;
}

function blenderMeshModalOperatorSession() {
  return blenderMeshModalOperatorState.session;
}

function blenderMeshModalNode() {
  const node = mod3dNoPorId(blenderMeshModalOperatorState.nodeId);
  return node && node.edicao ? node : null;
}

function blenderMeshModalRepaint(node) {
  mod3dMalhaEdTocar(node.edicao);
  node.malha = null;
  mod3dMarcarNoSujo(node);
  mod3dEdicao.projecao = null;
  if (typeof mod3dPintarMalhaNoPalco === 'function') mod3dPintarMalhaNoPalco();
  mod3dMarcarSujo();
}

function blenderMeshModalRestoreBase(node) {
  mod3dMalhaEdRestaurar(node.edicao, blenderMeshModalOperatorState.meshSnapshot);
  mod3dRestaurarSelecaoDaMalha(blenderMeshModalOperatorState.selectionSnapshot);
}

function blenderMeshModalRunOperator(session, mesh) {
  try {
    return session.definition.run(
      mesh,
      mod3dDadosDaSelecaoDeMalha(),
      blenderMeshModalSessionValue(session),
      blenderMeshModalSessionSegments(session),
    );
  } catch (error) {
    ignorarErro(error, 'blenderMeshModal:operacao');
    return { mudou: false, recado: 'A operação falhou' };
  }
}

function blenderMeshModalRunPreview() {
  const session = blenderMeshModalOperatorState.session;
  const node = blenderMeshModalNode();
  if (!session || !node) return { changed: false, message: 'A edição foi encerrada' };
  blenderMeshModalRestoreBase(node);
  const result = blenderMeshModalRunOperator(session, node.edicao);
  if (!result || result.mudou === false) {
    const message = result && result.recado ? result.recado : 'Nada para fazer';
    blenderMeshModalRestoreBase(node);
    blenderMeshModalRepaint(node);
    blenderPaintModalTransformHeader(blenderMeshModalMessageText(session, message));
    return { changed: false, message };
  }
  if (result.modo) mod3dEdicao.modo = mod3dModoDeMalhaSeguro(result.modo);
  mod3dAplicarDominioDaMalha(new Set(result.vertices || []));
  blenderMeshModalRepaint(node);
  blenderPaintModalTransformHeader(blenderMeshModalHeaderText(session));
  return { changed: true, message: result.recado || '' };
}

function blenderStopMeshModalOperator() {
  blenderMeshModalOperatorState.session = null;
  blenderMeshModalOperatorState.nodeId = '';
  blenderMeshModalOperatorState.meshSnapshot = null;
  blenderMeshModalOperatorState.selectionSnapshot = null;
  blenderClearModalTransformHeader();
  return true;
}

function blenderCancelMeshModalOperator() {
  if (!blenderMeshModalOperatorIsRunning()) return false;
  const nodeId = blenderMeshModalOperatorState.nodeId;
  const meshSnapshot = blenderMeshModalOperatorState.meshSnapshot;
  const selectionSnapshot = blenderMeshModalOperatorState.selectionSnapshot;
  blenderStopMeshModalOperator();
  mod3dVoltarMalhaDoNo(nodeId, meshSnapshot, selectionSnapshot);
  return true;
}

function blenderStartMeshModalOperator(operatorKey, pointer) {
  if (blenderMeshModalOperatorIsRunning()) blenderCancelMeshModalOperator();
  const definition = blenderMeshModalDefinition(operatorKey);
  if (!definition) return false;
  if (typeof mod3dEdicaoAtiva !== 'function' || !mod3dEdicaoAtiva()) return false;
  const node = mod3dNoDaEdicao();
  const mesh = mod3dMalhaDaEdicao();
  if (!node || !mesh) return false;
  if (node.travado) {
    mod3dEdicaoRecado('O objeto está travado');
    mod3dEdicaoTocar();
    return false;
  }
  blenderMeshModalOperatorState.nodeId = node.id;
  blenderMeshModalOperatorState.meshSnapshot = mod3dMalhaEdInstantaneo(mesh);
  blenderMeshModalOperatorState.selectionSnapshot = mod3dSelecaoDaMalhaGuardada();
  blenderMeshModalOperatorState.session = blenderCreateMeshModalSession(definition, pointer);
  const preview = blenderMeshModalRunPreview();
  if (preview.changed) return true;
  blenderStopMeshModalOperator();
  mod3dEdicaoRecado(preview.message);
  mod3dEdicaoTocar();
  return false;
}

function blenderUpdateMeshModalOperator() {
  if (!blenderMeshModalOperatorIsRunning()) return false;
  blenderMeshModalRunPreview();
  return true;
}

function blenderConfirmMeshModalOperator() {
  const session = blenderMeshModalOperatorState.session;
  const node = blenderMeshModalNode();
  if (!session || !node) return blenderStopMeshModalOperator();
  const mesh = node.edicao;
  const historyLabel = session.definition.historyLabel;
  const valueText = blenderMeshModalSessionValue(session).toFixed(session.definition.decimals);
  const meshBefore = blenderMeshModalOperatorState.meshSnapshot;
  const selectionBefore = blenderMeshModalOperatorState.selectionSnapshot;
  const selectedVertices = Array.from(mod3dEdicao.vertices);
  const map = mod3dMalhaEdCompactar(mesh);
  const kept = new Set();
  selectedVertices.forEach((vertex) => {
      const moved = map && vertex >= 0 && vertex < map.length ? map[vertex] : -1;
      if (moved >= 0) kept.add(moved);
  });
  mod3dAplicarDominioDaMalha(kept);
  node.malha = null;
  mod3dMarcarNoSujo(node);
  mod3dEdicaoRecado(`${historyLabel} ${valueText}`);
  mod3dEdicao.relatorio = null;
  mod3dGuardarPassoDaMalha(
    node.id,
    historyLabel,
    meshBefore,
    mod3dMalhaEdInstantaneo(mesh),
    selectionBefore,
    mod3dSelecaoDaMalhaGuardada(),
  );
  blenderStopMeshModalOperator();
  mod3dCenaTocar();
  mod3dEdicaoTocar();
  return true;
}
