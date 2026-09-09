'use strict';

const meshExtrudeModal = {
  unitsPerPixel: 0.01,
  precisionFactor: 0.1,
  running: false,
  pointerAnchored: false,
  nodeId: null,
  normal: null,
  basePositions: null,
  vertices: null,
  meshSnapshot: null,
  selectionSnapshot: null,
  startPointerY: 0,
  seedDistance: 0,
  distance: 0,
  typedDigits: '',

  start(seed) {
    if (meshExtrudeModal.running) return false;
    const node = mod3dNoDaEdicao();
    const mesh = mod3dMalhaDaEdicao();
    if (!node || !mesh) return false;
    if (node.travado) {
      mod3dEdicaoRecado('O objeto está travado');
      mod3dEdicaoTocar();
      return false;
    }
    const asked = Number(seed);
    const seedDistance =
    isFinite(asked) && asked !== 0 ? asked : MOD3D_DISTANCIA_PADRAO_DA_MALHA;
    const meshSnapshot = mod3dMalhaEdInstantaneo(mesh);
    const selectionSnapshot = mod3dSelecaoDaMalhaGuardada();
    let result = null;
    try {
      result = mod3dOpExtrudar(mesh, mod3dDadosDaSelecaoDeMalha(), seedDistance);
    } catch (erro) {
      ignorarErro(erro, 'meshExtrudeModal:start');
      result = { mudou: false, recado: 'A operação falhou' };
    }
    if (!result || result.mudou === false || !result.normal) {
      mod3dMalhaEdRestaurar(mesh, meshSnapshot);
      mod3dEdicaoRecado(result && result.recado ? result.recado : 'Nada para extrudar');
      mod3dEdicaoTocar();
      return false;
    }
    meshExtrudeModal.running = true;
    meshExtrudeModal.pointerAnchored = false;
    meshExtrudeModal.nodeId = node.id;
    meshExtrudeModal.normal = result.normal;
    meshExtrudeModal.vertices = Array.from(result.vertices || []);
    meshExtrudeModal.basePositions = new Map();
    meshExtrudeModal.vertices.forEach((vertex) => {
        const point = mod3dMalhaEdPonto(mesh, vertex);
        meshExtrudeModal.basePositions.set(vertex, [
            point[0] - result.normal[0] * seedDistance,
            point[1] - result.normal[1] * seedDistance,
            point[2] - result.normal[2] * seedDistance,
        ]);
    });
    meshExtrudeModal.meshSnapshot = meshSnapshot;
    meshExtrudeModal.selectionSnapshot = selectionSnapshot;
    meshExtrudeModal.seedDistance = seedDistance;
    meshExtrudeModal.distance = seedDistance;
    meshExtrudeModal.typedDigits = '';
    if (result.modo) mod3dEdicao.modo = mod3dModoDeMalhaSeguro(result.modo);
    mod3dAplicarDominioDaMalha(meshExtrudeModal.vertices);
    mod3dEdicao.relatorio = null;
    window.addEventListener('pointermove', meshExtrudeModal.onPointerMove, true);
    window.addEventListener('pointerdown', meshExtrudeModal.onPointerDown, true);
    window.addEventListener('keydown', meshExtrudeModal.onKeyDown, true);
    meshExtrudeModal.apply(seedDistance);
    return true;
  },

  apply(distance) {
    const node = mod3dNoPorId(meshExtrudeModal.nodeId);
    const mesh = node && node.edicao ? node.edicao : null;
    if (!mesh) {
      meshExtrudeModal.stop();
      return;
    }
    const value = Number(distance);
    if (!isFinite(value)) return;
    meshExtrudeModal.distance = value;
    meshExtrudeModal.basePositions.forEach((base, vertex) => {
        mod3dMalhaEdMover(
          mesh,
          vertex,
          base[0] + meshExtrudeModal.normal[0] * value,
          base[1] + meshExtrudeModal.normal[1] * value,
          base[2] + meshExtrudeModal.normal[2] * value,
        );
    });
    mod3dMalhaEdTocar(mesh);
    mod3dMarcarNoSujo(node);
    mod3dEdicaoRecado(`Extrudar ${value.toFixed(3)}`);
    mod3dEdicao.projecao = null;
    if (typeof mod3dPintarMalhaNoPalco === 'function') mod3dPintarMalhaNoPalco();
    mod3dMarcarSujo();
  },

  applyTypedDigits() {
    if (!meshExtrudeModal.typedDigits) {
      meshExtrudeModal.apply(meshExtrudeModal.seedDistance);
      return;
    }
    const value = Number(meshExtrudeModal.typedDigits);
    if (!isFinite(value)) return;
    meshExtrudeModal.apply(value);
  },

  confirm() {
    if (!meshExtrudeModal.running) return false;
    const node = mod3dNoPorId(meshExtrudeModal.nodeId);
    const mesh = node && node.edicao ? node.edicao : null;
    if (!mesh) {
      meshExtrudeModal.stop();
      return false;
    }
    const before = meshExtrudeModal.meshSnapshot;
    const selectionBefore = meshExtrudeModal.selectionSnapshot;
    const distance = meshExtrudeModal.distance;
    const map = mod3dMalhaEdCompactar(mesh);
    const vertices = new Set();
    meshExtrudeModal.vertices.forEach((vertex) => {
        const moved = map && vertex >= 0 && vertex < map.length ? map[vertex] : -1;
        if (moved >= 0) vertices.add(moved);
    });
    mod3dAplicarDominioDaMalha(vertices);
    mod3dMarcarNoSujo(node);
    mod3dEdicaoRecado(`Extrudar ${distance.toFixed(3)}`);
    mod3dGuardarPassoDaMalha(
      node.id,
      'Extrudar',
      before,
      mod3dMalhaEdInstantaneo(mesh),
      selectionBefore,
      mod3dSelecaoDaMalhaGuardada(),
    );
    meshExtrudeModal.stop();
    mod3dCenaTocar();
    mod3dEdicaoTocar();
    return true;
  },

  cancel() {
    if (!meshExtrudeModal.running) return false;
    const nodeId = meshExtrudeModal.nodeId;
    const snapshot = meshExtrudeModal.meshSnapshot;
    const selection = meshExtrudeModal.selectionSnapshot;
    meshExtrudeModal.stop();
    mod3dVoltarMalhaDoNo(nodeId, snapshot, selection);
    mod3dEdicaoRecado('Extrude cancelado');
    mod3dEdicaoTocar();
    return true;
  },

  stop() {
    window.removeEventListener('pointermove', meshExtrudeModal.onPointerMove, true);
    window.removeEventListener('pointerdown', meshExtrudeModal.onPointerDown, true);
    window.removeEventListener('keydown', meshExtrudeModal.onKeyDown, true);
    meshExtrudeModal.running = false;
    meshExtrudeModal.pointerAnchored = false;
    meshExtrudeModal.nodeId = null;
    meshExtrudeModal.normal = null;
    meshExtrudeModal.basePositions = null;
    meshExtrudeModal.vertices = null;
    meshExtrudeModal.meshSnapshot = null;
    meshExtrudeModal.selectionSnapshot = null;
    meshExtrudeModal.typedDigits = '';
  },

  onPointerMove(evento) {
    if (!meshExtrudeModal.running) return;
    if (!meshExtrudeModal.pointerAnchored) {
      meshExtrudeModal.pointerAnchored = true;
      meshExtrudeModal.startPointerY = evento.clientY;
      return;
    }
    if (meshExtrudeModal.typedDigits) return;
    const factor = evento.shiftKey
    ? meshExtrudeModal.unitsPerPixel * meshExtrudeModal.precisionFactor
    : meshExtrudeModal.unitsPerPixel;
    const moved = (meshExtrudeModal.startPointerY - evento.clientY) * factor;
    meshExtrudeModal.apply(meshExtrudeModal.seedDistance + moved);
  },

  onPointerDown(evento) {
    if (!meshExtrudeModal.running) return;
    evento.preventDefault();
    evento.stopPropagation();
    if (evento.button === 2) {
      meshExtrudeModal.cancel();
      return;
    }
    meshExtrudeModal.confirm();
  },

  onKeyDown(evento) {
    if (!meshExtrudeModal.running) return;
    const key = String(evento.key || '');
    const lower = key.toLowerCase();
    if (lower === 'escape') {
      evento.preventDefault();
      evento.stopPropagation();
      meshExtrudeModal.cancel();
      return;
    }
    if (lower === 'enter') {
      evento.preventDefault();
      evento.stopPropagation();
      meshExtrudeModal.confirm();
      return;
    }
    if (lower === 'backspace') {
      evento.preventDefault();
      evento.stopPropagation();
      meshExtrudeModal.typedDigits = meshExtrudeModal.typedDigits.slice(0, -1);
      meshExtrudeModal.applyTypedDigits();
      return;
    }
    if (key === '-' || key === '.' || (key >= '0' && key <= '9')) {
      evento.preventDefault();
      evento.stopPropagation();
      meshExtrudeModal.typedDigits = meshExtrudeModal.typedDigits + key;
      meshExtrudeModal.applyTypedDigits();
    }
  },
};
