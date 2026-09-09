'use strict';

const MOD3D_CHAVE_DO_MODO = 'synapse:modelador3d:modo';
const MOD3D_CHAVE_DO_ESPACO = 'synapse:modelador3d:espaco';
const MOD3D_CHAVE_DO_ENCAIXE = 'synapse:modelador3d:encaixe';
const MOD3D_ALCA_EM_PIXELS = 92;
const MOD3D_PEGADA_EM_PIXELS = 12;
const MOD3D_MODOS_DE_TRANSFORMAR = Object.freeze([
    Object.freeze({ chave: 'mover', rotulo: 'Mover', tecla: 'W' }),
    Object.freeze({ chave: 'girar', rotulo: 'Girar', tecla: 'E' }),
    Object.freeze({ chave: 'escalar', rotulo: 'Escalar', tecla: 'R' }),
]);
const MOD3D_EIXOS_DAS_ALCAS = Object.freeze(['x', 'y', 'z']);
const MOD3D_ENCAIXE_PADRAO = Object.freeze({
    ligado: true,
    passo: 0.1,
    angulo: 15,
    escala: 0.1,
});

const mod3dTransf = {
  modo: 'mover',
  espaco: 'global',
  encaixe: Object.assign({}, MOD3D_ENCAIXE_PADRAO),
  arraste: null,
  sobre: '',
};

function mod3dCorDoEixoDaAlca(eixo, forte) {
  const base =
  eixo === 'x'
  ? MOD3D_CORES_DA_CENA.eixoX
  : eixo === 'y'
  ? MOD3D_CORES_DA_CENA.eixoY
  : MOD3D_CORES_DA_CENA.eixoZ;
  if (!forte) return base;
  return [Math.min(1, base[0] + 0.3), Math.min(1, base[1] + 0.3), Math.min(1, base[2] + 0.3)];
}

function mod3dLerEncaixeGuardado() {
  const cru = mod3dLerLocal(MOD3D_CHAVE_DO_ENCAIXE);
  if (!cru) return;
  try {
    const dados = JSON.parse(cru);
    if (!dados || typeof dados !== 'object') return;
    mod3dTransf.encaixe = {
      ligado: dados.ligado !== false,
      passo: mod3dMedidaSegura(dados.passo, MOD3D_ENCAIXE_PADRAO.passo),
      angulo: mod3dMedidaSegura(dados.angulo, MOD3D_ENCAIXE_PADRAO.angulo),
      escala: mod3dMedidaSegura(dados.escala, MOD3D_ENCAIXE_PADRAO.escala),
    };
  } catch (erro) {
    ignorarErro(erro, 'mod3dLerEncaixeGuardado');
  }
}

function mod3dGuardarEncaixe() {
  try {
    mod3dGravarLocal(MOD3D_CHAVE_DO_ENCAIXE, JSON.stringify(mod3dTransf.encaixe));
  } catch (erro) {
    ignorarErro(erro, 'mod3dGuardarEncaixe');
  }
}

function mod3dIniciarTransformar() {
  const modo = mod3dLerLocal(MOD3D_CHAVE_DO_MODO);
  if (modo === 'mover' || modo === 'girar' || modo === 'escalar') mod3dTransf.modo = modo;
  const espaco = mod3dLerLocal(MOD3D_CHAVE_DO_ESPACO);
  if (espaco === 'global' || espaco === 'local') mod3dTransf.espaco = espaco;
  mod3dLerEncaixeGuardado();
}

function mod3dDefinirModo(modo) {
  if (modo !== 'mover' && modo !== 'girar' && modo !== 'escalar') return mod3dTransf.modo;
  mod3dTransf.modo = modo;
  mod3dGravarLocal(MOD3D_CHAVE_DO_MODO, modo);
  return modo;
}

function mod3dDefinirEspaco(espaco) {
  if (espaco !== 'global' && espaco !== 'local') return mod3dTransf.espaco;
  mod3dTransf.espaco = espaco;
  mod3dGravarLocal(MOD3D_CHAVE_DO_ESPACO, espaco);
  return espaco;
}

function mod3dDefinirEncaixe(mudanca) {
  const pedido = mudanca || {};
  if (typeof pedido.ligado === 'boolean') mod3dTransf.encaixe.ligado = pedido.ligado;
  if (pedido.passo !== undefined) {
    mod3dTransf.encaixe.passo = mod3dMedidaSegura(pedido.passo, MOD3D_ENCAIXE_PADRAO.passo);
  }
  if (pedido.angulo !== undefined) {
    mod3dTransf.encaixe.angulo = mod3dMedidaSegura(pedido.angulo, MOD3D_ENCAIXE_PADRAO.angulo);
  }
  if (pedido.escala !== undefined) {
    mod3dTransf.encaixe.escala = mod3dMedidaSegura(pedido.escala, MOD3D_ENCAIXE_PADRAO.escala);
  }
  mod3dGuardarEncaixe();
  return Object.assign({}, mod3dTransf.encaixe);
}

function mod3dEncaixarValor(valor, passo) {
  if (!mod3dTransf.encaixe.ligado || !passo) return valor;
  return Math.round(valor / passo) * passo;
}

function mod3dGrausDaMatriz(m) {
  const eixoX = mod3dNormalizarVetor([m[0], m[1], m[2]]);
  const eixoY = mod3dNormalizarVetor([m[4], m[5], m[6]]);
  const eixoZ = mod3dNormalizarVetor([m[8], m[9], m[10]]);
  const r = [
    eixoX[0],
    eixoX[1],
    eixoX[2],
    eixoY[0],
    eixoY[1],
    eixoY[2],
    eixoZ[0],
    eixoZ[1],
    eixoZ[2],
  ];
  const seno = mod3dEntre(-r[2], -1, 1);
  const ry = Math.asin(seno);
  let rx = 0;
  let rz = 0;
  if (Math.abs(r[2]) < 0.99999) {
    rx = Math.atan2(r[5], r[8]);
    rz = Math.atan2(r[1], r[0]);
  } else {
    rx = r[2] < 0 ? Math.atan2(r[3], r[4]) : Math.atan2(-r[3], r[4]);
    rz = 0;
  }
  return [rx / MOD3D_GRAU_EM_RADIANO, ry / MOD3D_GRAU_EM_RADIANO, rz / MOD3D_GRAU_EM_RADIANO];
}

function mod3dMatDeEixoAngulo(eixo, radianos) {
  const unidade = mod3dNormalizarVetor(eixo);
  const x = unidade[0];
  const y = unidade[1];
  const z = unidade[2];
  const c = Math.cos(radianos);
  const s = Math.sin(radianos);
  const t = 1 - c;
  const m = mod3dMatIdentidade();
  m[0] = t * x * x + c;
  m[1] = t * x * y + s * z;
  m[2] = t * x * z - s * y;
  m[4] = t * x * y - s * z;
  m[5] = t * y * y + c;
  m[6] = t * y * z + s * x;
  m[8] = t * x * z + s * y;
  m[9] = t * y * z - s * x;
  m[10] = t * z * z + c;
  return m;
}

function mod3dMatrizDoPaiDoNo(no) {
  const pai = no.pai ? mod3dNoPorId(no.pai) : null;
  return pai ? mod3dMatrizMundialDoNo(pai) : mod3dMatIdentidade();
}

function mod3dEixoMundoDaAlca(no, eixo) {
  const indice = MOD3D_EIXOS_DAS_ALCAS.indexOf(eixo);
  if (indice < 0) return [0, 1, 0];
  if (mod3dTransf.espaco === 'local') {
    const mundo = mod3dMundoDoNo(no);
    return mundo && mundo.eixos ? mundo.eixos[indice] : [0, 1, 0];
  }
  const fixo = [0, 0, 0];
  fixo[indice] = 1;
  return fixo;
}

function mod3dProjetarPonto(ponto, matrizes, tamanho) {
  const vista = matrizes.view;
  const proj = matrizes.proj;
  const camera = mod3dPontoPorMat(vista, ponto);
  const x = proj[0] * camera[0] + proj[4] * camera[1] + proj[8] * camera[2] + proj[12];
  const y = proj[1] * camera[0] + proj[5] * camera[1] + proj[9] * camera[2] + proj[13];
  const w = proj[3] * camera[0] + proj[7] * camera[1] + proj[11] * camera[2] + proj[15];
  const divisor = w === 0 ? 1e-6 : w;
  return {
    x: ((x / divisor + 1) / 2) * tamanho.largura,
    y: ((1 - y / divisor) / 2) * tamanho.altura,
    atras: divisor <= 0,
  };
}

function mod3dRaioDaTela(px, py, matrizes, tamanho) {
  const combinada = mod3dMatMultiplicar(matrizes.proj, matrizes.view);
  const inversa = mod3dMatInversa(combinada);
  if (!inversa) return null;
  const nx = (px / Math.max(1, tamanho.largura)) * 2 - 1;
  const ny = 1 - (py / Math.max(1, tamanho.altura)) * 2;
  const desfazer = (z) => {
    const x = inversa[0] * nx + inversa[4] * ny + inversa[8] * z + inversa[12];
    const y = inversa[1] * nx + inversa[5] * ny + inversa[9] * z + inversa[13];
    const c = inversa[2] * nx + inversa[6] * ny + inversa[10] * z + inversa[14];
    const w = inversa[3] * nx + inversa[7] * ny + inversa[11] * z + inversa[15];
    const divisor = w === 0 ? 1e-6 : w;
    return [x / divisor, y / divisor, c / divisor];
  };
  const perto = desfazer(-1);
  const longe = desfazer(1);
  return {
    origem: perto,
    direcao: mod3dNormalizarVetor([longe[0] - perto[0], longe[1] - perto[1], longe[2] - perto[2]]),
  };
}

function mod3dTamanhoDaAlca(no, matrizes, tamanho) {
  const mundo = mod3dMundoDoNo(no);
  const origem = mundo ? mundo.origem : [0, 0, 0];
  const raio = window.SynapseHandleScale.worldSizeForPixels(
    matrizes,
    tamanho.altura,
    origem,
    MOD3D_ALCA_EM_PIXELS,
  );
  return raio > 0 ? raio : 1;
}

function mod3dLinhasVazias() {
  return { pos: [], cores: [] };
}

function mod3dPorSegmento(linhas, a, b, cor) {
  linhas.pos.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  linhas.cores.push(cor[0], cor[1], cor[2], cor[0], cor[1], cor[2]);
}

function mod3dFecharLinhas(linhas) {
  return {
    pos: new Float32Array(linhas.pos),
    cores: new Float32Array(linhas.cores),
  };
}

function mod3dLinhasDaCaixa(minimo, maximo, cor) {
  const linhas = mod3dLinhasVazias();
  if (!minimo || !maximo) return mod3dFecharLinhas(linhas);
  const cantos = [
    [minimo[0], minimo[1], minimo[2]],
    [maximo[0], minimo[1], minimo[2]],
    [maximo[0], minimo[1], maximo[2]],
    [minimo[0], minimo[1], maximo[2]],
    [minimo[0], maximo[1], minimo[2]],
    [maximo[0], maximo[1], minimo[2]],
    [maximo[0], maximo[1], maximo[2]],
    [minimo[0], maximo[1], maximo[2]],
  ];
  const arestas = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ];
  arestas.forEach((aresta) => {
      mod3dPorSegmento(linhas, cantos[aresta[0]], cantos[aresta[1]], cor);
  });
  return mod3dFecharLinhas(linhas);
}

function mod3dFrenteDaCamera(matrizes) {
  const vista = matrizes ? matrizes.view : null;
  if (!vista) return null;
  return mod3dNormalizarVetor([-vista[2], -vista[6], -vista[10]]);
}

function mod3dModoDasFormasDaAlca() {
  if (mod3dTransf.modo === 'girar') return 'rotate';
  if (mod3dTransf.modo === 'escalar') return 'scale';
  return 'move';
}

function mod3dFormasDasAlcas(no, matrizes, tamanho) {
  const mundo = mod3dMundoDoNo(no);
  const origem = mundo ? mundo.origem : [0, 0, 0];
  return window.SynapseTransformGizmoShapes.shapes({
      mode: mod3dModoDasFormasDaAlca(),
      origin: origem,
      axes: MOD3D_EIXOS_DAS_ALCAS.map((eixo) => mod3dEixoMundoDaAlca(no, eixo)),
      handles: MOD3D_EIXOS_DAS_ALCAS,
      radius: mod3dTamanhoDaAlca(no, matrizes, tamanho),
      forward: mod3dFrenteDaCamera(matrizes),
  });
}

function mod3dLinhasDasAlcas(no, matrizes, tamanho) {
  const linhas = mod3dLinhasVazias();
  if (!no) return mod3dFecharLinhas(linhas);
  const ativa = mod3dTransf.arraste ? mod3dTransf.arraste.alca : mod3dTransf.sobre;
  mod3dFormasDasAlcas(no, matrizes, tamanho).forEach((forma) => {
      const cor = mod3dCorDoEixoDaAlca(forma.handle, ativa === forma.handle);
      for (let indice = 1; indice < forma.points.length; indice++) {
        mod3dPorSegmento(linhas, forma.points[indice - 1], forma.points[indice], cor);
      }
  });
  return mod3dFecharLinhas(linhas);
}

function mod3dDistanciaAoSegmento(px, py, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const tamanho = dx * dx + dy * dy;
  if (!tamanho) return Math.hypot(px - a.x, py - a.y);
  let t = ((px - a.x) * dx + (py - a.y) * dy) / tamanho;
  t = Math.min(1, Math.max(0, t));
  return Math.hypot(px - (a.x + dx * t), py - (a.y + dy * t));
}

function mod3dPegarAlca(px, py, no, matrizes, tamanho) {
  if (!no || no.travado) return '';
  let melhor = '';
  let menor = MOD3D_PEGADA_EM_PIXELS * mod3dTouchHandleScale();
  mod3dFormasDasAlcas(no, matrizes, tamanho).forEach((forma) => {
      if (!forma.pickable) return;
      for (let indice = 1; indice < forma.points.length; indice++) {
        const inicio = mod3dProjetarPonto(forma.points[indice - 1], matrizes, tamanho);
        const fim = mod3dProjetarPonto(forma.points[indice], matrizes, tamanho);
        if (inicio.atras || fim.atras) continue;
        const distancia = mod3dDistanciaAoSegmento(px, py, inicio, fim);
        if (distancia < menor) {
          menor = distancia;
          melhor = forma.handle;
        }
      }
  });
  return melhor;
}

function mod3dRaioNaCaixa(raio, minimo, maximo) {
  let perto = 0;
  let longe = Infinity;
  for (let eixo = 0; eixo < 3; eixo++) {
    const direcao = raio.direcao[eixo];
    const origem = raio.origem[eixo];
    if (Math.abs(direcao) < 1e-9) {
      if (origem < minimo[eixo] || origem > maximo[eixo]) return null;
      continue;
    }
    const t1 = (minimo[eixo] - origem) / direcao;
    const t2 = (maximo[eixo] - origem) / direcao;
    perto = Math.max(perto, Math.min(t1, t2));
    longe = Math.min(longe, Math.max(t1, t2));
    if (perto > longe) return null;
  }
  return perto;
}

function mod3dRaioNoTriangulo(raio, pos, base) {
  const ax = pos[base];
  const ay = pos[base + 1];
  const az = pos[base + 2];
  const e1x = pos[base + 3] - ax;
  const e1y = pos[base + 4] - ay;
  const e1z = pos[base + 5] - az;
  const e2x = pos[base + 6] - ax;
  const e2y = pos[base + 7] - ay;
  const e2z = pos[base + 8] - az;
  const d = raio.direcao;
  const px = d[1] * e2z - d[2] * e2y;
  const py = d[2] * e2x - d[0] * e2z;
  const pz = d[0] * e2y - d[1] * e2x;
  const determinante = e1x * px + e1y * py + e1z * pz;
  if (Math.abs(determinante) < 1e-12) return null;
  const inverso = 1 / determinante;
  const tx = raio.origem[0] - ax;
  const ty = raio.origem[1] - ay;
  const tz = raio.origem[2] - az;
  const u = (tx * px + ty * py + tz * pz) * inverso;
  if (u < -1e-6 || u > 1 + 1e-6) return null;
  const qx = ty * e1z - tz * e1y;
  const qy = tz * e1x - tx * e1z;
  const qz = tx * e1y - ty * e1x;
  const v = (d[0] * qx + d[1] * qy + d[2] * qz) * inverso;
  if (v < -1e-6 || u + v > 1 + 1e-6) return null;
  const t = (e2x * qx + e2y * qy + e2z * qz) * inverso;
  return t > 1e-6 ? t : null;
}

function mod3dPicarNoNaTela(px, py, matrizes, tamanho) {
  const raio = mod3dRaioDaTela(px, py, matrizes, tamanho);
  if (!raio) return '';
  let escolhido = '';
  let menor = Infinity;
  mod3dGrafo.nos.forEach((no) => {
      if (!no.visivel || no.tipo === 'grupo') return;
      const mundo = mod3dMundoDoNo(no);
      if (!mundo || !mundo.pos || !mundo.minimo) return;
      const naCaixa = mod3dRaioNaCaixa(raio, mundo.minimo, mundo.maximo);
      if (naCaixa === null || naCaixa > menor) return;
      const pos = mundo.pos;
      for (let base = 0; base + 8 < pos.length; base += 9) {
        const t = mod3dRaioNoTriangulo(raio, pos, base);
        if (t !== null && t < menor) {
          menor = t;
          escolhido = no.id;
        }
      }
  });
  return escolhido;
}

function mod3dIniciarArrasteDeAlca(alca, px, py, matrizes, tamanho) {
  const no = mod3dNoSelecionado();
  if (!no || no.travado || !alca) return false;
  const mundo = mod3dMundoDoNo(no);
  const origem = mundo ? mundo.origem.slice() : [0, 0, 0];
  const matPai = mod3dMatrizDoPaiDoNo(no);
  const indice = MOD3D_EIXOS_DAS_ALCAS.indexOf(alca);
  const eixo = mod3dEixoMundoDaAlca(no, alca);
  const centro = mod3dProjetarPonto(origem, matrizes, tamanho);
  const adiante = mod3dProjetarPonto(
    [origem[0] + eixo[0], origem[1] + eixo[1], origem[2] + eixo[2]],
    matrizes,
    tamanho,
  );
  const local = mod3dMalhaLocalDoNo(no);
  const extensao = local ? Math.max(0.05, local.maximo[indice] - local.minimo[indice]) : 1;
  mod3dTransf.arraste = {
    id: no.id,
    alca,
    indice,
    modo: mod3dTransf.modo,
    eixo,
    origem,
    matPai,
    matPaiInv: mod3dMatInversa(matPai) || mod3dMatIdentidade(),
    posInicial: no.pos.slice(),
    rotInicial: no.rot.slice(),
    escInicial: no.esc.slice(),
    telaInicial: { x: px, y: py },
    centro,
    eixoNaTela: { x: adiante.x - centro.x, y: adiante.y - centro.y },
    anguloInicial: Math.atan2(py - centro.y, px - centro.x),
    extensao,
    antes: mod3dEstadoDoNo(no),
    mexeu: false,
  };
  mod3dAbrirGrupoDoHistorico(`transformar:${no.id}`);
  return true;
}

function mod3dMoverPeloArraste(no, arraste, px, py) {
  const eixoTela = arraste.eixoNaTela;
  const tamanho = eixoTela.x * eixoTela.x + eixoTela.y * eixoTela.y;
  if (!tamanho) return;
  const dx = px - arraste.telaInicial.x;
  const dy = py - arraste.telaInicial.y;
  let avanco = (dx * eixoTela.x + dy * eixoTela.y) / tamanho;
  const passo = mod3dTransf.encaixe.passo;
  const origemMundo = mod3dPontoPorMat(arraste.matPai, arraste.posInicial);
  if (mod3dTransf.encaixe.ligado && passo) {
    if (mod3dTransf.espaco === 'global') {
      const antes = origemMundo[arraste.indice];
      const alvo = mod3dEncaixarValor(antes + avanco, passo);
      avanco = alvo - antes;
    } else {
      avanco = mod3dEncaixarValor(avanco, passo);
    }
  }
  const destino = [
    origemMundo[0] + arraste.eixo[0] * avanco,
    origemMundo[1] + arraste.eixo[1] * avanco,
    origemMundo[2] + arraste.eixo[2] * avanco,
  ];
  no.pos = mod3dPosicaoSegura(mod3dPontoPorMat(arraste.matPaiInv, destino));
}

function mod3dGirarPeloArraste(no, arraste, px, py) {
  const centro = arraste.centro;
  const agora = Math.atan2(py - centro.y, px - centro.x);
  let giro = (agora - arraste.anguloInicial) / MOD3D_GRAU_EM_RADIANO;
  const camera = mod3dCena.camera ? mod3dCena.camera.estado() : null;
  const olho = camera ? mod3dOlhoOrbital(camera.alvo, camera.theta, camera.phi, camera.dist) : null;
  if (olho) {
    const paraCamera = [
      olho[0] - arraste.origem[0],
      olho[1] - arraste.origem[1],
      olho[2] - arraste.origem[2],
    ];
    const frente =
    arraste.eixo[0] * paraCamera[0] +
    arraste.eixo[1] * paraCamera[1] +
    arraste.eixo[2] * paraCamera[2];
    if (frente > 0) giro = -giro;
  }
  giro = mod3dEncaixarValor(giro, mod3dTransf.encaixe.angulo);
  if (!giro) {
    no.rot = arraste.rotInicial.slice();
    return;
  }
  const radianos = giro * MOD3D_GRAU_EM_RADIANO;
  const localInicial = mod3dMatDeTRS([0, 0, 0], arraste.rotInicial, [1, 1, 1]);
  if (mod3dTransf.espaco === 'local') {
    const fixo = [0, 0, 0];
    fixo[arraste.indice] = 1;
    const giroLocal = mod3dMatDeEixoAngulo(fixo, radianos);
    no.rot = mod3dRotacaoSegura(mod3dGrausDaMatriz(mod3dMatMultiplicar(localInicial, giroLocal)));
    return;
  }
  const eixoNoPai = mod3dNormalizarVetor(mod3dVetorPorMat(arraste.matPaiInv, arraste.eixo));
  const giroNoPai = mod3dMatDeEixoAngulo(eixoNoPai, radianos);
  no.rot = mod3dRotacaoSegura(mod3dGrausDaMatriz(mod3dMatMultiplicar(giroNoPai, localInicial)));
}

function mod3dEscalarPeloArraste(no, arraste, px, py) {
  const eixoTela = arraste.eixoNaTela;
  const tamanho = eixoTela.x * eixoTela.x + eixoTela.y * eixoTela.y;
  if (!tamanho) return;
  const dx = px - arraste.telaInicial.x;
  const dy = py - arraste.telaInicial.y;
  const avanco = (dx * eixoTela.x + dy * eixoTela.y) / tamanho;
  const base = arraste.escInicial[arraste.indice];
  const crescimento = avanco / Math.max(0.05, arraste.extensao);
  let escala = base * (1 + crescimento);
  escala = mod3dEncaixarValor(escala, mod3dTransf.encaixe.escala);
  const nova = arraste.escInicial.slice();
  nova[arraste.indice] = escala;
  no.esc = mod3dEscalaSegura(nova);
}

function mod3dArrastarAlca(px, py) {
  const arraste = mod3dTransf.arraste;
  if (!arraste) return false;
  const no = mod3dNoPorId(arraste.id);
  if (!no) return false;
  if (arraste.modo === 'mover') mod3dMoverPeloArraste(no, arraste, px, py);
  else if (arraste.modo === 'girar') mod3dGirarPeloArraste(no, arraste, px, py);
  else mod3dEscalarPeloArraste(no, arraste, px, py);
  arraste.mexeu = true;
  mod3dMarcarNoSujo(no);
  mod3dCenaTocar();
  return true;
}

function mod3dRotuloDoModo(modo) {
  const achado = MOD3D_MODOS_DE_TRANSFORMAR.find((cada) => cada.chave === modo);
  return achado ? achado.rotulo : modo;
}

function mod3dSoltarAlca() {
  const arraste = mod3dTransf.arraste;
  mod3dTransf.arraste = null;
  mod3dFecharGrupoDoHistorico();
  if (!arraste || !arraste.mexeu) return false;
  const no = mod3dNoPorId(arraste.id);
  if (!no) return false;
  mod3dPassoDeEstados(
    mod3dRotuloDoModo(arraste.modo),
    [{ id: no.id, antes: arraste.antes, depois: mod3dEstadoDoNo(no) }],
    '',
  );
  return true;
}

function mod3dMudarNoComHistorico(id, rotulo, mudar, chave) {
  const no = mod3dNoPorId(id);
  if (!no) return false;
  const antes = mod3dEstadoDoNo(no);
  const depois = mod3dEstadoDoNo(no);
  mudar(depois, no);
  if (JSON.stringify(antes) === JSON.stringify(depois)) return false;
  mod3dAplicarEstadoNoNo(id, depois);
  mod3dPassoDeEstados(rotulo, [{ id, antes, depois }], chave || '');
  mod3dCenaTocar();
  return true;
}

function mod3dDefinirCampoDoNo(id, campo, indice, valor) {
  if (campo !== 'pos' && campo !== 'rot' && campo !== 'esc' && campo !== 'pivo') return false;
  const numero = Number(valor);
  if (!isFinite(numero)) return false;
  const rotulos = { pos: 'Mover', rot: 'Girar', esc: 'Escalar', pivo: 'Pivô' };
  return mod3dMudarNoComHistorico(
    id,
    rotulos[campo],
    (estado) => {
      const trio = estado[campo].slice();
      trio[indice] = numero;
      if (campo === 'pos') estado.pos = mod3dPosicaoSegura(trio);
      else if (campo === 'rot') estado.rot = mod3dRotacaoSegura(trio);
      else if (campo === 'esc') estado.esc = mod3dEscalaSegura(trio);
      else estado.pivo = mod3dPosicaoSegura(trio);
    },
    `${campo}:${id}:${indice}`,
  );
}

function mod3dDefinirParametroDoNo(id, chave, valor) {
  return mod3dMudarNoComHistorico(
    id,
    'Parâmetro',
    (estado, no) => {
      const params = Object.assign({}, estado.params);
      params[chave] = valor;
      estado.params = mod3dParametrosSeguros(no.tipo, params);
    },
    `params:${id}:${chave}`,
  );
}

function mod3dDefinirNomeDoNo(id, nome) {
  return mod3dMudarNoComHistorico(
    id,
    'Renomear',
    (estado) => {
      estado.nome = mod3dNomeSeguroDoNo(nome, estado.nome);
    },
    `nome:${id}`,
  );
}

function mod3dAlternarVisivelDoNo(id) {
  return mod3dMudarNoComHistorico(id, 'Esconder', (estado) => {
      estado.visivel = !estado.visivel;
  });
}

function mod3dAlternarTravaDoNo(id) {
  return mod3dMudarNoComHistorico(id, 'Travar', (estado) => {
      estado.travado = !estado.travado;
  });
}

function mod3dCentralizarPivoDoNo(id, naBase) {
  return mod3dMudarNoComHistorico(id, 'Pivô', (estado, no) => {
      const pivo = naBase ? mod3dPivoNaBaseDoNo(no) : mod3dPivoCentralizadoDoNo(no);
      const antes = estado.pivo.slice();
      const matriz = mod3dMatDeTRS([0, 0, 0], estado.rot, estado.esc);
      const desvio = mod3dVetorPorMat(matriz, [
          pivo[0] - antes[0],
          pivo[1] - antes[1],
          pivo[2] - antes[2],
      ]);
      estado.pivo = mod3dPosicaoSegura(pivo);
      estado.pos = mod3dPosicaoSegura([
          estado.pos[0] + desvio[0],
          estado.pos[1] + desvio[1],
          estado.pos[2] + desvio[2],
      ]);
  });
}

function mod3dAdicionarPrimitiva(tipo) {
  const no = mod3dCriarNo({ tipo });
  if (!no) return null;
  mod3dSelecionarNos([no.id]);
  mod3dPassoDeCriacao(MOD3D_PRIMITIVAS[tipo] ? MOD3D_PRIMITIVAS[tipo].rotulo : 'Grupo', [no.id]);
  mod3dCenaTocar();
  return no;
}

function mod3dDuplicarSelecao() {
  const copias = [];
  mod3dGrafo.selecao.slice().forEach((id) => {
      const copia = mod3dClonarSubarvore(id, undefined);
      if (copia) copias.push(copia.id);
  });
  if (!copias.length) return [];
  mod3dSelecionarNos(copias);
  mod3dPassoDeCriacao('Duplicar', copias);
  mod3dCenaTocar();
  return copias;
}

function mod3dApagarSelecao() {
  const alvos = mod3dGrafo.selecao.slice().filter((id) => {
      const no = mod3dNoPorId(id);
      return no && !no.travado;
  });
  if (!alvos.length) return false;
  const antes = mod3dGrafo.selecao.slice();
  const pacotes = alvos.map((id) => mod3dRetirarSubarvore(id)).filter((cada) => cada !== null);
  if (!pacotes.length) return false;
  mod3dSelecionarNos([]);
  mod3dPassoDeRemocao('Apagar', pacotes, antes);
  mod3dCenaTocar();
  return true;
}

function mod3dAgruparSelecao() {
  const alvos = mod3dGrafo.selecao.slice().filter((id) => mod3dNoPorId(id));
  if (!alvos.length) return null;
  const grupo = mod3dCriarNo({ tipo: 'grupo', nome: 'Grupo' });
  if (!grupo) return null;
  const caixa = mod3dCaixaDeNos(alvos);
  if (caixa) {
    grupo.pos = mod3dPosicaoSegura([
        (caixa.minimo[0] + caixa.maximo[0]) / 2,
        caixa.minimo[1],
        (caixa.minimo[2] + caixa.maximo[2]) / 2,
    ]);
  }
  const guardados = alvos
  .map((id) => {
      const no = mod3dNoPorId(id);
      return no ? { id, antes: mod3dEstadoDoNo(no) } : null;
  })
  .filter((cada) => cada !== null);
  alvos.forEach((id) => {
      const no = mod3dNoPorId(id);
      if (!no || !mod3dPodeSerPaiDoNo(id, grupo.id)) return;
      const mundo = mod3dMatrizMundialDoNo(no);
      mod3dReparentarNo(id, grupo.id);
      const paiInv = mod3dMatInversa(mod3dMatrizMundialDoNo(grupo));
      if (paiInv) {
        const local = mod3dMatMultiplicar(paiInv, mundo);
        no.pos = mod3dPosicaoSegura([local[12], local[13], local[14]]);
        no.rot = mod3dRotacaoSegura(mod3dGrausDaMatriz(local));
      }
      mod3dMarcarNoSujo(no);
  });
  const depois = guardados.map((peca) => ({
        id: peca.id,
        antes: peca.antes,
        depois: mod3dEstadoDoNo(mod3dNoPorId(peca.id)),
  }));
  mod3dSelecionarNos([grupo.id]);
  mod3dHistoricoPasso({
      rotulo: 'Agrupar',
      chave: '',
      desfazer: () => {
        depois.forEach((peca) => mod3dAplicarEstadoNoNo(peca.id, peca.antes));
        mod3dRetirarSubarvore(grupo.id);
        mod3dSelecionarNos(alvos);
        mod3dCenaTocar();
      },
      refazer: () => {
        const volta = mod3dCriarNo({ tipo: 'grupo', nome: grupo.nome, pos: grupo.pos });
        if (!volta) return;
        depois.forEach((peca) => {
            mod3dReparentarNo(peca.id, volta.id);
            mod3dAplicarEstadoNoNo(peca.id, peca.depois);
        });
        mod3dSelecionarNos([volta.id]);
        mod3dCenaTocar();
      },
  });
  mod3dCenaTocar();
  return grupo;
}
