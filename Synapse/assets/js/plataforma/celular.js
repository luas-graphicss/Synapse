(function () {
	const root = document.documentElement;

	function isTouch() {
		try {
			if (window.matchMedia('(pointer:coarse)').matches) return true;
			if (window.matchMedia('(hover:none)').matches) return true;
		} catch (e) {
			ignorarErro(e, 'isTouch');
		}
		if (navigator.maxTouchPoints > 1) return true;
		if ('ontouchstart' in window) return true;
		return false;
	}

	function viewportW() {
		const vv = window.visualViewport;
		return Math.min(window.innerWidth || 9999, (vv && vv.width) || 9999);
	}
	function viewportH() {
		const vv = window.visualViewport;
		return (vv && vv.height) || window.innerHeight || 0;
	}

	function apply() {
		const touch = isTouch();
		const w = viewportW();

		root.classList.toggle('aurora-mobile', touch || w <= 900);
		root.classList.toggle('aurora-narrow', w <= 720);
		root.classList.toggle('aurora-touch', touch);

		const h = viewportH();
		if (h) root.style.setProperty('--app-vh', h / 100 + 'px');
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
		const exp = document.querySelector('.explorer');
		const toolbar = document.querySelector('.toolbar');
		if (!exp || !toolbar || document.getElementById('auroraExpToggle')) return;

		const back = document.createElement('div');
		back.id = 'auroraExpBackdrop';
		document.body.appendChild(back);

		const btn = document.createElement('button');
		btn.id = 'auroraExpToggle';
		btn.className = 'tbtn';
		btn.title = 'Arquivos';
		btn.setAttribute('aria-label', 'Arquivos');
		btn.innerHTML =
			'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
			'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 ' +
			'1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
		toolbar.insertBefore(btn, toolbar.firstChild);

		function setOpen(v) {
			root.classList.toggle('exp-open', v);
			btn.classList.toggle('on', v);
			btn.setAttribute('aria-expanded', v ? 'true' : 'false');
		}
		btn.addEventListener('click', function (e) {
			e.preventDefault();
			e.stopPropagation();
			setOpen(!root.classList.contains('exp-open'));
		});
		back.addEventListener('click', function () {
			setOpen(false);
		});

		exp.addEventListener('click', function (e) {
			if (!root.classList.contains('aurora-narrow')) return;
			if (e.target.closest('.tree'))
				setTimeout(function () {
					setOpen(false);
				}, 120);
		});

		document.addEventListener('keydown', function (e) {
			if (e.key === 'Escape') setOpen(false);
		});
	}

	apply();

	window.addEventListener('resize', apply, { passive: true });
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
