'use strict';
function tmCmdInfo() {
	const b = TM.cmd.busy;
	if (!b) return 'nenhum comando em execucao';
	return (
		'"' +
		b.cmd +
		'"' +
		(b.agent ? ` do agente "${b.agent}"` : '') +
		(b.project ? ` no projeto "${b.project}"` : '') +
		' ha ' +
		Math.round((tmNow() - b.at) / 1000) +
		's' +
		(b.procId ? ` [proc ${b.procId}]` : '')
	);
}
function tmCmdAcquire(ctx, args) {
	return new Promise(function (resolve, reject) {
		let projName = '';
		try {
			const p = agProjQuiet(args);
			projName = p ? p.name : '';
		} catch (e) {
			ignorarErro(e, 'tmCmdAcquire');
		}
		const item = {
			id: 'c' + TM.cmd.seq++,
			agent: ctx.agent,
			tool: ctx.tool,
			project: projName,
			cmd: String(
				(args && args.command) || (ctx.tool === 'start_dev_server' ? 'npm run dev' : ctx.tool),
			).slice(0, 160),
			at: tmNow(),
			resolve: resolve,
			reject: reject,
			timer: null,
		};
		if (!TM.cmd.busy) {
			tmCmdStart(item);
			return;
		}
		if (TM.cmd.queue.length >= TM.cfg.cmdQueueMax) {
			reject(
				new Error(
					`Fila de comandos cheia (${TM.cfg.cmdQueueMax} na espera). Em execucao: ${tmCmdInfo()}. O terminal \
roda UM comando por vez em todo o site (dois em paralelo ja corromperam um projeto). Tente de novo em \
alguns minutos.`,
				),
			);
			return;
		}
		const esperaFila = Math.min(TM.cfg.cmdQueueWaitMs, TM.cfg.cmdEsperaChamadaMs || 55000);
		item.timer = {};
		item.esperaMs = esperaFila;
		(function (tok) {
			(window.bgEspera
				? window.bgEspera(esperaFila)
				: new Promise(function (r) {
						setTimeout(r, esperaFila);
					})
			).then(function () {
				if (item.timer === tok) tmCmdDrop(item);
			});
		})(item.timer);
		const vaga = tmCmdVagaGuardada(item);
		if (vaga >= 0) {
			TM.cmd.queue.splice(vaga, 0, item);
			TM.stats.cmdQueued++;
			tmAudit('cmd-vez-guardada', {
				id: item.id,
				tool: item.tool,
				agent: item.agent,
				cmd: item.cmd,
				posicao: vaga + 1,
				ocupado: tmCmdInfo(),
			});
		} else {
			TM.cmd.queue.push(item);
			TM.stats.cmdQueued++;
			tmAudit('cmd-queued', {
				id: item.id,
				tool: item.tool,
				agent: item.agent,
				cmd: item.cmd,
				posicao: TM.cmd.queue.length,
				ocupado: tmCmdInfo(),
			});
		}
		try {
			if (typeof toast === 'function')
				toast(
					`Comando na fila (${TM.cmd.queue.length})`,
					`Aguardando terminar: ${tmCmdInfo()}. O terminal roda um comando por vez.`,
					'ok',
				);
		} catch (e) {
			ignorarErro(e, 'tmCmdAcquire');
		}
		try {
			if (typeof mcpRenderPanel === 'function') mcpRenderPanel();
		} catch (e) {
			ignorarErro(e, 'tmCmdAcquire');
		}
	});
}
function tmCmdTicketPoda() {
	const T = TM.cmd.tickets || (TM.cmd.tickets = []);
	const prazo = Number(TM.cfg.cmdTicketMs) || 0,
		ag = tmNow();
	for (let i = T.length - 1; i >= 0; i--) {
		if (!prazo || ag - T[i].at > prazo) T.splice(i, 1);
	}
	if (T.length > 300) T.splice(0, T.length - 300);
	return T;
}
function tmCmdVagaGuardada(item) {
	const T = tmCmdTicketPoda();
	for (let i = 0; i < T.length; i++) {
		if (T[i].agent === item.agent && T[i].cmd === item.cmd) {
			const pos = Math.max(0, Math.min(T[i].pos, TM.cmd.queue.length));
			T.splice(i, 1);
			return pos;
		}
	}
	return -1;
}
function tmCmdDrop(item) {
	const i = TM.cmd.queue.indexOf(item);
	if (i < 0) return;
	TM.cmd.queue.splice(i, 1);
	if (Number(TM.cfg.cmdTicketMs) || 0) {
		tmCmdTicketPoda().push({
			agent: item.agent,
			cmd: item.cmd,
			tool: item.tool,
			pos: i,
			at: tmNow(),
		});
	}
	tmAudit('cmd-queue-timeout', {
		id: item.id,
		tool: item.tool,
		agent: item.agent,
		cmd: item.cmd,
		vagaGuardada: i + 1,
	});
	item.reject(
		new Error(
			`Terminal ocupado: ${tmCmdInfo()}. Sua vez nao chegou em ${Math.round((item.esperaMs || TM.cfg.cmdQueueWaitMs) / 1000)}s \
e NADA foi executado - repita a MESMA chamada em alguns segundos. Sua vez fica guardada por ${Math.round((Number(TM.cfg.cmdTicketMs) || 0) / 1000)}s: \
ao repetir, voce volta para a MESMA posicao da fila, sem ir para o fim.`,
		),
	);
}
function tmCmdStart(item) {
	item.timer = null;
	TM.cmd.busy = {
		id: item.id,
		agent: item.agent,
		tool: item.tool,
		cmd: item.cmd,
		project: item.project,
		at: tmNow(),
		procId: null,
		errs: 0,
	};
	TM.stats.cmdRuns++;
	tmAudit('cmd-start', {
		id: item.id,
		tool: item.tool,
		agent: item.agent,
		cmd: item.cmd,
		projeto: item.project,
		fila: TM.cmd.queue.length,
	});
	tmCmdWatch(true);
	try {
		if (typeof mcpRenderPanel === 'function') mcpRenderPanel();
	} catch (e) {
		ignorarErro(e, 'tmCmdStart');
	}
	item.resolve({ id: item.id });
}
function tmCmdRelease(lockId, reason) {
	const b = TM.cmd.busy;
	if (!b || (lockId && b.id !== lockId)) return false;
	TM.cmd.busy = null;
	tmAudit('cmd-end', {
		id: b.id,
		tool: b.tool,
		agent: b.agent,
		cmd: b.cmd,
		ms: tmNow() - b.at,
		motivo: reason || '',
	});
	const next = TM.cmd.queue.shift();
	if (next) tmCmdStart(next);
	else tmCmdWatch(false);
	try {
		if (typeof mcpRenderPanel === 'function') mcpRenderPanel();
	} catch (e) {
		ignorarErro(e, 'tmCmdRelease');
	}
	return true;
}
function tmCmdAfterCall(ctx, ok) {
	const lock = ctx.cmdLock;
	if (!lock) return;
	ctx.cmdLock = null;
	const b = TM.cmd.busy;
	if (!b || b.id !== lock.id) return;
	if (!ok) {
		tmCmdRelease(lock.id, 'a chamada falhou');
		return;
	}
	if (ctx.tool === 'start_dev_server') {
		tmCmdRelease(lock.id, 'dev server segue em background (ADR-0005)');
		return;
	}
	if (!b.procId) {
		tmCmdRelease(lock.id, 'nenhum processo ficou ativo');
		return;
	}
}
function tmCmdWatch(on) {
	if (!on) {
		TM.cmd.timer = null;
		return;
	}
	if (TM.cmd.timer) return;
	const meu = {};
	TM.cmd.timer = meu;
	const pausa = function (ms) {
		return window.bgEspera
			? window.bgEspera(ms)
			: new Promise(function (r) {
					setTimeout(r, ms);
				});
	};
	(async function laco() {
		while (TM.cmd.timer === meu) {
			const b = TM.cmd.busy;
			if (!b) {
				if (TM.cmd.timer === meu) TM.cmd.timer = null;
				return;
			}
			if (tmNow() - b.at > TM.cfg.cmdMaxMs) {
				TM.stats.cmdForced++;
				tmAudit('cmd-timeout-force', { id: b.id, cmd: b.cmd, ms: tmNow() - b.at });
				tmCmdRelease(b.id, 'tempo maximo excedido (comando zumbi)');
				continue;
			}
			let ocupado = !b.procId;
			if (!ocupado)
				for (let i = 0; i < TM.active.length; i++) {
					if (TM.active[i].cmdLock && TM.active[i].cmdLock.id === b.id) {
						ocupado = true;
						break;
					}
				}
			if (ocupado) {
				await pausa(Math.min(1000, TM.cfg.cmdPollMs));
				continue;
			}
			try {
				const st = await termApi('out', {
					procId: b.procId,
					from: 0,
					wait: Math.min(20000, Math.max(1000, TM.cfg.cmdPollMs * 3)),
					fim: true,
				});
				b.errs = 0;
				if (st && st.done) {
					tmCmdRelease(b.id, `processo finalizado (codigo ${st.code})`);
					continue;
				}
				if (!st || !st.lp) await pausa(TM.cfg.cmdPollMs);
			} catch (e) {
				b.errs = (b.errs || 0) + 1;
				if (b.errs >= TM.cfg.cmdMaxErrs) {
					tmAudit('cmd-relay-lost', { id: b.id, cmd: b.cmd, erros: b.errs });
					tmCmdRelease(b.id, `relay inacessivel apos ${b.errs} tentativas`);
					continue;
				}
				await pausa(TM.cfg.cmdPollMs);
			}
		}
	})();
}
function tmCmdNoteProc(procId, who, cmd, proj) {
	const b = TM.cmd.busy;
	if (who === 'agent') {
		if (!b) return;
		if (!b.procId) {
			b.procId = procId;
			return;
		}
		if (b.procId !== procId)
			tmAudit('cmd-overlap', { rodando: b.procId, iniciado: procId, cmd: b.cmd, por: 'agente' });
		return;
	}
	if (!b) {
		TM.cmd.busy = {
			id: 'u' + TM.cmd.seq++,
			agent: 'voce (usuario)',
			tool: 'terminal',
			cmd: String(cmd || 'comando do terminal').slice(0, 160),
			project: (proj && proj.name) || '',
			at: tmNow(),
			procId: procId,
			user: true,
			errs: 0,
		};
		TM.stats.cmdRuns++;
		tmAudit('cmd-start', {
			id: TM.cmd.busy.id,
			tool: 'terminal',
			agent: 'usuario',
			cmd: TM.cmd.busy.cmd,
			fila: TM.cmd.queue.length,
		});
		tmCmdWatch(true);
		return;
	}
	if (b.user && !b.procId) {
		b.procId = procId;
		return;
	}
	if (b.procId && b.procId !== procId) {
		tmAudit('cmd-overlap', { rodando: b.procId, iniciado: procId, cmd: b.cmd, por: 'usuario' });
		try {
			toast(
				'Dois comandos ao mesmo tempo',
				`Ja existe um comando rodando (${b.cmd}). Rodar dois no mesmo projeto pode corromper arquivos.`,
				'err',
			);
		} catch (e) {
			ignorarErro(e, 'tmCmdNoteProc');
		}
	}
}
function tmSelfCheck() {
	const problems = [];
	try {
		const names = new Set(
			typeof MCP_TOOLS !== 'undefined' && MCP_TOOLS.map
				? MCP_TOOLS.map(function (t) {
						return t.name;
					})
				: [],
		);
		if (typeof AG_WRITE !== 'undefined')
			AG_WRITE.forEach(function (n) {
				if (!TM_TOOL_PATHS[n])
					problems.push('ferramenta de escrita sem rota declarada em TM_TOOL_PATHS: ' + n);
			});
		Object.keys(TM_TOOL_PATHS).forEach(function (n) {
			if (names.size && !names.has(n))
				problems.push('TM_TOOL_PATHS aponta para ferramenta inexistente: ' + n);
		});
		const round = JSON.parse(JSON.stringify(tmSerialize()));
		if ((round.v | 0) !== TM_SCHEMA) problems.push('serializacao perdeu a versao do schema');
		['cfg', 'teams', 'agents', 'locks', 'reviews', 'audit'].forEach(function (k) {
			if (!(k in round)) problems.push('serializacao sem o campo ' + k);
		});
		if (!(new TMFileMap() instanceof Map)) problems.push('TMFileMap nao herda de Map');
		const probe = new TMFileMap();
		TM.active.push({
			id: -1,
			tool: '__probe',
			probe: true,
			agent: '',
			allow: new Set(['ok.txt']),
			prefixes: [],
			writesAll: false,
			wrote: [],
			undeclared: [],
			cmdLock: null,
		});
		try {
			probe.set('ok.txt', 1);
			probe.set('fora.txt', 1);
			const c = TM.active[TM.active.length - 1];
			if (c.wrote.length !== 1) problems.push('guard nao contabilizou a escrita declarada');
			if (c.undeclared.length !== 1) problems.push('guard nao detectou a escrita NAO declarada');
		} finally {
			TM.active.pop();
		}
		tmTeamsSelfCheck().forEach(function (x) {
			problems.push(x);
		});
		if (typeof tmReviewsSelfCheck === 'function')
			tmReviewsSelfCheck().forEach(function (x) {
				problems.push(x);
			});
		if (typeof tmMsgsSelfCheck === 'function')
			tmMsgsSelfCheck().forEach(function (x) {
				problems.push(x);
			});
		if (typeof tmUISelfCheck === 'function')
			tmUISelfCheck().forEach(function (x) {
				problems.push(x);
			});
	} catch (e) {
		problems.push('excecao no selfcheck: ' + ((e && e.message) || e));
	}
	if (problems.length) tmAudit('selfcheck-fail', { problemas: problems });
	return problems;
}
const TM_TEAMS = {
	criar: function (nome, arquivos, descricao) {
		const t = tmTeamCreate({ name: nome, paths: arquivos || [], desc: descricao || '' });
		registro.debug('Equipe criada:', t.name);
		return tmTeamsReport();
	},
	apagar: function (nome) {
		tmTeamDelete(nome);
		return tmTeamsReport();
	},
	renomear: function (nome, novo) {
		tmTeamRename(nome, novo);
		return tmTeamsReport();
	},
	adicionar: function (nome, arquivos) {
		tmPathsAdd(nome, arquivos);
		return tmTeam(nome);
	},
	remover: function (nome, arquivos) {
		const r = tmPathsRemove(nome, arquivos);
		return { removidos: r.removidos, naoEncontrados: r.naoEncontrados, equipe: r.equipe };
	},
	permitirSaida: function (nome, sim) {
		return tmTeamAllowLeave(nome, sim !== false);
	},
	dono: function (caminho) {
		const d = tmOwnerOf(caminho);
		return d ? { equipe: d.team.name, regra: d.regra, alvo: d.alvo } : 'sem dono';
	},
	podeEscrever: function (nome, caminho) {
		return tmTeamCanWrite(nome, caminho);
	},
	lista: function () {
		try {
			console.table(tmTeamsReport());
		} catch (e) {
			ignorarErro(e, 'lista');
		}
		return tmTeamsReport();
	},
	ver: function (nome) {
		return tmTeam(nome);
	},
};
const TM_QA = {
	state: function () {
		return TM;
	},
	stats: function () {
		return TM.stats;
	},
	audit: function (n) {
		return TM.audit.slice(-(n || 30));
	},
	selfcheck: tmSelfCheck,
	cmd: function () {
		return {
			emExecucao: TM.cmd.busy ? tmCmdInfo() : null,
			fila: TM.cmd.queue.map(function (q) {
				return {
					id: q.id,
					tool: q.tool,
					agent: q.agent,
					cmd: q.cmd,
					esperando_s: Math.round((tmNow() - q.at) / 1000),
				};
			}),
		};
	},
	dump: function () {
		const g = {};
		TM.audit.forEach(function (e) {
			g[e.kind] = (g[e.kind] || 0) + 1;
		});
		try {
			registro.debug('%c[Synapse Teams] estado', 'color:#6aa3ff;font-weight:600', {
				schema: TM.v,
				enforce: TM.cfg.enforce,
				filaTerminal: TM.cfg.serializeCommands,
				stats: TM.stats,
				auditoria: g,
				comando: TM_QA.cmd(),
			});
		} catch (e) {
			ignorarErro(e, 'dump');
		}
		return { stats: TM.stats, auditoria: g };
	},
};
const TM_TEAM_LIMITS = {
	nome: [1, 60],
	desc: [0, 400],
	caminhos: 400,
	equipes: 200,
	saneMax: 3000,
};
const TM_NATIVE = {
	reviewer: {
		id: 'nativa-revisor',
		name: 'Integrador Revisor',
		maxAgents: 1,
		desc: 'Equipe nativa de UM agente. Revisa compatibilidade e dependencias entre as alteracoes das outras equipes e pode corrigir o que reprovar.',
		caps: { writeAny: true, writeOwnerless: true, manageTeams: false, review: true },
	},
	manager: {
		id: 'nativa-gerenciador',
		name: 'Gerenciador',
		maxAgents: 1,
		desc: 'Equipe nativa opcional de UM agente. Administra as equipes (criar, remover, mudar arquivos permitidos). Nao mexe em arquivo que ja tem dono.',
		caps: { writeAny: false, writeOwnerless: true, manageTeams: true, review: false, plan: false },
	},
	planner: {
		id: 'nativa-planejador',
		name: 'Planejador / Divisor',
		maxAgents: 1,
		desc:
			'Equipe nativa de UM agente. Planeja a arquitetura do sistema que o usuario pediu e ' +
			'divide o trabalho entre as equipes existentes, entregando um prompt pronto para cada ' +
			'uma. Nao altera arquivo nenhum.',
		caps: { writeAny: false, writeOwnerless: false, manageTeams: false, review: false, plan: true },
	},
};
function tmCaps() {
	return { writeAny: false, writeOwnerless: false, manageTeams: false, review: false, plan: false };
}
function tmProjList() {
	try {
		return typeof State !== 'undefined' && State && Array.isArray(State.projects)
			? State.projects
			: [];
	} catch (e) {
		return [];
	}
}
function tmProjById(id) {
	const s = String(id || '');
	if (!s) return null;
	return (
		tmProjList().filter(function (p) {
			return String(p.id) === s;
		})[0] || null
	);
}
function tmProjNome(id) {
	const p = tmProjById(id);
	return p ? String(p.name || p.id) : String(id || '');
}
function tmProjEscopo(x) {
	if (!x) return '';
	if (typeof x === 'string') return x;
	if (typeof x === 'object' && x.id) return String(x.id);
	return '';
}
function tmTeamProj(t) {
	return String((t && t.proj) || '');
}
function tmTeamProjNome(t) {
	const id = tmTeamProj(t);
	if (!id) return '';
	return t && t.projName ? String(t.projName) : tmProjNome(id);
}
function tmTeamEscopoTxt(t) {
	return tmTeamProj(t)
		? `projeto "${tmTeamProjNome(t)}"`
		: 'qualquer projeto (equipe sem projeto definido)';
}
function tmKey(p) {
	return tmNormPath(p).toLowerCase();
}
function tmPathValid(p) {
	const s = tmNormPath(p);
	if (!s) return 'caminho vazio';
	if (s.length > 300) return 'caminho longo demais';
	if (s.split('/').includes('..')) return 'caminho nao pode sair da pasta do projeto ("..")';
	if (/^[a-zA-Z]:/.test(s) || /^~/.test(s))
		return 'use caminho relativo ao projeto, nao caminho absoluto';
	if (/[<>:"|?*\u0000-\u001f]/.test(s)) return 'caminho com caractere invalido';
	return null;
}
function tmIsInside(filhoKey, paiKey) {
	return filhoKey === paiKey || filhoKey.indexOf(paiKey + '/') === 0;
}
function tmTeams() {
	return Object.keys(TM.teams)
		.map(function (k) {
			return TM.teams[k];
		})
		.filter(Boolean);
}
function tmTeam(ref) {
	if (!ref) return null;
	if (typeof ref === 'object' && ref.id) return TM.teams[ref.id] || null;
	const s = String(ref).trim();
	if (!s) return null;
	const alvo = s.toLowerCase();
	const porNome = tmTeams().filter(function (t) {
		return String(t.name).toLowerCase() === alvo;
	});
	if (porNome.length) return porNome[0];
	return TM.teams[s] || null;
}
function tmSlug(nome) {
	let base =
		tmNormPath(nome)
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 40) || 'equipe';
	let id = base,
		n = 2;
	while (TM.teams[id]) {
		id = base + '-' + n++;
	}
	return id;
}
let TM_REV = 1;
function tmTouch() {
	TM_REV++;
}
let TM_IDX = { sig: null, files: null, dirs: null };
function tmIdxSig() {
	let n = 0,
		c = 0;
	const ks = Object.keys(TM.teams || {});
	for (let i = 0; i < ks.length; i++) {
		const t = TM.teams[ks[i]];
		if (!t) continue;
		n++;
		c += (t.files ? t.files.length : 0) + (t.dirs ? t.dirs.length : 0);
	}
	return TM_REV + ':' + n + ':' + c;
}
function tmIdxKey(proj, k) {
	return String(proj || '') + '\u0000' + k;
}
function tmIndex() {
	const sig = tmIdxSig();
	if (TM_IDX.sig === sig) return TM_IDX;
	const files = new Map(),
		dirs = new Map();
	tmTeams().forEach(function (t) {
		const pr = tmTeamProj(t);
		(t.files || []).forEach(function (p) {
			const k = tmKey(p);
			if (!k) return;
			const kk = tmIdxKey(pr, k);
			if (!files.has(kk)) files.set(kk, { team: t, regra: 'arquivo', alvo: p });
		});
		(t.dirs || []).forEach(function (p) {
			const k = tmKey(p);
			if (!k) return;
			const kk = tmIdxKey(pr, k);
			if (!dirs.has(kk)) dirs.set(kk, { team: t, regra: 'pasta', alvo: p });
		});
	});
	TM_IDX = { sig: sig, files: files, dirs: dirs };
	return TM_IDX;
}
function tmOwnerEscopo(k, escopo, ix) {
	const f = ix.files.get(tmIdxKey(escopo, k));
	if (f) return f;
	if (!ix.dirs.size) return null;
	const seg = k.split('/');
	for (let i = seg.length; i >= 1; i--) {
		const d = ix.dirs.get(tmIdxKey(escopo, seg.slice(0, i).join('/')));
		if (d) return d;
	}
	return null;
}
function tmOwnerOf(path, proj) {
	const k = tmKey(path);
	if (!k) return null;
	const ix = tmIndex();
	const pr = tmProjEscopo(proj);
	if (pr) {
		const dono = tmOwnerEscopo(k, pr, ix);
		if (dono) return dono;
	}
	return tmOwnerEscopo(k, '', ix);
}
function tmTeamOf(path, proj) {
	const d = tmOwnerOf(path, proj);
	return d ? d.team : null;
}
function tmConflicts(entradas, exceptId, proj) {
	const pr = tmProjEscopo(proj);
	const out = [];
	entradas.forEach(function (e) {
		const k = tmKey(e.path);
		tmTeams().forEach(function (t) {
			if (t.id === exceptId) return;
			const tp = tmTeamProj(t);
			if (pr && tp && tp !== pr) return;
			(t.files || []).forEach(function (f) {
				const fk = tmKey(f);
				if (e.dir ? tmIsInside(fk, k) : fk === k)
					out.push({
						path: e.path,
						equipe: t.name,
						equipeId: t.id,
						conflito: f,
						motivo: e.dir
							? 'a pasta engloba um arquivo de outra equipe'
							: 'esse arquivo ja tem dono',
					});
			});
			(t.dirs || []).forEach(function (d) {
				const dk = tmKey(d);
				if (e.dir ? tmIsInside(dk, k) || tmIsInside(k, dk) : tmIsInside(k, dk))
					out.push({
						path: e.path,
						equipe: t.name,
						equipeId: t.id,
						conflito: d,
						motivo: e.dir
							? 'as pastas se sobrepoem'
							: 'esse arquivo esta dentro de uma pasta de outra equipe',
					});
			});
		});
	});
	return out;
}
function tmConflictMsg(conf) {
	return (
		'Nao da para adicionar: ' +
		conf
			.slice(0, 6)
			.map(function (c) {
				return `"${c.path}" (${c.motivo}: "${c.conflito}" e da equipe "${c.equipe}")`;
			})
			.join('; ') +
		(conf.length > 6 ? ` e mais ${conf.length - 6}.` : '') +
		' Um arquivo so pode ter uma equipe dona.'
	);
}
function tmProjSets(alvo) {
	const arquivos = new Set(),
		pastas = new Set();
	try {
		const proj = alvo || (typeof activeProject === 'function' ? activeProject() : null);
		if (proj && proj.files && proj.files.forEach) {
			proj.files.forEach(function (v, fk) {
				const k = tmKey(fk);
				if (!k) return;
				arquivos.add(k);
				const seg = k.split('/');
				for (let i = 1; i < seg.length; i++) pastas.add(seg.slice(0, i).join('/'));
			});
		}
	} catch (e) {
		ignorarErro(e, 'tmProjSets');
	}
	return { arquivos: arquivos, pastas: pastas };
}
function tmParsePaths(lista, alvo) {
	if (typeof lista === 'string') lista = [lista];
	if (lista && !Array.isArray(lista) && typeof lista === 'object' && (lista.path || lista.caminho))
		lista = [lista];
	const ent = [],
		erros = [],
		auto = [];
	const proj = tmProjSets(alvo);
	(Array.isArray(lista) ? lista : []).forEach(function (item) {
		const obj = item && typeof item === 'object';
		const raw = obj ? item.path || item.caminho : item;
		const err = tmPathValid(raw);
		if (err) {
			erros.push({ path: String(raw), erro: err });
			return;
		}
		const p = tmNormPath(raw),
			k = tmKey(p);
		let dir = !!(obj && (item.dir || item.pasta));
		const declarou = obj && ('dir' in item || 'pasta' in item);
		if (!dir && !declarou && !proj.arquivos.has(k) && proj.pastas.has(k)) {
			dir = true;
			auto.push(p);
		}
		if (
			!ent.some(function (x) {
				return tmKey(x.path) === k;
			})
		)
			ent.push({ path: p, dir: dir });
	});
	return { entradas: ent, erros: erros, auto: auto };
}
function tmAvisaAuto(auto) {
	if (auto && auto.length) {
		try {
			registro.info(
				'[Synapse Teams] tratados como PASTA (cobrem tudo que esta dentro): ' + auto.join(', '),
			);
		} catch (e) {
			ignorarErro(e, 'tmAvisaAuto');
		}
	}
}
