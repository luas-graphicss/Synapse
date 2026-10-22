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

	function aoReceberDoHost(reg, m) {
		if (!m || typeof m !== 'object') return;
		if (m.type === 'hello') {
			reg.sw = !!m.sw;
			if (!reg.sonda && !reg.sw) {
				reg._rejeitar(new Error('Service Worker indisponivel na origem do preview'));
				return;
			}
			reg._resolver(reg);
			return;
		}
		if (m.type === 'navegacao-adiada') reg.navegacaoAdiada = true;
		if (m.type === 'carregado') {
			reg.ultimaCargaEm = Date.now();
			reg.navegacaoAdiada = false;
			if (reg.aguardandoCarga) {
				const w = reg.aguardandoCarga;
				reg.aguardandoCarga = null;
				clearTimeout(w.timer);
				w.res(true);
			}
			const proj = projetoPorId(reg.pid);
			if (proj && reg.pid === ativoId() && !proj.__previewLegado) {
				try {

					if (typeof root.hidePreviewLoading === 'function') root.hidePreviewLoading();
					const el = root.el;
					if (el && el.device && !reg.sonda) {
						el.device.classList.remove('hidden');
						if (el.previewEmpty) el.previewEmpty.classList.add('hidden');
					}
				} catch (e) {
					ignorar(e, 'carregado');
				}
			}
		}
		if (m.id != null && pendentes.has(m.id)) {
			const p = pendentes.get(m.id);
			if (m.type === 'erro') {
				pendentes.delete(m.id);
				clearTimeout(p.timer);
				p.rej(new Error(m.erro || 'erro no preview'));
				return;
			}
			if (p.resposta === m.type || (p.resposta === 'carregado' && m.type === 'navegacao-adiada')) {
				pendentes.delete(m.id);
				clearTimeout(p.timer);
				p.res(m);
			}
		}
	}

	function pedir(reg, mensagem, opcoes) {
		const o = opcoes || {};
		return new Promise((res, rej) => {
			if (!reg.porta) return rej(new Error('preview sem canal'));
			const id = seq++;
			const resposta = o.resposta || RESPOSTAS[mensagem.type] || mensagem.type;
			const timer = setTimeout(() => {
				pendentes.delete(id);
				rej(new Error('o preview nao respondeu a "' + mensagem.type + '"'));
			}, o.limiteMs || 20000);
			pendentes.set(id, { res, rej, timer, reg, resposta });
			try {
				reg.porta.postMessage(Object.assign({ id }, mensagem), o.transfer || []);
			} catch (e) {
				clearTimeout(timer);
				pendentes.delete(id);
				rej(e);
			}
		});
	}
	const RESPOSTAS = {
		publicar: 'publicado',
		remover: 'removido',
		limpar: 'limpo',
		navegar: 'carregado',
		recarregar: 'carregado',
		congelar: 'congelado',
		descongelar: 'descongelado',
		ping: 'pong',
	};

	async function garantirRegistro(proj) {
		if (!disponivel) throw new Error('preview isolado indisponivel');
		let reg = frames.get(proj.id);
		if (reg && reg.estado === 'hibernado') {
			const urlAtual = reg.urlAtual;
			reg = criarRegistro(proj);
			reg.urlAtual = urlAtual;
			reg.estado = 'congelado';
			reg.renascido = true;
		} else if (!reg) {
			reg = criarRegistro(proj);
			reg.estado = proj.id === ativoId() ? 'vivo' : 'congelado';
		}
		await reg.pronto;
		if (reg.estado === 'congelado' && !reg.congeladoNoHost) {
			reg.congeladoNoHost = true;
			pedir(reg, { type: 'congelar' }).catch((e) => ignorar(e, 'congelarInicial'));
		}
		if (reg.renascido && reg.urlAtual) {
			reg.renascido = false;
			pedir(reg, { type: 'navegar', url: reg.urlAtual, allow: allowDoPreview() }, { limiteMs: 30000 }).catch((e) =>
				ignorar(e, 'renascer'),
			);
		}
		publicarResumo();
		return reg;
	}
	function allowDoPreview() {
		try {
			return root.SynapsePreviewPermissions.allowValue();
		} catch (e) {
			return '';
		}
	}

	function mostrar(reg) {
		const legado = frameLegado();
		if (legado) legado.style.display = 'none';
		for (const r of frames.values()) {
			if (r.sonda) continue;
			if (r === reg) {
				r.iframe.style.cssText = '';
				r.iframe.style.display = '';
			} else if (!r.emCaptura) r.iframe.style.display = 'none';
		}
	}
	function ocultarTodos() {
		for (const r of frames.values()) if (!r.sonda && !r.emCaptura) r.iframe.style.display = 'none';
		const legado = frameLegado();
		if (legado) legado.style.display = '';
	}
	function congelar(reg) {
		if (!reg || reg.estado === 'congelado' || reg.estado === 'hibernado') return;
		reg.estado = 'congelado';
		reg.congeladoNoHost = true;
		reg.ultimoUso = Date.now();
		if (!reg.emCaptura) reg.iframe.style.display = 'none';
		if (reg.porta) pedir(reg, { type: 'congelar' }).catch((e) => ignorar(e, 'congelar'));
		publicarResumo();
	}
	function descongelar(reg) {
		if (!reg || reg.estado === 'vivo') return;
		reg.estado = 'vivo';
		reg.congeladoNoHost = false;
		reg.ultimoUso = Date.now();
		if (reg.porta) pedir(reg, { type: 'descongelar' }).catch((e) => ignorar(e, 'descongelar'));
		publicarResumo();
	}
	function hibernar(reg) {
		if (!reg || reg.sonda || reg.estado === 'hibernado' || reg.emCaptura) return;
		const urlAtual = reg.urlAtual;
		destruirRegistro(reg);
		frames.set(reg.pid, { pid: reg.pid, estado: 'hibernado', urlAtual, ultimoUso: Date.now(), iframe: null, porta: null });
		publicarResumo();
	}
	function congelarOutros(pidVivo) {
		let vivos = 0;
		for (const [pid, r] of frames) {
			if (r.sonda || r.estado === 'hibernado') continue;
			if (pid === pidVivo) continue;
			if (r.estado === 'vivo' || r.estado === 'carregando') {
				if (r.estado === 'carregando') {
					r.estado = 'vivo';
				}
				congelar(r);
			}
		}
		for (const r of frames.values()) if (r.estado === 'vivo') vivos++;
		return vivos;
	}

	function ativar(pid) {
		const S = estado();
		const reg = frames.get(pid);
		congelarOutros(pid);
		const proj = projetoPorId(pid);
		if (!reg || !proj || proj.__previewLegado) return false;
		if (reg.estado === 'hibernado') {

			if (!reg.urlAtual) return false;
			if (typeof root.showPreviewLoading === 'function') {
				try {
					root.showPreviewLoading();
				} catch (e) {
					ignorar(e, 'ativar');
				}
			}
			garantirRegistro(proj)
				.then((r) => {
					if (ativoId() !== pid) return;
					mostrar(r);
					if (!estado() || estado().layout !== 'editor') descongelar(r);
				})
				.catch((e) => ignorar(e, 'ativar:renascer'));
			return true;
		}
		reg.ultimoUso = Date.now();
		mostrar(reg);
		if (!S || S.layout !== 'editor') descongelar(reg);
		return !!reg.urlAtual;
	}

	function temPreview(pid) {
		const reg = frames.get(pid);
		return !!(reg && reg.urlAtual);
	}

	function registrarRecurso(proj, conteudo, mime, dica) {
		const d = dica || {};
		const url = d.caminho ? urlVirtual(proj, d.caminho) : urlDerivada(proj, d.nome || 'recurso', extensaoDe(mime));
		const fila = proj.__publicacaoPendente || (proj.__publicacaoPendente = []);
		let corpo = conteudo;
		let transferivel = false;
		if (conteudo instanceof ArrayBuffer) {
			corpo = d.transferivel ? conteudo : conteudo.slice(0);
			transferivel = true;
		} else if (ArrayBuffer.isView(conteudo)) {
			const inteiro = conteudo.byteOffset === 0 && conteudo.byteLength === conteudo.buffer.byteLength;
			corpo = d.transferivel && inteiro ? conteudo.buffer : conteudo.slice().buffer;
			transferivel = true;
		} else if (typeof conteudo !== 'string') {
			corpo = String(conteudo == null ? '' : conteudo);
		}
		fila.push({ caminho: caminhoDaUrl(url), tipo: mime || 'application/octet-stream', corpo, transferivel });
		return url;
	}

	function lotes(entradas) {
		const saida = [];
		let atual = [];
		let bytes = 0;
		for (const e of entradas) {
			const tam = e.corpo instanceof ArrayBuffer ? e.corpo.byteLength : String(e.corpo).length * 2;
			if (atual.length && (atual.length >= LOTE_MAX_ENTRADAS || bytes + tam > LOTE_MAX_BYTES)) {
				saida.push(atual);
				atual = [];
				bytes = 0;
			}
			atual.push(e);
			bytes += tam;
		}
		if (atual.length) saida.push(atual);
		return saida;
	}

	async function publicar(proj, dados) {
		const reg = await garantirRegistro(proj);
		proj.__previewLegado = false;
		const entradas = Array.isArray(dados.entradas) ? dados.entradas : [];
		for (const lote of lotes(entradas)) {
			const transfer = [];
			const limpo = lote.map((e) => {
				if (e.corpo instanceof ArrayBuffer) transfer.push(e.corpo);
				return { caminho: e.caminho, tipo: e.tipo, corpo: e.corpo };
			});
			await pedir(reg, { type: 'publicar', entradas: limpo }, { transfer, limiteMs: LIMITE_PUBLICACAO_MS });
		}
		if (dados.url) {
			reg.urlAtual = dados.url;
			const vivo = proj.id === ativoId() && (!estado() || estado().layout !== 'editor');
			if (vivo) {
				reg.ultimoUso = Date.now();
				congelarOutros(proj.id);
				mostrar(reg);
				descongelar(reg);
			}
			esperarCarga(reg, 30000);
			await pedir(reg, { type: 'navegar', url: dados.url, allow: allowDoPreview() }, { limiteMs: 30000 });
		}
		publicarResumo();
		return reg;
	}

	async function publicarHtml(proj, html, token, opcoes) {
		const o = opcoes || {};
		const fila = proj.__publicacaoPendente || [];
		proj.__publicacaoPendente = [];
		const entrada = o.entrada || entradaDoProjeto(proj);
		const caminho = caminhoBase(proj.id) + codificarCaminho(entrada);
		fila.push({ caminho, tipo: 'text/html; charset=utf-8', corpo: html });
		return publicar(proj, { entradas: fila, url: origem + caminho + '?v=' + (token || Date.now()), token });
	}
	function entradaDoProjeto(proj) {
		try {
			const e = proj.detect && proj.detect.entry;
			if (e && /\.html?$/i.test(e)) return e;
		} catch (err) {
			ignorar(err, 'entradaDoProjeto');
		}
		return 'index.html';
	}

	function esperarCarga(reg, limiteMs) {
		if (reg.aguardandoCarga) return reg.aguardandoCarga.promise;
		const w = {};
		w.promise = new Promise((res) => {
			w.res = res;
			w.timer = setTimeout(() => {
				if (reg.aguardandoCarga === w) reg.aguardandoCarga = null;
				res(false);
			}, limiteMs || 15000);
		});
		reg.aguardandoCarga = w;
		return w.promise;
	}

	function descartar(proj, url) {
		const reg = frames.get(proj.id);
		const caminho = caminhoDaUrl(url);
		if (!reg || !caminho || reg.estado === 'hibernado' || !reg.porta) return;
		reg.removidosPendentes.add(caminho);
		if (reg.timerRemocao) return;
		reg.timerRemocao = setTimeout(() => {
			reg.timerRemocao = 0;
			const caminhos = [...reg.removidosPendentes];
			reg.removidosPendentes.clear();
			if (caminhos.length) pedir(reg, { type: 'remover', caminhos }).catch((e) => ignorar(e, 'descartar'));
		}, 1500);
	}

	async function limpar(proj) {
		const reg = frames.get(proj.id);
		proj.__publicacaoPendente = [];
		if (!reg) return;
		if (reg.estado !== 'hibernado' && reg.porta) {
			try {
				await pedir(reg, { type: 'limpar' }, { limiteMs: 8000 });
			} catch (e) {
				ignorar(e, 'limpar');
			}
		}
		destruirRegistro(reg);
		frames.delete(proj.id);
		publicarResumo();
	}

	function cederParaLegado(proj) {
		if (!proj) return;
		proj.__previewLegado = true;
		const reg = frames.get(proj.id);
		if (reg && reg.estado !== 'hibernado') congelar(reg);
		ocultarTodos();
	}

	async function prepararParaCaptura(proj, dimensoes) {
		const reg0 = frames.get(proj.id);
		const espera = reg0 ? PICO.intervaloDeCapturaMs - (Date.now() - (reg0.capturaEm || 0)) : 0;
		if (espera > 0) await new Promise((r) => setTimeout(r, espera));
		if (proj.previewDirty || !temPreview(proj.id)) {
			if (typeof root.buildPreview === 'function') {
				proj.__previewSolicitado = true;
				try {
					await root.buildPreview(proj);
				} finally {
					proj.__previewSolicitado = false;
				}
			}
		}
		const reg = await garantirRegistro(proj);
		if (!reg.urlAtual) throw new Error('O projeto "' + proj.name + '" ainda nao tem preview montado. Use refresh_preview e tente de novo.');
		clearTimeout(reg.timerDescongelado);
		reg.capturaEm = Date.now();
		reg.ultimoUso = Date.now();
		const ehAtivo = proj.id === ativoId();
		if (!ehAtivo) {
			reg.emCaptura = true;
			const w = (dimensoes && dimensoes.w) || (proj.viewport && proj.viewport.w) || 1280;
			const h = (dimensoes && dimensoes.h) || (proj.viewport && proj.viewport.h) || 720;

			reg.iframe.style.cssText =
				'position:absolute;left:0;top:0;width:' + w + 'px;height:' + h + 'px;opacity:0.001;pointer-events:none;z-index:-1;border:0;display:block;';
			reg.dimensoesCaptura = { w, h };
		}

		const precisaCarga = !reg.ultimaCargaEm || reg.navegacaoAdiada || !!reg.aguardandoCarga;
		const carga = precisaCarga ? esperarCarga(reg, 12000) : null;
		descongelar(reg);
		if (carga) await carga;
		await new Promise((r) => setTimeout(r, 2 * 17));
		return { janela: reg.iframe.contentWindow, w: reg.dimensoesCaptura ? reg.dimensoesCaptura.w : null, h: reg.dimensoesCaptura ? reg.dimensoesCaptura.h : null };
	}
	function liberarCaptura(proj) {
		const reg = frames.get(proj.id);
		if (!reg || reg.estado === 'hibernado') return;
		if (proj.id === ativoId()) return;
		clearTimeout(reg.timerDescongelado);
		reg.timerDescongelado = setTimeout(() => {
			reg.emCaptura = false;
			reg.dimensoesCaptura = null;
			congelar(reg);
			reg.iframe.style.cssText = '';
			reg.iframe.style.display = 'none';
		}, 600);
	}

	function admitirBuild(proj) {
		const ehAtivo = proj && proj.id === ativoId();
		if (builds.ativos < PICO.buildsConcorrentes && (ehAtivo || !builds.fila.length)) {
			builds.ativos++;
			return Promise.resolve();
		}
		return new Promise((res) => {
			const item = { proj, res };
			if (ehAtivo) builds.fila.unshift(item);
			else builds.fila.push(item);
		});
	}
	function concluirBuild() {
		builds.ativos = Math.max(0, builds.ativos - 1);
		while (builds.ativos < PICO.buildsConcorrentes && builds.fila.length) {
			const item = builds.fila.shift();
			builds.ativos++;
			item.res();
		}
	}
	function buildEmSegundoPlanoNecessario(proj) {
		if (!proj) return false;
		if (proj.id === ativoId()) return true;
		if (proj.__previewSolicitado) return true;
		if (proj.popout && !proj.popout.closed) return true;
		return false;
	}

	function registroDaFonte(fonte) {
		if (!fonte) return null;
		for (const r of frames.values()) {
			if (r.iframe && r.iframe.contentWindow === fonte) return r;
		}
		return null;
	}
	function projetoDaFonte(fonte) {
		const r = registroDaFonte(fonte);
		return r && !r.sonda ? projetoPorId(r.pid) : null;
	}
	function janelaDe(proj) {
		if (!proj) return null;
		const reg = frames.get(proj.id);
		return reg && reg.iframe ? reg.iframe.contentWindow : null;
	}
	function elementoDe(proj) {
		if (!proj) return null;
		const reg = frames.get(proj.id);
		return reg && reg.iframe ? reg.iframe : null;
	}
	function ativoPara(proj) {
		return disponivel === true && !!proj && !proj.__previewLegado;
	}

	function manutencao() {
		const agora = Date.now();
		for (const r of [...frames.values()]) {
			if (r.sonda || r.estado !== 'congelado' || r.emCaptura) continue;
			if (agora - r.ultimoUso > PICO.hibernarAposMs) hibernar(r);
		}
	}
	function aoMudarVisibilidade() {
		if (document.hidden) {
			clearTimeout(timerAbaOculta);
			timerAbaOculta = setTimeout(() => {
				if (!document.hidden) return;
				for (const r of frames.values()) if (!r.sonda && r.estado === 'vivo') congelar(r);
			}, PICO.congelarAbaOcultaMs);
			return;
		}
		clearTimeout(timerAbaOculta);
		const pid = ativoId();
		const reg = pid != null ? frames.get(pid) : null;
		const S = estado();
		if (reg && reg.estado === 'congelado' && S && S.layout !== 'editor') {
			const proj = projetoPorId(pid);
			if (proj && !proj.__previewLegado) {
				mostrar(reg);
				descongelar(reg);
			}
		}
	}
	function aoMudarLayout(layout) {
		const pid = ativoId();
		const reg = pid != null ? frames.get(pid) : null;
		if (!reg || reg.estado === 'hibernado') return;
		if (layout === 'editor') congelar(reg);
		else {
			const proj = projetoPorId(pid);
			if (proj && !proj.__previewLegado && reg.urlAtual) {
				mostrar(reg);
				descongelar(reg);
			}
		}
	}

	function resumo() {
		let vivos = 0,
			congelados = 0,
			hibernados = 0;
		for (const r of frames.values()) {
			if (r.sonda) continue;
			if (r.estado === 'vivo' || r.estado === 'carregando') vivos++;
			else if (r.estado === 'congelado') congelados++;
			else if (r.estado === 'hibernado') hibernados++;
		}
		return {
			modo: disponivel ? 'isolado' : 'legado',
			rotulo: disponivel
				? mesmaOrigem
					? 'preview via Service Worker (mesma origem, sem processo separado)'
					: 'preview em processo separado'
				: 'preview na thread da IDE (modo reduzido)',
			mesmaOrigem,
			origem: origem || '',
			motivo: disponivel ? '' : motivo,
			vivos,
			congelados,
			hibernados,
			buildsAtivos: builds.ativos,
			buildsNaFila: builds.fila.length,
			pico: Object.assign({}, PICO),
		};
	}
	function publicarResumo() {
		try {
			if (root.SynapseDesempenho) root.SynapseDesempenho.registrarPreviews(resumo());
		} catch (e) {
			ignorar(e, 'publicarResumo');
		}
	}

	function definirOrigem(valor) {
		try {
			if (!valor) localStorage.removeItem(CHAVE_ORIGEM);
			else if (valor === 'off' || valor === 'mesma-origem') localStorage.setItem(CHAVE_ORIGEM, valor);
			else localStorage.setItem(CHAVE_ORIGEM, new URL(valor).origin);
			sessionStorage.removeItem(CHAVE_SONDA);
		} catch (e) {
			ignorar(e, 'definirOrigem');
		}
	}

	root.addEventListener('message', (e) => {
		const d = e.data;
		if (!d || d.type !== 'synapse-preview-host' || d.estado !== 'pronto') return;
		if (!origem || e.origin !== origem) return;
		const reg = registroDaFonte(e.source);
		if (!reg || reg.porta) return;
		adotarHost(reg, e);
	});
	document.addEventListener('visibilitychange', aoMudarVisibilidade);

	function iniciar() {
		sondar().catch((e) => {
			ignorar(e, 'sondar');
			concluirSonda(false, 'falha ao sondar a origem do preview');
		});
		if (root.SynapseAgendador) root.SynapseAgendador.manutencao(manutencao, 30000, { nome: 'preview-isolado' });
		else setInterval(manutencao, 30000);
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
	else iniciar();

	root.SynapsePreviewIsolado = Object.freeze({
		pronto,
		disponivel: () => disponivel === true,
		origem: () => origem,
		motivo: () => motivo,
		ativoPara,
		temPreview,
		estadoDe: (pid) => (frames.get(pid) ? frames.get(pid).estado : null),
		urlVirtual,
		ehVirtual,
		registrarRecurso,
		publicarHtml,
		publicar,
		descartar,
		limpar,
		ativar,
		congelarOutros,
		ocultarTodos,
		cederParaLegado,
		prepararParaCaptura,
		liberarCaptura,
		admitirBuild,
		concluirBuild,
		buildEmSegundoPlanoNecessario,
		projetoDaFonte,
		janelaDe,
		elementoDe,
		aoMudarLayout,
		resumo,
		manutencao,
		definirOrigem,
		PICO,
	});
})(globalThis);
