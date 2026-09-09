'use strict';
(function auroraAdmissaoDedupe() {
    if (typeof window === 'undefined') return;
    if (window.__MCP_ADMISSAO_V10) return;
    window.__MCP_ADMISSAO_V10 = true;

    const CFG = {
      limite: { escrita: 1, comando: 1, leitura: 4 },
      profundidadeMax: 64,
      payloadMaxBytes: 32768,
      cachePayloadMax: 200,
      metaMax: 2000,
      sweepMs: 5000,
      sweepChamadas: 500,
      esperaMaxMs: 23000,
      queueWaitMs: 18000,
      responseBudgetMs: 24000,
      retryAfterS: 10,
    };

    const FERR_ESCRITA = new Set([
        'write_file',
        'write_files',
        'create_file',
        'edit_file',
        'delete',
        'rename',
        'restore_version',
        'restore_snapshot',
        'snapshot_project',
        'add_asset_from_url',
        'add_asset_base64',
        'model3d_forge',
        'model3d_set_pivot',
        'model3d_transform',
        'model3d_apply',
        'model3d_convert',
        'create_project',
        'open_project_from_disk',
        'set_active_project',
    ]);

    const FERR_COMANDO = new Set([
        'run_command',
        'stop_command',
        'start_dev_server',
        'stop_dev_server',
        'deploy_static',
        'undeploy_static',
        'export_zip',
        'command_output',
        'wait_for',
        'wait_for_errors',
        'assert_state',
        'perf_stats',
        'record_frames',
        'screenshot_burst',
        'run_scenario',
    ]);

    const METODOS_LIVRES = new Set([
        'initialize',
        'ping',
        'tools/list',
        'resources/list',
        'resources/templates/list',
        'prompts/list',
        'completion/complete',
    ]);

    const MSG_SEM_CACHE =
    'Esta chamada ja foi executada nesta aba, mas a resposta era grande demais para ficar em cache. ' +
    'NAO repita cegamente: confira o estado atual (project_status / list_files / read_file) antes de agir de novo.';

    const MSG_AINDA_RODANDO =
    'Chamada identica ja esta em execucao nesta aba e ainda nao terminou. ' +
    'Nada foi duplicado. Espere alguns segundos e consulte o estado antes de repetir.';

    function ignora(e, ctx) {
      try {
        if (typeof ignorarErro === 'function') ignorarErro(e, ctx || 'admissao');
      } catch (e2) {
        void e2;
      }
    }

    function num(v, d) {
      return typeof v === 'number' && isFinite(v) && v > 0 ? v : d;
    }

    function ttlSeen() {
      try {
        return num(typeof MCP_SEEN_TTL !== 'undefined' ? MCP_SEEN_TTL : 0, 300000);
      } catch (e) {
        return 300000;
      }
    }

    function mapa() {
      try {
        if (typeof MCP === 'undefined' || !MCP) return null;
        if (!MCP.seenReq || typeof MCP.seenReq.get !== 'function') MCP.seenReq = new Map();
        return MCP.seenReq;
      } catch (e) {
        return null;
      }
    }

    function idDe(pkt) {
      try {
        const b = pkt && pkt.body;
        if (b && !Array.isArray(b) && b.id !== undefined) return b.id;
      } catch (e) {
        ignora(e, 'idDe');
      }
      return null;
    }

    function erroJson(id, code, msg, data) {
      const err = { code: code, message: String(msg) };
      if (data) err.data = data;
      return { jsonrpc: '2.0', id: id === undefined ? null : id, error: err };
    }

    function erroOcupado(id) {
      return erroJson(
        id,
        -32000,
        'A aba do site esta com a fila cheia (' +
        Q.profundidade +
        ' de ' +
        CFG.profundidadeMax +
        ' chamadas). NADA foi executado desta vez - nao existe trabalho pela metade. ' +
        'Isto nao e queda de conexao: espere ~' +
        CFG.retryAfterS +
        s_ou_() +
        ' e repita esta mesma chamada, de preferencia enviando menos chamadas em paralelo.',
        {
          retry_after: CFG.retryAfterS,
          ocupado: true,
          fila: Q.profundidade,
          teto: CFG.profundidadeMax,
          em_voo: {
            escrita: Q.emVoo.escrita,
            comando: Q.emVoo.comando,
            leitura: Q.emVoo.leitura,
          },
        },
      );
    }

    function s_ou_() {
      return 's';
    }

    function djb2(s) {
      let h = 5381;
      for (let i = 0; i < s.length; i++) h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
      return h.toString(36);
    }

    function hashAmostra(s) {
      const n = s.length;
      if (!n) return '0';
      let h = 5381;
      const passo = n <= 1024 ? 1 : Math.ceil(n / 1024);
      for (let i = 0; i < n; i += passo) h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
      return h.toString(36) + '.' + n.toString(36);
    }

    function assinatura(v, prof) {
      if (v === null || v === undefined) return '~';
      const t = typeof v;
      if (t === 'string') return 's' + hashAmostra(v);
      if (t === 'number' || t === 'boolean') return String(v);
      if (t !== 'object') return 'x';
      if (prof >= 3) return 'o';
      if (Array.isArray(v)) {
        const lim = Math.min(v.length, 24);
        let s = 'a' + v.length + '[';
        for (let i = 0; i < lim; i++) s += assinatura(v[i], prof + 1) + ',';
        return s + ']';
      }
      let ks;
      try {
        ks = Object.keys(v).sort();
      } catch (e) {
        return 'o';
      }
      const lim = Math.min(ks.length, 40);
      let s = '{';
      for (let i = 0; i < lim; i++) s += ks[i] + '=' + assinatura(v[ks[i]], prof + 1) + ';';
      return s + '}';
    }

    function chaveDe(pkt) {
      let base = '';
      try {
        const b = (pkt && pkt.body) || null;
        if (Array.isArray(b)) {
          base = 'lote' + b.length + assinatura(b.slice(0, 8), 1);
        } else if (b) {
          base =
          String(b.method || '') +
          '|' +
          (b.id !== undefined && b.id !== null ? String(b.id) : '') +
          '|' +
          String((b.params && b.params.name) || '') +
          '|' +
          assinatura(b.params || null, 0);
        }
      } catch (e) {
        ignora(e, 'chaveDe');
        base = 'erro';
      }
      const pre = pkt && pkt.ep !== null && pkt.ep !== undefined ? String(pkt.ep) + '|' : '';
      return (
        pre + (pkt ? String(pkt.reqId) : '?') + '|' + djb2(base) + '|' + base.length.toString(36)
      );
    }

    const comPayload = new Set();
    let ultSweep = 0;
    let desdeSweep = 0;

    function apagar(m, k) {
      m.delete(k);
      comPayload.delete(k);
    }

    function varrer(forcar) {
      const m = mapa();
      if (!m) return;
      const t = Date.now();
      desdeSweep++;
      if (!forcar && t - ultSweep < CFG.sweepMs && desdeSweep < CFG.sweepChamadas) return;
      ultSweep = t;
      desdeSweep = 0;
      const ttl = ttlSeen();
      const morrer = [];
      m.forEach(function (v, k) {
          if (v && v.done && t - (v.t || 0) > ttl) morrer.push(k);
      });
      for (let i = 0; i < morrer.length; i++) apagar(m, morrer[i]);
      if (m.size > CFG.metaMax) {
        const sobra = m.size - CFG.metaMax;
        const alvo = [];
        m.forEach(function (v, k) {
            if (alvo.length < sobra && v && v.done) alvo.push(k);
        });
        for (let i = 0; i < alvo.length; i++) apagar(m, alvo[i]);
      }
    }

    function tamanhoAprox(out) {
      try {
        if (out === null || out === undefined) return 64;
        if (typeof out !== 'object') return 128;
        if (out.error) return 512 + String((out.error && out.error.message) || '').length * 2;
        const r = out.result;
        if (r === null || r === undefined) return 128;
        if (typeof r !== 'object') return 256;
        if (Array.isArray(r.content)) {
          let n = 512;
          for (let i = 0; i < r.content.length; i++) {
            const c = r.content[i];
            if (!c) continue;
            if (typeof c.text === 'string') n += c.text.length * 2;
            else if (typeof c.data === 'string') n += c.data.length;
            else n += 512;
          }
          return n;
        }
        return CFG.payloadMaxBytes + 1;
      } catch (e) {
        return CFG.payloadMaxBytes + 1;
      }
    }

    function guardarPayload(k) {
      comPayload.delete(k);
      comPayload.add(k);
      if (comPayload.size <= CFG.cachePayloadMax) return;
      const m = mapa();
      while (comPayload.size > CFG.cachePayloadMax) {
        const it = comPayload.values().next();
        if (it.done) break;
        const velho = it.value;
        comPayload.delete(velho);
        const e = m && m.get(velho);
        if (e) {
          e.out = null;
          e.omitido = true;
        }
      }
    }

    function verEntrada(map, key) {
      return map.get(key) || null;
    }

    function marcarVoo(map, key, message) {
      map.set(key, { t: Date.now(), done: false, out: null, omitido: false, esperando: [], message });
    }

    function concluir(k, out) {
      const m = mapa();
      if (!m) return;
      const prev = m.get(k) || null;
      const esperando = (prev && prev.esperando) || null;
      const cabe = tamanhoAprox(out) <= CFG.payloadMaxBytes;
      m.set(k, { t: Date.now(), done: true, out: cabe ? out : null, omitido: !cabe });
      if (cabe) guardarPayload(k);
      else comPayload.delete(k);
      if (!esperando || !esperando.length) return;
      for (let i = 0; i < esperando.length; i++) {
        const w = esperando[i];
        try {
          if (w.timer) clearTimeout(w.timer);
        } catch (e) {
          ignora(e, 'concluir');
        }
        try {
          const p = w.responder(w.reqId, out, w.packet);
          if (p && typeof p.catch === 'function')
          p.catch(function (e) {
              ignora(e, 'concluir');
          });
        } catch (e) {
          ignora(e, 'concluir');
        }
      }
      esperando.length = 0;
    }

    function sendSafely(reply, packet, response) {
      try {
        Promise.resolve(reply(packet.reqId, response, packet)).catch((error) =>
          ignora(error, 'reply'),
        );
      } catch (error) {
        ignora(error, 'reply');
      }
    }

    function registrarEspera(entry, packet, reply) {
      if (!entry.esperando) entry.esperando = [];
      const waiting = { reqId: packet.reqId, packet, responder: reply, timer: 0 };
      const respondPending = () =>
      sendSafely(
        reply,
        packet,
        window.SynapseMcpCallLifecycle?.pending(entry.message, idDe(packet)) ||
        erroJson(idDe(packet), -32000, MSG_AINDA_RODANDO, { retry_original: false }),
      );
      if (entry.esperando.length >= 8) return respondPending();
      const waitingBudget = Number.isFinite(packet.budgetMs)
      ? Math.max(1, Math.min(CFG.esperaMaxMs, packet.budgetMs - 7000))
      : CFG.esperaMaxMs;
      waiting.timer = setTimeout(() => {
          const index = entry.esperando.indexOf(waiting);
          if (index >= 0) entry.esperando.splice(index, 1);
          respondPending();
        }, waitingBudget);
      entry.esperando.push(waiting);
    }

    const Q = {
      fila: [],
      emVoo: { escrita: 0, comando: 0, leitura: 0 },
      profundidade: 0,
      aceitas: 0,
      concluidas: 0,
      recusadas: 0,
      livres: 0,
      dedupeCache: 0,
      dedupeVoo: 0,
      dedupeOmitido: 0,
      picoFila: 0,
      picoProfundidade: 0,
      esperaMaxMs: 0,
    };

    function resolveToolName(message) {
      const name = String(message?.params?.name || '');
      const action = String(message?.params?.arguments?.action || '').trim();
      const tools = typeof MCP_TOOLS !== 'undefined' && Array.isArray(MCP_TOOLS) ? MCP_TOOLS : [];
      const members = tools.find((tool) => tool.name === name)?.__group?.members;
      return members && Object.prototype.hasOwnProperty.call(members, action)
      ? members[action]
      : name;
    }

    function requestLanes(body) {
      if (Array.isArray(body)) return [...new Set(body.flatMap(requestLanes))];
      const lane = classeDe(body);
      return lane ? [lane] : [];
    }

    function queuedRejection(packet) {
      const failure = (message) =>
      erroJson(
        message?.id ?? null,
        -32000,
        'Executor busy. This queued call was not started. Retry after current work drains.',
        { executed: false, retry_after: 2, reason: 'admission_capacity' },
      );
      return Array.isArray(packet.body)
      ? packet.body.filter((message) => message && message.id !== undefined).map(failure)
      : failure(packet.body);
    }

    function expireQueued(item) {
      const index = Q.fila.indexOf(item);
      if (index < 0) return;
      Q.fila.splice(index, 1);
      clearTimeout(item.queueTimer);
      Q.profundidade--;
      Q.recusadas++;
      const response = queuedRejection(item.pkt);
      concluir(item.key, response);
      sendSafely(item.responder, item.pkt, response);
      if (!ocupado()) avisarDreno();
    }

    function classeDe(body) {
      if (!body || typeof body !== 'object') return 'leitura';
      if (Array.isArray(body)) return requestLanes(body)[0] || null;
      const m = String(body.method || '');
      if (!m) return 'leitura';
      if (METODOS_LIVRES.has(m)) return null;
      if (m.indexOf('notifications/') === 0) return null;
      if (m !== 'tools/call') return 'leitura';
      const nome = resolveToolName(body);
      if (['call_status', 'stop_command', 'stop_dev_server', 'dev_server_status'].includes(nome))
      return null;
      if (FERR_COMANDO.has(nome)) return 'comando';
      if (FERR_ESCRITA.has(nome)) return 'escrita';
      return 'leitura';
    }

    function limiteDe(cls) {
      return num(CFG.limite[cls], 1);
    }

    function ocupado() {
      return Q.fila.length > 0 || Q.emVoo.escrita > 0 || Q.emVoo.comando > 0 || Q.emVoo.leitura > 0;
    }

    function bombear() {
      if (!Q.fila.length) return;
      for (let i = 0; i < Q.fila.length;) {
        const it = Q.fila[i];
        if (Date.now() >= it.queueDeadline) {
          expireQueued(it);
          continue;
        }
        if (it.lanes.every((lane) => Q.emVoo[lane] < limiteDe(lane))) {
          Q.fila.splice(i, 1);
          iniciar(it);
        } else {
          i++;
        }
      }
    }

    async function chamarNucleo(pkt) {
      const h = window.mcpHandleMessage;
      if (typeof h !== 'function') throw new Error('mcpHandleMessage indisponivel nesta aba');
      return await h(pkt.body);
    }

    async function iniciar(item) {
      clearTimeout(item.queueTimer);
      Q.esperaMaxMs = Math.max(Q.esperaMaxMs, Date.now() - item.em);
      for (const lane of item.lanes) Q.emVoo[lane]++;
      let response;
      const lifecycle = window.SynapseMcpCallLifecycle;
      try {
        response = lifecycle
        ? await lifecycle.execute(
          item.pkt,
          () => chamarNucleo(item.pkt),
          item.responder,
          item.responseDeadline - Date.now(),
        )
        : await chamarNucleo(item.pkt);
      } catch (error) {
        response = erroJson(idDe(item.pkt), -32603, String(error?.message || error));
      } finally {
        for (const lane of item.lanes) Q.emVoo[lane]--;
        Q.profundidade--;
        Q.concluidas++;
        bombear();
        if (!ocupado()) avisarDreno();
      }
      concluir(item.key, response);
      if (!lifecycle) sendSafely(item.responder, item.pkt, response);
    }

    async function rodarLivre(k, pkt, resp) {
      Q.livres++;
      let out = null;
      try {
        out = await chamarNucleo(pkt);
      } catch (e) {
        out = erroJson(idDe(pkt), -32603, String((e && e.message) || e));
      }
      if (k) {
        try {
          concluir(k, out);
        } catch (e) {
          ignora(e, 'rodarLivre');
        }
      }
      try {
        await resp(pkt.reqId, out, pkt);
      } catch (e) {
        ignora(e, 'rodarLivre');
      }
    }

    function responderPadrao(reqId, out, packet) {
      try {
        if (typeof window.mcpEnviarResposta === 'function')
        return window.mcpEnviarResposta(reqId, out, packet);
      } catch (e) {
        ignora(e, 'responderPadrao');
      }
    }

    async function executarPacote(pkt, responder) {
      if (!pkt || pkt.reqId === null || pkt.reqId === undefined) return;
      const resp = typeof responder === 'function' ? responder : responderPadrao;
      const m = mapa();
      if (!m) return void (await rodarLivre(null, pkt, resp));

      varrer(false);
      const k = chaveDe(pkt);
      const v = verEntrada(m, k);
      if (v) {
        if (v.done) {
          Q.dedupeCache++;
          try {
            if (v.omitido) {
              Q.dedupeOmitido++;
              await resp(
                pkt.reqId,
                erroJson(idDe(pkt), -32000, MSG_SEM_CACHE, { retry_original: false }),
                pkt,
              );
            } else {
              await resp(pkt.reqId, v.out, pkt);
            }
          } catch (e) {
            ignora(e, 'executarPacote');
          }
        } else {
          Q.dedupeVoo++;
          registrarEspera(v, pkt, resp);
        }
        return;
      }

      const lanes = requestLanes(pkt.body);
      marcarVoo(m, k, pkt.body);

      if (!lanes.length) return void (await rodarLivre(k, pkt, resp));

      if (Q.profundidade >= CFG.profundidadeMax) {
        Q.recusadas++;
        apagar(m, k);
        try {
          await resp(pkt.reqId, queuedRejection(pkt), pkt);
        } catch (e) {
          ignora(e, 'executarPacote');
        }
        return;
      }

      Q.aceitas++;
      Q.profundidade++;
      if (Q.profundidade > Q.picoProfundidade) Q.picoProfundidade = Q.profundidade;
      const now = Date.now();
      const transportBudget = Number.isFinite(pkt.budgetMs)
      ? Math.max(0, pkt.budgetMs - 7000)
      : CFG.responseBudgetMs;
      const budget = Math.min(CFG.responseBudgetMs, transportBudget);
      const item = {
        key: k,
        pkt,
        responder: resp,
        lanes,
        em: now,
        responseDeadline: now + budget,
        queueDeadline: now + Math.min(CFG.queueWaitMs, budget),
        queueTimer: 0,
      };
      Q.fila.push(item);
      item.queueTimer = setTimeout(() => expireQueued(item), Math.max(1, item.queueDeadline - now));
      if (Q.fila.length > Q.picoFila) Q.picoFila = Q.fila.length;
      bombear();
    }

    function despacharPacotes(pkts, responder) {
      if (!pkts || !pkts.length) return;
      for (let i = 0; i < pkts.length; i++) {
        try {
          const p = executarPacote(pkts[i], responder);
          if (p && typeof p.catch === 'function')
          p.catch(function (e) {
              ignora(e, 'despachar');
          });
        } catch (e) {
          ignora(e, 'despachar');
        }
      }
    }

    const aoDrenar = [];
    let drenoT = 0;

    function avisarDreno() {
      if (drenoT) return;
      drenoT = setTimeout(function () {
          drenoT = 0;
          if (ocupado()) return;
          for (let i = 0; i < aoDrenar.length; i++) {
            try {
              aoDrenar[i]();
            } catch (e) {
              ignora(e, 'dreno');
            }
          }
        }, 250);
    }

    function aoDrenarFila(fn) {
      if (typeof fn === 'function' && aoDrenar.indexOf(fn) < 0) aoDrenar.push(fn);
    }

    function estado() {
      const m = mapa();
      return {
        filaEsperando: Q.fila.length,
        profundidade: Q.profundidade,
        teto: CFG.profundidadeMax,
        emVoo: { escrita: Q.emVoo.escrita, comando: Q.emVoo.comando, leitura: Q.emVoo.leitura },
        limites: {
          escrita: CFG.limite.escrita,
          comando: CFG.limite.comando,
          leitura: CFG.limite.leitura,
        },
        saturada: Q.profundidade >= CFG.profundidadeMax,
        aceitas: Q.aceitas,
        concluidas: Q.concluidas,
        recusadas: Q.recusadas,
        semFila: Q.livres,
        dedupeEmCache: Q.dedupeCache,
        dedupeEmVoo: Q.dedupeVoo,
        dedupeSemPayload: Q.dedupeOmitido,
        picoFila: Q.picoFila,
        picoProfundidade: Q.picoProfundidade,
        esperaMaxMs: Q.esperaMaxMs,
        entradasDedupe: m ? m.size : 0,
        entradasComResposta: comPayload.size,
        tetoEntradasComResposta: CFG.cachePayloadMax,
        tetoRespostaBytes: CFG.payloadMaxBytes,
      };
    }

    function resumo() {
      const e = estado();
      return (
        'fila ' +
        e.profundidade +
        '/' +
        e.teto +
        ' (esperando ' +
        e.filaEsperando +
        '; em voo escrita ' +
        e.emVoo.escrita +
        ', comando ' +
        e.emVoo.comando +
        ', leitura ' +
        e.emVoo.leitura +
        ')' +
        (e.saturada ? ' - SATURADA, aguarde antes de enviar mais chamadas' : '') +
        '; dedupe ' +
        e.entradasDedupe +
        ' entradas / ' +
        e.entradasComResposta +
        ' com resposta em cache; recusadas ' +
        e.recusadas
      );
    }

    function zerar() {
      Q.aceitas = 0;
      Q.concluidas = 0;
      Q.recusadas = 0;
      Q.livres = 0;
      Q.dedupeCache = 0;
      Q.dedupeVoo = 0;
      Q.dedupeOmitido = 0;
      Q.picoFila = 0;
      Q.picoProfundidade = 0;
      Q.esperaMaxMs = 0;
      return estado();
    }

    function autoteste() {
      const falhas = [];
      const grande = {
        jsonrpc: '2.0',
        id: 1,
        result: { content: [{ type: 'text', text: 'x'.repeat(200000) }] },
      };
      const pequeno = { jsonrpc: '2.0', id: 2, result: { content: [{ type: 'text', text: 'ok' }] } };
      if (tamanhoAprox(grande) <= CFG.payloadMaxBytes) falhas.push('resposta grande seria cacheada');
      if (tamanhoAprox(pequeno) > CFG.payloadMaxBytes)
      falhas.push('resposta pequena nao seria cacheada');
      const p1 = {
        reqId: 'r1',
        ep: null,
        body: {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'write_file', arguments: { path: 'a.txt', content: 'a'.repeat(50000) } },
        },
      };
      const p2 = {
        reqId: 'r1',
        ep: null,
        body: {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'write_file', arguments: { path: 'a.txt', content: 'a'.repeat(50000) } },
        },
      };
      const p3 = {
        reqId: 'r1',
        ep: null,
        body: {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'write_file', arguments: { path: 'a.txt', content: 'b'.repeat(50000) } },
        },
      };
      if (chaveDe(p1) !== chaveDe(p2)) falhas.push('chamadas identicas geraram chaves diferentes');
      if (chaveDe(p1) === chaveDe(p3)) falhas.push('chamadas diferentes geraram a mesma chave');
      if (classeDe(p1.body) !== 'escrita')
      falhas.push('write_file nao foi classificado como escrita');
      if (classeDe({ method: 'tools/call', params: { name: 'read_file' } }) !== 'leitura')
      falhas.push('read_file nao foi classificado como leitura');
      if (classeDe({ method: 'tools/list' }) !== null)
      falhas.push('tools/list nao ficou fora da fila');
      if (classeDe({ method: 'tools/call', params: { name: 'run_command' } }) !== 'comando')
      falhas.push('run_command nao foi classificado como comando');
      return { ok: falhas.length === 0, falhas: falhas, estado: estado() };
    }

    window.SynapseMcpResolveToolName = resolveToolName;
    window.mcpExecutarPacote = executarPacote;
    window.mcpDespacharPacotes = despacharPacotes;
    window.mcpChaveDedupe = chaveDe;
    window.mcpVarrerDedupe = function (forcar) {
      varrer(!!forcar);
    };
    window.MCP_ADMISSAO = {
      ver: '10.10.0',
      cfg: CFG,
      estado: estado,
      resumo: resumo,
      zerar: zerar,
      ocupado: ocupado,
      aoDrenar: aoDrenarFila,
      autoteste: autoteste,
      executar: executarPacote,
      despachar: despacharPacotes,
    };
    window.SYNAPSE_FILA = window.MCP_ADMISSAO;

    try {
      if (typeof console !== 'undefined' && console.info) {
        console.info(
          '[Synapse] admissao MCP v10.10 ativa - escrita ' +
          CFG.limite.escrita +
          ', leitura ' +
          CFG.limite.leitura +
          ', comando ' +
          CFG.limite.comando +
          ', teto de fila ' +
          CFG.profundidadeMax,
        );
      }
    } catch (e) {
      ignora(e, 'banner');
    }
})();
