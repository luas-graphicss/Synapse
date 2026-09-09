const SYNAPSE_DEPURAR =
typeof process !== 'undefined' && !!process.env && process.env.SYNAPSE_DEPURAR === '1';

function ignorarErro(erro, contexto) {
  if (!SYNAPSE_DEPURAR) return;
  const detalhe = (erro && erro.message) || erro;
  console.warn(`[Synapse] falha tolerada em ${contexto || 'contexto nao informado'}:`, detalhe);
}

('use strict');

const VERSAO = 'cf-10.2.1-direct-url-resilience';

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

  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,HEAD,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Expose-Headers':
    'Mcp-Session-Id, Retry-After, X-Synapse-Plano, X-Synapse-Dia, X-Synapse-Min, X-Synapse-No, X-Synapse-Relay, X-Synapse-Portao',
    'Access-Control-Max-Age': '86400',
  };

  function jres(obj, status, extra) {
    return new Response(JSON.stringify(obj), {
        status: status || 200,
        headers: Object.assign(
          { 'Content-Type': 'application/json; charset=utf-8', 'X-Synapse-Relay': VERSAO },
          CORS,
          extra || {},
        ),
    });
  }
  function tres(s, status, extra) {
    return new Response(s, {
        status: status || 200,
        headers: Object.assign(
          { 'Content-Type': 'text/plain; charset=utf-8', 'X-Synapse-Relay': VERSAO },
          CORS,
          extra || {},
        ),
    });
  }
  function diaUTC() {
    return new Date().toISOString().slice(0, 10);
  }
  function minAgora() {
    return Math.floor(Date.now() / 60000);
  }

  const NOTION_ALLOWED_METHODS = ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE'];
  const NOTION_SAFE_PATH = /^\/v1\/[A-Za-z0-9._~\-/]*$/;
  const NOTION_SAFE_VERSION = /^\d{4}-\d{2}-\d{2}$/;
  const NOTION_SAFE_AUTHORIZATION = /^Bearer [A-Za-z0-9._~+/=-]{10,400}$/;
  const NOTION_MAX_PATH_LENGTH = 512;
  const NOTION_MAX_QUERY_LENGTH = 1024;
  const NOTION_MAX_BODY_BYTES = 1048576;
  const NOTION_MAX_RESPONSE_BYTES = 8388608;
  const NOTION_TIMEOUT_MS = 20000;

  function notionSafePath(path) {
    if (!path || path.length > NOTION_MAX_PATH_LENGTH) return null;
    if (path.includes('//')) return null;
    if (path.split('/').some((part) => part === '.' || part === '..')) return null;
    return NOTION_SAFE_PATH.test(path) ? path : null;
  }

  function notionSafeQuery(search) {
    const query = String(search || '');
    if (!query) return '';
    if (query.length > NOTION_MAX_QUERY_LENGTH) return null;
    if (query.includes('#')) return null;
    return query;
  }

  async function rotaNotion(req, url, p) {
    const method = String(req.method || 'GET').toUpperCase();
    if (!NOTION_ALLOWED_METHODS.includes(method)) return tres('metodo nao suportado', 405);
    const path = notionSafePath('/' + p.slice(1).join('/'));
    if (!path) return tres('use /notion/v1/...', 400);
    const query = notionSafeQuery(url.search);
    if (query === null) return tres('consulta invalida', 400);
    const auth = req.headers.get('authorization') || '';
    if (auth && !NOTION_SAFE_AUTHORIZATION.test(auth)) return tres('credencial invalida', 400);
    const h = new Headers();
    if (auth) h.set('authorization', auth);
    const version = String(req.headers.get('notion-version') || '');
    h.set('notion-version', NOTION_SAFE_VERSION.test(version) ? version : '2026-03-11');
    h.set('content-type', 'application/json');
    h.set('accept', 'application/json');
    let corpo;
    if (method !== 'GET' && method !== 'HEAD') {
      corpo = await req.text();
      if (corpo.length > NOTION_MAX_BODY_BYTES) return tres('corpo acima do limite', 413);
    }
    try {
      const r = await fetch('https://api.notion.com' + path + query, {
          method: method,
          headers: h,
          body: corpo,
          redirect: 'error',
          signal: AbortSignal.timeout(NOTION_TIMEOUT_MS),
      });
      const texto = await r.text();
      if (texto.length > NOTION_MAX_RESPONSE_BYTES) return tres('resposta acima do limite', 502);
      return new Response(texto, {
          status: r.status,
          headers: Object.assign(
            {
              'Content-Type': 'application/json; charset=utf-8',
              'X-Content-Type-Options': 'nosniff',
              'Cache-Control': 'no-store',
              'X-Synapse-Relay': VERSAO,
            },
            CORS,
          ),
      });
    } catch (e) {
      ignorarErro(e, 'rotaNotion');
      return tres('proxy do Notion falhou', 502);
    }
  }

  export default {
    async fetch(req, env) {
      try {
        if (req.method === 'OPTIONS')
        return new Response(null, {
            status: 204,
            headers: Object.assign({ 'X-Synapse-Relay': VERSAO }, CORS),
        });
        const url = new URL(req.url);
        const p = url.pathname.split('/').filter(Boolean);
        if (!p.length)
        return tres(
          'Synapse MCP Relay (Cloudflare) ' +
          VERSAO +
          ' - ok\nplano: ' +
          (env.PLANO || 'free') +
          '\nrotas: /mcp/:sid/:token (Notion) e /bridge/:sid/:token/* (aba do site)',
        );
        if (p[0] === 'salud' || p[0] === 'saude' || p[0] === 'health') return tres('ok');
        if (p[0] === 'favicon.ico')
        return new Response(null, {
            status: 204,
            headers: Object.assign({ 'X-Synapse-Relay': VERSAO }, CORS),
        });
        if (p[0] === 'stats' && p.length === 1)
        return jres({
            version: VERSAO,
            plano: env.PLANO || 'free',
            dica: 'estatisticas por sessao: /bridge/:sid/:token/stats',
        });
        if (p[0] === 'notion') return await rotaNotion(req, url, p);
        const ehMcp = p[0] === 'mcp' && p.length >= 3;
        const ehBridge = p[0] === 'bridge' && p.length >= 4;
        if (!ehMcp && !ehBridge) return tres('rota desconhecida', 404);
        const sid = p[1] || '',
        token = p[2] || '';
        if (!/^[A-Za-z0-9_-]{4,80}$/.test(sid) || !/^[A-Za-z0-9_-]{4,160}$/.test(token))
        return tres('sessao invalida', 400);
        const id = env.SESSOES.idFromName(sid + '/' + token);
        return await env.SESSOES.get(id).fetch(req);
      } catch (e) {
        return jres({ error: String((e && e.message) || e) }, 500);
      }
    },
  };

  export class RelaySessao {
    constructor(state, env) {
      this.state = state;
      this.env = env;
      this.tabs = new Set();
      this.sse = new Set();
      this.cids = new Map();
      this.pollers = [];
      this.fila = [];
      this.pend = new Map();
      this.seq = 0;
      this.ep = Math.random().toString(36).slice(2, 10);
      this.rr = 0;
      this.rrEnc = 0;
      this.meta = null;
      this.reservas = [];
      this.saudeR = new Map();
      this.encaminhadas = 0;
      this.uso = { dia: diaUTC(), nDia: 0, minK: minAgora(), nMin: 0, antMin: 0 };
      this.salvoEm = 0;
      this.statsEm = 0;
      this.state.blockConcurrencyWhile(async () => {
          try {
            const m = await this.state.storage.get('meta');
            if (m) this.meta = m;
            const cl = await this.state.storage.get('cliente');
            if (cl) this.cliente = String(cl);
            const u = await this.state.storage.get('uso');
            if (u && u.dia === diaUTC()) this.uso.nDia = u.nDia || 0;
            const rv = await this.state.storage.get('reservas');
            if (Array.isArray(rv)) this.reservas = rv;
          } catch (e) {
            ignorarErro(e, 'constructor');
          }
      });
    }

    cfg(nome, padrao) {
      const v = this.env && this.env[nome];
      const n = Number(v);
      return v == null || v === '' || isNaN(n) ? padrao : n;
    }
    plano() {
      return String((this.env && this.env.PLANO) || 'free').toLowerCase();
    }
    limites() {
      const free = this.plano() !== 'paid' && this.plano() !== 'pago';
      return {
        free: free,
        dia: this.cfg('LIMITE_DIA', free ? 300000 : 10000000),
        min: this.cfg('LIMITE_MIN', free ? 6000 : 100000),
      };
    }

    reservasCfg() {
      const lista = [];
      const poe = (u) => {
        u = String(u || '')
        .trim()
        .replace(/\/+$/, '');
        if (/^https?:\/\//i.test(u) && u.length < 300 && !lista.includes(u)) lista.push(u);
        };
        String((this.env && (this.env.RESERVAS || this.env.RESERVA)) || '')
        .split(/[\s,;|]+/)
        .forEach(poe);
        (this.reservas || []).forEach(poe);
        return lista.slice(0, 8);
      }
      gravarReservas(arr) {
        const lista = [];
        for (const u0 of Array.isArray(arr) ? arr : []) {
          const u = String(u0 || '')
          .trim()
          .replace(/\/+$/, '');
          if (/^https?:\/\//i.test(u) && u.length < 300 && !lista.includes(u)) lista.push(u);
          }
          this.reservas = lista.slice(0, 8);
          try {
            const pr = this.state.storage.put('reservas', this.reservas);
            if (this.state.waitUntil) this.state.waitUntil(pr);
          } catch (e) {
            ignorarErro(e, 'gravarReservas');
          }
        }

        nTools() {
          try {
            return this.meta && this.meta.tools && Array.isArray(this.meta.tools.tools)
            ? this.meta.tools.tools.length
            : 0;
          } catch (e) {
            return 0;
          }
        }
        catalogoCheio() {
          return this.nTools() > 0;
        }
        mesclarMeta(b) {
          b = wafSanearJson(b);
          const antes = this.nTools();
          const novas = b && b.tools && Array.isArray(b.tools.tools) ? b.tools.tools.length : -1;
          const tools =
          novas > 0 || antes === 0
          ? (b && b.tools) || (this.meta && this.meta.tools) || null
          : (this.meta && this.meta.tools) || null;
          this.meta = {
            init: (b && b.init) || (this.meta && this.meta.init) || null,
            tools: tools || null,
            at: Date.now(),
          };
          try {
            const pr =
            this.nTools() > 0
            ? this.state.storage.put('meta', this.meta)
            : this.state.storage.delete('meta');
            if (this.state.waitUntil) this.state.waitUntil(pr);
          } catch (e) {
            ignorarErro(e, 'mesclarMeta');
          }
          if (b && Array.isArray(b.reservas)) this.gravarReservas(b.reservas);
          return this.nTools();
        }
        gravarUso() {
          try {
            const prom = this.state.storage.put('uso', { dia: this.uso.dia, nDia: this.uso.nDia });
            if (this.state.waitUntil) this.state.waitUntil(prom);
          } catch (e) {
            ignorarErro(e, 'gravarUso');
          }
        }

        rolarJanela() {
          const d = diaUTC();
          if (d !== this.uso.dia) {
            this.uso.dia = d;
            this.uso.nDia = 0;
            this.uso.antMin = 0;
          }
          const mk = minAgora();
          if (mk !== this.uso.minK) {
            this.uso.antMin = mk - this.uso.minK === 1 ? this.uso.nMin : 0;
            this.uso.minK = mk;
            this.uso.nMin = 0;
          }
        }

        contar(tipo) {
          this.rolarJanela();
          if (tipo !== 'bridge') {
            this.uso.nDia++;
            this.uso.nMin++;
          }
          const ag = Date.now();
          if (ag - this.salvoEm > 45000) {
            this.salvoEm = ag;
            this.gravarUso();
          }
          this.empurrarStats(false);
        }

        nivel() {
          this.rolarJanela();
          const L = this.limites();
          const min = Math.max(this.uso.nMin, Math.round(this.uso.antMin * 0.35));
          const pMin = min / Math.max(1, L.min);
          const pDia = this.uso.nDia / Math.max(1, L.dia);
          return {
            L: L,
            pMin: pMin,
            pDia: pDia,
            quente: L.free && (pMin >= 0.78 || pDia >= 0.9),
            critico: L.free && (pMin >= 0.94 || pDia >= 0.985),
          };
        }

        statsJson() {
          const nv = this.nivel();
          return {
            version: VERSAO,
            plano: this.plano(),
            dia: { usados: this.uso.nDia, limite: nv.L.dia },
            minuto: { usados: this.uso.nMin, limite: nv.L.min },
            quente: nv.quente,
            critico: nv.critico,
            executores: this.tabs.size + this.sse.size,
            reservas: { configuradas: this.reservasCfg().length, encaminhadas: this.encaminhadas },
            pendentes: this.pend.size,
            fila: this.fila.length,
            recusadasFila: this.recusasFila || 0,
            catalogo: { ferramentas: this.nTools(), temInitialize: !!(this.meta && this.meta.init) },
          };
        }

        empurrarStats(forcar) {
          const ag = Date.now();
          if (!forcar && ag - this.statsEm < 15000) return;
          if (!this.tabs.size) return;
          this.statsEm = ag;
          const m = JSON.stringify(Object.assign({ t: 'stats' }, this.statsJson()));
          for (const ws of this.tabs) {
            try {
              ws.send(m);
            } catch (e) {
              ignorarErro(e, 'empurrarStats');
            }
          }
        }

        packetFor(event) {
          return {
            reqId: event.reqId,
            ep: this.ep,
            body: event.body,
            budgetMs: Math.max(0, event.expiresAt - Date.now()),
          };
        }

        completeRequest(requestId, response) {
          const pending = this.pend.get(requestId);
          if (!pending) return false;
          clearTimeout(pending.timer);
          this.pend.delete(requestId);
          this.fila = this.fila.filter((event) => event.reqId !== requestId);
          pending.resolve(response);
          return true;
        }

        expireRequest(requestId) {
          const pending = this.pend.get(requestId);
          if (!pending) return;
          const delivered = !!pending.ev.delivered;
          this.completeRequest(requestId, {
              jsonrpc: '2.0',
              id: pending.ev.body?.id ?? null,
              error: {
                code: -32002,
                message: delivered
                ? 'Executor did not return a result within the transport deadline. Execution may have started. Inspect its target before repeating a mutation.'
                : 'No executor became available before the admission deadline. Nothing was delivered or executed. Reconnect the editor and retry.',
                data: { executed: delivered ? 'unknown' : false, retry_original: !delivered },
              },
          });
        }

        entregar(ev) {
          if (!this.pend.has(ev.reqId)) return;
          if (Date.now() >= ev.expiresAt) return this.expireRequest(ev.reqId);
          const abas = [...this.tabs].filter((socket) => socket.readyState === 1);
          if (abas.length) {
            const alvo = abas[this.rr++ % abas.length];
            try {
              ev.delivered = true;
              alvo.send(JSON.stringify({ t: 'rpc', ...this.packetFor(ev) }));
              ev.alvo = alvo;
              return;
            } catch (e) {
              ignorarErro(e, 'entregar');
            }
          }
          for (const esc of this.sse) {
            try {
              ev.delivered = true;
              esc('rpc', JSON.stringify(this.packetFor(ev)));
              ev.alvo = esc;
              return;
            } catch (e) {
              ignorarErro(e, 'entregar');
            }
          }
          ev.alvo = null;
          const filaMax = Math.max(200, this.cfg('FILA_MAX', 5000));
          if (this.fila.length >= filaMax) {
            const p9 = this.pend.get(ev.reqId);
            if (p9) {
              clearTimeout(p9.timer);
              this.pend.delete(ev.reqId);
              this.recusasFila = (this.recusasFila || 0) + 1;
              try {
                p9.resolve({
                    jsonrpc: '2.0',
                    id: ev.body && ev.body.id != null ? ev.body.id : null,
                    error: {
                      code: -32000,
                      message: `Fila deste no cheia (${filaMax} chamadas esperando a aba executar). NADA foi executado: repita a MESMA chamada em alguns segundos.`,
                    },
                    __http429: true,
                });
              } catch (e) {
                ignorarErro(e, 'entregar');
              }
              return;
            }
          }
          this.fila.push(ev);
          this.acordarPollers();
        }

        acordarPollers() {
          while (this.pollers.length && this.fila.length) {
            const w = this.pollers.shift();
            clearTimeout(w.timer);
            const eventos = this.fila
            .splice(0, 64)
            .filter((ev) => this.pend.has(ev.reqId) && ev.expiresAt > Date.now())
            .map((ev) => {
                ev.alvo = 'poll';
                ev.delivered = true;
                return this.packetFor(ev);
            });
            try {
              w.resolve({ events: eventos });
            } catch (e) {
              ignorarErro(e, 'acordarPollers');
            }
          }
        }

        requeue(alvo) {
          for (const par of this.pend) {
            const p = par[1];
            if (p.ev && p.ev.alvo === alvo) {
              p.ev.alvo = null;
              this.entregar(p.ev);
            }
          }
        }

        aguardar(msg, timeoutMs) {
          const maxPending = Math.max(1, this.cfg('MAX_PENDING', 256));
          if (this.pend.size >= maxPending)
          return Promise.resolve({
              jsonrpc: '2.0',
              id: msg?.id ?? null,
              error: {
                code: -32000,
                message:
                'Relay admission capacity reached. Nothing was executed. Retry after current work drains.',
                data: { executed: false, retry_after: 2 },
              },
              __http429: true,
          });
          const requestId = ++this.seq;
          const body =
          this.cliente && msg && typeof msg === 'object' && !msg._cli
          ? { ...msg, _cli: this.cliente }
          : msg;
          const event = {
            reqId: requestId,
            body,
            alvo: null,
            delivered: false,
            expiresAt: Date.now() + timeoutMs,
          };
          const response = new Promise((resolve) => {
              const timer = setTimeout(() => this.expireRequest(requestId), timeoutMs);
              this.pend.set(requestId, { resolve, timer, ev: event });
          });
          this.entregar(event);
          return response;
        }

        responder(reqId, body, epoch) {
          if (epoch != null && epoch !== this.ep) return false;
          return this.completeRequest(reqId, body);
        }

        acknowledgeReplies(items) {
          const ids = [];
          const expiredIds = [];
          for (const item of items) {
            if (!item || item.reqId == null) continue;
            ids.push(item.reqId);
            if (!this.responder(item.reqId, item.body, item.ep)) expiredIds.push(item.reqId);
          }
          return {
            t: 'ack',
            ep: this.ep,
            ids,
            expiredIds,
            delivered: ids.length - expiredIds.length,
            expired: expiredIds.length,
          };
        }

        initLocal(params) {
          const conhecidas = ['2025-06-18', '2025-03-26', '2024-11-05'];
          const pv =
          params && conhecidas.includes(params.protocolVersion) ? params.protocolVersion : '2025-03-26';
          let base;
          try {
            base = this.meta && this.meta.init ? JSON.parse(JSON.stringify(this.meta.init)) : null;
          } catch (e) {
            base = null;
          }
          if (!base)
          base = {
            capabilities: { tools: { listChanged: false } },
            serverInfo: {
              name: 'aurora-live-preview',
              title: 'Synapse Live Preview (site de preview de .zip)',
              version: '1.0.0',
            },
            instructions: '',
          };
          base.protocolVersion = pv;
          const nR = this.reservasCfg().length;
          const dica = this.env && this.env.RESERVA_HINT ? String(this.env.RESERVA_HINT).trim() : '';
          if (nR)
          base.instructions =
          String(base.instructions || '') +
          '\n\nALTA DISPONIBILIDADE: esta URL tem failover automatico interno (' +
          nR +
          ' no(s) de reserva). Se uma chamada retornar HTTP 429 momentaneo, aguarde alguns segundos e repita a MESMA chamada nesta MESMA URL. Nao existe (nem e preciso) outro servidor MCP.';
          else if (dica) base.instructions = String(base.instructions || '') + '\n\nFAILOVER: ' + dica;
          return base;
        }

        metodoLocal(msg) {
          const m = msg.method;
          if (m === 'initialize')
          return {
            jsonrpc: '2.0',
            id: msg.id,
            result: wafSanearJson(this.initLocal(msg.params || {})),
          };
          if (m === 'ping') return { jsonrpc: '2.0', id: msg.id, result: {} };
          if (m === 'tools/list' && this.catalogoCheio())
          return {
            jsonrpc: '2.0',
            id: msg.id,
            result: wafSanearJson(this.meta.tools),
          };
          if (m === 'resources/list') return { jsonrpc: '2.0', id: msg.id, result: { resources: [] } };
          if (m === 'resources/templates/list')
          return { jsonrpc: '2.0', id: msg.id, result: { resourceTemplates: [] } };
          if (m === 'prompts/list') return { jsonrpc: '2.0', id: msg.id, result: { prompts: [] } };
          return null;
        }

        async aguardarCapacidade() {
          const maxMs = this.cfg('ESPERA_CAPACIDADE_MS', 40000);
          if (maxMs <= 0) return false;
          const fim = Date.now() + maxMs;
          while (Date.now() < fim) {
            await new Promise((r) => setTimeout(r, 400));
            const nv2 = this.nivel();
            if (!nv2.critico || nv2.pMin < 0.97) return true;
          }
          return false;
        }

        async tratarMcpMsg(msg, nv) {
          if (!msg || typeof msg !== 'object' || typeof msg.method !== 'string') {
            return {
              jsonrpc: '2.0',
              id: msg && msg.id != null ? msg.id : null,
              error: { code: -32600, message: 'Requisicao invalida' },
            };
          }
          if (msg.id === undefined) return null;
          if (msg.method === 'initialize') {
            try {
              const nomeCli = (msg.params && msg.params.clientInfo && msg.params.clientInfo.name) || '';
              if (nomeCli) {
                this.cliente = String(nomeCli);
                const pc = this.state.storage.put('cliente', this.cliente);
                if (this.state.waitUntil) this.state.waitUntil(pc);
              }
            } catch (e) {
              ignorarErro(e, 'tratarMcpMsg');
            }
          }
          const local = this.metodoLocal(msg);
          if (local) return local;
          const online = this.tabs.size + this.sse.size > 0 || this.pollers.length > 0;
          if (msg.method === 'tools/list') {
            if (!online)
            return {
              jsonrpc: '2.0',
              id: msg.id,
              error: {
                code: -32002,
                message:
                'Nenhuma aba do Synapse esta conectada a este no e nao existe catalogo em cache. Abra o ' +
                'site, ative o MCP (bolinha verde) e recarregue as ferramentas do conector. Lembre-se: o ' +
                'transporte do MCP tem de ser a URL da nuvem - endereco local (localhost:8787) e apenas ' +
                'complemento de terminal/disco.',
              },
            };
            const rl = await this.aguardar(msg, this.cfg('HS_TIMEOUT_MS', 20000));
            if (
              rl &&
              rl.result &&
              Array.isArray(rl.result.tools) &&
              !rl.result.tools.length &&
              this.catalogoCheio()
            )
            return { jsonrpc: '2.0', id: msg.id, result: wafSanearJson(this.meta.tools) };
            return wafSanearRpc(rl);
          }
          const estrito = /^(1|true|sim|yes|on)$/i.test(
            String((this.env && this.env.CAPACIDADE_ESTRITA) || ''),
          );
          if (
            estrito &&
            msg.method === 'tools/call' &&
            nv &&
            nv.critico &&
            (!online || nv.pMin >= 0.97 || nv.pDia >= 0.995)
          ) {
            const liberou = await this.aguardarCapacidade();
            if (liberou) return await this.aguardar(msg, this.cfg('AURORA_TIMEOUT_MS', 35000));
            const reservas = this.reservasCfg();
            const saudiveis = reservas.filter((u) => {
                const s = this.saudeR.get(u);
                return !s || s.ok || Date.now() - s.at > 15000;
            });
            const msgErro =
            reservas.length === 0
            ? 'No no limite de capacidade e sem nos de reserva configurados. Aguarde a virada do minuto e repita a chamada nesta mesma URL.'
            : `No no limite de capacidade. ${saudiveis.length} de ${reservas.length} no(s) de reserva disponivel(is) \
— o portao pode encaminhar. Aguarde alguns segundos e repita a chamada nesta mesma URL.`;
            return {
              jsonrpc: '2.0',
              id: msg.id,
              error: { code: -32000, message: msgErro },
              __http429: true,
            };
          }
          return await this.aguardar(msg, this.cfg('AURORA_TIMEOUT_MS', 35000));
        }

        async fetch(req) {
          try {
            return await this.rotear(req);
          } catch (e) {
            return jres({ error: String((e && e.message) || e) }, 500);
          }
        }

        async rotear(req) {
          if (req.method === 'OPTIONS')
          return new Response(null, {
              status: 204,
              headers: Object.assign({ 'X-Synapse-Relay': VERSAO }, CORS),
          });
          const url = new URL(req.url);
          const p = url.pathname.split('/').filter(Boolean);
          if (p[0] === 'mcp') return this.rotaMcp(req, url);
          const acao = p[3] || '';
          if (acao === 'ws') return this.rotaWs(req);
          if (acao === 'events') {
            this.contar('bridge');
            return this.rotaSse(req);
          }
          if (acao === 'poll') {
            this.contar('bridge');
            return this.rotaPoll(req);
          }
          if (acao === 'reply') {
            this.contar('bridge');
            return this.rotaReply(req);
          }
          if (acao === 'meta') {
            this.contar('bridge');
            return this.rotaMeta(req);
          }
          if (acao === 'fetchurl' || acao === 'fetchjson') {
            this.contar('bridge');
            return this.rotaFetch(req, acao);
          }
          if (acao === 'stats') return jres(this.statsJson());
          return tres('rota desconhecida', 404);
        }

        async rotaMeta(req) {
          let b = null;
          try {
            b = await req.json();
          } catch (e) {
            ignorarErro(e, 'rotaMeta');
          }
          if (!b || typeof b !== 'object') return jres({ ok: false }, 400);
          const n = this.mesclarMeta(b);
          return jres({ ok: true, tools: n, reservas: this.reservasCfg().length });
        }

        async rotaFetch(req, acao) {
          if (req.method !== 'POST') return tres('use POST', 405);
          let b = null;
          try {
            b = await req.json();
          } catch (e) {
            return jres({ error: 'json invalido' }, 400);
          }
          b = b || {};
          const u = String(b.url || '');
          if (!(u.slice(0, 7).toLowerCase() === 'http://' || u.slice(0, 8).toLowerCase() === 'https://'))
          return jres({ error: 'url invalida: use http(s)' }, 400);
          const permitidos = [
            'authorization',
            'x-auth-token',
            'x-api-key',
            'accept',
            'user-agent',
            'content-type',
            'notion-version',
          ];
          const hd = {};
          try {
            for (const k of Object.keys(b.headers || {})) {
              if (permitidos.includes(String(k).toLowerCase()) && b.headers[k] != null)
              hd[k] = String(b.headers[k]).slice(0, 2048);
            }
          } catch (e) {
            ignorarErro(e, 'rotaFetch');
          }
          try {
            if (acao === 'fetchjson') {
              let met = String(b.method || 'GET').toUpperCase();
              if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].includes(met)) met = 'GET';
              if (
                b.body != null &&
                met !== 'GET' &&
                met !== 'HEAD' &&
                !hd['content-type'] &&
                !hd['Content-Type']
              )
              hd['Content-Type'] = 'application/json';
              const op = {
                method: met,
                redirect: 'follow',
                headers: hd,
                signal: AbortSignal.timeout(30000),
              };
              if (b.body != null && met !== 'GET' && met !== 'HEAD')
              op.body = typeof b.body === 'string' ? b.body : JSON.stringify(b.body);
              const r = await fetch(u, op);
              const tx = await r.text();
              return jres({
                  status: r.status,
                  ok: !!r.ok,
                  mime: r.headers.get('content-type') || '',
                  text: String(tx || '').slice(0, 4 * 1024 * 1024),
                  finalUrl: r.url || u,
              });
            }
            const cap = 25 * 1024 * 1024;
            const r2 = await fetch(u, {
                redirect: 'follow',
                headers: hd,
                signal: AbortSignal.timeout(30000),
            });
            if (!r2.ok) return jres({ error: 'download falhou: HTTP ' + r2.status }, 502);
            const cl = Number(r2.headers.get('content-length') || 0);
            if (cl > cap) return jres({ error: 'arquivo maior que 25MB' }, 413);
            const ab = await r2.arrayBuffer();
            if (ab.byteLength > cap) return jres({ error: 'arquivo maior que 25MB' }, 413);
            const by = new Uint8Array(ab);
            let bin = '';
            for (let i = 0; i < by.length; i += 0x8000)
            bin += String.fromCharCode.apply(null, by.subarray(i, i + 0x8000));
            return jres({
                b64: btoa(bin),
                size: ab.byteLength,
                mime: r2.headers.get('content-type') || '',
                finalUrl: r2.url || u,
            });
          } catch (e) {
            const m =
            e && (e.name === 'TimeoutError' || e.name === 'AbortError')
            ? 'tempo esgotado (30s)'
            : String((e && e.message) || e);
            return jres(
              { error: (acao === 'fetchjson' ? 'chamada de API falhou: ' : 'download falhou: ') + m },
              500,
            );
          }
        }

        async rotaReply(req) {
          let b = null;
          try {
            b = await req.json();
          } catch (e) {
            ignorarErro(e, 'rotaReply');
          }
          if (!b) return jres({ ok: false }, 400);
          const itens = Array.isArray(b)
          ? b
          : Array.isArray(b.batch)
          ? b.batch
          : Array.isArray(b.items)
          ? b.items
          : [b];
          return jres({ ok: true, ...this.acknowledgeReplies(itens) });
        }

        async rotaPoll(req) {
          let b = null;
          try {
            b = await req.json();
          } catch (e) {
            ignorarErro(e, 'rotaPoll');
          }
          const wait = Math.max(1000, Math.min(30000, Number(b && b.wait) || 25000));
          if (this.fila.length) {
            const eventos = this.fila
            .splice(0, 64)
            .filter((ev) => this.pend.has(ev.reqId) && ev.expiresAt > Date.now())
            .map((ev) => {
                ev.alvo = 'poll';
                ev.delivered = true;
                return this.packetFor(ev);
            });
            return jres({ events: eventos });
          }
          const self = this;
          const out = await new Promise((resolve) => {
              const w = {
                resolve: resolve,
                timer: setTimeout(() => {
                    const i = self.pollers.indexOf(w);
                    if (i >= 0) self.pollers.splice(i, 1);
                    resolve({ events: [] });
                  }, wait),
              };
              self.pollers.push(w);
          });
          return jres(out);
        }

        rotaSse(req) {
          const self = this;
          const ts = new TransformStream();
          const writer = ts.writable.getWriter();
          const enc = new TextEncoder();
          function mandar(evento, dados) {
            return writer.write(enc.encode(`event: ${evento}\ndata: ${dados || '{}'}\n\n`));
          }
          let ping = null;
          let closed = false;
          const escritor = (evento, dados) => {
            if (closed) throw new Error('SSE executor disconnected');
            mandar(evento, dados).catch(() => limpar());
          };
          const limpar = () => {
            if (closed) return;
            closed = true;
            if (ping) {
              clearInterval(ping);
              ping = null;
            }
            self.sse.delete(escritor);
            self.requeue(escritor);
            try {
              writer.close().catch((error) => ignorarErro(error, 'close-stream'));
            } catch (e) {
              ignorarErro(e, 'limpar');
            }
          };
          this.sse.add(escritor);
          mandar('hello', JSON.stringify({ v: VERSAO })).catch(() => limpar());
          ping = setInterval(() => {
              mandar('ping', '{}').catch(() => limpar());
            }, 20000);
          try {
            req.signal.addEventListener('abort', limpar);
          } catch (e) {
            ignorarErro(e, 'rotaSse');
          }
          setTimeout(() => {
              const fl = self.fila.splice(0);
              for (const ev of fl) self.entregar(ev);
            }, 10);
          return new Response(ts.readable, {
              headers: Object.assign(
                {
                  'Content-Type': 'text/event-stream',
                  'Cache-Control': 'no-cache, no-transform',
                  'X-Synapse-Relay': VERSAO,
                },
                CORS,
              ),
          });
        }

        rotaWs(req) {
          if (String(req.headers.get('Upgrade') || '').toLowerCase() !== 'websocket')
          return tres('esperava upgrade websocket', 426);
          this.contar('bridge');
          const par = new WebSocketPair();
          const cliente = par[0],
          servidor = par[1];
          servidor.accept();
          const self = this;
          this.tabs.add(servidor);
          let ping = setInterval(() => {
              try {
                servidor.send(JSON.stringify({ t: 'ping' }));
              } catch (e) {
                ignorarErro(e, 'rotaWs');
              }
            }, 20000);
          const tchau = () => {
            if (ping) {
              clearInterval(ping);
              ping = null;
            }
            self.tabs.delete(servidor);
            self.requeue(servidor);
          };
          servidor.addEventListener('close', tchau);
          servidor.addEventListener('error', tchau);
          servidor.addEventListener('message', (ev) => {
              let m = null;
              try {
                m = JSON.parse(ev.data);
              } catch (e) {
                return;
              }
              if (!m || typeof m !== 'object') return;
              if (m.t === 'ping') {
                try {
                  servidor.send(JSON.stringify({ t: 'pong' }));
                } catch (e) {
                  ignorarErro(e, 'rotaWs');
                }
                return;
              }
              if (m.t === 'pong') return;
              if (m.t === 'reply' && m.reqId != null) {
                servidor.send(JSON.stringify(self.acknowledgeReplies([m])));
                return;
              }
              if (m.t === 'replies' && Array.isArray(m.items)) {
                servidor.send(JSON.stringify(self.acknowledgeReplies(m.items)));
                return;
              }
              if (m.t === 'meta') {
                try {
                  self.mesclarMeta(m);
                } catch (e) {
                  ignorarErro(e, 'rotaWs');
                }
                return;
              }
              if (m.t === 'stats?') {
                self.empurrarStats(true);
                return;
              }
          });
          try {
            servidor.send(JSON.stringify({ t: 'hello', v: VERSAO }));
          } catch (e) {
            ignorarErro(e, 'rotaWs');
          }
          this.empurrarStats(true);
          setTimeout(() => {
              const fl = self.fila.splice(0);
              for (const ev of fl) self.entregar(ev);
            }, 10);
          return new Response(null, { status: 101, webSocket: cliente });
        }

        async encaminhar(req, url, corpo, motivo) {
          const lista = this.reservasCfg();
          if (!lista.length) return null;
          let meuHost = '';
          try {
            meuHost = url.host;
          } catch (e) {
            ignorarErro(e, 'encaminhar');
          }
          const corpoTxt = JSON.stringify(corpo);
          const sess = req.headers.get('Mcp-Session-Id') || req.headers.get('mcp-session-id') || '';
          const inicio = this.rrEnc++ % lista.length;
          for (let i = 0; i < lista.length; i++) {
            const base = lista[(inicio + i) % lista.length];
            let alvoHost = '';
            try {
              alvoHost = new URL(base).host;
            } catch (e) {
              continue;
            }
            if (!alvoHost || alvoHost === meuHost) continue;
            const sd = this.saudeR.get(base);
            if (sd && !sd.ok && Date.now() - sd.at < 15000) continue;
            try {
              const hd = {
                'Content-Type': 'application/json',
                Accept: 'application/json, text/event-stream',
                'X-Synapse-Salto': '1',
              };
              if (sess) hd['Mcp-Session-Id'] = sess;
              const r = await fetch(base + url.pathname + url.search, {
                  method: 'POST',
                  headers: hd,
                  body: corpoTxt,
                  signal: AbortSignal.timeout(this.cfg('AURORA_TIMEOUT_MS', 35000) + 8000),
              });
              if (r.status === 429 || r.status === 402 || r.status >= 500) {
                this.saudeR.set(base, { ok: false, at: Date.now() });
                continue;
              }
              this.saudeR.set(base, { ok: true, at: Date.now() });
              this.encaminhadas++;
              const h = new Headers(r.headers);
              for (const k of Object.keys(CORS)) h.set(k, CORS[k]);
              h.set('X-Synapse-No', `reserva ${alvoHost} (${motivo || 'failover'})`);
              return new Response(r.body, { status: r.status, headers: h });
            } catch (e) {
              this.saudeR.set(base, { ok: false, at: Date.now() });
            }
          }
          return null;
        }

        async rotaMcp(req, url) {
          if (req.method === 'DELETE') {
            this.contar('mcp');
            return new Response(null, {
                status: 204,
                headers: Object.assign({ 'X-Synapse-Relay': VERSAO }, CORS),
            });
          }
          if (req.method === 'GET' || req.method === 'HEAD') {
            if (this.sseLegado(url)) return this.mcpSse(req, url);
            return this.semStreamGet(req);
          }
          if (req.method !== 'POST') return tres('use POST', 405, { Allow: 'POST, DELETE, OPTIONS' });
          this.contar('mcp');
          const nv = this.nivel();

          let corpo = null;
          try {
            corpo = await req.json();
          } catch (e) {
            return jres(
              { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON invalido' } },
              400,
            );
          }

          const cid = url.searchParams.get('cid');
          const viaSse = url.searchParams.get('transport') === 'sse' && cid;
          const lote = Array.isArray(corpo) ? corpo : [corpo];
          if (!lote.length || lote.length > 64)
          return jres(
            {
              jsonrpc: '2.0',
              id: null,
              error: {
                code: -32600,
                message: 'Batch must contain between 1 and 64 messages. Nothing was executed.',
              },
            },
            400,
          );

          const salto = !!req.headers.get('X-Synapse-Salto');
          const temCall = lote.some((m) => m && m.method === 'tools/call');
          const semExecutor = this.tabs.size + this.sse.size === 0 && this.pollers.length === 0;
          if (salto && temCall && semExecutor)
          return tres('reserva sem executor conectado para esta sessao', 503);
          const spillover =
          !salto &&
          !viaSse &&
          temCall &&
          (semExecutor || (nv.L.free && nv.critico && (nv.pMin >= 0.97 || nv.pDia >= 0.995)));
          if (spillover) {
            const enc = await this.encaminhar(
              req,
              url,
              corpo,
              semExecutor ? 'sem executor' : 'capacidade',
            );
            if (enc) return enc;
          }

          const atrasoCrit = Math.max(0, this.cfg('ATRASO_CRITICO_MS', 0));
          const jitterCrit = Math.max(0, this.cfg('ATRASO_CRITICO_JITTER_MS', 0));
          const atrasoQuente = Math.max(0, this.cfg('ATRASO_QUENTE_MS', 0));
          const jitterQuente = Math.max(0, this.cfg('ATRASO_QUENTE_JITTER_MS', 0));
          if (nv.critico && (atrasoCrit || jitterCrit))
          await new Promise((r) =>
            setTimeout(r, atrasoCrit + Math.floor(Math.random() * (jitterCrit + 1))),
          );
          else if (nv.quente && (atrasoQuente || jitterQuente))
          await new Promise((r) =>
            setTimeout(r, atrasoQuente + Math.floor(Math.random() * (jitterQuente + 1))),
          );
          const responses = await Promise.all(lote.map((message) => this.tratarMcpMsg(message, nv)));
          const saidas = responses.filter(Boolean);
          let com429 = false;
          for (const response of saidas) {
            if (response.__http429) {
              com429 = true;
              delete response.__http429;
            }
          }

          const sess = req.headers.get('Mcp-Session-Id') || req.headers.get('mcp-session-id') || '';
          const extra = {
            'X-Synapse-Plano': this.plano(),
            'X-Synapse-Dia': String(this.uso.nDia),
            'X-Synapse-Min': String(this.uso.nMin),
          };
          const temInit = lote.some((m) => m && m.method === 'initialize');
          if (temInit)
          extra['Mcp-Session-Id'] =
          sess || Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
          else if (sess) extra['Mcp-Session-Id'] = sess;
          if (com429) extra['Retry-After'] = '8';

          if (viaSse) {
            const esc = this.cids.get(cid);
            if (esc) {
              for (const s of saidas) {
                try {
                  esc('message', JSON.stringify(s));
                } catch (e) {
                  ignorarErro(e, 'rotaMcp');
                }
              }
            }
            return tres('Accepted', 202, extra);
          }
          if (!saidas.length)
          return new Response(null, {
              status: 202,
              headers: Object.assign(
                { 'X-Synapse-Relay': VERSAO, 'X-Synapse-No': 'ack-notificacao' },
                CORS,
                extra,
              ),
          });
          const unico = !Array.isArray(corpo);
          return jres(unico ? saidas[0] : saidas, com429 ? 429 : 200, extra);
        }

        sseLegado(url) {
          try {
            const q = url.searchParams;
            if (q.get('transport') === 'sse' || q.get('sse') === '1' || q.get('legado') === 'sse')
            return true;
          } catch (e) {
            ignorarErro(e, 'sseLegado');
          }
          return /^(1|true|sim|yes|on)$/i.test(String((this.env && this.env.SSE_LEGADO) || ''));
        }

        semStreamGet(req) {
          const h = Object.assign(
            {
              'Content-Type': 'application/json; charset=utf-8',
              Allow: 'POST, DELETE, OPTIONS',
              'X-Synapse-Relay': VERSAO,
              'X-Synapse-No': 'get-sem-stream',
            },
            CORS,
          );
          if (req.method === 'HEAD') return new Response(null, { status: 405, headers: h });
          return new Response(
            JSON.stringify({
                jsonrpc: '2.0',
                id: null,
                error: {
                  code: -32000,
                  message:
                  'Este servidor MCP fala Streamable HTTP: mande as mensagens por POST nesta mesma URL. O ' +
                  'stream GET nao e oferecido (HTTP 405, permitido pela especificacao). Se o seu cliente ' +
                  'so fala o transporte SSE legado, acrescente ?transport=sse na URL.',
                },
            }),
            { status: 405, headers: h },
          );
        }

        mcpSse(req, url) {
          this.contar();
          const self = this;
          const cid = Math.random().toString(36).slice(2, 12);
          const ts = new TransformStream();
          const writer = ts.writable.getWriter();
          const enc = new TextEncoder();
          function mandar(evento, dados) {
            return writer.write(enc.encode(`event: ${evento}\ndata: ${dados}\n\n`));
          }
          let ping = null;
          const limpar = () => {
            if (ping) {
              clearInterval(ping);
              ping = null;
            }
            self.cids.delete(cid);
            try {
              writer.close().catch((error) => ignorarErro(error, 'close-stream'));
            } catch (e) {
              ignorarErro(e, 'limpar');
            }
          };
          const escritor = (evento, dados) => {
            mandar(evento, dados).catch(() => limpar());
          };
          this.cids.set(cid, escritor);
          const origemPub =
          String(req.headers.get('X-Synapse-Origem') || '')
          .trim()
          .replace(/\/+$/, '') || url.origin;
          mandar('endpoint', origemPub + url.pathname + '?transport=sse&cid=' + cid).catch(() =>
            limpar(),
          );
          ping = setInterval(() => {
              writer.write(enc.encode(': ping\n\n')).catch(() => limpar());
            }, 20000);
          try {
            req.signal.addEventListener('abort', limpar);
          } catch (e) {
            ignorarErro(e, 'mcpSse');
          }
          return new Response(ts.readable, {
              headers: Object.assign(
                {
                  'Content-Type': 'text/event-stream',
                  'Cache-Control': 'no-cache, no-transform',
                  'X-Synapse-Relay': VERSAO,
                },
                CORS,
              ),
          });
        }
      }
