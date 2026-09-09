'use strict';

const MOD3D_TETO_DAS_LINHAS_DA_MALHA = 60000;
const MOD3D_TETO_DOS_PONTOS_DA_MALHA = 20000;
const MOD3D_CRUZ_DO_VERTICE = 0.006;
const MOD3D_CORES_DA_MALHA = Object.freeze({
    aresta: [0.42, 0.47, 0.58],
    borda: [1, 0.71, 0.33],
    escolhida: [0.42, 0.64, 1],
    vertice: [0.55, 0.6, 0.72],
    ponta: [0.24, 0.81, 0.56],
});

const mod3dPainelDaMalha = {
  caixa: null,
  corpo: null,
  resumo: null,
  recado: null,
  entrar: null,
  modos: [],
  contagem: null,
  entradas: {},
  trio: null,
  eixo: null,
  soldar: null,
  avisos: null,
  botoes: [],
  assinatura: '',
  pintado: '',
  mundo: null,
};

function mod3dValorDaMalha(chave, padrao) {
  const entrada = mod3dPainelDaMalha.entradas[chave];
  if (!entrada) return padrao;
  const valor = Number(entrada.value);
  if (!isFinite(valor)) return padrao;
  return valor;
}

function mod3dMedidaDaMalha(chave, padrao) {
  return mod3dTelaParaMetro(mod3dValorDaMalha(chave, mod3dMetroParaTela(padrao)));
}

function mod3dBotaoDaMalha(rotulo, titulo, acao, livre) {
  const botao = mod3dPainelBotao(rotulo, titulo);
  botao.addEventListener('click', acao);
  mod3dPainelDaMalha.botoes.push({ botao, livre: livre === true });
  return botao;
}

function mod3dLinhaDeBotoesDaMalha(lista) {
  const linha = mod3dNo('div', 'mod3d-ferramentas');
  lista.forEach((item) => {
      linha.appendChild(mod3dBotaoDaMalha(item.rotulo, item.titulo, item.acao, item.livre));
  });
  return linha;
}

function mod3dCampoDaMalha(chave, rotulo, passo, valor) {
  const numero = mod3dPainelNumero(rotulo, passo);
  numero.entrada.value = String(valor);
  mod3dPainelDaMalha.entradas[chave] = numero.entrada;
  return numero.caixa;
}

function mod3dMontarModosDaMalha() {
  const linha = mod3dNo('div', 'mod3d-ferramentas');
  mod3dPainelDaMalha.modos = [];
  MOD3D_MODOS_DE_MALHA.forEach((modo) => {
      const botao = mod3dBotaoDaMalha(
        modo.rotulo,
        `${mod3dTexto(modo.rotulo)} (${modo.tecla})`,
        () => {
          mod3dDefinirModoDeMalha(modo.chave);
        },
      );
      mod3dPainelDaMalha.modos.push({ chave: modo.chave, botao });
      linha.appendChild(botao);
  });
  return linha;
}

function mod3dMontarEspelhoDaMalha() {
  const linha = mod3dNo('div', 'mod3d-linha');
  const eixo = mod3dNo('select', 'mod3d-seletor mod3d-seletor-curto');
  MOD3D_EIXOS_DO_ESPELHO.forEach((item) => {
      const opcao = mod3dNo('option', '', mod3dTexto(item.rotulo));
      opcao.value = item.chave;
      eixo.appendChild(opcao);
  });
  mod3dPainelDaMalha.eixo = eixo;
  linha.appendChild(eixo);
  const soldar = mod3dNo('label', 'mod3d-check');
  const marca = document.createElement('input');
  marca.type = 'checkbox';
  marca.checked = true;
  soldar.appendChild(marca);
  soldar.appendChild(mod3dNo('span', '', mod3dTexto('Soldar no meio')));
  mod3dPainelDaMalha.soldar = marca;
  linha.appendChild(soldar);
  linha.appendChild(
    mod3dBotaoDaMalha('Espelhar', 'Espelhar a malha pelo eixo', () => {
        mod3dEspelharMalha(
          eixo.value,
          marca.checked,
          mod3dMedidaDaMalha('solda', MOD3D_SOLDA_PADRAO),
        );
    }),
  );
  return linha;
}

function mod3dMontarMoverDaMalha() {
  const trio = mod3dTrioDeCampos(mod3dTexto('Mover'), 'malha', 0.05);
  mod3dPainelDaMalha.trio = trio.entradas;
  trio.linha.appendChild(
    mod3dBotaoDaMalha('Aplicar', 'Mover a seleção pelos valores', () => {
        mod3dMoverSelecaoDeMalha([
            mod3dTelaParaMetro(trio.entradas[0].value),
            mod3dTelaParaMetro(trio.entradas[1].value),
            mod3dTelaParaMetro(trio.entradas[2].value),
        ]);
    }),
  );
  return trio.linha;
}

function mod3dMontarPainelDaMalha() {
  const caixa = mod3dNo('section', 'mod3d-painel');
  const titulo = mod3dNo('div', 'mod3d-painel-titulo');
  titulo.appendChild(mod3dNo('span', '', mod3dTexto('Malha')));
  const resumo = mod3dNo('span', 'mod3d-painel-resumo', '');
  titulo.appendChild(resumo);
  caixa.appendChild(titulo);
  const corpo = mod3dNo('div', 'mod3d-painel-corpo');
  caixa.appendChild(corpo);
  mod3dPainelDaMalha.caixa = caixa;
  mod3dPainelDaMalha.corpo = corpo;
  mod3dPainelDaMalha.resumo = resumo;
  mod3dPainelDaMalha.botoes = [];
  mod3dPainelDaMalha.entradas = {};

  const entrada = mod3dNo('div', 'mod3d-ferramentas');
  mod3dPainelDaMalha.entrar = mod3dBotaoDaMalha(
    'Editar malha',
    'Entrar ou sair da edição (Alt+E)',
    () => {
      mod3dAlternarEdicao();
    },
    true,
  );
  entrada.appendChild(mod3dPainelDaMalha.entrar);
  corpo.appendChild(entrada);

  corpo.appendChild(mod3dMontarModosDaMalha());
  const contagem = mod3dNo('div', 'mod3d-malha-contagem', '');
  mod3dPainelDaMalha.contagem = contagem;
  corpo.appendChild(contagem);

  corpo.appendChild(
    mod3dLinhaDeBotoesDaMalha([
        { rotulo: 'Tudo', titulo: 'Selecionar tudo (Ctrl+A)', acao: mod3dSelecionarTudoNaMalha },
        {
          rotulo: 'Nada',
          titulo: 'Limpar a seleção',
          acao: () => mod3dAplicarDominioDaMalha(new Set()),
        },
        {
          rotulo: 'Inverter',
          titulo: 'Inverter a seleção (Ctrl+I)',
          acao: mod3dInverterSelecaoDeMalha,
        },
        {
          rotulo: 'Ligados',
          titulo: 'Selecionar o pedaço ligado (L)',
          acao: mod3dSelecionarLigadosNaMalha,
        },
        { rotulo: 'Crescer', titulo: 'Crescer a seleção (])', acao: mod3dCrescerSelecaoDeMalha },
        { rotulo: 'Encolher', titulo: 'Encolher a seleção ([)', acao: mod3dEncolherSelecaoDeMalha },
    ]),
  );
  corpo.appendChild(
    mod3dNo('div', 'mod3d-malha-dica', mod3dTexto('Ctrl+arrastar: caixa · Alt+arrastar: laço')),
  );

  const medidas = mod3dNo('div', 'mod3d-linha');
  medidas.appendChild(
    mod3dCampoDaMalha(
      'distancia',
      mod3dTexto('Distância'),
      0.05,
      mod3dMetroParaTela(MOD3D_DISTANCIA_PADRAO_DA_MALHA),
    ),
  );
  medidas.appendChild(
    mod3dCampoDaMalha('fator', mod3dTexto('Fator'), 0.05, MOD3D_FATOR_PADRAO_DA_MALHA),
  );
  medidas.appendChild(
    mod3dCampoDaMalha('angulo', mod3dTexto('Ângulo'), 1, MOD3D_ANGULO_SUAVE_PADRAO),
  );
  medidas.appendChild(
    mod3dCampoDaMalha('solda', mod3dTexto('Solda'), 0.001, mod3dMetroParaTela(MOD3D_SOLDA_PADRAO)),
  );
  corpo.appendChild(medidas);

  corpo.appendChild(
    mod3dLinhaDeBotoesDaMalha([
        {
          rotulo: 'Extrudar',
          titulo: 'Extrudar a seleção (E)',
          acao: () =>
          mod3dExtrudarSelecao(mod3dMedidaDaMalha('distancia', MOD3D_DISTANCIA_PADRAO_DA_MALHA)),
        },
        {
          rotulo: 'Inserir face',
          titulo: 'Inserir face para dentro (I)',
          acao: () =>
          mod3dInserirFaceNaSelecao(mod3dValorDaMalha('fator', MOD3D_FATOR_PADRAO_DA_MALHA)),
        },
        {
          rotulo: 'Chanfrar',
          titulo: 'Chanfrar os vértices (B)',
          acao: () =>
          mod3dChanfrarSelecao(mod3dMedidaDaMalha('distancia', MOD3D_DISTANCIA_PADRAO_DA_MALHA)),
        },
        { rotulo: 'Subdividir', titulo: 'Subdividir as faces (S)', acao: mod3dSubdividirSelecao },
        {
          rotulo: 'Corte em anel',
          titulo: 'Cortar o anel de quads (K)',
          acao: mod3dCortarAnelNaSelecao,
        },
        { rotulo: 'Ponte', titulo: 'Ponte entre duas bordas (P)', acao: mod3dPontearSelecao },
        {
          rotulo: 'Girar aresta',
          titulo: 'Girar a aresta entre duas faces (T)',
          acao: mod3dGirarArestaNaSelecao,
        },
        {
          rotulo: 'Fundir',
          titulo: 'Fundir vértices por distância (M)',
          acao: () => mod3dFundirSelecao(mod3dMedidaDaMalha('solda', MOD3D_SOLDA_PADRAO)),
        },
        { rotulo: 'Preencher', titulo: 'Preencher buraco (H)', acao: mod3dPreencherBuracoNaSelecao },
        {
          rotulo: 'Apagar',
          titulo: 'Apagar as faces da seleção (Delete)',
          acao: mod3dApagarSelecaoDeMalha,
        },
    ]),
  );

  corpo.appendChild(mod3dMontarMoverDaMalha());
  corpo.appendChild(mod3dMontarEspelhoDaMalha());

  corpo.appendChild(
    mod3dLinhaDeBotoesDaMalha([
        {
          rotulo: 'Plana',
          titulo: 'Sombreamento plano',
          acao: () => mod3dSombrearMalhaDaEdicao('plano'),
        },
        {
          rotulo: 'Suave',
          titulo: 'Sombreamento suave',
          acao: () => mod3dSombrearMalhaDaEdicao('suave'),
        },
        {
          rotulo: 'Por ângulo',
          titulo: 'Suavizar até o ângulo escolhido',
          acao: () =>
          mod3dSombrearMalhaDaEdicao(
            'angulo',
            mod3dValorDaMalha('angulo', MOD3D_ANGULO_SUAVE_PADRAO),
          ),
        },
        {
          rotulo: 'Para fora',
          titulo: 'Recalcular as normais para fora',
          acao: mod3dRecalcularNormaisDaEdicao,
        },
        {
          rotulo: 'Inverter normais',
          titulo: 'Inverter as normais',
          acao: mod3dInverterNormaisDaEdicao,
        },
    ]),
  );

  corpo.appendChild(
    mod3dLinhaDeBotoesDaMalha([
        {
          rotulo: 'Verificar',
          titulo: 'Procurar problemas na malha',
          acao: mod3dVerificarMalhaDaEdicao,
        },
        {
          rotulo: 'Corrigir',
          titulo: 'Corrigir os problemas encontrados',
          acao: mod3dCorrigirMalhaDaEdicao,
        },
    ]),
  );
  const avisos = mod3dNo('div', 'mod3d-avisos');
  mod3dPainelDaMalha.avisos = avisos;
  corpo.appendChild(avisos);
  const recado = mod3dNo('div', 'mod3d-malha-recado', '');
  mod3dPainelDaMalha.recado = recado;
  corpo.appendChild(recado);

  mod3dPintarPainelDaMalha();
  return caixa;
}

function mod3dPintarAvisosDaMalha() {
  const caixa = mod3dPainelDaMalha.avisos;
  if (!caixa) return;
  caixa.textContent = '';
  const relatorio = mod3dEdicao.relatorio;
  if (!relatorio) return;
  if (relatorio.limpo) {
    caixa.appendChild(mod3dNo('div', 'mod3d-aviso-limpo', mod3dTexto('Malha limpa')));
    return;
  }
  mod3dLinhasDaVerificacao(relatorio).forEach((linha) => {
      const item = mod3dNo('div', 'mod3d-aviso');
      item.appendChild(mod3dNo('span', 'mod3d-aviso-nome', mod3dTexto(linha.rotulo)));
      item.appendChild(mod3dNo('b', 'mod3d-aviso-total', String(linha.total)));
      caixa.appendChild(item);
  });
}

function mod3dPintarPainelDaMalha() {
  const painel = mod3dPainelDaMalha;
  if (!painel.caixa) return;
  const ativo = mod3dEdicaoAtiva();
  const no = mod3dNoDaEdicao();
  const malha = mod3dMalhaDaEdicao();
  const assinatura = ativo
  ? `${no.id}|${no.versao}|${malha.versao}|${mod3dEdicao.versao}`
  : `fora|${mod3dNoSelecionado() ? mod3dNoSelecionado().id : ''}`;
  if (assinatura === painel.assinatura) return;
  painel.assinatura = assinatura;
  painel.caixa.classList.toggle('on', ativo);
  if (painel.entrar) {
    painel.entrar.textContent = mod3dTexto(ativo ? 'Sair da edição' : 'Editar malha');
    painel.entrar.disabled = !ativo && !mod3dNoSelecionado();
  }
  painel.modos.forEach((item) => {
      item.botao.classList.toggle('on', ativo && mod3dEdicao.modo === item.chave);
  });
  painel.botoes.forEach((item) => {
      if (!item.livre) item.botao.disabled = !ativo;
  });
  if (painel.eixo) painel.eixo.disabled = !ativo;
  if (painel.soldar) painel.soldar.disabled = !ativo;
  if (painel.trio) painel.trio.forEach((campo) => (campo.disabled = !ativo));
  const resumo = ativo ? mod3dResumoDaEdicao() : null;
  if (painel.resumo) {
    painel.resumo.textContent = resumo
    ? `${resumo.estatisticas.vertices} v · ${resumo.estatisticas.faces} f`
    : mod3dTexto('fora da edição');
  }
  if (painel.contagem) {
    painel.contagem.textContent = resumo
    ? `${resumo.vertices} ${mod3dTexto('vértices')} · ${resumo.arestas} ${mod3dTexto('arestas')} · ${resumo.faces} ${mod3dTexto('faces')}`
    : mod3dTexto('Escolha uma forma para editar');
  }
  if (painel.recado) painel.recado.textContent = mod3dTexto(mod3dEdicao.recado || '');
  mod3dPintarAvisosDaMalha();
}

function mod3dPontosDaMalhaNoMundo(no, malha) {
  const chave = `${no.id}|${no.versao}|${malha.versao}`;
  if (mod3dPainelDaMalha.mundo && mod3dPainelDaMalha.mundo.chave === chave) {
    return mod3dPainelDaMalha.mundo;
  }
  const mundo = mod3dMundoDoNo(no);
  if (!mundo || !mundo.mat) return null;
  const total = mod3dMalhaEdTotalDeVertices(malha);
  const pontos = new Float64Array(total * 3);
  const minimo = [Infinity, Infinity, Infinity];
  const maximo = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < total; i++) {
    const local = [
      malha.pos[i * 3] - no.pivo[0],
      malha.pos[i * 3 + 1] - no.pivo[1],
      malha.pos[i * 3 + 2] - no.pivo[2],
    ];
    const ponto = mod3dPontoPorMat(mundo.mat, local);
    for (let eixo = 0; eixo < 3; eixo++) {
      pontos[i * 3 + eixo] = ponto[eixo];
      if (ponto[eixo] < minimo[eixo]) minimo[eixo] = ponto[eixo];
      if (ponto[eixo] > maximo[eixo]) maximo[eixo] = ponto[eixo];
    }
  }
  let lado = 1;
  if (total) {
    lado = Math.max(maximo[0] - minimo[0], maximo[1] - minimo[1], maximo[2] - minimo[2], 0.01);
  }
  mod3dPainelDaMalha.mundo = { chave, pontos, total, cruz: lado * MOD3D_CRUZ_DO_VERTICE };
  return mod3dPainelDaMalha.mundo;
}

function mod3dPontoDoMundo(dados, indice) {
  return [dados.pontos[indice * 3], dados.pontos[indice * 3 + 1], dados.pontos[indice * 3 + 2]];
}

function mod3dCruzNoPonto(linhas, ponto, raio, cor) {
  for (let eixo = 0; eixo < 3; eixo++) {
    const de = ponto.slice();
    const para = ponto.slice();
    de[eixo] -= raio;
    para[eixo] += raio;
    mod3dPorSegmento(linhas, de, para, cor);
  }
}

function mod3dLimparMalhaDoPalco(render) {
  render.definirLinhas('edicao:aresta', null);
  render.definirLinhas('edicao:sel', null);
  render.definirLinhas('edicao:vertice', null);
  mod3dPainelDaMalha.pintado = '';
  mod3dPainelDaMalha.mundo = null;
}

function mod3dPintarMalhaNoPalco() {
  const render = mod3dCena.renderizador;
  if (!render) return;
  const no = mod3dNoDaEdicao();
  const malha = mod3dMalhaDaEdicao();
  if (!no || !malha) {
    if (mod3dPainelDaMalha.pintado) mod3dLimparMalhaDoPalco(render);
    return;
  }
  const dados = mod3dPontosDaMalhaNoMundo(no, malha);
  if (!dados) return;
  let soma = 0;
  mod3dEdicao.vertices.forEach((vertice) => {
      soma += vertice + 1;
  });
  mod3dEdicao.faces.forEach((face) => {
      soma += (face + 1) * 7;
  });
  const assinatura = `${dados.chave}|${mod3dEdicao.modo}|${mod3dEdicao.vertices.size}|${mod3dEdicao.arestas.size}|${mod3dEdicao.faces.size}|${soma}`;
  if (assinatura === mod3dPainelDaMalha.pintado) return;
  mod3dPainelDaMalha.pintado = assinatura;
  const adj = mod3dMalhaEdAdjacencia(malha);
  const fio = mod3dLinhasVazias();
  const escolha = mod3dLinhasVazias();
  const pontas = mod3dLinhasVazias();
  const cheio = adj.arestas.size <= MOD3D_TETO_DAS_LINHAS_DA_MALHA;
  adj.arestas.forEach((aresta, chave) => {
      const de = mod3dPontoDoMundo(dados, aresta.a);
      const para = mod3dPontoDoMundo(dados, aresta.b);
      if (mod3dEdicao.arestas.has(chave)) {
        mod3dPorSegmento(escolha, de, para, MOD3D_CORES_DA_MALHA.escolhida);
        return;
      }
      if (aresta.faces.length !== 2) {
        mod3dPorSegmento(fio, de, para, MOD3D_CORES_DA_MALHA.borda);
        return;
      }
      if (cheio) mod3dPorSegmento(fio, de, para, MOD3D_CORES_DA_MALHA.aresta);
  });
  if (mod3dEdicao.modo === 'vertice' && dados.total <= MOD3D_TETO_DOS_PONTOS_DA_MALHA) {
    for (let i = 0; i < dados.total; i++) {
      const escolhido = mod3dEdicao.vertices.has(i);
      mod3dCruzNoPonto(
        escolhido ? pontas : fio,
        mod3dPontoDoMundo(dados, i),
        dados.cruz * (escolhido ? 2 : 1),
        escolhido ? MOD3D_CORES_DA_MALHA.ponta : MOD3D_CORES_DA_MALHA.vertice,
      );
    }
  }
  const desenhar = (nome, linhas, ordem) => {
    if (!linhas.pos.length) {
      render.definirLinhas(nome, null);
      return;
    }
    const pronto = mod3dFecharLinhas(linhas);
    render.definirLinhas(nome, { pos: pronto.pos, cores: pronto.cores, ordem });
  };
  desenhar('edicao:aresta', fio, 3);
  desenhar('edicao:sel', escolha, 5);
  desenhar('edicao:vertice', pontas, 6);
}

function mod3dModoPorTeclaDaMalha(tecla) {
  if (tecla === '1') return 'vertice';
  if (tecla === '2') return 'aresta';
  if (tecla === '3') return 'face';
  return '';
}

function mod3dEdicaoAoTeclar(evento) {
  const tecla = String(evento.key || '').toLowerCase();
  if (evento.altKey && tecla === 'e' && !evento.ctrlKey && !evento.metaKey) {
    mod3dAlternarEdicao();
    return true;
  }
  if (!mod3dEdicaoAtiva()) return false;
  if (evento.altKey && tecla === 's' && !evento.ctrlKey && !evento.metaKey) {
    runShrinkFattenOnSelection(mod3dMedidaDaMalha('distancia', MOD3D_DISTANCIA_PADRAO_DA_MALHA));
    return true;
  }
  if (tecla === 'tab' && !evento.ctrlKey && !evento.metaKey && !evento.altKey) {
    mod3dSairDaEdicao();
    return true;
  }
  if (evento.altKey) {
    const modo = mod3dModoPorTeclaDaMalha(tecla);
    if (!modo) return false;
    mod3dDefinirModoDeMalha(modo);
    return true;
  }
  if (evento.ctrlKey || evento.metaKey) {
    if (evento.shiftKey) return false;
    if (tecla === 'a') {
      mod3dSelecionarTudoNaMalha();
      return true;
    }
    if (tecla === 'i') {
      mod3dInverterSelecaoDeMalha();
      return true;
    }
    return false;
  }
  if (tecla === 'escape') {
    mod3dSairDaEdicao();
    return true;
  }
  if (tecla === ']') {
    mod3dCrescerSelecaoDeMalha();
    return true;
  }
  if (tecla === '[') {
    mod3dEncolherSelecaoDeMalha();
    return true;
  }
  if (tecla === 'l') {
    mod3dSelecionarLigadosNaMalha();
    return true;
  }
  if (tecla === 'e') {
    meshExtrudeModal.start(mod3dMedidaDaMalha('distancia', MOD3D_DISTANCIA_PADRAO_DA_MALHA));
    return true;
  }
  if (tecla === 'i') {
    mod3dInserirFaceNaSelecao(mod3dValorDaMalha('fator', MOD3D_FATOR_PADRAO_DA_MALHA));
    return true;
  }
  if (tecla === 'b') {
    mod3dChanfrarSelecao(mod3dMedidaDaMalha('distancia', MOD3D_DISTANCIA_PADRAO_DA_MALHA));
    return true;
  }
  if (tecla === 's') {
    mod3dSubdividirSelecao();
    return true;
  }
  if (tecla === 'k') {
    mod3dCortarAnelNaSelecao();
    return true;
  }
  if (tecla === 'p') {
    mod3dPontearSelecao();
    return true;
  }
  if (tecla === 't') {
    mod3dGirarArestaNaSelecao();
    return true;
  }
  if (tecla === 'm') {
    mod3dFundirSelecao(mod3dMedidaDaMalha('solda', MOD3D_SOLDA_PADRAO));
    return true;
  }
  if (tecla === 'h') {
    mod3dPreencherBuracoNaSelecao();
    return true;
  }
  if (tecla === 'delete' || tecla === 'backspace') {
    mod3dApagarSelecaoDeMalha();
    return true;
  }
  return false;
}
