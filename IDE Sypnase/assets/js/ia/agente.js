'use strict';

const IA_SINAIS = { aoEvento: null };

const IA_CHAT = {
  conversa: null,
  rodando: false,
  controle: null,
  sempre: new Set(),
  pendente: null,
  task: null,
  historyWarning: '',
  stats: { entrada: 0, saida: 0, chamadas: 0, passos: 0, ms: 0 },
};

function iaSinal(evento, dados) {
  try {
    if (typeof IA_SINAIS.aoEvento === 'function') IA_SINAIS.aoEvento(evento, dados || {});
  } catch (e) {
    ignorarErro(e, 'iaSinal');
  }
}

function iaNovaConversa(silencioso) {
  if (IA_CHAT.rodando) return IA_CHAT.conversa;
  IA_CHAT.conversa = {
    id: iaUid(),
    titulo: 'Nova conversa',
    criada: Date.now(),
    atualizada: Date.now(),
    mensagens: [],
  };
  IA_CHAT.stats = { entrada: 0, saida: 0, chamadas: 0, passos: 0, ms: 0 };
  IA_CHAT.sempre = new Set();
  if (!silencioso) iaSinal('conversa', { conversa: IA_CHAT.conversa });
  return IA_CHAT.conversa;
}

function iaConversaAtual() {
  if (!IA_CHAT.conversa) iaNovaConversa(true);
  return IA_CHAT.conversa;
}

function iaHistorico() {
  const lista = iaLerJson(IA_LS.conversas, []);
  return Array.isArray(lista) ? lista : [];
}

function iaSalvarConversa() {
  const conversation = IA_CHAT.conversa;
  if (!conversation?.mensagens.length) return;
  const result = window.SynapseAIConversationHistory.save(conversation, iaHistorico());
  if (result.saved) return;
  const warning = `${conversation.id}|${result.reason}`;
  if (IA_CHAT.historyWarning === warning) return;
  IA_CHAT.historyWarning = warning;
  iaSinal('aviso', {
      texto:
      'Não foi possível salvar esta conversa inteira no navegador. Ela permanece aberta nesta aba; copie o conteúdo importante antes de recarregar. Histórico antigo pode ter atingido o limite de armazenamento.',
  });
}

function iaCarregarConversa(id) {
  if (IA_CHAT.rodando) return null;
  const achada = iaHistorico().find((c) => c.id === id);
  if (!achada) return null;
  IA_CHAT.conversa = window.SynapseAIConversationHistory.restore(achada);
  IA_CHAT.stats = [...(achada.mensagens || [])]
  .reverse()
  .find((message) => message.role === 'summary')?.metrics || {
    entrada: 0,
    saida: 0,
    chamadas: 0,
    passos: 0,
    ms: 0,
  };
  iaSinal('conversa', { conversa: IA_CHAT.conversa, restaurada: true });
  return IA_CHAT.conversa;
}

function iaApagarConversa(id) {
  iaGravarJson(
    IA_LS.conversas,
    iaHistorico().filter((c) => c.id !== id),
  );
  if (IA_CHAT.conversa && IA_CHAT.conversa.id === id) iaNovaConversa();
}

function iaPodar(mensagens) {
  const limite = 6;
  let vistos = 0;
  const fora = [];
  for (let i = mensagens.length - 1; i >= 0; i--) {
    const m = mensagens[i];
    if (m.role === 'tool') {
      vistos++;
      if (vistos > limite) {
        const curto = String(m.texto || '').slice(0, 500);
        fora.unshift({ ...m, texto: curto, imagens: [] });
        continue;
      }
    }
    fora.unshift(m);
  }
  return fora;
}

function iaPararGeracao() {
  if (IA_CHAT.controle) {
    try {
      IA_CHAT.controle.abort();
    } catch (e) {
      ignorarErro(e, 'iaPararGeracao');
    }
  }
  if (IA_CHAT.pendente) {
    IA_CHAT.pendente.resolver('nao');
    IA_CHAT.pendente = null;
  }
}

function iaResponderPermissao(resposta) {
  if (!IA_CHAT.pendente) return;
  const p = IA_CHAT.pendente;
  IA_CHAT.pendente = null;
  if (resposta === 'sempre') IA_CHAT.sempre.add(p.nome);
  p.resolver(resposta === 'nao' ? 'nao' : 'sim');
}

function iaPerguntarPermissao(id, nome, args) {
  return new Promise((resolver) => {
      IA_CHAT.pendente = { id, nome, args, resolver };
      iaSinal('permissao', { id, nome, args, classe: iaFerramentaClasse(nome) });
  });
}

async function iaRodarChamadas(chamadas, onResult = () => {}) {
  const resultados = [];
  for (const chamada of chamadas) {
    const nome = String(chamada.nome || '');
    const args = chamada.args || {};
    iaSinal('ferramenta-inicio', { id: chamada.id, nome, args });
    if (IA_CHAT.controle?.signal.aborted) {
      const canceled = {
        role: 'tool',
        id: chamada.id,
        nome,
        texto: 'Execução interrompida. Esta ferramenta não foi executada.',
        erro: true,
        imagens: [],
        ms: 0,
      };
      resultados.push(canceled);
      onResult(canceled);
      iaSinal('ferramenta-fim', {
          id: chamada.id,
          nome,
          ok: false,
          recusada: true,
          texto: canceled.texto,
      });
      continue;
    }
    const precisa = iaPedeAprovacao(nome) && !IA_CHAT.sempre.has(nome);
    if (precisa) {
      const r = await iaPerguntarPermissao(chamada.id, nome, args);
      if (r === 'nao' || IA_CHAT.controle?.signal.aborted) {
        const recusa = {
          role: 'tool',
          id: chamada.id,
          nome,
          texto: 'O usuario recusou esta acao. Nao repita a mesma chamada; proponha outro caminho.',
          erro: true,
          imagens: [],
          ms: 0,
        };
        resultados.push(recusa);
        onResult(recusa);
        iaSinal('ferramenta-fim', { id: chamada.id, nome, ok: false, recusada: true, texto: '' });
        continue;
      }
    }
    const saida = await iaExecutarFerramenta(nome, args);
    IA_CHAT.task?.countTool();
    resultados.push({
        role: 'tool',
        id: chamada.id,
        nome,
        texto: saida.texto,
        imagens: saida.imagens,
        erro: !saida.ok,
        ms: saida.ms,
    });
    onResult(resultados[resultados.length - 1]);
    iaSinal('ferramenta-fim', {
        id: chamada.id,
        nome,
        ok: saida.ok,
        texto: saida.texto,
        imagens: saida.imagens,
        ms: saida.ms,
    });
  }
  return resultados;
}

async function iaLoop(connection) {
  const conversation = iaConversaAtual();
  const preferences = { ...IA.prefs };
  const settings = window.SynapseAIGenerationSettings.normalize(connection.generation);
  const capabilities = window.SynapseAIModelCapabilities.resolve(connection);
  const maximumSteps = Math.max(1, Math.min(60, Number(preferences.passos) || 24));
  const tools =
  settings.toolsEnabled && capabilities.tools ? iaFerramentasPara(connection.formato) : [];
  const telemetry = IA_CHAT.task;
  for (let step = 1; step <= maximumSteps; step++) {
    if (IA_CHAT.controle?.signal.aborted) {
      throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
    }
    telemetry.beginStep();
    iaSinal('passo', { passo: step, max: maximumSteps });
    iaSinal('assistente-inicio', {
        model: connection.modelo,
        thinking: capabilities.thinkingActive,
        reasoningVisible: capabilities.reasoningVisible,
    });
    let partialText = '';
    let response;
    try {
      response = await iaConversar(
        connection,
        {
          sistema: [iaSistema(), settings.instructions].filter(Boolean).join('\n\n'),
          mensagens: iaPodar(conversation.mensagens),
          ferramentas: tools,
          stream: preferences.stream !== false,
          maxTokens: connection.maxTokens,
          visao: preferences.enviarImagens !== false && connection.visao !== false,
          sinal: IA_CHAT.controle?.signal,
        },
        {
          aoTexto: (delta) => {
            partialText += delta || '';
            iaSinal('texto', { delta });
          },
          aoRaciocinio: (delta, metadata) => {
            const block = telemetry.addReasoning(delta, metadata);
            iaSinal('raciocinio', { delta, block });
          },
          aoRaciocinioFim: (metadata) => {
            for (const block of telemetry.endReasoning(metadata)) {
              iaSinal('raciocinio-fim', { block });
            }
          },
          aoUso: (usage) => telemetry.updateUsage(usage),
          aoFerramenta: (name) => iaSinal('ferramenta-prevista', { nome: name }),
        },
      );
    } catch (error) {
      const metrics = telemetry.closeStep(null, false);
      conversation.mensagens.push({
          role: 'assistant',
          content: partialText,
          reasoning: metrics.reasoning,
          metrics,
          model: connection.modelo,
      });
      iaSinal('assistente-fim', { texto: partialText, chamadas: [], metrics, interrupted: true });
      throw error;
    }
    const metrics = telemetry.closeStep(response.uso);
    const calls = (response.chamadas || []).filter((call) => call && call.nome);
    conversation.mensagens.push({
        role: 'assistant',
        content: response.texto || '',
        chamadas: calls.length ? calls : undefined,
        reasoning: metrics.reasoning,
        metrics,
        providerState: response.providerState,
        model: connection.modelo,
    });
    iaSinal('assistente-fim', { texto: response.texto || '', chamadas: calls, metrics });
    if (!calls.length) {
      if (['length', 'max_tokens', 'MAX_TOKENS'].includes(response.motivo)) {
        iaSinal('aviso', {
            texto:
            'O limite de saída foi atingido. A resposta pode estar incompleta; aumente o limite na aba Modelo.',
        });
      }
      return { motivo: response.motivo || 'fim', passos: step };
    }
    await iaRodarChamadas(calls, (result) => {
        conversation.mensagens.push(result);
        iaSalvarConversa();
    });
    if (IA_CHAT.controle?.signal.aborted) {
      throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
    }
    conversation.atualizada = Date.now();
    iaSalvarConversa();
  }
  iaSinal('aviso', {
      texto: `Limite de ${maximumSteps} passos alcançado. Peça para continuar se ainda faltar algo.`,
  });
  return { motivo: 'limite', passos: maximumSteps };
}

async function iaEnviar(texto, imagens) {
  const conteudo = String(texto || '').trim();
  const figuras = Array.isArray(imagens) ? imagens : [];
  if (!conteudo && !figuras.length) return;
  if (IA_CHAT.rodando) {
    iaSinal('aviso', { texto: 'Aguarde: ja existe uma execucao em andamento.' });
    return;
  }
  const activeConnection = iaConexaoAtiva();
  const conexao = activeConnection
  ? {
    ...activeConnection,
    generation: window.SynapseAIGenerationSettings.normalize(activeConnection.generation),
  }
  : null;
  if (!conexao) {
    iaSinal('erro', {
        texto: 'Nenhuma IA conectada. Abra os ajustes (engrenagem) e conecte um provedor.',
        abrirCfg: true,
    });
    return;
  }
  const conversa = iaConversaAtual();
  if (conversa.titulo === 'Nova conversa' && conteudo) {
    conversa.titulo = conteudo.slice(0, 60);
    iaSinal('titulo', { titulo: conversa.titulo });
  }
  conversa.mensagens.push({ role: 'user', content: conteudo, imagens: figuras });
  iaSinal('usuario', { texto: conteudo, imagens: figuras });
  IA_CHAT.rodando = true;
  IA_CHAT.controle = new AbortController();
  IA_CHAT.task = window.SynapseAITaskTelemetry.create({
      model: conexao.modelo,
      connectionName: conexao.nome,
      onUpdate: (metrics) => {
        IA_CHAT.stats = metrics;
        iaSinal('stats', metrics);
      },
  });
  IA_CHAT.task.publish();
  const telemetryTimer = setInterval(() => IA_CHAT.task?.publish(), 500);
  let taskStatus = 'completed';
  iaSinal('estado', { rodando: true });
  try {
    const fim = await iaLoop(conexao);
    if (fim.motivo === 'limite' || ['length', 'max_tokens', 'MAX_TOKENS'].includes(fim.motivo)) {
      taskStatus = 'limited';
    }
    iaSinal('fim', fim);
  } catch (e) {
    taskStatus = e && e.name === 'AbortError' ? 'interrupted' : 'error';
    if (e && e.name === 'AbortError') {
      iaSinal('aviso', { texto: 'Execucao interrompida por voce.' });
    } else iaSinal('erro', { texto: iaErroAmigavel(e, conexao) });
  } finally {
    clearInterval(telemetryTimer);
    IA_CHAT.rodando = false;
    const metrics = IA_CHAT.task.finish(taskStatus);
    conversa.mensagens.push({ role: 'summary', content: '', metrics });
    iaSinal('task-summary', { metrics });
    IA_CHAT.controle = null;
    IA_CHAT.pendente = null;
    conversa.atualizada = Date.now();
    iaSalvarConversa();
    iaSinal('estado', { rodando: false });
  }
}
