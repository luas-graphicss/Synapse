'use strict';

const MOD3D_MEDIDA_MINIMA = 0.001;
const MOD3D_MEDIDA_MAXIMA = 1000;
const MOD3D_SEGMENTOS_MINIMO = 3;
const MOD3D_SEGMENTOS_MAXIMO = 96;
const MOD3D_ANEIS_MINIMO = 2;
const MOD3D_ANEIS_MAXIMO = 96;

const MOD3D_PRIMITIVAS = Object.freeze({
    cubo: Object.freeze({
        rotulo: 'Cubo',
        campos: Object.freeze([
            Object.freeze({ chave: 'largura', rotulo: 'Largura', tipo: 'medida', padrao: 1 }),
            Object.freeze({ chave: 'altura', rotulo: 'Altura', tipo: 'medida', padrao: 1 }),
            Object.freeze({ chave: 'profundidade', rotulo: 'Profundidade', tipo: 'medida', padrao: 1 }),
        ]),
    }),
    esfera: Object.freeze({
        rotulo: 'Esfera',
        campos: Object.freeze([
            Object.freeze({ chave: 'raio', rotulo: 'Raio', tipo: 'medida', padrao: 0.5 }),
            Object.freeze({ chave: 'segmentos', rotulo: 'Segmentos', tipo: 'inteiro', padrao: 24 }),
            Object.freeze({ chave: 'aneis', rotulo: 'Anéis', tipo: 'aneis', padrao: 16 }),
        ]),
    }),
    cilindro: Object.freeze({
        rotulo: 'Cilindro',
        campos: Object.freeze([
            Object.freeze({ chave: 'raio', rotulo: 'Raio', tipo: 'medida', padrao: 0.5 }),
            Object.freeze({ chave: 'altura', rotulo: 'Altura', tipo: 'medida', padrao: 1 }),
            Object.freeze({ chave: 'segmentos', rotulo: 'Segmentos', tipo: 'inteiro', padrao: 24 }),
        ]),
    }),
    cone: Object.freeze({
        rotulo: 'Cone',
        campos: Object.freeze([
            Object.freeze({ chave: 'raio', rotulo: 'Raio', tipo: 'medida', padrao: 0.5 }),
            Object.freeze({ chave: 'altura', rotulo: 'Altura', tipo: 'medida', padrao: 1 }),
            Object.freeze({ chave: 'segmentos', rotulo: 'Segmentos', tipo: 'inteiro', padrao: 24 }),
        ]),
    }),
    plano: Object.freeze({
        rotulo: 'Plano',
        campos: Object.freeze([
            Object.freeze({ chave: 'largura', rotulo: 'Largura', tipo: 'medida', padrao: 2 }),
            Object.freeze({ chave: 'profundidade', rotulo: 'Profundidade', tipo: 'medida', padrao: 2 }),
        ]),
    }),
    toro: Object.freeze({
        rotulo: 'Toro',
        campos: Object.freeze([
            Object.freeze({ chave: 'raio', rotulo: 'Raio do aro', tipo: 'medida', padrao: 0.6 }),
            Object.freeze({ chave: 'tubo', rotulo: 'Raio do tubo', tipo: 'medida', padrao: 0.18 }),
            Object.freeze({ chave: 'segmentos', rotulo: 'Segmentos', tipo: 'inteiro', padrao: 32 }),
            Object.freeze({ chave: 'aneis', rotulo: 'Anéis', tipo: 'aneis', padrao: 16 }),
        ]),
    }),
    rampa: Object.freeze({
        rotulo: 'Rampa',
        campos: Object.freeze([
            Object.freeze({ chave: 'largura', rotulo: 'Largura', tipo: 'medida', padrao: 1 }),
            Object.freeze({ chave: 'altura', rotulo: 'Altura', tipo: 'medida', padrao: 1 }),
            Object.freeze({ chave: 'profundidade', rotulo: 'Profundidade', tipo: 'medida', padrao: 1 }),
        ]),
    }),
});

const MOD3D_ORDEM_DAS_PRIMITIVAS = Object.freeze([
    'cubo',
    'esfera',
    'cilindro',
    'cone',
    'plano',
    'toro',
    'rampa',
]);

function mod3dMedidaSegura(valor, padrao) {
  const numero = Number(valor);
  if (!isFinite(numero) || numero <= 0) return padrao;
  return Math.min(MOD3D_MEDIDA_MAXIMA, Math.max(MOD3D_MEDIDA_MINIMA, numero));
}

function mod3dInteiroSeguro(valor, padrao, minimo, maximo) {
  const numero = Math.round(Number(valor));
  if (!isFinite(numero)) return padrao;
  return Math.min(maximo, Math.max(minimo, numero));
}

function mod3dValorDoCampo(campo, valor) {
  if (campo.tipo === 'inteiro') {
    return mod3dInteiroSeguro(valor, campo.padrao, MOD3D_SEGMENTOS_MINIMO, MOD3D_SEGMENTOS_MAXIMO);
  }
  if (campo.tipo === 'aneis') {
    return mod3dInteiroSeguro(valor, campo.padrao, MOD3D_ANEIS_MINIMO, MOD3D_ANEIS_MAXIMO);
  }
  return mod3dMedidaSegura(valor, campo.padrao);
}

function mod3dCamposDaPrimitiva(tipo) {
  const molde = MOD3D_PRIMITIVAS[tipo];
  return molde ? molde.campos : [];
}

function mod3dParametrosSeguros(tipo, params) {
  const pedido = params || {};
  const saida = {};
  mod3dCamposDaPrimitiva(tipo).forEach((campo) => {
      const bruto = pedido[campo.chave] === undefined ? campo.padrao : pedido[campo.chave];
      saida[campo.chave] = mod3dValorDoCampo(campo, bruto);
  });
  return saida;
}

function mod3dNormalDaFace(a, b, c) {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  const x = uy * vz - uz * vy;
  const y = uz * vx - ux * vz;
  const z = ux * vy - uy * vx;
  const tamanho = Math.hypot(x, y, z) || 1;
  return [x / tamanho, y / tamanho, z / tamanho];
}

function mod3dMalhaCrua() {
  return { pos: [], nrm: [] };
}

function mod3dPorTriangulo(malha, a, b, c, normais) {
  const face = normais || null;
  const plana = face ? null : mod3dNormalDaFace(a, b, c);
  const cantos = [a, b, c];
  for (let i = 0; i < 3; i++) {
    malha.pos.push(cantos[i][0], cantos[i][1], cantos[i][2]);
    const normal = face ? face[i] || face[0] : plana;
    malha.nrm.push(normal[0], normal[1], normal[2]);
  }
}

function mod3dPorQuadrado(malha, a, b, c, d, normais) {
  if (normais) {
    mod3dPorTriangulo(malha, a, b, c, [normais[0], normais[1], normais[2]]);
    mod3dPorTriangulo(malha, a, c, d, [normais[0], normais[2], normais[3]]);
    return;
  }
  mod3dPorTriangulo(malha, a, b, c, null);
  mod3dPorTriangulo(malha, a, c, d, null);
}

function mod3dFecharMalha(malha) {
  const pos = new Float32Array(malha.pos);
  const nrm = new Float32Array(malha.nrm);
  const minimo = [Infinity, Infinity, Infinity];
  const maximo = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) {
    for (let eixo = 0; eixo < 3; eixo++) {
      const valor = pos[i + eixo];
      if (valor < minimo[eixo]) minimo[eixo] = valor;
      if (valor > maximo[eixo]) maximo[eixo] = valor;
    }
  }
  if (!pos.length) {
    minimo[0] = 0;
    minimo[1] = 0;
    minimo[2] = 0;
    maximo[0] = 0;
    maximo[1] = 0;
    maximo[2] = 0;
  }
  return { pos, nrm, minimo, maximo, triangulos: pos.length / 9 };
}

function mod3dMalhaCubo(params) {
  const largura = params.largura;
  const altura = params.altura;
  const profundidade = params.profundidade;
  const x = largura / 2;
  const z = profundidade / 2;
  const malha = mod3dMalhaCrua();
  const p = [
    [-x, 0, z],
    [x, 0, z],
    [x, altura, z],
    [-x, altura, z],
    [x, 0, -z],
    [-x, 0, -z],
    [-x, altura, -z],
    [x, altura, -z],
  ];
  mod3dPorQuadrado(malha, p[0], p[1], p[2], p[3], null);
  mod3dPorQuadrado(malha, p[4], p[5], p[6], p[7], null);
  mod3dPorQuadrado(malha, p[1], p[4], p[7], p[2], null);
  mod3dPorQuadrado(malha, p[5], p[0], p[3], p[6], null);
  mod3dPorQuadrado(malha, p[3], p[2], p[7], p[6], null);
  mod3dPorQuadrado(malha, p[5], p[4], p[1], p[0], null);
  return mod3dFecharMalha(malha);
}

function mod3dMalhaPlano(params) {
  const x = params.largura / 2;
  const z = params.profundidade / 2;
  const malha = mod3dMalhaCrua();
  const cima = [0, 1, 0];
  mod3dPorQuadrado(malha, [-x, 0, z], [x, 0, z], [x, 0, -z], [-x, 0, -z], [cima, cima, cima, cima]);
  return mod3dFecharMalha(malha);
}

function mod3dMalhaEsfera(params) {
  const raio = params.raio;
  const segmentos = params.segmentos;
  const aneis = params.aneis;
  const malha = mod3dMalhaCrua();
  const ponto = (anel, fatia) => {
    const phi = (anel / aneis) * Math.PI;
    const theta = (fatia / segmentos) * Math.PI * 2;
    const seno = Math.sin(phi);
    const normal = [seno * Math.cos(theta), Math.cos(phi), seno * Math.sin(theta)];
    return {
      pos: [normal[0] * raio, normal[1] * raio + raio, normal[2] * raio],
      nrm: normal,
    };
  };
  for (let anel = 0; anel < aneis; anel++) {
    for (let fatia = 0; fatia < segmentos; fatia++) {
      const a = ponto(anel, fatia);
      const b = ponto(anel + 1, fatia);
      const c = ponto(anel + 1, fatia + 1);
      const d = ponto(anel, fatia + 1);
      if (anel === 0) {
        mod3dPorTriangulo(malha, a.pos, b.pos, c.pos, [a.nrm, b.nrm, c.nrm]);
      } else if (anel === aneis - 1) {
        mod3dPorTriangulo(malha, a.pos, b.pos, d.pos, [a.nrm, b.nrm, d.nrm]);
      } else {
        mod3dPorQuadrado(malha, a.pos, b.pos, c.pos, d.pos, [a.nrm, b.nrm, c.nrm, d.nrm]);
      }
    }
  }
  return mod3dFecharMalha(malha);
}

function mod3dMalhaCilindro(params) {
  const raio = params.raio;
  const altura = params.altura;
  const segmentos = params.segmentos;
  const malha = mod3dMalhaCrua();
  const cima = [0, 1, 0];
  const baixo = [0, -1, 0];
  for (let fatia = 0; fatia < segmentos; fatia++) {
    const t0 = (fatia / segmentos) * Math.PI * 2;
    const t1 = ((fatia + 1) / segmentos) * Math.PI * 2;
    const n0 = [Math.cos(t0), 0, Math.sin(t0)];
    const n1 = [Math.cos(t1), 0, Math.sin(t1)];
    const a = [n0[0] * raio, 0, n0[2] * raio];
    const b = [n1[0] * raio, 0, n1[2] * raio];
    const c = [n1[0] * raio, altura, n1[2] * raio];
    const d = [n0[0] * raio, altura, n0[2] * raio];
    mod3dPorQuadrado(malha, a, b, c, d, [n0, n1, n1, n0]);
    mod3dPorTriangulo(malha, [0, altura, 0], d, c, [cima, cima, cima]);
    mod3dPorTriangulo(malha, [0, 0, 0], b, a, [baixo, baixo, baixo]);
  }
  return mod3dFecharMalha(malha);
}

function mod3dMalhaCone(params) {
  const raio = params.raio;
  const altura = params.altura;
  const segmentos = params.segmentos;
  const malha = mod3dMalhaCrua();
  const baixo = [0, -1, 0];
  const lado = Math.hypot(raio, altura) || 1;
  const subida = raio / lado;
  const deitado = altura / lado;
  for (let fatia = 0; fatia < segmentos; fatia++) {
    const t0 = (fatia / segmentos) * Math.PI * 2;
    const t1 = ((fatia + 1) / segmentos) * Math.PI * 2;
    const meio = (t0 + t1) / 2;
    const n0 = [Math.cos(t0) * deitado, subida, Math.sin(t0) * deitado];
    const n1 = [Math.cos(t1) * deitado, subida, Math.sin(t1) * deitado];
    const nm = [Math.cos(meio) * deitado, subida, Math.sin(meio) * deitado];
    const a = [Math.cos(t0) * raio, 0, Math.sin(t0) * raio];
    const b = [Math.cos(t1) * raio, 0, Math.sin(t1) * raio];
    mod3dPorTriangulo(malha, a, b, [0, altura, 0], [n0, n1, nm]);
    mod3dPorTriangulo(malha, [0, 0, 0], b, a, [baixo, baixo, baixo]);
  }
  return mod3dFecharMalha(malha);
}

function mod3dMalhaToro(params) {
  const raio = params.raio;
  const tubo = Math.min(params.tubo, raio);
  const segmentos = params.segmentos;
  const aneis = params.aneis;
  const malha = mod3dMalhaCrua();
  const ponto = (volta, anel) => {
    const u = (volta / segmentos) * Math.PI * 2;
    const v = (anel / aneis) * Math.PI * 2;
    const normal = [Math.cos(v) * Math.cos(u), Math.sin(v), Math.cos(v) * Math.sin(u)];
    const distancia = raio + tubo * Math.cos(v);
    return {
      pos: [distancia * Math.cos(u), tubo + tubo * Math.sin(v), distancia * Math.sin(u)],
      nrm: normal,
    };
  };
  for (let volta = 0; volta < segmentos; volta++) {
    for (let anel = 0; anel < aneis; anel++) {
      const a = ponto(volta, anel);
      const b = ponto(volta + 1, anel);
      const c = ponto(volta + 1, anel + 1);
      const d = ponto(volta, anel + 1);
      mod3dPorQuadrado(malha, a.pos, b.pos, c.pos, d.pos, [a.nrm, b.nrm, c.nrm, d.nrm]);
    }
  }
  return mod3dFecharMalha(malha);
}

function mod3dMalhaRampa(params) {
  const x = params.largura / 2;
  const z = params.profundidade / 2;
  const altura = params.altura;
  const malha = mod3dMalhaCrua();
  const a = [-x, 0, z];
  const b = [x, 0, z];
  const c = [x, 0, -z];
  const d = [-x, 0, -z];
  const e = [x, altura, -z];
  const f = [-x, altura, -z];
  mod3dPorQuadrado(malha, d, c, b, a, null);
  mod3dPorQuadrado(malha, a, b, e, f, null);
  mod3dPorQuadrado(malha, c, d, f, e, null);
  mod3dPorTriangulo(malha, b, c, e, null);
  mod3dPorTriangulo(malha, d, a, f, null);
  return mod3dFecharMalha(malha);
}

function mod3dPrimitivaMalha(tipo, params) {
  if (!MOD3D_PRIMITIVAS[tipo]) return null;
  const seguros = mod3dParametrosSeguros(tipo, params);
  if (tipo === 'cubo') return mod3dMalhaCubo(seguros);
  if (tipo === 'esfera') return mod3dMalhaEsfera(seguros);
  if (tipo === 'cilindro') return mod3dMalhaCilindro(seguros);
  if (tipo === 'cone') return mod3dMalhaCone(seguros);
  if (tipo === 'plano') return mod3dMalhaPlano(seguros);
  if (tipo === 'toro') return mod3dMalhaToro(seguros);
  if (tipo === 'rampa') return mod3dMalhaRampa(seguros);
  return null;
}
