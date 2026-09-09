'use strict';

const MOD3D_DISTANCIA_PADRAO_DA_MALHA = 0.25;
const MOD3D_FATOR_PADRAO_DA_MALHA = 0.2;
const MOD3D_FATOR_MINIMO_DA_MALHA = 0.01;
const MOD3D_FATOR_MAXIMO_DA_MALHA = 0.9;
const MOD3D_TETO_DO_PAREAMENTO = 512;
const MOD3D_EIXOS_DO_ESPELHO = Object.freeze([
    Object.freeze({ chave: 'x', rotulo: 'Eixo X' }),
    Object.freeze({ chave: 'y', rotulo: 'Eixo Y' }),
    Object.freeze({ chave: 'z', rotulo: 'Eixo Z' }),
]);

function mod3dEntreLimites(valor, minimo, maximo) {
  const numero = Number(valor);
  if (!isFinite(numero)) return minimo;
  return Math.min(maximo, Math.max(minimo, numero));
}

function mod3dSelecaoDaMalhaGuardada() {
  return {
    modo: mod3dEdicao.modo,
    vertices: Array.from(mod3dEdicao.vertices),
    arestas: Array.from(mod3dEdicao.arestas),
    faces: Array.from(mod3dEdicao.faces),
  };
}

function mod3dRestaurarSelecaoDaMalha(dados) {
  if (!dados) return;
  mod3dEdicao.modo = mod3dModoDeMalhaSeguro(dados.modo);
  mod3dEdicao.vertices = new Set(dados.vertices || []);
  mod3dEdicao.arestas = new Set(dados.arestas || []);
  mod3dEdicao.faces = new Set(dados.faces || []);
}

function mod3dVoltarMalhaDoNo(id, instantaneo, selecao) {
  const no = mod3dNoPorId(id);
  if (!no || !no.edicao || !instantaneo) return false;
  mod3dMalhaEdRestaurar(no.edicao, instantaneo);
  no.malha = null;
  mod3dMarcarNoSujo(no);
  if (mod3dEdicao.no === id) mod3dRestaurarSelecaoDaMalha(selecao);
  mod3dCenaTocar();
  mod3dEdicaoTocar();
  return true;
}

function mod3dGuardarPassoDaMalha(id, rotulo, antes, depois, selecaoAntes, selecaoDepois) {
  const inicial = selecaoAntes || mod3dSelecaoDaMalhaGuardada();
  const derradeira = selecaoDepois || mod3dSelecaoDaMalhaGuardada();
  return mod3dHistoricoPasso({
      rotulo,
      desfazer: () => mod3dVoltarMalhaDoNo(id, antes, inicial),
      refazer: () => mod3dVoltarMalhaDoNo(id, depois, derradeira),
  });
}

function mod3dDadosDaSelecaoDeMalha() {
  return {
    modo: mod3dEdicao.modo,
    vertices: mod3dVerticesDaSelecao(),
    arestas: mod3dArestasDaSelecao(),
    faces: mod3dFacesDaSelecao(),
  };
}

function mod3dRodarOperacaoDeMalha(rotulo, operacao) {
  const no = mod3dNoDaEdicao();
  const malha = mod3dMalhaDaEdicao();
  if (!no || !malha) return false;
  if (no.travado) {
    mod3dEdicaoRecado('O objeto está travado');
    mod3dEdicaoTocar();
    return false;
  }
  const antes = mod3dMalhaEdInstantaneo(malha);
  const selecaoAntes = mod3dSelecaoDaMalhaGuardada();
  let resultado = null;
  try {
    resultado = operacao(malha, mod3dDadosDaSelecaoDeMalha());
  } catch (erro) {
    ignorarErro(erro, 'mod3dMalha:operacao');
    resultado = { mudou: false, recado: 'A operação falhou' };
  }
  if (!resultado || resultado.mudou === false) {
    mod3dMalhaEdRestaurar(malha, antes);
    mod3dEdicaoRecado(resultado && resultado.recado ? resultado.recado : 'Nada para fazer');
    mod3dEdicaoTocar();
    return false;
  }
  const mapa = mod3dMalhaEdCompactar(malha);
  if (resultado.modo) mod3dEdicao.modo = mod3dModoDeMalhaSeguro(resultado.modo);
  const vertices = new Set();
  (resultado.vertices || []).forEach((vertice) => {
      const novo = mapa && vertice >= 0 && vertice < mapa.length ? mapa[vertice] : -1;
      if (novo >= 0) vertices.add(novo);
  });
  mod3dAplicarDominioDaMalha(vertices);
  no.malha = null;
  mod3dMarcarNoSujo(no);
  mod3dEdicaoRecado(resultado.recado || '');
  mod3dEdicao.relatorio = null;
  mod3dGuardarPassoDaMalha(
    no.id,
    rotulo,
    antes,
    mod3dMalhaEdInstantaneo(malha),
    selecaoAntes,
    mod3dSelecaoDaMalhaGuardada(),
  );
  mod3dCenaTocar();
  mod3dEdicaoTocar();
  return true;
}

function mod3dArestasDaRegiao(malha, faces) {
  const contagem = new Map();
  const lista = [];
  faces.forEach((face) => {
      const anel = malha.faces[face];
      if (!anel) return;
      for (let i = 0; i < anel.length; i++) {
        const a = anel[i];
        const b = anel[(i + 1) % anel.length];
        const chave = mod3dChaveDaAresta(a, b);
        lista.push({ a, b, face, chave });
        contagem.set(chave, (contagem.get(chave) || 0) + 1);
      }
  });
  return lista.filter((item) => contagem.get(item.chave) === 1);
}

function mod3dNormalDaRegiao(malha, faces) {
  let x = 0;
  let y = 0;
  let z = 0;
  faces.forEach((face) => {
      const area = Math.max(mod3dMalhaEdAreaDaFace(malha, face), 1e-9);
      const normal = mod3dMalhaEdNormalDaFace(malha, face);
      x += normal[0] * area;
      y += normal[1] * area;
      z += normal[2] * area;
  });
  const tamanho = Math.hypot(x, y, z);
  if (!(tamanho > 1e-9)) return [0, 1, 0];
  return [x / tamanho, y / tamanho, z / tamanho];
}

function mod3dOpExtrudar(malha, dados, distancia) {
  const passo = Number(distancia);
  if (!isFinite(passo) || passo === 0) return { mudou: false, recado: 'Informe uma distância' };
  const faces = Array.from(dados.faces || []).filter((face) => malha.faces[face]);
  if (faces.length) {
    const borda = mod3dArestasDaRegiao(malha, faces);
    if (!borda.length) return { mudou: false, recado: 'Escolha faces com borda livre' };
    const normal = mod3dNormalDaRegiao(malha, faces);
    const naBorda = new Set();
    borda.forEach((item) => {
        naBorda.add(item.a);
        naBorda.add(item.b);
    });
    const usados = new Set();
    faces.forEach((face) => {
        malha.faces[face].forEach((vertice) => usados.add(vertice));
    });
    const copia = new Map();
    let falhou = false;
    naBorda.forEach((vertice) => {
        const ponto = mod3dMalhaEdPonto(malha, vertice);
        const novo = mod3dMalhaEdVertice(
          malha,
          ponto[0] + normal[0] * passo,
          ponto[1] + normal[1] * passo,
          ponto[2] + normal[2] * passo,
        );
        if (novo < 0) falhou = true;
        else copia.set(vertice, novo);
    });
    if (falhou) return { mudou: false, recado: 'A malha chegou ao limite' };
    usados.forEach((vertice) => {
        if (copia.has(vertice)) return;
        const ponto = mod3dMalhaEdPonto(malha, vertice);
        mod3dMalhaEdMover(
          malha,
          vertice,
          ponto[0] + normal[0] * passo,
          ponto[1] + normal[1] * passo,
          ponto[2] + normal[2] * passo,
        );
    });
    faces.forEach((face) => {
        const anel = malha.faces[face];
        if (!anel) return;
        malha.faces[face] = anel.map((vertice) =>
          copia.has(vertice) ? copia.get(vertice) : vertice,
        );
    });
    borda.forEach((item) => {
        const na = copia.get(item.a);
        const nb = copia.get(item.b);
        if (na === undefined || nb === undefined) return;
        mod3dMalhaEdFace(malha, [item.a, item.b, nb, na], malha.suave[item.face] === true);
    });
    const selecionados = [];
    usados.forEach((vertice) => {
        selecionados.push(copia.has(vertice) ? copia.get(vertice) : vertice);
    });
    return { vertices: selecionados, modo: 'face', normal };
  }
  const adj = mod3dMalhaEdAdjacencia(malha);
  const escolhidas = Array.from(dados.arestas || []).filter((chave) => adj.arestas.get(chave));
  if (!escolhidas.length) return { mudou: false, recado: 'Escolha arestas ou faces' };
  const vizinhas = new Set();
  escolhidas.forEach((chave) => {
      adj.arestas.get(chave).faces.forEach((face) => vizinhas.add(face));
  });
  const normalDaSelecao = mod3dNormalDaRegiao(malha, vizinhas);
  const copia = new Map();
  const selecionados = [];
  const novoDe = (vertice, normal) => {
    if (copia.has(vertice)) return copia.get(vertice);
    const ponto = mod3dMalhaEdPonto(malha, vertice);
    const novo = mod3dMalhaEdVertice(
      malha,
      ponto[0] + normal[0] * passo,
      ponto[1] + normal[1] * passo,
      ponto[2] + normal[2] * passo,
    );
    if (novo >= 0) {
      copia.set(vertice, novo);
      selecionados.push(novo);
    }
    return novo;
  };
  let criadas = 0;
  escolhidas.forEach((chave) => {
      const aresta = adj.arestas.get(chave);
      const face = aresta.faces[0];
      const anel = face === undefined ? null : malha.faces[face];
      const normal = normalDaSelecao;
      const sentido = anel ? mod3dAnelTemAresta(anel, aresta.a, aresta.b) : 0;
      const de = sentido === 1 ? aresta.b : aresta.a;
      const para = sentido === 1 ? aresta.a : aresta.b;
      const inicio = novoDe(de, normal);
      const fim = novoDe(para, normal);
      if (inicio < 0 || fim < 0) return;
      if (mod3dMalhaEdFace(malha, [de, para, fim, inicio], false) >= 0) criadas += 1;
  });
  if (!criadas) return { mudou: false, recado: 'Nada para extrudar' };
  return { vertices: selecionados, modo: 'vertice', normal: normalDaSelecao };
}

function mod3dOpInserirFace(malha, dados, fator) {
  const faces = Array.from(dados.faces || []).filter((face) => malha.faces[face]);
  if (!faces.length) return { mudou: false, recado: 'Escolha faces' };
  const passo = mod3dEntreLimites(fator, MOD3D_FATOR_MINIMO_DA_MALHA, MOD3D_FATOR_MAXIMO_DA_MALHA);
  const selecionados = [];
  let criadas = 0;
  faces.forEach((face) => {
      const anel = malha.faces[face];
      if (!anel) return;
      const suave = malha.suave[face] === true;
      const centro = mod3dMalhaEdCentroDaFace(malha, face);
      const internos = [];
      let falhou = false;
      anel.forEach((vertice) => {
          const ponto = mod3dMalhaEdPonto(malha, vertice);
          const novo = mod3dMalhaEdVertice(
            malha,
            ponto[0] + (centro[0] - ponto[0]) * passo,
            ponto[1] + (centro[1] - ponto[1]) * passo,
            ponto[2] + (centro[2] - ponto[2]) * passo,
          );
          if (novo < 0) falhou = true;
          else internos.push(novo);
      });
      if (falhou || internos.length !== anel.length) return;
      for (let i = 0; i < anel.length; i++) {
        const proximo = (i + 1) % anel.length;
        mod3dMalhaEdFace(malha, [anel[i], anel[proximo], internos[proximo], internos[i]], suave);
      }
      malha.faces[face] = internos;
      internos.forEach((vertice) => selecionados.push(vertice));
      criadas += 1;
  });
  if (!criadas) return { mudou: false, recado: 'Nada para inserir' };
  return { vertices: selecionados, modo: 'face' };
}

function mod3dLequeDoVertice(malha, vertice) {
  const arestas = mod3dMalhaEdArestasDoVertice(malha, vertice).slice();
  const faces = mod3dMalhaEdFacesDoVertice(malha, vertice).slice();
  if (arestas.length < 3 || faces.length !== arestas.length) return null;
  const porFace = new Map();
  let falhou = false;
  faces.forEach((face) => {
      const anel = malha.faces[face];
      if (!anel) {
        falhou = true;
        return;
      }
      const posicao = anel.indexOf(vertice);
      if (posicao < 0) {
        falhou = true;
        return;
      }
      const anterior = anel[(posicao - 1 + anel.length) % anel.length];
      const seguinte = anel[(posicao + 1) % anel.length];
      porFace.set(face, [
          mod3dChaveDaAresta(vertice, anterior),
          mod3dChaveDaAresta(vertice, seguinte),
      ]);
  });
  if (falhou) return null;
  const ordem = [];
  const usadas = new Set();
  let chave = arestas[0];
  let faceAtual = -1;
  for (let volta = 0; volta < arestas.length; volta++) {
    ordem.push(chave);
    usadas.add(chave);
    const vizinhas = mod3dMalhaEdFacesDaAresta(malha, chave);
    if (vizinhas.length !== 2) return null;
    let proxima = -1;
    for (let i = 0; i < vizinhas.length; i++) {
      if (vizinhas[i] !== faceAtual && porFace.has(vizinhas[i])) {
        proxima = vizinhas[i];
        break;
      }
    }
    if (proxima < 0) return null;
    const par = porFace.get(proxima);
    const outra = par[0] === chave ? par[1] : par[0];
    faceAtual = proxima;
    chave = outra;
    if (usadas.has(outra)) break;
  }
  if (ordem.length !== arestas.length) return null;
  return { ordem, faces };
}

function mod3dOpChanfrar(malha, dados, distancia) {
  const vertices = Array.from(dados.vertices || []);
  if (!vertices.length) return { mudou: false, recado: 'Escolha vértices' };
  const passo = Math.max(1e-4, Number(distancia) || MOD3D_DISTANCIA_PADRAO_DA_MALHA);
  const selecionados = [];
  let feitos = 0;
  vertices.forEach((vertice) => {
      const leque = mod3dLequeDoVertice(malha, vertice);
      if (!leque) return;
      const pontoV = mod3dMalhaEdPonto(malha, vertice);
      const criados = new Map();
      let falhou = false;
      leque.ordem.forEach((chave) => {
          const pontas = mod3dPontasDaAresta(chave);
          const outro = pontas[0] === vertice ? pontas[1] : pontas[0];
          const pontoO = mod3dMalhaEdPonto(malha, outro);
          const dx = pontoO[0] - pontoV[0];
          const dy = pontoO[1] - pontoV[1];
          const dz = pontoO[2] - pontoV[2];
          const tamanho = Math.hypot(dx, dy, dz);
          if (!(tamanho > 1e-9)) {
            falhou = true;
            return;
          }
          const fracao = Math.min(passo, tamanho * 0.45) / tamanho;
          const novo = mod3dMalhaEdVertice(
            malha,
            pontoV[0] + dx * fracao,
            pontoV[1] + dy * fracao,
            pontoV[2] + dz * fracao,
          );
          if (novo < 0) falhou = true;
          else criados.set(chave, novo);
      });
      if (falhou || criados.size !== leque.ordem.length) return;
      const media = mod3dNormalDaRegiao(malha, leque.faces);
      leque.faces.forEach((face) => {
          const anel = malha.faces[face];
          if (!anel) return;
          const posicao = anel.indexOf(vertice);
          if (posicao < 0) return;
          const anterior = anel[(posicao - 1 + anel.length) % anel.length];
          const seguinte = anel[(posicao + 1) % anel.length];
          const antes = criados.get(mod3dChaveDaAresta(vertice, anterior));
          const depois = criados.get(mod3dChaveDaAresta(vertice, seguinte));
          if (antes === undefined || depois === undefined) return;
          const substituto = anel.slice();
          substituto.splice(posicao, 1, antes, depois);
          malha.faces[face] = substituto;
      });
      const tampa = leque.ordem.map((chave) => criados.get(chave));
      const indice = mod3dMalhaEdFace(malha, tampa, false);
      if (indice >= 0) {
        const normal = mod3dMalhaEdNormalDaFace(malha, indice);
        if (normal[0] * media[0] + normal[1] * media[1] + normal[2] * media[2] < 0) {
          malha.faces[indice] = mod3dAnelInvertido(malha.faces[indice]);
        }
        tampa.forEach((novo) => selecionados.push(novo));
        feitos += 1;
      }
      mod3dMalhaEdTocar(malha);
  });
  if (!feitos) return { mudou: false, recado: 'Chanfro só em vértices fechados' };
  return { vertices: selecionados, modo: 'face' };
}

function mod3dOpSubdividir(malha, dados) {
  const faces = Array.from(dados.faces || []).filter((face) => malha.faces[face]);
  if (!faces.length) return { mudou: false, recado: 'Escolha faces' };
  const adj = mod3dMalhaEdAdjacencia(malha);
  const dentro = new Set(faces);
  const meios = new Map();
  const selecionados = [];
  let falhou = false;
  faces.forEach((face) => {
      const anel = malha.faces[face];
      if (!anel) return;
      for (let i = 0; i < anel.length; i++) {
        const a = anel[i];
        const b = anel[(i + 1) % anel.length];
        const chave = mod3dChaveDaAresta(a, b);
        if (meios.has(chave)) continue;
        const pa = mod3dMalhaEdPonto(malha, a);
        const pb = mod3dMalhaEdPonto(malha, b);
        const novo = mod3dMalhaEdVertice(
          malha,
          (pa[0] + pb[0]) / 2,
          (pa[1] + pb[1]) / 2,
          (pa[2] + pb[2]) / 2,
        );
        if (novo < 0) falhou = true;
        else meios.set(chave, novo);
      }
  });
  if (falhou) return { mudou: false, recado: 'A malha chegou ao limite' };
  let criadas = 0;
  faces.forEach((face) => {
      const anel = malha.faces[face];
      if (!anel) return;
      const suave = malha.suave[face] === true;
      const centro = mod3dMalhaEdCentroDaFace(malha, face);
      const meio = mod3dMalhaEdVertice(malha, centro[0], centro[1], centro[2]);
      if (meio < 0) return;
      for (let i = 0; i < anel.length; i++) {
        const anterior = anel[(i - 1 + anel.length) % anel.length];
        const atual = anel[i];
        const proximo = anel[(i + 1) % anel.length];
        const m1 = meios.get(mod3dChaveDaAresta(anterior, atual));
        const m2 = meios.get(mod3dChaveDaAresta(atual, proximo));
        if (m1 === undefined || m2 === undefined) continue;
        if (mod3dMalhaEdFace(malha, [m1, atual, m2, meio], suave) >= 0) criadas += 1;
      }
      mod3dMalhaEdApagarFace(malha, face);
      selecionados.push(meio);
      anel.forEach((vertice) => selecionados.push(vertice));
  });
  if (!criadas) return { mudou: false, recado: 'Nada para subdividir' };
  meios.forEach((novo, chave) => {
      selecionados.push(novo);
      const aresta = adj.arestas.get(chave);
      if (!aresta) return;
      aresta.faces.forEach((face) => {
          if (dentro.has(face)) return;
          const anel = malha.faces[face];
          if (!anel) return;
          for (let i = 0; i < anel.length; i++) {
            const a = anel[i];
            const b = anel[(i + 1) % anel.length];
            if (mod3dChaveDaAresta(a, b) !== chave) continue;
            const substituto = anel.slice();
            substituto.splice(i + 1, 0, novo);
            malha.faces[face] = substituto;
            break;
          }
      });
  });
  return { vertices: selecionados, modo: 'vertice' };
}

function mod3dArestaOpostaNoQuad(malha, face, chave) {
  const anel = malha.faces[face];
  if (!anel || anel.length !== 4) return '';
  for (let i = 0; i < 4; i++) {
    if (mod3dChaveDaAresta(anel[i], anel[(i + 1) % 4]) !== chave) continue;
    return mod3dChaveDaAresta(anel[(i + 2) % 4], anel[(i + 3) % 4]);
  }
  return '';
}

function mod3dAnelDeCorte(malha, semente) {
  const adj = mod3dMalhaEdAdjacencia(malha);
  const inicial = adj.arestas.get(semente);
  if (!inicial) return null;
  const arestas = [semente];
  const usadas = new Set([semente]);
  const quads = [];
  const vistas = new Set();
  const andar = (partida, evitar) => {
    let chave = partida;
    let faceAtual = evitar;
    for (let volta = 0; volta < MOD3D_MALHA_TETO_DE_FACES; volta++) {
      const aresta = adj.arestas.get(chave);
      if (!aresta) return;
      let proxima = -1;
      for (let i = 0; i < aresta.faces.length; i++) {
        const face = aresta.faces[i];
        if (face === faceAtual || vistas.has(face)) continue;
        if (!malha.faces[face] || malha.faces[face].length !== 4) continue;
        proxima = face;
        break;
      }
      if (proxima < 0) return;
      const outra = mod3dArestaOpostaNoQuad(malha, proxima, chave);
      if (!outra) return;
      vistas.add(proxima);
      quads.push({ face: proxima, entrada: chave, saida: outra });
      if (usadas.has(outra)) return;
      usadas.add(outra);
      arestas.push(outra);
      faceAtual = proxima;
      chave = outra;
    }
  };
  andar(semente, -1);
  if (inicial.faces.length > 1) {
    const primeira = quads.length ? quads[0].face : -1;
    andar(semente, primeira);
  }
  if (!quads.length) return null;
  return { arestas, quads };
}

function mod3dOpCortarAnel(malha, dados) {
  const escolhidas = Array.from(dados.arestas || []);
  if (!escolhidas.length) return { mudou: false, recado: 'Escolha uma aresta' };
  const adj = mod3dMalhaEdAdjacencia(malha);
  const anel = mod3dAnelDeCorte(malha, escolhidas[0]);
  if (!anel) return { mudou: false, recado: 'O corte precisa de um anel de quads' };
  const meios = new Map();
  let falhou = false;
  anel.arestas.forEach((chave) => {
      const pontas = mod3dPontasDaAresta(chave);
      const pa = mod3dMalhaEdPonto(malha, pontas[0]);
      const pb = mod3dMalhaEdPonto(malha, pontas[1]);
      const novo = mod3dMalhaEdVertice(
        malha,
        (pa[0] + pb[0]) / 2,
        (pa[1] + pb[1]) / 2,
        (pa[2] + pb[2]) / 2,
      );
      if (novo < 0) falhou = true;
      else meios.set(chave, novo);
  });
  if (falhou) return { mudou: false, recado: 'A malha chegou ao limite' };
  const cortadas = new Set();
  let criadas = 0;
  anel.quads.forEach((peca) => {
      const ring = malha.faces[peca.face];
      if (!ring || ring.length !== 4) return;
      const suave = malha.suave[peca.face] === true;
      let posicao = -1;
      for (let i = 0; i < 4; i++) {
        if (mod3dChaveDaAresta(ring[i], ring[(i + 1) % 4]) === peca.entrada) {
          posicao = i;
          break;
        }
      }
      if (posicao < 0) return;
      const a = ring[posicao];
      const b = ring[(posicao + 1) % 4];
      const c = ring[(posicao + 2) % 4];
      const d = ring[(posicao + 3) % 4];
      const m1 = meios.get(peca.entrada);
      const m2 = meios.get(peca.saida);
      if (m1 === undefined || m2 === undefined) return;
      if (mod3dMalhaEdFace(malha, [a, m1, m2, d], suave) >= 0) criadas += 1;
      if (mod3dMalhaEdFace(malha, [m1, b, c, m2], suave) >= 0) criadas += 1;
      mod3dMalhaEdApagarFace(malha, peca.face);
      cortadas.add(peca.face);
  });
  if (!criadas) return { mudou: false, recado: 'Nada para cortar' };
  const selecionados = [];
  meios.forEach((novo, chave) => {
      selecionados.push(novo);
      const aresta = adj.arestas.get(chave);
      if (!aresta) return;
      aresta.faces.forEach((face) => {
          if (cortadas.has(face)) return;
          const ring = malha.faces[face];
          if (!ring) return;
          for (let i = 0; i < ring.length; i++) {
            if (mod3dChaveDaAresta(ring[i], ring[(i + 1) % ring.length]) !== chave) continue;
            const substituto = ring.slice();
            substituto.splice(i + 1, 0, novo);
            malha.faces[face] = substituto;
            break;
          }
      });
  });
  return { vertices: selecionados, modo: 'aresta' };
}

function mod3dArestasDoLaco(laco, fechado) {
  const saida = [];
  const total = laco.length;
  const limite = fechado ? total : total - 1;
  for (let i = 0; i < limite; i++) {
    saida.push([laco[i], laco[(i + 1) % total]]);
  }
  return saida;
}

function mod3dLacoFechado(malha, laco) {
  if (laco.length < 3) return false;
  const adj = mod3dMalhaEdAdjacencia(malha);
  const chave = mod3dChaveDaAresta(laco[laco.length - 1], laco[0]);
  const aresta = adj.arestas.get(chave);
  return Boolean(aresta && aresta.faces.length === 1);
}

function mod3dAlinharLacos(malha, primeiro, segundo, fechado) {
  const pontosA = primeiro.map((vertice) => mod3dMalhaEdPonto(malha, vertice));
  const pontosB = segundo.map((vertice) => mod3dMalhaEdPonto(malha, vertice));
  const total = primeiro.length;
  let melhor = null;
  const voltas = fechado ? Math.min(total, MOD3D_TETO_DO_PAREAMENTO) : 1;
  for (let giro = 0; giro < voltas; giro++) {
    for (let sentido = 0; sentido < 2; sentido++) {
      let soma = 0;
      for (let i = 0; i < total; i++) {
        const indice = sentido === 0 ? (i + giro) % total : (total - i + giro) % total;
        const pa = pontosA[i];
        const pb = pontosB[indice];
        soma += (pa[0] - pb[0]) ** 2 + (pa[1] - pb[1]) ** 2 + (pa[2] - pb[2]) ** 2;
      }
      if (!melhor || soma < melhor.soma) melhor = { soma, giro, sentido };
    }
  }
  if (!melhor) return null;
  const ordem = [];
  for (let i = 0; i < total; i++) {
    const indice =
    melhor.sentido === 0 ? (i + melhor.giro) % total : (total - i + melhor.giro) % total;
    ordem.push(segundo[indice]);
  }
  return ordem;
}

function mod3dOpPontear(malha, dados) {
  const adj = mod3dMalhaEdAdjacencia(malha);
  const bordas = Array.from(dados.arestas || []).filter((chave) => {
      const aresta = adj.arestas.get(chave);
      return aresta && aresta.faces.length === 1;
  });
  if (bordas.length < 2) return { mudou: false, recado: 'Escolha duas bordas abertas' };
  const lacos = mod3dLacosDeArestas(bordas);
  if (lacos.length !== 2) return { mudou: false, recado: 'A ponte precisa de dois laços' };
  if (lacos[0].length !== lacos[1].length) {
    return { mudou: false, recado: 'Os laços precisam do mesmo tamanho' };
  }
  const fechado = mod3dLacoFechado(malha, lacos[0]) && mod3dLacoFechado(malha, lacos[1]);
  const destino = mod3dAlinharLacos(malha, lacos[0], lacos[1], fechado);
  if (!destino) return { mudou: false, recado: 'Não foi possível alinhar' };
  const paresA = mod3dArestasDoLaco(lacos[0], fechado);
  const paresB = mod3dArestasDoLaco(destino, fechado);
  if (!paresA.length || paresA.length !== paresB.length) {
    return { mudou: false, recado: 'Os laços precisam do mesmo tamanho' };
  }
  const selecionados = [];
  let criadas = 0;
  for (let i = 0; i < paresA.length; i++) {
    const a = paresA[i][0];
    const b = paresA[i][1];
    const c = paresB[i][0];
    const d = paresB[i][1];
    const aresta = adj.arestas.get(mod3dChaveDaAresta(a, b));
    if (!aresta) continue;
    const vizinha = malha.faces[aresta.faces[0]];
    const sentido = mod3dAnelTemAresta(vizinha, a, b);
    const anel = sentido === 1 ? [b, a, c, d] : [a, b, d, c];
    if (mod3dMalhaEdFace(malha, anel, false) >= 0) {
      criadas += 1;
      anel.forEach((vertice) => selecionados.push(vertice));
    }
  }
  if (!criadas) return { mudou: false, recado: 'Nada para pontear' };
  return { vertices: selecionados, modo: 'face' };
}

function mod3dOpGirarAresta(malha, dados) {
  const escolhidas = Array.from(dados.arestas || []);
  if (!escolhidas.length) return { mudou: false, recado: 'Escolha arestas' };
  const adj = mod3dMalhaEdAdjacencia(malha);
  const selecionados = [];
  let giradas = 0;
  escolhidas.forEach((chave) => {
      const aresta = adj.arestas.get(chave);
      if (!aresta || aresta.faces.length !== 2) return;
      const primeira = malha.faces[aresta.faces[0]];
      const segunda = malha.faces[aresta.faces[1]];
      if (!primeira || !segunda) return;
      const sentido = mod3dAnelTemAresta(primeira, aresta.a, aresta.b);
      if (sentido === 0) return;
      const de = sentido === 1 ? aresta.a : aresta.b;
      const para = sentido === 1 ? aresta.b : aresta.a;
      if (mod3dAnelTemAresta(segunda, para, de) !== 1) return;
      const caminho = [];
      const juntar = (anel, inicio, fim) => {
        const posicao = anel.indexOf(inicio);
        if (posicao < 0) return false;
        for (let i = 0; i < anel.length; i++) {
          const vertice = anel[(posicao + i) % anel.length];
          if (vertice === fim) return true;
          caminho.push(vertice);
        }
        return false;
      };
      if (!juntar(segunda, de, para)) return;
      if (!juntar(primeira, para, de)) return;
      if (caminho.length < 4) return;
      const total = caminho.length;
      const posicaoDe = caminho.indexOf(de);
      const posicaoPara = caminho.indexOf(para);
      if (posicaoDe < 0 || posicaoPara < 0) return;
      const novoA = (posicaoDe + 1) % total;
      const novoB = (posicaoPara + 1) % total;
      if (novoA === novoB) return;
      const nova = mod3dChaveDaAresta(caminho[novoA], caminho[novoB]);
      if (nova === chave || adj.arestas.has(nova)) return;
      const primeiroAnel = [];
      for (let i = novoA; ; i = (i + 1) % total) {
        primeiroAnel.push(caminho[i]);
        if (i === novoB) break;
      }
      const segundoAnel = [];
      for (let i = novoB; ; i = (i + 1) % total) {
        segundoAnel.push(caminho[i]);
        if (i === novoA) break;
      }
      if (primeiroAnel.length < 3 || segundoAnel.length < 3) return;
      const suave = malha.suave[aresta.faces[0]] === true;
      mod3dMalhaEdApagarFace(malha, aresta.faces[0]);
      mod3dMalhaEdApagarFace(malha, aresta.faces[1]);
      if (
        mod3dMalhaEdFace(malha, primeiroAnel, suave) >= 0 &&
        mod3dMalhaEdFace(malha, segundoAnel, suave) >= 0
      ) {
        giradas += 1;
        selecionados.push(caminho[novoA]);
        selecionados.push(caminho[novoB]);
      }
  });
  if (!giradas) return { mudou: false, recado: 'Gire arestas entre duas faces' };
  return { vertices: selecionados, modo: 'aresta' };
}

function mod3dOpFundir(malha, dados, limite) {
  const passo = mod3dEntreLimites(limite, MOD3D_SOLDA_MINIMA, MOD3D_SOLDA_MAXIMA);
  let lista = Array.from(dados.vertices || []);
  if (lista.length < 2) {
    lista = [];
    const total = mod3dMalhaEdTotalDeVertices(malha);
    for (let i = 0; i < total; i++) lista.push(i);
  }
  const grade = new Map();
  const destino = new Map();
  const selecionados = [];
  lista.forEach((vertice) => {
      const ponto = mod3dMalhaEdPonto(malha, vertice);
      const cx = Math.round(ponto[0] / passo);
      const cy = Math.round(ponto[1] / passo);
      const cz = Math.round(ponto[2] / passo);
      let achado = -1;
      for (let dx = -1; dx <= 1 && achado < 0; dx++) {
        for (let dy = -1; dy <= 1 && achado < 0; dy++) {
          for (let dz = -1; dz <= 1 && achado < 0; dz++) {
            const caixa = grade.get(`${cx + dx}|${cy + dy}|${cz + dz}`);
            if (!caixa) continue;
            for (let i = 0; i < caixa.length; i++) {
              const outro = mod3dMalhaEdPonto(malha, caixa[i]);
              const distancia = Math.hypot(
                ponto[0] - outro[0],
                ponto[1] - outro[1],
                ponto[2] - outro[2],
              );
              if (distancia <= passo) {
                achado = caixa[i];
                break;
              }
            }
          }
        }
      }
      if (achado >= 0) {
        destino.set(vertice, achado);
        return;
      }
      const chave = `${cx}|${cy}|${cz}`;
      if (!grade.has(chave)) grade.set(chave, []);
      grade.get(chave).push(vertice);
      selecionados.push(vertice);
  });
  if (!destino.size) return { mudou: false, recado: 'Nada perto para fundir' };
  let apagadas = 0;
  for (let face = 0; face < malha.faces.length; face++) {
    const anel = malha.faces[face];
    if (!anel) continue;
    const trocado = anel.map((vertice) => (destino.has(vertice) ? destino.get(vertice) : vertice));
    const limpo = [];
    const vistos = new Set();
    trocado.forEach((vertice) => {
        if (vistos.has(vertice)) return;
        vistos.add(vertice);
        limpo.push(vertice);
    });
    if (limpo.length < 3) {
      mod3dMalhaEdApagarFace(malha, face);
      apagadas += 1;
      continue;
    }
    malha.faces[face] = limpo;
  }
  mod3dMalhaEdTocar(malha);
  return {
    vertices: selecionados,
    recado: `${destino.size} vértices fundidos, ${apagadas} faces removidas`,
  };
}

function mod3dOpPreencherBuraco(malha, dados) {
  const adj = mod3dMalhaEdAdjacencia(malha);
  const vertices = dados.vertices || new Set();
  const bordas = [];
  adj.arestas.forEach((aresta, chave) => {
      if (aresta.faces.length !== 1) return;
      if (vertices.size && !(vertices.has(aresta.a) && vertices.has(aresta.b))) return;
      bordas.push(chave);
  });
  if (!bordas.length) return { mudou: false, recado: 'Sem bordas abertas' };
  const lacos = mod3dLacosDeArestas(bordas);
  const selecionados = [];
  let criadas = 0;
  lacos.forEach((laco) => {
      if (laco.length < 3 || laco.length > MOD3D_MALHA_LADOS_MAXIMOS) return;
      const aresta = adj.arestas.get(mod3dChaveDaAresta(laco[0], laco[1]));
      if (!aresta) return;
      const vizinha = malha.faces[aresta.faces[0]];
      const sentido = mod3dAnelTemAresta(vizinha, laco[0], laco[1]);
      const anel = sentido === 1 ? mod3dAnelInvertido(laco) : laco.slice();
      if (mod3dMalhaEdFace(malha, anel, false) >= 0) {
        criadas += 1;
        anel.forEach((vertice) => selecionados.push(vertice));
      }
  });
  if (!criadas) return { mudou: false, recado: 'Nada para preencher' };
  return { vertices: selecionados, modo: 'face', recado: `${criadas} buracos preenchidos` };
}

function mod3dOpEspelhar(malha, eixo, soldar, limite) {
  let indice = 0;
  if (eixo === 'y') indice = 1;
  if (eixo === 'z') indice = 2;
  const passo = mod3dEntreLimites(limite, MOD3D_SOLDA_MINIMA, MOD3D_SOLDA_MAXIMA);
  const total = mod3dMalhaEdTotalDeVertices(malha);
  if (!total) return { mudou: false, recado: 'Malha vazia' };
  const mapa = new Int32Array(total).fill(-1);
  let falhou = false;
  for (let i = 0; i < total; i++) {
    const ponto = mod3dMalhaEdPonto(malha, i);
    if (soldar && Math.abs(ponto[indice]) <= passo) {
      ponto[indice] = 0;
      mod3dMalhaEdMover(malha, i, ponto[0], ponto[1], ponto[2]);
      mapa[i] = i;
      continue;
    }
    const espelho = ponto.slice();
    espelho[indice] = -ponto[indice];
    const novo = mod3dMalhaEdVertice(malha, espelho[0], espelho[1], espelho[2]);
    if (novo < 0) falhou = true;
    else mapa[i] = novo;
  }
  if (falhou) return { mudou: false, recado: 'A malha chegou ao limite' };
  const faces = mod3dMalhaEdFacesVivas(malha);
  const selecionados = [];
  let criadas = 0;
  faces.forEach((face) => {
      const anel = malha.faces[face];
      if (!anel) return;
      let naLinha = true;
      const trocado = anel.map((vertice) => {
          if (mapa[vertice] !== vertice) naLinha = false;
          return mapa[vertice];
      });
      if (naLinha) return;
      const espelhado = mod3dAnelInvertido(trocado);
      if (mod3dMalhaEdFace(malha, espelhado, malha.suave[face] === true) >= 0) {
        criadas += 1;
        espelhado.forEach((vertice) => selecionados.push(vertice));
      }
  });
  if (!criadas) return { mudou: false, recado: 'Nada para espelhar' };
  return { vertices: selecionados, modo: 'face' };
}

function mod3dOpApagar(malha, dados) {
  const alvos = new Set();
  if (dados.modo === 'face') {
    (dados.faces || new Set()).forEach((face) => {
        if (malha.faces[face]) alvos.add(face);
    });
  } else {
    const vertices = dados.vertices || new Set();
    if (!vertices.size) return { mudou: false, recado: 'Nada selecionado' };
    for (let face = 0; face < malha.faces.length; face++) {
      const anel = malha.faces[face];
      if (!anel) continue;
      for (let i = 0; i < anel.length; i++) {
        if (vertices.has(anel[i])) {
          alvos.add(face);
          break;
        }
      }
    }
  }
  if (!alvos.size) return { mudou: false, recado: 'Nada selecionado' };
  alvos.forEach((face) => mod3dMalhaEdApagarFace(malha, face));
  return { vertices: [], recado: `${alvos.size} faces removidas` };
}

function mod3dTornarNoEditavel(id) {
  const no = mod3dNoPorId(id);
  if (!no || no.tipo === 'grupo') return false;
  if (no.tipo === 'malha') return Boolean(no.edicao);
  if (no.travado) return false;
  const malha = mod3dMalhaEdDaPrimitiva(no.tipo, no.params);
  if (!malha) return false;
  const tipoAntes = no.tipo;
  const paramsAntes = Object.assign({}, no.params);
  no.tipo = 'malha';
  no.params = {};
  no.edicao = malha;
  no.malha = null;
  mod3dMarcarNoSujo(no);
  const depois = mod3dMalhaEdInstantaneo(malha);
  mod3dHistoricoPasso({
      rotulo: 'Tornar editável',
      desfazer: () => {
        const alvo = mod3dNoPorId(id);
        if (!alvo) return;
        if (mod3dEdicao.no === id) mod3dSairDaEdicao();
        alvo.tipo = tipoAntes;
        alvo.params = mod3dParametrosSeguros(tipoAntes, paramsAntes);
        alvo.edicao = null;
        alvo.malha = null;
        mod3dMarcarNoSujo(alvo);
        mod3dCenaTocar();
      },
      refazer: () => {
        const alvo = mod3dNoPorId(id);
        if (!alvo) return;
        const nova = mod3dMalhaEditavel();
        mod3dMalhaEdRestaurar(nova, depois);
        alvo.tipo = 'malha';
        alvo.params = {};
        alvo.edicao = nova;
        alvo.malha = null;
        mod3dMarcarNoSujo(alvo);
        mod3dCenaTocar();
      },
  });
  mod3dCenaTocar();
  return true;
}

function mod3dExtrudarSelecao(distancia) {
  return mod3dRodarOperacaoDeMalha('Extrudar', (malha, dados) =>
    mod3dOpExtrudar(malha, dados, distancia),
  );
}

function mod3dInserirFaceNaSelecao(fator) {
  return mod3dRodarOperacaoDeMalha('Inserir face', (malha, dados) =>
    mod3dOpInserirFace(malha, dados, fator),
  );
}

function mod3dChanfrarSelecao(distancia) {
  return mod3dRodarOperacaoDeMalha('Chanfrar', (malha, dados) =>
    mod3dOpChanfrar(malha, dados, distancia),
  );
}

function mod3dSubdividirSelecao() {
  return mod3dRodarOperacaoDeMalha('Subdividir', (malha, dados) => mod3dOpSubdividir(malha, dados));
}

function mod3dCortarAnelNaSelecao() {
  return mod3dRodarOperacaoDeMalha('Corte em anel', (malha, dados) =>
    mod3dOpCortarAnel(malha, dados),
  );
}

function mod3dPontearSelecao() {
  return mod3dRodarOperacaoDeMalha('Ponte de arestas', (malha, dados) =>
    mod3dOpPontear(malha, dados),
  );
}

function mod3dGirarArestaNaSelecao() {
  return mod3dRodarOperacaoDeMalha('Girar aresta', (malha, dados) =>
    mod3dOpGirarAresta(malha, dados),
  );
}

function mod3dFundirSelecao(limite) {
  return mod3dRodarOperacaoDeMalha('Fundir por distância', (malha, dados) =>
    mod3dOpFundir(malha, dados, limite),
  );
}

function mod3dPreencherBuracoNaSelecao() {
  return mod3dRodarOperacaoDeMalha('Preencher buraco', (malha, dados) =>
    mod3dOpPreencherBuraco(malha, dados),
  );
}

function mod3dEspelharMalha(eixo, soldar, limite) {
  return mod3dRodarOperacaoDeMalha('Espelhar', (malha) =>
    mod3dOpEspelhar(malha, eixo, soldar, limite),
  );
}

function mod3dApagarSelecaoDeMalha() {
  return mod3dRodarOperacaoDeMalha('Apagar elementos', (malha, dados) =>
    mod3dOpApagar(malha, dados),
  );
}

function mod3dMoverSelecaoDeMalha(trio) {
  const lista = trio || [];
  const passo = [Number(lista[0]) || 0, Number(lista[1]) || 0, Number(lista[2]) || 0];
  if (!passo[0] && !passo[1] && !passo[2]) return false;
  return mod3dRodarOperacaoDeMalha('Mover seleção', (malha, dados) => {
      const vertices = Array.from(dados.vertices || []);
      if (!vertices.length) return { mudou: false, recado: 'Nada selecionado' };
      vertices.forEach((vertice) => {
          const ponto = mod3dMalhaEdPonto(malha, vertice);
          mod3dMalhaEdMover(
            malha,
            vertice,
            ponto[0] + passo[0],
            ponto[1] + passo[1],
            ponto[2] + passo[2],
          );
      });
      return { vertices };
  });
}

function mod3dSombrearMalhaDaEdicao(modo, angulo) {
  return mod3dRodarOperacaoDeMalha('Sombreamento', (malha, dados) => {
      if (!mod3dDefinirSombreamentoDaMalha(malha, modo, angulo)) {
        return { mudou: false, recado: 'Sombreamento já aplicado' };
      }
      const faces = Array.from(dados.faces || []);
      if (faces.length && modo !== 'angulo') {
        mod3dMarcarSuaveNasFaces(malha, faces, modo === 'suave');
      }
      return { vertices: Array.from(dados.vertices || []) };
  });
}

function mod3dInverterNormaisDaEdicao() {
  return mod3dRodarOperacaoDeMalha('Inverter normais', (malha, dados) => {
      const faces = Array.from(dados.faces || []);
      const total = mod3dInverterFacesDaMalha(malha, faces);
      if (!total) return { mudou: false, recado: 'Nada para inverter' };
      return {
        vertices: Array.from(dados.vertices || []),
        recado: `${total} faces invertidas`,
      };
  });
}

function mod3dRecalcularNormaisDaEdicao() {
  return mod3dRodarOperacaoDeMalha('Normais para fora', (malha, dados) => {
      const total = mod3dOrientarMalhaParaFora(malha);
      if (!total) return { mudou: false, recado: 'As normais já apontam para fora' };
      return {
        vertices: Array.from(dados.vertices || []),
        recado: `${total} faces corrigidas`,
      };
  });
}

function mod3dVerificarMalhaDaEdicao() {
  const malha = mod3dMalhaDaEdicao();
  if (!malha) return null;
  mod3dEdicao.relatorio = mod3dVerificarMalha(malha);
  mod3dEdicaoRecado(mod3dEdicao.relatorio.limpo ? 'Malha limpa' : 'Veja os avisos');
  mod3dEdicaoTocar();
  return mod3dEdicao.relatorio;
}

function mod3dCorrigirMalhaDaEdicao() {
  const feito = mod3dRodarOperacaoDeMalha('Corrigir malha', (malha, dados) => {
      const conta = mod3dCorrigirMalha(malha, { naoManifold: false });
      const total = conta.degeneradas + conta.soltos + conta.invertidas;
      if (!total) return { mudou: false, recado: 'Nada para corrigir' };
      return {
        vertices: Array.from(dados.vertices || []),
        recado: `${total} problemas corrigidos`,
      };
  });
  if (feito) mod3dVerificarMalhaDaEdicao();
  return feito;
}
