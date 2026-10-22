(function (root) {
	'use strict';
	if (root.SynapseCofreDisco || root.SynapsePreviewSession) return;

	const HANDLE_KEY = 'cofre.dir';
	const MANIFEST_FILE = '.synapse-projeto.json';
	const ATRASO_MS = 45000;
	const ATRASO_BOOT_MS = 20000;
	const AMOSTRA_BYTES = 8 * 1024 * 1024;
	const CEDER_A_CADA = 12;

	const estado = {
		handle: null,
		nome: '',
		permissao: null,
		carregado: false,
		ultimoEspelho: 0,
		ultimoErro: null,
		ocupado: false,
		reexecutar: false,
		motivoPendente: null,
		pendentes: new Set(),
		timer: 0,
		dirs: new Map(),
		sombra: new Map(),
		cacheHash: new Map(),
		escritosTotal: 0,
		ultimoResumo: null,
	};

	function ignorar(e, ctx) {
		try {
			if (typeof root.ignorarErro === 'function') root.ignorarErro(e, ctx);
		} catch (e2) {

		}
	}
	function log(nivel, msg) {
		try {
			if (root.registro && typeof root.registro[nivel] === 'function') root.registro[nivel](msg);
		} catch (e) {

		}
	}
	function store() {
		return root.SynapseSessionStore || null;
	}
	function projetos() {
		return (root.State && Array.isArray(root.State.projects) && root.State.projects) || [];
	}
	function suportado() {
		return typeof root.showDirectoryPicker === 'function' && root.isSecureContext !== false;
	}
	function pronto() {
		return !!estado.handle && estado.permissao === 'granted';
	}

	function ceder() {
		try {
			if (root.scheduler && typeof root.scheduler.yield === 'function')
				return root.scheduler.yield().catch(function () {});
		} catch (e) {

		}
		return new Promise(function (res) {
			setTimeout(res, 0);
		});
	}

	function hashTexto(s) {
		let h = 0x811c9dc5;
		for (let i = 0; i < s.length; i++) {
			h ^= s.charCodeAt(i);
			h = Math.imul(h, 0x01000193);
		}
		return (h >>> 0).toString(16) + ':' + s.length;
	}
	function hashBytes(b) {
		let h = 0x811c9dc5;
		const n = b.length;
		if (n <= AMOSTRA_BYTES) {
			for (let i = 0; i < n; i++) {
				h ^= b[i];
				h = Math.imul(h, 0x01000193);
			}
		} else {
			const passo = Math.ceil(n / (AMOSTRA_BYTES / 2));
			for (let i = 0; i < n; i += passo) {
				h ^= b[i];
				h = Math.imul(h, 0x01000193);
			}
			for (let i = Math.max(0, n - 65536); i < n; i++) {
				h ^= b[i];
				h = Math.imul(h, 0x01000193);
			}
		}
		return 'b' + (h >>> 0).toString(16) + ':' + n;
	}
	function hashArquivo(pid, path, f) {
		const ref = typeof f.text === 'string' ? f.text : f.data || null;
		const chave = pid + ':' + path;
		const c = estado.cacheHash.get(chave);
		if (c && c.ref === ref) return c.hash;
		const hash =
			typeof f.text === 'string'
				? hashTexto(f.text)
				: f.data
					? hashBytes(f.data)
					: 'vazio:0';
		estado.cacheHash.set(chave, { ref: ref, hash: hash });
		return hash;
	}

	async function carregarHandle() {
		const S = store();
		if (!S) return;
		try {
			const rec = await S.getRecord(HANDLE_KEY);
			if (rec && rec.handle) {
				estado.handle = rec.handle;
				estado.nome = rec.nome || rec.handle.name || 'pasta';
				await consultarPermissao();
			}
		} catch (e) {
			ignorar(e, 'cofreDisco:carregarHandle');
		} finally {
			estado.carregado = true;
		}
	}
	async function consultarPermissao() {
		if (!estado.handle) return (estado.permissao = null);
		try {
			estado.permissao = await estado.handle.queryPermission({ mode: 'readwrite' });
		} catch (e) {
			estado.permissao = 'prompt';
		}
		return estado.permissao;
	}
	async function vincular() {
		if (!suportado()) throw new Error('Este navegador nao suporta pasta de backup (use Chrome/Edge).');
		const h = await root.showDirectoryPicker({
			id: 'synapse-cofre',
			mode: 'readwrite',
			startIn: 'documents',
		});
		estado.handle = h;
		estado.nome = h.name || 'pasta';
		estado.permissao = 'granted';
		estado.dirs.clear();
		estado.sombra.clear();
		estado.ultimoErro = null;
		const S = store();
		if (S) await S.putRecord(HANDLE_KEY, { handle: h, nome: estado.nome, t: Date.now() });
		espelharAgora('vinculada').catch(function (e) {
			ignorar(e, 'cofreDisco:vincular');
		});
		return estado.nome;
	}
	async function reconectar() {
		if (!estado.handle) return false;
		try {
			estado.permissao = await estado.handle.requestPermission({ mode: 'readwrite' });
		} catch (e) {
			estado.permissao = 'prompt';
			ignorar(e, 'cofreDisco:reconectar');
		}
		if (estado.permissao === 'granted') {
			estado.ultimoErro = null;
			espelharAgora('reconectada').catch(function (e) {
				ignorar(e, 'cofreDisco:reconectar');
			});
		}
		return estado.permissao === 'granted';
	}
	async function desvincular() {
		estado.handle = null;
		estado.nome = '';
		estado.permissao = null;
		estado.dirs.clear();
		estado.sombra.clear();
		estado.pendentes.clear();
		const S = store();
		if (S)
			try {
				await S.deleteRecord(HANDLE_KEY);
			} catch (e) {
				ignorar(e, 'cofreDisco:desvincular');
			}
	}

	function nomeSeguro(n) {
		const s = String(n || 'projeto')
			.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-')
			.replace(/^\.+/, '')
			.trim()
			.slice(0, 60);
		return s || 'projeto';
	}
	async function lerManifesto(dirHandle) {
		try {
			const fh = await dirHandle.getFileHandle(MANIFEST_FILE);
			const f = await fh.getFile();
			const m = JSON.parse(await f.text());
			return m && typeof m === 'object' ? m : null;
		} catch (e) {
			return null;
		}
	}
	async function indexarDiretorios() {
		estado.dirs.clear();
		if (!pronto()) return estado.dirs;
		for await (const [name, h] of estado.handle.entries()) {
			if (!h || h.kind !== 'directory') continue;
			const m = await lerManifesto(h);
			if (m && m.id != null) estado.dirs.set(String(m.id), { handle: h, nome: name, manifest: m });
		}
		return estado.dirs;
	}
	async function dirDoProjeto(p) {
		const pid = String(p.id);
		let d = estado.dirs.get(pid);
		if (d) return d;
		if (!estado.dirs.size) await indexarDiretorios();
		d = estado.dirs.get(pid);
		if (d) return d;
		const nome = nomeSeguro(p.name) + '__' + pid;
		const handle = await estado.handle.getDirectoryHandle(nome, { create: true });
		d = { handle: handle, nome: nome, manifest: null };
		estado.dirs.set(pid, d);
		return d;
	}
	async function dirPai(rootHandle, path, cache, criar) {
		const partes = path.split('/');
		partes.pop();
		let h = rootHandle;
		let acc = '';
		for (let i = 0; i < partes.length; i++) {
			acc = acc ? acc + '/' + partes[i] : partes[i];
			let c = cache.get(acc);
			if (!c) {
				c = await h.getDirectoryHandle(partes[i], { create: !!criar });
				cache.set(acc, c);
			}
			h = c;
		}
		return h;
	}
	function caminhoValido(p) {
		if (typeof p !== 'string' || !p) return false;
		if (/[\\:*?"<>|\u0000-\u001f]/.test(p)) return false;
		return p.split('/').every(function (s) {
			return s && s !== '.' && s !== '..' && s !== MANIFEST_FILE;
		});
	}
	async function escreverArquivo(rootHandle, path, f, cache) {
		const dir = await dirPai(rootHandle, path, cache, true);
		const nome = path.split('/').pop();
		const fh = await dir.getFileHandle(nome, { create: true });
		const w = await fh.createWritable();
		try {
			if (f.data) await w.write(f.data);
			else await w.write(typeof f.text === 'string' ? f.text : '');
		} finally {
			await w.close();
		}
	}
	async function escreverTexto(rootHandle, nome, texto) {
		const fh = await rootHandle.getFileHandle(nome, { create: true });
		const w = await fh.createWritable();
		try {
			await w.write(texto);
		} finally {
			await w.close();
		}
	}
	async function pastaVazia(h) {
		for await (const _k of h.keys()) return false;
		return true;
	}
	async function removerArquivo(rootHandle, path) {
		const cache = new Map();
		let dir;
		try {
			dir = await dirPai(rootHandle, path, cache, false);
		} catch (e) {
			return false;
		}
		const nome = path.split('/').pop();
		try {
			await dir.removeEntry(nome);
		} catch (e) {
			return false;
		}

		const partes = path.split('/');
		partes.pop();
		for (let n = 0; n < 6 && partes.length; n++) {
			const acc = partes.join('/');
			const h = cache.get(acc);
			if (!h) break;
			try {
				if (!(await pastaVazia(h))) break;
				const pai = partes.length > 1 ? cache.get(partes.slice(0, -1).join('/')) : rootHandle;
				if (!pai) break;
				await pai.removeEntry(partes[partes.length - 1]);
			} catch (e) {
				break;
			}
			partes.pop();
		}
		return true;
	}
})(typeof window !== 'undefined' ? window : globalThis);
