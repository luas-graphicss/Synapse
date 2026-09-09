'use strict';

const MOD3D_MALHA_TETO_DE_VERTICES = 300000;
const MOD3D_MALHA_TETO_DE_FACES = 200000;
const MOD3D_MALHA_LADOS_MAXIMOS = 64;
const MOD3D_MALHA_AREA_MINIMA = 1e-10;
const MOD3D_SOLDA_MINIMA = 0.00001;
const MOD3D_SOLDA_PADRAO = 0.001;
const MOD3D_SOLDA_MAXIMA = 1;

function mod3dMalhaEditavel() {
  return {
    pos: [],
    faces: [],
    suave: [],
    uv: [],
    mat: [],
    cores: null,
    vivas: 0,
    sombreamento: 'plano',
    angulo: MOD3D_ANGULO_SUAVE_PADRAO,
    versao: 1,
    adj: null,
    normais: null,
    saida: null,
  };
}

function mod3dMalhaEdTocar(malha) {
  if (!malha) return;
  malha.versao += 1;
  malha.adj = null;
  malha.normais = null;
  malha.saida = null;
}

function mod3dMalhaEdUvGarantido(malha) {
  if (!malha) return null;
  if (!Array.isArray(malha.uv)) malha.uv = [];
  while (malha.uv.length < malha.faces.length) malha.uv.push(null);
  return malha.uv;
}

function mod3dMalhaEdMatGarantido(malha) {
  if (!malha) return null;
  if (!Array.isArray(malha.mat)) malha.mat = [];
  while (malha.mat.length < malha.faces.length) malha.mat.push(0);
  return malha.mat;
}

function mod3dMalhaEdCoresGarantidas(malha) {
  if (!malha) return null;
  const total = mod3dMalhaEdTotalDeVertices(malha) * 3;
  if (!Array.isArray(malha.cores)) malha.cores = [];
  while (malha.cores.length < total) malha.cores.push(1);
  return malha.cores;
}

function mod3dMalhaEdTemCores(malha) {
  if (!malha || !Array.isArray(malha.cores)) return false;
  return malha.cores.length >= mod3dMalhaEdTotalDeVertices(malha) * 3;
}

function mod3dMalhaEdTotalDeVertices(malha) {
  return malha && malha.pos ? Math.floor(malha.pos.length / 3) : 0;
}

function mod3dMalhaEdVertice(malha, x, y, z) {
  if (!malha) return -1;
  if (mod3dMalhaEdTotalDeVertices(malha) >= MOD3D_MALHA_TETO_DE_VERTICES) return -1;
  const indice = mod3dMalhaEdTotalDeVertices(malha);
  const px = Number(x);
  const py = Number(y);
  const pz = Number(z);
  malha.pos.push(isFinite(px) ? px : 0, isFinite(py) ? py : 0, isFinite(pz) ? pz : 0);
  return indice;
}

function mod3dMalhaEdPonto(malha, indice) {
  const base = indice * 3;
  return [malha.pos[base], malha.pos[base + 1], malha.pos[base + 2]];
}

function mod3dMalhaEdMover(malha, indice, x, y, z) {
  const base = indice * 3;
  if (base < 0 || base + 2 >= malha.pos.length) return false;
  const px = Number(x);
  const py = Number(y);
  const pz = Number(z);
  malha.pos[base] = isFinite(px) ? px : malha.pos[base];
  malha.pos[base + 1] = isFinite(py) ? py : malha.pos[base + 1];
  malha.pos[base + 2] = isFinite(pz) ? pz : malha.pos[base + 2];
  return true;
}

function mod3dMalhaEdAnelLimpo(malha, indices) {
  const total = mod3dMalhaEdTotalDeVertices(malha);
  const lista = Array.isArray(indices) ? indices : [];
  const vistos = new Set();
  const saida = [];
  for (let i = 0; i < lista.length; i++) {
    if (saida.length >= MOD3D_MALHA_LADOS_MAXIMOS) break;
    const indice = Math.trunc(Number(lista[i]));
    if (!isFinite(indice) || indice < 0 || indice >= total) continue;
    if (vistos.has(indice)) continue;
    vistos.add(indice);
    saida.push(indice);
  }
  return saida;
}

function mod3dMalhaEdFace(malha, indices, suave) {
  if (!malha) return -1;
  if (malha.vivas >= MOD3D_MALHA_TETO_DE_FACES) return -1;
  const anel = mod3dMalhaEdAnelLimpo(malha, indices);
  if (anel.length < 3) return -1;
  malha.faces.push(anel);
  malha.suave.push(suave === true);
  mod3dMalhaEdUvGarantido(malha);
  mod3dMalhaEdMatGarantido(malha);
  malha.vivas += 1;
  return malha.faces.length - 1;
}

function mod3dMalhaEdTrocarFace(malha, face, indices) {
  if (!malha || !malha.faces[face]) return false;
  const anel = mod3dMalhaEdAnelLimpo(malha, indices);
  if (anel.length < 3) return false;
  const cantos = malha.faces[face].length;
  malha.faces[face] = anel;
  if (cantos !== anel.length) {
    mod3dMalhaEdUvGarantido(malha);
    malha.uv[face] = null;
  }
  return true;
}

function mod3dMalhaEdApagarFace(malha, face) {
  if (!malha || !malha.faces[face]) return false;
  malha.faces[face] = null;
  if (Array.isArray(malha.uv)) malha.uv[face] = null;
  if (Array.isArray(malha.mat)) malha.mat[face] = 0;
  malha.vivas -= 1;
  return true;
}

function mod3dMalhaEdFaceViva(malha, face) {
  return Boolean(malha && malha.faces[face]);
}

function mod3dMalhaEdFacesVivas(malha) {
  const saida = [];
  if (!malha) return saida;
  for (let face = 0; face < malha.faces.length; face++) {
    if (malha.faces[face]) saida.push(face);
  }
  return saida;
}

function mod3dChaveDaAresta(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function mod3dPontasDaAresta(chave) {
  const partes = String(chave).split(':');
  const a = Math.trunc(Number(partes[0]));
  const b = Math.trunc(Number(partes[1]));
  return [isFinite(a) ? a : 0, isFinite(b) ? b : 0];
}

function mod3dAnelTemAresta(anel, a, b) {
  if (!anel) return 0;
  for (let i = 0; i < anel.length; i++) {
    const atual = anel[i];
    const proximo = anel[(i + 1) % anel.length];
    if (atual === a && proximo === b) return 1;
    if (atual === b && proximo === a) return -1;
  }
  return 0;
}

function mod3dMalhaEdAdjacencia(malha) {
  if (!malha) return null;
  if (malha.adj && malha.adj.versao === malha.versao) return malha.adj;
  const total = mod3dMalhaEdTotalDeVertices(malha);
  const porVertice = new Array(total);
  for (let i = 0; i < total; i++) porVertice[i] = { faces: [], arestas: [] };
  const arestas = new Map();
  for (let face = 0; face < malha.faces.length; face++) {
    const anel = malha.faces[face];
    if (!anel) continue;
    for (let i = 0; i < anel.length; i++) {
      const a = anel[i];
      const b = anel[(i + 1) % anel.length];
      if (porVertice[a]) porVertice[a].faces.push(face);
      const chave = mod3dChaveDaAresta(a, b);
      let aresta = arestas.get(chave);
      if (!aresta) {
        aresta = { a: Math.min(a, b), b: Math.max(a, b), faces: [] };
        arestas.set(chave, aresta);
        if (porVertice[a]) porVertice[a].arestas.push(chave);
        if (porVertice[b]) porVertice[b].arestas.push(chave);
      }
      aresta.faces.push(face);
    }
  }
  malha.adj = { versao: malha.versao, arestas, porVertice };
  return malha.adj;
}

function mod3dMalhaEdFacesDoVertice(malha, vertice) {
  const adj = mod3dMalhaEdAdjacencia(malha);
  if (!adj || !adj.porVertice[vertice]) return [];
  return adj.porVertice[vertice].faces;
}

function mod3dMalhaEdArestasDoVertice(malha, vertice) {
  const adj = mod3dMalhaEdAdjacencia(malha);
  if (!adj || !adj.porVertice[vertice]) return [];
  return adj.porVertice[vertice].arestas;
}

function mod3dMalhaEdFacesDaAresta(malha, chave) {
  const adj = mod3dMalhaEdAdjacencia(malha);
  if (!adj) return [];
  const aresta = adj.arestas.get(chave);
  return aresta ? aresta.faces : [];
}

function mod3dMalhaEdBordas(malha) {
  const adj = mod3dMalhaEdAdjacencia(malha);
  const saida = [];
  if (!adj) return saida;
  adj.arestas.forEach((aresta, chave) => {
      if (aresta.faces.length === 1) saida.push(chave);
  });
  return saida;
}

function mod3dLacosDeArestas(chaves) {
  const vizinhos = new Map();
  const usadas = new Set();
  const lista = Array.from(chaves || []);
  lista.forEach((chave) => {
      const pontas = mod3dPontasDaAresta(chave);
      [
        [pontas[0], pontas[1]],
        [pontas[1], pontas[0]],
      ].forEach((par) => {
          if (!vizinhos.has(par[0])) vizinhos.set(par[0], []);
          vizinhos.get(par[0]).push({ chave, outro: par[1] });
      });
  });
  const lacos = [];
  lista.forEach((inicio) => {
      if (usadas.has(inicio)) return;
      const pontas = mod3dPontasDaAresta(inicio);
      const caminho = [pontas[0], pontas[1]];
      usadas.add(inicio);
      let atual = pontas[1];
      let andou = true;
      while (andou) {
        andou = false;
        const saidas = vizinhos.get(atual) || [];
        for (let i = 0; i < saidas.length; i++) {
          if (usadas.has(saidas[i].chave)) continue;
          usadas.add(saidas[i].chave);
          atual = saidas[i].outro;
          if (atual !== caminho[0]) caminho.push(atual);
          andou = true;
          break;
        }
      }
      let frente = caminho[0];
      let voltou = true;
      while (voltou) {
        voltou = false;
        const saidas = vizinhos.get(frente) || [];
        for (let i = 0; i < saidas.length; i++) {
          if (usadas.has(saidas[i].chave)) continue;
          usadas.add(saidas[i].chave);
          frente = saidas[i].outro;
          if (caminho.indexOf(frente) < 0) caminho.unshift(frente);
          voltou = true;
          break;
        }
      }
      if (caminho.length >= 2) lacos.push(caminho);
  });
  return lacos;
}

function mod3dMalhaEdNormalDaFace(malha, face) {
  const anel = malha ? malha.faces[face] : null;
  if (!anel) return [0, 0, 0];
  let x = 0;
  let y = 0;
  let z = 0;
  for (let i = 0; i < anel.length; i++) {
    const a = anel[i] * 3;
    const b = anel[(i + 1) % anel.length] * 3;
    const ax = malha.pos[a];
    const ay = malha.pos[a + 1];
    const az = malha.pos[a + 2];
    const bx = malha.pos[b];
    const by = malha.pos[b + 1];
    const bz = malha.pos[b + 2];
    x += (ay - by) * (az + bz);
    y += (az - bz) * (ax + bx);
    z += (ax - bx) * (ay + by);
  }
  const tamanho = Math.hypot(x, y, z);
  if (!(tamanho > 1e-12)) return [0, 0, 0];
  return [x / tamanho, y / tamanho, z / tamanho];
}

function mod3dMalhaEdCentroDaFace(malha, face) {
  const anel = malha ? malha.faces[face] : null;
  if (!anel) return [0, 0, 0];
  let x = 0;
  let y = 0;
  let z = 0;
  anel.forEach((indice) => {
      const base = indice * 3;
      x += malha.pos[base];
      y += malha.pos[base + 1];
      z += malha.pos[base + 2];
  });
  const total = anel.length || 1;
  return [x / total, y / total, z / total];
}

function mod3dMalhaEdAreaDaFace(malha, face) {
  const anel = malha ? malha.faces[face] : null;
  if (!anel || anel.length < 3) return 0;
  const base = mod3dMalhaEdPonto(malha, anel[0]);
  let area = 0;
  for (let i = 1; i < anel.length - 1; i++) {
    const b = mod3dMalhaEdPonto(malha, anel[i]);
    const c = mod3dMalhaEdPonto(malha, anel[i + 1]);
    const ux = b[0] - base[0];
    const uy = b[1] - base[1];
    const uz = b[2] - base[2];
    const vx = c[0] - base[0];
    const vy = c[1] - base[1];
    const vz = c[2] - base[2];
    const x = uy * vz - uz * vy;
    const y = uz * vx - ux * vz;
    const z = ux * vy - uy * vx;
    area += Math.hypot(x, y, z) / 2;
  }
  return area;
}

function mod3dMalhaEdCaixa(malha) {
  const minimo = [Infinity, Infinity, Infinity];
  const maximo = [-Infinity, -Infinity, -Infinity];
  const total = mod3dMalhaEdTotalDeVertices(malha);
  if (!total) return { minimo: [0, 0, 0], maximo: [0, 0, 0] };
  for (let i = 0; i < total; i++) {
    for (let eixo = 0; eixo < 3; eixo++) {
      const valor = malha.pos[i * 3 + eixo];
      if (valor < minimo[eixo]) minimo[eixo] = valor;
      if (valor > maximo[eixo]) maximo[eixo] = valor;
    }
  }
  return { minimo, maximo };
}

function mod3dMalhaEdVolume(malha) {
  if (!malha) return 0;
  let volume = 0;
  for (let face = 0; face < malha.faces.length; face++) {
    const anel = malha.faces[face];
    if (!anel || anel.length < 3) continue;
    const a = mod3dMalhaEdPonto(malha, anel[0]);
    for (let i = 1; i < anel.length - 1; i++) {
      const b = mod3dMalhaEdPonto(malha, anel[i]);
      const c = mod3dMalhaEdPonto(malha, anel[i + 1]);
      const x = b[1] * c[2] - b[2] * c[1];
      const y = b[2] * c[0] - b[0] * c[2];
      const z = b[0] * c[1] - b[1] * c[0];
      volume += (a[0] * x + a[1] * y + a[2] * z) / 6;
    }
  }
  return volume;
}

function mod3dMalhaEdSoltos(malha) {
  const total = mod3dMalhaEdTotalDeVertices(malha);
  const usados = new Uint8Array(total);
  for (let face = 0; face < malha.faces.length; face++) {
    const anel = malha.faces[face];
    if (!anel) continue;
    for (let i = 0; i < anel.length; i++) usados[anel[i]] = 1;
  }
  const saida = [];
  for (let i = 0; i < total; i++) {
    if (!usados[i]) saida.push(i);
  }
  return saida;
}

function mod3dMalhaEdCompactar(malha) {
  if (!malha) return null;
  const total = mod3dMalhaEdTotalDeVertices(malha);
  const usados = new Uint8Array(total);
  for (let face = 0; face < malha.faces.length; face++) {
    const anel = malha.faces[face];
    if (!anel) continue;
    for (let i = 0; i < anel.length; i++) usados[anel[i]] = 1;
  }
  const mapa = new Int32Array(total).fill(-1);
  const pos = [];
  for (let i = 0; i < total; i++) {
    if (!usados[i]) continue;
    mapa[i] = Math.floor(pos.length / 3);
    pos.push(malha.pos[i * 3], malha.pos[i * 3 + 1], malha.pos[i * 3 + 2]);
  }
  const faces = [];
  const suave = [];
  const uv = [];
  const mat = [];
  for (let face = 0; face < malha.faces.length; face++) {
    const anel = malha.faces[face];
    if (!anel) continue;
    faces.push(anel.map((indice) => mapa[indice]));
    suave.push(malha.suave[face] === true);
    const lista = Array.isArray(malha.uv) && malha.uv[face] ? malha.uv[face] : null;
    uv.push(lista ? lista.slice() : null);
    const ordem = Array.isArray(malha.mat) ? Number(malha.mat[face]) || 0 : 0;
    mat.push(Math.max(0, Math.trunc(ordem)));
  }
  const cores = Array.isArray(malha.cores) ? [] : null;
  if (cores) {
    for (let i = 0; i < total; i++) {
      if (mapa[i] < 0) continue;
      for (let canal = 0; canal < 3; canal++) {
        const valor = Number(malha.cores[i * 3 + canal]);
        cores.push(isFinite(valor) ? valor : 1);
      }
    }
  }
  malha.pos = pos;
  malha.faces = faces;
  malha.suave = suave;
  malha.uv = uv;
  malha.mat = mat;
  malha.cores = cores;
  malha.vivas = faces.length;
  mod3dMalhaEdTocar(malha);
  return mapa;
}

function mod3dMalhaEdEstatisticas(malha) {
  if (!malha) return { vertices: 0, arestas: 0, faces: 0, quads: 0, triangulos: 0, bordas: 0 };
  const adj = mod3dMalhaEdAdjacencia(malha);
  let bordas = 0;
  let naoManifold = 0;
  adj.arestas.forEach((aresta) => {
      if (aresta.faces.length === 1) bordas += 1;
      if (aresta.faces.length > 2) naoManifold += 1;
  });
  let quads = 0;
  let triangulos = 0;
  let ngons = 0;
  for (let face = 0; face < malha.faces.length; face++) {
    const anel = malha.faces[face];
    if (!anel) continue;
    if (anel.length === 3) triangulos += 1;
    else if (anel.length === 4) quads += 1;
    else ngons += 1;
  }
  return {
    vertices: mod3dMalhaEdTotalDeVertices(malha),
    arestas: adj.arestas.size,
    faces: malha.vivas,
    triangulos,
    quads,
    ngons,
    bordas,
    naoManifold,
  };
}

function mod3dMalhaEdInstantaneo(malha) {
  if (!malha) return null;
  const vivas = mod3dMalhaEdFacesVivas(malha);
  let cantos = 0;
  vivas.forEach((face) => {
      cantos += malha.faces[face].length;
  });
  const indices = new Int32Array(cantos);
  const lados = new Int32Array(vivas.length);
  const suave = new Uint8Array(vivas.length);
  const mat = new Int32Array(vivas.length);
  const uv = [];
  let cursor = 0;
  vivas.forEach((face, ordem) => {
      const anel = malha.faces[face];
      lados[ordem] = anel.length;
      suave[ordem] = malha.suave[face] === true ? 1 : 0;
      const material = Array.isArray(malha.mat) ? Number(malha.mat[face]) || 0 : 0;
      mat[ordem] = Math.max(0, Math.trunc(material));
      const lista = Array.isArray(malha.uv) && malha.uv[face] ? malha.uv[face] : null;
      uv.push(lista ? Float32Array.from(lista) : null);
      for (let i = 0; i < anel.length; i++) {
        indices[cursor] = anel[i];
        cursor += 1;
      }
  });
  return {
    pos: Float64Array.from(malha.pos),
    indices,
    lados,
    suave,
    mat,
    uv,
    cores: Array.isArray(malha.cores) ? Float32Array.from(malha.cores) : null,
    sombreamento: malha.sombreamento,
    angulo: malha.angulo,
  };
}

function mod3dMalhaEdRestaurar(malha, instantaneo) {
  if (!malha || !instantaneo) return false;
  const pos = [];
  for (let i = 0; i < instantaneo.pos.length; i++) pos.push(instantaneo.pos[i]);
  const faces = [];
  const suave = [];
  const uv = [];
  const mat = [];
  let cursor = 0;
  for (let ordem = 0; ordem < instantaneo.lados.length; ordem++) {
    const lados = instantaneo.lados[ordem];
    const anel = [];
    for (let i = 0; i < lados; i++) {
      anel.push(instantaneo.indices[cursor]);
      cursor += 1;
    }
    faces.push(anel);
    suave.push(instantaneo.suave[ordem] === 1);
    const lista = Array.isArray(instantaneo.uv) ? instantaneo.uv[ordem] : null;
    uv.push(lista && lista.length === lados * 2 ? Array.from(lista) : null);
    mat.push(instantaneo.mat ? Math.max(0, instantaneo.mat[ordem]) : 0);
  }
  malha.pos = pos;
  malha.faces = faces;
  malha.suave = suave;
  malha.uv = uv;
  malha.mat = mat;
  malha.cores = instantaneo.cores ? Array.from(instantaneo.cores) : null;
  malha.vivas = faces.length;
  malha.sombreamento = instantaneo.sombreamento || 'plano';
  malha.angulo = instantaneo.angulo || MOD3D_ANGULO_SUAVE_PADRAO;
  mod3dMalhaEdTocar(malha);
  return true;
}

function mod3dMalhaEdClonar(malha) {
  if (!malha) return null;
  const copia = mod3dMalhaEditavel();
  mod3dMalhaEdRestaurar(copia, mod3dMalhaEdInstantaneo(malha));
  return copia;
}

function mod3dMalhaEdDeTriangulos(pos, tolerancia) {
  const malha = mod3dMalhaEditavel();
  if (!pos || !pos.length) return malha;
  const limite = Math.min(
    MOD3D_SOLDA_MAXIMA,
    Math.max(MOD3D_SOLDA_MINIMA, Number(tolerancia) || MOD3D_SOLDA_PADRAO),
  );
  const mapa = new Map();
  const achar = (x, y, z) => {
    const chave = `${Math.round(x / limite)}|${Math.round(y / limite)}|${Math.round(z / limite)}`;
    if (mapa.has(chave)) return mapa.get(chave);
    const indice = mod3dMalhaEdVertice(malha, x, y, z);
    mapa.set(chave, indice);
    return indice;
  };
  for (let i = 0; i + 8 < pos.length; i += 9) {
    const a = achar(pos[i], pos[i + 1], pos[i + 2]);
    const b = achar(pos[i + 3], pos[i + 4], pos[i + 5]);
    const c = achar(pos[i + 6], pos[i + 7], pos[i + 8]);
    if (a < 0 || b < 0 || c < 0) break;
    mod3dMalhaEdFace(malha, [a, b, c], false);
  }
  mod3dMalhaEdTocar(malha);
  return malha;
}

function mod3dAnelInvertido(anel) {
  return anel.slice().reverse();
}

function mod3dMalhaEdCubo(params) {
  const x = params.largura / 2;
  const z = params.profundidade / 2;
  const altura = params.altura;
  const malha = mod3dMalhaEditavel();
  [
    [-x, 0, z],
    [x, 0, z],
    [x, altura, z],
    [-x, altura, z],
    [x, 0, -z],
    [-x, 0, -z],
    [-x, altura, -z],
    [x, altura, -z],
  ].forEach((ponto) => mod3dMalhaEdVertice(malha, ponto[0], ponto[1], ponto[2]));
  [
    [0, 1, 2, 3],
    [4, 5, 6, 7],
    [1, 4, 7, 2],
    [5, 0, 3, 6],
    [3, 2, 7, 6],
    [5, 4, 1, 0],
  ].forEach((anel) => mod3dMalhaEdFace(malha, anel, false));
  return malha;
}

function mod3dMalhaEdPlano(params) {
  const x = params.largura / 2;
  const z = params.profundidade / 2;
  const malha = mod3dMalhaEditavel();
  mod3dMalhaEdVertice(malha, -x, 0, z);
  mod3dMalhaEdVertice(malha, x, 0, z);
  mod3dMalhaEdVertice(malha, x, 0, -z);
  mod3dMalhaEdVertice(malha, -x, 0, -z);
  mod3dMalhaEdFace(malha, [0, 1, 2, 3], false);
  return malha;
}

function mod3dMalhaEdEsfera(params) {
  const raio = params.raio;
  const segmentos = params.segmentos;
  const aneis = params.aneis;
  const malha = mod3dMalhaEditavel();
  const norte = mod3dMalhaEdVertice(malha, 0, raio * 2, 0);
  const faixas = [];
  for (let anel = 1; anel < aneis; anel++) {
    const phi = (anel / aneis) * Math.PI;
    const seno = Math.sin(phi);
    const cosseno = Math.cos(phi);
    const faixa = [];
    for (let fatia = 0; fatia < segmentos; fatia++) {
      const theta = (fatia / segmentos) * Math.PI * 2;
      faixa.push(
        mod3dMalhaEdVertice(
          malha,
          seno * Math.cos(theta) * raio,
          cosseno * raio + raio,
          seno * Math.sin(theta) * raio,
        ),
      );
    }
    faixas.push(faixa);
  }
  const sul = mod3dMalhaEdVertice(malha, 0, 0, 0);
  const primeira = faixas[0] || [];
  for (let fatia = 0; fatia < segmentos; fatia++) {
    const a = primeira[fatia];
    const b = primeira[(fatia + 1) % segmentos];
    mod3dMalhaEdFace(malha, [norte, b, a], true);
  }
  for (let anel = 0; anel < faixas.length - 1; anel++) {
    const alta = faixas[anel];
    const baixa = faixas[anel + 1];
    for (let fatia = 0; fatia < segmentos; fatia++) {
      const proxima = (fatia + 1) % segmentos;
      mod3dMalhaEdFace(malha, [alta[fatia], alta[proxima], baixa[proxima], baixa[fatia]], true);
    }
  }
  const ultima = faixas[faixas.length - 1] || [];
  for (let fatia = 0; fatia < segmentos; fatia++) {
    const a = ultima[fatia];
    const b = ultima[(fatia + 1) % segmentos];
    mod3dMalhaEdFace(malha, [a, b, sul], true);
  }
  malha.sombreamento = 'angulo';
  return malha;
}

function mod3dMalhaEdCilindro(params) {
  const raio = params.raio;
  const altura = params.altura;
  const segmentos = params.segmentos;
  const malha = mod3dMalhaEditavel();
  const baixo = [];
  const alto = [];
  for (let fatia = 0; fatia < segmentos; fatia++) {
    const theta = (fatia / segmentos) * Math.PI * 2;
    const x = Math.cos(theta) * raio;
    const z = Math.sin(theta) * raio;
    baixo.push(mod3dMalhaEdVertice(malha, x, 0, z));
    alto.push(mod3dMalhaEdVertice(malha, x, altura, z));
  }
  for (let fatia = 0; fatia < segmentos; fatia++) {
    const proxima = (fatia + 1) % segmentos;
    mod3dMalhaEdFace(malha, [baixo[fatia], alto[fatia], alto[proxima], baixo[proxima]], true);
  }
  mod3dMalhaEdFace(malha, mod3dAnelInvertido(alto), false);
  mod3dMalhaEdFace(malha, baixo, false);
  malha.sombreamento = 'angulo';
  return malha;
}

function mod3dMalhaEdCone(params) {
  const raio = params.raio;
  const altura = params.altura;
  const segmentos = params.segmentos;
  const malha = mod3dMalhaEditavel();
  const base = [];
  for (let fatia = 0; fatia < segmentos; fatia++) {
    const theta = (fatia / segmentos) * Math.PI * 2;
    base.push(mod3dMalhaEdVertice(malha, Math.cos(theta) * raio, 0, Math.sin(theta) * raio));
  }
  const ponta = mod3dMalhaEdVertice(malha, 0, altura, 0);
  for (let fatia = 0; fatia < segmentos; fatia++) {
    const proxima = (fatia + 1) % segmentos;
    mod3dMalhaEdFace(malha, [base[fatia], ponta, base[proxima]], true);
  }
  mod3dMalhaEdFace(malha, base, false);
  malha.sombreamento = 'angulo';
  return malha;
}

function mod3dMalhaEdToro(params) {
  const raio = params.raio;
  const tubo = Math.min(params.tubo, raio);
  const segmentos = params.segmentos;
  const aneis = params.aneis;
  const malha = mod3dMalhaEditavel();
  const grade = [];
  for (let volta = 0; volta < segmentos; volta++) {
    const u = (volta / segmentos) * Math.PI * 2;
    const linha = [];
    for (let anel = 0; anel < aneis; anel++) {
      const v = (anel / aneis) * Math.PI * 2;
      const distancia = raio + tubo * Math.cos(v);
      linha.push(
        mod3dMalhaEdVertice(
          malha,
          distancia * Math.cos(u),
          tubo + tubo * Math.sin(v),
          distancia * Math.sin(u),
        ),
      );
    }
    grade.push(linha);
  }
  for (let volta = 0; volta < segmentos; volta++) {
    const proximaVolta = (volta + 1) % segmentos;
    for (let anel = 0; anel < aneis; anel++) {
      const proximoAnel = (anel + 1) % aneis;
      mod3dMalhaEdFace(
        malha,
        [
          grade[volta][anel],
          grade[volta][proximoAnel],
          grade[proximaVolta][proximoAnel],
          grade[proximaVolta][anel],
        ],
        true,
      );
    }
  }
  malha.sombreamento = 'angulo';
  return malha;
}

function mod3dMalhaEdRampa(params) {
  const x = params.largura / 2;
  const z = params.profundidade / 2;
  const altura = params.altura;
  const malha = mod3dMalhaEditavel();
  [
    [-x, 0, z],
    [x, 0, z],
    [x, 0, -z],
    [-x, 0, -z],
    [x, altura, -z],
    [-x, altura, -z],
  ].forEach((ponto) => mod3dMalhaEdVertice(malha, ponto[0], ponto[1], ponto[2]));
  [
    [3, 2, 1, 0],
    [0, 1, 4, 5],
    [2, 3, 5, 4],
    [1, 2, 4],
    [3, 0, 5],
  ].forEach((anel) => mod3dMalhaEdFace(malha, anel, false));
  return malha;
}

function mod3dMalhaEdDaPrimitiva(tipo, params) {
  if (!MOD3D_PRIMITIVAS[tipo]) return null;
  const seguros = mod3dParametrosSeguros(tipo, params);
  let malha = null;
  if (tipo === 'cubo') malha = mod3dMalhaEdCubo(seguros);
  else if (tipo === 'plano') malha = mod3dMalhaEdPlano(seguros);
  else if (tipo === 'esfera') malha = mod3dMalhaEdEsfera(seguros);
  else if (tipo === 'cilindro') malha = mod3dMalhaEdCilindro(seguros);
  else if (tipo === 'cone') malha = mod3dMalhaEdCone(seguros);
  else if (tipo === 'toro') malha = mod3dMalhaEdToro(seguros);
  else if (tipo === 'rampa') malha = mod3dMalhaEdRampa(seguros);
  if (!malha) return null;
  mod3dMalhaEdTocar(malha);
  return malha;
}

function mod3dMalhaEdTriangulosDaFace(malha, face) {
  const anel = malha.faces[face];
  if (!anel || anel.length < 3) return 0;
  return anel.length >= 5 ? anel.length : anel.length - 2;
}

function mod3dMalhaEdTriangular(malha) {
  if (!malha) return null;
  if (malha.saida && malha.saida.versao === malha.versao) return malha.saida.dados;
  const normais = mod3dNormaisDaMalha(malha);
  mod3dMalhaEdUvGarantido(malha);
  mod3dMalhaEdMatGarantido(malha);
  const temCor = mod3dMalhaEdTemCores(malha);
  let triangulos = 0;
  for (let face = 0; face < malha.faces.length; face++) {
    triangulos += mod3dMalhaEdTriangulosDaFace(malha, face);
  }
  const pos = new Float32Array(triangulos * 9);
  const nrm = new Float32Array(triangulos * 9);
  const uv = new Float32Array(triangulos * 6);
  const cor = temCor ? new Float32Array(triangulos * 9) : null;
  const minimo = [Infinity, Infinity, Infinity];
  const maximo = [-Infinity, -Infinity, -Infinity];
  let cursor = 0;
  let passo = 0;
  const por = (ponto, normal, coordenada, tinta) => {
    pos[cursor] = ponto[0];
    pos[cursor + 1] = ponto[1];
    pos[cursor + 2] = ponto[2];
    nrm[cursor] = normal[0];
    nrm[cursor + 1] = normal[1];
    nrm[cursor + 2] = normal[2];
    if (cor) {
      cor[cursor] = tinta ? tinta[0] : 1;
      cor[cursor + 1] = tinta ? tinta[1] : 1;
      cor[cursor + 2] = tinta ? tinta[2] : 1;
    }
    uv[passo] = coordenada ? coordenada[0] : 0;
    uv[passo + 1] = coordenada ? coordenada[1] : 0;
    for (let eixo = 0; eixo < 3; eixo++) {
      const valor = ponto[eixo];
      if (valor < minimo[eixo]) minimo[eixo] = valor;
      if (valor > maximo[eixo]) maximo[eixo] = valor;
    }
    cursor += 3;
    passo += 2;
  };
  const tintaDoVertice = (indice) => {
    if (!temCor) return null;
    const base = indice * 3;
    return [malha.cores[base], malha.cores[base + 1], malha.cores[base + 2]];
  };
  const mediaDosCantos = (lista, largura) => {
    const validos = lista.filter((item) => Boolean(item));
    if (!validos.length) return null;
    const soma = new Array(largura).fill(0);
    validos.forEach((item) => {
        for (let i = 0; i < largura; i++) soma[i] += item[i];
    });
    return soma.map((valor) => valor / validos.length);
  };
  const porMaterial = new Map();
  for (let face = 0; face < malha.faces.length; face++) {
    const anel = malha.faces[face];
    if (!anel || anel.length < 3) continue;
    const ordem = Math.max(0, Math.trunc(Number(malha.mat[face]) || 0));
    if (!porMaterial.has(ordem)) porMaterial.set(ordem, []);
    porMaterial.get(ordem).push(face);
  }
  const grupos = [];
  Array.from(porMaterial.keys())
  .sort((a, b) => a - b)
  .forEach((material) => {
      const inicio = cursor / 3;
      porMaterial.get(material).forEach((face) => {
          const anel = malha.faces[face];
          const normalDaFace = mod3dNormalDaFaceGuardada(normais, face);
          const pontos = anel.map((indice) => mod3dMalhaEdPonto(malha, indice));
          const tintas = anel.map((indice) => tintaDoVertice(indice));
          const guardado = Array.isArray(malha.uv[face]) ? malha.uv[face] : null;
          const cantos = anel.map((indice, canto) =>
            guardado ? [guardado[canto * 2], guardado[canto * 2 + 1]] : null,
          );
          const normaisDoCanto = anel.map((indice, canto) =>
            mod3dNormalDoCantoGuardada(normais, face, canto, normalDaFace),
          );
          if (anel.length >= 5) {
            const centro = mod3dMalhaEdCentroDaFace(malha, face);
            const tintaDoCentro = mediaDosCantos(tintas, 3);
            const uvDoCentro = mediaDosCantos(cantos, 2);
            for (let i = 0; i < anel.length; i++) {
              const proximo = (i + 1) % anel.length;
              por(centro, normalDaFace, uvDoCentro, tintaDoCentro);
              por(pontos[i], normaisDoCanto[i], cantos[i], tintas[i]);
              por(pontos[proximo], normaisDoCanto[proximo], cantos[proximo], tintas[proximo]);
            }
            return;
          }
          for (let i = 1; i < anel.length - 1; i++) {
            por(pontos[0], normaisDoCanto[0], cantos[0], tintas[0]);
            por(pontos[i], normaisDoCanto[i], cantos[i], tintas[i]);
            por(pontos[i + 1], normaisDoCanto[i + 1], cantos[i + 1], tintas[i + 1]);
          }
      });
      const conta = cursor / 3 - inicio;
      if (conta > 0) grupos.push({ material, inicio, conta });
  });
  if (!pos.length) {
    for (let eixo = 0; eixo < 3; eixo++) {
      minimo[eixo] = 0;
      maximo[eixo] = 0;
    }
  }
  const dados = { pos, nrm, uv, cor, grupos, minimo, maximo, triangulos: pos.length / 9 };
  malha.saida = { versao: malha.versao, dados };
  return dados;
}
