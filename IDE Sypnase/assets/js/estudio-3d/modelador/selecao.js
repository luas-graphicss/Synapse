'use strict';

const MOD3D_MODOS_DE_MALHA = Object.freeze([
    Object.freeze({ chave: 'vertice', rotulo: 'Vértice', tecla: 'Alt+1' }),
    Object.freeze({ chave: 'aresta', rotulo: 'Aresta', tecla: 'Alt+2' }),
    Object.freeze({ chave: 'face', rotulo: 'Face', tecla: 'Alt+3' }),
]);
const MOD3D_PEGADA_DO_VERTICE = 12;
const MOD3D_PEGADA_DA_ARESTA = 9;
const MOD3D_ARRASTE_MINIMO_DA_MALHA = 3;
const MOD3D_TETO_DO_LACO = 400;

const mod3dEdicao = {
  no: '',
  modo: 'vertice',
  vertices: new Set(),
  arestas: new Set(),
  faces: new Set(),
  pincel: null,
  arraste: null,
  relatorio: null,
  recado: '',
  versao: 0,
  projecao: null,
};

function mod3dNoDaEdicao() {
  if (!mod3dEdicao.no) return null;
  const no = mod3dNoPorId(mod3dEdicao.no);
  if (!no || no.tipo !== 'malha' || !no.edicao) return null;
  return no;
}

function mod3dMalhaDaEdicao() {
  const no = mod3dNoDaEdicao();
  return no ? no.edicao : null;
}

function mod3dEdicaoAtiva() {
  return Boolean(mod3dNoDaEdicao());
}

function mod3dModoDeMalhaSeguro(chave) {
  for (let i = 0; i < MOD3D_MODOS_DE_MALHA.length; i++) {
    if (MOD3D_MODOS_DE_MALHA[i].chave === chave) return chave;
  }
  return 'vertice';
}

function mod3dEdicaoRecado(texto) {
  mod3dEdicao.recado = texto ? String(texto) : '';
}

function mod3dEdicaoTocar() {
  mod3dEdicao.versao += 1;
  if (typeof mod3dProjectDocument !== 'undefined' && mod3dProjectDocument) {
    mod3dProjectDocument.changed();
  }
  mod3dEdicao.projecao = null;
  if (typeof mod3dPintarPainelDaMalha === 'function') mod3dPintarPainelDaMalha();
  if (typeof mod3dPintarPainelDosMateriais === 'function') mod3dPintarPainelDosMateriais();
  if (typeof mod3dPintarEditorUv === 'function') mod3dPintarEditorUv();
  if (typeof mod3dPintarMalhaNoPalco === 'function') mod3dPintarMalhaNoPalco();
  if (typeof mod3dPintarHud === 'function') mod3dPintarHud();
  if (typeof mod3dMarcarSujo === 'function') mod3dMarcarSujo();
}

function mod3dLimparSelecaoDeMalha() {
  mod3dEdicao.vertices = new Set();
  mod3dEdicao.arestas = new Set();
  mod3dEdicao.faces = new Set();
}

function mod3dEntrarNaEdicao(id) {
  const escolhido = mod3dNoSelecionado();
  const alvo = id || (escolhido ? escolhido.id : '');
  if (!alvo) return false;
  const no = mod3dNoPorId(alvo);
  if (!no || no.tipo === 'grupo') {
    mod3dEdicaoRecado('Escolha uma forma para editar');
    mod3dEdicaoTocar();
    return false;
  }
  if (no.travado) {
    mod3dEdicaoRecado('O objeto está travado');
    mod3dEdicaoTocar();
    return false;
  }
  if (no.tipo !== 'malha' && !mod3dTornarNoEditavel(alvo)) {
    mod3dEdicaoRecado('Não foi possível converter em malha');
    mod3dEdicaoTocar();
    return false;
  }
  mod3dEdicao.no = alvo;
  mod3dEdicao.arraste = null;
  mod3dEdicao.pincel = null;
  mod3dEdicao.relatorio = null;
  mod3dLimparSelecaoDeMalha();
  mod3dEdicaoRecado('');
  mod3dSelecionarNos([alvo]);
  mod3dCenaTocar();
  mod3dEdicaoTocar();
  return true;
}

function mod3dSairDaEdicao() {
  if (!mod3dEdicao.no) return false;
  mod3dEdicao.no = '';
  mod3dEdicao.arraste = null;
  mod3dEdicao.pincel = null;
  mod3dEdicao.relatorio = null;
  mod3dLimparSelecaoDeMalha();
  mod3dEdicaoRecado('');
  mod3dPintarPincel();
  mod3dEdicaoTocar();
  return true;
}

function mod3dAlternarEdicao() {
  if (mod3dEdicaoAtiva()) return mod3dSairDaEdicao();
  return mod3dEntrarNaEdicao('');
}

function mod3dVerticesDaSelecao() {
  const malha = mod3dMalhaDaEdicao();
  const saida = new Set();
  if (!malha) return saida;
  if (mod3dEdicao.modo === 'vertice') {
    mod3dEdicao.vertices.forEach((vertice) => saida.add(vertice));
    return saida;
  }
  if (mod3dEdicao.modo === 'aresta') {
    mod3dEdicao.arestas.forEach((chave) => {
        const pontas = mod3dPontasDaAresta(chave);
        saida.add(pontas[0]);
        saida.add(pontas[1]);
    });
    return saida;
  }
  mod3dEdicao.faces.forEach((face) => {
      const anel = malha.faces[face];
      if (!anel) return;
      anel.forEach((vertice) => saida.add(vertice));
  });
  return saida;
}

function mod3dArestasDaSelecao() {
  const malha = mod3dMalhaDaEdicao();
  const saida = new Set();
  if (!malha) return saida;
  if (mod3dEdicao.modo === 'aresta') {
    mod3dEdicao.arestas.forEach((chave) => saida.add(chave));
    return saida;
  }
  if (mod3dEdicao.modo === 'face') {
    mod3dEdicao.faces.forEach((face) => {
        const anel = malha.faces[face];
        if (!anel) return;
        for (let i = 0; i < anel.length; i++) {
          saida.add(mod3dChaveDaAresta(anel[i], anel[(i + 1) % anel.length]));
        }
    });
    return saida;
  }
  const adj = mod3dMalhaEdAdjacencia(malha);
  const vertices = mod3dEdicao.vertices;
  adj.arestas.forEach((aresta, chave) => {
      if (vertices.has(aresta.a) && vertices.has(aresta.b)) saida.add(chave);
  });
  return saida;
}

function mod3dFacesDaSelecao() {
  const malha = mod3dMalhaDaEdicao();
  const saida = new Set();
  if (!malha) return saida;
  if (mod3dEdicao.modo === 'face') {
    mod3dEdicao.faces.forEach((face) => {
        if (malha.faces[face]) saida.add(face);
    });
    return saida;
  }
  const vertices = mod3dVerticesDaSelecao();
  if (!vertices.size) return saida;
  for (let face = 0; face < malha.faces.length; face++) {
    const anel = malha.faces[face];
    if (!anel) continue;
    let dentro = true;
    for (let i = 0; i < anel.length; i++) {
      if (!vertices.has(anel[i])) {
        dentro = false;
        break;
      }
    }
    if (dentro) saida.add(face);
  }
  return saida;
}

function mod3dAplicarDominioDaMalha(vertices) {
  const malha = mod3dMalhaDaEdicao();
  mod3dEdicao.vertices = new Set(vertices);
  mod3dEdicao.arestas = new Set();
  mod3dEdicao.faces = new Set();
  if (!malha) return;
  if (mod3dEdicao.modo === 'aresta' || mod3dEdicao.modo === 'face') {
    const adj = mod3dMalhaEdAdjacencia(malha);
    adj.arestas.forEach((aresta, chave) => {
        if (mod3dEdicao.vertices.has(aresta.a) && mod3dEdicao.vertices.has(aresta.b)) {
          mod3dEdicao.arestas.add(chave);
        }
    });
  }
  if (mod3dEdicao.modo === 'face') {
    for (let face = 0; face < malha.faces.length; face++) {
      const anel = malha.faces[face];
      if (!anel) continue;
      let dentro = true;
      for (let i = 0; i < anel.length; i++) {
        if (!mod3dEdicao.vertices.has(anel[i])) {
          dentro = false;
          break;
        }
      }
      if (dentro) mod3dEdicao.faces.add(face);
    }
  }
}

function mod3dDefinirModoDeMalha(chave) {
  const modo = mod3dModoDeMalhaSeguro(chave);
  if (modo === mod3dEdicao.modo) return false;
  const vertices = mod3dVerticesDaSelecao();
  mod3dEdicao.modo = modo;
  mod3dAplicarDominioDaMalha(vertices);
  mod3dEdicaoTocar();
  return true;
}

function mod3dSelecionarTudoNaMalha() {
  const malha = mod3dMalhaDaEdicao();
  if (!malha) return false;
  const vertices = new Set();
  const total = mod3dMalhaEdTotalDeVertices(malha);
  for (let i = 0; i < total; i++) vertices.add(i);
  mod3dAplicarDominioDaMalha(vertices);
  mod3dEdicaoTocar();
  return true;
}

function mod3dInverterSelecaoDeMalha() {
  const malha = mod3dMalhaDaEdicao();
  if (!malha) return false;
  if (mod3dEdicao.modo === 'face') {
    const antes = mod3dFacesDaSelecao();
    const faces = new Set();
    for (let face = 0; face < malha.faces.length; face++) {
      if (malha.faces[face] && !antes.has(face)) faces.add(face);
    }
    mod3dEdicao.faces = faces;
    mod3dEdicao.vertices = new Set();
    mod3dEdicao.arestas = new Set();
    mod3dEdicaoTocar();
    return true;
  }
  if (mod3dEdicao.modo === 'aresta') {
    const antes = mod3dArestasDaSelecao();
    const adj = mod3dMalhaEdAdjacencia(malha);
    const arestas = new Set();
    adj.arestas.forEach((aresta, chave) => {
        if (!antes.has(chave)) arestas.add(chave);
    });
    mod3dEdicao.arestas = arestas;
    mod3dEdicao.vertices = new Set();
    mod3dEdicao.faces = new Set();
    mod3dEdicaoTocar();
    return true;
  }
  const antes = mod3dEdicao.vertices;
  const vertices = new Set();
  const total = mod3dMalhaEdTotalDeVertices(malha);
  for (let i = 0; i < total; i++) {
    if (!antes.has(i)) vertices.add(i);
  }
  mod3dAplicarDominioDaMalha(vertices);
  mod3dEdicaoTocar();
  return true;
}

function mod3dVizinhosDoVertice(malha, vertice) {
  const saida = [];
  mod3dMalhaEdArestasDoVertice(malha, vertice).forEach((chave) => {
      const pontas = mod3dPontasDaAresta(chave);
      saida.push(pontas[0] === vertice ? pontas[1] : pontas[0]);
  });
  return saida;
}

function mod3dCrescerSelecaoDeMalha() {
  const malha = mod3dMalhaDaEdicao();
  if (!malha) return false;
  const vertices = mod3dVerticesDaSelecao();
  if (!vertices.size) return false;
  const maiores = new Set(vertices);
  vertices.forEach((vertice) => {
      mod3dVizinhosDoVertice(malha, vertice).forEach((outro) => maiores.add(outro));
  });
  mod3dAplicarDominioDaMalha(maiores);
  mod3dEdicaoTocar();
  return true;
}

function mod3dEncolherSelecaoDeMalha() {
  const malha = mod3dMalhaDaEdicao();
  if (!malha) return false;
  const vertices = mod3dVerticesDaSelecao();
  if (!vertices.size) return false;
  const menores = new Set();
  vertices.forEach((vertice) => {
      const vizinhos = mod3dVizinhosDoVertice(malha, vertice);
      let cercado = true;
      for (let i = 0; i < vizinhos.length; i++) {
        if (!vertices.has(vizinhos[i])) {
          cercado = false;
          break;
        }
      }
      if (cercado) menores.add(vertice);
  });
  mod3dAplicarDominioDaMalha(menores);
  mod3dEdicaoTocar();
  return true;
}

function mod3dSelecionarLigadosNaMalha() {
  const malha = mod3dMalhaDaEdicao();
  if (!malha) return false;
  const vertices = mod3dVerticesDaSelecao();
  if (!vertices.size) return false;
  const vistos = new Set(vertices);
  const fila = Array.from(vertices);
  while (fila.length) {
    const vertice = fila.pop();
    mod3dVizinhosDoVertice(malha, vertice).forEach((outro) => {
        if (vistos.has(outro)) return;
        vistos.add(outro);
        fila.push(outro);
    });
  }
  mod3dAplicarDominioDaMalha(vistos);
  mod3dEdicaoTocar();
  return true;
}

function mod3dEscolherSelecaoDaOperacao(dados) {
  if (!dados) return;
  if (dados.modo) mod3dEdicao.modo = mod3dModoDeMalhaSeguro(dados.modo);
  if (dados.vertices) {
    mod3dAplicarDominioDaMalha(new Set(dados.vertices));
    return;
  }
  if (dados.faces) {
    mod3dEdicao.faces = new Set(dados.faces);
    mod3dEdicao.vertices = new Set();
    mod3dEdicao.arestas = new Set();
    return;
  }
  if (dados.arestas) {
    mod3dEdicao.arestas = new Set(dados.arestas);
    mod3dEdicao.vertices = new Set();
    mod3dEdicao.faces = new Set();
  }
}

function mod3dProjecaoDaEdicao(atual) {
  const malha = mod3dMalhaDaEdicao();
  const no = mod3dNoDaEdicao();
  if (!malha || !no || !atual) return null;
  const mundo = mod3dMundoDoNo(no);
  if (!mundo || !mundo.mat) return null;
  const assinatura = `${no.id}|${no.versao}|${malha.versao}|${atual.tamanho.largura}x${atual.tamanho.altura}|${atual.matrizes.view.join(',')}|${atual.matrizes.proj[0]}`;
  if (mod3dEdicao.projecao && mod3dEdicao.projecao.assinatura === assinatura) {
    return mod3dEdicao.projecao;
  }
  const total = mod3dMalhaEdTotalDeVertices(malha);
  const tela = new Float32Array(total * 2);
  const atras = new Uint8Array(total);
  const pontos = new Float64Array(total * 3);
  for (let i = 0; i < total; i++) {
    const local = [
      malha.pos[i * 3] - no.pivo[0],
      malha.pos[i * 3 + 1] - no.pivo[1],
      malha.pos[i * 3 + 2] - no.pivo[2],
    ];
    const ponto = mod3dPontoPorMat(mundo.mat, local);
    pontos[i * 3] = ponto[0];
    pontos[i * 3 + 1] = ponto[1];
    pontos[i * 3 + 2] = ponto[2];
    const projetado = mod3dProjetarPonto(ponto, atual.matrizes, atual.tamanho);
    tela[i * 2] = projetado.x;
    tela[i * 2 + 1] = projetado.y;
    atras[i] = projetado.atras ? 1 : 0;
  }
  mod3dEdicao.projecao = { assinatura, tela, atras, pontos, mat: mundo.mat };
  return mod3dEdicao.projecao;
}

function mod3dDistanciaNaTela(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const tamanho = dx * dx + dy * dy;
  if (!(tamanho > 0)) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / tamanho;
  t = Math.min(1, Math.max(0, t));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

function mod3dFacePorRaioNaMalha(px, py, atual, projecao) {
  const malha = mod3dMalhaDaEdicao();
  if (!malha || !projecao) return -1;
  const raio = mod3dRaioDaTela(px, py, atual.matrizes, atual.tamanho);
  if (!raio) return -1;
  const triangulo = new Float64Array(9);
  let escolhida = -1;
  let menor = Infinity;
  for (let face = 0; face < malha.faces.length; face++) {
    const anel = malha.faces[face];
    if (!anel || anel.length < 3) continue;
    for (let i = 1; i < anel.length - 1; i++) {
      const indices = [anel[0], anel[i], anel[i + 1]];
      for (let canto = 0; canto < 3; canto++) {
        triangulo[canto * 3] = projecao.pontos[indices[canto] * 3];
        triangulo[canto * 3 + 1] = projecao.pontos[indices[canto] * 3 + 1];
        triangulo[canto * 3 + 2] = projecao.pontos[indices[canto] * 3 + 2];
      }
      const t = mod3dRaioNoTriangulo(raio, triangulo, 0);
      if (t !== null && t < menor) {
        menor = t;
        escolhida = face;
      }
    }
  }
  return escolhida;
}

function mod3dPicarNaMalha(px, py, atual) {
  const malha = mod3dMalhaDaEdicao();
  const projecao = mod3dProjecaoDaEdicao(atual);
  if (!malha || !projecao) return null;
  const total = mod3dMalhaEdTotalDeVertices(malha);
  if (mod3dEdicao.modo === 'vertice') {
    let melhor = -1;
    let menor = MOD3D_PEGADA_DO_VERTICE;
    for (let i = 0; i < total; i++) {
      if (projecao.atras[i]) continue;
      const distancia = Math.hypot(projecao.tela[i * 2] - px, projecao.tela[i * 2 + 1] - py);
      if (distancia <= menor) {
        menor = distancia;
        melhor = i;
      }
    }
    if (melhor >= 0) return { tipo: 'vertice', vertice: melhor };
    const face = mod3dFacePorRaioNaMalha(px, py, atual, projecao);
    if (face < 0) return null;
    const anel = malha.faces[face];
    let perto = anel[0];
    let dist = Infinity;
    anel.forEach((vertice) => {
        const valor = Math.hypot(
          projecao.tela[vertice * 2] - px,
          projecao.tela[vertice * 2 + 1] - py,
        );
        if (valor < dist) {
          dist = valor;
          perto = vertice;
        }
    });
    return { tipo: 'vertice', vertice: perto };
  }
  if (mod3dEdicao.modo === 'aresta') {
    const adj = mod3dMalhaEdAdjacencia(malha);
    let melhor = '';
    let menor = MOD3D_PEGADA_DA_ARESTA;
    adj.arestas.forEach((aresta, chave) => {
        if (projecao.atras[aresta.a] || projecao.atras[aresta.b]) return;
        const distancia = mod3dDistanciaNaTela(
          px,
          py,
          projecao.tela[aresta.a * 2],
          projecao.tela[aresta.a * 2 + 1],
          projecao.tela[aresta.b * 2],
          projecao.tela[aresta.b * 2 + 1],
        );
        if (distancia <= menor) {
          menor = distancia;
          melhor = chave;
        }
    });
    if (melhor) return { tipo: 'aresta', aresta: melhor };
    const face = mod3dFacePorRaioNaMalha(px, py, atual, projecao);
    if (face < 0) return null;
    const anel = malha.faces[face];
    let chaveDaFace = '';
    let dist = Infinity;
    for (let i = 0; i < anel.length; i++) {
      const a = anel[i];
      const b = anel[(i + 1) % anel.length];
      const valor = mod3dDistanciaNaTela(
        px,
        py,
        projecao.tela[a * 2],
        projecao.tela[a * 2 + 1],
        projecao.tela[b * 2],
        projecao.tela[b * 2 + 1],
      );
      if (valor < dist) {
        dist = valor;
        chaveDaFace = mod3dChaveDaAresta(a, b);
      }
    }
    return chaveDaFace ? { tipo: 'aresta', aresta: chaveDaFace } : null;
  }
  const face = mod3dFacePorRaioNaMalha(px, py, atual, projecao);
  return face >= 0 ? { tipo: 'face', face } : null;
}

function mod3dElementoSelecionado(alvo) {
  if (!alvo) return false;
  if (alvo.tipo === 'vertice') return mod3dEdicao.vertices.has(alvo.vertice);
  if (alvo.tipo === 'aresta') return mod3dEdicao.arestas.has(alvo.aresta);
  return mod3dEdicao.faces.has(alvo.face);
}

function mod3dEscolherElementoDaMalha(alvo, aditivo) {
  if (!alvo) {
    if (!aditivo) mod3dLimparSelecaoDeMalha();
    mod3dEdicaoTocar();
    return;
  }
  if (!aditivo) mod3dLimparSelecaoDeMalha();
  if (alvo.tipo === 'vertice') {
    if (aditivo && mod3dEdicao.vertices.has(alvo.vertice)) {
      mod3dEdicao.vertices.delete(alvo.vertice);
    } else {
      mod3dEdicao.vertices.add(alvo.vertice);
    }
  } else if (alvo.tipo === 'aresta') {
    if (aditivo && mod3dEdicao.arestas.has(alvo.aresta)) {
      mod3dEdicao.arestas.delete(alvo.aresta);
    } else {
      mod3dEdicao.arestas.add(alvo.aresta);
    }
  } else if (aditivo && mod3dEdicao.faces.has(alvo.face)) {
    mod3dEdicao.faces.delete(alvo.face);
  } else {
    mod3dEdicao.faces.add(alvo.face);
  }
  mod3dEdicaoTocar();
}

function mod3dEdicaoSelecionarNaTela(evento) {
  if (!mod3dEdicaoAtiva()) return false;
  const atual = mod3dMatrizesAtuais();
  if (!atual) return false;
  const ponto = mod3dPontoNaTela(evento);
  const alvo = mod3dPicarNaMalha(ponto.x, ponto.y, atual);
  mod3dEscolherElementoDaMalha(alvo, evento.shiftKey === true);
  return true;
}

function mod3dPontoDentroDoLaco(pontos, x, y) {
  let dentro = false;
  for (let i = 0, j = pontos.length - 1; i < pontos.length; j = i, i++) {
    const ax = pontos[i][0];
    const ay = pontos[i][1];
    const bx = pontos[j][0];
    const by = pontos[j][1];
    const cruza = ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}

function mod3dSelecionarPorAreaNaMalha(dentro, aditivo) {
  const malha = mod3dMalhaDaEdicao();
  const atual = mod3dMatrizesAtuais();
  const projecao = mod3dProjecaoDaEdicao(atual);
  if (!malha || !projecao) return false;
  const vertices = aditivo ? mod3dVerticesDaSelecao() : new Set();
  const total = mod3dMalhaEdTotalDeVertices(malha);
  for (let i = 0; i < total; i++) {
    if (projecao.atras[i]) continue;
    if (dentro(projecao.tela[i * 2], projecao.tela[i * 2 + 1])) vertices.add(i);
  }
  mod3dAplicarDominioDaMalha(vertices);
  mod3dEdicaoTocar();
  return true;
}

function mod3dSelecionarPorRetanguloNaMalha(caixa, aditivo) {
  const esquerda = Math.min(caixa.de.x, caixa.para.x);
  const direita = Math.max(caixa.de.x, caixa.para.x);
  const topo = Math.min(caixa.de.y, caixa.para.y);
  const base = Math.max(caixa.de.y, caixa.para.y);
  return mod3dSelecionarPorAreaNaMalha(
    (x, y) => x >= esquerda && x <= direita && y >= topo && y <= base,
    aditivo,
  );
}

function mod3dSelecionarPorLacoNaMalha(pontos, aditivo) {
  if (!pontos || pontos.length < 3) return false;
  return mod3dSelecionarPorAreaNaMalha((x, y) => mod3dPontoDentroDoLaco(pontos, x, y), aditivo);
}

function mod3dMontarPincelDaEdicao(caixa) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'mod3d-pincel');
  svg.setAttribute('aria-hidden', 'true');
  const retangulo = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  retangulo.setAttribute('class', 'mod3d-pincel-retangulo');
  const laco = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  laco.setAttribute('class', 'mod3d-pincel-laco');
  svg.appendChild(retangulo);
  svg.appendChild(laco);
  if (caixa) caixa.appendChild(svg);
  return { svg, retangulo, laco };
}

function mod3dPintarPincel() {
  const pincel = mod3dCena.pincel;
  if (!pincel) return;
  const atual = mod3dEdicao.pincel;
  if (!atual) {
    pincel.svg.classList.remove('on');
    pincel.retangulo.setAttribute('width', '0');
    pincel.retangulo.setAttribute('height', '0');
    pincel.laco.setAttribute('points', '');
    return;
  }
  pincel.svg.classList.add('on');
  if (atual.tipo === 'retangulo') {
    pincel.laco.setAttribute('points', '');
    pincel.retangulo.setAttribute('x', String(Math.min(atual.de.x, atual.para.x)));
    pincel.retangulo.setAttribute('y', String(Math.min(atual.de.y, atual.para.y)));
    pincel.retangulo.setAttribute('width', String(Math.abs(atual.para.x - atual.de.x)));
    pincel.retangulo.setAttribute('height', String(Math.abs(atual.para.y - atual.de.y)));
    return;
  }
  pincel.retangulo.setAttribute('width', '0');
  pincel.retangulo.setAttribute('height', '0');
  pincel.laco.setAttribute('points', atual.pontos.map((ponto) => ponto.join(',')).join(' '));
}

function mod3dPontoNoPlanoDaTela(raio, ponto, normal) {
  const denominador =
  raio.direcao[0] * normal[0] + raio.direcao[1] * normal[1] + raio.direcao[2] * normal[2];
  if (Math.abs(denominador) < 1e-9) return null;
  const t =
  ((ponto[0] - raio.origem[0]) * normal[0] +
    (ponto[1] - raio.origem[1]) * normal[1] +
    (ponto[2] - raio.origem[2]) * normal[2]) /
  denominador;
  return [
    raio.origem[0] + raio.direcao[0] * t,
    raio.origem[1] + raio.direcao[1] * t,
    raio.origem[2] + raio.direcao[2] * t,
  ];
}

function mod3dIniciarArrasteDeMalha(ponto, atual) {
  const malha = mod3dMalhaDaEdicao();
  const no = mod3dNoDaEdicao();
  if (!malha || !no || no.travado) return null;
  const projecao = mod3dProjecaoDaEdicao(atual);
  const vertices = Array.from(mod3dVerticesDaSelecao());
  if (!projecao || !vertices.length) return null;
  const inversa = mod3dMatInversa(projecao.mat);
  const raio = mod3dRaioDaTela(ponto.x, ponto.y, atual.matrizes, atual.tamanho);
  if (!inversa || !raio) return null;
  const centro = [0, 0, 0];
  vertices.forEach((vertice) => {
      centro[0] += projecao.pontos[vertice * 3];
      centro[1] += projecao.pontos[vertice * 3 + 1];
      centro[2] += projecao.pontos[vertice * 3 + 2];
  });
  centro[0] /= vertices.length;
  centro[1] /= vertices.length;
  centro[2] /= vertices.length;
  const normal = raio.direcao;
  const inicio = mod3dPontoNoPlanoDaTela(raio, centro, normal);
  if (!inicio) return null;
  mod3dEdicao.arraste = {
    vertices,
    base: vertices.map((vertice) => mod3dMalhaEdPonto(malha, vertice)),
    antes: mod3dMalhaEdInstantaneo(malha),
    inversa,
    normal: [normal[0], normal[1], normal[2]],
    centro,
    inicio,
    moveu: false,
  };
  return mod3dEdicao.arraste;
}

function mod3dArrastarMalha(ponto, atual) {
  const arraste = mod3dEdicao.arraste;
  const malha = mod3dMalhaDaEdicao();
  const no = mod3dNoDaEdicao();
  if (!arraste || !malha || !no) return false;
  const raio = mod3dRaioDaTela(ponto.x, ponto.y, atual.matrizes, atual.tamanho);
  if (!raio) return false;
  const agora = mod3dPontoNoPlanoDaTela(raio, arraste.centro, arraste.normal);
  if (!agora) return false;
  const deslocamento = mod3dVetorPorMat(arraste.inversa, [
      agora[0] - arraste.inicio[0],
      agora[1] - arraste.inicio[1],
      agora[2] - arraste.inicio[2],
  ]);
  const encaixe = mod3dTransf.encaixe;
  const passo = encaixe && encaixe.ligado ? encaixe.passo : 0;
  for (let eixo = 0; eixo < 3; eixo++) {
    if (passo > 0) deslocamento[eixo] = Math.round(deslocamento[eixo] / passo) * passo;
  }
  arraste.vertices.forEach((vertice, ordem) => {
      const base = arraste.base[ordem];
      mod3dMalhaEdMover(
        malha,
        vertice,
        base[0] + deslocamento[0],
        base[1] + deslocamento[1],
        base[2] + deslocamento[2],
      );
  });
  arraste.moveu = true;
  mod3dMalhaEdTocar(malha);
  mod3dMarcarNoSujo(no);
  mod3dEdicao.projecao = null;
  if (typeof mod3dPintarMalhaNoPalco === 'function') mod3dPintarMalhaNoPalco();
  mod3dMarcarSujo();
  return true;
}

function mod3dSoltarArrasteDeMalha() {
  const arraste = mod3dEdicao.arraste;
  const no = mod3dNoDaEdicao();
  const malha = mod3dMalhaDaEdicao();
  mod3dEdicao.arraste = null;
  if (!arraste || !no || !malha) return false;
  if (!arraste.moveu) return false;
  mod3dGuardarPassoDaMalha(no.id, 'Mover seleção', arraste.antes, mod3dMalhaEdInstantaneo(malha));
  mod3dCenaTocar();
  mod3dEdicaoTocar();
  return true;
}

function mod3dEdicaoAoApertar(evento) {
  if (!mod3dEdicaoAtiva() || evento.button !== 0) return false;
  if (mod3dCena.ponteiros.size > 1) return false;
  const atual = mod3dMatrizesAtuais();
  if (!atual) return false;
  const ponto = mod3dPontoNaTela(evento);
  const comTecla = evento.ctrlKey === true || evento.metaKey === true || evento.altKey === true;
  if (comTecla) {
    mod3dEdicao.pincel = {
      tipo: evento.altKey === true ? 'laco' : 'retangulo',
      aditivo: evento.shiftKey === true,
      de: ponto,
      para: ponto,
      pontos: [[ponto.x, ponto.y]],
    };
    mod3dPintarPincel();
    return true;
  }
  const alvo = mod3dPicarNaMalha(ponto.x, ponto.y, atual);
  if (alvo && mod3dElementoSelecionado(alvo) && mod3dIniciarArrasteDeMalha(ponto, atual)) {
    return true;
  }
  return false;
}

function mod3dEdicaoAoMover(evento) {
  if (!mod3dEdicaoAtiva()) return false;
  const atual = mod3dMatrizesAtuais();
  if (!atual) return false;
  const ponto = mod3dPontoNaTela(evento);
  if (mod3dEdicao.pincel) {
    mod3dEdicao.pincel.para = ponto;
    if (
      mod3dEdicao.pincel.tipo === 'laco' &&
      mod3dEdicao.pincel.pontos.length < MOD3D_TETO_DO_LACO
    ) {
      mod3dEdicao.pincel.pontos.push([ponto.x, ponto.y]);
    }
    mod3dPintarPincel();
    return true;
  }
  if (mod3dEdicao.arraste) return mod3dArrastarMalha(ponto, atual);
  return false;
}

function mod3dEdicaoAoSoltar() {
  if (mod3dEdicao.pincel) {
    const pincel = mod3dEdicao.pincel;
    mod3dEdicao.pincel = null;
    mod3dPintarPincel();
    const movimento = Math.hypot(pincel.para.x - pincel.de.x, pincel.para.y - pincel.de.y);
    if (movimento < MOD3D_ARRASTE_MINIMO_DA_MALHA) return true;
    if (pincel.tipo === 'laco') mod3dSelecionarPorLacoNaMalha(pincel.pontos, pincel.aditivo);
    else mod3dSelecionarPorRetanguloNaMalha(pincel, pincel.aditivo);
    return true;
  }
  if (mod3dEdicao.arraste) {
    mod3dSoltarArrasteDeMalha();
    return true;
  }
  return false;
}

function mod3dResumoDaEdicao() {
  const malha = mod3dMalhaDaEdicao();
  if (!malha) return null;
  return {
    modo: mod3dEdicao.modo,
    vertices: mod3dEdicao.vertices.size,
    arestas: mod3dEdicao.arestas.size,
    faces: mod3dEdicao.faces.size,
    escolhidos:
    mod3dEdicao.modo === 'vertice'
    ? mod3dEdicao.vertices.size
    : mod3dEdicao.modo === 'aresta'
    ? mod3dEdicao.arestas.size
    : mod3dEdicao.faces.size,
    estatisticas: mod3dMalhaEdEstatisticas(malha),
  };
}
