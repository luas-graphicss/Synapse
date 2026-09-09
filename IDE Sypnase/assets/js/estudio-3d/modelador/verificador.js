'use strict';

const MOD3D_AVISOS_DA_MALHA = Object.freeze([
    Object.freeze({ chave: 'degeneradas', rotulo: 'Faces degeneradas' }),
    Object.freeze({ chave: 'soltos', rotulo: 'Vértices soltos' }),
    Object.freeze({ chave: 'invertidas', rotulo: 'Normais invertidas' }),
    Object.freeze({ chave: 'naoManifold', rotulo: 'Arestas não múltiplas de dois' }),
]);
const MOD3D_TETO_DA_LISTA_DE_AVISOS = 200;

function mod3dFacesDegeneradas(malha) {
  const saida = [];
  if (!malha) return saida;
  for (let face = 0; face < malha.faces.length; face++) {
    const anel = malha.faces[face];
    if (!anel) continue;
    if (anel.length < 3) {
      saida.push(face);
      continue;
    }
    if (mod3dMalhaEdAreaDaFace(malha, face) <= MOD3D_MALHA_AREA_MINIMA) saida.push(face);
  }
  return saida;
}

function mod3dArestasNaoManifold(malha) {
  const saida = [];
  if (!malha) return saida;
  const adj = mod3dMalhaEdAdjacencia(malha);
  adj.arestas.forEach((aresta, chave) => {
      if (aresta.faces.length > 2) saida.push(chave);
  });
  return saida;
}

function mod3dFacesInvertidas(malha) {
  const saida = [];
  if (!malha || !malha.vivas) return saida;
  const copia = mod3dMalhaEdClonar(malha);
  if (!copia) return saida;
  mod3dOrientarMalhaParaFora(copia);
  for (let face = 0; face < malha.faces.length; face++) {
    const anel = malha.faces[face];
    if (!anel || anel.length < 3) continue;
    const arrumada = copia.faces[face];
    if (!arrumada) continue;
    if (mod3dAnelTemAresta(arrumada, anel[0], anel[1]) === -1) saida.push(face);
  }
  return saida;
}

function mod3dVerificarMalha(malha) {
  const relatorio = {
    vertices: 0,
    faces: 0,
    degeneradas: [],
    soltos: [],
    invertidas: [],
    naoManifold: [],
    bordas: 0,
    limpo: true,
  };
  if (!malha) return relatorio;
  relatorio.vertices = mod3dMalhaEdTotalDeVertices(malha);
  relatorio.faces = malha.vivas;
  relatorio.degeneradas = mod3dFacesDegeneradas(malha);
  relatorio.soltos = mod3dMalhaEdSoltos(malha);
  relatorio.naoManifold = mod3dArestasNaoManifold(malha);
  relatorio.invertidas = mod3dFacesInvertidas(malha);
  relatorio.bordas = mod3dMalhaEdBordas(malha).length;
  relatorio.limpo =
  !relatorio.degeneradas.length &&
  !relatorio.soltos.length &&
  !relatorio.invertidas.length &&
  !relatorio.naoManifold.length;
  return relatorio;
}

function mod3dContarAvisos(relatorio) {
  if (!relatorio) return 0;
  return (
    relatorio.degeneradas.length +
    relatorio.soltos.length +
    relatorio.invertidas.length +
    relatorio.naoManifold.length
  );
}

function mod3dLinhasDaVerificacao(relatorio) {
  const linhas = [];
  if (!relatorio) return linhas;
  MOD3D_AVISOS_DA_MALHA.forEach((aviso) => {
      const lista = relatorio[aviso.chave] || [];
      linhas.push({
          chave: aviso.chave,
          rotulo: aviso.rotulo,
          total: Math.min(lista.length, MOD3D_TETO_DA_LISTA_DE_AVISOS),
          cru: lista.length,
      });
  });
  return linhas;
}

function mod3dCorrigirMalha(malha, pedido) {
  const feito = { degeneradas: 0, soltos: 0, invertidas: 0, naoManifold: 0 };
  if (!malha) return feito;
  const opcoes = pedido || {};
  if (opcoes.degeneradas !== false) {
    mod3dFacesDegeneradas(malha).forEach((face) => {
        if (mod3dMalhaEdApagarFace(malha, face)) feito.degeneradas += 1;
    });
    if (feito.degeneradas) mod3dMalhaEdTocar(malha);
  }
  if (opcoes.soltos !== false) {
    const soltos = mod3dMalhaEdSoltos(malha).length;
    if (soltos || feito.degeneradas) {
      mod3dMalhaEdCompactar(malha);
      feito.soltos = soltos;
    }
  }
  if (opcoes.invertidas !== false) {
    feito.invertidas = mod3dOrientarMalhaParaFora(malha);
  }
  if (opcoes.naoManifold === true) {
    const chaves = mod3dArestasNaoManifold(malha);
    const alvos = new Set();
    chaves.forEach((chave) => {
        const faces = mod3dMalhaEdFacesDaAresta(malha, chave);
        for (let i = 2; i < faces.length; i++) alvos.add(faces[i]);
    });
    alvos.forEach((face) => {
        if (mod3dMalhaEdApagarFace(malha, face)) feito.naoManifold += 1;
    });
    if (feito.naoManifold) {
      mod3dMalhaEdCompactar(malha);
    }
  }
  return feito;
}
