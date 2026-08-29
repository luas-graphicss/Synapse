(function () {
	'use strict';
	if (window.__PM_ON) return;
	window.__PM_ON = 1;

	const PM = {
		HIST_MAX: 6,
		HIST_BUDGET: 6 * 1024 * 1024,
		SNAP_MAX: 3,
		LOG_MAX: 400,
		PERSIST_HIST: 1,
		PERSIST_SNAP: 1,
		TREE_MAX: 900,
		HEAP_ALVO: 700 * 1024 * 1024,
		files: 0,
		histChars: 0,
		heap: 0,
		_nodes: 0,
		_ocultos: 0,
		n: {
			varreduras: 0,
			histCortado: 0,
			snapCortado: 0,
			logCortado: 0,
			savePedido: 0,
			saveFeito: 0,
			treePedido: 0,
			treeFeito: 0,
			buildPulado: 0,
			socorros: 0,
		},
	};
	window.SYNAPSE_MEM = PM;

	function estado() {
		try {
			return State;
		} catch (e) {
			ignorarErro(e, 'estado');
		}
		try {
			return window.State;
		} catch (e) {
			ignorarErro(e, 'estado');
		}
		return null;
	}
	function projetos() {
		try {
			const S = estado();
			return (S && S.projects) || [];
		} catch (e) {
			return [];
		}
	}
	function recontar() {
		let ps = projetos(),
			n = 0;
		for (let i = 0; i < ps.length; i++) {
			try {
				n += (ps[i].files && ps[i].files.size) || 0;
			} catch (e) {
				ignorarErro(e, 'recontar');
			}
		}
		PM.files = n;
		return n;
	}
	function mb(n) {
		return Math.round((n / 1048576) * 10) / 10 + ' MB';
	}

	function histSweep(alvo) {
		const lim = typeof alvo === 'number' ? alvo : PM.HIST_BUDGET;
		let ps = projetos(),
			listas = [],
			todas = [],
			total = 0;
		for (let i = 0; i < ps.length; i++) {
			const fl = ps[i] && ps[i].files;
			if (!fl || !fl.forEach) continue;
			fl.forEach(function (f) {
				const h = f && f.history;
				if (!h || !h.length) return;
				if (h.length > PM.HIST_MAX) {
					PM.n.histCortado += h.length - PM.HIST_MAX;
					h.splice(0, h.length - PM.HIST_MAX);
				}
				listas.push(h);
				for (let k = 0; k < h.length; k++) {
					const e = h[k],
						len = e && typeof e.text === 'string' ? e.text.length : 0;
					total += len;
					todas.push({ a: h, e: e, t: (e && e.t) || 0, len: len });
				}
			});
		}
		PM.histChars = total;
		if (total <= lim || !todas.length) return 0;
		todas.sort(function (x, y) {
			return x.t - y.t;
		});
		let cont = new Map(),
			i2;
		for (i2 = 0; i2 < todas.length; i2++) cont.set(todas[i2].a, (cont.get(todas[i2].a) || 0) + 1);
		let mortos = new Set(),
			livre = 0;
		for (i2 = 0; i2 < todas.length && total - livre > lim; i2++) {
			const it = todas[i2],
				c = cont.get(it.a) || 0;
			if (c <= 1) continue;
			mortos.add(it.e);
			cont.set(it.a, c - 1);
			livre += it.len;
		}
		if (!mortos.size) return 0;
		for (i2 = 0; i2 < listas.length; i2++) {
			const arr = listas[i2];
			for (let w = arr.length - 1; w >= 0; w--) if (mortos.has(arr[w])) arr.splice(w, 1);
		}
		PM.histChars = total - livre;
		PM.n.varreduras++;
		PM.n.histCortado += mortos.size;
		return mortos.size;
	}
	PM.histSweep = histSweep;

	let swT = null;
	function agendarSweep() {
		if (swT) return;
		swT = setTimeout(function () {
			swT = null;
			try {
				histSweep();
			} catch (e) {
				ignorarErro(e, 'agendarSweep');
			}
		}, 1200);
	}

	if (typeof window.mcpHist === 'function' && !window.mcpHist.__pm) {
		const nmh = function (f) {
			if (!f) return;
			if (!f.history) f.history = [];
			const t = typeof f.text === 'string' ? f.text : null;
			if (t == null) return;
			const h = f.history,
				ult = h.length ? h[h.length - 1] : null;
			if (ult && ult.text === t) return;
			h.push({ t: Date.now(), text: t });
			PM.histChars += t.length;
			if (h.length > PM.HIST_MAX) {
				const fora = h.splice(0, h.length - PM.HIST_MAX);
				for (let i = 0; i < fora.length; i++)
					PM.histChars -= ((fora[i] && fora[i].text) || '').length;
				PM.n.histCortado += fora.length;
			}
			if (PM.histChars > PM.HIST_BUDGET) agendarSweep();
		};
		nmh.__pm = 1;
		nmh.__orig = window.mcpHist;
		window.mcpHist = nmh;
	}

	if (typeof window.makeSnapshot === 'function' && !window.makeSnapshot.__pm) {
		const _ms = window.makeSnapshot;
		const nms = function (proj, label) {
			const s = _ms(proj, label);
			try {
				const sn = proj && proj.snapshots;
				if (sn && sn.length > PM.SNAP_MAX) {
					PM.n.snapCortado += sn.length - PM.SNAP_MAX;
					sn.splice(0, sn.length - PM.SNAP_MAX);
				}
			} catch (e) {
				ignorarErro(e, 'nms');
			}
			return s;
		};
		nms.__pm = 1;
		nms.__orig = _ms;
		window.makeSnapshot = nms;
	}

	if (typeof window.makeFileEntry === 'function' && !window.makeFileEntry.__pm) {
		const _mfe = window.makeFileEntry;
		const nmfe = function (path, data) {
			const f = _mfe(path, data);
			try {
				if (f && typeof f.text === 'string' && f.data && !f.text.includes('\uFFFD')) f.data = null;
			} catch (e) {
				ignorarErro(e, 'nmfe');
			}
			return f;
		};
		nmfe.__pm = 1;
		nmfe.__orig = _mfe;
		window.makeFileEntry = nmfe;
	}

	function enxugar(s) {
		const ps = s && s.projects;
		if (!ps || !ps.length) return s;
		for (let i = 0; i < ps.length; i++) {
			const p = ps[i];
			if (p.snapshots && p.snapshots.length > PM.PERSIST_SNAP)
				p.snapshots = p.snapshots.slice(-PM.PERSIST_SNAP);
			const fl = p.files;
			if (!fl || !fl.length) continue;
			const pHist = fl.length > 600 ? 0 : PM.PERSIST_HIST;
			for (let j = 0; j < fl.length; j++) {
				const ent = fl[j],
					f = ent && ent[1];
				if (!f) continue;
				if (f.text != null && f.data) f.data = null;
				const h = f.history;
				if (h && h.length) {
					if (!pHist) {
						f.history = [];
						continue;
					}
					const keep = [];
					for (let k = Math.max(0, h.length - pHist); k < h.length; k++) {
						const e = h[k];
						if (!e || typeof e.text !== 'string') continue;
						if (e.text === f.text) continue;
						keep.push(e);
					}
					f.history = keep;
				}
			}
		}
		return s;
	}
	if (typeof window.serializeSession === 'function' && !window.serializeSession.__pm) {
		const _ser = window.serializeSession;
		const nser = function () {
			const s = _ser();
			try {
				enxugar(s);
			} catch (e) {
				ignorarErro(e, 'nser');
			}
			return s;
		};
		nser.__pm = 1;
		nser.__orig = _ser;
		window.serializeSession = nser;
	}

	function esperaSave() {
		const n = PM.files;
		if (n > 1200) return 6000;
		if (n > 600) return 3000;
		if (n > 200) return 1200;
		return 450;
	}
	let _save = window.saveSession,
		svT = null,
		svLast = 0;
	if (typeof _save === 'function' && !_save.__pm) {
		const nsave = function () {
			try {
				const S = estado();
				if (S && S.suppressSave) return;
			} catch (e) {
				ignorarErro(e, 'nsave');
			}
			PM.n.savePedido++;
			if (svT) return;
			recontar();
			const d = esperaSave(),
				esp = Math.max(0, d - (Date.now() - svLast));
			svT = setTimeout(function () {
				svT = null;
				svLast = Date.now();
				PM.n.saveFeito++;
				try {
					_save();
				} catch (e) {
					ignorarErro(e, 'nsave');
				}
			}, esp);
		};
		nsave.__pm = 1;
		nsave.__orig = _save;
		window.saveSession = nsave;
	}
	function descarregarSave() {
		try {
			if (svT) {
				clearTimeout(svT);
				svT = null;
			}
		} catch (e) {
			ignorarErro(e, 'descarregarSave');
		}
		try {
			if (typeof window.saveSessionNow === 'function') window.saveSessionNow();
			else if (typeof _save === 'function') _save();
		} catch (e) {
			ignorarErro(e, 'descarregarSave');
		}
	}
	try {
		window.addEventListener('pagehide', descarregarSave);
		window.addEventListener('beforeunload', descarregarSave);
		document.addEventListener('visibilitychange', function () {
			if (document.hidden) descarregarSave();
		});
	} catch (e) {
		ignorarErro(e, 'memoria');
	}

	try {
		if (typeof REC !== 'undefined' && REC) {
			REC.max = Math.min(REC.max || 20, 4);
			REC.genMs = Math.max(REC.genMs || 300000, 900000);
		}
	} catch (e) {
		ignorarErro(e, 'memoria');
	}

	function caparLogs(proj) {
		try {
			const L = proj && proj.logs;
			if (L && L.length > PM.LOG_MAX) {
				const q = L.length - PM.LOG_MAX;
				L.splice(0, q);
				PM.n.logCortado += q;
			}
		} catch (e) {
			ignorarErro(e, 'caparLogs');
		}
	}
	['pushLog', 'logCmd', 'logErr'].forEach(function (nome) {
		const f = window[nome];
		if (typeof f !== 'function' || f.__pm) return;
		const g = function (proj) {
			const r = f.apply(this, arguments);
			caparLogs(proj);
			return r;
		};
		g.__pm = 1;
		g.__orig = f;
		window[nome] = g;
	});

	function dirsAbertos() {
		try {
			return openDirs;
		} catch (e) {
			return null;
		}
	}
	const _renderDir = window.renderDir;
	if (typeof _renderDir === 'function' && !_renderDir.__pm) {
		const desenhar = function (node, depth, proj) {
			let buscando = false;
			try {
				buscando = el.exSearch.value.trim() !== '';
			} catch (e) {
				ignorarErro(e, 'desenhar');
			}
			const oa = dirsAbertos();
			const kids = [];
			node.children.forEach(function (v) {
				kids.push(v);
			});
			kids.sort(function (a, b) {
				return b.dir - a.dir || a.name.localeCompare(b.name);
			});
			let out = '';
			for (let i = 0; i < kids.length; i++) {
				const k = kids[i],
					pad = 8 + depth * 13;
				if (k.dir) {
					const aberto = (oa ? oa.has(k.path) : true) || buscando;
					const dentro = aberto ? desenhar(k, depth + 1, proj) : '';
					out += `<div class="node"><div class="row${aberto ? ' open' : ''}" draggable="true" data-dir="${esc(k.path)}" \
style="padding-left:${pad}px"><span class="chev"><svg class="icon" viewBox="0 0 24 24"><path d="M9 6l6 \
6-6 6"/></svg></span><span class="fico" style="color:#7aa7ff">${fileIcon(k.path, true, aberto)}</span>\
<span class="rname">${esc(k.name)}</span></div><div class="children" style="${aberto ? '' : 'display:none'}">${dentro}</div>\
</div>`;
				} else {
					if (PM._nodes >= PM.TREE_MAX) {
						PM._ocultos++;
						continue;
					}
					PM._nodes++;
					const sel = proj && proj.openFile === k.path ? ' sel' : '';
					out += `<div class="row${sel}" draggable="true" data-file="${esc(k.path)}" style="padding-left:${pad}${8}px">\
<span class="fico" style="color:${colorOfExt(k.path)}">${fileIcon(k.path, false)}</span><span class="rname">${esc(k.name)}</span>\
</div>`;
				}
			}
			return out;
		};
		const nrd = function (node, depth, proj) {
			try {
				return desenhar(node, depth, proj);
			} catch (e) {
				PM.erroArvore = String((e && e.message) || e);
				try {
					return _renderDir(node, depth, proj);
				} catch (e2) {
					return '';
				}
			}
		};
		nrd.__pm = 1;
		nrd.__orig = _renderDir;
		window.renderDir = nrd;
	}

	const _renderTree = window.renderTree;
	function arvoreAgora() {
		PM._nodes = 0;
		PM._ocultos = 0;
		try {
			_renderTree();
		} catch (e) {
			ignorarErro(e, 'arvoreAgora');
		}
		PM.n.treeFeito++;
		if (PM._ocultos > 0) {
			try {
				el.tree.insertAdjacentHTML(
					'beforeend',
					`<div class="ex-empty">+${PM._ocultos} arquivo(s) nao listados (teto de ${PM.TREE_MAX} linhas para nao travar PCs fracos).<br>Use a busca do Explorer para filtrar.</div>`,
				);
			} catch (e) {
				ignorarErro(e, 'arvoreAgora');
			}
		}
	}
	if (typeof _renderTree === 'function' && !_renderTree.__pm) {
		let rtT = null,
			rtLast = 0;
		const nrt = function () {
			PM.n.treePedido++;
			recontar();
			const min = PM.files > 1200 ? 1200 : PM.files > 400 ? 600 : 0;
			if (!min) {
				if (rtT) {
					clearTimeout(rtT);
					rtT = null;
				}
				rtLast = Date.now();
				return arvoreAgora();
			}
			if (rtT) return;
			const esp = Math.max(0, min - (Date.now() - rtLast));
			rtT = setTimeout(function () {
				rtT = null;
				rtLast = Date.now();
				arvoreAgora();
			}, esp);
		};
		nrt.__pm = 1;
		nrt.__orig = _renderTree;
		window.renderTree = nrt;
		window.renderTreeAgora = arvoreAgora;
	}

	const _sb = window.scheduleBuild;
	if (typeof _sb === 'function' && !_sb.__pm) {
		let sbT = null,
			sbLast = 0,
			sbP = null;
		const nsb = function (proj) {
			recontar();
			const min = PM.files > 1200 ? 1500 : PM.files > 600 ? 900 : 0;
			if (!min) return _sb(proj);
			sbP = proj || sbP;
			if (sbT) {
				PM.n.buildPulado++;
				return;
			}
			const esp = Math.max(0, min - (Date.now() - sbLast));
			sbT = setTimeout(function () {
				sbT = null;
				sbLast = Date.now();
				try {
					_sb(sbP);
				} catch (e) {
					ignorarErro(e, 'nsb');
				}
			}, esp);
		};
		nsb.__pm = 1;
		nsb.__orig = _sb;
		window.scheduleBuild = nsb;
	}

	function socorro() {
		PM.n.socorros++;
		try {
			histSweep(Math.floor(PM.HIST_BUDGET / 3));
		} catch (e) {
			ignorarErro(e, 'socorro');
		}
		let ativo = null;
		try {
			ativo = State.active;
		} catch (e) {
			ignorarErro(e, 'socorro');
		}
		const ps = projetos();
		for (let i = 0; i < ps.length; i++) {
			const p = ps[i];
			if (!p) continue;
			try {
				if (p.snapshots && p.snapshots.length > 1) p.snapshots.splice(0, p.snapshots.length - 1);
			} catch (e) {
				ignorarErro(e, 'socorro');
			}
			try {
				if (p.logs && p.logs.length > 120) p.logs.splice(0, p.logs.length - 120);
			} catch (e) {
				ignorarErro(e, 'socorro');
			}
			if (p.id !== ativo) {
				try {
					if (typeof limparBlobsSoltos === 'function') limparBlobsSoltos(p);
				} catch (e) {
					ignorarErro(e, 'socorro');
				}
				try {
					if (p.lastHtml && p.lastHtml.length > 200000) p.lastHtml = null;
				} catch (e) {
					ignorarErro(e, 'socorro');
				}
			}
		}
		try {
			if (
				typeof HEADLESS !== 'undefined' &&
				HEADLESS.map &&
				typeof headlessDestroy === 'function'
			) {
				const mortos = [];
				HEADLESS.map.forEach(function (h, pid) {
					if (pid !== ativo) mortos.push(pid);
				});
				for (let q = 0; q < mortos.length; q++) headlessDestroy(mortos[q]);
			}
		} catch (e) {
			ignorarErro(e, 'socorro');
		}
		return true;
	}
	PM.limpar = function () {
		socorro();
		return PM.diag();
	};

	setInterval(function () {
		try {
			const m = window.performance && performance.memory ? performance.memory.usedJSHeapSize : 0;
			PM.heap = m;
			if (m && m > PM.HEAP_ALVO) socorro();
			else if (PM.histChars > PM.HIST_BUDGET) histSweep();
			const ps = projetos();
			for (let i = 0; i < ps.length; i++) caparLogs(ps[i]);
		} catch (e) {
			ignorarErro(e, 'memoria');
		}
	}, 15000);

	setTimeout(function () {
		try {
			recontar();
			histSweep();
			const ps = projetos();
			for (let i = 0; i < ps.length; i++) {
				caparLogs(ps[i]);
				const sn = ps[i] && ps[i].snapshots;
				if (sn && sn.length > PM.SNAP_MAX) sn.splice(0, sn.length - PM.SNAP_MAX);
			}
		} catch (e) {
			ignorarErro(e, 'memoria');
		}
	}, 4000);

	PM.diag = function () {
		recontar();
		try {
			histSweep(Number.MAX_SAFE_INTEGER);
		} catch (e) {
			ignorarErro(e, 'diag');
		}
		let ps = projetos(),
			snaps = 0,
			logs = 0,
			texto = 0,
			bytes = 0,
			blobs = 0;
		for (let i = 0; i < ps.length; i++) {
			const p = ps[i];
			if (!p) continue;
			snaps += (p.snapshots || []).length;
			logs += (p.logs || []).length;
			blobs += (p.blobs && p.blobs.size) || 0;
			try {
				p.files.forEach(function (f) {
					if (f && typeof f.text === 'string') texto += f.text.length;
					if (f && f.data) bytes += f.data.byteLength || f.data.length || 0;
				});
			} catch (e) {
				ignorarErro(e, 'diag');
			}
		}
		const temMem = !!(window.performance && performance.memory);
		return {
			projetos: ps.length,
			arquivos: PM.files,
			textoNaMemoria: mb(texto * 2),
			bytesNaMemoria: mb(bytes),
			historicoNaMemoria: mb(PM.histChars * 2),
			snapshots: snaps,
			linhasDeLog: logs,
			blobs: blobs,
			heap: temMem ? mb(performance.memory.usedJSHeapSize) : 'indisponivel',
			heapLimite: temMem ? mb(performance.memory.jsHeapSizeLimit) : 'indisponivel',
			contadores: PM.n,
			tetos: {
				versoesPorArquivo: PM.HIST_MAX,
				historicoGlobal: mb(PM.HIST_BUDGET * 2),
				snapshotsPorProjeto: PM.SNAP_MAX,
				linhasDeConsole: PM.LOG_MAX,
				linhasDaArvore: PM.TREE_MAX,
				salvarCada: esperaSave() + ' ms',
			},
		};
	};

	try {
		registro.info(
			'[Synapse/memoria] patch 33-perf-memoria ativo. Use SYNAPSE_MEM.diag() no console.',
		);
	} catch (e) {
		ignorarErro(e, 'memoria');
	}
})();
