'use strict';
(function sessaoIncremental(root) {
	'use strict';
	if (root.SynapseSessionStore) return;

	                                                           
	                                                                                               
	                                                                                               
	                                                                        
	                                                                                                 
	                                                                                                
	                                                                              

	const META_KEY = 'session';
	const FILE_PREFIX = 'pf:';
	const SNAP_PREFIX = 'ps:';
	const LOST_PREFIX = 'session.lost.';
	const FORMAT = 2;
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
				d.onversionchange = function () {
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

	                                                                                            
	                                                                                
	async function tx(mode, fn) {
		const d = await dbOpen();
		const t = d.transaction('kv', mode);
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

	function deleteRange(prefix) {
		return tx('readwrite', function (st, track) {
			track(st.delete(IDBKeyRange.bound(prefix, prefix + HIGH, false, false)));
		});
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
			s = { files: new Map(), snaps: new Map() };
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
		const t = d.transaction('kv', 'readwrite');
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
			written++;
			done++;
			progress();
		}

		const metaObj =
			typeof opts.serializeMeta === 'function' ? opts.serializeMeta() : { v: 1, projects: [] };
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
		return {
			ok: true,
			rev: rev,
			bytes: total,
			delta: delta,
			written: written,
			deleted: deleted,
			files: nFiles,
			legacy: legacy,
			ms: stats.lastMs,
		};
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
						onItem(rest, null, 'bloqueado');
						continue;
					}
					try {
						v = await decrypt(v);
					} catch (e) {
						onItem(rest, null, 'senha');
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
	}

	async function clearAll() {
		shadow.clear();
		await tx('readwrite', function (st, track) {
			track(st.delete(META_KEY));
		});
		await deleteRange(FILE_PREFIX);
		await deleteRange(SNAP_PREFIX);
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
		forgetProject: forgetProject,
		clearAll: clearAll,
		resetShadow: resetShadow,
		estimate: estimate,
		dropDb: dropDb,
	});
})(window);
