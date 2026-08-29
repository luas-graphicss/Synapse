(function (raiz, fabrica) {
	'use strict';
	const api = fabrica();
	if (typeof module === 'object' && module && module.exports) module.exports = api;
	else raiz.SYNAPSE_CATALOGO = api;
})(typeof self !== 'undefined' ? self : this, function () {
	'use strict';

	const CATALOGO = [
		{
			id: 'clang-wasi',
			nome: 'Clang para WASI',
			linguagens: ['c', 'cpp'],
			nivel: 1,
			versao: '0.0.0-PREENCHER',
			verificado: false,
			notas: 'Compila C/C++ de console para WebAssembly WASI. Roda direto no navegador.',
			recursos: [
				{ nome: 'clang.wasm', urls: [], bytes: 32000000 },
				{ nome: 'lld.wasm', urls: [], bytes: 8000000 },
				{ nome: 'sysroot.tar', urls: [], bytes: 6000000 },
			],
		},
		{
			id: 'roslyn-wasm',
			nome: 'Roslyn para C#',
			linguagens: ['csharp'],
			nivel: 1,
			versao: '0.0.0-PREENCHER',
			verificado: false,
			notas: 'Compilador do C# rodando sobre .NET WebAssembly. Interpretado, nao JIT.',
			recursos: [
				{ nome: 'dotnet.wasm', urls: [], bytes: 24000000 },
				{ nome: 'roslyn.bundle', urls: [], bytes: 12000000 },
			],
		},
		{
			id: 'emscripten',
			nome: 'Emscripten (SDL2/raylib/ImGui -> canvas)',
			linguagens: ['c', 'cpp'],
			nivel: 2,
			versao: '0.0.0-PREENCHER',
			verificado: false,
			notas:
				'Nivel 2: GUI portavel virando canvas/WebGL. IMPORTANTE: se o projeto importado ja ' +
				'trouxer a pasta do build web (build/, web/, dist/, docs/...), o preview roda SEM nada ' +
				'disto -- bundle-web.js acha o .js + .wasm e o orquestrador serve na hora.',
			recursos: [
				{ nome: 'clang.wasm', urls: [], bytes: 32000000 },
				{ nome: 'wasm-ld.wasm', urls: [], bytes: 8000000 },
				{ nome: 'sysroot-emscripten.tar', urls: [], bytes: 14000000 },
				{ nome: 'libsdl2.a', urls: [], bytes: 4000000 },
			],
		},
		{
			id: 'avalonia-browser',
			nome: 'Avalonia para navegador',
			linguagens: ['csharp'],
			nivel: 2,
			versao: '0.0.0-PREENCHER',
			verificado: false,
			notas:
				'Nivel 2: C# com GUI Avalonia. O caminho realista e rodar "dotnet publish" com o head browser-wasm e importar a pasta AppBundle/wwwroot resultante -- bundle-web.js reconhece e serve.',
			recursos: [
				{ nome: 'dotnet.wasm', urls: [], bytes: 24000000 },
				{ nome: 'avalonia.bundle', urls: [], bytes: 18000000 },
			],
		},
		{
			id: 'pyodide',
			nome: 'Pyodide',
			linguagens: ['python'],
			nivel: 1,
			versao: '0.0.0-PREENCHER',
			verificado: false,
			notas: 'CPython compilado para WebAssembly.',
			recursos: [{ nome: 'pyodide.asm.wasm', urls: [], bytes: 9000000 }],
		},
	];

	function registrarTudo(motor) {
		motor = motor || (typeof self !== 'undefined' ? self.SYNAPSE_TOOLCHAINS : null);
		if (!motor)
			return {
				registrados: [],
				pendentes: CATALOGO.map(function (d) {
					return d.id;
				}),
			};
		const registrados = [],
			pendentes = [];
		for (let i = 0; i < CATALOGO.length; i++) {
			var d = CATALOGO[i];
			let completo = d.recursos.length > 0;
			for (let j = 0; j < d.recursos.length; j++) {
				const u = d.recursos[j].urls;
				if (!u || !u.length) {
					completo = false;
					break;
				}
			}
			if (completo) {
				motor.registrar(d);
				registrados.push(d.id);
			} else pendentes.push(d.id);
		}
		return { registrados: registrados, pendentes: pendentes };
	}

	function porLinguagem(tipo) {
		for (let i = 0; i < CATALOGO.length; i++) {
			if (CATALOGO[i].linguagens.includes(tipo)) return CATALOGO[i];
		}
		return null;
	}

	function listar() {
		return CATALOGO.slice();
	}

	return {
		listar: listar,
		porLinguagem: porLinguagem,
		registrarTudo: registrarTudo,
		CATALOGO: CATALOGO,
	};
});
