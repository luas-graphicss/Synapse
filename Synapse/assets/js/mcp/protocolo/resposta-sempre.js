'use strict';

(function auroraRespostaSempre() {
	if (typeof mcpHandleMessage !== 'function') return;
	try {
		if (mcpHandleMessage.__respostaSempre) return;
	} catch (e) {
		return;
	}

	const LIMITE_HANDSHAKE = 12000;
	const LIMITE_GERAL = 110000;
	const ESPERA_DUPLICATA = 120000;

	const R = { acks: 0, socorros: 0, nulos: 0, duplicatas: 0, handshakeOk: false };
	let ultimoTools = null;

	function logar(k, t) {
		try {
			if (typeof mcpLog === 'function') mcpLog(k, t);
		} catch (e) {
			ignorarErro(e, 'logar');
		}
	}
	function ehObj(x) {
		return !!x && typeof x === 'object' && !Array.isArray(x);
	}
	function metodoDe(m) {
		try {
			return ehObj(m) && typeof m.method === 'string' ? m.method : '';
		} catch (e) {
			return '';
		}
	}
	function ehNotificacao(m) {
		return ehObj(m) && typeof m.method === 'string' && m.id === undefined;
	}

	function ack(metodo) {
		R.acks++;
		return {
			jsonrpc: '2.0',
			method: 'notifications/ack',
			params: {
				ok: true,
				status: 202,
				received: String(metodo || ''),
				server: 'aurora-live-preview',
			},
		};
	}

	function erroJson(id, codigo, msg) {
		return {
			jsonrpc: '2.0',
			id: id === undefined ? null : id,
			error: { code: codigo, message: String(msg) },
		};
	}

	function sanear(out, msg) {
		if (Array.isArray(out)) {
			const lista = [];
			for (let i = 0; i < out.length; i++) {
				const it = sanear(out[i], null);
				if (it) lista.push(it);
			}
			if (!lista.length) return ack(metodoDe(msg) || 'batch');
			return lista;
		}
		if (!ehObj(out)) {
			R.nulos++;
			return ack(metodoDe(msg));
		}
		if (
			out.error === undefined &&
			out.id !== undefined &&
			(out.result === null || out.result === undefined)
		)
			out.result = {};
		if (out.jsonrpc === undefined) out.jsonrpc = '2.0';
		return out;
	}

	function guardarTools(msg, out) {
		try {
			if (metodoDe(msg) !== 'tools/list') return;
			const t = out && out.result && out.result.tools;
			if (Array.isArray(t) && t.length) ultimoTools = { tools: t };
		} catch (e) {
			ignorarErro(e, 'guardarTools');
		}
	}

	function versaoNegociada(params) {
		const conhecidas = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
		let pedida = '';
		try {
			pedida = String((params && params.protocolVersion) || '');
		} catch (e) {
			ignorarErro(e, 'versaoNegociada');
		}
		return conhecidas.includes(pedida) ? pedida : '2025-03-26';
	}

	function socorroHandshake(msg) {
		const metodo = metodoDe(msg);
		const id = msg && msg.id;
		let res = null;
		if (metodo === 'initialize') {
			res = {
				protocolVersion: versaoNegociada(msg && msg.params),
				capabilities: { tools: { listChanged: false } },
				serverInfo: {
					name: 'aurora-live-preview',
					title: 'Synapse Live Preview',
					version: '1.0.0',
				},
				instructions:
					'Synapse Live Preview: editor com preview ao vivo. Use tools/list para ver as ferramentas.',
			};
		} else if (metodo === 'tools/list') {
			res = ultimoTools || { tools: [] };
		} else if (metodo === 'resources/list') res = { resources: [] };
		else if (metodo === 'resources/templates/list') res = { resourceTemplates: [] };
		else if (metodo === 'prompts/list') res = { prompts: [] };
		else res = {};
		R.socorros++;
		logar(
			'err',
			`Handshake "${metodo}" demorou demais: respondi com um resultado valido para o Notion nao ficar carregando.`,
		);
		return { jsonrpc: '2.0', id: id === undefined ? null : id, result: res };
	}

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

	const HANDSHAKE = {
		initialize: 1,
		'tools/list': 1,
		ping: 1,
		'resources/list': 1,
		'resources/templates/list': 1,
		'prompts/list': 1,
		'logging/setLevel': 1,
	};

	const _orig = mcpHandleMessage;

	async function mcpHandleMessageSempre(msg) {
		const metodo = metodoDe(msg);
		const notif = ehNotificacao(msg);
		const limite = HANDSHAKE[metodo] ? LIMITE_HANDSHAKE : LIMITE_GERAL;

		let pronto = false;
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
		const relogio = esperar(limite).then(function () {
			return { tempo: 1 };
		});
		const r = await Promise.race([real, relogio]);

		if (r && r.tempo && !pronto) {
			if (notif) return ack(metodo);
			if (HANDSHAKE[metodo]) return socorroHandshake(msg);
			return erroJson(
				msg && msg.id,
				-32001,
				`A aba do Synapse nao concluiu "${metodo || 'chamada'}" a tempo. Confira o estado antes de repetir.`,
			);
		}

		if (r && r.ok) {
			const out = r.v;
			guardarTools(msg, out);
			if (notif) {
				if (metodo === 'notifications/initialized' && !R.handshakeOk) {
					R.handshakeOk = true;
					logar(
						'ok',
						'Handshake concluido: "notifications/initialized" confirmado ao cliente (o Notion nao fica mais carregando).',
					);
				}
				return ehObj(out) || Array.isArray(out) ? sanear(out, msg) : ack(metodo);
			}
			return sanear(out, msg);
		}

		var e = r && r.e;
		if (notif) return ack(metodo);
		return erroJson(msg && msg.id, -32603, (e && e.message) || e || 'erro interno');
	}

	mcpHandleMessageSempre.__respostaSempre = 1;
	mcpHandleMessageSempre.__orig = _orig;
	try {
		mcpHandleMessage = mcpHandleMessageSempre;
	} catch (e) {
		try {
			window.mcpHandleMessage = mcpHandleMessageSempre;
		} catch (e2) {
			ignorarErro(e2, 'auroraRespostaSempre');
		}
	}
	try {
		window.mcpHandleMessage = mcpHandleMessageSempre;
	} catch (e) {
		ignorarErro(e, 'auroraRespostaSempre');
	}

	try {
		if (
			typeof mcpReqKey === 'function' &&
			typeof mcpReqVisto === 'function' &&
			!mcpReqVisto.__respostaSempre
		) {
			const _chave = mcpReqKey;
			const _visto = mcpReqVisto;
			let ultimoPkt = null;
			const aguardando = Object.create(null);

			const novaChave = function (pkt) {
				try {
					ultimoPkt = pkt;
				} catch (e) {
					ignorarErro(e, 'novaChave');
				}
				return _chave(pkt);
			};
			novaChave.__respostaSempre = 1;

			const responderDepois = function (chave, reqId, idOriginal) {
				const marca = chave + '#' + reqId;
				if (aguardando[marca]) return;
				aguardando[marca] = 1;
				R.duplicatas++;
				const inicio = Date.now();
				const tick = setInterval(function () {
					let v = null;
					try {
						v = MCP.seenReq ? MCP.seenReq.get(chave) : null;
					} catch (e) {
						v = null;
					}
					const fim = Date.now() - inicio > ESPERA_DUPLICATA;
					if (v && v.done) {
						clearInterval(tick);
						delete aguardando[marca];
						try {
							mcpEnviarResposta(reqId, v.out);
						} catch (e) {
							ignorarErro(e, 'responderDepois');
						}
						return;
					}
					if (!v || fim) {
						clearInterval(tick);
						delete aguardando[marca];
						const corpo =
							idOriginal === undefined
								? ack('duplicata')
								: erroJson(
										idOriginal,
										-32001,
										'Chamada repetida sem resultado disponivel. Confira o estado antes de repetir.',
									);
						try {
							mcpEnviarResposta(reqId, corpo);
						} catch (e) {
							ignorarErro(e, 'responderDepois');
						}
					}
				}, 500);
			};

			const novoVisto = function (chave) {
				const v = _visto(chave);
				try {
					if (v && !v.done && ultimoPkt && ultimoPkt.reqId != null) {
						responderDepois(chave, ultimoPkt.reqId, ultimoPkt.body ? ultimoPkt.body.id : undefined);
					}
				} catch (e) {
					ignorarErro(e, 'novoVisto');
				}
				return v;
			};
			novoVisto.__respostaSempre = 1;

			try {
				mcpReqKey = novaChave;
			} catch (e) {
				window.mcpReqKey = novaChave;
			}
			try {
				mcpReqVisto = novoVisto;
			} catch (e) {
				window.mcpReqVisto = novoVisto;
			}
			try {
				window.mcpReqKey = novaChave;
				window.mcpReqVisto = novoVisto;
			} catch (e) {
				ignorarErro(e, 'auroraRespostaSempre');
			}
		}
	} catch (e) {
		ignorarErro(e, 'auroraRespostaSempre');
	}

	try {
		window.SYNAPSE_HANDSHAKE = {
			estado: function () {
				return {
					handshakeConcluido: R.handshakeOk,
					notificacoesConfirmadas: R.acks,
					respostasNulasCorrigidas: R.nulos,
					socorrosDeHandshake: R.socorros,
					duplicatasRespondidas: R.duplicatas,
					ferramentasEmCache: ultimoTools ? ultimoTools.tools.length : 0,
				};
			},
		};
	} catch (e) {
		ignorarErro(e, 'auroraRespostaSempre');
	}

	try {
		registro.debug(
			'%c[Synapse] Handshake MCP blindado v10.1',
			'color:#6aa3ff;font-weight:600',
			'notificacoes sempre confirmadas · SYNAPSE_HANDSHAKE.estado()',
		);
	} catch (e) {
		ignorarErro(e, 'auroraRespostaSempre');
	}
})();
