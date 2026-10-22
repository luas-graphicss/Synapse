(function (root) {
	'use strict';
	if (root.SynapseAgendador) return;

	const scheduler = root.scheduler || null;
	const temPostTask = !!(scheduler && typeof scheduler.postTask === 'function');
	const temYield = !!(scheduler && typeof scheduler.yield === 'function');
	const ORCAMENTO_PADRAO_MS = 6;
	const JANELA_DE_DIGITACAO_MS = 300;
	const TICK_VISIVEL_MS = 1000;
	const TICK_OCULTO_MS = 5000;

	let ultimaEntrada = -Infinity;
	const metricas = {
		ticks: 0,
		tarefasDeManutencao: 0,
		fatiasCedidas: 0,
		tarefasPostTask: 0,
	};

	function agora() {
		return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
	}

	let ultimaTecla = -Infinity;
	const TIPOS_DE_TECLADO = new Set(['keydown', 'beforeinput', 'input']);

	function registrarEntrada(evento) {
		ultimaEntrada = agora();
		if (!evento || TIPOS_DE_TECLADO.has(evento.type)) ultimaTecla = ultimaEntrada;
	}

	function interagindo(janelaMs) {
		const janela = janelaMs > 0 ? janelaMs : JANELA_DE_DIGITACAO_MS;
		return agora() - ultimaEntrada < janela;
	}

	function digitando(janelaMs) {
		const janela = janelaMs > 0 ? janelaMs : JANELA_DE_DIGITACAO_MS;
		return agora() - ultimaTecla < janela;
	}

	function aguardarFimDaDigitacao(janelaMs, limiteMs) {
		const janela = janelaMs > 0 ? janelaMs : JANELA_DE_DIGITACAO_MS;
		const limite = limiteMs > 0 ? limiteMs : 4000;
		const inicio = agora();
		return new Promise((resolver) => {
			(function tentar() {
				const silencio = agora() - ultimaEntrada;
				if (silencio >= janela || agora() - inicio >= limite) return resolver();
				root.setTimeout(tentar, Math.max(16, janela - silencio));
			})();
		});
	}

	function cederViaMessageChannel() {
		return new Promise((resolver) => {
			const canal = new MessageChannel();
			canal.port1.onmessage = () => {
				canal.port1.close();
				resolver();
			};
			canal.port2.postMessage(0);
		});
	}

	function cederParaEntrada() {
		metricas.fatiasCedidas++;
		if (temYield) {
			try {
				return scheduler.yield();
			} catch (e) {
				ignorarErroLocal(e, 'cederParaEntrada');
			}
		}
		return cederViaMessageChannel();
	}

	function cederParaPintura() {
		if (typeof document !== 'undefined' && document.hidden) return cederViaMessageChannel();
		return new Promise((resolver) => {
			root.requestAnimationFrame(() => root.setTimeout(resolver, 0));
		});
	}

	function postTask(funcao, opcoes) {
		const o = opcoes || {};
		metricas.tarefasPostTask++;
		if (temPostTask) {
			try {
				return scheduler.postTask(funcao, {
					priority: o.priority || 'user-visible',
					delay: o.delay || 0,
					signal: o.signal,
				});
			} catch (e) {
				ignorarErroLocal(e, 'postTask');
			}
		}
		return new Promise((resolver, rejeitar) => {
			const atraso = (o.delay || 0) + (o.priority === 'background' ? 4 : 0);
			const id = root.setTimeout(() => {
				if (o.signal && o.signal.aborted) return rejeitar(new DOMException('Cancelado', 'AbortError'));
				try {
					resolver(funcao());
				} catch (e) {
					rejeitar(e);
				}
			}, atraso);
			if (o.signal) o.signal.addEventListener('abort', () => root.clearTimeout(id), { once: true });
		});
	}

	function proximoQuadro(callback) {
		let agendado = 0;
		function rodar() {
			agendado = 0;
			callback();
		}
		return function agendar() {
			if (agendado) return;
			if (typeof document !== 'undefined' && document.hidden) {
				agendado = root.setTimeout(rodar, 0);
				return;
			}
			agendado = root.requestAnimationFrame(rodar);
		};
	}

	async function emFatias(passos, orcamentoMs) {
		const orcamento = orcamentoMs > 0 ? orcamentoMs : ORCAMENTO_PADRAO_MS;
		let inicio = agora();
		for (const passo of passos) {
			passo();
			if (agora() - inicio > orcamento) {
				await cederParaEntrada();
				inicio = agora();
			}
		}
	}

	async function paraCada(itens, tratar, opcoes) {
		const o = opcoes || {};
		const orcamento = o.sliceMs > 0 ? o.sliceMs : o.orcamentoMs > 0 ? o.orcamentoMs : ORCAMENTO_PADRAO_MS;
		const tamanhoDoBloco = o.chunkSize > 0 ? o.chunkSize : 0;
		const progresso = o.onProgress || null;
		const total = itens.length;
		let processados = 0;
		let inicio = agora();
		for (const item of itens) {
			tratar(item, processados);
			processados++;
			if (processados >= total) continue;
			const vencido = tamanhoDoBloco
				? processados % tamanhoDoBloco === 0
				: agora() - inicio >= orcamento;
			if (vencido) {
				if (progresso) progresso(processados, total);
				await (o.pintar ? cederParaPintura() : cederParaEntrada());
				inicio = agora();
			}
		}
		if (progresso) progresso(processados, total);
	}

	function ocioso(funcao, limiteMs) {
		if (typeof root.requestIdleCallback === 'function') {
			return root.requestIdleCallback(funcao, { timeout: limiteMs > 0 ? limiteMs : 2000 });
		}
		return root.setTimeout(() => funcao({ didTimeout: true, timeRemaining: () => 8 }), 50);
	}

	const tarefas = new Map();
	let proximoId = 1;
	let tickAgendado = false;

	function manutencao(funcao, periodoMs, opcoes) {
		const o = opcoes || {};
		const periodo = Math.max(1000, periodoMs || 1000);
		const id = proximoId++;
		tarefas.set(id, {
			id,
			nome: o.nome || (funcao && funcao.name) || 'tarefa-' + id,
			funcao,
			periodo,
			proximo: Date.now() + (o.imediato ? 0 : periodo),
			somenteVisivel: !!o.somenteVisivel,
			execucoes: 0,
			ultimoCustoMs: 0,
		});
		agendarTick();
		return id;
	}

	function cancelar(id) {
		return tarefas.delete(id);
	}

	function agendarTick() {
		if (tickAgendado || !tarefas.size) return;
		tickAgendado = true;
		const oculto = typeof document !== 'undefined' && document.hidden;
		const atraso = oculto ? TICK_OCULTO_MS : TICK_VISIVEL_MS;
		postTask(tick, { priority: 'background', delay: atraso }).catch((e) =>
			ignorarErroLocal(e, 'agendarTick'),
		);
	}

	async function tick() {
		tickAgendado = false;
		metricas.ticks++;
		const t = Date.now();
		const oculto = typeof document !== 'undefined' && document.hidden;
		let inicioDaFatia = agora();
		for (const tarefa of [...tarefas.values()]) {
			if (tarefa.proximo > t) continue;
			if (tarefa.somenteVisivel && oculto) continue;
			if (interagindo()) break;
			tarefa.proximo = t + tarefa.periodo;
			const inicio = agora();
			try {
				const r = tarefa.funcao();
				if (r && typeof r.then === 'function') r.catch((e) => ignorarErroLocal(e, tarefa.nome));
			} catch (e) {
				ignorarErroLocal(e, tarefa.nome);
			}
			tarefa.ultimoCustoMs = agora() - inicio;
			tarefa.execucoes++;
			metricas.tarefasDeManutencao++;
			if (agora() - inicioDaFatia > ORCAMENTO_PADRAO_MS) {
				await cederParaEntrada();
				inicioDaFatia = agora();
			}
		}
		agendarTick();
	}

	function ignorarErroLocal(e, contexto) {
		try {
			if (typeof root.ignorarErro === 'function') root.ignorarErro(e, 'agendador:' + contexto);
		} catch (_) {

		}
	}

	function diagnostico() {
		return {
			postTaskNativo: temPostTask,
			yieldNativo: temYield,
			digitando: digitando(),
			interagindo: interagindo(),
			tarefas: [...tarefas.values()].map((t) => ({
				nome: t.nome,
				periodoMs: t.periodo,
				execucoes: t.execucoes,
				ultimoCustoMs: Math.round(t.ultimoCustoMs * 10) / 10,
			})),
			metricas: { ...metricas },
		};
	}

	if (typeof root.addEventListener === 'function') {
		const opcoes = { capture: true, passive: true };
		for (const tipo of ['keydown', 'beforeinput', 'input', 'pointerdown', 'wheel', 'touchstart']) {
			root.addEventListener(tipo, registrarEntrada, opcoes);
		}
		if (typeof document !== 'undefined') {
			document.addEventListener('visibilitychange', () => {
				if (!document.hidden) agendarTick();
			});
		}
	}

	root.SynapseAgendador = Object.freeze({
		cederParaEntrada,
		cederParaPintura,
		postTask,
		proximoQuadro,
		emFatias,
		paraCada,
		ocioso,
		manutencao,
		cancelar,
		registrarEntrada,
		digitando,
		interagindo,
		aguardarFimDaDigitacao,
		diagnostico,
		JANELA_DE_DIGITACAO_MS,
	});

	root.SynapseFrameScheduler = Object.freeze({ create: proximoQuadro });
	root.SynapseChunkedWork = Object.freeze({
		forEachInChunks: (itens, tratar, opcoes) =>
			paraCada(itens, tratar, { ...(opcoes || {}), pintar: true }),
	});
})(globalThis);
