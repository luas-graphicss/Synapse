
(function () {
	'use strict';

	var root = document.documentElement;
	var BAR_ID = 'auroraPaneBar';
	var bar = null;
	var buttons = {};
	var mounted = false;

	function ignore(error) {
		if (typeof window.ignorarErro === 'function') {
			try {
				window.ignorarErro(error, 'celular-paineis');
				return;
			} catch (e) {
			}
		}
	}

	function narrow() {
		return root.classList.contains('aurora-narrow');
	}

	function translate(text) {
		try {
			if (window.SynapseI18n && typeof window.SynapseI18n.t === 'function') {
				return window.SynapseI18n.t(text) || text;
			}
		} catch (e) {
			ignore(e);
		}
		return text;
	}

	function measureSafeArea() {
		try {
			var probe = document.createElement('div');
			probe.style.cssText =
				'position:fixed;left:-9999px;bottom:0;width:1px;padding-bottom:env(safe-area-inset-bottom);pointer-events:none;visibility:hidden';
			document.body.appendChild(probe);
			var value = parseFloat(getComputedStyle(probe).paddingBottom) || 0;
			probe.remove();
			root.style.setProperty('--mpane-safe-b', value.toFixed(2) + 'px');
		} catch (e) {
			ignore(e);
		}
	}

	var ICONS = {
		files: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>',
		code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5"></path>',
		preview:
			'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle>',
		console:
			'<rect x="3" y="4" width="18" height="16" rx="1"></rect><path d="M7 9l3 3-3 3M13 15h4"></path>',
		external:
			'<path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"></path>',
	};

	function makeButton(key, label, iconKey) {
		var button = document.createElement('button');
		button.type = 'button';
		button.dataset.mpb = key;
		button.setAttribute('aria-label', label);
		button.innerHTML =
			'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
			'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
			ICONS[iconKey] +
			'</svg><span class="mpb-label"></span>';
		button.querySelector('.mpb-label').textContent = label;
		buttons[key] = button;
		return button;
	}

	function click(id) {
		var target = document.getElementById(id);
		if (!target) return false;
		try {
			target.click();
			return true;
		} catch (e) {
			ignore(e);
			return false;
		}
	}

	function consoleOpen() {
		var pane = document.getElementById('console');
		return !!(pane && pane.classList.contains('open'));
	}

	function closeDrawer() {
		if (root.classList.contains('exp-open')) click('auroraExpToggle');
	}

	function showPane(pane) {
		root.setAttribute('data-mpane', pane);
		closeDrawer();
		if (pane === 'preview') {
			try {
				if (window.State && window.State.layout === 'editor' && typeof window.setLayout === 'function') {
					window.setLayout('split');
				}
			} catch (e) {
				ignore(e);
			}
		}
		sync();
		try {
			window.dispatchEvent(new Event('resize'));
		} catch (e) {
			ignore(e);
		}
	}

	function sync() {
		if (!bar) return;
		var pane = root.getAttribute('data-mpane') || 'editor';
		var drawer = root.classList.contains('exp-open');
		var setOn = function (key, on) {
			if (!buttons[key]) return;
			buttons[key].classList.toggle('on', !!on);
			buttons[key].setAttribute('aria-pressed', on ? 'true' : 'false');
		};
		setOn('files', drawer);
		setOn('editor', !drawer && pane === 'editor');
		setOn('preview', !drawer && pane === 'preview');
		setOn('console', consoleOpen());

		var source = document.getElementById('consoleBadge');
		var target = buttons.console && buttons.console.querySelector('.mpb-badge');
		var count = 0;
		if (source && !source.classList.contains('hidden')) count = parseInt(source.textContent, 10) || 0;
		if (count > 0) {
			if (!target) {
				target = document.createElement('span');
				target.className = 'mpb-badge';
				buttons.console.appendChild(target);
			}
			target.textContent = count > 99 ? '99+' : String(count);
		} else if (target) {
			target.remove();
		}
	}

	function mount() {
		if (mounted || !document.body) return;
		mounted = true;
		bar = document.getElementById(BAR_ID);
		if (!bar) {
			bar = document.createElement('nav');
			bar.id = BAR_ID;
			bar.setAttribute('aria-label', translate('Painéis'));
			bar.appendChild(makeButton('files', translate('Arquivos'), 'files'));
			bar.appendChild(makeButton('editor', translate('Código'), 'code'));
			bar.appendChild(makeButton('preview', translate('Preview'), 'preview'));
			bar.appendChild(makeButton('console', translate('Console'), 'console'));
			bar.appendChild(makeButton('popout', translate('Nova aba'), 'external'));
			document.body.appendChild(bar);
		}

		bar.addEventListener('click', function (event) {
			var button = event.target.closest('[data-mpb]');
			if (!button) return;
			var key = button.dataset.mpb;
			if (key === 'files') {
				click('auroraExpToggle');
				sync();
				return;
			}
			if (key === 'console') {
				closeDrawer();
				click('consoleBtn');
				sync();
				return;
			}
			if (key === 'popout') {
				click('popoutBtn');
				return;
			}
			showPane(key);
		});

		var seg = document.getElementById('layoutSeg');
		if (seg) {
			seg.addEventListener('click', function (event) {
				var button = event.target.closest('[data-lay]');
				if (!button || !narrow()) return;
				var lay = button.dataset.lay;
				root.setAttribute('data-mpane', lay === 'preview' ? 'preview' : 'editor');
				sync();
			});
		}

		var badge = document.getElementById('consoleBadge');
		if (badge && window.MutationObserver) {
			new MutationObserver(sync).observe(badge, {
				attributes: true,
				childList: true,
				characterData: true,
				subtree: true,
			});
		}
		var pane = document.getElementById('console');
		if (pane && window.MutationObserver) {
			new MutationObserver(sync).observe(pane, { attributes: true, attributeFilter: ['class'] });
		}
		if (window.MutationObserver) {
			new MutationObserver(apply).observe(root, { attributes: true, attributeFilter: ['class'] });
		}
	}

	function apply() {
		if (narrow()) {
			mount();
			if (!root.getAttribute('data-mpane')) {
				var initial = 'editor';
				try {
					if (window.State && window.State.layout === 'preview') initial = 'preview';
				} catch (e) {
					ignore(e);
				}
				root.setAttribute('data-mpane', initial);
			}
			measureSafeArea();
			sync();
		} else if (root.hasAttribute('data-mpane')) {
			root.removeAttribute('data-mpane');
			try {
				if (window.State && typeof window.setLayout === 'function') window.setLayout(window.State.layout);
			} catch (e) {
				ignore(e);
			}
		}
	}

	function boot() {
		apply();
		window.addEventListener('resize', apply, { passive: true });
		window.addEventListener('orientationchange', function () {
			setTimeout(apply, 60);
		});
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', boot, { once: true });
	} else {
		boot();
	}

	window.SynapseMobilePanes = {
		show: showPane,
		refresh: apply,
		active: function () {
			return root.getAttribute('data-mpane') || null;
		},
	};
})();
