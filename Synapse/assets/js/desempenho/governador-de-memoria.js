(function () {
	'use strict';
	if (window.__MEM_V10) return;
	window.__MEM_V10 = true;

	const PM = window.SYNAPSE_MEM || null;
	const POUCA_RAM = (function () {
		try {
			const d = navigator.deviceMemory;
			return typeof d === 'number' && d > 0 && d <= 4;
		} catch (e) {
			return false;
		}
	})();
	const CH = (function () {
		try {
			return navigator.hardwareConcurrency || 4;
		} catch (e) {
			return 4;
		}
	})();

	const M = {
		ver: '10.0.0',
		alvoMB: 400,
		tetoMB: 620,
		grandeArq: 400,
		histMax: 3,
		histMaxGrande: 1,
		histAberto: 6,
		snapMax: 2,
		snapMaxGrande: 1,
		logMax: 120,
		logLinha: 600,
		mcpLogMax: 200,
		treeMax: 300,
		treeMaxLeve: 180,
		headlessMax: 1,
		headlessIdle: 35000,
		headlessW: 1024,
		headlessH: 576,
		ocultoMs: 20000,
		descarregarOculto: true,
		pausarBuildOculto: true,
		burstJanela: 1500,
		burstLimite: 6,
		burstBuildMs: 2500,
		bigChars: 150000,
		bigLines: 4000,
		bigCharsLeve: 60000,
		bigLinesLeve: 2000,
		saveMinMs: 20000,
		leve: false,
		burst: false,
		savesEvitados: 0,
		buildsAdiados: 0,
		headlessMortos: 0,
		ciclos: 0,
	};
	window.SYNAPSE_MEM10 = M;

	function est() {
		try {
			return State;
		} catch (e) {
			ignorarErro(e, 'est');
		}
		try {
			return window.State;
		} catch (e) {
			ignorarErro(e, 'est');
		}
		return null;
	}
	function projs() {
		try {
			const S = est();
			return (S && S.projects) || [];
		} catch (e) {
			return [];
		}
	}
	function ativo() {
		const S = est();
		if (!S) return null;
		const L = S.projects || [];
		for (let i = 0; i < L.length; i++) if (L[i] && L[i].id === S.active) return L[i];
		return null;
	}
	function fnw(n) {
		try {
			const f = window[n];
			return typeof f === 'function' ? f : null;
		} catch (e) {
			return null;
		}
	}
	function mcpAtivo() {
		try {
			if (MCP && MCP.active) return true;
		} catch (e) {
			ignorarErro(e, 'mcpAtivo');
		}
		try {
			if (window.MCP && window.MCP.active) return true;
		} catch (e) {
			ignorarErro(e, 'mcpAtivo');
		}
		return false;
	}
	function hl() {
		try {
			if (typeof HEADLESS !== 'undefined' && HEADLESS) return HEADLESS;
		} catch (e) {
			ignorarErro(e, 'hl');
		}
		return null;
	}
	function nArq() {
		let L = projs(),
			n = 0;
		for (let i = 0; i < L.length; i++) {
			try {
				n += (L[i].files && L[i].files.size) || 0;
			} catch (e) {
				ignorarErro(e, 'nArq');
			}
		}
		return n;
	}
	function grande() {
		const p = ativo();
		const n = (p && p.files && p.files.size) || 0;
		return n > M.grandeArq || nArq() > M.grandeArq * 2;
	}
	function heap() {
		try {
			const m = performance.memory;
			return (m && m.usedJSHeapSize) || 0;
		} catch (e) {
			return 0;
		}
	}
	function mb(x) {
		return Math.round((x || 0) / 1048576);
	}
	function limpaCache(p, k) {
		try {
			const c = p[k];
			if (!c) return;
			if (typeof Map !== 'undefined' && c instanceof Map) {
				c.clear();
				return;
			}
			if (typeof c === 'object') {
				for (let x in c) if (Object.prototype.hasOwnProperty.call(c, x)) delete c[x];
			}
		} catch (e) {
			ignorarErro(e, 'limpaCache');
		}
	}

	function aplicarPM() {
		const g = grande();
		if (PM) {
			try {
				PM.HIST_MAX = g ? M.histMaxGrande : M.histMax;
				PM.SNAP_MAX = g ? M.snapMaxGrande : M.snapMax;
				PM.LOG_MAX = M.logMax;
				PM.TREE_MAX = M.leve ? M.treeMaxLeve : M.treeMax;
				PM.HEAP_ALVO = M.alvoMB * 1048576;
				if (typeof PM.HIST_BUDGET === 'number') PM.HIST_BUDGET = M.leve ? 1048576 : 2097152;
			} catch (e) {
				ignorarErro(e, 'aplicarPM');
			}
		}
		try {
			window.__PERF_BIG_CHARS = M.leve ? M.bigCharsLeve : M.bigChars;
			window.__PERF_BIG_LINES = M.leve ? M.bigLinesLeve : M.bigLines;
		} catch (e) {
			ignorarErro(e, 'aplicarPM');
		}
		const H = hl();
		if (H) {
			try {
				H.MAX = M.headlessMax;
				H.W = M.headlessW;
				H.H = M.headlessH;
			} catch (e) {
				ignorarErro(e, 'aplicarPM');
			}
		}
	}

	function limparHeadless(tudo) {
		const H = hl();
		if (!H || !H.map || !H.map.forEach) return 0;
		const hd = fnw('headlessDestroy'),
			agora = Date.now(),
			mortos = [];
		H.map.forEach(function (h, pid) {
			if (!h) {
				mortos.push(pid);
				return;
			}
			if (!h.__t10) h.__t10 = agora;
			const ult = Math.max(h.__t10, typeof h.t === 'number' ? h.t : 0);
			if (tudo || agora - ult > M.headlessIdle) mortos.push(pid);
		});
		for (let i = 0; i < mortos.length; i++) {
			try {
				if (hd) hd(mortos[i]);
				else {
					const h2 = H.map.get(mortos[i]);
					if (h2 && h2.ifr && h2.ifr.remove) h2.ifr.remove();
					H.map.delete(mortos[i]);
				}
			} catch (e) {
				ignorarErro(e, 'limparHeadless');
			}
		}
		M.headlessMortos += mortos.length;
		return mortos.length;
	}

	function enxugarHtml() {
		const S = est();
		if (!S) return 0;
		let solto = 0;
		projs().forEach(function (p) {
			if (!p || !p.lastHtml) return;
			if (p.id === S.active) return;
			if (p.popout && !p.popout.closed) return;
			solto += p.lastHtml.length;
			p.lastHtml = null;
		});
		return solto;
	}
	function soltarBlobs() {
		const S = est();
		if (!S) return 0;
		const rb = fnw('revokeBlobs');
		if (!rb) return 0;
		let H = hl(),
			n = 0;
		projs().forEach(function (p) {
			if (!p || p.id === S.active) return;
			if (p.popout && !p.popout.closed) return;
			try {
				if (H && H.map && H.map.get && H.map.get(p.id)) return;
			} catch (e) {
				ignorarErro(e, 'soltarBlobs');
			}
			const q = (p.blobs && p.blobs.size) || 0;
			if (!q) return;
			try {
				rb(p);
			} catch (e) {
				ignorarErro(e, 'soltarBlobs');
			}
			limpaCache(p, 'blobCache');
			limpaCache(p, 'cssBlobCache');
			n += q;
		});
		return n;
	}

	function enxugarHistorico(max) {
		const lim = typeof max === 'number' ? max : grande() ? M.histMaxGrande : M.histMax;
		let cortados = 0;
		projs().forEach(function (p) {
			if (!p || !p.files || !p.files.forEach) return;
			const aberto = p.openFile;
			p.files.forEach(function (f, k) {
				if (!f || !f.history || !f.history.length) return;
				const alvo = k === aberto ? Math.max(lim, M.histAberto) : lim;
				if (f.history.length > alvo) {
					cortados += f.history.length - alvo;
					f.history = f.history.slice(-alvo);
				}
			});
		});
		return cortados;
	}
	function enxugarSnaps(max) {
		const lim = typeof max === 'number' ? max : grande() ? M.snapMaxGrande : M.snapMax;
		let n = 0,
			campos = ['snaps', 'snapshots', 'snapList', 'versoes'];
		projs().forEach(function (p) {
			if (!p) return;
			campos.forEach(function (k) {
				const a = p[k];
				if (!Array.isArray(a) || a.length <= lim) return;
				n += a.length - lim;
				a.splice(0, a.length - lim);
			});
		});
		return n;
	}
	function enxugarLogs() {
		let n = 0;
		projs().forEach(function (p) {
			if (!p || !Array.isArray(p.logs)) return;
			if (p.logs.length > M.logMax) {
				n += p.logs.length - M.logMax;
				p.logs.splice(0, p.logs.length - M.logMax);
			}
		});
		try {
			if (Array.isArray(MCP.log) && MCP.log.length > M.mcpLogMax)
				MCP.log.splice(0, MCP.log.length - M.mcpLogMax);
		} catch (e) {
			ignorarErro(e, 'enxugarLogs');
		}
		try {
			if (Array.isArray(AG.log) && AG.log.length > M.mcpLogMax)
				AG.log.splice(0, AG.log.length - M.mcpLogMax);
		} catch (e) {
			ignorarErro(e, 'enxugarLogs');
		}
		return n;
	}
	function cortarTexto(x) {
		if (typeof x !== 'string' || x.length <= M.logLinha) return x;
		return x.slice(0, M.logLinha) + ' [...+' + (x.length - M.logLinha) + ' caracteres]';
	}
	function envolverLogs() {
		['pushLog', 'logCmd', 'logErr', 'mcpLog'].forEach(function (nome) {
			const o = window[nome];
			if (typeof o !== 'function' || o.__m10) return;
			const w = function () {
				const A = [].slice.call(arguments);
				for (let i = 0; i < A.length; i++) A[i] = cortarTexto(A[i]);
				return o.apply(this, A);
			};
			w.__m10 = 1;
			w.__orig = o;
			w.__diag = o.__diag || 0;
			w.__pm = o.__pm || 0;
			try {
				window[nome] = w;
			} catch (e) {
				ignorarErro(e, 'envolverLogs');
			}
		});
	}

	let fpUlt = '',
		tSaveUlt = 0;
	function impressao() {
		const S = est();
		if (!S) return '';
		const out = [],
			L = S.projects || [];
		for (let i = 0; i < L.length; i++) {
			let p = L[i],
				soma = 0,
				q = 0;
			try {
				p.files.forEach(function (f) {
					q++;
					soma += f && f.text != null ? f.text.length : (f && f.data && f.data.length) || 0;
				});
			} catch (e) {
				ignorarErro(e, 'impressao');
			}
			out.push(
				p.id +
					'.' +
					q +
					'.' +
					soma +
					'.' +
					(p.openFile || '') +
					'.' +
					(p.name || '') +
					'.' +
					((p.openTabs && p.openTabs.length) || 0) +
					'.' +
					((p.dirty && p.dirty.size) || 0),
			);
		}
		let fpMcp = '';
		try {
			fpMcp =
				(MCP.active ? '1' : '0') +
				'.' +
				(MCP.sid || '') +
				'.' +
				(MCP.token || '') +
				'.' +
				(MCP.relay || '');
		} catch (e) {
			ignorarErro(e, 'impressao');
		}
		return (S.active || '') + '|' + fpMcp + '|' + out.join('|');
	}
	function envolverSave() {
		const o = window.saveSession;
		if (typeof o !== 'function' || o.__m10) return;
		const w = function () {
			try {
				const agora = Date.now();
				const f = impressao();
				if (f && f === fpUlt && agora - tSaveUlt < M.saveMinMs) {
					M.savesEvitados++;
					return;
				}
				fpUlt = f;
				tSaveUlt = agora;
			} catch (e) {
				ignorarErro(e, 'w');
			}
			return o.apply(this, arguments);
		};
		w.__m10 = 1;
		w.__orig = o;
		try {
			window.saveSession = w;
		} catch (e) {
			ignorarErro(e, 'envolverSave');
		}
	}

	let escritas = [],
		pendBuild = null,
		timerBuild = null,
		timerBurst = null;
	function marcarEscrita() {
		const t = Date.now();
		escritas.push(t);
		while (escritas.length && t - escritas[0] > M.burstJanela) escritas.shift();
		if (escritas.length >= M.burstLimite) {
			M.burst = true;
			if (timerBurst) clearTimeout(timerBurst);
			timerBurst = setTimeout(function () {
				M.burst = false;
				fimDaRajada();
			}, M.burstJanela + 900);
		}
	}
	function fimDaRajada() {
		enxugarHistorico();
		enxugarLogs();
		if (pendBuild && !document.hidden) {
			const p = pendBuild;
			pendBuild = null;
			const sb = fnw('scheduleBuild');
			const o = (sb && sb.__orig) || sb;
			if (o)
				try {
					o(p);
				} catch (e) {
					ignorarErro(e, 'fimDaRajada');
				}
		}
	}
	function envolverEscritas() {
		['mcpAfterWrite', 'mcpBulkChanged', 'mcpDeleteOne'].forEach(function (nome) {
			const o = window[nome];
			if (typeof o !== 'function' || o.__m10) return;
			const w = function () {
				marcarEscrita();
				return o.apply(this, arguments);
			};
			w.__m10 = 1;
			w.__orig = o;
			try {
				window[nome] = w;
			} catch (e) {
				ignorarErro(e, 'envolverEscritas');
			}
		});
		const sb = window.scheduleBuild;
		if (typeof sb === 'function' && !sb.__m10) {
			const w2 = function (p) {
				if (document.hidden && M.pausarBuildOculto && !mcpAtivo()) {
					pendBuild = p || pendBuild;
					M.buildsAdiados++;
					return;
				}
				if (M.burst) {
					pendBuild = p || pendBuild;
					M.buildsAdiados++;
					if (!timerBuild)
						timerBuild = setTimeout(function () {
							timerBuild = null;
							const x = pendBuild;
							pendBuild = null;
							if (x && !document.hidden)
								try {
									sb(x);
								} catch (e) {
									ignorarErro(e, 'w2');
								}
						}, M.burstBuildMs);
					return;
				}
				return sb.apply(this, arguments);
			};
			w2.__m10 = 1;
			w2.__orig = sb;
			try {
				window.scheduleBuild = w2;
			} catch (e) {
				ignorarErro(e, 'envolverEscritas');
			}
		}
		['drawMinimap', 'refreshMinimap'].forEach(function (nome) {
			const o = window[nome];
			if (typeof o !== 'function' || o.__m10) return;
			const w3 = function () {
				if (document.hidden || M.burst) return;
				return o.apply(this, arguments);
			};
			w3.__m10 = 1;
			w3.__orig = o;
			try {
				window[nome] = w3;
			} catch (e) {
				ignorarErro(e, 'envolverEscritas');
			}
		});
	}

	let pausado = false,
		htmlPausa = null,
		timerOculto = null;
	function frameEl() {
		try {
			if (typeof el !== 'undefined' && el && el.frame) return el.frame;
		} catch (e) {
			ignorarErro(e, 'frameEl');
		}
		return (
			document.getElementById('frame') ||
			document.querySelector('.device iframe') ||
			document.querySelector('#device iframe')
		);
	}
	function pausarPreview(auto) {
		const f = frameEl();
		if (!f || pausado) return false;
		const p = ativo();
		htmlPausa = (p && p.lastHtml) || null;
		pausado = true;
		M.pausadoAuto = !!auto;
		try {
			f.removeAttribute('srcdoc');
		} catch (e) {
			ignorarErro(e, 'pausarPreview');
		}
		try {
			f.src = 'about:blank';
		} catch (e) {
			ignorarErro(e, 'pausarPreview');
		}
		return true;
	}
	function retomarPreview() {
		if (!pausado) return false;
		pausado = false;
		const p = ativo(),
			fs = fnw('frameSrcdoc'),
			bp = fnw('buildPreview');
		const h = htmlPausa || (p && p.lastHtml) || null;
		htmlPausa = null;
		try {
			if (h && fs) fs(h);
			else if (p && bp) bp(p);
		} catch (e) {
			ignorarErro(e, 'retomarPreview');
		}
		if (M.pausadoAuto) {
			M.pausadoAuto = false;
			const tf = fnw('toast');
			if (tf)
				try {
					tf(
						'Preview recarregado',
						'Ele foi descarregado enquanto a aba ficou em segundo plano para economizar memoria',
						'ok',
					);
				} catch (e) {
					ignorarErro(e, 'retomarPreview');
				}
		}
		return true;
	}
	function aoOcultarMuito() {
		const mcp = mcpAtivo();
		limparHeadless(!mcp);
		enxugarHistorico();
		enxugarSnaps();
		enxugarLogs();
		enxugarHtml();
		soltarBlobs();
		if (!mcp && M.descarregarOculto && (M.leve || grande() || mb(heap()) > 320))
			pausarPreview(true);
	}
	function ligarVisibilidade() {
		document.addEventListener(
			'visibilitychange',
			function () {
				if (document.hidden) {
					if (timerOculto) clearTimeout(timerOculto);
					timerOculto = setTimeout(function () {
						if (document.hidden) aoOcultarMuito();
					}, M.ocultoMs);
				} else {
					if (timerOculto) {
						clearTimeout(timerOculto);
						timerOculto = null;
					}
					if (pausado) retomarPreview();
					else if (pendBuild) {
						const p = pendBuild;
						pendBuild = null;
						const sb = fnw('scheduleBuild');
						const o = (sb && sb.__orig) || sb;
						if (o)
							try {
								o(p);
							} catch (e) {
								ignorarErro(e, 'ligarVisibilidade');
							}
					}
				}
			},
			false,
		);
	}

	function nivel1() {
		aplicarPM();
		const r = {
			hist: enxugarHistorico(),
			snaps: enxugarSnaps(),
			logs: enxugarLogs(),
			html: enxugarHtml(),
			blobs: soltarBlobs(),
			headless: limparHeadless(false),
		};
		return r;
	}
	function nivel2() {
		const r = nivel1();
		r.headless += limparHeadless(true);
		r.hist += enxugarHistorico(grande() ? 0 : 1);
		r.snaps += enxugarSnaps(1);
		try {
			if (PM && typeof PM.socorro === 'function') PM.socorro();
		} catch (e) {
			ignorarErro(e, 'nivel2');
		}
		try {
			const lb = fnw('limparBlobsSoltos');
			const p = ativo();
			if (lb && p) lb(p);
		} catch (e) {
			ignorarErro(e, 'nivel2');
		}
		return r;
	}
	function modoLeve(on) {
		M.leve = on === undefined ? !M.leve : !!on;
		try {
			localStorage.setItem('synapse_mem10_leve', M.leve ? '1' : '0');
		} catch (e) {
			ignorarErro(e, 'modoLeve');
		}
		if (M.leve) {
			M.descarregarOculto = true;
			M.headlessMax = 1;
			nivel1();
		}
		aplicarPM();
		const f = fnw('renderTreeAgora') || fnw('renderTree');
		if (f)
			try {
				f();
			} catch (e) {
				ignorarErro(e, 'modoLeve');
			}
		return M.leve;
	}

	let timer = null;
	function ciclo() {
		M.ciclos++;
		try {
			aplicarPM();
			limparHeadless(false);
			if (document.hidden) return;
			let h = heap();
			if (!h) {
				h = estimativa();
			}
			M.heapMB = mb(h);
			if (!M.leve && !M.escolhaManual && grande()) modoLeve(true);
			if (h > M.alvoMB * 1048576) nivel1();
			if (h > M.tetoMB * 1048576) {
				nivel2();
				if (!M.leve) modoLeve(true);
			}
		} catch (e) {
			ignorarErro(e, 'ciclo');
		}
	}
	function estimativa() {
		let total = 0;
		projs().forEach(function (p) {
			if (!p || !p.files || !p.files.forEach) return;
			p.files.forEach(function (f) {
				if (!f) return;
				if (f.text != null) total += f.text.length * 2;
				else if (f.data && f.data.length) total += f.data.length;
				if (f.history && f.history.length)
					for (let i = 0; i < f.history.length; i++) {
						const t = f.history[i] && f.history[i].text;
						if (t) total += t.length * 2;
					}
			});
			if (p.lastHtml) total += p.lastHtml.length * 2;
		});
		return total;
	}

	M.diag = function (curto) {
		let histE = 0,
			histC = 0,
			snaps = 0,
			blobs = 0,
			arqs = 0;
		projs().forEach(function (p) {
			if (!p) return;
			blobs += (p.blobs && p.blobs.size) || 0;
			['snaps', 'snapshots', 'snapList', 'versoes'].forEach(function (k) {
				if (Array.isArray(p[k])) snaps += p[k].length;
			});
			if (p.files && p.files.forEach)
				p.files.forEach(function (f) {
					arqs++;
					if (f && f.history) {
						histE += f.history.length;
						for (let i = 0; i < f.history.length; i++) {
							const t = f.history[i] && f.history[i].text;
							if (t) histC += t.length;
						}
					}
				});
		});
		const H = hl();
		const d = {
			ver: M.ver,
			heapMB: mb(heap()) || mb(estimativa()),
			estimativaMB: mb(estimativa()),
			projetos: projs().length,
			arquivos: arqs,
			histEntradas: histE,
			histChars: Math.round(histC / 1000),
			snaps: snaps,
			blobs: blobs,
			headless: (H && H.map && H.map.size) || 0,
			burst: M.burst,
			leve: M.leve,
			previewPausado: pausado,
			savesEvitados: M.savesEvitados,
			buildsAdiados: M.buildsAdiados,
			previewsInvisiveisMortos: M.headlessMortos,
			treeMax: PM ? PM.TREE_MAX : null,
			histMax: PM ? PM.HIST_MAX : null,
		};
		if (!curto)
			try {
				console.table ? console.table(d) : registro.debug(d);
			} catch (e) {
				ignorarErro(e, 'diag');
			}
		return d;
	};
	M.liberar = function () {
		const r = nivel2();
		try {
			registro.debug('[mem10] liberado', r);
		} catch (e) {
			ignorarErro(e, 'liberar');
		}
		return r;
	};
	M.leveza = modoLeve;
	M.modoLeve = modoLeve;
	M.pausarPreview = function () {
		return pausarPreview(false);
	};
	M.retomarPreview = retomarPreview;
	M.pausado = function () {
		return pausado;
	};
	M.set = function (o) {
		if (o && typeof o === 'object')
			for (let k in o) if (Object.prototype.hasOwnProperty.call(o, k)) M[k] = o[k];
		aplicarPM();
		return M;
	};
	M.nivel1 = nivel1;
	M.nivel2 = nivel2;

	function ligar() {
		let escolha = null;
		try {
			escolha = localStorage.getItem('synapse_mem10_leve');
		} catch (e) {
			ignorarErro(e, 'ligar');
		}
		M.escolhaManual = escolha === '0' || escolha === '1';
		if (escolha === '1') M.leve = true;
		else if (escolha !== '0' && (POUCA_RAM || CH <= 4)) M.leve = true;
		aplicarPM();
		envolverLogs();
		envolverSave();
		envolverEscritas();
		ligarVisibilidade();
		limparHeadless(true);
		if (timer) clearInterval(timer);
		timer = setInterval(ciclo, 8000);
		try {
			registro.debug(
				`[mem10] governador ativo - alvo ${M.alvoMB} MB${M.leve ? ' (modo leve)' : ''}`,
			);
		} catch (e) {
			ignorarErro(e, 'ligar');
		}
	}
	if (document.readyState === 'loading')
		document.addEventListener('DOMContentLoaded', function () {
			setTimeout(ligar, 300);
		});
	else setTimeout(ligar, 300);
})();
