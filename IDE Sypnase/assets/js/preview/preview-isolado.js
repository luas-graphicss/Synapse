(function (root) {
	'use strict';
	if (root.SynapsePreviewIsolado) return;

	const CHAVE_ORIGEM = 'aurora.preview.origem';
	const CHAVE_SONDA = 'aurora.preview.sonda';
	const CAMINHO_HOST = '/preview-host.html';
	const PREFIXO_P = '/p/';
	const PICO = {
		previewsVivos: 1,
		hibernarAposMs: 5 * 60 * 1000,
		janelaDeEscritasMs: 250,
		intervaloDeCapturaMs: 2000,
		buildsConcorrentes: (navigator.hardwareConcurrency || 4) <= 4 ? 1 : 2,
		esperarDigitacao: true,
		dprDoPreview: 0,
		congelarAbaOcultaMs: 20000,
	};
	const LIMITE_HANDSHAKE_MS = 7000;
	const LIMITE_PUBLICACAO_MS = 120000;
	const LOTE_MAX_ENTRADAS = 250;
	const LOTE_MAX_BYTES = 24 * 1024 * 1024;

	const frames = new Map();
	const pendentes = new Map();
	const builds = { ativos: 0, fila: [] };
	let origem = null;
	let disponivel = null;
	let motivo = '';
	let seq = 1;
	let resolverPronto = null;
	let timerAbaOculta = 0;
	const pronto = new Promise((r) => {
		resolverPronto = r;
	});

	function ignorar(e, ctx) {
		try {
			if (typeof root.ignorarErro === 'function') root.ignorarErro(e, 'previewIsolado:' + ctx);
		} catch (_) {

		}
	}
	function estado() {
		return root.State || null;
	}
	function projetoPorId(pid) {
		const S = estado();
		return S && S.projects ? S.projects.find((p) => p && p.id === pid) || null : null;
	}
	function ativoId() {
		const S = estado();
		return S ? S.active : null;
	}
	function container() {
		return (root.el && root.el.device) || document.getElementById('device');
	}
	function frameLegado() {
		return (root.el && root.el.frame) || document.getElementById('frame');
	}
	function codificarCaminho(caminho) {
		return String(caminho || '')
			.replace(/^\/+/, '')
			.split('/')
			.map((s) => encodeURIComponent(s))
			.join('/');
	}
	function caminhoBase(pid) {
		return PREFIXO_P + encodeURIComponent(pid) + '/';
	}
	function urlVirtual(proj, caminho) {
		return origem + caminhoBase(proj.id) + codificarCaminho(caminho);
	}
	function urlDerivada(proj, nome, extensao) {
		proj.__previewSeq = (proj.__previewSeq || 0) + 1;
		const base = String(nome || 'recurso').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-80);
		return origem + caminhoBase(proj.id) + '__synapse/' + proj.__previewSeq + '-' + base + (extensao || '');
	}
	function caminhoDaUrl(url) {
		try {
			const u = new URL(url);
			return u.origin === origem ? u.pathname : null;
		} catch (e) {
			return null;
		}
	}
	function ehVirtual(url) {
		return typeof url === 'string' && origem && url.indexOf(origem + PREFIXO_P) === 0;
	}
	function extensaoDe(mime) {
		if (!mime) return '';
		if (/javascript|ecmascript/.test(mime)) return '.js';
		if (/css/.test(mime)) return '.css';
		if (/html/.test(mime)) return '.html';
		if (/json/.test(mime)) return '.json';
		if (/svg/.test(mime)) return '.svg';
		if (/wasm/.test(mime)) return '.wasm';
		return '';
	}

	let mesmaOrigem = false;
	function descobrirOrigem() {
		const propria = location.origin;
		let candidata = null;
		try {
			const salvo = localStorage.getItem(CHAVE_ORIGEM);
			if (salvo === 'off') {
				motivo = 'Isolamento desligado nas configuracoes (aurora.preview.origem = off).';
				return null;
			}
			if (salvo === 'mesma-origem') {
				mesmaOrigem = true;
				return propria;
			}
			if (salvo) candidata = new URL(salvo).origin;
		} catch (e) {
			ignorar(e, 'descobrirOrigem');
		}
		if (!candidata && typeof root.SYNAPSE_PREVIEW_ORIGIN === 'string' && root.SYNAPSE_PREVIEW_ORIGIN) {
			candidata = root.SYNAPSE_PREVIEW_ORIGIN.replace(/\/+$/, '');
		}
		if (!candidata) {
			const meta = document.querySelector('meta[name="synapse-preview-origin"]');
			if (meta && meta.content) candidata = meta.content.replace(/\/+$/, '');
		}
		if (!candidata) {
			const { protocol, hostname, port } = location;
			if (protocol === 'file:') {
				motivo = 'Em file:// nao existe segunda origem: o preview roda no modo reduzido (mesma thread da IDE). Sirva a IDE por http://localhost para isolar.';
				return null;
			}
			const p = port ? ':' + port : '';
			if (hostname === 'localhost') candidata = protocol + '//127.0.0.1' + p;
			else if (hostname === '127.0.0.1') candidata = protocol + '//localhost' + p;
			else if (/\.vercel\.app$/i.test(hostname)) {
				motivo =
					'Adicione um dominio preview.<seu-dominio> ao projeto na Vercel (ou defina aurora.preview.origem; "mesma-origem" usa o Service Worker sem processo separado) para isolar o preview.';
				return null;
			} else if (/^preview\./i.test(hostname)) {
				motivo = 'A IDE esta aberta pela origem do preview; abra-a pelo dominio principal.';
				return null;
			} else candidata = protocol + '//preview.' + hostname + p;
		}
		if (candidata === propria) {
			motivo = 'A origem do preview precisa ser diferente da origem da IDE (ou use aurora.preview.origem = mesma-origem de proposito).';
			return null;
		}
		return candidata;
	}

	function lerSonda() {
		try {
			const s = JSON.parse(sessionStorage.getItem(CHAVE_SONDA) || 'null');
			if (s && s.origem === origem && Date.now() - s.t < 6 * 3600 * 1000) return s;
		} catch (e) {
			ignorar(e, 'lerSonda');
		}
		return null;
	}
	function gravarSonda(ok, texto) {
		try {
			sessionStorage.setItem(CHAVE_SONDA, JSON.stringify({ origem, ok, texto, t: Date.now() }));
		} catch (e) {
			ignorar(e, 'gravarSonda');
		}
	}

	async function sondar() {
		origem = descobrirOrigem();
		if (!origem) return concluirSonda(false, motivo);
		const anterior = lerSonda();
		if (anterior) return concluirSonda(anterior.ok, anterior.texto);
		let reg = null;
		try {
			reg = criarRegistro({ id: '__sonda__' }, { sonda: true });
			const r = await Promise.race([
				reg.pronto,
				new Promise((_, rej) => setTimeout(() => rej(new Error('tempo esgotado')), LIMITE_HANDSHAKE_MS)),
			]);
			if (!r.sw) throw new Error('o Service Worker da origem do preview nao assumiu o controle');
			gravarSonda(true, '');
			concluirSonda(true, '');
		} catch (e) {
			const texto =
				'Origem do preview ' +
				origem +
				' indisponivel (' +
				((e && e.message) || e) +
				'). O preview segue no modo reduzido, na thread da IDE.';
			gravarSonda(false, texto);
			concluirSonda(false, texto);
		} finally {
			if (reg) destruirRegistro(reg);
		}
	}
	function concluirSonda(ok, texto) {
		disponivel = !!ok;
		motivo = ok ? '' : texto || motivo;
		resolverPronto(disponivel);
		publicarResumo();
		try {
			if (typeof root.registro !== 'undefined' && root.registro && root.registro.debug) {
				root.registro.debug(
					ok
						? '[preview-isolado] ' + (mesmaOrigem ? 'previews via Service Worker na propria origem ' : 'previews em processo separado via ') + origem
						: '[preview-isolado] modo reduzido: ' + motivo,
				);
			}
		} catch (e) {
			ignorar(e, 'concluirSonda');
		}
	}

	function criarRegistro(proj, opcoes) {
		const o = opcoes || {};
		const pid = proj.id;
		const iframe = document.createElement('iframe');
		iframe.className = 'preview-isolado';
		iframe.dataset.pid = String(pid);
		iframe.setAttribute('title', 'preview');
		iframe.setAttribute('referrerpolicy', 'no-referrer');
		iframe.setAttribute('loading', 'eager');
		try {
			iframe.setAttribute('allow', root.SynapsePreviewPermissions.allowValue());
		} catch (e) {
			ignorar(e, 'allow');
		}

		iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-pointer-lock allow-modals');
		if (root.crossOriginIsolated) iframe.setAttribute('credentialless', '');
		iframe.style.display = 'none';
		iframe.src = origem + CAMINHO_HOST + '?pid=' + encodeURIComponent(pid);
		const reg = {
			pid,
			iframe,
			porta: null,
			estado: 'carregando',
			ultimoUso: Date.now(),
			urlAtual: null,
			sw: false,
			sonda: !!o.sonda,
			capturaEm: 0,
			timerDescongelado: 0,
			aguardandoCarga: null,
			removidosPendentes: new Set(),
			timerRemocao: 0,
		};
		reg.pronto = new Promise((res, rej) => {
			reg._resolver = res;
			reg._rejeitar = rej;
		});
		reg.pronto.catch(() => {});
		reg.timerHandshake = setTimeout(() => {
			if (!reg.porta) reg._rejeitar(new Error('a pagina anfitria do preview nao respondeu'));
		}, LIMITE_HANDSHAKE_MS);
		(o.sonda ? document.body : container() || document.body).appendChild(iframe);
		frames.set(pid, reg);
		return reg;
	}
	function destruirRegistro(reg) {
		if (!reg) return;
		clearTimeout(reg.timerHandshake);
		clearTimeout(reg.timerDescongelado);
		clearTimeout(reg.timerRemocao);
		try {
			if (reg.porta) reg.porta.close();
		} catch (e) {
			ignorar(e, 'destruirRegistro');
		}
		try {
			reg.iframe.remove();
		} catch (e) {
			ignorar(e, 'destruirRegistro');
		}
		for (const [id, p] of pendentes) {
			if (p.reg === reg) {
				clearTimeout(p.timer);
				pendentes.delete(id);
				p.rej(new Error('preview descartado'));
			}
		}
		if (frames.get(reg.pid) === reg) frames.delete(reg.pid);
	}

	function adotarHost(reg, e) {
		clearTimeout(reg.timerHandshake);
		const canal = new MessageChannel();
		reg.porta = canal.port1;
		reg.porta.onmessage = (ev) => aoReceberDoHost(reg, ev.data);
		reg.sw = !!(e.data && e.data.sw);
		try {
			reg.iframe.contentWindow.postMessage({ type: 'synapse-kernel-port' }, origem, [canal.port2]);
		} catch (err) {
			reg._rejeitar(err);
		}
	}
})(globalThis);
