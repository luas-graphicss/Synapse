(function () {
	const root = document.documentElement;

	const MOBILE_MAX_WIDTH = 900;
	const NARROW_MAX_WIDTH = 720;

	const SHORT_MAX_HEIGHT = 520;
	const SHORT_MAX_WIDTH = 1024;

	function media(query) {
		try {
			return window.matchMedia(query).matches;
		} catch (e) {
			ignorarErro(e, 'media');
			return false;
		}
	}

	function isTouchFirst() {
		if (!media('(pointer: coarse)')) return false;
		if (!media('(hover: none)')) return false;
		if (media('(any-hover: hover)')) return false;
		return true;
	}

	function hasTouchScreen() {
		if (media('(any-pointer: coarse)')) return true;
		if (navigator.maxTouchPoints > 0) return true;
		return 'ontouchstart' in window;
	}

	function layoutWidth() {
		const clientWidth = (document.documentElement && document.documentElement.clientWidth) || 0;
		return window.innerWidth || clientWidth || 9999;
	}

	function layoutHeight(mobile) {
		const vv = window.visualViewport;
		if (mobile && vv && vv.height) return vv.height;
		return window.innerHeight || 0;
	}

	function layoutMode() {
		const api = window.SynapseMobileMode;
		return api && typeof api.get === 'function' ? api.get() : 'auto';
	}

	function apply() {
		const w = layoutWidth();
		const mode = layoutMode();
		const touchFirst = isTouchFirst();
		const detectedMobile = touchFirst || w <= MOBILE_MAX_WIDTH;
		const mobile = mode === 'phone' ? true : mode === 'desktop' ? false : detectedMobile;

		root.classList.toggle('aurora-mobile', mobile);
		const viewportHeight =
			window.innerHeight || (document.documentElement && document.documentElement.clientHeight) || 0;
		const shortViewport = viewportHeight > 0 && viewportHeight <= SHORT_MAX_HEIGHT && w <= SHORT_MAX_WIDTH;
		const detectedNarrow = w <= NARROW_MAX_WIDTH || shortViewport;
		const narrow = mode === 'phone' ? true : mode === 'desktop' ? false : detectedNarrow;

		root.classList.toggle('aurora-narrow', narrow);
		root.classList.toggle('aurora-touch', mobile && (mode === 'phone' || hasTouchScreen()));
		root.classList.toggle('aurora-desktop-touch', !mobile && hasTouchScreen());
		if (!narrow) root.classList.remove('exp-open');

		const h = layoutHeight(mobile);
		if (h) root.style.setProperty('--app-vh', h / 100 + 'px');

		try {
			window.dispatchEvent(
				new CustomEvent('synapse:mobile-layout', { detail: { mobile, narrow, mode, width: w } }),
			);
		} catch (e) {
			ignorarErro(e, 'mobile-layout-event');
		}
	}

	function revealActiveTab() {
		const t = document.querySelector('.tabs .tab.active');
		if (t && t.scrollIntoView) {
			try {
				t.scrollIntoView({ inline: 'nearest', block: 'nearest' });
			} catch (e) {
				ignorarErro(e, 'revealActiveTab');
			}
		}
	}

	function setupDrawer() {
		const explorer = document.querySelector('.explorer');
		const toolbar = document.querySelector('.toolbar');
		if (!explorer || !toolbar) return;
		let backdrop = document.getElementById('auroraExpBackdrop');
		if (!backdrop) {
			backdrop = document.createElement('div');
			backdrop.id = 'auroraExpBackdrop';
			document.body.appendChild(backdrop);
		}
		let trigger = document.getElementById('auroraExpToggle');
		if (!trigger) {
			trigger = document.createElement('button');
			trigger.id = 'auroraExpToggle';
			trigger.className = 'tbtn';
			trigger.innerHTML = iconSvg('folder');
			toolbar.prepend(trigger);
		}
		if (trigger.dataset.drawerBound) return;
		trigger.dataset.drawerBound = 'true';
		trigger.type = 'button';
		trigger.title = 'Arquivos';
		trigger.setAttribute('aria-label', 'Arquivos');
		trigger.setAttribute('aria-expanded', 'false');
		explorer.id = explorer.id || 'workspaceExplorer';
		trigger.setAttribute('aria-controls', explorer.id);

		function setOpen(open, restoreFocus = false) {
			root.classList.toggle('exp-open', open);
			trigger.classList.toggle('on', open);
			trigger.setAttribute('aria-expanded', String(open));
			if (restoreFocus) trigger.focus();
		}
		trigger.addEventListener('click', (event) => {
			event.preventDefault();
			event.stopPropagation();
			setOpen(!root.classList.contains('exp-open'));
		});
		backdrop.addEventListener('click', () => setOpen(false, true));
		explorer.addEventListener('click', (event) => {
			if (!root.classList.contains('aurora-narrow') || event.target.closest('.ex-inline')) return;
			if (event.ctrlKey || event.metaKey || event.shiftKey || window.SynapseExplorer?.selectionMode()) return;
			if (event.target.closest('.row[data-file]')) setOpen(false);
		});
		document.addEventListener('keydown', (event) => {
			if (event.key === 'Escape' && root.classList.contains('exp-open')) setOpen(false, true);
		});
	}

	apply();

	if (window.SynapseMobileMode && typeof window.SynapseMobileMode.subscribe === 'function') {
		window.SynapseMobileMode.subscribe(function () {
			apply();
			setTimeout(apply, 50);
		});
	}

	window.addEventListener('resize', apply, { passive: true });
	window.addEventListener('pageshow', apply);
	document.addEventListener('visibilitychange', () => {
		if (!document.hidden) apply();
	});
	window.addEventListener(
		'orientationchange',
		function () {
			apply();
			setTimeout(apply, 250);
			setTimeout(apply, 600);
			setTimeout(revealActiveTab, 650);
		},
		{ passive: true },
	);

	if (window.visualViewport) {
		window.visualViewport.addEventListener('resize', apply, { passive: true });
	}

	function watchTabs() {
		const tabs = document.getElementById('tabs');
		if (!tabs || !window.MutationObserver) return;
		new MutationObserver(function () {
			setTimeout(revealActiveTab, 30);
		}).observe(tabs, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['class'],
		});
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', function () {
			apply();
			watchTabs();
			setupDrawer();
		});
	} else {
		watchTabs();
		setupDrawer();
	}
})();
