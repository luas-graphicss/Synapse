'use strict';
(function auroraMcpModoLocal() {
	'use strict';
	const K_MODO = 'aurora.mcp.modo',
		K_TUNEL = 'aurora.mcp.tunel',
		K_LOCAL = 'aurora.mcp.relaylocal',
		K_NUVEM = 'aurora.mcp.relaynuvem';
	let PADRAO = '';
	try {
		PADRAO = String(MCP_RELAY_PADRAO || '');
	} catch (e) {
		ignorarErro(e, 'auroraMcpModoLocal');
	}
	const LOCAL_PADRAO = 'http://localhost:8787';
	let MOVEL = false;
	try {
		const larg = Math.min(
			window.innerWidth || 9999,
			(window.screen && window.screen.width) || 9999,
		);
		MOVEL = !!MCP_MOBILE && larg <= 900;
	} catch (e) {
		try {
			MOVEL = !!MCP_MOBILE;
		} catch (x) {
			ignorarErro(x, 'auroraMcpModoLocal');
		}
	}
	let usarTunel = false;

	function el(id) {
		try {
			return document.getElementById(id);
		} catch (e) {
			return null;
		}
	}
	function lim(v) {
		return String(v == null ? '' : v)
			.trim()
			.replace(/\/+$/, '');
	}
	function get(k) {
		try {
			return localStorage.getItem(k);
		} catch (e) {
			return null;
		}
	}
	function set(k, v) {
		try {
			localStorage.setItem(k, v);
		} catch (e) {
			ignorarErro(e, 'set');
		}
	}
	function ehUrl(u) {
		return /^https?:\/\/[^\s\/]+/i.test(lim(u));
	}
	function val(id) {
		const i = el(id);
		return lim(i ? i.value : '');
	}
	function toastar(t, s, k) {
		try {
			if (typeof toast === 'function') toast(t, s, k);
		} catch (e) {
			ignorarErro(e, 'toastar');
		}
	}
	function logar(k, t) {
		try {
			if (typeof mcpLog === 'function') mcpLog(k, t);
		} catch (e) {
			ignorarErro(e, 'logar');
		}
	}
	function appAtivo() {
		try {
			if (window.AuroraApp && window.AuroraApp.isApp) return true;
		} catch (e) {
			ignorarErro(e, 'appAtivo');
		}
		try {
			return !!(APPN && APPN.ativo);
		} catch (e) {
			return false;
		}
	}
	function cab() {
		return { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' };
	}

	const DICA = {
		nuvem:
			'<b>Modo nuvem.</b> A conexão já vem pronta: toque em <b>Ativar MCP</b>, copie a URL e ' +
			'cole no conector MCP do Notion. Não precisa de túnel nem de terminal. <b>Mantenha esta ' +
			'aba aberta</b> enquanto o agente trabalha.',
		local:
			'<b>Modo local (nuvem + complemento).</b> A conexão com o Notion é a mesma do modo nuvem ' +
			'- mesma URL, mesma capacidade. O <code>node relay.js</code> entra apenas como <b>' +
			'complemento local</b>: é ele que dá terminal, disco e dev server. <b>Não precisa de ' +
			'túnel.</b> Mantenha esta aba aberta enquanto o agente trabalha.',
	};
	const PASSOS =
		'<b>Como ativar:</b> 1) <code>node relay.js</code> (Node 18+) · 2) clique em <b>' +
		'Testar</b> · 3) marque a permissão do terminal. Sem túnel: a URL que vai para o Notion ' +
		'é sempre a da nuvem.';

	function modo() {
		if (MOVEL) return 'nuvem';
		const m = get(K_MODO);
		if (m === 'local' || m === 'nuvem') return m;
		let r = '';
		try {
			r = lim(MCP.relay);
		} catch (e) {
			ignorarErro(e, 'modo');
		}
		return r && PADRAO && r !== lim(PADRAO) ? 'local' : 'nuvem';
	}
	try {
		window.mcpModoAtual = modo;
	} catch (e) {
		ignorarErro(e, 'auroraMcpModoLocal');
	}

	function estado(m) {
		if (appAtivo()) return;
		try {
			let tun = val('mcpPub'),
				loc = val('mcpRelayLocal');
			let trans = val('mcpRelay') || lim(PADRAO);
			try {
				if (typeof mcpEhLocal === 'function' && mcpEhLocal(trans)) {
					if (!loc) loc = trans;
					trans = lim(PADRAO) || trans;
					const ri = el('mcpRelay');
					if (ri) ri.value = trans;
					const li = el('mcpRelayLocal');
					if (li && !lim(li.value)) li.value = loc;
					logar(
						'err',
						'Endereco local movido para o campo do complemento: o transporte do MCP tem de ser a nuvem, senao o conector do Notion fica com 0 ferramentas.',
					);
				}
			} catch (e) {
				ignorarErro(e, 'estado');
			}
			MCP.relay = trans;
			MCP.pub = '';
			if (m === 'local') {
				try {
					COMPL.url = loc || tun || COMPL_PADRAO;
					complSalvarCfg();
					complSondar(true);
				} catch (e) {
					ignorarErro(e, 'estado');
				}
			} else {
				try {
					COMPL.url = '';
					COMPL.ok = false;
					complSalvarCfg();
				} catch (e) {
					ignorarErro(e, 'estado');
				}
			}
			mcpSaveCfg();
		} catch (e) {
			ignorarErro(e, 'estado');
		}
	}

	function terminalTravado(local) {
		let ok = false;
		try {
			ok = !!local && termTemComplemento();
		} catch (e) {
			ok = !!local;
		}
		const ck = el('mcpTermAllow'),
			lab = el('mcpTermLab'),
			tl = el('mcpTermList');
		if (ck) {
			ck.disabled = !local;
			try {
				if (ck.checked !== !!TERM.allow) ck.checked = !!TERM.allow;
			} catch (e) {
				ignorarErro(e, 'terminalTravado');
			}
		}
		if (tl) tl.disabled = !local;
		if (lab) lab.classList.toggle('off', !ok);
		const st = el('mcpSideMsg');
		if (st) {
			if (!local) {
				st.className = 'mcp-teste';
				st.textContent = '';
			} else if (ok) {
				st.className = 'mcp-teste ok';
				st.textContent = `Serviço local conectado${COMPL.ver ? ' ' + COMPL.ver : ''} · terminal, disco e dev server disponíveis.`;
			} else if (TERM.allow) {
				st.className = 'mcp-teste';
				st.textContent =
					'Serviço local sem resposta agora — reconectando automaticamente. A permissão de terminal continua ativa e volta a valer sozinha.';
			} else {
				st.className = 'mcp-teste err';
				st.textContent =
					'Serviço local não encontrado — execute "node relay.js" na máquina de trabalho e clique em Testar. O MCP continua operando pela nuvem.';
			}
		}
	}
	try {
		window.auroraTermUI = function () {
			try {
				terminalTravado(modo() === 'local');
			} catch (e) {
				ignorarErro(e, 'auroraTermUI');
			}
		};
	} catch (e) {
		ignorarErro(e, 'auroraMcpModoLocal');
	}

	function aplicar(m) {
		const local = m === 'local';
		const bn = el('mcpBlocoNuvem'),
			bl = el('mcpBlocoLocal');
		if (bn) bn.classList.toggle('hidden', local);
		if (bl) bl.classList.toggle('hidden', !local);
		const bts = document.querySelectorAll('#mcpModo .mcp-modo-b');
		for (let i = 0; i < bts.length; i++)
			bts[i].classList.toggle('on', bts[i].getAttribute('data-modo') === m);
		try {
			document.body.classList.toggle('mcp-modo-local', local);
		} catch (e) {
			ignorarErro(e, 'aplicar');
		}
		const d = el('mcpDicaModo');
		if (d) d.innerHTML = DICA[local ? 'local' : 'nuvem'];
		const dl = el('mcpLocalDica');
		if (dl) dl.innerHTML = PASSOS;
		estado(m);
		terminalTravado(local);
		if (local) {
			try {
				complSondar(true);
			} catch (e) {
				ignorarErro(e, 'aplicar');
			}
		}
		try {
			if (typeof mcpRenderPanel === 'function') mcpRenderPanel();
		} catch (e) {
			ignorarErro(e, 'aplicar');
		}
	}

	function corrigirFalsoCelular() {
		if (MOVEL) return;
		try {
			document.body.classList.remove('mcp-movel');
		} catch (e) {
			ignorarErro(e, 'corrigirFalsoCelular');
		}
		try {
			const st = document.getElementById('aurora-mcp-mobile');
			if (st && st.parentNode) st.parentNode.removeChild(st);
		} catch (e) {
			ignorarErro(e, 'corrigirFalsoCelular');
		}
	}

	function trocar(m) {
		if (MOVEL) return;
		usarTunel = false;
		if (m === modo()) {
			aplicar(m);
			return;
		}
		set(K_MODO, m);
		aplicar(m);
		logar(
			'ok',
			'Modo do MCP: ' +
				(m === 'local' ? 'relay local no PC (com terminal)' : 'nuvem (servidor do site)'),
		);
		let ativo = false;
		try {
			ativo = !!MCP.active;
		} catch (e) {
			ignorarErro(e, 'trocar');
		}
		if (!ativo) return;
		try {
			mcpConnect();
		} catch (e) {
			ignorarErro(e, 'trocar');
		}
		try {
			enviarCatalogo(true);
		} catch (e) {
			ignorarErro(e, 'trocar');
		}
		toastar(
			'Modo alterado',
			m === 'local'
				? 'A URL do MCP continua a mesma - o terminal entra assim que o complemento local responder'
				: 'Terminal desligado - o MCP segue pela nuvem',
			'ok',
		);
	}

	let catEnviado = '',
		catQuando = 0,
		CAT_REVALIDA = 45000;
	async function enviarCatalogo(forcar) {
		try {
			let ativo = false;
			try {
				ativo = !!MCP.active;
			} catch (e) {
				ignorarErro(e, 'enviarCatalogo');
			}
			if (!ativo || typeof mcpHandleMessage !== 'function') return;
			let base = '';
			try {
				base = lim(MCP.relay);
			} catch (e) {
				ignorarErro(e, 'enviarCatalogo');
			}
			if (!ehUrl(base)) return;
			const ini = await mcpHandleMessage({
				jsonrpc: '2.0',
				id: 'cat-i',
				method: 'initialize',
				params: {
					protocolVersion: '2025-06-18',
					capabilities: {},
					clientInfo: { name: 'aurora-cache', version: '1' },
				},
			});
			const tls = await mcpHandleMessage({
				jsonrpc: '2.0',
				id: 'cat-t',
				method: 'tools/list',
				params: {},
			});
			let nFer = 0;
			try {
				nFer = ((tls && tls.result && tls.result.tools) || []).length;
			} catch (e) {
				ignorarErro(e, 'enviarCatalogo');
			}
			const chave = base + '|' + MCP.sid + '|' + MCP.token + '|' + nFer;
			if (!forcar && chave === catEnviado && Date.now() - catQuando < CAT_REVALIDA) return;
			if (!nFer && !forcar) return;
			const r = await fetch(base + '/bridge/' + MCP.sid + '/' + MCP.token + '/meta', {
				method: 'POST',
				headers: cab(),
				body: JSON.stringify({
					init: (ini && ini.result) || null,
					tools: (tls && tls.result) || null,
					reservas: typeof window.__flvReservas === 'function' ? window.__flvReservas() : [],
				}),
			});
			if (!r || !r.ok) return;
			let j = null;
			try {
				j = await r.json();
			} catch (e) {
				ignorarErro(e, 'enviarCatalogo');
			}
			if (chave !== catEnviado)
				logar(
					'ok',
					`Catálogo entregue ao relay (${(j && j.tools) || 0} ferramentas) - o Notion consegue validar a conexão mesmo se esta aba cair.`,
				);
			catEnviado = chave;
			catQuando = Date.now();
		} catch (e) {
			ignorarErro(e, 'enviarCatalogo');
		}
	}
	try {
		window.mcpEnviarCatalogo = enviarCatalogo;
	} catch (e) {
		ignorarErro(e, 'auroraMcpModoLocal');
	}
	try {
		setInterval(function () {
			try {
				if (MCP.active) enviarCatalogo(false);
			} catch (e) {
				ignorarErro(e, 'auroraMcpModoLocal');
			}
		}, 20000);
	} catch (e) {
		ignorarErro(e, 'auroraMcpModoLocal');
	}

	let vigiaN = 0;
	function vigiarPonte() {
		try {
			if (appAtivo()) return;
			let ativo = false;
			try {
				ativo = !!MCP.active;
			} catch (e) {
				ignorarErro(e, 'vigiarPonte');
			}
			if (!ativo) {
				vigiaN = 0;
				return;
			}
			if (modo() === 'local') {
				try {
					complSondar(true);
				} catch (e) {
					ignorarErro(e, 'vigiarPonte');
				}
			}
			let on = false;
			try {
				on = MCP.status === 'online';
			} catch (e) {
				ignorarErro(e, 'vigiarPonte');
			}
			if (on) {
				vigiaN = 0;
				enviarCatalogo(false);
				return;
			}
			vigiaN++;
		} catch (e) {
			ignorarErro(e, 'vigiarPonte');
		}
	}

	async function testar() {
		const msg = el('mcpTesteMsg');
		function diz(k, t) {
			if (!msg) return;
			msg.className = 'mcp-teste' + (k ? ' ' + k : '');
			msg.textContent = t;
		}
		const base = val('mcpRelayLocal') || val('mcpPub') || LOCAL_PADRAO;
		if (!ehUrl(base)) {
			diz('err', 'Preencha o endereço do complemento local (padrão http://localhost:8787).');
			return;
		}
		diz('', `Testando ${base} ...`);
		var ctl = null,
			t = null;
		try {
			ctl = new AbortController();
			t = setTimeout(function () {
				try {
					ctl.abort();
				} catch (e) {
					ignorarErro(e, 'testar');
				}
			}, 7000);
			const r = await fetch(base + '/', {
				method: 'GET',
				cache: 'no-store',
				mode: 'cors',
				credentials: 'omit',
				headers: { 'ngrok-skip-browser-warning': 'true' },
				signal: ctl.signal,
			});
			let txt = '';
			try {
				txt = await r.text();
			} catch (e) {
				ignorarErro(e, 'testar');
			}
			if (r.ok && /(?:Aurora|Synapse) MCP Relay/i.test(txt)) {
				let extra = '';
				try {
					const r2 = await fetch(base + '/stats', {
						method: 'GET',
						cache: 'no-store',
						mode: 'cors',
						credentials: 'omit',
						headers: { 'ngrok-skip-browser-warning': 'true' },
					});
					const j2 = await r2.json();
					let abas = 0,
						ses = (j2 && j2.sessions) || [];
					for (let i = 0; i < ses.length; i++)
						if (ses[i] && ses[i].sid === MCP.sid) abas = ses[i].executores || 0;
					const fer = (j2 && j2.catalogo && j2.catalogo.ferramentas) || 0;
					extra = ` · ${abas} aba(s) conectada(s) · catálogo: ${fer ? fer + ' ferramentas' : 'ainda vazio'}`;
				} catch (e) {
					ignorarErro(e, 'testar');
				}
				diz('ok', `OK - ${txt.trim().split('\n')[0].slice(0, 60)}${extra}`);
				logar('ok', `Complemento local respondeu em ${base}${extra}`);
				try {
					COMPL.url = base;
					complSalvarCfg();
					complSondar(false).then(function () {
						enviarCatalogo(true);
					});
				} catch (e) {
					ignorarErro(e, 'testar');
				}
			} else {
				diz(
					'err',
					`Respondeu (HTTP ${r.status}), mas nao parece o relay do Synapse. Confira a URL/porta.`,
				);
			}
		} catch (e) {
			diz(
				'err',
				`Sem resposta de ${base} - o relay esta rodando (node relay.js)? A URL do tunel esta certa?`,
			);
		} finally {
			if (t) clearTimeout(t);
		}
	}

	function iniciar() {
		corrigirFalsoCelular();
		const m = modo();
		let rel = '',
			pub = '';
		try {
			rel = lim(MCP.relay);
			pub = lim(MCP.pub);
		} catch (e) {
			ignorarErro(e, 'iniciar');
		}
		const iTun = el('mcpPub'),
			iLoc = el('mcpRelayLocal'),
			iNuv = el('mcpRelay');
		const sTun = get(K_TUNEL),
			sLoc = get(K_LOCAL),
			sNuv = get(K_NUVEM);
		if (iTun) iTun.value = lim(sTun != null ? sTun : m === 'local' ? pub : '');
		if (iLoc) {
			let loc = sLoc;
			if (loc == null) loc = m === 'local' && rel && rel !== pub ? rel : LOCAL_PADRAO;
			iLoc.value = lim(loc);
		}
		if (iNuv)
			iNuv.value = lim(sNuv != null ? sNuv : m === 'nuvem' && rel ? rel : PADRAO) || lim(PADRAO);

		if (iTun && !iTun.getAttribute('data-ml')) {
			iTun.setAttribute('data-ml', '1');
			iTun.addEventListener('input', function () {
				set(K_TUNEL, lim(iTun.value));
				estado(modo());
				try {
					mcpRenderPanel();
				} catch (e) {
					ignorarErro(e, 'iniciar');
				}
			});
		}
		if (iLoc && !iLoc.getAttribute('data-ml')) {
			iLoc.setAttribute('data-ml', '1');
			iLoc.addEventListener('input', function () {
				usarTunel = false;
				set(K_LOCAL, lim(iLoc.value));
				estado(modo());
			});
		}
		if (iNuv && !iNuv.getAttribute('data-ml')) {
			iNuv.setAttribute('data-ml', '1');
			iNuv.addEventListener('input', function () {
				set(K_NUVEM, lim(iNuv.value));
				estado(modo());
			});
		}

		const mm = el('mcpModo');
		if (mm && !mm.getAttribute('data-ml')) {
			mm.setAttribute('data-ml', '1');
			mm.addEventListener('click', function (ev) {
				const alvo = ev.target && ev.target.closest ? ev.target.closest('.mcp-modo-b') : null;
				if (!alvo) return;
				ev.preventDefault();
				ev.stopPropagation();
				trocar(alvo.getAttribute('data-modo') === 'local' ? 'local' : 'nuvem');
			});
		}
		const bt = el('mcpTestar');
		if (bt && !bt.getAttribute('data-ml')) {
			bt.setAttribute('data-ml', '1');
			bt.addEventListener('click', function (ev) {
				ev.preventDefault();
				testar();
			});
		}

		aplicar(m);
		setTimeout(function () {
			corrigirFalsoCelular();
			aplicar(modo());
		}, 1500);
		setInterval(vigiarPonte, 12000);
		setTimeout(function () {
			enviarCatalogo(false);
		}, 4000);
	}

	try {
		const _ativarAntes = mcpActivate;
		if (typeof _ativarAntes === 'function') {
			mcpActivate = function (silent) {
				try {
					if (modo() === 'local' && !appAtivo()) {
						estado('local');
						try {
							complSondar(true);
						} catch (e) {
							ignorarErro(e, 'auroraMcpModoLocal');
						}
					}
				} catch (e) {
					ignorarErro(e, 'auroraMcpModoLocal');
				}
				const ret = _ativarAntes.apply(this, arguments);
				try {
					setTimeout(function () {
						enviarCatalogo(true);
					}, 2000);
				} catch (e) {
					ignorarErro(e, 'auroraMcpModoLocal');
				}
				return ret;
			};
		}
	} catch (e) {
		ignorarErro(e, 'auroraMcpModoLocal');
	}

	if (document.readyState === 'loading')
		document.addEventListener('DOMContentLoaded', function () {
			setTimeout(iniciar, 0);
		});
	else setTimeout(iniciar, 0);
})();
