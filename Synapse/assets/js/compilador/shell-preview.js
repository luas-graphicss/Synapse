(function (raiz, fabrica) {
	'use strict';
	const api = fabrica();
	if (typeof module === 'object' && module && module.exports) module.exports = api;
	else raiz.SYNAPSE_SHELL = api;
})(typeof self !== 'undefined' ? self : this, function () {
	'use strict';

	function esc(s) {
		return String(s == null ? '' : s)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	function jsStr(v) {
		return JSON.stringify(v === undefined ? null : v).replace(/</g, '\\u003c');
	}

	function semFecharScript(codigo) {
		return String(codigo).replace(/<\/(script)/gi, '<\\/$1');
	}

	function corpoIframe(CFG) {
		const ROT = CFG.rot;
		const MAX_NOS = 1200;
		const MAX_CHARS_NO = 4000;

		const con = document.getElementById('console');
		let vazio = document.getElementById('vazio');
		const luz = document.getElementById('luz');
		const est = document.getElementById('estado');
		const prog = document.getElementById('prog');
		const progBarra = document.getElementById('progBarra');
		const progTxt = document.getElementById('progTxt');
		const stdin = document.getElementById('stdin');

		let trunc = null;
		let ultimo = null;
		let ultimaClasse = '';
		let ultimoLen = 0;

		function podar() {
			if (!trunc) {
				trunc = document.createElement('div');
				trunc.id = 'trunc';
				trunc.className = 'l-sis';
				trunc.textContent = ROT.truncado;
				con.insertBefore(trunc, con.firstChild);
			}
			while (con.childNodes.length > MAX_NOS) {
				const alvo = trunc.nextSibling;
				if (!alvo) break;
				con.removeChild(alvo);
			}
			if (ultimo && ultimo.parentNode !== con) {
				ultimo = null;
				ultimaClasse = '';
				ultimoLen = 0;
			}
		}

		function escreve(txt, cls) {
			if (txt == null || txt === '') return;
			if (vazio && vazio.parentNode) {
				vazio.parentNode.removeChild(vazio);
				vazio = null;
			}
			if (cls === 'l-err') con.className = 'temErro';

			if (
				ultimo &&
				ultimaClasse === cls &&
				ultimo.parentNode === con &&
				ultimoLen + txt.length <= MAX_CHARS_NO
			) {
				ultimo.appendChild(document.createTextNode(txt));
				ultimoLen += txt.length;
			} else {
				const d = document.createElement('div');
				d.className = cls;
				d.appendChild(document.createTextNode(txt));
				con.appendChild(d);
				ultimo = d;
				ultimaClasse = cls;
				ultimoLen = txt.length;
			}

			if (con.childNodes.length > MAX_NOS) podar();
			con.scrollTop = con.scrollHeight;
		}

		function mostraProg(pct, texto) {
			prog.classList.add('on');
			if (pct === null || pct === undefined || isNaN(pct)) {
				prog.classList.add('indef');
				progBarra.style.width = '35%';
			} else {
				prog.classList.remove('indef');
				progBarra.style.width = Math.max(0, Math.min(100, pct)) + '%';
			}
			progTxt.textContent = texto || '';
		}
		function escondeProg() {
			prog.classList.remove('on');
			prog.classList.remove('indef');
		}

		function limpar() {
			while (con.firstChild) con.removeChild(con.firstChild);
			trunc = null;
			ultimo = null;
			ultimaClasse = '';
			ultimoLen = 0;
			con.className = '';
			vazio = document.createElement('div');
			vazio.id = 'vazio';
			vazio.textContent = ROT.esperando;
			con.appendChild(vazio);
			escondeProg();
		}

		const NL = String.fromCharCode(10);
		const mod = {
			pedido: false,
			pronto: false,
			fim: false,
			relogio: null,
			quadros: 0,
			t0: 0,
			urls: [],
		};

		function urlDeBytes(bytes, tipo) {
			const u = URL.createObjectURL(
				new Blob([bytes], { type: tipo || 'application/octet-stream' }),
			);
			mod.urls.push(u);
			return u;
		}

		function contarQuadros() {
			const orig = window.requestAnimationFrame;
			if (!orig) return;
			window.requestAnimationFrame = function (cb) {
				return orig.call(window, function (t) {
					mod.quadros++;
					return cb(t);
				});
			};
		}

		function vigiarQuadros() {
			let anterior = 0;
			let avisado = false;
			document.addEventListener(
				'visibilitychange',
				function () {
					if (!document.hidden) anterior = mod.quadros;
				},
				false,
			);
			mod.relogio = setInterval(function () {
				if (mod.fim) {
					clearInterval(mod.relogio);
					mod.relogio = null;
					return;
				}
				const fps = (mod.quadros - anterior) * 2;
				anterior = mod.quadros;
				parent.postMessage(
					{ tipo: 'quadros', total: mod.quadros, fps: fps, oculto: !!document.hidden },
					'*',
				);
				if (document.hidden) {
					avisado = false;
					return;
				}
				if (!mod.quadros) return;
				if (fps > 0) {
					avisado = false;
					if (luz.className !== 'erro') luz.className = 'ok';
					est.textContent = ROT.rodando + ' (' + fps + ' ' + ROT.quadros + ')';
				} else if (!avisado) {
					avisado = true;
					escreve(`[preview] ${ROT.parado}${NL}`, 'l-avi');
					est.textContent = ROT.parado;
				}
			}, 500);
		}

		function moduloPronto() {
			if (mod.pronto) return;
			mod.pronto = true;
			const ms = Date.now() - mod.t0;
			est.textContent = ROT.rodando;
			escreve(`[preview] modulo iniciado em ${ms}ms. ${ROT.clique}${NL}`, 'l-sis');
			parent.postMessage({ tipo: 'modulo-pronto', ms: ms }, '*');
			vigiarQuadros();
		}

		function moduloErro(texto) {
			mod.fim = true;
			escreve(`[preview] ${texto}${NL}`, 'l-err');
			luz.className = 'erro';
			est.textContent = ROT.erro;
			escondeProg();
			parent.postMessage({ tipo: 'modulo-erro', texto: texto }, '*');
		}

		function carregarModulo(m) {
			if (mod.pedido) {
				escreve('[preview] pedido de modulo repetido, ignorado' + NL, 'l-sis');
				return;
			}
			mod.pedido = true;
			mod.t0 = Date.now();
			est.textContent = ROT.iniciando;
			if (luz.className !== 'erro') luz.className = 'rodando';

			const tela = document.getElementById('tela2d');
			if (!tela) {
				moduloErro('o painel foi montado sem canvas, entao nao tem onde desenhar');
				return;
			}

			tela.style.imageRendering = 'auto';
			tela.setAttribute('tabindex', '0');
			tela.addEventListener(
				'webglcontextlost',
				function (ev) {
					ev.preventDefault();
					escreve(
						'[preview] o navegador perdeu o contexto WebGL (GPU ocupada ou aba em segundo plano)' +
							NL,
						'l-avi',
					);
				},
				false,
			);

			let bytesWasm = null;
			if (m.wasm) bytesWasm = m.wasm instanceof Uint8Array ? m.wasm : new Uint8Array(m.wasm);
			const urlDados = m.dados ? urlDeBytes(m.dados) : null;

			const cfg = {
				canvas: tela,
				arguments: m.args || [],
				wasmBinary: bytesWasm,
				print: function (t) {
					escreve(t + NL, 'l-out');
				},
				printErr: function (t) {
					escreve(t + NL, 'l-err');
				},
				setStatus: function (t) {
					if (t) est.textContent = t;
				},
				monitorRunDependencies: function () {},
				locateFile: function (p) {
					const s = String(p || '');
					if (urlDados && m.nomeDados && s.includes(m.nomeDados)) return urlDados;
					if (urlDados && s.includes('.data')) return urlDados;
					if (bytesWasm && /\.wasm$/.test(s)) return urlDeBytes(bytesWasm, 'application/wasm');
					return s;
				},
				onRuntimeInitialized: function () {
					moduloPronto();
				},
				onAbort: function (razao) {
					moduloErro('o modulo abortou: ' + (razao || 'motivo nao informado'));
				},
				onExit: function (c) {
					const cod = c | 0;
					mod.fim = true;
					luz.className = cod === 0 ? 'ok' : 'erro';
					est.textContent = ROT.fim + ' (' + ROT.codigo + ' ' + cod + ')';
					parent.postMessage({ tipo: 'modulo-fim', codigo: cod }, '*');
				},
			};
			window.Module = cfg;
			contarQuadros();

			if (m.esm) {
				const uMod = urlDeBytes(m.js, 'text/javascript');
				const sm = document.createElement('script');
				sm.type = 'module';
				sm.textContent = `import(${JSON.stringify(uMod)}).then(function(mo){var f = mo && (mo.default || \
mo.Module);if (typeof f === "function") return f(window.Module);parent.postMessage({tipo:"modulo-erro", \
texto:"o glue e um modulo ES mas nao exporta fabrica (export default): nao ha o que chamar"}, "*");}\
).catch(function(e){ parent.postMessage({tipo:"modulo-erro", texto:"o modulo ES nao carregou: " + ((e&&e.message)||e)}\
, "*"); });`;
				document.body.appendChild(sm);
				return;
			}

			const sc = document.createElement('script');
			sc.src = urlDeBytes(m.js, 'text/javascript');
			sc.onerror = function () {
				moduloErro('o navegador nao conseguiu carregar ' + (m.nomeJs || 'o glue do modulo'));
			};
			sc.onload = function () {
				try {
					if (typeof window.Module === 'function') {
						const p = window.Module(cfg);
						if (p && typeof p.then === 'function') {
							p.then(
								function () {},
								function (e) {
									moduloErro('a fabrica do modulo rejeitou: ' + ((e && e.message) || e));
								},
							);
						}
					}
				} catch (e) {
					moduloErro('a fabrica do modulo estourou: ' + ((e && e.message) || e));
				}
			};
			document.body.appendChild(sc);
		}

		window.addEventListener('message', function (ev) {
			const m = (ev && ev.data) || {};
			if (!m || !m.tipo) return;

			if (m.tipo === 'ping') {
				parent.postMessage({ tipo: 'pronto' }, '*');
				return;
			}
			if (m.tipo === 'modulo') {
				carregarModulo(m);
				return;
			}
			if (m.tipo === 'saida') {
				escreve(m.texto, m.fluxo === 'err' ? 'l-err' : 'l-out');
			} else if (m.tipo === 'aviso') {
				escreve(m.texto, 'l-avi');
			} else if (m.tipo === 'sistema') {
				escreve(m.texto, 'l-sis');
			} else if (m.tipo === 'estado') {
				est.textContent = m.texto;
				if (luz.className !== 'erro' && luz.className !== 'ok') luz.className = 'rodando';
			} else if (m.tipo === 'progresso') {
				mostraProg(m.pct, m.texto);
			} else if (m.tipo === 'limpar') {
				limpar();
			} else if (m.tipo === 'erro') {
				escreve(m.texto, 'l-err');
				luz.className = 'erro';
				est.textContent = m.rotulo || 'Erro';
				escondeProg();
			} else if (m.tipo === 'fim') {
				luz.className = m.codigo === 0 ? 'ok' : 'erro';
				est.textContent = ROT.fim + ' (' + ROT.codigo + ' ' + m.codigo + ', ' + m.ms + 'ms)';
				escondeProg();
			}
		});

		window.addEventListener('error', function (ev) {
			const msg = (ev && ev.message) || 'falha desconhecida';
			escreve(`[erro no preview] ${msg}${NL}`, 'l-err');
			luz.className = 'erro';
			if (mod.pedido && !mod.pronto) {
				parent.postMessage(
					{ tipo: 'modulo-erro', texto: 'erro ao avaliar o glue do modulo: ' + msg },
					'*',
				);
			}
		});

		if (stdin) {
			stdin.addEventListener('keydown', function (ev) {
				if (ev.key !== 'Enter') return;
				const t = stdin.value;
				stdin.value = '';
				escreve(t + '\n', 'l-sis');
				parent.postMessage({ tipo: 'entrada', texto: t + '\n' }, '*');
			});
		}

		parent.postMessage({ tipo: 'pronto' }, '*');
	}

	function montar(op) {
		op = op || {};
		const modo = op.modo === 'canvas' || op.modo === 'misto' ? op.modo : 'console';
		const titulo = op.titulo || 'Preview';
		const interativo = !!op.interativo;
		const r = op.rotulos || {};
		const rot = {
			esperando: r.esperando || 'Aguardando...',
			saida: r.saida || 'Saída do programa',
			entrada: r.entrada || 'Digite e pressione Enter',
			fim: r.fim || 'Programa encerrado',
			codigo: r.codigo || 'código',
			truncado: r.truncado || 'Saída antiga removida para não travar o navegador.',
			rodando: r.rodando || 'Rodando',
			quadros: r.quadros || 'quadros/s',
			clique: r.clique || 'Clique no preview para o teclado e o mouse funcionarem.',
			parado: r.parado || 'O programa parou de desenhar.',
			iniciando: r.iniciando || 'Iniciando módulo...',
			erro: r.erro || 'Erro',
		};

		const mostraCanvas = modo === 'canvas' || modo === 'misto';

		const flexConsole = mostraCanvas ? 'flex:0 0 34%' : 'flex:1 1 auto';
		const extraConsole = mostraCanvas ? ';min-height:64px;border-top:1px solid #1e2530' : '';

		const css = [
			'*{box-sizing:border-box}',
			'html,body{margin:0;height:100%;background:#0b0e13;color:#d7dee8;font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}',
			'#raiz{display:flex;flex-direction:column;height:100%}',
			'#barra{flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:6px 10px;background:#11161f;border-bottom:1px solid #1e2530}',
			'#luz{width:9px;height:9px;border-radius:50%;background:#4b5563;flex:0 0 auto}',
			'#luz.rodando{background:#f5b544;animation:pulsa 1s infinite}',
			'#luz.ok{background:#38d17a}',
			'#luz.erro{background:#ef5f5f}',
			'@keyframes pulsa{0%,100%{opacity:1}50%{opacity:.35}}',
			'#titulo{font-weight:600;color:#9fb0c6}',
			'#estado{margin-left:auto;color:#7f8fa4;font-size:12px}',
			'#prog{display:none;flex:0 0 auto;align-items:center;gap:8px;padding:5px 10px;background:#0e131b;border-bottom:1px solid #1e2530}',
			'#prog.on{display:flex}',
			'#trilha{flex:1 1 auto;height:5px;border-radius:3px;background:#1c2432;overflow:hidden}',
			'#progBarra{height:100%;width:0%;background:linear-gradient(90deg,#3b82f6,#38d17a);transition:width .18s ease}',
			'#prog.indef #progBarra{animation:desliza 1.1s infinite linear}',
			'@keyframes desliza{0%{margin-left:-35%}100%{margin-left:100%}}',
			'#progTxt{flex:0 0 auto;font-size:11px;color:#7f8fa4;min-width:90px;text-align:right}',
			'#tela{flex:1 1 auto;display:flex;flex-direction:column;min-height:0}',
			`#canvasBox{${mostraCanvas ? 'flex:1 1 auto;display:flex' : 'display:none'};align-items:center;justify-content:center;background:#05070a;min-height:0;overflow:hidden}`,
			'#tela2d{max-width:100%;max-height:100%;background:#000;image-rendering:pixelated}',
			`#console{${flexConsole};display:block;overflow:auto;padding:8px 10px;white-space:pre-wrap;word-break:break-word;min-height:0${extraConsole}}`,
			'#console.temErro{border-left:3px solid #ef5f5f}',
			'#vazio{color:#5b6879;font-style:italic}',
			'.l-out{color:#d7dee8}',
			'.l-err{color:#ff8f8f}',
			'.l-sis{color:#6f7f95}',
			'.l-avi{color:#f5b544}',
			`#linha{${interativo ? 'display:flex' : 'display:none'};flex:0 0 auto;gap:6px;padding:6px 10px;background:#11161f;border-top:1px solid #1e2530}`,
			'#stdin{flex:1 1 auto;background:#0b0e13;border:1px solid #223046;border-radius:5px;color:#d7dee8;padding:5px 8px;font:inherit}',
			'#stdin:focus{outline:none;border-color:#3b82f6}',
		].join('');

		const corpo = `var CFG = ${jsStr({ rot: rot, modo: modo, interativo: interativo })};\n(${semFecharScript(String(corpoIframe))})(CFG);`;

		return [
			'<!doctype html>',
			'<html lang="pt-BR"><head><meta charset="utf-8">',
			'<meta name="viewport" content="width=device-width,initial-scale=1">',
			`<title>${esc(titulo)}</title>`,
			`<style>${css}</style>`,
			'</head><body>',
			'<div id="raiz">',
			`<div id="barra"><span id="luz"></span><span id="titulo">${esc(titulo)}</span><span id="estado">${esc(rot.esperando)}</span></div>`,
			'<div id="prog"><div id="trilha"><div id="progBarra"></div></div><span id="progTxt"></span></div>',
			'<div id="tela">',
			'<div id="canvasBox"><canvas id="tela2d" width="640" height="480"></canvas></div>',
			`<div id="console" role="log" aria-live="polite" aria-label="${esc(rot.saida)}"><div id="vazio">${esc(rot.esperando)}</div></div>`,
			'</div>',
			`<div id="linha"><input id="stdin" type="text" autocomplete="off" placeholder="${esc(rot.entrada)}" aria-label="${esc(rot.entrada)}"></div>`,
			'</div>',
			`<script>${corpo}</script>`,
			'</body></html>',
		].join('');
	}

	return { montar: montar, esc: esc };
});
