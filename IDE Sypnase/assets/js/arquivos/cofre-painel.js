(function (root) {
	'use strict';
	if (root.SynapseCofrePainel || root.SynapsePreviewSession) return;

	const NUDGE_KEY = 'aurora.cofre.aviso';
	const NUDGE_MS = 3 * 24 * 3600 * 1000;
	let css = false;

	function g(nome) {
		return root[nome];
	}
	function esc(s) {
		const f = g('esc');
		return typeof f === 'function' ? f(s == null ? '' : String(s)) : String(s == null ? '' : s);
	}
	function relTime(t) {
		const f = g('relTime');
		try {
			return typeof f === 'function' ? f(t) : new Date(t).toLocaleString('pt-BR');
		} catch (e) {
			return '';
		}
	}
	function fmtB(n) {
		const f = g('fmtB');
		return typeof f === 'function' ? f(n || 0) : String(n || 0) + ' B';
	}
	function hhmm(t) {
		if (!t) return 'nunca';
		try {
			return new Date(t).toLocaleTimeString('pt-BR');
		} catch (e) {
			return String(t);
		}
	}
	function toast(a, b, c) {
		const f = g('toast');
		if (typeof f === 'function') f(a, b, c);
	}
	function ignorar(e, ctx) {
		if (typeof root.ignorarErro === 'function') root.ignorarErro(e, ctx);
	}
	function FX() {
		return root.AURORA_PERSIST || null;
	}
	function disco() {
		return root.SynapseCofreDisco || null;
	}
	function store() {
		return root.SynapseSessionStore || null;
	}
	function abertos() {
		const S = root.State;
		return new Set(((S && S.projects) || []).map((p) => String(p.id)));
	}

	function cssOnce() {
		if (css) return;
		css = true;
		const st = document.createElement('style');
		st.textContent =
			'.rec-kv{display:flex;flex-direction:column;gap:4px}.rec-kv .rec-row{margin:0}' +
			'.rec-ok{color:#3fb97f}.rec-bad{color:#e5484d}.rec-warn{color:#e6b455}' +
			'.rec-row .rec-acts{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}' +
			'.rec-alert-box{border:1px solid rgba(229,72,77,.5);background:rgba(229,72,77,.08);border-radius:4px;padding:8px 10px;font-size:12px;line-height:1.5}' +
			'.rec-warn-box{border:1px solid rgba(230,180,85,.5);background:rgba(230,180,85,.08);border-radius:4px;padding:8px 10px;font-size:12px;line-height:1.5}' +
			'#recentBtn{position:relative}#recentBtn.rec-storage-warn::after{content:"";position:absolute;top:-3px;right:-3px;width:9px;height:9px;border-radius:50%;background:#e6b455;box-shadow:0 0 0 2px var(--bg-2,#111)}' +
			'#recentBtn.rec-storage-bad::after{background:#e5484d}';
		document.head.appendChild(st);
	}

	function botao(op, label, attrs) {
		return (
			'<button class="rec-btn" data-op="' +
			esc(op) +
			'"' +
			(attrs || '') +
			'>' +
			esc(label) +
			'</button>'
		);
	}

	function secaoSaude() {
		cssOnce();
		const fx = FX();
		const d = disco();
		const de = d ? d.estado() : null;
		let html = '<div class="rec-sec"><span class="rec-t">Saude do armazenamento</span><div class="rec-kv">';

		const M = root.SynapseCofreManifesto;
		const perda = M && root.localStorage ? M.readLoss(root.localStorage) : null;
		if (perda && perda.texto)
			html +=
				'<div class="rec-alert-box">' +
				esc(perda.texto) +
				'<div class="rec-acts" style="margin-top:6px">' +
				botao('cofre:perda-ok', 'Dispensar este aviso') +
				'</div></div>';

		if (fx && fx.wipeAttempt)
			html +=
				'<div class="rec-alert-box"><span>Algo tentou APAGAR o armazenamento da IDE as</span> ' +
				esc(hhmm(fx.wipeAttempt.t)) +
				' <span>(origem:</span> <span>' +
				esc(fx.wipeAttempt.origem) +
				'</span>). <span>A exclusao esta bloqueada enquanto esta aba estiver aberta. Garanta um backup agora.</span></div>';
		if (fx && fx.bootUnverified)
			html +=
				'<div class="rec-warn-box">O indice da sessao nao pode ser lido quando a aba abriu; nada esta sendo gravado nesta aba. Recarregue a pagina.</div>';

		const persist = fx ? fx.persisted : null;
		html +=
			'<div class="rec-row"><span class="rec-n">Armazenamento persistente</span><span class="rec-m ' +
			(persist === true ? 'rec-ok' : persist === false ? 'rec-bad' : '') +
			'">' +
			(persist === true
				? 'concedido pelo navegador'
				: persist === false
					? 'NAO concedido: o navegador pode despejar os dados'
					: 'desconhecido') +
			'</span>' +
			(persist === true ? '' : botao('cofre:persistir', 'Pedir ao navegador')) +
			'</div>';

		if (fx)
			html +=
				'<div class="rec-row"><span class="rec-n">Ultima gravacao confirmada</span><span class="rec-m"><span>' +
				esc(hhmm(fx.lastOk)) +
				'</span> · <span>revisao ' +
				esc(fx.rev) +
				'</span>' +
				(fx.lastBytes ? ' · ' + esc(fmtB(fx.lastBytes)) : '') +
				(fx.quota ? ' · <span>cota</span> ' + esc(fmtB(fx.usage)) + ' / ' + esc(fmtB(fx.quota)) : '') +
				(fx.pending && fx.pending() ? ' · <span class="rec-warn">alteracoes pendentes</span>' : '') +
				'</span></div>';

		if (!d || !de || !de.suportado)
			html +=
				'<div class="rec-row"><span class="rec-n">Pasta de backup no disco</span><span class="rec-m">nao suportada neste navegador (Chrome/Edge no computador)</span>' +
				botao('cofre:exportar', 'Exportar .zip') +
				'</div>';
		else if (!de.vinculada)
			html +=
				'<div class="rec-row"><span class="rec-n">Pasta de backup no disco</span><span class="rec-m rec-warn">nenhuma pasta vinculada</span>' +
				botao('cofre:vincular', 'Escolher pasta...') +
				'</div>' +
				'<div class="rec-note">Com uma pasta vinculada, cada projeto vira uma subpasta real no seu computador, atualizada em segundo plano a cada gravacao. Se o navegador apagar os dados do site, nada se perde.</div>';
		else
			html +=
				'<div class="rec-row"><span class="rec-n">Pasta de backup: ' +
				esc(de.nome) +
				'</span><span class="rec-m ' +
				(de.permissao === 'granted' ? 'rec-ok' : 'rec-warn') +
				'">' +
				(de.permissao === 'granted'
					? de.ocupado
						? 'espelhando...'
						: 'ultimo espelho ' + esc(hhmm(de.ultimoEspelho)) + (de.pendentes ? ' · ' + de.pendentes + ' pendente(s)' : '')
					: 'precisa de permissao') +
				(de.ultimoErro ? ' · <span class="rec-bad">' + esc(de.ultimoErro) + '</span>' : '') +
				'</span><span class="rec-acts">' +
				(de.permissao === 'granted'
					? botao('cofre:espelhar', 'Espelhar agora')
					: botao('cofre:reconectar', 'Reconectar')) +
				botao('cofre:desvincular', 'Desvincular') +
				'</span></div>';

		html += '</div></div>';
		return html;
	}

	async function secaoAchados(sess) {
		const S = store();
		if (!S || typeof S.scanProjects !== 'function') return '';
		let achados = [];
		try {
			const LOCK = root.LOCK;
			const dec = LOCK && LOCK.key && typeof root._decSession === 'function' ? (r) => root._decSession(r, LOCK.key) : null;
			achados = await S.scanProjects(dec);
		} catch (e) {
			ignorar(e, 'cofrePainel:scan');
			return '';
		}
		const noIndice = new Set(
			(sess && Array.isArray(sess.projects) ? sess.projects : []).map((p) => String(p && p.id)),
		);
		const open = abertos();
		const fora = achados.filter((a) => !noIndice.has(String(a.id)) && !open.has(String(a.id)));
		if (!fora.length) return '';
		let html =
			'<div class="rec-sec"><span class="rec-t">Projetos encontrados no armazenamento (fora do indice)</span>' +
			'<div class="rec-note">Os arquivos destes projetos estao gravados no navegador, mas eles nao constam na lista da sessao. Isso acontece quando o indice foi sobrescrito ou nao pode ser lido. Reabrir devolve o projeto a sessao.</div>';
		for (const a of fora) {
			html +=
				'<div class="rec-row"><span class="rec-n">' +
				esc(a.bloqueado ? 'Projeto protegido por senha' : a.name || 'projeto') +
				'</span><span class="rec-m">' +
				(a.nFiles != null ? '<span>' + esc(a.nFiles) + ' arquivo(s)</span>' : '?') +
				(a.t ? ' · <span>' + esc(relTime(a.t)) + '</span>' : '') +
				' · id <span>' +
				esc(a.id) +
				'</span></span><span class="rec-acts">' +
				botao('cofre:achado-abrir', a.bloqueado ? 'Desbloquear e reabrir' : 'Reabrir', ' data-k="' + esc(a.id) + '"') +
				botao('cofre:achado-excluir', 'Excluir', ' data-k="' + esc(a.id) + '"') +
				'</span></div>';
		}
		html += '</div>';
		return html;
	}

	async function secaoDisco() {
		const d = disco();
		if (!d) return '';
		const de = d.estado();
		if (!de.suportado || !de.vinculada) return '';
		let html = '<div class="rec-sec"><span class="rec-t">Projetos na pasta de backup (' + esc(de.nome) + ')</span>';
		if (de.permissao !== 'granted') {
			html +=
				'<div class="rec-note">A pasta precisa de permissao para ser lida. Clique em Reconectar acima.</div></div>';
			return html;
		}
		let lista = [];
		try {
			lista = await d.listarProjetos();
		} catch (e) {
			ignorar(e, 'cofrePainel:listarDisco');
			html += '<div class="rec-note rec-bad">Nao consegui ler a pasta: ' + esc((e && e.message) || e) + '</div></div>';
			return html;
		}
		if (!lista.length)
			html += '<div class="rec-note">Ainda nao ha projetos espelhados. O primeiro espelho acontece em segundos apos uma gravacao.</div>';
		for (const it of lista) {
			html +=
				'<div class="rec-row"><span class="rec-n">' +
				esc(it.nome) +
				'</span><span class="rec-m">' +
				(it.nFiles != null ? '<span>' + esc(it.nFiles) + ' arquivo(s)</span> · ' : '') +
				(it.t ? '<span>' + esc(relTime(it.t)) + '</span>' : '') +
				' · <span>' +
				esc(it.pasta) +
				'</span></span><span class="rec-acts">' +
				(it.aberto
					? '<button class="rec-btn" disabled>Aberto</button>'
					: botao('cofre:disco-abrir', 'Reabrir', ' data-k="' + esc(it.pid) + '"')) +
				botao('cofre:disco-excluir', 'Excluir da pasta', ' data-k="' + esc(it.pid) + '"') +
				'</span></div>';
		}
		html += '</div>';
		return html;
	}

	function saude() {
		try {
			return secaoSaude();
		} catch (e) {
			ignorar(e, 'cofrePainel:saude');
			return '';
		}
	}

	async function recuperacao(sess) {
		const partes = [];
		try {
			partes.push(await secaoAchados(sess));
		} catch (e) {
			ignorar(e, 'cofrePainel:achados');
		}
		try {
			partes.push(await secaoDisco());
		} catch (e) {
			ignorar(e, 'cofrePainel:disco');
		}
		return partes.join('');
	}

	async function render(sess) {
		return saude() + (await recuperacao(sess));
	}

	async function acao(op, btn, rerender) {
		const k = btn && btn.getAttribute ? btn.getAttribute('data-k') : null;
		const fx = FX();
		const d = disco();
		const S = store();
		const uiConfirm = root.uiConfirm;
		const recOpen = root.recOpen;

		if (op === 'cofre:perda-ok') {
			const M = root.SynapseCofreManifesto;
			if (M && root.localStorage) {
				M.clearLoss(root.localStorage);
				M.clearWipe(root.localStorage);
			}
			if (fx) fx.wipeAttempt = null;
			if (fx && typeof fx.render === 'function') fx.render();
			atualizarIndicador();
			return rerender();
		}
		if (op === 'cofre:persistir') {
			const r = fx && fx.pedirPersistencia ? await fx.pedirPersistencia() : null;
			toast(
				r ? 'Armazenamento persistente' : 'Pedido recusado',
				r
					? 'O navegador concedeu armazenamento persistente a este site.'
					: 'O navegador nao concedeu. Instalar a IDE como app, adicionar aos favoritos ou vincular uma pasta de backup resolve.',
				r ? 'ok' : 'warn',
			);
			return rerender();
		}
		if (op === 'cofre:exportar') {
			if (typeof root.exportZipDialog === 'function') root.exportZipDialog();
			return;
		}
		if (op === 'cofre:vincular') {
			if (!d) return;
			try {
				const nome = await d.vincular();
				toast('Pasta vinculada', 'Os projetos passam a ser espelhados em "' + nome + '".', 'ok');
			} catch (e) {
				if (!(e && e.name === 'AbortError')) toast('Nao foi possivel vincular', (e && e.message) || String(e), 'err');
			}
			return rerender();
		}
		if (op === 'cofre:reconectar') {
			if (!d) return;
			const ok = await d.reconectar();
			toast(ok ? 'Pasta reconectada' : 'Permissao negada', ok ? 'O espelho em disco voltou a funcionar.' : 'Sem permissao a pasta nao pode ser atualizada.', ok ? 'ok' : 'warn');
			return rerender();
		}
		if (op === 'cofre:desvincular') {
			if (!d) return;
			const ok = typeof uiConfirm === 'function' ? await uiConfirm('Desvincular pasta de backup', 'Os arquivos ja espelhados continuam na pasta; a IDE so deixa de atualiza-los.', 'Desvincular', true) : true;
			if (!ok) return;
			await d.desvincular();
			return rerender();
		}
		if (op === 'cofre:espelhar') {
			if (!d) return;
			const r = await d.espelharAgora('manual');
			if (r) toast('Espelho atualizado', r.projetos + ' projeto(s), ' + r.escritos + ' arquivo(s) gravado(s) em ' + r.ms + 'ms', 'ok');
			else toast('Espelho nao executado', (d.estado().ultimoErro) || 'tente novamente em instantes', 'warn');
			return rerender();
		}
		if (op === 'cofre:achado-abrir' || op === 'cofre:achado-excluir') {
			if (!S || k == null) return;
			if (op === 'cofre:achado-excluir') {
				const ok = typeof uiConfirm === 'function' ? await uiConfirm('Excluir projeto do armazenamento', 'Isso apaga definitivamente os arquivos gravados deste projeto no navegador.', 'Excluir', true) : true;
				if (!ok) return;
				await S.forgetProject(k);
				return rerender();
			}
			let dec = null;
			const LOCK = root.LOCK;
			if (LOCK && LOCK.key && typeof root._decSession === 'function') dec = (r) => root._decSession(r, LOCK.key);
			let pm = null;
			try {
				let raw = await S.getRecord(S.MANIFEST_PREFIX + k);
				if (raw && raw.enc) {
					if (!dec && typeof root.recDecKey === 'function') {
						const r = await root.recDecKey(raw);
						if (!r) return;
						dec = (rec) => root._decSession(rec, r.key);
						raw = r.data;
					} else if (dec) raw = await dec(raw);
				}
				pm = raw && typeof raw === 'object' ? raw : { id: k };
			} catch (e) {
				ignorar(e, 'cofrePainel:manifesto');
				pm = { id: k };
			}
			const pd = await S.loadProject(k, dec, pm);
			if (!pd || !pd.files || !pd.files.length) {
				toast('Nada para reabrir', pd && pd.__skipped ? 'Os arquivos estao protegidos por senha.' : 'Nenhum arquivo legivel foi encontrado para este projeto.', 'warn');
				return;
			}
			const n = typeof recOpen === 'function' ? await recOpen([pd]) : 0;
			if (n && fx) {
				fx.forgotten.delete(String(k));
				if (typeof root.saveSession === 'function') root.saveSession();
			}
			return n ? 'fechar' : undefined;
		}
		if (op === 'cofre:disco-abrir' || op === 'cofre:disco-excluir') {
			if (!d || k == null) return;
			if (op === 'cofre:disco-excluir') {
				const ok = typeof uiConfirm === 'function' ? await uiConfirm('Excluir da pasta de backup', 'Remove a subpasta deste projeto do disco. O projeto aberto na IDE (se houver) nao e afetado.', 'Excluir', true) : true;
				if (!ok) return;
				await d.excluirProjeto(k);
				return rerender();
			}
			let pd;
			try {
				if (typeof root.showPreviewLoading === 'function') root.showPreviewLoading('Lendo a pasta de backup...', '');
				pd = await d.lerProjeto(k);
			} catch (e) {
				toast('Nao consegui ler a pasta', (e && e.message) || String(e), 'err');
				return;
			} finally {
				try {
					if (typeof root.hidePreviewLoading === 'function') root.hidePreviewLoading();
				} catch (e) {
					ignorar(e, 'cofrePainel:loading');
				}
			}
			if (!pd.files.length) {
				toast('Pasta vazia', 'Nenhum arquivo foi encontrado nesta subpasta.', 'warn');
				return;
			}
			const n = typeof recOpen === 'function' ? await recOpen([pd]) : 0;
			if (n && fx) {
				fx.forgotten.delete(String(pd.id));
				if (typeof root.saveSession === 'function') root.saveSession();
			}
			return n ? 'fechar' : undefined;
		}
	}

	function atualizarIndicador() {
		cssOnce();
		const b = document.getElementById('recentBtn');
		if (!b) return;
		const fx = FX();
		const d = disco();
		const de = d ? d.estado() : null;
		let nivel = '';
		const motivos = [];
		if (fx) {
			if (fx.wipeAttempt) {
				nivel = 'bad';
				motivos.push('tentativa de apagar o armazenamento detectada');
			}
			if (fx.bootUnverified) {
				nivel = 'bad';
				motivos.push('indice nao lido no boot (recarregue)');
			}
			if (fx.lastErr && fx.owner) {
				nivel = nivel || 'bad';
				motivos.push('ultima gravacao falhou');
			}
			if (fx.persisted === false && !(de && de.vinculada)) {
				nivel = nivel || 'warn';
				motivos.push('sem armazenamento persistente e sem pasta de backup');
			}
		}
		if (de && de.vinculada && de.permissao !== 'granted') {
			nivel = nivel || 'warn';
			motivos.push('pasta de backup precisa de permissao (Reconectar)');
		}
		if (de && de.ultimoErro && de.permissao === 'granted') {
			nivel = nivel || 'warn';
			motivos.push('espelho em disco com erro');
		}
		b.classList.toggle('rec-storage-warn', nivel === 'warn');
		b.classList.toggle('rec-storage-bad', nivel === 'bad');
		b.title = motivos.length
			? 'Projetos recentes e backups — atencao: ' + motivos.join('; ')
			: 'Projetos recentes e backups — recuperar projetos fechados';
	}

	function sugerirProtecao() {
		try {
			const fx = FX();
			const d = disco();
			const de = d ? d.estado() : null;
			if (!fx || fx.persisted !== false) return false;
			if (de && de.vinculada) return false;
			const ls = root.localStorage;
			const ultimo = ls ? +ls.getItem(NUDGE_KEY) || 0 : 0;
			if (Date.now() - ultimo < NUDGE_MS) return false;
			if (ls) ls.setItem(NUDGE_KEY, String(Date.now()));
			toast(
				'Proteja seus projetos',
				de && de.suportado
					? 'O navegador pode apagar os dados deste site. Vincule uma pasta de backup no disco: relogio (Recentes) > Escolher pasta.'
					: 'O navegador pode apagar os dados deste site. Exporte .zip com frequencia ou use Chrome/Edge para ter pasta de backup.',
				'warn',
			);
			atualizarIndicador();
			return true;
		} catch (e) {
			ignorar(e, 'cofrePainel:sugerir');
			return false;
		}
	}

	root.SynapseCofrePainel = Object.freeze({
		render: render,
		saude: saude,
		recuperacao: recuperacao,
		acao: acao,
		atualizarIndicador: atualizarIndicador,
		sugerirProtecao: sugerirProtecao,
	});
})(typeof window !== 'undefined' ? window : globalThis);
