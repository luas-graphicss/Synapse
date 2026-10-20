(function (root) {
	'use strict';

	const TABS = [
		{ id: 'details', label: 'Detalhes' },
		{ id: 'contributions', label: 'Contribuições' },
		{ id: 'changelog', label: 'Alterações' },
		{ id: 'permissions', label: 'Permissões' },
		{ id: 'versions', label: 'Versões' },
	];
	const README_NAMES = ['README.md', 'readme.md', 'Readme.md', 'README.MD', 'README'];
	const CHANGELOG_NAMES = ['CHANGELOG.md', 'changelog.md', 'Changelog.md', 'CHANGELOG'];
	const FETCH_TIMEOUT = 8000;

	const states = new Map();
	const remoteCache = new Map();

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

	function panels() {
		return root.SynapseHostPanels;
	}

	function markdown() {
		return root.SynapseMarkdownLite;
	}

	function permsDialog() {
		return root.SynapseExtensionPermissionsDialog;
	}

	function keybindings() {
		return root.SynapseExtensionKeybindings;
	}

	function format() {
		return root.SynapseShortcutFormat;
	}

	function compareVersions(a, b) {
		const pkg = root.SynapseExtensionPackage;
		if (pkg && typeof pkg.compareVersions === 'function') return pkg.compareVersions(a, b);
		return String(a).localeCompare(String(b), undefined, { numeric: true });
	}

	function panelKey(id) {
		return `extension-details:${id}`;
	}

	function fileText(files, names) {
		if (!files) return '';
		for (const name of names) {
			const value = files instanceof Map ? files.get(name) : files[name];
			if (typeof value === 'string') return value;
			if (value && typeof value.text === 'string') return value.text;
		}
		return '';
	}

	async function fetchText(url) {
		if (!url || !/^https:\/\//i.test(url)) return '';
		if (remoteCache.has(url)) return remoteCache.get(url);
		const controller = typeof AbortController === 'function' ? new AbortController() : null;
		const timer = controller ? setTimeout(() => controller.abort(), FETCH_TIMEOUT) : 0;
		try {
			const response = await fetch(url, { signal: controller ? controller.signal : undefined, cache: 'force-cache' });
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const text = await response.text();
			remoteCache.set(url, text);
			return text;
		} catch (error) {
			return '';
		} finally {
			clearTimeout(timer);
		}
	}

	function collect(id, entry) {
		const item = registry() ? registry().get(id) : null;
		const manifest = registry() ? registry().manifestOf(id) : null;
		const files = registry() ? registry().filesOf(id) : null;
		const installed = installer() ? installer().get(id) : null;
		const update = installer() ? installer().updates().find((update) => update.id === id) || null : null;
		return { id, item, manifest, files, installed, update, entry: entry || null };
	}

	function displayName(data) {
		if (data.manifest && data.manifest.name) return data.manifest.name;
		if (data.entry) return data.entry.displayName || data.entry.name || data.id;
		return data.id;
	}

	function metaOf(data) {
		const manifest = data.manifest || {};
		const entry = data.entry || {};
		return {
			publisher: manifest.publisher || entry.publisher || (data.id.includes('.') ? data.id.split('.')[0] : ''),
			version: manifest.version || (data.item ? data.item.version : '') || entry.latest || '',
			description: manifest.description || entry.description || '',
			categories: Array.isArray(manifest.categories) ? manifest.categories : Array.isArray(entry.categories) ? entry.categories : [],
			license: manifest.license || entry.license || '',
			repository: typeof manifest.repository === 'string' ? manifest.repository : manifest.repository && manifest.repository.url ? manifest.repository.url : entry.repository || '',
			homepage: manifest.homepage || entry.homepage || '',
			icon: (data.item && data.item.icon) || entry.icon || (/^(https?:|data:image\/|blob:)/i.test(String(manifest.icon || '')) ? manifest.icon : '') || '',
			installs: Number(entry.installs || entry.downloads || 0),
			verified: !!entry.verified,
			engines: manifest.engines || {},
		};
	}

	function githubRepo(url) {
		const match = /^https:\/\/github\.com\/([^/#?]+)\/([^/#?]+?)(?:\.git)?\/?$/i.exec(String(url || '').trim());
		return match ? { owner: match[1], repo: match[2] } : null;
	}

	function hostVersion() {
		return String(root.SYNAPSE_VERSION || root.APP_VERSION || '');
	}

	function recentProblems(id) {
		const audit = root.SynapseExtensionAudit;
		if (!audit || typeof audit.list !== 'function') return [];
		try {
			return audit.list({ extensionId: id, onlyProblems: true, limit: 8 });
		} catch (error) {
			return [];
		}
	}

	function reportUrl(data) {
		const meta = metaOf(data);
		const gh = githubRepo(meta.repository);
		if (!gh) return '';
		const item = data.item || {};
		const lines = [
			'## O que aconteceu',
			'',
			'(descreva o problema e como reproduzir)',
			'',
			'## Ambiente',
			'',
			`- Extensão: ${data.id} ${meta.version || ''}`.trim(),
			`- Estado: ${item.status || (data.item ? 'instalada' : 'não instalada')}${item.enabled === false ? ' (desabilitada)' : ''}${item.source ? ` · origem ${item.source}` : ''}`,
			`- Synapse IDE: ${hostVersion() || 'desconhecida'}`,
			`- Navegador: ${typeof navigator !== 'undefined' ? navigator.userAgent : ''}`,
		];
		if (item.lastError || item.error) lines.push('', '## Último erro', '', '```', String(item.lastError || item.error).slice(0, 800), '```');
		const problems = recentProblems(data.id);
		if (problems.length) {
			lines.push('', '## Atividade recente com falha', '', '```');
			problems.forEach((entry) => lines.push(`${new Date(entry.t).toISOString()} ${entry.kind} ${entry.method || ''} ${entry.code || ''} ${entry.error || ''}`.replace(/\s+/g, ' ').trim().slice(0, 200)));
			lines.push('```');
		}
		lines.push('', '_Aberto pela Synapse IDE. Nenhum dado foi enviado automaticamente; revise antes de publicar._');
		const params = new URLSearchParams({ title: `[${data.id}] `, body: lines.join('\n'), labels: 'bug' });
		return `https://github.com/${encodeURIComponent(gh.owner)}/${encodeURIComponent(gh.repo)}/issues/new?${params.toString()}`;
	}

	function initials(name) {
		const parts = String(name || '?').trim().split(/\s+/);
		return ((parts[0] || '?')[0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
	}

	function safeHref(url) {
		if (markdown() && typeof markdown().safeHref === 'function') return markdown().safeHref(url);
		return /^https?:\/\//i.test(url) ? url : '';
	}

	function headerMarkup(data) {
		const meta = metaOf(data);
		const name = displayName(data);
		const state = data.item;
		const badges = [];
		if (state) {
			if (state.status === 'error') badges.push(`<span class="xd-badge xd-badge-error">${esc(tr('Erro'))}</span>`);
			else if (!state.enabled) badges.push(`<span class="xd-badge xd-badge-off">${esc(state.enablementScope === 'workspace' ? tr('Desabilitada neste projeto') : tr('Desabilitada'))}</span>`);
			else if (state.status === 'active') badges.push(`<span class="xd-badge xd-badge-on">${esc(tr('Em execução'))}</span>`);
			else badges.push(`<span class="xd-badge">${esc(tr('Instalada'))}</span>`);
			if (state.source === 'builtin') badges.push(`<span class="xd-badge">${esc(tr('Integrada'))}</span>`);
			if (state.source === 'dev') badges.push(`<span class="xd-badge">${esc(tr('Desenvolvimento'))}</span>`);
		}
		if (meta.verified) badges.push(`<span class="xd-badge xd-badge-verified">${icon('lock')} ${esc(tr('Publicador verificado'))}</span>`);
		if (data.update) badges.push(`<span class="xd-badge xd-badge-update">${esc(tr('Atualização'))}: ${esc(data.update.to)}</span>`);
		const iconHtml = meta.icon && /^(https?:|data:image\/|blob:)/i.test(meta.icon) ? `<img class="xd-icon" src="${esc(meta.icon)}" alt="" />` : `<span class="xd-icon xd-icon-text" aria-hidden="true">${esc(initials(name))}</span>`;
		const stats = [meta.publisher ? `<span class="xd-stat">${esc(meta.publisher)}</span>` : '', meta.version ? `<span class="xd-stat">v${esc(meta.version)}</span>` : '', meta.installs ? `<span class="xd-stat">${esc(String(meta.installs))} ${esc(tr('instalações'))}</span>` : '', meta.license ? `<span class="xd-stat">${esc(meta.license)}</span>` : ''].filter(Boolean).join('<span class="xd-sep">·</span>');
		return (
			`<header class="xd-header">` +
			iconHtml +
			`<div class="xd-head-main">` +
			`<h1 class="xd-name">${esc(name)}<span class="xd-id" title="${esc(tr('Identificador'))}">${esc(data.id)}</span></h1>` +
			`<div class="xd-stats">${stats}</div>` +
			`<p class="xd-desc">${esc(meta.description || tr('Sem descrição.'))}</p>` +
			`<div class="xd-badges">${badges.join('')}</div>` +
			`<div class="xd-actions">${actionsMarkup(data)}</div>` +
			`</div>` +
			`</header>`
		);
	}

	function actionsMarkup(data) {
		const parts = [];
		if (!data.item) {
			parts.push(`<button type="button" class="xv-btn xv-btn-primary" data-act="install">${esc(tr('Instalar'))}</button>`);
		} else {
			if (data.update) parts.push(`<button type="button" class="xv-btn xv-btn-primary" data-act="update">${esc(tr('Atualizar para'))} ${esc(data.update.to)}</button>`);
			if (data.item.source !== 'builtin') {
				parts.push(`<button type="button" class="xv-btn" data-act="${data.item.enabled ? 'disable' : 'enable'}">${esc(data.item.enabled ? tr('Desabilitar') : tr('Habilitar'))}</button>`);
				if (typeof root.activeProject === 'function' && root.activeProject()) parts.push(`<button type="button" class="xv-btn" data-act="${data.item.enablementScope === 'workspace' ? 'enable-workspace' : 'disable-workspace'}">${esc(data.item.enablementScope === 'workspace' ? tr('Habilitar neste projeto') : tr('Desabilitar neste projeto'))}</button>`);
			}
			if (data.installed && data.installed.previous) parts.push(`<button type="button" class="xv-btn" data-act="rollback">${esc(tr('Reverter'))} ${esc(data.installed.previous.version || '')}</button>`);
			if (data.item.source !== 'builtin' && data.item.source !== 'dev') parts.push(`<button type="button" class="xv-btn xv-btn-danger" data-act="uninstall">${esc(tr('Desinstalar'))}</button>`);
			if (data.item.status === 'error') parts.push(`<button type="button" class="xv-btn" data-act="output">${esc(tr('Ver saída'))}</button>`);
		}
		if (githubRepo(metaOf(data).repository)) parts.push(`<button type="button" class="xv-btn" data-act="report" title="${esc(tr('Abre uma issue pré-preenchida no repositório do autor; nada é enviado sem você revisar.'))}">${esc(tr('Reportar problema'))}</button>`);
		return parts.join('');
	}

	function tabsMarkup(active) {
		return (
			`<nav class="xd-tabs" role="tablist" aria-label="${esc(tr('Seções da extensão'))}">` +
			TABS.map((tab) => `<button type="button" role="tab" class="xd-tab${tab.id === active ? ' active' : ''}" aria-selected="${tab.id === active}" data-tab="${tab.id}">${esc(tr(tab.label))}</button>`).join('') +
			`</nav>`
		);
	}

	function linksMarkup(meta) {
		const links = [];
		if (meta.repository && safeHref(meta.repository)) links.push(`<a href="${esc(safeHref(meta.repository))}" target="_blank" rel="noopener noreferrer">${esc(tr('Repositório'))}</a>`);
		if (meta.homepage && safeHref(meta.homepage)) links.push(`<a href="${esc(safeHref(meta.homepage))}" target="_blank" rel="noopener noreferrer">${esc(tr('Site'))}</a>`);
		if (!links.length && !meta.categories.length) return '';
		return (
			`<aside class="xd-side">` +
			(meta.categories.length ? `<h3>${esc(tr('Categorias'))}</h3><ul class="xd-chips">${meta.categories.map((cat) => `<li>${esc(cat)}</li>`).join('')}</ul>` : '') +
			(links.length ? `<h3>${esc(tr('Links'))}</h3><ul class="xd-links">${links.map((link) => `<li>${link}</li>`).join('')}</ul>` : '') +
			(meta.engines && meta.engines.synapse ? `<h3>${esc(tr('Requisito'))}</h3><p class="xd-mono">synapse ${esc(meta.engines.synapse)}</p>` : '') +
			`</aside>`
		);
	}

	async function detailsTab(data, container) {
		const meta = metaOf(data);
		let readme = fileText(data.files, README_NAMES);
		if (!readme && data.entry) readme = await fetchText(data.entry.readme || data.entry.readmeUrl || '');
		const bodyHtml = readme ? markdown().render(readme) : `<p class="xd-empty">${esc(tr('Esta extensão não inclui um README.'))}</p>`;
		container.innerHTML = `<div class="xd-columns"><article class="md-body xd-readme">${bodyHtml}</article>${linksMarkup(meta)}</div>`;
	}

	function contributionsTab(data, container) {
		const manifest = data.manifest || (data.entry && data.entry.manifest) || null;
		if (!manifest || !manifest.contributes) {
			container.innerHTML = `<p class="xd-empty">${esc(data.item ? tr('Esta extensão não declara contribuições.') : tr('Instale a extensão para ver as contribuições.'))}</p>`;
			return;
		}
		const contributes = manifest.contributes;
		const blocks = [];
		const commands = Array.isArray(contributes.commands) ? contributes.commands : [];
		if (commands.length) {
			const rows = commands
				.map((command) => {
					const shortcut = data.item && keybindings() ? keybindings().bindingLabel(data.id, command.command) : '';
					return `<tr><td class="xd-mono">${esc(command.command)}</td><td>${esc(command.category ? `${command.category}: ${command.title}` : command.title || '')}</td><td>${shortcut ? `<kbd>${esc(shortcut)}</kbd>` : '<span class="xd-muted">—</span>'}</td></tr>`;
				})
				.join('');
			blocks.push(`<section class="xd-block"><h3>${esc(tr('Comandos'))} <span class="xv-count">${commands.length}</span></h3><table class="xd-table"><thead><tr><th>${esc(tr('ID'))}</th><th>${esc(tr('Título'))}</th><th>${esc(tr('Atalho'))}</th></tr></thead><tbody>${rows}</tbody></table></section>`);
		}
		const keys = Array.isArray(contributes.keybindings) ? contributes.keybindings : [];
		if (keys.length) {
			const rows = keys.map((entry) => `<tr><td><kbd>${esc(entry.key || '')}</kbd></td><td class="xd-mono">${esc(entry.command || '')}</td><td class="xd-mono xd-muted">${esc(entry.when || '')}</td></tr>`).join('');
			blocks.push(`<section class="xd-block"><h3>${esc(tr('Atalhos padrão'))} <span class="xv-count">${keys.length}</span></h3><table class="xd-table"><thead><tr><th>${esc(tr('Tecla'))}</th><th>${esc(tr('Comando'))}</th><th>${esc(tr('Condição'))}</th></tr></thead><tbody>${rows}</tbody></table></section>`);
		}
		const config = contributes.configuration && contributes.configuration.properties ? contributes.configuration.properties : null;
		if (config && Object.keys(config).length) {
			const rows = Object.keys(config)
				.map((key) => {
					const prop = config[key] || {};
					return `<tr><td class="xd-mono">${esc(key)}</td><td>${esc(prop.type || '')}</td><td class="xd-mono">${esc(prop.default === undefined ? '' : JSON.stringify(prop.default))}</td><td>${esc(prop.description || '')}</td></tr>`;
				})
				.join('');
			blocks.push(`<section class="xd-block"><h3>${esc(tr('Configurações'))} <span class="xv-count">${Object.keys(config).length}</span></h3><table class="xd-table"><thead><tr><th>${esc(tr('Chave'))}</th><th>${esc(tr('Tipo'))}</th><th>${esc(tr('Padrão'))}</th><th>${esc(tr('Descrição'))}</th></tr></thead><tbody>${rows}</tbody></table></section>`);
		}
		const menus = contributes.menus && typeof contributes.menus === 'object' ? contributes.menus : null;
		if (menus && Object.keys(menus).length) {
			const rows = [];
			Object.keys(menus).forEach((location) => {
				(Array.isArray(menus[location]) ? menus[location] : []).forEach((entry) => rows.push(`<tr><td class="xd-mono">${esc(location)}</td><td class="xd-mono">${esc(entry.command || '')}</td><td class="xd-mono xd-muted">${esc(entry.when || '')}</td></tr>`));
			});
			blocks.push(`<section class="xd-block"><h3>${esc(tr('Menus'))} <span class="xv-count">${rows.length}</span></h3><table class="xd-table"><thead><tr><th>${esc(tr('Local'))}</th><th>${esc(tr('Comando'))}</th><th>${esc(tr('Condição'))}</th></tr></thead><tbody>${rows.join('')}</tbody></table></section>`);
		}
		const views = contributes.views && Array.isArray(contributes.views.sidebar) ? contributes.views.sidebar : [];
		if (views.length) {
			blocks.push(`<section class="xd-block"><h3>${esc(tr('Views laterais'))} <span class="xv-count">${views.length}</span></h3><ul class="xd-plain">${views.map((view) => `<li><strong>${esc(view.name || view.id)}</strong> <span class="xd-mono xd-muted">${esc(view.id)}</span></li>`).join('')}</ul></section>`);
		}
		const activation = Array.isArray(manifest.activationEvents) ? manifest.activationEvents : [];
		if (activation.length) {
			blocks.push(`<section class="xd-block"><h3>${esc(tr('Eventos de ativação'))}</h3><ul class="xd-chips">${activation.map((event) => `<li class="xd-mono">${esc(event)}</li>`).join('')}</ul></section>`);
		}
		container.innerHTML = blocks.length ? blocks.join('') : `<p class="xd-empty">${esc(tr('Esta extensão não declara contribuições.'))}</p>`;
	}

	async function changelogTab(data, container) {
		let changelog = fileText(data.files, CHANGELOG_NAMES);
		if (!changelog && data.entry) changelog = await fetchText(data.entry.changelog || data.entry.changelogUrl || '');
		if (!changelog && data.entry && Array.isArray(data.entry.versions)) {
			const notes = data.entry.versions.filter((version) => version.notes || version.changelog);
			if (notes.length) changelog = notes.map((version) => `## ${version.version}\n\n${version.notes || version.changelog}`).join('\n\n');
		}
		container.innerHTML = changelog ? `<article class="md-body xd-readme">${markdown().render(changelog)}</article>` : `<p class="xd-empty">${esc(tr('Nenhum histórico de alterações disponível.'))}</p>`;
	}

	function permissionsTab(data, container) {
		const manifest = data.manifest || (data.entry && data.entry.manifest) || null;
		const permissions = manifest && Array.isArray(manifest.permissions) ? manifest.permissions : data.entry && Array.isArray(data.entry.permissions) ? data.entry.permissions : [];
		if (!permsDialog()) {
			container.innerHTML = `<ul class="xd-plain">${permissions.map((permission) => `<li class="xd-mono">${esc(permission)}</li>`).join('')}</ul>`;
			return;
		}
		const described = permsDialog().describeAll({ permissions });
		const risky = described.filter((entry) => entry.risk === 'alto' || entry.risk === 'high').length;
		container.innerHTML =
			(risky ? `<div class="xd-warning">${icon('warn')} ${esc(tr('Esta extensão pede permissões de alto risco. Instale apenas se confiar no publicador.'))}</div>` : '') +
			permsDialog().permissionsMarkup(described) +
			(data.item && data.item.status === 'error' && /permiss/i.test(data.item.error || '') ? `<p class="xd-error">${esc(data.item.error)}</p>` : '');
	}

	async function versionsTab(data, container) {
		let entry = data.entry;
		if (!entry && marketplace()) {
			try {
				entry = await marketplace().find(data.id);
			} catch (error) {
				entry = null;
			}
		}
		const current = data.manifest ? data.manifest.version : '';
		const rows = [];
		if (entry && Array.isArray(entry.versions)) {
			entry.versions
				.slice()
				.sort((a, b) => compareVersions(b.version, a.version))
				.forEach((version) => {
					const isCurrent = version.version === current;
					const newer = current && compareVersions(version.version, current) > 0;
					const pkg = root.SynapseExtensionPackage;
					const blocked = pkg && typeof pkg.engineProblem === 'function' ? pkg.engineProblem({ engines: version.engines }) : '';
					const action = isCurrent ? `<span class="xd-badge xd-badge-on">${esc(tr('Atual'))}</span>` : blocked ? `<span class="xd-muted" title="${esc(blocked)}">${esc(tr('Incompatível'))}</span>` : `<button type="button" class="xv-btn" data-act="install-version" data-version="${esc(version.version)}">${esc(newer ? tr('Atualizar') : data.item ? tr('Instalar esta versão') : tr('Instalar'))}</button>`;
					rows.push(`<tr class="${isCurrent ? 'current' : ''}"><td class="xd-mono">${esc(version.version)}</td><td>${esc(version.publishedAt ? new Date(version.publishedAt).toLocaleDateString() : '')}</td><td class="xd-mono xd-muted">${esc(version.engines && version.engines.synapse ? version.engines.synapse : '')}</td><td class="xd-mono xd-muted" title="${esc(version.sha256 || '')}">${esc(version.sha256 ? version.sha256.slice(0, 12) + '…' : '')}</td><td>${action}</td></tr>`);
				});
		}
		if (data.installed && data.installed.previous && data.installed.previous.version && !rows.some((row) => row.includes(`>${esc(data.installed.previous.version)}<`))) {
			rows.push(`<tr><td class="xd-mono">${esc(data.installed.previous.version)}</td><td>${esc(tr('Backup local'))}</td><td></td><td></td><td><button type="button" class="xv-btn" data-act="rollback">${esc(tr('Reverter'))}</button></td></tr>`);
		}
		container.innerHTML = rows.length
			? `<table class="xd-table"><thead><tr><th>${esc(tr('Versão'))}</th><th>${esc(tr('Publicada'))}</th><th>${esc(tr('Requisito'))}</th><th>SHA-256</th><th></th></tr></thead><tbody>${rows.join('')}</tbody></table>`
			: `<p class="xd-empty">${esc(current ? `${tr('Somente a versão instalada')} (${current}) ${tr('é conhecida.')}` : tr('Nenhuma versão disponível.'))}</p>`;
	}

	const RENDERERS = { details: detailsTab, contributions: contributionsTab, changelog: changelogTab, permissions: permissionsTab, versions: versionsTab };

	async function renderTab(state) {
		const body = state.container.querySelector('.xd-tab-body');
		if (!body) return;
		const token = ++state.token;
		body.innerHTML = `<div class="xd-loading">${esc(tr('Carregando…'))}</div>`;
		const data = collect(state.id, state.entry);
		try {
			await RENDERERS[state.tab](data, body);
		} catch (error) {
			if (token === state.token) body.innerHTML = `<p class="xd-error">${esc(error && error.message ? error.message : String(error))}</p>`;
		}
	}

	function paint(state) {
		const data = collect(state.id, state.entry);
		state.container.innerHTML = `<div class="xd-root">${headerMarkup(data)}${tabsMarkup(state.tab)}<div class="xd-tab-body" role="tabpanel"></div></div>`;
		renderTab(state);
		if (panels()) panels().setTitle(panelKey(state.id), displayName(data), data.manifest ? `v${data.manifest.version}` : metaOf(data).version ? `v${metaOf(data).version}` : tr('Marketplace'));
	}

	async function guard(work, failTitle) {
		try {
			await work();
		} catch (error) {
			toast(failTitle, error && error.message ? error.message : String(error), 'err');
		}
	}

	function requireReload(reason) {
		if (root.SynapseExtensionsView && typeof root.SynapseExtensionsView.requireReload === 'function') root.SynapseExtensionsView.requireReload(reason);
	}

	async function act(state, action, target) {
		const data = collect(state.id, state.entry);
		const name = displayName(data);
		if (action === 'install') return guard(async () => (await installer().installFromRegistry(state.id, undefined, { origin: 'extension-details' }), toast(tr('Extensão instalada'), name, 'ok')), tr('Falha ao instalar'));
		if (action === 'install-version') {
			const version = target.dataset.version;
			return guard(async () => {
				await installer().installFromRegistry(state.id, version, { origin: 'extension-details' });
				toast(tr('Versão instalada'), `${name} ${version}`, 'ok');
				if (data.item) requireReload(tr('Versão alterada'));
			}, tr('Falha ao instalar versão'));
		}
		if (action === 'update') return guard(async () => (await installer().installFromRegistry(state.id, data.update ? data.update.to : undefined, { origin: 'extension-details', update: true }), toast(tr('Extensão atualizada'), name, 'ok'), requireReload(tr('Extensão atualizada'))), tr('Falha ao atualizar'));
		if (action === 'enable' || action === 'disable') return guard(() => registry().setEnabled(state.id, action === 'enable', 'global'), tr('Falha ao alterar estado'));
		if (action === 'enable-workspace' || action === 'disable-workspace') return guard(() => registry().setEnabled(state.id, action === 'enable-workspace', 'workspace'), tr('Falha ao alterar estado'));
		if (action === 'rollback') return guard(async () => (await installer().rollback(state.id), toast(tr('Versão anterior restaurada'), name, 'ok'), requireReload(tr('Extensão revertida'))), tr('Falha ao reverter'));
		if (action === 'output') {
			if (root.SynapseExtensionOutput && typeof root.SynapseExtensionOutput.show === 'function') root.SynapseExtensionOutput.show();
			return;
		}
		if (action === 'report') {
			const url = reportUrl(data);
			if (!url) return toast(tr('Sem repositório'), tr('Esta extensão não informa um repositório no GitHub.'), 'warn');
			const opened = root.open(url, '_blank', 'noopener,noreferrer');
			if (!opened) toast(tr('Pop-up bloqueado'), tr('Permita pop-ups para abrir a issue no GitHub.'), 'warn');
			return;
		}
		if (action === 'uninstall') {
			const ok = typeof root.uiConfirm === 'function' ? await root.uiConfirm(tr('Desinstalar extensão'), `${name}\n${tr('Os dados salvos pela extensão também serão removidos.')}`, tr('Desinstalar'), true) : confirm(tr('Desinstalar extensão?'));
			if (!ok) return;
			return guard(async () => {
				await installer().uninstall(state.id, { origin: 'extension-details' });
				toast(tr('Extensão desinstalada'), name, 'ok');
			}, tr('Falha ao desinstalar'));
		}
	}

	function bind(state) {
		state.container.addEventListener('click', (event) => {
			const tab = event.target.closest('[data-tab]');
			if (tab) {
				state.tab = tab.dataset.tab;
				state.container.querySelectorAll('.xd-tab').forEach((node) => {
					const active = node.dataset.tab === state.tab;
					node.classList.toggle('active', active);
					node.setAttribute('aria-selected', String(active));
				});
				renderTab(state);
				return;
			}
			const button = event.target.closest('[data-act]');
			if (button) act(state, button.dataset.act, button);
		});
		state.container.addEventListener('keydown', (event) => {
			const tab = event.target.closest('[data-tab]');
			if (!tab || (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft')) return;
			event.preventDefault();
			const index = TABS.findIndex((entry) => entry.id === tab.dataset.tab);
			const next = TABS[(index + (event.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
			const node = state.container.querySelector(`[data-tab="${next.id}"]`);
			if (node) {
				node.focus();
				node.click();
			}
		});
	}

	function open(id, options) {
		if (!panels() || typeof id !== 'string' || !id) return;
		options = options || {};
		let state = states.get(id);
		if (!state) {
			state = { id, entry: options.entry || null, tab: options.tab || 'details', container: null, token: 0, bound: false };
			states.set(id, state);
		} else if (options.entry) state.entry = options.entry;
		if (options.tab) state.tab = options.tab;
		if (!state.entry && marketplace()) {
			marketplace()
				.find(id)
				.then((entry) => {
					if (entry && states.get(id) === state) {
						state.entry = entry;
						if (state.container) paint(state);
					}
				})
				.catch(() => {});
		}
		panels().open({
			key: panelKey(id),
			title: displayName(collect(id, state.entry)),
			icon: 'spark',
			render: (container) => {
				state.container = container;
				if (!state.bound) {
					bind(state);
					state.bound = true;
				}
				paint(state);
			},
			onClose: () => {
				states.delete(id);
			},
			refresh: true,
		});
	}

	function refreshAll() {
		states.forEach((state) => {
			if (state.container && panels() && panels().has(panelKey(state.id))) paint(state);
		});
	}

	function bindGlobal() {
		if (registry() && typeof registry().onDidChange === 'function') registry().onDidChange(refreshAll);
		if (installer() && typeof installer().onDidChangeUpdates === 'function') installer().onDidChangeUpdates(refreshAll);
		document.addEventListener('synapse:language-changed', refreshAll);
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindGlobal, { once: true });
	else bindGlobal();

	root.SynapseExtensionDetails = Object.freeze({ open, refreshAll, TABS });
})(window);
