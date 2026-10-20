(function (root) {
	'use strict';

	const LAYER_ID = 'hostPanelLayer';
	const records = new Map();
	const order = [];
	const listeners = new Set();
	let layer = null;
	let activeKey = null;
	let integrated = false;

	function esc(text) {
		return typeof root.escaparHtml === 'function' ? root.escaparHtml(String(text)) : String(text).replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
	}

	function icon(name, className) {
		return typeof root.iconSvg === 'function' ? root.iconSvg(name, className) : '';
	}

	function el() {
		return root.el || {};
	}

	function ensureLayer() {
		if (layer) return layer;
		const pane = document.getElementById('editorPane');
		if (!pane) return null;
		layer = document.createElement('div');
		layer.className = 'host-panel-layer hidden';
		layer.id = LAYER_ID;
		layer.setAttribute('role', 'tabpanel');
		const scroll = document.getElementById('editorScroll');
		if (scroll && scroll.parentElement === pane) pane.insertBefore(layer, scroll.nextSibling);
		else pane.appendChild(layer);
		return layer;
	}

	function emit() {
		listeners.forEach((listener) => {
			try {
				listener(activeKey);
			} catch (error) {}
		});
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
				if (activeKey) hide();
				return originalOpen.apply(this, arguments);
			};
		}
		const originalClose = root.closeTab;
		if (typeof originalClose === 'function') {
			root.closeTab = function () {
				const result = originalClose.apply(this, arguments);
				if (activeKey) present();
				return result;
			};
		}
		const tabs = el().editorTabs;
		if (!tabs) return;
		tabs.addEventListener(
			'click',
			(event) => {
				if (event.target.closest('[data-tab-webview]') && activeKey) hide();
			},
			true,
		);
		tabs.addEventListener('click', (event) => {
			const close = event.target.closest('[data-host-close]');
			if (close) {
				event.stopPropagation();
				closePanel(close.dataset.hostClose);
				return;
			}
			const tab = event.target.closest('[data-tab-host]');
			if (!tab) return;
			event.stopPropagation();
			activate(tab.dataset.tabHost);
		});
		tabs.addEventListener('mousedown', (event) => {
			const tab = event.target.closest('[data-tab-host]');
			if (event.button === 1 && tab) {
				event.preventDefault();
				closePanel(tab.dataset.tabHost);
			}
		});
		tabs.addEventListener('keydown', (event) => {
			const tab = event.target.closest('[data-tab-host]');
			if (!tab) return;
			if (event.key === 'Delete' || (event.key === 'w' && (event.ctrlKey || event.metaKey))) {
				event.preventDefault();
				closePanel(tab.dataset.tabHost);
			}
		});
	}

	function panels() {
		return order.map((key) => records.get(key)).filter(Boolean);
	}

	function paintTabs() {
		const tabs = el().editorTabs;
		if (!tabs) return;
		tabs.querySelectorAll('[data-tab-host]').forEach((node) => node.parentElement.remove());
		const list = panels();
		if (!list.length) return;
		tabs.classList.remove('hidden');
		if (activeKey) {
			tabs.querySelectorAll('.etab.active').forEach((node) => node.classList.remove('active'));
			tabs.querySelectorAll('[role="tab"][aria-selected="true"]').forEach((node) => node.setAttribute('aria-selected', 'false'));
		}
		const fragment = document.createDocumentFragment();
		list.forEach((record) => {
			const active = record.key === activeKey;
			const tab = document.createElement('div');
			tab.className = 'etab host-panel-tab' + (active ? ' active' : '');
			tab.setAttribute('role', 'presentation');
			tab.innerHTML =
				`<button type="button" class="etselect" role="tab" aria-selected="${active}" aria-controls="${LAYER_ID}" tabindex="${active ? 0 : -1}" data-tab-host="${esc(record.key)}" title="${esc(record.title)}${record.subtitle ? ' · ' + esc(record.subtitle) : ''}">` +
				`<span class="etico host-panel-tab-icon" aria-hidden="true">${icon(record.icon || 'info')}</span><span class="etname">${esc(record.title)}</span></button>` +
				`<button type="button" class="etclose" data-host-close="${esc(record.key)}" aria-label="Fechar ${esc(record.title)}" tabindex="${active ? 0 : -1}">${icon('close')}</button>`;
			fragment.appendChild(tab);
		});
		tabs.appendChild(fragment);
		const activeTab = tabs.querySelector('.host-panel-tab.active');
		if (activeTab) activeTab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
	}

	function present() {
		const record = records.get(activeKey);
		if (!record) {
			activeKey = null;
			return;
		}
		const ui = el();
		ensureLayer();
		if (ui.editorScroll) ui.editorScroll.classList.add('hidden');
		const webviews = root.SynapseExtensionWebviews;
		if (webviews && webviews.activePanel && typeof webviews.hide === 'function') webviews.hide();
		const webviewLayer = document.getElementById('extWebviewLayer');
		if (webviewLayer) webviewLayer.classList.add('hidden');
		layer.classList.remove('hidden');
		layer.querySelectorAll('.host-panel').forEach((node) => node.classList.toggle('hidden', node.dataset.key !== record.key));
		if (ui.editorTitle) {
			ui.editorTitle.textContent = record.title;
			ui.editorTitle.title = record.title;
		}
		if (ui.editorPath) {
			ui.editorPath.textContent = record.subtitle || '';
			ui.editorPath.title = record.subtitle || '';
		}
		if (ui.editorDirty) ui.editorDirty.classList.remove('on');
		if (!record.rendered) renderRecord(record);
		if (typeof record.onShow === 'function') {
			try {
				record.onShow(record.container);
			} catch (error) {}
		}
		paintTabs();
		emit();
	}

	function hide() {
		activeKey = null;
		if (layer) layer.classList.add('hidden');
		const ui = el();
		if (ui.editorScroll) ui.editorScroll.classList.remove('hidden');
		emit();
	}

	function restoreEditor() {
		hide();
		const ui = el();
		const project = typeof root.activeProject === 'function' ? root.activeProject() : null;
		if (project && project.openFile && typeof root.openFileInEditor === 'function') {
			root.openFileInEditor(project.openFile);
			return;
		}
		if (ui.editorTitle) {
			ui.editorTitle.textContent = 'Nenhum arquivo';
			ui.editorTitle.title = '';
		}
		if (ui.editorPath) {
			ui.editorPath.textContent = '';
			ui.editorPath.title = '';
		}
		if (typeof root.renderEditorTabs === 'function') root.renderEditorTabs();
	}

	function renderRecord(record) {
		record.container.innerHTML = '';
		record.rendered = true;
		try {
			record.render(record.container, {
				close: () => closePanel(record.key),
				setTitle: (title, subtitle) => setTitle(record.key, title, subtitle),
				refresh: () => refresh(record.key),
			});
		} catch (error) {
			record.container.innerHTML = `<div class="host-panel-error">${esc(error && error.message ? error.message : error)}</div>`;
		}
	}

	function activate(key, preserveFocus) {
		const record = records.get(key);
		if (!record) return false;
		activeKey = key;
		if (root.SynapseEditorDocuments && typeof root.SynapseEditorDocuments.rememberView === 'function') {
			try {
				root.SynapseEditorDocuments.rememberView();
			} catch (error) {}
		}
		present();
		if (!preserveFocus) {
			const focusable = record.container.querySelector('[autofocus], input, button, [tabindex="0"]');
			if (focusable) setTimeout(() => focusable.focus({ preventScroll: true }), 30);
		}
		return true;
	}

	function open(spec) {
		if (!spec || typeof spec.key !== 'string' || typeof spec.render !== 'function') throw new Error('Painel exige key e render().');
		ensureIntegration();
		let record = records.get(spec.key);
		if (record) {
			record.title = spec.title || record.title;
			record.subtitle = spec.subtitle !== undefined ? spec.subtitle : record.subtitle;
			record.render = spec.render;
			record.onShow = spec.onShow || record.onShow;
			record.onClose = spec.onClose || record.onClose;
			if (spec.refresh !== false) record.rendered = false;
			activate(spec.key, !!spec.preserveFocus);
			return record.key;
		}
		const container = document.createElement('div');
		container.className = 'host-panel hidden';
		container.dataset.key = spec.key;
		ensureLayer().appendChild(container);
		record = {
			key: spec.key,
			title: String(spec.title || 'Painel'),
			subtitle: spec.subtitle ? String(spec.subtitle) : '',
			icon: spec.icon || 'info',
			render: spec.render,
			onShow: spec.onShow || null,
			onClose: spec.onClose || null,
			container,
			rendered: false,
		};
		records.set(record.key, record);
		order.push(record.key);
		activate(record.key, !!spec.preserveFocus);
		return record.key;
	}

	function closePanel(key) {
		const record = records.get(key);
		if (!record) return false;
		records.delete(key);
		const index = order.indexOf(key);
		if (index !== -1) order.splice(index, 1);
		if (typeof record.onClose === 'function') {
			try {
				record.onClose();
			} catch (error) {}
		}
		record.container.remove();
		if (activeKey === key) {
			const next = order[Math.min(index, order.length - 1)];
			if (next) activate(next, true);
			else restoreEditor();
		} else paintTabs();
		return true;
	}

	function setTitle(key, title, subtitle) {
		const record = records.get(key);
		if (!record) return false;
		if (title) record.title = String(title);
		if (subtitle !== undefined) record.subtitle = subtitle ? String(subtitle) : '';
		if (activeKey === key) present();
		else paintTabs();
		return true;
	}

	function refresh(key) {
		const record = records.get(key);
		if (!record) return false;
		record.rendered = false;
		if (activeKey === key) present();
		return true;
	}

	function has(key) {
		return records.has(key);
	}

	function isActive(key) {
		return activeKey === key;
	}

	function onDidChangeActive(listener) {
		listeners.add(listener);
		return () => listeners.delete(listener);
	}

	root.SynapseHostPanels = Object.freeze({
		open,
		close: closePanel,
		activate,
		hide,
		refresh,
		setTitle,
		has,
		isActive,
		list: () => panels().map((record) => ({ key: record.key, title: record.title, subtitle: record.subtitle })),
		onDidChangeActive,
		get activeKey() {
			return activeKey;
		},
	});
})(window);
