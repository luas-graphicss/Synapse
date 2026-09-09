'use strict';

const MOD3D_ANGULO_SUAVE_PADRAO = 32;
const MOD3D_ANGULO_SUAVE_MINIMO = 1;
const MOD3D_ANGULO_SUAVE_MAXIMO = 180;
const MOD3D_SOMBREAMENTOS = Object.freeze([
    Object.freeze({ chave: 'plano', rotulo: 'Plana' }),
    Object.freeze({ chave: 'suave', rotulo: 'Suave' }),
    Object.freeze({ chave: 'angulo', rotulo: 'Por ângulo' }),
]);

function mod3dAnguloSuaveSeguro(valor) {
  const numero = Number(valor);
  if (!isFinite(numero)) return MOD3D_ANGULO_SUAVE_PADRAO;
  return Math.min(MOD3D_ANGULO_SUAVE_MAXIMO, Math.max(MOD3D_ANGULO_SUAVE_MINIMO, numero));
}

function mod3dSombreamentoSeguro(chave) {
  for (let i = 0; i < MOD3D_SOMBREAMENTOS.length; i++) {
    if (MOD3D_SOMBREAMENTOS[i].chave === chave) return chave;
  }
  return 'plano';
}

function mod3dAnguloDoSombreamento(malha) {
  if (!malha) return MOD3D_ANGULO_SUAVE_PADRAO;
  if (malha.sombreamento === 'suave') return MOD3D_ANGULO_SUAVE_MAXIMO;
  return mod3dAnguloSuaveSeguro(malha.angulo);
}

function mod3dNormaisDaMalha(malha) {
  if (!malha) return null;
  if (malha.normais && malha.normais.versao === malha.versao) return malha.normais;
  const totalDeFaces = malha.faces.length;
  const faces = new Float64Array(totalDeFaces * 3);
  const inicio = new Int32Array(totalDeFaces + 1);
  let cantos = 0;
  for (let face = 0; face < totalDeFaces; face++) {
    inicio[face] = cantos;
    const anel = malha.faces[face];
    if (!anel) continue;
    const normal = mod3dMalhaEdNormalDaFace(malha, face);
    faces[face * 3] = normal[0];
    faces[face * 3 + 1] = normal[1];
    faces[face * 3 + 2] = normal[2];
    cantos += anel.length;
  }
  inicio[totalDeFaces] = cantos;
  const suaves = new Float32Array(cantos * 3);
  const plano = malha.sombreamento === 'plano';
  if (!plano && cantos) {
    const limite = Math.cos(mod3dAnguloDoSombreamento(malha) * MOD3D_GRAU_EM_RADIANO);
    const adj = mod3dMalhaEdAdjacencia(malha);
    for (let face = 0; face < totalDeFaces; face++) {
      const anel = malha.faces[face];
      if (!anel || malha.suave[face] !== true) continue;
      const nx = faces[face * 3];
      const ny = faces[face * 3 + 1];
      const nz = faces[face * 3 + 2];
      for (let canto = 0; canto < anel.length; canto++) {
        const vizinhas = adj.porVertice[anel[canto]] ? adj.porVertice[anel[canto]].faces : [];
        let sx = 0;
        let sy = 0;
        let sz = 0;
        for (let i = 0; i < vizinhas.length; i++) {
          const outra = vizinhas[i];
          if (malha.suave[outra] !== true) continue;
          const ox = faces[outra * 3];
          const oy = faces[outra * 3 + 1];
          const oz = faces[outra * 3 + 2];
          if (outra !== face && nx * ox + ny * oy + nz * oz < limite) continue;
          sx += ox;
          sy += oy;
          sz += oz;
        }
        const tamanho = Math.hypot(sx, sy, sz);
        if (!(tamanho > 1e-9)) continue;
        const base = (inicio[face] + canto) * 3;
        suaves[base] = sx / tamanho;
        suaves[base + 1] = sy / tamanho;
        suaves[base + 2] = sz / tamanho;
      }
    }
  }
  malha.normais = { versao: malha.versao, faces, inicio, cantos: suaves };
  return malha.normais;
}

function mod3dNormalDaFaceGuardada(normais, face) {
  if (!normais) return [0, 1, 0];
  return [normais.faces[face * 3], normais.faces[face * 3 + 1], normais.faces[face * 3 + 2]];
}

function mod3dNormalDoCantoGuardada(normais, face, canto, padrao) {
  if (!normais || !normais.cantos.length) return padrao;
  const base = (normais.inicio[face] + canto) * 3;
  const x = normais.cantos[base];
  const y = normais.cantos[base + 1];
  const z = normais.cantos[base + 2];
  if (x === 0 && y === 0 && z === 0) return padrao;
  return [x, y, z];
}

function mod3dDefinirSombreamentoDaMalha(malha, modo, angulo) {
  if (!malha) return false;
  const chave = mod3dSombreamentoSeguro(modo);
  malha.sombreamento = chave;
  if (angulo !== undefined) malha.angulo = mod3dAnguloSuaveSeguro(angulo);
  const suave = chave !== 'plano';
  for (let face = 0; face < malha.faces.length; face++) {
    if (!malha.faces[face]) continue;
    malha.suave[face] = suave;
  }
  mod3dMalhaEdTocar(malha);
  return true;
}

function mod3dMarcarSuaveNasFaces(malha, faces, suave) {
  if (!malha || !faces) return 0;
  let mudou = 0;
  faces.forEach((face) => {
      if (!malha.faces[face]) return;
      if (malha.suave[face] === (suave === true)) return;
      malha.suave[face] = suave === true;
      mudou += 1;
  });
  if (mudou && suave === true && malha.sombreamento === 'plano') malha.sombreamento = 'angulo';
  if (mudou) mod3dMalhaEdTocar(malha);
  return mudou;
}

function mod3dInverterFacesDaMalha(malha, faces) {
  if (!malha) return 0;
  const lista = faces && faces.length ? faces : mod3dMalhaEdFacesVivas(malha);
  let mudou = 0;
  lista.forEach((face) => {
      const anel = malha.faces[face];
      if (!anel) return;
      malha.faces[face] = mod3dAnelInvertido(anel);
      mudou += 1;
  });
  if (mudou) mod3dMalhaEdTocar(malha);
  return mudou;
}

function mod3dVolumeDoGrupo(malha, grupo) {
  let volume = 0;
  grupo.forEach((face) => {
      const anel = malha.faces[face];
      if (!anel || anel.length < 3) return;
      const a = mod3dMalhaEdPonto(malha, anel[0]);
      for (let i = 1; i < anel.length - 1; i++) {
        const b = mod3dMalhaEdPonto(malha, anel[i]);
        const c = mod3dMalhaEdPonto(malha, anel[i + 1]);
        const x = b[1] * c[2] - b[2] * c[1];
        const y = b[2] * c[0] - b[0] * c[2];
        const z = b[0] * c[1] - b[1] * c[0];
        volume += (a[0] * x + a[1] * y + a[2] * z) / 6;
      }
  });
  return volume;
}

function mod3dFugaDoGrupo(malha, grupo) {
  let cx = 0;
  let cy = 0;
  let cz = 0;
  let peso = 0;
  const centros = [];
  grupo.forEach((face) => {
      const area = mod3dMalhaEdAreaDaFace(malha, face);
      const centro = mod3dMalhaEdCentroDaFace(malha, face);
      centros.push({ face, area, centro });
      cx += centro[0] * area;
      cy += centro[1] * area;
      cz += centro[2] * area;
      peso += area;
  });
  if (!(peso > 0)) return 0;
  cx /= peso;
  cy /= peso;
  cz /= peso;
  let fora = 0;
  centros.forEach((peca) => {
      const normal = mod3dMalhaEdNormalDaFace(malha, peca.face);
      const dx = peca.centro[0] - cx;
      const dy = peca.centro[1] - cy;
      const dz = peca.centro[2] - cz;
      fora += (normal[0] * dx + normal[1] * dy + normal[2] * dz) * peca.area;
  });
  return fora;
}

function mod3dOrientarMalhaParaFora(malha) {
  if (!malha) return 0;
  const adj = mod3dMalhaEdAdjacencia(malha);
  const visitado = new Uint8Array(malha.faces.length);
  let trocadas = 0;
  for (let raiz = 0; raiz < malha.faces.length; raiz++) {
    if (!malha.faces[raiz] || visitado[raiz]) continue;
    const grupo = [];
    const fila = [raiz];
    visitado[raiz] = 1;
    let fechado = true;
    while (fila.length) {
      const face = fila.pop();
      grupo.push(face);
      const anel = malha.faces[face];
      if (!anel) continue;
      for (let i = 0; i < anel.length; i++) {
        const a = anel[i];
        const b = anel[(i + 1) % anel.length];
        const aresta = adj.arestas.get(mod3dChaveDaAresta(a, b));
        if (!aresta) continue;
        if (aresta.faces.length !== 2) fechado = false;
        for (let j = 0; j < aresta.faces.length; j++) {
          const outra = aresta.faces[j];
          if (outra === face || visitado[outra] || !malha.faces[outra]) continue;
          visitado[outra] = 1;
          if (mod3dAnelTemAresta(malha.faces[outra], a, b) === 1) {
            malha.faces[outra] = mod3dAnelInvertido(malha.faces[outra]);
            trocadas += 1;
          }
          fila.push(outra);
        }
      }
    }
    const medida = fechado ? mod3dVolumeDoGrupo(malha, grupo) : mod3dFugaDoGrupo(malha, grupo);
    if (medida < 0) {
      grupo.forEach((face) => {
          if (!malha.faces[face]) return;
          malha.faces[face] = mod3dAnelInvertido(malha.faces[face]);
          trocadas += 1;
      });
    }
  }
  if (trocadas) mod3dMalhaEdTocar(malha);
  return trocadas;
}
