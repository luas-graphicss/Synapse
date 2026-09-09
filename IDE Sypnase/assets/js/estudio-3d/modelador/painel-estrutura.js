'use strict';

const MOD3D_SINAL_VISIVEL = '◉';
const MOD3D_SINAL_ESCONDIDO = '○';
const MOD3D_SINAL_TRAVADO = '■';
const MOD3D_SINAL_LIVRE = '□';
const MOD3D_EIXOS_DOS_CAMPOS = Object.freeze(['X', 'Y', 'Z']);

const mod3dPainelDaCena = {
  caixa: null,
  arvore: null,
  propriedades: null,
  resumo: null,
  assinatura: '',
  entradas: null,
  botoes: null,
  modos: null,
  encaixe: null,
};

function mod3dPainelBotao(rotulo, titulo, classe) {
  const botao = mod3dNo('button', classe || 'mod3d-botao', mod3dTexto(rotulo));
  botao.type = 'button';
  botao.title = mod3dTexto(titulo || rotulo);
  return botao;
}

function mod3dPainelNumero(rotulo, passo) {
  const caixa = mod3dNo('label', 'mod3d-numero');
  caixa.appendChild(mod3dNo('span', 'mod3d-numero-rotulo', rotulo));
  const entrada = document.createElement('input');
  entrada.className = 'mod3d-numero-campo';
  entrada.type = 'number';
  entrada.step = String(passo || 0.1);
  entrada.value = '0';
  caixa.appendChild(entrada);
  return { caixa, entrada };
}

function mod3dUnidadeDoPainel() {
  if (typeof mod3dUnidadeDaCena === 'function') return mod3dUnidadeDaCena();
  return { f: 1, label: 'm' };
}

function mod3dMetroParaTela(metros) {
  const unidade = mod3dUnidadeDoPainel();
  const valor = (Number(metros) || 0) / (unidade.f || 1);
  return Math.round(valor * 10000) / 10000;
}

function mod3dTelaParaMetro(valor) {
  const unidade = mod3dUnidadeDoPainel();
  return (Number(valor) || 0) * (unidade.f || 1);
}

function mod3dTrioDeCampos(rotulo, campo, passo) {
  const linha = mod3dNo('div', 'mod3d-trio');
  linha.appendChild(mod3dNo('span', 'mod3d-trio-rotulo', rotulo));
  const entradas = [];
  MOD3D_EIXOS_DOS_CAMPOS.forEach((eixo, indice) => {
      const numero = mod3dPainelNumero(eixo, passo);
      numero.entrada.dataset.campo = campo;
      numero.entrada.dataset.indice = String(indice);
      linha.appendChild(numero.caixa);
      entradas.push(numero.entrada);
  });
  return { linha, entradas };
}

function mod3dValorDoCampoNaTela(no, campo, indice) {
  if (campo === 'rot') return Math.round(no.rot[indice] * 1000) / 1000;
  if (campo === 'esc') return Math.round(no.esc[indice] * 10000) / 10000;
  if (campo === 'pivo') return mod3dMetroParaTela(no.pivo[indice]);
  return mod3dMetroParaTela(no.pos[indice]);
}

function mod3dAplicarCampoDoPainel(entrada) {
  const no = mod3dNoSelecionado();
  if (!no) return;
  const campo = entrada.dataset.campo;
  const indice = Number(entrada.dataset.indice) || 0;
  const bruto = Number(entrada.value);
  if (!isFinite(bruto)) return;
  const valor = campo === 'pos' || campo === 'pivo' ? mod3dTelaParaMetro(bruto) : bruto;
  mod3dDefinirCampoDoNo(no.id, campo, indice, valor);
}

function mod3dMontarFerramentasDaCena() {
  const barra = mod3dNo('div', 'mod3d-ferramentas');
  const tipos = document.createElement('select');
  tipos.className = 'mod3d-seletor mod3d-seletor-curto';
  tipos.title = mod3dTexto('Primitiva para adicionar');
  MOD3D_ORDEM_DAS_PRIMITIVAS.forEach((chave) => {
      const item = document.createElement('option');
      item.value = chave;
      item.textContent = mod3dTexto(MOD3D_PRIMITIVAS[chave].rotulo);
      tipos.appendChild(item);
  });
  const adicionar = mod3dPainelBotao(
    'Adicionar',
    'Criar a primitiva escolhida',
    'mod3d-botao mod3d-botao-forte',
  );
  adicionar.addEventListener('click', () => mod3dAdicionarPrimitiva(tipos.value));
  const duplicar = mod3dPainelBotao('Duplicar', 'Duplicar a seleção (Ctrl+D)');
  duplicar.addEventListener('click', () => mod3dDuplicarSelecao());
  const agrupar = mod3dPainelBotao('Agrupar', 'Juntar a seleção em um grupo');
  agrupar.addEventListener('click', () => mod3dAgruparSelecao());
  const apagar = mod3dPainelBotao('Apagar', 'Apagar a seleção (Delete)');
  apagar.addEventListener('click', () => mod3dApagarSelecao());
  const desfazer = mod3dPainelBotao('Desfazer', 'Desfazer (Ctrl+Z)');
  desfazer.addEventListener('click', () => mod3dDesfazer());
  const refazer = mod3dPainelBotao('Refazer', 'Refazer (Ctrl+Shift+Z)');
  refazer.addEventListener('click', () => mod3dRefazer());
  [tipos, adicionar, duplicar, agrupar, apagar, desfazer, refazer].forEach((no) => {
      barra.appendChild(no);
  });
  return { barra, tipos, adicionar, duplicar, agrupar, apagar, desfazer, refazer };
}

function mod3dMontarModosDaCena() {
  const barra = mod3dNo('div', 'mod3d-ferramentas');
  const modos = new Map();
  MOD3D_MODOS_DE_TRANSFORMAR.forEach((modo) => {
      const botao = mod3dPainelBotao(modo.rotulo, `${modo.rotulo} (${modo.tecla})`);
      botao.addEventListener('click', () => {
          mod3dDefinirModo(modo.chave);
          mod3dCenaTocar();
      });
      modos.set(modo.chave, botao);
      barra.appendChild(botao);
  });
  const espaco = mod3dPainelBotao('Global', 'Alternar eixo global e local (X)');
  espaco.addEventListener('click', () => {
      mod3dDefinirEspaco(mod3dTransf.espaco === 'global' ? 'local' : 'global');
      mod3dCenaTocar();
  });
  barra.appendChild(espaco);

  const marca = mod3dNo('label', 'mod3d-check');
  const ligado = document.createElement('input');
  ligado.type = 'checkbox';
  ligado.checked = mod3dTransf.encaixe.ligado;
  ligado.addEventListener('change', () => {
      mod3dDefinirEncaixe({ ligado: ligado.checked });
      mod3dCenaTocar();
  });
  marca.appendChild(ligado);
  marca.appendChild(mod3dNo('span', '', mod3dTexto('Encaixar')));
  barra.appendChild(marca);

  const passo = mod3dPainelNumero(mod3dTexto('Grade'), 0.05);
  passo.entrada.addEventListener('change', () => {
      mod3dDefinirEncaixe({ passo: mod3dTelaParaMetro(passo.entrada.value) });
      mod3dCenaTocar();
  });
  const angulo = mod3dPainelNumero(mod3dTexto('Ângulo'), 1);
  angulo.entrada.addEventListener('change', () => {
      mod3dDefinirEncaixe({ angulo: angulo.entrada.value });
      mod3dCenaTocar();
  });
  const escala = mod3dPainelNumero(mod3dTexto('Escala'), 0.05);
  escala.entrada.addEventListener('change', () => {
      mod3dDefinirEncaixe({ escala: escala.entrada.value });
      mod3dCenaTocar();
  });
  [passo, angulo, escala].forEach((campo) => barra.appendChild(campo.caixa));
  return {
    barra,
    modos,
    espaco,
    ligado,
    passo: passo.entrada,
    angulo: angulo.entrada,
    escala: escala.entrada,
  };
}

function mod3dLinhaDaArvore(item) {
  const no = item.no;
  const linha = mod3dNo('div', 'mod3d-no');
  if (mod3dGrafo.selecao.indexOf(no.id) >= 0) linha.classList.add('on');
  linha.style.paddingLeft = `${6 + item.nivel * 14}px`;

  const olho = mod3dNo(
    'button',
    'mod3d-no-sinal',
    no.visivel ? MOD3D_SINAL_VISIVEL : MOD3D_SINAL_ESCONDIDO,
  );
  olho.type = 'button';
  olho.title = mod3dTexto(no.visivel ? 'Esconder o objeto' : 'Mostrar o objeto');
  olho.addEventListener('click', (evento) => {
      evento.stopPropagation();
      mod3dAlternarVisivelDoNo(no.id);
  });

  const trava = mod3dNo(
    'button',
    'mod3d-no-sinal',
    no.travado ? MOD3D_SINAL_TRAVADO : MOD3D_SINAL_LIVRE,
  );
  trava.type = 'button';
  trava.title = mod3dTexto(no.travado ? 'Destravar o objeto' : 'Travar o objeto');
  trava.addEventListener('click', (evento) => {
      evento.stopPropagation();
      mod3dAlternarTravaDoNo(no.id);
  });

  const nome = mod3dNo('span', 'mod3d-no-nome', no.nome);
  nome.title = mod3dTexto('Clique duplo para renomear');
  nome.addEventListener('dblclick', (evento) => {
      evento.stopPropagation();
      const entrada = document.createElement('input');
      entrada.className = 'mod3d-no-entrada';
      entrada.type = 'text';
      entrada.value = no.nome;
      entrada.addEventListener('keydown', (tecla) => {
          if (tecla.key === 'Enter') entrada.blur();
          if (tecla.key === 'Escape') {
            entrada.value = no.nome;
            entrada.blur();
          }
      });
      entrada.addEventListener('blur', () => {
          mod3dDefinirNomeDoNo(no.id, entrada.value);
          mod3dPintarPainelDaCena();
      });
      linha.replaceChild(entrada, nome);
      entrada.focus();
      entrada.select();
  });

  const tipo = mod3dNo('span', 'mod3d-no-tipo', mod3dTexto(mod3dRotuloDoTipo(no.tipo)));
  linha.appendChild(olho);
  linha.appendChild(trava);
  linha.appendChild(nome);
  linha.appendChild(tipo);
  linha.addEventListener('click', () => {
      mod3dSelecionarNos([no.id]);
      mod3dCenaTocar();
  });
  return linha;
}

function mod3dRotuloDoTipo(tipo) {
  if (tipo === 'grupo') return 'Grupo';
  if (tipo === 'malha') return 'Malha';
  return MOD3D_PRIMITIVAS[tipo] ? MOD3D_PRIMITIVAS[tipo].rotulo : tipo;
}

function mod3dPintarArvore() {
  const arvore = mod3dPainelDaCena.arvore;
  if (!arvore) return;
  arvore.textContent = '';
  const itens = mod3dNosEmOrdem();
  if (!itens.length) {
    arvore.appendChild(mod3dNo('div', 'mod3d-arvore-vazia', mod3dTexto('Cena vazia')));
    return;
  }
  itens.forEach((item) => arvore.appendChild(mod3dLinhaDaArvore(item)));
}

function mod3dMontarPropriedades(no) {
  const caixa = mod3dPainelDaCena.propriedades;
  caixa.textContent = '';
  mod3dPainelDaCena.entradas = null;
  if (!no) {
    caixa.appendChild(
      mod3dNo('div', 'mod3d-arvore-vazia', mod3dTexto('Nenhum objeto selecionado')),
    );
    return;
  }
  const unidade = mod3dUnidadeDoPainel().label;
  const posicao = mod3dTrioDeCampos(`${mod3dTexto('Posição')} (${unidade})`, 'pos', 0.05);
  const giro = mod3dTrioDeCampos(`${mod3dTexto('Rotação')} (°)`, 'rot', 1);
  const escala = mod3dTrioDeCampos(mod3dTexto('Escala'), 'esc', 0.05);
  const pivo = mod3dTrioDeCampos(`${mod3dTexto('Pivô')} (${unidade})`, 'pivo', 0.05);
  [posicao, giro, escala, pivo].forEach((trio) => {
      caixa.appendChild(trio.linha);
      trio.entradas.forEach((entrada) => {
          entrada.addEventListener('change', () => mod3dAplicarCampoDoPainel(entrada));
      });
  });

  const acoesDoPivo = mod3dNo('div', 'mod3d-ferramentas');
  const centrar = mod3dPainelBotao('Centralizar pivô', 'Põe o pivô no centro da malha');
  centrar.addEventListener('click', () => mod3dCentralizarPivoDoNo(no.id, false));
  const apoiar = mod3dPainelBotao('Pivô na base', 'Apoia o pivô na base da malha');
  apoiar.addEventListener('click', () => mod3dCentralizarPivoDoNo(no.id, true));
  acoesDoPivo.appendChild(centrar);
  acoesDoPivo.appendChild(apoiar);
  caixa.appendChild(acoesDoPivo);

  const params = [];
  const campos = mod3dCamposDaPrimitiva(no.tipo);
  if (campos.length) {
    const linha = mod3dNo('div', 'mod3d-trio mod3d-trio-largo');
    linha.appendChild(mod3dNo('span', 'mod3d-trio-rotulo', mod3dTexto('Parâmetros')));
    campos.forEach((campo) => {
        const medida = campo.tipo === 'medida';
        const nome = medida ? `${mod3dTexto(campo.rotulo)} (${unidade})` : mod3dTexto(campo.rotulo);
        const numero = mod3dPainelNumero(nome, medida ? 0.05 : 1);
        numero.entrada.addEventListener('change', () => {
            const bruto = Number(numero.entrada.value);
            if (!isFinite(bruto)) return;
            mod3dDefinirParametroDoNo(no.id, campo.chave, medida ? mod3dTelaParaMetro(bruto) : bruto);
        });
        linha.appendChild(numero.caixa);
        params.push({ campo, entrada: numero.entrada });
    });
    caixa.appendChild(linha);
  }

  const linhaDoPai = mod3dNo('div', 'mod3d-trio');
  linhaDoPai.appendChild(mod3dNo('span', 'mod3d-trio-rotulo', mod3dTexto('Pai')));
  const pais = document.createElement('select');
  pais.className = 'mod3d-seletor mod3d-seletor-curto';
  const semPai = document.createElement('option');
  semPai.value = '';
  semPai.textContent = mod3dTexto('Raiz da cena');
  pais.appendChild(semPai);
  mod3dNosEmOrdem().forEach((item) => {
      if (item.no.id === no.id || !mod3dPodeSerPaiDoNo(no.id, item.no.id)) return;
      const opcao = document.createElement('option');
      opcao.value = item.no.id;
      opcao.textContent = item.no.nome;
      pais.appendChild(opcao);
  });
  pais.value = no.pai;
  pais.addEventListener('change', () => {
      mod3dMudarNoComHistorico(no.id, mod3dTexto('Reparentar'), (alvo) => {
          alvo.pai = pais.value;
      });
  });
  linhaDoPai.appendChild(pais);
  caixa.appendChild(linhaDoPai);

  mod3dPainelDaCena.entradas = {
    id: no.id,
    pos: posicao.entradas,
    rot: giro.entradas,
    esc: escala.entradas,
    pivo: pivo.entradas,
    params,
    pais,
  };
}

function mod3dPintarPropriedades() {
  const no = mod3dNoSelecionado();
  const unidade = mod3dUnidadeDoPainel().label;
  const assinatura = no ? `${no.id}:${no.tipo}:${unidade}` : `vazio:${unidade}`;
  if (assinatura !== mod3dPainelDaCena.assinatura) {
    mod3dPainelDaCena.assinatura = assinatura;
    mod3dMontarPropriedades(no);
  }
  const entradas = mod3dPainelDaCena.entradas;
  if (!no || !entradas) return;
  const ativo = document.activeElement;
  ['pos', 'rot', 'esc', 'pivo'].forEach((campo) => {
      entradas[campo].forEach((entrada, indice) => {
          if (entrada === ativo) return;
          entrada.value = String(mod3dValorDoCampoNaTela(no, campo, indice));
          entrada.disabled = no.travado;
      });
  });
  entradas.params.forEach((peca) => {
      if (peca.entrada === ativo) return;
      const bruto = no.params[peca.campo.chave];
      const valor = peca.campo.tipo === 'medida' ? mod3dMetroParaTela(bruto) : bruto;
      peca.entrada.value = String(valor);
      peca.entrada.disabled = no.travado;
  });
  if (entradas.pais !== ativo) entradas.pais.value = no.pai;
}

function mod3dPintarResumoDaCena() {
  if (!mod3dPainelDaCena.resumo) return;
  const resumo = mod3dCenaResumo();
  const historico = mod3dHistoricoEstado();
  const no = mod3dNoSelecionado();
  const partes = [
    `${resumo.nos} ${mod3dTexto('objetos')}`,
    `${resumo.triangulos} ${mod3dTexto('triângulos')}`,
    `${historico.passos} ${mod3dTexto('passos')}`,
  ];
  if (no) partes.push(no.nome);
  mod3dPainelDaCena.resumo.textContent = partes.join(' · ');
}

function mod3dPintarPainelDaCena() {
  if (!mod3dPainelDaCena.caixa) return;
  const historico = mod3dHistoricoEstado();
  const botoes = mod3dPainelDaCena.botoes;
  const temSelecao = mod3dGrafo.selecao.length > 0;
  if (botoes) {
    botoes.duplicar.disabled = !temSelecao;
    botoes.apagar.disabled = !temSelecao;
    botoes.agrupar.disabled = !temSelecao;
    botoes.desfazer.disabled = !historico.podeDesfazer;
    botoes.refazer.disabled = !historico.podeRefazer;
    botoes.desfazer.title = historico.podeDesfazer
    ? `${mod3dTexto('Desfazer')}: ${mod3dTexto(historico.rotuloDesfazer)}`
    : mod3dTexto('Nada para desfazer');
    botoes.refazer.title = historico.podeRefazer
    ? `${mod3dTexto('Refazer')}: ${mod3dTexto(historico.rotuloRefazer)}`
    : mod3dTexto('Nada para refazer');
  }
  const modos = mod3dPainelDaCena.modos;
  if (modos) {
    modos.modos.forEach((botao, chave) => {
        botao.classList.toggle('on', mod3dTransf.modo === chave);
    });
    modos.espaco.textContent = mod3dTexto(mod3dTransf.espaco === 'global' ? 'Global' : 'Local');
    modos.ligado.checked = mod3dTransf.encaixe.ligado;
    const ativo = document.activeElement;
    if (modos.passo !== ativo)
    modos.passo.value = String(mod3dMetroParaTela(mod3dTransf.encaixe.passo));
    if (modos.angulo !== ativo) modos.angulo.value = String(mod3dTransf.encaixe.angulo);
    if (modos.escala !== ativo) modos.escala.value = String(mod3dTransf.encaixe.escala);
  }
  mod3dPintarArvore();
  mod3dPintarPropriedades();
  mod3dPintarResumoDaCena();
}

function mod3dMontarPainelDaCena() {
  const painel = mod3dNo('section', 'mod3d-painel');
  const titulo = mod3dNo('h2', 'mod3d-painel-titulo', mod3dTexto('Cena'));
  const resumo = mod3dNo('span', 'mod3d-painel-resumo', '');
  titulo.appendChild(resumo);
  painel.appendChild(titulo);

  const botoes = mod3dMontarFerramentasDaCena();
  const modos = mod3dMontarModosDaCena();
  painel.appendChild(botoes.barra);
  painel.appendChild(modos.barra);

  const corpo = mod3dNo('div', 'mod3d-painel-corpo');
  const arvore = mod3dNo('div', 'mod3d-arvore');
  const propriedades = mod3dNo('div', 'mod3d-propriedades');
  corpo.appendChild(arvore);
  corpo.appendChild(propriedades);
  painel.appendChild(corpo);

  mod3dPainelDaCena.caixa = painel;
  mod3dPainelDaCena.arvore = arvore;
  mod3dPainelDaCena.propriedades = propriedades;
  mod3dPainelDaCena.resumo = resumo;
  mod3dPainelDaCena.botoes = botoes;
  mod3dPainelDaCena.modos = modos;
  mod3dPainelDaCena.assinatura = '';
  mod3dPintarPainelDaCena();
  return painel;
}
