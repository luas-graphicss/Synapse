'use strict';

const EXEMPLOS = {
	sdl: 'jogo.c :: #include <SDL2/SDL.h>\nint main(){ SDL_Init(SDL_INIT_VIDEO); return 0; }',
	win: 'app.c :: #include <windows.h>\nint WINAPI WinMain(){ return 0; }',
	cs: 'App.csproj :: <Project Sdk="Microsoft.NET.Sdk"></Project>\nProgram.cs :: class P { static void Main(){ System.Console.WriteLine("oi"); } }',
	rust: 'Cargo.toml :: [package]\nname = "app"\nsrc/main.rs :: fn main(){ println!("oi"); }',
};

function exemplo(k) {
	document.getElementById('entrada').value = EXEMPLOS[k].split('\n').join('\n');
	detectar();
}

function lerArquivos() {
	const txt = document.getElementById('entrada').value;
	const linhas = txt.split('\n');
	let arquivos = [],
		atual = null;
	for (let i = 0; i < linhas.length; i++) {
		const m = /^([^\s:][^:]*?)\s*::\s*(.*)$/.exec(linhas[i]);
		if (m) {
			atual = { caminho: m[1].trim(), conteudo: m[2] };
			arquivos.push(atual);
		} else if (atual) {
			atual.conteudo += '\n' + linhas[i];
		}
	}
	return arquivos;
}

const TEXTO_NIVEL = {
	0: 'Não roda no navegador',
	1: 'Nível 1 — navegador puro',
	2: 'Nível 2 — precisa do Relay',
	3: 'Nível 3 — execução remota',
};

function detectar() {
	const d = window.SYNAPSE_DETECCAO.detectar(lerArquivos());
	let h = `<div class="linha"><span class="pill n${d.nivel === 3 ? 2 : d.nivel}">${TEXTO_NIVEL[d.nivel]}</span>\
</div><div class="linha"><span class="rot">Linguagem</span><b>${d.tipo}</b>${d.gui ? ' (interface gráfica)' : ' (console)'}</div>\
<div class="linha"><span class="rot">Entrada</span><code>${d.entrada || '—'}</code></div><div class="linha">\
<span class="rot">Toolchain</span><code>${d.toolchain || '—'}</code></div><div class="linha"><span class="rot">\
Motivo</span>${d.motivo}</div>`;
	if (d.libs && d.libs.length) {
		h += `<div class="linha"><span class="rot">Bibliotecas</span>${d.libs.join(', ')}</div>`;
	}
	for (let i = 0; i < d.avisos.length; i++) h += `<div class="aviso">⚠ ${d.avisos[i]}</div>`;
	document.getElementById('veredito').innerHTML = h;
}

function esperarPronto(f) {
	return new Promise(function (ok) {
		function h(e) {
			if (e.data && e.data.tipo === 'pronto') {
				window.removeEventListener('message', h);
				ok();
			}
		}
		window.addEventListener('message', h, false);
	});
}

function montarShell(titulo, modo) {
	const f = document.getElementById('frame');
	const p = esperarPronto(f);
	f.srcdoc = window.SYNAPSE_SHELL.montar({
		titulo: titulo,
		modo: modo || 'console',
		rotulos: { esperando: 'Aguardando execução...', fim: 'Programa encerrado', codigo: 'código' },
	});
	return p.then(function () {
		return f;
	});
}

async function rodar(arquivo) {
	const f = await montarShell(arquivo, 'console');
	f.contentWindow.postMessage({ tipo: 'estado', texto: 'Executando...' }, '*');

	const resp = await fetch('exemplos/' + arquivo);
	const bytes = new Uint8Array(await resp.arrayBuffer());

	const wasi = window.SYNAPSE_WASI.criar({
		args: [arquivo],
		stdout: function (s) {
			f.contentWindow.postMessage({ tipo: 'saida', fluxo: 'stdout', texto: s }, '*');
		},
		stderr: function (s) {
			f.contentWindow.postMessage({ tipo: 'saida', fluxo: 'stderr', texto: s }, '*');
		},
	});

	const t0 = performance.now();
	try {
		const mod = await WebAssembly.instantiate(bytes, wasi.imports);
		const inst = mod.instance || mod;
		wasi.vincular(inst);
		const codigo = wasi.rodar(inst);
		f.contentWindow.postMessage(
			{ tipo: 'fim', codigo: codigo, ms: Math.round(performance.now() - t0) },
			'*',
		);
	} catch (e) {
		f.contentWindow.postMessage({ tipo: 'erro', texto: String((e && e.message) || e) }, '*');
	}
}

function limpar() {
	const f = document.getElementById('frame');
	if (f.contentWindow) f.contentWindow.postMessage({ tipo: 'limpar' }, '*');
}

detectar();
montarShell('preview', 'console');

const ACOES_DA_DEMO = {
	btnDetectar: () => detectar(),
	btnExemploSdl: () => exemplo('sdl'),
	btnExemploWin: () => exemplo('win'),
	btnExemploCs: () => exemplo('cs'),
	btnExemploRust: () => exemplo('rust'),
	btnRodarOlaWasm: () => rodar('ola.wasm'),
	btnRodarSaida7Wasm: () => rodar('saida7.wasm'),
	btnLimpar: () => limpar(),
};

document.addEventListener('DOMContentLoaded', () => {
	for (const [id, acao] of Object.entries(ACOES_DA_DEMO)) {
		const botao = document.getElementById(id);
		if (botao) {
			botao.addEventListener('click', acao);
		} else {
			avisarBotaoAusente(id);
		}
	}
});

function avisarBotaoAusente(id) {
	if (typeof registro !== 'undefined') {
		registro.aviso('demo: nenhum elemento com id', id);
	}
}
