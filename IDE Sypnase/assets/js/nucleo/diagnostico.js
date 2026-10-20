'use strict';

const NIVEIS = Object.freeze({ silencio: 0, erro: 1, aviso: 2, info: 3, debug: 4 });
const PREFIXO = '[Synapse]';
const LIMITE_DO_HISTORICO = 100;

const falhasToleradas = [];

function modoDiagnosticoLigado() {
	try {
		const { hostname, search } = window.location;
		if (/[?&]diagnostico=1/.test(search)) return true;
		if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') return true;
		return window.localStorage.getItem('synapse:diagnostico') === '1';
	} catch {
		return false;
	}
}

let nivelAtual = modoDiagnosticoLigado() ? NIVEIS.debug : NIVEIS.aviso;

function escrever(nivel, metodo, argumentos) {
	if (nivel > nivelAtual) return;
	const saida = window.console;
	if (!saida || typeof saida[metodo] !== 'function') return;
	saida[metodo](PREFIXO, ...argumentos);
}

const registro = Object.freeze({
	debug: (...argumentos) => escrever(NIVEIS.debug, 'debug', argumentos),
	info: (...argumentos) => escrever(NIVEIS.info, 'info', argumentos),
	aviso: (...argumentos) => escrever(NIVEIS.aviso, 'warn', argumentos),
	erro: (...argumentos) => escrever(NIVEIS.erro, 'error', argumentos),

	niveis: NIVEIS,
	nivelAtual: () => Object.keys(NIVEIS).find((nome) => NIVEIS[nome] === nivelAtual),
	definirNivel(nome) {
		if (!(nome in NIVEIS)) throw new RangeError(`nível de registro inválido: ${nome}`);
		nivelAtual = NIVEIS[nome];
		return nome;
	},

	falhasToleradas: () => falhasToleradas.slice(),
	limparFalhasToleradas: () => {
		falhasToleradas.length = 0;
	},
});

function ignorarErro(erro, contexto) {
	const mensagem = erro instanceof Error ? erro.message : String(erro);
	falhasToleradas.push({
		contexto: contexto || 'desconhecido',
		mensagem,
		momento: new Date().toISOString(),
	});
	if (falhasToleradas.length > LIMITE_DO_HISTORICO) falhasToleradas.shift();
	registro.debug(`falha tolerada em ${contexto}:`, mensagem);
}

window.registro = registro;
window.ignorarErro = ignorarErro;
