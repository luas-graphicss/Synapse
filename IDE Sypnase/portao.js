const SYNAPSE_DEPURAR =
typeof process !== 'undefined' && !!process.env && process.env.SYNAPSE_DEPURAR === '1';

function ignorarErro(erro, contexto) {
  if (!SYNAPSE_DEPURAR) return;
  const detalhe = (erro && erro.message) || erro;
  console.warn(`[Synapse] falha tolerada em ${contexto || 'contexto nao informado'}:`, detalhe);
}

('use strict');

const VERSAO_PORTAO =
'portao-10.2.0-waf-safe (saneia so o handshake; resultado de ferramenta passa intacto)';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers':
  'Content-Type, Mcp-Session-Id, Retry-After, X-Synapse-No, X-Synapse-Relay, X-Synapse-Portao',
  'Access-Control-Max-Age': '86400',
};

function jres(obj, status, extra) {
  return new Response(JSON.stringify(obj), {
      status: status || 200,
      headers: Object.assign(
        { 'Content-Type': 'application/json', 'X-Synapse-Portao': VERSAO_PORTAO },
        CORS,
        extra || {},
      ),
  });
}
function tres(txt, status) {
  return new Response(txt, {
      status: status || 200,
      headers: Object.assign(
        { 'Content-Type': 'text/plain; charset=utf-8', 'X-Synapse-Portao': VERSAO_PORTAO },
        CORS,
      ),
  });
}

function cfgNum(env, chave, padrao) {
  const v = Number(env && env[chave]);
  return Number.isFinite(v) && v > 0 ? v : padrao;
}

function nodosCfg(env) {
  const bruto = String((env && (env.NODOS || env.NOS || env.RESERVAS)) || '');
  const fora = [];
  const visto = new Set();
  for (let u of bruto.split(/[\s,;|]+/)) {
    u = String(u || '')
    .trim()
    .replace(/\/+$/, '');
    if (!u || u.length > 300 || !/^https?:\/\//i.test(u)) continue;
      if (visto.has(u)) continue;
      visto.add(u);
      fora.push(u);
      if (fora.length >= 9) break;
    }
    return fora;
  }

  const SAUDE = new Map();
  function marcar(base, ok, motivo) {
    SAUDE.set(base, { ok: !!ok, em: Date.now(), motivo: motivo || '' });
  }
  function emQuarentena(base, env) {
    const s = SAUDE.get(base);
    if (!s || s.ok) return false;
    return Date.now() - s.em < cfgNum(env, 'PORTAO_QUARENTENA_MS', 20000);
  }
  function filaDeNodos(nodos, env) {
    const fila = nodos.filter((b) => !emQuarentena(b, env));
    return fila.length ? fila : nodos.slice();
  }

  let PORTAO_RR = 0;

  function ehApp(r) {
    if (!r) return false;
    if (r.headers.get('X-Synapse-Relay') || r.headers.get('X-Synapse-No')) return true;
    if (r.status >= 200 && r.status < 400) return true;
    return false;
  }

  function soNotificacoes(corpo) {
    try {
      const txt = new TextDecoder().decode(corpo);
      if (!txt || txt.length > 262144) return false;
      const j = JSON.parse(txt);
      const lote = Array.isArray(j) ? j : [j];
      if (!lote.length) return false;
      return lote.every(
        (m) => m && typeof m === 'object' && typeof m.method === 'string' && m.id === undefined,
      );
    } catch (e) {
      return false;
    }
  }

  async function sondar(base, env) {
    const t0 = Date.now();
    try {
      const r = await fetch(base + '/salud', {
          method: 'GET',
          headers: { 'X-Synapse-Portao-Sonda': '1' },
          signal: AbortSignal.timeout(cfgNum(env, 'PORTAO_SONDA_MS', 4000)),
      });
      const ok = !!(r && r.ok && ehApp(r));
      const motivo = ok
      ? ''
      : ehApp(r)
      ? 'http ' + r.status
      : 'borda/bloqueio (sem assinatura do app)';
      marcar(base, ok, motivo);
      return { url: base, ok: ok, ms: Date.now() - t0, motivo: motivo };
    } catch (e) {
      marcar(base, false, 'sem resposta');
      return { url: base, ok: false, ms: Date.now() - t0, motivo: 'sem resposta' };
    }
  }

  const WAF_MENOR = String.fromCharCode(8249);
  function wafSanearTexto(s) {
    if (typeof s !== 'string' || !s) return s;
    let t = s;
    if (t.includes('<')) {
      t = t
      .replace(
        /<\s*(\/?)\s*([A-Za-z][A-Za-z0-9:._-]{0,40})\s*\/?\s*>/g,
        (m, b, n) => `[${b || ''}${n}]`,
      )
      .replace(/<\s*(\/?)\s*([A-Za-z][A-Za-z0-9:._-]{0,40})/g, (m, b, n) => `[${b || ''}${n}`)
      .replace(/</g, WAF_MENOR);
    }
    if (t.includes(':')) t = t.replace(/javascript\s*:/gi, 'javascript :');
    if (t.includes('=')) t = t.replace(/\bon([a-z]{3,15})\s*=/gi, 'on$1 =');
    t = t.replace(/\x24\{/g, '\x24 {');
      return t;
    }
    function wafSanearJson(obj) {
      try {
        if (obj == null || typeof obj !== 'object') return obj;
        const s = JSON.stringify(obj);
        if (!s.includes('<') && !s.includes('javascript')) return obj;
        return JSON.parse(wafSanearTexto(s));
      } catch (e) {
        return obj;
      }
    }
    function wafSanearRpc(resp) {
      try {
        if (!resp || typeof resp !== 'object' || !resp.result) return resp;
        resp.result = wafSanearJson(resp.result);
        return resp;
      } catch (e) {
        return resp;
      }
    }

    function copiarHeaders(req, url) {
      const h = new Headers();
      for (const par of req.headers) {
        const kl = String(par[0]).toLowerCase();
        if (
          kl === 'host' ||
          kl === 'content-length' ||
          kl.indexOf('cf-') === 0 ||
          kl.indexOf('x-forwarded') === 0 ||
          kl === 'x-real-ip'
        )
        continue;
        h.set(par[0], par[1]);
      }
      h.set('X-Synapse-Portao-Salto', '1');
      h.set('X-Synapse-Origem', url.origin);
      return h;
    }

    async function respostaComCarimbo(r, base, principal) {
      const h = new Headers(r.headers);
      h.delete('content-encoding');
      h.delete('content-length');
      for (const k of Object.keys(CORS)) h.set(k, CORS[k]);
      let carimbo = VERSAO_PORTAO + '; no=' + base.replace(/^https?:\/\//i, '');
        if (base !== principal) carimbo += '; failover=1';
        h.set('X-Synapse-Portao', carimbo);
        const ct = String(r.headers.get('content-type') || '');
        if (/json/i.test(ct)) {
          try {
            const txt = await r.text();
            const ehHandshake =
            txt.includes('"inputSchema"') ||
            txt.includes('"protocolVersion"') ||
            txt.includes('"serverInfo"');
            const limpo = ehHandshake ? wafSanearTexto(txt) : txt;
            if (limpo !== txt) h.set('X-Synapse-Waf', 'saneado');
            return new Response(limpo, { status: r.status, statusText: r.statusText, headers: h });
          } catch (e) {
            ignorarErro(e, 'respostaComCarimbo');
          }
        }
        return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
      }

      async function encaminharHttp(req, url, nodos, env, ctx, rrBalancear) {
        const caminho = url.pathname + url.search;
        const metodo = req.method;
        const semCorpo = metodo === 'GET' || metodo === 'HEAD';
        const corpo = semCorpo ? undefined : await req.arrayBuffer();
        let ultimaApp = null;
        let ehToolsList = false;
        if (!semCorpo && corpo && corpo.byteLength && corpo.byteLength < 262144) {
          try {
            ehToolsList = new TextDecoder().decode(corpo).includes('"tools/list"');
          } catch (e) {
            ignorarErro(e, 'encaminharHttp');
          }
        }
        let vazioApp = null;

        const ehNotificacao = !semCorpo && !!corpo && corpo.byteLength > 0 && soNotificacoes(corpo);
        const notifDireta =
        ehNotificacao && !url.searchParams.get('cid') && url.searchParams.get('transport') !== 'sse';
        if (notifDireta) {
          const entrega = (async () => {
              for (const base of filaDeNodos(nodos, env)) {
                let nHost = '';
                try {
                  nHost = new URL(base).host;
                } catch (e) {
                  ignorarErro(e, 'encaminharHttp');
                }
                if (nHost && nHost === url.host) continue;
                try {
                  const rn = await fetch(base + caminho, {
                      method: metodo,
                      headers: copiarHeaders(req, url),
                      body: corpo,
                      signal: AbortSignal.timeout(cfgNum(env, 'PORTAO_NOTIF_MS', 10000)),
                  });
                  if (rn && rn.status < 500 && ehApp(rn)) {
                    marcar(base, true, '');
                    return;
                  }
                } catch (e) {}
              }
          })();
          try {
            if (ctx && ctx.waitUntil) ctx.waitUntil(entrega);
          } catch (e) {
            ignorarErro(e, 'encaminharHttp');
          }
          const hAck = Object.assign({ 'X-Synapse-Portao': VERSAO_PORTAO + '; ack-notificacao=1' }, CORS);
          const sessAck = req.headers.get('Mcp-Session-Id') || req.headers.get('mcp-session-id') || '';
          if (sessAck) hAck['Mcp-Session-Id'] = sessAck;
          return new Response(null, { status: 202, headers: hAck });
        }

        const candidatos = filaDeNodos(nodos, env);

        let lista;
        if (
          rrBalancear &&
          candidatos.length >= 3 &&
          String((env && env.PORTAO_MODO) || '').toLowerCase() !== 'prioridade'
        ) {
          const idx = PORTAO_RR++ % candidatos.length;
          lista = candidatos.slice(idx).concat(candidatos.slice(0, idx));
        } else {
          lista = candidatos;
        }

        for (const base of lista) {
          let bHost = '';
          try {
            bHost = new URL(base).host;
          } catch (e) {
            ignorarErro(e, 'encaminharHttp');
          }
          if (bHost && bHost === url.host) continue;
          let r = null;
          try {
            r = await fetch(base + caminho, {
                method: metodo,
                headers: copiarHeaders(req, url),
                body: semCorpo ? undefined : corpo,
                signal: semCorpo ? undefined : AbortSignal.timeout(cfgNum(env, 'PORTAO_TIMEOUT_MS', 95000)),
            });
          } catch (e) {
            marcar(base, false, 'sem resposta');
            continue;
          }
          if (!ehApp(r)) {
            marcar(base, false, 'borda/bloqueio (sem assinatura do app)');
            continue;
          }
          if (r.status === 429 || r.status === 402 || r.status >= 500) {
            ultimaApp = { r: r, base: base };
            marcar(base, false, 'http ' + r.status);
            continue;
          }
          marcar(base, true, '');
          if (ehToolsList) {
            let txt = '';
            try {
              txt = await r.clone().text();
            } catch (e) {
              txt = '';
            }
            if (txt && (/"tools"\s*:\s*\[\s*\]/.test(txt) || txt.includes('-32002'))) {
              marcar(base, false, 'sem catalogo (tools/list vazio)');
              if (!vazioApp) {
                try {
                  vazioApp = {
                    r: new Response(txt, { status: r.status, headers: r.headers }),
                    base: base,
                  };
                } catch (e) {
                  ignorarErro(e, 'encaminharHttp');
                }
              }
              continue;
            }
          }
          if (base !== nodos[0]) ctx.waitUntil(sondar(nodos[0], env));
          return await respostaComCarimbo(r, base, nodos[0]);
        }

        if (!ultimaApp && vazioApp) ultimaApp = vazioApp;
        if (ultimaApp) {
          const rr = await respostaComCarimbo(ultimaApp.r, ultimaApp.base, nodos[0]);
          const h = new Headers(rr.headers);
          h.set('X-Synapse-Portao', String(h.get('X-Synapse-Portao') || VERSAO_PORTAO) + '; esgotado=1');
          return new Response(rr.body, { status: rr.status, statusText: rr.statusText, headers: h });
        }

        if (ehNotificacao)
        return new Response(null, {
            status: 202,
            headers: Object.assign({ 'X-Synapse-Portao': VERSAO_PORTAO + '; ack-notificacao=1' }, CORS),
        });

        let id = null;
        try {
          id = JSON.parse(new TextDecoder().decode(corpo)).id;
        } catch (e) {
          ignorarErro(e, 'encaminharHttp');
        }
        if (id === undefined) id = null;
        return jres(
          {
            jsonrpc: '2.0',
            id: id,
            error: {
              code: -32001,
              message:
              'portao: nenhum no respondeu (todos indisponiveis ou bloqueados na borda). Tente de novo em alguns segundos.',
            },
          },
          503,
          { 'Retry-After': '8' },
        );
      }

      async function encaminharWs(req, url, nodos, env) {
        const caminho = url.pathname + url.search;
        const _cand = filaDeNodos(nodos, env);
        const _ini = PORTAO_RR++ % (_cand.length || 1);
        const _lista = _cand.slice(_ini).concat(_cand.slice(0, _ini));
        for (const base of _lista) {
          let bHost = '';
          try {
            bHost = new URL(base).host;
          } catch (e) {
            ignorarErro(e, 'encaminharWs');
          }
          if (bHost && bHost === url.host) continue;
          try {
            const nova = new Request(base + caminho, req);
            nova.headers.set('X-Synapse-Portao-Salto', '1');
            nova.headers.set('X-Synapse-Origem', url.origin);
            const r = await fetch(nova);
            if (r.status === 101) {
              marcar(base, true, '');
              return r;
            }
            marcar(base, false, 'ws http ' + r.status);
          } catch (e) {
            marcar(base, false, 'ws sem resposta');
          }
        }
        return jres({ erro: 'portao: nenhum no aceitou o WebSocket' }, 503);
      }

      let NODOS_CACHE = { em: 0, corpo: '' };
      async function rotaNodos(env) {
        const cacheMs = cfgNum(env, 'PORTAO_NODOS_CACHE_MS', 8000);
        if (NODOS_CACHE.corpo && Date.now() - NODOS_CACHE.em < cacheMs) {
          return new Response(NODOS_CACHE.corpo, {
              headers: Object.assign(
                { 'Content-Type': 'application/json', 'X-Synapse-Portao': VERSAO_PORTAO },
                CORS,
              ),
          });
        }
        const nodos = nodosCfg(env);
        const infos = await Promise.all(nodos.map((b) => sondar(b, env)));
        const vivo = infos.find((i) => i.ok);
        const modoRr = String((env && env.PORTAO_MODO) || '').toLowerCase() !== 'prioridade';
        const corpo = JSON.stringify({
            portao: VERSAO_PORTAO,
            agora: new Date().toISOString(),
            nodos: infos,
            servindo: vivo ? vivo.url : '',
            failover: !!(vivo && nodos.length && vivo.url !== nodos[0]),
            modo: modoRr ? 'balanceado' : 'prioridade',
            dica: nodos.length
            ? vivo
            ? vivo.url === nodos[0]
            ? 'no principal atendendo'
            : 'FAILOVER: reserva atendendo pela URL do portao'
            : 'NENHUM no vivo — URL do portao sem destino'
            : 'preencha NODOS no wrangler-portao.toml (principal primeiro, depois reservas)',
        });
        NODOS_CACHE = { em: Date.now(), corpo: corpo };
        return new Response(corpo, {
            headers: Object.assign(
              { 'Content-Type': 'application/json', 'X-Synapse-Portao': VERSAO_PORTAO },
              CORS,
            ),
        });
      }

      export default {
        async fetch(req, env, ctx) {
          try {
            if (req.method === 'OPTIONS')
            return new Response(null, {
                status: 204,
                headers: Object.assign({ 'X-Synapse-Portao': VERSAO_PORTAO }, CORS),
            });
            const url = new URL(req.url);
            const p = url.pathname.split('/').filter(Boolean);

            if (!p.length)
            return tres(
              `SYNAPSE PORTAO ${VERSAO_PORTAO} — roteador da URL unica.\nEncaminha /mcp e /bridge ao primeiro \
no vivo de NODOS (failover total, inclusive bloqueio de borda do no principal).\nSaude dos nos: /nodos`,
            );
            if (p[0] === 'salud' || p[0] === 'saude' || p[0] === 'health') return tres('ok');
            if (p[0] === 'favicon.ico') return new Response(null, { status: 204, headers: CORS });
            if (p[0] === 'nodos' || p[0] === 'stats') return rotaNodos(env);

            if (req.headers.get('X-Synapse-Portao-Salto')) {
              return jres(
                {
                  erro: 'laco de portoes detectado (X-Synapse-Portao-Salto). Um portao nao pode apontar para outro portao — NODOS deve listar apenas nos do worker.js.',
                },
                508,
              );
            }
            if (p[0] !== 'mcp' && p[0] !== 'bridge')
            return jres({ erro: 'rota desconhecida no portao: use /mcp/... ou /bridge/...' }, 404);

            if (p[0] === 'mcp' && (req.method === 'GET' || req.method === 'HEAD')) {
              const qs = url.searchParams;
              const querSse =
              qs.get('transport') === 'sse' || qs.get('sse') === '1' || qs.get('legado') === 'sse';
              if (!querSse) {
                const h405 = Object.assign(
                  {
                    'Content-Type': 'application/json; charset=utf-8',
                    Allow: 'POST, DELETE, OPTIONS',
                    'X-Synapse-Portao': VERSAO_PORTAO + '; get-sem-stream=1',
                  },
                  CORS,
                );
                const corpo405 = JSON.stringify({
                    jsonrpc: '2.0',
                    id: null,
                    error: {
                      code: -32000,
                      message:
                      'Este servidor MCP fala Streamable HTTP: mande as mensagens por POST nesta mesma URL. O ' +
                      'stream GET nao e oferecido (HTTP 405, permitido pela especificacao). Clientes antigos ' +
                      'podem usar ?transport=sse.',
                    },
                });
                return new Response(req.method === 'HEAD' ? null : corpo405, {
                    status: 405,
                    headers: h405,
                });
              }
            }

            const nodos = nodosCfg(env);
            if (!nodos.length)
            return jres(
              {
                erro: 'portao sem NODOS: edite wrangler-portao.toml, preencha NODOS = "https://no-principal..., https://reserva..." e rode o deploy de novo.',
              },
              503,
              { 'Retry-After': '30' },
            );

            if (String(req.headers.get('Upgrade') || '').toLowerCase() === 'websocket')
            return encaminharWs(req, url, nodos, env);

            const rrBalancear =
            p[0] === 'mcp' &&
            req.method === 'POST' &&
            !url.searchParams.get('cid') &&
            url.searchParams.get('transport') !== 'sse';

            return encaminharHttp(req, url, nodos, env, ctx, rrBalancear);
          } catch (e) {
            return jres(
              { erro: 'falha interna do portao: ' + (e && e.message ? e.message : String(e)) },
              500,
            );
          }
        },
      };
