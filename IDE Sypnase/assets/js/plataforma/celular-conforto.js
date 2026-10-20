(function (root) {
	'use strict';

	const documentElement = document.documentElement;
	const STRIP_ID = 'auroraCodeKeys';
	const KEYBOARD_THRESHOLD = 120;
	const EDGE_ZONE = 24;
	const SWIPE_DISTANCE = 56;
	const LONG_PRESS_MS = 480;
	const MOVE_TOLERANCE = 10;
	const CONTEXT_MENU_GRACE_MS = 900;

	let settings = {
		mobileCodeKeys: true,
		mobileLargeTargets: true,
		mobileEdgeSwipe: true,
		mobileLongPress: true,
	};
	let strip = null;
	let textarea = null;
	let baseViewportHeight = 0;
	let lastSyntheticContextMenu = 0;

	const KEYS = [
		{ id: 'tab', label: 'Tab', action: 'tab', wide: true },
		{ id: 'left', label: '\u2190', action: 'move', delta: -1 },
		{ id: 'right', label: '\u2192', action: 'move', delta: 1 },
		{ id: 'up', label: '\u2191', action: 'line', delta: -1 },
		{ id: 'down', label: '\u2193', action: 'line', delta: 1 },
		{ id: 'braces', label: '{ }', action: 'pair', open: '{', close: '}' },
		{ id: 'parens', label: '( )', action: 'pair', open: '(', close: ')' },
		{ id: 'brackets', label: '[ ]', action: 'pair', open: '[', close: ']' },
		{ id: 'angles', label: '< >', action: 'pair', open: '<', close: '>' },
		{ id: 'dquote', label: '"', action: 'pair', open: '"', close: '"' },
		{ id: 'squote', label: "'", action: 'pair', open: "'", close: "'" },
		{ id: 'backtick', label: '`', action: 'pair', open: '`', close: '`' },
		{ id: 'semicolon', label: ';', action: 'text', text: ';' },
		{ id: 'colon', label: ':', action: 'text', text: ':' },
		{ id: 'comma', label: ',', action: 'text', text: ',' },
		{ id: 'dot', label: '.', action: 'text', text: '.' },
		{ id: 'equals', label: '=', action: 'text', text: '=' },
		{ id: 'arrow', label: '=>', action: 'text', text: '=>' },
		{ id: 'slash', label: '/', action: 'text', text: '/' },
		{ id: 'backslash', label: '\\', action: 'text', text: '\\' },
		{ id: 'bang', label: '!', action: 'text', text: '!' },
		{ id: 'and', label: '&&', action: 'text', text: '&&' },
		{ id: 'or', label: '||', action: 'text', text: '||' },
		{ id: 'hash', label: '#', action: 'text', text: '#' },
		{ id: 'dollar', label: '$', action: 'text', text: '$' },
		{ id: 'underscore', label: '_', action: 'text', text: '_' },
		{ id: 'home', label: '\u21E4', action: 'edge', side: 'start' },
		{ id: 'end', label: '\u21E5', action: 'edge', side: 'end' },
		{ id: 'undo', label: 'Desfazer', action: 'history', direction: 'undo', wide: true },
		{ id: 'redo', label: 'Refazer', action: 'history', direction: 'redo', wide: true },
	];

	const ARIA = {
		tab: 'Inserir tabulacao',
		left: 'Mover cursor para a esquerda',
		right: 'Mover cursor para a direita',
		up: 'Linha acima',
		down: 'Linha abaixo',
		home: 'Inicio da linha',
		end: 'Fim da linha',
		undo: 'Desfazer',
		redo: 'Refazer',
	};

	function ignore(error, context) {
		if (typeof root.ignorarErro === 'function') root.ignorarErro(error, 'celular-conforto.' + context);
	}

	function touchLayout() {
		return documentElement.classList.contains('aurora-touch');
	}

	function narrowLayout() {
		return documentElement.classList.contains('aurora-narrow');
	}

	function mobileLayout() {
		return documentElement.classList.contains('aurora-mobile');
	}

	function vibrate(duration) {
		try {
			if (typeof navigator.vibrate === 'function') navigator.vibrate(duration);
		} catch (error) {
			ignore(error, 'vibrate');
		}
	}

	function editorTextarea() {
		if (!textarea) textarea = document.getElementById('codeTa');
		return textarea;
	}

	function editorFocused() {
		const target = editorTextarea();
		return !!target && document.activeElement === target;
	}

	function textEntryFocused() {
		const active = document.activeElement;
		if (!active || active === document.body) return false;
		const tag = active.tagName;
		return tag === 'TEXTAREA' || tag === 'INPUT' || active.isContentEditable === true;
	}

	function expandFolds() {
		try {
			if (root.EditorFolding && typeof root.EditorFolding.expandBeforeInput === 'function') {
				root.EditorFolding.expandBeforeInput();
			}
		} catch (error) {
			ignore(error, 'folding');
		}
	}

	function insertText(target, text, caretOffset) {
		const start = target.selectionStart;
		const end = target.selectionEnd;
		const previous = target.value;
		expandFolds();
		let inserted = false;
		if (typeof document.execCommand === 'function') {
			try {
				document.execCommand('insertText', false, text);
				inserted = target.value !== previous;
			} catch (error) {
				ignore(error, 'insert');
			}
		}
		if (!inserted) {
			target.setRangeText(text, start, end, 'end');
			target.dispatchEvent(new Event('input', { bubbles: true }));
		}
		if (typeof caretOffset === 'number') {
			const caret = start + caretOffset;
			target.setSelectionRange(caret, caret);
		}
	}

	function insertPair(target, key) {
		const start = target.selectionStart;
		const end = target.selectionEnd;
		if (end > start) {
			const selected = target.value.slice(start, end);
			insertText(target, key.open + selected + key.close);
			return;
		}
		insertText(target, key.open + key.close, key.open.length);
	}

	function pressTab(target) {
		const event = new KeyboardEvent('keydown', {
			key: 'Tab',
			code: 'Tab',
			keyCode: 9,
			which: 9,
			bubbles: true,
			cancelable: true,
		});
		target.dispatchEvent(event);
		if (!event.defaultPrevented) insertText(target, '  ');
	}

	function lineHeightOf(target) {
		const value = parseFloat(getComputedStyle(target).lineHeight);
		return Number.isFinite(value) && value > 0 ? value : 18;
	}

	function revealCaret(target, position) {
		const line = target.value.slice(0, position).split('\n').length - 1;
		const lineHeight = lineHeightOf(target);
		const top = line * lineHeight;
		const viewTop = target.scrollTop;
		const viewBottom = viewTop + target.clientHeight - lineHeight;
		if (top < viewTop) target.scrollTop = Math.max(0, top - lineHeight);
		else if (top > viewBottom) target.scrollTop = top - target.clientHeight + lineHeight * 2;
	}

	function setCaret(target, position) {
		const clamped = Math.max(0, Math.min(target.value.length, position));
		target.setSelectionRange(clamped, clamped);
		revealCaret(target, clamped);
	}

	function moveHorizontal(target, delta) {
		const start = target.selectionStart;
		const end = target.selectionEnd;
		if (end > start) {
			setCaret(target, delta < 0 ? start : end);
			return;
		}
		setCaret(target, start + delta);
	}

	function moveVertical(target, delta) {
		const value = target.value;
		const position = target.selectionStart;
		const lineStart = value.lastIndexOf('\n', position - 1) + 1;
		const column = position - lineStart;
		if (delta < 0) {
			if (lineStart === 0) {
				setCaret(target, 0);
				return;
			}
			const previousStart = value.lastIndexOf('\n', lineStart - 2) + 1;
			const previousLength = lineStart - 1 - previousStart;
			setCaret(target, previousStart + Math.min(column, previousLength));
			return;
		}
		const lineEnd = value.indexOf('\n', position);
		if (lineEnd === -1) {
			setCaret(target, value.length);
			return;
		}
		const nextStart = lineEnd + 1;
		let nextEnd = value.indexOf('\n', nextStart);
		if (nextEnd === -1) nextEnd = value.length;
		setCaret(target, nextStart + Math.min(column, nextEnd - nextStart));
	}

	function moveToEdge(target, side) {
		const value = target.value;
		const position = target.selectionStart;
		if (side === 'start') {
			const lineStart = value.lastIndexOf('\n', position - 1) + 1;
			const match = /^[ \t]*/.exec(value.slice(lineStart));
			const indentEnd = lineStart + (match ? match[0].length : 0);
			setCaret(target, position === indentEnd || position < indentEnd ? lineStart : indentEnd);
			return;
		}
		const lineEnd = value.indexOf('\n', position);
		setCaret(target, lineEnd === -1 ? value.length : lineEnd);
	}

	function travelHistory(target, direction) {
		const documents = root.SynapseEditorDocuments;
		if (documents && typeof documents[direction] === 'function') {
			try {
				documents[direction]();
				return;
			} catch (error) {
				ignore(error, direction);
			}
		}
		try {
			document.execCommand(direction);
		} catch (error) {
			ignore(error, direction);
		}
		target.dispatchEvent(new Event('input', { bubbles: true }));
	}

	function runKey(key) {
		const target = editorTextarea();
		if (!target || target.readOnly) return;
		if (document.activeElement !== target) target.focus({ preventScroll: true });
		switch (key.action) {
			case 'tab':
				pressTab(target);
				break;
			case 'move':
				moveHorizontal(target, key.delta);
				break;
			case 'line':
				moveVertical(target, key.delta);
				break;
			case 'pair':
				insertPair(target, key);
				break;
			case 'text':
				insertText(target, key.text);
				break;
			case 'edge':
				moveToEdge(target, key.side);
				break;
			case 'history':
				travelHistory(target, key.direction);
				break;
			default:
				break;
		}
		vibrate(6);
	}

	function ariaLabel(key) {
		if (ARIA[key.id]) return ARIA[key.id];
		if (key.action === 'pair') return 'Inserir ' + key.open + key.close;
		return 'Inserir ' + key.label;
	}

	function buildStrip() {
		const bar = document.createElement('div');
		bar.id = STRIP_ID;
		bar.setAttribute('role', 'toolbar');
		bar.setAttribute('aria-label', 'Teclas de codigo');
		const scroller = document.createElement('div');
		scroller.className = 'ck-scroll';
		for (const key of KEYS) {
			const button = document.createElement('button');
			button.type = 'button';
			button.className = key.wide ? 'ck-key ck-wide' : 'ck-key';
			button.dataset.key = key.id;
			button.textContent = key.label;
			button.setAttribute('aria-label', ariaLabel(key));
			scroller.appendChild(button);
		}
		bar.appendChild(scroller);
		bar.addEventListener('pointerdown', (event) => {
			if (event.target.closest('.ck-key')) event.preventDefault();
		});
		bar.addEventListener('click', (event) => {
			const button = event.target.closest('.ck-key');
			if (!button) return;
			event.preventDefault();
			const key = KEYS.find((item) => item.id === button.dataset.key);
			if (key) runKey(key);
		});
		return bar;
	}

	function syncStrip() {
		const visible = editorFocused() && touchLayout() && settings.mobileCodeKeys !== false;
		documentElement.classList.toggle('code-keys-on', visible);
	}

	function watchFocus(target) {
		target.addEventListener('focus', syncStrip);
		target.addEventListener('blur', () => setTimeout(syncStrip, 80));
	}

	function mountStrip() {
		const pane = document.getElementById('editorPane');
		const target = editorTextarea();
		if (!pane || !target || strip) return;
		strip = buildStrip();
		pane.appendChild(strip);
		watchFocus(target);
		syncStrip();
	}

	function watchKeyboard() {
		const viewport = root.visualViewport;
		if (!viewport) return;
		const update = () => {
			const height = viewport.height;
			if (height > baseViewportHeight) baseViewportHeight = height;
			const gap = baseViewportHeight - height;
			const open = gap > KEYBOARD_THRESHOLD && mobileLayout() && textEntryFocused();
			documentElement.classList.toggle('kbd-open', open);
			documentElement.style.setProperty('--kbd-h', open ? Math.round(gap) + 'px' : '0px');
			documentElement.style.setProperty('--vv-top', open ? Math.round(viewport.offsetTop) + 'px' : '0px');
		};
		const resetBaseline = () => {
			baseViewportHeight = 0;
			setTimeout(update, 320);
		};
		viewport.addEventListener('resize', update, { passive: true });
		viewport.addEventListener('scroll', update, { passive: true });
		root.addEventListener('orientationchange', resetBaseline, { passive: true });
		document.addEventListener('focusout', () => setTimeout(update, 120));
		update();
	}

	function toggleDrawer(open) {
		const trigger = document.getElementById('auroraExpToggle');
		if (!trigger) return;
		if (documentElement.classList.contains('exp-open') === open) return;
		trigger.click();
		vibrate(6);
	}

	function watchSwipe() {
		let tracking = null;
		document.addEventListener(
			'touchstart',
			(event) => {
				tracking = null;
				if (!narrowLayout() || settings.mobileEdgeSwipe === false || event.touches.length !== 1) return;
				const touch = event.touches[0];
				const drawerOpen = documentElement.classList.contains('exp-open');
				if (!drawerOpen && touch.clientX > EDGE_ZONE) return;
				if (drawerOpen && !event.target.closest('.explorer, #auroraExpBackdrop')) return;
				if (!drawerOpen && event.target.closest('#auroraCodeKeys, .console, .menu, .settings-shell')) return;
				tracking = { x: touch.clientX, y: touch.clientY, drawerOpen };
			},
			{ passive: true },
		);
		document.addEventListener(
			'touchmove',
			(event) => {
				if (!tracking) return;
				const touch = event.touches[0];
				const dx = touch.clientX - tracking.x;
				const dy = Math.abs(touch.clientY - tracking.y);
				if (dy > Math.abs(dx) && dy > MOVE_TOLERANCE) {
					tracking = null;
					return;
				}
				if (!tracking.drawerOpen && dx > SWIPE_DISTANCE) {
					tracking = null;
					toggleDrawer(true);
				} else if (tracking.drawerOpen && dx < -SWIPE_DISTANCE) {
					tracking = null;
					toggleDrawer(false);
				}
			},
			{ passive: true },
		);
		const stop = () => {
			tracking = null;
		};
		document.addEventListener('touchend', stop, { passive: true });
		document.addEventListener('touchcancel', stop, { passive: true });
	}

	function watchLongPress() {
		let timer = 0;
		let origin = null;
		const cancel = () => {
			if (timer) clearTimeout(timer);
			timer = 0;
			origin = null;
		};
		document.addEventListener(
			'touchstart',
			(event) => {
				cancel();
				if (settings.mobileLongPress === false || !touchLayout() || event.touches.length !== 1) return;
				const row = event.target.closest('.explorer .row');
				if (!row) return;
				const touch = event.touches[0];
				origin = { x: touch.clientX, y: touch.clientY, row };
				timer = setTimeout(() => {
					timer = 0;
					if (!origin) return;
					const menuEvent = new MouseEvent('contextmenu', {
						bubbles: true,
						cancelable: true,
						clientX: origin.x,
						clientY: origin.y,
						button: 2,
					});
					lastSyntheticContextMenu = Date.now();
					vibrate(12);
					origin.row.dispatchEvent(menuEvent);
					origin = null;
				}, LONG_PRESS_MS);
			},
			{ passive: true },
		);
		document.addEventListener(
			'touchmove',
			(event) => {
				if (!origin) return;
				const touch = event.touches[0];
				if (Math.abs(touch.clientX - origin.x) > MOVE_TOLERANCE || Math.abs(touch.clientY - origin.y) > MOVE_TOLERANCE) {
					cancel();
				}
			},
			{ passive: true },
		);
		document.addEventListener('touchend', cancel, { passive: true });
		document.addEventListener('touchcancel', cancel, { passive: true });
		document.addEventListener(
			'contextmenu',
			(event) => {
				if (!event.isTrusted || !event.target.closest('.explorer')) return;
				if (Date.now() - lastSyntheticContextMenu < CONTEXT_MENU_GRACE_MS) {
					event.preventDefault();
					event.stopImmediatePropagation();
					return;
				}
				cancel();
			},
			true,
		);
	}

	function applySettings(values) {
		settings = { ...settings, ...values };
		documentElement.setAttribute(
			'data-touch-targets',
			settings.mobileLargeTargets === false ? 'normal' : 'large',
		);
		syncStrip();
	}

	function bindStore() {
		const store = root.SynapseSettingsStore;
		if (!store || bindStore.done) return;
		bindStore.done = true;
		applySettings(store.all());
		store.subscribe(applySettings);
	}

	function boot() {
		mountStrip();
		bindStore();
		watchKeyboard();
		watchSwipe();
		watchLongPress();
		root.addEventListener('synapse:mobile-layout', syncStrip);
		root.addEventListener('load', () => {
			mountStrip();
			bindStore();
		}, { once: true });
	}

	applySettings({});

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', boot, { once: true });
	} else {
		boot();
	}

	root.SynapseMobileComfort = Object.freeze({
		refresh: syncStrip,
		keys: Object.freeze(KEYS.map((key) => key.id)),
	});
})(typeof globalThis !== 'undefined' ? globalThis : window);
