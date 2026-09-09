'use strict';

const IA_FER_COMANDO = new Set([
    'run_command',
    'command_output',
    'stop_command',
    'start_dev_server',
    'stop_dev_server',
    'dev_server_status',
    'deploy_static',
    'undeploy_static',
]);

const IA_FER_DESTRUTIVA = new Set([
    'delete',
    'restore_snapshot',
    'restore_version',
    'reset_state',
    'rename',
    'team_delete',
    'undeploy_static',
]);

const IA_FER_ESSENCIAL = [
  'project_status',
  'list_projects',
  'create_project',
  'list_files',
  'read_file',
  'read_files',
  'outline',
  'search',
  'write_file',
  'write_files',
  'create_file',
  'edit_file',
  'delete',
  'rename',
  'check_syntax',
  'wait_for_errors',
  'console_logs',
  'refresh_preview',
  'screenshot_preview',
  'screenshot_burst',
  'query_dom',
  'ui_map',
  'interact',
  'eval_js',
  'wait_for',
  'assert_state',
  'run_scenario',
  'set_viewport',
  'network_log',
  'perf_stats',
  'audio_status',
  'add_asset_from_url',
  'snapshot_project',
  'list_snapshots',
  'restore_snapshot',
  'diff_file',
  'list_versions',
  'restore_version',
  'run_command',
  'command_output',
  'export_zip',
  'help',
];

const IA_LIMITE_TEXTO = 24000;

function iaConjunto() {
  iaCarregar();
  return IA.prefs.conjunto === 'essencial' ? 'essencial' : 'completo';
}

function iaFerramentasBrutas() {
  if (typeof MCP_TOOLS === 'undefined' || !Array.isArray(MCP_TOOLS)) return [];
  try {
    if (typeof agEnsureProps === 'function') agEnsureProps();
  } catch (e) {
    ignorarErro(e, 'iaFerramentasBrutas');
  }
  let temCompl = false;
  try {
    temCompl = typeof termTemComplemento === 'function' ? termTemComplemento() : false;
  } catch (e) {
    ignorarErro(e, 'iaFerramentasBrutas');
  }
  const oculta =
  typeof MCP_TOOLS_COMPL !== 'undefined' && MCP_TOOLS_COMPL
  ? MCP_TOOLS_COMPL
  : { has: () => false };
  const conjunto = iaConjunto();
  const filtro = conjunto === 'essencial' ? new Set(IA_FER_ESSENCIAL) : null;
  return MCP_TOOLS.filter((t) => t && t.name && (temCompl || !oculta.has(t.name)))
  .filter((t) => !filtro || filtro.has(t.name))
  .map((t) => ({
        name: t.name,
        title: t.title || t.name,
        desc: String(t.desc || t.title || t.name),
        schema: t.schema || { type: 'object', properties: {} },
  }));
}

function iaFerramentaClasse(nome) {
  if (IA_FER_COMANDO.has(nome)) return 'comando';
  if (IA_FER_DESTRUTIVA.has(nome)) return 'destrutiva';
  const escreve =
  typeof AG_WRITE !== 'undefined' && AG_WRITE && typeof AG_WRITE.has === 'function'
  ? AG_WRITE.has(nome)
  : /^(write|create|edit|delete|rename|restore|snapshot|add_asset|deploy|team_|msg_|post_)/.test(
    nome,
  );
  return escreve ? 'escrita' : 'leitura';
}

function iaPedeAprovacao(nome) {
  iaCarregar();
  const modo = IA.prefs.modo;
  if (modo === 'auto') return false;
  const classe = iaFerramentaClasse(nome);
  if (modo === 'tudo') return true;
  if (modo === 'leitura') return classe !== 'leitura';
  return classe === 'comando' || classe === 'destrutiva';
}

function iaLimparEsquema(no, profundidade) {
  const nivel = profundidade || 0;
  if (!no || typeof no !== 'object' || nivel > 8) return { type: 'string' };
  if (Array.isArray(no)) return { type: 'string' };
  const fora = {};
  const manter = [
    'type',
    'description',
    'enum',
    'items',
    'properties',
    'required',
    'default',
    'minimum',
    'maximum',
    'anyOf',
    'oneOf',
  ];
  manter.forEach((k) => {
      if (no[k] === undefined) return;
      if (k === 'properties' && no.properties && typeof no.properties === 'object') {
        const props = {};
        Object.keys(no.properties).forEach((p) => {
            props[p] = iaLimparEsquema(no.properties[p], nivel + 1);
        });
        fora.properties = props;
        return;
      }
      if (k === 'items') {
        fora.items = iaLimparEsquema(no.items, nivel + 1);
        return;
      }
      if ((k === 'anyOf' || k === 'oneOf') && Array.isArray(no[k])) {
        fora[k] = no[k].map((v) => iaLimparEsquema(v, nivel + 1));
        return;
      }
      fora[k] = no[k];
  });
  if (!fora.type && !fora.anyOf && !fora.oneOf) fora.type = fora.properties ? 'object' : 'string';
  if (fora.type === 'object' && !fora.properties) fora.properties = {};
  return fora;
}

function iaEsquemaGemini(no, profundidade) {
  const nivel = profundidade || 0;
  const limpo = iaLimparEsquema(no, nivel);
  const fora = {};
  const tipo = Array.isArray(limpo.type) ? limpo.type[0] : limpo.type;
  fora.type = String(tipo || 'string').toUpperCase();
  if (fora.type === 'INT' || fora.type === 'INTEGER') fora.type = 'INTEGER';
  if (limpo.description) fora.description = String(limpo.description).slice(0, 900);
  if (Array.isArray(limpo.enum) && limpo.enum.length) {
    fora.enum = limpo.enum.map(String);
    fora.type = 'STRING';
  }
  if (fora.type === 'ARRAY')
  fora.items = iaEsquemaGemini(limpo.items || { type: 'string' }, nivel + 1);
  if (fora.type === 'OBJECT') {
    const props = {};
    const origem = limpo.properties || {};
    Object.keys(origem).forEach((p) => {
        props[p] = iaEsquemaGemini(origem[p], nivel + 1);
    });
    if (Object.keys(props).length) {
      fora.properties = props;
      if (Array.isArray(limpo.required) && limpo.required.length) {
        fora.required = limpo.required.filter((r) => props[r]);
      }
    } else {
      fora.type = 'STRING';
      fora.description = fora.description || 'objeto vazio';
    }
  }
  return fora;
}

function iaFerramentasPara(formato) {
  if (formato === 'notion-agents') return [];
  const brutas = iaFerramentasBrutas();
  if (formato === 'anthropic') {
    return brutas.map((t) => ({
          name: t.name,
          description: t.desc.slice(0, 1400),
          input_schema: iaLimparEsquema(t.schema),
    }));
  }
  if (formato === 'gemini') {
    return [
      {
        functionDeclarations: brutas.map((t) => {
            const esquema = iaEsquemaGemini(t.schema);
            const decl = { name: t.name, description: t.desc.slice(0, 1000) };
            if (esquema.type === 'OBJECT' && esquema.properties) decl.parameters = esquema;
            return decl;
        }),
      },
    ];
  }
  return brutas.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.desc.slice(0, 1400),
          parameters: iaLimparEsquema(t.schema),
        },
  }));
}

function iaResumoFerramentas() {
  const brutas = iaFerramentasBrutas();
  let escrita = 0;
  let comando = 0;
  brutas.forEach((t) => {
      const c = iaFerramentaClasse(t.name);
      if (c === 'comando') comando++;
      else if (c !== 'leitura') escrita++;
  });
  return { total: brutas.length, escrita, comando, leitura: brutas.length - escrita - comando };
}

function iaCortar(texto, limite) {
  const max = limite || IA_LIMITE_TEXTO;
  const t = String(texto == null ? '' : texto);
  if (t.length <= max) return t;
  return `${t.slice(0, max)}\n\n… [resultado cortado: ${t.length - max} caracteres a mais. Refine a chamada, use outline/search ou leia por trechos.]`;
}

async function iaExecutarFerramenta(nome, argumentos) {
  const inicio = Date.now();
  const args = argumentos && typeof argumentos === 'object' ? argumentos : {};
  try {
    if (typeof mcpToolCall !== 'function') throw new Error('Ponte MCP indisponível nesta página.');
    const saida = await mcpToolCall({ name: nome, arguments: args });
    const partes = (saida && saida.content) || [];
    const textos = [];
    const imagens = [];
    partes.forEach((p) => {
        if (!p) return;
        if (p.type === 'text') textos.push(String(p.text || ''));
        else if (p.type === 'image' && p.data) {
          imagens.push({ data: String(p.data), mime: p.mimeType || 'image/png' });
        } else if (p.type === 'resource' && p.resource) {
          textos.push(String(p.resource.text || p.resource.uri || ''));
        } else textos.push(JSON.stringify(p));
    });
    const erro = !!(saida && saida.isError);
    let texto = textos.join('\n').trim();
    if (!texto && imagens.length) texto = `[${imagens.length} imagem(ns) anexada(s) ao resultado]`;
    if (!texto) texto = erro ? 'Erro sem detalhes.' : 'OK (sem saída).';
    return { ok: !erro, texto: iaCortar(texto), imagens, ms: Date.now() - inicio };
  } catch (e) {
    return {
      ok: false,
      texto: `Erro: ${(e && e.message) || e}`,
      imagens: [],
      ms: Date.now() - inicio,
    };
  }
}

function iaContexto() {
  const ctx = {
    projeto: '',
    projetoId: '',
    arquivos: 0,
    aberto: '',
    projetos: 0,
    tema: '',
    terminal: false,
    dispositivo: '',
  };
  try {
    const p = typeof activeProject === 'function' ? activeProject() : null;
    Object.assign(ctx, window.SynapseAIProjectContext.describe(p));
    if (typeof State !== 'undefined' && State) {
      ctx.projetos = Array.isArray(State.projects) ? State.projects.length : 0;
      ctx.dispositivo = State.device || '';
    }
    ctx.tema = document.documentElement.getAttribute('data-theme') || '';
    ctx.terminal = typeof termTemComplemento === 'function' ? !!termTemComplemento() : false;
  } catch (e) {
    ignorarErro(e, 'iaContexto');
  }
  return ctx;
}

function iaListaArquivos(limite) {
  try {
    const p = typeof activeProject === 'function' ? activeProject() : null;
    return window.SynapseAIProjectContext.sample(p, limite);
  } catch (e) {
    ignorarErro(e, 'iaListaArquivos');
    return [];
  }
}

function iaSistema() {
  const ctx = iaContexto();
  const res = iaResumoFerramentas();
  const base =
  typeof MCP_INSTRUCTIONS === 'string' && MCP_INSTRUCTIONS
  ? MCP_INSTRUCTIONS
  : 'Editor de projetos web com preview ao vivo.';
  const arquivos = iaListaArquivos(40);
  const linhas = [
    'Voce e o assistente de desenvolvimento embutido no Synapse Live Preview, operando DENTRO do',
    'editor do usuario, no navegador dele. Voce tem as mesmas ferramentas de um cliente MCP',
    'externo e deve usa-las para agir de verdade, nao apenas descrever o que faria.',
    '',
    '== Ambiente ==',
    base,
    '',
    '== Estado atual ==',
    `Projeto ativo: ${ctx.projeto || '(nenhum)'}${ctx.projetoId ? ` [id ${ctx.projetoId}]` : ''}`,
    `Arquivos no projeto: ${ctx.arquivos} | Projetos abertos: ${ctx.projetos}`,
    `Arquivo aberto no editor: ${ctx.aberto || '(nenhum)'}`,
    `Viewport do preview: ${ctx.dispositivo || 'padrao'} | Tema do editor: ${ctx.tema || '-'}`,
    `Terminal/relay: ${ctx.terminal ? 'disponivel' : 'INDISPONIVEL (run_command e dev server vao falhar)'}`,
    `Ferramentas ligadas: ${res.total} (${res.leitura} leitura, ${res.escrita} escrita, ${res.comando} terminal)`,
    arquivos.length ? `Amostra de arquivos: ${arquivos.join(', ')}` : '',
    '',
    '== Regras de trabalho ==',
    '1. Antes de editar, leia. Use outline/read_file/search para localizar o trecho exato.',
    '2. Prefira edit_file com edits=[{old_str,new_str}] em lote; use write_file so para arquivos novos ou reescritas totais.',
    '3. Depois de mudanca visual, confira com screenshot_preview; depois de mudanca de logica, use console_logs ou wait_for_errors.',
    '4. Caminhos sao relativos, sem barra inicial. Nao invente arquivos: liste antes.',
    '5. Faca snapshot_project antes de refactors grandes.',
    '6. Uma ferramenta por vez quando o resultado influencia o passo seguinte; agrupe quando forem independentes.',
    '7. Responda em portugues do Brasil, direto e tecnico, sem enrolacao e sem repetir o resultado bruto das ferramentas.',
    '8. Termine com um resumo curto do que mudou e o que o usuario deve conferir no preview.',
  ].filter(Boolean);
  return linhas.join('\n');
}
