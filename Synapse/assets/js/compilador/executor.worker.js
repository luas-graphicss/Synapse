'use strict';

importScripts('wasi.js');

self.onmessage = function (ev) {
	const m = (ev && ev.data) || {};
	if (m.tipo !== 'rodar') return;

	const t0 = Date.now();

	let codigoSaida = 0;
	let viuSaida = false;

	try {
		const w = self.SYNAPSE_WASI.criar({
			args: m.args && m.args.length ? m.args : ['programa'],
			env: m.env || {},
			stdin: m.stdin || '',
			limiteMs: m.limiteMs || 0,
			aoSair: function (c) {
				viuSaida = true;
				codigoSaida = c == null ? 0 : c | 0;
			},
			stdout: function (t) {
				self.postMessage({ tipo: 'saida', fluxo: 'out', texto: t });
			},
			stderr: function (t) {
				self.postMessage({ tipo: 'saida', fluxo: 'err', texto: t });
			},
		});

		const mod = new WebAssembly.Module(m.wasm);
		const inst = new WebAssembly.Instance(mod, w.imports);
		w.vincular(inst);

		const r = w.rodar(inst);

		let codigo;
		if (viuSaida) codigo = codigoSaida;
		else if (typeof r === 'number') codigo = r | 0;
		else if (r && typeof r.codigo === 'number') codigo = r.codigo | 0;
		else codigo = 0;

		const ms = r && typeof r === 'object' && typeof r.ms === 'number' ? r.ms : Date.now() - t0;

		self.postMessage({ tipo: 'fim', codigo: codigo, ms: ms });
	} catch (e) {
		self.postMessage({
			tipo: 'falha',
			texto: String((e && e.message) || e),
			tempoEsgotado: !!(e && (e.wasiTempo || e.tempoEsgotado)),
			ms: Date.now() - t0,
		});
	}
};
