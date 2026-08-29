'use strict';
(function auroraFundo() {
	'use strict';
	let W = null,
		seq = 1,
		pend = {},
		mortos = 0,
		avisou = false;
	const EST = {
		esperas: 0,
		viaWorker: 0,
		viaTimer: 0,
		derivaMax: 0,
		ocultou: 0,
		congelou: 0,
		resumiu: 0,
		audio: false,
	};

	function criar() {
		if (W || mortos > 2) return W;
		try {
			const src = `var T={};onmessage=function(e){var d=e.data||{};if(d.cancel){if(T[d.cancel]){clearTimeout(T[d.cancel]);\
delete T[d.cancel];}return;}T[d.id]=setTimeout(function(){delete T[d.id];postMessage({id:d.id});},d.ms);\
};`;
			const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
			W = new Worker(url);
			try {
				URL.revokeObjectURL(url);
			} catch (e) {
				ignorarErro(e, 'criar');
			}
			W.onmessage = function (ev) {
				const id = ev && ev.data && ev.data.id,
					f = pend[id];
				if (f) {
					delete pend[id];
					f();
				}
			};
			W.onerror = function () {
				mortos++;
				try {
					W.terminate();
				} catch (e) {
					ignorarErro(e, 'onerror');
				}
				W = null;
			};
		} catch (e) {
			mortos++;
			W = null;
		}
		return W;
	}

	function bgEspera(ms) {
		const t = Math.max(0, Number(ms) || 0);
		EST.esperas++;
		const w = criar();
		if (!w) {
			EST.viaTimer++;
			return new Promise(function (r) {
				setTimeout(r, t);
			});
		}
		EST.viaWorker++;
		return new Promise(function (r) {
			let id = seq++,
				t0 = Date.now(),
				fim = false;
			const solta = function () {
				if (fim) return;
				fim = true;
				const d = Date.now() - t0 - t;
				if (d > EST.derivaMax) EST.derivaMax = d;
				r();
			};
			pend[id] = solta;
			try {
				w.postMessage({ id: id, ms: t });
			} catch (e) {
				delete pend[id];
				EST.viaTimer++;
				setTimeout(solta, t);
				return;
			}
			setTimeout(function () {
				if (pend[id]) {
					delete pend[id];
					solta();
				}
			}, t + 15000);
		});
	}
	window.bgEspera = bgEspera;

	async function testar() {
		const a = Date.now();
		await new Promise(function (r) {
			setTimeout(r, 1000);
		});
		const timer = Date.now() - a - 1000;
		const b = Date.now();
		await bgEspera(1000);
		const worker = Date.now() - b - 1000;
		let vered;
		if (timer > 3000 && worker < 1500)
			vered =
				'o navegador esta estrangulando os timers desta aba, e o caminho novo (Worker) esta imune - terminal OK em segundo plano';
		else if (timer > 3000)
			vered =
				'timers estrangulados e o Worker tambem atrasou - ligue SYNAPSE_FUNDO.audio(true) para o navegador parar de congelar a aba';
		else vered = 'sem estrangulamento neste momento';
		return {
			oculta: document.visibilityState !== 'visible',
			atraso_setTimeout_ms: timer,
			atraso_bgEspera_ms: worker,
			veredito: vered,
		};
	}

	document.addEventListener('visibilitychange', function () {
		if (document.visibilityState === 'visible') return;
		EST.ocultou++;
		if (avisou) return;
		let ativo = false;
		try {
			ativo = !!(typeof MCP !== 'undefined' && MCP.active);
		} catch (e) {
			ignorarErro(e, 'auroraFundo');
		}
		if (!ativo) return;
		avisou = true;
		testar().then(
			function (r) {
				if (r.atraso_setTimeout_ms <= 3000) return;
				try {
					mcpLog(
						'ok',
						`Aba em segundo plano: o navegador atrasou os timers em ${Math.round(r.atraso_setTimeout_ms / 1000)}s, \
mas o terminal agora conta o tempo fora da aba - segue rodando sem a tela aberta`,
					);
				} catch (e) {
					ignorarErro(e, 'auroraFundo');
				}
			},
			function () {},
		);
	});

	document.addEventListener(
		'freeze',
		function () {
			EST.congelou++;
		},
		true,
	);
	document.addEventListener(
		'resume',
		function () {
			EST.resumiu++;
			try {
				if (typeof MCP !== 'undefined' && MCP.active) {
					mcpLog('ok', 'Aba foi descongelada pelo navegador - reconectando a ponte');
					mcpConnect();
				}
			} catch (e) {
				ignorarErro(e, 'auroraFundo');
			}
			try {
				if (window.SYNAPSE_POOL) window.SYNAPSE_POOL.religar();
			} catch (e) {
				ignorarErro(e, 'auroraFundo');
			}
		},
		true,
	);

	let AC = null,
		OSC = null;
	function audio(on) {
		if (on === false) {
			try {
				if (OSC) OSC.stop();
			} catch (e) {
				ignorarErro(e, 'audio');
			}
			try {
				if (AC) AC.close();
			} catch (e) {
				ignorarErro(e, 'audio');
			}
			AC = null;
			OSC = null;
			EST.audio = false;
			return 'keepalive de audio desligado';
		}
		try {
			const Ctx = window.AudioContext || window.webkitAudioContext;
			if (!Ctx) return 'este navegador nao tem WebAudio';
			if (!AC) AC = new Ctx();
			if (AC.state === 'suspended') AC.resume();
			if (!OSC) {
				OSC = AC.createOscillator();
				const g = AC.createGain();
				g.gain.value = 0.0001;
				OSC.frequency.value = 30;
				OSC.connect(g);
				g.connect(AC.destination);
				OSC.start();
			}
			EST.audio = true;
			return 'keepalive de audio ligado: a aba conta como "tocando som", o navegador para de congelar/descartar ela (vai aparecer o icone de som na aba)';
		} catch (e) {
			return 'nao foi possivel ligar: ' + ((e && e.message) || e);
		}
	}

	window.SYNAPSE_FUNDO = {
		estado: function () {
			return {
				oculta: document.visibilityState !== 'visible',
				worker: !!W,
				esperas: EST.esperas,
				viaWorker: EST.viaWorker,
				viaTimer: EST.viaTimer,
				derivaMaxMs: EST.derivaMax,
				vezesOculta: EST.ocultou,
				congelou: EST.congelou,
				resumiu: EST.resumiu,
				audioKeepalive: EST.audio,
			};
		},
		testar: testar,
		audio: audio,
	};
})();
