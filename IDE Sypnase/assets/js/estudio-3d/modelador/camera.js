'use strict';

const MOD3D_FOV = 50;
const MOD3D_DIST_MINIMA = 0.02;
const MOD3D_DIST_MAXIMA = 5000;
const MOD3D_PHI_LIMITE = Math.PI / 2;
const MOD3D_GIRO_POR_PIXEL = 0.0062;
const MOD3D_GIRO_DO_TECLADO = 0.08;
const MOD3D_ZOOM_DO_TECLADO = 1.12;
const MOD3D_ZOOM_POR_ROLAGEM = 0.0016;
const MOD3D_ALVO_MAXIMO = 100000;
const MOD3D_FOLGA_DO_ENQUADRE = 1.3;
const MOD3D_VISTAS_RAPIDAS = Object.freeze({
    livre: Object.freeze({ theta: Math.PI / 4, phi: 0.44, orto: false }),
    frente: Object.freeze({ theta: 0, phi: 0, orto: true }),
    lado: Object.freeze({ theta: Math.PI / 2, phi: 0, orto: true }),
    topo: Object.freeze({ theta: 0, phi: MOD3D_PHI_LIMITE, orto: true }),
});

function mod3dMatrizNova() {
  return new Float32Array(16);
}

function mod3dEntre(valor, minimo, maximo) {
  if (!isFinite(valor)) return minimo;
  return Math.min(maximo, Math.max(minimo, valor));
}

function mod3dMatrizPerspectiva(fov, proporcao, perto, longe) {
  const m = mod3dMatrizNova();
  const foco = 1 / Math.tan((fov * Math.PI) / 360);
  m[0] = foco / Math.max(proporcao, 0.0001);
  m[5] = foco;
  m[10] = (longe + perto) / (perto - longe);
  m[11] = -1;
  m[14] = (2 * longe * perto) / (perto - longe);
  return m;
}

function mod3dMatrizOrtografica(largura, altura, perto, longe) {
  const m = mod3dMatrizNova();
  m[0] = 2 / Math.max(largura, 0.0001);
  m[5] = 2 / Math.max(altura, 0.0001);
  m[10] = -2 / (longe - perto);
  m[14] = -(longe + perto) / (longe - perto);
  m[15] = 1;
  return m;
}

function mod3dBaseOrbital(theta, phi) {
  const cf = Math.cos(phi);
  const sf = Math.sin(phi);
  const ct = Math.cos(theta);
  const st = Math.sin(theta);
  return {
    frente: [-cf * st, -sf, -cf * ct],
    direita: [ct, 0, -st],
    cima: [-st * sf, cf, -ct * sf],
  };
}

function mod3dOlhoOrbital(alvo, theta, phi, dist) {
  const cf = Math.cos(phi);
  return [
    alvo[0] + dist * cf * Math.sin(theta),
    alvo[1] + dist * Math.sin(phi),
    alvo[2] + dist * cf * Math.cos(theta),
  ];
}

function mod3dMatrizVistaOrbital(alvo, theta, phi, dist) {
  const base = mod3dBaseOrbital(theta, phi);
  const olho = mod3dOlhoOrbital(alvo, theta, phi, dist);
  const x = base.direita;
  const y = base.cima;
  const z = [-base.frente[0], -base.frente[1], -base.frente[2]];
  const m = mod3dMatrizNova();
  m[0] = x[0];
  m[1] = y[0];
  m[2] = z[0];
  m[4] = x[1];
  m[5] = y[1];
  m[6] = z[1];
  m[8] = x[2];
  m[9] = y[2];
  m[10] = z[2];
  m[12] = -(x[0] * olho[0] + x[1] * olho[1] + x[2] * olho[2]);
  m[13] = -(y[0] * olho[0] + y[1] * olho[1] + y[2] * olho[2]);
  m[14] = -(z[0] * olho[0] + z[1] * olho[1] + z[2] * olho[2]);
  m[15] = 1;
  return m;
}

function mod3dCriarCamera(inicio) {
  const partida = inicio || {};
  const estado = {
    theta: MOD3D_VISTAS_RAPIDAS.livre.theta,
    phi: MOD3D_VISTAS_RAPIDAS.livre.phi,
    dist: partida.dist > 0 ? partida.dist : 3.2,
    alvo: Array.isArray(partida.alvo) ? partida.alvo.slice(0, 3) : [0, 0.5, 0],
    orto: false,
    vista: 'livre',
  };

  function alturaVisivel() {
    return 2 * estado.dist * Math.tan((MOD3D_FOV * Math.PI) / 360);
  }

  function metrosPorPixel(alturaEmPixels) {
    return alturaVisivel() / Math.max(1, alturaEmPixels);
  }

  function definirDistancia(valor) {
    estado.dist = mod3dEntre(valor, MOD3D_DIST_MINIMA, MOD3D_DIST_MAXIMA);
  }

  function definirAlvo(ponto) {
    if (!Array.isArray(ponto)) return;
    for (let i = 0; i < 3; i++) {
      estado.alvo[i] = mod3dEntre(Number(ponto[i]) || 0, -MOD3D_ALVO_MAXIMO, MOD3D_ALVO_MAXIMO);
    }
  }

  function orbitar(dx, dy) {
    estado.theta -= Number(dx) || 0;
    estado.phi = mod3dEntre((Number(dy) || 0) + estado.phi, -MOD3D_PHI_LIMITE, MOD3D_PHI_LIMITE);
    estado.vista = 'livre';
  }

  function orbitarPorPixel(dx, dy) {
    orbitar((Number(dx) || 0) * MOD3D_GIRO_POR_PIXEL, (Number(dy) || 0) * MOD3D_GIRO_POR_PIXEL);
  }

  function deslocarPorPixel(dx, dy, alturaEmPixels) {
    const base = mod3dBaseOrbital(estado.theta, estado.phi);
    const passo = metrosPorPixel(alturaEmPixels);
    const mover = [
      -base.direita[0] * dx * passo + base.cima[0] * dy * passo,
      -base.direita[1] * dx * passo + base.cima[1] * dy * passo,
      -base.direita[2] * dx * passo + base.cima[2] * dy * passo,
    ];
    definirAlvo([estado.alvo[0] + mover[0], estado.alvo[1] + mover[1], estado.alvo[2] + mover[2]]);
  }

  function aproximar(fator) {
    const quanto = Number(fator);
    if (!isFinite(quanto) || quanto <= 0) return;
    definirDistancia(estado.dist / quanto);
  }

  function rolar(delta) {
    const quanto = Number(delta) || 0;
    definirDistancia(estado.dist * Math.exp(quanto * MOD3D_ZOOM_POR_ROLAGEM));
  }

  function definirVista(nome) {
    const alvoDaVista = MOD3D_VISTAS_RAPIDAS[nome];
    if (!alvoDaVista) return false;
    estado.theta = alvoDaVista.theta;
    estado.phi = alvoDaVista.phi;
    estado.orto = alvoDaVista.orto;
    estado.vista = nome;
    return true;
  }

  function alternarProjecao() {
    estado.orto = !estado.orto;
    return estado.orto;
  }

  function enquadrar(minimo, maximo) {
    if (!Array.isArray(minimo) || !Array.isArray(maximo)) return false;
    const dims = [
      Math.abs(maximo[0] - minimo[0]),
      Math.abs(maximo[1] - minimo[1]),
      Math.abs(maximo[2] - minimo[2]),
    ];
    const raio = Math.max(1e-4, Math.hypot(dims[0], dims[1], dims[2]) / 2);
    definirAlvo([
        (minimo[0] + maximo[0]) / 2,
        (minimo[1] + maximo[1]) / 2,
        (minimo[2] + maximo[2]) / 2,
    ]);
    definirDistancia((raio * MOD3D_FOLGA_DO_ENQUADRE) / Math.tan((MOD3D_FOV * Math.PI) / 360));
    return true;
  }

  function matrizes(largura, altura) {
    const proporcao = Math.max(0.05, largura / Math.max(1, altura));
    const visivel = alturaVisivel();
    const longe = Math.max(60, estado.dist * 24);
    const perto = Math.max(0.01, estado.dist * 0.02);
    const proj = estado.orto
    ? mod3dMatrizOrtografica(visivel * proporcao, visivel, -longe, longe)
    : mod3dMatrizPerspectiva(MOD3D_FOV, proporcao, perto, longe);
    return {
      proj,
      view: mod3dMatrizVistaOrbital(estado.alvo, estado.theta, estado.phi, estado.dist),
      olho: mod3dOlhoOrbital(estado.alvo, estado.theta, estado.phi, estado.dist),
      alturaVisivel: visivel,
      metrosPorPixel: metrosPorPixel(altura),
      perto,
      longe,
    };
  }

  function definirEixoDaVista(eixo, sinal) {
    const indice = Number(eixo);
    const direcao = Number(sinal) >= 0 ? 1 : -1;
    if (indice === 0) {
      estado.theta = (direcao * Math.PI) / 2;
      estado.phi = 0;
      estado.vista = direcao > 0 ? 'lado' : 'livre';
    } else if (indice === 1) {
      estado.phi = direcao * MOD3D_PHI_LIMITE;
      estado.vista = direcao > 0 ? 'topo' : 'livre';
    } else if (indice === 2) {
      estado.theta = direcao > 0 ? 0 : Math.PI;
      estado.phi = 0;
      estado.vista = direcao > 0 ? 'frente' : 'livre';
    } else {
      return false;
    }
    estado.orto = true;
    return true;
  }

  return {
    estado: () => ({
        theta: estado.theta,
        phi: estado.phi,
        dist: estado.dist,
        alvo: estado.alvo.slice(),
        orto: estado.orto,
        vista: estado.vista,
    }),
    alturaVisivel,
    metrosPorPixel,
    orbitar,
    orbitarPorPixel,
    deslocarPorPixel,
    aproximar,
    rolar,
    giroDoTeclado: () => MOD3D_GIRO_DO_TECLADO,
    zoomDoTeclado: () => MOD3D_ZOOM_DO_TECLADO,
    definirVista,
    alternarProjecao,
    definirAlvo,
    definirDistancia,
    enquadrar,
    matrizes,
    definirEixoDaVista,
  };
}
