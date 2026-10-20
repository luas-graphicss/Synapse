(function (root) {
	'use strict';

	const KEY = 'extensions-activity';
	const ROW_LIMIT = 400;
	let container = null;
	let unsubscribe = null;
	const filter = { extensionId: '', category: '', onlyProblems: false };

	function tr(text) {
		return typeof root.tr === 'function' ? root.tr(text) : text;
	}

	function esc(text) {
		return typeof root.escaparHtml === 'function' ? root.escaparHtml(String(text == null ? '' : text)) : String(text == null ? '' : text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
	}

	function icon(name, className) {
		return typeof root.iconSvg === 'function' ? root.iconSvg(name, className) : '';
	}

	function audit() {
		return root.SynapseExtensionAudit;
	}

	function registry() {
		return root.SynapseExtensions;
	}

	function panels() {
		return root.SynapseHostPanels;
	}

	function nameOf(id) {
		const item = registry() ? registry().get(id) : null;
		return item ? item.name : id;
	}

	function time(t) {
		const date = new Date(t);
		return `${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.${String(date.getMilliseconds()).padStart(3, '0')}`;
	}

	function categoryLabel(category) {
		const labels = audit() ? audit().CATEGORY_LABELS : {};
		return tr(labels[category] || category);
	}

	function resultMarkup(entry) {
		if (entry.kind === 'negado') return `<span class="xa-result xa-denied">${esc(tr('negado'))}</span>`;
		if (entry.kind === 'seguranca') return `<span class="xa-result ${entry.ok ? 'xa-info' : 'xa-fail'}">${esc(tr('segurança'))}</span>`;
		if (entry.ok) return `<span class="xa-result xa-ok">${esc(tr('ok'))}</span>`;
		return `<span class="xa-result xa-fail" title="${esc(entry.error || '')}">${esc(entry.code || tr('erro'))}</span>`;
	}

	function summary(list) {
		const total = list.length;
		const failed = list.filter((entry) => !entry.ok).length;
		const denied = list.filter((entry) => entry.kind === 'negado').length;
		const writes = list.filter((entry) => entry.category === 'arquivo:escrita').length;
		const network = list.filter((entry) => entry.category === 'rede').length;
		return (
			`<div class="xr-summary">` +
			`<span><strong>${total}</strong> ${esc(tr('chamadas'))}</span>` +
			`<span><strong>${writes}</strong> ${esc(tr('escritas em arquivos'))}</span>` +
			`<span><strong>${network}</strong> ${esc(tr('acessos à rede'))}</span>` +
			`<span><strong>${denied}</strong> ${esc(tr('negadas'))}</span>` +
			`<span><strong>${failed}</strong> ${esc(tr('com falha'))}</span>` +
			`</div>`
		);
	}

	function filtersMarkup() {
		const ids = audit() ? audit().extensionIds() : [];
		const categories = audit() ? Object.keys(audit().CATEGORY_LABELS) : [];
		return (
			`<div class="xa-filters">` +
			`<label class="xa-field"><span>${esc(tr('Extensão'))}</span><select data-filter="extensionId"><option value="">${esc(tr('Todas'))}</option>${ids.map((id) => `<option value="${esc(id)}"${filter.extensionId === id ? ' selected' : ''}>${esc(nameOf(id))} · ${esc(id)}</option>`).join('')}</select></label>` +
			`<label class="xa-field"><span>${esc(tr('Categoria'))}</span><select data-filter="category"><option value="">${esc(tr('Todas'))}</option>${categories.map((category) => `<option value="${esc(category)}"${filter.category === category ? ' selected' : ''}>${esc(categoryLabel(category))}</option>`).join('')}</select></label>` +
			`<label class="xa-check"><input type="checkbox" data-filter="onlyProblems"${filter.onlyProblems ? ' checked' : ''}><span>${esc(tr('Só problemas'))}</span></label>` +
			`</div>`
		);
	}

	function render() {
		if (!container || !audit()) return;
		const list = audit().list({ extensionId: filter.extensionId || undefined, category: filter.category || undefined, onlyProblems: filter.onlyProblems, limit: ROW_LIMIT });
		const body = list
			.map(
				(entry) =>
					`<tr class="xa-row${entry.ok ? '' : ' xa-row-fail'}">` +
					`<td class="xd-mono xd-muted xa-time">${esc(time(entry.t))}</td>` +
					`<td><button type="button" class="xa-link" data-act="details" data-id="${esc(entry.id)}" title="${esc(entry.id)}">${esc(nameOf(entry.id) || '—')}</button></td>` +
					`<td><span class="xa-cat xa-cat-${esc(entry.category.replace(':', '-'))}">${esc(categoryLabel(entry.category))}</span></td>` +
					`<td class="xd-mono">${esc(entry.method)}</td>` +
					`<td class="xa-detail" title="${esc(entry.detail || '')}">${esc(entry.detail || '')}</td>` +
					`<td class="xd-mono xd-muted">${entry.durationMs === null || entry.durationMs === undefined ? '—' : esc(`${entry.durationMs} ms`)}</td>` +
					`<td>${resultMarkup(entry)}</td>` +
					`</tr>`,
			)
			.join('');
		container.innerHTML =
			`<div class="xr-root xa-root">` +
			`<header class="xr-head"><h1>${esc(tr('Atividade de extensões'))}</h1><div class="xr-head-actions">` +
			`<button type="button" class="xv-btn" data-act="export">${icon('download')} ${esc(tr('Exportar JSON'))}</button>` +
			`<button type="button" class="xv-btn" data-act="clear">${esc(tr('Limpar'))}</button>` +
			`<button type="button" class="xv-btn" data-act="refresh">${icon('reload')} ${esc(tr('Atualizar'))}</button>` +
			`</div></header>` +
			`<p class="xa-hint">${esc(tr('Últimas chamadas feitas pelas extensões à IDE: leitura e escrita de arquivos, rede, editor e eventos de segurança. Nada sai do seu navegador; use Exportar para anexar a um relatório.'))}</p>` +
			summary(list) +
			filtersMarkup() +
			(list.length
				? `<table class="xd-table xa-table"><thead><tr><th>${esc(tr('Hora'))}</th><th>${esc(tr('Extensão'))}</th><th>${esc(tr('Categoria'))}</th><th>${esc(tr('Chamada'))}</th><th>${esc(tr('Detalhe'))}</th><th>${esc(tr('Duração'))}</th><th>${esc(tr('Resultado'))}</th></tr></thead><tbody>${body}</tbody></table>`
				: `<p class="xd-empty">${esc(tr('Nenhuma atividade registrada com os filtros atuais.'))}</p>`) +
			`</div>`;
	}

	function download(text, name) {
		const blob = new Blob([text], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = name;
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
		setTimeout(() => URL.revokeObjectURL(url), 2000);
	}

	function act(action, target) {
		if (!audit()) return;
		if (action === 'refresh') return render();
		if (action === 'export') {
			download(audit().exportJson({ extensionId: filter.extensionId || undefined, category: filter.category || undefined, onlyProblems: filter.onlyProblems }), `synapse-extensoes-atividade-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
			return;
		}
		if (action === 'clear') {
			audit().clear(filter.extensionId || undefined);
			return render();
		}
		if (action === 'details' && root.SynapseExtensionDetails && target && target.dataset.id) root.SynapseExtensionDetails.open(target.dataset.id);
	}

	function bind(node) {
		node.addEventListener('click', (event) => {
			const button = event.target.closest('[data-act]');
			if (button) act(button.dataset.act, button);
		});
		node.addEventListener('change', (event) => {
			const control = event.target.closest('[data-filter]');
			if (!control) return;
			const key = control.dataset.filter;
			filter[key] = control.type === 'checkbox' ? !!control.checked : String(control.value || '');
			render();
		});
	}

	function open(options) {
		if (!panels()) return;
		if (options && typeof options.extensionId === 'string') filter.extensionId = options.extensionId;
		panels().open({
			key: KEY,
			title: tr('Atividade de extensões'),
			icon: 'shield',
			render: (node) => {
				if (container !== node) {
					container = node;
					bind(node);
				}
				render();
			},
			onShow: render,
			onClose: () => {
				container = null;
				if (unsubscribe) unsubscribe();
				unsubscribe = null;
			},
		});
		if (!unsubscribe && audit()) {
			unsubscribe = audit().subscribe(() => {
				if (container && panels().isActive(KEY)) render();
			});
		}
		if (options && options.extensionId) render();
	}

	function register() {
		if (!registry()) return;
		if (typeof registry().registerPaletteCommand === 'function') {
			registry().registerPaletteCommand(() => ({ id: 'synapse.extensions.activity', label: tr('Extensões: Atividade de extensões'), hint: tr('chamadas RPC, arquivos, rede e segurança'), icon: 'shield', run: () => open() }));
		}
		if (root.SynapseNativeShortcuts && typeof root.SynapseNativeShortcuts.register === 'function') {
			root.SynapseNativeShortcuts.register([{ id: 'synapse.extensions.activity', label: tr('Atividade de extensões'), defaultBinding: '', category: tr('Extensões'), run: () => open() }]);
		}
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', register, { once: true });
	else register();

	root.SynapseExtensionsActivity = Object.freeze({ open, refresh: render });
})(window);
