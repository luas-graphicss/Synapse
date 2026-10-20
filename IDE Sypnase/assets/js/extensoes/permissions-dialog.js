(function (root) {
	'use strict';

	const SENSITIVE = new Set(['network', 'preview', 'mcp']);
	const EXPLANATIONS = Object.freeze({
		'workspace.read': 'Pode ler o conteúdo de todos os arquivos do projeto ativo.',
		'workspace.write': 'Pode criar, alterar e excluir arquivos do projeto ativo. As alterações entram no histórico e podem ser desfeitas.',
		'workspace.all': 'Vê todos os projetos abertos, não apenas o ativo.',
		editor: 'Lê a seleção e edita o arquivo aberto no editor.',
		webview: 'Mostra interface própria em painéis isolados, sem acesso à IDE.',
		clipboard: 'Lê e escreve na área de transferência.',
		preview: 'Injeta código e controla o preview do seu site.',
		mcp: 'Expõe ferramentas para agentes conectados via MCP.',
		network: 'Faz requisições de rede. Dados do projeto podem sair do seu computador.',
	});
	const RISK_ORDER = { alto: 0, médio: 1, baixo: 2, desconhecido: 3 };

	let active = null;

	function esc(text) {
		return typeof root.escaparHtml === 'function' ? root.escaparHtml(String(text)) : String(text).replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
	}

	function icon(name) {
		return typeof root.iconSvg === 'function' ? root.iconSvg(name) : '';
	}

	function permissions() {
		return root.SynapseExtensionPermissions;
	}

	function describe(permission) {
		const key = permission.startsWith('network:') ? 'network' : permission;
		const info = permissions() && typeof permissions().describe === 'function' ? permissions().describe(permission) : { risk: 'desconhecido', label: permission };
		let explanation = EXPLANATIONS[key] || 'Permissão não reconhecida por esta versão da IDE.';
		if (key === 'network') explanation = `Faz requisições para ${permission.slice('network:'.length)}. Dados do projeto podem sair do seu computador.`;
		return { permission, key, risk: info.risk, label: info.label, explanation, sensitive: SENSITIVE.has(key) };
	}

	function describeAll(manifest) {
		const list = Array.isArray(manifest && manifest.permissions) ? manifest.permissions : [];
		return list.map(describe).sort((a, b) => (RISK_ORDER[a.risk] ?? 3) - (RISK_ORDER[b.risk] ?? 3));
	}

	function riskClass(risk) {
		return risk === 'alto' ? 'high' : risk === 'médio' ? 'medium' : risk === 'baixo' ? 'low' : 'unknown';
	}

	function permissionsMarkup(items) {
		if (!items.length) return '<p class="ext-perm-none">Não pede permissões além do básico: comandos, notificações, configurações e armazenamento próprio.</p>';
		return (
			'<ul class="ext-perm-list" role="list">' +
			items
				.map(
					(item) =>
						`<li class="ext-perm-item risk-${riskClass(item.risk)}">` +
						`<span class="ext-perm-risk" aria-label="Risco ${esc(item.risk)}">${esc(item.risk)}</span>` +
						`<span class="ext-perm-text"><span class="ext-perm-label">${esc(item.label)}</span><span class="ext-perm-explain">${esc(item.explanation)}</span><code class="ext-perm-code">${esc(item.permission)}</code></span></li>`,
				)
				.join('') +
			'</ul>'
		);
	}

	function close(result) {
		if (!active) return;
		const { overlay, resolve, previousFocus, onKey } = active;
		active = null;
		document.removeEventListener('keydown', onKey, true);
		overlay.remove();
		if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus({ preventScroll: true });
		resolve(result);
	}

	function confirm(manifest, context) {
		context = context || {};
		if (active) close(false);
		const items = describeAll(manifest);
		const requiresScroll = items.some((item) => item.sensitive);
		const update = !!context.currentVersion;
		const okLabel = context.okLabel || (update ? 'Atualizar' : 'Instalar');
		const title = context.title || (update ? 'Atualizar extensão' : 'Instalar extensão');
		const overlay = document.createElement('div');
		overlay.className = 'cmdk-back ext-overlay ext-perm-overlay';
		overlay.innerHTML =
			`<div class="ext-perm-dialog" role="dialog" aria-modal="true" aria-labelledby="extPermTitle" aria-describedby="extPermBody">` +
			`<div class="ext-perm-head"><span class="ext-perm-title" id="extPermTitle">${esc(title)}</span><button type="button" class="ext-perm-close" data-act="cancel" aria-label="Fechar">${icon('close')}</button></div>` +
			`<div class="ext-perm-identity">` +
			`<span class="ext-perm-icon" aria-hidden="true">${context.iconUrl ? `<img src="${esc(context.iconUrl)}" alt="">` : esc((manifest.name || manifest.id || '?').slice(0, 1).toUpperCase())}</span>` +
			`<span class="ext-perm-meta"><span class="ext-perm-name">${esc(manifest.name || manifest.id)}</span><span class="ext-perm-sub">${esc(manifest.publisher || '')} · ${update ? `v${esc(context.currentVersion)} → ` : ''}v${esc(manifest.version || '')}</span></span>` +
			`</div>` +
			`<div class="ext-perm-body" id="extPermBody" tabindex="0">` +
			(manifest.description ? `<p class="ext-perm-desc">${esc(manifest.description)}</p>` : '') +
			`<dl class="ext-perm-facts">` +
			`<dt>Origem</dt><dd>${esc(context.origin || context.url || 'arquivo local')}</dd>` +
			`<dt>Integridade</dt><dd>${context.hashVerified ? 'SHA-256 verificado contra o registro.' : 'SHA-256 calculado localmente, sem referência no registro.'}</dd>` +
			`<dt>Assinatura</dt><dd class="${context.signatureVerified ? 'ext-perm-signed' : 'ext-perm-unsigned'}">${context.signatureVerified ? `${icon('lock')} Assinada por “${esc(context.publisher || manifest.publisher || '')}” e verificada (ECDSA P-256).` : 'Não assinada pelo publicador.'}</dd>` +
			(manifest.license ? `<dt>Licença</dt><dd>${esc(manifest.license)}</dd>` : '') +
			`</dl>` +
			(context.warnings && context.warnings.length ? `<div class="ext-perm-warnings" role="note">${context.warnings.map((warning) => `<p>${icon('warn')}<span>${esc(warning)}</span></p>`).join('')}</div>` : '') +
			`<h4 class="ext-perm-heading">Permissões solicitadas</h4>` +
			permissionsMarkup(items) +
			(requiresScroll ? `<p class="ext-perm-scrollhint" data-scrollhint>Leia até o fim para habilitar “${esc(okLabel)}”.</p>` : '') +
			`</div>` +
			`<div class="ext-perm-foot"><button type="button" class="settings-button ghost" data-act="cancel">Cancelar</button><button type="button" class="settings-button primary ext-perm-ok" data-act="ok"${requiresScroll ? ' disabled' : ''}>${esc(okLabel)}</button></div>` +
			`</div>`;
		document.body.appendChild(overlay);
		const dialog = overlay.firstElementChild;
		const body = dialog.querySelector('.ext-perm-body');
		const ok = dialog.querySelector('[data-act="ok"]');
		const hint = dialog.querySelector('[data-scrollhint]');

		function unlock() {
			if (!ok.disabled) return;
			ok.disabled = false;
			if (hint) hint.classList.add('done');
		}

		function checkScroll() {
			if (!requiresScroll) return;
			if (body.scrollHeight - body.scrollTop - body.clientHeight <= 4) unlock();
		}

		body.addEventListener('scroll', checkScroll, { passive: true });
		requestAnimationFrame(checkScroll);

		function onKey(event) {
			if (!active || active.overlay !== overlay) return;
			if (event.key === 'Escape') {
				event.preventDefault();
				event.stopPropagation();
				close(false);
				return;
			}
			if (event.key === 'Tab') {
				const focusables = [...dialog.querySelectorAll('button:not([disabled]), [tabindex="0"]')];
				if (!focusables.length) return;
				const first = focusables[0];
				const last = focusables[focusables.length - 1];
				if (event.shiftKey && document.activeElement === first) {
					event.preventDefault();
					last.focus();
				} else if (!event.shiftKey && document.activeElement === last) {
					event.preventDefault();
					first.focus();
				}
			}
		}

		overlay.addEventListener('click', (event) => {
			const button = event.target.closest('[data-act]');
			if (button) {
				close(button.dataset.act === 'ok');
				return;
			}
			if (event.target === overlay) close(false);
		});
		document.addEventListener('keydown', onKey, true);

		return new Promise((resolve) => {
			active = { overlay, resolve, previousFocus: document.activeElement, onKey };
			setTimeout(() => dialog.querySelector('.ext-perm-foot [data-act="cancel"]').focus({ preventScroll: true }), 20);
		});
	}

	root.SynapseExtensionPermissionsDialog = Object.freeze({ confirm, describe, describeAll, permissionsMarkup, EXPLANATIONS });
})(window);
