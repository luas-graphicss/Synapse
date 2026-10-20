(function (root) {
	'use strict';

	const STORAGE_KEY = 'aurora.theme.ext';
	const ICON_THEME_KEY = 'aurora.iconTheme.ext';
	const MAX_THEME_BYTES = 64 * 1024;
	const REQUIRED = Object.freeze(['bg', 'bg-1', 'bg-2', 'bg-3', 'line', 'txt', 'txt-2', 'acc']);
	const COLOR_TOKENS = Object.freeze([
		'bg', 'bg-1', 'bg-2', 'bg-3', 'line', 'line-2', 'txt', 'txt-2', 'txt-3', 'acc', 'acc-2', 'acc-ink',
		'ok', 'warn', 'err', 'info',
		'tk-key', 'tk-str', 'tk-num', 'tk-com', 'tk-tag', 'tk-attr', 'tk-punc', 'tk-fn',
		'preview-a', 'preview-b', 'preview-veil', 'scrim',
	]);
	const DERIVED_FALLBACK = Object.freeze({
		'line-2': 'line',
		'txt-3': 'txt-2',
		'acc-2': 'acc',
		'acc-ink': 'bg',
		'preview-a': 'bg-1',
		'preview-b': 'bg',
	});
	const themes = new Map();
	const iconThemes = new Map();
	let styleNode = null;
	let activeThemeId = null;
	let activeIconThemeId = null;
	let hoverRestore = null;
	let wrapped = false;
	let iconsWrapped = false;
	let nativeFileIcons = null;
	let systemExtensionId = null;
	let systemMedia = null;
	let observing = false;
	const changeListeners = new Set();

	function output() {
		return root.SynapseExtensionOutput;
	}

	function warn(extensionId, message) {
		if (output()) output().warn(extensionId, message);
	}

	function esc(text) {
		return typeof root.escaparHtml === 'function' ? root.escaparHtml(String(text)) : String(text).replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
	}

	function slug(text) {
		return String(text || '')
			.toLowerCase()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 40) || 'tema';
	}

	function validColor(value) {
		return typeof value === 'string' && value.length <= 60 && typeof CSS !== 'undefined' && CSS.supports && CSS.supports('color', value);
	}

	function readJson(item, path, label) {
		const normalized = String(path || '').replace(/^\.\//, '');
		const text = item.files.get(normalized);
		if (typeof text !== 'string') {
			warn(item.id, `${label}: arquivo "${normalized}" não encontrado na extensão.`);
			return null;
		}
		if (text.length > MAX_THEME_BYTES) {
			warn(item.id, `${label}: "${normalized}" excede ${MAX_THEME_BYTES / 1024} KB.`);
			return null;
		}
		try {
			return JSON.parse(text);
		} catch (error) {
			warn(item.id, `${label}: JSON inválido em "${normalized}" (${error.message}).`);
			return null;
		}
	}

	function hexToRgb(color) {
		const probe = document.createElement('span');
		probe.style.color = color;
		document.body.appendChild(probe);
		const computed = getComputedStyle(probe).color;
		probe.remove();
		const match = computed.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
		return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
	}

	function luminance(color) {
		const rgb = hexToRgb(color);
		if (!rgb) return 0;
		return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
	}

	function compile(item, entry, json) {
		const label = String(entry.label || json.name || 'Tema').slice(0, 60);
		const id = `ext:${item.id}/${slug(label)}`;
		const colors = json && json.colors && typeof json.colors === 'object' ? json.colors : {};
		const resolved = {};
		const problems = [];
		COLOR_TOKENS.forEach((token) => {
			const value = colors[token];
			if (value === undefined) return;
			if (validColor(value)) resolved[token] = String(value).trim();
			else problems.push(`cor inválida em "${token}"`);
		});
		REQUIRED.forEach((token) => {
			if (!resolved[token]) problems.push(`token obrigatório ausente: "${token}"`);
		});
		if (problems.some((problem) => problem.startsWith('token obrigatório'))) {
			warn(item.id, `contributes.themes "${label}": ${problems.join('; ')}.`);
			return null;
		}
		Object.keys(DERIVED_FALLBACK).forEach((token) => {
			if (!resolved[token]) resolved[token] = resolved[DERIVED_FALLBACK[token]];
		});
		if (problems.length) warn(item.id, `contributes.themes "${label}": ${problems.join('; ')}.`);
		const kind = entry.uiTheme === 'light' || json.type === 'light' ? 'light' : entry.uiTheme === 'dark' || json.type === 'dark' ? 'dark' : luminance(resolved.bg) > 0.5 ? 'light' : 'dark';
		const accentRgb = hexToRgb(resolved.acc);
		const declarations = Object.keys(resolved).map((token) => `--${token}:${resolved[token]}`);
		if (accentRgb) declarations.push(`--acc-rgb:${accentRgb.join(', ')}`);
		declarations.push(`--acc-grad:${resolved.acc}`);
		if (typeof json.grain === 'number' && json.grain >= 0 && json.grain <= 0.3) declarations.push(`--grain:${json.grain}`);
		declarations.push(`color-scheme:${kind}`);
		return {
			id,
			label,
			extensionId: item.id,
			extensionName: String((item.manifest && item.manifest.name) || item.id).slice(0, 60),
			kind,
			bg: resolved.bg,
			acc: resolved.acc,
			css: `:root[data-theme="${id}"]{${declarations.join(';')}}`,
		};
	}

	function rebuildStyle() {
		if (!styleNode) {
			styleNode = document.createElement('style');
			styleNode.id = 'extThemes';
			document.head.appendChild(styleNode);
		}
		styleNode.textContent = [...themes.values()].map((theme) => theme.css).join('\n');
	}

	function currentTheme() {
		return document.documentElement.getAttribute('data-theme') || 'dark';
	}

	function systemKind() {
		return root.matchMedia && root.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
	}

	function pairedExtensions() {
		const kinds = new Map();
		themes.forEach((theme) => {
			if (!kinds.has(theme.extensionId)) kinds.set(theme.extensionId, new Set());
			kinds.get(theme.extensionId).add(theme.kind);
		});
		return [...kinds.entries()].filter(([, set]) => set.has('light') && set.has('dark')).map(([id]) => id);
	}

	function themeOfKind(extensionId, kind) {
		return [...themes.values()].find((theme) => theme.extensionId === extensionId && theme.kind === kind) || null;
	}

	function themeForSystem(extensionId) {
		return themeOfKind(extensionId, systemKind());
	}

	function ensureSystemMedia() {
		if (systemMedia || !root.matchMedia) return;
		systemMedia = root.matchMedia('(prefers-color-scheme: light)');
		const handler = () => {
			if (!systemExtensionId) return;
			const theme = themeForSystem(systemExtensionId);
			if (!theme || theme.id === activeThemeId) return;
			setDocumentTheme(theme.id);
			paintPanel();
		};
		if (typeof systemMedia.addEventListener === 'function') systemMedia.addEventListener('change', handler);
		else if (typeof systemMedia.addListener === 'function') systemMedia.addListener(handler);
	}

	function setDocumentTheme(id) {
		hoverRestore = null;
		activeThemeId = id;
		document.documentElement.setAttribute('data-theme', id);
		if (root.State) root.State.theme = id;
		if (root.el && root.el.themeBtn && typeof root.iconSvg === 'function') root.el.themeBtn.innerHTML = root.iconSvg('palette');
	}

	function persistChoice(value) {
		try {
			localStorage.setItem(STORAGE_KEY, value);
		} catch (error) {}
	}

	function applySystemTheme(extensionId, persist) {
		const theme = themeForSystem(extensionId);
		if (!theme) return false;
		ensureSystemMedia();
		systemExtensionId = extensionId;
		setDocumentTheme(theme.id);
		if (persist !== false) persistChoice(`auto:${extensionId}`);
		paintPanel();
		return true;
	}

	function applyExtensionTheme(id, persist) {
		if (typeof id === 'string' && id.startsWith('auto:')) return applySystemTheme(id.slice(5), persist);
		const theme = themes.get(id);
		if (!theme) return false;
		systemExtensionId = null;
		setDocumentTheme(id);
		if (persist !== false) persistChoice(id);
		paintPanel();
		return true;
	}

	function clearExtensionTheme() {
		activeThemeId = null;
		systemExtensionId = null;
		try {
			localStorage.removeItem(STORAGE_KEY);
		} catch (error) {}
	}

	function wrapThemeFunctions() {
		if (wrapped) return;
		const originalApply = root.applyTheme;
		const originalRender = root.renderThemePanel;
		if (typeof originalApply !== 'function' || typeof originalRender !== 'function') return;
		wrapped = true;
		root.applyTheme = function (theme) {
			hoverRestore = null;
			if (typeof theme === 'string' && /^(ext|auto):/.test(theme)) {
				if (applyExtensionTheme(theme)) return;
				theme = 'dark';
			}
			clearExtensionTheme();
			return originalApply.apply(this, [theme]);
		};
		root.renderThemePanel = function () {
			const result = originalRender.apply(this, arguments);
			paintPanel();
			return result;
		};
		const originalToggle = root.toggleTheme;
		if (typeof originalToggle === 'function') {
			root.toggleTheme = function () {
				if (activeThemeId) {
					clearExtensionTheme();
					return originalApply.apply(this, ['dark']);
				}
				return originalToggle.apply(this, arguments);
			};
		}
	}

	function paintPanel() {
		const container = document.getElementById('tmThemes');
		if (!container) return;
		container.querySelectorAll('.tm-th.ext').forEach((node) => node.remove());
		if (activeThemeId) container.querySelectorAll('.tm-th.on').forEach((node) => node.classList.remove('on'));
		if (!themes.size) return;
		const fragment = document.createDocumentFragment();
		[...themes.values()]
			.sort((a, b) => a.label.localeCompare(b.label, 'pt'))
			.forEach((theme) => {
				const button = document.createElement('button');
				button.type = 'button';
				button.className = 'tm-th ext' + (theme.id === activeThemeId ? ' on' : '');
				button.dataset.theme = theme.id;
				button.title = `${theme.label} · extensão ${theme.extensionId}`;
				button.innerHTML = `<span class="tm-sw" style="background:${esc(theme.bg)}"><i style="background:${esc(theme.acc)}"></i></span><span>${esc(theme.label)}</span>`;
				button.addEventListener('mouseenter', () => previewStart(theme.id));
				button.addEventListener('mouseleave', previewEnd);
				button.addEventListener('focus', () => previewStart(theme.id));
				button.addEventListener('blur', previewEnd);
				fragment.appendChild(button);
			});
		pairedExtensions().forEach((extensionId) => {
			const dark = themeOfKind(extensionId, 'dark');
			const light = themeOfKind(extensionId, 'light');
			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'tm-th ext auto' + (systemExtensionId === extensionId ? ' on' : '');
			button.dataset.theme = `auto:${extensionId}`;
			button.title = `Alterna entre "${dark.label}" e "${light.label}" conforme o modo claro/escuro do sistema`;
			button.innerHTML = `<span class="tm-sw" style="background:linear-gradient(135deg,${esc(dark.bg)} 50%,${esc(light.bg)} 50%)"><i style="background:${esc(dark.acc)}"></i></span><span>${esc(dark.extensionName)}: Sistema</span>`;
			button.addEventListener('mouseenter', () => previewStart(themeForSystem(extensionId).id));
			button.addEventListener('mouseleave', previewEnd);
			button.addEventListener('focus', () => previewStart(themeForSystem(extensionId).id));
			button.addEventListener('blur', previewEnd);
			fragment.appendChild(button);
		});
		container.appendChild(fragment);
	}

	function previewStart(id) {
		if (!themes.has(id)) return;
		if (!hoverRestore) hoverRestore = currentTheme();
		document.documentElement.setAttribute('data-theme', id);
	}

	function previewEnd() {
		if (!hoverRestore) return;
		const restore = hoverRestore;
		hoverRestore = null;
		if (currentTheme() !== restore) document.documentElement.setAttribute('data-theme', restore);
	}

	function registerThemes(item) {
		const declared = Array.isArray(item.manifest.contributes.themes) ? item.manifest.contributes.themes : [];
		if (!declared.length) return;
		let stored = null;
		try {
			stored = localStorage.getItem(STORAGE_KEY);
		} catch (error) {}
		declared.forEach((entry) => {
			if (!entry || typeof entry.path !== 'string') return;
			const json = readJson(item, entry.path, `contributes.themes "${entry.label || entry.path}"`);
			if (!json) return;
			const compiled = compile(item, entry, json);
			if (!compiled) return;
			if (themes.has(compiled.id)) warn(item.id, `Tema "${compiled.label}" declarado mais de uma vez; o último vence.`);
			themes.set(compiled.id, compiled);
		});
		rebuildStyle();
		wrapThemeFunctions();
		if (stored && themes.has(stored) && !activeThemeId) applyExtensionTheme(stored, false);
		else if (stored === `auto:${item.id}` && !activeThemeId) applySystemTheme(item.id, false);
		paintPanel();
	}

	function unregisterThemes(item) {
		let removedActive = false;
		[...themes.values()].forEach((theme) => {
			if (theme.extensionId !== item.id) return;
			if (theme.id === activeThemeId) removedActive = true;
			themes.delete(theme.id);
		});
		if (systemExtensionId === item.id) {
			systemExtensionId = null;
			removedActive = true;
		}
		rebuildStyle();
		if (removedActive) {
			activeThemeId = null;
			if (typeof root.applyTheme === 'function') root.applyTheme('dark');
		}
		paintPanel();
	}

	function compileIconTheme(item, entry, json) {
		const label = String(entry.label || json.name || 'Ícones').slice(0, 60);
		const id = `ext:${item.id}/${slug(entry.id || label)}`;
		const definitions = json && json.iconDefinitions && typeof json.iconDefinitions === 'object' ? json.iconDefinitions : {};
		const icons = new Map();
		Object.keys(definitions).forEach((name) => {
			const definition = definitions[name];
			if (!definition || typeof definition !== 'object') return;
			const text = String(definition.label || name).slice(0, 3);
			const color = validColor(definition.color) ? String(definition.color).trim() : 'var(--txt-2)';
			const svg = typeof definition.svg === 'string' && definition.svg.length <= 4096 && /^<svg[\s>]/i.test(definition.svg.trim()) && !/<script|on[a-z]+=|javascript:|<foreignObject|<use|href=/i.test(definition.svg) ? definition.svg.trim() : null;
			icons.set(name, Object.freeze({ name: 'ext-' + slug(name), label: text.toUpperCase(), color, svg }));
		});
		const byExtension = new Map();
		const byFilename = new Map();
		const mapping = (source, target, normalize) => {
			if (!source || typeof source !== 'object') return;
			Object.keys(source).forEach((key) => {
				const icon = icons.get(String(source[key]));
				if (icon) target.set(normalize(key), icon);
			});
		};
		mapping(json.fileExtensions, byExtension, (key) => String(key).toLowerCase().replace(/^\./, ''));
		mapping(json.fileNames, byFilename, (key) => String(key).toLowerCase());
		if (!byExtension.size && !byFilename.size) {
			warn(item.id, `contributes.iconThemes "${label}": nenhum mapeamento em fileExtensions/fileNames.`);
			return null;
		}
		return { id, label, extensionId: item.id, byExtension, byFilename, fallbackToNative: json.inheritsNative !== false };
	}

	function renderIcon(icon) {
		if (icon.svg) return icon.svg.replace(/^<svg/i, `<svg class="icon file-language-icon" data-language="${esc(icon.name)}" aria-hidden="true" focusable="false" style="color:${esc(icon.color)}"`);
		const size = icon.label.length > 2 ? 7 : icon.label.length > 1 ? 9 : 12;
		return `<svg class="icon file-language-icon" data-language="${esc(icon.name)}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" style="color:${esc(icon.color)}"><path d="M5 2.75h9.5L19 7.25V21H5Z" fill="currentColor" fill-opacity=".08" stroke="currentColor" stroke-width="1.2"/><path d="M14 3v5h5" fill="none" stroke="currentColor" stroke-width="1.2"/><text x="12" y="16.7" text-anchor="middle" fill="currentColor" stroke="none" font-family="Arial,sans-serif" font-size="${size}" font-weight="700">${esc(icon.label)}</text></svg>`;
	}

	function lookup(path) {
		const theme = iconThemes.get(activeIconThemeId);
		if (!theme) return null;
		const filename = String(path || '').split(/[\\/]/).pop().toLowerCase();
		if (theme.byFilename.has(filename)) return theme.byFilename.get(filename);
		const extension = filename.includes('.') ? filename.slice(filename.lastIndexOf('.') + 1) : '';
		return theme.byExtension.get(extension) || null;
	}

	function wrapFileIcons() {
		if (iconsWrapped || !root.SynapseFileIcons) return;
		iconsWrapped = true;
		nativeFileIcons = root.SynapseFileIcons;
		root.SynapseFileIcons = Object.freeze({
			resolve(path) {
				return lookup(path) || nativeFileIcons.resolve(path);
			},
			render(path) {
				const icon = lookup(path);
				return icon ? renderIcon(icon) : nativeFileIcons.render(path);
			},
			extensions: nativeFileIcons.extensions,
		});
	}

	function repaintFiles() {
		if (typeof root.renderTree === 'function') {
			try {
				root.renderTree();
			} catch (error) {}
		}
		if (typeof root.renderEditorTabs === 'function') {
			try {
				root.renderEditorTabs();
			} catch (error) {}
		}
	}

	function applyIconTheme(id, persist) {
		if (id && !iconThemes.has(id)) return false;
		activeIconThemeId = id || null;
		if (persist !== false) {
			try {
				if (id) localStorage.setItem(ICON_THEME_KEY, id);
				else localStorage.removeItem(ICON_THEME_KEY);
			} catch (error) {}
		}
		wrapFileIcons();
		repaintFiles();
		return true;
	}

	function registerIconThemes(item) {
		const declared = Array.isArray(item.manifest.contributes.iconThemes) ? item.manifest.contributes.iconThemes : [];
		if (!declared.length) return;
		let stored = null;
		try {
			stored = localStorage.getItem(ICON_THEME_KEY);
		} catch (error) {}
		declared.forEach((entry) => {
			if (!entry || typeof entry.path !== 'string') return;
			const json = readJson(item, entry.path, `contributes.iconThemes "${entry.label || entry.path}"`);
			if (!json) return;
			const compiled = compileIconTheme(item, entry, json);
			if (compiled) iconThemes.set(compiled.id, compiled);
		});
		wrapFileIcons();
		if (stored && iconThemes.has(stored)) applyIconTheme(stored, false);
		else if (!activeIconThemeId && iconThemes.size === 1 && !stored) applyIconTheme([...iconThemes.keys()][0], false);
	}

	function unregisterIconThemes(item) {
		let removedActive = false;
		[...iconThemes.values()].forEach((theme) => {
			if (theme.extensionId !== item.id) return;
			if (theme.id === activeIconThemeId) removedActive = true;
			iconThemes.delete(theme.id);
		});
		if (removedActive) applyIconTheme(null, false);
	}

	function register(item) {
		registerThemes(item);
		registerIconThemes(item);
	}

	function unregister(item) {
		unregisterThemes(item);
		unregisterIconThemes(item);
	}

	function listThemes() {
		return [...themes.values()].map((theme) => ({ id: theme.id, label: theme.label, extensionId: theme.extensionId, kind: theme.kind, active: theme.id === activeThemeId }));
	}

	function snapshot() {
		const id = currentTheme();
		const theme = themes.get(id);
		const kit = root.SynapseExtensionWebviewKit;
		const kind = theme ? theme.kind : kit ? kit.themeSnapshot().kind : 'dark';
		return {
			id,
			kind,
			label: theme ? theme.label : id,
			extensionId: theme ? theme.extensionId : null,
			followsSystem: !!theme && theme.extensionId === systemExtensionId,
		};
	}

	function ensureObserver() {
		if (observing) return;
		observing = true;
		let timer = 0;
		let last = currentTheme();
		const observer = new MutationObserver(() => {
			clearTimeout(timer);
			timer = setTimeout(() => {
				if (hoverRestore) return;
				const id = currentTheme();
				if (id === last) return;
				last = id;
				const current = snapshot();
				changeListeners.forEach((listener) => {
					try {
						listener(current);
					} catch (error) {
						warn('synapse', `Ouvinte de tema falhou: ${error && error.message ? error.message : error}`);
					}
				});
			}, 60);
		});
		observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
	}

	function onDidChange(listener) {
		if (typeof listener !== 'function') return () => {};
		changeListeners.add(listener);
		ensureObserver();
		return () => changeListeners.delete(listener);
	}

	function listIconThemes() {
		return [...iconThemes.values()].map((theme) => ({ id: theme.id, label: theme.label, extensionId: theme.extensionId, active: theme.id === activeIconThemeId }));
	}

	function registerPalette() {
		const registry = root.SynapseExtensions;
		if (!registry || typeof registry.registerPaletteCommand !== 'function') return;
		registry.registerPaletteCommand(() => ({
			id: 'ext-icon-theme',
			label: 'Extensões: Escolher tema de ícones de arquivo',
			hint: iconThemes.size ? `${iconThemes.size} tema(s) disponível(is)` : 'nenhum tema de ícones instalado',
			icon: 'folder',
			on: iconThemes.size > 0,
			run: pickIconTheme,
		}));
	}

	async function pickIconTheme() {
		const windowApi = root.SynapseExtensionWindow;
		if (!windowApi) return;
		const items = [{ label: 'Padrão do Synapse', description: activeIconThemeId ? '' : 'ativo', id: null }].concat(
			[...iconThemes.values()].map((theme) => ({ label: theme.label, description: (theme.id === activeIconThemeId ? 'ativo · ' : '') + theme.extensionId, id: theme.id })),
		);
		const context = { descriptor: { id: 'synapse', manifest: { name: 'Synapse' } } };
		const picked = await windowApi.showQuickPick({ items, options: { title: 'Tema de ícones de arquivo', placeHolder: 'Selecione um tema' } }, context);
		if (!Array.isArray(picked) || !picked.length) return;
		applyIconTheme(items[picked[0]].id);
	}

	root.SynapseExtensionThemes = Object.freeze({
		register,
		unregister,
		applyTheme: applyExtensionTheme,
		applySystemTheme,
		applyIconTheme,
		listThemes,
		listIconThemes,
		snapshot,
		onDidChange,
		get followsSystem() {
			return systemExtensionId;
		},
		get activeTheme() {
			return activeThemeId;
		},
		get activeIconTheme() {
			return activeIconThemeId;
		},
	});

	if (document.readyState === 'complete') setTimeout(registerPalette, 0);
	else root.addEventListener('load', () => setTimeout(registerPalette, 0), { once: true });
})(window);
