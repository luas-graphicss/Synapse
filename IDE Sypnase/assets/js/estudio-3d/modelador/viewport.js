'use strict';

const MOD3D_LADO_DO_GIZMO = 76;
const MOD3D_JANELA_DO_FPS = 500;
const MOD3D_ESPERA_DO_CONTEXTO = 1200;
const MOD3D_CHAVE_DA_UNIDADE = 'synapse:modelador3d:unidade';
const MOD3D_UNIDADES_PADRAO = Object.freeze({
    m: Object.freeze({ f: 1, label: 'm' }),
    cm: Object.freeze({ f: 0.01, label: 'cm' }),
    mm: Object.freeze({ f: 0.001, label: 'mm' }),
    stud: Object.freeze({ f: 0.28, label: 'studs' }),
    ft: Object.freeze({ f: 0.3048, label: 'ft' }),
    in: Object.freeze({ f: 0.0254, label: 'pol' }),
});
const MOD3D_ORDEM_DAS_UNIDADES = Object.freeze(['m', 'cm', 'mm', 'stud', 'ft', 'in']);
const MOD3D_CORES_DA_CENA = Object.freeze({
    grade: [0.125, 0.145, 0.185],
    gradeForte: [0.2, 0.23, 0.3],
    eixoX: [0.85, 0.35, 0.4],
    eixoY: [0.36, 0.78, 0.52],
    eixoZ: [0.36, 0.56, 0.95],
    selecao: [1, 0.78, 0.36],
    referencia: [0.47, 0.75, 0.66],
});
const MOD3D_VISTAS_DO_MENU = Object.freeze([
    Object.freeze({ chave: 'livre', rotulo: 'Livre' }),
    Object.freeze({ chave: 'frente', rotulo: 'Frente' }),
    Object.freeze({ chave: 'lado', rotulo: 'Lado' }),
    Object.freeze({ chave: 'topo', rotulo: 'Topo' }),
]);
const MOD3D_TEXTO_SEM_WEBGL =
'WebGL indisponível neste navegador — o viewport do modelador precisa de WebGL.';
const MOD3D_TEXTO_CONTEXTO_PERDIDO = 'O navegador reiniciou o WebGL — refazendo a cena…';
const MOD3D_TEXTO_SEM_REFERENCIA = 'Nenhuma referência carregada';
const MOD3D_TEXTO_CARREGANDO = 'Carregando referência…';
const MOD3D_TEXTO_SEM_MODELOS = 'Nenhum modelo 3D no projeto';
const MOD3D_ERROS_DA_REFERENCIA = Object.freeze({
    'sem-editor': 'Editor fora de alcance — a referência não veio',
    'sem-projeto': 'Escolha um projeto para carregar a referência',
    'sem-resposta': 'O editor não respondeu a tempo',
    'projeto-sumiu': 'O projeto não está mais aberto no editor',
    'sem-estudio': 'Este editor não tem o Estúdio 3D carregado',
    'sem-arquivo': 'O arquivo não está mais no projeto',
    leitura: 'Não foi possível ler o modelo',
    resumo: 'A malha chegou corrompida',
    incompleto: 'A travessia da malha ficou incompleta',
    'grande-demais': 'A malha é grande demais para o viewport',
    falha: 'A referência falhou',
});

const mod3dCena = {
  caixa: null,
  canvas: null,
  renderizador: null,
  camera: null,
  canal: null,
  projeto: '',
  unidades: Object.assign({}, MOD3D_UNIDADES_PADRAO),
  unidade: 'm',
  studM: MOD3D_UNIDADES_PADRAO.stud.f,
  grade: { passo: 0, chave: '', ligada: true },
  pecas: new Map(),
  selecaoPintada: '',
  alcas: '',
  pincel: null,
  clique: null,
  referencia: null,
  modelos: [],
  hud: null,
  sujo: true,
  laco: 0,
  espera: 0,
  fps: { conta: 0, marca: 0, valor: 0, tempo: 0 },
  ponteiros: new Map(),
  gesto: null,
  dedos: null,
  observador: null,
  carregando: false,
};

function mod3dMarcarSujo() {
  mod3dCena.sujo = true;
}

function mod3dDiagnosticoDoViewport() {
  try {
    if (typeof modoDiagnosticoLigado === 'function') return modoDiagnosticoLigado() === true;
  } catch (erro) {
    ignorarErro(erro, 'mod3dViewport:diagnostico');
  }
  return false;
}

function mod3dUnidadeDaCena() {
  return mod3dCena.unidades[mod3dCena.unidade] || MOD3D_UNIDADES_PADRAO.m;
}

function mod3dValorNaUnidade(metros) {
  const unidade = mod3dUnidadeDaCena();
  const valor = (Number(metros) || 0) / (unidade.f || 1);
  const grandeza = Math.abs(valor);
  const casas = grandeza >= 100 ? 1 : grandeza >= 10 ? 2 : grandeza >= 1 ? 3 : 4;
  let texto = valor.toFixed(casas);
  if (texto.indexOf('.') >= 0) texto = texto.replace(/0+$/, '').replace(/\.$/, '');
  return texto.replace('.', ',');
}

function mod3dMedidaFormatada(metros) {
  return `${mod3dValorNaUnidade(metros)} ${mod3dUnidadeDaCena().label}`;
}

function mod3dTrioFormatado(trio) {
  if (!Array.isArray(trio)) return '—';
  const partes = [trio[0], trio[1], trio[2]].map((valor) => mod3dValorNaUnidade(valor));
  return `${partes.join(' × ')} ${mod3dUnidadeDaCena().label}`;
}

function mod3dPassoDaGrade(visibleHeight) {
  return window.SynapseModelerGrid.stepFor(visibleHeight);
}

function mod3dPintarLinha(pos, cores, alvo, a, b, cor) {
  pos[alvo] = a[0];
  pos[alvo + 1] = a[1];
  pos[alvo + 2] = a[2];
  pos[alvo + 3] = b[0];
  pos[alvo + 4] = b[1];
  pos[alvo + 5] = b[2];
  for (let i = 0; i < 6; i += 3) {
    cores[alvo + i] = cor[0];
    cores[alvo + i + 1] = cor[1];
    cores[alvo + i + 2] = cor[2];
  }
  return alvo + 6;
}

function mod3dEixoVertical(passo) {
  const pos = new Float32Array(6);
  const cores = new Float32Array(6);
  mod3dPintarLinha(pos, cores, 0, [0, 0, 0], [0, passo * 3, 0], MOD3D_CORES_DA_CENA.eixoY);
  return { pos, cores };
}

function mod3dMontarGizmoDeNavegacao(caixa) {
  if (!window.SynapseNavigationGizmo) return null;
  return window.SynapseNavigationGizmo.create(caixa, {
      size: MOD3D_LADO_DO_GIZMO,
      onAxis: (eixo, sinal) => {
        if (!mod3dCena.camera) return;
        mod3dCena.camera.definirEixoDaVista(eixo, sinal);
        mod3dPintarHud();
        mod3dMarcarSujo();
      },
      onOrbit: (deltaX, deltaY) => {
        if (!mod3dCena.camera) return;
        mod3dCena.camera.orbitarPorPixel(deltaX, deltaY);
        mod3dPintarHud();
        mod3dMarcarSujo();
      },
  });
}

function mod3dNomeDaPeca(id) {
  return `no:${id}`;
}

function mod3dGruposDoPalco(no, mundo) {
  const materiais = mod3dMateriaisDoNo(no);
  const vertices = mundo.pos.length / 3;
  const bruto =
  Array.isArray(mundo.grupos) && mundo.grupos.length
  ? mundo.grupos
  : [{ material: 0, inicio: 0, conta: vertices }];
  return bruto.map((grupo) => {
      const indice = Number(grupo.material) || 0;
      const material = mod3dMaterialSeguro(materiais[indice] || materiais[0], indice);
      return {
        inicio: Number(grupo.inicio) || 0,
        conta: Number(grupo.conta) || 0,
        cor: material.cor,
        opacidade: material.opacidade,
        emissao: material.emissao,
        metal: material.metal,
        rugosidade: material.rugosidade,
        textura: material.textura,
        textureMaps: material.textureMaps,
        repetir: material.repetir,
        deslocar: material.deslocar,
      };
  });
}

function mod3dUvDoPalco(mundo, grupos) {
  if (!mundo.uv || !mundo.uv.length) return null;
  const mexe = grupos.some(
    (grupo) =>
    grupo.repetir[0] !== 1 ||
    grupo.repetir[1] !== 1 ||
    grupo.deslocar[0] !== 0 ||
    grupo.deslocar[1] !== 0,
  );
  if (!mexe) return mundo.uv;
  const saida = new Float32Array(mundo.uv);
  grupos.forEach((grupo) => {
      const fim = grupo.inicio + grupo.conta;
      for (let vertice = grupo.inicio; vertice < fim; vertice++) {
        const base = vertice * 2;
        if (base + 1 >= saida.length) break;
        saida[base] = saida[base] * grupo.repetir[0] + grupo.deslocar[0];
        saida[base + 1] = saida[base + 1] * grupo.repetir[1] + grupo.deslocar[1];
      }
  });
  return saida;
}

function mod3dSubirTexturasDoPalco() {
  const render = mod3dCena.renderizador;
  if (!render || typeof render.definirTextura !== 'function') return;
  if (typeof mod3dCaminhosDasTexturasDaCena !== 'function') return;
  mod3dCaminhosDasTexturasDaCena().forEach((caminho) => {
      if (render.temTextura(caminho)) return;
      const imagem = typeof mod3dImagemDaTextura === 'function' ? mod3dImagemDaTextura(caminho) : null;
      if (imagem) render.definirTextura(caminho, imagem);
  });
}

function mod3dSincronizarCena() {
  const render = mod3dCena.renderizador;
  if (!render) return;
  mod3dSubirTexturasDoPalco();
  const vistos = new Set();
  mod3dGrafo.nos.forEach((no) => {
      if (no.tipo === 'grupo') return;
      const nome = mod3dNomeDaPeca(no.id);
      vistos.add(nome);
      const marca = `${no.versao}|${no.visivel ? 1 : 0}|${no.cor.join(',')}|${mod3dAssinaturaDosMateriais(no)}|${editableMeshVersionOfNode(no)}`;
      if (mod3dCena.pecas.get(nome) === marca) return;
      const mundo = mod3dMundoDoNo(no);
      if (!mundo || !mundo.pos) return;
      mod3dCena.pecas.set(nome, marca);
      const grupos = mod3dGruposDoPalco(no, mundo);
      render.definirMalha(nome, {
          pos: mundo.pos,
          nrm: mundo.nrm,
          uv: mod3dUvDoPalco(mundo, grupos),
          tinta: mundo.cor || null,
          grupos,
          cor: no.cor,
          ordem: 0,
          visivel: no.visivel,
      });
  });
  Array.from(mod3dCena.pecas.keys()).forEach((nome) => {
      if (vistos.has(nome)) return;
      mod3dCena.pecas.delete(nome);
      render.remover(nome);
  });
  mod3dPintarSelecaoNoPalco();
  mod3dPintarMalhaNoPalco();
}

function mod3dPintarSelecaoNoPalco() {
  const render = mod3dCena.renderizador;
  if (!render) return;
  const no = mod3dNoSelecionado();
  const assinatura = no ? `${no.id}|${no.versao}` : '';
  if (assinatura === mod3dCena.selecaoPintada) return;
  mod3dCena.selecaoPintada = assinatura;
  const caixa = no ? mod3dCaixaDeNos([no.id]) : null;
  if (!caixa) {
    render.definirLinhas('selecao', null);
    return;
  }
  const linhas = mod3dLinhasDaCaixa(caixa.minimo, caixa.maximo, MOD3D_CORES_DA_CENA.selecao);
  render.definirLinhas('selecao', { pos: linhas.pos, cores: linhas.cores, ordem: 4 });
}

function mod3dPintarAlcas(matrizes) {
  const render = mod3dCena.renderizador;
  const canvas = mod3dCena.canvas;
  if (!render || !canvas || !mod3dCena.camera) return;
  const no = mod3dNoSelecionado();
  if (!no || no.travado) {
    if (mod3dCena.alcas) {
      mod3dCena.alcas = '';
      render.definirLinhas('alcas', null);
    }
    return;
  }
  const tamanho = {
    largura: Math.max(1, canvas.clientWidth),
    altura: Math.max(1, canvas.clientHeight),
  };
  const camera = mod3dCena.camera.estado();
  const assinatura = [
    no.id,
    no.versao,
    mod3dTransf.modo,
    mod3dTransf.espaco,
    camera.theta.toFixed(4),
    camera.phi.toFixed(4),
    camera.dist.toFixed(4),
    camera.alvo.map((valor) => valor.toFixed(3)).join(','),
    camera.orto ? 1 : 0,
    tamanho.largura,
    tamanho.altura,
  ].join('|');
  if (assinatura === mod3dCena.alcas) return;
  mod3dCena.alcas = assinatura;
  const linhas = mod3dLinhasDasAlcas(no, matrizes, tamanho);
  render.definirLinhas('alcas', { pos: linhas.pos, cores: linhas.cores, camada: 'gizmo', ordem: 5 });
}

function mod3dPontoNaTela(evento) {
  const canvas = mod3dCena.canvas;
  if (!canvas) return { x: 0, y: 0 };
  const caixa = canvas.getBoundingClientRect();
  return { x: evento.clientX - caixa.left, y: evento.clientY - caixa.top };
}

function mod3dMatrizesAtuais() {
  const canvas = mod3dCena.canvas;
  if (!canvas || !mod3dCena.camera) return null;
  const largura = Math.max(1, canvas.clientWidth);
  const altura = Math.max(1, canvas.clientHeight);
  return {
    matrizes: mod3dCena.camera.matrizes(largura, altura),
    tamanho: { largura, altura },
  };
}

function mod3dSelecionarPelaTela(evento) {
  if (mod3dEdicaoSelecionarNaTela(evento)) return;
  const atual = mod3dMatrizesAtuais();
  if (!atual) return;
  const ponto = mod3dPontoNaTela(evento);
  const id = mod3dPicarNoNaTela(ponto.x, ponto.y, atual.matrizes, atual.tamanho);
  mod3dSelecionarNos(id ? [id] : []);
  mod3dCenaTocar();
}

function mod3dAtualizarGrade(visibleHeight, target) {
  const renderer = mod3dCena.renderizador;
  if (!renderer) return;
  if (!mod3dCena.grade.ligada) {
    mod3dCena.grade.neblina = null;
    if (mod3dCena.grade.chave !== 'desligada') {
      renderer.definirLinhas('grade', null);
      renderer.definirLinhas('eixoY', null);
      mod3dCena.grade.chave = 'desligada';
    }
    return;
  }
  const description = window.SynapseGridLevels.describe(visibleHeight, target, mod3dCena.camera.estado());
  mod3dCena.grade.neblina = window.SynapseGridFog.settingsFor(description, MOD3D_FUNDO_DO_PALCO);
  if (description.key === mod3dCena.grade.chave) return;
  const grid = window.SynapseGridLevels.build(description, { background: MOD3D_FUNDO_DO_PALCO });
  renderer.definirLinhas('grade', { pos: grid.positions, cores: grid.colors, camada: 'grade', ordem: 0 });
  const vertical = description.plane === 'xz' ? mod3dEixoVertical(description.step) : null;
  renderer.definirLinhas(
    'eixoY',
    vertical ? { pos: vertical.pos, cores: vertical.cores, camada: 'grade', ordem: 1 } : null,
  );
  mod3dCena.grade.passo = description.step;
  mod3dCena.grade.chave = description.key;
}

function mod3dUniaoDasCaixas(partes) {
  const minimo = [Infinity, Infinity, Infinity];
  const maximo = [-Infinity, -Infinity, -Infinity];
  let achou = false;
  partes.forEach((parte) => {
      if (!parte || !Array.isArray(parte.minimo) || !Array.isArray(parte.maximo)) return;
      achou = true;
      for (let eixo = 0; eixo < 3; eixo++) {
        minimo[eixo] = Math.min(minimo[eixo], Number(parte.minimo[eixo]) || 0);
        maximo[eixo] = Math.max(maximo[eixo], Number(parte.maximo[eixo]) || 0);
      }
  });
  return achou ? { minimo, maximo } : null;
}

function mod3dCaixaDaReferencia() {
  if (!mod3dCena.referencia || !mod3dCena.referencia.meta) return null;
  const meta = mod3dCena.referencia.meta;
  if (!Array.isArray(meta.bboxMin) || !Array.isArray(meta.bboxMax)) return null;
  return { minimo: meta.bboxMin, maximo: meta.bboxMax };
}

function mod3dCaixaDaCena() {
  const tudo = mod3dUniaoDasCaixas([mod3dCaixaDaCenaToda(), mod3dCaixaDaReferencia()]);
  if (tudo) return tudo;
  return { minimo: [-0.5, 0, -0.5], maximo: [0.5, 1, 0.5] };
}

function mod3dEnquadrarCena() {
  if (!mod3dCena.camera) return;
  const selecao = mod3dGrafo.selecao.length ? mod3dCaixaDeNos(mod3dGrafo.selecao) : null;
  const caixa = selecao || mod3dCaixaDaCena();
  mod3dCena.camera.enquadrar(caixa.minimo, caixa.maximo);
  mod3dMarcarSujo();
  mod3dPintarHud();
}

function mod3dAplicarReferencia(pacote) {
  if (!mod3dCena.renderizador || !pacote || !pacote.pos) return false;
  mod3dCena.referencia = { meta: pacote.meta || {}, triangulos: (pacote.pos.length / 9) | 0 };
  mod3dCena.renderizador.definirMalha('referencia', {
      pos: pacote.pos,
      nrm: pacote.nrm,
      cor: MOD3D_CORES_DA_CENA.referencia,
      ordem: 1,
  });
  mod3dEnquadrarCena();
  return true;
}

function mod3dLimparReferencia() {
  if (!mod3dCena.renderizador) return;
  mod3dCena.renderizador.definirMalha('referencia', null);
  mod3dCena.referencia = null;
  if (mod3dCena.hud) mod3dCena.hud.aviso.textContent = '';
  mod3dMarcarSujo();
  mod3dPintarHud();
}

function mod3dTextoDoErroDaReferencia(resposta) {
  const frase = MOD3D_ERROS_DA_REFERENCIA[resposta.erro] || MOD3D_ERROS_DA_REFERENCIA.falha;
  const texto = mod3dTexto(frase);
  return resposta.detalhe ? `${texto} — ${resposta.detalhe}` : texto;
}

async function mod3dCarregarReferencia(caminho) {
  if (!mod3dCena.hud || mod3dCena.carregando) return null;
  const alvo = caminho || mod3dCena.hud.modelos.value;
  if (!alvo) return null;
  if (!mod3dCena.canal || !mod3dCena.projeto) {
    mod3dCena.hud.aviso.textContent = mod3dTexto(MOD3D_ERROS_DA_REFERENCIA['sem-projeto']);
    return null;
  }
  mod3dCena.carregando = true;
  mod3dCena.hud.carregar.disabled = true;
  mod3dCena.hud.aviso.textContent = mod3dTexto(MOD3D_TEXTO_CARREGANDO);
  let resposta = { erro: 'falha' };
  try {
    resposta = await mod3dPedirReferencia(mod3dCena.canal, {
        projeto: mod3dCena.projeto,
        caminho: alvo,
        progresso: (feitos, total) => {
          if (!mod3dCena.hud || total < 2) return;
          mod3dCena.hud.aviso.textContent = `${mod3dTexto(MOD3D_TEXTO_CARREGANDO)} ${feitos}/${total}`;
        },
    });
  } catch (erro) {
    ignorarErro(erro, 'mod3dCarregarReferencia');
    resposta = { erro: 'falha' };
  }
  mod3dCena.carregando = false;
  mod3dCena.hud.carregar.disabled = false;
  if (resposta.erro) {
    mod3dCena.hud.aviso.textContent = mod3dTextoDoErroDaReferencia(resposta);
    return resposta;
  }
  mod3dCena.hud.aviso.textContent = '';
  mod3dAplicarReferencia(resposta);
  return resposta;
}

function mod3dPintarModelos(lista) {
  mod3dCena.modelos = Array.isArray(lista) ? lista : [];
  if (!mod3dCena.hud) return;
  const seletor = mod3dCena.hud.modelos;
  const anterior = seletor.value;
  seletor.textContent = '';
  if (!mod3dCena.modelos.length) {
    const vazio = document.createElement('option');
    vazio.value = '';
    vazio.textContent = mod3dTexto(MOD3D_TEXTO_SEM_MODELOS);
    seletor.appendChild(vazio);
    seletor.disabled = true;
    mod3dCena.hud.carregar.disabled = true;
    return;
  }
  mod3dCena.modelos.forEach((modelo) => {
      const item = document.createElement('option');
      item.value = modelo.caminho;
      item.textContent = `${modelo.caminho} · ${mod3dTamanhoLegivel(modelo.bytes)}`;
      seletor.appendChild(item);
  });
  seletor.disabled = false;
  mod3dCena.hud.carregar.disabled = mod3dCena.carregando;
  if (mod3dCena.modelos.some((modelo) => modelo.caminho === anterior)) seletor.value = anterior;
}

function mod3dAplicarUnidades(dados) {
  const tabela = dados && dados.tabela ? dados.tabela : null;
  if (tabela) {
    const novas = {};
    MOD3D_ORDEM_DAS_UNIDADES.forEach((chave) => {
        const vinda = tabela[chave];
        const padrao = MOD3D_UNIDADES_PADRAO[chave];
        const fator = vinda && Number(vinda.f) > 0 ? Number(vinda.f) : padrao.f;
        novas[chave] = { f: fator, label: (vinda && vinda.label) || padrao.label };
    });
    mod3dCena.unidades = novas;
  }
  if (dados && Number(dados.studM) > 0) {
    mod3dCena.studM = Number(dados.studM);
    mod3dCena.unidades.stud = { f: mod3dCena.studM, label: mod3dCena.unidades.stud.label };
  }
  mod3dPintarHud();
}

function mod3dViewportRecado(envelope) {
  if (!envelope || !envelope.tipo) return false;
  if (envelope.tipo === 'unidades') {
    mod3dAplicarUnidades(envelope.dados || {});
    return true;
  }
  if (envelope.tipo === 'modelos') {
    mod3dPintarModelos(envelope.dados ? envelope.dados.lista : []);
    return true;
  }
  return false;
}

function mod3dViewportProjeto(id, canal) {
  if (canal) mod3dCena.canal = canal;
  const novo = String(id || '');
  const mudou = novo !== mod3dCena.projeto;
  mod3dCena.projeto = novo;
  if (!mod3dCena.canal || !novo) return;
  if (mudou) mod3dLimparReferencia();
  mod3dCena.canal.enviarPorTodos('unidades-pedido', { projeto: novo });
  mod3dCena.canal.enviarPorTodos('modelos-pedido', { projeto: novo });
  if (typeof mod3dPedirImagensDoProjeto === 'function') {
    mod3dPedirImagensDoProjeto(mod3dCena.canal, novo);
  }
}

function mod3dMemoriaEmMb() {
  try {
    const memoria = performance && performance.memory ? performance.memory : null;
    if (!memoria || !memoria.usedJSHeapSize) return 0;
    return memoria.usedJSHeapSize / 1048576;
  } catch (erro) {
    return 0;
  }
}

function mod3dPintarContador() {
  const hud = mod3dCena.hud;
  if (!hud || !hud.contador) return;
  const contas = mod3dCena.renderizador ? mod3dCena.renderizador.contar() : null;
  const memoria = mod3dMemoriaEmMb();
  const partes = [
    `${mod3dCena.fps.valor} fps`,
    `${mod3dCena.fps.tempo.toFixed(1)} ms`,
    `${contas ? contas.triangulos : 0} tri`,
    `${contas ? contas.linhas : 0} lin`,
    `${contas ? (contas.bytes / 1048576).toFixed(1) : '0.0'} MB gpu`,
  ];
  if (memoria > 0) partes.push(`${memoria.toFixed(0)} MB js`);
  hud.contador.textContent = partes.join(' · ');
}

function mod3dPintarHud() {
  const hud = mod3dCena.hud;
  if (!hud || !mod3dCena.camera) return;
  const estado = mod3dCena.camera.estado();
  hud.grade.textContent = `${mod3dTexto('Grade')}: ${mod3dMedidaFormatada(mod3dCena.grade.passo)}`;
  hud.distancia.textContent = `${mod3dTexto('Distância')}: ${mod3dMedidaFormatada(estado.dist)}`;
  hud.alvo.textContent = `${mod3dTexto('Alvo')}: ${mod3dTrioFormatado(estado.alvo)}`;
  const escolhido = mod3dNoSelecionado();
  const caixaDaSelecao = escolhido ? mod3dCaixaDeNos([escolhido.id]) : null;
  const edicao = mod3dEdicaoAtiva() ? mod3dResumoDaEdicao() : null;
  if (edicao) {
    const modo = MOD3D_MODOS_DE_MALHA.filter((item) => item.chave === edicao.modo)[0];
    hud.selecao.textContent = `${mod3dTexto('Malha')} · ${mod3dTexto(modo ? modo.rotulo : edicao.modo)}: ${edicao.escolhidos}`;
  } else if (escolhido && caixaDaSelecao) {
    hud.selecao.textContent = `${escolhido.nome}: ${mod3dTrioFormatado([
			caixaDaSelecao.maximo[0] - caixaDaSelecao.minimo[0],
			caixaDaSelecao.maximo[1] - caixaDaSelecao.minimo[1],
			caixaDaSelecao.maximo[2] - caixaDaSelecao.minimo[2],
		])}`;
  } else {
    hud.selecao.textContent = `${mod3dTexto('Seleção')}: ${escolhido ? escolhido.nome : '—'}`;
  }
  if (mod3dCena.referencia) {
    const meta = mod3dCena.referencia.meta || {};
    const dims = Array.isArray(meta.dims) ? meta.dims : [0, 0, 0];
    const nota = meta.nota ? ` · ${meta.nota}` : '';
    hud.referencia.textContent = `${meta.caminho || '—'} · ${mod3dCena.referencia.triangulos} ${mod3dTexto('triângulos')} · ${mod3dTrioFormatado(dims)}${nota}`;
  } else {
    hud.referencia.textContent = mod3dTexto(MOD3D_TEXTO_SEM_REFERENCIA);
  }
  hud.projecao.textContent = estado.orto ? mod3dTexto('Ortográfica') : mod3dTexto('Perspectiva');
  Array.from(hud.vistas.keys()).forEach((chave) => {
      hud.vistas.get(chave).classList.toggle('on', chave === estado.vista);
  });
  mod3dPintarContador();
}

function mod3dMedirTela() {
  if (!mod3dCena.canvas || !mod3dCena.renderizador) return false;
  const caixa = mod3dCena.canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const mudou = mod3dCena.renderizador.definirTamanho(
    Math.max(1, caixa.width),
    Math.max(1, caixa.height),
    dpr,
  );
  if (mudou) mod3dMarcarSujo();
  return mudou;
}

function mod3dPintarAviso() {
  const hud = mod3dCena.hud;
  if (!hud) return;
  if (!mod3dCena.renderizador) return;
  if (mod3dCena.renderizador.perdido()) {
    hud.falha.textContent = mod3dTexto(MOD3D_TEXTO_CONTEXTO_PERDIDO);
    hud.falha.hidden = false;
    return;
  }
  if (!mod3dCena.renderizador.pronto()) {
    hud.falha.textContent = mod3dTexto(MOD3D_TEXTO_SEM_WEBGL);
    hud.falha.hidden = false;
    return;
  }
  hud.falha.hidden = true;
}

function mod3dDesenharQuadro(agora) {
  const render = mod3dCena.renderizador;
  if (!render || !mod3dCena.camera) return;
  if (!render.pronto()) {
    if (render.perdido() && agora - mod3dCena.espera > MOD3D_ESPERA_DO_CONTEXTO) {
      mod3dCena.espera = agora;
      render.remontar();
      mod3dMarcarSujo();
    }
    return;
  }
  const tamanho = render.tamanho();
  const matrizes = mod3dCena.camera.matrizes(tamanho.largura, tamanho.altura);
  mod3dAtualizarGrade(matrizes.alturaVisivel, mod3dCena.camera.estado().alvo);
  mod3dSincronizarCena();
  mod3dPintarAlcas(matrizes);
  render.desenhar({
      proj: matrizes.proj,
      view: matrizes.view,
      olho: matrizes.olho,
      neblina: mod3dCena.grade.neblina,
      fundo: MOD3D_FUNDO_DO_PALCO,
  });
  if (mod3dCena.gizmo) mod3dCena.gizmo.draw(matrizes.view);
}

function mod3dLaco(agora) {
  mod3dCena.laco = 0;
  if (document.hidden) return;
  const momento = agora || (performance && performance.now ? performance.now() : Date.now());
  if (mod3dCena.sujo) {
    mod3dCena.sujo = false;
    const inicio = performance && performance.now ? performance.now() : momento;
    mod3dDesenharQuadro(momento);
    const fim = performance && performance.now ? performance.now() : momento;
    mod3dCena.fps.tempo = fim - inicio;
    mod3dCena.fps.conta += 1;
  }
  if (momento - mod3dCena.fps.marca >= MOD3D_JANELA_DO_FPS) {
    const janela = (momento - mod3dCena.fps.marca) / 1000;
    mod3dCena.fps.valor = janela > 0 ? Math.round(mod3dCena.fps.conta / janela) : 0;
    mod3dCena.fps.conta = 0;
    mod3dCena.fps.marca = momento;
    if (mod3dCena.hud && mod3dCena.hud.contador) mod3dPintarContador();
  }
  mod3dTocarLaco();
}

function mod3dTocarLaco() {
  if (mod3dCena.laco || document.hidden || !mod3dCena.canvas) return;
  mod3dCena.laco = requestAnimationFrame(mod3dLaco);
}

function mod3dPararLaco() {
  if (!mod3dCena.laco) return;
  cancelAnimationFrame(mod3dCena.laco);
  mod3dCena.laco = 0;
}

function mod3dMedidaDosDedos() {
  const pontos = Array.from(mod3dCena.ponteiros.values());
  if (pontos.length < 2) return null;
  const dx = pontos[1].x - pontos[0].x;
  const dy = pontos[1].y - pontos[0].y;
  return {
    dist: Math.max(1, Math.hypot(dx, dy)),
    x: (pontos[0].x + pontos[1].x) / 2,
    y: (pontos[0].y + pontos[1].y) / 2,
  };
}

function mod3dAoApertar(evento) {
  const tela = mod3dCena.canvas;
  if (!tela) return;
  try {
    tela.focus({ preventScroll: true });
    if (typeof tela.setPointerCapture === 'function') tela.setPointerCapture(evento.pointerId);
  } catch (erro) {
    ignorarErro(erro, 'mod3dViewport:captura');
  }
  mod3dCena.ponteiros.set(evento.pointerId, { x: evento.clientX, y: evento.clientY });
  if (
    typeof blenderHandleViewportPointerDown === 'function' &&
    blenderHandleViewportPointerDown(evento)
  ) {
    mod3dCena.gesto = null;
    mod3dCena.clique = null;
    mod3dMarcarSujo();
    evento.preventDefault();
    return;
  }
  if (mod3dEdicaoAoApertar(evento)) {
    mod3dCena.gesto = null;
    mod3dCena.clique = null;
    mod3dMarcarSujo();
    evento.preventDefault();
    return;
  }
  if (mod3dCena.ponteiros.size === 1 && evento.button === 0 && !evento.shiftKey) {
    const atual = mod3dMatrizesAtuais();
    const ponto = mod3dPontoNaTela(evento);
    const alca = atual
    ? mod3dPegarAlca(ponto.x, ponto.y, mod3dNoSelecionado(), atual.matrizes, atual.tamanho)
    : '';
    if (alca && mod3dIniciarArrasteDeAlca(alca, ponto.x, ponto.y, atual.matrizes, atual.tamanho)) {
      mod3dCena.gesto = null;
      mod3dCena.clique = null;
      mod3dMarcarSujo();
      evento.preventDefault();
      return;
    }
    mod3dCena.clique = { x: evento.clientX, y: evento.clientY };
  }
  if (mod3dCena.ponteiros.size >= 2) {
    mod3dCena.dedos = mod3dMedidaDosDedos();
    mod3dCena.gesto = null;
  } else {
    const deslocar = evento.button === 1 || evento.button === 2 || evento.shiftKey === true;
    mod3dCena.gesto = {
      modo: deslocar ? 'deslocar' : 'orbitar',
      x: evento.clientX,
      y: evento.clientY,
    };
  }
  evento.preventDefault();
}

function mod3dAoMover(evento) {
  if (
    typeof blenderHandleViewportPointerMove === 'function' &&
    blenderHandleViewportPointerMove(evento)
  ) {
    evento.preventDefault();
    return;
  }
  if (!mod3dCena.ponteiros.has(evento.pointerId)) return;
  mod3dCena.ponteiros.set(evento.pointerId, { x: evento.clientX, y: evento.clientY });
  if (mod3dEdicaoAoMover(evento)) {
    mod3dMarcarSujo();
    evento.preventDefault();
    return;
  }
  if (mod3dTransf.arraste) {
    const ponto = mod3dPontoNaTela(evento);
    mod3dArrastarAlca(ponto.x, ponto.y);
    mod3dMarcarSujo();
    evento.preventDefault();
    return;
  }
  const altura = mod3dCena.canvas ? mod3dCena.canvas.clientHeight : 1;
  if (mod3dCena.ponteiros.size >= 2) {
    const agora = mod3dMedidaDosDedos();
    const antes = mod3dCena.dedos;
    if (agora && antes) {
      mod3dCena.camera.aproximar(agora.dist / antes.dist);
      mod3dCena.camera.deslocarPorPixel(agora.x - antes.x, agora.y - antes.y, altura);
      mod3dMarcarSujo();
      mod3dPintarHud();
    }
    mod3dCena.dedos = agora;
    evento.preventDefault();
    return;
  }
  const gesto = mod3dCena.gesto;
  if (!gesto) return;
  const dx = evento.clientX - gesto.x;
  const dy = evento.clientY - gesto.y;
  gesto.x = evento.clientX;
  gesto.y = evento.clientY;
  if (gesto.modo === 'deslocar') mod3dCena.camera.deslocarPorPixel(dx, dy, altura);
  else mod3dCena.camera.orbitarPorPixel(dx, dy);
  mod3dMarcarSujo();
  mod3dPintarHud();
  evento.preventDefault();
}

function mod3dAoSoltar(evento) {
  if (mod3dEdicaoAoSoltar()) {
    mod3dMarcarSujo();
  } else if (mod3dTransf.arraste) {
    mod3dSoltarAlca();
    mod3dMarcarSujo();
    mod3dPintarHud();
  } else if (mod3dCena.clique) {
    const dx = evento.clientX - mod3dCena.clique.x;
    const dy = evento.clientY - mod3dCena.clique.y;
    if (Math.hypot(dx, dy) < 4) mod3dSelecionarPelaTela(evento);
  }
  mod3dCena.clique = null;
  mod3dCena.ponteiros.delete(evento.pointerId);
  if (mod3dCena.ponteiros.size < 2) mod3dCena.dedos = null;
  if (mod3dCena.ponteiros.size === 0) mod3dCena.gesto = null;
  try {
    if (mod3dCena.canvas && typeof mod3dCena.canvas.releasePointerCapture === 'function') {
      mod3dCena.canvas.releasePointerCapture(evento.pointerId);
    }
  } catch (erro) {
    ignorarErro(erro, 'mod3dViewport:solta');
  }
}

function mod3dAoRolar(evento) {
  if (typeof blenderHandleViewportWheel === 'function' && blenderHandleViewportWheel(evento)) {
    mod3dMarcarSujo();
    evento.preventDefault();
    return;
  }
  if (!mod3dCena.camera) return;
  const passo = evento.deltaMode === 1 ? 16 : evento.deltaMode === 2 ? 100 : 1;
  mod3dCena.camera.rolar(evento.deltaY * passo);
  mod3dMarcarSujo();
  mod3dPintarHud();
  evento.preventDefault();
}

function mod3dTrocarVista(chave) {
  if (!mod3dCena.camera) return;
  mod3dCena.camera.definirVista(chave);
  mod3dMarcarSujo();
  mod3dPintarHud();
}

function mod3dAlternarGrade() {
  mod3dCena.grade.ligada = !mod3dCena.grade.ligada;
  mod3dCena.grade.chave = '';
  writeGridVisibilityPreference(mod3dCena.grade.ligada);
  if (mod3dCena.hud) mod3dCena.hud.grade2.classList.toggle('on', mod3dCena.grade.ligada);
  mod3dMarcarSujo();
}

function mod3dAoTeclar(evento) {
  if (!mod3dCena.camera) return;
  if (typeof blenderHandleViewportKeyDown === 'function' && blenderHandleViewportKeyDown(evento)) {
    mod3dMarcarSujo();
    evento.preventDefault();
    return;
  }
  if (mod3dEdicaoAoTeclar(evento)) {
    mod3dMarcarSujo();
    evento.preventDefault();
    return;
  }
  const camera = mod3dCena.camera;
  const giro = camera.giroDoTeclado();
  const zoom = camera.zoomDoTeclado();
  const altura = mod3dCena.canvas ? mod3dCena.canvas.clientHeight : 1;
  const passoEmPixels = Math.max(12, altura / 12);
  const tecla = evento.key;
  let usou = true;
  if (tecla === 'ArrowLeft' || tecla === 'ArrowRight') {
    const sinal = tecla === 'ArrowLeft' ? -1 : 1;
    if (evento.shiftKey) camera.deslocarPorPixel(-sinal * passoEmPixels, 0, altura);
    else camera.orbitar(-sinal * giro, 0);
  } else if (tecla === 'ArrowUp' || tecla === 'ArrowDown') {
    const sinal = tecla === 'ArrowUp' ? -1 : 1;
    if (evento.shiftKey) camera.deslocarPorPixel(0, -sinal * passoEmPixels, altura);
    else camera.orbitar(0, -sinal * giro);
  } else if (tecla === '+' || tecla === '=') {
    camera.aproximar(zoom);
  } else if (tecla === '-' || tecla === '_') {
    camera.aproximar(1 / zoom);
  } else if (tecla === '1') {
    mod3dTrocarVista('frente');
  } else if (tecla === '3') {
    mod3dTrocarVista('lado');
  } else if (tecla === '7') {
    mod3dTrocarVista('topo');
  } else if (tecla === '0') {
    mod3dTrocarVista('livre');
  } else if (tecla === '5') {
    camera.alternarProjecao();
  } else if (tecla === 'f' || tecla === 'F') {
    mod3dEnquadrarCena();
  } else if (tecla === 'g' || tecla === 'G') {
    mod3dAlternarGrade();
  } else if ((tecla === 'z' || tecla === 'Z') && (evento.ctrlKey || evento.metaKey)) {
    if (evento.shiftKey) mod3dRefazer();
    else mod3dDesfazer();
  } else if ((tecla === 'y' || tecla === 'Y') && (evento.ctrlKey || evento.metaKey)) {
    mod3dRefazer();
  } else if ((tecla === 'd' || tecla === 'D') && (evento.ctrlKey || evento.metaKey)) {
    mod3dDuplicarSelecao();
  } else if (tecla === 'Delete' || tecla === 'Backspace') {
    mod3dApagarSelecao();
  } else if (tecla === 'w' || tecla === 'W') {
    mod3dDefinirModo('mover');
    mod3dCenaTocar();
  } else if (tecla === 'e' || tecla === 'E') {
    mod3dDefinirModo('girar');
    mod3dCenaTocar();
  } else if (tecla === 'r' || tecla === 'R') {
    mod3dDefinirModo('escalar');
    mod3dCenaTocar();
  } else if (tecla === 'x' || tecla === 'X') {
    mod3dDefinirEspaco(mod3dTransf.espaco === 'global' ? 'local' : 'global');
    mod3dCenaTocar();
  } else {
    usou = false;
  }
  if (!usou) return;
  mod3dMarcarSujo();
  mod3dPintarHud();
  evento.preventDefault();
}

function mod3dBotaoDoViewport(rotulo, titulo) {
  const botao = mod3dNo('button', 'mod3d-viewbotao', mod3dTexto(rotulo));
  botao.type = 'button';
  botao.title = mod3dTexto(titulo || rotulo);
  return botao;
}

function mod3dMontarHud(caixa) {
  const topo = mod3dNo('div', 'mod3d-hud mod3d-hud-topo');
  const vistas = new Map();
  const grupoDeVistas = mod3dNo('div', 'mod3d-hud-grupo');
  MOD3D_VISTAS_DO_MENU.forEach((vista) => {
      const botao = mod3dBotaoDoViewport(vista.rotulo, `Vista ${vista.rotulo.toLowerCase()}`);
      botao.addEventListener('click', () => mod3dTrocarVista(vista.chave));
      vistas.set(vista.chave, botao);
      grupoDeVistas.appendChild(botao);
  });
  const enquadrar = mod3dBotaoDoViewport('Enquadrar', 'Enquadrar a cena (F)');
  enquadrar.addEventListener('click', mod3dEnquadrarCena);
  grupoDeVistas.appendChild(enquadrar);
  const grade2 = mod3dBotaoDoViewport('Grade', 'Ligar ou desligar a grade (G)');
  grade2.addEventListener('click', mod3dAlternarGrade);
  grupoDeVistas.appendChild(grade2);
  const projecao = mod3dNo('button', 'mod3d-viewbotao', mod3dTexto('Perspectiva'));
  projecao.type = 'button';
  projecao.title = mod3dTexto('Alternar perspectiva e ortográfica (5)');
  projecao.addEventListener('click', () => {
      mod3dCena.camera.alternarProjecao();
      mod3dMarcarSujo();
      mod3dPintarHud();
  });
  grupoDeVistas.appendChild(projecao);
  topo.appendChild(grupoDeVistas);

  const grupoDeDados = mod3dNo('div', 'mod3d-hud-grupo');
  const unidades = document.createElement('select');
  unidades.className = 'mod3d-viewseletor';
  unidades.title = mod3dTexto('Unidade de medida');
  MOD3D_ORDEM_DAS_UNIDADES.forEach((chave) => {
      const item = document.createElement('option');
      item.value = chave;
      item.textContent = MOD3D_UNIDADES_PADRAO[chave].label;
      unidades.appendChild(item);
  });
  unidades.value = mod3dCena.unidade;
  unidades.addEventListener('change', () => {
      mod3dCena.unidade = unidades.value;
      mod3dGravarLocal(MOD3D_CHAVE_DA_UNIDADE, mod3dCena.unidade);
      mod3dPintarHud();
  });
  const modelos = document.createElement('select');
  modelos.className = 'mod3d-viewseletor mod3d-viewseletor-largo';
  modelos.title = mod3dTexto('Modelo do projeto para usar como referência');
  modelos.disabled = true;
  const carregar = mod3dBotaoDoViewport('Carregar', 'Carregar o modelo escolhido no viewport');
  carregar.disabled = true;
  carregar.addEventListener('click', () => {
      mod3dCarregarReferencia(modelos.value).catch((erro) =>
        ignorarErro(erro, 'mod3dCarregarReferencia'),
      );
  });
  const limpar = mod3dBotaoDoViewport('Limpar', 'Tirar a referência do viewport');
  limpar.addEventListener('click', mod3dLimparReferencia);
  grupoDeDados.appendChild(unidades);
  grupoDeDados.appendChild(modelos);
  grupoDeDados.appendChild(carregar);
  grupoDeDados.appendChild(limpar);
  topo.appendChild(grupoDeDados);

  const base = mod3dNo('div', 'mod3d-hud mod3d-hud-base');
  const grade = mod3dNo('span', 'mod3d-medida', '—');
  const distancia = mod3dNo('span', 'mod3d-medida', '—');
  const alvo = mod3dNo('span', 'mod3d-medida', '—');
  const selecao = mod3dNo('span', 'mod3d-medida', '—');
  const projecaoTexto = mod3dNo('span', 'mod3d-medida', '—');
  [grade, distancia, alvo, selecao, projecaoTexto].forEach((no) => base.appendChild(no));

  const rodape = mod3dNo('div', 'mod3d-hud mod3d-hud-referencia');
  const referencia = mod3dNo('span', 'mod3d-medida', mod3dTexto(MOD3D_TEXTO_SEM_REFERENCIA));
  const aviso = mod3dNo('span', 'mod3d-viewaviso', '');
  rodape.appendChild(referencia);
  rodape.appendChild(aviso);

  const falha = mod3dNo('div', 'mod3d-viewfalha', '');
  falha.hidden = true;

  let contador = null;
  if (mod3dDiagnosticoDoViewport()) {
    contador = mod3dNo('div', 'mod3d-contador', '—');
  }

  caixa.appendChild(topo);
  caixa.appendChild(base);
  caixa.appendChild(rodape);
  caixa.appendChild(falha);
  if (contador) caixa.appendChild(contador);

  return {
    vistas,
    projecao,
    grade2,
    unidades,
    modelos,
    carregar,
    limpar,
    grade,
    distancia,
    alvo,
    selecao,
    referencia,
    aviso,
    falha,
    contador,
  };
}

function mod3dMontarViewport(palco) {
  if (!palco || mod3dCena.canvas) return null;
  const caixa = mod3dNo('div', 'mod3d-viewport');
  const canvas = document.createElement('canvas');
  canvas.className = 'mod3d-tela';
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', mod3dTexto('Cena 3D do modelador'));
  caixa.appendChild(canvas);
  palco.appendChild(caixa);

  mod3dCena.caixa = caixa;
  mod3dCena.canvas = canvas;
  mod3dCena.unidade = mod3dLerLocal(MOD3D_CHAVE_DA_UNIDADE) || 'm';
  if (!MOD3D_UNIDADES_PADRAO[mod3dCena.unidade]) mod3dCena.unidade = 'm';
  mod3dCena.grade.ligada = readGridVisibilityPreference();
  mod3dCena.camera = mod3dCriarCamera({ alvo: [0, 0.5, 0], dist: 3.2 });
  mod3dCena.gizmo = mod3dMontarGizmoDeNavegacao(caixa);
  mod3dCena.renderizador = mod3dCriarRenderizador(canvas);
  mod3dCena.hud = mod3dMontarHud(caixa);
  mod3dCena.pincel = mod3dMontarPincelDaEdicao(caixa);
  mod3dCena.hud.grade2.classList.toggle('on', mod3dCena.grade.ligada);
  mod3dCena.renderizador.aoMudar(mod3dMarcarSujo);

  canvas.addEventListener('pointerdown', mod3dAoApertar);
  canvas.addEventListener('pointermove', mod3dAoMover);
  canvas.addEventListener('pointerup', mod3dAoSoltar);
  canvas.addEventListener('pointercancel', mod3dAoSoltar);
  canvas.addEventListener('pointerleave', mod3dAoSoltar);
  canvas.addEventListener('wheel', mod3dAoRolar, { passive: false });
  canvas.addEventListener('keydown', mod3dAoTeclar);
  canvas.addEventListener('contextmenu', (evento) => evento.preventDefault());
  canvas.addEventListener('webglcontextlost', mod3dPintarAviso);
  canvas.addEventListener('webglcontextrestored', mod3dPintarAviso);

  if (typeof ResizeObserver === 'function') {
    mod3dCena.observador = new ResizeObserver(() => {
        mod3dMedirTela();
        mod3dTocarLaco();
    });
    mod3dCena.observador.observe(caixa);
  } else {
    window.addEventListener('resize', () => {
        mod3dMedirTela();
        mod3dTocarLaco();
    });
  }
  document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        mod3dPararLaco();
        return;
      }
      mod3dMarcarSujo();
      mod3dTocarLaco();
  });

  mod3dMedirTela();
  mod3dIniciarTransformar();
  mod3dCenaAoMudar(() => {
      mod3dMarcarSujo();
      mod3dPintarHud();
      mod3dPintarPainelDaCena();
      mod3dPintarPainelDaMalha();
      mod3dPintarPainelDosMateriais();
      mod3dPintarEditorUv();
  });
  mod3dHistoricoAoMudar(() => {
      mod3dPintarPainelDaCena();
      mod3dPintarPainelDaMalha();
      mod3dPintarPainelDosMateriais();
      mod3dPintarEditorUv();
      mod3dPintarMalhaNoPalco();
  });
  if (!mod3dGrafo.nos.size) {
    const inicial = mod3dCriarNo({ tipo: 'cubo' });
    if (inicial) mod3dSelecionarNos([inicial.id]);
  }
  mod3dHistoricoLimpar();
  mod3dSincronizarCena();
  mod3dEnquadrarCena();
  mod3dAtualizarGrade(mod3dCena.camera.alturaVisivel(), mod3dCena.camera.estado().alvo);
  mod3dPintarAviso();
  mod3dPintarHud();
  mod3dTocarLaco();

  window.MOD3D_VIEWPORT = {
    camera: () => (mod3dCena.camera ? mod3dCena.camera.estado() : null),
    cena: () => mod3dCenaResumo(),
    no: (id) => {
      const achado = mod3dNoPorId(id);
      return achado ? mod3dDadosDoNo(achado) : null;
    },
    selecionar: (id) => {
      const lista = mod3dSelecionarNos(Array.isArray(id) ? id : id ? [id] : []);
      mod3dCenaTocar();
      return lista;
    },
    adicionar: (tipo) => {
      const novo = mod3dAdicionarPrimitiva(tipo);
      return novo ? novo.id : '';
    },
    duplicar: mod3dDuplicarSelecao,
    apagar: mod3dApagarSelecao,
    agrupar: () => {
      const grupo = mod3dAgruparSelecao();
      return grupo ? grupo.id : '';
    },
    campo: mod3dDefinirCampoDoNo,
    parametro: mod3dDefinirParametroDoNo,
    renomear: mod3dDefinirNomeDoNo,
    pivo: mod3dCentralizarPivoDoNo,
    esconder: mod3dAlternarVisivelDoNo,
    travar: mod3dAlternarTravaDoNo,
    modo: (chave) => (chave ? mod3dDefinirModo(chave) : mod3dTransf.modo),
    espaco: (chave) => (chave ? mod3dDefinirEspaco(chave) : mod3dTransf.espaco),
    encaixe: (mudanca) =>
    mudanca ? mod3dDefinirEncaixe(mudanca) : Object.assign({}, mod3dTransf.encaixe),
    desfazer: mod3dDesfazer,
    refazer: mod3dRefazer,
    historico: () => mod3dHistoricoEstado(),
    exportar: () => mod3dCenaGltf(),
    limparCena: () => {
      mod3dCenaLimpar();
      mod3dHistoricoLimpar();
      mod3dCenaTocar();
      return mod3dCenaResumo();
    },
    enquadrar: mod3dEnquadrarCena,
    vista: mod3dTrocarVista,
    grade: () => ({ passo: mod3dCena.grade.passo, ligada: mod3dCena.grade.ligada }),
    unidade: (chave) => {
      if (chave && MOD3D_UNIDADES_PADRAO[chave]) {
        mod3dCena.unidade = chave;
        if (mod3dCena.hud) mod3dCena.hud.unidades.value = chave;
        mod3dPintarHud();
      }
      return mod3dCena.unidade;
    },
    referencia: () => mod3dCena.referencia,
    carregar: mod3dCarregarReferencia,
    limpar: mod3dLimparReferencia,
    contar: () => (mod3dCena.renderizador ? mod3dCena.renderizador.contar() : null),
    fps: () => mod3dCena.fps.valor,
    pronto: () => Boolean(mod3dCena.renderizador && mod3dCena.renderizador.pronto()),
  };
  return window.MOD3D_VIEWPORT;
}
