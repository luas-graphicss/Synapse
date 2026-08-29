(function () {
	'use strict';
	const N = {
		coalesc: 0,
		pulados: 0,
		pinturas: 0,
		lintPulado: 0,
		diffPulado: 0,
		histCortado: 0,
		erroConsole: null,
	};
	function raf(f) {
		try {
			if (document.hidden) return setTimeout(f, 0);
		} catch (e) {
			ignorarErro(e, 'raf');
		}
		try {
			if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(f);
		} catch (e) {
			ignorarErro(e, 'raf');
		}
		return setTimeout(f, 16);
	}
	function estadoApp() {
		try {
			return State;
		} catch (e) {
			ignorarErro(e, 'estadoApp');
		}
		try {
			return window.State;
		} catch (e) {
			ignorarErro(e, 'estadoApp');
		}
		return null;
	}
	function consoleAberto() {
		try {
			const S = estadoApp();
			return S ? !!S.consoleOpen : true;
		} catch (e) {
			return true;
		}
	}

	let rcPend = false,
		rcForca = false;
	if (typeof window.renderConsole === 'function' && !window.renderConsole.__veloz) {
		const _rc = window.renderConsole;
		const nrc = function () {
			if (!consoleAberto() && !rcForca) {
				N.pulados++;
				return;
			}
			if (rcPend) {
				N.coalesc++;
				return;
			}
			rcPend = true;
			raf(function () {
				rcPend = false;
				try {
					_rc();
				} catch (e) {
					N.erroConsole = String((e && e.message) || e);
				}
			});
		};
		nrc.__veloz = 1;
		nrc.__orig = _rc;
		window.renderConsole = nrc;
	}

	if (typeof window.updateBadge === 'function' && !window.updateBadge.__veloz) {
		let _ub = window.updateBadge,
			ubP = null,
			ubT = false;
		const nub = function (proj) {
			ubP = proj || ubP;
			if (ubT) {
				N.coalesc++;
				return;
			}
			ubT = true;
			raf(function () {
				ubT = false;
				try {
					_ub(ubP);
				} catch (e) {
					ignorarErro(e, 'nub');
				}
			});
		};
		nub.__veloz = 1;
		nub.__orig = _ub;
		window.updateBadge = nub;
	}

	['mcpRenderLog', 'mcpRenderPanel'].forEach(function (nome) {
		const f = window[nome];
		if (typeof f !== 'function' || f.__veloz) return;
		let pend = false;
		const g = function () {
			if (pend) {
				N.coalesc++;
				return;
			}
			pend = true;
			raf(function () {
				pend = false;
				try {
					f();
				} catch (e) {
					ignorarErro(e, 'g');
				}
			});
		};
		g.__veloz = 1;
		g.__orig = f;
		window[nome] = g;
	});

	const P = { proj: null, editor: false, t: null };
	function pintarAgora() {
		P.t = null;
		const proj = P.proj,
			ed = P.editor;
		P.proj = null;
		P.editor = false;
		if (!proj) return;
		try {
			if (proj.id === State.active) {
				if (ed) {
					const f = proj.files.get(proj.openFile);
					if (f && f.text != null) {
						try {
							clearFolds();
						} catch (e) {
							ignorarErro(e, 'pintarAgora');
						}
						try {
							el.codeTa.value = f.text;
						} catch (e) {
							ignorarErro(e, 'pintarAgora');
						}
						try {
							paintEditor(proj.openFile, f.text);
						} catch (e) {
							ignorarErro(e, 'pintarAgora');
						}
						try {
							el.editorDirty.classList.add('on');
						} catch (e) {
							ignorarErro(e, 'pintarAgora');
						}
					}
				}
				try {
					uiEscritaAgendar();
				} catch (e) {
					ignorarErro(e, 'pintarAgora');
				}
				try {
					scheduleBuild(proj);
				} catch (e) {
					ignorarErro(e, 'pintarAgora');
				}
			}
		} catch (e) {
			ignorarErro(e, 'pintarAgora');
		}
		N.pinturas++;
	}
	if (typeof window.mcpAfterWrite === 'function' && !window.mcpAfterWrite.__veloz) {
		const _aw = window.mcpAfterWrite;
		const naw = function (proj, path) {
			try {
				if (typeof tmDepInvalida === 'function') tmDepInvalida(proj && proj.id);
			} catch (e) {
				ignorarErro(e, 'naw');
			}
			try {
				proj.dirty.add(path);
			} catch (e) {
				ignorarErro(e, 'naw');
			}
			try {
				devAutoSync(proj);
			} catch (e) {
				ignorarErro(e, 'naw');
			}
			try {
				saveSession();
			} catch (e) {
				ignorarErro(e, 'naw');
			}
			try {
				if (proj && proj.id === State.active) {
					P.proj = proj;
					if (proj.openFile === path) P.editor = true;
					if (!P.t) P.t = setTimeout(pintarAgora, 0);
				}
			} catch (e) {
				ignorarErro(e, 'naw');
			}
		};
		naw.__veloz = 1;
		naw.__orig = _aw;
		window.mcpAfterWrite = naw;
	}

	if (typeof window.lintSuffix === 'function' && !window.lintSuffix.__veloz) {
		const _ls = window.lintSuffix;
		const nls = function (p, t) {
			try {
				if (typeof t === 'string' && t.length > 250000) {
					N.lintPulado++;
					return '';
				}
			} catch (e) {
				ignorarErro(e, 'nls');
			}
			return _ls(p, t);
		};
		nls.__veloz = 1;
		nls.__orig = _ls;
		window.lintSuffix = nls;
	}
	if (typeof window.lpDelta === 'function' && !window.lpDelta.__veloz) {
		const _ld = window.lpDelta;
		const nld = function (a, b) {
			try {
				if ((a && a.length > 400000) || (b && b.length > 400000)) {
					N.diffPulado++;
					return '';
				}
			} catch (e) {
				ignorarErro(e, 'nld');
			}
			return _ld(a, b);
		};
		nld.__veloz = 1;
		nld.__orig = _ld;
		window.lpDelta = nld;
	}
	if (typeof window.mcpHist === 'function' && !window.mcpHist.__veloz) {
		const _mh = window.mcpHist;
		const nmh = function (f) {
			const r = _mh(f);
			try {
				if (f && f.history && f.text && f.text.length > 200000 && f.history.length > 8) {
					f.history.splice(0, f.history.length - 8);
					N.histCortado++;
				}
			} catch (e) {
				ignorarErro(e, 'nmh');
			}
			return r;
		};
		nmh.__veloz = 1;
		nmh.__orig = _mh;
		window.mcpHist = nmh;
	}

	function descarregar() {
		try {
			if (P.t) {
				clearTimeout(P.t);
				pintarAgora();
			}
		} catch (e) {
			ignorarErro(e, 'descarregar');
		}
	}
	try {
		window.addEventListener('beforeunload', descarregar);
		document.addEventListener('visibilitychange', function () {
			if (document.hidden) descarregar();
		});
	} catch (e) {
		ignorarErro(e, 'render-coalescido');
	}

	function ms() {
		try {
			return performance.now();
		} catch (e) {
			return Date.now();
		}
	}
	window.SYNAPSE_VELOZ = {
		estado: function () {
			return {
				coalescidos: N.coalesc,
				redrawsPulados: N.pulados,
				pinturasAgrupadas: N.pinturas,
				lintPulado: N.lintPulado,
				diffPulado: N.diffPulado,
				historicoCortado: N.histCortado,
				consoleAberto: consoleAberto(),
				erroConsole: N.erroConsole,
			};
		},
		forcar: function () {
			rcForca = true;
			try {
				(window.renderConsole.__orig || window.renderConsole)();
			} catch (e) {
				ignorarErro(e, 'forcar');
			}
			rcForca = false;
			return true;
		},
		medir: function (qtd) {
			qtd = qtd || 200;
			let rc = window.renderConsole.__orig || window.renderConsole,
				t = ms(),
				i;
			for (i = 0; i < qtd; i++) {
				try {
					rc();
				} catch (e) {
					ignorarErro(e, 'medir');
				}
			}
			const antigo = ms() - t;
			const t2 = ms();
			for (i = 0; i < qtd; i++) {
				try {
					window.renderConsole();
				} catch (e) {
					ignorarErro(e, 'medir');
				}
			}
			const novo = ms() - t2;
			return {
				chamadas: qtd,
				msAntigo: Math.round(antigo * 10) / 10,
				msNovo: Math.round(novo * 10) / 10,
				ganho: antigo > 0 ? Math.round((1 - novo / antigo) * 100) + '%' : '-',
			};
		},
	};
})();
