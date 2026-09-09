'use strict';

function iaErroAmigavel(erro, conexao) {
  const msg = String((erro && erro.message) || erro || 'falha desconhecida');
  const nome = (conexao && conexao.nome) || 'provedor';
  if (/abort/i.test(msg)) return 'Geracao interrompida.';
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return (
      `Nao foi possivel falar com ${nome}. Isso quase sempre e CORS ou rede: confirme a URL ` +
      'base, se o provedor aceita chamadas direto do navegador e se o servico local esta ligado.'
    );
  }
  if (/^401|invalid.?api.?key|unauthorized/i.test(msg)) {
    return `Chave rejeitada por ${nome} (401). Revise a chave nos ajustes da conexao.`;
  }
  if (/^403/.test(msg)) return `Acesso negado por ${nome} (403). A chave pode nao ter permissao.`;
  if (/^404/.test(msg)) {
    return `Endpoint ou modelo inexistente em ${nome} (404). Revise a URL base e o nome do modelo.`;
  }
  if (/^429|rate.?limit|quota/i.test(msg)) {
    return `Limite de uso atingido em ${nome} (429). Aguarde um instante ou troque de modelo.`;
  }
  if (/^5\d\d/.test(msg)) return `${nome} respondeu com erro do servidor. Tente novamente.`;
  return msg;
}

async function iaLerSSE(response, onEvent) {
  return window.SynapseAIStreamReader.read(response, onEvent);
}

async function iaFalhaHttp(resposta) {
  const bruto = await resposta.text().catch(() => '');
  let detalhe = bruto.slice(0, 400);
  try {
    const j = JSON.parse(bruto);
    const e = j.error || j;
    detalhe = String(e.message || e.error || detalhe).slice(0, 400);
  } catch (e) {
    ignorarErro(e, 'iaFalhaHttp');
  }
  return new Error(`${resposta.status} ${detalhe}`.trim());
}

function iaImagemUrl(img) {
  return `data:${img.mime || 'image/png'};base64,${img.data}`;
}

function iaMsgsOpenAI(pedido, connection) {
  const fora = [{ role: 'system', content: pedido.sistema }];
  const comVisao = pedido.visao !== false;
  pedido.mensagens.forEach((m) => {
      if (m.role === 'user') {
        const imgs = comVisao ? m.imagens || [] : [];
        if (!imgs.length) {
          fora.push({ role: 'user', content: String(m.content || '') });
          return;
        }
        const partes = [{ type: 'text', text: String(m.content || '') }];
        imgs.forEach((i) => partes.push({ type: 'image_url', image_url: { url: iaImagemUrl(i) } }));
        fora.push({ role: 'user', content: partes });
        return;
      }
      if (m.role === 'assistant') {
        const saved = connection ? window.SynapseAIProviderProtocol.restore(m, connection) : null;
        const msg = { ...(saved || {}), role: 'assistant', content: m.content || '' };
        if (m.chamadas && m.chamadas.length) {
          msg.tool_calls = m.chamadas.map((c) => ({
                id: c.id,
                type: 'function',
                function: { name: c.nome, arguments: JSON.stringify(c.args || {}) },
          }));
          if (!msg.content) msg.content = null;
        }
        fora.push(msg);
        return;
      }
      if (m.role === 'tool') {
        fora.push({ role: 'tool', tool_call_id: m.id, content: m.texto || '' });
        if (comVisao && m.imagens && m.imagens.length) {
          const partes = [{ type: 'text', text: `Imagem devolvida por ${m.nome}:` }];
          m.imagens.forEach((i) => {
              partes.push({ type: 'image_url', image_url: { url: iaImagemUrl(i) } });
          });
          fora.push({ role: 'user', content: partes });
        }
      }
  });
  return fora;
}

function iaMsgsAnthropic(pedido, connection) {
  const fora = [];
  const comVisao = pedido.visao !== false;
  const blocoImg = (i) => ({
      type: 'image',
      source: { type: 'base64', media_type: i.mime || 'image/png', data: i.data },
  });
  pedido.mensagens.forEach((m) => {
      if (m.role === 'user') {
        const partes = [];
        if (comVisao) (m.imagens || []).forEach((i) => partes.push(blocoImg(i)));
        partes.push({ type: 'text', text: String(m.content || '') });
        fora.push({ role: 'user', content: partes });
        return;
      }
      if (m.role === 'assistant') {
        const saved = connection ? window.SynapseAIProviderProtocol.restore(m, connection) : null;
        if (Array.isArray(saved?.blocks)) {
          fora.push({ role: 'assistant', content: saved.blocks });
          return;
        }
        const partes = [];
        if (m.content) partes.push({ type: 'text', text: m.content });
        (m.chamadas || []).forEach((c) => {
            partes.push({ type: 'tool_use', id: c.id, name: c.nome, input: c.args || {} });
        });
        if (partes.length) fora.push({ role: 'assistant', content: partes });
        return;
      }
      if (m.role === 'tool') {
        const conteudo = [{ type: 'text', text: m.texto || 'OK' }];
        if (comVisao) (m.imagens || []).forEach((i) => conteudo.push(blocoImg(i)));
        const bloco = { type: 'tool_result', tool_use_id: m.id, content: conteudo };
        if (m.erro) bloco.is_error = true;
        const ultima = fora[fora.length - 1];
        if (ultima && ultima.role === 'user' && Array.isArray(ultima.content)) {
          ultima.content.push(bloco);
        } else fora.push({ role: 'user', content: [bloco] });
      }
  });
  return fora;
}

function iaMsgsGemini(pedido, connection) {
  const fora = [];
  const comVisao = pedido.visao !== false;
  pedido.mensagens.forEach((m) => {
      if (m.role === 'user') {
        const partes = [{ text: String(m.content || '') }];
        if (comVisao) {
          (m.imagens || []).forEach((i) => {
              partes.push({ inlineData: { mimeType: i.mime || 'image/png', data: i.data } });
          });
        }
        fora.push({ role: 'user', parts: partes });
        return;
      }
      if (m.role === 'assistant') {
        const saved = connection ? window.SynapseAIProviderProtocol.restore(m, connection) : null;
        if (Array.isArray(saved?.parts)) {
          fora.push({ role: 'model', parts: saved.parts });
          return;
        }
        const partes = [];
        if (m.content) partes.push({ text: m.content });
        (m.chamadas || []).forEach((c) => {
            partes.push({ functionCall: { name: c.nome, args: c.args || {} } });
        });
        if (partes.length) fora.push({ role: 'model', parts: partes });
        return;
      }
      if (m.role === 'tool') {
        const partes = [
          { functionResponse: { name: m.nome, response: { resultado: m.texto || 'OK' } } },
        ];
        if (comVisao) {
          (m.imagens || []).forEach((i) => {
              partes.push({ inlineData: { mimeType: i.mime || 'image/png', data: i.data } });
          });
        }
        const ultima = fora[fora.length - 1];
        if (ultima && ultima.role === 'user' && ultima.parts[0] && ultima.parts[0].functionResponse) {
          ultima.parts = ultima.parts.concat(partes);
        } else fora.push({ role: 'user', parts: partes });
      }
  });
  return fora;
}

function iaJuntarArgs(bruto) {
  if (!bruto) return {};
  if (typeof bruto === 'object') return bruto;
  try {
    const v = JSON.parse(bruto);
    return v && typeof v === 'object' ? v : {};
  } catch (e) {
    ignorarErro(e, 'iaJuntarArgs');
    return {};
  }
}

async function iaChamarOpenAI(connection, request, hooks) {
  return window.SynapseAIOpenAIProvider.converse(connection, request, hooks);
}

async function iaChamarAnthropic(connection, request, hooks) {
  return window.SynapseAIAnthropicProvider.converse(connection, request, hooks);
}

async function iaChamarGemini(connection, request, hooks) {
  return window.SynapseAIGeminiProvider.converse(connection, request, hooks);
}

function iaUso(raw) {
  return window.SynapseAIProviderUsage.normalize(raw);
}

async function iaConversar(conexao, pedido, ganchos) {
  if (!conexao) throw new Error('Nenhuma IA conectada. Abra os ajustes e adicione uma conexao.');
  if ((conexao.formato || '') === 'notion-agents') {
    return iaChamarNotion(conexao, pedido, ganchos || {});
  }
  if (!conexao.modelo) throw new Error('Escolha um modelo para esta conexao nos ajustes.');
  if (iaPrecisaChave(conexao) && !iaChaveDe(conexao)) {
    throw new Error('Chave de API ausente. Abra os ajustes da conexao e informe a chave.');
  }
  const g = ganchos || {};
  const formato = conexao.formato || 'openai';
  try {
    if (formato === 'anthropic') return await iaChamarAnthropic(conexao, pedido, g);
    if (formato === 'gemini') return await iaChamarGemini(conexao, pedido, g);
    return await iaChamarOpenAI(conexao, pedido, g);
  } catch (e) {
    if (e && e.name === 'AbortError') throw e;
    throw new Error(iaErroAmigavel(e, conexao));
  }
}
