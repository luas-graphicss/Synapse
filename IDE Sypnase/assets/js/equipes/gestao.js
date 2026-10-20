'use strict';
function tmTeamCreate(o) {
	o = o || {};
	const nome = String(o.name == null ? '' : o.name).trim();
	if (nome.length < TM_TEAM_LIMITS.nome[0] || nome.length > TM_TEAM_LIMITS.nome[1])
		throw new Error(`O nome da equipe precisa ter de 1 a ${TM_TEAM_LIMITS.nome[1]} caracteres.`);
	if (tmTeam(nome)) throw new Error(`Ja existe uma equipe chamada "${nome}". Escolha outro nome.`);
	if (tmTeams().length >= TM_TEAM_LIMITS.equipes)
		throw new Error(`Limite de ${TM_TEAM_LIMITS.equipes} equipes atingido.`);
	const desc = String(o.desc == null ? '' : o.desc).slice(0, TM_TEAM_LIMITS.desc[1]);
	const projId = tmProjEscopo(o.proj);
	const par = tmParsePaths(o.paths, tmProjById(projId));
	if (par.erros.length)
		throw new Error(
			'Caminho invalido: ' +
				par.erros
					.map(function (e) {
						return e.path + ' (' + e.erro + ')';
					})
					.join('; '),
		);
	if (par.entradas.length > TM_TEAM_LIMITS.caminhos)
		throw new Error(`Limite de ${TM_TEAM_LIMITS.caminhos} caminhos por equipe.`);
	const conf = tmConflicts(par.entradas, null, projId);
	if (conf.length) throw new Error(tmConflictMsg(conf));
	const id = o.id || tmSlug(nome);
	if (TM.teams[id]) throw new Error(`Ja existe uma equipe com o identificador "${id}".`);
	const t = {
		id: id,
		name: nome,
		desc: desc,
		native: o.native || null,
		proj: projId,
		projName: projId ? String(o.projName || tmProjNome(projId)).slice(0, 60) : '',
		caps: Object.assign(tmCaps(), o.caps || {}),
		files: par.entradas
			.filter(function (e) {
				return !e.dir;
			})
			.map(function (e) {
				return e.path;
			}),
		dirs: par.entradas
			.filter(function (e) {
				return e.dir;
			})
			.map(function (e) {
				return e.path;
			}),
		maxAgents: typeof o.maxAgents === 'number' && o.maxAgents > 0 ? o.maxAgents : null,
		allowLeave: false,
		agents: [],
		createdAt: tmNow(),
	};
	TM.teams[id] = t;
	tmTouch();
	tmAvisaAuto(par.auto);
	tmAudit('team-create', {
		id: id,
		nome: nome,
		projeto: t.projName || '(qualquer)',
		arquivos: t.files.length,
		pastas: t.dirs.length,
	});
	return t;
}
function tmTeamDelete(ref) {
	const t = tmTeam(ref);
	if (!t) throw new Error('Equipe nao encontrada: ' + ref);
	if (t.native) throw new Error(`A equipe "${t.name}" e nativa do site e nao pode ser apagada.`);
	delete TM.teams[t.id];
	tmTouch();
	tmAudit('team-delete', { id: t.id, nome: t.name, agentes: t.agents.length });
	return true;
}
function tmTeamRename(ref, novo) {
	const t = tmTeam(ref);
	if (!t) throw new Error('Equipe nao encontrada: ' + ref);
	if (t.native) throw new Error(`A equipe nativa "${t.name}" nao pode ser renomeada.`);
	const nome = String(novo == null ? '' : novo).trim();
	if (nome.length < 1 || nome.length > TM_TEAM_LIMITS.nome[1]) throw new Error('Nome invalido.');
	const outro = tmTeam(nome);
	if (outro && outro.id !== t.id) throw new Error(`Ja existe uma equipe chamada "${nome}".`);
	const antes = t.name;
	t.name = nome;
	tmTouch();
	tmAudit('team-rename', { id: t.id, de: antes, para: nome });
	return t;
}
function tmTeamSetDesc(ref, desc) {
	const t = tmTeam(ref);
	if (!t) throw new Error('Equipe nao encontrada: ' + ref);
	t.desc = String(desc == null ? '' : desc).slice(0, TM_TEAM_LIMITS.desc[1]);
	return t;
}
function tmTeamAllowLeave(ref, on) {
	const t = tmTeam(ref);
	if (!t) throw new Error('Equipe nao encontrada: ' + ref);
	t.allowLeave = !!on;
	tmAudit('team-allow-leave', { id: t.id, nome: t.name, permitido: t.allowLeave });
	return t;
}
function tmPathsAdd(ref, lista) {
	const t = tmTeam(ref);
	if (!t) throw new Error('Equipe nao encontrada: ' + ref);
	const tp = tmTeamProj(t);
	const par = tmParsePaths(lista, tmProjById(tp));
	if (par.erros.length)
		throw new Error(
			'Caminho invalido: ' +
				par.erros
					.map(function (e) {
						return e.path + ' (' + e.erro + ')';
					})
					.join('; '),
		);
	const conf = tmConflicts(par.entradas, t.id, tp);
	if (conf.length) throw new Error(tmConflictMsg(conf));
	const novos = par.entradas.filter(function (e) {
		const k = tmKey(e.path);
		return (
			!t.files.some(function (x) {
				return tmKey(x) === k;
			}) &&
			!t.dirs.some(function (x) {
				return tmKey(x) === k;
			})
		);
	});
	if (t.files.length + t.dirs.length + novos.length > TM_TEAM_LIMITS.caminhos)
		throw new Error(`Limite de ${TM_TEAM_LIMITS.caminhos} caminhos por equipe.`);
	novos.forEach(function (e) {
		(e.dir ? t.dirs : t.files).push(e.path);
	});
	tmTouch();
	tmAvisaAuto(par.auto);
	tmAudit('team-paths-add', { id: t.id, nome: t.name, adicionados: novos.length });
	return t;
}
function tmPathsRemove(ref, lista) {
	const t = tmTeam(ref);
	if (!t) throw new Error('Equipe nao encontrada: ' + ref);
	if (typeof lista === 'string') lista = [lista];
	const alvos = (Array.isArray(lista) ? lista : [lista])
		.map(function (x) {
			return tmKey(x && typeof x === 'object' ? x.path || x.caminho : x);
		})
		.filter(Boolean);
	const achou = {};
	let rm = 0;
	['files', 'dirs'].forEach(function (campo) {
		t[campo] = t[campo].filter(function (p) {
			const k = tmKey(p);
			if (alvos.includes(k)) {
				achou[k] = 1;
				rm++;
				return false;
			}
			return true;
		});
	});
	const faltando = alvos.filter(function (k) {
		return !achou[k];
	});
	tmTouch();
	tmAudit('team-paths-remove', { id: t.id, nome: t.name, removidos: rm, naoEncontrados: faltando });
	if (faltando.length) {
		try {
			registro.aviso(
				`[Synapse Teams] estes caminhos NAO estavam na equipe "${t.name}" (nada foi removido para eles): ${faltando.join(', ')}`,
			);
		} catch (e) {
			ignorarErro(e, 'tmPathsRemove');
		}
	}
	return { equipe: t, removidos: rm, naoEncontrados: faltando };
}
function tmTeamCanWrite(ref, path, proj) {
	const t = tmTeam(ref);
	if (!t)
		return {
			ok: false,
			motivo: 'Voce nao esta em nenhuma equipe. Agente sem equipe nao altera nada no projeto.',
		};
	if (t.caps.plan)
		return {
			ok: false,
			motivo: `A equipe nativa "${t.name}" NAO altera arquivos: ela planeja a arquitetura e divide o sistema \
em prompts para as outras equipes. Entregue o plano ao usuario (ou mande por msg_send); quem grava sao \
as equipes que voce instruir.`,
		};
	if (t.caps.writeAny) return { ok: true, motivo: 'equipe nativa com escrita total' };
	const pr = tmProjEscopo(proj);
	const tp = tmTeamProj(t);
	if (tp && pr && tp !== pr)
		return {
			ok: false,
			motivo: `A equipe "${t.name}" trabalha no projeto "${tmTeamProjNome(t)}", e esta alteracao e no projeto \
"${tmProjNome(pr)}". Cada equipe so altera arquivos do projeto dela. Peca ao usuario (ou ao agente Gerenciador) \
uma equipe para este projeto.`,
		};
	const glob = tmIsGlobal(path, pr);
	if (glob)
		return {
			ok: true,
			motivo: `arquivo GLOBAL ("${glob.path}${glob.dir ? '/' : ''}", definido pelo Gerenciador): todas as equipes podem alterar`,
		};
	const dono = tmOwnerOf(path, pr);
	if (!dono) {
		if (t.caps.writeOwnerless)
			return { ok: true, motivo: 'arquivo sem dono, permitido a esta equipe nativa' };
		return {
			ok: false,
			motivo: `O arquivo "${tmNormPath(path)}" nao pertence a nenhuma equipe e nao esta na lista de arquivos \
globais. Arquivo sem dono so pode ser alterado pelo Gerenciador ou pelo Integrador Revisor. Peca ao \
usuario (ou ao Gerenciador) para incluir esse arquivo na sua equipe, ou para torna-lo global com team_global_add \
se for um arquivo de todos (README, changelog, docs).`,
		};
	}
	if (dono.team.id === t.id) return { ok: true, motivo: `dono por ${dono.regra} ("${dono.alvo}")` };
	return {
		ok: false,
		motivo: `O arquivo "${tmNormPath(path)}" pertence a equipe "${dono.team.name}" (por ${dono.regra}: \
"${dono.alvo}"). Voce pode LER, mas nao alterar. Se precisa dessa mudanca, use a comunicacao entre agentes \
ou peca ao usuario.`,
	};
}
function tmGlobalsAll() {
	if (!TM.globals || typeof TM.globals !== 'object') TM.globals = {};
	return TM.globals;
}
function tmGlobalsSane() {
	const G = tmGlobalsAll();
	const out = {};
	const probl = [];
	Object.keys(G).forEach(function (pid) {
		const L = Array.isArray(G[pid]) ? G[pid] : [];
		const vistos = {},
			limpo = [];
		L.forEach(function (x) {
			let raw = '',
				dir = false;
			if (x && typeof x === 'object') {
				raw = String(x.path == null ? '' : x.path);
				dir = !!x.dir;
			} else {
				raw = String(x == null ? '' : x);
				dir = /\/+$/.test(raw);
			}
			const err = tmPathValid(raw);
			if (err) {
				probl.push(`caminho global descartado: ${raw} (${err})`);
				return;
			}
			const p = tmNormPath(raw),
				k = tmKey(p);
			if (!k || vistos[k]) return;
			vistos[k] = 1;
			limpo.push({ path: p, dir: dir });
		});
		if (limpo.length) out[String(pid)] = limpo.slice(0, TM_TEAM_LIMITS.caminhos);
	});
	TM.globals = out;
	if (probl.length) tmAudit('globais-sane', { problemas: probl.slice(0, 10), total: probl.length });
	return probl;
}
function tmGlobalsDo(proj) {
	const pid = tmProjEscopo(proj) || '';
	const G = tmGlobalsAll();
	const aqui = Array.isArray(G[pid]) ? G[pid] : [];
	const todos = pid && Array.isArray(G['']) ? G[''] : [];
	return aqui.concat(todos);
}
function tmIsGlobal(path, proj) {
	const k = tmKey(path);
	if (!k) return null;
	const L = tmGlobalsDo(proj);
	for (let i = 0; i < L.length; i++) {
		const g = L[i],
			gk = tmKey(g.path);
		if (!gk) continue;
		if (g.dir ? tmIsInside(k, gk) : k === gk) return g;
	}
	return null;
}
function tmGlobalsTxt(proj) {
	const L = tmGlobalsDo(proj);
	if (!L.length) return '(nenhum ainda)';
	const m = L.slice(0, 20).map(function (g) {
		return g.path + (g.dir ? '/ (pasta inteira)' : '');
	});
	return m.join(', ') + (L.length > 20 ? ` e mais ${L.length - 20} caminho(s)` : '');
}
function tmGlobalAdd(lista, proj) {
	const pid = tmProjEscopo(proj) || '';
	const par = tmParsePaths(lista, tmProjById(pid));
	if (par.erros.length)
		throw new Error(
			'Caminho invalido: ' +
				par.erros
					.map(function (e) {
						return e.path + ' (' + e.erro + ')';
					})
					.join('; '),
		);
	if (!par.entradas.length)
		throw new Error(
			'Diga quais caminhos ficam globais: paths:["README.md","docs/"] ou path:"README.md".',
		);
	const conf = tmConflicts(par.entradas, null, pid);
	if (conf.length)
		throw new Error(
			tmConflictMsg(conf) +
				' Arquivo global nao pode ter dono: tire o caminho da equipe com team_remove_files antes de torna-lo global.',
		);
	const G = tmGlobalsAll();
	const L = Array.isArray(G[pid]) ? G[pid] : [];
	const novos = par.entradas.filter(function (e) {
		const k = tmKey(e.path);
		return !L.some(function (g) {
			return tmKey(g.path) === k;
		});
	});
	if (L.length + novos.length > TM_TEAM_LIMITS.caminhos)
		throw new Error(`Limite de ${TM_TEAM_LIMITS.caminhos} caminhos globais por projeto.`);
	novos.forEach(function (e) {
		L.push({ path: e.path, dir: !!e.dir });
	});
	G[pid] = L;
	tmTouch();
	tmAvisaAuto(par.auto);
	tmAudit('globais-add', {
		proj: pid,
		adicionados: novos.map(function (e) {
			return e.path;
		}),
	});
	return { globais: L, adicionados: novos, jaEram: par.entradas.length - novos.length };
}
function tmGlobalRemove(lista, proj) {
	const pid = tmProjEscopo(proj) || '';
	if (typeof lista === 'string') lista = [lista];
	const alvos = (Array.isArray(lista) ? lista : [lista])
		.map(function (x) {
			return tmKey(x && typeof x === 'object' ? x.path || x.caminho : x);
		})
		.filter(Boolean);
	if (!alvos.length)
		throw new Error('Diga quais caminhos deixam de ser globais: paths:["README.md"].');
	const G = tmGlobalsAll();
	const L = Array.isArray(G[pid]) ? G[pid] : [];
	const achou = {};
	const rest = [];
	L.forEach(function (g) {
		const k = tmKey(g.path);
		if (alvos.includes(k)) {
			achou[k] = 1;
			return;
		}
		rest.push(g);
	});
	G[pid] = rest;
	tmTouch();
	const faltando = alvos.filter(function (k) {
		return !achou[k];
	});
	tmAudit('globais-remove', { proj: pid, removidos: Object.keys(achou), naoEncontrados: faltando });
	return { globais: rest, removidos: Object.keys(achou).length, naoEncontrados: faltando };
}
function tmGlobalsSelfCheck() {
	const p = [];
	try {
		const G = tmGlobalsAll();
		Object.keys(G).forEach(function (pid) {
			(G[pid] || []).forEach(function (g) {
				const d = tmOwnerOf(g.path, pid);
				if (d && d.team)
					p.push(
						`caminho global "${g.path}" tambem e da equipe "${d.team.name}": tire de um dos dois`,
					);
			});
		});
	} catch (e) {
		ignorarErro(e, 'tmGlobalsSelfCheck');
	}
	return p.slice(0, 10);
}
function tmEnsureNativeTeams(silencioso) {
	let criadas = 0;
	Object.keys(TM_NATIVE).forEach(function (tipo) {
		const cfg = TM_NATIVE[tipo];
		const existe = tmTeams().filter(function (t) {
			return t.native === tipo;
		})[0];
		if (existe) {
			existe.name = cfg.name;
			existe.caps = Object.assign(tmCaps(), cfg.caps);
			existe.maxAgents = cfg.maxAgents;
			if (!existe.desc) existe.desc = cfg.desc;
			return;
		}
		let id = cfg.id,
			n = 2;
		while (TM.teams[id]) {
			id = cfg.id + '-' + n++;
		}
		TM.teams[id] = {
			id: id,
			name: cfg.name,
			desc: cfg.desc,
			native: tipo,
			caps: Object.assign(tmCaps(), cfg.caps),
			files: [],
			dirs: [],
			maxAgents: cfg.maxAgents,
			allowLeave: false,
			agents: [],
			createdAt: tmNow(),
		};
		criadas++;
	});
	if (criadas) {
		tmTouch();
		if (!silencioso) tmAudit('team-native-ensure', { criadas: criadas });
	}
	return criadas;
}
function tmNativeTeam(tipo) {
	return (
		tmTeams().filter(function (t) {
			return t.native === tipo;
		})[0] || null
	);
}
function tmTeamsSane() {
	const problemas = [],
		limpo = {};
	Object.keys(TM.teams || {}).forEach(function (k) {
		const t = TM.teams[k];
		if (!t || typeof t !== 'object' || typeof t.name !== 'string' || !t.name.trim()) {
			problemas.push('equipe descartada (formato invalido): ' + k);
			return;
		}
		if (!t.id) t.id = String(k);
		t.files = Array.isArray(t.files)
			? t.files
					.filter(function (p) {
						return !tmPathValid(p);
					})
					.map(tmNormPath)
			: [];
		t.dirs = Array.isArray(t.dirs)
			? t.dirs
					.filter(function (p) {
						return !tmPathValid(p);
					})
					.map(tmNormPath)
			: [];
		t.agents = Array.isArray(t.agents) ? t.agents : [];
		t.caps = Object.assign(tmCaps(), t.caps && typeof t.caps === 'object' ? t.caps : {});
		t.allowLeave = !!t.allowLeave;
		t.proj = String(t.proj || '');
		t.projName = String(t.projName || '').slice(0, 60);
		t.native =
			t.native === 'reviewer' || t.native === 'manager' || t.native === 'planner' ? t.native : null;
		t.createdAt = typeof t.createdAt === 'number' && isFinite(t.createdAt) ? t.createdAt : 0;
		if (limpo[t.id]) {
			let novo = t.id + '-2',
				n = 3;
			while (limpo[novo]) {
				novo = t.id + '-' + n++;
			}
			problemas.push(`identificador repetido: "${t.name}" passou a ser "${novo}"`);
			t.id = novo;
		}
		limpo[t.id] = t;
	});
	const ordem = Object.keys(limpo)
		.map(function (k) {
			return limpo[k];
		})
		.sort(function (a, b) {
			return a.createdAt - b.createdAt || String(a.id).localeCompare(String(b.id));
		});
	['reviewer', 'manager', 'planner'].forEach(function (tipo) {
		const cs = ordem.filter(function (t) {
			return t.native === tipo;
		});
		cs.slice(1).forEach(function (t) {
			problemas.push(
				`havia duas equipes nativas do tipo "${tipo}": "${t.name}" virou equipe comum`,
			);
			t.native = null;
			t.caps = tmCaps();
			t.maxAgents = null;
		});
	});
	const nomes = {};
	ordem.forEach(function (t) {
		let n = t.name.trim();
		if (nomes[n.toLowerCase()]) {
			let c = 2,
				novo = n + ' (' + c + ')';
			while (nomes[novo.toLowerCase()]) {
				c++;
				novo = n + ' (' + c + ')';
			}
			problemas.push(`nome repetido: "${n}" passou a ser "${novo}"`);
			n = novo;
		}
		t.name = n;
		nomes[n.toLowerCase()] = 1;
	});
	ordem.forEach(function (t) {
		if (t.native) t.caps = Object.assign(tmCaps(), TM_NATIVE[t.native].caps);
	});
	let total = 0;
	ordem.forEach(function (t) {
		total += t.files.length + t.dirs.length;
	});
	const aceitos = [];
	const pesado = total > TM_TEAM_LIMITS.saneMax;
	const vistos = {};
	ordem.forEach(function (t) {
		['files', 'dirs'].forEach(function (campo) {
			const ehDir = campo === 'dirs';
			t[campo] = t[campo].filter(function (p) {
				const k = tmKey(p);
				if (vistos[k]) {
					if (vistos[k] !== t)
						problemas.push(
							`caminho com dois donos removido de "${t.name}": ${p} (fica com "${vistos[k].name}")`,
						);
					return false;
				}
				if (!pesado) {
					for (let i = 0; i < aceitos.length; i++) {
						const a = aceitos[i];
						if (a.team === t) continue;
						const bate = a.dir
							? ehDir
								? tmIsInside(k, a.key) || tmIsInside(a.key, k)
								: tmIsInside(k, a.key)
							: ehDir
								? tmIsInside(a.key, k)
								: false;
						if (bate) {
							problemas.push(
								`sobreposicao removida de "${t.name}": ${p} (conflita com "${a.path}" da equipe "${a.team.name}")`,
							);
							return false;
						}
					}
				}
				vistos[k] = t;
				aceitos.push({ key: k, path: p, dir: ehDir, team: t });
				return true;
			});
		});
	});
	if (pesado)
		problemas.push(
			`muitos caminhos (${total}): a verificacao de pasta sobreposta foi pulada para nao travar a aba`,
		);
	TM.teams = limpo;
	tmTouch();
	if (problemas.length)
		tmAudit('teams-sane', { problemas: problemas.slice(0, 10), total: problemas.length });
	return problemas;
}
function tmTeamsSelfCheck() {
	const p = [];
	if (!tmNativeTeam('reviewer') || !tmNativeTeam('manager') || !tmNativeTeam('planner'))
		tmEnsureNativeTeams(true);
	if (!tmNativeTeam('reviewer'))
		p.push('equipe nativa Integrador Revisor ausente mesmo apos recriar');
	if (!tmNativeTeam('manager')) p.push('equipe nativa Gerenciador ausente mesmo apos recriar');
	if (!tmNativeTeam('planner'))
		p.push('equipe nativa Planejador / Divisor ausente mesmo apos recriar');
	const r = tmNativeTeam('reviewer');
	if (r && !r.caps.writeAny)
		p.push('Integrador Revisor precisa poder escrever (decisao 3 do usuario)');
	const g = tmNativeTeam('manager');
	if (g && !g.caps.manageTeams) p.push('Gerenciador precisa poder administrar equipes');
	const pl = tmNativeTeam('planner');
	if (pl && !pl.caps.plan) p.push('Planejador / Divisor precisa ter a capacidade de planejar');
	if (pl && (pl.caps.writeAny || pl.caps.writeOwnerless))
		p.push('Planejador / Divisor nao pode ter permissao de escrita (ele so planeja e divide)');
	try {
		(tmGlobalsSelfCheck() || []).forEach(function (x) {
			p.push(x);
		});
	} catch (e) {
		ignorarErro(e, 'tmTeamsSelfCheck');
	}
	['reviewer', 'manager', 'planner'].forEach(function (tipo) {
		if (
			tmTeams().filter(function (t) {
				return t.native === tipo;
			}).length > 1
		)
			p.push(`existe mais de uma equipe nativa do tipo "${tipo}"`);
	});
	const nomes = {},
		ids = {};
	let total = 0;
	tmTeams().forEach(function (t) {
		if (!t.id || !t.name) p.push('equipe sem id ou nome');
		const n = String(t.name).toLowerCase();
		if (nomes[n]) p.push(`duas equipes com o mesmo nome: "${t.name}"`);
		nomes[n] = 1;
		if (ids[t.id]) p.push(`duas equipes com o mesmo identificador: "${t.id}"`);
		ids[t.id] = 1;
		if (t.maxAgents && t.agents.length > t.maxAgents)
			p.push(`equipe "${t.name}" tem mais agentes que o limite`);
		total += t.files.length + t.dirs.length;
	});
	if (total <= TM_TEAM_LIMITS.saneMax) {
		tmTeams().forEach(function (t) {
			const ent = t.files
				.map(function (x) {
					return { path: x, dir: false };
				})
				.concat(
					t.dirs.map(function (x) {
						return { path: x, dir: true };
					}),
				);
			tmConflicts(ent, t.id).forEach(function (c) {
				p.push(
					`sobreposicao de posse: "${c.path}" (equipe "${t.name}") x "${c.conflito}" (equipe "${c.equipe}")`,
				);
			});
		});
	}
	return p
		.filter(function (x, i) {
			return p.indexOf(x) === i;
		})
		.slice(0, 20);
}
function tmTeamsReport() {
	return tmTeams().map(function (t) {
		return {
			equipe: t.name,
			tipo: t.native || 'sua',
			agentes: t.agents.length + (t.maxAgents ? '/' + t.maxAgents : ''),
			arquivos: t.files.length,
			pastas: t.dirs.length,
			podeSair: t.allowLeave ? 'sim' : 'nao',
		};
	});
}
function tmModoValido(m) {
	return m === 'auto' || m === 'on' || m === 'shadow' || m === 'off';
}
function tmAgSave() {
	try {
		if (typeof saveSession === 'function') saveSession();
	} catch (e) {
		ignorarErro(e, 'tmAgSave');
	}
}
function tmAgNome(n) {
	return String(n == null ? '' : n)
		.trim()
		.slice(0, 40);
}
function tmAgKey(n) {
	return tmAgNome(n).toLowerCase();
}
function tmAgents() {
	if (!TM.agents || typeof TM.agents !== 'object' || Array.isArray(TM.agents)) TM.agents = {};
	return TM.agents;
}
function tmAgentList() {
	const A = tmAgents();
	return Object.keys(A)
		.map(function (k) {
			return A[k];
		})
		.filter(Boolean);
}
function tmAgent(nome) {
	const k = tmAgKey(nome);
	return k ? tmAgents()[k] || null : null;
}
function tmAgentTeam(nome) {
	const a = tmAgent(nome);
	if (!a || !a.teamId) return null;
	return TM.teams[a.teamId] || null;
}
const TM_AGENT_MAX = 500;
