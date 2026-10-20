(function () {
	'use strict';

	const DEFAULT_CHUNK_SIZE = 100;

	function releaseToInterface() {
		return new Promise((resolve) => {
			if (document.hidden) {
				setTimeout(resolve, 0);
				return;
			}
			requestAnimationFrame(() => setTimeout(resolve, 0));
		});
	}

	async function forEachInChunks(items, handleItem, options) {
		const settings = options || {};
		const chunkSize = settings.chunkSize > 0 ? settings.chunkSize : DEFAULT_CHUNK_SIZE;
		const sliceMs = settings.sliceMs > 0 ? settings.sliceMs : 0;
		const reportProgress = settings.onProgress || null;
		const total = items.length;
		let processed = 0;
		let sliceStart = performance.now();
		for (const item of items) {
			handleItem(item, processed);
			processed++;
			if (processed >= total) continue;
			const due = sliceMs ? performance.now() - sliceStart >= sliceMs : processed % chunkSize === 0;
			if (due) {
				if (reportProgress) reportProgress(processed, total);
				await releaseToInterface();
				sliceStart = performance.now();
			}
		}
		if (reportProgress) reportProgress(processed, total);
	}

	window.SynapseChunkedWork = Object.freeze({ forEachInChunks });
})();
