'use strict';

const MOD3D_TETO_DO_HISTORICO = 100;
const MOD3D_JANELA_DO_GRUPO = 700;

const mod3dHistorico = {
  pilha: [],
  indice: -1,
  aplicando: false,
  grupo: '',
  ouvintes: [],
};

function mod3dHistoricoAoMudar(fn) {
  if (typeof fn === 'function') mod3dHistorico.ouvintes.push(fn);
}

function mod3dHistoricoTocar() {
  mod3dHistorico.ouvintes.forEach((fn) => {
      try {
        fn();
      } catch (erro) {
        ignorarErro(erro, 'mod3dHistoricoTocar');
      }
  });
}

function mod3dHistoricoLimpar() {
  mod3dHistorico.pilha = [];
  mod3dHistorico.indice = -1;
  mod3dHistorico.grupo = '';
  if (typeof mod3dResetHistoryDocument === 'function') mod3dResetHistoryDocument();
  mod3dHistoricoTocar();
}

function mod3dAgora() {
  if (typeof performance === 'object' && performance && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function mod3dAbrirGrupoDoHistorico(chave) {
  mod3dHistorico.grupo = chave || '';
}

function mod3dFecharGrupoDoHistorico() {
  mod3dHistorico.grupo = '';
}

function mod3dTopoDoHistorico() {
  if (mod3dHistorico.indice < 0) return null;
  return mod3dHistorico.pilha[mod3dHistorico.indice] || null;
}

function mod3dPodeJuntarNoTopo(chave) {
  if (!chave) return false;
  const topo = mod3dTopoDoHistorico();
  if (!topo || topo.chave !== chave) return false;
  if (mod3dHistorico.indice !== mod3dHistorico.pilha.length - 1) return false;
  if (mod3dHistorico.grupo && mod3dHistorico.grupo === chave) return true;
  return mod3dAgora() - topo.marca <= MOD3D_JANELA_DO_GRUPO;
}

function mod3dHistoricoPasso(passo) {
  if (mod3dHistorico.aplicando || !passo) return null;
  if (typeof passo.desfazer !== 'function' || typeof passo.refazer !== 'function') return null;
  const chave = passo.chave || '';
  if (mod3dPodeJuntarNoTopo(chave)) {
    const topo = mod3dTopoDoHistorico();
    topo.refazer = passo.refazer;
    topo.rotulo = passo.rotulo || topo.rotulo;
    topo.marca = mod3dAgora();
    if (typeof mod3dRecordHistoryDocument === 'function') mod3dRecordHistoryDocument(topo, true);
    mod3dHistoricoTocar();
    return topo;
  }
  const novo = {
    rotulo: passo.rotulo || 'Mudança',
    chave,
    desfazer: passo.desfazer,
    refazer: passo.refazer,
    marca: mod3dAgora(),
  };
  mod3dHistorico.pilha = mod3dHistorico.pilha.slice(0, mod3dHistorico.indice + 1);
  mod3dHistorico.pilha.push(novo);
  if (mod3dHistorico.pilha.length > MOD3D_TETO_DO_HISTORICO) mod3dHistorico.pilha.shift();
  mod3dHistorico.indice = mod3dHistorico.pilha.length - 1;
  if (typeof mod3dRecordHistoryDocument === 'function') mod3dRecordHistoryDocument(novo, false);
  mod3dHistoricoTocar();
  return novo;
}

function mod3dRodarPasso(passo, sentido) {
  mod3dHistorico.aplicando = true;
  try {
    if (sentido === 'desfazer') passo.desfazer();
    else passo.refazer();
  } catch (erro) {
    ignorarErro(erro, 'mod3dRodarPasso');
  } finally {
    mod3dHistorico.aplicando = false;
  }
}

function mod3dDesfazer() {
  const passo = mod3dTopoDoHistorico();
  if (!passo) return false;
  mod3dHistorico.grupo = '';
  mod3dRodarPasso(passo, 'desfazer');
  mod3dHistorico.indice -= 1;
  if (typeof mod3dRefreshHistoryBaseline === 'function') mod3dRefreshHistoryBaseline();
  mod3dHistoricoTocar();
  return true;
}

function mod3dRefazer() {
  const proximo = mod3dHistorico.pilha[mod3dHistorico.indice + 1];
  if (!proximo) return false;
  mod3dHistorico.grupo = '';
  mod3dRodarPasso(proximo, 'refazer');
  mod3dHistorico.indice += 1;
  if (typeof mod3dRefreshHistoryBaseline === 'function') mod3dRefreshHistoryBaseline();
  mod3dHistoricoTocar();
  return true;
}

function mod3dHistoricoEstado() {
  const topo = mod3dTopoDoHistorico();
  const proximo = mod3dHistorico.pilha[mod3dHistorico.indice + 1] || null;
  return {
    passos: mod3dHistorico.pilha.length,
    indice: mod3dHistorico.indice,
    podeDesfazer: Boolean(topo),
    podeRefazer: Boolean(proximo),
    rotuloDesfazer: topo ? topo.rotulo : '',
    rotuloRefazer: proximo ? proximo.rotulo : '',
  };
}

function mod3dPassoDeEstados(rotulo, lista, chave) {
  const pecas = (lista || []).filter((peca) => peca && peca.id && peca.antes && peca.depois);
  if (!pecas.length) return null;
  const guardados = pecas.map((peca) => ({
        id: peca.id,
        antes: peca.antes,
        depois: peca.depois,
  }));
  return mod3dHistoricoPasso({
      rotulo,
      chave,
      desfazer: () => {
        guardados.forEach((peca) => mod3dAplicarEstadoNoNo(peca.id, peca.antes));
        mod3dCenaTocar();
      },
      refazer: () => {
        guardados.forEach((peca) => mod3dAplicarEstadoNoNo(peca.id, peca.depois));
        mod3dCenaTocar();
      },
  });
}

function mod3dPassoDeCriacao(rotulo, ids) {
  const lista = (ids || []).slice();
  if (!lista.length) return null;
  let guardados = null;
  return mod3dHistoricoPasso({
      rotulo,
      chave: '',
      desfazer: () => {
        guardados = lista
        .map((id) => mod3dRetirarSubarvore(id))
        .filter((pacote) => pacote !== null)
        .reverse();
        mod3dSelecionarNos([]);
        mod3dCenaTocar();
      },
      refazer: () => {
        if (!guardados) return;
        guardados
        .slice()
        .reverse()
        .forEach((pacote) => mod3dDevolverSubarvore(pacote));
        guardados = null;
        mod3dSelecionarNos(lista);
        mod3dCenaTocar();
      },
  });
}

function mod3dPassoDeRemocao(rotulo, pacotes, selecaoAntes) {
  const guardados = (pacotes || []).filter((pacote) => pacote !== null);
  if (!guardados.length) return null;
  const selecao = (selecaoAntes || []).slice();
  return mod3dHistoricoPasso({
      rotulo,
      chave: '',
      desfazer: () => {
        guardados
        .slice()
        .reverse()
        .forEach((pacote) => mod3dDevolverSubarvore(pacote));
        mod3dSelecionarNos(selecao);
        mod3dCenaTocar();
      },
      refazer: () => {
        guardados.forEach((pacote) => mod3dRetirarSubarvore(pacote.raiz));
        mod3dSelecionarNos([]);
        mod3dCenaTocar();
      },
  });
}
