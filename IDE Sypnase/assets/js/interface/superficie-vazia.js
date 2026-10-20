(function () {
	'use strict';

	var root = document.documentElement;
	var watched = ['editorGrid', 'mediaView', 'previewEmpty', 'editorEmpty', 'editorTabs', 'tabs'];
	var pending = 0;

	function visible(element) {
		if (!element) return false;
		if (element.hidden) return false;
		if (element.classList && element.classList.contains('hidden')) return false;
		if (element.style && element.style.display === 'none') return false;
		return true;
	}

	function refresh() {
		var editing =
			visible(document.getElementById('editorGrid')) || visible(document.getElementById('mediaView'));
		var welcome = visible(document.getElementById('previewEmpty'));
		root.classList.toggle('sem-arquivo', !editing);
		root.classList.toggle('sem-projeto', !editing && welcome);
	}

	function schedule() {
		if (pending) return;
		pending = window.requestAnimationFrame(function () {
			pending = 0;
			refresh();
		});
	}

	function observe() {
		if (typeof window.MutationObserver !== 'function') return;
		var observer = new window.MutationObserver(schedule);
		for (var index = 0; index < watched.length; index += 1) {
			var element = document.getElementById(watched[index]);
			if (!element) continue;
			observer.observe(element, {
				attributes: true,
				attributeFilter: ['class', 'hidden', 'style'],
				childList: true,
			});
		}
	}

	function start() {
		refresh();
		observe();
		window.addEventListener('resize', schedule);
		document.addEventListener('click', schedule, true);
		document.addEventListener('keyup', schedule, true);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', start, { once: true });
	} else {
		start();
	}

	window.SynapseSuperficieVazia = Object.freeze({ refresh: refresh, schedule: schedule });
})();
