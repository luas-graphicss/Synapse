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
})(typeof window !== 'undefined' ? window : globalThis);
