'use strict';
(function auroraFixPersistencia() {
	'use strict';
	if (window.__AURORA_FIX_PERSIST) return;
	window.__AURORA_FIX_PERSIST = '1';

	const FX = (window.AURORA_PERSIST = {
		id: 'aba-' + Math.random().toString(36).slice(2, 8),
		owner: true,
		ownerKnown: false,
		ownerMode: '?',
		rev: 0,
		seq: 0,
		savedSeq: 0,
		chain: null,
		timer: null,
		lastOk: 0,
		lastErr: null,
		lastBytes: 0,
		lastLevel: 0,
		conflicts: 0,
		quotaHits: 0,
		fails: 0,
		persisted: null,
		quota: 0,
		usage: 0,
		softLimit: 180 * 1024 * 1024,
	});

	function now() {
		return Date.now();
	}
	function hhmm(t) {
		if (!t) return 'nunca';
		try {
			return new Date(t).toLocaleTimeString('pt-BR');
		} catch (e) {
			return String(t);
		}
	}
	function mb(n) {
		return (n / 1048576).toFixed(1) + ' MB';
	}
	function withTimeout(p, ms, label) {
		return new Promise(function (res, rej) {
			const to = setTimeout(function () {
				rej(new Error(label + ': tempo esgotado apos ' + ms + 'ms'));
			}, ms);
			p.then(
				function (v) {
					clearTimeout(to);
					res(v);
				},
				function (e) {
					clearTimeout(to);
					rej(e);
				},
			);
		});
	}

	let DBP = null;
	function dropDb() {
		DBP = null;
		try {
			SDB.p = null;
		} catch (e) {
			ignorarErro(e, 'dropDb');
		}
	}
	function dbOpen() {
		if (DBP) return DBP;
		DBP = new Promise(function (res, rej) {
			let r;
			try {
				r = indexedDB.open('aurora-lp', 1);
			} catch (e) {
				DBP = null;
				return rej(e);
			}
			r.onupgradeneeded = function () {
				const d = r.result;
				if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
			};
			r.onsuccess = function () {
				const d = r.result;
				d.onclose = function () {
					dropDb();
				};
				d.onversionchange = function () {
					try {
						d.close();
					} catch (e) {
						ignorarErro(e, 'onversionchange');
					}
					dropDb();
				};
				res(d);
			};
			r.onerror = function () {
				DBP = null;
				rej(r.error || new Error('IndexedDB indisponivel'));
			};
			r.onblocked = function () {};
		});
		return DBP;
	}

	function txDone(t) {
		return new Promise(function (res, rej) {
			t.oncomplete = function () {
				res();
			};
			t.onerror = function () {
				rej(t.error || new Error('transacao falhou'));
			};
			t.onabort = function () {
				rej(t.error || new Error('transacao abortada (cota do navegador?)'));
			};
		});
	}

	async function kvPut(key, val) {
		const d = await dbOpen();
		const t = d.transaction('kv', 'readwrite');
		const done = txDone(t);
		let reqErr = null;
		const rq = t.objectStore('kv').put(val, key);
		rq.onerror = function () {
			reqErr = rq.error;
		};
		try {
			await done;
		} catch (e) {
			throw reqErr || e;
		}
		return true;
	}
	async function kvGet(key) {
		const d = await dbOpen();
		const t = d.transaction('kv', 'readonly');
		const done = txDone(t);
		const rq = t.objectStore('kv').get(key);
		await done;
		return rq.result;
	}
	async function kvDel(key) {
		const d = await dbOpen();
		const t = d.transaction('kv', 'readwrite');
		const done = txDone(t);
		t.objectStore('kv').delete(key);
		await done;
		return true;
	}
	async function kvKeys() {
		const d = await dbOpen();
		const t = d.transaction('kv', 'readonly');
		const done = txDone(t);
		const rq = t.objectStore('kv').getAllKeys();
		await done;
		return rq.result || [];
	}

	async function kvPutSession(rec, expectRev) {
		const d = await dbOpen();
		const t = d.transaction('kv', 'readwrite');
		const st = t.objectStore('kv');
		const done = txDone(t);
		let conflict = null;
		let written = 0;
		let reqErr = null;
		const g = st.get('session');
		g.onsuccess = function () {
			try {
				const cur = g.result;
				const curRev = (cur && cur.__rev) || 0;
				const curW = cur && cur.__w;
				if (cur && curW && curW !== FX.id && curRev > expectRev) {
					conflict = { rev: curRev, w: curW, t: cur.__t || 0 };
					try {
						t.abort();
					} catch (e) {
						ignorarErro(e, 'onsuccess');
					}
					return;
				}
				written = Math.max(curRev, expectRev, FX.rev) + 1;
				rec.__rev = written;
				const pq = st.put(rec, 'session');
				pq.onerror = function () {
					reqErr = pq.error;
				};
			} catch (e) {
				reqErr = e;
				try {
					t.abort();
				} catch (e2) {
					ignorarErro(e2, 'onsuccess');
				}
			}
		};
		g.onerror = function () {
			reqErr = g.error;
		};
		try {
			await done;
		} catch (e) {
			if (conflict) {
				const ce = new Error(
					`outra aba do Synapse gravou uma versao mais nova (rev ${conflict.rev})`,
				);
				ce.conflict = conflict;
				throw ce;
			}
			throw reqErr || e;
		}
		return written;
	}

	try {
		sdb = dbOpen;
		sdbPut = async function (k, v) {
			try {
				await withTimeout(kvPut(k, v), 45000, `IndexedDB put(${k})`);
				return true;
			} catch (e) {
				FX.lastErr = (e && (e.message || e.name)) || String(e);
				try {
					registro.aviso(`[Synapse/persist] falha ao gravar ${k}:`, e);
				} catch (e2) {
					ignorarErro(e2, 'auroraFixPersistencia');
				}
				return false;
			}
		};
		sdbGet = async function (k) {
			try {
				return await withTimeout(kvGet(k), 45000, `IndexedDB get(${k})`);
			} catch (e) {
				try {
					registro.aviso(`[Synapse/persist] falha ao ler ${k}:`, e);
				} catch (e2) {
					ignorarErro(e2, 'auroraFixPersistencia');
				}
				return null;
			}
		};
		sdbDel = async function (k) {
			try {
				await withTimeout(kvDel(k), 45000, 'IndexedDB del');
				return true;
			} catch (e) {
				return false;
			}
		};
		sdbKeys = async function () {
			try {
				return await withTimeout(kvKeys(), 45000, 'IndexedDB keys');
			} catch (e) {
				return [];
			}
		};
	} catch (e) {
		try {
			registro.aviso('[Synapse/persist] nao consegui substituir os helpers sdb*', e);
		} catch (e2) {
			ignorarErro(e2, 'auroraFixPersistencia');
		}
	}

	function estBytes(s) {
		let n = 2048;
		try {
			const ps = s.projects || [];
			for (let i = 0; i < ps.length; i++) {
				const p = ps[i];
				const fl = p.files || [];
				for (let j = 0; j < fl.length; j++) {
					const f = (fl[j] && fl[j][1]) || {};
					if (typeof f.text === 'string') n += f.text.length * 2;
					if (f.data) n += f.data.byteLength || f.data.length || 0;
					const h = f.history || [];
					for (let k = 0; k < h.length; k++)
						if (h[k] && typeof h[k].text === 'string') n += h[k].text.length * 2;
				}
				const sn = p.snapshots || [];
				for (let q = 0; q < sn.length; q++) {
					const sf = (sn[q] && sn[q].files) || [];
					for (let r = 0; r < sf.length; r++) {
						const v = sf[r] && sf[r][1];
						if (v && typeof v.text === 'string') n += v.text.length * 2;
						if (v && v.data) n += v.data.byteLength || v.data.length || 0;
					}
				}
			}
		} catch (e) {
			ignorarErro(e, 'estBytes');
		}
		return n;
	}

	const HIST_KEEP = [2, 1, 1, 1, 0];
	const SNAP_KEEP = [2, 2, 1, 1, 1];

	function trimSession(s, level) {
		const hk = HIST_KEEP[level] != null ? HIST_KEEP[level] : 0;
		const sk = SNAP_KEEP[level] != null ? SNAP_KEEP[level] : 1;
		try {
			const ps = s.projects || [];
			for (let i = 0; i < ps.length; i++) {
				const p = ps[i];
				const fl = p.files || [];
				for (let j = 0; j < fl.length; j++) {
					const ent = fl[j];
					if (!ent || !ent[1]) continue;
					const f = ent[1];
					const h = f.history || [];
					if (h.length > hk) ent[1] = Object.assign({}, f, { history: hk ? h.slice(-hk) : [] });
				}
				const sn = p.snapshots || [];
				if (sn.length > sk) p.snapshots = sn.slice(-sk);
			}
		} catch (e) {
			ignorarErro(e, 'trimSession');
		}
		return s;
	}

	async function gcBackups(level) {
		try {
			const keys = await kvKeys();
			const gens = [],
				recs = [],
				resc = [];
			for (let i = 0; i < keys.length; i++) {
				const k = String(keys[i]);
				if (k.indexOf('session.gen.') === 0) gens.push(k);
				else if (k.indexOf('recent.proj.') === 0) recs.push(k);
				else if (k.indexOf('session.rescue.') === 0) resc.push(k);
			}
			gens.sort();
			recs.sort();
			resc.sort();
			let kill = [];
			if (level >= 1) kill = kill.concat(gens.slice(0, Math.max(0, gens.length - 2)));
			if (level >= 2) kill = kill.concat(recs.slice(0, Math.max(0, recs.length - 5)));
			if (level >= 3) kill = kill.concat(gens, recs.slice(0, Math.max(0, recs.length - 1)));
			if (level >= 4) kill = kill.concat(resc.slice(0, Math.max(0, resc.length - 1)));
			const seen = {};
			for (let j = 0; j < kill.length; j++) {
				if (seen[kill[j]]) continue;
				seen[kill[j]] = 1;
				try {
					await kvDel(kill[j]);
				} catch (e) {
					ignorarErro(e, 'gcBackups');
				}
			}
			return Object.keys(seen).length;
		} catch (e) {
			return 0;
		}
	}

	function isQuota(e) {
		const s = ((e && (e.name || '')) + ' ' + ((e && e.message) || '')).toLowerCase();
		return /quota|cota|abort|storage|space|disk|full/.test(s);
	}

	const revReady = (async function () {
		try {
			const cur = await kvGet('session');
			if (cur && typeof cur.__rev === 'number') FX.rev = cur.__rev;
		} catch (e) {
			ignorarErro(e, 'auroraFixPersistencia');
		}
	})();

	async function doFlush(reason) {
		try {
			await revReady;
		} catch (e) {
			ignorarErro(e, 'doFlush');
		}
		if (!FX.owner) {
			FX.lastErr = 'esta aba esta em modo somente-leitura (outra aba do Synapse esta no comando)';
			return { ok: false, code: 'nao-dono', msg: FX.lastErr };
		}
		if (typeof State !== 'undefined' && State.suppressSave)
			return { ok: true, code: 'suprimido', bytes: 0, level: 0 };
		const seq = FX.seq;
		let s;
		try {
			s = serializeSession();
		} catch (e) {
			FX.fails++;
			FX.lastErr = 'falha ao montar a sessao: ' + ((e && e.message) || e);
			renderBanner();
			return { ok: false, code: 'serializar', msg: FX.lastErr };
		}
		const bytes = estBytes(s);
		let level = 0;
		if (bytes > FX.softLimit) level = 1;
		if (FX.quota && FX.usage != null && FX.quota - FX.usage < bytes * 1.5)
			level = Math.max(level, 1);
		let lastError = null;
		while (level <= 4) {
			if (level > 0) s = trimSession(s, level);
			try {
				const rec =
					typeof LOCK !== 'undefined' && LOCK && LOCK.key
						? await withTimeout(_encSession(s), 60000, 'criptografia da sessao')
						: s;
				if (!rec || typeof rec !== 'object') throw new Error('registro de sessao invalido');
				rec.__w = FX.id;
				rec.__t = now();
				rec.__fx = 2;
				const newRev = await withTimeout(kvPutSession(rec, FX.rev), 60000, 'gravacao no IndexedDB');
				FX.rev = newRev;
				FX.savedSeq = seq;
				FX.lastOk = now();
				FX.lastErr = null;
				FX.lastBytes = bytes;
				FX.lastLevel = level;
				FX.fails = 0;
				if (level > 0) {
					FX.quotaHits++;
					try {
						registro.aviso(
							`[Synapse/persist] sessao gravada com poda nivel ${level} (${mb(bytes)})`,
						);
					} catch (e) {
						ignorarErro(e, 'doFlush');
					}
				}
				renderBanner();
				return { ok: true, bytes: bytes, level: level, rev: newRev };
			} catch (e) {
				lastError = e;
				if (e && e.conflict) {
					FX.conflicts++;
					FX.rev = e.conflict.rev;
					FX.lastErr = e.message;
					renderBanner();
					return { ok: false, code: 'conflito', msg: e.message, conflict: e.conflict };
				}
				if (isQuota(e)) {
					await gcBackups(level + 1);
					level++;
					continue;
				}
				dropDb();
				if (level < 1) {
					level = 1;
					continue;
				}
				break;
			}
		}
		FX.fails++;
		FX.lastErr =
			(lastError && (lastError.message || lastError.name)) || 'erro desconhecido ao gravar';
		try {
			registro.erro('[Synapse/persist] NAO consegui gravar a sessao:', lastError);
		} catch (e) {
			ignorarErro(e, 'doFlush');
		}
		renderBanner();
		try {
			toast(
				'Sessao NAO foi salva',
				FX.lastErr + ' - exporte o projeto antes de fechar a aba.',
				'err',
			);
		} catch (e) {
			ignorarErro(e, 'doFlush');
		}
		return { ok: false, code: 'falha', msg: FX.lastErr, bytes: bytes };
	}

	function flushNow(reason) {
		const run = function () {
			return doFlush(reason);
		};
		FX.chain = (FX.chain || Promise.resolve()).then(run, run);
		return FX.chain;
	}
	FX.flushNow = flushNow;
	FX.pending = function () {
		return FX.seq !== FX.savedSeq;
	};
	window.saveSessionNow = function () {
		return flushNow('manual');
	};

	__sessionFlush = function () {
		return flushNow('legado');
	};
	saveSession = function () {
		if (typeof State !== 'undefined' && State.suppressSave) return;
		FX.seq++;
		if (!FX.owner) {
			renderBanner();
			return;
		}
		clearTimeout(FX.timer);
		FX.timer = setTimeout(function () {
			flushNow('auto').catch((erro) => ignorarErro(erro, 'persistencia:auto'));
		}, 400);
	};
	setInterval(function () {
		try {
			if (FX.owner && FX.pending())
				flushNow('intervalo').catch((erro) => ignorarErro(erro, 'persistencia:intervalo'));
		} catch (e) {
			ignorarErro(e, 'auroraFixPersistencia');
		}
	}, 5000);

	const origRestore = restoreSession;
	restoreSession = function (data) {
		try {
			if (data && typeof data.__rev === 'number') FX.rev = data.__rev;
		} catch (e) {
			ignorarErro(e, 'auroraFixPersistencia');
		}
		try {
			return origRestore(data);
		} finally {
			try {
				State.suppressSave = false;
			} catch (e) {
				ignorarErro(e, 'auroraFixPersistencia');
			}
		}
	};

	let bc = null;
	try {
		bc = new BroadcastChannel('aurora.session.owner');
	} catch (e) {
		ignorarErro(e, 'auroraFixPersistencia');
	}
	let releaseLock = null;

	function softDisconnectMcp() {
		try {
			if (typeof MCP === 'undefined' || !MCP) return;
			MCP.pollGen = (MCP.pollGen || 0) + 1;
			try {
				clearTimeout(MCP.retryT);
			} catch (e) {
				ignorarErro(e, 'softDisconnectMcp');
			}
			try {
				clearTimeout(MCP.helloT);
			} catch (e) {
				ignorarErro(e, 'softDisconnectMcp');
			}
			try {
				clearInterval(MCP.pingT);
			} catch (e) {
				ignorarErro(e, 'softDisconnectMcp');
			}
			try {
				if (MCP.ws) {
					MCP.ws.onclose = null;
					MCP.ws.onerror = null;
					MCP.ws.close();
					MCP.ws = null;
				}
			} catch (e) {
				ignorarErro(e, 'softDisconnectMcp');
			}
			try {
				if (MCP.es) {
					MCP.es.close();
					MCP.es = null;
				}
			} catch (e) {
				ignorarErro(e, 'softDisconnectMcp');
			}
			MCP.active = false;
			MCP.status = 'off';
			try {
				mcpLog(
					'err',
					'MCP desligado nesta aba: outra aba do Synapse esta no comando. Isso evita que duas abas gravem por cima uma da outra.',
				);
			} catch (e) {
				ignorarErro(e, 'softDisconnectMcp');
			}
			try {
				mcpRenderPanel();
			} catch (e) {
				ignorarErro(e, 'softDisconnectMcp');
			}
		} catch (e) {
			ignorarErro(e, 'softDisconnectMcp');
		}
	}

	function setOwner(v, why) {
		const changed = FX.owner !== !!v || !FX.ownerKnown;
		FX.owner = !!v;
		FX.ownerKnown = true;
		if (!changed) {
			renderBanner();
			return;
		}
		if (!v) {
			softDisconnectMcp();
			try {
				toast(
					'Aba em modo leitura',
					'Outra aba do Synapse esta no comando. Use o aviso no topo para assumir.',
					'warn',
				);
			} catch (e) {
				ignorarErro(e, 'setOwner');
			}
		} else {
			try {
				registro.debug(`[Synapse/persist] esta aba assumiu a sessao (${why || ''})`);
			} catch (e) {
				ignorarErro(e, 'setOwner');
			}
			if (FX.seq !== FX.savedSeq)
				flushNow('assumiu').catch((erro) => ignorarErro(erro, 'persistencia:assumiu'));
		}
		renderBanner();
	}

	function requestLock(blocking) {
		if (!navigator.locks || !navigator.locks.request) return legacyElect();
		FX.ownerMode = 'weblocks';
		const opts = blocking ? {} : { ifAvailable: true };
		try {
			navigator.locks
				.request('aurora.session.writer', opts, function (lock) {
					if (!lock) {
						setOwner(false, 'lock ocupado');
						setTimeout(function () {
							requestLock(true);
						}, 0);
						return;
					}
					setOwner(true, 'lock obtido');
					return new Promise(function (res) {
						releaseLock = function () {
							releaseLock = null;
							res();
						};
					});
				})
				.catch(function () {
					legacyElect();
				});
		} catch (e) {
			legacyElect();
		}
	}

	let legacyStarted = false;
	function legacyElect() {
		if (legacyStarted) return;
		legacyStarted = true;
		FX.ownerMode = 'heartbeat';
		const K = 'aurora.session.owner';
		function rd() {
			try {
				return JSON.parse(localStorage.getItem(K) || 'null');
			} catch (e) {
				return null;
			}
		}
		function beat() {
			try {
				localStorage.setItem(K, JSON.stringify({ id: FX.id, t: now() }));
			} catch (e) {
				ignorarErro(e, 'beat');
			}
		}
		const cur = rd();
		if (cur && cur.id !== FX.id && now() - (cur.t || 0) < 8000)
			setOwner(false, 'heartbeat de outra aba');
		else {
			beat();
			setOwner(true, 'heartbeat livre');
		}
		setInterval(function () {
			const c = rd();
			if (FX.owner) {
				if (c && c.id !== FX.id && (c.t || 0) > now() - 4000) setOwner(false, 'outra aba assumiu');
				else beat();
			} else if (!c || now() - (c.t || 0) > 8000) {
				beat();
				setOwner(true, 'a dona sumiu');
			}
		}, 3000);
	}

	FX.takeover = function () {
		try {
			if (bc) bc.postMessage({ t: 'takeover', id: FX.id });
		} catch (e) {
			ignorarErro(e, 'takeover');
		}
		if (FX.ownerMode === 'heartbeat') {
			try {
				localStorage.setItem('aurora.session.owner', JSON.stringify({ id: FX.id, t: now() }));
			} catch (e) {
				ignorarErro(e, 'takeover');
			}
			setOwner(true, 'assumiu manualmente');
		}
		try {
			toast(
				'Assumindo a sessao',
				'Se outra aba estava no comando, ela vai para o modo leitura.',
				'ok',
			);
		} catch (e) {
			ignorarErro(e, 'takeover');
		}
	};

	if (bc) {
		bc.onmessage = function (ev) {
			const m = (ev && ev.data) || {};
			if (m.t === 'takeover' && m.id !== FX.id && FX.owner) {
				setOwner(false, 'outra aba pediu o comando');
				try {
					if (releaseLock) releaseLock();
				} catch (e) {
					ignorarErro(e, 'onmessage');
				}
				setTimeout(function () {
					requestLock(true);
				}, 800);
			}
		};
	}

	let bar = null;
	function renderBanner() {
		try {
			if (!document.body) return;
			const bad = !FX.owner || !!FX.lastErr;
			if (!bad) {
				if (bar) bar.style.display = 'none';
				return;
			}
			if (!bar) {
				bar = document.createElement('div');
				bar.id = 'auroraPersistBar';
				bar.setAttribute(
					'style',
					'position:fixed;left:0;right:0;top:0;z-index:2147483000;font:13px/1.35 system-ui,' +
						'sans-serif;padding:8px 12px;display:flex;gap:10px;align-items:center;justify-content:' +
						'center;flex-wrap:wrap;box-shadow:0 2px 10px rgba(0,0,0,.35)',
				);
				document.body.appendChild(bar);
			}
			let msg, label;
			if (!FX.owner) {
				bar.style.background = '#7a5b00';
				bar.style.color = '#fff';
				msg =
					'Esta aba esta em MODO LEITURA: outra aba do Synapse esta no comando da sessao. Nada aqui e salvo e os agentes nao falam com esta aba.';
				label = 'Assumir o controle';
			} else {
				bar.style.background = '#7f1d1d';
				bar.style.color = '#fff';
				msg = `A SESSAO NAO ESTA SENDO SALVA: ${FX.lastErr}. Ultima gravacao com sucesso: ${hhmm(FX.lastOk)}. Exporte o projeto em ZIP antes de fechar a aba.`;
				label = 'Tentar gravar agora';
			}
			bar.textContent = '';
			const sp = document.createElement('span');
			sp.textContent = msg;
			bar.appendChild(sp);
			const b = document.createElement('button');
			b.textContent = label;
			b.setAttribute(
				'style',
				'cursor:pointer;border:0;border-radius:6px;padding:5px 10px;font:600 12px system-ui,sans-serif;background:#fff;color:#111',
			);
			b.onclick = function () {
				if (!FX.owner) FX.takeover();
				else
					flushNow('botao').then(function (r) {
						try {
							toast(
								r.ok ? 'Sessao salva' : 'Ainda falhou',
								r.ok ? 'Gravacao confirmada no navegador.' : r.msg || '',
								r.ok ? 'ok' : 'err',
							);
						} catch (e) {
							ignorarErro(e, 'onclick');
						}
					});
			};
			bar.appendChild(b);
			bar.style.display = 'flex';
		} catch (e) {
			ignorarErro(e, 'renderBanner');
		}
	}

	function addNote(res, extra) {
		try {
			if (!res || !extra) return res;
			if (!Array.isArray(res.content)) return res;
			const c0 = res.content[0];
			if (c0 && c0.type === 'text' && typeof c0.text === 'string') c0.text = c0.text + extra;
			else res.content.push({ type: 'text', text: extra });
		} catch (e) {
			ignorarErro(e, 'addNote');
		}
		return res;
	}

	function healthNote() {
		if (!FX.owner)
			return (
				'\n\n[AVISO DO SYNAPSE] Esta aba do editor esta em MODO LEITURA porque outra aba assumiu a sessao. ' +
				'Nada gravado aqui sobrevive a um reload. Peca ao usuario para deixar UMA unica aba do Synapse aberta.'
			);
		if (FX.lastErr)
			return `\n\n[AVISO DO SYNAPSE] A ultima gravacao da sessao FALHOU (${FX.lastErr}). Ultimo salvamento \
confirmado: ${hhmm(FX.lastOk)}. Trate tudo depois desse horario como nao persistido.`;
		return '';
	}

	function failText(name, r) {
		const base = `FALHA DE PERSISTENCIA em ${name}: a alteracao foi aplicada na memoria do editor mas \
NAO foi gravada no navegador, entao ela some se a pagina recarregar. Motivo: ${r.msg || r.code || 'desconhecido'}. `;
		if (r.code === 'conflito')
			return (
				base +
				'Existe MAIS DE UMA aba/dispositivo com este projeto aberto e eles estao gravando por cima um do outro. ' +
				'Nao repita a gravacao: peca ao usuario para fechar as outras abas do Synapse, recarregar a que ficou e so entao continuar.'
			);
		if (r.code === 'nao-dono')
			return (
				base +
				'Esta aba esta em modo somente-leitura porque outra aba do Synapse esta no comando. ' +
				'Pare de escrever e peca ao usuario para usar apenas uma aba.'
			);
		return (
			base +
			'Provavel falta de espaco no armazenamento do navegador. Nao adianta repetir a mesma gravacao: ' +
			'peca ao usuario para exportar o projeto em ZIP agora e liberar espaco (apagar projetos antigos ou snapshots) antes de continuar.'
		);
	}

	if (typeof mcpToolCall === 'function') {
		const origToolCall = mcpToolCall;
		mcpToolCall = async function (params) {
			const name = (params && params.name) || '?';
			const before = FX.seq;
			const res = await origToolCall(params);
			try {
				const mudou = FX.seq !== before;
				if (!mudou) return addNote(res, healthNote());
				if (res && res.isError) return res;
				const r = await flushNow('tool:' + name);
				if (!r || !r.ok) {
					mcpLog(
						'err',
						name + ': gravacao NAO persistida (' + ((r && (r.msg || r.code)) || '?') + ')',
					);
					return { content: [{ type: 'text', text: failText(name, r || {}) }], isError: true };
				}
				return addNote(
					res,
					'\n[persistido: rev ' +
						r.rev +
						(r.level ? `, historico antigo podado (nivel ${r.level}) por falta de espaco` : '') +
						']',
				);
			} catch (e) {
				return addNote(
					res,
					`\n[AVISO: nao foi possivel confirmar a gravacao: ${(e && e.message) || e}]`,
				);
			}
		};
	}

	try {
		if (typeof MCP_TOOLS !== 'undefined' && Array.isArray(MCP_TOOLS)) {
			MCP_TOOLS.push({
				name: 'storage_health',
				title: 'Saude do armazenamento',
				desc:
					'Diz se as gravacoes estao realmente sendo persistidas no navegador: ultima gravacao ' +
					'confirmada, tamanho da sessao, cota disponivel, se ha outra aba disputando a sessao e ' +
					'se houve poda de historico. Chame quando desconfiar que uma edicao nao pegou.',
				schema: { type: 'object', properties: {} },
				run: async function () {
					await refreshQuota();
					const L = [];
					L.push(
						`Aba: ${FX.id} | ${FX.owner ? 'DONA da sessao (grava)' : 'SOMENTE LEITURA (outra aba esta no comando)'} | eleicao: ${FX.ownerMode}`,
					);
					L.push(`Ultima gravacao confirmada: ${hhmm(FX.lastOk)} (revisao ${FX.rev})`);
					L.push('Alteracoes pendentes: ' + (FX.pending() ? 'SIM' : 'nao'));
					L.push('Tamanho estimado da sessao: ' + mb(FX.lastBytes));
					if (FX.quota) L.push(`Cota do navegador: ${mb(FX.usage)} em uso de ${mb(FX.quota)}`);
					L.push(
						'Armazenamento persistente concedido: ' +
							(FX.persisted === null
								? 'desconhecido'
								: FX.persisted
									? 'sim'
									: 'NAO (o navegador pode despejar os dados)'),
					);
					L.push(
						`Podas por falta de espaco: ${FX.quotaHits} | conflitos entre abas: ${FX.conflicts} | falhas seguidas: ${FX.fails}`,
					);
					if (FX.lastLevel)
						L.push(
							`ATENCAO: a ultima gravacao precisou podar historico/snapshots (nivel ${FX.lastLevel}).`,
						);
					if (FX.lastErr) L.push('ERRO ATUAL: ' + FX.lastErr);
					else L.push('Sem erros de gravacao no momento.');
					return L.join('\n');
				},
			});
		}
	} catch (e) {
		ignorarErro(e, 'auroraFixPersistencia');
	}

	function onDisplaced() {
		FX.displaced = true;
		softDisconnectMcp();
		FX.lastErr =
			'outro navegador ou dispositivo entrou com o MESMO sid/token e assumiu a sessao MCP. Esta aba parou de atender agentes para nao devolver um projeto desatualizado.';
		renderBanner();
		try {
			toast(
				'Sessao MCP assumida em outro lugar',
				'Feche a outra aba/dispositivo e clique em conectar de novo aqui.',
				'err',
			);
		} catch (e) {
			ignorarErro(e, 'onDisplaced');
		}
	}
	setInterval(function () {
		try {
			const ws = typeof MCP !== 'undefined' && MCP ? MCP.ws : null;
			if (ws && !ws.__auroraGuard) {
				ws.__auroraGuard = 1;
				ws.addEventListener('message', function (ev) {
					let m = null;
					try {
						m = JSON.parse(typeof ev.data === 'string' ? ev.data : '{}');
					} catch (e) {
						return;
					}
					if (m && m.t === 'displaced') onDisplaced();
				});
			}
		} catch (e) {
			ignorarErro(e, 'auroraFixPersistencia');
		}
	}, 2500);

	async function refreshQuota() {
		try {
			if (navigator.storage && navigator.storage.estimate) {
				const est = await navigator.storage.estimate();
				FX.quota = est.quota || 0;
				FX.usage = est.usage || 0;
			}
		} catch (e) {
			ignorarErro(e, 'refreshQuota');
		}
	}

	async function boot() {
		try {
			if (navigator.storage && navigator.storage.persist) {
				const already = navigator.storage.persisted ? await navigator.storage.persisted() : false;
				FX.persisted = already ? true : await navigator.storage.persist();
				if (!FX.persisted)
					registro.aviso(
						'[Synapse/persist] o navegador nao concedeu armazenamento persistente: sob pressao de disco os dados podem ser despejados. Exporte ZIPs com frequencia.',
					);
			}
		} catch (e) {
			ignorarErro(e, 'boot');
		}
		await refreshQuota();
		renderBanner();
	}

	requestLock(false);
	boot();
	setInterval(refreshQuota, 60000);
	if (document.readyState === 'loading')
		document.addEventListener('DOMContentLoaded', renderBanner);
	else renderBanner();

	window.addEventListener('pagehide', function () {
		if (FX.owner && FX.pending()) flushNow('pagehide');
	});
	document.addEventListener('visibilitychange', function () {
		if (document.visibilityState === 'hidden' && FX.owner && FX.pending()) flushNow('oculta');
	});
	window.addEventListener('beforeunload', function (ev) {
		if (!FX.owner) return;
		if (!FX.pending() && !FX.lastErr) return;
		flushNow('saindo');
		ev.preventDefault();
		ev.returnValue = '';
		return '';
	});

	try {
		registro.debug(
			`[Synapse/persist] protecao de gravacao ativa (${FX.id}). Diagnostico: window.AURORA_PERSIST`,
		);
	} catch (e) {
		ignorarErro(e, 'auroraFixPersistencia');
	}
})();
