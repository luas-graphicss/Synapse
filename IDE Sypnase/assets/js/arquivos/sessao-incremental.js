'use strict';
(function sessaoIncremental(root) {
	'use strict';
	if (root.SynapseSessionStore) return;

	                                                           
	                                                                                               
	                                                                                               
	                                                                        
	                                                                                                 
	                                                                                                
	                                                                              












	const META_KEY = 'session';
	const FILE_PREFIX = 'pf:';
	const SNAP_PREFIX = 'ps:';
	const MANIFEST_PREFIX = 'pm:';
	const COFRE_PREFIX = 'cofre.';
	const LOST_PREFIX = 'session.lost.';
	const FORMAT = 2;
	const STRICT = { durability: 'strict' };
	const KEYS_PAGE = 1000;
	const HIGH = '\uffff';
	const BATCH_BYTES = 2 * 1024 * 1024;
	const BATCH_RECORDS = 150;
	const LOAD_PAGE = 300;
	const HIST_KEEP = [1, 1, 1, 0, 0];
	const SNAP_KEEP = [1, 1, 1, 1, 0];

	const stats = {
		flushes: 0,
		written: 0,
		deleted: 0,
		lastWritten: 0,
		lastDeleted: 0,
		lastDeltaBytes: 0,
		lastMs: 0,
		lastReason: '',
		migrated: false,
		loading: false,
	};

	function ignorar(e, ctx) {
		try {
			if (typeof root.ignorarErro === 'function') root.ignorarErro(e, ctx);
		} catch (e2) {
			                             
		}
	}

	let DBP = null;
	function dropDb() {
		DBP = null;
	}
	function dbOpen() {
		if (DBP) return DBP;
		DBP = new Promise(function (res, rej) {
			let r;
			try {
				r = indexedDB.open(root.SynapseSessionStorageNames.databaseName(), 1);
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
				d.onclose = dropDb;
				if (root.SynapseCofreGuarda) root.SynapseCofreGuarda.protegerConexao(d, dropDb);
				else
					d.onversionchange = function (ev) {

						if (!ev || ev.newVersion == null) return;
						try {
							d.close();
						} catch (e) {
							ignorar(e, 'sessaoIncremental:onversionchange');
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

	                                                                                            
	                                                                                
	async function tx(mode, fn, txOpts) {
		const d = await dbOpen();
		let t;
		try {
			t = txOpts ? d.transaction('kv', mode, txOpts) : d.transaction('kv', mode);
		} catch (e) {
			t = d.transaction('kv', mode);
		}
		const st = t.objectStore('kv');
		const done = txDone(t);
		let reqErr = null;
		function track(rq) {
			rq.onerror = function () {
				reqErr = rq.error;
			};
			return rq;
		}
		const out = fn(st, track);
		try {
			await done;
		} catch (e) {
			throw reqErr || e;
		}
		return typeof out === 'function' ? out() : out;
	}

	function kvGet(key) {
		return tx('readonly', function (st, track) {
			const rq = track(st.get(key));
			return function () {
				return rq.result;
			};
		});
	}

	function kvPut(key, value, strict) {
		return tx(
			'readwrite',
			function (st, track) {
				track(st.put(value, key));
			},
			strict ? STRICT : null,
		);
	}

	function kvDel(key) {
		return tx('readwrite', function (st, track) {
			track(st.delete(key));
		});
	}

	function deleteRange(prefix) {
		return tx('readwrite', function (st, track) {
			track(st.delete(IDBKeyRange.bound(prefix, prefix + HIGH, false, false)));
		});
	}


	async function keysByPrefix(prefix, onKey) {
		const upper = prefix + HIGH;
		let range = IDBKeyRange.bound(prefix, upper, false, false);
		let n = 0;
		for (;;) {
			const keys = await tx('readonly', function (st, track) {
				const rq = track(st.getAllKeys(range, KEYS_PAGE));
				return function () {
					return rq.result || [];
				};
			});
			if (!keys.length) break;
			for (let i = 0; i < keys.length; i++) {
				onKey(String(keys[i]));
				n++;
			}
			if (keys.length < KEYS_PAGE) break;
			range = IDBKeyRange.bound(keys[keys.length - 1], upper, true, false);
			await yieldToBrowser();
		}
		return n;
	}


	async function countFilesByProject() {
		const M = root.SynapseCofreManifesto;
		const counts = new Map();
		await keysByPrefix(FILE_PREFIX, function (key) {
			const pid = M ? M.pidFromFileKey(key) : null;
			if (pid == null) return;
			counts.set(pid, (counts.get(pid) || 0) + 1);
		});
		return counts;
	}

	async function listManifestPids() {
		const out = [];
		await keysByPrefix(MANIFEST_PREFIX, function (key) {
			out.push(key.slice(MANIFEST_PREFIX.length));
		});
		return out;
	}

	function yieldToBrowser() {
		                                                                                        
		                                                         
		if (typeof document !== 'undefined' && document.hidden) return Promise.resolve();
		try {
			if (root.scheduler && typeof root.scheduler.yield === 'function')
				return root.scheduler.yield().catch(function () {});
		} catch (e) {
			ignorar(e, 'sessaoIncremental:yield');
		}
		return new Promise(function (res) {
			try {
				const ch = new MessageChannel();
				ch.port1.onmessage = function () {
					ch.port1.close();
					res();
				};
				ch.port2.postMessage(0);
			} catch (e) {
				setTimeout(res, 0);
			}
		});
	}

	function bytesOfFile(f) {
		let n = 64;
		if (typeof f.text === 'string') n += f.text.length * 2;
		else if (f.data) n += f.data.byteLength || f.data.length || 0;
		return n;
	}
	function bytesOfSnapEntry(ent) {
		const v = ent && ent[1];
		let n = 48 + ((ent && ent[0] && ent[0].length * 2) || 0);
		if (v && typeof v.text === 'string') n += v.text.length * 2;
		return n;
	}

	function persistHist(level, nFiles) {
		const PM = root.SYNAPSE_MEM || null;
		let keep = PM && typeof PM.PERSIST_HIST === 'number' ? PM.PERSIST_HIST : 1;
		if (nFiles > 600) keep = 0;
		const cap = HIST_KEEP[level] != null ? HIST_KEEP[level] : 0;
		return Math.max(0, Math.min(keep, cap));
	}
	function persistSnaps(level) {
		const PM = root.SYNAPSE_MEM || null;
		const keep = PM && typeof PM.PERSIST_SNAP === 'number' ? PM.PERSIST_SNAP : 1;
		const cap = SNAP_KEEP[level] != null ? SNAP_KEEP[level] : 0;
		return Math.max(0, Math.min(keep, cap));
	}

	function fileRecord(path, f, histKeep) {
		const text = typeof f.text === 'string' ? f.text : null;
		const rec = {
			path: f.path || path,
			text: text,
			data: text != null ? null : f.data || null,
			isText: !!f.isText,
			history: [],
		};
		const h = f.history;
		if (histKeep > 0 && Array.isArray(h) && h.length) {
			for (let k = Math.max(0, h.length - histKeep); k < h.length; k++) {
				const e = h[k];
				if (!e || typeof e.text !== 'string' || e.text === text) continue;
				rec.history.push(e);
			}
		}
		return rec;
	}

	                                                                                    
	const shadow = new Map();
	function shadowFor(pid) {
		let s = shadow.get(pid);
		if (!s) {
			s = { files: new Map(), snaps: new Map(), manifest: null };
			shadow.set(pid, s);
		}
		return s;
	}
	function mark(f) {
		const h = f.history;
		const hl = Array.isArray(h) ? h.length : 0;
		return {
			text: f.text,
			data: f.data,
			isText: !!f.isText,
			hlen: hl,
			hlast: hl ? h[hl - 1] : null,
			bytes: bytesOfFile(f),
		};
	}
	function same(s, f) {
		if (!s) return false;
		if (s.text !== f.text || s.data !== f.data || s.isText !== !!f.isText) return false;
		const h = f.history;
		const hl = Array.isArray(h) ? h.length : 0;
		if (hl !== s.hlen) return false;
		if (hl && h[hl - 1] !== s.hlast) return false;
		return true;
	}
	function resetShadow(pid) {
		if (pid == null) shadow.clear();
		else shadow.delete(pid);
	}

	function conflictOf(cur, expectRev, writer) {
		const curRev = (cur && cur.__rev) || 0;
		const curW = cur && cur.__w;
		if (cur && curW && writer && curW !== writer && curRev > expectRev)
			return { rev: curRev, w: curW, t: cur.__t || 0 };
		return null;
	}
	function conflictError(c) {
		const ce = new Error(`outra aba do Synapse gravou uma versao mais nova (rev ${c.rev})`);
		ce.conflict = c;
		return ce;
	}

	async function putMeta(rec, expectRev, writer, revFloor) {
		const d = await dbOpen();
		let t;
		try {
			t = d.transaction('kv', 'readwrite', STRICT);
		} catch (e) {
			t = d.transaction('kv', 'readwrite');
		}
		const st = t.objectStore('kv');
		const done = txDone(t);
		let conflict = null;
		let written = 0;
		let reqErr = null;
		const g = st.get(META_KEY);
		g.onsuccess = function () {
			try {
				const cur = g.result;
				conflict = conflictOf(cur, expectRev, writer);
				if (conflict) {
					try {
						t.abort();
					} catch (e) {
						ignorar(e, 'sessaoIncremental:putMeta');
					}
					return;
				}
				const curRev = (cur && cur.__rev) || 0;
				written = Math.max(curRev, expectRev, revFloor || 0) + 1;
				rec.__rev = written;
				const pq = st.put(rec, META_KEY);
				pq.onerror = function () {
					reqErr = pq.error;
				};
			} catch (e) {
				reqErr = e;
				try {
					t.abort();
				} catch (e2) {
					ignorar(e2, 'sessaoIncremental:putMeta');
				}
			}
		};
		g.onerror = function () {
			reqErr = g.error;
		};
		try {
			await done;
		} catch (e) {
			if (conflict) throw conflictError(conflict);
			throw reqErr || e;
		}
		return written;
	}

	function isIncremental(rec) {
		return !!(rec && typeof rec === 'object' && rec.inc === 1);
	}
	function hasProjects(rec) {
		return !!(rec && (rec.enc || (Array.isArray(rec.projects) && rec.projects.length)));
	}

	function splitSnapshot(snap) {
		const parts = [];
		let cur = [];
		let curBytes = 0;
		const files = Array.isArray(snap.files) ? snap.files : [];
		for (let i = 0; i < files.length; i++) {
			const b = bytesOfSnapEntry(files[i]);
			if (cur.length && curBytes + b > BATCH_BYTES) {
				parts.push(cur);
				cur = [];
				curBytes = 0;
			}
			cur.push(files[i]);
			curBytes += b;
		}
		if (cur.length || !parts.length) parts.push(cur);
		return parts.map(function (list, idx) {
			return {
				id: snap.id,
				t: snap.t || 0,
				label: snap.label || '',
				part: idx,
				parts: parts.length,
				files: list,
			};
		});
	}
	function snapPartKey(pid, sid, idx) {
		return SNAP_PREFIX + pid + ':' + sid + ':' + String(idx).padStart(4, '0');
	}

	let activeFlush = null;

	async function flush(opts) {
		                                                                                       
		while (activeFlush) {
			try {
				await activeFlush;
			} catch (e) {
				                                                            
			}
		}
		const p = flushInner(opts || {});
		activeFlush = p;
		try {
			return await p;
		} finally {
			if (activeFlush === p) activeFlush = null;
		}
	}

	async function flushInner(opts) {
		const t0 = Date.now();
		const projects =
			(typeof opts.projects === 'function' ? opts.projects() : opts.projects) || [];
		const level = Math.max(0, opts.level | 0);
		const encrypt = typeof opts.encrypt === 'function' ? opts.encrypt : null;
		const force = !!opts.force;
		const writer = opts.writerId || '';
		const expectRev = typeof opts.expectRev === 'number' ? opts.expectRev : 0;
		const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null;

		const cur = await kvGet(META_KEY);
		const early = conflictOf(cur, expectRev, writer);
		if (early) throw conflictError(early);
		const legacy = !!(cur && !isIncremental(cur) && hasProjects(cur));
		if (!projects.length && !opts.allowEmpty && hasProjects(cur)) {
			                                                                               
			                                                                  
			return {
				ok: true,
				skipped: true,
				code: 'vazio-protegido',
				rev: (cur && cur.__rev) || expectRev,
				bytes: 0,
				delta: 0,
				written: 0,
				deleted: 0,
				files: 0,
				legacy: false,
			};
		}
		if (cur && cur.enc && !encrypt && !force) {




			return {
				ok: true,
				skipped: true,
				code: 'bloqueado',
				msg: 'a sessao gravada esta protegida por senha: desbloqueie (cadeado) para voltar a gravar',
				rev: (cur && cur.__rev) || expectRev,
				bytes: 0,
				delta: 0,
				written: 0,
				deleted: 0,
				files: 0,
				legacy: false,
			};
		}

		const plan = { dels: [], puts: [], snapWrites: [], snapDels: [] };
		let total = 0;
		let nFiles = 0;
		for (let i = 0; i < projects.length; i++) {
			const p = projects[i];
			if (!p || p.id == null || !p.files || typeof p.files.forEach !== 'function') continue;
			const pid = String(p.id);
			const sh = shadowFor(pid);
			const histKeep = persistHist(level, p.files.size || 0);
			const prefix = FILE_PREFIX + pid + ':';
			const seen = new Set();
			let matched = 0;
			p.files.forEach(function (f, path) {
				if (!f || typeof path !== 'string') return;
				seen.add(path);
				nFiles++;
				const prev = sh.files.get(path);
				if (prev) matched++;
				if (prev && !force && same(prev, f)) {
					total += prev.bytes;
					return;
				}
				const bytes = bytesOfFile(f);
				total += bytes;
				plan.puts.push({
					key: prefix + path,
					pid: pid,
					bytes: bytes,
					prepare: function () {
						                                                                           
						                                        
						return { mark: mark(f), value: fileRecord(path, f, histKeep) };
					},
					after: function (prepared) {
						sh.files.set(path, prepared.mark);
					},
				});
			});
			                                                                                   
			if (sh.files.size > matched)
				sh.files.forEach(function (_v, path) {
					if (seen.has(path)) return;
					plan.dels.push({
						key: prefix + path,
						pid: pid,
						after: function () {
							sh.files.delete(path);
						},
					});
				});

			const keepSnaps = persistSnaps(level);
			const snaps = Array.isArray(p.snapshots) ? p.snapshots : [];
			const want = keepSnaps > 0 ? snaps.slice(-keepSnaps) : [];
			const wantIds = new Set();
			for (let q = 0; q < want.length; q++) {
				const s = want[q];
				if (!s || s.id == null) continue;
				const sid = String(s.id);
				wantIds.add(sid);
				const prev = sh.snaps.get(sid);
				if (prev && prev.ref === s && !force) continue;
				plan.snapWrites.push({ pid: pid, sid: sid, snap: s, sh: sh });
			}
			sh.snaps.forEach(function (_v, sid) {
				if (!wantIds.has(sid)) plan.snapDels.push({ pid: pid, sid: sid, sh: sh });
			});
		}

		const totalOps =
			plan.dels.length + plan.puts.length + plan.snapWrites.length + plan.snapDels.length;
		let done = 0;
		let written = 0;
		let deleted = 0;
		let delta = 0;
		const touched = new Set();
		function progress() {
			if (onProgress)
				try {
					onProgress({ done: done, total: totalOps, written: written, legacy: legacy });
				} catch (e) {
					ignorar(e, 'sessaoIncremental:progress');
				}
		}

		let batch = [];
		let batchBytes = 0;
		async function runBatch() {
			if (!batch.length) return;
			const items = batch;
			batch = [];
			batchBytes = 0;
			for (let i = 0; i < items.length; i++) {
				const it = items[i];
				if (!it.prepare) continue;
				it.prepared = it.prepare();
				if (encrypt) it.prepared.value = await encrypt(it.prepared.value);
			}
			await tx('readwrite', function (st, track) {
				for (let i = 0; i < items.length; i++) {
					const it = items[i];
					if (it.prepare) track(st.put(it.prepared.value, it.key));
					else track(st.delete(it.key));
				}
			});
			for (let i = 0; i < items.length; i++) {
				const it = items[i];
				it.after(it.prepared);
				if (it.pid) touched.add(it.pid);
				if (it.prepare) {
					written++;
					delta += it.bytes || 0;
				} else deleted++;
			}
			done += items.length;
			progress();
			await yieldToBrowser();
		}

		for (let i = 0; i < plan.dels.length; i++) {
			batch.push(plan.dels[i]);
			if (batch.length >= BATCH_RECORDS * 3) await runBatch();
		}
		await runBatch();
		for (let i = 0; i < plan.puts.length; i++) {
			const w = plan.puts[i];
			if (batch.length && (batchBytes + w.bytes > BATCH_BYTES || batch.length >= BATCH_RECORDS))
				await runBatch();
			batch.push(w);
			batchBytes += w.bytes;
		}
		await runBatch();

		for (let i = 0; i < plan.snapDels.length; i++) {
			const sd = plan.snapDels[i];
			await deleteRange(SNAP_PREFIX + sd.pid + ':' + sd.sid + ':');
			sd.sh.snaps.delete(sd.sid);
			deleted++;
			done++;
			progress();
		}
		for (let i = 0; i < plan.snapWrites.length; i++) {
			const sw = plan.snapWrites[i];
			await deleteRange(SNAP_PREFIX + sw.pid + ':' + sw.sid + ':');
			const parts = splitSnapshot(sw.snap);
			for (let k = 0; k < parts.length; k++) {
				let value = parts[k];
				if (encrypt) value = await encrypt(value);
				const key = snapPartKey(sw.pid, sw.sid, k);
				await tx('readwrite', function (st, track) {
					track(st.put(value, key));
				});
				await yieldToBrowser();
			}
			sw.sh.snaps.set(sw.sid, { ref: sw.snap, parts: parts.length });
			touched.add(sw.pid);
			written++;
			done++;
			progress();
		}

		const metaObj =
			typeof opts.serializeMeta === 'function' ? opts.serializeMeta() : { v: 1, projects: [] };
		if (!Array.isArray(metaObj.projects)) metaObj.projects = [];
		const guarded = await protectIndex(metaObj, cur, opts, writer);
		const carried = guarded.carried;
		await writeManifests(metaObj.projects, encrypt, writer, force);
		metaObj.inc = 1;
		metaObj.fmt = FORMAT;
		let rec = encrypt ? await encrypt(metaObj) : metaObj;
		if (!rec || typeof rec !== 'object') throw new Error('registro de sessao invalido');
		rec.inc = 1;
		rec.fmt = FORMAT;
		rec.__w = writer;
		rec.__t = Date.now();
		rec.__fx = 3;
		if (opts.flagRewrite) rec.__rw = 1;
		const rev = await putMeta(rec, expectRev, writer, opts.revFloor);

		stats.flushes++;
		stats.written += written;
		stats.deleted += deleted;
		stats.lastWritten = written;
		stats.lastDeleted = deleted;
		stats.lastDeltaBytes = delta;
		stats.lastMs = Date.now() - t0;
		stats.lastReason = opts.reason || '';
		if (legacy) stats.migrated = true;
		if (carried.length) stats.carried = (stats.carried || 0) + carried.length;
		return {
			ok: true,
			rev: rev,
			bytes: total,
			delta: delta,
			written: written,
			deleted: deleted,
			files: nFiles,
			legacy: legacy,
			carried: carried,
			touched: Array.from(touched),
			ms: stats.lastMs,
		};
	}




	async function protectIndex(metaObj, cur, opts, writer) {
		const M = root.SynapseCofreManifesto;
		if (!M || opts.allowShrink) return { carried: [] };
		const decrypt = typeof opts.decrypt === 'function' ? opts.decrypt : null;
		const forgotten = new Set();
		if (opts.forgotten)
			try {
				Array.from(opts.forgotten).forEach(function (pid) {
					forgotten.add(String(pid));
				});
			} catch (e) {
				ignorar(e, 'sessaoIncremental:forgotten');
			}
		const nextIds = new Set();
		metaObj.projects.forEach(function (p) {
			if (p && p.id != null) nextIds.add(String(p.id));
		});

		let atual = [];
		if (cur && Array.isArray(cur.projects)) atual = cur.projects;
		else if (cur && cur.enc && decrypt) {
			try {
				const dec = await decrypt(cur);
				if (dec && Array.isArray(dec.projects)) atual = dec.projects;
			} catch (e) {
				ignorar(e, 'sessaoIncremental:decryptMeta');
			}
		}

		let conhecidos = [];
		try {
			conhecidos = await listManifestPids();
		} catch (e) {
			ignorar(e, 'sessaoIncremental:listManifestPids');
		}


		const candidatos = new Set();
		conhecidos.forEach(function (pid) {
			if (!nextIds.has(pid) && !forgotten.has(pid)) candidatos.add(pid);
		});
		atual.forEach(function (p) {
			if (!p || p.id == null) return;
			const pid = String(p.id);
			if (!nextIds.has(pid) && !forgotten.has(pid)) candidatos.add(pid);
		});
		if (!candidatos.size) return { carried: [] };


		const vazios = new Set();
		for (const pid of candidatos) {
			try {
				const n = await countProjectFiles(pid);
				if (n === 0) vazios.add(pid);
			} catch (e) {
				ignorar(e, 'sessaoIncremental:countProjectFiles');
			}
		}
		for (const pid of vazios) {
			candidatos.delete(pid);
			try {
				await kvDel(MANIFEST_PREFIX + pid);
			} catch (e) {
				ignorar(e, 'sessaoIncremental:limparManifesto');
			}
		}
		if (!candidatos.size) return { carried: [] };

		const manifestos = new Map();
		for (const pid of candidatos) {
			try {
				let v = await kvGet(MANIFEST_PREFIX + pid);
				if (v && v.enc) v = decrypt ? await decrypt(v) : null;
				if (v && typeof v === 'object') manifestos.set(pid, v);
			} catch (e) {
				ignorar(e, 'sessaoIncremental:lerManifesto');
			}
		}
		const atualVivos = atual.filter(function (p) {
			return p && p.id != null && !vazios.has(String(p.id));
		});
		const merged = M.mergeProjects(
			atualVivos,
			metaObj.projects,
			Array.from(candidatos),
			forgotten,
			manifestos,
			{ allowShrink: false },
		);
		metaObj.projects = merged.projects;
		if (merged.carried.length) {
			try {
				if (root.registro)
					root.registro.aviso(
						'[Synapse/cofre] ' +
							merged.carried.length +
							' projeto(s) voltaram ao indice por protecao: ' +
							merged.carried.map((c) => c.name + ' (' + c.id + ')').join(', '),
					);
			} catch (e) {
				ignorar(e, 'sessaoIncremental:avisoCarried');
			}
		}
		return { carried: merged.carried, writer: writer };
	}


	async function writeManifests(list, encrypt, writer, force) {
		const M = root.SynapseCofreManifesto;
		if (!M) return 0;
		const pendentes = [];
		for (let i = 0; i < list.length; i++) {
			const pm = list[i];
			if (!pm || pm.id == null) continue;
			const pid = String(pm.id);
			const sh = shadowFor(pid);
			const man = M.manifestFromMeta(pm, { t: Date.now(), w: writer });
			if (!man) continue;
			if (!force && sh.manifest && !M.manifestChanged(sh.manifest, man)) continue;
			pendentes.push({ key: MANIFEST_PREFIX + pid, value: encrypt ? await encrypt(man) : man, sh: sh, man: man });
		}
		if (!pendentes.length) return 0;

		await tx(
			'readwrite',
			function (st, track) {
				for (let i = 0; i < pendentes.length; i++) track(st.put(pendentes[i].value, pendentes[i].key));
			},
			STRICT,
		);
		for (let i = 0; i < pendentes.length; i++) pendentes[i].sh.manifest = pendentes[i].man;
		return pendentes.length;
	}



	async function scanProjects(decrypt) {
		const M = root.SynapseCofreManifesto;
		if (!M) return [];
		const manifestos = new Map();
		await loadRange(MANIFEST_PREFIX, decrypt || null, function (pid, v, why, raw) {
			if (v && typeof v === 'object') manifestos.set(pid, v);
			else if (why) manifestos.set(pid, { bloqueado: true, bruto: raw || null });
		});
		const contagens = await countFilesByProject();
		return M.rebuildIndex(manifestos, contagens);
	}

	                                                                                              
	                                                                          
	async function flagRewrite(writer, expectRev) {
		const cur = await kvGet(META_KEY);
		                                                                                     
		                                                                                     
		                   
		if (!cur || typeof cur !== 'object' || !isIncremental(cur)) return expectRev;
		const early = conflictOf(cur, expectRev, writer);
		if (early) throw conflictError(early);
		cur.__rw = 1;
		cur.__w = writer;
		cur.__t = Date.now();
		return putMeta(cur, expectRev, writer, expectRev);
	}

	function pageRange(range, count) {
		return tx('readonly', function (st, track) {
			const rk = track(st.getAllKeys(range, count));
			const rv = track(st.getAll(range, count));
			return function () {
				return { keys: rk.result || [], vals: rv.result || [] };
			};
		});
	}

	async function loadRange(prefix, decrypt, onItem) {
		const upper = prefix + HIGH;
		let range = IDBKeyRange.bound(prefix, upper, false, false);
		let n = 0;
		for (;;) {
			const page = await pageRange(range, LOAD_PAGE);
			const keys = page.keys;
			if (!keys.length) break;
			for (let i = 0; i < keys.length; i++) {
				const key = String(keys[i]);
				const rest = key.slice(prefix.length);
				let v = page.vals[i];
				if (v && v.enc) {
					if (!decrypt) {
						onItem(rest, null, 'bloqueado', v);
						continue;
					}
					try {
						v = await decrypt(v);
					} catch (e) {
						onItem(rest, null, 'senha', page.vals[i]);
						continue;
					}
				}
				onItem(rest, v, null);
				n++;
			}
			if (keys.length < LOAD_PAGE) break;
			range = IDBKeyRange.bound(keys[keys.length - 1], upper, true, false);
			await yieldToBrowser();
		}
		return n;
	}

	                                                                                                   
	async function loadProject(pid, decrypt, pm) {
		pid = String(pid);
		const sh = shadowFor(pid);
		sh.files = new Map();
		sh.snaps = new Map();
		const files = [];
		let skipped = 0;
		await loadRange(FILE_PREFIX + pid + ':', decrypt, function (path, v, why) {
			if (!v || typeof v !== 'object') {
				if (why) skipped++;
				return;
			}
			const f = {
				path: v.path || path,
				data: v.data || null,
				text: typeof v.text === 'string' ? v.text : null,
				isText: !!v.isText,
				history: Array.isArray(v.history) ? v.history : [],
			};
			files.push([path, f]);
			sh.files.set(path, mark(f));
		});
		const parts = new Map();
		await loadRange(SNAP_PREFIX + pid + ':', decrypt, function (rest, v) {
			if (!v || typeof v !== 'object') return;
			const cut = rest.indexOf(':');
			const sid = cut >= 0 ? rest.slice(0, cut) : rest;
			let arr = parts.get(sid);
			if (!arr) {
				arr = [];
				parts.set(sid, arr);
			}
			arr.push(v);
		});
		const snapshots = [];
		parts.forEach(function (arr, sid) {
			arr.sort(function (a, b) {
				return (a.part || 0) - (b.part || 0);
			});
			const first = arr[0];
			if (!first || arr.length !== (first.parts || 1)) return;
			const snap = { id: first.id || sid, t: first.t || 0, label: first.label || '', files: [] };
			for (let i = 0; i < arr.length; i++) {
				const list = arr[i].files;
				if (!Array.isArray(list)) continue;
				for (let k = 0; k < list.length; k++) snap.files.push(list[k]);
			}
			snapshots.push(snap);
			sh.snaps.set(String(snap.id), { ref: snap, parts: arr.length });
		});
		snapshots.sort(function (a, b) {
			return (a.t || 0) - (b.t || 0);
		});
		const pd = Object.assign({}, pm || { id: pid }, { files: files, snapshots: snapshots });
		pd.__skipped = skipped;
		return pd;
	}

	async function loadSession(meta, decrypt, onProgress) {
		stats.loading = true;
		try {
			const data = Object.assign({}, meta);
			const list = Array.isArray(meta && meta.projects) ? meta.projects : [];
			data.projects = [];
			for (let i = 0; i < list.length; i++) {
				const pm = list[i];
				if (!pm || pm.id == null) continue;
				if (onProgress)
					try {
						onProgress({ index: i, total: list.length, project: pm });
					} catch (e) {
						ignorar(e, 'sessaoIncremental:loadSession');
					}
				try {
					data.projects.push(await loadProject(pm.id, decrypt, pm));
				} catch (e) {
					ignorar(e, 'sessaoIncremental:loadSession');
				}
			}
			return data;
		} finally {
			stats.loading = false;
		}
	}

	async function forgetProject(pid) {
		pid = String(pid);
		shadow.delete(pid);
		await deleteRange(FILE_PREFIX + pid + ':');
		await deleteRange(SNAP_PREFIX + pid + ':');
		await kvDel(MANIFEST_PREFIX + pid);
	}


	async function clearAll() {
		shadow.clear();
		await tx('readwrite', function (st, track) {
			track(st.delete(META_KEY));
		});
		await deleteRange(FILE_PREFIX);
		await deleteRange(SNAP_PREFIX);
		await deleteRange(MANIFEST_PREFIX);
		await deleteRange(LOST_PREFIX);
	}

	async function countProjectFiles(pid) {
		const prefix = FILE_PREFIX + String(pid) + ':';
		return tx('readonly', function (st, track) {
			const rq = track(st.count(IDBKeyRange.bound(prefix, prefix + HIGH, false, false)));
			return function () {
				return rq.result || 0;
			};
		});
	}

	function estimate() {
		let bytes = 0;
		let files = 0;
		shadow.forEach(function (sh) {
			sh.files.forEach(function (m) {
				files++;
				bytes += m.bytes || 0;
			});
		});
		return { bytes: bytes, files: files, projects: shadow.size };
	}

	root.SynapseSessionStore = Object.freeze({
		META_KEY: META_KEY,
		FILE_PREFIX: FILE_PREFIX,
		SNAP_PREFIX: SNAP_PREFIX,
		MANIFEST_PREFIX: MANIFEST_PREFIX,
		COFRE_PREFIX: COFRE_PREFIX,
		LOST_PREFIX: LOST_PREFIX,
		FORMAT: FORMAT,
		stats: stats,
		isIncremental: isIncremental,
		hasProjects: hasProjects,
		flush: flush,
		flagRewrite: flagRewrite,
		loadSession: loadSession,
		loadProject: loadProject,
		countProjectFiles: countProjectFiles,
		countFilesByProject: countFilesByProject,
		listManifestPids: listManifestPids,
		scanProjects: scanProjects,
		getRecord: kvGet,
		putRecord: function (key, value) {
			return kvPut(key, value, true);
		},
		deleteRecord: kvDel,
		forgetProject: forgetProject,
		clearAll: clearAll,
		resetShadow: resetShadow,
		estimate: estimate,
		dropDb: dropDb,
	});
})(window);
