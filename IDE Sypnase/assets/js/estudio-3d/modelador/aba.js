'use strict';

const MOD3D_INTERVALO_DE_RECONEXAO = 1000;
const MOD3D_TEXTO_PROCURANDO = 'Procurando o editor…';
const MOD3D_TEXTO_LIGADO = 'Conectado ao editor';
const MOD3D_TEXTO_PERDIDO = 'Editor fora do ar — reconectando…';
const MOD3D_TEXTO_SEM_PROJETO = 'Nenhum projeto aberto no editor';
const MOD3D_LOADING_PROJECTS_TEXT = 'Carregando projetos do editor…';
const MOD3D_TEXTO_SEM_GRAVACAO = 'Nada gravado ainda';
const MOD3D_TEXTO_GRAVANDO = 'Gravando no projeto…';
const MOD3D_TEXTO_ENVIANDO = 'Enviando bloco';
const MOD3D_TEXTO_GRAVADO = 'Gravado';
const MOD3D_ERROS_DA_GRAVACAO = Object.freeze({
    'sem-editor': 'Editor fora de alcance — nada foi gravado',
    'sem-projeto': 'Escolha um projeto de destino',
    'cena-vazia': 'A cena está vazia — nada para gravar',
    'sem-resposta': 'O editor não respondeu a tempo — nada foi gravado',
    'sem-porta': 'Este editor não tem a porta de gravação',
    'projeto-sumiu': 'O projeto escolhido não está mais aberto no editor',
    'nome-invalido': 'Nome de arquivo inválido',
    'nome-ocupado': 'Já existem arquivos demais com esse nome',
    'grande-demais': 'Modelo grande demais para atravessar',
    travado: 'Arquivo travado por outro agente',
    resumo: 'O arquivo chegou corrompido — nada foi gravado',
    incompleto: 'A travessia ficou incompleta — nada foi gravado',
    empacotar: 'Não foi possível montar o .glb',
    falha: 'A gravação falhou',
});

let mod3dCanalDaAba = null;
let mod3dTela = null;
let mod3dProjetosDaAba = [];
let mod3dProjectListLoaded = false;
let mod3dDestino = '';
let mod3dJaLigou = false;
let mod3dProjectDocument = null;

function mod3dNo(tag, classe, texto) {
  const no = document.createElement(tag);
  if (classe) no.className = classe;
  if (texto !== undefined && texto !== null) no.textContent = texto;
  return no;
}

function mod3dCampo(rotulo, valor) {
  const caixa = mod3dNo('span', 'mod3d-campo');
  caixa.appendChild(mod3dNo('span', 'mod3d-campo-rotulo', rotulo));
  const forte = mod3dNo('b', 'mod3d-campo-valor', valor);
  caixa.appendChild(forte);
  return { caixa, valor: forte };
}

function mod3dTexto(frase) {
  try {
    if (window.SYNAPSE_I18N && typeof window.SYNAPSE_I18N.t === 'function') {
      return window.SYNAPSE_I18N.t(frase);
    }
  } catch (erro) {
    ignorarErro(erro, 'mod3dTexto');
  }
  return frase;
}

function mod3dMontarPainel() {
  const caixa = mod3dNo('div', 'mod3d-paineis');
  const projectPanel = mod3dCreateProjectPanel();
  caixa.appendChild(projectPanel.panel);
  caixa.appendChild(mod3dMontarPainelDaCena());
  caixa.appendChild(mod3dMontarPainelDaMalha());
  caixa.appendChild(mod3dMontarPainelDosMateriais());
  caixa.appendChild(mod3dMontarPainelDoUv());
  const exportPanel = mod3dCreateGlbExportPanel();
  mod3dCreateSourceOptions(exportPanel);
  caixa.appendChild(exportPanel.panel);
  return {
    painel: caixa,
    nome: exportPanel.filename,
    sobrescrever: exportPanel.overwrite,
    gravar: exportPanel.save,
    resultado: exportPanel.result,
    exportPanel,
    projectPanel,
  };
}

function mod3dMontarTela() {
  const boot = mod3dBoot() || {};
  document.body.classList.add('mod3d-corpo');

  const topo = mod3dNo('header', 'mod3d-topo');
  const marca = mod3dNo('div', 'mod3d-marca');
  marca.appendChild(mod3dNo('span', 'mod3d-marca-nome', 'Blepse 3D'));
  topo.appendChild(marca);

  const ligacao = mod3dNo('div', 'mod3d-ligacao');
  const ponto = mod3dNo('span', 'mod3d-ponto');
  const texto = mod3dNo('span', 'mod3d-ligacao-texto', MOD3D_TEXTO_PROCURANDO);
  ligacao.appendChild(ponto);
  ligacao.appendChild(texto);
  topo.appendChild(ligacao);

  const barra = mod3dNo('section', 'mod3d-barra');
  const rotulo = mod3dNo('label', 'mod3d-rotulo', 'Projeto de destino');
  rotulo.setAttribute('for', 'mod3dProjetos');
  const seletor = document.createElement('select');
  seletor.id = 'mod3dProjetos';
  seletor.className = 'mod3d-seletor';
  const atualizar = mod3dNo('button', 'mod3d-botao', 'Atualizar lista');
  atualizar.type = 'button';
  barra.appendChild(rotulo);
  barra.appendChild(seletor);
  barra.appendChild(atualizar);

  const painel = mod3dMontarPainel();

  const palco = mod3dNo('main', 'mod3d-palco');

  const rodape = mod3dNo('footer', 'mod3d-estado');
  const transporte = mod3dCampo('Transporte', '—');
  const sessao = mod3dCampo('Sessão', boot.sessao || '—');
  const protocolo = mod3dCampo('Protocolo', String(boot.proto || MOD3D_PROTO));
  const projetos = mod3dCampo('Projetos', '0');
  const atualizado = mod3dCampo('Atualizado', '—');
  [transporte, sessao, protocolo, projetos, atualizado].forEach((campo) => {
      rodape.appendChild(campo.caixa);
  });

  document.body.appendChild(topo);
  document.body.appendChild(barra);
  const workspace = mod3dNo('div', 'mod3d-workspace');
  workspace.append(painel.painel, palco);
  document.body.appendChild(workspace);
  document.body.appendChild(rodape);
  mod3dMontarViewport(palco);

  return {
    ponto,
    texto,
    seletor,
    atualizar,
    transporte,
    projetos,
    atualizado,
    nome: painel.nome,
    sobrescrever: painel.sobrescrever,
    gravar: painel.gravar,
    resultado: painel.resultado,
    exportPanel: painel.exportPanel,
    projectPanel: painel.projectPanel,
  };
}

function mod3dPintarEstado(estado) {
  if (!mod3dTela) return;
  const nome = estado.transporte ? MOD3D_NOMES_DOS_TRANSPORTES[estado.transporte] : '';
  mod3dTela.transporte.valor.textContent = nome || '—';
  mod3dTela.ponto.classList.toggle('on', estado.ligado === true);
  if (estado.ligado) {
    mod3dJaLigou = true;
    mod3dTela.texto.textContent = MOD3D_TEXTO_LIGADO;
    return;
  }
  mod3dTela.texto.textContent = mod3dJaLigou ? MOD3D_TEXTO_PERDIDO : MOD3D_TEXTO_PROCURANDO;
}

function mod3dGuardarDestino(id) {
  if (!id || id === mod3dDestino) return;
  mod3dDestino = id;
  mod3dGravarLocal(MOD3D_CHAVE_DO_DESTINO, id);
}

function mod3dPintarProjetos(lista) {
  if (!mod3dTela) return;
  if (Array.isArray(lista)) mod3dProjectListLoaded = true;
  mod3dProjetosDaAba = Array.isArray(lista) ? lista : [];
  const seletor = mod3dTela.seletor;
  const anterior = mod3dDestino || seletor.value;
  seletor.textContent = '';
  if (mod3dProjetosDaAba.length === 0) {
    const nenhum = document.createElement('option');
    nenhum.value = '';
    nenhum.textContent = mod3dProjectListLoaded
    ? MOD3D_TEXTO_SEM_PROJETO
    : MOD3D_LOADING_PROJECTS_TEXT;
    seletor.appendChild(nenhum);
    seletor.disabled = true;
  } else {
    mod3dProjetosDaAba.forEach((projeto) => {
        const item = document.createElement('option');
        item.value = projeto.id;
        const marca = projeto.ativo ? ' · ativo' : '';
        item.textContent = `${projeto.nome} · ${projeto.arquivos} arq.${marca}`;
        seletor.appendChild(item);
    });
    seletor.disabled = false;
    const escolhido = mod3dChooseOpenProject(mod3dProjetosDaAba, anterior);
    seletor.value = escolhido;
    mod3dGuardarDestino(escolhido);
  }
  mod3dTela.projetos.valor.textContent = String(mod3dProjetosDaAba.length);
  mod3dTela.atualizado.valor.textContent = new Date().toLocaleTimeString();
  if (mod3dTela.gravar) mod3dTela.gravar.disabled = mod3dGravando || seletor.disabled;
  mod3dViewportProjeto(seletor.value, mod3dCanalDaAba);
  if (mod3dProjectDocument) mod3dProjectDocument.syncProject(seletor.value);
}

function mod3dMostrarResultado(texto, estado) {
  if (!mod3dTela) return;
  mod3dTela.resultado.textContent = texto;
  mod3dTela.resultado.className = estado ? `mod3d-resultado ${estado}` : 'mod3d-resultado';
}

function mod3dTextoDoErro(resposta) {
  const frase = MOD3D_ERROS_DA_GRAVACAO[resposta.erro] || MOD3D_ERROS_DA_GRAVACAO.falha;
  const texto = mod3dTexto(frase);
  return resposta.detalhe ? `${texto} — ${resposta.detalhe}` : texto;
}

async function mod3dGravarCena() {
  return mod3dSaveGlbScene();
}

const mod3dEditorHost = modelerCreateEditorHost(MOD3D_JANELA_DE_PRESENCA);

function mod3dEditorInstanceOf(envelope) {
  return typeof envelope.instance === 'string' ? envelope.instance : '';
}

function mod3dProjectCountOf(envelope) {
  if (!envelope.dados || !Array.isArray(envelope.dados.lista)) return null;
  return envelope.dados.lista.length;
}

function mod3dReceberDoEditor(envelope, via) {
  const enviadoPor = mod3dEditorInstanceOf(envelope);
  if (!mod3dEditorHost.acceptsSender(enviadoPor, mod3dProjectCountOf(envelope))) return;
  if (mod3dProjectDocument && mod3dProjectDocument.receive(envelope, via)) return;
  if (envelope.tipo === 'gravar-ok' || envelope.tipo === 'gravar-erro') {
    mod3dPonteResposta(envelope);
    return;
  }
  if (envelope.tipo.indexOf('referencia-') === 0) {
    mod3dReferenciaResposta(envelope);
    return;
  }
  if (envelope.tipo.indexOf('textura-') === 0) {
    mod3dTexturaResposta(envelope);
    return;
  }
  if (envelope.tipo === 'imagens') {
    mod3dImagensDoProjetoRecebidas(envelope.dados);
    return;
  }
  if (envelope.tipo === 'unidades' || envelope.tipo === 'modelos') {
    mod3dViewportRecado(envelope);
    return;
  }
  if (envelope.tipo === 'ola-ok') {
    mod3dJaLigou = true;
    if (envelope.dados) mod3dPintarProjetos(envelope.dados.lista);
    if (mod3dDestino) mod3dPedirImagensDoProjeto(mod3dCanalDaAba, mod3dDestino);
    if (mod3dProjectDocument) mod3dCanalDaAba.enviar('document-ready', {});
    return;
  }
  if (envelope.tipo === 'projetos') {
    mod3dPintarProjetos(envelope.dados ? envelope.dados.lista : []);
    return;
  }
  if (envelope.tipo === 'editor-pronto' && mod3dCanalDaAba) {
    mod3dCanalDaAba.enviarPorTodos('ola', {});
  }
}

function mod3dIniciarAba() {
  const boot = mod3dBoot();
  if (!boot || mod3dTela) return;
  mod3dDestino = mod3dLerLocal(MOD3D_CHAVE_DO_DESTINO) || '';
  mod3dTela = mod3dMontarTela();
  mod3dPintarProjetos(null);
  mod3dCanalDaAba = mod3dCriarCanal({
      papel: 'modelador',
      sessao: boot.sessao,
      baterCoracao: true,
      aoReceber: mod3dReceberDoEditor,
      aoMudar: mod3dPintarEstado,
      onPresence: (enviadoPor) => mod3dEditorHost.markHostAlive(enviadoPor),
  });
  mod3dProjectDocument = mod3dCreateProjectDocument(
    mod3dCanalDaAba,
    mod3dTela.projectPanel,
    mod3dTela.exportPanel,
    boot,
  );
  window.MOD3D_PROJECT = mod3dProjectDocument;
  mod3dTela.seletor.addEventListener('change', async () => {
      const selected = mod3dTela.seletor.value;
      mod3dTela.seletor.value = mod3dDestino;
      await mod3dProjectDocument.chooseProject(selected);
  });
  mod3dTela.atualizar.addEventListener('click', () => {
      mod3dCanalDaAba.enviarPorTodos('projetos-pedido', {});
  });
  mod3dTela.gravar.addEventListener('click', () => {
      modelerPerformanceTimeExport(mod3dGravarCena).catch((erro) =>
        ignorarErro(erro, 'mod3dGravarCena'),
      );
  });
  mod3dCanalDaAba.enviarPorTodos('ola', {});
  setInterval(() => {
      if (!mod3dCanalDaAba.ligado()) {
        mod3dCanalDaAba.enviarPorTodos('ola', {});
        return;
      }
      if (!mod3dProjetosDaAba.length) mod3dCanalDaAba.enviarPorTodos('projetos-pedido', {});
    }, MOD3D_INTERVALO_DE_RECONEXAO);
  window.addEventListener('beforeunload', () => {
      mod3dCanalDaAba.enviar('adeus', {});
  });
  window.MOD3D_ABA = {
    canal: mod3dCanalDaAba,
    projetos: () => mod3dProjetosDaAba.slice(),
    destino: () => mod3dDestino,
    gravar: mod3dGravarCena,
    enviar: (pedido) => mod3dEnviarModelo(mod3dCanalDaAba, pedido),
    resultado: () => mod3dUltimoResultado,
  };
  modelerPerformanceMarkTabReady();
}

if (mod3dPapel() === 'modelador') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mod3dIniciarAba);
  } else {
    mod3dIniciarAba();
  }
}
