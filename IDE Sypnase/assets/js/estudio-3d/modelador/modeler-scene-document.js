'use strict';

function mod3dCaptureEditableMesh(mesh) {
  if (!mesh) return null;
  return {
    positions: mesh.pos.slice(),
    faces: mesh.faces.map((face) => (face ? face.slice() : null)),
    smooth: mesh.faces.map((face, index) => mesh.suave[index] === true),
    uv: mesh.faces.map((face, index) =>
      face && mesh.uv[index] ? Array.from(mesh.uv[index]) : null,
    ),
    materialIndices: mesh.faces.map((face, index) => mesh.mat[index] || 0),
    colors: mesh.cores ? mesh.cores.slice() : null,
    shading: mesh.sombreamento,
    smoothAngle: mesh.angulo,
  };
}

function mod3dCaptureSceneDocument() {
  return {
    nodes: Array.from(mod3dGrafo.nos.values(), (node) => ({
          id: node.id,
          name: node.nome,
          type: node.tipo,
          parent: node.pai,
          children: node.filhos.slice(),
          position: node.pos.slice(),
          rotation: node.rot.slice(),
          scale: node.esc.slice(),
          pivot: node.pivo.slice(),
          parameters: { ...node.params },
          color: node.cor.slice(),
          visible: node.visivel,
          locked: node.travado,
          materials: mod3dSourceClone(node.materiais || []),
          uvProjection: node.projecao || 'cubica',
          mesh: mod3dCaptureEditableMesh(node.edicao),
    })),
    roots: mod3dGrafo.raizes.slice(),
    selection: mod3dGrafo.selecao.slice(),
    nextId: mod3dGrafo.contador,
  };
}

function mod3dRestoreEditableMesh(source) {
  if (!source) return null;
  const mesh = mod3dMalhaEditavel();
  mesh.pos = source.positions.slice();
  mesh.faces = source.faces.map((face) => (face ? face.slice() : null));
  mesh.suave = source.smooth.slice();
  mesh.uv = source.uv.map((coordinates) => (coordinates ? coordinates.slice() : null));
  mesh.mat = source.materialIndices.slice();
  mesh.cores = source.colors ? source.colors.slice() : null;
  mesh.vivas = mesh.faces.filter(Boolean).length;
  mesh.sombreamento = source.shading;
  mesh.angulo = source.smoothAngle;
  return mesh;
}

function mod3dRestoreSceneDocument(scene, options = {}) {
  mod3dValidateSceneDocument(scene);
  const nodes = new Map(
    scene.nodes.map((source) => [
        source.id,
        {
          id: source.id,
          nome: source.name,
          tipo: source.type,
          pai: source.parent,
          filhos: source.children.slice(),
          pos: source.position.slice(),
          rot: source.rotation.slice(),
          esc: source.scale.slice(),
          pivo: source.pivot.slice(),
          params: { ...source.parameters },
          cor: source.color.slice(),
          visivel: source.visible,
          travado: source.locked,
          materiais: mod3dSourceClone(source.materials),
          projecao: source.uvProjection,
          edicao: mod3dRestoreEditableMesh(source.mesh),
          malha: null,
          mundo: null,
          versao: mod3dGrafo.versao + 1,
        },
    ]),
  );
  mod3dGrafo.nos = nodes;
  mod3dGrafo.raizes = scene.roots.slice();
  mod3dGrafo.selecao = scene.selection.slice();
  mod3dGrafo.contador = scene.nextId;
  if (typeof mod3dEdicao !== 'undefined') {
    mod3dEdicao.no = '';
    mod3dEdicao.vertices.clear();
    mod3dEdicao.arestas.clear();
    mod3dEdicao.faces.clear();
    mod3dEdicao.arraste = null;
    mod3dEdicao.projecao = null;
  }
  if (typeof mod3dCena !== 'undefined') {
    for (const key of mod3dCena.pecas.keys()) mod3dCena.pecas.set(key, '');
    mod3dCena.selecaoPintada = '';
    mod3dCena.alcas = '';
  }
  if (options.notify !== false) mod3dCenaTocar();
  return scene;
}

function mod3dCaptureSourceDocument(documentId) {
  return {
    format: MOD3D_SOURCE_FORMAT,
    version: MOD3D_SOURCE_VERSION,
    documentId,
    scene: mod3dCaptureSceneDocument(),
    history: mod3dCaptureHistoryDocument(),
    textures:
    typeof mod3dCaptureTextureDocument === 'function' ? mod3dCaptureTextureDocument() : [],
  };
}

function mod3dRestoreSourceDocument(source) {
  mod3dValidateSourceDocument(source);
  mod3dRestoreSceneDocument(source.scene, { notify: false });
  if (typeof mod3dRestoreTextureDocument === 'function') {
    mod3dRestoreTextureDocument(source.textures);
  }
  mod3dRestoreHistoryDocument(source.history);
  mod3dCenaTocar();
  return source;
}
