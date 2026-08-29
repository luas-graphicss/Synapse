(function () {
	'use strict';
	if (window.__UX_V10) return;
	window.__UX_V10 = true;

	function fn(n) {
		try {
			const f = window[n];
			return typeof f === 'function' ? f : null;
		} catch (e) {
			return null;
		}
	}
	function call(n) {
		const f = fn(n);
		if (!f) return undefined;
		try {
			return f.apply(null, [].slice.call(arguments, 1));
		} catch (e) {
			try {
				registro.aviso('[ux10]', n, e);
			} catch (_) {
				ignorarErro(_, 'call');
			}
			return undefined;
		}
	}
	function E() {
		try {
			return typeof el !== 'undefined' && el ? el : window.el || null;
		} catch (e) {
			return window.el || null;
		}
	}
	function est() {
		try {
			return State;
		} catch (e) {
			ignorarErro(e, 'est');
		}
		try {
			return window.State;
		} catch (e) {
			ignorarErro(e, 'est');
		}
		return null;
	}
	function proj() {
		const f = fn('activeProject');
		if (f) {
			try {
				return f() || null;
			} catch (e) {
				ignorarErro(e, 'proj');
			}
		}
		const S = est();
		if (!S) return null;
		for (let i = 0; i < (S.projects || []).length; i++)
			if (S.projects[i].id === S.active) return S.projects[i];
		return null;
	}
	function dirs() {
		try {
			if (typeof openDirs !== 'undefined' && openDirs) return openDirs;
		} catch (e) {
			ignorarErro(e, 'dirs');
		}
		return null;
	}
	function toolsArr() {
		try {
			if (typeof MCP_TOOLS !== 'undefined' && MCP_TOOLS && MCP_TOOLS.length) return MCP_TOOLS;
		} catch (e) {
			ignorarErro(e, 'toolsArr');
		}
		return null;
	}
	function tool(nome) {
		const T = toolsArr();
		if (!T) return null;
		for (let i = 0; i < T.length; i++) if (T[i] && T[i].name === nome) return T[i];
		return null;
	}
	function av(t, d, k) {
		const f = fn('toast');
		if (f) {
			try {
				f(t, d, k || 'ok');
				return;
			} catch (e) {
				ignorarErro(e, 'av');
			}
		}
		try {
			registro.debug('[ux10]', t, d);
		} catch (e) {
			ignorarErro(e, 'av');
		}
	}
	function escH(s) {
		const f = fn('esc');
		if (f) {
			try {
				return f(s);
			} catch (e) {
				ignorarErro(e, 'escH');
			}
		}
		return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
			return c === '&'
				? '&amp;'
				: c === '<'
					? '&lt;'
					: c === '>'
						? '&gt;'
						: c === '"'
							? '&quot;'
							: '&#39;';
		});
	}
	function cssq(s) {
		try {
			if (window.CSS && CSS.escape) return CSS.escape(String(s));
		} catch (e) {
			ignorarErro(e, 'cssq');
		}
		return String(s).replace(/(["\\])/g, '\\$1');
	}
	function treeEl() {
		const e = E();
		return (e && e.tree) || document.getElementById('tree');
	}
	function renderArvore() {
		const f = fn('renderTreeAgora') || fn('renderTree');
		if (f) {
			try {
				f();
			} catch (e) {
				ignorarErro(e, 'renderArvore');
			}
		}
	}
	function base(p) {
		p = String(p || '');
		const i = p.lastIndexOf('/');
		return i < 0 ? p : p.slice(i + 1);
	}
	function pai(p) {
		p = String(p || '');
		const i = p.lastIndexOf('/');
		return i < 0 ? '' : p.slice(0, i);
	}
	const ICO_FILE =
		'<svg class="icon" viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>';
	const ICO_DIR =
		'<svg class="icon" viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';

	let inpFile = null,
		MAX_UM = 48 * 1024 * 1024;
	function inputArquivos() {
		if (inpFile) return inpFile;
		inpFile = document.createElement('input');
		inpFile.type = 'file';
		inpFile.multiple = true;
		inpFile.setAttribute('aria-hidden', 'true');
		inpFile.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0';
		document.body.appendChild(inpFile);
		inpFile.addEventListener('change', function () {
			const lista = [].slice.call(inpFile.files || []);
			inpFile.value = '';
			if (lista.length) importarParaRaiz(lista);
		});
		return inpFile;
	}
	function baseSeguro(nome) {
		nome = String(nome || '').replace(/\\/g, '/');
		nome = base(nome)
			.replace(/[<>:"|?*\u0000-\u001f]/g, '_')
			.replace(/^\.+/, '')
			.trim();
		return nome.slice(0, 120);
	}
	function nomeLivre(p, novos, nome) {
		const dot = nome.lastIndexOf('.'),
			b = dot > 0 ? nome.slice(0, dot) : nome,
			ext = dot > 0 ? nome.slice(dot) : '';
		let i = 2,
			alvo = b + '-' + i + ext;
		while ((p && p.files && p.files.has(alvo)) || (novos && novos.has(alvo))) {
			i++;
			alvo = b + '-' + i + ext;
		}
		return alvo;
	}
	function entradaManual(path, bytes) {
		let isT = true;
		try {
			if (window.Core && Core.isTextFile) isT = Core.isTextFile(path) !== false;
		} catch (e) {
			ignorarErro(e, 'entradaManual');
		}
		if (isT) {
			const lim = Math.min(bytes.length, 4096);
			for (let i = 0; i < lim; i++)
				if (bytes[i] === 0) {
					isT = false;
					break;
				}
		}
		if (isT) {
			let txt = '';
			try {
				txt =
					window.Core && Core.utf8Decode
						? Core.utf8Decode(bytes)
						: new TextDecoder('utf-8').decode(bytes);
			} catch (e) {
				isT = false;
			}
			if (isT)
				return {
					path: path,
					data: null,
					text: txt,
					isText: true,
					history: [{ t: Date.now(), text: txt }],
				};
		}
		return { path: path, data: bytes, text: null, isText: false, history: [] };
	}
	function entradaDe(path, bytes) {
		let mk = fn('makeFileEntry'),
			ent = null;
		if (mk) {
			try {
				ent = mk(path, bytes);
			} catch (e) {
				ent = null;
			}
		}
		if (!ent || typeof ent !== 'object' || !('isText' in ent)) ent = entradaManual(path, bytes);
		ent.path = path;
		return ent;
	}
	async function importarParaRaiz(lista) {
		const p = proj(),
			novos = new Map(),
			pulados = [];
		for (let i = 0; i < lista.length; i++) {
			const f = lista[i];
			if (!f) continue;
			if (f.size > MAX_UM) {
				pulados.push(f.name);
				continue;
			}
			const nome = baseSeguro(f.name);
			if (!nome) {
				pulados.push(f.name);
				continue;
			}
			let bytes = null;
			try {
				bytes = new Uint8Array(await f.arrayBuffer());
			} catch (e) {
				pulados.push(f.name);
				continue;
			}
			let alvo = nome;
			if ((p && p.files && p.files.has(alvo)) || novos.has(alvo)) alvo = nomeLivre(p, novos, nome);
			novos.set(alvo, entradaDe(alvo, bytes));
		}
		if (!novos.size) {
			av(
				'Nada importado',
				pulados.length
					? 'Arquivo(s) grandes ou ilegiveis: ' + pulados.slice(0, 3).join(', ')
					: 'Nenhum arquivo escolhido',
				'err',
			);
			return;
		}
		if (!p) {
			const addP = fn('addProject');
			if (!addP) {
				av('Sem projeto', 'Abra ou crie um projeto antes de importar', 'err');
				return;
			}
			const nm =
				novos.size === 1
					? base([].concat(Array.from(novos.keys()))[0]).replace(/\.[^.]+$/, '')
					: 'projeto-importado';
			try {
				addP(
					nm || 'projeto',
					novos.size === 1 && novos.has('index.html') ? 'html' : 'folder',
					novos,
				);
			} catch (e) {
				av('Falhou', String((e && e.message) || e), 'err');
			}
			return;
		}
		let primeiro = null;
		novos.forEach(function (ent, k) {
			if (p.emptyDirs && p.emptyDirs.has(k)) p.emptyDirs.delete(k);
			p.files.set(k, ent);
			try {
				if (p.dirty && p.dirty.add) p.dirty.add(k);
			} catch (e) {
				ignorarErro(e, 'importarParaRaiz');
			}
			if (!primeiro && ent.isText) primeiro = k;
		});
		const nomes = [].concat(Array.from(novos.keys()));
		try {
			call(
				'logCmd',
				p,
				`Importado(s) para a raiz: ${nomes.slice(0, 8).join(', ')}${nomes.length > 8 ? ' e mais ' + (nomes.length - 8) : ''}`,
			);
		} catch (e) {
			ignorarErro(e, 'importarParaRaiz');
		}
		const fc = fn('fsChanged');
		if (fc) {
			try {
				fc(p, primeiro || undefined);
			} catch (e) {
				renderArvore();
			}
		} else {
			renderArvore();
			call('renderEditorTabs');
			call('scheduleBuild', p);
			call('saveSession');
		}
		av(
			'Importado',
			novos.size +
				' arquivo(s) na raiz' +
				(pulados.length ? ` - ${pulados.length} ignorado(s)` : ''),
			'ok',
		);
	}

	let PEND = null,
		obs = null;
	function abrirDirs(dir) {
		const D = dirs();
		if (!D || !dir) return;
		let acc = '';
		String(dir)
			.split('/')
			.forEach(function (part) {
				acc = acc ? acc + '/' + part : part;
				try {
					D.add(acc);
				} catch (e) {
					ignorarErro(e, 'abrirDirs');
				}
			});
	}
	function pararObs() {
		if (obs) {
			try {
				obs.disconnect();
			} catch (e) {
				ignorarErro(e, 'pararObs');
			}
			obs = null;
		}
	}
	function novoInline(tipo, dir) {
		const p = proj();
		if (!p) {
			av('Nenhum projeto', 'Importe um .zip/pasta ou crie um projeto novo primeiro', 'err');
			return;
		}
		dir = String(dir || '').replace(/^\/+|\/+$/g, '');
		abrirDirs(dir);
		PEND = { modo: 'novo', tipo: tipo, dir: dir, valor: '' };
		renderArvore();
		injetar();
	}
	function renomearInline(caminho, pasta) {
		const p = proj();
		if (!p || !caminho) return;
		if (pasta) abrirDirs(pai(caminho));
		PEND = {
			modo: 'rename',
			tipo: pasta ? 'dir' : 'file',
			path: String(caminho),
			valor: base(caminho),
		};
		renderArvore();
		injetar();
	}
	function injetar() {
		if (!PEND) return;
		const root = treeEl();
		if (!root) return;
		if (root.querySelector('.ex-inline')) return;
		const inp = document.createElement('input');
		inp.className = 'ex-inline';
		inp.spellcheck = false;
		inp.autocomplete = 'off';
		inp.value = PEND.valor || '';
		if (PEND.modo === 'novo') {
			let cont = root,
				depth = 0,
				prefixo = '';
			if (PEND.dir) {
				const rowDir = root.querySelector(`.row[data-dir="${cssq(PEND.dir)}"]`);
				const kids = rowDir ? rowDir.nextElementSibling : null;
				if (kids && kids.classList && kids.classList.contains('children')) {
					cont = kids;
					depth = PEND.dir.split('/').length;
					if (cont.style.display === 'none') cont.style.display = '';
				} else {
					prefixo = PEND.dir + '/';
					if (!inp.value) inp.value = prefixo;
				}
			}
			const pad = 8 + depth * 13 + (PEND.tipo === 'file' ? 8 : 0);
			const linha = document.createElement('div');
			linha.className = 'row ex-inline-row';
			linha.style.paddingLeft = pad + 'px';
			linha.innerHTML = `<span class="fico">${PEND.tipo === 'dir' ? ICO_DIR : ICO_FILE}</span>`;
			linha.appendChild(inp);
			cont.insertBefore(linha, cont.firstChild);
			inp.placeholder = PEND.tipo === 'dir' ? 'nova-pasta' : 'novo-arquivo.js';
		} else {
			const sel = `.row[data-${PEND.tipo === 'dir' ? 'dir' : 'file'}="${cssq(PEND.path)}"]`;
			const row = root.querySelector(sel);
			const nm = row ? row.querySelector('.rname') : null;
			if (!row || !nm) {
				PEND = null;
				pararObs();
				return;
			}
			nm.style.display = 'none';
			row.appendChild(inp);
		}
		let feito = false;
		function fim(ok) {
			if (feito) return;
			feito = true;
			const val = inp.value,
				alvo = PEND;
			PEND = null;
			pararObs();
			if (ok && alvo) confirmar(alvo, val);
			else renderArvore();
		}
		inp.addEventListener('keydown', function (e) {
			if (e.key === 'Enter') {
				e.preventDefault();
				fim(true);
			} else if (e.key === 'Escape') {
				e.preventDefault();
				fim(false);
			} else if (e.key === 'Tab') {
				e.preventDefault();
			}
			e.stopPropagation();
		});
		inp.addEventListener('keyup', function (e) {
			e.stopPropagation();
		});
		inp.addEventListener('keypress', function (e) {
			e.stopPropagation();
		});
		inp.addEventListener('blur', function () {
			setTimeout(function () {
				fim(true);
			}, 0);
		});
		['click', 'mousedown', 'dblclick', 'contextmenu', 'dragstart'].forEach(function (ev) {
			inp.addEventListener(ev, function (e) {
				e.stopPropagation();
			});
		});
		try {
			inp.focus({ preventScroll: false });
			const v = inp.value,
				dot = v.lastIndexOf('.');
			if (PEND.modo === 'rename' && PEND.tipo === 'file' && dot > 0) inp.setSelectionRange(0, dot);
			else if (PEND.modo === 'rename') inp.select();
			else inp.setSelectionRange(v.length, v.length);
			if (inp.scrollIntoView) inp.scrollIntoView({ block: 'nearest' });
		} catch (e) {
			ignorarErro(e, 'injetar');
		}
		if (!obs && window.MutationObserver) {
			obs = new MutationObserver(function () {
				if (!PEND) {
					pararObs();
					return;
				}
				const r = treeEl();
				if (r && !r.querySelector('.ex-inline')) setTimeout(injetar, 0);
			});
			try {
				obs.observe(root, { childList: true, subtree: true });
			} catch (e) {
				ignorarErro(e, 'injetar');
			}
		}
	}
	function retomar(alvo, valor, aviso) {
		if (aviso) av(aviso[0], aviso[1], 'err');
		PEND = { modo: alvo.modo, tipo: alvo.tipo, dir: alvo.dir, path: alvo.path, valor: valor };
		renderArvore();
		injetar();
	}
	function confirmar(alvo, valBruto) {
		const p = proj();
		if (!p) {
			renderArvore();
			return;
		}
		const val = String(valBruto == null ? '' : valBruto)
			.trim()
			.replace(/^\/+/, '');
		if (!val) {
			renderArvore();
			return;
		}
		const vrp =
			fn('validRelPath') ||
			function () {
				return true;
			};
		if (alvo.modo === 'novo') {
			if (alvo.tipo === 'dir') {
				const path = (alvo.dir ? alvo.dir + '/' : '') + val.replace(/\/+$/, '');
				if (!vrp(path))
					return retomar(alvo, val, ['Nome invalido', 'Evite ".." e os caracteres < > : " | ? *']);
				if (p.files.has(path))
					return retomar(alvo, val, ['Ja existe', 'Ja ha um arquivo com esse caminho']);
				if (!p.emptyDirs) p.emptyDirs = new Set();
				const ja =
					p.emptyDirs.has(path) ||
					[].concat(Array.from(p.files.keys())).some(function (k) {
						return k.indexOf(path + '/') === 0;
					});
				abrirDirs(path);
				if (ja) {
					av('Ja existe', 'Essa pasta ja existe no projeto', 'warn');
					renderArvore();
					return;
				}
				p.emptyDirs.add(path);
				av('Pasta criada', `"${path}/"`, 'ok');
				renderArvore();
				call('saveSession');
				return;
			}
			const fpath = (alvo.dir ? alvo.dir + '/' : '') + val;
			if (!vrp(fpath))
				return retomar(alvo, val, ['Nome invalido', 'Evite ".." e os caracteres < > : " | ? *']);
			if (p.files.has(fpath)) {
				av('Ja existe', 'Abrindo o arquivo existente', 'warn');
				call('openFileInEditor', fpath);
				renderArvore();
				return;
			}
			if (p.emptyDirs && p.emptyDirs.has(fpath))
				return retomar(alvo, val, ['Ja existe', 'Ja ha uma pasta com esse nome']);
			const nfe = fn('newFileEntry');
			p.files.set(
				fpath,
				nfe
					? nfe(fpath)
					: {
							path: fpath,
							data: null,
							text: '',
							isText: true,
							history: [{ t: Date.now(), text: '' }],
						},
			);
			abrirDirs(alvo.dir);
			if (p.emptyDirs)
				[].concat(Array.from(p.emptyDirs)).forEach(function (d) {
					if (fpath.indexOf(d + '/') === 0) p.emptyDirs.delete(d);
				});
			av('Arquivo criado', `"${fpath}"`, 'ok');
			const fc = fn('fsChanged');
			if (fc) {
				try {
					fc(p, fpath);
				} catch (e) {
					renderArvore();
				}
			} else {
				renderArvore();
				call('openFileInEditor', fpath);
			}
			return;
		}
		const dirOld = pai(alvo.path);
		let dest = valBruto.indexOf('/') === 0 ? val : dirOld ? dirOld + '/' + val : val;
		dest = dest.replace(/^\/+/, '');
		if (alvo.tipo === 'dir') {
			dest = dest.replace(/\/+$/, '');
			if (!dest || dest === alvo.path) {
				renderArvore();
				return;
			}
			if (!vrp(dest))
				return retomar(alvo, val, ['Nome invalido', 'Evite ".." e os caracteres < > : " | ? *']);
			const pre = alvo.path + '/',
				ks = [].concat(Array.from(p.files.keys()));
			for (let i = 0; i < ks.length; i++)
				if (ks[i] === dest || ks[i].indexOf(dest + '/') === 0)
					return retomar(alvo, val, ['Conflito', `Ja existe algo em "${dest}"`]);
			const map = new Map();
			p.files.forEach(function (v, k) {
				if (k.indexOf(pre) === 0) {
					const nk = dest + '/' + k.slice(pre.length);
					v.path = nk;
					map.set(nk, v);
				} else map.set(k, v);
			});
			p.files = map;
			call('remapPaths', p, function (x) {
				return x && x.indexOf(pre) === 0 ? dest + '/' + x.slice(pre.length) : x;
			});
			if (p.emptyDirs) {
				const nd = new Set();
				p.emptyDirs.forEach(function (x) {
					nd.add(
						x === alvo.path ? dest : x.indexOf(pre) === 0 ? dest + '/' + x.slice(pre.length) : x,
					);
				});
				p.emptyDirs = nd;
			}
			const D = dirs();
			if (D && D.has(alvo.path)) {
				D.delete(alvo.path);
				D.add(dest);
			}
			av('Pasta renomeada', `"${alvo.path}" -> "${dest}"`, 'ok');
			const fc2 = fn('fsChanged');
			if (fc2) {
				try {
					fc2(p, p.openFile);
				} catch (e) {
					renderArvore();
				}
			} else renderArvore();
			return;
		}
		if (!dest || dest === alvo.path) {
			renderArvore();
			return;
		}
		if (!vrp(dest))
			return retomar(alvo, val, ['Nome invalido', 'Evite ".." e os caracteres < > : " | ? *']);
		if (p.files.has(dest))
			return retomar(alvo, val, ['Ja existe', `Ja ha um arquivo em "${dest}"`]);
		const f = p.files.get(alvo.path);
		if (!f) {
			renderArvore();
			return;
		}
		f.path = dest;
		const m2 = new Map();
		p.files.forEach(function (v, k) {
			m2.set(k === alvo.path ? dest : k, v);
		});
		p.files = m2;
		call('remapPaths', p, function (x) {
			return x === alvo.path ? dest : x;
		});
		av('Renomeado', `"${alvo.path}" -> "${dest}"`, 'ok');
		const fc3 = fn('fsChanged');
		if (fc3) {
			try {
				fc3(p, p.openFile);
			} catch (e) {
				renderArvore();
			}
		} else renderArvore();
	}

	window.ctxNewFile = function (dir) {
		novoInline('file', dir || '');
	};
	window.ctxNewFolder = function (dir) {
		novoInline('dir', dir || '');
	};
	window.ctxRenameFile = function (path) {
		renomearInline(path, false);
	};
	window.ctxRenameFolder = function (dir) {
		renomearInline(dir, true);
	};

	function pidAtivo() {
		const p = proj();
		return p ? String(p.id) : '';
	}
	function globaisLista() {
		const f = fn('tmGlobalsDo');
		if (!f) return null;
		try {
			const L = f(pidAtivo());
			return Array.isArray(L) ? L : [];
		} catch (e) {
			return [];
		}
	}
	function salvarEquipes() {
		call('tmAdminSalvar');
		call('tmTouch');
		call('saveSession');
	}
	function globalAdd(path) {
		path = String(path || '').trim();
		if (!path) return;
		const g = fn('tmGlobalAdd');
		if (!g) {
			av('Indisponivel', 'O modulo de equipes nao carregou', 'err');
			return;
		}
		try {
			g([path], pidAtivo());
			salvarEquipes();
			av('Arquivo global', `"${path}" agora pode ser editado por qualquer equipe`, 'ok');
		} catch (e) {
			av('Nao deu', String((e && e.message) || e), 'err');
		}
		atualizarMenu();
	}
	function globalRemove(path) {
		const g = fn('tmGlobalRemove');
		if (!g) return;
		try {
			const r = g([path], pidAtivo());
			if (r && !r.removidos) g([path], '');
			salvarEquipes();
			av('Removido', `"${path}" nao e mais global`, 'ok');
		} catch (e) {
			av('Nao deu', String((e && e.message) || e), 'err');
		}
		atualizarMenu();
	}
	function renomearProjeto(nome, id) {
		const S = est();
		if (!S) return;
		const p = id
			? (S.projects || []).filter(function (x) {
					return x.id === id;
				})[0]
			: proj();
		if (!p) return;
		nome = String(nome || '')
			.trim()
			.slice(0, 90);
		if (!nome || nome === p.name) return;
		const antigo = p.name;
		p.name = nome;
		call('renderTabs');
		call('renderStatusbar');
		call('saveSession');
		try {
			call('logCmd', p, `Projeto renomeado: "${antigo}" -> "${nome}"`);
		} catch (e) {
			ignorarErro(e, 'renomearProjeto');
		}
		av('Projeto renomeado', `"${antigo}" -> "${nome}"`, 'ok');
	}
	function esqueleto(nome) {
		return `<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" \
content="width=device-width, initial-scale=1">\n<title>${String(nome).replace(/[<>]/g, '')}</title>\n</head>\
\n<body>\n\n</body>\n</html>\n`;
	}
	async function novoProjeto(nome) {
		nome =
			String(nome || '')
				.trim()
				.slice(0, 90) || 'novo-projeto';
		const t = tool('create_project');
		if (t && t.run) {
			try {
				await t.run({ name: nome, activate: true });
				av('Projeto criado', `"${nome}" esta ativo`, 'ok');
				return;
			} catch (e) {
				ignorarErro(e, 'novoProjeto');
			}
		}
		const addP = fn('addProject');
		if (!addP) {
			av('Indisponivel', 'Nao foi possivel criar o projeto', 'err');
			return;
		}
		const nfe = fn('newFileEntry');
		const f = nfe
			? nfe('index.html')
			: { path: 'index.html', data: null, text: '', isText: true, history: [] };
		f.isText = true;
		f.data = null;
		f.text = esqueleto(nome);
		f.history = [{ t: Date.now(), text: f.text }];
		const files = new Map();
		files.set('index.html', f);
		try {
			addP(nome, 'html', files);
		} catch (e) {
			av('Falhou', String((e && e.message) || e), 'err');
		}
	}
	function mem() {
		return window.SYNAPSE_MEM10 || null;
	}
	function htmlMenu() {
		const p = proj(),
			M = mem();
		const L = globaisLista();
		let h = '';
		h += `<div class="clabel">${p ? escH(p.name) : 'Nenhum projeto aberto'}</div>`;
		if (p) {
			h += `<button class="ci" data-a="ren">${ICO_FILE}Renomear projeto aberto</button>`;
			h += `<button class="ci" data-a="exp">${ICO_DIR}Exportar .zip</button>`;
		}
		h += `<button class="ci" data-a="novo">${ICO_DIR}Novo projeto vazio</button>`;
		h += `<button class="ci" data-a="imp">${ICO_FILE}Importar arquivos para a raiz</button>`;
		if (p) {
			h += '<div class="csep"></div><div class="clabel">Arquivos globais</div>';
			if (L === null) h += '<div class="ux-vazio">Modulo de equipes nao carregado.</div>';
			else if (!L.length)
				h += '<div class="ux-vazio">Nenhum ainda. Global = qualquer equipe pode editar.</div>';
			else {
				h += '<div class="ux-glist">';
				L.slice(0, 40).forEach(function (g) {
					const pt = String((g && g.path) || '');
					h += `<div class="ux-g"><span title="${escH(pt)}">${escH(pt)}${g && g.dir ? '/' : ''}</span><button data-rm="${escH(pt)}" title="Tirar da lista">&#215;</button></div>`;
				});
				h += '</div>';
			}
			h += `<button class="ci" data-a="gadd">${ICO_FILE}Tornar caminho global</button>`;
		}
		h += '<div class="csep"></div><div class="clabel">Memoria</div>';
		if (M) {
			let pausado = false;
			try {
				pausado = !!M.pausado();
			} catch (e) {
				ignorarErro(e, 'htmlMenu');
			}
			h += `<button class="ci${pausado ? ' on' : ''}" data-a="prev">${ICO_FILE}${pausado ? 'Retomar preview' : 'Pausar preview (libera memoria)'}</button>`;
			h += `<button class="ci${M.leve ? ' on' : ''}" data-a="leve">${ICO_FILE}Modo leve: ${M.leve ? 'ligado' : 'desligado'}<small>\
PC fraco: corta historico, minimapa e previews em segundo plano</small></button>`;
			h += `<button class="ci" data-a="lib">${ICO_FILE}Liberar memoria agora</button>`;
			let d = null;
			try {
				d = M.diag(true);
			} catch (e) {
				ignorarErro(e, 'htmlMenu');
			}
			if (d)
				h += `<div class="ux-mem">heap ${d.heapMB} MB - ${d.arquivos} arq - ${d.projetos} proj - hist ${d.histChars}k</div>`;
		} else h += '<div class="ux-vazio">Patch de memoria nao carregado.</div>';
		return h;
	}
	let painel = null;
	function fecharPainel() {
		if (!painel) return;
		try {
			painel.remove();
		} catch (e) {
			ignorarErro(e, 'fecharPainel');
		}
		painel = null;
		document.removeEventListener('mousedown', foraPainel, true);
		document.removeEventListener('keydown', escPainel, true);
	}
	function foraPainel(e) {
		if (painel && !painel.contains(e.target)) fecharPainel();
	}
	function escPainel(e) {
		if (e.key === 'Escape') {
			e.stopPropagation();
			fecharPainel();
		}
	}
	function atualizarMenu() {
		if (painel) painel.innerHTML = htmlMenu();
	}
	function posicionar(el0, btn) {
		const r = btn.getBoundingClientRect();
		el0.style.left = '0px';
		el0.style.top = '0px';
		el0.style.visibility = 'hidden';
		const w = el0.offsetWidth || 260,
			h = el0.offsetHeight || 200;
		const x = Math.min(Math.max(8, r.left - w + r.width), Math.max(8, window.innerWidth - w - 8));
		let y = r.bottom + 6;
		if (y + h > window.innerHeight - 8) y = Math.max(8, r.top - h - 6);
		el0.style.left = x + 'px';
		el0.style.top = y + 'px';
		el0.style.visibility = '';
	}
	function campoNoMenu(botao, valor, ph, aoOk) {
		const row = document.createElement('div');
		row.className = 'ux-row';
		const inp = document.createElement('input');
		inp.className = 'ex-inline';
		inp.spellcheck = false;
		inp.value = valor || '';
		inp.placeholder = ph || '';
		row.appendChild(inp);
		botao.parentNode.replaceChild(row, botao);
		let feito = false;
		function fim(ok) {
			if (feito) return;
			feito = true;
			const v = inp.value;
			if (ok && String(v).trim()) aoOk(String(v).trim());
			else atualizarMenu();
		}
		inp.addEventListener('keydown', function (e) {
			if (e.key === 'Enter') {
				e.preventDefault();
				fim(true);
			} else if (e.key === 'Escape') {
				e.preventDefault();
				e.stopPropagation();
				fim(false);
			}
			e.stopPropagation();
		});
		inp.addEventListener('mousedown', function (e) {
			e.stopPropagation();
		});
		try {
			inp.focus();
			inp.select();
		} catch (e) {
			ignorarErro(e, 'campoNoMenu');
		}
	}
	function cliqueMenu(e) {
		const rm = e.target.closest ? e.target.closest('[data-rm]') : null;
		if (rm) {
			e.preventDefault();
			e.stopPropagation();
			globalRemove(rm.getAttribute('data-rm'));
			return;
		}
		const b = e.target.closest ? e.target.closest('[data-a]') : null;
		if (!b) return;
		e.preventDefault();
		e.stopPropagation();
		const a = b.getAttribute('data-a'),
			p = proj(),
			M = mem();
		if (a === 'ren') {
			if (!p) return;
			campoNoMenu(b, p.name, 'nome do projeto', function (v) {
				renomearProjeto(v);
				fecharPainel();
			});
			return;
		}
		if (a === 'novo') {
			campoNoMenu(b, '', 'nome do projeto novo', function (v) {
				fecharPainel();
				novoProjeto(v);
			});
			return;
		}
		if (a === 'gadd') {
			campoNoMenu(b, '', 'README.md ou docs/', function (v) {
				globalAdd(v);
			});
			return;
		}
		if (a === 'imp') {
			fecharPainel();
			inputArquivos().click();
			return;
		}
		if (a === 'exp') {
			fecharPainel();
			call('exportZip') || call('doExport');
			return;
		}
		if (a === 'prev' && M) {
			let ok = false;
			try {
				ok = M.pausado() ? M.retomarPreview() : M.pausarPreview();
			} catch (e2) {
				ignorarErro(e2, 'cliqueMenu');
			}
			atualizarMenu();
			av(
				M.pausado() ? 'Preview pausado' : 'Preview retomado',
				M.pausado() ? 'A memoria do preview foi liberada' : 'Reconstruindo o preview',
				'ok',
			);
			return;
		}
		if (a === 'leve' && M) {
			try {
				M.modoLeve(!M.leve);
			} catch (e3) {
				ignorarErro(e3, 'cliqueMenu');
			}
			atualizarMenu();
			av('Modo leve', M.leve ? 'Ligado - consumo reduzido' : 'Desligado', 'ok');
			return;
		}
		if (a === 'lib' && M) {
			let r = null;
			try {
				r = M.liberar();
			} catch (e4) {
				ignorarErro(e4, 'cliqueMenu');
			}
			atualizarMenu();
			av(
				'Memoria liberada',
				r ? `historico ${r.hist} - blobs ${r.blobs} - previews ${r.headless}` : 'Feito',
				'ok',
			);
			return;
		}
	}
	function menuProjeto(btn) {
		if (painel) {
			fecharPainel();
			return;
		}
		painel = document.createElement('div');
		painel.className = 'ctxmenu uxmenu';
		painel.innerHTML = htmlMenu();
		document.body.appendChild(painel);
		posicionar(painel, btn);
		painel.addEventListener('click', cliqueMenu);
		painel.addEventListener('contextmenu', function (e) {
			e.stopPropagation();
		});
		setTimeout(function () {
			document.addEventListener('mousedown', foraPainel, true);
			document.addEventListener('keydown', escPainel, true);
		}, 0);
	}

	function dirDoContexto() {
		const p = proj();
		if (!p) return '';
		const D = dirs(),
			d = pai(p.openFile || '');
		if (d && D && D.has(d)) return d;
		return d || '';
	}
	document.addEventListener(
		'click',
		function (e) {
			const t =
				e.target && e.target.closest
					? e.target.closest('#addBtn,#exNewFile,#exNewFolder,#exProjBtn')
					: null;
			if (!t) return;
			e.preventDefault();
			e.stopPropagation();
			try {
				const m = document.getElementById('importMenu');
				if (m) m.classList.remove('open');
			} catch (_e) {
				ignorarErro(_e, 'explorer-e-projeto');
			}
			if (t.id === 'addBtn') {
				inputArquivos().click();
				return;
			}
			if (t.id === 'exNewFile') {
				novoInline('file', dirDoContexto());
				return;
			}
			if (t.id === 'exNewFolder') {
				novoInline('dir', dirDoContexto());
				return;
			}
			if (t.id === 'exProjBtn') {
				menuProjeto(t);
				return;
			}
		},
		true,
	);

	document.addEventListener(
		'dblclick',
		function (e) {
			const tab = e.target && e.target.closest ? e.target.closest('#tabs [data-tab]') : null;
			if (!tab) return;
			e.preventDefault();
			e.stopPropagation();
			const id = tab.getAttribute('data-tab');
			const nm = tab.querySelector('.tname');
			if (!nm) return;
			const S = est();
			const p = ((S && S.projects) || []).filter(function (x) {
				return x.id === id;
			})[0];
			if (!p) return;
			nm.style.display = 'none';
			const inp = document.createElement('input');
			inp.className = 'ex-inline';
			inp.spellcheck = false;
			inp.value = p.name || '';
			tab.insertBefore(inp, nm);
			let feito = false;
			function fim(ok) {
				if (feito) return;
				feito = true;
				const v = inp.value;
				if (ok) renomearProjeto(v, id);
				call('renderTabs');
			}
			inp.addEventListener('keydown', function (ev) {
				if (ev.key === 'Enter') {
					ev.preventDefault();
					fim(true);
				} else if (ev.key === 'Escape') {
					ev.preventDefault();
					fim(false);
				}
				ev.stopPropagation();
			});
			inp.addEventListener('blur', function () {
				setTimeout(function () {
					fim(true);
				}, 0);
			});
			['click', 'mousedown', 'dblclick'].forEach(function (ev) {
				inp.addEventListener(ev, function (x) {
					x.stopPropagation();
				});
			});
			try {
				inp.focus();
				inp.select();
			} catch (_e) {
				ignorarErro(_e, 'explorer-e-projeto');
			}
		},
		true,
	);

	document.addEventListener(
		'keydown',
		function (e) {
			if (e.key !== 'F2' || PEND) return;
			const p = proj();
			if (!p || !p.openFile) return;
			e.preventDefault();
			e.stopPropagation();
			renomearInline(p.openFile, false);
		},
		true,
	);

	window.SYNAPSE_UX = {
		ver: '10.0.0',
		importar: function () {
			inputArquivos().click();
		},
		novoArquivo: function (dir) {
			novoInline('file', dir || '');
		},
		novaPasta: function (dir) {
			novoInline('dir', dir || '');
		},
		renomear: function (path, pasta) {
			renomearInline(path, !!pasta);
		},
		renomearProjeto: renomearProjeto,
		novoProjeto: novoProjeto,
		globalAdd: globalAdd,
		globalRemove: globalRemove,
		menu: menuProjeto,
	};
	try {
		registro.debug('[ux10] Explorer inline + acoes de projeto ativos');
	} catch (e) {
		ignorarErro(e, 'explorer-e-projeto');
	}
})();
