(function registerPushMirror(root) {
	'use strict';

	if (typeof MCP_TOOLS === 'undefined' || MCP_TOOLS.some((tool) => tool.name === 'push_sync')) return;

	const MEGABYTE = 1048576;
	const MAX_SESSIONS = 6;
	const IDLE_TTL_MS = 30 * 60000;
	const MAX_OPS = 400;
	const MAX_PART_BUFFER = 96 * MEGABYTE;
	const MAX_INLINE_B64 = 12 * MEGABYTE;
	const JOURNAL_MAX = 500;
	const RECENT_MAX = 40;
	const TOAST_GAP_MS = 4000;
	const HASH_CHARS = 16;

	const sessions = new Map();
	const journal = [];
	const hashCache = new WeakMap();
	let sequence = 0;

	function now() {
		return Date.now();
	}

	function formatBytes(bytes) {
		const guard = root.SynapseZipGuard;
		if (guard && typeof guard.formatMegabytes === 'function' && bytes >= MEGABYTE)
			return guard.formatMegabytes(bytes);
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < MEGABYTE) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / MEGABYTE).toFixed(1)} MB`;
	}

	function hex(buffer) {
		const view = new Uint8Array(buffer);
		let out = '';
		for (let index = 0; index < view.length; index++) out += view[index].toString(16).padStart(2, '0');
		return out;
	}

	async function bytesOf(file) {
		if (file.data) {
			if (file.data instanceof Blob) return new Uint8Array(await file.data.arrayBuffer());
			if (file.data instanceof Uint8Array) return file.data;
			if (ArrayBuffer.isView(file.data))
				return new Uint8Array(file.data.buffer, file.data.byteOffset, file.data.byteLength);
			return new Uint8Array(file.data);
		}
		if (typeof file.text === 'string') return new TextEncoder().encode(file.text);
		return new Uint8Array(0);
	}

	async function sha1Short(bytes) {
		if (root.crypto && root.crypto.subtle) {
			const digest = await root.crypto.subtle.digest('SHA-1', bytes);
			return hex(digest).slice(0, HASH_CHARS);
		}
		let h1 = 0x811c9dc5;
		let h2 = 0x01000193;
		for (let index = 0; index < bytes.length; index++) {
			h1 = Math.imul(h1 ^ bytes[index], 0x01000193) >>> 0;
			h2 = Math.imul(h2 + bytes[index], 0x9e3779b1) >>> 0;
		}
		return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).slice(0, HASH_CHARS);
	}

	async function fileHash(file) {
		const cached = hashCache.get(file);
		if (cached && cached.text === file.text && cached.data === file.data) return cached.value;
		const bytes = await bytesOf(file);
		const value = await sha1Short(bytes);
		hashCache.set(file, { text: file.text, data: file.data, value, size: bytes.length });
		return value;
	}

	function fileSize(file) {
		const cached = hashCache.get(file);
		if (cached && cached.text === file.text && cached.data === file.data) return cached.size;
		if (file.data) return file.data instanceof Blob ? file.data.size : file.data.byteLength || file.data.length || 0;
		return typeof file.text === 'string' ? new TextEncoder().encode(file.text).length : 0;
	}

	async function manifestOf(project) {
		const rows = [];
		const paths = [...project.files.keys()].sort();
		let pending = [];
		for (const path of paths) {
			const file = project.files.get(path);
			if (!file) continue;
			pending.push(
				fileHash(file).then((hash) => {
					rows.push([path, fileSize(file), hash, file.isText && file.text != null ? 1 : 0]);
				}),
			);
			if (pending.length >= 32) {
				await Promise.all(pending);
				pending = [];
			}
		}
		await Promise.all(pending);
		rows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
		const dirs = project.emptyDirs ? [...project.emptyDirs].sort() : [];
		return { rows, dirs };
	}

	function targetProject(input) {
		if (typeof mcpProj === 'function') return mcpProj(input);
		const project = typeof activeProject === 'function' ? activeProject() : null;
		if (!project) throw new Error('Nenhum projeto aberto.');
		return project;
	}

	function ensureSessionLoaded() {
		const store = root.SynapseSessionStore;
		if (store && store.stats && store.stats.loading)
			throw new Error('A sessao do editor ainda esta carregando. Repita em alguns segundos.');
	}

	function agentOf(input) {
		return String((input && input.agent) || '')
			.trim()
			.slice(0, 40);
	}

	function cleanText(value, max) {
		return String(value == null ? '' : value)
			.replace(/[\u0000-\u001f\u007f]+/g, ' ')
			.trim()
			.slice(0, max);
	}

	function safeToast(title, sub, kind) {
		try {
			if (typeof toast === 'function') toast(title, sub, kind);
		} catch (error) {
			ignorarErro(error, 'push_sync');
		}
	}

	function safeLog(kind, text) {
		try {
			if (typeof mcpLog === 'function') mcpLog(kind, text);
		} catch (error) {
			ignorarErro(error, 'push_sync');
		}
	}

	function safeAudit(kind, data) {
		try {
			if (typeof tmAudit === 'function') tmAudit(kind, data);
		} catch (error) {
			ignorarErro(error, 'push_sync');
		}
	}

	function record(entry) {
		entry.t = now();
		journal.push(entry);
		if (journal.length > JOURNAL_MAX) journal.splice(0, journal.length - JOURNAL_MAX);
	}

	function sessionLabel(session) {
		return `${session.agent || 'agente'} -> "${session.projectName}"`;
	}

	function activeSessions() {
		return [...sessions.values()].filter((session) => session.state === 'ativo');
	}

	function expireIdle() {
		const limit = now() - IDLE_TTL_MS;
		for (const session of sessions.values()) {
			if (session.state === 'ativo' && session.lastSeen < limit) closeSession(session, 'expirado');
		}
		const closed = [...sessions.values()]
			.filter((session) => session.state !== 'ativo')
			.sort((a, b) => a.lastSeen - b.lastSeen);
		while (closed.length && sessions.size > MAX_SESSIONS) sessions.delete(closed.shift().id);
	}

	function closeSession(session, state, reason) {
		if (session.state !== 'ativo') return;
		session.state = state;
		session.endedAt = now();
		session.endReason = reason || '';
		session.parts.clear();
		session.partBytes = 0;
		const stats = session.stats;
		const summary = `${stats.writes} gravacao(oes), ${stats.deletes} exclusao(oes), ${stats.renames} renomeacao(oes), ${formatBytes(stats.bytes)} em ${stats.batches} lote(s)`;
		safeLog(
			state === 'encerrado' ? 'ok' : 'err',
			`push_sync: espelho ${state} ${sessionLabel(session)}${reason ? ' (' + reason + ')' : ''} - ${summary}`,
		);
		safeAudit('push-end', {
			sessao: session.id,
			agente: session.agent,
			projeto: session.projectName,
			estado: state,
			motivo: reason || '',
			stats: Object.assign({}, stats),
		});
		record({ kind: 'end', session: session.id, agent: session.agent, project: session.projectName, state, reason });
		safeToast(
			state === 'encerrado' ? 'Espelho da sandbox encerrado' : 'Espelho da sandbox ' + state,
			`${session.agent || 'agente'} · ${session.projectName} · ${summary}`,
			state === 'encerrado' ? 'info' : 'warn',
		);
		renderPanel();
	}

	function sessionById(id, allowClosed) {
		const session = sessions.get(String(id || '').trim());
		if (!session)
			throw new Error(
				`Sessao de push "${id || ''}" nao existe (expira apos 30 min sem atividade). Chame push_sync com action=start.`,
			);
		if (!allowClosed && session.state !== 'ativo')
			throw new Error(
				`A sessao de push ${session.id} foi ${session.state}${session.endReason ? ' (' + session.endReason + ')' : ''}. Chame action=start para abrir outra.`,
			);
		return session;
	}

	function pathOf(value) {
		if (typeof mcpNorm === 'function') return mcpNorm(String(value == null ? '' : value).replace(/\\/g, '/'));
		const path = String(value == null ? '' : value)
			.replace(/\\/g, '/')
			.trim()
			.replace(/^\/+/, '')
			.replace(/\/+$/, '');
		if (!path || path.split('/').some((segment) => !segment || segment === '.' || segment === '..'))
			throw new Error('Caminho invalido: ' + value);
		return path;
	}

	function base64Of(value) {
		let text = String(value || '').trim();
		const marker = text.indexOf('base64,');
		if (marker >= 0) text = text.slice(marker + 7);
		return text.replace(/\s+/g, '');
	}

	function decodeBase64(text) {
		if (typeof b64ToBytes === 'function') return b64ToBytes(text);
		const binary = atob(text);
		const bytes = new Uint8Array(binary.length);
		for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
		return bytes;
	}

	function opsOf(input) {
		let ops = input.ops;
		if (typeof ops === 'string') {
			try {
				ops = JSON.parse(ops);
			} catch {
				throw new Error('ops deve ser uma lista JSON de operacoes.');
			}
		}
		if (!Array.isArray(ops) || !ops.length) throw new Error('Informe ops=[{op, path, ...}, ...] com pelo menos uma operacao.');
		if (ops.length > MAX_OPS) throw new Error(`Maximo de ${MAX_OPS} operacoes por lote (recebi ${ops.length}). Nada foi aplicado.`);
		return ops;
	}

	function normalizeOp(raw, index) {
		const op = raw && typeof raw === 'object' ? raw : {};
		const kind = String(op.op || op.type || '')
			.trim()
			.toLowerCase();
		const tag = `op #${index + 1}`;
		if (kind === 'write' || kind === 'write_text') {
			if (typeof op.content !== 'string') throw new Error(`${tag} (write ${op.path || '?'}): content deve ser uma string.`);
			return { kind: 'write', path: pathOf(op.path), content: op.content, expect: op.expect ? String(op.expect) : '' };
		}
		if (kind === 'write_b64' || kind === 'write_base64' || kind === 'binary') {
			const base64 = base64Of(op.base64 || op.data);
			if (!base64) throw new Error(`${tag} (write_b64 ${op.path || '?'}): base64 vazio.`);
			if (base64.length > MAX_INLINE_B64)
				throw new Error(
					`${tag} (write_b64 ${op.path || '?'}): ${formatBytes(base64.length)} de base64 em uma unica op. Divida em partes com op=part.`,
				);
			return { kind: 'write_b64', path: pathOf(op.path), base64, expect: op.expect ? String(op.expect) : '' };
		}
		if (kind === 'part') {
			const partIndex = Number(op.index);
			const total = Number(op.total);
			const base64 = base64Of(op.base64 || op.data);
			if (!Number.isInteger(partIndex) || partIndex < 0 || !Number.isInteger(total) || total < 1 || partIndex >= total)
				throw new Error(`${tag} (part ${op.path || '?'}): index/total invalidos.`);
			if (!base64) throw new Error(`${tag} (part ${op.path || '?'}): base64 vazio.`);
			if (base64.length > MAX_INLINE_B64) throw new Error(`${tag} (part ${op.path || '?'}): parte grande demais.`);
			return {
				kind: 'part',
				path: pathOf(op.path),
				index: partIndex,
				total,
				base64,
				size: Number(op.size) || 0,
				expect: op.expect ? String(op.expect) : '',
			};
		}
		if (kind === 'delete' || kind === 'remove' || kind === 'rm') return { kind: 'delete', path: pathOf(op.path), expect: op.expect ? String(op.expect) : '' };
		if (kind === 'rename' || kind === 'move' || kind === 'mv') {
			const from = pathOf(op.from || op.path);
			const to = pathOf(op.to);
			if (from === to) throw new Error(`${tag} (rename): origem e destino iguais (${from}).`);
			return { kind: 'rename', from, to, path: from };
		}
		if (kind === 'mkdir') return { kind: 'mkdir', path: pathOf(op.path) };
		throw new Error(`${tag}: op "${kind || '?'}" desconhecida. Use write, write_b64, part, delete, rename ou mkdir.`);
	}

	function mergeHistory(previous, file) {
		if (!previous || !Array.isArray(previous.history) || !previous.history.length) return;
		const history = previous.history.slice();
		if (previous.isText && typeof previous.text === 'string') {
			const last = history[history.length - 1];
			if (!last || last.text !== previous.text) history.push({ t: now(), text: previous.text });
		}
		if (file.isText && typeof file.text === 'string') {
			const last = history[history.length - 1];
			if (!last || last.text !== file.text) history.push({ t: now(), text: file.text });
		}
		file.history = history;
		if (typeof mcpHist === 'function' && file.isText && typeof file.text === 'string') mcpHist(file);
	}

	function lintOf(path, text) {
		try {
			return typeof lintSuffix === 'function' ? String(lintSuffix(path, text) || '').trim() : '';
		} catch {
			return '';
		}
	}

	function writeText(project, path, content) {
		const previous = project.files.get(path);
		let file = previous;
		let delta = '';
		if (file && file.isText && typeof file.text === 'string') {
			if (typeof mcpHist === 'function') mcpHist(file);
			const before = file.text;
			file.text = content;
			file.data = null;
			if (typeof lpDelta === 'function') delta = String(lpDelta(before, content) || '').trim();
		} else {
			file = newFileEntry(path);
			file.isText = true;
			file.text = content;
			file.data = null;
			file.history = [{ t: now(), text: content }];
			project.files.set(path, file);
		}
		project.dirty.add(path);
		return { created: !previous, bytes: new TextEncoder().encode(content).length, delta, lint: lintOf(path, content) };
	}

	function writeBytes(project, path, bytes) {
		const previous = project.files.get(path);
		const file = makeFileEntry(path, bytes);
		mergeHistory(previous, file);
		project.files.set(path, file);
		project.dirty.add(path);
		return {
			created: !previous,
			bytes: bytes.length,
			binary: !(file.isText && file.text != null),
			lint: file.isText && file.text != null ? lintOf(path, file.text) : '',
		};
	}

	function deletePath(project, path) {
		if (project.files.has(path)) {
			mcpDeleteOne(project, path);
			return 1;
		}
		const prefix = path + '/';
		const victims = [...project.files.keys()].filter((key) => key.indexOf(prefix) === 0);
		for (const victim of victims) mcpDeleteOne(project, victim);
		if (project.emptyDirs) {
			for (const dir of [...project.emptyDirs]) if (dir === path || dir.indexOf(prefix) === 0) project.emptyDirs.delete(dir);
		}
		try {
			if (typeof openDirs !== 'undefined' && openDirs && typeof openDirs.delete === 'function') openDirs.delete(path);
		} catch (error) {
			ignorarErro(error, 'push_sync');
		}
		return victims.length;
	}

	function adopt(project) {
		try {
			if (typeof tmAdopt === 'function') tmAdopt(project);
		} catch (error) {
			ignorarErro(error, 'push_sync');
		}
	}

	function renamePath(project, from, to) {
		if (project.files.has(from)) {
			if (project.files.has(to)) throw new Error(`rename ${from} -> ${to}: ja existe um arquivo em ${to}.`);
			const file = project.files.get(from);
			file.path = to;
			const map = new Map();
			for (const [key, value] of project.files) map.set(key === from ? to : key, value);
			project.files = map;
			adopt(project);
			if (typeof remapPaths === 'function') remapPaths(project, (path) => (path === from ? to : path));
			project.dirty.delete(from);
			project.dirty.add(to);
			return 1;
		}
		const prefix = from + '/';
		const victims = [...project.files.keys()].filter((key) => key.indexOf(prefix) === 0);
		if (!victims.length) throw new Error(`rename ${from}: nada encontrado nessa origem.`);
		for (const key of project.files.keys())
			if (key === to || key.indexOf(to + '/') === 0) throw new Error(`rename ${from} -> ${to}: conflito, ja existe algo em ${to}.`);
		const map = new Map();
		for (const [key, value] of project.files) {
			if (key.indexOf(prefix) === 0) {
				const next = to + '/' + key.slice(prefix.length);
				value.path = next;
				map.set(next, value);
				project.dirty.delete(key);
				project.dirty.add(next);
			} else map.set(key, value);
		}
		project.files = map;
		adopt(project);
		if (typeof remapPaths === 'function')
			remapPaths(project, (path) => (path && path.indexOf(prefix) === 0 ? to + '/' + path.slice(prefix.length) : path));
		return victims.length;
	}

	async function currentHash(project, path) {
		const file = project.files.get(path);
		return file ? fileHash(file) : '';
	}

	function partsBufferFor(session, op) {
		let slot = session.parts.get(op.path);
		if (slot && slot.total !== op.total) {
			session.partBytes -= slot.bytes;
			slot = null;
		}
		if (!slot) {
			slot = { total: op.total, chunks: new Array(op.total), got: 0, bytes: 0, expect: op.expect || '' };
			session.parts.set(op.path, slot);
		}
		return slot;
	}

	function refreshUi(project, writtenPaths, bulk) {
		try {
			if (bulk || writtenPaths.length !== 1) mcpBulkChanged(project);
			else mcpAfterWrite(project, writtenPaths[0]);
		} catch (error) {
			ignorarErro(error, 'push_sync');
			try {
				mcpBulkChanged(project);
			} catch (inner) {
				ignorarErro(inner, 'push_sync');
			}
		}
	}

	function throttledToast(session, applied) {
		const t = now();
		session.pendingToast = (session.pendingToast || []).concat(applied);
		if (t - (session.lastToastAt || 0) < TOAST_GAP_MS) {
			if (!session.toastTimer)
				session.toastTimer = setTimeout(() => {
					session.toastTimer = 0;
					flushToast(session);
				}, TOAST_GAP_MS - (t - (session.lastToastAt || 0)));
			return;
		}
		flushToast(session);
	}

	function flushToast(session) {
		const list = session.pendingToast || [];
		session.pendingToast = [];
		if (!list.length) return;
		session.lastToastAt = now();
		const names = list.slice(0, 3).map((item) => item.path.split('/').pop());
		const extra = list.length > 3 ? ` +${list.length - 3}` : '';
		safeToast(
			`${list.length} alteracao(oes) espelhada(s) da sandbox`,
			`${session.agent || 'agente'} · ${session.projectName} · ${names.join(', ')}${extra}`,
			'ok',
		);
	}

	async function applyBatch(session, input) {
		const project = session.project;
		if (!State.projects.includes(project)) {
			closeSession(session, 'expirado', 'projeto fechado no editor');
			throw new Error(`O projeto "${session.projectName}" nao esta mais aberto no editor. Sessao encerrada.`);
		}
		if (typeof agGate === 'function') agGate(project, 'push_sync', input);
		adopt(project);
		const ops = opsOf(input).map(normalizeOp);
		const force = input.force === true || /^(true|1|sim|yes)$/i.test(String(input.force || ''));
		const seq = Number(input.seq);
		if (Number.isFinite(seq) && seq > 0) {
			if (session.lastSeq && seq <= session.lastSeq)
				return reply(`Lote ${seq} ja foi aplicado antes (ultimo = ${session.lastSeq}); nada repetido.`, {
					session: session.id,
					seq,
					duplicate: true,
					applied: [],
					conflicts: [],
					skipped: [],
				});
		}

		const applied = [];
		const conflicts = [];
		const skipped = [];
		const written = [];
		let bulk = false;
		let bytes = 0;

		for (const op of ops) {
			if (op.expect && !force && (op.kind === 'write' || op.kind === 'write_b64' || op.kind === 'delete' || op.kind === 'part')) {
				const current = await currentHash(project, op.path);
				if (current && current !== op.expect) {
					conflicts.push({ op: op.kind, path: op.path, expected: op.expect, current });
					if (op.kind === 'part') {
						const slot = session.parts.get(op.path);
						if (slot) {
							session.partBytes -= slot.bytes;
							session.parts.delete(op.path);
						}
					}
					continue;
				}
			}
			if (op.kind === 'write') {
				const result = writeText(project, op.path, op.content);
				bytes += result.bytes;
				written.push(op.path);
				applied.push({ op: result.created ? 'create' : 'write', path: op.path, bytes: result.bytes, delta: result.delta || undefined, lint: result.lint || undefined });
				continue;
			}
			if (op.kind === 'write_b64') {
				let data;
				try {
					data = decodeBase64(op.base64);
				} catch {
					throw new Error(`write_b64 ${op.path}: base64 invalido. Nada deste item foi gravado.`);
				}
				const result = writeBytes(project, op.path, data);
				bytes += result.bytes;
				written.push(op.path);
				applied.push({ op: result.created ? 'create' : 'write', path: op.path, bytes: result.bytes, binary: result.binary || undefined, lint: result.lint || undefined });
				continue;
			}
			if (op.kind === 'part') {
				const slot = partsBufferFor(session, op);
				if (!slot.chunks[op.index]) {
					slot.chunks[op.index] = op.base64;
					slot.got++;
					slot.bytes += op.base64.length;
					session.partBytes += op.base64.length;
				}
				if (session.partBytes > MAX_PART_BUFFER) {
					session.parts.clear();
					session.partBytes = 0;
					throw new Error(`Partes pendentes passaram de ${formatBytes(MAX_PART_BUFFER)}. Buffer descartado: reenvie o arquivo ${op.path}.`);
				}
				if (slot.got < slot.total) {
					skipped.push({ op: 'part', path: op.path, pending: slot.total - slot.got, reason: 'aguardando partes' });
					continue;
				}
				session.parts.delete(op.path);
				session.partBytes -= slot.bytes;
				let data;
				try {
					data = decodeBase64(slot.chunks.join(''));
				} catch {
					throw new Error(`part ${op.path}: base64 invalido ao juntar as partes. Reenvie o arquivo.`);
				}
				if (op.size && data.length !== op.size)
					throw new Error(`part ${op.path}: juntei ${data.length} bytes, esperava ${op.size}. Reenvie o arquivo.`);
				const result = writeBytes(project, op.path, data);
				bytes += result.bytes;
				written.push(op.path);
				applied.push({ op: result.created ? 'create' : 'write', path: op.path, bytes: result.bytes, binary: result.binary || undefined, parts: slot.total });
				continue;
			}
			if (op.kind === 'delete') {
				const count = deletePath(project, op.path);
				if (!count) {
					skipped.push({ op: 'delete', path: op.path, reason: 'nao existia no projeto' });
					continue;
				}
				bulk = true;
				applied.push({ op: 'delete', path: op.path, files: count });
				continue;
			}
			if (op.kind === 'rename') {
				const count = renamePath(project, op.from, op.to);
				bulk = true;
				applied.push({ op: 'rename', path: op.from, to: op.to, files: count });
				continue;
			}
			if (op.kind === 'mkdir') {
				if (!project.emptyDirs) project.emptyDirs = new Set();
				const exists = [...project.files.keys()].some((key) => key.indexOf(op.path + '/') === 0);
				if (exists || project.emptyDirs.has(op.path)) {
					skipped.push({ op: 'mkdir', path: op.path, reason: 'ja existe' });
					continue;
				}
				project.emptyDirs.add(op.path);
				bulk = true;
				applied.push({ op: 'mkdir', path: op.path });
			}
		}

		if (Number.isFinite(seq) && seq > 0) session.lastSeq = seq;
		session.lastSeen = now();
		if (applied.length) {
			refreshUi(project, written, bulk);
			const stats = session.stats;
			stats.batches++;
			stats.bytes += bytes;
			for (const item of applied) {
				if (item.op === 'delete') stats.deletes++;
				else if (item.op === 'rename') stats.renames++;
				else if (item.op === 'mkdir') stats.dirs++;
				else stats.writes++;
				record({ kind: 'op', session: session.id, agent: session.agent, project: session.projectName, op: item.op, path: item.path, to: item.to, bytes: item.bytes || 0 });
			}
			session.recent.push(...applied.map((item) => Object.assign({ t: now() }, item)));
			if (session.recent.length > RECENT_MAX) session.recent.splice(0, session.recent.length - RECENT_MAX);
			const names = applied.slice(0, 6).map((item) => `${item.op}:${item.path}${item.to ? '->' + item.to : ''}`);
			safeLog(
				'ok',
				`push_sync: ${applied.length} alteracao(oes) da sandbox espelhada(s) em "${session.projectName}" por ${session.agent || 'agente'} (${formatBytes(bytes)}): ${names.join(', ')}${applied.length > 6 ? ' ...' : ''}`,
			);
			safeAudit('push-apply', {
				sessao: session.id,
				agente: session.agent,
				projeto: session.projectName,
				aplicadas: applied.length,
				conflitos: conflicts.length,
				bytes,
				caminhos: applied.slice(0, 12).map((item) => item.path),
			});
			throttledToast(session, applied);
		}
		if (conflicts.length) {
			session.stats.conflicts += conflicts.length;
			safeLog(
				'err',
				`push_sync: ${conflicts.length} conflito(s) em "${session.projectName}" (arquivo mudou no editor depois do ultimo espelhamento): ${conflicts
					.slice(0, 5)
					.map((item) => item.path)
					.join(', ')}`,
			);
			safeToast(
				`${conflicts.length} conflito(s) no espelho da sandbox`,
				`${conflicts
					.slice(0, 3)
					.map((item) => item.path.split('/').pop())
					.join(', ')} mudou no editor; a sandbox NAO sobrescreveu`,
				'warn',
			);
		}
		renderPanel();
		const lints = applied.filter((item) => item.lint).map((item) => `${item.path}: ${item.lint}`);
		const summary = [
			`${applied.length} aplicada(s), ${conflicts.length} conflito(s), ${skipped.length} ignorada(s) em "${session.projectName}"${applied.length ? '. Preview atualizado.' : '.'}`,
		];
		if (conflicts.length)
			summary.push(
				`CONFLITO: ${conflicts.map((item) => item.path).join(', ')} mudou no editor desde o ultimo espelhamento e NAO foi sobrescrito. Leia a versao do editor (read_file) ou repita com force=true.`,
			);
		if (lints.length) summary.push(lints.slice(0, 5).join('\n'));
		return reply(summary.join('\n'), { session: session.id, seq: Number.isFinite(seq) ? seq : null, applied, conflicts, skipped });
	}

	function reply(summary, meta, payload) {
		const items = [
			{ type: 'text', text: summary },
			{ type: 'text', text: JSON.stringify(meta) },
		];
		if (payload !== undefined) items.push({ type: 'text', text: payload });
		return { __content: items };
	}

	function publicSession(session) {
		return {
			session: session.id,
			state: session.state,
			agent: session.agent,
			project: session.projectName,
			project_id: session.projectId,
			folder: session.folder,
			host: session.host,
			note: session.note,
			started_at: session.startedAt,
			last_seen: session.lastSeen,
			ended_at: session.endedAt || null,
			end_reason: session.endReason || null,
			last_seq: session.lastSeq || 0,
			pending_parts: [...session.parts.keys()],
			stats: Object.assign({}, session.stats),
			recent: session.recent.slice(-12),
		};
	}

	async function startSession(input) {
		ensureSessionLoaded();
		expireIdle();
		const project = targetProject(input);
		if (typeof agGate === 'function') agGate(project, 'push_sync', input);
		const agent = agentOf(input) || 'sandbox';
		const folder = cleanText(input.folder || input.dir || input.path, 240);
		if (!folder) throw new Error('Informe folder="/caminho/da/pasta/na/sandbox" (a pasta que sera espelhada no projeto).');
		for (const other of activeSessions())
			if (other.project === project && other.agent === agent) closeSession(other, 'encerrado', 'substituida por uma nova sessao do mesmo agente');
		if (activeSessions().length >= MAX_SESSIONS)
			throw new Error(`Ja existem ${MAX_SESSIONS} espelhos ativos. Encerre algum com action=end antes de abrir outro.`);
		const session = {
			id: `ps-${now().toString(36)}-${(++sequence).toString(36)}`,
			agent,
			project,
			projectId: String(project.id),
			projectName: String(project.name || project.id),
			folder,
			host: cleanText(input.host, 80),
			note: cleanText(input.note, 160),
			state: 'ativo',
			startedAt: now(),
			lastSeen: now(),
			endedAt: 0,
			endReason: '',
			lastSeq: 0,
			parts: new Map(),
			partBytes: 0,
			recent: [],
			stats: { batches: 0, writes: 0, deletes: 0, renames: 0, dirs: 0, bytes: 0, conflicts: 0 },
		};
		sessions.set(session.id, session);
		const wantManifest = !(input.manifest === false || /^(false|0|nao|não|no)$/i.test(String(input.manifest || '')));
		const manifest = wantManifest ? await manifestOf(project) : { rows: [], dirs: [] };
		safeLog('ok', `push_sync: espelho iniciado ${sessionLabel(session)} a partir de ${folder}${session.host ? ' @ ' + session.host : ''}`);
		safeAudit('push-start', { sessao: session.id, agente: agent, projeto: session.projectName, pasta: folder, host: session.host });
		record({ kind: 'start', session: session.id, agent, project: session.projectName, folder });
		safeToast('Espelho da sandbox iniciado', `${agent} vai espelhar ${folder} em "${session.projectName}". Cada alteracao local aparece aqui.`, 'info');
		renderPanel();
		const meta = Object.assign(publicSession(session), {
			files: manifest.rows.length,
			empty_dirs: manifest.dirs,
			manifest_format: 'lista JSON de [path, bytes, hash, is_text]; hash = 16 hex iniciais do SHA-1 dos bytes (texto em UTF-8)',
			limits: { max_ops: MAX_OPS, max_inline_base64_chars: MAX_INLINE_B64, idle_ttl_ms: IDLE_TTL_MS },
		});
		return reply(
			`Sessao de push ${session.id} aberta: ${agent} espelha "${folder}" no projeto "${session.projectName}" (${manifest.rows.length} arquivo(s) no editor agora). Envie lotes com action=apply (ops=[{op:"write",path,content,expect?},{op:"write_b64",path,base64},{op:"part",path,index,total,base64,size},{op:"delete",path},{op:"rename",from,to},{op:"mkdir",path}]) e encerre com action=end. O usuario ve cada lote como aviso e no registro do MCP.`,
			meta,
			wantManifest ? JSON.stringify(manifest.rows) : undefined,
		);
	}

	function statusReply(input) {
		expireIdle();
		if (input.session) {
			const session = sessionById(input.session, true);
			                                                                                                          
			if (session.state === 'ativo') session.lastSeen = now();
			return reply(
				`Sessao ${session.id} (${session.state}): ${sessionLabel(session)} desde ${session.folder}; ${session.stats.writes} gravacao(oes), ${session.stats.deletes} exclusao(oes), ${session.stats.renames} renomeacao(oes), ${session.stats.conflicts} conflito(s), ${formatBytes(session.stats.bytes)}.`,
				publicSession(session),
			);
		}
		const list = [...sessions.values()].sort((a, b) => b.lastSeen - a.lastSeen).map(publicSession);
		const active = list.filter((item) => item.state === 'ativo');
		return reply(
			active.length
				? `${active.length} espelho(s) ativo(s): ${active.map((item) => `${item.session} (${item.agent} -> ${item.project}, ${item.stats.writes} gravacao(oes))`).join('; ')}`
				: 'Nenhum espelho ativo. Use action=start para abrir um.',
			{ sessions: list },
		);
	}

	function logReply(input) {
		const limit = Math.max(1, Math.min(JOURNAL_MAX, Math.floor(Number(input.limit) || 60)));
		let entries = journal.slice();
		if (input.session) entries = entries.filter((entry) => entry.session === String(input.session));
		entries = entries.slice(-limit);
		const lines = entries.map((entry) => {
			const when = new Date(entry.t).toISOString().slice(11, 19);
			if (entry.kind === 'start') return `${when} inicio ${entry.agent} -> "${entry.project}" (${entry.folder})`;
			if (entry.kind === 'end') return `${when} fim ${entry.agent} -> "${entry.project}" (${entry.state}${entry.reason ? ': ' + entry.reason : ''})`;
			return `${when} ${entry.op} ${entry.path}${entry.to ? ' -> ' + entry.to : ''}${entry.bytes ? ' (' + formatBytes(entry.bytes) + ')' : ''} [${entry.agent} -> "${entry.project}"]`;
		});
		return reply(lines.length ? lines.join('\n') : 'Registro vazio: nenhuma alteracao espelhada ainda.', { entries });
	}

	async function manifestReply(input) {
		ensureSessionLoaded();
		const project = targetProject(input);
		const manifest = await manifestOf(project);
		return reply(
			`Manifesto de "${project.name || project.id}": ${manifest.rows.length} arquivo(s), ${manifest.dirs.length} pasta(s) vazia(s).`,
			{ project: String(project.name || project.id), project_id: String(project.id), files: manifest.rows.length, empty_dirs: manifest.dirs },
			JSON.stringify(manifest.rows),
		);
	}

	async function run(args) {
		const input = args || {};
		const action = String(input.action || 'status')
			.trim()
			.toLowerCase();
		if (action === 'start' || action === 'session_start' || action === 'begin') return startSession(input);
		if (action === 'apply' || action === 'push' || action === 'sync') {
			const session = sessionById(input.session);
			return applyBatch(session, input);
		}
		if (action === 'end' || action === 'stop' || action === 'session_end' || action === 'close') {
			const session = sessionById(input.session, true);
			if (session.state === 'ativo') closeSession(session, 'encerrado', cleanText(input.reason, 120) || 'encerrado pelo agente');
			return reply(`Sessao ${session.id} encerrada. ${session.stats.writes} gravacao(oes), ${session.stats.deletes} exclusao(oes), ${session.stats.renames} renomeacao(oes), ${formatBytes(session.stats.bytes)}.`, publicSession(session));
		}
		if (action === 'status' || action === 'sessions' || action === 'list') return statusReply(input);
		if (action === 'log' || action === 'journal' || action === 'history') return logReply(input);
		if (action === 'manifest' || action === 'hashes') return manifestReply(input);
		throw new Error(`acao "${action}" invalida. Use start, apply, end, status, log ou manifest.`);
	}

	function renderPanel() {
		try {
			const host = document.getElementById('mcpPushSessions');
			if (!host) return;
			const active = activeSessions().sort((a, b) => b.lastSeen - a.lastSeen);
			if (!active.length) {
				host.innerHTML = '';
				return;
			}
			const escape = typeof esc === 'function' ? esc : (value) => String(value);
			const html = [
				'<div class="push-sessions">',
				`<div class="push-sessions-title">Espelho da sandbox (${active.length})</div>`,
			];
			for (const session of active) {
				const last = session.recent[session.recent.length - 1];
				const ago = Math.max(0, Math.round((now() - session.lastSeen) / 1000));
				html.push(
					'<div class="push-session">',
					`<div class="push-session-head"><b>${escape(session.agent)}</b> &rarr; ${escape(session.projectName)} <button class="ui-btn push-session-stop" data-push-stop="${escape(session.id)}" title="Encerrar este espelho">Encerrar</button></div>`,
					`<div class="push-session-folder" title="${escape(session.folder)}">${escape(session.folder)}${session.host ? ' @ ' + escape(session.host) : ''}</div>`,
					`<div class="push-session-stats">${session.stats.writes} grav. · ${session.stats.deletes} excl. · ${session.stats.renames} ren. · ${escape(formatBytes(session.stats.bytes))}${session.stats.conflicts ? ' · <span class="push-session-conflict">' + session.stats.conflicts + ' conflito(s)</span>' : ''} · ha ${ago}s</div>`,
					last ? `<div class="push-session-last">${escape(last.op)} ${escape(last.path)}${last.to ? ' &rarr; ' + escape(last.to) : ''}</div>` : '',
					'</div>',
				);
			}
			html.push('</div>');
			host.innerHTML = html.join('');
			host.querySelectorAll('[data-push-stop]').forEach((button) => {
				button.addEventListener('click', () => {
					const session = sessions.get(button.getAttribute('data-push-stop'));
					if (session) closeSession(session, 'encerrado', 'encerrado pelo usuario no painel MCP');
				});
			});
		} catch (error) {
			ignorarErro(error, 'push_sync');
		}
	}

	setInterval(() => {
		expireIdle();
		if (activeSessions().length) renderPanel();
	}, 15000);

	                                                                                                       
	try {
		if (typeof root.mcpRenderAgents === 'function' && !root.mcpRenderAgents.__pushMirror) {
			const original = root.mcpRenderAgents;
			const wrapped = function () {
				const result = original.apply(this, arguments);
				renderPanel();
				return result;
			};
			wrapped.__pushMirror = true;
			root.mcpRenderAgents = wrapped;
		}
	} catch (error) {
		ignorarErro(error, 'push_sync');
	}

	try {
		if (typeof TM_TOOL_PATHS !== 'undefined' && TM_TOOL_PATHS && !TM_TOOL_PATHS.push_sync) {
			TM_TOOL_PATHS.push_sync = function (a) {
				const action = String((a && a.action) || '')
					.trim()
					.toLowerCase();
				if (action !== 'apply' && action !== 'push' && action !== 'sync') return {};
				const writes = [];
				const prefixes = [];
				let ops = a && a.ops;
				if (typeof ops === 'string') {
					try {
						ops = JSON.parse(ops);
					} catch {
						ops = [];
					}
				}
				for (const op of Array.isArray(ops) ? ops : []) {
					if (!op || typeof op !== 'object') continue;
					const kind = String(op.op || op.type || '').toLowerCase();
					const path = tmNormPath(op.path || op.from || '');
					if (!path) continue;
					writes.push(path);
					if (kind === 'delete' || kind === 'remove' || kind === 'rm' || kind === 'mkdir') prefixes.push(path);
					if (kind === 'rename' || kind === 'move' || kind === 'mv') {
						const to = tmNormPath(op.to || '');
						prefixes.push(path);
						if (to) {
							writes.push(to);
							prefixes.push(to);
						}
					}
				}
				return { w: writes, wp: prefixes };
			};
		}
	} catch (error) {
		ignorarErro(error, 'push_sync');
	}

	try {
		if (typeof AG_TRACK !== 'undefined' && AG_TRACK && typeof AG_TRACK.add === 'function') AG_TRACK.add('push_sync');
	} catch (error) {
		ignorarErro(error, 'push_sync');
	}

	MCP_TOOLS.push({
		name: 'push_sync',
		title: 'Espelhar a pasta da sandbox no projeto (push continuo)',
		desc: 'Receptor do espelho sandbox -> editor: a pasta baixada com download_project vira espelho do projeto. O CLI do terminal (./syn push ./pasta) usa esta ferramenta sozinho: abre uma sessao (action=start, devolve o manifesto path/bytes/hash do editor), observa a pasta e envia cada alteracao local (novo arquivo, edicao, asset binario, exclusao, renomeacao) em lotes (action=apply com ops=[{op:"write",path,content,expect?},{op:"write_b64",path,base64},{op:"part",path,index,total,base64,size},{op:"delete",path},{op:"rename",from,to},{op:"mkdir",path}]). O editor aplica tudo com historico de versoes, atualiza o preview, mostra um aviso ao usuario e registra cada mudanca (action=log). expect = hash que a sandbox conhece; se o arquivo mudou no editor, a op vira conflito e NAO sobrescreve (force=true ignora). Acoes: start, apply, end, status, log, manifest.',
		schema: {
			type: 'object',
			properties: {
				action: {
					type: 'string',
					enum: ['start', 'apply', 'end', 'status', 'log', 'manifest'],
					description: 'start abre a sessao e devolve o manifesto; apply aplica um lote de ops; end encerra; status/log mostram as sessoes e o registro; manifest devolve path/bytes/hash do projeto.',
				},
				session: { type: 'string', description: 'ID da sessao devolvido por start (apply, end, status, log).' },
				folder: { type: 'string', description: 'start: pasta da sandbox que sera espelhada (informativo, aparece para o usuario).' },
				host: { type: 'string', description: 'start: nome da maquina/sandbox (informativo).' },
				note: { type: 'string', description: 'start: observacao curta exibida ao usuario.' },
				manifest: { type: 'boolean', description: 'start: false para nao devolver o manifesto (padrao true).' },
				ops: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							op: { type: 'string', enum: ['write', 'write_b64', 'part', 'delete', 'rename', 'mkdir'] },
							path: { type: 'string' },
							content: { type: 'string', description: 'write: texto completo do arquivo' },
							base64: { type: 'string', description: 'write_b64/part: bytes em base64' },
							index: { type: 'integer', description: 'part: indice da parte (0..total-1)' },
							total: { type: 'integer', description: 'part: total de partes' },
							size: { type: 'integer', description: 'part: tamanho final em bytes (conferido ao juntar)' },
							from: { type: 'string', description: 'rename: caminho atual' },
							to: { type: 'string', description: 'rename: novo caminho' },
							expect: { type: 'string', description: 'hash (16 hex) que a sandbox conhece do arquivo no editor; divergencia = conflito' },
						},
						required: ['op'],
					},
					description: 'apply: lista de operacoes (max. 400 por lote).',
				},
				seq: { type: 'integer', minimum: 1, description: 'apply: numero crescente do lote; lotes repetidos sao ignorados.' },
				force: { type: 'boolean', description: 'apply: true sobrescreve mesmo com conflito de hash.' },
				reason: { type: 'string', description: 'end: motivo exibido ao usuario.' },
				limit: { type: 'integer', minimum: 1, description: 'log: quantas entradas (padrao 60).' },
				agent: { type: 'string', description: 'Seu nome de agente. Use sempre o mesmo em todas as chamadas.' },
				project: { type: 'string', description: 'ID ou nome do projeto. Omita para usar o ativo.' },
			},
		},
		run,
	});

	if (typeof MCP_INSTRUCTIONS !== 'undefined')
		MCP_INSTRUCTIONS +=
			'\n\nESPELHO SANDBOX -> EDITOR (push continuo): depois de baixar o projeto com download_project, rode no terminal da sandbox "./syn push ./pasta" (CLI em GET <url-do-mcp>/cli). Ele abre uma sessao em push_sync (action=start), compara a pasta com o manifesto do editor e passa a espelhar automaticamente toda alteracao local (codigo, assets binarios, exclusoes, renomeacoes) no projeto do editor, em lotes, com aviso ao usuario e registro (push_sync action=log). Voce edita e testa so na sandbox; nao precisa repetir as edicoes com write_file. Se um arquivo mudar no editor enquanto isso, a op vira conflito e nao e sobrescrita (o CLI avisa; force=true ignora). Encerre com Ctrl+C ou action=end.';

	root.SynapsePushMirror = Object.freeze({
		sessions: () => [...sessions.values()].map(publicSession),
		journal: () => journal.slice(),
		render: renderPanel,
	});
})(window);
