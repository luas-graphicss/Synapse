(function (root) {
	'use strict';
	if (root.SynapseCofreManifesto) return;

	const MANIFEST_PREFIX = 'pm:';
	const FILE_PREFIX = 'pf:';
	const MARKER_KEY = 'aurora.session.marker';
	const WIPE_KEY = 'aurora.session.wipe';
	const LOSS_KEY = 'aurora.session.perda';
	const MARKER_MAX_PROJECTS = 60;

	function manifestKey(pid) {
		return MANIFEST_PREFIX + String(pid);
	}

	function pidFromManifestKey(key) {
		const k = String(key);
		return k.indexOf(MANIFEST_PREFIX) === 0 ? k.slice(MANIFEST_PREFIX.length) : null;
	}

	function pidFromFileKey(key) {
		const k = String(key);
		if (k.indexOf(FILE_PREFIX) !== 0) return null;
		const rest = k.slice(FILE_PREFIX.length);
		const cut = rest.indexOf(':');
		return cut > 0 ? rest.slice(0, cut) : null;
	}

	function manifestFromMeta(pm, extra) {
		if (!pm || pm.id == null) return null;
		const m = {
			id: pm.id,
			name: pm.name || 'projeto',
			kind: pm.kind || 'folder',
			openFile: pm.openFile || null,
			openTabs: Array.isArray(pm.openTabs) ? pm.openTabs.slice(0, 64) : [],
			emptyDirs: Array.isArray(pm.emptyDirs) ? pm.emptyDirs : [],
			snapSeq: pm.snapSeq || 0,
			nFiles: pm.nFiles != null ? pm.nFiles : Array.isArray(pm.files) ? pm.files.length : 0,
			nSnaps: pm.nSnaps != null ? pm.nSnaps : Array.isArray(pm.snapshots) ? pm.snapshots.length : 0,
			debuggerState: pm.debuggerState || null,
		};
		if (extra) {
			if (extra.t != null) m.t = extra.t;
			if (extra.w) m.w = extra.w;
			if (extra.rev != null) m.rev = extra.rev;
		}
		return m;
	}

	function manifestChanged(prev, next) {
		if (!prev || !next) return true;
		const a = Object.assign({}, prev, { t: 0, w: '', rev: 0 });
		const b = Object.assign({}, next, { t: 0, w: '', rev: 0 });
		return JSON.stringify(a) !== JSON.stringify(b);
	}

	function idsOf(list) {
		const out = [];
		for (let i = 0; i < (list || []).length; i++) {
			const p = list[i];
			if (p && p.id != null) out.push(String(p.id));
		}
		return out;
	}

	function stubFor(pid, hint) {
		return {
			id: pid,
			name: (hint && hint.name) || 'Projeto recuperado ' + pid,
			kind: (hint && hint.kind) || 'folder',
			openFile: (hint && hint.openFile) || null,
			openTabs: (hint && hint.openTabs) || [],
			emptyDirs: (hint && hint.emptyDirs) || [],
			snapSeq: (hint && hint.snapSeq) || 0,
			nFiles: hint && hint.nFiles != null ? hint.nFiles : null,
			nSnaps: hint && hint.nSnaps != null ? hint.nSnaps : 0,
			recuperado: true,
		};
	}

	function mergeProjects(atual, proximos, conhecidos, esquecidos, manifestos, opts) {
		const options = opts || {};
		const next = Array.isArray(proximos) ? proximos.slice() : [];
		if (options.allowShrink) return { projects: next, carried: [] };
		const forgotten = new Set();
		if (esquecidos) esquecidos.forEach((pid) => forgotten.add(String(pid)));
		const nextIds = new Set(idsOf(next));
		const atualMap = new Map();
		(atual || []).forEach((p) => {
			if (p && p.id != null) atualMap.set(String(p.id), p);
		});
		const known = new Set(atualMap.keys());
		(conhecidos || []).forEach((pid) => {
			if (pid != null) known.add(String(pid));
		});
		const carried = [];
		known.forEach((pid) => {
			if (nextIds.has(pid) || forgotten.has(pid)) return;
			const fromMeta = atualMap.get(pid);
			const fromManifest = manifestos && manifestos.get ? manifestos.get(pid) : null;
			const entry = fromMeta
				? Object.assign({}, fromMeta)
				: fromManifest
					? Object.assign({}, fromManifest)
					: stubFor(pid, null);
			delete entry.files;
			delete entry.snapshots;
			if (entry.id == null) entry.id = pid;
			next.push(entry);
			carried.push({ id: pid, name: entry.name || 'projeto', nFiles: entry.nFiles });
		});
		return { projects: next, carried: carried };
	}

	function rebuildIndex(manifestos, contagens) {
		const out = [];
		const seen = new Set();
		if (manifestos && manifestos.forEach)
			manifestos.forEach((m, pid) => {
				const id = String(pid);
				seen.add(id);
				const n = contagens && contagens.get ? contagens.get(id) : null;
				if (m && m.bloqueado) {
					out.push({ id: id, bloqueado: true, bruto: m.bruto || null, nFiles: n != null ? n : null, t: 0 });
					return;
				}
				const entry = manifestFromMeta(Object.assign({ id: id }, m || {}), null) || stubFor(id, null);
				if (n != null) entry.nFiles = n;
				entry.t = (m && m.t) || 0;
				entry.fonte = 'manifesto';
				if (n === 0 && !entry.nFiles) return;
				out.push(entry);
			});
		if (contagens && contagens.forEach)
			contagens.forEach((n, pid) => {
				const id = String(pid);
				if (seen.has(id) || !(n > 0)) return;
				const entry = stubFor(id, { nFiles: n });
				entry.t = 0;
				entry.fonte = 'arquivos';
				out.push(entry);
			});
		out.sort((a, b) => (b.t || 0) - (a.t || 0) || String(a.id).localeCompare(String(b.id)));
		return out;
	}

	function buildMarker(info) {
		const projects = (info && info.projects) || [];
		return {
			v: 1,
			t: (info && info.t) || Date.now(),
			rev: (info && info.rev) || 0,
			n: projects.length,
			persisted: info && info.persisted != null ? !!info.persisted : null,
			disco: info && info.disco != null ? !!info.disco : null,
			projects: projects.slice(0, MARKER_MAX_PROJECTS).map((p) => ({
				id: p.id,
				name: p.name || 'projeto',
				nFiles: p.nFiles != null ? p.nFiles : p.files && p.files.size != null ? p.files.size : null,
			})),
		};
	}

	function writeMarker(storage, info) {
		if (!storage) return null;
		const marker = buildMarker(info);
		try {
			storage.setItem(MARKER_KEY, JSON.stringify(marker));
		} catch (e) {
			return null;
		}
		return marker;
	}

	function readMarker(storage) {
		if (!storage) return null;
		try {
			const raw = storage.getItem(MARKER_KEY);
			if (!raw) return null;
			const m = JSON.parse(raw);
			return m && typeof m === 'object' ? m : null;
		} catch (e) {
			return null;
		}
	}

	function writeWipe(storage, info) {
		if (!storage) return null;
		const rec = { t: (info && info.t) || Date.now(), origem: (info && info.origem) || 'desconhecida' };
		try {
			storage.setItem(WIPE_KEY, JSON.stringify(rec));
		} catch (e) {
			return null;
		}
		return rec;
	}

	function readWipe(storage) {
		if (!storage) return null;
		try {
			const raw = storage.getItem(WIPE_KEY);
			return raw ? JSON.parse(raw) : null;
		} catch (e) {
			return null;
		}
	}

	function clearWipe(storage) {
		try {
			storage.removeItem(WIPE_KEY);
		} catch (e) {

		}
	}

	function writeLoss(storage, info) {
		if (!storage) return null;
		const rec = {
			t: (info && info.t) || Date.now(),
			marker: (info && info.marker) || null,
			wipe: (info && info.wipe) || null,
			texto: (info && info.texto) || '',
		};
		try {
			storage.setItem(LOSS_KEY, JSON.stringify(rec));
		} catch (e) {
			return null;
		}
		return rec;
	}

	function readLoss(storage) {
		if (!storage) return null;
		try {
			const raw = storage.getItem(LOSS_KEY);
			const r = raw ? JSON.parse(raw) : null;
			return r && typeof r === 'object' ? r : null;
		} catch (e) {
			return null;
		}
	}

	function clearLoss(storage) {
		try {
			storage.removeItem(LOSS_KEY);
		} catch (e) {

		}
	}

	function fmtDate(t) {
		try {
			return new Date(t).toLocaleString('pt-BR');
		} catch (e) {
			return String(t);
		}
	}

	function describeLoss(marker, wipe, extras) {
		const x = extras || {};
		const parts = [];
		if (marker && marker.n > 0) {
			const nomes = (marker.projects || [])
				.slice(0, 6)
				.map((p) => p.name + (p.nFiles != null ? ' (' + p.nFiles + ' arq.)' : ''))
				.join(', ');
			parts.push(
				'Na ultima gravacao confirmada (' +
					fmtDate(marker.t) +
					') havia ' +
					marker.n +
					' projeto(s): ' +
					nomes +
					(marker.n > 6 ? ' e outros' : '') +
					'.',
			);
		}
		parts.push('Agora o armazenamento do navegador nao tem nenhum deles.');
		if (wipe && wipe.t)
			parts.push(
				'Foi detectada uma tentativa de APAGAR o banco da IDE em ' +
					fmtDate(wipe.t) +
					' (origem: ' +
					wipe.origem +
					'). Codigo rodando no preview do projeto e a causa mais comum.',
			);
		else if (marker && marker.persisted === false)
			parts.push(
				'O navegador NAO tinha concedido armazenamento persistente a este site, entao ele pode ter despejado os dados para liberar espaco em disco.',
			);
		else
			parts.push(
				'Causas comuns: limpeza de dados do site (manual, antivirus ou "limpar ao fechar"), despejo por falta de espaco, modo anonimo, ou abrir a IDE por outro endereco.',
			);
		if (x.disco) parts.push('A pasta de backup no disco esta vinculada: use "Pasta de backup" para reabrir.');
		else
			parts.push(
				'Vincule uma pasta de backup no disco (painel Recentes) para que isso nunca mais signifique perda: o espelho fica fora do navegador.',
			);
		return parts.join(' ');
	}

	root.SynapseCofreManifesto = Object.freeze({
		MANIFEST_PREFIX: MANIFEST_PREFIX,
		FILE_PREFIX: FILE_PREFIX,
		MARKER_KEY: MARKER_KEY,
		WIPE_KEY: WIPE_KEY,
		LOSS_KEY: LOSS_KEY,
		manifestKey: manifestKey,
		pidFromManifestKey: pidFromManifestKey,
		pidFromFileKey: pidFromFileKey,
		manifestFromMeta: manifestFromMeta,
		manifestChanged: manifestChanged,
		mergeProjects: mergeProjects,
		rebuildIndex: rebuildIndex,
		buildMarker: buildMarker,
		writeMarker: writeMarker,
		readMarker: readMarker,
		writeWipe: writeWipe,
		readWipe: readWipe,
		clearWipe: clearWipe,
		writeLoss: writeLoss,
		readLoss: readLoss,
		clearLoss: clearLoss,
		describeLoss: describeLoss,
	});
})(typeof window !== 'undefined' ? window : globalThis);
