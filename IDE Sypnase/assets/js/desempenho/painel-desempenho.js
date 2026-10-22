(function (root) {
	'use strict';
	if (root.SynapseDesempenho) return;

	const CHAVE_BASE = 'aurora.desempenho.linha-de-base';
	const JANELA_MS = 60000;
	const M = {
		longTasks: [],
		longTasksDigitando: 0,
		tarefas16Digitando: 0,
		inpMs: 0,
		interacoes: [],
		fps: 0,
		fpsMinimo: 60,
		heapBytes: 0,
		heapFonte: '',
		trocas: [],
		mcpChamadas: [],
		previews: null,
	};
	let painel = null;
	let aberto = false;
	let ultimoFrame = 0;
	let quadros = 0;
	let acumuladoMs = 0;
	let timerDeRender = 0;

	function agora() {
		return performance.now();
	}
	function podar(lista, janela) {
		const limite = agora() - (janela || JANELA_MS);
		while (lista.length && lista[0].t < limite) lista.shift();
	}
	function digitando() {
		return !!(root.SynapseAgendador && root.SynapseAgendador.digitando(500));
	}

	function ligarObservadores() {
		if (typeof PerformanceObserver !== 'function') return;
		const suportados = PerformanceObserver.supportedEntryTypes || [];
		if (suportados.includes('longtask')) {
			try {
				new PerformanceObserver((lista) => {
					for (const e of lista.getEntries()) {
						M.longTasks.push({ t: agora(), dur: e.duration });
						if (digitando()) M.longTasksDigitando++;
					}
					podar(M.longTasks);
				}).observe({ type: 'longtask', buffered: true });
			} catch (e) {
				ignorar(e, 'longtask');
			}
		}
		if (suportados.includes('event')) {
			try {
				new PerformanceObserver((lista) => {
					for (const e of lista.getEntries()) {
						if (e.duration > 16 && digitando()) M.tarefas16Digitando++;
						M.interacoes.push({ t: agora(), dur: e.duration });
					}
					podar(M.interacoes);

					const ordenadas = M.interacoes.map((i) => i.dur).sort((a, b) => a - b);
					M.inpMs = ordenadas.length ? ordenadas[Math.floor(ordenadas.length * 0.98)] : 0;
				}).observe({ type: 'event', durationThreshold: 16, buffered: true });
			} catch (e) {
				ignorar(e, 'event');
			}
		}
	}

	function medirFps(ts) {
		if (ultimoFrame) {
			const dt = ts - ultimoFrame;
			quadros++;
			acumuladoMs += dt;
			if (acumuladoMs >= 1000) {
				M.fps = Math.round((quadros * 1000) / acumuladoMs);
				if (!document.hidden && M.fps < M.fpsMinimo) M.fpsMinimo = M.fps;
				quadros = 0;
				acumuladoMs = 0;
			}
		}
		ultimoFrame = ts;
		root.requestAnimationFrame(medirFps);
	}

	async function medirHeap() {
		try {
			if (root.crossOriginIsolated && typeof performance.measureUserAgentSpecificMemory === 'function') {
				const r = await performance.measureUserAgentSpecificMemory();

				let total = 0;
				for (const b of r.breakdown || []) {
					const soDaJanela = (b.attribution || []).every(
						(a) => !a.container || a.container.id === '' || a.scope !== 'cross-origin-aggregated',
					);
					if (soDaJanela) total += b.bytes || 0;
				}
				M.heapBytes = total || r.bytes || 0;
				M.heapFonte = 'measureUserAgentSpecificMemory';
				return;
			}
		} catch (e) {
			ignorar(e, 'medirHeap');
		}
		try {
			if (performance.memory && performance.memory.usedJSHeapSize) {
				M.heapBytes = performance.memory.usedJSHeapSize;
				M.heapFonte = 'performance.memory';
			}
		} catch (e) {
			ignorar(e, 'medirHeap');
		}
	}

	function marcarTroca(ms) {
		M.trocas.push({ t: agora(), dur: ms });
		if (M.trocas.length > 30) M.trocas.shift();
		agendarRender();
	}
	function marcarChamadaMcp() {
		M.mcpChamadas.push({ t: agora() });
		podar(M.mcpChamadas);
	}
	function registrarPreviews(resumo) {
		M.previews = resumo;
		agendarRender();
	}

	function resumo() {
		podar(M.longTasks);
		podar(M.mcpChamadas);
		const trocas = M.trocas.map((x) => x.dur);
		return {
			quando: Date.now(),
			longTasksPorMin: M.longTasks.length,
			longTasksDigitando: M.longTasksDigitando,
			tarefas16Digitando: M.tarefas16Digitando,
			inpMs: Math.round(M.inpMs),
			fps: M.fps,
			fpsMinimo: M.fpsMinimo,
			heapMB: Math.round(M.heapBytes / 1048576),
			heapFonte: M.heapFonte,
			ultimaTrocaMs: trocas.length ? Math.round(trocas[trocas.length - 1]) : null,
			trocaMediaMs: trocas.length ? Math.round(trocas.reduce((a, b) => a + b, 0) / trocas.length) : null,
			mcpPorMin: M.mcpChamadas.length,
			previews: M.previews,
			agendador: root.SynapseAgendador ? root.SynapseAgendador.diagnostico().metricas : null,
		};
	}
	function gravarLinhaDeBase() {
		try {
			localStorage.setItem(CHAVE_BASE, JSON.stringify(resumo()));
		} catch (e) {
			ignorar(e, 'gravarLinhaDeBase');
		}
		agendarRender();
	}
	function linhaDeBase() {
		try {
			const s = localStorage.getItem(CHAVE_BASE);
			return s ? JSON.parse(s) : null;
		} catch (e) {
			return null;
		}
	}
	function zerar() {
		M.longTasks.length = 0;
		M.longTasksDigitando = 0;
		M.tarefas16Digitando = 0;
		M.interacoes.length = 0;
		M.inpMs = 0;
		M.fpsMinimo = 60;
		M.trocas.length = 0;
		M.mcpChamadas.length = 0;
		agendarRender();
	}

	function esc(s) {
		return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
	}
	function alvo(valor, ok, pior) {
		if (valor == null) return 'neutro';
		return ok(valor) ? 'ok' : pior && pior(valor) ? 'err' : 'warn';
	}
	function linha(rotulo, valor, classe, base, meta) {
		const b = base == null ? '' : `<span class="pd-base" title="linha de base">${esc(base)}</span>`;
		return `<div class="pd-linha ${classe}"><span class="pd-rotulo">${esc(rotulo)}</span><span class="pd-valor">${esc(valor)}</span>${b}<span class="pd-meta">${esc(meta || '')}</span></div>`;
	}
	function render() {
		if (!painel || !aberto) return;
		const r = resumo();
		const b = linhaDeBase() || {};
		const p = r.previews || {};
		const modo = p.modo || 'legado';
		const html = [
			`<div class="pd-cab"><strong>Desempenho</strong><span class="pd-modo ${modo === 'isolado' ? 'ok' : 'warn'}">${esc(p.rotulo || (modo === 'isolado' ? 'preview isolado' : 'preview na thread da IDE'))}</span><button class="pd-x" data-pd="fechar" title="Fechar">×</button></div>`,
			linha('Long Tasks / min', r.longTasksPorMin, alvo(r.longTasksPorMin, (v) => v === 0, (v) => v > 10), b.longTasksPorMin, 'meta: 0 digitando'),
			linha('Long Tasks digitando', r.longTasksDigitando, alvo(r.longTasksDigitando, (v) => v === 0), b.longTasksDigitando, '> 50 ms'),
			linha('Tarefas > 16 ms digitando', r.tarefas16Digitando, alvo(r.tarefas16Digitando, (v) => v === 0, (v) => v > 20), b.tarefas16Digitando, ''),
			linha('INP (p98)', r.inpMs + ' ms', alvo(r.inpMs, (v) => v <= 100, (v) => v > 300), b.inpMs != null ? b.inpMs + ' ms' : null, 'meta: <= 100 ms'),
			linha('FPS (atual / mínimo)', `${r.fps} / ${r.fpsMinimo}`, alvo(r.fpsMinimo, (v) => v >= 55, (v) => v < 30), b.fps != null ? `${b.fps} / ${b.fpsMinimo}` : null, 'meta: >= 55'),
			linha('Heap da IDE', r.heapMB ? r.heapMB + ' MB' : 'indisponível', alvo(r.heapMB || null, (v) => v < 150, (v) => v > 400), b.heapMB != null ? b.heapMB + ' MB' : null, r.heapFonte ? 'via ' + r.heapFonte : 'Chrome: performance.memory'),
			linha('Troca de projeto', r.ultimaTrocaMs == null ? '—' : `${r.ultimaTrocaMs} ms (média ${r.trocaMediaMs})`, alvo(r.ultimaTrocaMs, (v) => v < 100, (v) => v > 500), b.ultimaTrocaMs != null ? b.ultimaTrocaMs + ' ms' : null, 'meta: < 100 ms'),
			linha('Chamadas MCP / min', r.mcpPorMin, 'neutro', b.mcpPorMin, 'meta: 200 com FPS >= 55'),
			linha('Previews', p.modo ? `${p.vivos || 0} vivo · ${p.congelados || 0} congelados · ${p.hibernados || 0} hibernados` : '—', 'neutro', null, p.origem ? esc(p.origem) : ''),
			p.motivo ? `<div class="pd-aviso">${esc(p.motivo)}</div>` : '',
			`<div class="pd-acoes"><button data-pd="base">Gravar linha de base</button><button data-pd="zerar">Zerar contadores</button><button data-pd="copiar">Copiar JSON</button></div>`,
		].join('');
		painel.innerHTML = html;
	}
	function agendarRender() {
		if (!aberto || timerDeRender) return;
		timerDeRender = root.setTimeout(() => {
			timerDeRender = 0;
			render();
		}, 120);
	}
	function criarPainel() {
		if (painel) return painel;
		painel = document.createElement('aside');
		painel.id = 'painelDesempenho';
		painel.className = 'painel-desempenho hidden';
		painel.setAttribute('aria-label', 'Painel de desempenho');
		painel.addEventListener('click', (e) => {
			const alvoBotao = e.target.closest('[data-pd]');
			if (!alvoBotao) return;
			const acao = alvoBotao.dataset.pd;
			if (acao === 'fechar') alternar(false);
			else if (acao === 'base') gravarLinhaDeBase();
			else if (acao === 'zerar') zerar();
			else if (acao === 'copiar') {
				try {
					navigator.clipboard.writeText(JSON.stringify(resumo(), null, 2));
					if (typeof root.toast === 'function') root.toast('Copiado', 'Resumo de desempenho no clipboard', 'ok');
				} catch (err) {
					ignorar(err, 'copiar');
				}
			}
		});
		document.body.appendChild(painel);
		return painel;
	}
	function alternar(forcar) {
		criarPainel();
		aberto = typeof forcar === 'boolean' ? forcar : !aberto;
		painel.classList.toggle('hidden', !aberto);
		const botao = document.getElementById('stPerf');
		if (botao) botao.setAttribute('aria-pressed', String(aberto));
		if (aberto) {
			medirHeap().then(render);
			render();
		}
	}
	function ligarBotao() {
		const botao = document.getElementById('stPerf');
		if (botao) botao.addEventListener('click', () => alternar());
		root.addEventListener('keydown', (e) => {
			if (e.altKey && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
				e.preventDefault();
				alternar();
			}
		});
	}
	function atualizarBotao() {
		const botao = document.getElementById('stPerf');
		if (!botao) return;
		podar(M.longTasks);
		const lt = M.longTasks.length;
		botao.classList.toggle('alerta', lt > 5 || M.fps < 30);
		const rotulo = botao.querySelector('span');
		if (rotulo) rotulo.textContent = `${M.fps || '–'} fps · ${lt} LT`;
	}

	function ignorar(e, ctx) {
		try {
			if (typeof root.ignorarErro === 'function') root.ignorarErro(e, 'desempenho:' + ctx);
		} catch (_) {

		}
	}

	function iniciar() {
		ligarObservadores();
		root.requestAnimationFrame(medirFps);
		ligarBotao();
		const agendar = root.SynapseAgendador;
		const ciclo = () => {
			medirHeap();
			atualizarBotao();
			if (aberto) render();
		};
		if (agendar) agendar.manutencao(ciclo, 2000, { nome: 'desempenho', somenteVisivel: true });
		else root.setInterval(ciclo, 2000);
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
	else iniciar();

	root.SynapseDesempenho = Object.freeze({
		marcarTroca,
		marcarChamadaMcp,
		registrarPreviews,
		resumo,
		gravarLinhaDeBase,
		linhaDeBase,
		zerar,
		alternar,
	});
})(globalThis);
