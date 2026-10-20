(function (raiz, fabrica) {
	'use strict';
	if (typeof module === 'object' && module.exports) module.exports = fabrica();
	else raiz.SYNAPSE_BUNDLE = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
	'use strict';

	const FORA = /(^|\/)(node_modules|\.git|\.svn|\.cache|__pycache__)(\/|$)/i;

	const MARCAS = [
		/wasmBinary/,
		/_emscripten_|emscripten_set_main_loop|EmscriptenModule/,
		/createWasm|instantiateAsync|asmLibraryArg|wasmImports|wasmExports/,
		/Module\s*\[\s*['"]canvas['"]\s*\]|Module\.canvas|moduleArg/,
		/onRuntimeInitialized/,
		/HEAPU8|_malloc|stackAlloc|dynCall/,
		/\.data['"]|preloadedAudios|FS_createPreloadedFile/,
	];

	const PREFERIDAS = [
		'web',
		'build',
		'dist',
		'out',
		'public',
		'docs',
		'site',
		'wasm',
		'emscripten',
	];

	function termina(s, suf) {
		return s.length >= suf.length && s.slice(s.length - suf.length) === suf;
	}

	function naoEhGlue(n) {
		const b = String(n || '').toLowerCase();
		return (
			termina(b, '.worker.js') ||
			termina(b, '.worklet.js') ||
			termina(b, '-worker.js') ||
			b === 'sw.js' ||
			b === 'service-worker.js'
		);
	}

	function magicaOk(bytes) {
		try {
			const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
			return u.length >= 8 && u[0] === 0 && u[1] === 0x61 && u[2] === 0x73 && u[3] === 0x6d;
		} catch (e) {
			return false;
		}
	}

	function ehEsm(texto) {
		if (!texto) return false;
		const NL = String.fromCharCode(10);
		const CR = String.fromCharCode(13);
		const TAB = String.fromCharCode(9);
		let i = -1;
		while ((i = texto.indexOf('export', i + 1)) >= 0) {
			const antes = i === 0 ? NL : texto.charAt(i - 1);
			if (
				antes !== NL &&
				antes !== CR &&
				antes !== ';' &&
				antes !== '}' &&
				antes !== ' ' &&
				antes !== TAB
			)
				continue;
			const resto = texto.slice(i + 6);
			let j = 0;
			while (
				j < resto.length &&
				(resto.charAt(j) === ' ' ||
					resto.charAt(j) === TAB ||
					resto.charAt(j) === NL ||
					resto.charAt(j) === CR)
			)
				j++;
			const d = resto.slice(j, j + 9);
			if (d.indexOf('default') === 0 || d.charAt(0) === '{' || d.charAt(0) === '*') return true;
			if (
				d.indexOf('function') === 0 ||
				d.indexOf('class') === 0 ||
				d.indexOf('const') === 0 ||
				d.indexOf('let ') === 0 ||
				d.indexOf('var ') === 0
			)
				return true;
		}
		return false;
	}

	function dir(caminho) {
		const i = caminho.lastIndexOf('/');
		return i < 0 ? '' : caminho.slice(0, i + 1);
	}
	function nome(caminho) {
		const i = caminho.lastIndexOf('/');
		return i < 0 ? caminho : caminho.slice(i + 1);
	}
	function semExt(n) {
		const i = n.lastIndexOf('.');
		return i <= 0 ? n : n.slice(0, i);
	}
	function ext(n) {
		const i = n.lastIndexOf('.');
		return i < 0 ? '' : n.slice(i + 1).toLowerCase();
	}

	function normalizar(arquivos) {
		const saida = [];
		if (!arquivos) return saida;
		let lista = arquivos;
		if (!Array.isArray(arquivos)) {
			lista = [];
			for (let k in arquivos) {
				if (Object.prototype.hasOwnProperty.call(arquivos, k))
					lista.push({ caminho: k, conteudo: arquivos[k] });
			}
		}
		for (let i = 0; i < lista.length; i++) {
			const a = lista[i];
			if (!a) continue;
			if (typeof a === 'string') {
				saida.push({ caminho: a, conteudo: '', bytes: null });
				continue;
			}
			const caminho = a.caminho || a.path || a.nome || a.name;
			if (!caminho) continue;
			const conteudo =
				a.conteudo != null
					? a.conteudo
					: a.content != null
						? a.content
						: a.texto != null
							? a.texto
							: a.text;
			let bytes = a.bytes || a.dados || a.data || null;
			if (bytes && typeof bytes === 'string') bytes = null;
			saida.push({
				caminho: String(caminho).replace(/\\/g, '/').replace(/^\.\//, ''),
				conteudo: typeof conteudo === 'string' ? conteudo : '',
				bytes: bytes,
			});
		}
		return saida;
	}

	function pontos(texto) {
		let n = 0;
		for (let i = 0; i < MARCAS.length; i++) if (MARCAS[i].test(texto)) n++;
		return n;
	}

	function ehGlue(texto) {
		if (!texto || texto.length < 200) return false;
		return pontos(texto) >= 2;
	}

	function preferencia(caminho) {
		const p = caminho.toLowerCase();
		for (let i = 0; i < PREFERIDAS.length; i++) {
			if (p.includes(`/${PREFERIDAS[i]}/`) || p.indexOf(PREFERIDAS[i] + '/') === 0) return i;
		}
		return PREFERIDAS.length;
	}

	function achar(arquivos) {
		const lista = normalizar(arquivos);
		if (!lista.length) return null;

		const cands = [];
		let i;
		for (i = 0; i < lista.length; i++) {
			const a = lista[i];
			if (FORA.test(a.caminho)) continue;
			const e = ext(nome(a.caminho));
			if (e !== 'js' && e !== 'mjs') continue;
			if (naoEhGlue(nome(a.caminho))) continue;
			if (!ehGlue(a.conteudo)) continue;
			cands.push(a);
		}
		if (!cands.length) return null;

		cands.sort(function (x, y) {
			const px = preferencia(x.caminho),
				py = preferencia(y.caminho);
			if (px !== py) return px - py;
			if (x.caminho.length !== y.caminho.length) return x.caminho.length - y.caminho.length;
			return x.caminho < y.caminho ? -1 : 1;
		});

		const glue = cands[0];
		const pasta = dir(glue.caminho);
		const raizNome = semExt(nome(glue.caminho));
		const avisos = [];

		function naPasta(cond) {
			for (let j = 0; j < lista.length; j++) {
				if (dir(lista[j].caminho) !== pasta) continue;
				if (cond(lista[j])) return lista[j];
			}
			return null;
		}

		const wasm =
			naPasta(function (f) {
				return nome(f.caminho) === raizNome + '.wasm';
			}) ||
			naPasta(function (f) {
				return ext(nome(f.caminho)) === 'wasm';
			});

		let dados =
			naPasta(function (f) {
				return nome(f.caminho) === raizNome + '.data';
			}) ||
			naPasta(function (f) {
				return ext(nome(f.caminho)) === 'data';
			});

		const html = naPasta(function (f) {
			return ext(nome(f.caminho)) === 'html';
		});

		let faltando = null;
		const tamWasm = wasm && wasm.bytes ? wasm.bytes.byteLength || wasm.bytes.length || 0 : 0;
		if (wasm && wasm.bytes && tamWasm === 0) {
			faltando = 'wasm-vazio';
		} else if (wasm && wasm.bytes && !magicaOk(wasm.bytes)) {
			faltando = 'wasm-corrompido';
		} else if (wasm && !wasm.bytes) {
			faltando = 'bytes-do-wasm';
		} else if (!wasm) {
			avisos.push(
				`Nao achei .wasm ao lado de ${nome(glue.caminho)}. Se o build foi feito com WASM=0 (asm.js) isso e normal e ele ainda roda.`,
			);
		}
		if (dados && !dados.bytes) {
			avisos.push(
				`Achei ${nome(dados.caminho)} (arquivos empacotados) mas sem os bytes; o programa pode nao encontrar assets.`,
			);
			dados = null;
		}
		if (html) {
			avisos.push(
				`Ignorando ${nome(html.caminho)} de proposito: o preview usa o painel do site (com console e barra de estado) em vez do HTML gerado pelo compilador.`,
			);
		}

		return {
			tipo: 'emscripten',
			base: pasta,
			js: { caminho: glue.caminho, conteudo: glue.conteudo, tamanho: glue.conteudo.length },
			wasm:
				wasm && wasm.bytes
					? {
							caminho: wasm.caminho,
							bytes: wasm.bytes,
							tamanho: wasm.bytes.byteLength || wasm.bytes.length || 0,
						}
					: null,
			dados:
				dados && dados.bytes
					? { caminho: dados.caminho, nome: nome(dados.caminho), bytes: dados.bytes }
					: null,
			html: html ? { caminho: html.caminho } : null,
			esm: ehEsm(glue.conteudo) || ext(nome(glue.caminho)) === 'mjs',
			faltando: faltando,
			avisos: avisos,
			candidatos: cands.length,
		};
	}

	return { achar: achar, ehGlue: ehGlue, pontos: pontos, _normalizar: normalizar };
});
