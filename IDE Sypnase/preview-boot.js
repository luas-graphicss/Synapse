(function () {
	'use strict';

	const params = new URLSearchParams(location.search);
	const pid = params.get('pid') || '';
	const PREFIXO_CACHE = 'proj:';
	const CHAVE_CFG = 'synapse.preview.cfg.';
	let porta = null;
	let origemDaIde = null;
	let interno = null;
	let pendente = null;
	let congelado = false;
	let swAtivo = false;
	let navegacaoAdiada = null;
	let seqDeNavegacao = 0;

	function enviar(m, transfer) {
		if (!porta) return;
		try {
			porta.postMessage(m, transfer || []);
		} catch (e) {
			try {
				porta.postMessage(m);
			} catch (_) {

			}
		}
	}

	function mostrarAviso(titulo, texto) {
		document.body.innerHTML =
			'<div class="aviso"><h1></h1><p></p></div>';
		document.querySelector('.aviso h1').textContent = titulo;
		document.querySelector('.aviso p').textContent = texto;
	}

	async function prepararServiceWorker() {
		if (!('serviceWorker' in navigator)) return false;
		try {
			await navigator.serviceWorker.register('/preview-sw.js', { scope: '/' });
			await navigator.serviceWorker.ready;
			if (!navigator.serviceWorker.controller) {
				await new Promise((resolver) => {
					const t = setTimeout(resolver, 4000);
					navigator.serviceWorker.addEventListener(
						'controllerchange',
						() => {
							clearTimeout(t);
							resolver();
						},
						{ once: true },
					);
				});
			}
			return !!navigator.serviceWorker.controller;
		} catch (e) {
			return false;
		}
	}

	function cfgLer() {
		try {
			return JSON.parse(sessionStorage.getItem(CHAVE_CFG + pid) || '{}') || {};
		} catch (e) {
			return {};
		}
	}
	function cfgGravar(parcial) {
		try {
			sessionStorage.setItem(CHAVE_CFG + pid, JSON.stringify(Object.assign(cfgLer(), parcial)));
		} catch (e) {

		}
	}

	function runtimeDe(frame) {
		try {
			return frame && frame.contentWindow && frame.contentWindow.__synapseRuntime;
		} catch (e) {
			return null;
		}
	}
	function aplicarCongelamento(frame, valor) {
		const rt = runtimeDe(frame);
		if (rt && typeof rt.setFrozen === 'function') {
			try {
				rt.setFrozen(valor);
				return;
			} catch (e) {

			}
		}
		try {
			frame.contentWindow.postMessage({ __synapse_runtime: valor ? 'freeze' : 'thaw' }, location.origin);
		} catch (e) {

		}
	}
	function congelar(valor) {
		congelado = !!valor;
		cfgGravar({ congelado });
		if (interno) aplicarCongelamento(interno, congelado);
		if (pendente) aplicarCongelamento(pendente, congelado);
		if (!congelado && navegacaoAdiada) {
			const n = navegacaoAdiada;
			navegacaoAdiada = null;
			navegar(n.url, n.opcoes);
		}
	}

	async function publicar(m) {
		const cache = await caches.open(PREFIXO_CACHE + pid);
		const entradas = Array.isArray(m.entradas) ? m.entradas : [];
		let gravadas = 0;
		for (const ent of entradas) {
			if (!ent || !ent.caminho) continue;
			const cabecalhos = new Headers({
				'Content-Type': ent.tipo || 'application/octet-stream',
				'Cross-Origin-Resource-Policy': 'cross-origin',
				'Cache-Control': 'no-store',
			});
			try {
				await cache.put(new Request(new URL(ent.caminho, location.origin).href), new Response(ent.corpo, { headers: cabecalhos }));
				gravadas++;
			} catch (e) {
				enviar({ type: 'erro', id: m.id, caminho: ent.caminho, erro: String((e && e.message) || e) });
			}
		}
		enviar({ type: 'publicado', id: m.id, gravadas });
	}
	async function remover(m) {
		const cache = await caches.open(PREFIXO_CACHE + pid);
		for (const caminho of m.caminhos || []) {
			try {
				await cache.delete(new URL(caminho, location.origin).href, { ignoreSearch: true });
			} catch (e) {

			}
		}
		enviar({ type: 'removido', id: m.id });
	}
	async function limpar(m) {
		try {
			await caches.delete(PREFIXO_CACHE + pid);
		} catch (e) {

		}
		enviar({ type: 'limpo', id: m && m.id });
	}

	function navegar(url, opcoes) {
		const o = opcoes || {};
		if (congelado && !o.mesmoCongelado) {
			navegacaoAdiada = { url, opcoes: o };
			enviar({ type: 'navegacao-adiada', id: o.id, url });
			return;
		}
		navegacaoAdiada = null;
		const seq = ++seqDeNavegacao;
		if (pendente) {
			pendente.remove();
			pendente = null;
		}
		const novo = document.createElement('iframe');
		novo.setAttribute('title', 'preview');
		novo.setAttribute('referrerpolicy', 'no-referrer');
		novo.setAttribute('allow', o.allow || '');
		novo.dataset.pendente = '1';
		let concluido = false;
		const concluir = (motivo) => {
			if (concluido || seq !== seqDeNavegacao) return;
			concluido = true;
			clearTimeout(limite);
			const anterior = interno;
			if (anterior && o.manterRolagem !== false) {
				try {
					novo.contentWindow.scrollTo(anterior.contentWindow.scrollX, anterior.contentWindow.scrollY);
				} catch (e) {

				}
			}
			delete novo.dataset.pendente;
			interno = novo;
			pendente = null;
			if (anterior) anterior.remove();
			if (congelado) aplicarCongelamento(interno, true);
			enviar({ type: 'carregado', id: o.id, url, motivo });
		};
		novo.addEventListener('load', () => {

			requestAnimationFrame(() => requestAnimationFrame(() => concluir('load')));
		});
		novo.addEventListener('error', () => concluir('erro'));
		const limite = setTimeout(() => concluir('tempo'), o.limiteMs || 15000);
		pendente = novo;
		document.body.appendChild(novo);
		novo.src = url;
	}

	function recarregar(m) {
		if (!interno) return;
		try {
			navegar(interno.contentWindow.location.href, { id: m && m.id, manterRolagem: true });
		} catch (e) {
			enviar({ type: 'erro', id: m && m.id, erro: 'nao foi possivel recarregar' });
		}
	}

	async function aoReceberDaIde(e) {
		const m = e.data;
		if (!m || typeof m !== 'object') return;
		try {
			switch (m.type) {
				case 'publicar':
					await publicar(m);
					break;
				case 'remover':
					await remover(m);
					break;
				case 'limpar':
					await limpar(m);
					break;
				case 'navegar':
					navegar(m.url, m);
					break;
				case 'recarregar':
					recarregar(m);
					break;
				case 'congelar':
					congelar(true);
					enviar({ type: 'congelado', id: m.id });
					break;
				case 'descongelar':
					congelar(false);
					enviar({ type: 'descongelado', id: m.id });
					break;
				case 'dpr':
					cfgGravar({ dpr: m.valor || 0 });
					{
						const rt = runtimeDe(interno);
						if (rt && typeof rt.setDpr === 'function') rt.setDpr(m.valor || 0);
					}
					break;
				case 'para-o-projeto':
					if (interno) interno.contentWindow.postMessage(m.dados, '*');
					break;
				case 'ping':
					enviar({ type: 'pong', id: m.id, congelado, carregado: !!interno });
					break;
				default:
					break;
			}
		} catch (erro) {
			enviar({ type: 'erro', id: m.id, erro: String((erro && erro.message) || erro) });
		}
	}

	function adotarPorta(e) {
		const p = e.ports && e.ports[0];
		if (!p) return;
		if (porta) {
			try {
				porta.close();
			} catch (_) {

			}
		}
		porta = p;
		origemDaIde = e.origin;
		porta.onmessage = aoReceberDaIde;
		porta.start && porta.start();
		enviar({ type: 'hello', pid, sw: swAtivo, congelado, carregado: !!interno });
	}

	window.addEventListener('message', (e) => {
		const d = e.data;
		if (e.source === window.parent) {
			if (d && d.type === 'synapse-kernel-port') {
				adotarPorta(e);
				return;
			}
			if (origemDaIde && e.origin !== origemDaIde) return;

			if (interno) {
				try {
					interno.contentWindow.postMessage(d, '*');
				} catch (_) {

				}
			}
			return;
		}
		const daInterna = (interno && e.source === interno.contentWindow) || (pendente && e.source === pendente.contentWindow);
		if (!daInterna) return;

		try {
			window.parent.postMessage(d, origemDaIde || '*');
		} catch (_) {

		}
	});

	async function iniciar() {
		if (!pid) {
			if (/^\/p\//.test(location.pathname)) {
				mostrarAviso(
					'Preview expirado',
					'Este endereco so existe enquanto a IDE estiver aberta. Volte para a aba da IDE e recarregue o preview.',
				);
			} else {
				mostrarAviso(
					'Origem do preview da Synapse IDE',
					'Esta origem so serve os previews isolados da IDE. Abra a IDE no endereco principal.',
				);
			}
			return;
		}
		if (window.parent === window) {
			mostrarAviso('Preview isolado', 'Esta pagina precisa ser aberta pela IDE.');
			return;
		}
		swAtivo = await prepararServiceWorker();
		congelado = !!cfgLer().congelado;
		try {
			window.parent.postMessage({ type: 'synapse-preview-host', estado: 'pronto', pid, sw: swAtivo }, '*');
		} catch (_) {

		}
	}

	iniciar();
})();
