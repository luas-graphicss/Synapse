(function (root) {
	'use strict';

	const URI_PREFIX = 'synapse:/projeto/';
	const MAX_READ_BYTES = 4 * 1024 * 1024;
	const MAX_WRITE_BYTES = 4 * 1024 * 1024;
	const MAX_DOCUMENT_PUSH_BYTES = 1024 * 1024;
	const MAX_DIRECTORY_ENTRIES = 5000;
	const MAX_EDIT_FILES = 500;
	const MAX_WATCHERS = 32;
	const WRITE_BUDGET = { capacity: 120, refillPerSecond: 12 };
	const UNDO_STACK_LIMIT = 30;
	const CHANGE_DEBOUNCE_MS = 120;
	const SAVE_IDLE_MS = 1500;
	const CHUNK_SIZE = 40;

	const watchers = new Map();
	const apiDocuments = new Map();
	const documentVersions = new Map();
	const writeBudgets = new Map();
	const structureSnapshots = new Map();
	const pendingChanges = new Map();
	const pendingSaves = new Map();
	const undoStack = [];
	const knownProjects = new Map();
	let lastActiveProjectId = null;

	function rpc() {
		return root.SynapseExtensionRpc;
	}

	function fail(code, message, data) {
		const api = rpc();
		return new api.RpcError(api.ERROR_CODES[code] || code, message, data);
	}

	function registry() {
		return root.SynapseExtensions;
	}

	function output() {
		return root.SynapseExtensionOutput;
	}

	function editorHost() {
		return root.SynapseExtensionEditor;
	}

	function byteLength(text) {
		return new TextEncoder().encode(text).length;
	}

	function textOf(entry) {
		if (!entry) return null;
		if (typeof root.sniffTextEntry === 'function') root.sniffTextEntry(entry);
		return entry.isText && typeof entry.text === 'string' ? entry.text : null;
	}

	function normalizePath(value, allowEmpty) {
		const parts = [];
		String(value || '')
			.replace(/\\/g, '/')
			.split('/')
			.forEach((segment) => {
				if (!segment || segment === '.') return;
				if (segment === '..') throw fail('INVALID_PARAMS', 'Caminhos com ".." não são permitidos.');
				parts.push(segment);
			});
		if (!parts.length && !allowEmpty) throw fail('INVALID_PARAMS', 'Caminho vazio.');
		return parts.join('/');
	}

	function relativeOf(value, allowEmpty) {
		let text = String(value === undefined || value === null ? '' : value).trim();
		if (text.startsWith(URI_PREFIX)) text = text.slice(URI_PREFIX.length);
		else if (text === 'synapse:/projeto') text = '';
		else if (/^[a-z][a-z0-9+.-]*:/i.test(text)) throw fail('INVALID_PARAMS', `Uri fora do projeto: "${text.slice(0, 120)}".`);
		return normalizePath(text, allowEmpty);
	}

	function uriOf(path) {
		return URI_PREFIX + path;
	}

	function languageOf(path) {
		const languages = root.SynapseEditorLanguages;
		const specific = languages && typeof languages.fromPath === 'function' ? languages.fromPath(path) : null;
		if (specific && specific !== 'text') return specific;
		const core = root.Core;
		const generic = core && typeof core.langOf === 'function' ? core.langOf(path) : '';
		return generic || 'plaintext';
	}

	function projectsList() {
		const state = root.State;
		return state && Array.isArray(state.projects) ? state.projects : [];
	}

	function activeProjectId() {
		const state = root.State;
		return state ? state.active : null;
	}

	function projectOf(context, params) {
		const requested = params && params.project ? String(params.project) : '';
		const own = registry().projectFor(context.descriptor.id);
		if (requested && (!own || own.id !== requested)) {
			if (!context.descriptor.capabilities.has('workspace.all')) {
				throw fail('PERMISSION_DENIED', `Acesso ao projeto "${requested}" exige a permissão "workspace.all".`, { permission: 'workspace.all' });
			}
			const found = projectsList().find((project) => project.id === requested);
			if (!found) throw fail('HOST_ERROR', `Projeto "${requested}" não está aberto.`);
			return found;
		}
		if (!own) throw fail('HOST_ERROR', 'Nenhum projeto aberto para esta extensão.');
		return own;
	}

	function projectMatches(item, project) {
		if (!project) return false;
		if (item.capabilities.has('workspace.all')) return true;
		const own = registry().projectFor(item.id);
		return !!own && own.id === project.id;
	}

	function consumeWriteBudget(extensionId, cost) {
		const now = Date.now();
		const bucket = writeBudgets.get(extensionId) || { tokens: WRITE_BUDGET.capacity, updatedAt: now };
		const elapsed = (now - bucket.updatedAt) / 1000;
		bucket.tokens = Math.min(WRITE_BUDGET.capacity, bucket.tokens + elapsed * WRITE_BUDGET.refillPerSecond);
		bucket.updatedAt = now;
		if (bucket.tokens < cost) {
			writeBudgets.set(extensionId, bucket);
			throw fail('HOST_ERROR', `Limite de escrita atingido (${WRITE_BUDGET.capacity} operações por rajada, ${WRITE_BUDGET.refillPerSecond}/s). Agrupe alterações em um WorkspaceEdit.`);
		}
		bucket.tokens -= cost;
		writeBudgets.set(extensionId, bucket);
	}

	function versionKey(project, path) {
		return project.id + '::' + path;
	}

	function versionRecord(project, path, text) {
		const key = versionKey(project, path);
		let record = documentVersions.get(key);
		if (!record) {
			record = { version: 1, text };
			documentVersions.set(key, record);
		} else if (record.text !== text) {
			record.version += 1;
			record.text = text;
		}
		return record;
	}

	function describeDocument(project, path, includeText) {
		const entry = project.files.get(path);
		const text = textOf(entry);
		if (text === null) return null;
		const record = versionRecord(project, path, text);
		const size = byteLength(text);
		const tooLarge = size > MAX_DOCUMENT_PUSH_BYTES;
		return {
			uri: uriOf(path),
			path,
			projectId: project.id,
			languageId: languageOf(path),
			version: record.version,
			isDirty: !!(project.dirty && project.dirty.has(path)),
			eol: text.includes('\r\n') ? 2 : 1,
			size,
			tooLarge,
			text: includeText && !tooLarge ? text : undefined,
		};
	}

	function trackedPaths(project) {
		const paths = new Set(Array.isArray(project.openTabs) ? project.openTabs : []);
		if (project.openFile) paths.add(project.openFile);
		const extra = apiDocuments.get(project.id);
		if (extra) extra.forEach((path) => paths.add(path));
		return [...paths].filter((path) => textOf(project.files.get(path)) !== null);
	}

	function openDocuments(project, includeText) {
		if (!project) return [];
		return trackedPaths(project)
			.map((path) => describeDocument(project, path, includeText))
			.filter(Boolean);
	}

	function isTracked(project, path) {
		if (project.openFile === path) return true;
		if (Array.isArray(project.openTabs) && project.openTabs.includes(path)) return true;
		const extra = apiDocuments.get(project.id);
		return !!extra && extra.has(path);
	}

	function computeChange(previous, next) {
		let start = 0;
		const limit = Math.min(previous.length, next.length);
		while (start < limit && previous.charCodeAt(start) === next.charCodeAt(start)) start += 1;
		let previousEnd = previous.length;
		let nextEnd = next.length;
		while (previousEnd > start && nextEnd > start && previous.charCodeAt(previousEnd - 1) === next.charCodeAt(nextEnd - 1)) {
			previousEnd -= 1;
			nextEnd -= 1;
		}
		return { rangeOffset: start, rangeLength: previousEnd - start, text: next.slice(start, nextEnd) };
	}

	function broadcast(method, params, project, permission) {
		if (!registry()) return 0;
		return registry().broadcast(method, params, (item) => item.capabilities.has(permission) && projectMatches(item, project));
	}

	function publishDocumentChange(project, path, reason) {
		const entry = project.files.get(path);
		const text = textOf(entry);
		if (text === null) return;
		const key = versionKey(project, path);
		const record = documentVersions.get(key);
		const previous = record ? record.text : null;
		if (previous === text) return;
		const nextRecord = versionRecord(project, path, text);
		if (previous === null || !isTracked(project, path)) return;
		const change = computeChange(previous, text);
		const size = byteLength(text);
		broadcast(
			'workspace.documentChanged',
			{
				projectId: project.id,
				uri: uriOf(path),
				path,
				version: nextRecord.version,
				isDirty: !!(project.dirty && project.dirty.has(path)),
				reason: reason || 'edit',
				change,
				text: size <= MAX_DOCUMENT_PUSH_BYTES ? text : undefined,
				tooLarge: size > MAX_DOCUMENT_PUSH_BYTES,
			},
			project,
			'workspace.read',
		);
		scheduleSave(project, path);
	}

	function scheduleSave(project, path) {
		const key = versionKey(project, path);
		clearTimeout(pendingSaves.get(key));
		pendingSaves.set(
			key,
			setTimeout(() => {
				pendingSaves.delete(key);
				const current = projectsList().find((candidate) => candidate.id === project.id);
				if (!current || !current.files.has(path)) return;
				const record = documentVersions.get(key);
				broadcast('workspace.documentSaved', { projectId: current.id, uri: uriOf(path), path, version: record ? record.version : 1 }, current, 'workspace.read');
			}, SAVE_IDLE_MS),
		);
	}

	function notifyTextChanged(project, path) {
		if (!project || !path) return;
		const key = versionKey(project, path);
		clearTimeout(pendingChanges.get(key));
		pendingChanges.set(
			key,
			setTimeout(() => {
				pendingChanges.delete(key);
				const current = projectsList().find((candidate) => candidate.id === project.id);
				if (!current) return;
				publishDocumentChange(current, path, 'edit');
				emitFileEvents(current, { changed: [path] });
			}, CHANGE_DEBOUNCE_MS),
		);
	}

	function snapshotOf(project) {
		const snapshot = new Map();
		for (const [path, entry] of project.files) snapshot.set(path, entry.isText ? entry.text : entry.data);
		return snapshot;
	}

	function syncSnapshot(project) {
		structureSnapshots.set(project.id, snapshotOf(project));
	}

	function diffStructure(project) {
		const previous = structureSnapshots.get(project.id);
		const current = snapshotOf(project);
		structureSnapshots.set(project.id, current);
		if (!previous) return { created: [], deleted: [], changed: [] };
		const created = [];
		const deleted = [];
		const changed = [];
		for (const [path, content] of current) {
			if (!previous.has(path)) created.push(path);
			else if (previous.get(path) !== content) changed.push(path);
		}
		for (const path of previous.keys()) if (!current.has(path)) deleted.push(path);
		return { created, deleted, changed };
	}

	function emitFileEvents(project, events) {
		const created = events.created || [];
		const deleted = events.deleted || [];
		const changed = events.changed || [];
		const renamed = events.renamed || [];
		if (!created.length && !deleted.length && !changed.length && !renamed.length) return;
		if (created.length || deleted.length || renamed.length) {
			broadcast(
				'workspace.filesChanged',
				{
					projectId: project.id,
					created: created.map(uriOf),
					deleted: deleted.map(uriOf),
					renamed: renamed.map((pair) => ({ oldUri: uriOf(pair.from), newUri: uriOf(pair.to) })),
				},
				project,
				'workspace.read',
			);
		}
		watchers.forEach((byHandle, extensionId) => {
			const item = registry().get(extensionId);
			if (!item || item.status !== 'active') return;
			const hits = [];
			byHandle.forEach((watcher, handle) => {
				const push = (type, list) => list.forEach((path) => {
					if (watcher.matcher.test(path)) hits.push({ handle, type, uri: uriOf(path), path });
				});
				if (!watcher.ignoreCreate) push('create', created);
				if (!watcher.ignoreChange) push('change', changed);
				if (!watcher.ignoreDelete) push('delete', deleted);
			});
			if (hits.length) registry().notifyExtension(extensionId, 'workspace.fileEvents', { projectId: project.id, events: hits });
		});
		deleted.forEach((path) => {
			documentVersions.delete(versionKey(project, path));
			const extra = apiDocuments.get(project.id);
			if (extra) extra.delete(path);
		});
	}

	function notifyStructureChanged(project) {
		if (!project) return;
		const diff = diffStructure(project);
		diff.changed.forEach((path) => publishDocumentChange(project, path, 'external'));
		emitFileEvents(project, diff);
		syncTrackedDocuments(project);
	}

	const trackedByProject = new Map();

	function syncTrackedDocuments(project) {
		const previous = trackedByProject.get(project.id) || new Set();
		const current = new Set(trackedPaths(project));
		trackedByProject.set(project.id, current);
		current.forEach((path) => {
			if (!previous.has(path)) {
				const document = describeDocument(project, path, true);
				if (document) broadcast('workspace.documentOpened', { document }, project, 'workspace.read');
			}
		});
		previous.forEach((path) => {
			if (!current.has(path)) broadcast('workspace.documentClosed', { projectId: project.id, uri: uriOf(path), path }, project, 'workspace.read');
		});
	}

	function notifyDocumentOpened(project, path) {
		if (!project || !path) return;
		syncTrackedDocuments(project);
		if (editorHost()) editorHost().notifyActiveChanged();
	}

	function notifyTabClosed(project, path) {
		if (!project) return;
		syncTrackedDocuments(project);
		if (editorHost()) editorHost().notifyActiveChanged();
	}

	function notifyProjectsChanged() {
		const list = projectsList();
		const currentIds = new Set(list.map((project) => project.id));
		const opened = [];
		const closed = [];
		list.forEach((project) => {
			if (!knownProjects.has(project.id)) {
				knownProjects.set(project.id, project.name);
				opened.push({ id: project.id, name: project.name });
				syncSnapshot(project);
			}
		});
		[...knownProjects.keys()].forEach((id) => {
			if (!currentIds.has(id)) {
				closed.push({ id, name: knownProjects.get(id) });
				knownProjects.delete(id);
				structureSnapshots.delete(id);
				trackedByProject.delete(id);
				apiDocuments.delete(id);
			}
		});
		const activeId = activeProjectId();
		const activeChanged = activeId !== lastActiveProjectId;
		lastActiveProjectId = activeId;
		if (!opened.length && !closed.length && !activeChanged) return;
		const active = list.find((project) => project.id === activeId) || null;
		if (registry()) {
			registry().broadcast(
				'workspace.projectsChanged',
				{ opened, closed, active: active ? { id: active.id, name: active.name } : null, activeChanged },
				(item) => item.capabilities.has('workspace.read') || item.capabilities.has('workspace.all'),
			);
		}
		if (active) syncTrackedDocuments(active);
		if (editorHost()) editorHost().notifyActiveChanged();
	}

	function ensureText(project, path) {
		const entry = project.files.get(path);
		if (!entry) throw fail('HOST_ERROR', `Arquivo "${path}" não encontrado no projeto.`, { code: 'FileNotFound' });
		const text = textOf(entry);
		if (text === null) throw fail('HOST_ERROR', `Arquivo "${path}" é binário; leitura de texto indisponível.`, { code: 'Binary' });
		return { entry, text };
	}

	function isDirectory(project, path) {
		if (!path) return true;
		if (project.emptyDirs && project.emptyDirs.has(path)) return true;
		const prefix = path + '/';
		for (const candidate of project.files.keys()) if (candidate.startsWith(prefix)) return true;
		return false;
	}

	function readFile(params, context) {
		const project = projectOf(context, params);
		const path = relativeOf(params.path);
		const entry = project.files.get(path);
		if (!entry) throw fail('HOST_ERROR', `Arquivo "${path}" não encontrado no projeto.`, { code: 'FileNotFound' });
		const text = textOf(entry);
		if (text !== null) {
			if (byteLength(text) > MAX_READ_BYTES) throw fail('HOST_ERROR', `Arquivo "${path}" excede o limite de leitura de 4 MB.`);
			return { kind: 'text', text };
		}
		if (!params.binary) throw fail('HOST_ERROR', `Arquivo "${path}" é binário; use fs.readFile com Uri para obter os bytes.`, { code: 'Binary' });
		const data = entry.data;
		if (!data) return { kind: 'binary', base64: '' };
		const bytes = data instanceof Uint8Array ? data : new Uint8Array(data.buffer || data);
		if (bytes.byteLength > MAX_READ_BYTES) throw fail('HOST_ERROR', `Arquivo "${path}" excede o limite de leitura de 4 MB.`);
		let binary = '';
		for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(index, index + 0x8000));
		return { kind: 'binary', base64: btoa(binary) };
	}

	function stat(params, context) {
		const project = projectOf(context, params);
		const path = relativeOf(params.path, true);
		const entry = project.files.get(path);
		if (entry) {
			const text = textOf(entry);
			const history = Array.isArray(entry.history) && entry.history.length ? entry.history : null;
			return {
				type: 1,
				path,
				uri: uriOf(path),
				isText: text !== null,
				size: text !== null ? byteLength(text) : entry.data ? entry.data.byteLength || entry.data.length || 0 : 0,
				ctime: history ? history[0].t : 0,
				mtime: history ? history[history.length - 1].t : 0,
			};
		}
		if (isDirectory(project, path)) return { type: 2, path, uri: uriOf(path), isText: false, size: 0, ctime: 0, mtime: 0 };
		throw fail('HOST_ERROR', `"${path}" não existe no projeto.`, { code: 'FileNotFound' });
	}

	function readDirectory(params, context) {
		const project = projectOf(context, params);
		const path = relativeOf(params.path, true);
		if (path && project.files.has(path)) throw fail('HOST_ERROR', `"${path}" é um arquivo, não uma pasta.`, { code: 'FileNotADirectory' });
		if (path && !isDirectory(project, path)) throw fail('HOST_ERROR', `Pasta "${path}" não encontrada.`, { code: 'FileNotFound' });
		const prefix = path ? path + '/' : '';
		const entries = new Map();
		for (const candidate of project.files.keys()) {
			if (prefix && !candidate.startsWith(prefix)) continue;
			const rest = candidate.slice(prefix.length);
			const slash = rest.indexOf('/');
			if (slash === -1) entries.set(rest, 1);
			else entries.set(rest.slice(0, slash), 2);
			if (entries.size >= MAX_DIRECTORY_ENTRIES) break;
		}
		for (const directory of project.emptyDirs || []) {
			if (prefix && !directory.startsWith(prefix)) continue;
			const rest = directory.slice(prefix.length);
			if (!rest) continue;
			const slash = rest.indexOf('/');
			entries.set(slash === -1 ? rest : rest.slice(0, slash), 2);
		}
		return [...entries.entries()].sort((a, b) => (a[1] !== b[1] ? b[1] - a[1] : a[0].localeCompare(b[0])));
	}

	function findFiles(params, context) {
		const project = projectOf(context, params);
		const matcher = root.SynapseExtensionActivation.globToRegExp(String(params.glob || '**/*').replace(/^\.?\//, ''));
		const exclude = params.exclude ? root.SynapseExtensionActivation.globToRegExp(String(params.exclude).replace(/^\.?\//, '')) : null;
		const limit = Math.max(1, Math.min(MAX_DIRECTORY_ENTRIES, Number(params.maxResults) || MAX_DIRECTORY_ENTRIES));
		const results = [];
		for (const path of project.files.keys()) {
			if (!matcher.test(path)) continue;
			if (exclude && exclude.test(path)) continue;
			results.push(path);
			if (results.length >= limit) break;
		}
		return results;
	}

	function validateWritablePath(path) {
		if (typeof root.validRelPath === 'function' && !root.validRelPath(path)) throw fail('INVALID_PARAMS', `Caminho inválido: "${path}".`);
	}

	function setText(project, path, content, options) {
		validateWritablePath(path);
		if (byteLength(content) > MAX_WRITE_BYTES) throw fail('HOST_ERROR', 'Conteúdo excede o limite de escrita de 4 MB.');
		let entry = project.files.get(path);
		let created = false;
		if (!entry) {
			if (options && options.create === false) throw fail('HOST_ERROR', `Arquivo "${path}" não existe e create=false.`, { code: 'FileNotFound' });
			if (project.emptyDirs && project.emptyDirs.has(path)) throw fail('HOST_ERROR', `"${path}" é uma pasta.`, { code: 'FileIsADirectory' });
			entry = root.newFileEntry(path);
			entry.isText = true;
			entry.text = '';
			project.files.set(path, entry);
			created = true;
		} else {
			if (options && options.overwrite === false) throw fail('HOST_ERROR', `Arquivo "${path}" já existe e overwrite=false.`, { code: 'FileExists' });
			if (textOf(entry) === null) throw fail('HOST_ERROR', `Arquivo "${path}" é binário; escrita de texto indisponível.`, { code: 'Binary' });
		}
		const previous = entry.text;
		if (previous === content && !created) return { created: false, changed: false, previous };
		entry.history = entry.history || [];
		const last = entry.history[entry.history.length - 1];
		if (!last || last.text !== entry.text) entry.history.push({ t: Date.now(), text: entry.text });
		if (entry.history.length > 40) entry.history.splice(0, entry.history.length - 40);
		entry.text = content;
		entry.data = null;
		if (project.dirty) project.dirty.add(path);
		return { created, changed: true, previous };
	}

	function applyToOpenEditor(project, path) {
		const editor = editorHost();
		if (editor && editor.isActiveDocument(project, path)) editor.syncFromModel();
		else if (project.openFile === path && activeProjectId() === project.id && typeof root.openFileInEditor === 'function') root.openFileInEditor(path);
	}

	function commit(project, events, extensionId, message) {
		syncSnapshot(project);
		if (typeof root.fsChanged === 'function') root.fsChanged(project);
		(events.changed || []).forEach((path) => publishDocumentChange(project, path, 'extension'));
		(events.created || []).forEach((path) => publishDocumentChange(project, path, 'extension'));
		emitFileEvents(project, events);
		syncTrackedDocuments(project);
		if (message && output()) output().command(extensionId, message);
	}

	function writeFile(params, context) {
		const project = projectOf(context, params);
		const path = relativeOf(params.path);
		const content = typeof params.content === 'string' ? params.content : params.base64 ? decodeBase64(params.base64) : '';
		consumeWriteBudget(context.descriptor.id, 1);
		const result = setText(project, path, content, params.options || {});
		if (!result.changed) return { path, uri: uriOf(path), bytes: byteLength(content), created: false, changed: false };
		applyToOpenEditor(project, path);
		commit(project, result.created ? { created: [path] } : { changed: [path] }, context.descriptor.id, `Escreveu ${path} (${byteLength(content)} bytes).`);
		return { path, uri: uriOf(path), bytes: byteLength(content), created: result.created, changed: true };
	}

	function decodeBase64(base64) {
		try {
			const binary = atob(String(base64));
			const bytes = new Uint8Array(binary.length);
			for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
			return new TextDecoder().decode(bytes);
		} catch (error) {
			throw fail('INVALID_PARAMS', 'Conteúdo base64 inválido.');
		}
	}

	function createDirectory(params, context) {
		const project = projectOf(context, params);
		const path = relativeOf(params.path);
		validateWritablePath(path);
		if (project.files.has(path)) throw fail('HOST_ERROR', `"${path}" já existe como arquivo.`, { code: 'FileExists' });
		if (isDirectory(project, path)) return { path, uri: uriOf(path), created: false };
		consumeWriteBudget(context.descriptor.id, 1);
		project.emptyDirs = project.emptyDirs || new Set();
		project.emptyDirs.add(path);
		commit(project, {}, context.descriptor.id, `Criou a pasta ${path}.`);
		return { path, uri: uriOf(path), created: true };
	}

	function closeTabsFor(project, paths) {
		const victims = new Set(paths);
		let reopen = false;
		victims.forEach((path) => {
			if (project.dirty) project.dirty.delete(path);
			if (Array.isArray(project.openTabs)) {
				const index = project.openTabs.indexOf(path);
				if (index >= 0) project.openTabs.splice(index, 1);
			}
			if (project.openFile === path) reopen = true;
		});
		if (!reopen || activeProjectId() !== project.id) {
			if (reopen) project.openFile = Array.isArray(project.openTabs) && project.openTabs.length ? project.openTabs[project.openTabs.length - 1] : null;
			return;
		}
		const next = Array.isArray(project.openTabs) && project.openTabs.length ? project.openTabs[project.openTabs.length - 1] : typeof root.pickDefaultFile === 'function' ? root.pickDefaultFile(project.files) : null;
		if (next && project.files.has(next) && typeof root.openFileInEditor === 'function') root.openFileInEditor(next);
		else {
			project.openFile = null;
			if (typeof root.editorToEmpty === 'function') root.editorToEmpty();
		}
	}

	function deletePaths(project, path, recursive) {
		const removed = [];
		const contents = new Map();
		if (project.files.has(path)) {
			contents.set(path, project.files.get(path));
			project.files.delete(path);
			removed.push(path);
		} else if (isDirectory(project, path)) {
			const prefix = path + '/';
			const victims = [...project.files.keys()].filter((candidate) => candidate.startsWith(prefix));
			if (victims.length && !recursive) throw fail('HOST_ERROR', `Pasta "${path}" não está vazia; use recursive=true.`, { code: 'DirectoryNotEmpty' });
			victims.forEach((candidate) => {
				contents.set(candidate, project.files.get(candidate));
				project.files.delete(candidate);
				removed.push(candidate);
			});
			if (project.emptyDirs) for (const directory of [...project.emptyDirs]) if (directory === path || directory.startsWith(prefix)) project.emptyDirs.delete(directory);
		} else {
			throw fail('HOST_ERROR', `"${path}" não existe no projeto.`, { code: 'FileNotFound' });
		}
		closeTabsFor(project, removed);
		return { removed, contents };
	}

	function deleteEntry(params, context) {
		const project = projectOf(context, params);
		const path = relativeOf(params.path);
		consumeWriteBudget(context.descriptor.id, 2);
		const result = deletePaths(project, path, !!(params.options && params.options.recursive));
		pushUndo({ extensionId: context.descriptor.id, projectId: project.id, label: `excluir ${path}`, files: [], operations: [{ kind: 'delete', path, contents: result.contents }] });
		commit(project, { deleted: result.removed }, context.descriptor.id, `Excluiu ${path} (${result.removed.length} arquivo(s)).`);
		return { path, uri: uriOf(path), removed: result.removed.length };
	}

	function movePath(project, from, to, overwrite) {
		if (from === to) return { moved: [], directory: false };
		const directory = !project.files.has(from);
		if (directory && !isDirectory(project, from)) throw fail('HOST_ERROR', `"${from}" não existe no projeto.`, { code: 'FileNotFound' });
		if (!directory && (to === from || to.startsWith(from + '/'))) throw fail('INVALID_PARAMS', 'Destino inválido.');
		if (directory && to.startsWith(from + '/')) throw fail('INVALID_PARAMS', 'Não é possível mover uma pasta para dentro dela mesma.');
		const exists = project.files.has(to) || isDirectory(project, to);
		if (exists && !overwrite) throw fail('HOST_ERROR', `"${to}" já existe.`, { code: 'FileExists' });
		if (exists) deletePaths(project, to, true);
		const prefix = from + '/';
		const remap = (path) => {
			if (path === from) return to;
			if (directory && typeof path === 'string' && path.startsWith(prefix)) return to + '/' + path.slice(prefix.length);
			return path;
		};
		const moved = [];
		const next = new Map();
		for (const [path, entry] of project.files) {
			const target = remap(path);
			if (target !== path) {
				entry.path = target;
				moved.push({ from: path, to: target });
			}
			next.set(target, entry);
		}
		project.files = next;
		if (typeof root.remapPaths === 'function') root.remapPaths(project, remap);
		else {
			if (project.openFile) project.openFile = remap(project.openFile);
			if (project.openTabs) project.openTabs = project.openTabs.map(remap);
			if (project.dirty) project.dirty = new Set(Array.from(project.dirty, remap));
		}
		if (project.entry) project.entry = remap(project.entry);
		if (project.detect && project.detect.entry) project.detect.entry = remap(project.detect.entry);
		if (project.emptyDirs) project.emptyDirs = new Set(Array.from(project.emptyDirs, remap));
		return { moved, directory };
	}

	function rename(params, context) {
		const project = projectOf(context, params);
		const from = relativeOf(params.from);
		const to = relativeOf(params.to);
		validateWritablePath(to);
		consumeWriteBudget(context.descriptor.id, 2);
		const result = movePath(project, from, to, !!(params.options && params.options.overwrite));
		if (!result.moved.length && !result.directory) return { from, to, moved: 0 };
		if (activeProjectId() === project.id && project.openFile && typeof root.openFileInEditor === 'function') root.openFileInEditor(project.openFile);
		pushUndo({ extensionId: context.descriptor.id, projectId: project.id, label: `renomear ${from}`, files: [], operations: [{ kind: 'rename', from, to }] });
		commit(
			project,
			{ renamed: result.moved, created: result.moved.map((pair) => pair.to), deleted: result.moved.map((pair) => pair.from) },
			context.descriptor.id,
			`Renomeou ${from} → ${to}.`,
		);
		return { from, to, uri: uriOf(to), moved: result.moved.length };
	}

	function offsetsOf(text) {
		const starts = [0];
		for (let index = text.indexOf('\n'); index >= 0; index = text.indexOf('\n', index + 1)) starts.push(index + 1);
		return starts;
	}

	function offsetAt(text, starts, position) {
		const line = Math.max(0, Math.min(starts.length - 1, Number(position.line) || 0));
		const lineStart = starts[line];
		const lineEnd = line + 1 < starts.length ? starts[line + 1] - 1 : text.length;
		return lineStart + Math.max(0, Math.min(lineEnd - lineStart, Number(position.character) || 0));
	}

	function applyTextEdits(text, edits) {
		const starts = offsetsOf(text);
		const resolved = edits.map((edit) => {
			const range = edit.range || {};
			const start = offsetAt(text, starts, range.start || { line: 0, character: 0 });
			const end = offsetAt(text, starts, range.end || range.start || { line: 0, character: 0 });
			return { start: Math.min(start, end), end: Math.max(start, end), text: String(edit.newText === undefined ? edit.text || '' : edit.newText) };
		});
		resolved.sort((a, b) => b.start - a.start || b.end - a.end);
		for (let index = 1; index < resolved.length; index += 1) {
			if (resolved[index].end > resolved[index - 1].start) throw fail('INVALID_PARAMS', 'Edições sobrepostas no mesmo documento.');
		}
		let result = text;
		resolved.forEach((edit) => {
			result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
		});
		return result;
	}

	function pushUndo(record) {
		record.t = Date.now();
		undoStack.push(record);
		if (undoStack.length > UNDO_STACK_LIMIT) undoStack.splice(0, undoStack.length - UNDO_STACK_LIMIT);
	}

	async function applyEdit(params, context) {
		const project = projectOf(context, params);
		const edit = params.edit || {};
		const documentChanges = Array.isArray(edit.documentChanges) ? edit.documentChanges : [];
		const fileOperations = Array.isArray(edit.fileOperations) ? edit.fileOperations : [];
		if (!documentChanges.length && !fileOperations.length) return { applied: true, files: 0 };
		if (documentChanges.length + fileOperations.length > MAX_EDIT_FILES) throw fail('INVALID_PARAMS', `WorkspaceEdit excede ${MAX_EDIT_FILES} arquivos.`);
		consumeWriteBudget(context.descriptor.id, Math.max(1, Math.ceil((documentChanges.length + fileOperations.length) / 10)));
		const planned = [];
		for (const change of documentChanges) {
			const path = relativeOf(change.uri || change.path);
			const existing = project.files.get(path);
			const current = existing ? textOf(existing) : '';
			if (existing && current === null) throw fail('HOST_ERROR', `Arquivo "${path}" é binário.`, { code: 'Binary' });
			if (!existing && !change.createIfMissing) throw fail('HOST_ERROR', `Arquivo "${path}" não encontrado.`, { code: 'FileNotFound' });
			if (existing && change.version !== undefined && change.version !== null) {
				const record = versionRecord(project, path, current);
				if (record.version !== change.version) throw fail('HOST_ERROR', `Documento "${path}" mudou (versão ${record.version} ≠ ${change.version}).`, { code: 'VersionMismatch' });
			}
			const next = applyTextEdits(current || '', Array.isArray(change.edits) ? change.edits : []);
			if (byteLength(next) > MAX_WRITE_BYTES) throw fail('HOST_ERROR', `Resultado em "${path}" excede 4 MB.`);
			planned.push({ path, previous: existing ? current : null, next, create: !existing });
		}
		const record = { extensionId: context.descriptor.id, projectId: project.id, label: String(edit.label || 'edição de extensão'), files: [], operations: [] };
		const events = { created: [], changed: [], deleted: [], renamed: [] };
		const chunked = root.SynapseChunkedWork;
		const applyOne = (plan) => {
			if (plan.previous === plan.next && !plan.create) return;
			const result = setText(project, plan.path, plan.next, {});
			record.files.push({ path: plan.path, before: plan.previous, after: plan.next, created: result.created });
			(result.created ? events.created : events.changed).push(plan.path);
			applyToOpenEditor(project, plan.path);
		};
		if (chunked && planned.length > CHUNK_SIZE) await chunked.forEachInChunks(planned, applyOne, { chunkSize: CHUNK_SIZE });
		else planned.forEach(applyOne);
		for (const operation of fileOperations) {
			const kind = String(operation.kind || '');
			if (kind === 'create') {
				const path = relativeOf(operation.uri || operation.path);
				if (project.files.has(path)) {
					if (operation.options && operation.options.ignoreIfExists) continue;
					if (!(operation.options && operation.options.overwrite)) throw fail('HOST_ERROR', `Arquivo "${path}" já existe.`, { code: 'FileExists' });
				}
				const result = setText(project, path, String(operation.contents || ''), {});
				record.files.push({ path, before: result.previous === undefined ? null : result.created ? null : result.previous, after: String(operation.contents || ''), created: result.created });
				(result.created ? events.created : events.changed).push(path);
			} else if (kind === 'delete') {
				const path = relativeOf(operation.uri || operation.path);
				if (!project.files.has(path) && !isDirectory(project, path)) {
					if (operation.options && operation.options.ignoreIfNotExists) continue;
					throw fail('HOST_ERROR', `"${path}" não existe.`, { code: 'FileNotFound' });
				}
				const result = deletePaths(project, path, !!(operation.options && operation.options.recursive));
				record.operations.push({ kind: 'delete', path, contents: result.contents });
				events.deleted.push(...result.removed);
			} else if (kind === 'rename') {
				const from = relativeOf(operation.oldUri || operation.from);
				const to = relativeOf(operation.newUri || operation.to);
				validateWritablePath(to);
				if (!project.files.has(from) && !isDirectory(project, from)) {
					if (operation.options && operation.options.ignoreIfNotExists) continue;
					throw fail('HOST_ERROR', `"${from}" não existe.`, { code: 'FileNotFound' });
				}
				const result = movePath(project, from, to, !!(operation.options && operation.options.overwrite));
				record.operations.push({ kind: 'rename', from, to });
				events.renamed.push(...result.moved);
				events.created.push(...result.moved.map((pair) => pair.to));
				events.deleted.push(...result.moved.map((pair) => pair.from));
			} else {
				throw fail('INVALID_PARAMS', `Operação de arquivo desconhecida: "${kind}".`);
			}
		}
		if (!record.files.length && !record.operations.length) return { applied: true, files: 0 };
		pushUndo(record);
		if (activeProjectId() === project.id && project.openFile && !project.files.has(project.openFile) && typeof root.openFileInEditor === 'function') closeTabsFor(project, [project.openFile]);
		commit(project, events, context.descriptor.id, `WorkspaceEdit "${record.label}": ${record.files.length} arquivo(s), ${record.operations.length} operação(ões).`);
		return { applied: true, files: record.files.length, operations: record.operations.length };
	}

	function undoLast() {
		const record = undoStack.pop();
		if (!record) return null;
		const project = projectsList().find((candidate) => candidate.id === record.projectId);
		if (!project) return null;
		const events = { created: [], changed: [], deleted: [], renamed: [] };
		[...record.operations].reverse().forEach((operation) => {
			if (operation.kind === 'rename') {
				const result = movePath(project, operation.to, operation.from, true);
				events.renamed.push(...result.moved);
				events.created.push(...result.moved.map((pair) => pair.to));
				events.deleted.push(...result.moved.map((pair) => pair.from));
			} else if (operation.kind === 'delete') {
				operation.contents.forEach((entry, path) => {
					project.files.set(path, entry);
					events.created.push(path);
				});
			}
		});
		[...record.files].reverse().forEach((file) => {
			if (file.created || file.before === null) {
				if (project.files.has(file.path)) {
					project.files.delete(file.path);
					if (project.dirty) project.dirty.delete(file.path);
					events.deleted.push(file.path);
				}
				return;
			}
			const entry = project.files.get(file.path);
			if (!entry) {
				const recreated = root.newFileEntry(file.path);
				recreated.isText = true;
				recreated.text = file.before;
				project.files.set(file.path, recreated);
				events.created.push(file.path);
				return;
			}
			entry.text = file.before;
			entry.data = null;
			events.changed.push(file.path);
			applyToOpenEditor(project, file.path);
		});
		if (project.openFile && !project.files.has(project.openFile)) closeTabsFor(project, [project.openFile]);
		else if (activeProjectId() === project.id && project.openFile && typeof root.openFileInEditor === 'function') root.openFileInEditor(project.openFile);
		commit(project, events, record.extensionId, `Desfez "${record.label}".`);
		return record;
	}

	function openTextDocument(params, context) {
		const project = projectOf(context, params);
		if (params.untitled) {
			return { uri: 'untitled:' + (params.name || 'sem-titulo'), path: '', projectId: project.id, languageId: String(params.language || 'plaintext'), version: 1, isDirty: false, eol: 1, size: byteLength(String(params.content || '')), tooLarge: false, text: String(params.content || ''), untitled: true };
		}
		const path = relativeOf(params.path);
		ensureText(project, path);
		if (!apiDocuments.has(project.id)) apiDocuments.set(project.id, new Set());
		const wasTracked = isTracked(project, path);
		apiDocuments.get(project.id).add(path);
		const document = describeDocument(project, path, true);
		if (!wasTracked) syncTrackedDocuments(project);
		return document;
	}

	function listDocuments(params, context) {
		const project = projectOf(context, params);
		return openDocuments(project, !!params.includeText);
	}

	function watch(params, context) {
		const extensionId = context.descriptor.id;
		if (!watchers.has(extensionId)) watchers.set(extensionId, new Map());
		const own = watchers.get(extensionId);
		if (own.size >= MAX_WATCHERS) throw fail('HOST_ERROR', `Limite de ${MAX_WATCHERS} watchers por extensão.`);
		const glob = String(params.glob || '**/*').replace(/^\.?\//, '');
		own.set(String(params.handle), {
			glob,
			matcher: root.SynapseExtensionActivation.globToRegExp(glob),
			ignoreCreate: !!params.ignoreCreate,
			ignoreChange: !!params.ignoreChange,
			ignoreDelete: !!params.ignoreDelete,
		});
		return { handle: String(params.handle), glob };
	}

	function unwatch(params, context) {
		const own = watchers.get(context.descriptor.id);
		if (own) own.delete(String(params.handle));
		return null;
	}

	function projects(params, context) {
		const active = activeProjectId();
		const visible = context.descriptor.capabilities.has('workspace.all') ? projectsList() : [registry().projectFor(context.descriptor.id)].filter(Boolean);
		return visible.map((project) => ({ id: project.id, name: project.name, active: project.id === active, files: project.files.size }));
	}

	function disposeAll(extensionId) {
		watchers.delete(extensionId);
		writeBudgets.delete(extensionId);
	}

	function initialPayload(item) {
		const project = registry() ? registry().projectFor(item.id) : null;
		const canRead = item.capabilities.has('workspace.read');
		const active = activeProjectId();
		return {
			documents: canRead && project ? openDocuments(project, true) : [],
			projects: (item.capabilities.has('workspace.all') ? projectsList() : project ? [project] : []).map((candidate) => ({ id: candidate.id, name: candidate.name, active: candidate.id === active, files: candidate.files.size })),
		};
	}

	function bootstrap() {
		projectsList().forEach((project) => {
			knownProjects.set(project.id, project.name);
			syncSnapshot(project);
			trackedByProject.set(project.id, new Set(trackedPaths(project)));
		});
		lastActiveProjectId = activeProjectId();
	}

	const handlers = {
		'workspace.fs.readFile': readFile,
		'workspace.fs.stat': stat,
		'workspace.fs.readDirectory': readDirectory,
		'workspace.fs.writeFile': writeFile,
		'workspace.fs.createDirectory': createDirectory,
		'workspace.fs.delete': deleteEntry,
		'workspace.fs.rename': rename,
		'workspace.findFiles': findFiles,
		'workspace.applyEdit': applyEdit,
		'workspace.openTextDocument': openTextDocument,
		'workspace.textDocuments': listDocuments,
		'workspace.watch': watch,
		'workspace.unwatch': unwatch,
		'workspace.projects': projects,
	};

	root.SynapseExtensionWorkspace = Object.freeze({
		URI_PREFIX,
		handlers,
		relativeOf,
		uriOf,
		languageOf,
		describeDocument,
		openDocuments,
		initialPayload,
		computeChange,
		notifyTextChanged,
		notifyStructureChanged,
		notifyDocumentOpened,
		notifyTabClosed,
		notifyProjectsChanged,
		undoLast,
		disposeAll,
		bootstrap,
		get undoCount() {
			return undoStack.length;
		},
		get lastUndoLabel() {
			return undoStack.length ? undoStack[undoStack.length - 1].label : '';
		},
	});
})(window);
