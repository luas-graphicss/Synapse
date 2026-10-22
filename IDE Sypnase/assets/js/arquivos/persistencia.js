'use strict';
(function auroraFixPersistencia() {
	'use strict';
	if (window.SynapsePreviewSession || window.__AURORA_FIX_PERSIST) return;
	const STORE = window.SynapseSessionStore;
	if (!STORE) {
		try {
			registro.aviso(
				'[Synapse/persist] sessao-incremental.js nao carregou; usando a gravacao legada da sessao',
			);
		} catch (e) {
			ignorarErro(e, 'auroraFixPersistencia');
		}
		return;
	}
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



		forgotten: new Set(),
		bootUnverified: false,
		wipeAttempt: null,
		carried: [],
		marker: null,
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
				r = indexedDB.open(window.SynapseSessionStorageNames.databaseName(), 1);
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
				if (window.SynapseCofreGuarda) window.SynapseCofreGuarda.protegerConexao(d, dropDb);
				else
					d.onversionchange = function (ev) {
						if (!ev || ev.newVersion == null) return;
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


		window.sdbGetStrict = async function (k) {
			return withTimeout(kvGet(k), 45000, `IndexedDB get(${k})`);
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

	const QUOTA_RESERVA = 48 * 1024 * 1024;

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
			if (cur && cur.__rw) FX.forceNext = true;
		} catch (e) {
			ignorarErro(e, 'auroraFixPersistencia');
		}
	})();

	FX.forceNext = false;
	FX.allowEmptyOnce = false;
	FX.lastDelta = 0;
	FX.lastWritten = 0;
	FX.lastMs = 0;
	FX.store = STORE;

	let migracaoAvisadaEm = 0;
	function avisarMigracao(p) {
		if (!p || !p.legacy) return;
		const t = now();
		if (t - migracaoAvisadaEm < 4000) return;
		migracaoAvisadaEm = t;
		try {
			toast(
				'Otimizando o armazenamento',
				`Convertendo a sessao para gravacao por arquivo (${p.done}/${p.total}). O editor continua utilizavel.`,
				'ok',
			);
		} catch (e) {
			ignorarErro(e, 'avisarMigracao');
		}
	}

	function metaDaSessao() {
		if (typeof serializeSessionMeta === 'function') return serializeSessionMeta();
		const s = serializeSession();
		s.projects = (s.projects || []).map(function (p) {
			const m = Object.assign({}, p);
			m.nFiles = (p.files || []).length;
			m.nSnaps = (p.snapshots || []).length;
			delete m.files;
			delete m.snapshots;
			return m;
		});
		return s;
	}

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
		if (FX.bootUnverified) {


			FX.lastErr =
				'o indice da sessao nao pode ser lido quando a aba abriu; recarregue a pagina para voltar a gravar com seguranca';
			renderBanner();
			return { ok: false, code: 'boot-nao-verificado', msg: FX.lastErr };
		}
		if (typeof State !== 'undefined' && State.suppressSave)
			return { ok: true, code: 'suprimido', bytes: 0, level: 0 };
		if (STORE.stats.loading) return { ok: true, code: 'carregando', bytes: 0, level: 0 };
		const seq = FX.seq;
		const force = !!FX.forceNext;
		const allowEmpty = !!FX.allowEmptyOnce;
		let level = 0;
		if (FX.quota && FX.usage != null && FX.quota - FX.usage < QUOTA_RESERVA) level = 1;
		let lastError = null;
		while (level <= 4) {
			try {
				const r = await withTimeout(
					STORE.flush({
						reason: reason,
						level: level,
						force: force,
						allowEmpty: allowEmpty,
						writerId: FX.id,
						expectRev: FX.rev,
						revFloor: FX.rev,
						forgotten: FX.forgotten,
						projects: function () {
							return State.projects;
						},
						serializeMeta: metaDaSessao,
						encrypt:
							typeof LOCK !== 'undefined' && LOCK && LOCK.key
								? function (obj) {
										return _encSession(obj);
									}
								: null,
						decrypt:
							typeof LOCK !== 'undefined' && LOCK && LOCK.key
								? function (rec) {
										return _decSession(rec, LOCK.key);
									}
								: null,
						onProgress: avisarMigracao,
					}),
					10 * 60 * 1000,
					'gravacao incremental no IndexedDB',
				);
				if (!r || !r.ok) throw new Error('gravacao incremental devolveu um resultado invalido');
				if (r.skipped && r.code === 'bloqueado') {


					FX.lastErr = r.msg;
					renderBanner();
					return { ok: false, code: r.code, msg: r.msg };
				}
				if (r.skipped) {
					FX.savedSeq = seq;
					renderBanner();
					return { ok: true, code: r.code, bytes: FX.lastBytes, level: 0, rev: FX.rev };
				}
				FX.rev = r.rev;
				FX.savedSeq = seq;
				FX.lastOk = now();
				FX.lastErr = null;
				FX.lastBytes = r.bytes;
				FX.lastDelta = r.delta;
				FX.lastWritten = r.written;
				FX.lastMs = r.ms;
				FX.lastLevel = level;
				FX.fails = 0;
				FX.forceNext = false;
				FX.allowEmptyOnce = false;
				if (r.legacy) {
					try {
						registro.debug(
							`[Synapse/persist] sessao migrada para o formato incremental: ${r.files} arquivo(s), ${mb(r.bytes)}, ${r.ms}ms`,
						);
						toast(
							'Armazenamento otimizado',
							`${r.files} arquivo(s) agora sao gravados individualmente. Salvamentos passam a tocar so o que mudou.`,
							'ok',
						);
					} catch (e) {
						ignorarErro(e, 'doFlush');
					}
				}
				if (level > 0) {
					FX.quotaHits++;
					try {
						registro.aviso(
							`[Synapse/persist] sessao gravada com poda nivel ${level} (${mb(r.bytes)})`,
						);
					} catch (e) {
						ignorarErro(e, 'doFlush');
					}
				}
				aposGravar(r, reason, level);
				renderBanner();
				return { ok: true, bytes: r.bytes, level: level, rev: r.rev, written: r.written };
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
				STORE.dropDb();
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
		return { ok: false, code: 'falha', msg: FX.lastErr, bytes: FX.lastBytes };
	}

	const flushCoordinator = window.SynapseSessionFlushCoordinator.create({
		getSequence: () => FX.seq,
		getSavedSequence: () => FX.savedSeq,
		canReuse: (result) => FX.owner && !FX.lastErr && result.rev === FX.rev,
		flush: async (reason) => {
			const result = await doFlush(reason);
			FX.ultimoFlush = Date.now();
			return result;
		},
	});
	FX.flushState = flushCoordinator.state;

	function flushNow(reason) {
		clearTimeout(FX.timer);
		FX.timer = 0;
		FX.timerEm = 0;
		FX.chain = flushCoordinator.request(reason, {
			force: reason === 'manual' || reason === 'legado' || reason === 'botao',
			immediate: reason === 'pagehide' || reason === 'oculta' || reason === 'saindo',
		});
		return FX.chain;
	}
	FX.flushNow = flushNow;
	FX.pending = function () {
		return FX.seq !== FX.savedSeq;
	};
	window.saveSessionNow = function () {
		return flushNow('manual');
	};

	                                                                                                

	function aposGravar(r, reason, level) {
		try {
			const carried = (r && Array.isArray(r.carried) && r.carried) || [];


			const antes = new Set((FX.carried || []).map((c) => String(c.id)));
			const novos = carried.filter((c) => !antes.has(String(c.id)));
			FX.carried = carried;
			if (novos.length) {
				registro.aviso(
					'[Synapse/persist] o indice ia perder ' +
						novos.length +
						' projeto(s); eles foram mantidos: ' +
						novos.map((c) => c.name).join(', '),
				);
				toast(
					'Projetos protegidos',
					novos.length +
						' projeto(s) que nao estao abertos continuam guardados. Veja em Recentes (relogio).',
					'warn',
				);
				if (typeof recFlagBtn === 'function') recFlagBtn();
			}
		} catch (e) {
			ignorarErro(e, 'aposGravar:carried');
		}
		try {
			const M = window.SynapseCofreManifesto;
			if (M) {
			const disco = window.SynapseCofreDisco;
			FX.marker = M.writeMarker(window.localStorage, {
					t: Date.now(),
					rev: FX.rev,
					persisted: FX.persisted,
					disco: !!(disco && disco.estado().vinculada),
					projects: (typeof State !== 'undefined' && State.projects) || [],
				});
			}
		} catch (e) {
			ignorarErro(e, 'aposGravar:marcador');
		}
		try {
			const disco = window.SynapseCofreDisco;
			if (disco) disco.aoGravar(r, reason, level);
		} catch (e) {
			ignorarErro(e, 'aposGravar:disco');
		}
	}



	FX.forgetProject = async function (pid) {
		FX.seq++;
		FX.forgotten.add(String(pid));
		if (!FX.owner) return flushNow('fechar');
		try {
			await STORE.forgetProject(pid);
		} catch (e) {
			ignorarErro(e, 'forgetProject');
		}
		FX.allowEmptyOnce = true;
		return flushNow('fechar');
	};

	                                                                                          
	                                                                
	FX.rewriteAll = async function (reason) {
		FX.seq++;
		if (!FX.owner) return flushNow(reason || 'reescrever');
		FX.forceNext = true;
		try {
			await revReady;
			FX.rev = await STORE.flagRewrite(FX.id, FX.rev);
		} catch (e) {
			if (e && e.conflict) {
				FX.conflicts++;
				FX.rev = e.conflict.rev;
			}
			ignorarErro(e, 'rewriteAll');
		}
		return flushNow(reason || 'reescrever');
	};

	                                                                                      
	FX.clearAll = async function () {
		if (!FX.owner) {
			try {
				toast('Aba em modo leitura', 'Limpe a sessao pela aba que esta no comando.', 'warn');
			} catch (e) {
				ignorarErro(e, 'clearAll');
			}
			return false;
		}
		await STORE.clearAll();
		FX.rev = 0;
		FX.savedSeq = FX.seq;
		FX.lastBytes = 0;
		FX.lastErr = null;
		FX.carried = [];
		try {

			const M = window.SynapseCofreManifesto;
			if (M) FX.marker = M.writeMarker(window.localStorage, { t: Date.now(), rev: 0, projects: [] });
		} catch (e) {
			ignorarErro(e, 'clearAll:marcador');
		}
		renderBanner();
		return true;
	};

	__sessionFlush = function () {
		return flushNow('legado');
	};
	function minMs() {
		try {
			const m = window.SYNAPSE_MEM10;
			if (m && typeof m.saveMinMs === 'number' && m.saveMinMs > 0) return m.saveMinMs;
		} catch (e) {
			ignorarErro(e, 'minMs');
		}
		return 15000;
	}
	FX.ultimoFlush = 0;
	FX.timerEm = 0;
	function agendarFlush(minimo) {
		if (!FX.owner) {
			renderBanner();
			return;
		}
		const passou = Date.now() - (FX.ultimoFlush || 0);
		let atraso = Math.max(minimo, minMs() - passou);
		if (!(atraso > 0)) atraso = 0;
		const alvo = Date.now() + atraso;
		if (FX.timer && FX.timerEm && FX.timerEm <= alvo) return;
		clearTimeout(FX.timer);
		FX.timerEm = alvo;
		FX.timer = setTimeout(function () {
			FX.timerEm = 0;
			FX.timer = 0;
			flushNow('auto').catch((erro) => ignorarErro(erro, 'persistencia:auto'));
		}, atraso);
	}
	saveSession = function () {
		if (typeof State !== 'undefined' && State.suppressSave) return;
		FX.seq++;
		agendarFlush(400);
	};
	window.saveSessionSuave = function () {
		if (typeof State !== 'undefined' && State.suppressSave) return;
		FX.seq++;
		agendarFlush(minMs());
	};
	setInterval(function () {
		try {
			if (FX.owner && FX.pending() && Date.now() - (FX.ultimoFlush || 0) >= minMs())
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
		bc = new BroadcastChannel(window.SynapseSessionStorageNames.ownerChannelName());
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
				.request(window.SynapseSessionStorageNames.writerLockName(), opts, function (lock) {
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
		const K = window.SynapseSessionStorageNames.ownerStorageKey();
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
				localStorage.setItem(
					window.SynapseSessionStorageNames.ownerStorageKey(),
					JSON.stringify({ id: FX.id, t: now() }),
				);
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
			try {
				if (window.SynapseCofrePainel) window.SynapseCofrePainel.atualizarIndicador();
			} catch (e) {
				ignorarErro(e, 'renderBanner:indicador');
			}
			const bad = !FX.owner || !!FX.lastErr || !!FX.wipeAttempt;
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
			let msg, label, acao, extra;
			const BTN =
				'cursor:pointer;border:0;border-radius:3px;padding:5px 10px;font:600 12px system-ui,sans-serif;background:#fff;color:#111';
			if (FX.wipeAttempt) {
				bar.style.background = '#7f1d1d';
				bar.style.color = '#fff';

				msg = [
					'ALERTA: algo tentou APAGAR o armazenamento da IDE as',
					{ raw: ' ' + hhmm(FX.wipeAttempt.t) + ' ' },
					'(origem:',
					{ raw: ' ' + FX.wipeAttempt.origem + '). ' },
					'A exclusao esta bloqueada enquanto esta aba estiver aberta, mas pode se concluir quando ela fechar. Garanta um backup agora: pasta de backup no disco ou exportar .zip.',
				];
				label = 'Abrir backups';
				acao = function () {
					if (typeof openRecentPanel === 'function') openRecentPanel();
				};
				extra = {
					label: 'Entendi',
					run: function () {
						FX.wipeAttempt = null;
						renderBanner();
					},
				};
			} else if (!FX.owner) {
				bar.style.background = '#7a5b00';
				bar.style.color = '#fff';
				msg =
					'Esta aba esta em MODO LEITURA: outra aba do Synapse esta no comando da sessao. Nada aqui e salvo e os agentes nao falam com esta aba.';
				label = 'Assumir o controle';
				acao = function () {
					FX.takeover();
				};
			} else if (FX.bootUnverified) {
				bar.style.background = '#7a5b00';
				bar.style.color = '#fff';
				msg =
					'O indice da sessao NAO pode ser lido quando esta aba abriu, entao nada esta sendo gravado aqui (gravar por cima poderia descartar projetos que nao chegamos a ver). Seus dados continuam no navegador. Recarregue a pagina para voltar ao normal.';
				label = 'Recarregar a pagina';
				acao = function () {
					location.reload();
				};
			} else {
				bar.style.background = '#7f1d1d';
				bar.style.color = '#fff';
				msg = `A SESSAO NAO ESTA SENDO SALVA: ${FX.lastErr}. Ultima gravacao com sucesso: ${hhmm(FX.lastOk)}. Exporte o projeto em ZIP antes de fechar a aba.`;
				label = 'Tentar gravar agora';
				acao = function () {
					flushNow('botao').then(
						function (r) {
							try {
								toast(
									r.ok ? 'Sessao salva' : 'Ainda falhou',
									r.ok ? 'Gravacao confirmada no navegador.' : r.msg || '',
									r.ok ? 'ok' : 'err',
								);
							} catch (e) {
								ignorarErro(e, 'onclick');
							}
						},
						function (erro) {
							ignorarErro(erro, 'persistencia:botao');
						},
					);
				};
			}
			bar.textContent = '';
			const sp = document.createElement('span');
			if (Array.isArray(msg)) {
				msg.forEach(function (parte) {
					if (parte && typeof parte === 'object') {
						sp.appendChild(document.createTextNode(String(parte.raw || '')));
						return;
					}
					const s = document.createElement('span');
					s.textContent = String(parte);
					sp.appendChild(s);
				});
			} else sp.textContent = msg;
			bar.appendChild(sp);
			const b = document.createElement('button');
			b.textContent = label;
			b.setAttribute('style', BTN);
			b.onclick = acao;
			bar.appendChild(b);
			if (extra) {
				const b2 = document.createElement('button');
				b2.textContent = extra.label;
				b2.setAttribute('style', BTN + ';background:transparent;color:#fff;border:1px solid #fff');
				b2.onclick = extra.run;
				bar.appendChild(b2);
			}
			bar.style.display = 'flex';
		} catch (e) {
			ignorarErro(e, 'renderBanner');
		}
	}

	FX.render = renderBanner;

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
		if (FX.bootUnverified)
			return (
				'\n\n[AVISO DO SYNAPSE] O indice da sessao nao pode ser lido quando a aba abriu; nada esta sendo gravado. ' +
				'Peca ao usuario para recarregar a pagina antes de continuar.'
			);
		if (FX.wipeAttempt)
			return (
				'\n\n[AVISO DO SYNAPSE] Algo tentou APAGAR o armazenamento da IDE (origem: ' +
				FX.wipeAttempt.origem +
				'). A exclusao esta bloqueada por enquanto. Peca ao usuario para garantir um backup (pasta de backup ou .zip) agora.'
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
				if (!mudou || window.SynapseMcpToolDurability?.requiresFlush(params) === false)
					return addNote(res, healthNote());
				if (res && res.isError) return res;
				const r = await flushNow('tool:' + name);
				if (!r || !r.ok || !Number.isFinite(r.rev)) {
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
				return {
					isError: true,
					content: [
						{
							type: 'text',
							text: `Persistence could not be confirmed for "${name}". The in-memory change may exist; inspect the target before retrying. ${(e && e.message) || e}`,
						},
					],
				};
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
					const est = STORE.estimate();
					L.push(
						`Formato: incremental (1 registro por arquivo) | ${est.files} arquivo(s) em ${est.projects} projeto(s) rastreados`,
					);
					L.push(
						`Ultima gravacao tocou ${FX.lastWritten} registro(s) / ${mb(FX.lastDelta)} em ${FX.lastMs}ms | total de gravacoes: ${STORE.stats.flushes}`,
					);
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
					try {
						const pids = await STORE.listManifestPids();
						L.push(
							`Cofre: ${pids.length} manifesto(s) de projeto gravado(s) | projetos devolvidos ao indice por protecao: ${STORE.stats.carried || 0}`,
						);
					} catch (e) {
						ignorarErro(e, 'storage_health:manifestos');
					}
					try {
						const disco = window.SynapseCofreDisco;
						if (disco) {
							const d = disco.estado();
							if (!d.suportado)
								L.push('Pasta de backup no disco: nao suportada neste navegador (use exportar .zip).');
							else if (!d.vinculada)
								L.push('Pasta de backup no disco: NAO vinculada (recomende vincular pelo painel Recentes).');
							else
								L.push(
									`Pasta de backup no disco: "${d.nome}" | permissao: ${d.permissao} | ultimo espelho: ${hhmm(d.ultimoEspelho)} | pendentes: ${d.pendentes}${d.ultimoErro ? ' | erro: ' + d.ultimoErro : ''}`,
								);
						}
					} catch (e) {
						ignorarErro(e, 'storage_health:disco');
					}
					if (FX.wipeAttempt)
						L.push(
							`ALERTA: tentativa de apagar o banco da IDE detectada as ${hhmm(FX.wipeAttempt.t)} (${FX.wipeAttempt.origem}).`,
						);
					if (FX.bootUnverified)
						L.push('ALERTA: indice nao lido no boot; esta aba nao grava ate ser recarregada.');
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


	function aoTentarApagar(detalhe) {
		FX.wipeAttempt = detalhe || { t: now(), origem: 'desconhecida' };
		renderBanner();
		try {
			toast(
				'Tentativa de apagar o armazenamento',
				'A exclusao foi bloqueada. Garanta um backup agora (Recentes > pasta de backup ou exportar .zip).',
				'err',
			);
		} catch (e) {
			ignorarErro(e, 'aoTentarApagar');
		}
		try {
			if (typeof recFlagBtn === 'function') recFlagBtn();
		} catch (e) {
			ignorarErro(e, 'aoTentarApagar');
		}
		try {
			const disco = window.SynapseCofreDisco;
			if (disco) disco.espelharAgora('tentativa-de-exclusao');
		} catch (e) {
			ignorarErro(e, 'aoTentarApagar:disco');
		}
	}
	try {
		if (window.SynapseCofreGuarda)
			window.addEventListener(window.SynapseCofreGuarda.EVENTO, function (ev) {
				aoTentarApagar(ev && ev.detail);
			});
	} catch (e) {
		ignorarErro(e, 'auroraFixPersistencia');
	}



	FX.pedirPersistencia = async function () {
		try {
			if (!(navigator.storage && navigator.storage.persist)) return null;
			FX.persisted = await navigator.storage.persist();
			renderBanner();
			return FX.persisted;
		} catch (e) {
			ignorarErro(e, 'pedirPersistencia');
			return null;
		}
	};

	async function boot() {
		try {
			if (navigator.storage && navigator.storage.persist) {
				const already = navigator.storage.persisted ? await navigator.storage.persisted() : false;
				FX.persisted = already ? true : await navigator.storage.persist();
				if (!FX.persisted)
					registro.aviso(
						'[Synapse/persist] o navegador nao concedeu armazenamento persistente: sob pressao de disco os dados podem ser despejados. Vincule uma pasta de backup no disco.',
					);
			}
		} catch (e) {
			ignorarErro(e, 'boot');
		}
		await refreshQuota();
		renderBanner();
		try {
			const M = window.SynapseCofreManifesto;
			if (M) FX.marker = M.readMarker(window.localStorage);
		} catch (e) {
			ignorarErro(e, 'boot:marcador');
		}
	}

	requestLock(false);
	boot().catch((erro) => ignorarErro(erro, 'persistencia:boot'));
	setInterval(refreshQuota, 60000);
	if (document.readyState === 'loading')
		document.addEventListener('DOMContentLoaded', renderBanner);
	else renderBanner();

	window.addEventListener('pagehide', function () {
		if (FX.owner && FX.pending())
			flushNow('pagehide').catch((erro) => ignorarErro(erro, 'persistencia:pagehide'));
	});
	document.addEventListener('visibilitychange', function () {
		if (document.visibilityState === 'hidden' && FX.owner && FX.pending())
			flushNow('oculta').catch((erro) => ignorarErro(erro, 'persistencia:oculta'));
	});
	window.addEventListener('beforeunload', function (ev) {
		if (!FX.owner) return;
		if (!FX.pending() && !FX.lastErr) return;
		flushNow('saindo').catch((erro) => ignorarErro(erro, 'persistencia:saindo'));
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
