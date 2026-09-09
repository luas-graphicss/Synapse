'use strict';

const MOD3D_PROJECOES_DE_UV = Object.freeze([
    Object.freeze({ chave: 'plana', rotulo: 'Plana' }),
    Object.freeze({ chave: 'cubica', rotulo: 'Cúbica' }),
    Object.freeze({ chave: 'cilindrica', rotulo: 'Cilíndrica' }),
    Object.freeze({ chave: 'esferica', rotulo: 'Esférica' }),
]);

const MOD3D_ALINHAMENTOS_DE_UV = Object.freeze([
    Object.freeze({ chave: 'esquerda', rotulo: 'Esquerda' }),
    Object.freeze({ chave: 'direita', rotulo: 'Direita' }),
    Object.freeze({ chave: 'base', rotulo: 'Base' }),
    Object.freeze({ chave: 'topo', rotulo: 'Topo' }),
    Object.freeze({ chave: 'centro', rotulo: 'Centro' }),
    Object.freeze({ chave: 'encaixar', rotulo: 'Encaixar' }),
]);

const MOD3D_PROJECAO_PADRAO = 'cubica';
const MOD3D_ANGULO_DA_ILHA_PADRAO = 40;
const MOD3D_ANGULO_DA_ILHA_MINIMO = 1;
const MOD3D_ANGULO_DA_ILHA_MAXIMO = 180;
const MOD3D_MARGEM_DAS_ILHAS = 0.02;
const MOD3D_CASAS_DO_UV = 5;
const MOD3D_UV_LIMITE = 64;
const MOD3D_COSTURA_DO_UV = 0.5;
const MOD3D_TOLERANCIA_DO_UV = 0.0001;

function mod3dProjecaoDeUvSegura(chave) {
  for (let i = 0; i < MOD3D_PROJECOES_DE_UV.length; i++) {
    if (MOD3D_PROJECOES_DE_UV[i].chave === chave) return chave;
  }
  return MOD3D_PROJECAO_PADRAO;
}

function mod3dAlinhamentoDeUvSeguro(chave) {
  for (let i = 0; i < MOD3D_ALINHAMENTOS_DE_UV.length; i++) {
    if (MOD3D_ALINHAMENTOS_DE_UV[i].chave === chave) return chave;
  }
  return 'centro';
}

function mod3dAnguloDaIlhaSeguro(valor) {
  const numero = Number(valor);
  if (!isFinite(numero)) return MOD3D_ANGULO_DA_ILHA_PADRAO;
  return Math.min(MOD3D_ANGULO_DA_ILHA_MAXIMO, Math.max(MOD3D_ANGULO_DA_ILHA_MINIMO, numero));
}

function mod3dNumeroDoUv(valor) {
  const numero = Number(valor);
  if (!isFinite(numero)) return 0;
  const preso = Math.min(MOD3D_UV_LIMITE, Math.max(-MOD3D_UV_LIMITE, numero));
  const peso = Math.pow(10, MOD3D_CASAS_DO_UV);
  return Math.round(preso * peso) / peso;
}

function mod3dUvDaFace(malha, face) {
  if (!malha || !Array.isArray(malha.uv)) return null;
  const lista = malha.uv[face];
  const anel = malha.faces[face];
  if (!lista || !anel || lista.length !== anel.length * 2) return null;
  return lista;
}

function mod3dDefinirUvDaFace(malha, face, lista) {
  const anel = malha && malha.faces ? malha.faces[face] : null;
  if (!anel) return false;
  mod3dMalhaEdUvGarantido(malha);
  if (!lista) {
    malha.uv[face] = null;
    return true;
  }
  const saida = [];
  for (let i = 0; i < anel.length; i++) {
    saida.push(mod3dNumeroDoUv(lista[i * 2]), mod3dNumeroDoUv(lista[i * 2 + 1]));
  }
  malha.uv[face] = saida;
  return true;
}

function mod3dMalhaTemUv(malha) {
  if (!malha || !Array.isArray(malha.uv)) return false;
  for (let face = 0; face < malha.faces.length; face++) {
    if (mod3dUvDaFace(malha, face)) return true;
  }
  return false;
}

function mod3dFacesDoUv(malha, faces) {
  if (!malha) return [];
  const bruto = faces instanceof Set ? Array.from(faces) : Array.isArray(faces) ? faces : [];
  const lista = bruto.length ? bruto : mod3dMalhaEdFacesVivas(malha);
  return lista.filter((face) => Boolean(malha.faces[face]));
}

function mod3dPontoNoEixo(ponto, eixo) {
  return ponto[0] * eixo[0] + ponto[1] * eixo[1] + ponto[2] * eixo[2];
}

function mod3dCaixaFechadaDoUv(minimo, maximo) {
  const lados = [maximo[0] - minimo[0], maximo[1] - minimo[1], maximo[2] - minimo[2]];
  const escala = Math.max(lados[0], lados[1], lados[2], 0.000001);
  return {
    minimo,
    maximo,
    centro: [
      (minimo[0] + maximo[0]) / 2,
      (minimo[1] + maximo[1]) / 2,
      (minimo[2] + maximo[2]) / 2,
    ],
    escala,
  };
}

function mod3dCaixaDeFacesDoUv(malha, faces) {
  const minimo = [Infinity, Infinity, Infinity];
  const maximo = [-Infinity, -Infinity, -Infinity];
  let achou = false;
  (faces || []).forEach((face) => {
      const anel = malha.faces[face];
      if (!anel) return;
      for (let i = 0; i < anel.length; i++) {
        const base = anel[i] * 3;
        for (let eixo = 0; eixo < 3; eixo++) {
          const valor = malha.pos[base + eixo];
          if (valor < minimo[eixo]) minimo[eixo] = valor;
          if (valor > maximo[eixo]) maximo[eixo] = valor;
        }
        achou = true;
      }
  });
  if (!achou) return mod3dCaixaFechadaDoUv([0, 0, 0], [0, 0, 0]);
  return mod3dCaixaFechadaDoUv(minimo, maximo);
}

function mod3dCaixaDeTriangulosDoUv(pos) {
  const minimo = [Infinity, Infinity, Infinity];
  const maximo = [-Infinity, -Infinity, -Infinity];
  if (!pos || !pos.length) return mod3dCaixaFechadaDoUv([0, 0, 0], [0, 0, 0]);
  for (let i = 0; i + 2 < pos.length; i += 3) {
    for (let eixo = 0; eixo < 3; eixo++) {
      const valor = pos[i + eixo];
      if (valor < minimo[eixo]) minimo[eixo] = valor;
      if (valor > maximo[eixo]) maximo[eixo] = valor;
    }
  }
  return mod3dCaixaFechadaDoUv(minimo, maximo);
}

function mod3dBaseDoEixoDaNormal(normal) {
  const nx = Math.abs(normal[0]);
  const ny = Math.abs(normal[1]);
  const nz = Math.abs(normal[2]);
  if (nx >= ny && nx >= nz) {
    if (normal[0] >= 0) return { u: [0, 0, -1], v: [0, 1, 0] };
    return { u: [0, 0, 1], v: [0, 1, 0] };
  }
  if (ny >= nx && ny >= nz) {
    if (normal[1] >= 0) return { u: [1, 0, 0], v: [0, 0, -1] };
    return { u: [1, 0, 0], v: [0, 0, 1] };
  }
  if (normal[2] >= 0) return { u: [1, 0, 0], v: [0, 1, 0] };
  return { u: [-1, 0, 0], v: [0, 1, 0] };
}

function mod3dPontoNoUvPlano(ponto, base, caixa) {
  const u =
  0.5 + (mod3dPontoNoEixo(ponto, base.u) - mod3dPontoNoEixo(caixa.centro, base.u)) / caixa.escala;
  const v =
  0.5 + (mod3dPontoNoEixo(ponto, base.v) - mod3dPontoNoEixo(caixa.centro, base.v)) / caixa.escala;
  return [u, v];
}

function mod3dPontoNoUvCilindrico(ponto, caixa) {
  const dx = ponto[0] - caixa.centro[0];
  const dz = ponto[2] - caixa.centro[2];
  const altura = Math.max(caixa.maximo[1] - caixa.minimo[1], 0.000001);
  const u = Math.atan2(dz, dx) / (Math.PI * 2) + 0.5;
  const v = (ponto[1] - caixa.minimo[1]) / altura;
  return [u, v];
}

function mod3dPontoNoUvEsferico(ponto, caixa) {
  const dx = ponto[0] - caixa.centro[0];
  const dy = ponto[1] - caixa.centro[1];
  const dz = ponto[2] - caixa.centro[2];
  const raio = Math.hypot(dx, dy, dz) || 1;
  const u = Math.atan2(dz, dx) / (Math.PI * 2) + 0.5;
  const v = 1 - Math.acos(Math.min(1, Math.max(-1, dy / raio))) / Math.PI;
  return [u, v];
}

function mod3dUvDoPonto(ponto, modo, caixa, base) {
  if (modo === 'cilindrica') return mod3dPontoNoUvCilindrico(ponto, caixa);
  if (modo === 'esferica') return mod3dPontoNoUvEsferico(ponto, caixa);
  return mod3dPontoNoUvPlano(ponto, base, caixa);
}

function mod3dFecharCosturaDoUv(lista, modo) {
  if (modo !== 'cilindrica' && modo !== 'esferica') return lista;
  let menor = Infinity;
  let maior = -Infinity;
  for (let i = 0; i < lista.length; i += 2) {
    if (lista[i] < menor) menor = lista[i];
    if (lista[i] > maior) maior = lista[i];
  }
  if (maior - menor <= MOD3D_COSTURA_DO_UV) return lista;
  for (let i = 0; i < lista.length; i += 2) {
    if (lista[i] < MOD3D_COSTURA_DO_UV) lista[i] += 1;
  }
  return lista;
}

function mod3dNormalMediaDasFaces(malha, faces, normais) {
  const media = [0, 0, 0];
  (faces || []).forEach((face) => {
      const normal = mod3dNormalDaFaceGuardada(normais, face);
      media[0] += normal[0];
      media[1] += normal[1];
      media[2] += normal[2];
  });
  const tamanho = Math.hypot(media[0], media[1], media[2]);
  if (tamanho < 0.000001) return [0, 0, 1];
  return [media[0] / tamanho, media[1] / tamanho, media[2] / tamanho];
}

function mod3dProjetarUvNaMalha(malha, faces, modo) {
  if (!malha) return 0;
  const alvo = mod3dFacesDoUv(malha, faces);
  if (!alvo.length) return 0;
  const escolha = mod3dProjecaoDeUvSegura(modo);
  const caixa = mod3dCaixaDeFacesDoUv(malha, alvo);
  const normais = mod3dNormaisDaMalha(malha);
  const basePlana = mod3dBaseDoEixoDaNormal(mod3dNormalMediaDasFaces(malha, alvo, normais));
  mod3dMalhaEdUvGarantido(malha);
  let conta = 0;
  alvo.forEach((face) => {
      const anel = malha.faces[face];
      if (!anel) return;
      const base =
      escolha === 'cubica'
      ? mod3dBaseDoEixoDaNormal(mod3dNormalDaFaceGuardada(normais, face))
      : basePlana;
      const lista = [];
      for (let i = 0; i < anel.length; i++) {
        const par = mod3dUvDoPonto(mod3dMalhaEdPonto(malha, anel[i]), escolha, caixa, base);
        lista.push(par[0], par[1]);
      }
      mod3dFecharCosturaDoUv(lista, escolha);
      mod3dDefinirUvDaFace(malha, face, lista);
      conta += 1;
  });
  if (conta) mod3dMalhaEdTocar(malha);
  return conta;
}

function mod3dLimparUvDaMalha(malha, faces) {
  if (!malha) return 0;
  const alvo = mod3dFacesDoUv(malha, faces);
  if (!alvo.length) return 0;
  mod3dMalhaEdUvGarantido(malha);
  let conta = 0;
  alvo.forEach((face) => {
      if (!malha.uv[face]) return;
      malha.uv[face] = null;
      conta += 1;
  });
  if (conta) mod3dMalhaEdTocar(malha);
  return conta;
}

function mod3dIlhasPorAngulo(malha, faces, angulo) {
  const ilhas = [];
  if (!malha) return ilhas;
  const alvo = mod3dFacesDoUv(malha, faces);
  if (!alvo.length) return ilhas;
  const dentro = new Set(alvo);
  const vistos = new Set();
  const normais = mod3dNormaisDaMalha(malha);
  const limite = Math.cos(mod3dAnguloDaIlhaSeguro(angulo) * MOD3D_GRAU_EM_RADIANO);
  alvo.forEach((inicio) => {
      if (vistos.has(inicio)) return;
      const ilha = [];
      const fila = [inicio];
      vistos.add(inicio);
      while (fila.length) {
        const face = fila.pop();
        ilha.push(face);
        const anel = malha.faces[face];
        if (!anel) continue;
        const normal = mod3dNormalDaFaceGuardada(normais, face);
        for (let i = 0; i < anel.length; i++) {
          const chave = mod3dChaveDaAresta(anel[i], anel[(i + 1) % anel.length]);
          const vizinhas = mod3dMalhaEdFacesDaAresta(malha, chave);
          for (let j = 0; j < vizinhas.length; j++) {
            const outra = vizinhas[j];
            if (outra === face || vistos.has(outra) || !dentro.has(outra)) continue;
            const vizinha = mod3dNormalDaFaceGuardada(normais, outra);
            if (mod3dPontoNoEixo(normal, vizinha) < limite) continue;
            vistos.add(outra);
            fila.push(outra);
          }
        }
      }
      ilha.sort((a, b) => a - b);
      ilhas.push(ilha);
  });
  return ilhas;
}

function mod3dCaixaDeListasDeUv(mapa) {
  const minimo = [Infinity, Infinity];
  const maximo = [-Infinity, -Infinity];
  let achou = false;
  mapa.forEach((lista) => {
      for (let i = 0; i < lista.length; i += 2) {
        if (lista[i] < minimo[0]) minimo[0] = lista[i];
        if (lista[i] > maximo[0]) maximo[0] = lista[i];
        if (lista[i + 1] < minimo[1]) minimo[1] = lista[i + 1];
        if (lista[i + 1] > maximo[1]) maximo[1] = lista[i + 1];
        achou = true;
      }
  });
  if (!achou) return { minimo: [0, 0], maximo: [0, 0] };
  return { minimo, maximo };
}

function mod3dDesdobrarUvNaMalha(malha, faces, angulo) {
  const vazio = { ilhas: 0, faces: 0 };
  if (!malha) return vazio;
  const alvo = mod3dFacesDoUv(malha, faces);
  if (!alvo.length) return vazio;
  const ilhas = mod3dIlhasPorAngulo(malha, alvo, angulo);
  if (!ilhas.length) return vazio;
  const normais = mod3dNormaisDaMalha(malha);
  mod3dMalhaEdUvGarantido(malha);
  const pedacos = ilhas.map((ilha) => {
      const base = mod3dBaseDoEixoDaNormal(mod3dNormalMediaDasFaces(malha, ilha, normais));
      const caixa = mod3dCaixaDeFacesDoUv(malha, ilha);
      const mapa = new Map();
      ilha.forEach((face) => {
          const anel = malha.faces[face];
          if (!anel) return;
          const lista = [];
          for (let i = 0; i < anel.length; i++) {
            const par = mod3dPontoNoUvPlano(mod3dMalhaEdPonto(malha, anel[i]), base, caixa);
            lista.push(par[0], par[1]);
          }
          mapa.set(face, lista);
      });
      return mapa;
  });
  const colunas = Math.max(1, Math.ceil(Math.sqrt(pedacos.length)));
  const linhas = Math.max(1, Math.ceil(pedacos.length / colunas));
  const largura = 1 / colunas;
  const altura = 1 / linhas;
  let contaDeFaces = 0;
  pedacos.forEach((mapa, ordem) => {
      const caixa = mod3dCaixaDeListasDeUv(mapa);
      const vaoU = Math.max(caixa.maximo[0] - caixa.minimo[0], 0.000001);
      const vaoV = Math.max(caixa.maximo[1] - caixa.minimo[1], 0.000001);
      const espacoU = largura * (1 - MOD3D_MARGEM_DAS_ILHAS * 2);
      const espacoV = altura * (1 - MOD3D_MARGEM_DAS_ILHAS * 2);
      const escala = Math.min(espacoU / vaoU, espacoV / vaoV);
      const coluna = ordem % colunas;
      const linha = Math.floor(ordem / colunas);
      const baseU = coluna * largura + largura * MOD3D_MARGEM_DAS_ILHAS;
      const baseV = 1 - (linha + 1) * altura + altura * MOD3D_MARGEM_DAS_ILHAS;
      mapa.forEach((lista, face) => {
          const saida = [];
          for (let i = 0; i < lista.length; i += 2) {
            saida.push(
              baseU + (lista[i] - caixa.minimo[0]) * escala,
              baseV + (lista[i + 1] - caixa.minimo[1]) * escala,
            );
          }
          mod3dDefinirUvDaFace(malha, face, saida);
          contaDeFaces += 1;
      });
  });
  mod3dMalhaEdTocar(malha);
  return { ilhas: pedacos.length, faces: contaDeFaces };
}

function mod3dUvDoVerticeNaFace(malha, face, vertice) {
  const anel = malha && malha.faces ? malha.faces[face] : null;
  const lista = mod3dUvDaFace(malha, face);
  if (!anel || !lista) return null;
  for (let i = 0; i < anel.length; i++) {
    if (anel[i] === vertice) return [lista[i * 2], lista[i * 2 + 1]];
  }
  return null;
}

function mod3dUvColadoNaAresta(malha, face, outra, a, b) {
  const pontas = [a, b];
  for (let i = 0; i < pontas.length; i++) {
    const um = mod3dUvDoVerticeNaFace(malha, face, pontas[i]);
    const dois = mod3dUvDoVerticeNaFace(malha, outra, pontas[i]);
    if (!um || !dois) return false;
    if (Math.abs(um[0] - dois[0]) > MOD3D_TOLERANCIA_DO_UV) return false;
    if (Math.abs(um[1] - dois[1]) > MOD3D_TOLERANCIA_DO_UV) return false;
  }
  return true;
}

function mod3dIlhaDeUvDaFace(malha, face) {
  const saida = [];
  if (!malha || !malha.faces[face]) return saida;
  const vistos = new Set([face]);
  const fila = [face];
  while (fila.length) {
    const atual = fila.pop();
    saida.push(atual);
    const anel = malha.faces[atual];
    if (!anel) continue;
    for (let i = 0; i < anel.length; i++) {
      const a = anel[i];
      const b = anel[(i + 1) % anel.length];
      const vizinhas = mod3dMalhaEdFacesDaAresta(malha, mod3dChaveDaAresta(a, b));
      for (let j = 0; j < vizinhas.length; j++) {
        const outra = vizinhas[j];
        if (outra === atual || vistos.has(outra)) continue;
        if (!mod3dUvColadoNaAresta(malha, atual, outra, a, b)) continue;
        vistos.add(outra);
        fila.push(outra);
      }
    }
  }
  saida.sort((a, b) => a - b);
  return saida;
}

function mod3dCaixaDoUvDasFaces(malha, faces) {
  const mapa = new Map();
  mod3dFacesDoUv(malha, faces).forEach((face) => {
      const lista = mod3dUvDaFace(malha, face);
      if (lista) mapa.set(face, lista);
  });
  if (!mapa.size) return null;
  const caixa = mod3dCaixaDeListasDeUv(mapa);
  return {
    minimo: caixa.minimo,
    maximo: caixa.maximo,
    centro: [(caixa.minimo[0] + caixa.maximo[0]) / 2, (caixa.minimo[1] + caixa.maximo[1]) / 2],
    faces: Array.from(mapa.keys()),
  };
}

function mod3dTrocarUvDasFaces(malha, faces, fn) {
  if (!malha || typeof fn !== 'function') return 0;
  const alvo = mod3dFacesDoUv(malha, faces);
  let conta = 0;
  alvo.forEach((face) => {
      const lista = mod3dUvDaFace(malha, face);
      if (!lista) return;
      const saida = [];
      for (let i = 0; i < lista.length; i += 2) {
        const par = fn(lista[i], lista[i + 1]);
        saida.push(par[0], par[1]);
      }
      mod3dDefinirUvDaFace(malha, face, saida);
      conta += 1;
  });
  if (conta) mod3dMalhaEdTocar(malha);
  return conta;
}

function mod3dMoverUvDasFaces(malha, faces, du, dv) {
  const passoU = Number(du) || 0;
  const passoV = Number(dv) || 0;
  if (!passoU && !passoV) return 0;
  return mod3dTrocarUvDasFaces(malha, faces, (u, v) => [u + passoU, v + passoV]);
}

function mod3dGirarUvDasFaces(malha, faces, graus) {
  const angulo = Number(graus) || 0;
  if (!angulo) return 0;
  const caixa = mod3dCaixaDoUvDasFaces(malha, faces);
  if (!caixa) return 0;
  const radianos = angulo * MOD3D_GRAU_EM_RADIANO;
  const cosseno = Math.cos(radianos);
  const seno = Math.sin(radianos);
  return mod3dTrocarUvDasFaces(malha, caixa.faces, (u, v) => {
      const du = u - caixa.centro[0];
      const dv = v - caixa.centro[1];
      return [
        caixa.centro[0] + du * cosseno - dv * seno,
        caixa.centro[1] + du * seno + dv * cosseno,
      ];
  });
}

function mod3dEscalarUvDasFaces(malha, faces, fu, fv) {
  const escalaU = Number(fu);
  const escalaV = Number(fv);
  const pesoU = isFinite(escalaU) && escalaU !== 0 ? escalaU : 1;
  const pesoV = isFinite(escalaV) && escalaV !== 0 ? escalaV : 1;
  if (pesoU === 1 && pesoV === 1) return 0;
  const caixa = mod3dCaixaDoUvDasFaces(malha, faces);
  if (!caixa) return 0;
  return mod3dTrocarUvDasFaces(malha, caixa.faces, (u, v) => [
      caixa.centro[0] + (u - caixa.centro[0]) * pesoU,
      caixa.centro[1] + (v - caixa.centro[1]) * pesoV,
  ]);
}

function mod3dAlinharUvDasFaces(malha, faces, onde) {
  const escolha = mod3dAlinhamentoDeUvSeguro(onde);
  const caixa = mod3dCaixaDoUvDasFaces(malha, faces);
  if (!caixa) return 0;
  if (escolha === 'encaixar') {
    const vaoU = Math.max(caixa.maximo[0] - caixa.minimo[0], 0.000001);
    const vaoV = Math.max(caixa.maximo[1] - caixa.minimo[1], 0.000001);
    const escala = Math.min(1 / vaoU, 1 / vaoV);
    const largura = vaoU * escala;
    const altura = vaoV * escala;
    return mod3dTrocarUvDasFaces(malha, caixa.faces, (u, v) => [
        (1 - largura) / 2 + (u - caixa.minimo[0]) * escala,
        (1 - altura) / 2 + (v - caixa.minimo[1]) * escala,
    ]);
  }
  let du = 0;
  let dv = 0;
  if (escolha === 'esquerda') du = -caixa.minimo[0];
  if (escolha === 'direita') du = 1 - caixa.maximo[0];
  if (escolha === 'base') dv = -caixa.minimo[1];
  if (escolha === 'topo') dv = 1 - caixa.maximo[1];
  if (escolha === 'centro') {
    du = 0.5 - caixa.centro[0];
    dv = 0.5 - caixa.centro[1];
  }
  return mod3dMoverUvDasFaces(malha, caixa.faces, du, dv);
}

function mod3dUvEstatisticas(malha) {
  const saida = { faces: 0, comUv: 0, semUv: 0, ilhas: 0, fora: 0 };
  if (!malha) return saida;
  const vivas = mod3dMalhaEdFacesVivas(malha);
  saida.faces = vivas.length;
  const restantes = new Set();
  vivas.forEach((face) => {
      const lista = mod3dUvDaFace(malha, face);
      if (!lista) {
        saida.semUv += 1;
        return;
      }
      saida.comUv += 1;
      restantes.add(face);
      for (let i = 0; i < lista.length; i++) {
        if (lista[i] < -MOD3D_TOLERANCIA_DO_UV || lista[i] > 1 + MOD3D_TOLERANCIA_DO_UV) {
          saida.fora += 1;
          break;
        }
      }
  });
  while (restantes.size) {
    const primeira = restantes.values().next().value;
    const ilha = mod3dIlhaDeUvDaFace(malha, primeira);
    ilha.forEach((face) => restantes.delete(face));
    restantes.delete(primeira);
    saida.ilhas += 1;
  }
  return saida;
}

function mod3dUvDosTriangulos(pos, nrm, modo, caixa) {
  const total = pos && pos.length ? Math.floor(pos.length / 3) : 0;
  const saida = new Float32Array(total * 2);
  if (!total) return saida;
  const escolha = mod3dProjecaoDeUvSegura(modo);
  const limites = caixa || mod3dCaixaDeTriangulosDoUv(pos);
  const plana = mod3dBaseDoEixoDaNormal([0, 0, 1]);
  for (let triangulo = 0; triangulo + 8 < pos.length; triangulo += 9) {
    let base = plana;
    if (escolha === 'cubica' || escolha === 'plana') {
      const normal = [0, 0, 0];
      if (nrm && nrm.length >= triangulo + 9) {
        for (let canto = 0; canto < 3; canto++) {
          normal[0] += nrm[triangulo + canto * 3];
          normal[1] += nrm[triangulo + canto * 3 + 1];
          normal[2] += nrm[triangulo + canto * 3 + 2];
        }
      }
      const tamanho = Math.hypot(normal[0], normal[1], normal[2]);
      if (tamanho > 0.000001) {
        base = mod3dBaseDoEixoDaNormal([
            normal[0] / tamanho,
            normal[1] / tamanho,
            normal[2] / tamanho,
        ]);
      }
    }
    const lista = [];
    for (let canto = 0; canto < 3; canto++) {
      const i = triangulo + canto * 3;
      const par = mod3dUvDoPonto([pos[i], pos[i + 1], pos[i + 2]], escolha, limites, base);
      lista.push(par[0], par[1]);
    }
    mod3dFecharCosturaDoUv(lista, escolha);
    for (let canto = 0; canto < 3; canto++) {
      const destino = (triangulo / 3 + canto) * 2;
      saida[destino] = mod3dNumeroDoUv(lista[canto * 2]);
      saida[destino + 1] = mod3dNumeroDoUv(lista[canto * 2 + 1]);
    }
  }
  return saida;
}
