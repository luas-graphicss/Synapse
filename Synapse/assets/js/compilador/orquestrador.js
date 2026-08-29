(function (raiz, fabrica) {
	'use strict';
	let base = '';
	try {
		if (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) {
			base = document.currentScript.src.replace(/[^/]*$/, '');
		}
	} catch (e) {
		ignorarErro(e, 'orquestrador');
	}
	const api = fabrica(base);
	if (typeof module === 'object' && module && module.exports) module.exports = api;
	else raiz.SYNAPSE_ORQUESTRADOR = api;
})(typeof self !== 'undefined' ? self : this, function (BASE_DIR) {
	'use strict';

	const LIMITE_PADRAO_MS = 10000;

	function dep(nome) {
		const g = typeof self !== 'undefined' ? self : {};
		return g[nome] || null;
	}

	function ambiente() {
		const g = typeof self !== 'undefined' ? self : {};
		const problemas = [];
		function add(nivel, codigo, texto) {
			problemas.push({ nivel: nivel, codigo: codigo, texto: texto });
		}

		if (typeof WebAssembly === 'undefined' || !WebAssembly.validate) {
			add(
				'erro',
				'sem-wasm',
				'Este navegador nao tem WebAssembly. O preview compilado nao funciona aqui.',
			);
		}
		let proto = '';
		try {
			proto = (g.location && g.location.protocol) || '';
		} catch (e) {
			ignorarErro(e, 'ambiente');
		}
		if (proto === 'file:') {
			add(
				'aviso',
				'file-protocol',
				'A pagina foi aberta como arquivo local (file://). Nesse modo o navegador bloqueia cache e verificacao de integridade. Sirva por http:// para o auto-compilador funcionar direito.',
			);
		}
		if (typeof g.Worker !== 'function') {
			add(
				'aviso',
				'sem-worker',
				'Sem Web Worker: o programa vai rodar na thread da pagina. Um laco infinito no seu codigo pode travar a aba.',
			);
		}
		let temIDB = false;
		try {
			temIDB = !!g.indexedDB;
		} catch (e) {
			ignorarErro(e, 'ambiente');
		}
		if (!temIDB) {
			add(
				'aviso',
				'sem-indexeddb',
				'Sem IndexedDB (comum em janela privada). O toolchain nao fica guardado e sera baixado de novo a cada visita.',
			);
		}
		let temSubtle = false;
		try {
			temSubtle = !!(g.crypto && g.crypto.subtle && g.crypto.subtle.digest);
		} catch (e) {
			ignorarErro(e, 'ambiente');
		}
		if (!temSubtle) {
			add(
				'aviso',
				'sem-subtle',
				'Sem crypto.subtle: nao da para verificar a integridade (SHA-256) do toolchain baixado.',
			);
		}
		let online = true;
		try {
			if (g.navigator && typeof g.navigator.onLine === 'boolean') online = g.navigator.onLine;
		} catch (e) {
			ignorarErro(e, 'ambiente');
		}
		if (!online) {
			add(
				'aviso',
				'offline',
				'Voce esta sem conexao. Se o toolchain ainda nao estiver no cache, a compilacao nao vai comecar.',
			);
		}
		return {
			ok: !problemas.some(function (p) {
				return p.nivel === 'erro';
			}),
			problemas: problemas,
		};
	}

	function Painel(frame, ondeEstou) {
		this.frame = frame;
		this.fila = [];
		this.pronto = false;
		this.aoEntrada = null;
		this.janela = ondeEstou || self;
		this._largou = false;
		this._largarDepois = false;
		const eu = this;

		this._ouvinte = function (ev) {
			if (!frame || ev.source !== frame.contentWindow) return;
			const m = ev.data;
			if (!m || typeof m !== 'object') return;
			if (m.tipo === 'pronto') {
				if (eu.pronto) return;
				eu.pronto = true;
				if (eu._ping) {
					clearInterval(eu._ping);
					eu._ping = null;
				}
				while (eu.fila.length) eu._enviar(eu.fila.shift());
				if (eu._largarDepois) eu._largar();
			} else if (m.tipo === 'entrada' && typeof eu.aoEntrada === 'function') {
				eu.aoEntrada(m.texto);
			} else if (typeof eu.aoMensagem === 'function') {
				eu.aoMensagem(m);
			}
		};
		this.janela.addEventListener('message', this._ouvinte);

		let tentativas = 0;
		this._ping = setInterval(function () {
			if (eu.pronto || eu._largou || ++tentativas > 80) {
				clearInterval(eu._ping);
				eu._ping = null;
				return;
			}
			eu._enviar({ tipo: 'ping' });
		}, 60);
	}

	Painel.prototype._enviar = function (m) {
		try {
			if (this.frame && this.frame.contentWindow) this.frame.contentWindow.postMessage(m, '*');
		} catch (e) {
			ignorarErro(e, '_enviar');
		}
	};
	Painel.prototype.mandar = function (m) {
		if (this.pronto) this._enviar(m);
		else this.fila.push(m);
	};
	Painel.prototype.saida = function (fluxo, texto) {
		this.mandar({ tipo: 'saida', fluxo: fluxo, texto: texto });
	};
	Painel.prototype.sistema = function (texto) {
		this.mandar({ tipo: 'sistema', texto: texto + '\n' });
	};
	Painel.prototype.aviso = function (texto) {
		this.mandar({ tipo: 'aviso', texto: texto + '\n' });
	};
	Painel.prototype.estado = function (texto) {
		this.mandar({ tipo: 'estado', texto: texto });
	};
	Painel.prototype.progresso = function (pct, texto) {
		this.mandar({ tipo: 'progresso', pct: pct, texto: texto });
	};
	Painel.prototype.erro = function (texto, rotulo) {
		this.mandar({ tipo: 'erro', texto: texto, rotulo: rotulo || 'Erro' });
	};
	Painel.prototype.fim = function (codigo, ms) {
		this.mandar({ tipo: 'fim', codigo: codigo, ms: ms });
	};
	Painel.prototype.limpar = function () {
		this.mandar({ tipo: 'limpar' });
	};
	Painel.prototype.modulo = function (p) {
		this.mandar({
			tipo: 'modulo',
			js: p.js,
			nomeJs: p.nomeJs || null,
			wasm: p.wasm || null,
			dados: p.dados || null,
			nomeDados: p.nomeDados || null,
			esm: !!p.esm,
			args: p.args || [],
		});
	};
	Painel.prototype._largar = function () {
		if (this._largou) return;
		this._largou = true;
		if (this._ping) {
			clearInterval(this._ping);
			this._ping = null;
		}
		try {
			this.janela.removeEventListener('message', this._ouvinte);
		} catch (e) {
			ignorarErro(e, '_largar');
		}
	};
	Painel.prototype.soltar = function () {
		const eu = this;
		if (!this.pronto && this.fila.length) {
			this._largarDepois = true;
			setTimeout(function () {
				eu._largar();
			}, 4000);
			return;
		}
		this._largar();
	};

	let painelVivo = null;

	const adaptadores = {};

	function registrarAdaptador(idToolchain, fn) {
		if (!idToolchain || typeof fn !== 'function')
			throw new Error('adaptador precisa de id e funcao');
		adaptadores[idToolchain] = fn;
		return true;
	}

	let workerAtual = null;

	function rodarEmWorker(wasm, op) {
		const g = typeof self !== 'undefined' ? self : {};
		if (typeof g.Worker !== 'function') return null;

		return new Promise(function (resolve) {
			let w;
			try {
				w = new Worker(BASE_DIR + 'executor.worker.js');
			} catch (e) {
				resolve({ erro: 'nao-criou-worker', texto: String((e && e.message) || e) });
				return;
			}
			workerAtual = w;
			let acabou = false;
			const prazo = setTimeout(function () {
				if (acabou) return;
				acabou = true;
				try {
					w.terminate();
				} catch (e) {
					ignorarErro(e, 'rodarEmWorker');
				}
				workerAtual = null;
				resolve({
					erro: 'tempo',
					texto: `O programa passou de ${op.limiteMs}ms sem terminar e foi interrompido.`,
				});
			}, op.limiteMs + 1500);

			w.onmessage = function (ev) {
				const m = ev.data;
				if (!m) return;
				if (m.tipo === 'saida') {
					if (op.aoSaida) op.aoSaida(m.fluxo, m.texto);
					return;
				}
				if (acabou) return;
				acabou = true;
				clearTimeout(prazo);
				try {
					w.terminate();
				} catch (e) {
					ignorarErro(e, 'onmessage');
				}
				workerAtual = null;
				if (m.tipo === 'fim') resolve({ codigo: m.codigo, ms: m.ms });
				else resolve({ erro: m.tempoEsgotado ? 'tempo' : 'falha', texto: m.texto, ms: m.ms });
			};
			w.onerror = function (ev) {
				if (acabou) return;
				acabou = true;
				clearTimeout(prazo);
				try {
					w.terminate();
				} catch (e) {
					ignorarErro(e, 'onerror');
				}
				workerAtual = null;
				resolve({ erro: 'worker', texto: (ev && ev.message) || 'falha no worker de execucao' });
			};

			w.postMessage({
				tipo: 'rodar',
				wasm: wasm,
				args: op.args || ['programa'],
				env: op.env || {},
				stdin: op.stdin || '',
				limiteMs: op.limiteMs,
			});
		});
	}

	function rodarNaPagina(wasm, op) {
		const WASI = dep('SYNAPSE_WASI');
		if (!WASI) return Promise.resolve({ erro: 'falha', texto: 'wasi.js nao foi carregado' });
		const t0 = Date.now();
		return new Promise(function (resolve) {
			const wasi = WASI.criar({
				args: op.args || ['programa'],
				env: op.env || {},
				stdin: op.stdin || '',
				limiteMs: op.limiteMs,
				stdout: function (s) {
					if (op.aoSaida) op.aoSaida('out', s);
				},
				stderr: function (s) {
					if (op.aoSaida) op.aoSaida('err', s);
				},
			});
			try {
				const mod = new WebAssembly.Module(wasm);
				const inst = new WebAssembly.Instance(mod, wasi.imports);
				wasi.vincular(inst);
				const cod = wasi.rodar(inst);
				resolve({ codigo: cod, ms: Date.now() - t0 });
			} catch (e) {
				try {
					wasi.descarregar();
				} catch (e2) {
					ignorarErro(e2, 'rodarNaPagina');
				}
				resolve({
					erro: e && e.tempoEsgotado ? 'tempo' : 'falha',
					texto: String((e && e.message) || e),
					ms: Date.now() - t0,
				});
			}
		});
	}

	let cancelador = null;

	function cancelar() {
		if (cancelador) {
			try {
				cancelador.abort();
			} catch (e) {
				ignorarErro(e, 'cancelar');
			}
		}
		if (workerAtual) {
			try {
				workerAtual.terminate();
			} catch (e) {
				ignorarErro(e, 'cancelar');
			}
			workerAtual = null;
		}
		return true;
	}

	function nomeNivel(n) {
		if (n === 1) return 'nivel 1 (navegador puro)';
		if (n === 2) return 'nivel 2 (GUI portavel: canvas/WebGL)';
		if (n === 3) return 'nivel 3 (precisa da nuvem)';
		return 'nao executavel no navegador';
	}

	function autoPreview(op) {
		op = op || {};
		const logs = [];
		const DET = dep('SYNAPSE_DETECCAO');
		const MOTOR = dep('SYNAPSE_TOOLCHAINS');
		const CAT = dep('SYNAPSE_CATALOGO');
		const SHELL = dep('SYNAPSE_SHELL');
		const BUNDLE = dep('SYNAPSE_BUNDLE');

		let painel = null;

		function log(nivel, codigo, texto) {
			const reg = { nivel: nivel, codigo: codigo, texto: texto };
			logs.push(reg);
			if (typeof op.aoLog === 'function') {
				try {
					op.aoLog(reg);
				} catch (e) {
					ignorarErro(e, 'log');
				}
			} else if (typeof console !== 'undefined') {
				const f = nivel === 'erro' ? 'error' : nivel === 'aviso' ? 'warn' : 'log';
				try {
					console[f]('[auto-compilador] ' + texto);
				} catch (e) {
					ignorarErro(e, 'log');
				}
			}
			if (painel) {
				if (nivel === 'erro') painel.erro(texto, 'Erro');
				else if (nivel === 'aviso') painel.aviso('! ' + texto);
				else painel.sistema('- ' + texto);
			}
			return reg;
		}

		const EXT_FONTE = /\.(c|h|cc|cpp|cxx|hpp|hh|m|mm|cs|rs|go|py|zig|java|kt|swift)$/i;
		function fontesDoUsuario(lista) {
			let t = '';
			try {
				const arr = DET && typeof DET.normalizar === 'function' ? DET.normalizar(lista || []) : [];
				for (let i = 0; i < arr.length; i++) {
					const a = arr[i] || {};
					if (!EXT_FONTE.test(String(a.caminho || a.path || ''))) continue;
					const c = a.conteudo != null ? a.conteudo : a.content != null ? a.content : '';
					t += ' ' + String(c);
				}
			} catch (e) {
				ignorarErro(e, 'fontesDoUsuario');
			}
			return t;
		}

		function avisarInterferencias(temDados) {
			const fontes = fontesDoUsuario(op.arquivos);
			if (!fontes) return;

			const temLoopWeb =
				/emscripten_set_main_loop|emscripten_request_animation_frame|emscripten_sleep|ASYNCIFY/i.test(
					fontes,
				);
			const temLoopBloqueante =
				/while\s*\(\s*(?:1|true)\s*\)|for\s*\(\s*;\s*;\s*\)|WindowShouldClose|SDL_PollEvent|glfwWindowShouldClose/i.test(
					fontes,
				);
			if (temLoopBloqueante && !temLoopWeb) {
				log(
					'aviso',
					'loop-bloqueante',
					'Aviso: o codigo tem laco principal proprio (while(1) / WindowShouldClose) e nao chama ' +
						'emscripten_set_main_loop. No navegador esse laco nao devolve o controle para a pagina: ' +
						'a tela congela e nem o console responde. Compile com -sASYNCIFY ou troque o laco por ' +
						'emscripten_set_main_loop.',
				);
			}

			if (
				/SDL_INIT_AUDIO|Mix_OpenAudio|SDL_OpenAudio|alSourcePlay|InitAudioDevice|PlaySound|SDL_QueueAudio/i.test(
					fontes,
				)
			) {
				log(
					'aviso',
					'audio-precisa-clique',
					'Aviso: o navegador só libera audio depois de um clique dentro do preview. Antes disso o som fica mudo (e alguns programas travam esperando o dispositivo de audio abrir).',
				);
			}

			if (
				/SDL_SetRelativeMouseMode|SDL_CaptureMouse|glfwSetInputMode|DisableCursor|SetMousePosition|SDL_WarpMouse/i.test(
					fontes,
				)
			) {
				log(
					'aviso',
					'mouse-capturado',
					'Aviso: captura de mouse (pointer lock) só começa depois de um clique no preview, e a tecla ESC devolve o cursor -- o programa vai receber "mouse solto" nesse momento.',
				);
			}

			if (
				/SDL_SetWindowFullscreen|ToggleFullscreen|glfwSetWindowMonitor|SDL_WINDOW_FULLSCREEN/i.test(
					fontes,
				)
			) {
				log(
					'aviso',
					'tela-cheia',
					'Aviso: pedido de tela cheia dentro do preview usa só a area do painel, nao o monitor todo. Para testar tela cheia de verdade, abra o preview em janela separada.',
				);
			}

			if (
				!temDados &&
				/fopen\s*\(|std::ifstream|SDL_LoadBMP|IMG_Load|LoadTexture\s*\(|LoadSound\s*\(|LoadFont\s*\(|stbi_load/i.test(
					fontes,
				)
			) {
				log(
					'aviso',
					'sem-arquivos',
					'Aviso: o programa abre arquivos do disco, mas nenhum pacote de assets (.data) veio no ' +
						'build. No navegador o sistema de arquivos começa vazio: as texturas/sons/fontes vão ' +
						'falhar. Recompile com --preload-file para gerar o .data.',
				);
			}

			if (
				/\bsleep\s*\(|\busleep\s*\(|nanosleep|Thread\.Sleep|this_thread::sleep|time\.sleep/.test(
					fontes,
				)
			) {
				log(
					'aviso',
					'sleep-nao-pausa',
					'Aviso: pausas de tempo (sleep) nao pausam de verdade neste preview - o relogio e ' +
						'reportado como ja vencido. O programa vai parecer mais rapido que no desktop, e ' +
						'animacoes feitas com sleep saem instantaneas.',
				);
			}
			if (
				/pthread_create|std::thread|#include\s*<thread>|omp\s+parallel|threading\.Thread/.test(
					fontes,
				)
			) {
				const isolada =
					typeof SharedArrayBuffer !== 'undefined' &&
					typeof self !== 'undefined' &&
					self.crossOriginIsolated === true;
				if (!isolada) {
					log(
						'aviso',
						'sem-threads',
						'Aviso: o projeto parece usar threads, mas esta pagina nao esta isolada (faltam os cabecalhos COOP/COEP), entao SharedArrayBuffer nao esta disponivel. As threads podem falhar ou rodar em sequencia.',
					);
				}
			}
		}

		function servirModuloWeb(pacote) {
			if (!painel) {
				log(
					'erro',
					'sem-painel',
					'O modulo web precisa do painel de preview (iframe) para rodar, e ele nao foi montado.',
				);
				return terminar('sem-painel', { plano: plano, motivo: 'modulo web sem frame' });
			}

			const tamWasm = pacote.wasm
				? pacote.wasm.tamanho < 1024
					? pacote.wasm.tamanho + ' B'
					: Math.round((pacote.wasm.tamanho / 1024) * 10) / 10 + ' KB'
				: 'sem .wasm (build asm.js)';
			log(
				'info',
				'modulo-web',
				'Build web pronto no projeto: ' +
					pacote.js.caminho +
					(pacote.wasm ? ` + ${pacote.wasm.caminho} (${tamWasm})` : ` (${tamWasm})`) +
					(pacote.dados ? ' + ' + pacote.dados.nome : '') +
					'. Nao vou baixar compilador nenhum: da para servir o preview agora.',
			);
			for (let i = 0; i < (pacote.avisos || []).length; i++)
				log('aviso', 'bundle', pacote.avisos[i]);

			avisarBuildAntigo();
			avisarInterferencias(!!pacote.dados);

			painel.estado((op.rotulos && op.rotulos.iniciando) || 'Iniciando modulo...');
			const t0 = Date.now();
			let fechado = false;
			let relogio = null;
			let quadros = 0;
			let prontoEm = null;
			let fimEm = null;

			return new Promise(function (resolve) {
				function fechar(res) {
					if (fechado) return;
					fechado = true;
					if (relogio) {
						clearTimeout(relogio);
						relogio = null;
					}
					resolve(res);
				}

				painel.aoMensagem = function (m) {
					if (m.tipo === 'quadros') {
						quadros = m.total || 0;
						return;
					}
					if (m.tipo === 'modulo-pronto') {
						prontoEm = m.ms;
						if (relogio) {
							clearTimeout(relogio);
							relogio = null;
						}
						log(
							'info',
							'modulo-pronto',
							`Modulo iniciado em ${m.ms}ms. O preview esta rodando dentro da pagina.`,
						);
						setTimeout(function () {
							if (quadros > 0) {
								log('info', 'desenhando', `Preview desenhando: ${quadros} quadros contados.`);
								if (painel && fimEm === null)
									painel.estado((op.rotulos && op.rotulos.rodando) || 'Rodando');
							} else {
								log(
									'aviso',
									'sem-quadros',
									'O modulo iniciou mas nao desenhou nenhum quadro nos primeiros 900ms. Isso pode ser ' +
										'carga de assets, espera por entrada, ou desenho unico -- nao e necessariamente erro. Se ' +
										'ele comecar a desenhar, a barra do preview passa a mostrar a taxa de quadros sozinha; ' +
										'se a tela ficar preta, e sinal de que o programa esta parado esperando algo.',
								);
							}
							fechar({
								ok: true,
								etapa: 'rodando',
								plano: plano,
								tipo: 'modulo-web',
								ms: Date.now() - t0,
								quadros: quadros,
								logs: logs,
							});
						}, 900);
						return;
					}
					if (m.tipo === 'modulo-erro') {
						log('erro', 'modulo-falhou', 'O modulo web nao subiu: ' + m.texto);
						if (painel)
							painel.estado((op.rotulos && op.rotulos.estFalhouInicio) || 'Falhou ao iniciar');
						fechar({
							ok: false,
							etapa: 'modulo-falhou',
							plano: plano,
							motivo: m.texto,
							logs: logs,
						});
						return;
					}
					if (m.tipo === 'modulo-fim') {
						log('info', 'fim-codigo', `O programa encerrou sozinho com codigo ${m.codigo}.`);
						fimEm = Date.now() - t0;
						if (prontoEm === null) {
							if (painel) painel.estado((op.rotulos && op.rotulos.fim) || 'Programa encerrado');
							fechar({
								ok: m.codigo === 0,
								etapa: 'fim',
								plano: plano,
								tipo: 'modulo-web',
								codigo: m.codigo,
								ms: Date.now() - t0,
								quadros: quadros,
								logs: logs,
							});
						}
					}
				};

				painel.modulo({
					js: pacote.js.conteudo,
					nomeJs: pacote.js.caminho,
					wasm: pacote.wasm ? pacote.wasm.bytes : null,
					dados: pacote.dados ? pacote.dados.bytes : null,
					nomeDados: pacote.dados ? pacote.dados.nome : null,
					esm: !!pacote.esm,
					args: op.args || [],
				});

				const teto =
					typeof op.limiteInicioMs === 'number' && op.limiteInicioMs > 0
						? op.limiteInicioMs
						: 20000;
				relogio = setTimeout(function () {
					log(
						'erro',
						'modulo-travado',
						`O modulo nao terminou de iniciar em ${teto}ms. Isso costuma ser laco bloqueante (while(1) sem \
emscripten_set_main_loop), arquivo .wasm trocado/corrompido, ou build que espera rede. Nada mais vai \
acontecer sozinho.`,
					);
					if (painel) {
						painel.erro(`O modulo nao respondeu em ${teto}ms.`, 'Travou');
					}
					fechar({
						ok: false,
						etapa: 'modulo-travado',
						plano: plano,
						motivo: 'onRuntimeInitialized nunca chegou',
						logs: logs,
					});
				}, teto);
			});
		}

		function avisarBuildAntigo() {
			const lista = op.arquivos || [];
			const editadas = [];
			for (let i = 0; i < lista.length && editadas.length < 3; i++) {
				const a = lista[i];
				if (!a || !a.editado) continue;
				const c = String(a.caminho || a.path || '');
				if (EXT_FONTE.test(c)) editadas.push(c);
			}
			if (!editadas.length) return;
			log(
				'aviso',
				'build-antigo',
				`Atencao: este preview e o build web que ja estava na pasta do projeto, e voce editou ${editadas.join(', ')} \
nesta sessao. O codigo novo NAO esta nesse build -- rode o emcc de novo (ou use o Relay) para ver sua \
mudanca na tela.`,
			);
		}

		function textoDasFontes(lista) {
			let t = '';
			try {
				const arr = DET && typeof DET.normalizar === 'function' ? DET.normalizar(lista || []) : [];
				for (let i = 0; i < arr.length; i++) {
					const a = arr[i] || {};
					const c = a.conteudo != null ? a.conteudo : a.content != null ? a.content : '';
					t += '\n' + String(c);
				}
			} catch (e) {
				ignorarErro(e, 'textoDasFontes');
			}
			return t;
		}

		function terminar(etapa, extra) {
			const res = { ok: false, etapa: etapa, logs: logs };
			for (let k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) res[k] = extra[k];
			if (painel) painel.soltar();
			return Promise.resolve(res);
		}

		if (!DET) return terminar('dependencia', { motivo: 'deteccao.js nao carregado' });
		if (!SHELL) return terminar('dependencia', { motivo: 'shell-preview.js nao carregado' });

		var plano;
		try {
			plano = DET.detectar(op.arquivos || []);
		} catch (e) {
			return terminar('deteccao', { motivo: String((e && e.message) || e) });
		}

		if (op.frame) {
			const modo = plano.gui || plano.nivel >= 2 ? 'misto' : 'console';
			if (painelVivo) {
				try {
					painelVivo.soltar();
				} catch (e) {
					ignorarErro(e, 'autoPreview');
				}
				painelVivo = null;
			}
			try {
				op.frame.srcdoc = SHELL.montar({
					titulo: plano.entrada || 'Preview',
					modo: modo,
					interativo: op.interativo !== false,
					rotulos: op.rotulos || {},
				});
				painel = new Painel(op.frame);
				painelVivo = painel;
				if (typeof op.aoEntrada === 'function') painel.aoEntrada = op.aoEntrada;
			} catch (e) {
				painel = null;
			}
		}

		log(
			'info',
			'detectado',
			'Projeto detectado: ' +
				plano.tipo +
				' - ' +
				nomeNivel(plano.nivel) +
				(plano.entrada ? ' - entrada: ' + plano.entrada : '') +
				(plano.motivo ? ` (${plano.motivo})` : ''),
		);

		for (var a = 0; a < (plano.avisos || []).length; a++) {
			log('aviso', 'detector', plano.avisos[a]);
		}

		const amb = ambiente();
		for (let b = 0; b < amb.problemas.length; b++) {
			const pr = amb.problemas[b];
			log(pr.nivel, pr.codigo, pr.texto);
		}
		if (!amb.ok) {
			if (painel)
				painel.estado((op.rotulos && op.rotulos.estIncompativel) || 'Ambiente incompativel');
			return terminar('ambiente', { plano: plano, motivo: 'ambiente sem suporte a WebAssembly' });
		}

		if (plano.nivel === 0) {
			log(
				'erro',
				'nivel-0',
				`Este projeto nao tem como rodar dentro do navegador${plano.libs && plano.libs.length ? ' porque usa ' + plano.libs.join(' / ') : ''}. \
O preview foi cancelado (nada foi compilado).`,
			);
			if (painel)
				painel.estado((op.rotulos && op.rotulos.estNaoExecutavel) || 'Nao executavel no navegador');
			return terminar('nivel-0', {
				plano: plano,
				motivo: 'projeto depende de recurso nativo do sistema',
			});
		}
		if (plano.nivel >= 2) {
			var pacote = null;
			try {
				pacote = BUNDLE ? BUNDLE.achar(op.arquivos || []) : null;
			} catch (e) {
				pacote = null;
			}

			if (pacote && pacote.faltando === 'bytes-do-wasm') {
				log(
					'aviso',
					'bundle-sem-bytes',
					`Achei um build web pronto em ${pacote.base} mas os bytes do .wasm nao chegaram na importacao. \
Reimporte a pasta inteira (arrastando a pasta, nao os arquivos de texto) para o preview poder executar.`,
				);
				pacote = null;
			} else if (pacote && pacote.faltando === 'wasm-vazio') {
				log(
					'erro',
					'wasm-invalido',
					`Achei o build web em ${pacote.base} mas o .wasm tem 0 byte. Isso e build interrompido no meio: rode o emcc de novo ate o fim. Nao vou tentar executar binario vazio.`,
				);
				pacote = null;
			} else if (pacote && pacote.faltando === 'wasm-corrompido') {
				log(
					'erro',
					'wasm-invalido',
					`Achei o build web em ${pacote.base} mas o .wasm nao comeca com a assinatura de WebAssembly. Arquivo corrompido, truncado, ou outro formato com nome .wasm. Nao vou executar.`,
				);
				pacote = null;
			}
			if (pacote && pacote.wasm && typeof WebAssembly !== 'undefined' && WebAssembly.validate) {
				let okWasm = true;
				try {
					okWasm = !!WebAssembly.validate(pacote.wasm.bytes);
				} catch (e) {
					okWasm = false;
				}
				if (!okWasm)
					log(
						'aviso',
						'wasm-invalido',
						`O WebAssembly.validate recusou ${pacote.wasm.caminho} neste navegador (assinatura certa, estrutura nao). Vou tentar rodar; se falhar, o erro do modulo aparece abaixo.`,
					);
			}
			if (pacote) return servirModuloWeb(pacote);

			if (!adaptadores[plano.toolchain]) {
				log(
					'aviso',
					'nivel-2',
					`Este projeto e de nivel 2 (${plano.toolchain || 'toolchain externo'}): compilar aqui dentro exige \
um toolchain que ainda nao esta no catalogo. Duas saidas: (1) rode o build web uma vez (emcc / dotnet \
publish) e importe o projeto COM a pasta do build -- ai o preview roda na hora, sem baixar nada; ou \
(2) use o Relay local ou build na nuvem.`,
				);
				if (painel)
					painel.estado(
						(op.rotulos && op.rotulos.estPrecisaBuild) || 'Precisa de build web ou Relay',
					);
				return terminar('nivel-2', { plano: plano, motivo: 'toolchain nao roda no navegador' });
			}

			log(
				'info',
				'nivel-2-compilar',
				`Projeto de nivel 2 com adaptador registrado (${plano.toolchain}): vou compilar para web e servir em canvas.`,
			);
		}

		if (plano.toolchain === 'nativo') {
			log(
				'info',
				'nativo',
				'Projeto web: roda direto no navegador, sem compilacao. Usando o preview nativo do site.',
			);
			if (painel) {
				painel.estado((op.rotulos && op.rotulos.estNativo) || 'Preview nativo');
				painel.soltar();
			}
			return Promise.resolve({ ok: true, etapa: 'nativo', plano: plano, logs: logs });
		}

		if (!MOTOR)
			return terminar('dependencia', { plano: plano, motivo: 'toolchains.js nao carregado' });
		if (CAT && typeof CAT.registrarTudo === 'function') {
			try {
				var reg = CAT.registrarTudo(MOTOR);
				if (reg && reg.pendentes && reg.pendentes.length) {
					log(
						'aviso',
						'catalogo-pendente',
						`Toolchains sem URL preenchida no catalogo: ${reg.pendentes.join(', ')}. Enquanto isso, o preview compilado fica indisponivel.`,
					);
				}
			} catch (e) {
				log('aviso', 'catalogo', 'Falha ao registrar o catalogo: ' + String((e && e.message) || e));
			}
		}

		const def = MOTOR.obter(plano.toolchain);
		if (!def) {
			log(
				'erro',
				'sem-toolchain',
				`O toolchain "${plano.toolchain}" nao esta configurado (falta a URL de download no catalogo). Nada foi compilado. Preencha catalogo.js seguindo VERIFICAR.md.`,
			);
			if (painel)
				painel.estado((op.rotulos && op.rotulos.estSemToolchain) || 'Toolchain nao configurado');
			return terminar('sem-toolchain', { plano: plano, motivo: 'toolchain ausente no registro' });
		}

		const adaptador = adaptadores[plano.toolchain];
		if (!adaptador) {
			log(
				'erro',
				'sem-adaptador',
				`Existe toolchain registrado para "${plano.toolchain}", mas nenhum adaptador de compilacao. Registre um com registrarAdaptador("${plano.toolchain}", fn).`,
			);
			if (painel)
				painel.estado((op.rotulos && op.rotulos.estSemAdaptador) || 'Sem adaptador de compilacao');
			return terminar('sem-adaptador', {
				plano: plano,
				motivo: 'adaptador de compilacao nao registrado',
			});
		}

		cancelador = typeof AbortController === 'function' ? new AbortController() : null;
		const limiteMs =
			typeof op.limiteMs === 'number' && op.limiteMs > 0 ? op.limiteMs : LIMITE_PADRAO_MS;

		if (painel)
			painel.estado((op.rotulos && op.rotulos.estPreparando) || 'Preparando o compilador...');

		return MOTOR.estaEmCache(def)
			.then(function (temCache) {
				if (!temCache) {
					let mb = 0;
					for (let i = 0; i < def.recursos.length; i++) mb += def.recursos[i].bytes || 0;
					log(
						'info',
						'baixando',
						'Primeira compilacao neste dispositivo: baixando o compilador' +
							(mb ? ` (~${Math.round(mb / 1048576)} MB)` : '') +
							'. Nas proximas vezes ele vem do cache.',
					);
				}
				return MOTOR.carregar(def, {
					sinal: cancelador ? cancelador.signal : null,
					aoProgresso: function (p) {
						if (!painel) return;
						if (p.fase === 'baixando') {
							painel.progresso(
								p.pct,
								`Baixando compilador ${p.pct}% (${Math.round(p.carregado / 1048576)}/${Math.round(p.total / 1048576)} MB)`,
							);
						} else if (p.fase === 'verificando') {
							painel.progresso(p.pct, 'Verificando integridade...');
						} else if (p.fase === 'cache') {
							painel.progresso(p.pct, 'Lendo do cache do dispositivo...');
						}
					},
				});
			})
			.then(function (tc) {
				log(
					'info',
					'toolchain-pronto',
					`Compilador pronto em ${tc.ms}ms${tc.doCache ? ' (cache do dispositivo)' : ' (baixado agora)'}`,
				);

				if (!tc.doCache) {
					MOTOR.estaEmCache(def)
						.then(function (guardou) {
							if (!guardou) {
								log(
									'aviso',
									'cache-falhou',
									'Nao foi possivel guardar o compilador no dispositivo (espaco cheio ou janela privada). ' +
										'Ele sera baixado de novo na proxima vez.',
								);
							}
						})
						['catch'](function () {});
				}

				if (painel) {
					painel.progresso(null, (op.rotulos && op.rotulos.estCompilando) || 'Compilando...');
					painel.estado((op.rotulos && op.rotulos.estCompilando) || 'Compilando...');
				}
				return Promise.resolve()
					.then(function () {
						return adaptador({
							arquivos: op.arquivos || [],
							plano: plano,
							toolchain: tc,
							aoLog: log,
						});
					})
					['catch'](function (e) {
						const err = new Error(String((e && e.message) || e));
						err.deCompilacao = true;
						throw err;
					});
			})
			.then(function (saidaComp) {
				if (painel) painel.progresso(null, '');
				if (!saidaComp || (!saidaComp.wasm && !saidaComp.js)) {
					log('erro', 'compilacao-vazia', 'O adaptador nao devolveu binario .wasm nem glue .js.');
					if (painel)
						painel.estado((op.rotulos && op.rotulos.estFalhaCompilacao) || 'Falha na compilacao');
					return terminar('compilacao', { plano: plano, motivo: 'adaptador nao devolveu wasm' });
				}
				for (let i = 0; i < (saidaComp.avisos || []).length; i++) {
					log('aviso', 'compilador', saidaComp.avisos[i]);
				}

				if (saidaComp.js) {
					return servirModuloWeb({
						tipo: 'emscripten',
						base: '(compilado agora)',
						js: {
							caminho: saidaComp.nomeJs || 'modulo.js',
							conteudo: saidaComp.js,
							tamanho: String(saidaComp.js).length,
						},
						wasm: saidaComp.wasm
							? {
									caminho: 'modulo.wasm',
									bytes: saidaComp.wasm,
									tamanho: saidaComp.wasm.byteLength || saidaComp.wasm.length || 0,
								}
							: null,
						dados: saidaComp.dados
							? { caminho: 'modulo.data', nome: 'modulo.data', bytes: saidaComp.dados }
							: null,
						html: null,
						esm: !!saidaComp.esm,
						faltando: null,
						avisos: [],
					});
				}

				if (!WebAssembly.validate(saidaComp.wasm)) {
					log('erro', 'wasm-invalido', 'O binario gerado nao e um WebAssembly valido.');
					if (painel)
						painel.estado((op.rotulos && op.rotulos.estBinarioInvalido) || 'Binario invalido');
					return terminar('wasm-invalido', { plano: plano, motivo: 'wasm invalido' });
				}

				log('info', 'executando', 'Compilado. Executando o preview...');

				const fontes = textoDasFontes(op.arquivos);
				if (
					/\bsleep\s*\(|\busleep\s*\(|nanosleep|Thread\.Sleep|this_thread::sleep|time\.sleep/.test(
						fontes,
					)
				) {
					log(
						'aviso',
						'sleep-nao-pausa',
						'Aviso: pausas de tempo (sleep) nao pausam de verdade neste preview - o relogio e ' +
							'reportado como ja vencido. O programa vai parecer mais rapido que no desktop, e ' +
							'animacoes feitas com sleep saem instantaneas.',
					);
				}
				if (
					/pthread_create|std::thread|#include\s*<thread>|new Thread\s*\(|omp\s+parallel|threading\.Thread/.test(
						fontes,
					)
				) {
					const isolada =
						typeof SharedArrayBuffer !== 'undefined' &&
						typeof self !== 'undefined' &&
						self.crossOriginIsolated === true;
					if (!isolada) {
						log(
							'aviso',
							'sem-threads',
							'Aviso: o projeto parece usar threads, mas esta pagina nao esta isolada (faltam os cabecalhos COOP/COEP), entao SharedArrayBuffer nao esta disponivel. As threads podem falhar ou rodar em sequencia.',
						);
					}
				}
				if (painel) {
					painel.sistema('--- saida do programa ---');
					painel.estado((op.rotulos && op.rotulos.estExecutando) || 'Executando...');
				}

				const opRun = {
					args: op.args || [plano.entrada || 'programa'],
					env: op.env || {},
					stdin: op.stdin || '',
					limiteMs: limiteMs,
					aoSaida: function (fluxo, texto) {
						if (painel) painel.saida(fluxo, texto);
						if (typeof op.aoSaida === 'function') op.aoSaida(fluxo, texto);
					},
				};

				let promessa = rodarEmWorker(saidaComp.wasm, opRun);
				if (!promessa) {
					log('aviso', 'sem-worker-run', 'Rodando na thread da pagina (sem Worker disponivel).');
					promessa = rodarNaPagina(saidaComp.wasm, opRun);
				}

				return promessa.then(function (r) {
					if (r.erro) {
						if (r.erro === 'tempo') {
							log(
								'erro',
								'tempo',
								r.texto +
									' Provavelmente ha um laco infinito ou espera por entrada que nao chegou.',
							);
						} else {
							log('erro', r.erro, 'O programa terminou com falha: ' + r.texto);
						}
						if (painel)
							painel.erro(r.texto, r.erro === 'tempo' ? 'Tempo esgotado' : 'Falha na execucao');
						if (painel) painel.soltar();
						return { ok: false, etapa: 'execucao', plano: plano, motivo: r.texto, logs: logs };
					}
					if (painel) painel.fim(r.codigo, r.ms);
					if (r.codigo === 0)
						log('info', 'fim', `Preview servido. Programa encerrou com codigo 0 em ${r.ms}ms.`);
					else log('aviso', 'fim-codigo', `Programa encerrou com codigo ${r.codigo} em ${r.ms}ms.`);
					if (painel) painel.soltar();
					return {
						ok: true,
						etapa: 'pronto',
						plano: plano,
						codigo: r.codigo,
						ms: r.ms,
						logs: logs,
					};
				});
			})
			['catch'](function (e) {
				const msg = String((e && e.message) || e);
				if (e && e.cancelado) {
					log('aviso', 'cancelado', 'Compilacao cancelada.');
					if (painel) painel.estado((op.rotulos && op.rotulos.estCancelado) || 'Cancelado');
					return terminar('cancelado', { plano: plano, motivo: 'cancelado pelo usuario' });
				}
				if (e && e.deCompilacao) {
					log('erro', 'compilacao', 'O compilador recusou o codigo: ' + msg);
					if (painel)
						painel.estado((op.rotulos && op.rotulos.estErroCompilacao) || 'Erro de compilacao');
					return terminar('compilacao', { plano: plano, motivo: msg });
				}
				if (e && e.travou) {
					log('erro', 'cdn-travada', msg + ' Verifique a conexao ou troque o espelho no catalogo.');
				} else if (/Integridade falhou/i.test(msg)) {
					log(
						'erro',
						'integridade',
						msg +
							' O arquivo baixado nao confere com o hash do catalogo; foi descartado por seguranca.',
					);
				} else if (/espelhos falharam/i.test(msg)) {
					log('erro', 'download', 'Nao foi possivel baixar o compilador: ' + msg);
				} else {
					log('erro', 'inesperado', 'Erro inesperado: ' + msg);
				}
				if (painel) painel.estado((op.rotulos && op.rotulos.estFalhou) || 'Falhou');
				return terminar('erro', { plano: plano, motivo: msg });
			});
	}

	function preparar(arquivos) {
		const DET = dep('SYNAPSE_DETECCAO');
		if (!DET) return { erro: 'deteccao.js nao carregado' };
		const plano = DET.detectar(arquivos || []);
		return { plano: plano, ambiente: ambiente(), nivelTexto: nomeNivel(plano.nivel) };
	}

	return {
		autoPreview: autoPreview,
		preparar: preparar,
		ambiente: ambiente,
		cancelar: cancelar,
		registrarAdaptador: registrarAdaptador,
		adaptadores: adaptadores,
		Painel: Painel,
	};
});
