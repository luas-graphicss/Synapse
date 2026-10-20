(function () {
	'use strict';
	let MAX = 600,
		JANELA = 3000,
		MINIMO = 5,
		EV = [],
		RAJ = [],
		nMcp = 0,
		ultima = 0,
		timer = null,
		DEDUP = {};
	function agora() {
		return Date.now();
	}

	function classificar(e) {
		const t = String(e.msg || ''),
			cod = e.cod,
			http = e.http || 0;
		if (
			/relay lotado|processos simultaneos no relay|processos simult\u00e2neos no relay|Fila do relay/i.test(
				t,
			)
		)
			return { lado: 'site', motivo: 'relay lotado' };
		if (
			cod === -32001 ||
			/aba do site nao respondeu|aba do site n\u00e3o respondeu|Request timed out|timed out/i.test(
				t,
			)
		)
			return { lado: 'site', motivo: 'aba do site lenta' };
		if (cod === -32002 || /Nenhuma aba do Synapse/i.test(t))
			return { lado: 'site', motivo: 'aba do site desconectada' };
		if (cod === -32700 || cod === -32600) return { lado: 'site', motivo: 'protocolo do MCP' };
		if (cod === -32603 || /erro interno|internal error/i.test(t))
			return { lado: 'site', motivo: 'erro interno do site' };
		if (/Fila deste no cheia|fila deste n\u00f3 cheia/i.test(t))
			return { lado: 'url', motivo: 'fila do no cheia' };
		if (http === 429 || /__http429/.test(t) || /limite do minuto|limite diario|cota/i.test(t))
			return {
				lado: 'url',
				motivo: /limite diario|cota do dia/i.test(t) ? 'cota do dia' : 'cota do minuto',
			};
		if (
			http === 502 ||
			http === 503 ||
			http === 504 ||
			http === 1027 ||
			/Failed to fetch|NetworkError|Load failed|network/i.test(t)
		)
			return { lado: 'url', motivo: 'borda ou rede' };
		if (http >= 500) return { lado: 'url', motivo: 'borda ou rede' };
		if (http === 404) return { lado: 'url', motivo: 'endereco nao existe nesse no' };
		if (http >= 400) return { lado: 'url', motivo: `resposta ${http} da URL` };
		return { lado: '?', motivo: 'causa indefinida' };
	}
	function rotulo(l) {
		return l === 'url'
			? 'lado da URL (limite)'
			: l === 'site'
				? 'lado do site'
				: 'causa indefinida';
	}

	function proj() {
		try {
			return typeof activeProject === 'function' ? activeProject() : null;
		} catch (e) {
			return null;
		}
	}
	function emitir(txt, nivel) {
		const p = proj();
		if (p && typeof pushLog === 'function') {
			try {
				pushLog(p, nivel || 'mcp', txt, 'diag');
				return;
			} catch (e) {
				ignorarErro(e, 'emitir');
			}
		}
		try {
			if (window.console) registro.aviso('[SYNAPSE_DIAG] ' + txt);
		} catch (e) {
			ignorarErro(e, 'emitir');
		}
	}
	function contador() {
		try {
			const c = document.getElementById('cMcp');
			if (c) c.textContent = nMcp > 999 ? '999+' : String(nMcp);
		} catch (e) {
			ignorarErro(e, 'contador');
		}
	}

	function urlStats() {
		try {
			const base = typeof mcpPubBase === 'function' ? mcpPubBase() : '';
			if (!base || !window.MCP || !MCP.sid || !MCP.token) return '';
			return String(base).replace(/\/+$/, '') + '/bridge/' + MCP.sid + '/' + MCP.token + '/stats';
		} catch (e) {
			return '';
		}
	}
	function comStats(cb) {
		const u = urlStats();
		if (!u) {
			cb(null);
			return;
		}
		try {
			const f = (window.fetch && window.fetch.__orig) || window.fetch;
			f(u, { cache: 'no-store' })
				.then(function (r) {
					return r && r.ok ? r.json() : null;
				})
				.then(function (j) {
					cb(j || null);
				})
				['catch'](function () {
					cb(null);
				});
		} catch (e) {
			cb(null);
		}
	}

	function registrar(info) {
		const c = classificar(info);
		const ev = {
			t: agora(),
			lado: c.lado,
			motivo: c.motivo,
			cod: info.cod === undefined ? null : info.cod,
			http: info.http || 0,
			tool: info.tool || '',
			agente: info.agente || '',
			url: info.url || '',
			msg: String(info.msg || '').slice(0, 400),
			fonte: info.fonte || '',
		};
		EV.push(ev);
		if (EV.length > MAX) EV.shift();
		nMcp++;
		contador();
		const chaveD = ev.lado + '|' + ev.motivo + '|' + String(ev.msg).slice(0, 90);
		const dd = DEDUP[chaveD];
		if (dd && agora() - dd.t < 30000) {
			dd.n++;
			return ev;
		}
		const rep = dd && dd.n ? ` (repetiu ${dd.n}x nos ultimos 30s)` : '';
		DEDUP[chaveD] = { t: agora(), n: 0 };
		const linha = `erro de MCP em ${ev.tool || 'ferramenta desconhecida'}: ${ev.msg} [${rotulo(ev.lado)} \
- ${ev.motivo}${ev.http ? ' - HTTP ' + ev.http : ''}${ev.cod !== null ? ' - codigo ' + ev.cod : ''}]${rep}`;
		emitir(linha, 'mcp');
		if (!timer)
			timer = setTimeout(function () {
				timer = null;
				resumir();
			}, JANELA);
		return ev;
	}
	function resumir() {
		let t = agora(),
			lote = [],
			i;
		for (i = EV.length - 1; i >= 0; i--) {
			if (t - EV[i].t <= JANELA + 400) lote.push(EV[i]);
			else break;
		}
		if (lote.length < MINIMO) return;
		if (t - ultima < 1500) return;
		ultima = t;
		let nu = 0,
			ns = 0,
			nd = 0,
			por = {},
			dur = 0,
			j;
		for (j = 0; j < lote.length; j++) {
			const e = lote[j];
			if (e.lado === 'url') nu++;
			else if (e.lado === 'site') ns++;
			else nd++;
			por[e.motivo] = (por[e.motivo] || 0) + 1;
		}
		dur = (lote[0].t - lote[lote.length - 1].t) / 1000;
		let top = '',
			tn = 0;
		for (let k in por)
			if (por[k] > tn) {
				tn = por[k];
				top = k;
			}
		comStats(function (st) {
			let l = `Rajada de erros de MCP: ${lote.length} erros em ${dur > 0 ? dur.toFixed(1) : '0.1'}s`;
			l += ` | ${rotulo('url')}: ${nu} | ${rotulo('site')}: ${ns}${nd ? ' | causa indefinida: ' + nd : ''}`;
			if (top) l += ` | causa principal: ${top} (${tn})`;
			if (st) {
				if (st.minuto) l += ` | cota do minuto: ${st.minuto.usados}/${st.minuto.limite}`;
				if (st.dia) l += ` | cota do dia: ${st.dia.usados}/${st.dia.limite}`;
				if (typeof st.recusadasFila === 'number') l += ' | recusadas por fila: ' + st.recusadasFila;
				if (typeof st.fila === 'number') l += ' | fila do no: ' + st.fila;
				if (typeof st.pendentes === 'number') l += ' | pendentes na aba: ' + st.pendentes;
			}
			RAJ.push({
				t: t,
				total: lote.length,
				url: nu,
				site: ns,
				indefinido: nd,
				causa: top,
				dur: dur,
				stats: st || null,
			});
			if (RAJ.length > 50) RAJ.shift();
			emitir(l, 'error');
		});
	}

	if (typeof window.fetch === 'function' && !window.fetch.__diag) {
		const _f = window.fetch;
		const nf = function (entrada, init) {
			let u = '';
			try {
				u = typeof entrada === 'string' ? entrada : (entrada && entrada.url) || '';
			} catch (e) {
				ignorarErro(e, 'nf');
			}
			const ehLocalDiag =
				/^https?:\/\/(localhost|127\.\d+\.\d+\.\d+|\[::1\]|0\.0\.0\.0|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:|\/|$)/i.test(
					u,
				);
			const meu = !ehLocalDiag && /\/(bridge|mcp|run|out|reply|stats)(\/|$|\?)/.test(u);
			const p = _f.apply(this, arguments);
			if (!meu || !p || typeof p.then !== 'function') return p;
			try {
				p.then(
					function (res) {
						try {
							if (res && !res.ok) {
								let ra = '';
								try {
									ra = res.headers && res.headers.get ? res.headers.get('Retry-After') || '' : '';
								} catch (e) {
									ignorarErro(e, 'nf');
								}
								registrar({
									http: res.status,
									url: u,
									fonte: 'http',
									msg: 'HTTP ' + res.status + (ra ? ` (Retry-After ${ra}s)` : ''),
								});
							}
						} catch (e) {
							ignorarErro(e, 'nf');
						}
						return res;
					},
					function (err) {
						const m = String((err && err.message) || err || '');
						if (!/abort/i.test(m))
							try {
								registrar({ http: 0, url: u, fonte: 'rede', msg: m || 'falha de rede' });
							} catch (e) {
								ignorarErro(e, 'nf');
							}
					},
				);
			} catch (e) {
				ignorarErro(e, 'nf');
			}
			return p;
		};
		nf.__diag = 1;
		nf.__orig = _f;
		window.fetch = nf;
	}
	if (typeof window.mcpLog === 'function' && !window.mcpLog.__diag) {
		const _ml = window.mcpLog;
		const nml = function (kind, text) {
			try {
				if (window.__mcpDiagIgnorar) return _ml.apply(this, arguments);
				if (kind === 'err') {
					let s = String(text || ''),
						cod = null,
						m = s.match(/-3(2[0-9]{3})/);
					if (m) cod = parseInt('-3' + m[1], 10);
					const mt = s.match(/ferramenta ([a-z_]+)|tool ([a-z_]+)/i);
					registrar({ msg: s, cod: cod, fonte: 'mcpLog', tool: (mt && (mt[1] || mt[2])) || '' });
				}
			} catch (e) {
				ignorarErro(e, 'nml');
			}
			return _ml.apply(this, arguments);
		};
		nml.__diag = 1;
		nml.__orig = _ml;
		nml.__m10 = _ml.__m10 || 0;
		nml.__pm = _ml.__pm || 0;
		window.mcpLog = nml;
	}

	function aba() {
		try {
			const tabs = document.getElementById('consoleTabs');
			if (!tabs || document.getElementById('cMcpTab')) return;
			const ex = tabs.querySelector('button');
			const b = document.createElement('button');
			b.id = 'cMcpTab';
			b.type = 'button';
			b.setAttribute('data-f', 'mcp');
			if (ex && ex.className) b.className = ex.className;
			const sp = ex ? ex.querySelector('span') : null;
			b.innerHTML =
				'MCP <span id="cMcp"' +
				(sp && sp.className ? ` class="${sp.className}"` : '') +
				'>0</span>';
			tabs.appendChild(b);
			b.addEventListener('click', function () {
				try {
					State.consoleFilter = 'mcp';
				} catch (e) {
					ignorarErro(e, 'aba');
				}
				try {
					const bs = tabs.querySelectorAll('button');
					for (let i = 0; i < bs.length; i++) {
						bs[i].classList.toggle('on', bs[i] === b);
						bs[i].classList.toggle('active', bs[i] === b);
					}
				} catch (e) {
					ignorarErro(e, 'aba');
				}
				try {
					if (typeof openConsole === 'function') openConsole(true);
				} catch (e) {
					ignorarErro(e, 'aba');
				}
				try {
					renderConsole();
				} catch (e) {
					ignorarErro(e, 'aba');
				}
			});
			contador();
		} catch (e) {
			ignorarErro(e, 'aba');
		}
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', aba);
	else aba();
	setTimeout(aba, 900);

	function texto() {
		if (!EV.length) return 'Nenhum erro de MCP registrado ainda';
		let por = {},
			lados = { url: 0, site: 0 },
			i;
		for (i = 0; i < EV.length; i++) {
			por[EV[i].motivo] = (por[EV[i].motivo] || 0) + 1;
			if (lados[EV[i].lado] !== undefined) lados[EV[i].lado]++;
		}
		let s = `eventos: ${EV.length} | ${rotulo('url')}: ${lados.url} | ${rotulo('site')}: ${lados.site}\n`;
		for (let k in por) s += `  - ${k}: ${por[k]}\n`;
		s += `rajadas: ${RAJ.length}\n`;
		for (i = 0; i < RAJ.length; i++)
			s += `  - ${new Date(RAJ[i].t).toISOString()} total ${RAJ[i].total} url ${RAJ[i].url} site ${RAJ[i].site} causa ${RAJ[i].causa}\n`;
		return s;
	}
	window.SYNAPSE_DIAG = {
		eventos: function () {
			return EV.slice();
		},
		rajadas: function () {
			return RAJ.slice();
		},
		relatorio: function () {
			const s = texto();
			try {
				if (window.console) registro.debug(s);
			} catch (e) {
				ignorarErro(e, 'relatorio');
			}
			return s;
		},
		csv: function () {
			const l = ['quando,lado,motivo,codigo,http,ferramenta,mensagem'];
			for (let i = 0; i < EV.length; i++) {
				const e = EV[i];
				l.push(
					[
						new Date(e.t).toISOString(),
						e.lado,
						e.motivo,
						e.cod === null ? '' : e.cod,
						e.http || '',
						e.tool || '',
						`"${String(e.msg).replace(/"/g, "''")}"`,
					].join(','),
				);
			}
			return l.join('\n');
		},
		estado: function () {
			return {
				eventos: EV.length,
				rajadas: RAJ.length,
				janelaMs: JANELA,
				minimoParaRajada: MINIMO,
				teto: MAX,
			};
		},
		limpar: function () {
			EV.length = 0;
			RAJ.length = 0;
			nMcp = 0;
			contador();
			return true;
		},
		registrar: registrar,
		testar: function () {
			emitir('Teste do diagnostico: 6 erros sinteticos', 'mcp');
			registrar({ msg: 'Fila deste no cheia (128/128)', cod: -32000, tool: 'write_file' });
			registrar({ msg: 'Fila deste no cheia (128/128)', cod: -32000, tool: 'read_file' });
			registrar({ msg: 'limite do minuto atingido __http429', http: 429, tool: 'write_file' });
			registrar({
				msg: 'A aba do site nao respondeu em 25000ms',
				cod: -32001,
				tool: 'run_command',
			});
			registrar({ msg: 'Nenhuma aba do Synapse esta conectada', cod: -32002, tool: 'list_files' });
			registrar({ msg: 'relay lotado (80/80)', http: 429, tool: 'run_command' });
			return '6 eventos gerados - veja a aba MCP do console';
		},
	};
	emitir('Diagnostico de rajada ligado (SYNAPSE_DIAG)', 'mcp');
})();
