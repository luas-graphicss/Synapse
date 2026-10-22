(function () {
	'use strict';
	if (window.__synapseRuntime) return;

	let pid = '';
	try {
		const src = document.currentScript && document.currentScript.src;
		if (src) pid = new URL(src).searchParams.get('pid') || '';
	} catch (e) {
		pid = '';
	}
	const CHAVE_CFG = 'synapse.preview.cfg.' + pid;
	let cfg = {};
	try {
		cfg = JSON.parse(sessionStorage.getItem(CHAVE_CFG) || '{}') || {};
	} catch (e) {
		cfg = {};
	}

	let congelado = false;
	const rafRepresados = [];
	const timeoutsRepresados = [];
	const intervalosPerdidos = new Set();
	const audios = new Set();
	let proximoRafFalso = -1;

	const rafNativo = window.requestAnimationFrame.bind(window);
	const cancelRafNativo = window.cancelAnimationFrame.bind(window);
	const setTimeoutNativo = window.setTimeout.bind(window);
	const setIntervalNativo = window.setInterval.bind(window);
	const descritorHidden = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');
	const descritorVisibilidade = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');
	const hiddenNativo = descritorHidden && descritorHidden.get ? descritorHidden.get : null;
	const visibilidadeNativa = descritorVisibilidade && descritorVisibilidade.get ? descritorVisibilidade.get : null;

	window.requestAnimationFrame = function (cb) {
		if (!congelado) return rafNativo(cb);
		const id = proximoRafFalso--;
		rafRepresados.push({ id, cb });
		return id;
	};
	window.cancelAnimationFrame = function (id) {
		if (id < 0) {
			const i = rafRepresados.findIndex((r) => r.id === id);
			if (i >= 0) rafRepresados.splice(i, 1);
			return;
		}
		return cancelRafNativo(id);
	};

	window.setTimeout = function (fn, ms) {
		const args = Array.prototype.slice.call(arguments, 2);
		if (typeof fn !== 'function') return setTimeoutNativo.apply(window, arguments);
		return setTimeoutNativo(function () {
			if (congelado) {
				timeoutsRepresados.push(() => fn.apply(window, args));
				return;
			}
			fn.apply(window, args);
		}, ms);
	};
	window.setInterval = function (fn, ms) {
		const args = Array.prototype.slice.call(arguments, 2);
		if (typeof fn !== 'function') return setIntervalNativo.apply(window, arguments);
		const envelope = function () {
			if (congelado) {
				intervalosPerdidos.add(envelope);
				return;
			}
			fn.apply(window, args);
		};
		envelope.__fn = fn;
		envelope.__args = args;
		return setIntervalNativo(envelope, ms);
	};

	try {
		Object.defineProperty(document, 'hidden', {
			configurable: true,
			get: function () {
				return congelado || (hiddenNativo ? hiddenNativo.call(document) : false);
			},
		});
		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			get: function () {
				if (congelado) return 'hidden';
				return visibilidadeNativa ? visibilidadeNativa.call(document) : 'visible';
			},
		});
	} catch (e) {

	}

	if (typeof window.AudioContext === 'function' || typeof window.webkitAudioContext === 'function') {
		const Original = window.AudioContext || window.webkitAudioContext;
		const Envolvido = function AudioContext() {
			const ctx = new Original(...arguments);
			audios.add(ctx);
			if (congelado) {
				try {
					ctx.suspend();
				} catch (e) {

				}
			}
			return ctx;
		};
		Envolvido.prototype = Original.prototype;
		try {
			window.AudioContext = Envolvido;
			if (window.webkitAudioContext) window.webkitAudioContext = Envolvido;
		} catch (e) {

		}
	}

	function disparar(alvo, tipo) {
		try {
			alvo.dispatchEvent(new Event(tipo));
		} catch (e) {

		}
	}

	function setFrozen(valor) {
		valor = !!valor;
		if (valor === congelado) return;
		congelado = valor;
		if (congelado) {
			for (const ctx of audios) {
				try {
					if (ctx.state === 'running') {
						ctx.__synapseRetomar = true;
						ctx.suspend();
					}
				} catch (e) {

				}
			}
			disparar(document, 'visibilitychange');
			return;
		}
		const fila = rafRepresados.splice(0, rafRepresados.length);
		for (const r of fila) rafNativo(r.cb);
		const timeouts = timeoutsRepresados.splice(0, timeoutsRepresados.length);
		for (const t of timeouts) {
			try {
				t();
			} catch (e) {
				setTimeoutNativo(() => {
					throw e;
				}, 0);
			}
		}
		for (const envelope of intervalosPerdidos) {
			try {
				envelope.__fn.apply(window, envelope.__args);
			} catch (e) {
				setTimeoutNativo(() => {
					throw e;
				}, 0);
			}
		}
		intervalosPerdidos.clear();
		for (const ctx of audios) {
			try {
				if (ctx.__synapseRetomar) {
					ctx.__synapseRetomar = false;
					ctx.resume();
				}
			} catch (e) {

			}
		}
		disparar(document, 'visibilitychange');
		disparar(window, 'resize');
	}

	const descritorDprNativo = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio') || null;
	function setDpr(valor) {
		try {
			if (valor > 0) {
				Object.defineProperty(window, 'devicePixelRatio', { configurable: true, get: () => valor });
			} else if (descritorDprNativo) {
				Object.defineProperty(window, 'devicePixelRatio', descritorDprNativo);
			} else {
				delete window.devicePixelRatio;
			}
			disparar(window, 'resize');
		} catch (e) {

		}
	}

	window.addEventListener('message', (e) => {
		if (e.origin !== location.origin || !e.data || !e.data.__synapse_runtime) return;
		if (e.data.__synapse_runtime === 'freeze') setFrozen(true);
		else if (e.data.__synapse_runtime === 'thaw') setFrozen(false);
		else if (e.data.__synapse_runtime === 'dpr') setDpr(e.data.valor || 0);
	});

	if (cfg.dpr > 0) setDpr(cfg.dpr);
	if (cfg.congelado) setFrozen(true);

	window.__synapseRuntime = Object.freeze({
		pid,
		setFrozen,
		setDpr,
		estado: () => ({ congelado, rafRepresados: rafRepresados.length, timeoutsRepresados: timeoutsRepresados.length }),
	});
})();
