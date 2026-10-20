(function (root) {
	'use strict';

	const COLLAPSE_KEY = 'synapse.extensionsView.collapsed';
	const SECTIONS_KEY = 'synapse.extensionsView.sections';
	const NOTIFIED_KEY = 'synapse.extensionsView.recommendationsNotified';
	const RECOMMEND_PATH = '.synapse/extensions.json';
	const FILTERS = ['@installed', '@enabled', '@disabled', '@outdated', '@recommended', '@running', '@builtin', '@category:', '@sort:name', '@sort:installs', '@sort:updated', '@id:'];
	const MAX_MARKET = 60;

	let section = null;
	let body = null;
	let searchInput = null;
	let listRoot = null;
	let reloadBar = null;
	let badge = null;
	let query = '';
	let marketResults = [];
	let marketState = 'idle';
	let marketError = '';
	let searchTimer = 0;
	let reloadReasons = [];
	let hintBox = null;
	let disposed = false;

	function tr(text) {
		return typeof root.tr === 'function' ? root.tr(text) : text;
	}

	function esc(text) {
		return typeof root.escaparHtml === 'function' ? root.escaparHtml(String(text == null ? '' : text)) : String(text == null ? '' : text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
	}

	function icon(name, className) {
		return typeof root.iconSvg === 'function' ? root.iconSvg(name, className) : '';
	}

	function toast(title, message, kind) {
		if (typeof root.toast === 'function') root.toast(title, message, kind);
	}

	function registry() {
		return root.SynapseExtensions;
	}

	function installer() {
		return root.SynapseExtensionInstaller;
	}

	function marketplace() {
		return root.SynapseExtensionMarketplace;
	}

	function details() {
		return root.SynapseExtensionDetails;
	}

	function pkg() {
		return root.SynapseExtensionPackage;
	}

	function activeProject() {
		return typeof root.activeProject === 'function' ? root.activeProject() : null;
	}

	function compareVersions(a, b) {
		if (pkg() && typeof pkg().compareVersions === 'function') return pkg().compareVersions(a, b);
		const pa = String(a || '0').split('.').map(Number);
		const pb = String(b || '0').split('.').map(Number);
		for (let i = 0; i < 3; i++) {
			const d = (pa[i] || 0) - (pb[i] || 0);
			if (d) return d;
		}
		return 0;
	}

	function isMobile() {
		return document.documentElement.hasAttribute('data-mpane') || root.matchMedia('(max-width: 760px)').matches;
	}

	function kvGet(key, fallback) {
		try {
			const raw = localStorage.getItem(key);
			return raw == null ? fallback : JSON.parse(raw);
		} catch (error) {
			return fallback;
		}
	}

	function kvPut(key, value) {
		try {
			localStorage.setItem(key, JSON.stringify(value));
		} catch (error) {}
	}

	function recommendations() {
		const project = activeProject();
		if (!project || !project.files || typeof project.files.get !== 'function') return { ids: [], unwanted: [] };
		const entry = project.files.get(RECOMMEND_PATH);
		if (!entry || typeof entry.text !== 'string') return { ids: [], unwanted: [] };
		try {
			const parsed = JSON.parse(entry.text);
			const ids = Array.isArray(parsed.recommendations) ? parsed.recommendations.filter((id) => typeof id === 'string') : [];
			const unwanted = Array.isArray(parsed.unwantedRecommendations) ? parsed.unwantedRecommendations.filter((id) => typeof id === 'string') : [];
			return { ids, unwanted };
		} catch (error) {
			return { ids: [], unwanted: [] };
		}
	}

	function updatesMap() {
		const map = new Map();
		if (!installer() || typeof installer().updates !== 'function') return map;
		installer().updates().forEach((update) => map.set(update.id, update));
		return map;
	}

	function installedItems() {
		if (!registry()) return [];
		const updates = updatesMap();
		const recs = recommendations();
		return registry()
			.list()
			.map((item) => ({
				kind: 'installed',
				id: item.id,
				name: item.name || item.id,
				publisher: item.publisher || '',
				version: item.version || '',
				description: item.description || '',
				icon: item.icon || '',
				categories: item.categories || [],
				source: item.source,
				status: item.status,
				error: item.error,
				enabled: item.enabled,
				enablementScope: item.enablementScope,
				activationTimeMs: item.activationTimeMs,
				update: updates.get(item.id) || null,
				recommended: recs.ids.includes(item.id),
				raw: item,
			}));
	}

	function marketItems() {
		const installed = new Set(registry() ? registry().list().map((item) => item.id) : []);
		return marketResults
			.filter((entry) => !installed.has(entry.id))
			.map((entry) => ({
				kind: 'market',
				id: entry.id,
				name: entry.displayName || entry.name || entry.id,
				publisher: entry.publisher || (entry.id.includes('.') ? entry.id.split('.')[0] : ''),
				version: entry.latest || '',
				description: entry.description || '',
				icon: entry.icon || '',
				categories: entry.categories || [],
				installs: Number(entry.installs || entry.downloads || 0),
				updatedAt: entry.updatedAt || entry.publishedAt || '',
				verified: !!entry.verified,
				raw: entry,
			}));
	}

	function parseQuery(text) {
		const filters = { flags: new Set(), category: '', sort: '', id: '' };
		const words = [];
		String(text || '')
			.trim()
			.split(/\s+/)
			.filter(Boolean)
			.forEach((token) => {
				const lower = token.toLowerCase();
				if (!lower.startsWith('@')) return void words.push(token);
				if (lower.startsWith('@category:')) filters.category = lower.slice('@category:'.length);
				else if (lower.startsWith('@sort:')) filters.sort = lower.slice('@sort:'.length);
				else if (lower.startsWith('@id:')) filters.id = lower.slice('@id:'.length);
				else filters.flags.add(lower);
			});
		return { filters, text: words.join(' ').toLowerCase(), words };
	}

	function matchesText(item, text) {
		if (!text) return true;
		const hay = `${item.id} ${item.name} ${item.publisher} ${item.description} ${(item.categories || []).join(' ')}`.toLowerCase();
		return text.split(' ').every((word) => hay.includes(word));
	}

	function applyFilters(items, parsed) {
		const { filters, text } = parsed;
		let list = items.filter((item) => matchesText(item, text));
		if (filters.id) list = list.filter((item) => item.id.toLowerCase().includes(filters.id));
		if (filters.category) list = list.filter((item) => (item.categories || []).some((cat) => String(cat).toLowerCase().includes(filters.category)));
		if (filters.flags.has('@enabled')) list = list.filter((item) => item.kind === 'installed' && item.enabled);
		if (filters.flags.has('@disabled')) list = list.filter((item) => item.kind === 'installed' && !item.enabled);
		if (filters.flags.has('@outdated')) list = list.filter((item) => item.kind === 'installed' && item.update);
		if (filters.flags.has('@running')) list = list.filter((item) => item.kind === 'installed' && item.status === 'active');
		if (filters.flags.has('@builtin')) list = list.filter((item) => item.kind === 'installed' && item.source === 'builtin');
		if (filters.flags.has('@recommended')) list = list.filter((item) => item.recommended);
		if (filters.sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
		else if (filters.sort === 'installs') list.sort((a, b) => (b.installs || 0) - (a.installs || 0));
		else if (filters.sort === 'updated') list.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
		return list;
	}

	function initials(name) {
		const parts = String(name || '?')
			.replace(/[^\p{L}\p{N} ]/gu, ' ')
			.trim()
			.split(/\s+/);
		return ((parts[0] || '?')[0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
	}

	function iconMarkup(item) {
		if (item.icon && /^(https?:|data:image\/|blob:)/i.test(item.icon)) return `<img class="xv-icon" src="${esc(item.icon)}" alt="" loading="lazy" data-initials="${esc(initials(item.name))}" />`;
		return `<span class="xv-icon xv-icon-text" aria-hidden="true">${esc(initials(item.name))}</span>`;
	}

	function onIconError(event) {
		const img = event.target;
		if (!img || img.tagName !== 'IMG' || !img.classList.contains('xv-icon')) return;
		const fallback = document.createElement('span');
		fallback.className = 'xv-icon xv-icon-text';
		fallback.setAttribute('aria-hidden', 'true');
		fallback.textContent = img.dataset.initials || '?';
		img.replaceWith(fallback);
	}

	function statusMarkup(item) {
		if (item.kind !== 'installed') return item.verified ? `<span class="xv-badge xv-badge-verified" title="${esc(tr('Publicador verificado'))}">${icon('lock')}</span>` : '';
		if (item.status === 'error') return `<span class="xv-dot xv-dot-error" title="${esc(item.error || tr('Erro ao ativar'))}"></span>`;
		if (!item.enabled) return `<span class="xv-dot xv-dot-off" title="${esc(item.enablementScope === 'workspace' ? tr('Desabilitada neste projeto') : tr('Desabilitada'))}"></span>`;
		if (item.status === 'active') return `<span class="xv-dot xv-dot-on" title="${esc(tr('Em execução'))}"></span>`;
		return `<span class="xv-dot xv-dot-idle" title="${esc(tr('Aguardando ativação'))}"></span>`;
	}

	function actionsMarkup(item) {
		if (item.kind === 'market') {
			return `<button type="button" class="xv-btn xv-btn-primary" data-act="install">${esc(tr('Instalar'))}</button>`;
		}
		const parts = [];
		if (item.update) parts.push(`<button type="button" class="xv-btn xv-btn-primary" data-act="update" title="${esc(tr('Atualizar para'))} ${esc(item.update.to || '')}">${esc(tr('Atualizar'))}</button>`);
		if (item.source !== 'builtin') {
			parts.push(`<button type="button" class="xv-btn" data-act="${item.enabled ? 'disable' : 'enable'}">${esc(item.enabled ? tr('Desabilitar') : tr('Habilitar'))}</button>`);
		}
		parts.push(`<button type="button" class="xv-gear" data-act="menu" aria-haspopup="menu" aria-label="${esc(tr('Mais ações'))}">${icon('more')}</button>`);
		return parts.join('');
	}

	function rowMarkup(item) {
		const meta = [item.publisher, item.version ? `v${item.version}` : '', item.kind === 'market' && item.installs ? `${formatCount(item.installs)} ${tr('instalações')}` : ''].filter(Boolean).join(' · ');
		const classes = ['xv-row', item.kind === 'installed' && !item.enabled ? 'xv-row-disabled' : '', item.kind === 'installed' && item.status === 'error' ? 'xv-row-error' : ''].filter(Boolean).join(' ');
		return (
			`<li class="${classes}" data-id="${esc(item.id)}" data-kind="${item.kind}" role="button" tabindex="0">` +
			iconMarkup(item) +
			`<div class="xv-main">` +
			`<div class="xv-title"><span class="xv-name">${esc(item.name)}</span>${statusMarkup(item)}${item.recommended ? `<span class="xv-badge xv-badge-rec">${esc(tr('Recomendada'))}</span>` : ''}</div>` +
			`<div class="xv-desc">${esc(item.description || tr('Sem descrição.'))}</div>` +
			`<div class="xv-meta">${esc(meta)}</div>` +
			`</div>` +
			`<div class="xv-actions">${actionsMarkup(item)}</div>` +
			`</li>`
		);
	}

	function formatCount(value) {
		if (value >= 1e6) return `${(value / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
		if (value >= 1e3) return `${(value / 1e3).toFixed(1).replace(/\.0$/, '')}k`;
		return String(value);
	}

	function sectionsState() {
		return kvGet(SECTIONS_KEY, {});
	}

	function sectionMarkup(key, title, items, extra) {
		const collapsed = !!sectionsState()[key];
		const count = items.length;
		return (
			`<section class="xv-section${collapsed ? ' collapsed' : ''}" data-section="${key}">` +
			`<button type="button" class="xv-section-head" aria-expanded="${!collapsed}">` +
			`<span class="xv-chevron" aria-hidden="true">${icon('drop')}</span>` +
			`<span class="xv-section-title">${esc(title)}</span>` +
			`<span class="xv-count">${count}</span>` +
			`</button>` +
			`<div class="xv-section-body${collapsed ? ' hidden' : ''}">` +
			(extra || '') +
			(count ? `<ul class="xv-list" role="list">${items.map(rowMarkup).join('')}</ul>` : '') +
			`</div>` +
			`</section>`
		);
	}

	function emptyMarkup(text) {
		return `<div class="xv-empty">${esc(text)}</div>`;
	}

	function marketStateMarkup(count) {
		if (marketState === 'loading') return `<div class="xv-empty xv-loading">${esc(tr('Buscando no marketplace…'))}</div>`;
		if (marketState === 'error') return `<div class="xv-empty xv-error">${esc(tr('Marketplace indisponível.'))} <button type="button" class="xv-link" data-act="retry">${esc(tr('Tentar de novo'))}</button><div class="xv-error-detail">${esc(marketError)}</div></div>`;
		if (marketState === 'off') return `<div class="xv-empty xv-market-off">${esc(tr('Marketplace desativado.'))} <button type="button" class="xv-link" data-act="market-enable">${esc(tr('Ativar marketplace'))}</button></div>`;
		if (!count) return emptyMarkup(query.trim() ? tr('Nada encontrado com esse termo.') : tr('Nenhuma extensão disponível.'));
		return '';
	}

	function render() {
		if (!listRoot || disposed) return;
		const parsed = parseQuery(query);
		const onlyInstalled = ['@installed', '@enabled', '@disabled', '@outdated', '@running', '@builtin'].some((flag) => parsed.filters.flags.has(flag));
		const installed = applyFilters(installedItems(), parsed);
		const recs = recommendations();
		const installedIds = new Set(installed.map((item) => item.id));
		const recommendedMarket = applyFilters(
			marketItems().filter((item) => recs.ids.includes(item.id) && !recs.unwanted.includes(item.id)),
			parsed
		).map((item) => ({ ...item, recommended: true }));
		const market = onlyInstalled ? [] : applyFilters(marketItems().filter((item) => !recs.ids.includes(item.id)), parsed).slice(0, MAX_MARKET);
		const outdated = installed.filter((item) => item.update).length;
		if (badge) {
			badge.textContent = outdated ? String(outdated) : '';
			badge.classList.toggle('hidden', !outdated);
			badge.title = outdated ? `${outdated} ${tr('atualização(ões) disponível(is)')}` : '';
		}
		const html = [];
		if (outdated > 1 && !parsed.text) {
			html.push(`<div class="xv-toolbar"><button type="button" class="xv-btn xv-btn-primary" data-act="update-all">${esc(tr('Atualizar todas'))} (${outdated})</button></div>`);
		}
		if (!parsed.text && root.SynapseExtensionSync) {
			html.push(`<div class="xv-toolbar xv-toolbar-sync"><button type="button" class="xv-btn" data-act="sync-export">${esc(tr('Exportar lista'))}</button><button type="button" class="xv-btn" data-act="sync-import">${esc(tr('Importar lista'))}</button></div>`);
		}
		const slow = root.SynapseExtensionPerf ? root.SynapseExtensionPerf.slowAtStartup() : [];
		if (slow.length && !parsed.text) {
			html.push(`<div class="xv-banner xv-banner-perf" role="status"><strong>${esc(tr('Extensões lentas na inicialização'))}</strong> ${slow.map((entry) => `<button type="button" class="xv-link" data-act="details" data-id="${esc(entry.id)}" data-kind="installed">${esc(entry.name || entry.id)} (${Math.round(entry.ms)} ms)</button>`).join(', ')}</div>`);
		}
		html.push(sectionMarkup('installed', tr('Instaladas'), installed, installed.length ? '' : emptyMarkup(parsed.text || parsed.filters.flags.size ? tr('Nenhuma instalada corresponde ao filtro.') : tr('Nenhuma extensão instalada ainda.'))));
		if (recs.ids.length && !onlyInstalled) {
			html.push(sectionMarkup('recommended', tr('Recomendadas para este projeto'), recommendedMarket, recommendedMarket.length ? '' : emptyMarkup(tr('Todas as recomendações já estão instaladas.'))));
		}
		if (!onlyInstalled) html.push(sectionMarkup('market', tr('Marketplace'), market, marketStateMarkup(market.length)));
		listRoot.innerHTML = html.join('');
		void installedIds;
	}

	function scheduleMarketSearch(immediate) {
		clearTimeout(searchTimer);
		const run = async () => {
			if (!marketplace()) {
				marketState = 'off';
				return render();
			}
			const cfg = await marketplace().loadConfig().catch(() => null);
			if (cfg && cfg.enabled === false) {
				marketState = 'off';
				marketResults = [];
				return render();
			}
			marketState = 'loading';
			render();
			try {
				const parsed = parseQuery(query);
				marketResults = await marketplace().search(parsed.words.join(' '));
				marketState = 'ready';
				marketError = '';
			} catch (error) {
				marketState = 'error';
				marketError = error && error.message ? error.message : String(error);
				marketResults = [];
			}
			render();
		};
		if (immediate) run();
		else searchTimer = setTimeout(run, 220);
	}

	function itemById(id, kind) {
		if (kind === 'market') return marketItems().find((item) => item.id === id) || null;
		return installedItems().find((item) => item.id === id) || null;
	}

	async function guard(work, failTitle) {
		try {
			await work();
		} catch (error) {
			toast(failTitle, error && error.message ? error.message : String(error), 'err');
		}
		render();
	}

	async function runAction(act, id, kind, anchor) {
		const item = itemById(id, kind);
		if (act === 'install') {
			return guard(async () => {
				await installer().installFromRegistry(id, undefined, { origin: 'extensions-view' });
				toast(tr('Extensão instalada'), item ? item.name : id, 'ok');
			}, tr('Falha ao instalar'));
		}
		if (act === 'update') {
			return guard(async () => {
				await installer().installFromRegistry(id, item && item.update ? item.update.to : undefined, { origin: 'extensions-view', update: true });
				toast(tr('Extensão atualizada'), item ? item.name : id, 'ok');
				requireReload(tr('Extensão atualizada'));
			}, tr('Falha ao atualizar'));
		}
		if (act === 'update-all') {
			return guard(async () => {
				const result = await installer().updateAll();
				toast(tr('Extensões atualizadas'), typeof result === 'number' ? `${result} ${tr('atualizada(s)')}` : '', 'ok');
				requireReload(tr('Extensões atualizadas'));
			}, tr('Falha ao atualizar'));
		}
		if (act === 'enable' || act === 'disable') {
			return guard(() => registry().setEnabled(id, act === 'enable', 'global'), tr('Falha ao alterar estado'));
		}
		if (act === 'enable-workspace' || act === 'disable-workspace') {
			return guard(() => registry().setEnabled(id, act === 'enable-workspace', 'workspace'), tr('Falha ao alterar estado'));
		}
		if (act === 'uninstall') {
			const ok = typeof root.uiConfirm === 'function' ? await root.uiConfirm(tr('Desinstalar extensão'), `${item ? item.name : id}\n${tr('Os dados salvos pela extensão também serão removidos.')}`, tr('Desinstalar'), true) : confirm(tr('Desinstalar extensão?'));
			if (!ok) return;
			return guard(async () => {
				await installer().uninstall(id, { origin: 'extensions-view' });
				toast(tr('Extensão desinstalada'), item ? item.name : id, 'ok');
			}, tr('Falha ao desinstalar'));
		}
		if (act === 'rollback') {
			return guard(async () => {
				await installer().rollback(id);
				toast(tr('Versão anterior restaurada'), item ? item.name : id, 'ok');
				requireReload(tr('Extensão revertida'));
			}, tr('Falha ao reverter'));
		}
		if (act === 'sync-export') {
			return guard(async () => {
				const sync = root.SynapseExtensionSync;
				const choice = typeof root.uiConfirm === 'function' ? await root.uiConfirm(tr('Exportar extensões'), tr('Baixar um arquivo JSON com as extensões instaladas e suas configurações? Cancelar copia para a área de transferência.'), tr('Baixar'), false) : true;
				if (choice) {
					sync.download();
					toast(tr('Lista exportada'), tr('Arquivo JSON gerado.'), 'ok');
				} else {
					await sync.copyToClipboard();
					toast(tr('Lista copiada'), tr('JSON copiado para a área de transferência.'), 'ok');
				}
			}, tr('Falha ao exportar'));
		}
		if (act === 'sync-import') {
			return guard(async () => {
				const result = await root.SynapseExtensionSync.importInteractive();
				if (!result) return;
				toast(tr('Lista importada'), `${result.installed.length} ${tr('instalada(s)')}, ${result.failed.length} ${tr('falha(s)')}`, result.failed.length ? 'aviso' : 'ok');
				render();
			}, tr('Falha ao importar'));
		}
		if (act === 'details') return openDetails(id, kind);
		if (act === 'retry') return scheduleMarketSearch(true);
		if (act === 'market-enable') {
			return guard(async () => {
				await marketplace().setEnabled(true);
				toast(tr('Marketplace ativado'), tr('Buscando extensões no registro…'), 'ok');
				scheduleMarketSearch(true);
			}, tr('Falha ao ativar marketplace'));
		}
		if (act === 'menu') return openMenu(item, anchor);
		if (act === 'set-icon') {
			return guard(() => root.SynapseExtensionScaffold.setIcon(), tr('Falha ao definir ícone'));
		}
		if (act === 'copy-id') {
			try {
				await navigator.clipboard.writeText(id);
				toast(tr('ID copiado'), id, 'ok');
			} catch (error) {}
		}
	}

	function openDetails(id, kind) {
		if (details() && typeof details().open === 'function') {
			const item = itemById(id, kind);
			details().open(id, { entry: item && item.kind === 'market' ? item.raw : null });
			return;
		}
		toast(tr('Detalhes indisponíveis'), id, 'info');
	}

	function closeMenu() {
		const menu = document.getElementById('xvContextMenu');
		if (menu) menu.remove();
		document.removeEventListener('pointerdown', onMenuOutside, true);
		document.removeEventListener('keydown', onMenuKey, true);
	}

	function onMenuOutside(event) {
		const menu = document.getElementById('xvContextMenu');
		if (menu && !menu.contains(event.target)) closeMenu();
	}

	function onMenuKey(event) {
		if (event.key === 'Escape') {
			event.preventDefault();
			closeMenu();
		}
	}

	function openMenu(item, anchor) {
		closeMenu();
		if (!item || !anchor) return;
		const project = activeProject();
		const entries = [];
		entries.push({ act: 'details', label: tr('Detalhes') });
		if (item.source !== 'builtin') {
			entries.push({ act: item.enabled ? 'disable' : 'enable', label: item.enabled ? tr('Desabilitar (global)') : tr('Habilitar (global)') });
			if (project) entries.push({ act: item.enablementScope === 'workspace' ? 'enable-workspace' : 'disable-workspace', label: item.enablementScope === 'workspace' ? tr('Habilitar neste projeto') : tr('Desabilitar neste projeto') });
		}
		if (item.raw && installer() && installer().get(item.id) && installer().get(item.id).previous) entries.push({ act: 'rollback', label: tr('Reverter para versão anterior') });
		if (item.source === 'dev' && root.SynapseExtensionScaffold && typeof root.SynapseExtensionScaffold.setIcon === 'function') entries.push({ act: 'set-icon', label: tr('Definir ícone PNG/JPG…') });
		entries.push({ act: 'copy-id', label: tr('Copiar ID') });
		if (item.source !== 'builtin' && item.source !== 'dev') entries.push({ act: 'uninstall', label: tr('Desinstalar'), danger: true });
		const menu = document.createElement('div');
		menu.id = 'xvContextMenu';
		menu.className = 'xv-menu';
		menu.setAttribute('role', 'menu');
		menu.innerHTML = entries.map((entry) => `<button type="button" role="menuitem" class="xv-menu-item${entry.danger ? ' danger' : ''}" data-act="${entry.act}">${esc(entry.label)}</button>`).join('');
		document.body.appendChild(menu);
		const rect = anchor.getBoundingClientRect();
		const width = menu.offsetWidth || 200;
		const height = menu.offsetHeight || 40 * entries.length;
		let left = Math.min(rect.right - width, root.innerWidth - width - 8);
		let top = rect.bottom + 4;
		if (top + height > root.innerHeight - 8) top = Math.max(8, rect.top - height - 4);
		menu.style.left = `${Math.max(8, left)}px`;
		menu.style.top = `${top}px`;
		menu.addEventListener('click', (event) => {
			const button = event.target.closest('[data-act]');
			if (!button) return;
			closeMenu();
			runAction(button.dataset.act, item.id, item.kind, anchor);
		});
		document.addEventListener('pointerdown', onMenuOutside, true);
		document.addEventListener('keydown', onMenuKey, true);
		const first = menu.querySelector('[role="menuitem"]');
		if (first) first.focus();
	}

	function onListClick(event) {
		const actionButton = event.target.closest('[data-act]');
		if (actionButton) {
			event.preventDefault();
			event.stopPropagation();
			const row = actionButton.closest('.xv-row');
			runAction(actionButton.dataset.act, row ? row.dataset.id : '', row ? row.dataset.kind : '', actionButton);
			return;
		}
		const head = event.target.closest('.xv-section-head');
		if (head) {
			const sectionNode = head.closest('.xv-section');
			const key = sectionNode.dataset.section;
			const state = sectionsState();
			state[key] = !state[key];
			kvPut(SECTIONS_KEY, state);
			sectionNode.classList.toggle('collapsed', !!state[key]);
			head.setAttribute('aria-expanded', String(!state[key]));
			sectionNode.querySelector('.xv-section-body').classList.toggle('hidden', !!state[key]);
			return;
		}
		const row = event.target.closest('.xv-row');
		if (row) openDetails(row.dataset.id, row.dataset.kind);
	}

	function onListKey(event) {
		const row = event.target.closest('.xv-row');
		if (!row) return;
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			openDetails(row.dataset.id, row.dataset.kind);
		} else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			const rows = [...listRoot.querySelectorAll('.xv-row')];
			const index = rows.indexOf(row);
			const next = rows[index + (event.key === 'ArrowDown' ? 1 : -1)];
			if (next) next.focus();
		} else if (event.key === 'Delete' && row.dataset.kind === 'installed') {
			event.preventDefault();
			runAction('uninstall', row.dataset.id, 'installed', row);
		}
	}

	function paintHints() {
		if (!hintBox) return;
		const token = query.split(/\s+/).pop() || '';
		if (!token.startsWith('@')) {
			hintBox.classList.add('hidden');
			hintBox.innerHTML = '';
			return;
		}
		const options = FILTERS.filter((filter) => filter.startsWith(token.toLowerCase()) && filter !== token.toLowerCase());
		if (!options.length) return void hintBox.classList.add('hidden');
		hintBox.classList.remove('hidden');
		hintBox.innerHTML = options.map((filter) => `<button type="button" class="xv-hint" data-filter="${esc(filter)}">${esc(filter)}</button>`).join('');
	}

	function applyHint(filter) {
		const parts = query.split(/\s+/);
		parts.pop();
		parts.push(filter);
		query = parts.join(' ') + (filter.endsWith(':') ? '' : ' ');
		searchInput.value = query;
		searchInput.focus();
		onQueryChange();
	}

	function onQueryChange() {
		paintHints();
		render();
		const parsed = parseQuery(query);
		const onlyInstalled = ['@installed', '@enabled', '@disabled', '@outdated', '@running', '@builtin'].some((flag) => parsed.filters.flags.has(flag));
		if (!onlyInstalled) scheduleMarketSearch(false);
	}

	function requireReload(reason) {
		if (reason && !reloadReasons.includes(reason)) reloadReasons.push(reason);
		if (!reloadBar) return;
		reloadBar.classList.remove('hidden');
		reloadBar.querySelector('.xv-reload-text').textContent = `${tr('Recarregar necessário')} · ${reloadReasons.join(', ')}`;
		if (section && section.classList.contains('collapsed')) toggleSection(true);
	}

	function clearReload() {
		reloadReasons = [];
		if (reloadBar) reloadBar.classList.add('hidden');
	}

	function toggleSection(expanded) {
		if (!section) return;
		const next = expanded === undefined ? section.classList.contains('collapsed') : !!expanded;
		section.classList.toggle('collapsed', !next);
		body.classList.toggle('hidden', !next);
		section.querySelector('.ext-view-head').setAttribute('aria-expanded', String(next));
		kvPut(COLLAPSE_KEY, !next);
	}

	function mount() {
		if (section) return section;
		const explorer = document.getElementById('explorer');
		if (!explorer) return null;
		section = document.createElement('section');
		section.className = 'ext-view xv-view';
		section.id = 'extensionsView';
		section.dataset.viewId = 'synapse.extensions';
		const collapsed = kvGet(COLLAPSE_KEY, false) === true;
		if (collapsed) section.classList.add('collapsed');
		section.innerHTML =
			`<button type="button" class="ext-view-head" aria-expanded="${!collapsed}">` +
			`<span class="ext-view-chevron" aria-hidden="true">${icon('drop')}</span>` +
			`<span class="ext-view-name">${esc(tr('Extensões'))}</span>` +
			`<span class="xv-head-badge hidden" aria-live="polite"></span>` +
			`<span class="ext-view-owner">Ctrl+Shift+X</span>` +
			`</button>` +
			`<div class="ext-view-body xv-body${collapsed ? ' hidden' : ''}">` +
			`<div class="xv-reload hidden" role="status"><span class="xv-reload-text"></span><button type="button" class="xv-btn xv-btn-primary" data-reload="1">${esc(tr('Recarregar'))}</button><button type="button" class="xv-gear" data-reload-dismiss="1" aria-label="${esc(tr('Fechar'))}">${icon('close')}</button></div>` +
			`<div class="xv-search">${icon('search', 'xv-search-icon')}<input type="search" class="xv-search-input" placeholder="${esc(tr('Buscar extensões (@installed, @outdated, @category:…)'))}" aria-label="${esc(tr('Buscar extensões'))}" autocomplete="off" spellcheck="false" /><button type="button" class="xv-gear xv-refresh" data-refresh="1" title="${esc(tr('Verificar atualizações'))}" aria-label="${esc(tr('Verificar atualizações'))}">${icon('reload')}</button></div>` +
			`<div class="xv-hints hidden"></div>` +
			`<div class="xv-list-root"></div>` +
			`</div>`;
		const extViews = document.getElementById('extViews');
		if (extViews) explorer.insertBefore(section, extViews);
		else explorer.appendChild(section);
		body = section.querySelector('.xv-body');
		searchInput = section.querySelector('.xv-search-input');
		listRoot = section.querySelector('.xv-list-root');
		reloadBar = section.querySelector('.xv-reload');
		badge = section.querySelector('.xv-head-badge');
		hintBox = section.querySelector('.xv-hints');
		section.querySelector('.ext-view-head').addEventListener('click', () => toggleSection());
		searchInput.addEventListener('input', () => {
			query = searchInput.value;
			onQueryChange();
		});
		searchInput.addEventListener('keydown', (event) => {
			if (event.key === 'Escape' && query) {
				event.preventDefault();
				query = '';
				searchInput.value = '';
				onQueryChange();
			} else if (event.key === 'ArrowDown') {
				const first = listRoot.querySelector('.xv-row');
				if (first) {
					event.preventDefault();
					first.focus();
				}
			} else if (event.key === 'Tab' && !event.shiftKey && !hintBox.classList.contains('hidden')) {
				const first = hintBox.querySelector('.xv-hint');
				if (first) {
					event.preventDefault();
					applyHint(first.dataset.filter);
				}
			}
		});
		hintBox.addEventListener('click', (event) => {
			const hint = event.target.closest('.xv-hint');
			if (hint) applyHint(hint.dataset.filter);
		});
		section.querySelector('[data-refresh]').addEventListener('click', () => {
			guard(async () => {
				if (installer() && typeof installer().checkUpdates === 'function') await installer().checkUpdates({ force: true });
				scheduleMarketSearch(true);
			}, tr('Falha ao verificar atualizações'));
		});
		reloadBar.querySelector('[data-reload]').addEventListener('click', () => root.location.reload());
		reloadBar.querySelector('[data-reload-dismiss]').addEventListener('click', clearReload);
		listRoot.addEventListener('click', onListClick);
		listRoot.addEventListener('keydown', onListKey);
		listRoot.addEventListener('error', onIconError, true);
		render();
		scheduleMarketSearch(true);
		return section;
	}

	function reveal(options) {
		mount();
		if (!section) return;
		if (isMobile()) {
			const html = document.documentElement;
			if (!html.classList.contains('exp-open')) {
				const toggle = document.getElementById('auroraExpToggle');
				if (toggle) toggle.click();
			}
		}
		toggleSection(true);
		section.scrollIntoView({ block: 'nearest' });
		if (options && typeof options.query === 'string') {
			query = options.query;
			searchInput.value = query;
			onQueryChange();
		}
		if (!options || options.focus !== false) setTimeout(() => searchInput.focus({ preventScroll: true }), 30);
	}

	function notifyRecommendations() {
		const project = activeProject();
		if (!project || !project.id) return;
		const recs = recommendations();
		if (!recs.ids.length) return;
		const seen = kvGet(NOTIFIED_KEY, {});
		if (seen[project.id]) return;
		const installed = new Set(registry() ? registry().list().map((item) => item.id) : []);
		const missing = recs.ids.filter((id) => !installed.has(id) && !recs.unwanted.includes(id));
		if (!missing.length) return;
		seen[project.id] = Date.now();
		kvPut(NOTIFIED_KEY, seen);
		toast(tr('Extensões recomendadas'), `${tr('Este projeto recomenda')} ${missing.length} ${tr('extensão(ões). Abra a view Extensões com @recommended.')}`, 'info');
	}

	function bindEvents() {
		if (registry() && typeof registry().onDidChange === 'function') registry().onDidChange(() => render());
		if (registry() && typeof registry().onDidChangeProject === 'function') {
			registry().onDidChangeProject(() => {
				render();
				setTimeout(notifyRecommendations, 400);
			});
		}
		setTimeout(notifyRecommendations, 1500);
		if (installer() && typeof installer().onDidChangeUpdates === 'function') installer().onDidChangeUpdates(() => render());
		if (marketplace() && typeof marketplace().onDidChangeConfig === 'function') marketplace().onDidChangeConfig(() => scheduleMarketSearch(true));
		root.addEventListener('synapse:project-changed', () => render());
		root.addEventListener('synapse:extension-reload-required', (event) => requireReload(event.detail && event.detail.reason ? event.detail.reason : ''));
		document.addEventListener('synapse:language-changed', () => {
			if (!section) return;
			section.querySelector('.ext-view-name').textContent = tr('Extensões');
			searchInput.placeholder = tr('Buscar extensões (@installed, @outdated, @category:…)');
			render();
		});
	}

	function registerShortcut() {
		const register = () => {
			if (root.SynapseNativeShortcuts && typeof root.SynapseNativeShortcuts.register === 'function') {
				root.SynapseNativeShortcuts.register([
					{ id: 'synapse.extensions.show', label: tr('Mostrar Extensões'), defaultBinding: 'Mod+Shift+X', category: tr('Extensões'), run: () => reveal() },
					{ id: 'synapse.extensions.checkUpdates', label: tr('Verificar atualizações de extensões'), defaultBinding: '', category: tr('Extensões'), run: () => section && section.querySelector('[data-refresh]').click() },
				]);
				return true;
			}
			return false;
		};
		if (!register()) document.addEventListener('DOMContentLoaded', register, { once: true });
		document.addEventListener('keydown', (event) => {
			if (root.SynapseNativeShortcuts && root.SynapseNativeShortcuts.has && root.SynapseNativeShortcuts.has('synapse.extensions.show')) return;
			const mod = event.ctrlKey || event.metaKey;
			if (mod && event.shiftKey && !event.altKey && (event.key === 'X' || event.key === 'x')) {
				event.preventDefault();
				reveal();
			}
		});
	}

	function registerPalette() {
		if (!registry() || typeof registry().registerPaletteCommand !== 'function') return;
		const entries = [
			() => ({ id: 'synapse.extensions.show', label: tr('Extensões: Mostrar painel'), hint: 'Ctrl+Shift+X', icon: 'spark', run: () => reveal() }),
			() => ({ id: 'synapse.extensions.installed', label: tr('Extensões: Mostrar instaladas'), icon: 'spark', run: () => reveal({ query: '@installed ' }) }),
			() => ({ id: 'synapse.extensions.outdated', label: tr('Extensões: Mostrar desatualizadas'), icon: 'spark', run: () => reveal({ query: '@outdated ' }) }),
			() => ({ id: 'synapse.extensions.recommended', label: tr('Extensões: Mostrar recomendadas'), icon: 'spark', run: () => reveal({ query: '@recommended ' }) }),
			() => ({ id: 'synapse.extensions.running', label: tr('Extensões: Mostrar em execução'), icon: 'spark', run: () => reveal({ query: '@running ' }) }),
			() => ({ id: 'synapse.extensions.checkUpdates', label: tr('Extensões: Verificar atualizações'), icon: 'reload', run: () => (mount(), section.querySelector('[data-refresh]').click()) }),
		];
		entries.forEach((factory) => registry().registerPaletteCommand(factory));
	}

	function bootstrap() {
		const start = () => {
			mount();
			bindEvents();
			registerShortcut();
			registerPalette();
		};
		if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
		else start();
	}

	bootstrap();

	root.SynapseExtensionsView = Object.freeze({
		reveal,
		refresh: render,
		search: (text) => reveal({ query: text }),
		requireReload,
		clearReload,
		parseQuery,
		recommendations,
		FILTERS,
	});
})(window);
