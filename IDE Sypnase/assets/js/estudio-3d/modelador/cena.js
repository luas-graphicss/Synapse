'use strict';

const MOD3D_TETO_DE_NOS = 400;
const MOD3D_NOME_DO_NO_MAXIMO = 48;
const MOD3D_ESCALA_MINIMA = 0.001;
const MOD3D_ESCALA_MAXIMA = 1000;
const MOD3D_POSICAO_MAXIMA = 100000;
const MOD3D_GRAU_EM_RADIANO = Math.PI / 180;

const mod3dGrafo = {
  nos: new Map(),
  raizes: [],
  selecao: [],
  contador: 0,
  versao: 0,
  ouvintes: [],
};

function mod3dMatIdentidade() {
  const m = new Float32Array(16);
  m[0] = 1;
  m[5] = 1;
  m[10] = 1;
  m[15] = 1;
  return m;
}

function mod3dMatMultiplicar(a, b) {
  const m = new Float32Array(16);
  for (let coluna = 0; coluna < 4; coluna++) {
    for (let linha = 0; linha < 4; linha++) {
      let soma = 0;
      for (let k = 0; k < 4; k++) soma += a[k * 4 + linha] * b[coluna * 4 + k];
      m[coluna * 4 + linha] = soma;
    }
  }
  return m;
}

function mod3dMatDeTRS(pos, rot, esc) {
  const rx = (rot[0] || 0) * MOD3D_GRAU_EM_RADIANO;
  const ry = (rot[1] || 0) * MOD3D_GRAU_EM_RADIANO;
  const rz = (rot[2] || 0) * MOD3D_GRAU_EM_RADIANO;
  const cx = Math.cos(rx);
  const sx = Math.sin(rx);
  const cy = Math.cos(ry);
  const sy = Math.sin(ry);
  const cz = Math.cos(rz);
  const sz = Math.sin(rz);
  const r00 = cz * cy;
  const r01 = cz * sy * sx - sz * cx;
  const r02 = cz * sy * cx + sz * sx;
  const r10 = sz * cy;
  const r11 = sz * sy * sx + cz * cx;
  const r12 = sz * sy * cx - cz * sx;
  const r20 = -sy;
  const r21 = cy * sx;
  const r22 = cy * cx;
  const ex = esc[0];
  const ey = esc[1];
  const ez = esc[2];
  const m = new Float32Array(16);
  m[0] = r00 * ex;
  m[1] = r10 * ex;
  m[2] = r20 * ex;
  m[4] = r01 * ey;
  m[5] = r11 * ey;
  m[6] = r21 * ey;
  m[8] = r02 * ez;
  m[9] = r12 * ez;
  m[10] = r22 * ez;
  m[12] = pos[0];
  m[13] = pos[1];
  m[14] = pos[2];
  m[15] = 1;
  return m;
}

function mod3dQuatDeGraus(rot) {
  const mx = (rot[0] || 0) * MOD3D_GRAU_EM_RADIANO * 0.5;
  const my = (rot[1] || 0) * MOD3D_GRAU_EM_RADIANO * 0.5;
  const mz = (rot[2] || 0) * MOD3D_GRAU_EM_RADIANO * 0.5;
  const cx = Math.cos(mx);
  const sx = Math.sin(mx);
  const cy = Math.cos(my);
  const sy = Math.sin(my);
  const cz = Math.cos(mz);
  const sz = Math.sin(mz);
  return [
    sx * cy * cz - cx * sy * sz,
    cx * sy * cz + sx * cy * sz,
    cx * cy * sz - sx * sy * cz,
    cx * cy * cz + sx * sy * sz,
  ];
}

function mod3dMatInversa(m) {
  const a00 = m[0];
  const a01 = m[1];
  const a02 = m[2];
  const a03 = m[3];
  const a10 = m[4];
  const a11 = m[5];
  const a12 = m[6];
  const a13 = m[7];
  const a20 = m[8];
  const a21 = m[9];
  const a22 = m[10];
  const a23 = m[11];
  const a30 = m[12];
  const a31 = m[13];
  const a32 = m[14];
  const a33 = m[15];
  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;
  const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) return null;
  const i = 1 / det;
  const saida = new Float32Array(16);
  saida[0] = (a11 * b11 - a12 * b10 + a13 * b09) * i;
  saida[1] = (a02 * b10 - a01 * b11 - a03 * b09) * i;
  saida[2] = (a31 * b05 - a32 * b04 + a33 * b03) * i;
  saida[3] = (a22 * b04 - a21 * b05 - a23 * b03) * i;
  saida[4] = (a12 * b08 - a10 * b11 - a13 * b07) * i;
  saida[5] = (a00 * b11 - a02 * b08 + a03 * b07) * i;
  saida[6] = (a32 * b02 - a30 * b05 - a33 * b01) * i;
  saida[7] = (a20 * b05 - a22 * b02 + a23 * b01) * i;
  saida[8] = (a10 * b10 - a11 * b08 + a13 * b06) * i;
  saida[9] = (a01 * b08 - a00 * b10 - a03 * b06) * i;
  saida[10] = (a30 * b04 - a31 * b02 + a33 * b00) * i;
  saida[11] = (a21 * b02 - a20 * b04 - a23 * b00) * i;
  saida[12] = (a11 * b07 - a10 * b09 - a12 * b06) * i;
  saida[13] = (a00 * b09 - a01 * b07 + a02 * b06) * i;
  saida[14] = (a31 * b01 - a30 * b03 - a32 * b00) * i;
  saida[15] = (a20 * b03 - a21 * b01 + a22 * b00) * i;
  return saida;
}

function mod3dPontoPorMat(m, p) {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

function mod3dVetorPorMat(m, v) {
  return [
    m[0] * v[0] + m[4] * v[1] + m[8] * v[2],
    m[1] * v[0] + m[5] * v[1] + m[9] * v[2],
    m[2] * v[0] + m[6] * v[1] + m[10] * v[2],
  ];
}

function mod3dNormalizarVetor(v) {
  const tamanho = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / tamanho, v[1] / tamanho, v[2] / tamanho];
}

function mod3dEixosDaMatriz(m) {
  return [
    mod3dNormalizarVetor([m[0], m[1], m[2]]),
    mod3dNormalizarVetor([m[4], m[5], m[6]]),
    mod3dNormalizarVetor([m[8], m[9], m[10]]),
  ];
}

function mod3dMatNormalDe(m) {
  const inversa = mod3dMatInversa(m);
  if (!inversa) return [m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]];
  return [
    inversa[0],
    inversa[4],
    inversa[8],
    inversa[1],
    inversa[5],
    inversa[9],
    inversa[2],
    inversa[6],
    inversa[10],
  ];
}

function mod3dCenaAoMudar(fn) {
  if (typeof fn === 'function') mod3dGrafo.ouvintes.push(fn);
}

function mod3dCenaTocar() {
  mod3dGrafo.versao += 1;
  mod3dGrafo.ouvintes.forEach((fn) => {
      try {
        fn();
      } catch (erro) {
        ignorarErro(erro, 'mod3dCenaTocar');
      }
  });
}

function mod3dCenaLimpar() {
  mod3dGrafo.nos.clear();
  mod3dGrafo.raizes = [];
  mod3dGrafo.selecao = [];
  mod3dGrafo.contador = 0;
}

function mod3dNoPorId(id) {
  return mod3dGrafo.nos.get(id) || null;
}

function mod3dNomeSeguroDoNo(nome, padrao) {
  const limpo = String(nome === undefined || nome === null ? '' : nome)
  .replace(/[\r\n\t]+/g, ' ')
  .trim()
  .slice(0, MOD3D_NOME_DO_NO_MAXIMO);
  return limpo || padrao;
}

function mod3dNomeLivreDoNo(base) {
  const usados = new Set();
  mod3dGrafo.nos.forEach((no) => usados.add(no.nome));
  if (!usados.has(base)) return base;
  for (let numero = 2; numero < MOD3D_TETO_DE_NOS + 2; numero++) {
    const tentativa = `${base} ${numero}`;
    if (!usados.has(tentativa)) return tentativa;
  }
  return `${base} ${Date.now()}`;
}

function mod3dTrioSeguro(valores, padrao, minimo, maximo) {
  const bruto = Array.isArray(valores) ? valores : [];
  const saida = [];
  for (let i = 0; i < 3; i++) {
    const numero = Number(bruto[i]);
    saida.push(isFinite(numero) ? Math.min(maximo, Math.max(minimo, numero)) : padrao[i]);
  }
  return saida;
}

function mod3dPosicaoSegura(valores) {
  return mod3dTrioSeguro(valores, [0, 0, 0], -MOD3D_POSICAO_MAXIMA, MOD3D_POSICAO_MAXIMA);
}

function mod3dRotacaoSegura(valores) {
  const trio = mod3dTrioSeguro(valores, [0, 0, 0], -100000, 100000);
  return trio.map((grau) => {
      const voltas = grau % 360;
      return Math.round(voltas * 1000) / 1000;
  });
}

function mod3dEscalaSegura(valores) {
  const trio = mod3dTrioSeguro(valores, [1, 1, 1], -MOD3D_ESCALA_MAXIMA, MOD3D_ESCALA_MAXIMA);
  return trio.map((valor) => {
      const grandeza = Math.max(MOD3D_ESCALA_MINIMA, Math.abs(valor));
      return valor < 0 ? -grandeza : grandeza;
  });
}

function mod3dEdicaoDoNo(valor) {
  if (!valor) return null;
  if (Array.isArray(valor.faces)) {
    return typeof mod3dCaptureEditableMesh === 'function'
    ? mod3dRestoreEditableMesh(mod3dCaptureEditableMesh(valor))
    : mod3dMalhaEdClonar(valor);
  }
  const malha = mod3dMalhaEditavel();
  mod3dMalhaEdRestaurar(malha, valor);
  return malha;
}

function mod3dCriarNo(pedido) {
  if (mod3dGrafo.nos.size >= MOD3D_TETO_DE_NOS) return null;
  const dados = pedido || {};
  const tipo =
  dados.tipo === 'grupo' || dados.tipo === 'malha' || MOD3D_PRIMITIVAS[dados.tipo]
  ? dados.tipo
  : 'cubo';
  const molde = MOD3D_PRIMITIVAS[tipo];
  let padrao = 'Grupo';
  if (tipo === 'malha') padrao = 'Malha';
  if (molde) padrao = molde.rotulo;
  mod3dGrafo.contador += 1;
  const no = {
    id: dados.id || `no-${mod3dGrafo.contador}`,
    nome: mod3dNomeLivreDoNo(mod3dNomeSeguroDoNo(dados.nome, padrao)),
    tipo,
    pai: '',
    filhos: [],
    pos: mod3dPosicaoSegura(dados.pos),
    rot: mod3dRotacaoSegura(dados.rot),
    esc: mod3dEscalaSegura(dados.esc),
    pivo: mod3dPosicaoSegura(dados.pivo),
    params: tipo === 'grupo' || tipo === 'malha' ? {} : mod3dParametrosSeguros(tipo, dados.params),
    cor: dados.cor
    ? mod3dTrioSeguro(dados.cor, blenderDefaultObjectColor(), 0, 1)
    : blenderDefaultObjectColor(),
    visivel: dados.visivel !== false,
    travado: dados.travado === true,
    edicao: mod3dEdicaoDoNo(dados.edicao),
    materiais: mod3dMateriaisSeguros(dados.materiais),
    projecao: mod3dProjecaoDeUvSegura(dados.projecao),
    malha: null,
    mundo: null,
    versao: 0,
  };
  mod3dGrafo.nos.set(no.id, no);
  mod3dEncaixarNoPai(no, dados.pai || '', dados.indice);
  return no;
}

function mod3dEncaixarNoPai(no, paiId, indice) {
  const pai = paiId ? mod3dNoPorId(paiId) : null;
  const lista = pai ? pai.filhos : mod3dGrafo.raizes;
  no.pai = pai ? pai.id : '';
  const posicao =
  typeof indice === 'number' && indice >= 0 ? Math.min(indice, lista.length) : lista.length;
  lista.splice(posicao, 0, no.id);
}

function mod3dTirarDoPai(no) {
  const pai = no.pai ? mod3dNoPorId(no.pai) : null;
  const lista = pai ? pai.filhos : mod3dGrafo.raizes;
  const indice = lista.indexOf(no.id);
  if (indice >= 0) lista.splice(indice, 1);
  return indice < 0 ? lista.length : indice;
}

function mod3dDescendentesDoNo(id) {
  const saida = [];
  const fila = [id];
  while (fila.length) {
    const atual = mod3dNoPorId(fila.shift());
    if (!atual) continue;
    atual.filhos.forEach((filho) => {
        saida.push(filho);
        fila.push(filho);
    });
  }
  return saida;
}

function mod3dNosEmOrdem() {
  const saida = [];
  const descer = (id, nivel) => {
    const no = mod3dNoPorId(id);
    if (!no) return;
    saida.push({ no, nivel });
    no.filhos.forEach((filho) => descer(filho, nivel + 1));
  };
  mod3dGrafo.raizes.forEach((id) => descer(id, 0));
  return saida;
}

function mod3dDadosDoNo(no, comMalha) {
  const dados = {
    id: no.id,
    nome: no.nome,
    tipo: no.tipo,
    pos: no.pos.slice(),
    rot: no.rot.slice(),
    esc: no.esc.slice(),
    pivo: no.pivo.slice(),
    params: Object.assign({}, no.params),
    cor: no.cor.slice(),
    visivel: no.visivel,
    travado: no.travado,
    materiais: mod3dClonarMateriais(no.materiais),
    projecao: mod3dProjecaoDoNo(no),
  };
  if (comMalha && no.edicao) {
    dados.edicao =
    typeof mod3dCaptureEditableMesh === 'function'
    ? mod3dRestoreEditableMesh(mod3dCaptureEditableMesh(no.edicao))
    : mod3dMalhaEdInstantaneo(no.edicao);
  }
  return dados;
}

function mod3dRetirarSubarvore(id) {
  const raiz = mod3dNoPorId(id);
  if (!raiz) return null;
  const ids = [id].concat(mod3dDescendentesDoNo(id));
  const pai = raiz.pai;
  const indice = mod3dTirarDoPai(raiz);
  const pecas = ids.map((cada) => {
      const no = mod3dNoPorId(cada);
      return { dados: mod3dDadosDoNo(no, true), pai: no.pai, filhos: no.filhos.slice() };
  });
  ids.forEach((cada) => mod3dGrafo.nos.delete(cada));
  mod3dGrafo.selecao = mod3dGrafo.selecao.filter((cada) => ids.indexOf(cada) < 0);
  return { raiz: id, pai, indice, pecas };
}

function mod3dDevolverSubarvore(pacote) {
  if (!pacote) return null;
  pacote.pecas.forEach((peca) => {
      const no = {
        id: peca.dados.id,
        nome: peca.dados.nome,
        tipo: peca.dados.tipo,
        pai: peca.pai,
        filhos: peca.filhos.slice(),
        pos: peca.dados.pos.slice(),
        rot: peca.dados.rot.slice(),
        esc: peca.dados.esc.slice(),
        pivo: peca.dados.pivo.slice(),
        params: Object.assign({}, peca.dados.params),
        cor: peca.dados.cor.slice(),
        visivel: peca.dados.visivel,
        travado: peca.dados.travado,
        materiais: mod3dClonarMateriais(peca.dados.materiais),
        projecao: mod3dProjecaoDeUvSegura(peca.dados.projecao),
        edicao: mod3dEdicaoDoNo(peca.dados.edicao),
        malha: null,
        mundo: null,
        versao: 0,
      };
      mod3dGrafo.nos.set(no.id, no);
  });
  const raiz = mod3dNoPorId(pacote.raiz);
  if (!raiz) return null;
  const pai = pacote.pai ? mod3dNoPorId(pacote.pai) : null;
  const lista = pai ? pai.filhos : mod3dGrafo.raizes;
  const posicao = Math.min(Math.max(0, pacote.indice), lista.length);
  lista.splice(posicao, 0, raiz.id);
  raiz.pai = pai ? pai.id : '';
  return raiz;
}

function mod3dPodeSerPaiDoNo(id, paiNovo) {
  if (!paiNovo) return true;
  if (id === paiNovo) return false;
  return mod3dDescendentesDoNo(id).indexOf(paiNovo) < 0;
}

function mod3dReparentarNo(id, paiNovo) {
  const no = mod3dNoPorId(id);
  if (!no || !mod3dPodeSerPaiDoNo(id, paiNovo)) return false;
  mod3dTirarDoPai(no);
  mod3dEncaixarNoPai(no, paiNovo || '', undefined);
  mod3dMarcarNoSujo(no);
  return true;
}

function mod3dMarcarNoSujo(no) {
  if (!no) return;
  no.mundo = null;
  no.versao += 1;
  mod3dDescendentesDoNo(no.id).forEach((id) => {
      const filho = mod3dNoPorId(id);
      if (!filho) return;
      filho.mundo = null;
      filho.versao += 1;
  });
}

function mod3dMalhaLocalDoNo(no) {
  if (!no || no.tipo === 'grupo') return null;
  if (no.tipo === 'malha') return editableMeshGeometryOfNode(no);
  if (no.malha) return no.malha;
  no.malha = mod3dPrimitivaMalha(no.tipo, no.params);
  if (no.malha && no.malha.pos && !no.malha.uv) {
    no.malha.uv = mod3dUvDosTriangulos(no.malha.pos, no.malha.nrm, mod3dProjecaoDoNo(no), null);
    no.malha.cor = null;
    no.malha.grupos = [{ material: 0, inicio: 0, conta: no.malha.pos.length / 3 }];
  }
  return no.malha;
}

function mod3dMatrizLocalDoNo(no) {
  return mod3dMatDeTRS(no.pos, no.rot, no.esc);
}

function mod3dMatrizMundialDoNo(no) {
  const cadeia = [];
  let atual = no;
  while (atual) {
    cadeia.unshift(atual);
    atual = atual.pai ? mod3dNoPorId(atual.pai) : null;
  }
  let matriz = mod3dMatIdentidade();
  cadeia.forEach((cada) => {
      matriz = mod3dMatMultiplicar(matriz, mod3dMatrizLocalDoNo(cada));
  });
  return matriz;
}

function mod3dMundoDoNo(no) {
  if (!no) return null;
  const meshVersion = editableMeshVersionOfNode(no);
  if (no.mundo && no.mundo.meshVersion === meshVersion) return no.mundo;
  const matriz = mod3dMatrizMundialDoNo(no);
  const local = mod3dMalhaLocalDoNo(no);
  const mundo = {
    meshVersion,
    mat: matriz,
    pos: null,
    nrm: null,
    uv: null,
    cor: null,
    grupos: null,
    minimo: null,
    maximo: null,
    triangulos: 0,
    origem: mod3dPontoPorMat(matriz, [0, 0, 0]),
    eixos: mod3dEixosDaMatriz(matriz),
  };
  if (local && local.pos.length) {
    const total = local.pos.length;
    const pos = new Float32Array(total);
    const nrm = new Float32Array(total);
    const normal = mod3dMatNormalDe(matriz);
    const minimo = [Infinity, Infinity, Infinity];
    const maximo = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < total; i += 3) {
      const lx = local.pos[i] - no.pivo[0];
      const ly = local.pos[i + 1] - no.pivo[1];
      const lz = local.pos[i + 2] - no.pivo[2];
      const x = matriz[0] * lx + matriz[4] * ly + matriz[8] * lz + matriz[12];
      const y = matriz[1] * lx + matriz[5] * ly + matriz[9] * lz + matriz[13];
      const z = matriz[2] * lx + matriz[6] * ly + matriz[10] * lz + matriz[14];
      pos[i] = x;
      pos[i + 1] = y;
      pos[i + 2] = z;
      if (x < minimo[0]) minimo[0] = x;
      if (y < minimo[1]) minimo[1] = y;
      if (z < minimo[2]) minimo[2] = z;
      if (x > maximo[0]) maximo[0] = x;
      if (y > maximo[1]) maximo[1] = y;
      if (z > maximo[2]) maximo[2] = z;
      const nx = local.nrm[i];
      const ny = local.nrm[i + 1];
      const nz = local.nrm[i + 2];
      const tx = normal[0] * nx + normal[1] * ny + normal[2] * nz;
      const ty = normal[3] * nx + normal[4] * ny + normal[5] * nz;
      const tz = normal[6] * nx + normal[7] * ny + normal[8] * nz;
      const tamanho = Math.hypot(tx, ty, tz) || 1;
      nrm[i] = tx / tamanho;
      nrm[i + 1] = ty / tamanho;
      nrm[i + 2] = tz / tamanho;
    }
    mundo.pos = pos;
    mundo.nrm = nrm;
    mundo.uv = local.uv || null;
    mundo.cor = local.cor || null;
    mundo.grupos = local.grupos || null;
    mundo.minimo = minimo;
    mundo.maximo = maximo;
    mundo.triangulos = total / 9;
  }
  no.mundo = mundo;
  return mundo;
}

function mod3dCaixaDeNos(ids) {
  const minimo = [Infinity, Infinity, Infinity];
  const maximo = [-Infinity, -Infinity, -Infinity];
  let achou = false;
  (ids || []).forEach((id) => {
      const no = mod3dNoPorId(id);
      if (!no) return;
      const lista = [no.id].concat(mod3dDescendentesDoNo(no.id));
      lista.forEach((cada) => {
          const filho = mod3dNoPorId(cada);
          if (!filho || !filho.visivel) return;
          const mundo = mod3dMundoDoNo(filho);
          if (!mundo || !mundo.minimo) return;
          achou = true;
          for (let eixo = 0; eixo < 3; eixo++) {
            if (mundo.minimo[eixo] < minimo[eixo]) minimo[eixo] = mundo.minimo[eixo];
            if (mundo.maximo[eixo] > maximo[eixo]) maximo[eixo] = mundo.maximo[eixo];
          }
      });
  });
  return achou ? { minimo, maximo } : null;
}

function mod3dCaixaDaCenaToda() {
  return mod3dCaixaDeNos(Array.from(mod3dGrafo.nos.keys()));
}

function mod3dSelecionarNos(ids) {
  const lista = Array.isArray(ids) ? ids : ids ? [ids] : [];
  mod3dGrafo.selecao = lista.filter((id) => mod3dGrafo.nos.has(id));
  return mod3dGrafo.selecao.slice();
}

function mod3dNoSelecionado() {
  if (!mod3dGrafo.selecao.length) return null;
  return mod3dNoPorId(mod3dGrafo.selecao[0]);
}

function mod3dEstadoDoNo(no) {
  if (!no) return null;
  return {
    nome: no.nome,
    pos: no.pos.slice(),
    rot: no.rot.slice(),
    esc: no.esc.slice(),
    pivo: no.pivo.slice(),
    params: Object.assign({}, no.params),
    visivel: no.visivel,
    travado: no.travado,
    pai: no.pai,
    materiais: mod3dClonarMateriais(no.materiais),
    projecao: mod3dProjecaoDoNo(no),
  };
}

function mod3dAplicarEstadoNoNo(id, estado) {
  const no = mod3dNoPorId(id);
  if (!no || !estado) return false;
  const malhaMudou =
  JSON.stringify(estado.params || {}) !== JSON.stringify(no.params || {}) ||
  estado.pivo.join(',') !== no.pivo.join(',');
  no.nome = mod3dNomeSeguroDoNo(estado.nome, no.nome);
  no.pos = mod3dPosicaoSegura(estado.pos);
  no.rot = mod3dRotacaoSegura(estado.rot);
  no.esc = mod3dEscalaSegura(estado.esc);
  no.pivo = mod3dPosicaoSegura(estado.pivo);
  no.visivel = estado.visivel !== false;
  no.travado = estado.travado === true;
  if (estado.materiais) no.materiais = mod3dMateriaisSeguros(estado.materiais);
  if (estado.projecao) no.projecao = mod3dProjecaoDeUvSegura(estado.projecao);
  if (no.tipo !== 'grupo') no.params = mod3dParametrosSeguros(no.tipo, estado.params);
  if (typeof estado.pai === 'string' && estado.pai !== no.pai) {
    if (mod3dPodeSerPaiDoNo(no.id, estado.pai)) {
      mod3dTirarDoPai(no);
      mod3dEncaixarNoPai(no, estado.pai, undefined);
    }
  }
  if (malhaMudou) no.malha = null;
  mod3dMarcarNoSujo(no);
  return true;
}

function mod3dPivoCentralizadoDoNo(no) {
  const local = mod3dMalhaLocalDoNo(no);
  if (!local) return no.pivo.slice();
  return [
    (local.minimo[0] + local.maximo[0]) / 2,
    (local.minimo[1] + local.maximo[1]) / 2,
    (local.minimo[2] + local.maximo[2]) / 2,
  ];
}

function mod3dPivoNaBaseDoNo(no) {
  const local = mod3dMalhaLocalDoNo(no);
  if (!local) return no.pivo.slice();
  return [
    (local.minimo[0] + local.maximo[0]) / 2,
    local.minimo[1],
    (local.minimo[2] + local.maximo[2]) / 2,
  ];
}

function mod3dClonarSubarvore(id, paiDestino) {
  const raiz = mod3dNoPorId(id);
  if (!raiz) return null;
  const copiar = (origem, pai) => {
    const dados = mod3dDadosDoNo(origem, true);
    const novo = mod3dCriarNo({
        tipo: dados.tipo,
        edicao: dados.edicao,
        nome: dados.nome,
        pos: dados.pos,
        rot: dados.rot,
        esc: dados.esc,
        pivo: dados.pivo,
        params: dados.params,
        cor: dados.cor,
        visivel: dados.visivel,
        travado: dados.travado,
        materiais: dados.materiais,
        projecao: dados.projecao,
        pai,
    });
    if (!novo) return null;
    origem.filhos.forEach((filho) => {
        const no = mod3dNoPorId(filho);
        if (no) copiar(no, novo.id);
    });
    return novo;
  };
  return copiar(raiz, paiDestino === undefined ? raiz.pai : paiDestino);
}

function mod3dCenaResumo() {
  let triangulos = 0;
  let visiveis = 0;
  mod3dGrafo.nos.forEach((no) => {
      if (no.tipo === 'grupo') return;
      const mundo = mod3dMundoDoNo(no);
      if (!mundo) return;
      if (no.visivel) visiveis += 1;
      triangulos += mundo.triangulos;
  });
  return {
    nos: mod3dGrafo.nos.size,
    visiveis,
    triangulos,
    selecao: mod3dGrafo.selecao.slice(),
    versao: mod3dGrafo.versao,
  };
}
