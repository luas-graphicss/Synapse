'use strict';

const MOD3D_PROTO = 3;
const MOD3D_PREFIXO_DO_CANAL = 'aurora-3d-';
const MOD3D_CHAVE_DA_SESSAO = 'synapse:modelador3d:sessao';
const MOD3D_CHAVE_DO_DESTINO = 'synapse:modelador3d:destino';
const MOD3D_INTERVALO_DE_VIDA = 700;
const MOD3D_ESPERA_DE_VIDA = 1400;
const MOD3D_FALHAS_PARA_TROCAR = 2;
const MOD3D_INTERVALO_DE_SONDA = 5000;
const MOD3D_INTERVALO_DOS_PROJETOS = 400;
const MOD3D_SILENCIO_DA_OUTRA_PONTA = 15000;
const MOD3D_JANELA_DE_PRESENCA = 3000;
const MOD3D_TETO_DE_VISTOS = 240;
const MOD3D_TRANSPORTES = Object.freeze(['canal', 'opener', 'direto']);
const MOD3D_NOMES_DOS_TRANSPORTES = Object.freeze({
    canal: 'BroadcastChannel',
    opener: 'postMessage',
    direto: 'chamada direta',
});

let mod3dSessaoLembrada = null;
let mod3dBootLido = false;
let mod3dBootGuardado = null;

const mod3dServidor = {
  canal: null,
  janela: null,
  documentRequest: null,
  assinatura: '',
  ultimoContato: 0,
  relogio: 0,
};

function mod3dNovoId() {
  try {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    }
  } catch (erro) {
    ignorarErro(erro, 'mod3dNovoId');
  }
  return `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

function mod3dLerLocal(chave) {
  try {
    return window.localStorage.getItem(chave);
  } catch (erro) {
    ignorarErro(erro, 'mod3dLerLocal');
    return null;
  }
}

function mod3dGravarLocal(chave, valor) {
  try {
    window.localStorage.setItem(chave, valor);
    return true;
  } catch (erro) {
    ignorarErro(erro, 'mod3dGravarLocal');
    return false;
  }
}

function mod3dBoot() {
  if (mod3dBootLido) return mod3dBootGuardado;
  mod3dBootLido = true;
  try {
    const no = document.getElementById('mod3dBoot');
    if (no && no.textContent) mod3dBootGuardado = JSON.parse(no.textContent);
  } catch (erro) {
    ignorarErro(erro, 'mod3dBoot');
    mod3dBootGuardado = null;
  }
  return mod3dBootGuardado;
}

function mod3dPapel() {
  return mod3dBoot() ? 'modelador' : 'editor';
}

function mod3dSessao() {
  if (mod3dSessaoLembrada) return mod3dSessaoLembrada;
  const doBoot = mod3dBoot();
  if (doBoot && doBoot.sessao) {
    mod3dSessaoLembrada = String(doBoot.sessao);
    return mod3dSessaoLembrada;
  }
  const guardada = mod3dLerLocal(MOD3D_CHAVE_DA_SESSAO);
  if (guardada) {
    mod3dSessaoLembrada = guardada;
    return mod3dSessaoLembrada;
  }
  mod3dSessaoLembrada = mod3dNovoId();
  mod3dGravarLocal(MOD3D_CHAVE_DA_SESSAO, mod3dSessaoLembrada);
  return mod3dSessaoLembrada;
}

function mod3dBaseDoEditor() {
  return modelerTabBaseUrl() || './';
}

function mod3dCriarCanal(opcoes) {
  const papel = opcoes.papel;
  const sessao = opcoes.sessao;
  const aoReceber = typeof opcoes.aoReceber === 'function' ? opcoes.aoReceber : null;
  const aoMudar = typeof opcoes.aoMudar === 'function' ? opcoes.aoMudar : null;
  const onPresence = typeof opcoes.onPresence === 'function' ? opcoes.onPresence : null;
  const baterCoracao = opcoes.baterCoracao === true;
  const instanceId = mod3dNovoId();
  const vistos = new Set();
  const ordemDosVistos = [];
  const pendentes = new Map();
  const sondas = new Map();
  const quebrados = new Set();
  let janela = opcoes.janela || null;
  let emissor = null;
  let escolhido = null;
  let ultimaEntrada = 0;
  let falhasSeguidas = 0;
  let relogioDeVida = 0;
  let relogioDeSonda = 0;
  let ultimoAviso = '';
  let fechado = false;

  try {
    emissor = new BroadcastChannel(MOD3D_PREFIXO_DO_CANAL + sessao);
  } catch (erro) {
    ignorarErro(erro, 'mod3dCriarCanal');
    emissor = null;
  }

  function janelaAlvo() {
    try {
      if (papel === 'editor') return janela && !janela.closed ? janela : null;
      const abridor = window.opener;
      return abridor && !abridor.closed ? abridor : null;
    } catch (erro) {
      ignorarErro(erro, 'mod3dJanelaAlvo');
      return null;
    }
  }

  function caixaDireta() {
    const alvo = janelaAlvo();
    if (!alvo) return null;
    try {
      return typeof alvo.mod3dCaixaDireta === 'function' ? alvo.mod3dCaixaDireta : null;
    } catch (erro) {
      ignorarErro(erro, 'mod3dCaixaDireta');
      return null;
    }
  }

  function existe(nome) {
    if (nome === 'canal') return !!emissor;
    if (nome === 'opener') return !!janelaAlvo();
    return !!caixaDireta();
  }

  function disponivel(nome) {
    return existe(nome) && !quebrados.has(nome);
  }

  function escolher() {
    if (escolhido && disponivel(escolhido)) return escolhido;
    escolhido = MOD3D_TRANSPORTES.find(disponivel) || null;
    falhasSeguidas = 0;
    return escolhido;
  }

  function ligado() {
    return Date.now() - ultimaEntrada < MOD3D_JANELA_DE_PRESENCA;
  }

  function avisar() {
    if (!aoMudar) return;
    const estado = { transporte: escolhido, ligado: ligado() };
    const resumo = `${estado.transporte || '-'}:${estado.ligado ? '1' : '0'}`;
    if (resumo === ultimoAviso) return;
    ultimoAviso = resumo;
    try {
      aoMudar(estado);
    } catch (erro) {
      ignorarErro(erro, 'mod3dAvisar');
    }
  }

  function lembrarVisto(mid) {
    vistos.add(mid);
    ordemDosVistos.push(mid);
    while (ordemDosVistos.length > MOD3D_TETO_DE_VISTOS) {
      vistos.delete(ordemDosVistos.shift());
    }
  }

  function montarEnvelope(tipo, dados) {
    return {
      __mod3d: true,
      proto: MOD3D_PROTO,
      sessao,
      de: papel,
      instance: instanceId,
      mid: mod3dNovoId(),
      tipo,
      dados: dados || {},
    };
  }

  function despacharPor(nome, envelope) {
    try {
      if (nome === 'canal') {
        if (!emissor) return false;
        emissor.postMessage(envelope);
        return true;
      }
      if (nome === 'opener') {
        const alvo = janelaAlvo();
        if (!alvo) return false;
        alvo.postMessage(envelope, '*');
        return true;
      }
      const caixa = caixaDireta();
      if (!caixa) return false;
      caixa(envelope);
      return true;
    } catch (erro) {
      ignorarErro(erro, `mod3dDespachar:${nome}`);
      return false;
    }
  }

  function derrubar(nome) {
    if (!nome) return;
    quebrados.add(nome);
    if (escolhido === nome) escolhido = null;
    falhasSeguidas = 0;
    pendentes.clear();
    registro.aviso('modelador 3d: transporte trocado, caiu', nome);
    escolher();
    avisar();
  }

  function enviar(tipo, dados) {
    if (fechado) return false;
    const nome = escolher();
    if (!nome) return false;
    if (despacharPor(nome, montarEnvelope(tipo, dados))) return true;
    derrubar(nome);
    const reserva = escolher();
    return reserva ? despacharPor(reserva, montarEnvelope(tipo, dados)) : false;
  }

  function enviarPorTodos(tipo, dados) {
    if (fechado) return false;
    const envelope = montarEnvelope(tipo, dados);
    let foi = false;
    MOD3D_TRANSPORTES.forEach((nome) => {
        if (!existe(nome)) return;
        if (despacharPor(nome, envelope)) foi = true;
    });
    return foi;
  }

  function responder(via, tipo, dados) {
    if (fechado) return false;
    if (via && existe(via) && despacharPor(via, montarEnvelope(tipo, dados))) return true;
    return enviar(tipo, dados);
  }

  function confirmar(envelope, via) {
    const alvo = envelope.dados ? envelope.dados.emResposta : null;
    if (!alvo) return;
    if (pendentes.has(alvo)) {
      pendentes.delete(alvo);
      falhasSeguidas = 0;
    }
    if (sondas.has(alvo)) {
      const nome = sondas.get(alvo);
      sondas.delete(alvo);
      quebrados.delete(nome);
      if (MOD3D_TRANSPORTES.indexOf(nome) < MOD3D_TRANSPORTES.indexOf(escolhido || 'direto')) {
        escolhido = nome;
        falhasSeguidas = 0;
        pendentes.clear();
      }
    }
    if (via) quebrados.delete(via);
  }

  function tratar(bruto, via, portas) {
    if (fechado) return;
    const envelope = bruto;
    const esperado = { session: sessao, role: papel, protocol: MOD3D_PROTO };
    if (!modelerChannelMessageIsAddressedToUs(envelope, esperado)) return;
    const recusa = modelerChannelMessageProblem(envelope, esperado);
    if (recusa) {
      modelerChannelRecordRefusal(recusa, via);
      registro.aviso('modelador 3d: mensagem recusada', recusa);
      return;
    }
    if (vistos.has(envelope.mid)) return;
    lembrarVisto(envelope.mid);
    ultimaEntrada = Date.now();
    if (onPresence) {
      try {
        onPresence(typeof envelope.instance === 'string' ? envelope.instance : '');
      } catch (erro) {
        ignorarErro(erro, 'mod3dOnPresence');
      }
    }
    const seguirEntrada = !baterCoracao && escolhido !== via;
    if (seguirEntrada || !escolhido || quebrados.has(escolhido)) {
      quebrados.delete(via);
      escolhido = via;
      falhasSeguidas = 0;
      pendentes.clear();
    }
    if (envelope.tipo === 'vivo' || envelope.tipo === 'sonda') {
      responder(via, `${envelope.tipo}-ok`, { emResposta: envelope.mid });
      avisar();
      return;
    }
    if (envelope.tipo === 'vivo-ok' || envelope.tipo === 'sonda-ok') {
      confirmar(envelope, via);
      avisar();
      return;
    }
    if (aoReceber) {
      try {
        aoReceber(envelope, via, portas);
      } catch (erro) {
        ignorarErro(erro, 'mod3dAoReceber');
      }
    }
    avisar();
  }

  function bater() {
    if (fechado) return;
    const agora = Date.now();
    pendentes.forEach((info, mid) => {
        if (agora - info.momento <= MOD3D_ESPERA_DE_VIDA) return;
        pendentes.delete(mid);
        if (info.transporte === escolhido) falhasSeguidas += 1;
    });
    if (escolhido && falhasSeguidas >= MOD3D_FALHAS_PARA_TROCAR) derrubar(escolhido);
    const nome = escolher();
    if (!nome) {
      avisar();
      return;
    }
    const envelope = montarEnvelope('vivo', {});
    pendentes.set(envelope.mid, { transporte: nome, momento: agora });
    if (!despacharPor(nome, envelope)) {
      pendentes.delete(envelope.mid);
      derrubar(nome);
    }
    avisar();
  }

  function sondar() {
    if (fechado) return;
    const melhor = MOD3D_TRANSPORTES.find((nome) => existe(nome) && quebrados.has(nome));
    if (!melhor) return;
    if (escolhido && MOD3D_TRANSPORTES.indexOf(melhor) > MOD3D_TRANSPORTES.indexOf(escolhido)) {
      return;
    }
    const envelope = montarEnvelope('sonda', {});
    sondas.set(envelope.mid, melhor);
    if (!despacharPor(melhor, envelope)) sondas.delete(envelope.mid);
  }

  function ouvirMensagem(evento) {
    if (!evento) return;
    if (!modelerChannelOriginIsExpected(evento.origin)) {
      if (modelerChannelLooksLikeModelerMessage(evento.data)) {
        modelerChannelRecordRefusal(`origem inesperada ${String(evento.origin)}`, 'opener');
      }
      return;
    }
    tratar(evento.data, 'opener', evento.ports);
  }

  if (emissor) {
    emissor.onmessage = (evento) => tratar(evento && evento.data, 'canal');
  }
  window.addEventListener('message', ouvirMensagem);
  window.mod3dCaixaDireta = (envelope) => tratar(envelope, 'direto');

  if (baterCoracao) {
    relogioDeVida = setInterval(bater, MOD3D_INTERVALO_DE_VIDA);
    relogioDeSonda = setInterval(sondar, MOD3D_INTERVALO_DE_SONDA);
  }
  escolher();

  return {
    enviar,
    enviarPorTodos,
    responder,
    enviarComPortas(tipo, dados, transferiveis) {
      if (fechado) return false;
      const alvo = janelaAlvo();
      if (!alvo) return false;
      try {
        alvo.postMessage(montarEnvelope(tipo, dados), '*', transferiveis || []);
        return true;
      } catch (erro) {
        ignorarErro(erro, 'mod3dEnviarComPortas');
        return false;
      }
    },
    podeTransferir: () => typeof MessageChannel === 'function' && disponivel('opener'),
    ligado,
    transporte: () => escolhido,
    definirJanela(nova) {
      janela = nova || null;
      quebrados.delete('opener');
      quebrados.delete('direto');
      escolher();
      avisar();
    },
    simularQueda(nome) {
      if (nome === 'canal' && emissor) {
        try {
          emissor.close();
        } catch (erro) {
          ignorarErro(erro, 'mod3dSimularQueda');
        }
        emissor = null;
      }
      derrubar(nome);
      return escolhido;
    },
    fechar() {
      fechado = true;
      if (relogioDeVida) clearInterval(relogioDeVida);
      if (relogioDeSonda) clearInterval(relogioDeSonda);
      window.removeEventListener('message', ouvirMensagem);
      try {
        if (emissor) emissor.close();
      } catch (erro) {
        ignorarErro(erro, 'mod3dFecharCanal');
      }
      emissor = null;
      if (window.mod3dCaixaDireta) delete window.mod3dCaixaDireta;
    },
  };
}

function mod3dListaDeProjetos() {
  if (typeof State === 'undefined' || !State || !Array.isArray(State.projects)) return [];
  return State.projects.map((projeto) => ({
        id: projeto.id,
        nome: projeto.name,
        arquivos: projeto.files && typeof projeto.files.size === 'number' ? projeto.files.size : 0,
        ativo: projeto.id === State.active,
  }));
}

function mod3dAssinaturaDaLista(lista) {
  return lista.map((p) => `${p.id}:${p.nome}:${p.arquivos}:${p.ativo ? 1 : 0}`).join('|');
}

function mod3dPublicarProjetos(forcado) {
  if (!mod3dServidor.canal) return false;
  const lista = mod3dListaDeProjetos();
  const assinatura = mod3dAssinaturaDaLista(lista);
  if (!forcado && assinatura === mod3dServidor.assinatura) return false;
  mod3dServidor.assinatura = assinatura;
  return mod3dServidor.canal.enviar('projetos', { lista });
}

function mod3dMarcarBotao(ligado) {
  const botao = document.getElementById('modelador3dBtn');
  if (botao) botao.classList.toggle('on', !!ligado);
}

function mod3dAtenderModelador(envelope, via, portas) {
  const canal = mod3dServidor.canal;
  if (!canal) return;
  if (
    typeof mod3dHandleDocumentEnvelope === 'function' &&
    mod3dHandleDocumentEnvelope(envelope, via, canal)
  ) {
    return;
  }
  if (typeof mod3dPonteAtender === 'function' && mod3dPonteAtender(envelope, via, portas, canal)) {
    return;
  }
  if (typeof mod3dPonteAtenderCena === 'function' && mod3dPonteAtenderCena(envelope, via, canal)) {
    return;
  }
  if (envelope.tipo === 'document-ready' && mod3dServidor.documentRequest) {
    canal.responder(via, 'document-open-request', mod3dServidor.documentRequest);
    mod3dServidor.documentRequest = null;
    return;
  }
  if (envelope.tipo === 'ola') {
    const lista = mod3dListaDeProjetos();
    mod3dServidor.assinatura = mod3dAssinaturaDaLista(lista);
    canal.responder(via, 'ola-ok', { emResposta: envelope.mid, lista });
    registro.info('modelador 3d: aba ligada por', via);
    return;
  }
  if (envelope.tipo === 'projetos-pedido') {
    mod3dPublicarProjetos(true);
    return;
  }
  if (envelope.tipo === 'adeus') {
    mod3dServidor.ultimoContato = 0;
    mod3dMarcarBotao(false);
  }
}

function mod3dRememberModelerPresence() {
  mod3dServidor.ultimoContato = Date.now();
}

function mod3dPulsoDoServidor() {
  const vivo = Date.now() - mod3dServidor.ultimoContato < MOD3D_SILENCIO_DA_OUTRA_PONTA;
  mod3dMarcarBotao(vivo);
  if (vivo) mod3dPublicarProjetos(false);
}

function mod3dLigarServidor() {
  if (mod3dServidor.canal) return mod3dServidor.canal;
  mod3dServidor.canal = mod3dCriarCanal({
      papel: 'editor',
      sessao: mod3dSessao(),
      aoReceber: mod3dAtenderModelador,
      onPresence: mod3dRememberModelerPresence,
  });
  mod3dServidor.relogio = setInterval(mod3dPulsoDoServidor, MOD3D_INTERVALO_DOS_PROJETOS);
  mod3dServidor.canal.enviarPorTodos('editor-pronto', {});
  return mod3dServidor.canal;
}

function mod3dAbrirAba(documentRequest) {
  const sessao = mod3dSessao();
  const requested =
  documentRequest &&
  typeof documentRequest.project === 'string' &&
  typeof documentRequest.path === 'string'
  ? { project: documentRequest.project, path: documentRequest.path }
  : null;
  const existing = mod3dServidor.janela;
  if (existing && !existing.closed) {
    existing.focus();
    if (requested) {
      if (existing.MOD3D_PROJECT) mod3dServidor.canal.enviar('document-open-request', requested);
      else mod3dServidor.documentRequest = requested;
    }
    return existing;
  }
  mod3dServidor.documentRequest = requested;
  const janela = modelerOpenTabWindow(`synapse_modelador_${sessao}`);
  if (!janela) {
    toast('Pop-up bloqueado', 'Permita pop-ups para abrir em nova aba', 'err');
    return null;
  }
  const servidor = mod3dLigarServidor();
  try {
    if (janela.MOD3D_PROJECT) {
      mod3dServidor.janela = janela;
      servidor.definirJanela(janela);
      if (requested) servidor.enviar('document-open-request', requested);
      mod3dServidor.documentRequest = null;
      janela.focus();
      return janela;
    }
    modelerTabWriteDocument(janela, sessao);
  } catch (erro) {
    registro.erro('modelador 3d: a aba não pôde ser montada', erro);
    toast('Blepse 3D', modelerTabNoticeMessage(), 'err');
    janela.close();
    return null;
  }
  mod3dServidor.janela = janela;
  servidor.definirJanela(janela);
  janela.focus();
  toast('Blepse 3D aberto', 'Aba, canal e gravação no projeto', 'ok');
  return janela;
}

function mod3dPrepararEditor() {
  mod3dLigarServidor();
}

if (mod3dPapel() === 'editor') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mod3dPrepararEditor);
  } else {
    mod3dPrepararEditor();
  }
}
