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

	async function espelharProjeto(p, motivo) {
		const pid = String(p.id);
		const d = await dirDoProjeto(p);
		let sh = estado.sombra.get(pid);
		if (!sh) {

			sh = new Map();
			const prev = d.manifest || (await lerManifesto(d.handle));
			if (prev && prev.hashes && typeof prev.hashes === 'object')
				Object.keys(prev.hashes).forEach(function (k) {
					sh.set(k, prev.hashes[k]);
				});
			d.manifest = prev;
			estado.sombra.set(pid, sh);
		}
		const cache = new Map();
		const vistos = new Set();
		const hashes = {};
		let escritos = 0;
		let removidos = 0;
		let erros = 0;
		let i = 0;
		for (const [path, f] of p.files) {
			i++;
			if (!f || !caminhoValido(path)) continue;
			vistos.add(path);
			const h = hashArquivo(pid, path, f);
			hashes[path] = h;
			if (sh.get(path) === h) continue;
			try {
				await escreverArquivo(d.handle, path, f, cache);
				sh.set(path, h);
				escritos++;
			} catch (e) {
				erros++;
				if (e && e.name === 'NotAllowedError') throw e;
				ignorar(e, 'cofreDisco:escrever ' + path);
			}
			if (i % CEDER_A_CADA === 0) await ceder();
		}
		const antigos = Array.from(sh.keys());
		for (let k = 0; k < antigos.length; k++) {
			const path = antigos[k];
			if (vistos.has(path)) continue;
			if (await removerArquivo(d.handle, path)) removidos++;
			sh.delete(path);
			if (k % CEDER_A_CADA === 0) await ceder();
		}
		const emptyDirs = Array.from(p.emptyDirs || []);
		for (let k = 0; k < emptyDirs.length; k++) {
			const dirPath = emptyDirs[k];
			if (!caminhoValido(dirPath)) continue;
			try {
				await dirPai(d.handle, dirPath + '/x', cache, true);
			} catch (e) {
				ignorar(e, 'cofreDisco:emptyDir');
			}
		}
		const FX = root.AURORA_PERSIST || null;
		const manifesto = {
			versao: 1,
			id: p.id,
			name: p.name,
			kind: p.kind || 'folder',
			openFile: p.openFile || null,
			openTabs: Array.isArray(p.openTabs) ? p.openTabs.slice(0, 64) : [],
			emptyDirs: emptyDirs,
			nFiles: p.files.size,
			hashes: hashes,
			rev: FX ? FX.rev : 0,
			t: Date.now(),
			motivo: motivo || '',
		};
		if (escritos || removidos || !d.manifest || d.manifest.nFiles !== p.files.size || d.manifest.name !== p.name)
			await escreverTexto(d.handle, MANIFEST_FILE, JSON.stringify(manifesto));
		d.manifest = manifesto;
		return { escritos: escritos, removidos: removidos, erros: erros };
	}

	async function executar(motivo, alvo) {
		if (!pronto()) return null;
		if (estado.ocupado) {
			estado.reexecutar = true;
			estado.motivoPendente = motivo;
			if (alvo) alvo.forEach((pid) => estado.pendentes.add(String(pid)));
			return null;
		}
		estado.ocupado = true;
		const t0 = Date.now();
		const resumo = { motivo: motivo, projetos: 0, escritos: 0, removidos: 0, erros: 0, ms: 0 };
		try {
			const lista = projetos();
			const quais = alvo ? new Set(Array.from(alvo).map(String)) : null;
			for (let i = 0; i < lista.length; i++) {
				const p = lista[i];
				if (!p || p.id == null || !p.files) continue;
				if (quais && !quais.has(String(p.id))) continue;
				const r = await espelharProjeto(p, motivo);
				resumo.projetos++;
				resumo.escritos += r.escritos;
				resumo.removidos += r.removidos;
				resumo.erros += r.erros;
				estado.pendentes.delete(String(p.id));
				await ceder();
			}
			estado.ultimoEspelho = Date.now();
			estado.ultimoErro = null;
			estado.escritosTotal += resumo.escritos;
			resumo.ms = Date.now() - t0;
			estado.ultimoResumo = resumo;
			if (resumo.escritos || resumo.removidos)
				log(
					'debug',
					`[Synapse/cofre] espelho em disco (${motivo}): ${resumo.projetos} projeto(s), ${resumo.escritos} gravado(s), ${resumo.removidos} removido(s), ${resumo.ms}ms`,
				);
			return resumo;
		} catch (e) {
			estado.ultimoErro = (e && (e.message || e.name)) || String(e);
			if (e && e.name === 'NotAllowedError') {
				estado.permissao = 'prompt';
				estado.ultimoErro = 'permissao da pasta expirou: clique em Reconectar no painel Recentes';
			}
			log('aviso', '[Synapse/cofre] falha no espelho em disco: ' + estado.ultimoErro);
			return null;
		} finally {
			estado.ocupado = false;
			try {
				if (root.AURORA_PERSIST && root.SynapseCofrePainel)
					root.SynapseCofrePainel.atualizarIndicador();
			} catch (e) {
				ignorar(e, 'cofreDisco:indicador');
			}
			if (estado.reexecutar) {
				estado.reexecutar = false;
				const m = estado.motivoPendente || 'pendente';
				estado.motivoPendente = null;
				const alvo2 = estado.pendentes.size ? new Set(estado.pendentes) : null;
				setTimeout(function () {
					executar(m, alvo2).catch(function (e) {
						ignorar(e, 'cofreDisco:reexecutar');
					});
				}, 50);
			}
		}
	}

	function espelharAgora(motivo) {
		clearTimeout(estado.timer);
		estado.timer = 0;
		return executar(motivo || 'manual', null);
	}

	function agendar(ms) {
		if (estado.timer) return;
		estado.timer = setTimeout(function () {
			estado.timer = 0;
			const alvo = estado.pendentes.size ? new Set(estado.pendentes) : null;
			executar('agendado', alvo).catch(function (e) {
				ignorar(e, 'cofreDisco:agendado');
			});
		}, ms);
	}

	function aoGravar(r, motivo, nivel) {
		if (!pronto()) return;
		const tocados = (r && Array.isArray(r.touched) && r.touched) || [];
		tocados.forEach((pid) => estado.pendentes.add(String(pid)));
		if (!tocados.length && !(r && r.written)) return;
		const urgente =
			motivo === 'pagehide' || motivo === 'oculta' || motivo === 'saindo' || (nivel | 0) > 0;
		if (urgente) {
			clearTimeout(estado.timer);
			estado.timer = 0;
			executar(motivo, new Set(estado.pendentes)).catch(function (e) {
				ignorar(e, 'cofreDisco:urgente');
			});
			return;
		}
		agendar(ATRASO_MS);
	}

	async function lerArquivos(dirHandle, prefixo, out, resumo) {
		for await (const [name, h] of dirHandle.entries()) {
			const path = prefixo ? prefixo + '/' + name : name;
			if (h.kind === 'directory') {
				await lerArquivos(h, path, out, resumo);
				continue;
			}
			if (name === MANIFEST_FILE && !prefixo) continue;
			try {
				const file = await h.getFile();
				const isText = root.Core && typeof root.Core.isTextFile === 'function' ? root.Core.isTextFile(path) !== false : true;
				const entry = { path: path, data: null, text: null, isText: isText, history: [] };
				if (isText) entry.text = await file.text();
				else entry.data = new Uint8Array(await file.arrayBuffer());
				out.push([path, entry]);
				resumo.bytes += file.size || 0;
			} catch (e) {
				resumo.erros++;
				ignorar(e, 'cofreDisco:ler ' + path);
			}
			if (out.length % CEDER_A_CADA === 0) await ceder();
		}
	}
	async function lerProjeto(pid) {
		if (!pronto()) throw new Error('pasta de backup indisponivel');
		if (!estado.dirs.size) await indexarDiretorios();
		const d = estado.dirs.get(String(pid));
		if (!d) throw new Error('projeto nao encontrado na pasta de backup');
		const files = [];
		const resumo = { bytes: 0, erros: 0 };
		await lerArquivos(d.handle, '', files, resumo);
		const m = d.manifest || {};
		return {
			id: m.id != null ? m.id : pid,
			name: m.name || d.nome,
			kind: m.kind || 'folder',
			openFile: m.openFile || null,
			openTabs: Array.isArray(m.openTabs) ? m.openTabs : [],
			emptyDirs: Array.isArray(m.emptyDirs) ? m.emptyDirs : [],
			snapSeq: 0,
			snapshots: [],
			files: files,
			__resumo: resumo,
		};
	}
	async function listarProjetos() {
		if (!pronto()) return [];
		await indexarDiretorios();
		const abertos = new Set(projetos().map((p) => String(p.id)));
		const out = [];
		estado.dirs.forEach(function (d, pid) {
			const m = d.manifest || {};
			out.push({
				pid: pid,
				nome: m.name || d.nome,
				pasta: d.nome,
				nFiles: m.nFiles != null ? m.nFiles : null,
				t: m.t || 0,
				aberto: abertos.has(pid),
			});
		});
		out.sort((a, b) => (b.t || 0) - (a.t || 0));
		return out;
	}
	async function excluirProjeto(pid) {
		if (!pronto()) return false;
		if (!estado.dirs.size) await indexarDiretorios();
		const d = estado.dirs.get(String(pid));
		if (!d) return false;
		await estado.handle.removeEntry(d.nome, { recursive: true });
		estado.dirs.delete(String(pid));
		estado.sombra.delete(String(pid));
		const pref = String(pid) + ':';
		Array.from(estado.cacheHash.keys()).forEach(function (k) {
			if (k.indexOf(pref) === 0) estado.cacheHash.delete(k);
		});
		return true;
	}

	function snapshot() {
		return {
			suportado: suportado(),
			vinculada: !!estado.handle,
			nome: estado.nome,
			permissao: estado.permissao,
			pronta: pronto(),
			carregado: estado.carregado,
			ocupado: estado.ocupado,
			pendentes: estado.pendentes.size,
			ultimoEspelho: estado.ultimoEspelho,
			ultimoErro: estado.ultimoErro,
			ultimoResumo: estado.ultimoResumo,
			projetosNaPasta: estado.dirs.size,
		};
	}

	function iniciar() {
		if (!suportado()) {
			estado.carregado = true;
			return;
		}
		carregarHandle()
			.then(function () {
				try {
					if (root.SynapseCofrePainel) root.SynapseCofrePainel.atualizarIndicador();
				} catch (e) {
					ignorar(e, 'cofreDisco:indicador');
				}
				if (pronto()) agendar(ATRASO_BOOT_MS);
			})
			.catch(function (e) {
				ignorar(e, 'cofreDisco:iniciar');
			});
		try {
			root.addEventListener('pagehide', function () {
				if (pronto() && estado.pendentes.size)
					executar('pagehide', new Set(estado.pendentes)).catch(function (e) {
						ignorar(e, 'cofreDisco:pagehide');
					});
			});
		} catch (e) {
			ignorar(e, 'cofreDisco:iniciar');
		}
	}

	root.SynapseCofreDisco = Object.freeze({
		MANIFEST_FILE: MANIFEST_FILE,
		suportado: suportado,
		estado: snapshot,
		pronta: pronto,
		vincular: vincular,
		reconectar: reconectar,
		desvincular: desvincular,
		espelharAgora: espelharAgora,
		aoGravar: aoGravar,
		listarProjetos: listarProjetos,
		lerProjeto: lerProjeto,
		excluirProjeto: excluirProjeto,
		hashTexto: hashTexto,
		hashBytes: hashBytes,
		nomeSeguro: nomeSeguro,
	});

	iniciar();
})(typeof window !== 'undefined' ? window : globalThis);
