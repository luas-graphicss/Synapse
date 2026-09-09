'use strict';

function mod3dApiAddPrimitive(args) {
  const type = MOD3D_API_PRIMITIVES[args.primitive];
  mod3dSourceAssert(type, 'Unknown primitive');
  const parent = args.parentId ? mod3dNoPorId(args.parentId) : null;
  mod3dSourceAssert(!args.parentId || (parent && !parent.travado), 'Parent not found or locked');
  const node = mod3dCriarNo({
      tipo: type,
      nome: mod3dApiName(args.name, args.primitive),
      params: mod3dApiParameters(type, args.parameters),
      pai: args.parentId || '',
  });
  mod3dSourceAssert(node, 'Scene node limit reached');
  mod3dApiTransform(node, args);
  mod3dGrafo.selecao = [node.id];
  return { nodeId: node.id };
}

function mod3dApiEditableNode(node) {
  mod3dSourceAssert(
    node && node.tipo !== 'grupo' && !node.travado,
    'Choose an unlocked geometry node',
  );
  if (!node.edicao) {
    node.edicao = mod3dMalhaEdDaPrimitiva(node.tipo, node.params);
    mod3dSourceAssert(node.edicao, 'Node has no editable geometry');
    node.tipo = 'malha';
    node.params = {};
  }
  return node.edicao;
}

function mod3dApiEditMesh(args) {
  const operation = args.operation;
  mod3dSourceAssert(MOD3D_API_OPERATIONS.includes(operation), 'Unknown mesh operation');
  if (operation === 'undo' || operation === 'redo') {
    mod3dSourceAssert(
      operation === 'undo' ? mod3dDesfazer() : mod3dRefazer(),
      'No history step available',
    );
    return { operation };
  }
  const node = mod3dNoPorId(args.nodeId);
  mod3dSourceAssert(node && !node.travado, 'Node not found or locked');
  mod3dGrafo.selecao = [node.id];
  if (operation === 'transform') {
    mod3dApiTransform(node, args);
    return { nodeId: node.id };
  }
  if (operation === 'parameters') {
    mod3dSourceAssert(
      !node.edicao && MOD3D_PRIMITIVAS[node.tipo],
      'This node is no longer parametric',
    );
    node.params = { ...node.params, ...mod3dApiParameters(node.tipo, args.parameters) };
    node.malha = null;
    mod3dMarcarNoSujo(node);
    return { nodeId: node.id };
  }
  if (operation === 'duplicate') {
    mod3dSourceAssert(!node.filhos.length, 'Duplicate individual nodes, not a populated hierarchy');
    const copy = mod3dCriarNo({
        ...mod3dDadosDoNo(node, true),
        id: undefined,
        pai: node.pai,
        nome: mod3dApiName(args.name, node.nome.slice(0, 43) + ' copy'),
    });
    mod3dSourceAssert(copy, 'Scene node limit reached');
    mod3dApiTransform(copy, args);
    mod3dGrafo.selecao = [copy.id];
    return { nodeId: copy.id, duplicatedFrom: node.id };
  }
  if (operation === 'delete') {
    mod3dSourceAssert(!node.filhos.length, 'Delete children before their parent');
    mod3dTirarDoPai(node);
    mod3dGrafo.nos.delete(node.id);
    mod3dGrafo.selecao = [];
    return { deleted: node.id };
  }
  const mesh = mod3dApiEditableNode(node);
  const faces = mod3dApiSelectFaces(mesh, args.selection);
  const vertices = new Set([...faces].flatMap((face) => mesh.faces[face]));
  const data = { modo: 'face', faces, vertices, arestas: new Set() };
  let result;
  if (operation === 'extrude')
  result = mod3dOpExtrudar(
    mesh,
    data,
    mod3dApiNumber(args.amount ?? 0.25, -1000, 1000, 'extrusion distance'),
  );
  if (operation === 'inset')
  result = mod3dOpInserirFace(
    mesh,
    data,
    mod3dApiNumber(args.amount ?? 0.2, 0.01, 0.9, 'inset factor'),
  );
  if (operation === 'bevel')
  result = mod3dOpChanfrar(
    mesh,
    data,
    mod3dApiNumber(args.amount ?? 0.05, 0.001, 1000, 'bevel distance'),
  );
  if (operation === 'subdivide') result = mod3dOpSubdividir(mesh, data);
  if (operation === 'merge')
  result = mod3dOpFundir(
    mesh,
    data,
    mod3dApiNumber(args.amount ?? 0.001, 0.00001, 1, 'merge distance'),
  );
  if (operation === 'mirror') {
    mod3dSourceAssert(['x', 'y', 'z'].includes(args.axis), 'Choose mirror axis x, y or z');
    result = mod3dOpEspelhar(
      mesh,
      args.axis,
      args.weld === true,
      mod3dApiNumber(args.amount ?? 0.001, 0.00001, 1, 'weld distance'),
    );
  }
  if (operation === 'shade') {
    const mode = { flat: 'plano', smooth: 'suave', angle: 'angulo' }[args.shading];
    mod3dSourceAssert(mode, 'Choose flat, smooth or angle shading');
    mod3dDefinirSombreamentoDaMalha(
      mesh,
      mode,
      mod3dApiNumber(args.amount ?? 32, 1, 180, 'smooth angle'),
    );
    result = { mudou: true };
  }
  if (operation === 'uv') {
    const projection = {
      planar: 'plana',
      cubic: 'cubica',
      cylindrical: 'cilindrica',
      spherical: 'esferica',
    }[args.projection];
    mod3dSourceAssert(projection || args.projection === 'unwrap', 'Unknown UV projection');
    if (projection) {
      mod3dProjetarUvNaMalha(mesh, faces, projection);
      node.projecao = projection;
    } else
    mod3dDesdobrarUvNaMalha(
      mesh,
      faces,
      mod3dApiNumber(args.amount ?? 40, 1, 180, 'unwrap angle'),
    );
    result = { mudou: true };
  }
  mod3dSourceAssert(result && result.mudou !== false, result?.recado || 'Operation made no change');
  mod3dMalhaEdCompactar(mesh);
  node.malha = null;
  mod3dMarcarNoSujo(node);
  const report = mod3dVerificarMalha(mesh);
  return {
    nodeId: node.id,
    vertices: report.vertices,
    faces: report.faces,
    warnings: {
      degenerateFaces: report.degeneradas.length,
      looseVertices: report.soltos.length,
      invertedFaces: report.invertidas.length,
      nonManifoldEdges: report.naoManifold.length,
    },
  };
}

function mod3dApiApplyMaterial(args) {
  const node = mod3dNoPorId(args.nodeId);
  mod3dSourceAssert(
    node && node.tipo !== 'grupo' && !node.travado,
    'Choose an unlocked geometry node',
  );
  const slot = args.slot ?? 0;
  mod3dSourceInteger(slot, 0, 11, 'material slot');
  const values = args.material;
  mod3dSourceAssert(values && typeof values === 'object', 'A material is required');
  const materials = mod3dMateriaisDoNo(node).map((material, index) =>
    mod3dMaterialSeguro(material, index),
  );
  while (materials.length <= slot) materials.push(mod3dMaterialSeguro({}, materials.length));
  const material = materials[slot];
  if (values.name !== undefined) {
    mod3dSourceAssert(values.name.length <= 40, 'Material name exceeds 40 characters');
    material.nome = mod3dApiName(values.name);
  }
  if (values.color !== undefined)
  material.cor = mod3dApiVector(values.color, 0, 1, 'material color');
  for (const [key, property] of [
      ['metalness', 'metal'],
      ['roughness', 'rugosidade'],
      ['emission', 'emissao'],
      ['opacity', 'opacidade'],
  ]) {
    if (values[key] !== undefined) material[property] = mod3dApiNumber(values[key], 0, 1, key);
  }
  if (values.doubleSided !== undefined) material.faceDupla = values.doubleSided;
  if (values.embed !== undefined) material.embutir = values.embed;
  if (values.texture !== undefined) {
    if (values.texture) mod3dModelerProjectPath(values.texture);
    material.textura = values.texture;
  }
  node.materiais = materials;
  if (args.selection || slot !== 0 || node.edicao) {
    const mesh = mod3dApiEditableNode(node);
    for (const face of mod3dApiSelectFaces(mesh, args.selection)) mesh.mat[face] = slot;
    mod3dMalhaEdTocar(mesh);
  }
  node.malha = null;
  mod3dMarcarNoSujo(node);
  return { nodeId: node.id, slot };
}
