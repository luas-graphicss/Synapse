'use strict';

function mod3dApiSceneState(args = {}) {
  const all = [...mod3dGrafo.nos.values()];
  const offset = args.offset ?? 0;
  const limit = args.limit ?? 50;
  return {
    total: all.length,
    nextOffset: offset + limit < all.length ? offset + limit : null,
    undoSteps: mod3dHistorico.indice + 1,
    redoSteps: mod3dHistorico.pilha.length - mod3dHistorico.indice - 1,
    nodes: all.slice(offset, offset + limit).map((node) => ({
          nodeId: node.id,
          name: node.nome,
          type:
          Object.keys(MOD3D_API_PRIMITIVES).find((key) => MOD3D_API_PRIMITIVES[key] === node.tipo) ||
          'mesh',
          parentId: node.pai || null,
          position: node.pos.slice(),
          rotation: node.rot.slice(),
          scale: node.esc.slice(),
          pivot: node.pivo.slice(),
          parameters: Object.fromEntries(
            Object.entries(node.params).map(([key, value]) => [
                Object.keys(MOD3D_API_PARAMETERS).find(
                  (english) => MOD3D_API_PARAMETERS[english] === key,
                ) || key,
                value,
            ]),
          ),
          vertices: node.edicao ? node.edicao.pos.length / 3 : null,
          faces: node.edicao ? node.edicao.vivas : null,
          materials: node.materiais.map((material) => ({
                name: material.nome,
                color: material.cor.slice(),
                texture: material.textura || null,
          })),
    })),
  };
}

function mod3dRunApiKernel(source, action, args = {}) {
  mod3dRestoreSourceDocument(source);
  if (action === 'state') return { value: mod3dApiSceneState(args) };
  if (action === 'export') {
    const scene = mod3dCaptureGlbScene({ textureMode: args.textureMode || 'embed' });
    return { scene, textures: scene ? mod3dGlbTextureRequests(scene) : [] };
  }
  const before = mod3dCaptureSceneDocument();
  const historyAction = action === 'mesh' && ['undo', 'redo'].includes(args.operation);
  let value;
  try {
    mod3dHistorico.aplicando = !historyAction;
    if (action === 'primitive') value = mod3dApiAddPrimitive(args);
    else if (action === 'mesh') value = mod3dApiEditMesh(args);
    else if (action === 'material') value = mod3dApiApplyMaterial(args);
    else throw new Error('Unknown modeler action');
  } finally {
    mod3dHistorico.aplicando = false;
  }
  const after = mod3dCaptureSceneDocument();
  mod3dValidateSceneDocument(after);
  if (!historyAction) {
    mod3dHistoryBaseline = before;
    mod3dHistoricoPasso({
        rotulo: args.operation || action,
        chave: '',
        desfazer: () => mod3dRestoreSceneDocument(before),
        refazer: () => mod3dRestoreSceneDocument(after),
    });
  }
  const document = mod3dCaptureSourceDocument(source.documentId);
  document.textures = mod3dSourceClone(source.textures || []);
  mod3dValidateSourceDocument(document);
  return { document, value };
}

function mod3dBuildApiGlb(scene, resources) {
  const normalized = new Map(
    [...resources].map(([path, resource]) => [
        path,
        { ...resource, bytes: new Uint8Array(resource.bytes) },
    ]),
  );
  return mod3dBuildGlbDocument(scene, normalized);
}

window.MODELER_KERNEL = Object.freeze({ run: mod3dRunApiKernel, build: mod3dBuildApiGlb });
