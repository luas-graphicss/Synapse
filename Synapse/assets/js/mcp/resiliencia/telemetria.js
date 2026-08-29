'use strict';

(function auroraTelemetriaMcp() {
	let VERBOSO = false;
	try {
		VERBOSO = localStorage.getItem('aurora.mcp.verboso') === '1';
	} catch (e) {
		ignorarErro(e, 'auroraTelemetriaMcp');
	}

	const INTERNOS = { 'aurora-cache': 1, 'aurora-autoteste': 1, 'synapse-autoteste': 1 };
	const H = {
		inicio: 0,
		cliente: '',
		passos: {},
		ferramentas: 0,
		concluido: false,
		vigia: null,
		aviso: null,
		chegouAlgo: 0,
		autoteste: 0,
		recebidos: 0,
		respondidos: 0,
		falhasResposta: 0,
		ligadoEm: Date.now(),
	};
	const HIST = [];

	function ts() {
		return new Date().toISOString().slice(11, 23);
	}
	function guardar(k, t) {
		HIST.push({ t: Date.now(), kind: k, text: t });
		if (HIST.length > 500) HIST.shift();
	}
	function proj() {
		try {
			return typeof activeProject === 'function' ? activeProject() : null;
		} catch (e) {
			return null;
		}
	}
	function diga(k, t, soConsole) {
		guardar(k, t);
		try {
			window.__mcpDiagIgnorar = 1;
			if (!soConsole && typeof mcpLog === 'function') mcpLog(k === 'err' ? 'err' : 'ok', t);
		} catch (e) {
			ignorarErro(e, 'diga');
		} finally {
			try {
				window.__mcpDiagIgnorar = 0;
			} catch (e) {
				ignorarErro(e, 'diga');
			}
		}
		try {
			const p = proj();
			if (p && typeof pushLog === 'function') pushLog(p, k === 'err' ? 'error' : 'mcp', t, 'mcp');
		} catch (e) {
			ignorarErro(e, 'diga');
		}
		try {
			registro.debug(`%c[MCP ${ts()}] ${t}`, k === 'err' ? 'color:#ff6b6b' : 'color:#6aa3ff');
		} catch (e) {
			ignorarErro(e, 'diga');
		}
	}
	function kb(x) {
		try {
			const n = JSON.stringify(x).length;
			return n > 1024 ? (n / 1024).toFixed(1) + ' kB' : n + ' B';
		} catch (e) {
			return '?';
		}
	}
	function nomeCliente(msg) {
		try {
			return String((msg.params && msg.params.clientInfo && msg.params.clientInfo.name) || '');
		} catch (e) {
			return '';
		}
	}
	function ativo() {
		try {
			return !!MCP.active;
		} catch (e) {
			return false;
		}
	}
	function urlPublica() {
		try {
			return typeof mcpPublicUrl === 'function' ? mcpPublicUrl() : '';
		} catch (e) {
			return '';
		}
	}
	function no(u) {
		try {
			return String(u || '')
				.replace(/^https?:\/\//, '')
				.split('/')[0];
		} catch (e) {
			return String(u || '');
		}
	}

	function abrirHandshake(cliente) {
		H.inicio = Date.now();
		H.cliente = cliente || 'cliente MCP';
		H.passos = {};
		H.ferramentas = 0;
		H.concluido = false;
		clearTimeout(H.vigia);
		H.vigia = setTimeout(vigiarHandshake, 25000);
	}
	function vigiarHandshake() {
		if (H.concluido || !H.inicio) return;
		const fez = [];
		if (H.passos['initialize']) fez.push('1/3 initialize');
		if (H.passos['notifications/initialized']) fez.push('2/3 notifications/initialized');
		if (H.passos['tools/list']) fez.push('3/3 tools/list');
		const falta = !H.passos['notifications/initialized']
			? 'notifications/initialized (passo 2)'
			: 'tools/list (passo 3)';
		diga(
			'err',
			`LADO DO NOTION/RELAY: esta aba respondeu tudo que recebeu (${fez.join(' · ') || 'nada'}), mas o ${H.cliente} \
nao pediu ${falta} em 25s. O site nao esta segurando a conexao. Rode SYNAPSE_MCP.testar() para saber \
se a URL repassa.`,
		);
	}

	function narrarEntrada(msg) {
		let metodo = '';
		try {
			metodo = String((msg && msg.method) || '');
		} catch (e) {
			ignorarErro(e, 'narrarEntrada');
		}
		const cliente = nomeCliente(msg);
		const interno =
			!!INTERNOS[cliente] ||
			(msg &&
				(msg.id === 'cat-i' ||
					msg.id === 'cat-t' ||
					msg.id === 'cat-i2' ||
					msg.id === 'cat-t2' ||
					msg.id === 'cat-i3' ||
					msg.id === 'cat-t3'));

		if (cliente === 'synapse-autoteste') H.autoteste = Date.now();
		if (!interno) {
			H.chegouAlgo = Date.now();
			H.recebidos++;
		}

		if (interno) {
			if (VERBOSO) diga('ok', `interno: ${metodo} (${cliente || 'cache'})`, true);
			return { interno: true, metodo: metodo, t0: Date.now() };
		}

		if (metodo === 'initialize') {
			abrirHandshake(cliente || 'cliente MCP');
			diga(
				'ok',
				`PASSO 1/3 - chegou "initialize" do cliente "${cliente || 'sem nome'}" (protocolo ${String((msg.params && msg.params.protocolVersion) || '?')}). \
A aba RECEBEU o pedido: o relay esta repassando.`,
			);
		} else if (metodo === 'notifications/initialized') {
			diga(
				'ok',
				'PASSO 2/3 - chegou "notifications/initialized" (a notificacao que antes travava tudo). Respondendo com confirmacao...',
			);
		} else if (metodo === 'tools/list') {
			diga(
				'ok',
				'PASSO 3/3 - chegou "tools/list": o cliente esta pedindo o catalogo de ferramentas.',
			);
		} else if (metodo === 'tools/call') {
			let fer = '';
			try {
				fer = String((msg.params && msg.params.name) || '');
			} catch (e) {
				ignorarErro(e, 'narrarEntrada');
			}
			diga('ok', `chamada de ferramenta "${fer}" recebida (id ${String(msg.id)}).`);
		} else if (metodo) {
			diga(
				'ok',
				'chegou "' +
					metodo +
					'"' +
					(msg && msg.id !== undefined ? ` (id ${String(msg.id)})` : ' (notificacao)') +
					'.',
			);
		}
		H.passos[metodo] = Date.now();
		return { interno: false, metodo: metodo, t0: Date.now() };
	}

	function narrarSaida(ctx, out, erro) {
		if (!ctx) return;
		const ms = Date.now() - ctx.t0;
		if (ctx.interno) {
			if (VERBOSO) diga('ok', `interno respondido: ${ctx.metodo} em ${ms} ms`, true);
			return;
		}
		H.respondidos++;
		if (erro) {
			diga(
				'err',
				`LADO DO SITE: falhei ao processar "${ctx.metodo}" (${String((erro && erro.message) || erro)}) em ${ms} ms.`,
			);
			return;
		}
		if (ctx.metodo === 'tools/list') {
			let n = 0;
			try {
				n = ((out && out.result && out.result.tools) || []).length;
			} catch (e) {
				ignorarErro(e, 'narrarSaida');
			}
			H.ferramentas = n;
			H.concluido = true;
			clearTimeout(H.vigia);
			const total = H.inicio ? Date.now() - H.inicio : ms;
			diga(
				n ? 'ok' : 'err',
				n
					? `CONEXAO VALIDADA - devolvi ${n} ferramentas em ${ms} ms (handshake completo em ${total} ms). \
Se o Notion ainda ficar girando depois disto, o travamento e do lado do Notion.`
					: 'LADO DO SITE: o catalogo saiu VAZIO (0 ferramentas) - o Notion conecta sem nada para usar.',
			);
			return;
		}
		let tipo = 'resposta';
		if (ctx.metodo.indexOf('notifications/') === 0) tipo = 'confirmacao (ack)';
		diga('ok', `respondi "${ctx.metodo}" com ${tipo} em ${ms} ms (${kb(out)}).`);
	}

	if (typeof mcpHandleMessage === 'function' && !mcpHandleMessage.__telemetria) {
		const _hm = mcpHandleMessage;
		const comTelemetria = async function (msg) {
			let ctx = null;
			try {
				if (!Array.isArray(msg)) ctx = narrarEntrada(msg);
			} catch (e) {
				ignorarErro(e, 'comTelemetria');
			}
			try {
				const out = await _hm(msg);
				try {
					narrarSaida(ctx, out, null);
				} catch (e) {
					ignorarErro(e, 'comTelemetria');
				}
				return out;
			} catch (err) {
				try {
					narrarSaida(ctx, null, err);
				} catch (e) {
					ignorarErro(e, 'comTelemetria');
				}
				throw err;
			}
		};
		comTelemetria.__telemetria = 1;
		try {
			mcpHandleMessage = comTelemetria;
		} catch (e) {
			ignorarErro(e, 'auroraTelemetriaMcp');
		}
		try {
			window.mcpHandleMessage = comTelemetria;
		} catch (e) {
			ignorarErro(e, 'auroraTelemetriaMcp');
		}
	}

	if (typeof mcpEnviarResposta === 'function' && !mcpEnviarResposta.__telemetria) {
		const _env = mcpEnviarResposta;
		const envTel = async function (reqId, out) {
			const t0 = Date.now();
			try {
				const r = await _env(reqId, out);
				if (VERBOSO)
					diga(
						'ok',
						`resposta ${String(reqId).slice(0, 8)} entregue ao relay em ${Date.now() - t0} ms`,
						true,
					);
				return r;
			} catch (e) {
				H.falhasResposta++;
				diga(
					'err',
					`LADO DA URL/REDE: nao consegui entregar a resposta ao relay (${String((e && e.message) || e)}). O cliente vai ficar esperando.`,
				);
				throw e;
			}
		};
		envTel.__telemetria = 1;
		try {
			mcpEnviarResposta = envTel;
		} catch (e) {
			ignorarErro(e, 'auroraTelemetriaMcp');
		}
		try {
			window.mcpEnviarResposta = envTel;
		} catch (e) {
			ignorarErro(e, 'auroraTelemetriaMcp');
		}
	}

	function bruto() {
		try {
			return (window.fetch && window.fetch.__orig) || window.fetch;
		} catch (e) {
			return window.fetch;
		}
	}

	async function passo(url, corpo, ms, sessao) {
		const f = bruto();
		let ctl = null,
			t = null,
			t0 = Date.now();
		try {
			ctl = new AbortController();
			t = setTimeout(function () {
				try {
					ctl.abort();
				} catch (e) {
					ignorarErro(e, 'passo');
				}
			}, ms);
		} catch (e) {
			ignorarErro(e, 'passo');
		}
		const cab = {
			'Content-Type': 'application/json',
			Accept: 'application/json, text/event-stream',
			'MCP-Protocol-Version': '2025-06-18',
		};
		if (sessao) cab['Mcp-Session-Id'] = sessao;
		try {
			const r = await f(url, {
				method: 'POST',
				mode: 'cors',
				credentials: 'omit',
				cache: 'no-store',
				headers: cab,
				body: JSON.stringify(corpo),
				signal: ctl ? ctl.signal : undefined,
			});
			let txt = '';
			try {
				txt = await r.text();
			} catch (e) {
				ignorarErro(e, 'passo');
			}
			let tipo = '';
			try {
				tipo = (r.headers && r.headers.get && r.headers.get('content-type')) || '';
			} catch (e) {
				ignorarErro(e, 'passo');
			}
			let sid = '';
			try {
				sid =
					(r.headers &&
						r.headers.get &&
						(r.headers.get('mcp-session-id') || r.headers.get('Mcp-Session-Id'))) ||
					'';
			} catch (e) {
				ignorarErro(e, 'passo');
			}
			let json = null;
			try {
				if (/event-stream/i.test(tipo)) {
					const m = String(txt)
						.split('\n')
						.filter(function (l) {
							return l.indexOf('data:') === 0;
						});
					if (m.length) json = JSON.parse(m[0].slice(5).trim());
				} else if (txt) json = JSON.parse(txt);
			} catch (e) {
				ignorarErro(e, 'passo');
			}
			return {
				ms: Date.now() - t0,
				status: r.status,
				ok: r.ok,
				tipo: tipo,
				sessao: sid,
				json: json,
				texto: String(txt).slice(0, 300),
			};
		} catch (e) {
			const nome = String((e && (e.name || e.message)) || e);
			return {
				ms: Date.now() - t0,
				erro: true,
				timeout: /abort/i.test(nome),
				msg: String((e && e.message) || e),
			};
		} finally {
			if (t) clearTimeout(t);
		}
	}

	async function passoGet(url, ms) {
		const f = bruto();
		let ctl = null,
			t = null,
			t0 = Date.now();
		try {
			ctl = new AbortController();
			t = setTimeout(function () {
				try {
					ctl.abort();
				} catch (e) {
					ignorarErro(e, 'passoGet');
				}
			}, ms);
		} catch (e) {
			ignorarErro(e, 'passoGet');
		}
		try {
			const r = await f(url, {
				method: 'GET',
				mode: 'cors',
				credentials: 'omit',
				cache: 'no-store',
				headers: { Accept: 'text/event-stream', 'MCP-Protocol-Version': '2025-06-18' },
				signal: ctl ? ctl.signal : undefined,
			});
			let tipo = '';
			try {
				tipo = (r.headers && r.headers.get && r.headers.get('content-type')) || '';
			} catch (e) {
				ignorarErro(e, 'passoGet');
			}
			const stream = /event-stream/i.test(tipo);
			let trecho = '';
			if (stream) {
				try {
					if (r.body && r.body.cancel) r.body.cancel();
				} catch (e) {
					ignorarErro(e, 'passoGet');
				}
			} else {
				try {
					trecho = String(await r.text()).slice(0, 200);
				} catch (e) {
					ignorarErro(e, 'passoGet');
				}
			}
			return { ms: Date.now() - t0, status: r.status, tipo: tipo, stream: stream, texto: trecho };
		} catch (e) {
			const nome = String((e && (e.name || e.message)) || e);
			return {
				ms: Date.now() - t0,
				erro: true,
				timeout: /abort/i.test(nome),
				msg: String((e && e.message) || e),
			};
		} finally {
			if (t) clearTimeout(t);
		}
	}

	function candidatas() {
		const lista = [],
			vistos = {};
		function add(base, rotulo) {
			base = String(base || '')
				.trim()
				.replace(/\/+$/, '');
			if (!/^https?:\/\//i.test(base)) return;
			const u = base + '/mcp/' + MCP.sid + '/' + MCP.token;
			if (vistos[u]) return;
			vistos[u] = 1;
			lista.push({ url: u, rotulo: rotulo, base: base });
		}
		try {
			if (typeof mcpPortaoBase === 'function')
				add(mcpPortaoBase(), 'portao (URL que o painel entrega)');
		} catch (e) {
			ignorarErro(e, 'candidatas');
		}
		try {
			if (typeof mcpPubBase === 'function') add(mcpPubBase(), 'no principal');
		} catch (e) {
			ignorarErro(e, 'candidatas');
		}
		try {
			add(MCP.relay, 'transporte configurado');
		} catch (e) {
			ignorarErro(e, 'candidatas');
		}
		try {
			const res = typeof window.__flvReservas === 'function' ? window.__flvReservas() : [];
			for (let i = 0; i < res.length; i++) add(res[i], `no de reserva ${i}${1}`);
		} catch (e) {
			ignorarErro(e, 'candidatas');
		}
		return lista;
	}

	function ladoDoErro(r, chegouNaAba) {
		if (!r) return 'indefinido';
		if (r.erro && r.timeout)
			return chegouNaAba
				? 'LADO DO SITE (a aba recebeu mas nao devolveu a tempo)'
				: 'LADO DA URL (o relay aceitou e nunca respondeu)';
		if (r.erro) return 'LADO DA URL (relay fora do ar, bloqueio de rede ou CORS)';
		if (r.status === 404) return 'LADO DA URL (essa sessao nao existe nesse no - URL antiga?)';
		if (r.status === 429) return 'LADO DA URL (cota/limite do relay)';
		if (r.status >= 500) return 'LADO DA URL (erro interno do relay)';
		if (r.status >= 400) return `LADO DA URL (relay recusou: HTTP ${r.status})`;
		return 'ok';
	}

	let testando = false;
	async function testar(opcoes) {
		opcoes = opcoes || {};
		if (testando) return 'autoteste ja esta rodando';
		if (!ativo()) {
			diga('err', 'AUTOTESTE: o MCP esta desativado. Clique em Ativar MCP antes de testar.');
			return 'MCP desativado';
		}
		testando = true;
		const relatorio = [];
		try {
			const lista = candidatas();
			diga('ok', '===== AUTOTESTE DE CONEXAO (o site vai fazer o papel do Notion) =====');
			if (!lista.length) {
				diga(
					'err',
					'AUTOTESTE: nenhuma URL publica disponivel - o MCP precisa de um relay na nuvem. No modo local sem relay o Notion nao tem como alcancar esta aba.',
				);
				return 'sem URL';
			}
			diga('ok', 'URL entregue pelo painel: ' + urlPublica());

			for (let i = 0; i < lista.length; i++) {
				const c = lista[i];
				const completo = opcoes.rapido ? i === 0 : true;
				const marca = H.autoteste;
				diga('ok', `-- testando ${c.rotulo}: ${no(c.base)} --`);

				const r1 = await passo(
					c.url,
					{
						jsonrpc: '2.0',
						id: 1,
						method: 'initialize',
						params: {
							protocolVersion: '2025-06-18',
							capabilities: {},
							clientInfo: { name: 'synapse-autoteste', version: '1' },
						},
					},
					20000,
				);
				const chegou1 = H.autoteste > marca;
				const lado1 = ladoDoErro(r1, chegou1);
				if (lado1 !== 'ok') {
					diga(
						'err',
						'passo 1/4 initialize FALHOU em ' +
							r1.ms +
							' ms -> ' +
							lado1 +
							(r1.msg ? ` [${r1.msg}]` : '') +
							(r1.status ? ` [HTTP ${r1.status}]` : ''),
					);
					relatorio.push({ url: c.url, rotulo: c.rotulo, passo: 'initialize', resultado: lado1 });
					continue;
				}
				let srv = '';
				try {
					srv = String(((r1.json && r1.json.result && r1.json.result.serverInfo) || {}).name || '');
				} catch (e) {
					ignorarErro(e, 'testar');
				}
				diga(
					'ok',
					`passo 1/4 initialize OK em ${r1.ms} ms (HTTP ${r1.status}, ${r1.tipo || 'sem tipo'}, servidor \
"${srv || '?'}")${chegou1 ? ' - o pedido CHEGOU nesta aba' : ' - respondido pelo CACHE do relay (nao passou pela aba)'}`,
				);

				if (!completo) {
					relatorio.push({
						url: c.url,
						rotulo: c.rotulo,
						passo: 'initialize',
						resultado: 'parcial (so o passo 1 foi testado)',
					});
					continue;
				}

				const marca2 = H.autoteste;
				const r2 = await passo(
					c.url,
					{ jsonrpc: '2.0', method: 'notifications/initialized' },
					20000,
					r1.sessao,
				);
				const chegou2 = H.autoteste > marca2;
				const lado2 = ladoDoErro(r2, chegou2);
				if (lado2 !== 'ok') {
					diga(
						'err',
						'passo 2/4 notifications/initialized FALHOU em ' +
							r2.ms +
							' ms -> ' +
							lado2 +
							(r2.msg ? ` [${r2.msg}]` : '') +
							(r2.status ? ` [HTTP ${r2.status}]` : '') +
							'. ESTE e o passo que deixa o Notion girando para sempre.',
					);
					relatorio.push({
						url: c.url,
						rotulo: c.rotulo,
						passo: 'notifications/initialized',
						resultado: lado2,
					});
					continue;
				}
				diga(
					'ok',
					`passo 2/4 notifications/initialized OK em ${r2.ms} ms (HTTP ${r2.status})${chegou2 ? ' - chegou nesta aba' : ' - respondido pelo relay'}`,
				);

				const r3 = await passo(
					c.url,
					{ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
					20000,
					r1.sessao,
				);
				const lado3 = ladoDoErro(r3, false);
				if (lado3 !== 'ok') {
					diga(
						'err',
						'passo 3/4 tools/list FALHOU em ' +
							r3.ms +
							' ms -> ' +
							lado3 +
							(r3.msg ? ` [${r3.msg}]` : ''),
					);
					relatorio.push({ url: c.url, rotulo: c.rotulo, passo: 'tools/list', resultado: lado3 });
					continue;
				}
				let nf = 0;
				try {
					nf = ((r3.json && r3.json.result && r3.json.result.tools) || []).length;
				} catch (e) {
					ignorarErro(e, 'testar');
				}
				diga(
					nf ? 'ok' : 'err',
					`passo 3/4 tools/list ${nf ? 'OK' : 'VAZIO'} em ${r3.ms} ms - ${nf} ferramentas.`,
				);
				if (!nf) {
					relatorio.push({
						url: c.url,
						rotulo: c.rotulo,
						passo: 'tools/list',
						resultado: 'catalogo vazio',
						ferramentas: 0,
					});
					continue;
				}

				const g = await passoGet(c.url, 7000);
				if (g && (g.stream || g.timeout)) {
					diga(
						'err',
						`passo 4/4 GET na mesma URL: ${g.stream ? 'o servidor abriu um STREAM (text/event-stream) que nao termina' : 'o servidor nao respondeu e nao fechou em 7 s'}. \
ESTE e o passo que deixa o conector do Notion girando para sempre - os 3 POSTs passam, mas o GET fica \
pendurado. Correcao: publique de novo o worker.js e o portao.js na versao 10 (GET responde 405 na hora).`,
					);
					relatorio.push({
						url: c.url,
						rotulo: c.rotulo,
						passo: 'GET (stream)',
						resultado: 'GET pendurado - atualize o deploy para a v10',
						ferramentas: nf,
					});
					continue;
				}
				if (g && g.erro) {
					diga(
						'err',
						`passo 4/4 GET na mesma URL FALHOU (${g.msg || 'sem resposta'}). Sem esse passo o conector do Notion nao completa a configuracao.`,
					);
					relatorio.push({
						url: c.url,
						rotulo: c.rotulo,
						passo: 'GET (stream)',
						resultado: 'GET sem resposta',
						ferramentas: nf,
					});
					continue;
				}
				diga(
					'ok',
					`passo 4/4 GET na mesma URL OK em ${g.ms} ms (HTTP ${g.status}${g.tipo ? ', ' + g.tipo : ''}) - sem stream pendurado, como manda o Streamable HTTP.`,
				);
				relatorio.push({
					url: c.url,
					rotulo: c.rotulo,
					passo: 'completo',
					resultado: 'ok',
					ferramentas: nf,
				});
			}

			try {
				const wf = window.SYNAPSE_WAF && SYNAPSE_WAF.varrer ? await SYNAPSE_WAF.varrer(true) : null;
				if (wf && !wf.erro) {
					if (wf.seguro)
						diga(
							'ok',
							`passo 5/5 WAF OK - manifesto com ${wf.ferramentas} ferramentas e ${wf.bytes_tools_list} bytes, \
sem tag HTML literal nem padrao de injecao. O save do conector no Notion nao deve mais tomar 403 da \
borda.`,
						);
					else
						diga(
							'err',
							`passo 5/5 WAF FALHOU - ${wf.riscos.length} campo(s) do manifesto com sequencia que o WAF do Notion bloqueia (403 + "Conectando..." infinito): ${wf.riscos
								.map(function (x) {
									return x.campo;
								})
								.slice(0, 6)
								.join(
									', ',
								)}. Recarregue o site (Ctrl+F5); se persistir, corrija a descricao da ferramenta.`,
						);
				}
			} catch (e) {
				ignorarErro(e, 'testar');
			}
			try {
				const pv = window.SYNAPSE_WAF && SYNAPSE_WAF.provar ? SYNAPSE_WAF.provar() : null;
				if (pv) {
					const mo = SYNAPSE_WAF.modo();
					const okrt = pv.round_trip_identico && !pv.menor_depois_de_codificar;
					diga(
						okrt ? 'ok' : 'err',
						`passo 5b/5 resultado de ferramenta: codificacao reversivel ${okrt ? 'OK (round-trip byte a byte; HTML de teste sem nenhuma tag literal)' : 'FALHOU'} \
- modo ${mo.modo}, cliente visto pela aba: ${mo.cliente}`,
					);
				}
			} catch (e) {
				ignorarErro(e, 'testar');
			}
			const bons = relatorio.filter(function (x) {
				return x.resultado === 'ok';
			});
			const atual = urlPublica();
			const atualOk = bons.some(function (x) {
				return x.url === atual;
			});
			if (atualOk) {
				diga(
					'ok',
					'VEREDITO: a URL do painel completou os 4 passos do MCP (3 POSTs + o GET que o Notion ' +
						'abre) - veja tambem o passo 5/5 (WAF) acima. O caminho site -> relay -> cliente esta ' +
						'inteiro. Se o conector ainda ficar girando, remova a conexao no Notion e cole a URL de ' +
						'novo - e confirme que o deploy dos workers esta na v10 (o cabecalho X-Synapse-Portao ' +
						'mostra a versao).',
				);
			} else if (bons.length) {
				diga(
					'err',
					`VEREDITO: a URL que o painel entrega FALHOU, mas ${bons[0].rotulo} respondeu certo. Use esta URL \
no Notion: ${bons[0].url} (ou rode SYNAPSE_MCP.usarMelhorUrl() para o painel passar a entregar ela).`,
				);
				try {
					window.SYNAPSE_MCP.__melhor = bons[0];
				} catch (e) {
					ignorarErro(e, 'testar');
				}
			} else {
				diga(
					'err',
					'VEREDITO: nenhuma URL respondeu ao handshake -> LADO DA URL (relay). O site esta pronto, mas o relay nao esta atendendo /mcp. Verifique o deploy do worker e o portao.',
				);
			}
			try {
				console.table(relatorio);
			} catch (e) {
				ignorarErro(e, 'testar');
			}
			return relatorio;
		} finally {
			testando = false;
		}
	}

	function usarMelhorUrl() {
		let m = null;
		try {
			m = window.SYNAPSE_MCP.__melhor;
		} catch (e) {
			ignorarErro(e, 'usarMelhorUrl');
		}
		if (!m) return 'rode SYNAPSE_MCP.testar() antes';
		try {
			if (window.SYNAPSE_FAILOVER && typeof window.SYNAPSE_FAILOVER.definirPortao === 'function')
				window.SYNAPSE_FAILOVER.definirPortao('');
			MCP.pub = m.base;
			if (typeof mcpSaveCfg === 'function') mcpSaveCfg();
			if (typeof mcpRenderPanel === 'function') mcpRenderPanel();
		} catch (e) {
			ignorarErro(e, 'usarMelhorUrl');
		}
		diga(
			'ok',
			`URL do painel trocada para ${no(m.base)}. Copie de novo e cole no Notion: ${urlPublica()}`,
		);
		return urlPublica();
	}

	let avisouSilencio = 0;
	setInterval(function () {
		try {
			if (!ativo()) return;
			const agora = Date.now();
			if (!H.chegouAlgo && agora - (H.ligadoEm || 0) > 60000 && agora - avisouSilencio > 120000) {
				avisouSilencio = agora;
				diga(
					'ok',
					'Silencio nesta aba ate agora - e NORMAL. O handshake do Notion (initialize, ' +
						'notifications/initialized e tools/list) e respondido pelo CACHE do relay e nao passa ' +
						'pela aba. A aba so recebe quando uma ferramenta for realmente executada (tools/call). ' +
						'Se o conector do Notion continuar girando, rode SYNAPSE_MCP.testar(): agora ele tem 4 ' +
						'passos e o passo 4 (GET na mesma URL) e o que costuma travar o conector.',
				);
			}
		} catch (e) {
			ignorarErro(e, 'auroraTelemetriaMcp');
		}
	}, 20000);

	try {
		const _act = window.mcpActivate;
		if (typeof _act === 'function' && !_act.__telemetria) {
			const act = function (silent) {
				const r = _act.apply(this, arguments);
				try {
					H.ligadoEm = Date.now();
					H.chegouAlgo = 0;
					diga(
						'ok',
						`MCP ativado. URL para o Notion: ${urlPublica()} · vou narrar cada passo do handshake aqui.`,
					);
					const local =
						typeof window.mcpModoAtual === 'function' && window.mcpModoAtual() === 'local';
					let temCompl = false;
					try {
						temCompl = typeof termTemComplemento === 'function' && termTemComplemento();
					} catch (e) {
						ignorarErro(e, 'act');
					}
					if (local && !temCompl)
						diga(
							'err',
							'Aviso: modo local ligado sem o complemento respondendo. Isso NAO cria conexao sem relay ' +
								'- o transporte do MCP e sempre a nuvem; o modo local so acrescenta terminal e disco. A ' +
								'URL acima continua sendo a que o Notion precisa.',
						);
					setTimeout(function () {
						try {
							testar({});
						} catch (e) {
							ignorarErro(e, 'act');
						}
					}, 4000);
				} catch (e) {
					ignorarErro(e, 'act');
				}
				return r;
			};
			act.__telemetria = 1;
			try {
				mcpActivate = act;
			} catch (e) {
				ignorarErro(e, 'auroraTelemetriaMcp');
			}
			try {
				window.mcpActivate = act;
			} catch (e) {
				ignorarErro(e, 'auroraTelemetriaMcp');
			}
		}
	} catch (e) {
		ignorarErro(e, 'auroraTelemetriaMcp');
	}

	try {
		window.SYNAPSE_MCP = {
			testar: testar,
			usarMelhorUrl: usarMelhorUrl,
			url: urlPublica,
			estado: function () {
				return {
					ativo: ativo(),
					urlPublica: urlPublica(),
					pacotesRecebidos: H.recebidos,
					respostasEnviadas: H.respondidos,
					falhasAoResponder: H.falhasResposta,
					handshake: {
						cliente: H.cliente,
						passos: H.passos,
						ferramentas: H.ferramentas,
						concluido: H.concluido,
					},
					ultimoPacoteExterno: H.chegouAlgo ? new Date(H.chegouAlgo).toISOString() : 'nenhum',
				};
			},
			historico: function () {
				return HIST.slice();
			},
			copiar: function () {
				const s = HIST.map(function (x) {
					return new Date(x.t).toISOString().slice(11, 19) + ' [' + x.kind + '] ' + x.text;
				}).join('\n');
				try {
					if (navigator.clipboard) navigator.clipboard.writeText(s);
				} catch (e) {
					ignorarErro(e, 'copiar');
				}
				return s;
			},
			verboso: function (v) {
				VERBOSO = v !== false;
				try {
					localStorage.setItem('aurora.mcp.verboso', VERBOSO ? '1' : '0');
				} catch (e) {
					ignorarErro(e, 'verboso');
				}
				return VERBOSO ? 'detalhe ligado' : 'detalhe desligado';
			},
		};
	} catch (e) {
		ignorarErro(e, 'auroraTelemetriaMcp');
	}

	try {
		registro.debug(
			'%c[Synapse] Telemetria de MCP ativa',
			'color:#6aa3ff;font-weight:600',
			'SYNAPSE_MCP.testar() · SYNAPSE_MCP.estado() · SYNAPSE_MCP.copiar()',
		);
	} catch (e) {
		ignorarErro(e, 'auroraTelemetriaMcp');
	}
})();
