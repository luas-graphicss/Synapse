(function (root) {
	'use strict';

	const KEY = 'extensions-running';
	const REFRESH_MS = 2000;
	let container = null;
	let timer = 0;
	let sortBy = 'activationTimeMs';

	function tr(text) {
		return typeof root.tr === 'function' ? root.tr(text) : text;
	}

	function esc(text) {
		return typeof root.escaparHtml === 'function' ? root.escaparHtml(String(text == null ? '' : text)) : String(text == null ? '' : text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
	}

	function icon(name, className) {
		return typeof root.iconSvg === 'function' ? root.iconSvg(name, className) : '';
	}

	function registry() {
		return root.SynapseExtensions;
	}

	function panels() {
		return root.SynapseHostPanels;
	}

	function statusLabel(item) {
		if (item.status === 'active') return tr('Ativa');
		if (item.status === 'error') return tr('Erro');
		if (item.status === 'disabled') return tr('Desabilitada');
		if (item.status === 'activating') return tr('Ativando…');
		return tr('Aguardando');
	}

	function rows() {
		if (!registry()) return [];
		const list = registry().list().slice();
		list.sort((a, b) => {
			if (sortBy === 'name') return String(a.name).localeCompare(String(b.name));
			if (sortBy === 'status') return String(a.status).localeCompare(String(b.status));
			return (b.activationTimeMs || 0) - (a.activationTimeMs || 0);
		});
		return list;
	}

	function summary(list) {
		const active = list.filter((item) => item.status === 'active').length;
		const errors = list.filter((item) => item.status === 'error').length;
		const disabled = list.filter((item) => item.status === 'disabled').length;
		const total = list.reduce((sum, item) => sum + (item.activationTimeMs || 0), 0);
		return (
			`<div class="xr-summary">` +
			`<span><strong>${active}</strong> ${esc(tr('ativas'))}</span>` +
			`<span><strong>${errors}</strong> ${esc(tr('com erro'))}</span>` +
			`<span><strong>${disabled}</strong> ${esc(tr('desabilitadas'))}</span>` +
			`<span><strong>${Math.round(total)} ms</strong> ${esc(tr('tempo total de ativação'))}</span>` +
			`</div>`
		);
	}

	function render() {
		if (!container) return;
		const list = rows();
		const header = (key, label) => `<th><button type="button" class="xr-sort${sortBy === key ? ' active' : ''}" data-sort="${key}">${esc(label)}${sortBy === key ? icon('drop', 'xr-sort-ico') : ''}</button></th>`;
		const body = list
			.map((item) => {
				const time = item.activationTimeMs ? `${Math.round(item.activationTimeMs)} ms` : '—';
				const slow = item.activationTimeMs > 500;
				const actions = [];
				if (item.status === 'active') actions.push(`<button type="button" class="xv-btn" data-act="deactivate" data-id="${esc(item.id)}">${esc(tr('Desativar'))}</button>`);
				else if (item.status !== 'disabled') actions.push(`<button type="button" class="xv-btn" data-act="activate" data-id="${esc(item.id)}">${esc(tr('Ativar'))}</button>`);
				actions.push(`<button type="button" class="xv-gear" data-act="details" data-id="${esc(item.id)}" title="${esc(tr('Detalhes'))}" aria-label="${esc(tr('Detalhes'))}">${icon('info')}</button>`);
				return (
					`<tr class="xr-row xr-${esc(item.status)}">` +
					`<td><span class="xv-dot xv-dot-${item.status === 'active' ? 'on' : item.status === 'error' ? 'error' : item.status === 'disabled' ? 'off' : 'idle'}"></span></td>` +
					`<td><div class="xr-name">${esc(item.name)}</div><div class="xd-mono xd-muted">${esc(item.id)}</div></td>` +
					`<td>${esc(statusLabel(item))}${item.error ? `<div class="xr-error" title="${esc(item.error)}">${esc(item.error)}</div>` : ''}</td>` +
					`<td class="xd-mono${slow ? ' xr-slow' : ''}" title="${slow ? esc(tr('Ativação lenta')) : ''}">${esc(time)}</td>` +
					`<td class="xd-mono xd-muted">${esc((item.activationEvents || []).join(', ') || '*')}</td>` +
					`<td>${(item.commands || []).length}</td>` +
					`<td>${esc(item.source || '')}</td>` +
					`<td class="xr-actions">${actions.join('')}</td>` +
					`</tr>`
				);
			})
			.join('');
		container.innerHTML =
			`<div class="xr-root">` +
			`<header class="xr-head"><h1>${esc(tr('Extensões em execução'))}</h1><div class="xr-head-actions"><button type="button" class="xv-btn" data-act="output">${esc(tr('Ver saída'))}</button><button type="button" class="xv-btn" data-act="refresh">${icon('reload')} ${esc(tr('Atualizar'))}</button></div></header>` +
			summary(list) +
			(list.length
				? `<table class="xd-table xr-table"><thead><tr><th></th>${header('name', tr('Extensão'))}${header('status', tr('Estado'))}${header('activationTimeMs', tr('Ativação'))}<th>${esc(tr('Eventos'))}</th><th>${esc(tr('Comandos'))}</th><th>${esc(tr('Origem'))}</th><th></th></tr></thead><tbody>${body}</tbody></table>`
				: `<p class="xd-empty">${esc(tr('Nenhuma extensão carregada.'))}</p>`) +
			`</div>`;
	}

	async function act(action, id) {
		try {
			if (action === 'deactivate') await registry().deactivate(id);
			else if (action === 'activate') await registry().activate(id, 'manual');
			else if (action === 'details' && root.SynapseExtensionDetails) root.SynapseExtensionDetails.open(id);
			else if (action === 'output' && root.SynapseExtensionOutput) root.SynapseExtensionOutput.show();
		} catch (error) {
			if (typeof root.toast === 'function') root.toast(tr('Falha na operação'), error && error.message ? error.message : String(error), 'err');
		}
		render();
	}

	function bind(node) {
		node.addEventListener('click', (event) => {
			const sort = event.target.closest('[data-sort]');
			if (sort) {
				sortBy = sort.dataset.sort;
				return render();
			}
			const button = event.target.closest('[data-act]');
			if (!button) return;
			if (button.dataset.act === 'refresh') return render();
			act(button.dataset.act, button.dataset.id);
		});
	}

	function startTimer() {
		stopTimer();
		timer = setInterval(() => {
			if (panels() && panels().isActive(KEY)) render();
		}, REFRESH_MS);
	}

	function stopTimer() {
		if (timer) clearInterval(timer);
		timer = 0;
	}

	function open() {
		if (!panels()) return;
		panels().open({
			key: KEY,
			title: tr('Extensões em execução'),
			icon: 'clock',
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
				stopTimer();
			},
		});
		startTimer();
	}

	function register() {
		if (!registry()) return;
		if (typeof registry().onDidChange === 'function') registry().onDidChange(() => container && render());
		if (typeof registry().registerPaletteCommand === 'function') {
			registry().registerPaletteCommand(() => ({ id: 'synapse.extensions.running.panel', label: tr('Extensões: Painel de execução'), hint: tr('estado, tempo de ativação e erros'), icon: 'clock', run: open }));
		}
		if (root.SynapseNativeShortcuts && typeof root.SynapseNativeShortcuts.register === 'function') {
			root.SynapseNativeShortcuts.register([{ id: 'synapse.extensions.running', label: tr('Extensões em execução'), defaultBinding: '', category: tr('Extensões'), run: open }]);
		}
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', register, { once: true });
	else register();

	root.SynapseExtensionsRunning = Object.freeze({ open, refresh: render });
})(window);
