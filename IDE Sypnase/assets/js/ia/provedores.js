'use strict';

const IA_LS = {
  conexoes: 'synapse.ia.conexoes',
  ativa: 'synapse.ia.ativa',
  prefs: 'synapse.ia.prefs',
  ui: 'synapse.ia.ui',
  conversas: 'synapse.ia.conversas',
};

const IA_PROVEDORES = [
  {
    id: 'openai',
    nome: 'OpenAI',
    sigla: 'OA',
    formato: 'openai',
    base: 'https://api.openai.com/v1',
    modelos: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini', 'o4-mini'],
    listaModelos: true,
    visao: true,
    dicaChave: 'sk-…',
    painel: 'platform.openai.com/api-keys',
  },
  {
    id: 'anthropic',
    nome: 'Anthropic · Claude',
    sigla: 'CL',
    formato: 'anthropic',
    base: 'https://api.anthropic.com/v1',
    modelos: [
      'claude-sonnet-4-5',
      'claude-opus-4-1',
      'claude-3-7-sonnet-latest',
      'claude-3-5-haiku-latest',
    ],
    listaModelos: true,
    visao: true,
    dicaChave: 'sk-ant-…',
    painel: 'console.anthropic.com/settings/keys',
    nota: 'O site envia o cabeçalho de acesso direto do navegador exigido pela Anthropic.',
  },
  {
    id: 'gemini',
    nome: 'Google Gemini',
    sigla: 'GG',
    formato: 'gemini',
    base: 'https://generativelanguage.googleapis.com/v1beta',
    modelos: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
    listaModelos: true,
    visao: true,
    dicaChave: 'AIza…',
    painel: 'aistudio.google.com/apikey',
  },
  {
    id: 'openrouter',
    nome: 'OpenRouter',
    sigla: 'OR',
    formato: 'openai',
    base: 'https://openrouter.ai/api/v1',
    modelos: [
      'anthropic/claude-sonnet-4.5',
      'openai/gpt-4.1',
      'google/gemini-2.5-pro',
      'deepseek/deepseek-chat',
      'meta-llama/llama-3.3-70b-instruct',
    ],
    listaModelos: true,
    visao: true,
    dicaChave: 'sk-or-…',
    painel: 'openrouter.ai/keys',
  },
  {
    id: 'groq',
    nome: 'Groq',
    sigla: 'GQ',
    formato: 'openai',
    base: 'https://api.groq.com/openai/v1',
    modelos: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'qwen-2.5-coder-32b'],
    listaModelos: true,
    visao: false,
    dicaChave: 'gsk_…',
    painel: 'console.groq.com/keys',
  },
  {
    id: 'deepseek',
    nome: 'DeepSeek',
    sigla: 'DS',
    formato: 'openai',
    base: 'https://api.deepseek.com/v1',
    modelos: ['deepseek-chat', 'deepseek-reasoner'],
    listaModelos: true,
    visao: false,
    dicaChave: 'sk-…',
    painel: 'platform.deepseek.com/api_keys',
  },
  {
    id: 'mistral',
    nome: 'Mistral',
    sigla: 'MI',
    formato: 'openai',
    base: 'https://api.mistral.ai/v1',
    modelos: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest'],
    listaModelos: true,
    visao: false,
    dicaChave: '…',
    painel: 'console.mistral.ai/api-keys',
  },
  {
    id: 'xai',
    nome: 'xAI · Grok',
    sigla: 'XA',
    formato: 'openai',
    base: 'https://api.x.ai/v1',
    modelos: ['grok-4', 'grok-3', 'grok-3-mini'],
    listaModelos: true,
    visao: true,
    dicaChave: 'xai-…',
    painel: 'console.x.ai',
  },
  {
    id: 'ollama',
    nome: 'Ollama (local)',
    sigla: 'OL',
    formato: 'openai',
    base: 'http://127.0.0.1:11434/v1',
    modelos: ['qwen2.5-coder:14b', 'llama3.1:8b'],
    listaModelos: true,
    visao: false,
    semChave: true,
    nota: 'Rode o Ollama com OLLAMA_ORIGINS=* para o navegador conseguir chamar.',
  },
  {
    id: 'lmstudio',
    nome: 'LM Studio (local)',
    sigla: 'LM',
    formato: 'openai',
    base: 'http://127.0.0.1:1234/v1',
    modelos: [],
    listaModelos: true,
    visao: false,
    semChave: true,
    nota: 'Ligue o servidor local do LM Studio e habilite CORS nas configurações dele.',
  },
  {
    id: 'notion',
    nome: 'Notion · Agentes',
    sigla: 'NT',
    formato: 'notion-agents',
    base: '',
    modelos: [],
    listaModelos: false,
    visao: false,
    dicaChave: 'ntn_…',
    painel: 'notion.so/profile/integrations',
    nota: 'Conversa com os agentes do seu Notion pelo token, sem MCP. O site testa o token e avisa se ele não puder executar agentes.',
  },
  {
    id: 'custom',
    nome: 'API própria / compatível',
    sigla: 'API',
    formato: 'openai',
    base: '',
    modelos: [],
    listaModelos: true,
    visao: true,
    livre: true,
    nota: 'Qualquer endpoint compatível com OpenAI, Anthropic ou Gemini. Escolha o formato abaixo.',
  },
];

const IA_FORMATOS = [
  { id: 'openai', nome: 'OpenAI /chat/completions' },
  { id: 'anthropic', nome: 'Anthropic /messages' },
  { id: 'gemini', nome: 'Gemini generateContent' },
  { id: 'notion-agents', nome: 'Notion · sessões de agente' },
];

const IA_PREFS_PADRAO = {
  modo: 'pedir',
  passos: 24,
  stream: true,
  enviarImagens: true,
  temp: 0.2,
  maxTokens: 8192,
};

const IA = {
  conexoes: [],
  ativa: '',
  prefs: { ...IA_PREFS_PADRAO },
  chavesVolateis: {},
  modelosCache: {},
  pronto: false,
};

function iaUid() {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function iaProvedor(id) {
  return IA_PROVEDORES.find((p) => p.id === id) || IA_PROVEDORES[IA_PROVEDORES.length - 1];
}

function iaLerJson(chave, alternativa) {
  try {
    const bruto = localStorage.getItem(chave);
    if (!bruto) return alternativa;
    const valor = JSON.parse(bruto);
    return valor == null ? alternativa : valor;
  } catch (e) {
    ignorarErro(e, 'iaLerJson');
    return alternativa;
  }
}

function iaGravarJson(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch (e) {
    ignorarErro(e, 'iaGravarJson');
  }
}

function iaNormalizarConexao(bruta) {
  const prov = iaProvedor(bruta && bruta.prov);
  const c = {
    id: (bruta && bruta.id) || iaUid(),
    prov: prov.id,
    nome: String((bruta && bruta.nome) || prov.nome).slice(0, 60),
    formato: String((bruta && bruta.formato) || prov.formato),
    base: String((bruta && bruta.base) || prov.base || '').replace(/\/+$/, ''),
    modelo: String((bruta && bruta.modelo) || prov.modelos[0] || ''),
    chave: String((bruta && bruta.chave) || ''),
    guardarChave: (bruta && bruta.guardarChave) !== false,
    cabecalhos: String((bruta && bruta.cabecalhos) || ''),
    temp: Number((bruta && bruta.temp) != null ? bruta.temp : IA.prefs.temp),
    maxTokens: Number((bruta && bruta.maxTokens) || IA.prefs.maxTokens),
    visao: (bruta && bruta.visao) != null ? !!bruta.visao : !!prov.visao,
    agente: String((bruta && bruta.agente) || ''),
    agenteNome: String((bruta && bruta.agenteNome) || ''),
    contexto: (bruta && bruta.contexto) !== false,
    padrao: !!(bruta && bruta.padrao),
    notionCredentialVersion: bruta?.notionCredentialVersion === 1 ? 1 : 0,
    criada: (bruta && bruta.criada) || Date.now(),
    generation: window.SynapseAIGenerationSettings.normalize(bruta && bruta.generation),
  };
  if (!IA_FORMATOS.some((f) => f.id === c.formato)) c.formato = 'openai';
  if (!isFinite(c.temp) || c.temp < 0) c.temp = 0.2;
  c.temp = Math.min(2, c.temp);
  if (!isFinite(c.maxTokens) || c.maxTokens < 256) c.maxTokens = 4096;
  c.modelMetadata = window.SynapseAIModelCapabilities.metadata({
      ...c,
      modelMetadata: bruta?.modelMetadata,
  });
  return c;
}

function iaCarregar() {
  if (IA.pronto) return IA;
  const lista = iaLerJson(IA_LS.conexoes, []);
  IA.conexoes = (Array.isArray(lista) ? lista : []).map(iaNormalizarConexao);
  IA.prefs = { ...IA_PREFS_PADRAO, ...iaLerJson(IA_LS.prefs, {}) };
  try {
    IA.ativa = localStorage.getItem(IA_LS.ativa) || '';
  } catch (e) {
    ignorarErro(e, 'iaCarregar');
  }
  try {
    const volateis = JSON.parse(sessionStorage.getItem(IA_LS.conexoes) || '{}');
    if (volateis && typeof volateis === 'object') IA.chavesVolateis = volateis;
  } catch (e) {
    ignorarErro(e, 'iaCarregar');
  }
  if (typeof iaNotionSemear === 'function') iaNotionSemear();
  if (!IA.conexoes.some((c) => c.id === IA.ativa)) {
    IA.ativa = IA.conexoes.length ? IA.conexoes[0].id : '';
  }
  IA.pronto = true;
  return IA;
}

function iaSalvar() {
  const paraDisco = IA.conexoes.map((c) => ({
        ...c,
        chave: c.guardarChave ? c.chave : '',
        modelMetadata: window.SynapseAIModelCapabilities.metadata(c),
  }));
  iaGravarJson(IA_LS.conexoes, paraDisco);
  iaGravarJson(IA_LS.prefs, IA.prefs);
  try {
    localStorage.setItem(IA_LS.ativa, IA.ativa || '');
    sessionStorage.setItem(IA_LS.conexoes, JSON.stringify(IA.chavesVolateis || {}));
  } catch (e) {
    ignorarErro(e, 'iaSalvar');
  }
}

function iaConexaoAtiva() {
  iaCarregar();
  return IA.conexoes.find((c) => c.id === IA.ativa) || null;
}

function iaDefinirAtiva(id) {
  iaCarregar();
  if (!IA.conexoes.some((c) => c.id === id)) return null;
  IA.ativa = id;
  iaSalvar();
  return iaConexaoAtiva();
}

function iaSalvarConexao(bruta) {
  iaCarregar();
  const c = iaNormalizarConexao(bruta);
  const i = IA.conexoes.findIndex((x) => x.id === c.id);
  if (i >= 0) IA.conexoes[i] = c;
  else IA.conexoes.push(c);
  if (!c.guardarChave && c.chave) IA.chavesVolateis[c.id] = c.chave;
  else delete IA.chavesVolateis[c.id];
  if (!IA.ativa) IA.ativa = c.id;
  iaSalvar();
  return c;
}

function iaRemoverConexao(id) {
  iaCarregar();
  const alvo = IA.conexoes.find((c) => c.id === id);
  if (typeof iaNotionMarcarPadraoRemovido === 'function') iaNotionMarcarPadraoRemovido(alvo);
  IA.conexoes = IA.conexoes.filter((c) => c.id !== id);
  delete IA.chavesVolateis[id];
  if (IA.ativa === id) IA.ativa = IA.conexoes.length ? IA.conexoes[0].id : '';
  iaSalvar();
}

function iaChaveDe(conexao) {
  if (!conexao) return '';
  if (conexao.chave) return conexao.chave;
  return (IA.chavesVolateis && IA.chavesVolateis[conexao.id]) || '';
}

function iaCabecalhosExtras(conexao) {
  const fora = {};
  const texto = String((conexao && conexao.cabecalhos) || '').trim();
  if (!texto) return fora;
  texto.split(/[\n;]+/).forEach((linha) => {
      const corte = linha.indexOf(':');
      if (corte <= 0) return;
      const nome = linha.slice(0, corte).trim();
      const valor = linha.slice(corte + 1).trim();
      if (nome && valor) fora[nome] = valor;
  });
  return fora;
}

function iaBaseDe(conexao) {
  const prov = iaProvedor(conexao && conexao.prov);
  const base = String((conexao && conexao.base) || prov.base || '').replace(/\/+$/, '');
  if (!base) {
    throw new Error('Esta conexão está sem URL base. Abra os ajustes e informe o endereço da API.');
  }
  return base;
}

function iaCabecalhos(conexao, formato) {
  const chave = iaChaveDe(conexao);
  const h = { 'content-type': 'application/json' };
  const prov = iaProvedor(conexao && conexao.prov);
  if (formato === 'anthropic') {
    if (chave) h['x-api-key'] = chave;
    h['anthropic-version'] = '2023-06-01';
    h['anthropic-dangerous-direct-browser-access'] = 'true';
  } else if (formato === 'gemini') {
    if (chave) h['x-goog-api-key'] = chave;
  } else {
    if (chave) h.authorization = `Bearer ${chave}`;
    if (prov.id === 'openrouter') {
      h['x-title'] = 'Synapse Live Preview';
      h['http-referer'] = window.location.origin || 'https://synapse.local';
    }
  }
  return { ...h, ...iaCabecalhosExtras(conexao) };
}

function iaPrecisaChave(conexao) {
  const prov = iaProvedor(conexao && conexao.prov);
  if (prov.semChave) return false;
  if (prov.id === 'notion' || conexao?.formato === 'notion-agents') return true;
  const base = String((conexao && conexao.base) || '');
  if (/^https?:\/\/(127\.0\.0\.1|localhost|0\.0\.0\.0|\[::1\])/i.test(base)) return false;
  return true;
}

async function iaListarModelos(conexao) {
  const formato = (conexao && conexao.formato) || 'openai';
  if (formato === 'notion-agents') return iaNotionListarAgentes(conexao);
  const base = iaBaseDe(conexao);
  const cabecalhos = iaCabecalhos(conexao, formato);
  const alvo = formato === 'gemini' ? `${base}/models` : `${base}/models`;
  const resposta = await fetch(alvo, { method: 'GET', headers: cabecalhos });
  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => '');
    throw new Error(`${resposta.status} ${resposta.statusText} ${corpo.slice(0, 220)}`.trim());
  }
  const dados = await resposta.json();
  window.SynapseAIModelCapabilities.remember(conexao, dados.data || dados.models || []);
  let nomes = [];
  if (Array.isArray(dados.data)) nomes = dados.data.map((m) => m.id || m.name);
  else if (Array.isArray(dados.models)) {
    nomes = dados.models.map((m) => String(m.name || m.id || '').replace(/^models\//, ''));
      }
      nomes = nomes.filter(Boolean).sort();
      if (conexao && conexao.id) IA.modelosCache[conexao.id] = nomes;
      if (IA.conexoes.some((connection) => connection.id === conexao?.id)) iaSalvar();
      return nomes;
    }

    async function iaTestarConexao(conexao) {
      if (conexao && conexao.formato === 'notion-agents') return iaNotionTestar(conexao);
      const capabilities = window.SynapseAIModelCapabilities.resolve(conexao);
      const generation = window.SynapseAIGenerationSettings.normalize({
          ...conexao.generation,
          thinking: capabilities.thinkingRequired ? 'auto' : 'disabled',
          reasoningEffort: capabilities.efforts.includes('low') ? 'low' : 'auto',
          reasoningControl: 'effort',
      });
      const inicio = Date.now();
      const resposta = await iaConversar(
        { ...conexao, generation },
        {
          sistema: 'Responda somente com a palavra OK.',
          mensagens: [{ role: 'user', content: 'ping' }],
          ferramentas: [],
          stream: false,
          maxTokens: capabilities.thinkingRequired ? 1024 : 32,
        },
        {},
      );
      return {
        ms: Date.now() - inicio,
        texto:
        String(resposta.texto || '')
        .trim()
        .slice(0, 80) || '(sem texto)',
        uso: resposta.uso,
      };
    }

    window.IA = IA;
    window.IA_PROVEDORES = IA_PROVEDORES;
