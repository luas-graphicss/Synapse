(function (raiz, fabrica) {
	'use strict';
	const api = fabrica();
	if (typeof module === 'object' && module && module.exports) module.exports = api;
	else raiz.SYNAPSE_DETECCAO = api;
})(typeof self !== 'undefined' ? self : this, function () {
	'use strict';

	const LIXO =
		/(^|\/)(node_modules|\.git|\.svn|dist|build|out|bin|obj|target|\.next|\.cache|vendor|__pycache__)(\/|$)/i;

	const GUI_PORTAVEL = [
		{ re: /#\s*include\s*[<"](?:SDL2\/)?SDL\.h[>"]/i, lib: 'SDL2' },
		{ re: /#\s*include\s*[<"]raylib\.h[>"]/i, lib: 'raylib' },
		{ re: /#\s*include\s*[<"](?:imgui|imgui\/imgui)\.h[>"]/i, lib: 'Dear ImGui' },
		{ re: /#\s*include\s*[<"]GLFW\/glfw3\.h[>"]/i, lib: 'GLFW' },
		{ re: /#\s*include\s*[<"]GL\/(?:gl|glew)\.h[>"]/i, lib: 'OpenGL' },
		{ re: /#\s*include\s*[<"]SFML\//i, lib: 'SFML' },
	];

	const GUI_NATIVA = [
		{ re: /#\s*include\s*[<"]windows\.h[>"]/i, lib: 'Win32' },
		{ re: /#\s*include\s*[<"]gtk\/gtk\.h[>"]/i, lib: 'GTK' },
		{ re: /#\s*include\s*[<"]QtWidgets\//i, lib: 'Qt Widgets' },
		{ re: /#\s*include\s*[<"]FL\/Fl\.H[>"]/i, lib: 'FLTK' },
	];

	function ext(caminho) {
		const m = /\.([a-z0-9_+]+)$/i.exec(caminho || '');
		return m ? m[1].toLowerCase() : '';
	}
	function base(caminho) {
		const p = String(caminho || '').split('/');
		return p[p.length - 1];
	}

	function normalizar(arquivos) {
		const lista = [];
		if (!arquivos) return lista;
		if (Array.isArray(arquivos)) {
			for (let i = 0; i < arquivos.length; i++) {
				const a = arquivos[i];
				if (typeof a === 'string') lista.push({ caminho: a, conteudo: '' });
				else if (a && a.caminho !== undefined)
					lista.push({
						caminho: String(a.caminho),
						conteudo: a.conteudo == null ? '' : String(a.conteudo),
					});
				else if (a && a.path !== undefined)
					lista.push({
						caminho: String(a.path),
						conteudo: a.content == null ? '' : String(a.content),
					});
				else if (a && a.nome !== undefined)
					lista.push({
						caminho: String(a.nome),
						conteudo: a.conteudo == null ? '' : String(a.conteudo),
					});
			}
		} else if (typeof arquivos === 'object') {
			for (let k in arquivos) {
				if (!Object.prototype.hasOwnProperty.call(arquivos, k)) continue;
				const v = arquivos[k];
				lista.push({
					caminho: k,
					conteudo: typeof v === 'string' ? v : v && v.conteudo != null ? String(v.conteudo) : '',
				});
			}
		}
		const limpo = [];
		for (let j = 0; j < lista.length; j++) if (!LIXO.test(lista[j].caminho)) limpo.push(lista[j]);
		return limpo;
	}

	function achar(lista, nomes) {
		for (let i = 0; i < lista.length; i++) {
			const b = base(lista[i].caminho).toLowerCase();
			for (let j = 0; j < nomes.length; j++) if (b === nomes[j]) return lista[i];
		}
		return null;
	}

	function porExt(lista, exts) {
		const out = [];
		for (let i = 0; i < lista.length; i++)
			if (exts.includes(ext(lista[i].caminho))) out.push(lista[i]);
		return out;
	}

	function acharEntrada(cands, regex, preferidos) {
		let i;
		let temConteudo = false;
		let achouMain = false;
		for (i = 0; i < cands.length; i++) {
			if ((cands[i].conteudo || '').length) temConteudo = true;
			if (regex.test(cands[i].conteudo || '')) achouMain = true;
		}
		entradaConfirmada = achouMain || !temConteudo;

		for (i = 0; i < cands.length; i++) {
			const b = base(cands[i].caminho).toLowerCase();
			if (preferidos.includes(b)) return cands[i].caminho;
		}
		for (i = 0; i < cands.length; i++)
			if (regex.test(cands[i].conteudo || '')) return cands[i].caminho;
		return cands.length ? cands[0].caminho : null;
	}

	function varrerGui(cands) {
		const achados = { portavel: [], nativa: [] };
		for (let i = 0; i < cands.length; i++) {
			const txt = cands[i].conteudo || '';
			if (!txt) continue;
			let k;
			for (k = 0; k < GUI_PORTAVEL.length; k++) {
				if (GUI_PORTAVEL[k].re.test(txt) && !achados.portavel.includes(GUI_PORTAVEL[k].lib))
					achados.portavel.push(GUI_PORTAVEL[k].lib);
			}
			for (k = 0; k < GUI_NATIVA.length; k++) {
				if (GUI_NATIVA[k].re.test(txt) && !achados.nativa.includes(GUI_NATIVA[k].lib))
					achados.nativa.push(GUI_NATIVA[k].lib);
			}
		}
		return achados;
	}

	var entradaConfirmada = true;

	function resultado(o) {
		const avisos = (o.avisos || []).slice();
		if (!entradaConfirmada) {
			avisos.unshift(
				'Nao encontrei o ponto de entrada (main) nos arquivos importados. Confira se o arquivo principal entrou no projeto.',
			);
		}
		return {
			tipo: o.tipo,
			nivel: o.nivel,
			gui: !!o.gui,
			entrada: o.entrada || null,
			toolchain: o.toolchain || null,
			motivo: o.motivo || '',
			libs: o.libs || [],
			avisos: avisos,
		};
	}

	function detectar(arquivos) {
		entradaConfirmada = true;
		const lista = normalizar(arquivos);
		if (!lista.length) {
			return resultado({ tipo: 'vazio', nivel: 0, motivo: 'Nenhum arquivo no projeto' });
		}

		if (achar(lista, ['cargo.toml'])) {
			const rs = porExt(lista, ['rs']);
			const cargoTxt = (achar(lista, ['cargo.toml']) || {}).conteudo || '';
			const guiRust = /\b(eframe|egui|macroquad|bevy|iced|slint)\b/i.exec(cargoTxt);
			return resultado({
				tipo: 'rust',
				nivel: 2,
				gui: !!guiRust,
				entrada: acharEntrada(rs, /fn\s+main\s*\(/, ['main.rs']),
				toolchain: 'cargo-wasm',
				libs: guiRust ? [guiRust[1]] : [],
				motivo: 'Cargo.toml encontrado',
				avisos: [
					'O compilador do Rust nao roda dentro do navegador. Precisa do Relay ou da nuvem.',
				],
			});
		}

		let csproj = null;
		const projetos = [];
		for (let i = 0; i < lista.length; i++) {
			const e = ext(lista[i].caminho);
			if (e === 'csproj' || e === 'sln' || e === 'fsproj') {
				projetos.push(lista[i]);
				if (!csproj || (e !== 'sln' && /\.sln$/i.test(csproj.caminho || ''))) csproj = lista[i];
			}
		}
		const cs = porExt(lista, ['cs']);
		if (csproj || cs.length) {
			let projTxt = '';
			for (let pj = 0; pj < projetos.length; pj++) projTxt += (projetos[pj].conteudo || '') + '\n';
			const avalonia = /Avalonia/i.test(projTxt);
			const wpf = /<UseWPF>\s*true|<UseWindowsForms>\s*true/i.test(projTxt);
			if (wpf) {
				return resultado({
					tipo: 'csharp',
					nivel: 0,
					gui: true,
					entrada: acharEntrada(cs, /static\s+(?:async\s+)?(?:void|int|Task)\s+Main\s*\(/, [
						'program.cs',
					]),
					toolchain: null,
					libs: ['WPF/WinForms'],
					motivo: 'Projeto .NET com UI nativa do Windows',
					avisos: [
						'WPF e WinForms nao existem no navegador. Migrar para Avalonia habilita o preview web.',
					],
				});
			}
			return resultado({
				tipo: 'csharp',
				nivel: avalonia ? 2 : 1,
				gui: avalonia,
				entrada: acharEntrada(cs, /static\s+(?:async\s+)?(?:void|int|Task)\s+Main\s*\(/, [
					'program.cs',
				]),
				toolchain: avalonia ? 'avalonia-browser' : 'roslyn-wasm',
				libs: avalonia ? ['Avalonia'] : [],
				motivo: csproj ? base(csproj.caminho) + ' encontrado' : 'Arquivos .cs encontrados',
				avisos: avalonia
					? ['Avalonia com browser head precisa do dotnet publish, entao roda no nivel 2.']
					: [],
			});
		}

		const cpps = porExt(lista, ['cpp', 'cc', 'cxx', 'c++', 'hpp', 'hh']);
		const cs_ = porExt(lista, ['c', 'h']);
		if (cpps.length || cs_.length) {
			const ehCpp = cpps.length > 0;
			const cands = ehCpp ? cpps.concat(cs_) : cs_;
			const gui = varrerGui(cands);
			const entrada = acharEntrada(
				cands,
				/\bint\s+main\s*\(|\bvoid\s+main\s*\(/,
				ehCpp ? ['main.cpp', 'main.cc', 'main.cxx', 'main.c'] : ['main.c'],
			);
			const temMake = achar(lista, ['cmakelists.txt', 'makefile', 'meson.build']);

			if (gui.nativa.length) {
				return resultado({
					tipo: ehCpp ? 'cpp' : 'c',
					nivel: 0,
					gui: true,
					entrada: entrada,
					toolchain: null,
					libs: gui.nativa,
					motivo: 'Usa GUI amarrada ao sistema operacional',
					avisos: [
						gui.nativa.join(' / ') +
							' nao tem equivalente no navegador. Portar para SDL2 ou raylib habilita o preview.',
					],
				});
			}

			if (gui.portavel.length) {
				return resultado({
					tipo: ehCpp ? 'cpp' : 'c',
					nivel: 2,
					gui: true,
					entrada: entrada,
					toolchain: 'emscripten',
					libs: gui.portavel,
					motivo: `Usa ${gui.portavel.join(' + ')}, que compila para canvas`,
					avisos: [
						'GUI portavel: o preview sai em canvas/WebGL. Se o projeto trouxer a pasta do build web (build/, web/, dist/, out/), o preview roda aqui na hora; senao e preciso rodar o emcc uma vez ou usar o Relay.',
					],
				});
			}

			return resultado({
				tipo: ehCpp ? 'cpp' : 'c',
				nivel: 1,
				gui: false,
				entrada: entrada,
				toolchain: 'clang-wasi',
				libs: [],
				motivo: temMake
					? base(temMake.caminho) + ' + fontes ' + (ehCpp ? 'C++' : 'C')
					: `Fontes ${ehCpp ? 'C++' : 'C'} de console`,
				avisos: ehCpp
					? ['WASI nao suporta threads nem excecoes de C++. Codigo que depende disso pode falhar.']
					: [],
			});
		}

		if (achar(lista, ['pubspec.yaml'])) {
			return resultado({
				tipo: 'flutter',
				nivel: 2,
				gui: true,
				entrada: 'lib/main.dart',
				toolchain: 'flutter-web',
				motivo: 'pubspec.yaml encontrado',
			});
		}

		if (achar(lista, ['go.mod'])) {
			return resultado({
				tipo: 'go',
				nivel: 2,
				gui: false,
				entrada: acharEntrada(porExt(lista, ['go']), /func\s+main\s*\(/, ['main.go']),
				toolchain: 'go-wasm',
				motivo: 'go.mod encontrado',
				avisos: ['O compilador do Go nao roda no navegador. Precisa do Relay.'],
			});
		}

		const py = porExt(lista, ['py']);
		if (py.length) {
			return resultado({
				tipo: 'python',
				nivel: 1,
				gui: false,
				entrada: acharEntrada(py, /if\s+__name__\s*==/, ['main.py', 'app.py', '__main__.py']),
				toolchain: 'pyodide',
				motivo: 'Fontes Python encontradas',
			});
		}

		const html = porExt(lista, ['html', 'htm']);
		const pkg = achar(lista, ['package.json']);
		if (html.length || pkg) {
			let precisaBundler = false;
			const libsWeb = [];
			if (pkg) {
				const t = pkg.conteudo || '';
				if (/"(vite|webpack|parcel|rollup|esbuild|next|nuxt)"/i.test(t)) {
					precisaBundler = true;
				}
				const mm = /"(react|vue|svelte|solid-js|preact)"/i.exec(t);
				if (mm) libsWeb.push(mm[1]);
			}
			return resultado({
				tipo: 'web',
				nivel: precisaBundler ? 2 : 1,
				gui: true,
				entrada: html.length ? (achar(html, ['index.html']) || html[0]).caminho : null,
				toolchain: precisaBundler ? 'dev-server' : 'nativo',
				libs: libsWeb,
				motivo: precisaBundler
					? 'package.json com bundler'
					: html.length
						? 'HTML estatico'
						: 'package.json encontrado',
			});
		}

		return resultado({
			tipo: 'desconhecido',
			nivel: 0,
			motivo: 'Nao reconheci a linguagem do projeto',
			avisos: [
				'Adicione um arquivo de entrada reconhecivel (index.html, main.c, Program.cs, Cargo.toml...).',
			],
		});
	}

	return { detectar: detectar, normalizar: normalizar };
});
