'use strict';
(function auroraBlindagemRajada() {
	if (typeof mcpHandleMessage !== 'function') return;
	try {
		if (mcpHandleMessage.__rajada) return;
	} catch (e) {
		return;
	}

	const B = {
		ligado: true,
		limiteMs: 45000,
		lentaMs: 10000,
		total: 0,
		emVoo: 0,
		pico: 0,
		lentas: 0,
		socorros: 0,
		erros: 0,
		ultimoSocorro: '',
	};

	function esperar(ms) {
		try {
			if (typeof window.bgEspera === 'function') return window.bgEspera(ms);
		} catch (e) {
			ignorarErro(e, 'esperar');
		}
		return new Promise(function (rs) {
			setTimeout(rs, ms);
		});
	}
	function nomeFerr(msg) {
		try {
			return String((msg && msg.params && msg.params.name) || '');
		} catch (e) {
			return '';
		}
	}

	const _orig = mcpHandleMessage;
	async function mcpHandleMessageRajada(msg) {
		let vigiar = false;
		try {
			vigiar = !!(
				B.ligado &&
				B.limiteMs > 0 &&
				msg &&
				!Array.isArray(msg) &&
				msg.method === 'tools/call' &&
				msg.id !== undefined
			);
		} catch (e) {
			vigiar = false;
		}
		if (!vigiar) return _orig(msg);

		B.total++;
		B.emVoo++;
		if (B.emVoo > B.pico) B.pico = B.emVoo;
		let t0 = Date.now(),
			pronto = false;
		const real = Promise.resolve()
			.then(function () {
				return _orig(msg);
			})
			.then(
				function (v) {
					pronto = true;
					return { ok: 1, v: v };
				},
				function (e) {
					pronto = true;
					return { ok: 0, e: e };
				},
			);
		const relogio = esperar(B.limiteMs).then(function () {
			return { tempo: 1 };
		});
		const r = await Promise.race([real, relogio]);

		if (r && r.tempo && !pronto) {
			B.socorros++;
			B.emVoo--;
			const f = nomeFerr(msg) || 'tools/call';
			const seg = Math.round(B.limiteMs / 1000);
			B.ultimoSocorro =
				f +
				' as ' +
				(function () {
					try {
						return new Date().toLocaleTimeString();
					} catch (e) {
						return '';
					}
				})();
			try {
				mcpLog(
					'err',
					`Chamada "${f}" passou de ${seg}s: respondi ao agente para ele nao ficar travado (a chamada pode ainda estar rodando aqui).`,
				);
			} catch (e) {
				ignorarErro(e, 'mcpHandleMessageRajada');
			}
			return {
				jsonrpc: '2.0',
				id: msg.id,
				error: {
					code: -32001,
					message: `A aba do site nao concluiu "${f}" em ${seg}s. Esta resposta existe para voce nao ficar \
travado esperando: a chamada PODE ainda estar rodando no site. NAO repita gravacao as cegas - confira \
o estado primeiro (read_file, list_files, command_output ou file_locks) e so entao tente de novo.`,
				},
			};
		}

		B.emVoo--;
		if (Date.now() - t0 >= B.lentaMs) B.lentas++;
		if (r && r.ok) return r.v;
		B.erros++;
		throw r && r.e;
	}
	mcpHandleMessageRajada.__rajada = 1;
	mcpHandleMessageRajada.__orig = _orig;
	try {
		mcpHandleMessage = mcpHandleMessageRajada;
	} catch (e) {
		try {
			window.mcpHandleMessage = mcpHandleMessageRajada;
		} catch (e2) {
			ignorarErro(e2, 'auroraBlindagemRajada');
		}
	}

	try {
		if (typeof mcpRenderAgents === 'function' && !mcpRenderAgents.__rajada) {
			let _ra = mcpRenderAgents,
				raT = null,
				raPend = 0;
			const nra = function () {
				if (raT) {
					raPend++;
					return;
				}
				raT = setTimeout(function () {
					raT = null;
					if (raPend) {
						raPend = 0;
						try {
							nra();
						} catch (e) {
							ignorarErro(e, 'nra');
						}
					}
				}, 250);
				try {
					_ra();
				} catch (e) {
					ignorarErro(e, 'nra');
				}
			};
			nra.__rajada = 1;
			nra.__orig = _ra;
			try {
				mcpRenderAgents = nra;
			} catch (e) {
				try {
					window.mcpRenderAgents = nra;
				} catch (e2) {
					ignorarErro(e2, 'auroraBlindagemRajada');
				}
			}
		}
	} catch (e) {
		ignorarErro(e, 'auroraBlindagemRajada');
	}

	try {
		window.SYNAPSE_RAJADA = {
			estado: function () {
				let vivos = 0,
					cache = 0;
				try {
					MCP.seenReq.forEach(function (v) {
						if (v && !v.done) vivos++;
						else cache++;
					});
				} catch (e) {
					ignorarErro(e, 'estado');
				}
				let oculta = false;
				try {
					oculta = document.visibilityState !== 'visible';
				} catch (e) {
					ignorarErro(e, 'estado');
				}
				let tr = '?';
				try {
					tr = MCP.forcePoll ? 'polling' : MCP.forceSse ? 'sse' : 'websocket';
				} catch (e) {
					ignorarErro(e, 'estado');
				}
				return {
					ligado: B.ligado,
					tetoPorChamadaSeg: Math.round(B.limiteMs / 1000),
					chamadasVigiadas: B.total,
					emVoo: B.emVoo,
					picoSimultaneo: B.pico,
					lentas: B.lentas,
					respostasDeSocorro: B.socorros,
					ultimoSocorro: B.ultimoSocorro || '-',
					errosDeFerramenta: B.erros,
					emVooNoDedupe: vivos,
					respostasEmCache: cache,
					respostasPerdidasNoEnvio: (function () {
						try {
							return MCP.respPerdidas | 0;
						} catch (e) {
							return 0;
						}
					})(),
					abaOculta: oculta,
					transporte: tr,
				};
			},
			teto: function (seg) {
				const v = Math.max(5, Math.min(180, Number(seg) || 0));
				B.limiteMs = v * 1000;
				return `teto por chamada: ${v}s`;
			},
			desligar: function () {
				B.ligado = false;
				return 'blindagem de rajada DESLIGADA - o MCP volta ao comportamento anterior (sem teto de tempo por chamada)';
			},
			ligar: function () {
				B.ligado = true;
				return 'blindagem de rajada ligada';
			},
			zerar: function () {
				B.total = 0;
				B.pico = 0;
				B.lentas = 0;
				B.socorros = 0;
				B.erros = 0;
				B.ultimoSocorro = '';
				try {
					MCP.respPerdidas = 0;
				} catch (e) {
					ignorarErro(e, 'zerar');
				}
				return 'contadores zerados';
			},
		};
	} catch (e) {
		ignorarErro(e, 'auroraBlindagemRajada');
	}

	try {
		registro.debug(
			'%c[Synapse] Blindagem de rajada v10.0.2 ativa',
			'color:#6aa3ff;font-weight:600',
			'teto de 45s por chamada · SYNAPSE_RAJADA.estado()',
		);
	} catch (e) {
		ignorarErro(e, 'auroraBlindagemRajada');
	}
})();
