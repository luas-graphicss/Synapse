'use strict';
let __folds = new Set();
function clearFolds() {
	if (__folds.size) __folds = new Set();
	if (typeof el !== 'undefined' && el.codeTa) {
		el.codeTa.readOnly = false;
		el.codeTa.classList.remove('folded');
	}
}
function lineIndent(s) {
	let n = 0;
	for (let i = 0; i < s.length; i++) {
		const c = s[i];
		if (c === ' ') n++;
		else if (c === '\t') n += 2;
		else break;
	}
	return n;
}
function computeFoldRegions(text) {
	const map = new Map();
	if (typeof text !== 'string') return map;
	const lines = text.split('\n');
	const n = lines.length;
	const ind = new Array(n),
		blank = new Array(n);
	for (let i = 0; i < n; i++) {
		const tr = lines[i].trim();
		blank[i] = tr === '';
		ind[i] = blank[i] ? -1 : lineIndent(lines[i]);
	}
	for (let i = 0; i < n; i++) {
		if (blank[i]) continue;
		const base = ind[i];
		let j = i + 1;
		while (j < n && blank[j]) j++;
		if (j >= n || ind[j] <= base) continue;
		let end = i,
			k = i + 1;
		while (k < n) {
			if (blank[k]) {
				k++;
				continue;
			}
			if (ind[k] > base) {
				end = k;
				k++;
			} else break;
		}
		if (end > i) map.set(i, end);
	}
	return map;
}
function toggleFold(i) {
	const p = activeProject();
	if (!p || !p.openFile) return;
	const f = p.files.get(p.openFile);
	if (!f || f.text == null) return;
	if (__folds.has(i)) __folds.delete(i);
	else __folds.add(i);
	paintEditor(p.openFile, f.text);
}
function foldAll() {
	const p = activeProject();
	if (!p || !p.openFile) {
		toast('Nada para dobrar', 'Abra um arquivo primeiro', '');
		return;
	}
	const f = p.files.get(p.openFile);
	if (!f || f.text == null) {
		toast('Sem dobras', 'Este arquivo nao e texto', 'warn');
		return;
	}
	if (__isBigDoc(f.text)) {
		toast(
			'Arquivo muito grande',
			'Dobras ficam desativadas neste arquivo para manter a fluidez',
			'warn',
		);
		return;
	}
	const r = computeFoldRegions(f.text);
	if (__folds.size) {
		__folds = new Set();
		toast('Tudo desdobrado', '', 'ok');
	} else {
		__folds = new Set([...r.keys()]);
		if (!__folds.size) toast('Nada para dobrar', 'Nenhum bloco indentado encontrado', '');
		else toast('Tudo dobrado', __folds.size + ' bloco(s)', 'ok');
	}
	paintEditor(p.openFile, f.text);
}
if (typeof el !== 'undefined' && el.gutter) {
	el.gutter.addEventListener('click', (e) => {
		const fc = e.target.closest('[data-fold]');
		if (!fc) return;
		e.preventDefault();
		e.stopPropagation();
		toggleFold(+fc.getAttribute('data-fold'));
	});
}

let __miniText = '',
	__miniLang = '',
	__miniOn = false;
function loadMiniPref() {
	try {
		return localStorage.getItem('aurora.minimap') === '1';
	} catch (e) {
		return false;
	}
}
function saveMiniPref(v) {
	try {
		localStorage.setItem('aurora.minimap', v ? '1' : '0');
	} catch (e) {
		ignorarErro(e, 'saveMiniPref');
	}
}
function cssVar(n, f) {
	try {
		const v = getComputedStyle(document.documentElement).getPropertyValue(n).trim();
		return v || f;
	} catch (e) {
		return f;
	}
}
function setMinimap(on) {
	__miniOn = on;
	saveMiniPref(on);
	if (el.miniBtn) el.miniBtn.classList.toggle('on', on);
	const p = activeProject();
	if (p && p.openFile) {
		const f = p.files.get(p.openFile);
		if (f && f.text != null) {
			paintEditor(p.openFile, f.text);
			return;
		}
	}
	if (el.miniMap) el.miniMap.classList.add('hidden');
}
function drawMinimap(display, lang) {
	if (display != null) __miniText = display;
	if (lang != null) __miniLang = lang;
	renderMinimap();
}
function renderMinimap() {
	const c = el.miniMap;
	if (!c) return;
	const show = __miniOn && el.editorGrid && !el.editorGrid.classList.contains('hidden');
	c.classList.toggle('hidden', !show);
	if (!show) return;
	const scroll = el.editorScroll;
	const H = scroll.clientHeight || 300,
		W = 78;
	const dpr = Math.min(window.devicePixelRatio || 1, 2);
	c.style.top = scroll.scrollTop + 'px';
	c.style.height = H + 'px';
	if (c.width !== W * dpr || c.height !== Math.round(H * dpr)) {
		c.width = W * dpr;
		c.height = Math.round(H * dpr);
	}
	const x = c.getContext('2d');
	x.setTransform(dpr, 0, 0, dpr, 0, 0);
	x.clearRect(0, 0, W, H);
	const lines = __miniText.split('\n');
	const n = Math.max(1, lines.length);
	const lh = Math.min(3, H / n),
		totalMini = n * lh;
	const colTxt = cssVar('--txt-2', '#9aa3b2'),
		colCom = cssVar('--tk-com', '#6b7280');
	const step = n > 4000 ? Math.ceil(n / 4000) : 1;
	for (let i = 0; i < lines.length; i += step) {
		const t = lines[i].replace(/\t/g, '  ');
		const tr = t.trim();
		if (!tr) continue;
		const indent = t.length - t.replace(/^ +/, '').length,
			y = i * lh;
		const isCom = /^(\/\/|\/\*|\*|<!\x2d\x2d|#|--)/.test(tr);
		x.globalAlpha = isCom ? 0.3 : 0.55;
		x.fillStyle = isCom ? colCom : colTxt;
		const bx = 4 + Math.min(indent, 46) * 0.62,
			bw = Math.min(W - bx - 4, Math.max(2, tr.length * 0.62));
		x.fillRect(bx, y, bw, Math.max(1, lh - 0.4));
	}
	const contentH = scroll.scrollHeight || 1,
		rgb = cssVar('--acc-rgb', '106,163,255');
	const vpY = (scroll.scrollTop / contentH) * totalMini,
		vpH = Math.max(10, (scroll.clientHeight / contentH) * totalMini);
	x.globalAlpha = 1;
	x.fillStyle = `rgba(${rgb},.15)`;
	x.fillRect(0, vpY, W, vpH);
	x.strokeStyle = `rgba(${rgb},.55)`;
	x.lineWidth = 1;
	x.strokeRect(0.5, vpY + 0.5, W - 1, Math.max(1, vpH - 1));
}
let __miniRaf = 0;
function refreshMinimap() {
	if (__miniRaf) return;
	__miniRaf = requestAnimationFrame(() => {
		__miniRaf = 0;
		renderMinimap();
	});
}
if (typeof el !== 'undefined' && el.miniMap) {
	let dragging = false;
	function miniScrollTo(ev) {
		const c = el.miniMap,
			r = c.getBoundingClientRect(),
			scroll = el.editorScroll;
		const n = Math.max(1, __miniText.split('\n').length);
		const lh = Math.min(3, (scroll.clientHeight || 300) / n),
			totalMini = n * lh;
		const y = Math.max(0, Math.min(r.height, ev.clientY - r.top));
		const frac = totalMini ? y / totalMini : 0;
		scroll.scrollTop = Math.max(0, frac * scroll.scrollHeight - scroll.clientHeight / 2);
	}
	el.miniMap.addEventListener('pointerdown', (e) => {
		dragging = true;
		try {
			el.miniMap.setPointerCapture(e.pointerId);
		} catch (_) {
			ignorarErro(_, 'dobrar-minimapa-e-arrastar');
		}
		miniScrollTo(e);
	});
	el.miniMap.addEventListener('pointermove', (e) => {
		if (dragging) miniScrollTo(e);
	});
	el.miniMap.addEventListener('pointerup', (e) => {
		dragging = false;
		try {
			el.miniMap.releasePointerCapture(e.pointerId);
		} catch (_) {
			ignorarErro(_, 'dobrar-minimapa-e-arrastar');
		}
	});
	el.miniMap.addEventListener('pointercancel', () => {
		dragging = false;
	});
}
if (typeof el !== 'undefined' && el.miniBtn) {
	el.miniBtn.innerHTML =
		'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
		'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4 3 ' +
		'6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14m6-12v14"/></svg>';
	el.miniBtn.addEventListener('click', () => setMinimap(!__miniOn));
}
if (typeof el !== 'undefined' && el.foldBtn) {
	el.foldBtn.innerHTML =
		'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M4 17h16M10 11l2 2 2-2"/></svg>';
	el.foldBtn.addEventListener('click', foldAll);
}
window.addEventListener('resize', refreshMinimap);
setTimeout(() => {
	if (loadMiniPref()) setMinimap(true);
}, 60);

let __drag = null;
function moveEntry(srcPath, isDir, destDir) {
	const proj = activeProject();
	if (!proj) return;
	destDir = (destDir || '').replace(/^\/+/, '').replace(/\/+$/, '');
	const base = srcPath.includes('/') ? srcPath.slice(srcPath.lastIndexOf('/') + 1) : srcPath;
	if (isDir) {
		const srcDir = srcPath,
			newDir = destDir ? destDir + '/' + base : base;
		if (newDir === srcDir) return;
		if (destDir === srcDir || destDir.startsWith(srcDir + '/')) {
			toast('Operacao invalida', 'Nao da para mover uma pasta para dentro dela mesma', 'err');
			return;
		}
		if (!validRelPath(newDir)) {
			toast('Caminho invalido', '', 'err');
			return;
		}
		for (const k of proj.files.keys()) {
			if (k === newDir || k.startsWith(newDir + '/')) {
				toast('Conflito', `Ja existe algo em "${newDir}"`, 'err');
				return;
			}
		}
		const pre = srcDir + '/';
		const map = new Map();
		for (const [k, v] of proj.files) {
			if (k.startsWith(pre)) {
				const nk = newDir + '/' + k.slice(pre.length);
				v.path = nk;
				map.set(nk, v);
			} else map.set(k, v);
		}
		proj.files = map;
		remapPaths(proj, (p) => (p && p.startsWith(pre) ? newDir + '/' + p.slice(pre.length) : p));
		if (proj.emptyDirs) {
			const nd = new Set();
			proj.emptyDirs.forEach((x) =>
				nd.add(x === srcDir ? newDir : x.startsWith(pre) ? newDir + '/' + x.slice(pre.length) : x),
			);
			proj.emptyDirs = nd;
		}
		if (openDirs.has(srcDir)) {
			openDirs.delete(srcDir);
			openDirs.add(newDir);
		}
		if (destDir) openDirs.add(destDir);
		toast('Pasta movida', `"${srcDir}" -> "${newDir}"`, 'ok');
		fsChanged(proj, proj.openFile);
	} else {
		const newPath = destDir ? destDir + '/' + base : base;
		if (newPath === srcPath) return;
		if (!validRelPath(newPath)) {
			toast('Caminho invalido', '', 'err');
			return;
		}
		if (proj.files.has(newPath)) {
			toast('Conflito', `Ja existe "${newPath}"`, 'err');
			return;
		}
		const map = new Map();
		for (const [k, v] of proj.files) {
			if (k === srcPath) {
				v.path = newPath;
				map.set(newPath, v);
			} else map.set(k, v);
		}
		proj.files = map;
		remapPaths(proj, (p) => (p === srcPath ? newPath : p));
		if (proj.emptyDirs)
			for (const x of [...proj.emptyDirs])
				if (newPath.startsWith(x + '/')) proj.emptyDirs.delete(x);
		if (destDir) openDirs.add(destDir);
		toast('Arquivo movido', '"' + base + '" -> ' + (destDir ? `"${destDir}/"` : 'raiz'), 'ok');
		fsChanged(proj, proj.openFile);
	}
}
function dropDirForTarget(target) {
	if (!target) return '';
	const dr = target.closest && target.closest('[data-dir]');
	if (dr) return dr.dataset.dir;
	const fr = target.closest && target.closest('[data-file]');
	if (fr) {
		const p = fr.dataset.file;
		return p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';
	}
	return '';
}
if (typeof el !== 'undefined' && el.tree) {
	el.tree.addEventListener('dragstart', (e) => {
		const row = e.target.closest('[data-file],[data-dir]');
		if (!row) return;
		const isDir = row.hasAttribute('data-dir');
		__drag = { path: isDir ? row.dataset.dir : row.dataset.file, isDir };
		try {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', __drag.path);
		} catch (_) {
			ignorarErro(_, 'dobrar-minimapa-e-arrastar');
		}
		row.classList.add('dragging');
	});
	el.tree.addEventListener('dragend', () => {
		__drag = null;
		el.tree
			.querySelectorAll('.dragging,.drop-into')
			.forEach((n) => n.classList.remove('dragging', 'drop-into'));
		el.tree.classList.remove('drop-root');
	});
	el.tree.addEventListener('dragover', (e) => {
		if (!__drag) return;
		e.preventDefault();
		e.stopPropagation();
		try {
			e.dataTransfer.dropEffect = 'move';
		} catch (_) {
			ignorarErro(_, 'dobrar-minimapa-e-arrastar');
		}
		el.tree.querySelectorAll('.drop-into').forEach((n) => n.classList.remove('drop-into'));
		const dr = e.target.closest && e.target.closest('[data-dir]');
		if (dr) {
			dr.classList.add('drop-into');
			el.tree.classList.remove('drop-root');
		} else {
			el.tree.classList.add('drop-root');
		}
	});
	el.tree.addEventListener('dragleave', (e) => {
		if (!__drag) return;
		if (!el.tree.contains(e.relatedTarget)) {
			el.tree.classList.remove('drop-root');
			el.tree.querySelectorAll('.drop-into').forEach((n) => n.classList.remove('drop-into'));
		}
	});
	el.tree.addEventListener('drop', (e) => {
		if (!__drag) return;
		e.preventDefault();
		e.stopPropagation();
		const dest = dropDirForTarget(e.target);
		const d = __drag;
		__drag = null;
		el.tree.classList.remove('drop-root');
		el.tree
			.querySelectorAll('.dragging,.drop-into')
			.forEach((n) => n.classList.remove('dragging', 'drop-into'));
		if (d) moveEntry(d.path, d.isDir, dest);
	});
}

function openFileInEditor(path) {
	const proj = activeProject();
	if (!proj) return;
	const f = proj.files.get(path);
	if (!f) return;
	sniffTextEntry(f);
	proj.openFile = path;
	if (!proj.openTabs) proj.openTabs = [];
	if (!proj.openTabs.includes(path)) proj.openTabs.push(path);
	renderTree();
	renderEditorTabs();
	el.editorTitle.textContent = Core.basename(path);
	el.editorPath.textContent = path;
	el.editorDirty.classList.toggle('on', proj.dirty.has(path));
	if (!f.isText) {
		disposeMedia();
		el.editorGrid.classList.add('hidden');
		el.editorEmpty.classList.add('hidden');
		el.mediaView.classList.remove('hidden');
		openMediaPreview(proj, path, f);
		return;
	}
	disposeMedia();
	el.mediaView.classList.add('hidden');
	el.editorEmpty.classList.add('hidden');
	el.editorGrid.classList.remove('hidden');
	clearFolds();
	el.codeTa.value = f.text;
	paintEditor(path, f.text);
}
function renderEditorTabs() {
	const proj = activeProject();
	if (!proj || !proj.openTabs || !proj.openTabs.length) {
		el.editorTabs.classList.add('hidden');
		el.editorTabs.innerHTML = '';
		return;
	}
	el.editorTabs.classList.remove('hidden');
	el.editorTabs.innerHTML = proj.openTabs
		.map((p) => {
			const act = p === proj.openFile ? ' active' : '';
			const dirty = proj.dirty.has(p) ? '<span class="etdirty"></span>' : '';
			return `<div class="etab${act}" data-tab-file="${esc(p)}" title="${esc(p)}"><span class="etico" style="color:${colorOfExt(p)}">${fileIcon(p, false)}</span>\
<span class="etname">${esc(Core.basename(p))}</span>${dirty}<span class="etclose" data-tab-close="${esc(p)}">${iconSvg('close')}</span>\
</div>`;
		})
		.join('');
	const a = el.editorTabs.querySelector('.etab.active');
	if (a) a.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
function closeTab(path) {
	const proj = activeProject();
	if (!proj || !proj.openTabs) return;
	const i = proj.openTabs.indexOf(path);
	if (i < 0) return;
	proj.openTabs.splice(i, 1);
	if (proj.openFile === path) {
		const next =
			proj.openTabs[i] || proj.openTabs[i - 1] || proj.openTabs[proj.openTabs.length - 1] || null;
		if (next) {
			openFileInEditor(next);
		} else {
			proj.openFile = null;
			disposeMedia();
			el.editorGrid.classList.add('hidden');
			el.editorEmpty.classList.remove('hidden');
			el.editorEmpty.innerHTML = `<div>${iconSvg('code', 'icon')}Selecione um arquivo no Explorer para editar</div>`;
			el.editorTitle.textContent = 'Nenhum arquivo';
			el.editorPath.textContent = '';
			renderTree();
			renderEditorTabs();
		}
	} else {
		renderEditorTabs();
	}
	saveSession();
}
el.editorTabs.addEventListener('click', (e) => {
	const close = e.target.closest('[data-tab-close]');
	if (close) {
		e.stopPropagation();
		closeTab(close.getAttribute('data-tab-close'));
		return;
	}
	const tab = e.target.closest('[data-tab-file]');
	if (tab) {
		const p = tab.getAttribute('data-tab-file');
		const proj = activeProject();
		if (proj && proj.files.has(p)) openFileInEditor(p);
	}
});
el.editorTabs.addEventListener('mousedown', (e) => {
	if (e.button === 1) {
		const tab = e.target.closest('[data-tab-file]');
		if (tab) {
			e.preventDefault();
			closeTab(tab.getAttribute('data-tab-file'));
		}
	}
});
const __PERF_BIG_CHARS = 250000,
	__PERF_BIG_LINES = 7000;
function __isBigDoc(text) {
	if (text.length > __PERF_BIG_CHARS) return true;
	let nl = 0;
	for (let i = text.indexOf('\n'); i >= 0; i = text.indexOf('\n', i + 1)) {
		if (++nl >= __PERF_BIG_LINES) return true;
	}
	return false;
}
let __paintRaf = 0,
	__paintArgs = null,
	__gutCacheKey = '';
function paintEditor(path, text) {
	__paintArgs = [path, text];
	if (__paintRaf) return;
	__paintRaf = requestAnimationFrame(() => {
		__paintRaf = 0;
		const a = __paintArgs;
		__paintArgs = null;
		if (a) paintEditorNow(a[0], a[1]);
	});
}
function paintEditorNow(path, text) {
	const lang = Core.langOf(path);
	let nl = 0;
	for (let i = text.indexOf('\n'); i >= 0; i = text.indexOf('\n', i + 1)) nl++;
	const lineCount = nl + 1;
	if (text.length > __PERF_BIG_CHARS || lineCount > __PERF_BIG_LINES) {
		if (__folds.size) __folds = new Set();
		el.codeHl.textContent = text + '\n';
		const key = 'big:' + lineCount;
		if (__gutCacheKey !== key) {
			__gutCacheKey = key;
			let g = '';
			for (let i = 1; i <= lineCount; i++)
				g += `<div class="gln"><span class="gnum">${i}</span></div>`;
			el.gutter.innerHTML = g;
		}
		if (el.codeTa.value !== text) el.codeTa.value = text;
		el.codeTa.readOnly = false;
		el.codeTa.classList.remove('folded');
		el.codeTa.style.height = 'auto';
		el.codeTa.style.height = el.codeHl.scrollHeight + 'px';
		try {
			drawMinimap(text, lang);
		} catch (_e) {
			ignorarErro(_e, 'paintEditorNow');
		}
		return;
	}
	__gutCacheKey = '';
	let regions;
	try {
		regions = computeFoldRegions(text);
	} catch (_e) {
		regions = new Map();
	}
	for (const h of [...__folds]) if (!regions.has(h)) __folds.delete(h);
	const full = text.split('\n');
	const vis = [];
	for (let i = 0; i < full.length;) {
		vis.push(i);
		if (__folds.has(i) && regions.has(i)) i = regions.get(i) + 1;
		else i++;
	}
	const display = vis.map((i) => full[i]).join('\n');
	el.codeHl.innerHTML = highlight(display, lang) + '\n';
	let g = '';
	for (const i of vis) {
		const can = regions.has(i),
			fd = __folds.has(i);
		g +=
			'<div class="gln' +
			(fd ? ' folded' : '') +
			'">' +
			(can ? `<span class="foldctl" data-fold="${i}">${fd ? '▸' : '▾'}</span>` : '') +
			'<span class="gnum">' +
			(i + 1) +
			'</span>' +
			(fd ? `<span class="foldn">${regions.get(i) - i}</span>` : '') +
			'</div>';
	}
	el.gutter.innerHTML = g;
	const folded = __folds.size > 0;
	if (el.codeTa.value !== display) el.codeTa.value = display;
	el.codeTa.readOnly = folded;
	el.codeTa.classList.toggle('folded', folded);
	el.codeTa.style.height = 'auto';
	el.codeTa.style.height = el.codeHl.scrollHeight + 'px';
	try {
		drawMinimap(display, lang);
	} catch (_e) {
		ignorarErro(_e, 'paintEditorNow');
	}
}
el.codeTa.addEventListener('input', () => {
	if (el.codeTa.readOnly) return;
	const proj = activeProject();
	if (!proj || !proj.openFile) return;
	const f = proj.files.get(proj.openFile);
	if (!f) return;
	f.text = el.codeTa.value;
	f.data = null;
	const wasDirty = proj.dirty.has(proj.openFile);
	proj.dirty.add(proj.openFile);
	el.editorDirty.classList.add('on');
	if (!wasDirty) renderEditorTabs();
	paintEditor(proj.openFile, f.text);
	scheduleBuild(proj);
	scheduleSnapshot(proj, proj.openFile);
	saveSession();
});
el.codeTa.addEventListener('keydown', (e) => {
	if (el.codeTa.readOnly) return;
	if (e.key === 'Tab') {
		e.preventDefault();
		const s = el.codeTa.selectionStart,
			en = el.codeTa.selectionEnd;
		el.codeTa.value = el.codeTa.value.slice(0, s) + '  ' + el.codeTa.value.slice(en);
		el.codeTa.selectionStart = el.codeTa.selectionEnd = s + 2;
		el.codeTa.dispatchEvent(new Event('input'));
	}
});
el.codeTa.addEventListener('scroll', () => {});

function highlight(code, lang) {
	if (lang === 'js') return hlJs(code);
	if (lang === 'css') return hlCss(code);
	if (lang === 'json') return hlJson(code);
	if (lang === 'html') return hlHtml(code);
	return esc(code);
}
function hlJs(s) {
	const kw = new Set(
		(
			'const let var function return if else for while do switch case break continue new class ' +
			'extends super this import export from default async await try catch finally throw ' +
			'typeof instanceof in of delete void yield static get set null true false undefined NaN'
		).split(' '),
	);
	let out = '',
		i = 0;
	const n = s.length;
	while (i < n) {
		const c = s[i];
		if (c === '/' && s[i + 1] === '/') {
			let j = i;
			while (j < n && s[j] !== '\n') j++;
			out += `<span class="tk-com">${esc(s.slice(i, j))}</span>`;
			i = j;
			continue;
		}
		if (c === '/' && s[i + 1] === '*') {
			let j = i + 2;
			while (j < n && !(s[j] === '*' && s[j + 1] === '/')) j++;
			j = Math.min(n, j + 2);
			out += `<span class="tk-com">${esc(s.slice(i, j))}</span>`;
			i = j;
			continue;
		}
		if (c === '"' || c === "'" || c === '`') {
			const q = c;
			let j = i + 1;
			while (j < n) {
				if (s[j] === '\\') {
					j += 2;
					continue;
				}
				if (s[j] === q) {
					j++;
					break;
				}
				j++;
			}
			out += `<span class="tk-str">${esc(s.slice(i, j))}</span>`;
			i = j;
			continue;
		}
		if (/[0-9]/.test(c) && (i === 0 || /[^\w$]/.test(s[i - 1]))) {
			let j = i;
			while (j < n && /[0-9a-fxXbBoie._+\-]/.test(s[j])) j++;
			out += `<span class="tk-num">${esc(s.slice(i, j))}</span>`;
			i = j;
			continue;
		}
		if (/[A-Za-z_$]/.test(c)) {
			let j = i;
			while (j < n && /[\w$]/.test(s[j])) j++;
			const word = s.slice(i, j);
			if (kw.has(word)) {
				out += `<span class="tk-key">${esc(word)}</span>`;
			} else if (s[j] === '(') {
				out += `<span class="tk-fn">${esc(word)}</span>`;
			} else out += esc(word);
			i = j;
			continue;
		}
		out += esc(c);
		i++;
	}
	return out;
}
function hlCss(s) {
	return esc(s)
		.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="tk-com">$1</span>')
		.replace(/([.#]?[-\w]+)(\s*\{)/g, '<span class="tk-tag">$1</span>$2')
		.replace(/([-\w]+)(\s*:)/g, '<span class="tk-attr">$1</span>$2')
		.replace(/(:[^;{}]+)(;)/g, (m) => m);
}
function hlJson(s) {
	return esc(s)
		.replace(/("(?:[^"\\]|\\.)*")(\s*:)/g, '<span class="tk-attr">$1</span>$2')
		.replace(/:(\s*)("(?:[^"\\]|\\.)*")/g, ':$1<span class="tk-str">$2</span>')
		.replace(/\b(true|false|null)\b/g, '<span class="tk-key">$1</span>')
		.replace(/(-?\d+\.?\d*)/g, '<span class="tk-num">$1</span>');
}
function hlHtml(s) {
	return esc(s)
		.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="tk-com">$1</span>')
		.replace(/(&lt;\/?)([\w-]+)/g, '$1<span class="tk-tag">$2</span>')
		.replace(
			/([\w-]+)(=)(&quot;[^&]*&quot;)/g,
			'<span class="tk-attr">$1</span>$2<span class="tk-str">$3</span>',
		);
}

function revokeBlobs(proj) {
	proj.blobs.forEach((u) => {
		try {
			URL.revokeObjectURL(u);
		} catch (e) {
			ignorarErro(e, 'revokeBlobs');
		}
	});
	proj.blobs.clear();
	if (proj.blobCache) proj.blobCache.clear();
	if (proj.cssBlobCache) proj.cssBlobCache.clear();
}
function limparBlobsSoltos(proj) {
	const manter = new Set();
	if (proj.blobCache)
		for (const e of proj.blobCache.values()) {
			if (e && e.url) manter.add(e.url);
		}
	if (proj.cssBlobCache)
		for (const e of proj.cssBlobCache.values()) {
			if (e && e.url) manter.add(e.url);
		}
	for (const u of [...proj.blobs]) {
		if (!manter.has(u)) {
			try {
				URL.revokeObjectURL(u);
			} catch (e) {
				ignorarErro(e, 'limparBlobsSoltos');
			}
			proj.blobs.delete(u);
		}
	}
}
function mkBlob(proj, content, mime) {
	const url = URL.createObjectURL(new Blob([content], { type: mime }));
	proj.blobs.add(url);
	return url;
}
function fileBytes(f) {
	if (f.data) return f.data;
	if (f.text != null) return new TextEncoder().encode(f.text);
	return new Uint8Array();
}
function fileText(f) {
	if (f.text != null) return f.text;
	if (f.data) return bytesToText(f.data);
	return '';
}

const __crcT = (() => {
	const t = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		t[n] = c >>> 0;
	}
	return t;
})();
function crc32(b) {
	let c = 0xffffffff;
	for (let i = 0; i < b.length; i++) c = __crcT[(c ^ b[i]) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}
async function deflateRawAsync(bytes) {
	if (typeof CompressionStream === 'undefined') return null;
	try {
		const cs = new CompressionStream('deflate-raw');
		const stream = new Response(new Blob([bytes])).body.pipeThrough(cs);
		return new Uint8Array(await new Response(stream).arrayBuffer());
	} catch (e) {
		return null;
	}
}
async function buildZip(items) {
	const te = new TextEncoder();
	const chunks = [];
	const central = [];
	let offset = 0;
	const now = new Date();
	const dosDate =
		(((now.getFullYear() - 1980) & 0x7f) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
	const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | ((now.getSeconds() / 2) | 0);
	for (const it of items) {
		const isDir = it.data == null;
		const nameB = te.encode(isDir && !it.name.endsWith('/') ? it.name + '/' : it.name);
		const data = isDir ? new Uint8Array(0) : it.data;
		const crc = isDir ? 0 : crc32(data);
		let method = 0,
			comp = data;
		if (!isDir && data.length > 63) {
			const d = await deflateRawAsync(data);
			if (d && d.length < data.length) {
				method = 8;
				comp = d;
			}
		}
		const lh = new Uint8Array(30 + nameB.length);
		const dv = new DataView(lh.buffer);
		dv.setUint32(0, 0x04034b50, true);
		dv.setUint16(4, 20, true);
		dv.setUint16(6, 0x0800, true);
		dv.setUint16(8, method, true);
		dv.setUint16(10, dosTime, true);
		dv.setUint16(12, dosDate, true);
		dv.setUint32(14, crc, true);
		dv.setUint32(18, comp.length, true);
		dv.setUint32(22, data.length, true);
		dv.setUint16(26, nameB.length, true);
		lh.set(nameB, 30);
		chunks.push(lh, comp);
		central.push({ nameB, method, crc, cs: comp.length, us: data.length, off: offset, isDir });
		offset += lh.length + comp.length;
	}
	let cdSize = 0;
	const cdStart = offset;
	for (const e of central) {
		const ch = new Uint8Array(46 + e.nameB.length);
		const dv = new DataView(ch.buffer);
		dv.setUint32(0, 0x02014b50, true);
		dv.setUint16(4, 20, true);
		dv.setUint16(6, 20, true);
		dv.setUint16(8, 0x0800, true);
		dv.setUint16(10, e.method, true);
		dv.setUint16(12, dosTime, true);
		dv.setUint16(14, dosDate, true);
		dv.setUint32(16, e.crc, true);
		dv.setUint32(20, e.cs, true);
		dv.setUint32(24, e.us, true);
		dv.setUint16(28, e.nameB.length, true);
		dv.setUint32(38, e.isDir ? 0x10 : 0, true);
		dv.setUint32(42, e.off, true);
		ch.set(e.nameB, 46);
		chunks.push(ch);
		cdSize += ch.length;
	}
	const eocd = new Uint8Array(22);
	const dv = new DataView(eocd.buffer);
	dv.setUint32(0, 0x06054b50, true);
	dv.setUint16(8, central.length, true);
	dv.setUint16(10, central.length, true);
	dv.setUint32(12, cdSize, true);
	dv.setUint32(16, cdStart, true);
	chunks.push(eocd);
	return new Blob(chunks, { type: 'application/zip' });
}
function projectZipItems(proj) {
	const paths = [...proj.files.keys()].sort();
	const items = paths.map((p) => ({ name: p, data: fileBytes(proj.files.get(p)) }));
	if (proj.emptyDirs)
		for (const d of [...proj.emptyDirs].sort()) {
			if (!paths.some((p) => p.startsWith(d + '/'))) items.push({ name: d + '/', data: null });
		}
	return items;
}
function safeZipName(n) {
	n = String(n || 'projeto')
		.replace(/\.zip$/i, '')
		.replace(/[\\/:*?"<>|]+/g, '-')
		.trim();
	return (n || 'projeto') + '.zip';
}
let __expUrlT = null;
async function copyDownloadLink(txt) {
	try {
		if (navigator.clipboard && window.isSecureContext) {
			await navigator.clipboard.writeText(txt);
			return true;
		}
	} catch (e) {
		ignorarErro(e, 'copyDownloadLink');
	}
	try {
		const ta = document.createElement('textarea');
		ta.value = txt;
		ta.setAttribute('readonly', '');
		ta.style.cssText = 'position:fixed;top:-999px;left:-999px;opacity:0';
		document.body.appendChild(ta);
		ta.focus();
		ta.select();
		ta.setSelectionRange(0, txt.length);
		let ok = false;
		try {
			ok = document.execCommand('copy');
		} catch (e) {
			ignorarErro(e, 'copyDownloadLink');
		}
		ta.remove();
		return !!ok;
	} catch (e) {
		return false;
	}
}
function showExportResult(fname, url, size, started) {
	const back = document.createElement('div');
	back.className = 'ui-back';
	back.innerHTML =
		'<div class="ui-modal" role="dialog" aria-modal="true"><div class="ui-h">' +
		(started ? 'Download iniciado' : 'Exportação pronta') +
		'</div>' +
		'<div class="ui-msg">' +
		(started
			? `O navegador deve estar baixando <b>${esc(fname)}</b> (${esc(mvSize(size))}). Se o download não apareceu (bloqueado ou recusado), use o link abaixo.`
			: `O navegador recusou iniciar o download automático. Use o link abaixo para baixar <b>${esc(fname)}</b> (${esc(mvSize(size))}).`) +
		'</div>' +
		'<a class="exp-link" href="' +
		url +
		'" download="' +
		esc(fname) +
		'"><span class="i-export"></span> Baixar ' +
		esc(fname) +
		'</a>' +
		'<div class="exp-note">O link fica válido enquanto esta aba estiver aberta (por até 10 minutos) e só funciona neste navegador. Se salvar com nome genérico, renomeie para ' +
		esc(fname) +
		'.</div>' +
		'<div class="ui-actions"><button class="ui-btn" data-act="copylink">Copiar link</button><button class="ui-btn primary" data-act="ok">Fechar</button></div></div>';
	document.body.appendChild(back);
	hydrateIcons(back);
	const close = () => back.remove();
	back.addEventListener('mousedown', (e) => {
		if (e.target === back) close();
	});
	back.querySelector('[data-act="ok"]').addEventListener('click', close);
	const cb = back.querySelector('[data-act="copylink"]');
	cb.addEventListener('click', async () => {
		const ok = await copyDownloadLink(url);
		cb.textContent = ok ? 'Link copiado!' : 'Não consegui copiar';
		setTimeout(() => {
			cb.textContent = 'Copiar link';
		}, 2000);
		if (ok)
			toast(
				'Link copiado',
				`Link de download de ${fname} na área de transferência — vale por 10 min nesta aba`,
				'ok',
			);
	});
	setTimeout(() => {
		try {
			URL.revokeObjectURL(url);
		} catch (e) {
			ignorarErro(e, 'showExportResult');
		}
	}, 600000);
}
async function exportProjectZip(id) {
	const proj = State.projects.find((p) => p.id === id) || activeProject();
	if (!proj) {
		toast('Nada para exportar', 'Importe ou crie um projeto primeiro', 'warn');
		return;
	}
	setStatus('run', 'Gerando .zip…');
	try {
		const items = projectZipItems(proj);
		if (!items.length) {
			setStatus('err', 'Projeto vazio');
			toast('Projeto vazio', 'Não há arquivos para exportar', 'warn');
			return;
		}
		const blob = await buildZip(items);
		const fname = safeZipName(proj.name);
		const url = URL.createObjectURL(blob);
		let started = false;
		try {
			const a = document.createElement('a');
			a.href = url;
			a.download = fname;
			a.rel = 'noopener';
			document.body.appendChild(a);
			a.click();
			a.remove();
			started = true;
		} catch (e) {
			started = false;
		}
		setStatus('ok', '.zip exportado');
		logCmd(
			proj,
			`Exportado "${fname}" — ${items.length} item(ns), ${mvSize(blob.size)} (todas as edições incluídas).`,
		);
		showExportResult(fname, url, blob.size, started);
	} catch (err) {
		setStatus('err', 'Falha ao exportar');
		toast('Erro ao exportar', (err && err.message) || String(err), 'err');
	}
}
function exportZipDialog() {
	if (!State.projects.length) {
		toast('Nada para exportar', 'Importe ou crie um projeto primeiro', 'warn');
		return;
	}
	const back = document.createElement('div');
	back.className = 'ui-back';
	const rows = State.projects
		.map(
			(p) =>
				`<label class="exp-row"><input type="radio" name="expProj" value="${esc(p.id)}"${p.id === State.active ? ' checked' : ''}/>\
<span class="exp-name">${esc(p.name)}</span><span class="exp-meta">${p.files.size} arquivo(s)</span>\
</label>`,
		)
		.join('');
	back.innerHTML = `<div class="ui-modal" role="dialog" aria-modal="true"><div class="ui-h">Exportar \
projeto (.zip)</div><div class="ui-msg">Escolha qual projeto baixar. O .zip é gerado com o estado atual \
dos arquivos — todas as edições feitas aqui vão junto.</div><div class="exp-list">${rows}</div><div \
class="ui-actions"><button class="ui-btn" data-act="cancel">Cancelar</button><button class="ui-btn primary" \
data-act="ok">Exportar .zip</button></div></div>`;
	document.body.appendChild(back);
	const close = () => back.remove();
	back.addEventListener('mousedown', (e) => {
		if (e.target === back) close();
	});
	back.querySelector('[data-act="cancel"]').addEventListener('click', close);
	back.querySelector('[data-act="ok"]').addEventListener('click', () => {
		const sel = back.querySelector('input[name="expProj"]:checked');
		const id = sel ? sel.value : State.active;
		close();
		exportProjectZip(id);
	});
}

function flutterPreviewDoc(proj) {
	const pub = proj.files.get('pubspec.yaml');
	const y = pub ? fileText(pub) : '';
	const g = (k) => {
		const m = y.match(new RegExp(`^${k}:[ \\t]*(.+)$`, 'm'));
		return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
	};
	const appName = g('name') || proj.name || 'app_flutter';
	const desc = g('description') || 'Projeto Flutter';
	const ver = g('version');
	const dm = y.match(/^dependencies:[ \t]*\r?\n((?:[ \t]+[^\r\n]*\r?\n?)*)/m);
	const deps = dm
		? [...dm[1].matchAll(/^[ \t]{2}([A-Za-z0-9_]+):/gm)]
				.map((x) => x[1])
				.filter((d) => d !== 'flutter')
		: [];
	const dart = [...proj.files.keys()].filter((p) => p.endsWith('.dart')).sort();
	const lib = dart.filter((p) => p.startsWith('lib/'));
	const shown = (lib.length ? lib : dart).slice(0, 12);
	const chips =
		deps
			.slice(0, 16)
			.map((d) => `<span class="chip">${esc(d)}</span>`)
			.join('') || '<span class="chip dim">sem dependências extras</span>';
	const filesHtml = shown.map((p) => `<li>${esc(p)}</li>`).join('');
	return (
		'<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
		esc(appName) +
		'</title><style>' +
		('body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;' +
			'background:linear-gradient(160deg,#0b1220,#12203a);color:#e8eefb;min-height:100vh;' +
			'display:flex;align-items:center;justify-content:center;padding:28px;box-sizing:' +
			'border-box}') +
		'.card{max-width:640px;width:100%;background:rgba(13,22,40,.88);border:1px solid rgba(120,170,255,.22);border-radius:16px;padding:28px 30px;box-shadow:0 18px 60px rgba(0,0,0,.45)}' +
		'.top{display:flex;align-items:center;gap:14px;margin-bottom:6px}' +
		'.logo{width:46px;height:46px;border-radius:12px;background:#0f2038;display:flex;align-items:center;justify-content:center;border:1px solid rgba(84,197,248,.35)}' +
		'h1{font-size:21px;margin:0}' +
		'.ver{font-size:12px;color:#8fb7ff;font-family:ui-monospace,Menlo,Consolas,monospace}' +
		('.ok{display:inline-flex;align-items:center;gap:7px;background:rgba(46,204,113,.13);' +
			'border:1px solid rgba(46,204,113,.4);color:#7ee2a8;font-size:12.5px;font-weight:600;' +
			'border-radius:999px;padding:5px 12px;margin:10px 0 2px}') +
		'p.desc{color:#aebfdd;font-size:13.5px;line-height:1.55;margin:10px 0 0}' +
		'h2{font-size:12px;letter-spacing:.09em;text-transform:uppercase;color:#7f95bd;margin:22px 0 8px}' +
		'.chips{display:flex;flex-wrap:wrap;gap:6px}' +
		'.chip{background:rgba(84,197,248,.12);border:1px solid rgba(84,197,248,.3);color:#9fd8ff;border-radius:999px;padding:4px 11px;font-size:12px;font-family:ui-monospace,Menlo,Consolas,monospace}' +
		'.chip.dim{opacity:.6}' +
		'ul{margin:0;padding:0 0 0 2px;list-style:none;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px;color:#b9cae9;line-height:1.9}' +
		'ul li::before{content:"◆";color:#54c5f8;margin-right:8px;font-size:9px}' +
		'.steps{background:#0d1830;border:1px solid rgba(120,170,255,.18);border-radius:12px;padding:14px 16px;margin-top:8px}' +
		'.steps b{color:#dfe9ff}' +
		'.steps code{display:block;background:#091124;border-radius:8px;padding:8px 12px;margin:8px 0;color:#8fd6ff;font-size:12.5px;font-family:ui-monospace,Menlo,Consolas,monospace}' +
		'.steps span{color:#93a7cc;font-size:12.5px;line-height:1.6}' +
		'</style></head><body><div class="card">' +
		('<div class="top"><div class="logo"><svg width="26" height="26" viewBox="0 0 24 24" ' +
			'fill="none"><path d="M13.5 2 4 11.5l3 3L19.5 2z" fill="#54c5f8"/><path d="M13.5 11 8.7 ' +
			'15.8l3 3L13.5 17l6-6z" fill="#54c5f8"/><path d="M11.7 18.8l1.8 1.8h6l-4.8-4.8z" ' +
			'fill="#0468d7"/></svg></div>') +
		'<div><h1>' +
		esc(appName) +
		'</h1>' +
		(ver ? `<div class="ver">v${esc(ver)}</div>` : '') +
		'</div></div>' +
		'<div class="ok">✓ Projeto Flutter reconhecido — sem erros</div>' +
		'<p class="desc">' +
		esc(desc) +
		'</p>' +
		'<h2>Dependências (pubspec.yaml)</h2><div class="chips">' +
		chips +
		'</div>' +
		'<h2>Código Dart (' +
		dart.length +
		' arquivo' +
		(dart.length === 1 ? '' : 's') +
		')</h2><ul>' +
		filesHtml +
		(dart.length > shown.length ? `<li>… e mais ${dart.length - shown.length}</li>` : '') +
		'</ul>' +
		('<h2>Ver o app rodando aqui</h2><div class="steps"><span>Dart compila fora do navegador. ' +
			'Gere o build web e reimporte o projeto (com a pasta <b>build/web</b>) — o preview passa ' +
			'a mostrar o app real automaticamente:</span>') +
		'<code>flutter pub get</code><code>flutter build web</code>' +
		'<span>Depois é só importar o .zip aqui de novo.</span></div>' +
		'</div></body></html>'
	);
}

const scheduleHandles = new Map();
