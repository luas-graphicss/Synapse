(function (root) {
	'use strict';

	const MAX_HTML_BYTES = 2 * 1024 * 1024;
	const MAX_MESSAGE_BYTES = 1024 * 1024;
	const MAX_PANELS_PER_EXTENSION = 8;
	const MAX_TITLE = 80;
	const NONCE_PATTERN = /^[a-f0-9]{32}$/;
	const VIEW_HEIGHT_KEY = 'synapse.ext.views.collapsed';
	const records = new Map();
	const views = new Map();
	const order = [];
	let activePanelKey = null;
	let layer = null;
	let viewsRoot = null;
	let integrated = false;
	let themeTimer = null;
	let listening = false;

	function kit() {
		return root.SynapseExtensionWebviewKit;
	}

	function rpc() {
		return root.SynapseExtensionRpc;
	}

	function registry() {
		return root.SynapseExtensions;
	}

	function output() {
		return root.SynapseExtensionOutput;
	}

	function fail(code, message, data) {
		const api = rpc();
		return new api.RpcError(api.ERROR_CODES[code] || code, message, data);
	}

	function esc(text) {
		return typeof root.escaparHtml === 'function' ? root.escaparHtml(String(text)) : String(text).replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
	}

	function icon(name, className) {
		return typeof root.iconSvg === 'function' ? root.iconSvg(name, className) : '';
	}

	function clip(text, limit) {
		const value = String(text === undefined || text === null ? '' : text);
		return value.length > limit ? value.slice(0, limit - 1) + '…' : value;
	}

	function byteLength(text) {
		return new TextEncoder().encode(text).length;
	}

	function keyOf(context, handle) {
		return `${context.descriptor.id}/${String(handle)}`;
	}

	function require(context, handle) {
		const record = records.get(keyOf(context, handle));
		if (!record || record.disposed) throw fail('INVALID_PARAMS', `Webview "${handle}" não existe ou já foi descartada.`);
		return record;
	}

	function extensionName(extensionId) {
		const item = registry() ? registry().get(extensionId) : null;
		return item ? item.name : extensionId;
	}

	function ensureListening() {
		if (listening) return;
		listening = true;
		root.addEventListener('message', onWindowMessage);
		const observer = new MutationObserver(() => {
			clearTimeout(themeTimer);
			themeTimer = setTimeout(broadcastTheme, 60);
		});
		observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style', 'class'] });
	}

	function broadcastTheme() {
		if (!records.size) return;
		const theme = kit().themeSnapshot();
		records.forEach((record) => send(record, 'theme', theme));
	}

	function send(record, type, data) {
		if (record.disposed || !record.iframe || !record.iframe.contentWindow) return false;
		if (!record.ready) {
			record.queue.push({ type, data });
			return true;
		}
		try {
			record.iframe.contentWindow.postMessage({ __synapse: 1, type, data }, '*');
			return true;
		} catch (error) {
			return false;
		}
	}

	function onWindowMessage(event) {
		const message = event.data;
		if (!message || message.__synapse !== 1 || !event.source) return;
		let record = null;
		for (const candidate of records.values()) {
			if (candidate.iframe && candidate.iframe.contentWindow === event.source) {
				record = candidate;
				break;
			}
		}
		if (!record || record.disposed) return;
		if (message.type === 'ready') {
			record.ready = true;
			const queue = record.queue.splice(0);
			queue.forEach((entry) => send(record, entry.type, entry.data));
			return;
		}
		if (message.type === 'state') {
			record.state = message.data;
			return;
		}
		if (message.type === 'message') {
			let size = 0;
			try {
				size = byteLength(JSON.stringify(message.data));
			} catch (error) {
				size = MAX_MESSAGE_BYTES + 1;
			}
			if (size > MAX_MESSAGE_BYTES) {
				output().warn(record.extensionId, `Webview "${record.title}": mensagem acima de 1 MB ignorada.`);
				return;
			}
			registry().notifyExtension(record.extensionId, 'webview.message', { handle: record.handle, data: message.data });
			return;
		}
		if (message.type === 'openExternal') openExternal(record, String(message.data || ''));
	}

	async function openExternal(record, href) {
		const policy = root.SynapseUrlPolicy;
		const target = policy ? policy.navigationUrl(href, '') : '';
		if (!target) {
			output().warn(record.extensionId, `Link recusado pela política de navegação: "${clip(href, 120)}".`);
			return;
		}
		let allowed = true;
		if (typeof root.uiDialog === 'function') {
			const result = await root.uiDialog({
				title: 'Abrir link externo',
				message: `${extensionName(record.extensionId)} quer abrir:\n${target}`,
				buttons: [
					{ id: 'cancel', label: 'Cancelar' },
					{ id: 'open', label: 'Abrir', primary: true },
				],
			});
			allowed = result && result.act === 'open';
		}
		if (allowed) root.open(target, '_blank', 'noopener,noreferrer');
	}

	function createFrame(record) {
		const iframe = document.createElement('iframe');
		iframe.className = 'ext-webview-frame';
		iframe.setAttribute('sandbox', 'allow-scripts allow-forms');
		iframe.setAttribute('referrerpolicy', 'no-referrer');
		iframe.setAttribute('title', record.title);
		iframe.setAttribute('loading', 'eager');
		return iframe;
	}

	function render(record) {
		if (record.disposed || !record.iframe) return;
		record.ready = false;
		record.queue.length = 0;
		record.iframe.srcdoc = kit().buildDocument({
			html: record.html,
			title: record.title,
			hostNonce: record.hostNonce,
			userNonce: record.userNonce,
			enableScripts: record.options.enableScripts,
			state: record.state,
		});
		record.loaded = true;
	}

	function unload(record) {
		if (!record.iframe || !record.loaded) return;
		record.iframe.srcdoc = '';
		record.loaded = false;
		record.ready = false;
	}

	function ensureLayer() {
		if (layer) return layer;
		const pane = document.getElementById('editorPane');
		if (!pane) return null;
		layer = document.createElement('div');
		layer.className = 'ext-webview-layer hidden';
		layer.id = 'extWebviewLayer';
		layer.setAttribute('role', 'tabpanel');
		const scroll = document.getElementById('editorScroll');
		if (scroll && scroll.parentElement === pane) pane.insertBefore(layer, scroll.nextSibling);
		else pane.appendChild(layer);
		return layer;
	}

	function ensureIntegration() {
		if (integrated) return;
		integrated = true;
		ensureLayer();
		const originalRender = root.renderEditorTabs;
		if (typeof originalRender === 'function') {
			root.renderEditorTabs = function () {
				const result = originalRender.apply(this, arguments);
				paintTabs();
				return result;
			};
		}
		const originalOpen = root.openFileInEditor;
		if (typeof originalOpen === 'function') {
			root.openFileInEditor = function () {
				if (activePanelKey) hidePanels();
				return originalOpen.apply(this, arguments);
			};
		}
		const originalClose = root.closeTab;
		if (typeof originalClose === 'function') {
			root.closeTab = function () {
				const result = originalClose.apply(this, arguments);
				if (activePanelKey) presentActive();
				return result;
			};
		}
		const tabs = root.el && root.el.editorTabs;
		if (tabs) {
			tabs.addEventListener('click', (event) => {
				const close = event.target.closest('[data-webview-close]');
				if (close) {
					event.stopPropagation();
					disposeRecord(records.get(close.dataset.webviewClose), true);
					return;
				}
				const tab = event.target.closest('[data-tab-webview]');
				if (!tab) return;
				event.stopPropagation();
				activatePanel(tab.dataset.tabWebview, false);
			});
			tabs.addEventListener('mousedown', (event) => {
				const tab = event.target.closest('[data-tab-webview]');
				if (event.button === 1 && tab) {
					event.preventDefault();
					disposeRecord(records.get(tab.dataset.tabWebview), true);
				}
			});
		}
	}

	function panelRecords() {
		return order.map((key) => records.get(key)).filter((record) => record && record.kind === 'panel' && !record.disposed);
	}

	function paintTabs() {
		const tabs = root.el && root.el.editorTabs;
		if (!tabs) return;
		const panels = panelRecords();
		tabs.querySelectorAll('[data-tab-webview]').forEach((node) => node.parentElement.remove());
		if (!panels.length) return;
		tabs.classList.remove('hidden');
		if (activePanelKey) {
			tabs.querySelectorAll('.etab.active').forEach((node) => node.classList.remove('active'));
			tabs.querySelectorAll('[role="tab"][aria-selected="true"]').forEach((node) => node.setAttribute('aria-selected', 'false'));
		}
		const fragment = document.createDocumentFragment();
		panels.forEach((record) => {
			const active = record.key === activePanelKey;
			const tab = document.createElement('div');
			tab.className = 'etab ext-webview-tab' + (active ? ' active' : '');
			tab.setAttribute('role', 'presentation');
			tab.innerHTML =
				`<button type="button" class="etselect" role="tab" aria-selected="${active}" aria-controls="extWebviewLayer" tabindex="${active ? 0 : -1}" data-tab-webview="${esc(record.key)}" title="${esc(record.title)} · ${esc(extensionName(record.extensionId))}">` +
				`<span class="etico ext-webview-tab-icon" aria-hidden="true">${icon('eye')}</span><span class="etname">${esc(record.title)}</span></button>` +
				`<button type="button" class="etclose" data-webview-close="${esc(record.key)}" aria-label="Fechar ${esc(record.title)}" tabindex="${active ? 0 : -1}">${icon('close')}</button>`;
			fragment.appendChild(tab);
		});
		tabs.appendChild(fragment);
		const activeTab = tabs.querySelector('.ext-webview-tab.active');
		if (activeTab) activeTab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
	}

	function presentActive() {
		const record = records.get(activePanelKey);
		if (!record || record.disposed) {
			activePanelKey = null;
			return;
		}
		const el = root.el || {};
		ensureLayer();
		const hostPanels = root.SynapseHostPanels;
		if (hostPanels && hostPanels.activeKey && typeof hostPanels.hide === 'function') hostPanels.hide();
		if (el.editorScroll) el.editorScroll.classList.add('hidden');
		layer.classList.remove('hidden');
		layer.querySelectorAll('.ext-webview-panel').forEach((node) => node.classList.toggle('hidden', node.dataset.key !== record.key));
		if (el.editorTitle) {
			el.editorTitle.textContent = record.title;
			el.editorTitle.title = record.title;
		}
		if (el.editorPath) {
			el.editorPath.textContent = extensionName(record.extensionId);
			el.editorPath.title = record.extensionId;
		}
		if (el.editorDirty) el.editorDirty.classList.remove('on');
		if (!record.loaded) render(record);
		setViewState(record, true, true);
		paintTabs();
	}

	function hidePanels() {
		const previous = records.get(activePanelKey);
		activePanelKey = null;
		if (layer) layer.classList.add('hidden');
		const el = root.el || {};
		if (el.editorScroll) el.editorScroll.classList.remove('hidden');
		if (previous && !previous.disposed) {
			setViewState(previous, false, false);
			if (!previous.options.retainContextWhenHidden) unload(previous);
		}
	}

	function activatePanel(key, preserveFocus) {
		const record = records.get(key);
		if (!record || record.disposed || record.kind !== 'panel') return;
		const previous = activePanelKey && activePanelKey !== key ? records.get(activePanelKey) : null;
		if (previous && !previous.disposed) {
			setViewState(previous, false, false);
			if (!previous.options.retainContextWhenHidden) unload(previous);
		}
		activePanelKey = key;
		if (root.SynapseEditorDocuments && typeof root.SynapseEditorDocuments.rememberView === 'function') {
			try {
				root.SynapseEditorDocuments.rememberView();
			} catch (error) {}
		}
		presentActive();
		if (!preserveFocus && record.iframe) setTimeout(() => record.iframe.focus({ preventScroll: true }), 30);
	}

	function setViewState(record, active, visible) {
		if (record.active === active && record.visible === visible) return;
		record.active = active;
		record.visible = visible;
		registry().notifyExtension(record.extensionId, 'webview.viewState', { handle: record.handle, active, visible });
	}

	function restoreEditorAfterPanel() {
		const el = root.el || {};
		if (layer) layer.classList.add('hidden');
		if (el.editorScroll) el.editorScroll.classList.remove('hidden');
		const project = typeof root.activeProject === 'function' ? root.activeProject() : null;
		if (project && project.openFile && typeof root.openFileInEditor === 'function') {
			root.openFileInEditor(project.openFile);
			return;
		}
		if (el.editorTitle) {
			el.editorTitle.textContent = 'Nenhum arquivo';
			el.editorTitle.title = '';
		}
		if (el.editorPath) {
			el.editorPath.textContent = '';
			el.editorPath.title = '';
		}
		if (typeof root.renderEditorTabs === 'function') root.renderEditorTabs();
	}

	function createPanel(params, context) {
		ensureListening();
		ensureIntegration();
		const extensionId = context.descriptor.id;
		const open = [...records.values()].filter((record) => record.extensionId === extensionId && record.kind === 'panel' && !record.disposed);
		if (open.length >= MAX_PANELS_PER_EXTENSION) throw fail('HOST_ERROR', `Limite de ${MAX_PANELS_PER_EXTENSION} painéis simultâneos por extensão.`);
		const key = keyOf(context, params.handle);
		if (records.has(key)) throw fail('INVALID_PARAMS', `Webview "${params.handle}" já existe.`);
		const options = params.options || {};
		const record = {
			key,
			handle: String(params.handle),
			extensionId,
			kind: 'panel',
			viewType: String(params.viewType || 'webview'),
			title: clip(params.title || extensionName(extensionId), MAX_TITLE),
			options: { enableScripts: options.enableScripts !== false, retainContextWhenHidden: options.retainContextWhenHidden !== false },
			html: '',
			state: null,
			hostNonce: kit().nonce(),
			userNonce: NONCE_PATTERN.test(String(params.nonce || '')) ? String(params.nonce) : kit().nonce(),
			iframe: null,
			container: null,
			ready: false,
			loaded: false,
			queue: [],
			active: false,
			visible: false,
			disposed: false,
		};
		const container = document.createElement('div');
		container.className = 'ext-webview-panel hidden';
		container.dataset.key = key;
		container.dataset.extension = extensionId;
		record.iframe = createFrame(record);
		container.appendChild(record.iframe);
		ensureLayer().appendChild(container);
		record.container = container;
		records.set(key, record);
		order.push(key);
		const show = params.showOptions || {};
		if (show.preserveFocus && activePanelKey) paintTabs();
		else activatePanel(key, !!show.preserveFocus);
		return { handle: record.handle, cspSource: `'nonce-${record.userNonce}'`, nonce: record.userNonce };
	}

	function disposeRecord(record, notify) {
		if (!record || record.disposed) return false;
		record.disposed = true;
		records.delete(record.key);
		const index = order.indexOf(record.key);
		if (index !== -1) order.splice(index, 1);
		if (record.container) record.container.remove();
		if (record.kind === 'view') {
			const view = views.get(record.viewId);
			if (view && view.record === record) {
				view.record = null;
				paintViewBody(view);
			}
		}
		if (notify) registry().notifyExtension(record.extensionId, 'webview.disposed', { handle: record.handle });
		if (activePanelKey === record.key) {
			activePanelKey = null;
			const remaining = panelRecords();
			if (remaining.length) activatePanel(remaining[remaining.length - 1].key, false);
			else restoreEditorAfterPanel();
		} else if (typeof root.renderEditorTabs === 'function' && integrated) paintTabs();
		return true;
	}

	function setHtml(params, context) {
		const record = require(context, params.handle);
		const html = String(params.html === undefined ? '' : params.html);
		if (byteLength(html) > MAX_HTML_BYTES) throw fail('INVALID_PARAMS', 'HTML da webview excede 2 MB.');
		record.html = html;
		if (record.kind === 'view' || record.key === activePanelKey || record.options.retainContextWhenHidden) render(record);
		else record.loaded = false;
		return true;
	}

	function setTitle(params, context) {
		const record = require(context, params.handle);
		record.title = clip(params.title || record.title, MAX_TITLE);
		if (record.iframe) record.iframe.setAttribute('title', record.title);
		if (record.kind === 'panel') {
			paintTabs();
			if (record.key === activePanelKey && root.el && root.el.editorTitle) root.el.editorTitle.textContent = record.title;
		} else {
			const view = views.get(record.viewId);
			if (view) paintViewHead(view);
		}
		return true;
	}

	function setOptions(params, context) {
		const record = require(context, params.handle);
		const options = params.options || {};
		if ('enableScripts' in options) record.options.enableScripts = !!options.enableScripts;
		if ('retainContextWhenHidden' in options) record.options.retainContextWhenHidden = !!options.retainContextWhenHidden;
		if (record.loaded) render(record);
		return true;
	}

	function postMessage(params, context) {
		const record = require(context, params.handle);
		if (record.kind === 'panel' && !record.loaded) return false;
		return send(record, 'message', params.data);
	}

	function reveal(params, context) {
		const record = require(context, params.handle);
		if (record.kind === 'panel') activatePanel(record.key, !!params.preserveFocus);
		else showView(views.get(record.viewId), !!params.preserveFocus);
		return true;
	}

	function dispose(params, context) {
		const record = records.get(keyOf(context, params.handle));
		return disposeRecord(record, false);
	}

	function ensureViewsRoot() {
		if (viewsRoot) return viewsRoot;
		const explorer = document.getElementById('explorer');
		if (!explorer) return null;
		viewsRoot = document.createElement('div');
		viewsRoot.className = 'ext-views';
		viewsRoot.id = 'extViews';
		explorer.appendChild(viewsRoot);
		return viewsRoot;
	}

	function collapsedSet() {
		try {
			const raw = localStorage.getItem(VIEW_HEIGHT_KEY);
			return new Set(raw ? JSON.parse(raw) : []);
		} catch (error) {
			return new Set();
		}
	}

	function rememberCollapsed(viewId, collapsed) {
		const set = collapsedSet();
		if (collapsed) set.add(viewId);
		else set.delete(viewId);
		try {
			localStorage.setItem(VIEW_HEIGHT_KEY, JSON.stringify([...set]));
		} catch (error) {}
	}

	function paintViewHead(view) {
		const head = view.section.querySelector('.ext-view-head');
		const record = view.record;
		const title = record && record.title ? record.title : view.name;
		head.setAttribute('aria-expanded', String(view.expanded));
		head.innerHTML =
			`<span class="ext-view-chevron" aria-hidden="true">${icon('drop')}</span>` +
			`<span class="ext-view-name">${esc(title)}</span>` +
			(view.description ? `<span class="ext-view-desc">${esc(view.description)}</span>` : '') +
			`<span class="ext-view-owner" title="${esc(view.extensionId)}">${esc(extensionName(view.extensionId))}</span>`;
	}

	function paintViewBody(view) {
		const body = view.section.querySelector('.ext-view-body');
		body.classList.toggle('hidden', !view.expanded);
		if (!view.expanded) return;
		if (view.record && view.record.iframe) {
			if (view.record.iframe.parentElement !== body) {
				body.innerHTML = '';
				body.appendChild(view.record.iframe);
			}
			return;
		}
		const item = registry() ? registry().get(view.extensionId) : null;
		const message = !item ? 'Extensão indisponível.' : item.status === 'error' ? 'A extensão falhou ao ativar. Veja a saída.' : view.provider ? 'Carregando…' : item.status === 'active' ? 'Nenhum provedor registrado para esta view.' : 'Ativando extensão…';
		body.innerHTML = `<div class="ext-view-empty">${esc(message)}</div>`;
	}

	function toggleView(view, expanded) {
		view.expanded = expanded === undefined ? !view.expanded : !!expanded;
		rememberCollapsed(view.id, !view.expanded);
		paintViewHead(view);
		paintViewBody(view);
		if (view.expanded) resolveView(view);
		else if (view.record) setViewState(view.record, false, false);
	}

	function showView(view, preserveFocus) {
		if (!view) return;
		if (!view.expanded) toggleView(view, true);
		view.section.scrollIntoView({ block: 'nearest' });
		if (!preserveFocus && view.record && view.record.iframe) setTimeout(() => view.record.iframe.focus({ preventScroll: true }), 30);
	}

	async function resolveView(view) {
		if (view.record || view.resolving) return;
		const item = registry() ? registry().get(view.extensionId) : null;
		if (!item) return;
		view.resolving = true;
		try {
			if (item.status !== 'active') await registry().fireActivationEvent(root.SynapseExtensionActivation.KINDS.VIEW, view.id);
			if (!view.provider) {
				paintViewBody(view);
				return;
			}
			const handle = 'view:' + view.id;
			const record = {
				key: `${view.extensionId}/${handle}`,
				handle,
				extensionId: view.extensionId,
				kind: 'view',
				viewId: view.id,
				viewType: view.id,
				title: view.name,
				options: { enableScripts: true, retainContextWhenHidden: true },
				html: '',
				state: null,
				hostNonce: kit().nonce(),
				userNonce: kit().nonce(),
				iframe: null,
				container: null,
				ready: false,
				loaded: false,
				queue: [],
				active: false,
				visible: true,
				disposed: false,
			};
			record.iframe = createFrame(record);
			records.set(record.key, record);
			view.record = record;
			paintViewBody(view);
			ensureListening();
			await registry().requestExtension(view.extensionId, 'webview.resolveView', { viewId: view.id, handle, cspSource: `'nonce-${record.userNonce}'`, nonce: record.userNonce }, { timeoutMs: 15000 });
			if (!record.loaded) render(record);
		} catch (error) {
			output().warn(view.extensionId, `View "${view.id}": ${error && error.message ? error.message : error}`);
			if (view.record) disposeRecord(view.record, false);
			view.record = null;
			paintViewBody(view);
		} finally {
			view.resolving = false;
		}
	}

	function registerViews(item) {
		const declared = item.manifest.contributes.views && Array.isArray(item.manifest.contributes.views.sidebar) ? item.manifest.contributes.views.sidebar : [];
		if (!declared.length) return;
		const rootNode = ensureViewsRoot();
		if (!rootNode) return;
		const collapsed = collapsedSet();
		declared.forEach((entry) => {
			if (!entry || typeof entry.id !== 'string' || views.has(entry.id)) return;
			const section = document.createElement('section');
			section.className = 'ext-view';
			section.dataset.viewId = entry.id;
			section.dataset.extension = item.id;
			section.innerHTML = '<button type="button" class="ext-view-head"></button><div class="ext-view-body hidden"></div>';
			const view = {
				id: entry.id,
				name: clip(entry.name || entry.id, MAX_TITLE),
				iconPath: entry.icon || '',
				extensionId: item.id,
				description: '',
				section,
				provider: null,
				record: null,
				expanded: !collapsed.has(entry.id),
				resolving: false,
			};
			views.set(entry.id, view);
			rootNode.appendChild(section);
			section.querySelector('.ext-view-head').addEventListener('click', () => toggleView(view));
			paintViewHead(view);
			paintViewBody(view);
		});
		ensureListening();
	}

	function unregisterViews(item) {
		[...views.values()].forEach((view) => {
			if (view.extensionId !== item.id) return;
			if (view.record) disposeRecord(view.record, false);
			view.section.remove();
			views.delete(view.id);
		});
		if (viewsRoot && !viewsRoot.children.length) {
			viewsRoot.remove();
			viewsRoot = null;
		}
	}

	function registerViewProvider(params, context) {
		const view = views.get(String(params.viewId || ''));
		if (!view) throw fail('INVALID_PARAMS', `View "${params.viewId}" não está declarada em contributes.views.sidebar.`);
		if (view.extensionId !== context.descriptor.id) throw fail('PERMISSION_DENIED', `A view "${params.viewId}" pertence à extensão "${view.extensionId}".`, { method: 'webview.registerViewProvider', permission: 'webview' });
		view.provider = { registeredAt: Date.now() };
		if (view.expanded) resolveView(view);
		else paintViewBody(view);
		return true;
	}

	function unregisterViewProvider(params, context) {
		const view = views.get(String(params.viewId || ''));
		if (!view || view.extensionId !== context.descriptor.id) return false;
		view.provider = null;
		if (view.record) disposeRecord(view.record, false);
		paintViewBody(view);
		return true;
	}

	function showViewHandler(params, context) {
		const record = require(context, params.handle);
		if (record.kind !== 'view') throw fail('INVALID_PARAMS', 'A webview informada não é uma view lateral.');
		showView(views.get(record.viewId), !!params.preserveFocus);
		return true;
	}

	function setViewDescription(params, context) {
		const record = require(context, params.handle);
		const view = record.kind === 'view' ? views.get(record.viewId) : null;
		if (!view) return false;
		view.description = clip(params.description || '', 60);
		paintViewHead(view);
		return true;
	}

	function disposeAll(extensionId) {
		[...records.values()].forEach((record) => {
			if (record.extensionId === extensionId) disposeRecord(record, false);
		});
		views.forEach((view) => {
			if (view.extensionId === extensionId) {
				view.provider = null;
				paintViewBody(view);
			}
		});
	}

	function refreshViews() {
		views.forEach((view) => {
			paintViewHead(view);
			paintViewBody(view);
		});
	}

	function list(extensionId) {
		return [...records.values()].filter((record) => !extensionId || record.extensionId === extensionId).map((record) => ({ handle: record.handle, kind: record.kind, title: record.title, active: record.active, visible: record.visible }));
	}

	const handlers = Object.freeze({
		'webview.create': createPanel,
		'webview.setHtml': setHtml,
		'webview.setTitle': setTitle,
		'webview.setOptions': setOptions,
		'webview.postMessage': postMessage,
		'webview.reveal': reveal,
		'webview.dispose': dispose,
		'webview.registerViewProvider': registerViewProvider,
		'webview.unregisterViewProvider': unregisterViewProvider,
		'webview.view.show': showViewHandler,
		'webview.view.setDescription': setViewDescription,
	});

	root.SynapseExtensionWebviews = Object.freeze({
		handlers,
		registerViews,
		unregisterViews,
		disposeAll,
		refreshViews,
		list,
		hide: hidePanels,
		get activePanel() {
			return activePanelKey;
		},
	});
})(window);
