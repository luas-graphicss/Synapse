'use strict';
function tmLockReleaseCtx(ctx) {
	if (!ctx || ctx.id == null) return 0;
	const K = tmLocks();
	const graca = Math.max(0, Number(TM.cfg.lockReadGraceSeconds) || 0);
	let soltas = 0,
		sobrando = 0;
	let seguradas = 0;
	Object.keys(K).forEach(function (k) {
		const l = K[k];
		if (!l || l.mode !== 'auto') return;
		if (!tmLockDonos(l).includes(ctx.id)) return;
		if (tmLockDelDono(l, ctx.id) > 0) {
			seguradas++;
			return;
		}
		if (tmLockKind(l) === 'read' && graca > 0) {
			l.grace = true;
			l.until = tmNow() + graca * 1000;
			sobrando++;
			return;
		}
		delete K[k];
		soltas++;
	});
	if (soltas || sobrando || seguradas) {
		tmAudit('unlock-auto', {
			tool: ctx.tool,
			agente: ctx.agent || '(sem nome)',
			soltas: soltas,
			leituraEmSobra: sobrando,
			seguradaPorOutraChamada: seguradas,
			graca: graca + 's',
		});
		tmLockUiPing();
		if (sobrando)
			setTimeout(
				function () {
					try {
						tmLocksGC();
					} catch (e) {
						ignorarErro(e, 'tmLockReleaseCtx');
					}
				},
				graca * 1000 + 250,
			);
	}
	return soltas + sobrando;
}
function tmLockReleaseAgent(nome, motivo) {
	const n = tmAgKey(nome);
	if (!n) return 0;
	const K = tmLocks();
	let q = 0;
	Object.keys(K).forEach(function (k) {
		const l = K[k];
		if (l && tmAgKey(l.agent) === n) {
			delete K[k];
			q++;
		}
	});
	if (q) tmAudit('unlock', { agente: tmAgNome(nome), quantas: q, motivo: motivo || '' });
	return q;
}

function tmStalePreflight(ctx) {
	if (!ctx || ctx.probe || ctx.writesAll) return true;
	const n = tmAgKey(ctx.agent);
	if (!n) return true;
	const proj = tmProjKey(ctx.projId);
	let alvo = null;
	try {
		(ctx.allow || []).forEach(function (p) {
			if (alvo || !p) return;
			const w = tmStaleInfo(n, p, proj);
			if (w) alvo = { path: tmNormPath(p), w: w };
		});
	} catch (e) {
		ignorarErro(e, 'tmStalePreflight');
	}
	if (!alvo) return true;
	TM.stats.staleDenied = (TM.stats.staleDenied | 0) + 1;
	ctx.lockBlocked = (ctx.lockBlocked | 0) + 1;
	tmAudit('stale-write', {
		tool: ctx.tool,
		agent: ctx.agent || '(sem nome)',
		arquivo: alvo.path,
		outro: alvo.w.agent,
		momento: 'pre-voo',
	});
	throw new Error(
		`Chamada recusada INTEIRA, nada foi alterado: "${alvo.path}" foi gravado por "${alvo.w.agent}" DEPOIS \
da sua ultima leitura (ha ${tmSegTxt((tmNow() - tmMarkAt(alvo.w)) / 1000)}). Voce esta com uma versao \
velha na mao; gravar agora apagaria o trabalho dele sem ninguem perceber. Leia o arquivo de novo (read_file) \
e refaca a sua alteracao sobre a versao nova - ai a chamada passa.`,
	);
}

function tmLockPreflight(ctx) {
	if (!ctx || ctx.probe || ctx.writesAll) return true;
	tmStalePreflight(ctx);
	tmLocksGC();
	const K = tmLocks();
	const chaves = Object.keys(K);
	if (!chaves.length) return true;
	const proj = tmProjKey(ctx.projId);
	const exatos = {};
	let alvos = 0;
	try {
		(ctx.allow || []).forEach(function (p) {
			const k = tmLockPathKey(p);
			if (k && !exatos[k]) {
				exatos[k] = 1;
				alvos++;
			}
		});
	} catch (e) {
		ignorarErro(e, 'tmLockPreflight');
	}
	const pastas = (ctx.prefixes || []).map(tmLockPathKey).filter(Boolean);
	alvos += pastas.length;
	if (!alvos) return true;
	const meu = tmAgKey(ctx.agent);
	const presos = [];
	const vistos = {};
	chaves.forEach(function (k) {
		const l = K[k];
		if (!l) return;
		if (meu && tmAgKey(l.agent) === meu) return;
		if (!tmProjMatch(l.proj, proj)) return;
		const pk = tmLockPathKey(l.path);
		if (
			exatos[pk] ||
			pastas.some(function (d) {
				return pk === d || pk.indexOf(d + '/') === 0;
			})
		) {
			presos.push(l);
			vistos[pk] = 1;
		}
	});
	if (!presos.length) return true;
	const arquivos = Object.keys(vistos).length;
	const lendo = presos.filter(function (l) {
		return tmLockKind(l) === 'read';
	}).length;
	TM.stats.lockDenied = (TM.stats.lockDenied | 0) + 1;
	ctx.lockBlocked = (ctx.lockBlocked | 0) + 1;
	tmAudit('lock-deny-write', {
		tool: ctx.tool,
		agent: ctx.agent || '(sem nome)',
		arquivos: presos
			.map(function (l) {
				return l.path;
			})
			.slice(0, 12),
		lendo: lendo,
		momento: 'pre-voo',
	});
	throw new Error(
		'Chamada recusada INTEIRA, nada foi alterado: ' +
			arquivos +
			' de ' +
			alvos +
			' arquivo(s) estao na mao de outro agente agora' +
			(lendo ? ` - ${lendo} deles estao sendo LIDOS` : '') +
			'.' +
			String.fromCharCode(10) +
			presos
				.slice(0, 5)
				.map(function (l) {
					return '- ' + tmLockDesc(l);
				})
				.join(String.fromCharCode(10)) +
			String.fromCharCode(10) +
			('Ler esses arquivos continua liberado; gravar so quando ninguem mais estiver com eles. ' +
				'Espere alguns segundos: travas automaticas caem sozinhas assim que a chamada do outro ' +
				'responde. Se for reserva manual, combine por post_message. Nao contorne gravando em ' +
				'outro arquivo.'),
	);
}

function tmLockClaimCtx(ctx) {
	if (!ctx || ctx.probe || ctx.writesAll) return 0;
	const seg = Number(TM.cfg.lockAutoSeconds) || 0;
	if (seg <= 0) return 0;
	const n = tmAgNome(ctx.agent);
	if (!n) return 0;
	const proj = tmProjKey(ctx.projId);
	const alvos = [];
	try {
		(ctx.allow || []).forEach(function (p) {
			if (p) alvos.push(p);
		});
	} catch (e) {
		ignorarErro(e, 'tmLockClaimCtx');
	}
	let q = 0;
	const falhas = [];
	alvos.forEach(function (p) {
		try {
			tmLockAcquire(n, p, {
				kind: 'write',
				mode: 'auto',
				ctxId: ctx.id,
				seconds: seg,
				proj: proj,
				projName: ctx.projName,
				note: 'alterando com ' + ctx.tool,
			});
			q++;
		} catch (e) {
			falhas.push(String(p) + ': ' + String((e && e.message) || e).slice(0, 90));
		}
	});
	if (falhas.length)
		tmAudit('lock-claim-fail', {
			tool: ctx.tool,
			agente: n,
			quantas: falhas.length,
			exemplos: falhas.slice(0, 3),
		});
	if (q) tmLockUiPing();
	return q;
}

function tmMarkKey(path, proj) {
	return tmProjKey(proj) + '|' + tmLockPathKey(path);
}
function tmMarkPut(m, k, v) {
	m[k] = v;
	const ks = Object.keys(m);
	if (ks.length > 800)
		ks.slice(0, ks.length - 600).forEach(function (x) {
			delete m[x];
		});
}
function tmMarkTick() {
	TM.markSeq = (TM.markSeq | 0) + 1;
	return TM.markSeq;
}
function tmMarkNum(x) {
	return x && typeof x === 'object' ? Number(x.n) || 0 : 0;
}
function tmMarkAt(x) {
	if (x == null) return 0;
	return typeof x === 'number' ? x : Number(x.at) || 0;
}
function tmRMark(path, proj, nome) {
	const n = tmAgKey(nome);
	if (!n) return;
	TM.rmark = TM.rmark || {};
	tmMarkPut(TM.rmark, n + '@' + tmMarkKey(path, proj), { at: tmNow(), n: tmMarkTick() });
}
function tmWMark(path, proj, nome) {
	const n = tmAgNome(nome);
	if (!n) return;
	TM.wmark = TM.wmark || {};
	tmMarkPut(TM.wmark, tmMarkKey(path, proj), { agent: n, at: tmNow(), n: tmMarkTick() });
}
function tmStaleInfo(nome, path, proj) {
	const n = tmAgKey(nome);
	if (!n) return null;
	const ch = tmMarkKey(path, proj);
	const w = (TM.wmark || {})[ch];
	if (!w || !(tmMarkAt(w) > 0) || tmAgKey(w.agent) === n) return null;
	const li = (TM.rmark || {})[n + '@' + ch];
	if (!li) return null;
	const nl = tmMarkNum(li),
		nw = tmMarkNum(w);
	if (nl || nw) {
		if (nl >= nw) return null;
	} else if (tmMarkAt(li) >= tmMarkAt(w)) return null;
	return w;
}
function tmStaleGuard(ctx, path, proj) {
	if (!ctx || ctx.writesAll) return true;
	const w = tmStaleInfo(ctx.agent, path, proj);
	if (!w) return true;
	TM.stats.staleDenied = (TM.stats.staleDenied | 0) + 1;
	ctx.lockBlocked = (ctx.lockBlocked | 0) + 1;
	tmAudit('stale-write', {
		tool: ctx.tool,
		agent: ctx.agent || '(sem nome)',
		arquivo: tmNormPath(path),
		outro: w.agent,
		momento: 'gravacao',
	});
	throw new Error(
		`Alteracao recusada: "${tmNormPath(path)}" foi gravado por "${w.agent}" DEPOIS da sua ultima leitura \
(ha ${tmSegTxt((tmNow() - tmMarkAt(w)) / 1000)}). Gravar agora apagaria o trabalho dele sem ninguem \
perceber, porque voce esta em cima de uma versao velha do arquivo. Leia de novo (read_file) e refaca \
a sua alteracao sobre a versao nova - ai a gravacao passa.`,
	);
}

function tmLockGate(ctx, path, op) {
	if (!ctx || ctx.probe) return true;
	const proj = tmProjKey(ctx.projId);
	const l = tmBloqueioEscrita(path, ctx.agent, proj);
	if (l) {
		if (ctx.writesAll) {
			TM.stats.lockDenied = (TM.stats.lockDenied | 0) + 1;
			tmAudit('lock-terminal-cross', {
				tool: ctx.tool,
				agent: ctx.agent || '(sem nome)',
				arquivo: l.path,
				dono: l.agent,
				tipo: tmLockTipo(l),
			});
			return true;
		}
		TM.stats.lockDenied = (TM.stats.lockDenied | 0) + 1;
		ctx.lockBlocked = (ctx.lockBlocked | 0) + 1;
		tmAudit('lock-deny-write', {
			tool: ctx.tool,
			agent: ctx.agent || '(sem nome)',
			arquivos: [l.path],
			tipo: tmLockTipo(l),
			momento: 'gravacao',
		});
		throw new Error(
			`Alteracao recusada: ${tmLockDesc(l)}${tmLockRegra(l)} ${tmLockEspera(l)}, ou combine com o outro agente por post_message.`,
		);
	}
	if (!ctx.writesAll && tmAgNome(ctx.agent)) {
		tmStaleGuard(ctx, path, proj);
		const seg = Number(TM.cfg.lockAutoSeconds) || 0;
		if (seg > 0) {
			try {
				tmLockAcquire(ctx.agent, path, {
					kind: 'write',
					mode: 'auto',
					ctxId: ctx.id,
					seconds: seg,
					proj: proj,
					projName: ctx.projName,
					note: 'gravando com ' + ctx.tool,
				});
			} catch (e) {
				ignorarErro(e, 'tmLockGate');
			}
		}
		tmWMark(path, proj, ctx.agent);
	}
	return true;
}

function tmLockReadMsg(path, nome, proj) {
	if (!Object.keys(tmLocks()).length) return '';
	const l = tmBloqueioLeitura(path, nome, proj);
	if (!l) return '';
	TM.stats.lockReadDenied = (TM.stats.lockReadDenied | 0) + 1;
	tmAudit('lock-deny-read', {
		agent: tmAgNome(nome) || '(sem nome)',
		arquivo: l.path,
		dono: l.agent,
	});
	const semNome = !tmAgNome(nome)
		? ' ATENCAO: voce nao informou agent="seu-nome" nesta chamada. Se a trava for SUA, repita a leitura com o seu nome e ela passa.'
		: '';
	return `LEITURA BLOQUEADA: ${tmLockDesc(l)} O arquivo esta sendo REESCRITO agora - ler esta versao \
seria trabalhar em cima de conteudo velho. (Arquivo que outro agente esta apenas LENDO continua liberado \
para voce ler.) Tente de novo em ${tmLockPrazoTxt(l)} - a trava cai sozinha assim que a chamada dele \
responder; use file_locks para acompanhar.${semNome}`;
}
function tmGateRead(path, nome, proj) {
	const m = tmLockReadMsg(path, nome, proj);
	if (m) throw new Error(m);
	return true;
}
function tmGateReadSoft(path, nome, proj) {
	return tmLockReadMsg(path, nome, proj);
}

let __tmLockUiT = null,
	__tmLockTickT = null;
function tmLockPainelAberto() {
	try {
		const m = document.getElementById('mcpMenu');
		if (!m) return false;
		if (m.classList && m.classList.contains('open')) return true;
		const cs = typeof getComputedStyle === 'function' ? getComputedStyle(m) : null;
		if (cs && (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0))
			return false;
		const r = m.getBoundingClientRect();
		return !!(r && (r.width > 0 || r.height > 0));
	} catch (e) {
		return false;
	}
}
function tmLockTickOff() {
	if (__tmLockTickT) {
		clearInterval(__tmLockTickT);
		__tmLockTickT = null;
	}
}
function tmLockTickOn() {
	if (__tmLockTickT || typeof document === 'undefined' || typeof setInterval !== 'function') return;
	__tmLockTickT = setInterval(function () {
		try {
			if (!Object.keys(tmLocks()).length || !tmLockPainelAberto()) {
				tmLockTickOff();
				try {
					tmLocksGC();
				} catch (e) {
					ignorarErro(e, 'tmLockTickOn');
				}
				return;
			}
			tmLocksGC();
			if (typeof mcpRenderAgents === 'function') mcpRenderAgents();
		} catch (e) {
			tmLockTickOff();
		}
	}, 1000);
}
function tmLockUiPing() {
	try {
		tmLockTickOn();
	} catch (e) {
		ignorarErro(e, 'tmLockUiPing');
	}
	if (__tmLockUiT) return;
	__tmLockUiT = setTimeout(function () {
		__tmLockUiT = null;
		try {
			if (typeof mcpRenderAgents === 'function') mcpRenderAgents();
		} catch (e) {
			ignorarErro(e, 'tmLockUiPing');
		}
	}, 400);
}
function tmLockReadTouch(path, nome, proj, projName, tool) {
	try {
		const n = tmAgNome(nome);
		if (!n) return null;
		const p = tmNormPath(path);
		if (!p) return null;
		const pj = tmProjKey(proj);
		tmRMark(p, pj, n);
		const seg = Number(TM.cfg.lockAutoSeconds) || 0;
		if (seg <= 0) return null;
		const ctx = tmCtxDono(n, tool);
		const meu = tmLockMeu(p, pj, n, 'write') || tmLockMeu(p, pj, n, 'read');
		if (meu) {
			const novo = tmNow() + seg * 1000;
			if (novo > (meu.until || 0)) meu.until = novo;
			if (meu.mode !== 'manual' && ctx) tmLockAddDono(meu, ctx.id);
			tmLockUiPing();
			return meu;
		}
		if (tmLocksLivres() <= 0) return null;
		const r = tmLockAcquire(n, p, {
			kind: 'read',
			mode: 'auto',
			ctxId: ctx ? ctx.id : null,
			seconds: seg,
			proj: pj,
			projName: projName || '',
			note: 'lendo com ' + (tool || 'read_file'),
		});
		tmLockUiPing();
		return r.lock;
	} catch (e) {
		return null;
	}
}

function tmLocksResumo() {
	tmLocksGC();
	const K = tmLocks();
	const mapa = {};
	Object.keys(K).forEach(function (k) {
		const l = K[k];
		if (!l) return;
		const ch = tmProjKey(l.proj) + '|' + tmLockPathKey(l.path);
		const it =
			mapa[ch] ||
			(mapa[ch] = {
				path: l.path,
				projName: l.projName || '',
				escritor: null,
				leitores: [],
				until: 0,
			});
		if (tmLockKind(l) === 'write') it.escritor = l;
		else it.leitores.push(l);
		if ((l.until || 0) > it.until) it.until = l.until;
	});
	return Object.keys(mapa)
		.map(function (k) {
			return mapa[k];
		})
		.sort(function (a, b) {
			return (a.until || 0) - (b.until || 0);
		});
}
function tmLocksReport() {
	const its = tmLocksResumo();
	if (!its.length)
		return 'Nenhum arquivo na mao de ninguem agora. Lembrando: ler nunca precisa esperar outro leitor - a trava so impede GRAVACAO.';
	const NL = String.fromCharCode(10);
	const L = [`Arquivos ocupados agora (${its.length}):`];
	its.forEach(function (it) {
		const nome = it.path + (it.projName ? ` [${it.projName}]` : '');
		if (it.escritor) {
			const l = it.escritor;
			L.push(
				`- ${nome} - ESCRITA (ninguem le nem grava): ${l.agent}${l.team ? ' / ' + l.team : ''} - ${l.mode === 'manual' ? 'reservado' : 'gravando agora'} \
- mais ${tmLockPrazoTxt(l)}${l.note ? ' - ' + l.note : ''}`,
			);
		}
		if (it.leitores.length) {
			const mais = Math.max.apply(
				null,
				it.leitores.map(function (l) {
					return tmLockRestanteSeg(l);
				}),
			);
			L.push(
				`- ${nome} - LEITURA por ${it.leitores.length} agente(s) (pode ler junto, nao pode gravar): ${it.leitores
					.map(function (l) {
						return l.agent;
					})
					.join(', ')} - mais ${tmSegTxt(mais)}`,
			);
		}
	});
	return L.join(NL);
}

function tmToolSrc(t) {
	let s = '';
	let f = t && t.run;
	let n = 0;
	while (typeof f === 'function' && n < 6) {
		s += String(f);
		const o = f.orig;
		f = o && typeof o.run === 'function' ? o.run : null;
		n++;
	}
	return s;
}
function tmLocksSelfCheck() {
	const p = [];
	try {
		tmLocksGC();
		const K = tmLocks();
		Object.keys(K).forEach(function (k) {
			const l = K[k];
			if (!l) {
				p.push('trava vazia na chave ' + k);
				return;
			}
			if (tmLockKeyOf(l) !== k) p.push(`trava com chave inconsistente: ${k} vs ${l.path}`);
			if (!(Number(l.until) > tmNow())) p.push('trava vencida sobrou apos a limpeza: ' + l.path);
			if (l.mode !== 'auto' && l.mode !== 'manual')
				p.push('trava com tipo desconhecido: ' + l.path);
			if (l.kind !== 'read' && l.kind !== 'write')
				p.push('trava sem leitura/escrita definida: ' + l.path);
		});
		const K2 = tmLocks();
		if (
			Object.keys(K2).some(function (k) {
				const l = K2[k];
				if (!l || tmLockKind(l) !== 'read') return false;
				const w = tmLockOf(l.path, l.proj);
				return !!w && tmAgKey(w.agent) !== tmAgKey(l.agent);
			})
		)
			p.push(
				'um arquivo esta com leitura e escrita de agentes diferentes ao mesmo tempo: a exclusividade da escrita furou',
			);
		if (!String(tmLockReadMsg).includes('tmBloqueioLeitura'))
			p.push(
				'a leitura voltou a olhar qualquer trava: dois agentes nao conseguem mais ler o mesmo arquivo (ADR-0047 furado)',
			);
		if (!String(tmLockGate).includes('tmBloqueioEscrita'))
			p.push(
				'a gravacao nao olha mais a marca de leitura: da para gravar por cima de quem esta lendo (ADR-0047 furado)',
			);
		if (!String(tmBegin).includes('tmLockClaimCtx'))
			p.push(
				'tmBegin nao trava na entrada da chamada: volta a existir fresta entre ler e gravar (ADR-0049 furado)',
			);
		else if (
			String(tmBegin).indexOf('TM.active.push(ctx)') > String(tmBegin).indexOf('tmLockClaimCtx')
		)
			p.push(
				'tmBegin trava antes de entrar na pilha: a varredura de orfas pode apagar a trava da propria chamada (ADR-0050 furado)',
			);
		if (!String(tmLockReleaseCtx).includes('lockReadGraceSeconds'))
			p.push('a trava automatica nao cai mais junto com a resposta (ADR-0049 furado)');
		if (!String(tmLocksGC).includes('tmLockDonoVivo') && !String(tmLocksGC).includes('tmCtxVivo'))
			p.push('trava automatica de chamada morta nao e mais varrida (ADR-0050 furado)');
		if (
			Object.keys(K).some(function (k) {
				const l = K[k];
				return l && l.mode === 'auto' && !l.grace && tmLockDonos(l).length && !tmLockDonoVivo(l);
			})
		)
			p.push('sobrou trava automatica de chamada que ja acabou');
		if (!String(tmLockReleaseCtx).includes('tmLockDelDono'))
			p.push(
				'trava automatica voltou a ter dono unico: duas chamadas do mesmo agente se atropelam (ADR-0052 furado)',
			);
		if (!String(tmLockReadTouch).includes('tmCtxDono'))
			p.push(
				'a marca de leitura pega a chamada do topo da pilha, que pode ser de outro agente (ADR-0052 furado)',
			);
		if (!String(tmLockGate).includes('tmStaleGuard'))
			p.push(
				'gravacao em cima de leitura velha nao e mais barrada: da para apagar o trabalho do outro sem aviso (ADR-0051 furado)',
			);
		if (!String(tmLockPreflight).includes('tmStalePreflight'))
			p.push(
				'versao velha so e vista na hora de gravar: chamada de varios arquivos pode gravar metade e falhar no meio (ADR-0051 furado)',
			);
		if (!String(tmRMark).includes('tmMarkTick'))
			p.push(
				'marca de leitura voltou a depender so do relogio: leitura e gravacao no mesmo milissegundo passam batido',
			);
		if (!String(tmLockPainelAberto).includes('getBoundingClientRect'))
			p.push(
				'deteccao de painel aberto por offsetParent: com menu flutuante (position:fixed) o contador congela na tela',
			);
		if (!String(tmLockGate).includes('tmWMark'))
			p.push(
				'ninguem anota quem gravou por ultimo: a guarda de versao velha fica cega (ADR-0051 furado)',
			);
		if (!String(tmLockReadTouch).includes('tmRMark'))
			p.push(
				'ninguem anota quando o agente leu: a guarda de versao velha fica cega (ADR-0051 furado)',
			);
		if (
			Object.keys(K).some(function (k) {
				const l = K[k];
				return (
					l &&
					Array.isArray(l.ctxIds) &&
					l.ctxIds.length &&
					l.ctxId !== l.ctxIds[l.ctxIds.length - 1]
				);
			})
		)
			p.push('lista de donos da trava fora de sincronia com o dono atual');
		if (!String(tmGateWrite).includes('tmLockGate'))
			p.push('tmGateWrite nao chama tmLockGate: as travas sairam da primitiva (ADR-0026 furado)');
		else if (!String(tmBegin).includes('tmLockPreflight'))
			p.push(
				'tmBegin nao chama tmLockPreflight: a chamada voltou a ser conferida arquivo por arquivo (ADR-0030 furado)',
			);
		else if (!String(tmBegin).includes('ctx.projId'))
			p.push(
				'tmBegin nao guarda o projeto da chamada: as travas voltam a valer para o site inteiro (ADR-0032 furado)',
			);
		else if (!String(tmEnd).includes('tmLockReleaseCtx'))
			p.push(
				'tmEnd nao solta as travas automaticas: elas vao vazar entre chamadas (ADR-0027 furado)',
			);
		else {
			const rf =
				typeof MCP_TOOLS !== 'undefined'
					? MCP_TOOLS.filter(function (t) {
							return t.name === 'read_file';
						})[0]
					: null;
			const rfs =
				typeof MCP_TOOLS !== 'undefined'
					? MCP_TOOLS.filter(function (t) {
							return t.name === 'read_files';
						})[0]
					: null;
			if (rf && !tmToolSrc(rf).includes('tmGateRead'))
				p.push('read_file nao consulta as travas: da para ler versao velha (ADR-0029 furado)');
			if (rfs && !tmToolSrc(rfs).includes('tmGateReadSoft'))
				p.push('read_files nao consulta as travas: da para ler versao velha (ADR-0029 furado)');
			if (rf && !tmToolSrc(rf).includes('tmLockReadTouch'))
				p.push(
					'read_file nao marca a leitura: outro agente pode gravar por cima de quem esta lendo (ADR-0048 furado)',
				);
			if (rfs && !tmToolSrc(rfs).includes('tmLockReadTouch'))
				p.push(
					'read_files nao marca a leitura: outro agente pode gravar por cima de quem esta lendo (ADR-0048 furado)',
				);
			if (rf && !tmToolSrc(rf).includes('proj&&proj.id'))
				p.push('read_file nao diz de qual projeto e a leitura (ADR-0032 furado)');
			if (rfs && !tmToolSrc(rfs).includes('proj&&proj.id'))
				p.push('read_files nao diz de qual projeto e a leitura (ADR-0032 furado)');
			if (typeof mcpRenderAgents === 'function' && !String(mcpRenderAgents).includes('travas'))
				p.push(
					'o painel de agentes nao mostra mais as travas: o usuario fica sem enxergar quem segura o que',
				);
			if (
				typeof mcpRenderAgents === 'function' &&
				!String(mcpRenderAgents).includes('tmLockTickOn')
			)
				p.push(
					'o painel nao anda sozinho: com trava de segundos o contador congela e mostra arquivo ja liberado',
				);
		}
	} catch (e) {
		p.push('autodiagnostico de travas quebrou: ' + String((e && e.message) || e));
	}
	if (p.length) tmAudit('selfcheck-fail', { parte: 'travas', problemas: p.slice(0, 8) });
	return p;
}

const TM_LOCKS = {
	lista: function () {
		const s = tmLocksReport();
		try {
			registro.debug(s);
		} catch (e) {
			ignorarErro(e, 'lista');
		}
		return tmLocks();
	},
	travar: function (agente, path, min) {
		const r = tmLockAcquire(agente, path, { kind: 'write', mode: 'manual', minutes: min });
		tmAgSave();
		try {
			mcpRenderAgents();
		} catch (e) {
			ignorarErro(e, 'travar');
		}
		return r.lock;
	},
	ler: function (agente, path, min) {
		const r = tmLockAcquire(agente, path, { kind: 'read', mode: 'manual', minutes: min });
		tmAgSave();
		try {
			mcpRenderAgents();
		} catch (e) {
			ignorarErro(e, 'ler');
		}
		return r.lock;
	},
	soltar: function (path) {
		const r = tmLockRelease('', path, { forcarUsuario: true });
		tmAgSave();
		try {
			mcpRenderAgents();
		} catch (e) {
			ignorarErro(e, 'soltar');
		}
		return r;
	},
	soltarDoAgente: function (agente) {
		const n = tmLockReleaseAgent(agente, 'usuario');
		tmAgSave();
		try {
			mcpRenderAgents();
		} catch (e) {
			ignorarErro(e, 'soltarDoAgente');
		}
		return n;
	},
	soltarTodas: function () {
		const K = tmLocks();
		const n = Object.keys(K).length;
		TM.locks = {};
		tmAudit('lock-force', { quantas: n, porUsuario: true });
		tmAgSave();
		try {
			mcpRenderAgents();
		} catch (e) {
			ignorarErro(e, 'soltarTodas');
		}
		return n;
	},
	minutos: function (m) {
		const v = Math.max(1, Math.min(240, Number(m) || 10));
		TM.cfg.lockMinutes = v;
		tmAgSave();
		return v;
	},
	minutosLeitura: function (m) {
		const v = Math.max(0, Math.min(240, Number(m) || 0));
		TM.cfg.lockReadMinutes = v;
		tmAgSave();
		return v;
	},
	segundosAuto: function (s) {
		const v = Math.max(0, Math.min(900, Number(s) || 0));
		TM.cfg.lockAutoSeconds = v;
		tmAgSave();
		return v;
	},
	gracaLeitura: function (s) {
		const v = Math.max(0, Math.min(300, Number(s) || 0));
		TM.cfg.lockReadGraceSeconds = v;
		tmAgSave();
		return v;
	},
};
try {
	window.TM_LOCKS = TM_LOCKS;
} catch (e) {
	ignorarErro(e, 'travas-de-arquivo');
}

function tmPathsArg(a) {
	const raw = a && a.paths != null ? a.paths : a && a.path != null ? a.path : null;
	let arr = [];
	if (Array.isArray(raw)) arr = raw;
	else if (typeof raw === 'string') arr = raw.split(/[,\n]/);
	else if (raw != null) arr = [raw];
	if (a && a.paths != null && typeof a.path === 'string') arr = arr.concat([a.path]);
	const vistos = {};
	const out = [];
	arr
		.map(function (x) {
			return tmNormPath(String(x == null ? '' : x));
		})
		.forEach(function (p) {
			const k = p.toLowerCase();
			if (p && !vistos[k]) {
				vistos[k] = 1;
				out.push(p);
			}
		});
	return out;
}

tmEnsureNativeTeams();
tmAgentsSync();

try {
	window.TM = TM;
	window.TM_QA = TM_QA;
	window.TM_TOOL_PATHS = TM_TOOL_PATHS;
	window.TM_TEAMS = TM_TEAMS;
} catch (e) {
	ignorarErro(e, 'travas-de-arquivo');
}
setTimeout(function () {
	let p = [];
	try {
		p = tmSelfCheck()
			.concat(tmTeamsSelfCheck())
			.concat(tmAgentsSelfCheck())
			.concat(tmEnlistSelfCheck())
			.concat(tmLocksSelfCheck());
	} catch (e) {
		p = ['autodiagnostico quebrou: ' + ((e && e.message) || e)];
	}
	try {
		const modo = tmTeamMode();
		const desc =
			modo === 'off'
				? 'nenhuma equipe criada: o site funciona como antes'
				: modo === 'shadow'
					? 'MODO SOMBRA: nada e bloqueado, tudo vira auditoria'
					: 'POSSE VALENDO: agente so altera arquivo da propria equipe';
		registro.debug(
			'%c[Synapse Teams] Partes 0-3 ativas - ' + desc,
			'color:#6aa3ff;font-weight:600',
			p.length
				? 'PROBLEMAS DE CONTRATO: ' + p.join(' | ')
				: 'contratos OK. Use TM_TEAMS.lista(), TM_AGENTS.lista(), TM_LOCKS.lista() e TM_QA.dump().',
		);
	} catch (e) {
		ignorarErro(e, 'travas-de-arquivo');
	}
}, 1500);
