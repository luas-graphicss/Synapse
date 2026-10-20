(function (root) {
	'use strict';

	const source = root.SynapseHoverHintSource;
	const view = root.SynapseHoverTooltipView;
	if (!source || !view) return;

	const OPEN_DELAY = 380;
	const FOCUS_DELAY = 120;

	                                                                          
	                                                                         
	const SILENT_SURFACES = [
		'[data-hint-off]',
		'#editorGrid',
		'#editorScroll',
		'#codeTa',
		'#codeHl',
		'#gutter',
		'#miniMap',
		'#mediaView',
		'.code-ta',
		'.code-hl',
		'.code-wrap',
		'.editor-grid',
		'.editor-scroll',
		'.gutter',
		'.minimap',
		'.editor-caret-mirror',
		'.intellisense-caret-mirror',
		'.intellisense-diagnostics-overlay',
		'.editor-autocomplete',
		'.intellisense-completion',
	].join(', ');

	function isSilentSurface(target) {
		if (!target || typeof target.closest !== 'function') return false;
		try {
			return !!target.closest(SILENT_SURFACES);
		} catch (error) {
			return false;
		}
	}

	let openTimer = 0;
	let currentElement = null;

	function cancel() {
		clearTimeout(openTimer);
		openTimer = 0;
	}

	function hide() {
		cancel();
		currentElement = null;
		view.hide();
	}

	function schedule(hint, delay) {
		cancel();
		currentElement = hint.element;
		openTimer = setTimeout(() => {
			if (currentElement === hint.element) view.show(hint);
		}, delay);
	}

	function openFrom(target, delay) {
		if (isSilentSurface(target)) {
			hide();
			return;
		}
		const hint = source.resolve(target);
		if (!hint) {
			hide();
			return;
		}
		if (hint.element === currentElement && view.isVisible()) return;
		schedule(hint, delay);
	}

	document.addEventListener('pointerover', (event) => {
		if (event.pointerType === 'touch') return;
		openFrom(event.target, OPEN_DELAY);
	});
	document.addEventListener('pointerout', (event) => {
		if (currentElement && !currentElement.contains(event.relatedTarget)) hide();
	});
	document.addEventListener('pointerdown', hide, true);
	document.addEventListener('focusin', (event) => openFrom(event.target, FOCUS_DELAY));
	document.addEventListener('focusout', hide);
	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') hide();
	});
	document.addEventListener('scroll', hide, true);
	document.addEventListener('visibilitychange', hide);
	window.addEventListener('resize', hide);
	window.addEventListener('blur', hide);
})(typeof globalThis !== 'undefined' ? globalThis : window);
