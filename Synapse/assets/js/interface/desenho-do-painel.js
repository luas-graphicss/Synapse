'use strict';
function tmUIRender() {
	if (TMUI.rendering) return;
	const body = tmUIEl('tmuiBody');
	if (!body) return;
	TMUI.rendering = true;
	try {
		if (TMUI.view === 'alist') body.innerHTML = tmUIAlistHtml();
		else if (TMUI.view === 'criar' || TMUI.view === 'addpaths') body.innerHTML = tmUICriarHtml();
		else if (TMUI.view === 'detalhe') body.innerHTML = tmUIDetalheHtml();
		else body.innerHTML = tmUIListaHtml();
	} catch (e) {
		body.innerHTML = `<div class="tmui-erro">A tela de equipes falhou ao desenhar: ${tmUIEsc(String((e && e.message) || e))}. \
Suas equipes NAO foram alteradas - use TM_TEAMS.lista() no console enquanto isso.</div>`;
		try {
			tmAudit('ui-erro', { onde: TMUI.view, erro: String((e && e.message) || e) });
		} catch (e2) {
			ignorarErro(e2, 'tmUIRender');
		}
	} finally {
		TMUI.rendering = false;
	}
}

function tmUIIr(view, teamId) {
	const antes = TMUI.view,
		antesId = TMUI.teamId;
	TMUI.view = view || 'lista';
	if (teamId !== undefined) TMUI.teamId = teamId;
	const form = TMUI.view === 'criar' || TMUI.view === 'addpaths';
	const mesmaTela = antes === TMUI.view && String(antesId) === String(TMUI.teamId);
	if (form && !mesmaTela) {
		TMUI.sel = {};
		TMUI.busca = '';
		TMUI.erro = '';
		TMUI.nome = '';
		TMUI.desc = '';
	}
	tmUIRender();
}
function tmUIErro(msg) {
	TMUI.erro = String(msg || '');
	const e = tmUIEl('tmuiErro');
	if (e) {
		e.textContent = TMUI.erro;
		e.classList.toggle('hidden', !TMUI.erro);
	} else tmUIRender();
}

async function tmUIAcao(alvo) {
	const id = alvo.id || '';
	if (id === 'tmuiNova') {
		tmUIIr('criar', null);
		return;
	}
	if (id === 'tmuiAlist') {
		tmUIIr('alist', null);
		return;
	}
	if (id === 'tmuiVoltar' || id === 'tmuiCancelar') {
		TMUI.sel = {};
		TMUI.busca = '';
		TMUI.erro = '';
		TMUI.nome = '';
		TMUI.desc = '';
		if (TMUI.view === 'addpaths') tmUIIr('detalhe', TMUI.teamId);
		else tmUIIr('lista', null);
		return;
	}
	if (id === 'tmuiAddPaths') {
		tmUIIr('addpaths', TMUI.teamId);
		return;
	}

	if (id === 'tmuiConcluir') {
		const paths = Object.keys(TMUI.sel).map(function (p) {
			return { path: p, dir: !!TMUI.sel[p].dir };
		});
		if (TMUI.view === 'addpaths') {
			if (!paths.length) {
				tmUIErro('Marque pelo menos um arquivo ou pasta para adicionar.');
				return;
			}
			try {
				tmPathsAdd(TMUI.teamId, paths);
			} catch (e) {
				tmUIErro(String((e && e.message) || e));
				return;
			}
			tmAgSave();
			tmUIToast('Arquivos adicionados', paths.length + ' caminho(s) agora sao desta equipe', 'ok');
			TMUI.sel = {};
			TMUI.busca = '';
			tmUIIr('detalhe', TMUI.teamId);
			return;
		}
		const nome = (tmUIEl('tmuiNome') || {}).value || TMUI.nome || '';
		const desc = (tmUIEl('tmuiDesc') || {}).value || TMUI.desc || '';
		if (!String(nome).trim()) {
			tmUIErro('De um nome a equipe (ex.: Fisica, Runtime, Interface).');
			return;
		}
		let t = null;
		const _p = (function () {
			try {
				return typeof activeProject === 'function' ? activeProject() : null;
			} catch (e) {
				return null;
			}
		})();
		try {
			t = tmTeamCreate({
				name: nome,
				desc: desc,
				paths: paths,
				proj: _p ? _p.id : '',
				projName: _p ? _p.name : '',
			});
		} catch (e) {
			tmUIErro(String((e && e.message) || e));
			return;
		}
		tmAgSave();
		tmUIToast(
			'Equipe criada',
			t.name + (paths.length ? ` - ${paths.length} caminho(s)` : ' - sem arquivos ainda'),
			'ok',
		);
		TMUI.sel = {};
		TMUI.busca = '';
		TMUI.nome = '';
		TMUI.desc = '';
		tmUIIr('detalhe', t.id);
		return;
	}

	if (id === 'tmuiApagar') {
		const t = (function () {
			try {
				return tmTeam(TMUI.teamId);
			} catch (e) {
				return null;
			}
		})();
		if (!t) return;
		let okc = true;
		try {
			if (typeof uiConfirm === 'function')
				okc = await uiConfirm(
					`Apagar a equipe "${t.name}"?`,
					`Os ${t.agents.length} agente(s) dela ficam sem equipe e param de poder alterar arquivos. Os arquivos em si nao sao apagados.`,
					'Apagar equipe',
					true,
				);
		} catch (e) {
			ignorarErro(e, 'tmUIAcao');
		}
		if (!okc) return;
		try {
			tmTeamDelete(t.id);
		} catch (e) {
			tmUIToast('Nao deu para apagar', String((e && e.message) || e), 'err');
			return;
		}
		try {
			tmAgentsSync();
		} catch (e) {
			ignorarErro(e, 'tmUIAcao');
		}
		tmAgSave();
		tmUIToast('Equipe apagada', t.name, 'ok');
		tmUIIr('lista', null);
		return;
	}
}

async function tmUIClique(ev) {
	const body = tmUIEl('tmuiBody');
	if (!body) return;
	const alvo = ev.target;

	const item = alvo.closest ? alvo.closest('[data-team]') : null;
	if (item && body.contains(item)) {
		tmUIIr('detalhe', item.getAttribute('data-team'));
		return;
	}

	const rmag = alvo.closest ? alvo.closest('[data-rmag]') : null;
	if (rmag && body.contains(rmag)) {
		const nome = rmag.getAttribute('data-rmag');
		let okc = true;
		try {
			if (typeof uiConfirm === 'function')
				okc = await uiConfirm(
					`Remover o agente "${nome}"?`,
					'Ele sai da equipe, solta as travas que estiver segurando e para de poder alterar arquivos ate entrar em alguma equipe de novo.',
					'Remover agente',
					true,
				);
		} catch (e) {
			ignorarErro(e, 'tmUIClique');
		}
		if (!okc) return;
		try {
			tmAgentRemove(nome);
		} catch (e) {
			tmUIToast('Nao deu para remover', String((e && e.message) || e), 'err');
			return;
		}
		tmUIToast('Agente removido', nome, 'ok');
		tmUIRender();
		return;
	}

	const rmp = alvo.closest ? alvo.closest('[data-rmpath]') : null;
	if (rmp && body.contains(rmp)) {
		const p = rmp.getAttribute('data-rmpath');
		try {
			tmPathsRemove(TMUI.teamId, [p]);
		} catch (e) {
			tmUIToast('Nao deu para tirar', String((e && e.message) || e), 'err');
			return;
		}
		tmAgSave();
		tmUIToast('Caminho removido', p + ' - esta equipe nao altera mais esse caminho', 'ok');
		tmUIRender();
		return;
	}

	const btn = alvo.closest ? alvo.closest('button') : null;
	if (btn && btn.id && body.contains(btn)) await tmUIAcao(btn);
}

function tmUIMudou(ev) {
	const alvo = ev.target;
	if (!alvo) return;
	if (alvo.id === 'tmuiSaida') {
		try {
			tmTeamAllowLeave(TMUI.teamId, alvo.checked);
			tmAgSave();
			tmUIToast(
				alvo.checked ? 'Saida liberada' : 'Saida bloqueada',
				alvo.checked
					? 'O agente pode sair desta equipe com team_leave'
					: 'Quem entrar nesta equipe fica ate voce liberar',
				'ok',
			);
		} catch (e) {
			tmUIToast('Nao deu para mudar', String((e && e.message) || e), 'err');
		}
		tmUIRender();
		return;
	}
	if (
		alvo.id === 'tmuiAlistOn' ||
		alvo.id === 'tmuiAlistNat' ||
		alvo.id === 'tmuiAlistProj' ||
		alvo.id === 'tmuiAlistUni' ||
		alvo.id === 'tmuiAlistQtd' ||
		alvo.id === 'tmuiAlistPre'
	) {
		tmUIAlistSalvar(false);
		return;
	}
	const pick = alvo.getAttribute ? alvo.getAttribute('data-pick') : null;
	if (pick != null) {
		const dir = alvo.getAttribute('data-dir') === '1';
		if (alvo.checked) {
			TMUI.sel[pick] = { dir: dir };
			if (dir) tmUIPodaSel();
		} else delete TMUI.sel[pick];
		TMUI.erro = '';
		tmUIRenderPicker();
		return;
	}
}
function tmUIDigitou(ev) {
	const a = ev.target;
	if (!a) return;
	if (a.id === 'tmuiBusca') {
		TMUI.busca = a.value || '';
		tmUIRenderPicker();
		return;
	}
	if (a.id === 'tmuiAlistQtd' || a.id === 'tmuiAlistPre') {
		tmUIAlistSalvar(true);
		return;
	}
	if (a.id === 'tmuiNome') {
		TMUI.nome = a.value || '';
		return;
	}
	if (a.id === 'tmuiDesc') {
		TMUI.desc = a.value || '';
		return;
	}
}

function tmUIWire() {
	const btn = tmUIEl('teamsBtn'),
		menu = tmUIEl('teamsMenu');
	if (!btn || !menu) return false;
	btn.innerHTML = `<svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" \
stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 20v-2a4 4 0 0 0-4-4H5a4 \
4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 20v-2a4 4 0 0 0-3-3.87"></path>\
<path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`;
	btn.addEventListener('click', function (e) {
		e.stopPropagation();
		const abrindo = !menu.classList.contains('open');
		menu.classList.toggle('open', abrindo);
		TMUI.open = abrindo;
		if (abrindo) {
			try {
				tmEnsureNativeTeams(true);
			} catch (e2) {
				ignorarErro(e2, 'tmUIWire');
			}
			const v =
				TMUI.view === 'criar' ||
				TMUI.view === 'addpaths' ||
				TMUI.view === 'detalhe' ||
				TMUI.view === 'alist'
					? TMUI.view
					: 'lista';
			tmUIIr(v, TMUI.teamId);
		}
	});
	document.addEventListener('click', function () {
		menu.classList.remove('open');
		TMUI.open = false;
	});
	menu.addEventListener('click', function (e) {
		e.stopPropagation();
	});
	document.addEventListener('keydown', function (e) {
		if (e.key === 'Escape' && TMUI.open) {
			menu.classList.remove('open');
			TMUI.open = false;
		}
	});
	const body = tmUIEl('tmuiBody');
	if (body) {
		body.addEventListener('click', function (e) {
			tmUIClique(e);
		});
		body.addEventListener('change', tmUIMudou);
		body.addEventListener('input', tmUIDigitou);
	}
	tmUIRender();
	tmUITickOn();
	return true;
}

function tmUITickOn() {
	try {
		if (TMUI.timer) clearInterval(TMUI.timer);
	} catch (e) {
		ignorarErro(e, 'tmUITickOn');
	}
	try {
		TMUI.timer = setInterval(function () {
			if (!TMUI.open) return;
			if (TMUI.view === 'criar' || TMUI.view === 'addpaths') return;
			tmUIRenderIdle();
		}, 2000);
	} catch (e) {
		ignorarErro(e, 'tmUITickOn');
	}
}

function tmUISelfCheck() {
	const p = [];
	try {
		if (!tmUIEl('teamsBtn')) p.push('o botao de Equipes sumiu da barra de cima');
		if (!tmUIEl('teamsMenu')) p.push('o painel de Equipes nao existe no HTML');
		if (!tmUIEl('tmuiBody')) p.push('o corpo do painel de Equipes nao existe');
		if (!String(tmUIAcao).includes('tmTeamCreate'))
			p.push('a tela nao usa mais tmTeamCreate: a UI pode estar criando equipe por fora do motor');
		if (!String(tmUIAcao).includes('tmPathsAdd')) p.push('a tela nao usa mais tmPathsAdd');
		if (!String(tmUIClique).includes('tmAgentRemove')) p.push('a tela nao usa mais tmAgentRemove');
		if (!String(tmUIMudou).includes('tmTeamAllowLeave'))
			p.push('a tela nao usa mais tmTeamAllowLeave');
		if (!String(tmUIAlistSalvar).includes('tmEnlSane'))
			p.push('a tela de alistamento nao usa mais tmEnlSane: pode estar salvando regra invalida');
		if (
			Object.keys(TMUI.sel).some(function (x) {
				return !!tmUICobertoPorPasta(x);
			})
		)
			p.push('a selecao da tela tem caminho ja coberto por uma pasta marcada');
	} catch (e) {
		p.push('autodiagnostico da tela quebrou: ' + String((e && e.message) || e));
	}
	if (p.length) {
		try {
			tmAudit('selfcheck-fail', { parte: 'ui', problemas: p.slice(0, 8) });
		} catch (e) {
			ignorarErro(e, 'tmUISelfCheck');
		}
	}
	return p;
}

try {
	window.TM_UI = TMUI;
} catch (e) {
	ignorarErro(e, 'desenho-do-painel');
}
if (typeof document !== 'undefined') {
	if (document.readyState === 'loading')
		document.addEventListener('DOMContentLoaded', function () {
			try {
				tmUIWire();
			} catch (e) {
				ignorarErro(e, 'desenho-do-painel');
			}
		});
	else {
		try {
			tmUIWire();
		} catch (e) {
			ignorarErro(e, 'desenho-do-painel');
		}
	}
}

const TM_REVIEW_LIMITS = {
	arquivos: 200,
	nota: 600,
	parecer: 4000,
	problemas: 40,
	historico: 200,
	grafoMax: 4000,
	cacheMs: 4000,
	refsMax: 500,
	texto: 400000,
	quebradosMax: 200,
	stampChars: 2000000,
};
const TM_REVIEW_STATUS = { aberto: 1, aprovado: 1, reprovado: 1, cancelado: 1 };

function tmReviews() {
	if (!Array.isArray(TM.reviews)) TM.reviews = [];
	return TM.reviews;
}
function tmReviewNum() {
	let n = 0;
	tmReviews().forEach(function (r) {
		if ((r.num | 0) > n) n = r.num | 0;
	});
	return n + 1;
}
function tmReviewId() {
	return `rev-${tmNow().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function tmReviewFind(id) {
	const s = String(id == null ? '' : id)
		.trim()
		.toLowerCase()
		.replace(/^#/, '');
	if (!s) return null;
	const L = tmReviews();
	for (let i = L.length - 1; i >= 0; i--) {
		const r = L[i];
		if (String(r.id).toLowerCase() === s || String(r.num) === s) return r;
	}
	return null;
}
function tmReviewsAbertos() {
	return tmReviews().filter(function (r) {
		return r.status === 'aberto';
	});
}

function tmReviewsSane() {
	const problemas = [],
		vistos = {},
		bons = [];
	const lim =
		typeof TM_REVIEW_LIMITS !== 'undefined'
			? TM_REVIEW_LIMITS
			: { arquivos: 200, historico: 200, parecer: 4000, nota: 600 };
	tmReviews().forEach(function (r) {
		if (!r || typeof r !== 'object' || !r.id || !Array.isArray(r.files)) {
			problemas.push('pedido de revisao descartado (formato invalido)');
			return;
		}
		r.id = String(r.id);
		if (vistos[r.id.toLowerCase()]) {
			problemas.push('pedido com identificador repetido descartado: ' + r.id);
			return;
		}
		if (!TM_REVIEW_STATUS[r.status]) {
			problemas.push(`pedido "${r.id}" com situacao invalida virou "aberto"`);
			r.status = 'aberto';
		}
		const limpos = [],
			dupe = {};
		r.files.forEach(function (p) {
			const n = tmNormPath(p);
			if (!n || tmPathValid(n)) return;
			const k = n.toLowerCase();
			if (dupe[k]) return;
			dupe[k] = 1;
			limpos.push(n);
		});
		if (limpos.length > lim.arquivos) limpos.length = lim.arquivos;
		r.files = limpos;
		if (!r.files.length) {
			problemas.push(`pedido "${r.id}" descartado: ficou sem arquivo valido`);
			return;
		}
		r.num = typeof r.num === 'number' && r.num > 0 ? r.num : bons.length + 1;
		r.at = typeof r.at === 'number' && isFinite(r.at) ? r.at : tmNow();
		r.by = String(r.by || '').slice(0, 40);
		r.teamName = String(r.teamName || '').slice(0, 60);
		r.projName = String(r.projName || '').slice(0, 60);
		r.proj = String(r.proj || '');
		r.nota = String(r.nota || '').slice(0, lim.nota);
		r.parecer = String(r.parecer || '').slice(0, lim.parecer);
		r.reviewer = String(r.reviewer || '').slice(0, 40);
		r.decidedAt = typeof r.decidedAt === 'number' && isFinite(r.decidedAt) ? r.decidedAt : 0;
		if (r.status !== 'aberto' && !r.decidedAt) r.decidedAt = r.at;
		r.problemas = Array.isArray(r.problemas)
			? r.problemas
					.map(function (x) {
						return String(x).slice(0, 300);
					})
					.slice(0, lim.problemas || 40)
			: [];
		vistos[r.id.toLowerCase()] = 1;
		bons.push(r);
	});
	bons.sort(function (a, b) {
		return a.at - b.at || a.num - b.num;
	});
	const numUsado = {};
	let maiorNum = 0;
	bons.forEach(function (r) {
		if (r.num > maiorNum) maiorNum = r.num;
	});
	bons.forEach(function (r) {
		if (numUsado[r.num]) {
			const velho = r.num;
			r.num = ++maiorNum;
			problemas.push(`pedido "${r.id}" tinha o numero #${velho} repetido: virou #${r.num}`);
		}
		numUsado[r.num] = 1;
	});
	const sobra = bons.length - (lim.historico || 200);
	if (sobra > 0) {
		let podar = sobra;
		for (let i = 0; i < bons.length && podar > 0; i++) {
			if (bons[i].status !== 'aberto') {
				bons[i].__podar = 1;
				podar--;
			}
		}
		const antes = bons.length;
		for (let i = bons.length - 1; i >= 0; i--) {
			if (bons[i].__podar) bons.splice(i, 1);
		}
		if (antes !== bons.length)
			problemas.push(
				`historico de revisoes podado: ${antes - bons.length} pedido(s) ja decidido(s) saiu(ram)`,
			);
	}
	TM.reviews = bons;
	if (problemas.length)
		tmAudit('reviews-sane', { problemas: problemas.slice(0, 10), total: problemas.length });
	return problemas;
}

const TM_DEP_RE_CODE =
	/(?:^|[^\w$.])(?:import\s+[^'";]*?from\s*|import\s*\(\s*|export\s+[^'";]*?from\s*|require\s*\(\s*)["']([^"']+)["']/g;
const TM_DEP_RE_BARE = /^[ \t]*import\s+["']([^"']+)["']/gm;
const TM_DEP_RE_CSS = /@import\s+(?:url\()?\s*["']([^"']+)["']|url\(\s*["']?([^"')]+)["']?\s*\)/g;
const TM_DEP_RE_HTML = /(?:src|href)\s*=\s*["']([^"']+)["']/g;

function tmDepTipo(path) {
	const m = String(path || '')
		.toLowerCase()
		.match(/\.([a-z0-9]+)$/);
	const e = m ? m[1] : '';
	if (e === 'css' || e === 'scss' || e === 'less') return 'css';
	if (e === 'html' || e === 'htm') return 'html';
	if (['js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'vue', 'svelte'].includes(e)) return 'code';
	return '';
}

function tmDepRefs(path, texto) {
	const out = [],
		vistos = {};
	if (typeof texto !== 'string' || !texto) return out;
	const t = texto.length > TM_REVIEW_LIMITS.texto ? texto.slice(0, TM_REVIEW_LIMITS.texto) : texto;
	const tipo = tmDepTipo(path);
	if (!tipo) return out;
	const add = function (s) {
		if (typeof s !== 'string') return;
		const v = s.trim();
		if (!v || vistos[v] || out.length >= TM_REVIEW_LIMITS.refsMax) return;
		vistos[v] = 1;
		out.push(v);
	};
	const varrer = function (re, a, b) {
		re.lastIndex = 0;
		let m,
			guarda = 0;
		while ((m = re.exec(t)) && guarda++ < 5000) add(m[a] || (b ? m[b] : ''));
	};
	if (tipo === 'css') {
		varrer(TM_DEP_RE_CSS, 1, 2);
		return out;
	}
	if (tipo === 'html') {
		varrer(TM_DEP_RE_HTML, 1);
		varrer(TM_DEP_RE_CODE, 1);
		return out;
	}
	varrer(TM_DEP_RE_CODE, 1);
	varrer(TM_DEP_RE_BARE, 1);
	return out;
}

function tmDepExterna(spec, tipo) {
	const s = String(spec || '');
	if (/^(https?:|data:|blob:|mailto:|tel:|javascript:|#|\/\/)/i.test(s)) return true;
	if (tipo === 'html' || tipo === 'css') return false;
	return !/^[.\/]/.test(s);
}

const TM_DEP_TENTA = [
	'',
	'.js',
	'.mjs',
	'.cjs',
	'.jsx',
	'.ts',
	'.tsx',
	'.json',
	'.css',
	'.html',
	'/index.js',
	'/index.mjs',
	'/index.jsx',
	'/index.ts',
	'/index.tsx',
	'/index.html',
];

function tmDepResolve(idx, de, spec) {
	let s = String(spec || '')
		.split('?')[0]
		.split('#')[0]
		.trim();
	if (!s || tmDepExterna(s, tmDepTipo(de))) return null;
	let base;
	if (s.charAt(0) === '/') base = s.replace(/^\/+/, '');
	else {
		const corte = de.lastIndexOf('/');
		base = (corte >= 0 ? de.slice(0, corte) + '/' : '') + s;
	}
	const partes = [];
	base.split('/').forEach(function (p) {
		if (!p || p === '.') return;
		if (p === '..') {
			partes.pop();
			return;
		}
		partes.push(p);
	});
	base = partes.join('/');
	if (!base) return null;
	for (let i = 0; i < TM_DEP_TENTA.length; i++) {
		const real = idx[(base + TM_DEP_TENTA[i]).toLowerCase()];
		if (real) return { path: real };
	}
	return { faltando: base };
}

function tmDepStamp(proj) {
	let n = 0,
		s = 0,
		h = 0,
		exato = 1,
		orc = TM_REVIEW_LIMITS.stampChars || 2000000;
	try {
		proj.files.forEach(function (f, k) {
			n++;
			const len = f && typeof f.text === 'string' ? f.text.length : 0;
			s += len;
			const nome = String(k);
			let x = (len ^ 0x9e3779b9) >>> 0;
			for (let i = 0; i < nome.length; i++) x = Math.imul(x ^ nome.charCodeAt(i), 16777619) >>> 0;
			if (len) {
				const t = f.text;
				if (len <= orc) {
					orc -= len;
					for (let i = 0; i < len; i++) x = Math.imul(x ^ t.charCodeAt(i), 16777619) >>> 0;
				} else {
					exato = 0;
					const passo = Math.max(1, Math.floor(len / 64));
					for (let i = 0; i < len; i += passo) x = Math.imul(x ^ t.charCodeAt(i), 16777619) >>> 0;
					x = Math.imul(x ^ (t.charCodeAt(len - 1) | 0), 16777619) >>> 0;
				}
			}
			h = (h + Math.imul(x, 2654435761)) >>> 0;
		});
	} catch (e) {
		ignorarErro(e, 'tmDepStamp');
	}
	return n + ':' + s + ':' + h.toString(36) + (exato ? ':x' : ':a');
}
function tmDepIndex(proj) {
	const idx = {};
	try {
		proj.files.forEach(function (f, k) {
			idx[String(k).toLowerCase()] = String(k);
		});
	} catch (e) {
		ignorarErro(e, 'tmDepIndex');
	}
	return idx;
}
