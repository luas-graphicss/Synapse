(function () {
	'use strict';

	const tree = document.getElementById('tree');
	if (!tree) return;

	const OVERSCAN = 6;
	const collator = new Intl.Collator();
	let rows = [];
	let indexByPath = new Map();
	let rowHeight = 28;
	let spacer = null;
	let mounted = new Map();
	let range = { start: 0, end: 0 };
	let frame = 0;
	let inlineProvider = null;

	function ensureSpacer() {
		if (spacer && spacer.parentNode === tree) return spacer;
		tree.textContent = '';
		spacer = document.createElement('div');
		spacer.className = 'vtree-spacer';
		tree.appendChild(spacer);
		tree.classList.add('vtree');
		mounted = new Map();
		range = { start: 0, end: 0 };
		return spacer;
	}

	function showEmpty(html) {
		spacer = null;
		mounted = new Map();
		rows = [];
		indexByPath = new Map();
		tree.classList.remove('vtree');
		tree.innerHTML = '<div class="ex-empty">' + html + '</div>';
	}

	function pendingInline(project) {
		if (typeof inlineProvider !== 'function') return null;
		try {
			return inlineProvider(project) || null;
		} catch (e) {
			return null;
		}
	}

	function flatten(node, depth, searching, inline, out) {
		const kids = [...node.children.values()].sort(
			(a, b) => b.dir - a.dir || collator.compare(a.name, b.name),
		);
		if (inline && inline.dir === node.path) {
			out.push({ inline: true, dir: inline.tipo === 'dir', depth, path: '', name: '' });
		}
		for (const kid of kids) {
			if (kid.dir) {
				const open = searching || openDirs.has(kid.path);
				out.push({ path: kid.path, name: kid.name, dir: true, depth, open });
				if (open) flatten(kid, depth + 1, searching, inline, out);
			} else {
				out.push({ path: kid.path, name: kid.name, dir: false, depth, open: false });
			}
		}
	}

	function measureRowHeight() {
		const probe = document.createElement('div');
		probe.className = 'row vtree-probe';
		probe.innerHTML =
			'<span class="chev"></span><span class="fico"></span><span class="rname">probe</span>';
		spacer.appendChild(probe);
		const height = probe.getBoundingClientRect().height;
		probe.remove();
		if (height > 0) rowHeight = height;
		tree.style.setProperty('--vtree-row', rowHeight + 'px');
	}

	function keyOf(row) {
		return row.inline ? '\u0000inline' : row.path;
	}

	function createRow(row, project) {
		const pad = 8 + row.depth * 13;
		const div = document.createElement('div');
		if (row.inline) {
			div.className = 'row ex-inline-row';
			div.style.paddingLeft = pad + (row.dir ? 0 : 8) + 'px';
			div.innerHTML =
				'<span class="fico" style="color:' +
				(row.dir ? '#7aa7ff' : 'var(--txt-3)') +
				'">' +
				fileIcon(row.dir ? 'nova-pasta' : 'novo-arquivo.txt', row.dir, false) +
				'</span>';
			return div;
		}
		if (row.dir) {
			div.className = 'row' + (row.open ? ' open' : '');
			div.draggable = true;
			div.dataset.dir = row.path;
			div.style.paddingLeft = pad + 'px';
			div.innerHTML =
				'<span class="chev"><svg class="icon" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></span>' +
				'<span class="fico" style="color:#7aa7ff">' +
				fileIcon(row.path, true, row.open) +
				'</span><span class="rname">' +
				esc(row.name) +
				'</span>';
			return div;
		}
		div.className = 'row' + (project.openFile === row.path ? ' sel' : '');
		div.draggable = true;
		div.dataset.file = row.path;
		div.style.paddingLeft = pad + 8 + 'px';
		div.innerHTML =
			'<span class="fico" style="color:' +
			colorOfExt(row.path) +
			'">' +
			fileIcon(row.path, false) +
			'</span><span class="rname">' +
			esc(row.name) +
			'</span>';
		return div;
	}

	function keptRow() {
		const input = spacer && spacer.querySelector('.ex-inline');
		return input ? input.closest('.row') : null;
	}

	function keptKey(el) {
		if (!el) return null;
		if (el.classList.contains('ex-inline-row')) return '\u0000inline';
		return el.dataset.file ?? el.dataset.dir ?? null;
	}

	function visibleRange() {
		const top = Math.max(0, tree.scrollTop - spacer.offsetTop);
		const height = tree.clientHeight || 0;
		const start = Math.max(0, Math.floor(top / rowHeight) - OVERSCAN);
		const end = Math.min(rows.length, Math.ceil((top + height) / rowHeight) + OVERSCAN);
		return { start, end };
	}

	function paint(force) {
		if (!spacer || spacer.parentNode !== tree) return;
		const next = visibleRange();
		if (!force && next.start === range.start && next.end === range.end) return;
		const project = activeProject();
		const kept = keptRow();
		const kKey = keptKey(kept);
		if (force) {
			for (const el of mounted.values()) if (el !== kept) el.remove();
			mounted = new Map();
			if (kept && kKey != null) mounted.set(kKey, kept);
		}
		const alive = new Map();
		const fragment = document.createDocumentFragment();
		for (let i = next.start; i < next.end; i++) {
			const row = rows[i];
			const key = keyOf(row);
			let el = mounted.get(key);
			if (!el) {
				el = createRow(row, project);
				fragment.appendChild(el);
			}
			el.style.top = i * rowHeight + 'px';
			el.dataset.index = String(i);
			alive.set(key, el);
		}
		for (const [key, el] of mounted) {
			if (alive.has(key)) continue;
			if (el === kept) {
				const idx = key === '\u0000inline' ? rows.findIndex((r) => r.inline) : indexByPath.get(key);
				if (idx == null || idx < 0) {
					el.remove();
					continue;
				}
				el.style.top = idx * rowHeight + 'px';
				el.dataset.index = String(idx);
				alive.set(key, el);
				continue;
			}
			el.remove();
		}
		spacer.appendChild(fragment);
		mounted = alive;
		range = next;
	}

	function render() {
		const project = activeProject();
		if (
			!project ||
			(!project.files.size && !(project.emptyDirs && project.emptyDirs.size))
		) {
			showEmpty('Nenhum projeto aberto.<br>Importe um .zip, pasta ou index.html.');
			return;
		}
		const filter = el.exSearch.value;
		const model = buildTreeModel(project.files, filter, project.emptyDirs);
		if (openDirs.size === 0) {
			for (const child of model.children.values()) if (child.dir) openDirs.add(child.path);
			openDirs.add('');
		}
		const searching = filter.trim() !== '';
		const out = [];
		flatten(model, 0, searching, pendingInline(project), out);
		if (!out.length) {
			showEmpty('Sem resultados.');
			return;
		}
		rows = out;
		indexByPath = new Map();
		for (let i = 0; i < rows.length; i++) if (!rows[i].inline) indexByPath.set(rows[i].path, i);
		ensureSpacer();
		measureRowHeight();
		spacer.style.height = rows.length * rowHeight + 'px';
		paint(true);
	}

	function scrollToIndex(index) {
		if (index == null || index < 0 || !spacer) return false;
		const top = spacer.offsetTop + index * rowHeight;
		const bottom = top + rowHeight;
		const viewTop = tree.scrollTop;
		const viewBottom = viewTop + tree.clientHeight;
		if (top < viewTop) tree.scrollTop = top;
		else if (bottom > viewBottom) tree.scrollTop = bottom - tree.clientHeight;
		paint(false);
		return true;
	}

	function reveal(path) {
		return scrollToIndex(indexByPath.get(path));
	}

	function revealInline() {
		return scrollToIndex(rows.findIndex((r) => r.inline));
	}

	function visiblePaths() {
		const out = [];
		for (const row of rows) if (!row.inline) out.push(row.path);
		return out;
	}

	function schedulePaint() {
		if (frame) return;
		frame = requestAnimationFrame(() => {
			frame = 0;
			paint(false);
		});
	}

	tree.addEventListener('scroll', schedulePaint, { passive: true });
	if (typeof ResizeObserver === 'function') new ResizeObserver(schedulePaint).observe(tree);

	window.SynapseVirtualTree = Object.freeze({
		render,
		reveal,
		revealInline,
		visiblePaths,
		rowElement: (path) => mounted.get(path) || null,
		indexOf: (path) => indexByPath.get(path) ?? -1,
		count: () => rows.length,
		setInlineProvider: (fn) => {
			inlineProvider = typeof fn === 'function' ? fn : null;
		},
	});
})();
