(function (root) {
	'use strict';

	const NOTIFICATION_TIMEOUT_MS = 12000;
	const MAX_ACTIONS = 4;
	const MAX_PICK_ITEMS = 500;
	const MAX_TEXT = 400;
	const ICON_TOKEN = /\$\(([a-z0-9-]+)\)/gi;
	const statusItems = new Map();
	const progressTasks = new Map();
	let statusRestore = null;

	function esc(text) {
		return typeof root.escaparHtml === 'function' ? root.escaparHtml(String(text)) : String(text).replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
	}

	function icon(name, className) {
		return typeof root.iconSvg === 'function' ? root.iconSvg(name, className) : '';
	}

	function clip(text, limit) {
		const value = String(text === undefined || text === null ? '' : text);
		return value.length > (limit || MAX_TEXT) ? value.slice(0, (limit || MAX_TEXT) - 1) + '…' : value;
	}

	function toastsContainer() {
		return root.el && root.el.toasts ? root.el.toasts : document.body;
	}

	function narrow() {
		const html = document.documentElement.classList;
		return html.contains('aurora-narrow') || html.contains('aurora-mobile');
	}

	function renderIconText(text) {
		const value = clip(text, 200);
		let html = '';
		let last = 0;
		value.replace(ICON_TOKEN, (match, name, offset) => {
			html += esc(value.slice(last, offset));
			html += root.ICONS && root.ICONS[name] ? icon(name, 'st-ext-ic') : '';
			last = offset + match.length;
			return match;
		});
		html += esc(value.slice(last));
		return html;
	}

	function showMessage(params, context) {
		const kind = params.kind === 'err' ? 'err' : params.kind === 'warn' ? 'warn' : 'info';
		const title = context.descriptor.manifest.name;
		const message = clip(params.message);
		const actions = (Array.isArray(params.items) ? params.items : [])
			.map((item) => (item && typeof item === 'object' ? item : { title: String(item) }))
			.filter((item) => item && typeof item.title === 'string' && item.title.trim())
			.slice(0, MAX_ACTIONS);
		if (params.modal && typeof root.uiDialog === 'function') {
			const buttons = actions.map((item, index) => ({ id: String(index), label: clip(item.title, 40), primary: index === 0 }));
			buttons.unshift({ id: 'cancel', label: 'Fechar' });
			return root.uiDialog({ title, message: (params.detail ? message + '\n' + clip(params.detail) : message), buttons }).then((result) => {
				const index = result && result.act !== null && result.act !== 'cancel' ? Number(result.act) : -1;
				return index >= 0 ? index : null;
			});
		}
		if (!actions.length) {
			if (typeof root.toast === 'function') root.toast(title, message, kind === 'info' ? '' : kind);
			return Promise.resolve(null);
		}
		return new Promise((resolve) => {
			const node = document.createElement('div');
			node.className = 'toast ext-notification' + (kind === 'info' ? '' : ' ' + kind);
			node.setAttribute('role', kind === 'err' ? 'alert' : 'status');
			node.innerHTML =
				icon(kind === 'err' ? 'err' : kind === 'warn' ? 'warn' : 'info') +
				`<div class="tx"><b>${esc(title)}</b><span>${esc(message)}</span><div class="ext-notification-actions"></div></div>` +
				`<button class="ext-notification-close" type="button" aria-label="Fechar">${icon('close')}</button>`;
			const holder = node.querySelector('.ext-notification-actions');
			let settled = false;
			const finish = (value) => {
				if (settled) return;
				settled = true;
				clearTimeout(timer);
				node.style.transition = 'opacity .25s, transform .25s';
				node.style.opacity = '0';
				node.style.transform = 'translateX(30px)';
				setTimeout(() => node.remove(), 260);
				resolve(value);
			};
			actions.forEach((item, index) => {
				const button = document.createElement('button');
				button.type = 'button';
				button.className = 'ext-notification-action' + (index === 0 ? ' primary' : '');
				button.textContent = clip(item.title, 40);
				button.addEventListener('click', (event) => {
					event.stopPropagation();
					finish(index);
				});
				holder.appendChild(button);
			});
			node.querySelector('.ext-notification-close').addEventListener('click', (event) => {
				event.stopPropagation();
				finish(null);
			});
			const timer = setTimeout(() => finish(null), NOTIFICATION_TIMEOUT_MS);
			toastsContainer().appendChild(node);
			const first = holder.querySelector('button');
			if (first && !narrow()) first.focus({ preventScroll: true });
		});
	}

	function overlay(className) {
		const back = document.createElement('div');
		back.className = 'cmdk-back ext-overlay';
		const box = document.createElement('div');
		box.className = 'cmdk ' + (className || '');
		box.setAttribute('role', 'dialog');
		box.setAttribute('aria-modal', 'true');
		back.appendChild(box);
		document.body.appendChild(back);
		return { back, box };
	}

	function showQuickPick(params, context) {
		const options = params.options || {};
		const items = (Array.isArray(params.items) ? params.items : []).slice(0, MAX_PICK_ITEMS).map((item, index) => ({
			index,
			label: clip(item && item.label !== undefined ? item.label : String(item), 160),
			description: clip(item && item.description ? item.description : '', 200),
			detail: clip(item && item.detail ? item.detail : '', 300),
			picked: !!(item && item.picked),
			kind: item && item.kind === 'separator' ? 'separator' : 'item',
		}));
		const many = !!options.canPickMany;
		const matchDescription = !!options.matchOnDescription;
		const matchDetail = !!options.matchOnDetail;
		return new Promise((resolve) => {
			const ui = overlay('ext-quickpick');
			const title = options.title ? `<div class="ext-quickpick-title">${esc(clip(options.title, 120))}</div>` : '';
			ui.box.innerHTML =
				title +
				`<div class="cmdk-top">${icon('search', 'cmdk-ic')}<input class="ext-quickpick-input" placeholder="${esc(clip(options.placeHolder || (many ? 'Selecione um ou mais itens' : 'Selecione um item'), 120))}" autocomplete="off" spellcheck="false" /><span class="cmdk-esc">Esc</span></div>` +
				`<div class="cmdk-list ext-quickpick-list" role="listbox" aria-multiselectable="${many ? 'true' : 'false'}"></div>` +
				(many ? `<div class="ext-quickpick-foot"><span class="ext-quickpick-count"></span><button type="button" class="ui-btn primary ext-quickpick-ok">OK</button></div>` : '');
			const input = ui.box.querySelector('input');
			const list = ui.box.querySelector('.ext-quickpick-list');
			const count = ui.box.querySelector('.ext-quickpick-count');
			const selected = new Set(items.filter((item) => item.picked).map((item) => item.index));
			let visible = [];
			let cursor = 0;
			let settled = false;

			function finish(value) {
				if (settled) return;
				settled = true;
				document.removeEventListener('keydown', onKey, true);
				ui.back.remove();
				resolve(value);
			}

			function matches(item, term) {
				if (!term) return true;
				const haystack = [item.label, matchDescription ? item.description : '', matchDetail ? item.detail : ''].join(' ').toLowerCase();
				return haystack.includes(term);
			}

			function render() {
				const term = input.value.trim().toLowerCase();
				visible = items.filter((item) => item.kind !== 'separator' && matches(item, term));
				cursor = Math.min(cursor, Math.max(0, visible.length - 1));
				list.innerHTML = visible.length
					? visible
							.map((item, position) => {
								const check = many ? `<span class="ext-quickpick-check${selected.has(item.index) ? ' on' : ''}" aria-hidden="true"></span>` : '';
								const detail = item.detail ? `<span class="ext-quickpick-detail">${esc(item.detail)}</span>` : '';
								return `<button type="button" role="option" aria-selected="${position === cursor}" class="cmdk-item${position === cursor ? ' sel' : ''}" data-i="${item.index}">${check}<span class="ext-quickpick-text"><span class="cmdk-lbl">${esc(item.label)}</span>${detail}</span><span class="cmdk-hint">${esc(item.description)}</span></button>`;
							})
							.join('')
					: '<div class="cmdk-empty">Nenhum item corresponde</div>';
				if (count) count.textContent = selected.size ? `${selected.size} selecionado(s)` : '';
			}

			function moveCursor(delta) {
				if (!visible.length) return;
				cursor = (cursor + delta + visible.length) % visible.length;
				[...list.children].forEach((child, position) => {
					child.classList.toggle('sel', position === cursor);
					child.setAttribute('aria-selected', position === cursor ? 'true' : 'false');
				});
				const node = list.children[cursor];
				if (node && node.scrollIntoView) node.scrollIntoView({ block: 'nearest' });
			}

			function toggle(index) {
				if (selected.has(index)) selected.delete(index);
				else selected.add(index);
				render();
			}

			function accept(index) {
				if (many) {
					finish([...selected].sort((a, b) => a - b));
					return;
				}
				finish(index === undefined ? null : [index]);
			}

			function onKey(event) {
				if (event.key === 'Escape') {
					event.preventDefault();
					finish(null);
				} else if (event.key === 'ArrowDown') {
					event.preventDefault();
					moveCursor(1);
				} else if (event.key === 'ArrowUp') {
					event.preventDefault();
					moveCursor(-1);
				} else if (event.key === 'Enter') {
					event.preventDefault();
					const current = visible[cursor];
					if (many) accept();
					else if (current) accept(current.index);
				} else if (event.key === ' ' && many && document.activeElement === input && !input.value) {
					event.preventDefault();
					const current = visible[cursor];
					if (current) toggle(current.index);
				}
			}

			input.addEventListener('input', () => {
				cursor = 0;
				render();
			});
			list.addEventListener('click', (event) => {
				const button = event.target.closest('[data-i]');
				if (!button) return;
				const index = Number(button.dataset.i);
				if (many) toggle(index);
				else accept(index);
			});
			const ok = ui.box.querySelector('.ext-quickpick-ok');
			if (ok) ok.addEventListener('click', () => accept());
			ui.back.addEventListener('mousedown', (event) => {
				if (event.target === ui.back) finish(null);
			});
			document.addEventListener('keydown', onKey, true);
			render();
			setTimeout(() => input.focus(), 20);
		});
	}

	function showInputBox(params, context) {
		const options = params.options || {};
		const host = context.host;
		return new Promise((resolve) => {
			const ui = overlay('ext-inputbox');
			ui.box.innerHTML =
				`<div class="ui-h">${esc(clip(options.title || context.descriptor.manifest.name, 120))}</div>` +
				(options.prompt ? `<div class="ui-msg">${esc(clip(options.prompt))}</div>` : '') +
				`<div class="ui-fields"><input class="ui-input" type="${options.password ? 'password' : 'text'}" placeholder="${esc(clip(options.placeHolder || '', 120))}" autocomplete="off" spellcheck="false" /></div>` +
				`<div class="ext-inputbox-validation" role="alert"></div>` +
				`<div class="ui-actions"><button type="button" class="ui-btn" data-act="cancel">Cancelar</button><button type="button" class="ui-btn primary" data-act="ok">${esc(clip(options.okLabel || 'OK', 30))}</button></div>`;
			const input = ui.box.querySelector('input');
			const validation = ui.box.querySelector('.ext-inputbox-validation');
			const okButton = ui.box.querySelector('[data-act="ok"]');
			input.value = typeof options.value === 'string' ? options.value : '';
			let settled = false;
			let validationSequence = 0;
			let invalid = false;

			function finish(value) {
				if (settled) return;
				settled = true;
				document.removeEventListener('keydown', onKey, true);
				ui.back.remove();
				resolve(value);
			}

			async function validate() {
				if (!params.validate || !host || typeof host.request !== 'function') return;
				const sequence = ++validationSequence;
				let message = null;
				try {
					message = await host.request('window.validateInput', { token: params.token, value: input.value }, { timeoutMs: 3000 });
				} catch (error) {
					message = null;
				}
				if (sequence !== validationSequence || settled) return;
				invalid = typeof message === 'string' && message.trim() !== '';
				validation.textContent = invalid ? clip(message, 200) : '';
				validation.classList.toggle('on', invalid);
				okButton.disabled = invalid;
			}

			function onKey(event) {
				if (event.key === 'Escape') {
					event.preventDefault();
					finish(null);
				} else if (event.key === 'Enter' && document.activeElement === input && !event.isComposing && event.keyCode !== 229) {
					event.preventDefault();
					if (!invalid) finish(input.value);
				}
			}

			input.addEventListener('input', validate);
			ui.box.querySelector('[data-act="cancel"]').addEventListener('click', () => finish(null));
			okButton.addEventListener('click', () => {
				if (!invalid) finish(input.value);
			});
			ui.back.addEventListener('mousedown', (event) => {
				if (event.target === ui.back && !options.ignoreFocusOut) finish(null);
			});
			document.addEventListener('keydown', onKey, true);
			setTimeout(() => {
				input.focus();
				if (options.valueSelection && Array.isArray(options.valueSelection)) input.setSelectionRange(options.valueSelection[0] | 0, options.valueSelection[1] | 0);
				else input.select();
			}, 20);
			validate();
		});
	}

	function statusContainer(alignment) {
		const bar = document.querySelector('.statusbar');
		if (!bar) return null;
		const className = alignment === 'right' ? 'st-ext st-ext-right' : 'st-ext st-ext-left';
		let holder = bar.querySelector('.' + className.replace(/ /g, '.'));
		if (holder) return holder;
		holder = document.createElement('div');
		holder.className = className;
		const spacer = bar.querySelector('.sp');
		if (alignment === 'right') {
			if (spacer && spacer.nextSibling) bar.insertBefore(holder, spacer.nextSibling);
			else bar.appendChild(holder);
		} else if (spacer) bar.insertBefore(holder, spacer);
		else bar.appendChild(holder);
		return holder;
	}

	function placeStatusItem(record) {
		const holder = statusContainer(record.alignment);
		if (!holder) return;
		const siblings = [...holder.children].filter((child) => child !== record.node);
		const next = siblings.find((child) => Number(child.dataset.priority) < record.priority);
		if (next) holder.insertBefore(record.node, next);
		else holder.appendChild(record.node);
	}

	function paintStatusItem(record) {
		const node = record.node;
		node.dataset.priority = String(record.priority);
		node.innerHTML = renderIconText(record.text || '');
		node.title = clip(record.tooltip || record.text || '', 200);
		node.setAttribute('aria-label', clip(record.accessibilityLabel || record.tooltip || record.text || record.name, 200));
		node.hidden = !record.visible || !record.text;
		node.classList.toggle('clickable', !!record.command);
		node.classList.toggle('warn', record.background === 'warning');
		node.classList.toggle('err', record.background === 'error');
		node.style.color = record.color && typeof CSS !== 'undefined' && CSS.supports && CSS.supports('color', record.color) ? record.color : '';
		node.disabled = !record.command;
	}

	function createStatusItem(params, context) {
		const extensionId = context.descriptor.id;
		const handle = String(params.handle);
		const declared = (context.descriptor.manifest.contributes.statusBar || []).find((entry) => entry && entry.id === params.id) || {};
		const record = {
			handle,
			extensionId,
			id: params.id || handle,
			name: context.descriptor.manifest.name,
			alignment: (params.alignment || declared.alignment) === 'right' ? 'right' : 'left',
			priority: Number.isFinite(params.priority) ? params.priority : Number.isFinite(declared.priority) ? declared.priority : 0,
			text: '',
			tooltip: '',
			command: null,
			color: '',
			background: '',
			accessibilityLabel: '',
			visible: false,
			node: document.createElement('button'),
		};
		record.node.type = 'button';
		record.node.className = 'st-ext-item';
		record.node.dataset.extension = extensionId;
		record.node.hidden = true;
		record.node.addEventListener('click', () => {
			if (!record.command) return;
			const registry = root.SynapseExtensions;
			const commandId = typeof record.command === 'string' ? record.command : record.command.command;
			const args = record.command && Array.isArray(record.command.arguments) ? record.command.arguments : [];
			registry.executeCommand(commandId, ...args).catch(() => {});
		});
		statusItems.set(`${extensionId}/${handle}`, record);
		placeStatusItem(record);
		paintStatusItem(record);
		return { handle, alignment: record.alignment, priority: record.priority };
	}

	function updateStatusItem(params, context) {
		const record = statusItems.get(`${context.descriptor.id}/${params.handle}`);
		if (!record) return false;
		const patch = params.patch || {};
		if ('text' in patch) record.text = clip(patch.text, 200);
		if ('tooltip' in patch) record.tooltip = clip(patch.tooltip, 300);
		if ('command' in patch) record.command = patch.command && (typeof patch.command === 'string' || typeof patch.command.command === 'string') ? patch.command : null;
		if ('color' in patch) record.color = typeof patch.color === 'string' ? patch.color.slice(0, 40) : '';
		if ('backgroundColor' in patch) record.background = patch.backgroundColor === 'warning' || patch.backgroundColor === 'error' ? patch.backgroundColor : '';
		if ('accessibilityInformation' in patch) record.accessibilityLabel = patch.accessibilityInformation && patch.accessibilityInformation.label ? clip(patch.accessibilityInformation.label, 200) : '';
		if ('visible' in patch) record.visible = !!patch.visible;
		if ('priority' in patch && Number.isFinite(patch.priority)) {
			record.priority = patch.priority;
			placeStatusItem(record);
		}
		paintStatusItem(record);
		return true;
	}

	function disposeStatusItem(params, context) {
		const key = `${context.descriptor.id}/${params.handle}`;
		const record = statusItems.get(key);
		if (!record) return false;
		record.node.remove();
		statusItems.delete(key);
		return true;
	}

	function setStatusBarMessage(params, context) {
		if (typeof root.setStatus !== 'function') return null;
		const stateNode = document.getElementById('stState');
		if (!statusRestore) statusRestore = { text: stateNode ? stateNode.textContent : 'Pronto' };
		root.setStatus('', clip(params.message, 120));
		if (statusRestore.timer) clearTimeout(statusRestore.timer);
		const timeout = Number.isFinite(params.timeoutMs) && params.timeoutMs > 0 ? Math.min(params.timeoutMs, 60000) : 8000;
		statusRestore.timer = setTimeout(() => restoreStatus(), timeout);
		return null;
	}

	function restoreStatus() {
		if (!statusRestore) return;
		const restore = statusRestore;
		statusRestore = null;
		if (restore.timer) clearTimeout(restore.timer);
		if (progressTasks.size) {
			const [task] = progressTasks.values();
			if (task.location !== 'notification') {
				root.setStatus('run', clip(task.title, 120));
				return;
			}
		}
		root.setStatus('ok', restore.text || 'Pronto');
	}

	function progressBegin(params, context) {
		const token = String(params.token);
		const task = {
			token,
			extensionId: context.descriptor.id,
			title: clip(params.title || context.descriptor.manifest.name, 120),
			location: params.location === 'notification' ? 'notification' : 'window',
			cancellable: !!params.cancellable,
			percent: 0,
			node: null,
		};
		progressTasks.set(`${task.extensionId}/${token}`, task);
		if (task.location === 'notification') {
			const node = document.createElement('div');
			node.className = 'toast ext-progress';
			node.setAttribute('role', 'status');
			node.innerHTML =
				`<span class="ext-progress-spinner" aria-hidden="true"></span>` +
				`<div class="tx"><b>${esc(task.title)}</b><span class="ext-progress-message"></span><div class="ext-progress-track"><i class="ext-progress-fill indeterminate"></i></div></div>` +
				(task.cancellable ? `<button class="ext-notification-close" type="button" aria-label="Cancelar">${icon('close')}</button>` : '');
			if (task.cancellable) {
				node.querySelector('.ext-notification-close').addEventListener('click', () => {
					if (context.host && typeof context.host.notify === 'function') context.host.notify('progress.cancel', { token });
					node.classList.add('cancelling');
				});
			}
			toastsContainer().appendChild(node);
			task.node = node;
		} else if (typeof root.setStatus === 'function') {
			if (!statusRestore) {
				const stateNode = document.getElementById('stState');
				statusRestore = { text: stateNode ? stateNode.textContent : 'Pronto' };
			}
			root.setStatus('run', task.title);
		}
		return null;
	}

	function progressReport(params, context) {
		const task = progressTasks.get(`${context.descriptor.id}/${params.token}`);
		if (!task) return false;
		const message = clip(params.message || '', 200);
		if (Number.isFinite(params.increment)) task.percent = Math.min(100, task.percent + params.increment);
		if (task.node) {
			task.node.querySelector('.ext-progress-message').textContent = message;
			const fill = task.node.querySelector('.ext-progress-fill');
			if (Number.isFinite(params.increment)) {
				fill.classList.remove('indeterminate');
				fill.style.width = task.percent + '%';
			}
		} else if (typeof root.setStatus === 'function') {
			root.setStatus('run', message ? `${task.title} — ${message}` : task.title);
		}
		return true;
	}

	function progressEnd(params, context) {
		const key = `${context.descriptor.id}/${params.token}`;
		const task = progressTasks.get(key);
		if (!task) return false;
		progressTasks.delete(key);
		if (task.node) {
			task.node.style.transition = 'opacity .25s';
			task.node.style.opacity = '0';
			setTimeout(() => task.node.remove(), 260);
		} else {
			restoreStatus();
		}
		return true;
	}

	function disposeAll(extensionId) {
		[...statusItems.entries()].forEach(([key, record]) => {
			if (record.extensionId !== extensionId) return;
			record.node.remove();
			statusItems.delete(key);
		});
		[...progressTasks.entries()].forEach(([key, task]) => {
			if (task.extensionId !== extensionId) return;
			progressTasks.delete(key);
			if (task.node) task.node.remove();
		});
		if (!progressTasks.size && statusRestore) restoreStatus();
	}

	function listStatusItems() {
		return [...statusItems.values()]
			.filter((record) => record.visible && record.text)
			.map((record) => ({
				extensionId: record.extensionId,
				extensionName: record.name,
				text: record.text.replace(ICON_TOKEN, '').trim(),
				tooltip: record.tooltip,
				command: record.command ? (typeof record.command === 'string' ? record.command : record.command.command) : null,
				arguments: record.command && Array.isArray(record.command.arguments) ? record.command.arguments : [],
			}));
	}

	root.SynapseExtensionWindow = Object.freeze({
		showMessage,
		showQuickPick,
		showInputBox,
		createStatusItem,
		updateStatusItem,
		disposeStatusItem,
		setStatusBarMessage,
		progressBegin,
		progressReport,
		progressEnd,
		disposeAll,
		listStatusItems,
	});
})(window);
