(function (root) {
	'use strict';

	const MAX_SCRIPT_BYTES = 256 * 1024;
	const PRESETS = Object.freeze({
		celular: { w: 390, h: 844, dpr: 3, touch: true },
		celular_pequeno: { w: 360, h: 640, dpr: 2, touch: true },
		tablet: { w: 820, h: 1180, dpr: 2, touch: true },
		notebook: { w: 1366, h: 768, dpr: 1, touch: false },
		desktop: { w: 1920, h: 1080, dpr: 1, touch: false },
	});
	const observedFrames = new WeakSet();
	let observer = null;
	let lastReloadAt = 0;

	function rpc() {
		return root.SynapseExtensionRpc;
	}

	function registry() {
		return root.SynapseExtensions;
	}

	function fail(code, message, data) {
		const api = rpc();
		return new api.RpcError(api.ERROR_CODES[code] || code, message, data);
	}

	function byteLength(text) {
		return new TextEncoder().encode(text).length;
	}

	function project(context) {
		return registry() ? registry().projectFor(context.descriptor.id) : typeof root.activeProject === 'function' ? root.activeProject() : null;
	}

	function frame() {
		return root.el && root.el.frame ? root.el.frame : document.getElementById('frame');
	}

	function frameDocument() {
		const node = frame();
		if (!node) return null;
		try {
			return node.contentDocument || (node.contentWindow ? node.contentWindow.document : null);
		} catch (error) {
			return null;
		}
	}

	function describeFrame() {
		const node = frame();
		if (!node) return { mode: 'none', url: '' };
		if (node.hasAttribute('srcdoc') && node.getAttribute('srcdoc') !== '') return { mode: 'srcdoc', url: '' };
		const src = node.getAttribute('src') || '';
		return { mode: src ? 'url' : 'empty', url: src };
	}

	function announceReload() {
		const now = Date.now();
		if (now - lastReloadAt < 40) return;
		lastReloadAt = now;
		if (!registry()) return;
		const active = typeof root.activeProject === 'function' ? root.activeProject() : null;
		registry().broadcast('preview.reloaded', { projectId: active ? active.id : null, projectName: active ? active.name : '', ...describeFrame() });
	}

	function observeFrame(node) {
		if (!node || observedFrames.has(node)) return;
		observedFrames.add(node);
		node.addEventListener('load', () => {
			const state = describeFrame();
			if (state.mode === 'empty') return;
			announceReload();
		});
	}

	function ensureObserver() {
		if (observer) return;
		const device = document.getElementById('device');
		if (!device) return;
		observeFrame(frame());
		observer = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				mutation.addedNodes.forEach((node) => {
					if (node && node.tagName === 'IFRAME') observeFrame(node);
				});
			});
		});
		observer.observe(device, { childList: true });
	}

	function injectScript(params, context) {
		const source = String(params.source || '');
		if (!source.trim()) throw fail('INVALID_PARAMS', 'injectScript: código vazio.');
		if (byteLength(source) > MAX_SCRIPT_BYTES) throw fail('INVALID_PARAMS', 'injectScript: código excede 256 KB.');
		const doc = frameDocument();
		if (!doc || !doc.documentElement) throw fail('HOST_ERROR', 'O preview não está acessível (vazio, carregando ou servido por URL externa).');
		const script = doc.createElement('script');
		script.dataset.synapseExtension = context.descriptor.id;
		script.textContent = source;
		(doc.head || doc.documentElement).appendChild(script);
		script.remove();
		return true;
	}

	function reload(params, context) {
		const target = project(context);
		if (!target) throw fail('HOST_ERROR', 'Nenhum projeto ativo para recarregar.');
		if (params && params.full && root.SynapsePreviewProjectBlobs) root.SynapsePreviewProjectBlobs.releaseAll(target);
		if (typeof root.scheduleBuild !== 'function') throw fail('HOST_ERROR', 'Reconstrução do preview indisponível.');
		target.previewDirty = true;
		root.scheduleBuild(target);
		return true;
	}

	function currentViewport(target) {
		const custom = target && target.viewport;
		if (custom) return { width: custom.w, height: custom.h, dpr: custom.dpr || 0, touch: !!custom.touch, preset: custom.label || 'personalizado' };
		const stage = root.el && root.el.stage ? root.el.stage.getBoundingClientRect() : null;
		return { width: stage ? Math.round(stage.width) : 0, height: stage ? Math.round(stage.height) : 0, dpr: 0, touch: false, preset: 'padrao' };
	}

	function setViewport(params, context) {
		const target = project(context);
		if (!target) throw fail('HOST_ERROR', 'Nenhum projeto ativo.');
		const preset = String(params.preset || '').trim().toLowerCase();
		const reset = preset === 'padrao' || preset === 'reset' || preset === 'default';
		if (preset && !reset && !PRESETS[preset]) throw fail('INVALID_PARAMS', `Preset desconhecido "${preset}". Use celular, celular_pequeno, tablet, notebook, desktop ou padrao.`);
		let config = null;
		if (!reset) {
			const base = PRESETS[preset] || target.viewport || { w: 1280, h: 720, dpr: 0, touch: false };
			let width = params.width !== undefined ? Math.round(Number(params.width)) : base.w;
			let height = params.height !== undefined ? Math.round(Number(params.height)) : base.h;
			if (!(width >= 16 && width <= 4096) || !(height >= 16 && height <= 4096)) throw fail('INVALID_PARAMS', 'width/height devem estar entre 16 e 4096.');
			const dpr = params.dpr !== undefined ? Math.min(4, Math.max(0.5, Number(params.dpr) || 1)) : base.dpr || 0;
			const touch = params.touch !== undefined ? !!params.touch : !!base.touch;
			const orientation = String(params.orientation || '').toLowerCase();
			if ((orientation === 'landscape' && height > width) || (orientation === 'portrait' && width > height)) [width, height] = [height, width];
			config = { w: width, h: height, dpr, touch, label: preset || 'personalizado' };
		}
		target.viewport = config;
		const active = typeof root.activeProject === 'function' ? root.activeProject() : null;
		if (active && active.id === target.id && typeof root.applyDevice === 'function') {
			if (config && root.el && root.el.device && root.el.stage && root.Core && typeof root.placeDevice === 'function') {
				root.el.device.classList.remove('bordered');
				const rect = root.el.stage.getBoundingClientRect();
				const scale = root.Core.computeFitScale(rect.width, rect.height, config.w, config.h, 22);
				root.placeDevice(config.w, config.h, scale, 0);
			} else root.applyDevice();
		}
		return currentViewport(target);
	}

	function getViewport(params, context) {
		return currentViewport(project(context));
	}

	function state(params, context) {
		const target = project(context);
		return { projectId: target ? target.id : null, projectName: target ? target.name : '', layout: root.State ? root.State.layout : '', ...describeFrame(), viewport: currentViewport(target) };
	}

	const handlers = Object.freeze({
		'preview.injectScript': injectScript,
		'preview.reload': reload,
		'preview.setViewport': setViewport,
		'preview.getViewport': getViewport,
		'preview.state': state,
	});

	root.SynapseExtensionPreview = Object.freeze({ handlers, PRESETS, ensureObserver });

	if (document.readyState === 'complete') setTimeout(ensureObserver, 0);
	else root.addEventListener('load', () => setTimeout(ensureObserver, 0), { once: true });
})(window);
