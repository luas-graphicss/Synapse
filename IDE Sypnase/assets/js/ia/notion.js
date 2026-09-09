'use strict';


const NOTION_API = 'https://api.notion.com';
const NOTION_VERSAO_API = '2026-03-11';

const NOTION_TOKEN_PADRAO = '';

const NOTION_LS = {
  via: 'synapse.ia.notion.via',
  semPadrao: 'synapse.ia.notion.sem-padrao',
  sessoes: 'synapse.ia.notion.sessoes',
};

const NOTION_DIAG_TTL = 300000;
const NOTION_LIMITE_MS = 240000;
const NOTION_PASSO_MIN = 900;
const NOTION_PASSO_MAX = 2600;
const NOTION_FINAIS = [
  'completed',
  'complete',
  'succeeded',
  'success',
  'failed',
  'failure',
  'error',
  'errored',
  'cancelled',
  'canceled',
  'stopped',
  'expired',
  'timed_out',
  'requires_action',
  'action_required',
  'awaiting_input',
  'needs_input',
  'waiting_for_input',
  'paused',
];

const NOTION_ST = {
  via: '',
  diag: {},
  voando: {},
  sessoes: null,
  vistos: {},
  avisou: {},
  formCarregando: false,
};


function notionSemBarra(url) {
  return String(url || '')
  .trim()
  .replace(/\/+$/, '');
}

function notionEhNotion(conexao) {
  if (!conexao) return false;
  return conexao.formato === 'notion-agents' || conexao.prov === 'notion';
}

function notionToken(connection) {
  return window.SynapseNotionCredentials.token(
    connection,
    typeof IA === 'undefined' ? {} : IA.chavesVolateis,
  );
}

function notionUsaPadrao() {
  return false;
}

function notionVersao(conexao) {
  return String((conexao && conexao.notionVersao) || '').trim() || NOTION_VERSAO_API;
}

function notionCabecalhos(conexao) {
  if (!notionToken(conexao))
  throw new Error('Informe seu token proprio do Notion nos ajustes da conexao.');
  const h = {
    authorization: `Bearer ${notionToken(conexao)}`,
    'notion-version': notionVersao(conexao),
    'content-type': 'application/json',
    accept: 'application/json',
  };
  try {
    if (typeof iaCabecalhosExtras === 'function') Object.assign(h, iaCabecalhosExtras(conexao));
  } catch (e) {
    ignorarErro(e, 'notionCabecalhos');
  }
  return h;
}

function notionJson(texto) {
  try {
    const v = JSON.parse(String(texto || ''));
    return v && typeof v === 'object' ? v : null;
  } catch (e) {
    ignorarErro(e, 'notionJson');
    return null;
  }
}

function notionAbortado() {
  const e = new Error('Geracao interrompida.');
  e.name = 'AbortError';
  return e;
}

function notionConferirAborto(sinal) {
  if (sinal && sinal.aborted) throw notionAbortado();
}

function notionDormir(ms, sinal) {
  return new Promise((ok, falha) => {
      const t = setTimeout(() => {
          limpar();
          ok();
        }, ms);
      const parar = () => {
        limpar();
        falha(notionAbortado());
      };
      function limpar() {
        clearTimeout(t);
        if (sinal) sinal.removeEventListener('abort', parar);
      }
      if (sinal) {
        if (sinal.aborted) {
          parar();
          return;
        }
        sinal.addEventListener('abort', parar);
      }
  });
}


function notionViaSalva() {
  try {
    return localStorage.getItem(NOTION_LS.via) || '';
  } catch (e) {
    ignorarErro(e, 'notionViaSalva');
    return '';
  }
}

function notionGuardarVia(id) {
  try {
    if (id) localStorage.setItem(NOTION_LS.via, id);
    else localStorage.removeItem(NOTION_LS.via);
  } catch (e) {
    ignorarErro(e, 'notionGuardarVia');
  }
}

function notionProxyDoSite() {
  try {
    if (typeof location === 'undefined') return '';
    if (!/^https?:$/i.test(location.protocol || '')) return '';
    return `${location.origin}/api/notion`;
  } catch (e) {
    ignorarErro(e, 'notionProxyDoSite');
    return '';
  }
}

function notionRelay() {
  try {
    return typeof mcpBase === 'function' ? notionSemBarra(mcpBase()) : '';
  } catch (e) {
    ignorarErro(e, 'notionRelay');
    return '';
  }
}

function notionTemPonte() {
  try {
    if (typeof termApi !== 'function' || typeof MCP === 'undefined' || !MCP) return false;
    return !!(
      MCP.sid &&
      MCP.token &&
      (notionRelay() || (typeof termBase === 'function' && termBase()))
    );
  } catch (e) {
    ignorarErro(e, 'notionTemPonte');
    return false;
  }
}

function notionRotas(conexao) {
  const rotas = [];
  const manual = notionSemBarra((conexao && conexao.base) || '');
  if (manual)
  rotas.push({ id: 'manual', rot: `proxy da conexao (${manual})`, tipo: 'http', base: manual });
  const site = notionProxyDoSite();
  if (site) rotas.push({ id: 'site', rot: 'funcao /api/notion do site', tipo: 'http', base: site });
  const relay = notionRelay();
  if (relay)
  rotas.push({
      id: 'relay',
      rot: 'rota /notion do relay',
      tipo: 'http',
      base: `${relay}/notion`,
  });
  if (notionTemPonte())
  rotas.push({ id: 'ponte', rot: 'ponte do relay (fetchjson)', tipo: 'ponte', base: relay });
  rotas.push({
      id: 'direto',
      rot: 'chamada direta em api.notion.com',
      tipo: 'http',
      base: NOTION_API,
  });
  const uteis = rotas.filter((r) => !NOTION_SEM_VERSAO[r.id]);
  const finais = uteis.length ? uteis : rotas;
  const preferida = NOTION_ST.via || notionViaSalva();
  if (preferida) {
    const i = finais.findIndex((r) => r.id === preferida);
    if (i > 0) finais.unshift(finais.splice(i, 1)[0]);
  }
  return finais;
}

async function notionPeloHttp(rota, metodo, caminho, corpo, sinal, cabecalhos) {
  const opcoes = { method: metodo, headers: cabecalhos, cache: 'no-store' };
  if (sinal) opcoes.signal = sinal;
  if (corpo != null) opcoes.body = JSON.stringify(corpo);
  const resposta = await fetch(rota.base + caminho, opcoes);
  const texto = await resposta.text().catch(() => '');
  return { status: resposta.status, ok: resposta.ok, texto, json: notionJson(texto), rota };
}

async function notionPelaPonte(rota, metodo, caminho, corpo, sinal, cabecalhos) {
  if (typeof termApi !== 'function') throw new Error('ponte do relay indisponivel nesta pagina');
  notionConferirAborto(sinal);
  const r = await termApi('fetchjson', {
      url: NOTION_API + caminho,
      method: metodo,
      headers: cabecalhos,
      body: corpo == null ? null : JSON.stringify(corpo),
  });
  notionConferirAborto(sinal);
  const status = Number((r && r.status) || 0);
  if (!status) throw new Error(`ponte do relay sem resposta: ${(r && r.error) || 'sem status'}`);
  const texto = String((r && r.text) || '');
  return { status, ok: !!(r && r.ok), texto, json: notionJson(texto), rota };
}

const NOTION_SEM_VERSAO = {};

function notionPerdeuVersao(r) {
  if (!r || r.status !== 400) return false;
  const j = r.json;
  const codigo = String((j && j.code) || '');
  const msg = String((j && j.message) || (r && r.texto) || '');
  return codigo === 'missing_version' || /notion-version/i.test(msg);
}

function notionMsgSemVersao(rota) {
  return (
    `${(rota && rota.rot) || 'O intermediario em uso'} nao repassa o cabecalho Notion-Version, ` +
    'entao a Notion recusa a chamada. Isso acontece com relay antigo. Saidas: atualize e reinicie o ' +
    'relay do Synapse com o relay.js desta versao, publique o site (a funcao /api/notion ja vem no ' +
    'projeto), ou rode "node tools/proxy-notion.mjs" e informe http://127.0.0.1:8788/notion no campo ' +
    '"Proxy da API" da conexao.'
  );
}

function notionPareceNotion(r) {
  const j = r && r.json;
  if (!j) return false;
  return !!(j.object || j.results || j.agent_id || (j.id && j.status) || j.code);
}

function notionMsgSemRota(erro) {
  const detalhe = String((erro && erro.message) || erro || 'sem detalhe');
  if (/notion-version/i.test(detalhe)) return detalhe;
  return (
    'Nao consegui falar com a API do Notion a partir do navegador. A Notion nao libera CORS, ' +
    'entao o chat precisa de uma saida: publique o site (a funcao /api/notion ja vem no projeto), ' +
    'ligue o relay do Synapse no menu MCP, ou informe um proxy no campo "Proxy da API" da conexao. ' +
    `Detalhe: ${detalhe}`
  );
}

function notionMsgHttp(r) {
  const j = r && r.json;
  const msg =
  (j && (j.message || j.error || j.detail)) || String((r && r.texto) || '').slice(0, 220);
  const codigo = (j && j.code) || '';
  return `Notion ${r ? r.status : '?'}${codigo ? ` (${codigo})` : ''}: ${msg || 'sem detalhe'}`;
}

async function notionPedir(conexao, metodo, caminho, corpo, sinal) {
  notionConferirAborto(sinal);
  const cabecalhos = notionCabecalhos(conexao);
  const rotas = notionRotas(conexao);
  let ultimo = null;
  let semVersao = null;
  for (const rota of rotas) {
    try {
      const r =
      rota.tipo === 'ponte'
      ? await notionPelaPonte(rota, metodo, caminho, corpo, sinal, cabecalhos)
      : await notionPeloHttp(rota, metodo, caminho, corpo, sinal, cabecalhos);
      if (notionPerdeuVersao(r)) {
        NOTION_SEM_VERSAO[rota.id] = true;
        semVersao = new Error(notionMsgSemVersao(rota));
        ultimo = semVersao;
        if (NOTION_ST.via === rota.id) {
          NOTION_ST.via = '';
          notionGuardarVia('');
        }
        continue;
      }
      const intermediarioFalhou =
      !r.ok &&
      !notionPareceNotion(r) &&
      [0, 403, 404, 405, 500, 501, 502, 503].includes(r.status);
      if (intermediarioFalhou && rotas.length > 1) {
        ultimo = new Error(`${rota.rot}: HTTP ${r.status}`);
        if (NOTION_ST.via === rota.id) {
          NOTION_ST.via = '';
          notionGuardarVia('');
        }
        continue;
      }
      if (NOTION_ST.via !== rota.id) {
        NOTION_ST.via = rota.id;
        notionGuardarVia(rota.id);
      }
      return r;
    } catch (e) {
      if (e && e.name === 'AbortError') throw e;
      ultimo = e;
      if (NOTION_ST.via === rota.id) {
        NOTION_ST.via = '';
        notionGuardarVia('');
      }
    }
  }
  throw new Error(notionMsgSemRota(semVersao || ultimo));
}


function notionChaveDiag(conexao) {
  const token = notionToken(conexao);
  return `${token.slice(-10)}|${notionVersao(conexao)}|${notionSemBarra((conexao && conexao.base) || '')}`;
}

function notionDiagCache(conexao) {
  return NOTION_ST.diag[notionChaveDiag(conexao)] || null;
}

function notionNomeAgente(bruto) {
  if (!bruto || typeof bruto !== 'object') return '';
  if (typeof bruto.name === 'string' && bruto.name.trim()) return bruto.name.trim();
  if (bruto.title && Array.isArray(bruto.title)) {
    return bruto.title
    .map((t) => String((t && (t.plain_text || (t.text && t.text.content))) || ''))
    .join('')
    .trim();
  }
  return '';
}

function notionMapearAgentes(json) {
  const lista = (json && (json.results || json.agents || json.data)) || [];
  if (!Array.isArray(lista)) return [];
  return lista
  .map((a) => ({
        id: String((a && (a.id || a.agent_id)) || ''),
        nome: notionNomeAgente(a) || 'agente sem nome',
        descricao: String((a && (a.description || a.summary)) || '').slice(0, 220),
        tipo: String((a && (a.agent_type || a.type)) || ''),
  }))
  .filter((a) => a.id);
}

async function notionDetectar(conexao) {
  const d = {
    quando: Date.now(),
    estado: 'erro',
    via: '',
    bot: '',
    workspace: '',
    agentes: [],
    podeAgentes: false,
    mensagem: '',
    detalhe: '',
    padrao: notionUsaPadrao(conexao),
  };
  if (!notionToken(conexao)) {
    d.estado = 'sem-token';
    d.mensagem = 'Informe seu token proprio do Notion nos ajustes da conexao.';
    return d;
  }
  let eu = null;
  try {
    eu = await notionPedir(conexao, 'GET', '/v1/users/me', null, null);
  } catch (e) {
    d.estado = 'sem-rota';
    d.mensagem = String((e && e.message) || e);
    return d;
  }
  d.via = (eu.rota && eu.rota.rot) || '';
  if (eu.status === 401) {
    d.estado = 'token-invalido';
    d.mensagem =
    'O Notion recusou este token (401). Gere um novo em notion.so/profile/integrations e cole aqui.';
    d.detalhe = notionMsgHttp(eu);
    return d;
  }
  if (eu.ok && eu.json) {
    d.bot = String(eu.json.name || '');
    d.workspace = String((eu.json.bot && eu.json.bot.workspace_name) || '');
  } else if (!eu.ok) {
    d.mensagem = notionMsgHttp(eu);
    d.detalhe = d.mensagem;
    return d;
  }
  let ag = null;
  try {
    ag = await notionPedir(
      conexao,
      'POST',
      '/v1/agents/query',
      { page_size: 25, sorts: [{ property: 'created_time', direction: 'descending' }] },
      null,
    );
  } catch (e) {
    d.estado = 'sem-rota';
    d.mensagem = String((e && e.message) || e);
    return d;
  }
  if (ag.status === 401 || ag.status === 403) {
    d.estado = 'sem-permissao';
    d.mensagem =
    'Este token nao tem permissao para executar agentes. No Notion, abra a integracao e ligue o acesso ' +
    'aos agentes (Agents / "interact with agents"), depois compartilhe o agente com ela. Tokens sem essa ' +
    'permissao ainda leem paginas, mas nao conversam com agente.';
    d.detalhe = notionMsgHttp(ag);
    return d;
  }
  if (ag.status === 404 || ag.status === 400) {
    d.estado = 'sem-api';
    d.mensagem =
    'Este workspace nao expoe a API de agentes para o token (recurso de planos pagos do Notion, em fase de ' +
    'lancamento). Da para usar outro token ou outra conexao de IA no chat.';
    d.detalhe = notionMsgHttp(ag);
    return d;
  }
  if (!ag.ok) {
    d.mensagem = notionMsgHttp(ag);
    d.detalhe = d.mensagem;
    return d;
  }
  d.agentes = notionMapearAgentes(ag.json);
  d.podeAgentes = d.agentes.length > 0;
  d.estado = d.agentes.length ? 'ok' : 'sem-agentes';
  d.mensagem = d.agentes.length
  ? `Token liberado para agentes · ${d.agentes.length} disponivel(is): ${d.agentes
				.map((a) => a.nome)
				.slice(0, 4)
				.join(', ')}.`
  : 'Token valido, mas nenhum agente foi compartilhado com ele. No Notion, abra o agente, va em Conexoes/Acessos ' +
  'e adicione esta integracao.';
  return d;
}

async function notionDiagnostico(conexao, forcar) {
  const chave = notionChaveDiag(conexao);
  const cache = NOTION_ST.diag[chave];
  if (!forcar && cache && Date.now() - cache.quando < NOTION_DIAG_TTL) return cache;
  if (NOTION_ST.voando[chave]) return NOTION_ST.voando[chave];
  const tarefa = notionDetectar(conexao)
  .then((d) => {
      NOTION_ST.diag[chave] = d;
      return d;
  })
  .finally(() => {
      delete NOTION_ST.voando[chave];
  });
  NOTION_ST.voando[chave] = tarefa;
  return tarefa;
}

function notionAgenteDe(conexao, diag) {
  const lista = (diag && diag.agentes) || [];
  const escolhido = String((conexao && conexao.agente) || '').trim();
  if (escolhido) {
    const achado = lista.find((a) => a.id === escolhido);
    return achado || { id: escolhido, nome: (conexao && conexao.agenteNome) || 'agente do Notion' };
  }
  return lista[0] || null;
}

async function iaNotionListarAgentes(conexao) {
  const d = await notionDiagnostico(conexao, true);
  if (d.estado === 'ok' || d.estado === 'sem-agentes') return d.agentes.map((a) => a.nome);
  throw new Error(d.mensagem || 'Nao consegui listar os agentes do Notion.');
}

async function iaNotionTestar(conexao) {
  const inicio = Date.now();
  const d = await notionDiagnostico(conexao, true);
  if (d.estado !== 'ok' && d.estado !== 'sem-agentes') throw new Error(d.mensagem);
  const agente = notionAgenteDe(conexao, d);
  return {
    ms: Date.now() - inicio,
    texto: `${d.mensagem}${agente ? ` Agente em uso: ${agente.nome}.` : ''}${d.via ? ` Saida: ${d.via}.` : ''}`,
    uso: null,
  };
}


function notionSessoes() {
  if (NOTION_ST.sessoes) return NOTION_ST.sessoes;
  let mapa = {};
  try {
    const bruto = JSON.parse(localStorage.getItem(NOTION_LS.sessoes) || '{}');
    if (bruto && typeof bruto === 'object') mapa = bruto;
  } catch (e) {
    ignorarErro(e, 'notionSessoes');
  }
  NOTION_ST.sessoes = mapa;
  return mapa;
}

function notionGuardarSessoes() {
  try {
    const mapa = notionSessoes();
    const chaves = Object.keys(mapa);
    if (chaves.length > 40) {
      chaves
      .sort((a, b) => (mapa[a].quando || 0) - (mapa[b].quando || 0))
      .slice(0, chaves.length - 40)
      .forEach((k) => delete mapa[k]);
    }
    localStorage.setItem(NOTION_LS.sessoes, JSON.stringify(mapa));
  } catch (e) {
    ignorarErro(e, 'notionGuardarSessoes');
  }
}

function notionChaveConversa() {
  try {
    const c = typeof iaConversaAtual === 'function' ? iaConversaAtual() : null;
    return (c && c.id) || 'avulsa';
  } catch (e) {
    ignorarErro(e, 'notionChaveConversa');
    return 'avulsa';
  }
}

function notionSessaoDa(chave, agenteId) {
  const reg = notionSessoes()[chave];
  if (!reg || !reg.sessao) return '';
  if (agenteId && reg.agente && reg.agente !== agenteId) return '';
  return reg.sessao;
}

function notionLembrarSessao(chave, sessao, agenteId) {
  notionSessoes()[chave] = { sessao, agente: agenteId || '', quando: Date.now() };
  notionGuardarSessoes();
}

function notionEsquecerSessao(chave) {
  delete notionSessoes()[chave];
  notionGuardarSessoes();
}


function notionTextoDaMensagem(msg) {
  if (!msg) return '';
  const c = msg.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) {
    return c
    .map((p) => {
        if (!p) return '';
        if (typeof p === 'string') return p;
        if (typeof p.text === 'string') return p.text;
        if (p.text && typeof p.text.content === 'string') return p.text.content;
        if (typeof p.plain_text === 'string') return p.plain_text;
        return '';
    })
    .filter(Boolean)
    .join('\n');
  }
  return '';
}

function notionUltimaDoUsuario(pedido) {
  const msgs = (pedido && pedido.mensagens) || [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m && m.role === 'user') {
      const t = notionTextoDaMensagem(m).trim();
      if (t) return t;
    }
  }
  return '';
}

function notionContextoProjeto() {
  let ctx = null;
  let arquivos = [];
  try {
    ctx = typeof iaContexto === 'function' ? iaContexto() : null;
    arquivos = typeof iaListaArquivos === 'function' ? iaListaArquivos(30) : [];
  } catch (e) {
    ignorarErro(e, 'notionContextoProjeto');
  }
  if (!ctx) return '';
  return [
    '[Contexto automatico do Synapse Live Preview — editor de projetos web no navegador do usuario]',
    `Projeto ativo: ${ctx.projeto || '(nenhum)'} · ${ctx.arquivos || 0} arquivo(s)`,
    `Arquivo aberto no editor: ${ctx.aberto || '(nenhum)'}`,
    arquivos.length ? `Arquivos: ${arquivos.join(', ')}` : '',
    'Voce responde por texto dentro do editor; quem aplica as mudancas nos arquivos e o usuario ou uma conexao de IA com ferramentas.',
    'Responda em portugues do Brasil, direto ao ponto.',
    '---',
    '',
  ]
  .filter(Boolean)
  .join('\n');
}

function notionEventoTexto(ev) {
  if (!ev || typeof ev !== 'object') return '';
  const tipo = String(ev.type || ev.event_type || '');
  if (/user|input/i.test(tipo)) return '';
  if (!/message|text|output|response/i.test(tipo) && tipo) return '';
  const papel = String(ev.role || (ev.message && ev.message.role) || '');
  if (papel === 'user') return '';
  if (typeof ev.text === 'string' && ev.text.trim()) return ev.text;
  const direto = notionTextoDaMensagem(ev);
  if (direto) return direto;
  return notionTextoDaMensagem(ev.message || ev.data || ev.body);
}

async function notionEventos(conexao, sessao, sinal) {
  const caminho = `/v1/sessions/${encodeURIComponent(sessao)}/events/query`;
  let r = await notionPedir(
    conexao,
    'POST',
    caminho,
    {
      filter: { property: 'type', event_type: { equals: 'agent.message' } },
      page_size: 100,
    },
    sinal,
  );
  if (!r.ok && (r.status === 400 || r.status === 422)) {
    r = await notionPedir(conexao, 'POST', caminho, { page_size: 100 }, sinal);
  }
  if (!r.ok) return [];
  const lista = (r.json && (r.json.results || r.json.events || r.json.data)) || [];
  if (!Array.isArray(lista)) return [];
  return lista
  .map((ev, i) => ({
        id: String((ev && (ev.id || ev.event_id)) || `${i}`),
        seq: Number((ev && (ev.sequence || ev.sequence_number || ev.index)) || i),
        texto: notionEventoTexto(ev),
  }))
  .filter((ev) => ev.texto)
  .sort((a, b) => a.seq - b.seq);
}

function notionAvisoDeStatus(status) {
  const s = String(status || '').toLowerCase();
  if (
    /requires_action|action_required|awaiting_input|needs_input|waiting_for_input|paused/.test(s)
  ) {
    return '\n\n> O agente parou esperando uma acao ou aprovacao dentro do Notion. Abra a conversa no Notion para liberar e volte aqui.';
  }
  if (/fail|error/.test(s)) {
    return '\n\n> O Notion encerrou esta execucao com erro. Tente reenviar a mensagem.';
  }
  if (/cancel|stopped|expired|timed_out/.test(s)) {
    return '\n\n> A execucao foi encerrada pelo Notion antes de terminar.';
  }
  return '';
}

async function notionAcompanhar(conexao, sessao, pedido, ganchos) {
  const sinal = pedido && pedido.sinal;
  const vistos = new Set();
  const limite = Date.now() + NOTION_LIMITE_MS;
  let texto = '';
  let status = 'in_progress';
  let espera = NOTION_PASSO_MIN;
  let primeira = true;

  const puxar = async () => {
    const eventos = await notionEventos(conexao, sessao, sinal);
    let novoTexto = '';
    eventos.forEach((ev) => {
        if (vistos.has(ev.id)) return;
        vistos.add(ev.id);
        novoTexto += (novoTexto || texto ? '\n\n' : '') + ev.texto.trim();
    });
    if (novoTexto) {
      texto += novoTexto;
      if (typeof ganchos.aoTexto === 'function') ganchos.aoTexto(novoTexto);
      espera = NOTION_PASSO_MIN;
    }
    return !!novoTexto;
  };

  for (;;) {
    notionConferirAborto(sinal);
    if (!primeira) await notionDormir(espera, sinal);
    primeira = false;
    const achou = await puxar();
    if (!achou) espera = Math.min(NOTION_PASSO_MAX, Math.round(espera * 1.35));
    const s = await notionPedir(
      conexao,
      'GET',
      `/v1/sessions/${encodeURIComponent(sessao)}`,
      null,
      sinal,
    );
    if (s.ok && s.json) status = String(s.json.status || s.json.state || status);
    if (NOTION_FINAIS.includes(String(status).toLowerCase())) {
      await puxar();
      break;
    }
    if (Date.now() > limite) {
      texto +=
      '\n\n> Parei de esperar depois de 4 minutos. A resposta pode continuar na conversa dentro do Notion.';
      break;
    }
  }

  const aviso = notionAvisoDeStatus(status);
  if (aviso && !texto.includes(aviso.trim())) texto += aviso;
  if (!texto.trim()) {
    texto = `O agente terminou sem devolver texto (status "${status}"). Tente reformular a pergunta.`;
  }
  return { texto: texto.trim(), chamadas: [], motivo: status, uso: null };
}

async function iaChamarNotion(conexao, pedido, ganchos) {
  const g = ganchos || {};
  const sinal = pedido && pedido.sinal;
  const diag = await notionDiagnostico(conexao, false);
  if (diag.estado === 'sem-rota') throw new Error(diag.mensagem);
  if (diag.estado === 'token-invalido') throw new Error(diag.mensagem);
  if (diag.estado === 'sem-permissao') throw new Error(diag.mensagem);
  if (diag.estado === 'sem-api') throw new Error(diag.mensagem);
  if (diag.estado === 'sem-agentes') throw new Error(diag.mensagem);
  if (diag.estado !== 'ok')
  throw new Error(diag.mensagem || 'Nao consegui usar os agentes do Notion.');

  const agente = notionAgenteDe(conexao, diag);
  if (!agente) throw new Error('Nenhum agente do Notion disponivel para este token.');

  const chave = notionChaveConversa();
  const texto = notionUltimaDoUsuario(pedido);
  if (!texto) throw new Error('Escreva uma mensagem para o agente do Notion.');

  let sessao = notionSessaoDa(chave, agente.id);
  const comContexto = (conexao && conexao.contexto) !== false;
  const mensagem = sessao || !comContexto ? texto : notionContextoProjeto() + texto;

  let r = null;
  if (sessao) {
    r = await notionPedir(
      conexao,
      'POST',
      `/v1/sessions/${encodeURIComponent(sessao)}`,
      { message: mensagem },
      sinal,
    );
    if (!r.ok && (r.status === 404 || r.status === 410 || r.status === 400)) {
      notionEsquecerSessao(chave);
      sessao = '';
      r = null;
    }
  }
  if (!r) {
    r = await notionPedir(
      conexao,
      'POST',
      '/v1/sessions',
      { agent_id: agente.id, message: comContexto ? notionContextoProjeto() + texto : texto },
      sinal,
    );
  }
  if (!r.ok) {
    if (r.status === 401 || r.status === 403) {
      NOTION_ST.diag = {};
      throw new Error(
        `Este token nao pode executar o agente "${agente.nome}". ${notionMsgHttp(r)} Confira as permissoes da integracao no Notion.`,
      );
    }
    throw new Error(notionMsgHttp(r));
  }
  const nova = String(
    (r.json && (r.json.id || r.json.session_id || (r.json.session && r.json.session.id))) || sessao,
  );
  if (!nova) throw new Error('O Notion nao devolveu o identificador da sessao do agente.');
  notionLembrarSessao(chave, nova, agente.id);
  return notionAcompanhar(conexao, nova, pedido, g);
}


function iaNotionPadraoFoiRemovido() {
  try {
    return localStorage.getItem(NOTION_LS.semPadrao) === '1';
  } catch (e) {
    ignorarErro(e, 'iaNotionPadraoFoiRemovido');
    return false;
  }
}

function iaNotionMarcarPadraoRemovido(conexao) {
  if (!conexao || !conexao.padrao || conexao.prov !== 'notion') return;
  try {
    localStorage.setItem(NOTION_LS.semPadrao, '1');
  } catch (e) {
    ignorarErro(e, 'iaNotionMarcarPadraoRemovido');
  }
}

function iaNotionSemear() {
  if (window.SynapseNotionCredentials.migrate(IA)) iaSalvar();
  return null;
}


function notionClasseEstado(estado) {
  if (estado === 'ok') return 'ok';
  if (estado === 'sem-agentes') return 'alerta';
  return 'err';
}

function notionRotuloEstado(estado) {
  if (estado === 'sem-token') return 'Token do Notion nao configurado';
  if (estado === 'ok') return 'Token com permissao de agentes';
  if (estado === 'sem-agentes') return 'Token valido, sem agente compartilhado';
  if (estado === 'sem-permissao') return 'Token sem permissao para agentes';
  if (estado === 'token-invalido') return 'Token recusado pelo Notion';
  if (estado === 'sem-api') return 'Workspace sem a API de agentes';
  if (estado === 'sem-rota') return 'Sem caminho ate a API do Notion';
  return 'Nao consegui verificar o token';
}

function notionPainelEstado(diag, carregando) {
  if (carregando) {
    return `<div class="ia-nt-st">${iaIcone('teste')}<span><b>Verificando o token no Notion…</b>
			So um instante: estou perguntando ao Notion se ele pode executar agentes.</span></div>`;
  }
  if (!diag) {
    return `<div class="ia-nt-st">${iaIcone('plug')}<span><b>Token ainda nao verificado</b>
			Clique em <b>Detectar permissoes</b> para o site checar sozinho se este token executa agentes.</span></div>`;
  }
  const extra = [
    diag.bot ? `integracao: ${diag.bot}` : '',
    diag.workspace ? `workspace: ${diag.workspace}` : '',
    diag.via ? `saida: ${diag.via}` : '',
  ]
  .filter(Boolean)
  .join(' · ');
  return `<div class="ia-nt-st ${notionClasseEstado(diag.estado)}">${iaIcone(
		diag.estado === 'ok' ? 'ok' : 'alerta',
	)}<span><b>${iaEsc(notionRotuloEstado(diag.estado))}</b>${iaEsc(diag.mensagem || '')}
		${extra ? `<small class="dica">${iaEsc(extra)}</small>` : ''}</span></div>`;
}

function iaNotionFormulario(conn) {
  const provs = IA_PROVEDORES.map(
    (p) =>
    `<option value="${p.id}"${p.id === conn.prov ? ' selected' : ''}>${iaEsc(p.nome)}</option>`,
  ).join('');
  const diag = notionDiagCache(conn);
  const agentes = (diag && diag.agentes) || [];
  const escolhido = String(conn.agente || '');
  const opcoes = [`<option value="">Automatico (primeiro agente liberado)</option>`]
  .concat(
    agentes.map(
      (a) =>
      `<option value="${iaEsc(a.id)}"${a.id === escolhido ? ' selected' : ''}>${iaEsc(a.nome)}</option>`,
    ),
  )
  .concat(
    escolhido && !agentes.some((a) => a.id === escolhido)
    ? [
      `<option value="${iaEsc(escolhido)}" selected>${iaEsc(conn.agenteNome || escolhido)}</option>`,
    ]
    : [],
  )
  .join('');
  return `<div class="ia-cfg">
	<div class="ia-sec">${conn.novo ? 'Nova conexao' : 'Conexao com o Notion'}</div>
	<div class="ia-campo"><label for="iaFmProv">Provedor</label>
		<select class="ia-sel" id="iaFmProv">${provs}</select>
		<span class="dica">Conversa com os agentes do seu Notion direto pelo seu token. A API pode exigir o proxy configurado ou o relay do Synapse.</span></div>
	<div class="ia-campo"><label for="iaFmNome">Nome da conexao</label>
		<input class="ia-in" id="iaFmNome" value="${iaEsc(conn.nome)}" placeholder="Ex.: Notion do trabalho"></div>
	<div class="ia-campo"><label for="iaFmChave">Token do Notion</label>
		<div class="ia-row">
			<input class="ia-in" id="iaFmChave" type="password" autocomplete="off" spellcheck="false"
				value="${iaEsc(conn.chave || '')}" placeholder="Informe seu token proprio do Notion">
			<button class="ia-btn" data-ver="1" title="Mostrar/ocultar">${iaIcone('olho')}</button>
		</div>
		<span class="dica">Use um token proprio com acesso aos agentes. Nenhuma credencial acompanha o site.</span></div>
	<label class="ia-chk"><input type="checkbox" id="iaFmGuardar"${conn.guardarChave !== false ? ' checked' : ''}>
		<span>Guardar token neste navegador<small>Desmarque em computador compartilhado: o token some ao fechar a aba.</small></span></label>
	${notionPainelEstado(diag, NOTION_ST.formCarregando)}
	<div class="ia-row" style="margin-top:8px">
		<button class="ia-btn" data-notion-detectar="1">${iaIcone('teste')}Detectar permissoes</button>
	</div>
	<div class="ia-campo" style="margin-top:10px"><label for="iaNtAgente">Agente</label>
		<select class="ia-sel" id="iaNtAgente">${opcoes}</select>
		<span class="dica">A lista aparece depois da deteccao. Cada conversa do chat vira uma sessao do agente no Notion.</span></div>
	<label class="ia-chk"><input type="checkbox" id="iaNtCtx"${conn.contexto !== false ? ' checked' : ''}>
		<span>Mandar o contexto do projeto na primeira mensagem<small>Nome do projeto, arquivo aberto e lista de arquivos.</small></span></label>
	<div class="ia-sec">Avancado</div>
	<div class="ia-campo"><label for="iaFmBase">Proxy da API (opcional)</label>
		<input class="ia-in" id="iaFmBase" value="${iaEsc(conn.base || '')}" spellcheck="false"
			placeholder="https://seu-proxy.exemplo.com (sem /v1 no fim)">
		<span class="dica">Vazio = o site acha o caminho sozinho: /api/notion do proprio site, relay do Synapse ou chamada direta.</span></div>
	<div class="ia-row" style="margin-top:12px">
		<button class="ia-btn pri" data-salvar="1">${iaIcone('ok')}Salvar</button>
		<button class="ia-btn" data-testar="1">${iaIcone('teste')}Testar</button>
		<span class="sp" style="flex:1"></span>
		<button class="ia-btn gh" data-cancelar="1">Voltar</button>
	</div>
	<div class="ia-msg-st" id="iaFmSt"></div>
	<div class="ia-aviso" style="margin-top:10px">${iaIcone('alerta')}
		<span>O agente do Notion responde por texto e usa as ferramentas dele dentro do Notion. Ele nao edita os
		arquivos do projeto: para isso, use uma conexao de IA com chave propria (GPT, Claude, Gemini…).</span></div>
</div>`;
}

function iaNotionLerForm(base) {
  const v = (id) => {
    const n = document.getElementById(id);
    return n ? n.value : '';
  };
  const c = (id) => {
    const n = document.getElementById(id);
    return n ? n.checked : false;
  };
  const sel = document.getElementById('iaNtAgente');
  const agente = sel ? sel.value : String(base.agente || '');
  const agenteNome =
  sel && sel.selectedIndex > 0
  ? sel.options[sel.selectedIndex].text
  : String(base.agenteNome || '');
  return {
    id: base.id,
    prov: v('iaFmProv') || 'notion',
    nome: v('iaFmNome') || 'Notion · Agentes',
    chave: v('iaFmChave'),
    guardarChave: c('iaFmGuardar'),
    formato: 'notion-agents',
    base: v('iaFmBase').trim(),
    modelo: agente ? agenteNome || 'agente do Notion' : 'agente do Notion',
    agente,
    agenteNome: agente ? agenteNome : '',
    contexto: c('iaNtCtx'),
    temp: base.temp,
    maxTokens: base.maxTokens,
    visao: false,
    cabecalhos: base.cabecalhos || '',
    padrao: false,
    notionCredentialVersion: 1,
    criada: base.criada,
  };
}

async function iaNotionDetectarNoForm(forcar) {
  const dados = typeof iaLerForm === 'function' ? iaLerForm() : null;
  const conn = iaNormalizarConexao(dados || { prov: 'notion' });
  conn.novo = !!(IA_UI.edit && IA_UI.edit.novo);
  IA_UI.edit = conn;
  NOTION_ST.formCarregando = true;
  if (typeof iaRenderCfg === 'function') iaRenderCfg();
  try {
    const d = await notionDiagnostico(conn, forcar !== false);
    NOTION_ST.formCarregando = false;
    if (!conn.agente && d.agentes.length === 1) {
      conn.agente = d.agentes[0].id;
      conn.agenteNome = d.agentes[0].nome;
      conn.modelo = d.agentes[0].nome;
      IA_UI.edit = conn;
    }
    if (typeof iaRenderCfg === 'function') iaRenderCfg();
    if (typeof iaFormSt === 'function') {
      iaFormSt(d.mensagem, d.estado === 'ok' ? 'ok' : d.estado === 'sem-agentes' ? '' : 'err');
    }
  } catch (e) {
    NOTION_ST.formCarregando = false;
    if (typeof iaRenderCfg === 'function') iaRenderCfg();
    if (typeof iaFormSt === 'function') iaFormSt(String((e && e.message) || e), 'err');
  }
}

function iaNotionClique(ev) {
  const alvo = ev && ev.target;
  if (!alvo || !alvo.closest) return false;
  if (alvo.closest('[data-notion-detectar]')) {
    iaNotionDetectarNoForm(true);
    return true;
  }
  return false;
}

function iaNotionMudanca(ev) {
  if (!ev || !ev.target || ev.target.id !== 'iaNtAgente') return false;
  const sel = ev.target;
  const atual = IA_UI.edit;
  if (atual) {
    atual.agente = sel.value;
    atual.agenteNome = sel.selectedIndex > 0 ? sel.options[sel.selectedIndex].text : '';
    atual.modelo = atual.agenteNome || 'agente do Notion';
  }
  return true;
}

function iaNotionAoAbrir() {
  let conn = null;
  try {
    conn = typeof iaConexaoAtiva === 'function' ? iaConexaoAtiva() : null;
  } catch (e) {
    ignorarErro(e, 'iaNotionAoAbrir');
  }
  if (!notionEhNotion(conn)) return;
  notionDiagnostico(conn, false)
  .then((d) => {
      if (typeof iaAtualizarBarra === 'function') iaAtualizarBarra();
      if (d.estado === 'ok') return;
      const marca = `${conn.id}|${d.estado}`;
      if (NOTION_ST.avisou[marca]) return;
      NOTION_ST.avisou[marca] = true;
      if (typeof iaSinal === 'function') {
        iaSinal('aviso', { texto: `Notion: ${notionRotuloEstado(d.estado)}. ${d.mensagem}` });
      }
  })
  .catch((e) => ignorarErro(e, 'iaNotionAoAbrir'));
}

if (typeof window !== 'undefined') {
  window.NOTION_IA = {
    tokenPadrao: NOTION_TOKEN_PADRAO,
    versao: NOTION_VERSAO_API,
    estado: NOTION_ST,
    diagnostico: notionDiagnostico,
    agentes: iaNotionListarAgentes,
    pedir: notionPedir,
  };
}
