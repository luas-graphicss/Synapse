'use strict';
function scheduleBuild(proj) {
	if (!proj) return;
	if (proj.previewEverOpened && State.layout === 'editor') {
		proj.previewDirty = true;
		const _sh = scheduleHandles.get(proj.id);
		if (_sh) {
			if (_sh.raf) cancelAnimationFrame(_sh.raf);
			if (_sh.t) clearTimeout(_sh.t);
			scheduleHandles.delete(proj.id);
		}
		return;
	}
	const sh = scheduleHandles.get(proj.id);
	if (sh) {
		if (sh.raf) cancelAnimationFrame(sh.raf);
		if (sh.t) clearTimeout(sh.t);
	}
	let total = 0;
	try {
		for (const f of proj.files.values()) {
			total +=
				f.text != null ? f.text.length : (f.data && (f.data.byteLength || f.data.length)) || 0;
			if (total > 400000) break;
		}
	} catch (e) {
		ignorarErro(e, 'scheduleBuild');
	}
	const nf = (proj.files && proj.files.size) || 0;
	let espera = nf > 600 ? 700 : nf > 250 ? 450 : total > 400000 ? 280 : 0;
	if (document.hidden) espera = Math.max(espera, 1200);
	const go = () => {
		scheduleHandles.delete(proj.id);
		buildPreview(proj);
	};
	if (espera > 0) scheduleHandles.set(proj.id, { t: setTimeout(go, espera) });
	else scheduleHandles.set(proj.id, { raf: requestAnimationFrame(go) });
}

const BIN_DE_BUILD = ['.wasm', '.data', '.mem', '.bin'];
function ehBinarioDeBuild(p) {
	const b = String(p || '').toLowerCase();
	for (let i = 0; i < BIN_DE_BUILD.length; i++) {
		const suf = BIN_DE_BUILD[i];
		if (b.length >= suf.length && b.slice(b.length - suf.length) === suf) return true;
	}
	return false;
}
function arquivosParaCompilador(proj) {
	const lista = [];
	try {
		for (const [p, f] of proj.files) {
			let txt = '';
			try {
				if (f && f.text != null) txt = f.text;
				else if (f && f.isText) txt = fileText(f) || '';
			} catch (e) {
				txt = '';
			}
			let bin = null;
			try {
				if (f && f.data) bin = f.data;
				else if (f && f.text != null && ehBinarioDeBuild(p)) bin = new TextEncoder().encode(f.text);
			} catch (e) {
				bin = null;
			}
			let editado = false;
			try {
				editado = !!(f && f.history && f.history.length > 1);
			} catch (e) {
				editado = false;
			}
			lista.push({ caminho: p, conteudo: txt, bytes: bin, editado: editado });
		}
	} catch (e) {
		ignorarErro(e, 'arquivosParaCompilador');
	}
	return lista;
}
function rotulosDoCompilador() {
	const t = (s) => {
		try {
			return window.SYNAPSE_I18N && window.SYNAPSE_I18N.t ? window.SYNAPSE_I18N.t(s) : s;
		} catch (e) {
			return s;
		}
	};
	return {
		esperando: t('Aguardando...'),
		saida: t('Saída do programa'),
		entrada: t('Digite e pressione Enter'),
		fim: t('Programa encerrado'),
		codigo: t('código'),
		truncado: t('Saída antiga removida para não travar o navegador.'),
		rodando: t('Rodando'),
		quadros: t('quadros/s'),
		clique: t('Clique no preview para o teclado e o mouse funcionarem.'),
		parado: t('O programa parou de desenhar.'),
		iniciando: t('Iniciando módulo...'),
		erro: t('Erro'),
		estFalhouInicio: t('Falhou ao iniciar'),
		estIncompativel: t('Ambiente incompativel'),
		estNaoExecutavel: t('Nao executavel no navegador'),
		estPrecisaBuild: t('Precisa de build web ou Relay'),
		estNativo: t('Preview nativo'),
		estSemToolchain: t('Toolchain nao configurado'),
		estSemAdaptador: t('Sem adaptador de compilacao'),
		estPreparando: t('Preparando o compilador...'),
		estCompilando: t('Compilando...'),
		estFalhaCompilacao: t('Falha na compilacao'),
		estBinarioInvalido: t('Binario invalido'),
		estExecutando: t('Executando...'),
		estCancelado: t('Cancelado'),
		estErroCompilacao: t('Erro de compilacao'),
		estFalhou: t('Falhou'),
	};
}

const STUB_SERVICE_WORKER =
	'try{if(navigator.serviceWorker){const __r=function(){return Promise.resolve({unregister:' +
	'function(){return Promise.resolve(true)},update:function(){return Promise.resolve()},' +
	'addEventListener:function(){}})};Object.defineProperty(navigator,"serviceWorker",{value:' +
	'{register:__r,ready:new Promise(function(){}),getRegistration:function(){return ' +
	'Promise.resolve(undefined)},getRegistrations:function(){return Promise.resolve([])},' +
	'addEventListener:function(){},controller:null},configurable:true});}}catch(e){}';

function preludiosDoPreview(contexto) {
	const preludios = [];

	if (contexto.framework === 'flutter') {
		preludios.push({ nome: 'stub-service-worker', codigo: STUB_SERVICE_WORKER });
	}

	const vp = contexto.viewport;
	if (vp) {
		const medidas = { w: vp.w, h: vp.h, dpr: vp.dpr || 0, touch: vp.touch ? 5 : 0 };
		preludios.push({ nome: 'viewport', codigo: `window.__lpVP=${JSON.stringify(medidas)};` });
	}

	preludios.push({ nome: 'rotas-spa', codigo: AURORA_SPA_SHIM });
	preludios.push({ nome: 'preludio-aurora', codigo: AURORA_PRELUDE });
	preludios.push({ nome: 'visao', codigo: VISION_HOOK });
	preludios.push({ nome: 'console', codigo: CONSOLE_HOOK });

	preludios.push({
		nome: 'mapa-de-arquivos',
		codigo:
			`window.__LP_SRC__=${JSON.stringify(contexto.fontes)};\n` +
			`window.__LP_MAP__=${JSON.stringify(contexto.arquivos)};\n` +
			FETCH_SHIM,
	});

	return preludios;
}

function injetarPreludios(dom, contexto) {
	const preludios = preludiosDoPreview(contexto);
	for (let i = preludios.length - 1; i >= 0; i--) {
		const script = dom.createElement('script');
		script.setAttribute('data-synapse', 'preludio');
		script.setAttribute('data-synapse-preludio', preludios[i].nome);
		script.textContent = preludios[i].codigo;
		dom.head.insertBefore(script, dom.head.firstChild);
	}
}

function planoDoCompilador(proj) {
	if (!window.SYNAPSE_ORQUESTRADOR || !window.SYNAPSE_DETECCAO) return null;
	if (!proj || !proj.files || !proj.files.size) return null;
	const arquivos = arquivosParaCompilador(proj);
	let plano = null;
	try {
		plano = window.SYNAPSE_DETECCAO.detectar(arquivos);
	} catch (e) {
		return null;
	}
	if (!plano) return null;
	if (plano.toolchain === 'nativo' || plano.toolchain === 'dev-server') return null;
	return { plano: plano, arquivos: arquivos };
}
async function autoCompilarPreview(proj, token, alvo) {
	const plano = alvo.plano;
	logCmd(
		proj,
		'Projeto ' +
			plano.tipo +
			' detectado' +
			(plano.entrada ? ` (entrada: ${plano.entrada})` : '') +
			': o pipeline web nao serve aqui, assumindo com o auto-compilador.',
	);
	if (State.layout === 'editor') {
		proj.previewDirty = true;
		logCmd(proj, 'Preview fechado agora - o auto-compilador roda assim que voce abrir o preview.');
		return;
	}
	if (proj.id === State.active) {
		hidePreviewLoading();
		hidePreviewError();
		el.previewEmpty.classList.add('hidden');
		el.device.classList.remove('hidden');
		setStatus('run', 'Auto-compilando...');
	}
	try {
		el.frame.setAttribute(
			'sandbox',
			'allow-scripts allow-same-origin allow-forms allow-popups allow-pointer-lock allow-modals',
		);
	} catch (e) {
		ignorarErro(e, 'autoCompilarPreview');
	}
	try {
		el.frame.setAttribute('allow', 'pointer-lock; fullscreen; gamepad; autoplay');
	} catch (e) {
		ignorarErro(e, 'autoCompilarPreview');
	}
	try {
		el.frame.removeAttribute('src');
	} catch (e) {
		ignorarErro(e, 'autoCompilarPreview');
	}
	proj.lastHtml = null;
	let r = null;
	try {
		r = await window.SYNAPSE_ORQUESTRADOR.autoPreview({
			arquivos: alvo.arquivos,
			frame: el.frame,
			limiteMs: 10000,
			rotulos: rotulosDoCompilador(),
			aoLog: function (reg) {
				if (!reg) return;
				if (token !== proj.buildToken) return;
				const txt = '[auto-compilador] ' + reg.texto;
				if (reg.nivel === 'erro') logErr(proj, txt);
				else if (reg.nivel === 'aviso') pushLog(proj, 'warn', txt);
				else logCmd(proj, txt);
			},
		});
	} catch (e) {
		logErr(proj, '[auto-compilador] parou de um jeito nao previsto: ' + ((e && e.message) || e));
	}
	if (token !== proj.buildToken) return;
	if (r && r.ok) {
		logCmd(proj, 'Preview compilado e executado ✓');
		if (proj.id === State.active) {
			setStatus('ok', 'Preview compilado');
			try {
				renderStatusbar();
			} catch (e) {
				ignorarErro(e, 'autoCompilarPreview');
			}
		}
	} else {
		const etapa = (r && r.etapa) || '?';
		const motivo = (r && (r.motivo || r.texto)) || 'sem motivo informado';
		logErr(proj, `[auto-compilador] parou na etapa "${etapa}": ${motivo}`);
		if (proj.id === State.active) {
			setStatus('err', 'Auto-compilador parou');
			try {
				renderStatusbar();
			} catch (e) {
				ignorarErro(e, 'autoCompilarPreview');
			}
		}
	}
}

async function buildPreview(proj) {
	if (!proj) {
		hidePreviewLoading();
		renderPreviewEmpty(true);
		return;
	}
	proj.previewEverOpened = true;
	proj.previewDirty = false;
	const token = (proj.buildToken = (proj.buildToken || 0) + 1);
	logCmd(proj, '⚙ Montando preview…');
	if (proj.id === State.active) {
		setStatus('run', 'Compilando preview…');
		setPreviewLoadingDetail('Compilando o preview…');
	}
	try {
		if (!proj.files.size) {
			if (proj.id === State.active) {
				hidePreviewLoading();
				renderPreviewEmpty(true);
			}
			return;
		}
		const __alvo = planoDoCompilador(proj);
		if (__alvo) {
			await autoCompilarPreview(proj, token, __alvo);
			return;
		}
		limparBlobsSoltos(proj);
		if (proj.detect && proj.detect.framework === 'flutter' && !proj.entry) {
			setFrame(proj, flutterPreviewDoc(proj), token);
			finishBuild(proj, token);
			return;
		}
		const files = proj.files;
		const rawUrl = {};
		const mimeOf = {};
		const cacheRaw = proj.blobCache || (proj.blobCache = new Map());
		const vivos = new Set();
		let __bn = 0,
			__novos = 0;
		for (const [p, f] of files) {
			const mime = Core.getMime(p);
			mimeOf[p] = mime;
			let ent = cacheRaw.get(p);
			const igual =
				!!ent &&
				ent.mime === mime &&
				((f.text != null && ent.txt === f.text && ent.bin == null) ||
					(f.text == null && ent.txt == null && ent.bin === f.data));
			if (!igual) {
				if (ent && ent.url) {
					try {
						URL.revokeObjectURL(ent.url);
					} catch (e) {
						ignorarErro(e, 'buildPreview');
					}
					proj.blobs.delete(ent.url);
				}
				ent = {
					mime: mime,
					txt: f.text != null ? f.text : null,
					bin: f.text != null ? null : f.data,
					url: mkBlob(proj, fileBytes(f), mime),
				};
				cacheRaw.set(p, ent);
				__novos++;
			}
			rawUrl[p] = ent.url;
			vivos.add(p);
			if (++__bn % 150 === 0 && __novos > 0) {
				if (proj.id === State.active)
					setPreviewLoadingDetail(`Preparando arquivos... ${__bn}/${files.size}`);
				await AuroraFix.yieldUI();
				if (token !== proj.buildToken) return;
			}
		}
		for (const [pv, entv] of [...cacheRaw]) {
			if (!vivos.has(pv)) {
				if (entv && entv.url) {
					try {
						URL.revokeObjectURL(entv.url);
					} catch (e) {
						ignorarErro(e, 'buildPreview');
					}
					proj.blobs.delete(entv.url);
				}
				cacheRaw.delete(pv);
			}
		}
		const cssCache = {};
		const processCss = (path, seen) => {
			if (cssCache[path]) return cssCache[path];
			seen = seen || new Set();
			if (seen.has(path)) return rawUrl[path];
			seen.add(path);
			const f = files.get(path);
			if (!f) {
				return rawUrl[path];
			}
			let text = fileText(f);
			const dir = Core.dirname(path);
			text = text.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/g, (m, q, ref) => {
				const r = Core.joinPath(dir, ref);
				if (files.has(r)) return `url(${rawUrl[r]})`;
				return m;
			});
			text = text.replace(/@import\s+(["'])([^"']+)\1/g, (m, q, ref) => {
				const r = Core.joinPath(dir, ref);
				if (files.has(r)) return `@import "${processCss(r, seen)}"`;
				return m;
			});
			const cch = proj.cssBlobCache || (proj.cssBlobCache = new Map());
			const ant = cch.get(path);
			if (ant && ant.txt === text) {
				cssCache[path] = ant.url;
				return ant.url;
			}
			if (ant && ant.url) {
				try {
					URL.revokeObjectURL(ant.url);
				} catch (e) {
					ignorarErro(e, 'processCss');
				}
				proj.blobs.delete(ant.url);
			}
			const url = mkBlob(proj, text, 'text/css');
			cch.set(path, { txt: text, url: url });
			cssCache[path] = url;
			return url;
		};
		for (const p of files.keys()) if (Core.extname(p) === '.css') processCss(p);

		let importMap = null,
			transformedEntryScripts = null;
		const usesEsModule = (p) =>
			['.js', '.mjs', '.cjs'].includes(Core.extname(p)) &&
			/(^|[^.\w$])(import|export)\b/.test(fileText(files.get(p)));
		const needTransform =
			(proj.detect.type !== 'static' && proj.detect.framework !== 'flutter') ||
			[...files.keys()].some((p) => ['.jsx', '.tsx', '.ts'].includes(Core.extname(p))) ||
			[...files.keys()].some(usesEsModule);

		let entry = proj.entry && files.has(proj.entry) ? proj.entry : null;
		if (!entry) {
			const be = AuroraFix.pickBestEntry(files, proj.detect);
			if (be) {
				entry = be;
				proj.entry = be;
			}
		}
		let entryDir = '',
			html = '',
			synth = null;
		if (entry) {
			entryDir = Core.dirname(entry);
			html = fileText(files.get(entry));
		} else {
			synth = AuroraFix.synthesizeEntry(files);
			if (synth) {
				entryDir = synth.dir;
				html = synth.html;
				logCmd(
					proj,
					`Sem index.html no projeto: montei uma pagina host para "${synth.entrySource}".`,
				);
			}
		}
		if (!entry && !synth) {
			const doc = synthIndex(files, rawUrl);
			setFrame(proj, doc, token);
			finishBuild(proj, token);
			return;
		}
		const dom = new DOMParser().parseFromString(html, 'text/html');
		let base = dom.querySelector('base');
		if (!base) {
			base = dom.createElement('base');
			dom.head.insertBefore(base, dom.head.firstChild);
		}
		base.setAttribute('href', 'https://aurora.local/' + (entryDir ? entryDir + '/' : ''));
		const resolve = (ref) => {
			const clean = String(ref).replace(/[?#].*$/, '');
			if (clean.startsWith('/')) {
				const rel = clean.replace(/^\/+/, '');
				const scoped = entryDir ? Core.joinPath(entryDir, rel) : rel;
				if (files.has(scoped)) return scoped;
				return rel;
			}
			let r = Core.joinPath(entryDir, clean);
			return r.startsWith('/') ? r.slice(1) : r;
		};
		const entryFix = AuroraFix.fixEntryScripts(proj, dom, files, resolve, entryDir);
		if (entry && AuroraFix.isBuildOutPath(entry))
			logCmd(
				proj,
				`Entrada: "${entry}" - build pronto do projeto (o HTML da raiz aponta para um bundle que so existe \
depois de compilar). Edicoes em src/ so aparecem apos rodar o build; tire a pasta dist/ do zip para \
compilar do zero aqui.`,
			);
		try {
			const rootsTxt = (entryFix.roots || [])
				.map((r) => (files.has(r) ? fileText(files.get(r)) : ''))
				.join('\n');
			if (/history\.(push|replace)State|location\.pathname/.test(rootsTxt))
				logCmd(
					proj,
					'Rotas por caminho detectadas. O preview roda em <iframe srcdoc>: location.pathname vale ' +
						'"srcdoc", entao roteadores por caminho caem no 404 do proprio app. Liguei a ponte de ' +
						'history (sem SecurityError) e comecei em "#/" - no app, caia para modo hash quando ' +
						'location.protocol nao for http(s).',
				);
		} catch (e) {
			ignorarErro(e, 'buildPreview');
		}
		let transform = null;
		if (needTransform) {
			transform = await tryBuildModules(
				proj,
				files,
				rawUrl,
				entryFix.roots,
				processCss,
				entryDir,
			).catch((e) => {
				logErr(proj, 'Runtime build: ' + e.message);
				return null;
			});
			if (transform) importMap = transform.importMap;
		}
		if (token !== proj.buildToken) return;
		const projImportMaps = [];
		dom.querySelectorAll('script').forEach((node) => {
			if (String(node.getAttribute('type') || '').toLowerCase() !== 'importmap') return;
			let text = (node.textContent || '').trim();
			if (!text) {
				const s = node.getAttribute('src');
				if (s) {
					const r = resolve(s);
					if (files.has(r)) text = fileText(files.get(r)).trim();
				}
			}
			if (!text) return;
			let json = null;
			try {
				json = JSON.parse(text);
			} catch (e) {
				logErr(proj, 'Import map do projeto inválido (mantido como está): ' + e.message);
			}
			if (json && typeof json === 'object') {
				resolveImportMapLocals(json, resolve, files, rawUrl, transform && transform.modules);
				projImportMaps.push(json);
				node.remove();
			}
		});
		dom.querySelectorAll('[href]').forEach((node) => {
			const v = node.getAttribute('href');
			if (!v) return;
			let r = resolve(v);
			if (
				!files.has(r) &&
				node.tagName === 'LINK' &&
				!/^([a-z][a-z0-9+.-]*:)?\/\//i.test(v) &&
				!/^(data:|blob:|#|mailto:)/i.test(v)
			) {
				const alt = AuroraFix.resolveMissingRef(files, r, entryDir);
				if (alt) {
					logCmd(proj, `Entrada corrigida: "${v}" nao existe - usei "${alt}".`);
					r = alt;
				}
			}
			if (files.has(r)) {
				if (Core.extname(r) === '.css' && node.tagName === 'LINK')
					node.setAttribute('href', processCss(r));
				else node.setAttribute('href', rawUrl[r]);
			}
		});
		dom.querySelectorAll('[src],[data-aurora-src]').forEach((node) => {
			const fixed = node.getAttribute('data-aurora-src');
			const v = node.getAttribute('src') || fixed;
			if (!v) return;
			const r = fixed || resolve(v);
			if (fixed) node.removeAttribute('data-aurora-src');
			if (!files.has(r)) {
				if (
					node.tagName === 'SCRIPT' &&
					!/^([a-z]+:)?\/\//i.test(v) &&
					!v.startsWith('data:') &&
					!v.startsWith('blob:')
				)
					logErr(proj, `Script do HTML não encontrado: ${v} (resolvido: ${r})`);
				return;
			}
			if (node.tagName === 'SCRIPT') {
				const type = (node.getAttribute('type') || '').toLowerCase();
				if (type === 'module' && transform && transform.modules[r]) {
					node.setAttribute('src', transform.modules[r]);
					node.setAttribute('type', 'module');
				} else node.setAttribute('src', rawUrl[r]);
			} else node.setAttribute('src', rawUrl[r]);
		});
		dom.querySelectorAll('script').forEach((node) => {
			const t = (node.getAttribute('type') || '').toLowerCase();
			if (
				t !== 'module' ||
				node.getAttribute('src') ||
				!node.textContent ||
				!node.textContent.trim()
			)
				return;
			node.textContent = node.textContent.replace(
				/(\bfrom\s*|\bimport\s*|\bexport\s*\*\s*from\s*|\bimport\()\s*(["'])([^"']+)\2/g,
				(m, pre, q, spec) => {
					if (!(spec.startsWith('.') || spec.startsWith('/'))) return m;
					const tryBases = [];
					if (spec.startsWith('/')) {
						const rel = Core.normalizePath(spec).replace(/^\/+/, '');
						if (entryDir) tryBases.push(Core.joinPath(entryDir, rel));
						tryBases.push(rel);
					} else tryBases.push(Core.joinPath(entryDir, spec));
					const ccx = [
						'',
						'.js',
						'.jsx',
						'.ts',
						'.tsx',
						'.mjs',
						'/index.js',
						'/index.jsx',
						'/index.ts',
						'/index.tsx',
					];
					let h = null;
					for (const b of tryBases) {
						for (const e of ccx) {
							if (files.has(b + e)) {
								h = b + e;
								break;
							}
						}
						if (h) break;
					}
					if (h) {
						const u = (transform && transform.modules[h]) || rawUrl[h];
						return pre + q + u + q;
					}
					logErr(proj, 'Import do HTML não encontrado nos arquivos: ' + spec);
					return m;
				},
			);
		});
		dom.querySelectorAll('[srcset]').forEach((node) => {
			const v = node.getAttribute('srcset');
			node.setAttribute(
				'srcset',
				v.replace(/([^\s,]+)/g, (m) => {
					const r = resolve(m);
					return files.has(r) ? rawUrl[r] : m;
				}),
			);
		});
		dom.querySelectorAll('style').forEach((st) => {
			st.textContent = st.textContent.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/g, (m, q, ref) => {
				const r = resolve(ref);
				return files.has(r) ? `url(${rawUrl[r]})` : m;
			});
		});
		if (importMap || projImportMaps.length) {
			const finalMap = mergeImportMaps(importMap, projImportMaps, (msg) =>
				logCmd(proj, 'Import map: ' + msg),
			);
			const im = dom.createElement('script');
			im.setAttribute('type', 'importmap');
			im.textContent = JSON.stringify(finalMap);
			dom.head.insertBefore(im, dom.head.firstChild.nextSibling);
		}
		const shimMap = {};
		for (const p of files.keys()) shimMap['/' + p] = { u: cssCache[p] || rawUrl[p], m: mimeOf[p] };
		const srcMap = {};
		try {
			if (transform && transform.modules)
				for (const p of Object.keys(transform.modules)) srcMap[transform.modules[p]] = p;
			for (const p of Object.keys(rawUrl)) if (!srcMap[rawUrl[p]]) srcMap[rawUrl[p]] = p;
		} catch (e) {
			ignorarErro(e, 'buildPreview');
		}
		injetarPreludios(dom, {
			fontes: srcMap,
			arquivos: shimMap,
			viewport: proj.viewport,
			framework: proj.detect && proj.detect.framework,
		});
		const finalHtml = '<!DOCTYPE html>\n' + dom.documentElement.outerHTML;
		setFrame(proj, finalHtml, token);
		finishBuild(proj, token);
	} catch (err) {
		logErr(proj, 'Build: ' + err.message);
		if (proj.id === State.active) {
			hidePreviewLoading();
			setStatus('err', 'Erro ao compilar');
			showBuildCompileError(proj, err);
		}
	}
}
function finishBuild(proj, token) {
	if (token !== proj.buildToken) return;
	logCmd(proj, 'Preview montado com sucesso ✓');
	if (proj.id === State.active) {
		setStatus('ok', 'Preview atualizado');
		renderStatusbar();
	}
}
function frameSrcdoc(h) {
	try {
		el.frame.setAttribute(
			'sandbox',
			'allow-scripts allow-same-origin allow-forms allow-popups allow-pointer-lock allow-modals',
		);
	} catch (e) {
		ignorarErro(e, 'frameSrcdoc');
	}
	try {
		el.frame.setAttribute('allow', 'pointer-lock; fullscreen; gamepad; autoplay');
	} catch (e) {
		ignorarErro(e, 'frameSrcdoc');
	}
	try {
		el.frame.removeAttribute('src');
	} catch (e) {
		ignorarErro(e, 'frameSrcdoc');
	}
	el.frame.srcdoc = h;
}
function setFrame(proj, html, token) {
	if (token !== undefined && token !== proj.buildToken) return;
	proj.lastHtml = html;
	if (proj.id === State.active) {
		if (State.layout === 'editor') {
			proj.previewDirty = false;
			return;
		}
		proj.previewEverOpened = true;
		frameSrcdoc(html);
		if (proj.blocked && el.previewError && !el.previewError.classList.contains('hidden')) {
		} else {
			hidePreviewLoading();
			hidePreviewError();
			el.previewEmpty.classList.add('hidden');
			el.device.classList.remove('hidden');
		}
	}
	if (proj.channel) {
		try {
			proj.channel.postMessage({ type: 'html', html: html });
		} catch (e) {
			ignorarErro(e, 'setFrame');
		}
	}
	if (proj.popout && !proj.popout.closed) {
		try {
			proj.popout.postMessage({ __lp_popout: true, html: html }, '*');
		} catch (e) {
			ignorarErro(e, 'setFrame');
		}
	}
	try {
		headlessRefresh(proj, html);
	} catch (e) {
		ignorarErro(e, 'setFrame');
	}
}
function renderPreviewEmpty(empty) {
	try {
		AuroraFix.hideRunServerChip();
	} catch (e) {
		ignorarErro(e, 'renderPreviewEmpty');
	}
	if (empty) {
		el.device.classList.add('hidden');
		el.previewEmpty.classList.remove('hidden');
	}
}
function synthIndex(files, rawUrl) {
	let list = '';
	for (const p of [...files.keys()].sort())
		list += `<li><a href="${rawUrl[p]}" target="_blank">${esc(p)}</a></li>`;
	return `<!DOCTYPE html><meta charset="utf-8"><style>body{font-family:system-ui;background:#0b0d12;color:#e7ebf3;\
padding:30px}a{color:#6aa3ff}h1{font-size:18px}</style><h1>${files.size} arquivos (sem index.html)</h1>\
<ul>${list}</ul>`;
}

const CONSOLE_HOOK = [
	'(function(){',
	'  /* Preview gerenciado: nenhum conteudo pode armar o dialogo nativo "Sair do site?".',
	'     Assim a recompilacao (agente ou usuario) troca o documento na hora, sem confirmacao. */',
	'  try{',
	'    var _ael=window.addEventListener.bind(window);',
	'    window.addEventListener=function(t,fn,opt){if(t==="beforeunload"||t==="unload")return;return _ael(t,fn,opt);};',
	'    var _dael=document.addEventListener.bind(document);',
	'    document.addEventListener=function(t,fn,opt){if(t==="beforeunload"||t==="unload")return;return _dael(t,fn,opt);};',
	'    try{Object.defineProperty(window,"onbeforeunload",{configurable:true,get:function(){return null;},set:function(){}});}catch(_e){try{window.onbeforeunload=null;}catch(__e){}}',
	'    try{Object.defineProperty(document,"onbeforeunload",{configurable:true,get:function(){return null;},set:function(){}});}catch(_e){}',
	'  }catch(e){}',
	'  function ser(a){try{if(a instanceof Error)return a.stack||a.message;if(typeof ' +
		'a==="object")return JSON.stringify(a,function(k,v){return typeof v==="bigint"?String(v):' +
		'v;},2);return String(a);}catch(e){return String(a);}}',
	'  function send(level,args,src){try{parent.postMessage({__lp_console:true,level:level,text:Array.prototype.map.call(args,ser).join(" "),src:src||""},"*");}catch(e){}}',
	'  ["log","info","warn","error","debug"].forEach(function(m){var ' +
		'o=console[m]?console[m].bind(console):function(){};console[m]=function()' +
		'{send(m==="debug"?"log":m,arguments);o.apply(null,arguments);};});',
	'  function nm(f){try{var M=window.__LP_SRC__||{},b=String(f||"");if(!b)return "";' +
		'if(M[b])return M[b];for(var k in M){if(k===b||k.indexOf(b)>=0||b.indexOf(k)>=0)return ' +
		'M[k];}var t=b.split("/").pop();return M[t]||t;}catch(e){return String(f||"");}}',
	'  window.addEventListener("error",function(e){send("error",[(e.message||"Erro")+(e.filename?" • "+nm(e.filename)+":"+e.lineno+":"+e.colno:"")]);});',
	'  window.addEventListener("unhandledrejection",function(e){send("error",["Promise rejeitada: "+ser(e.reason)]);});',
	'  send("info",["▶ Preview iniciado "+new Date().toLocaleTimeString()]);',
	'})();',
].join('\n');
const VISION_HOOK = String.raw`(function () {
	if (window.__LP_VISION_V2__) return;
	window.__LP_VISION_V2__ = true;
	try {
		var gc = HTMLCanvasElement.prototype.getContext;
		HTMLCanvasElement.prototype.getContext = function (type, attrs) {
			if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') {
				attrs = attrs || {};
				attrs.preserveDrawingBuffer = true;
				attrs.desynchronized = false;
			}
			return gc.call(this, type, attrs);
		};
	} catch (e) {}
	var AUD = {
		log: [],
		ctxs: [],
		media: [],
		plays: 0,
		blocked: 0,
		errors: 0,
		starts: 0,
		decodes: 0,
		t0: Date.now(),
	};
	function audT() {
		return Date.now() - AUD.t0;
	}
	function audLog(type, detail) {
		AUD.log.push({ t: audT(), type: type, detail: String(detail || '').slice(0, 120) });
		if (AUD.log.length > 200) AUD.log.shift();
	}
	function audSrcName(el) {
		try {
			var sr = el.currentSrc || el.src || '';
			if (!sr) return '(sem src)';
			if (sr.indexOf('data:') === 0) return sr.slice(0, 28) + '...';
			var q = sr.split('?')[0].split('/');
			return q[q.length - 1] || sr.slice(0, 40);
		} catch (e) {
			return '?';
		}
	}
	function audTrackMedia(el) {
		if (!el || el.__aud) return;
		el.__aud = true;
		AUD.media.push(el);
		var evs = ['play', 'playing', 'pause', 'ended', 'waiting', 'stalled'];
		for (var ei = 0; ei < evs.length; ei++)
			(function (ev) {
				el.addEventListener(
					ev,
					function () {
						audLog(ev, audSrcName(el));
					},
					true,
				);
			})(evs[ei]);
		el.addEventListener(
			'error',
			function () {
				AUD.errors++;
				var ec = (el.error && el.error.code) || 0;
				audLog('media-erro', audSrcName(el) + ' code=' + ec);
			},
			true,
		);
	}
	try {
		var audPlay = HTMLMediaElement.prototype.play;
		HTMLMediaElement.prototype.play = function () {
			audTrackMedia(this);
			AUD.plays++;
			audLog('play-chamado', audSrcName(this));
			var audEl = this;
			var pr = audPlay.apply(this, arguments);
			if (pr && pr.catch)
				pr.catch(function (err) {
					var nm = (err && err.name) || '';
					if (nm === 'NotAllowedError') {
						AUD.blocked++;
						audLog('autoplay-bloqueado', audSrcName(audEl));
					} else {
						AUD.errors++;
						audLog('play-erro', audSrcName(audEl) + ' ' + nm);
					}
				});
			return pr;
		};
	} catch (e) {}
	function audWrapCtx(cname) {
		var C = window[cname];
		if (!C || C.__aud) return;
		var W = function () {
			var ctx = new (Function.prototype.bind.apply(C, [null].concat([].slice.call(arguments))))();
			try {
				var an = ctx.createAnalyser();
				an.fftSize = 2048;
				an.connect(ctx.destination);
				ctx.__audAn = an;
				AUD.ctxs.push(ctx);
				audLog('ctx-criado', cname + ' estado=' + ctx.state);
				if (ctx.state === 'suspended') ctx.__audSuspAtCreate = true;
				ctx.addEventListener('statechange', function () {
					audLog('ctx-estado', ctx.state);
				});
			} catch (e) {}
			return ctx;
		};
		W.prototype = C.prototype;
		W.__aud = true;
		try {
			Object.defineProperty(W, 'name', { value: cname });
		} catch (e) {}
		window[cname] = W;
	}
	try {
		audWrapCtx('AudioContext');
		audWrapCtx('webkitAudioContext');
		if (window.AudioNode) {
			var audConn = AudioNode.prototype.connect;
			AudioNode.prototype.connect = function (dst) {
				try {
					var actx = this.context;
					if (actx && actx.__audAn && dst === actx.destination && this !== actx.__audAn)
						audConn.call(this, actx.__audAn);
				} catch (e) {}
				return audConn.apply(this, arguments);
			};
		}
	} catch (e) {}
	try {
		if (window.AudioScheduledSourceNode && AudioScheduledSourceNode.prototype.start) {
			var audStart = AudioScheduledSourceNode.prototype.start;
			AudioScheduledSourceNode.prototype.start = function () {
				AUD.starts++;
				if (AUD.starts <= 30 || AUD.starts % 100 === 0)
					audLog('fonte-start', (this.constructor && this.constructor.name) || 'fonte');
				return audStart.apply(this, arguments);
			};
		}
	} catch (e) {}
	try {
		if (window.BaseAudioContext && BaseAudioContext.prototype.decodeAudioData) {
			var audDec = BaseAudioContext.prototype.decodeAudioData;
			BaseAudioContext.prototype.decodeAudioData = function () {
				var dp = audDec.apply(this, arguments);
				if (dp && dp.then)
					dp.then(
						function (buf) {
							AUD.decodes++;
							audLog('decode', (buf && buf.duration ? buf.duration.toFixed(2) : '?') + 's');
						},
						function () {
							AUD.errors++;
							audLog('decode-erro', '');
						},
					);
				return dp;
			};
		}
	} catch (e) {}
	try {
		var audMo = new MutationObserver(function (ms) {
			for (var mi = 0; mi < ms.length; mi++) {
				var ad = ms[mi].addedNodes;
				for (var mj = 0; mj < ad.length; mj++) {
					var nd = ad[mj];
					if (!nd) continue;
					if (nd.tagName === 'AUDIO' || nd.tagName === 'VIDEO') audTrackMedia(nd);
					if (nd.querySelectorAll) {
						var ml = nd.querySelectorAll('audio,video');
						for (var mk = 0; mk < ml.length; mk++) audTrackMedia(ml[mk]);
					}
				}
			}
		});
		audMo.observe(document.documentElement, { childList: true, subtree: true });
	} catch (e) {}
	function reply(id, ok, extra) {
		var m = { __lp_vision_result: true, id: id, ok: !!ok };
		if (extra) for (var k in extra) m[k] = extra[k];
		try {
			parent.postMessage(m, '*');
		} catch (e) {}
	}
	function announce(loaded) {
		try {
			parent.postMessage(
				{
					__lp_vision_ready: true,
					v: 2,
					loaded: !!loaded,
					w: window.innerWidth,
					h: window.innerHeight,
				},
				'*',
			);
		} catch (e) {}
	}
	function ser(v) {
		try {
			if (v === undefined) return 'undefined';
			if (typeof v === 'string') return v;
			var seen = [];
			return JSON.stringify(
				v,
				function (k, val) {
					if (typeof val === 'bigint') return String(val);
					if (typeof val === 'function') return '[funcao]';
					if (val && typeof val === 'object') {
						if (seen.indexOf(val) >= 0) return '[circular]';
						seen.push(val);
					}
					return val;
				},
				2,
			).slice(0, 20000);
		} catch (e) {
			return String(v);
		}
	}
	function findEl(sel) {
		var el = document.querySelector(sel);
		if (!el) throw new Error('Seletor nao encontrou nada: ' + sel);
		return el;
	}
	function center(el) {
		var r = el.getBoundingClientRect();
		return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
	}
	function elAt(x, y) {
		return document.elementFromPoint(x, y) || document.body;
	}
	var HELD = {};
	function fire(el, type, x, y, extra) {
		var Ev =
			type.indexOf('pointer') === 0 && window.PointerEvent
				? window.PointerEvent
				: window.MouseEvent;
		var o = {
			bubbles: true,
			cancelable: true,
			composed: true,
			view: window,
			clientX: x,
			clientY: y,
			button: 0,
			buttons: type === 'pointerdown' || type === 'mousedown' ? 1 : 0,
		};
		if (extra)
			for (var k in extra) {
				if (k === 'movementX' || k === 'movementY') continue;
				o[k] = extra[k];
			}
		var e = new Ev(type, o);
		if (extra && (extra.movementX != null || extra.movementY != null)) {
			try {
				Object.defineProperty(e, 'movementX', {
					get: function () {
						return Number(extra.movementX) || 0;
					},
				});
				Object.defineProperty(e, 'movementY', {
					get: function () {
						return Number(extra.movementY) || 0;
					},
				});
			} catch (ex) {}
		}
		el.dispatchEvent(e);
	}
	function doClick(el, x, y, dbl) {
		fire(el, 'pointerdown', x, y);
		fire(el, 'mousedown', x, y);
		fire(el, 'pointerup', x, y);
		fire(el, 'mouseup', x, y);
		fire(el, 'click', x, y);
		if (dbl) fire(el, 'dblclick', x, y, { detail: 2 });
	}
	var KC = {
		ArrowLeft: 37,
		ArrowUp: 38,
		ArrowRight: 39,
		ArrowDown: 40,
		Enter: 13,
		Escape: 27,
		Shift: 16,
		Tab: 9,
		Backspace: 8,
		Control: 17,
		Alt: 18,
		Delete: 46,
		Home: 36,
		End: 35,
		PageUp: 33,
		PageDown: 34,
	};
	function kcFor(k) {
		if (k === ' ') return 32;
		if (KC[k] != null) return KC[k];
		if (k.length === 1) return k.toUpperCase().charCodeAt(0);
		return 0;
	}
	function codeFor(k) {
		if (k === ' ') return 'Space';
		if (k.length === 1) {
			var u = k.toUpperCase();
			if (u >= 'A' && u <= 'Z') return 'Key' + u;
			if (k >= '0' && k <= '9') return 'Digit' + k;
		}
		return k;
	}
	function keyEv(t, type, key, mods) {
		var kc = kcFor(key);
		var e = new KeyboardEvent(type, {
			bubbles: true,
			cancelable: true,
			composed: true,
			key: key,
			code: codeFor(key),
			ctrlKey: !!(mods && mods.ctrl),
			shiftKey: !!(mods && mods.shift),
			altKey: !!(mods && mods.alt),
		});
		try {
			Object.defineProperty(e, 'keyCode', {
				get: function () {
					return kc;
				},
			});
			Object.defineProperty(e, 'which', {
				get: function () {
					return kc;
				},
			});
		} catch (ex) {}
		t.dispatchEvent(e);
	}
	function setValue(el, text) {
		try {
			if (el.isContentEditable) {
				el.textContent = text;
			} else {
				var proto =
					window.HTMLTextAreaElement && el instanceof HTMLTextAreaElement
						? HTMLTextAreaElement.prototype
						: window.HTMLInputElement && el instanceof HTMLInputElement
							? HTMLInputElement.prototype
							: null;
				if (proto) {
					var d = Object.getOwnPropertyDescriptor(proto, 'value');
					if (d && d.set) d.set.call(el, text);
					else el.value = text;
				} else el.value = text;
			}
		} catch (e) {
			try {
				el.value = text;
			} catch (e2) {}
		}
		el.dispatchEvent(new Event('input', { bubbles: true }));
		el.dispatchEvent(new Event('change', { bubbles: true }));
	}
	function visText(root, max) {
		var out = [];
		var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
		var n,
			len = 0;
		while ((n = w.nextNode())) {
			var t = (n.nodeValue || '').replace(/\s+/g, ' ').trim();
			if (!t) continue;
			var p = n.parentElement;
			if (p) {
				var tag = p.tagName;
				if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') continue;
				var st;
				try {
					st = getComputedStyle(p);
				} catch (e) {
					st = null;
				}
				if (st && (st.display === 'none' || st.visibility === 'hidden')) continue;
			}
			out.push(t);
			len += t.length + 1;
			if (len > max) break;
		}
		return out.join(' ').slice(0, max);
	}
	function scaleDims(w, h, maxW) {
		maxW = maxW || 1024;
		if (w <= maxW) return [Math.max(1, Math.round(w)), Math.max(1, Math.round(h))];
		return [maxW, Math.max(1, Math.round((h * maxW) / w))];
	}
	function bgColor() {
		try {
			var b = getComputedStyle(document.body).backgroundColor;
			if (b && b !== 'rgba(0, 0, 0, 0)' && b !== 'transparent') return b;
		} catch (e) {}
		return '#ffffff';
	}
	function pickCanvas(sel) {
		if (sel) {
			try {
				var el = document.querySelector(sel);
				if (el && el.tagName === 'CANVAS') return el;
			} catch (e) {}
			return null;
		}
		var best = null,
			ba = 0,
			cs = document.querySelectorAll('canvas');
		for (var i = 0; i < cs.length; i++) {
			var r = cs[i].getBoundingClientRect();
			var a = r.width * r.height;
			if (a > ba) {
				ba = a;
				best = cs[i];
			}
		}
		var vp = Math.max(1, window.innerWidth * window.innerHeight);
		if (best && ba / vp >= 0.35) return best;
		return null;
	}
	function viewport(a) {
		var w = Math.max(
			window.innerWidth || 0,
			document.documentElement.clientWidth || 0,
			(window.visualViewport && window.visualViewport.width) || 0,
		);
		var h = Math.max(
			window.innerHeight || 0,
			document.documentElement.clientHeight || 0,
			(window.visualViewport && window.visualViewport.height) || 0,
		);
		var hw = Number(a && a.__vw) || 0,
			hh = Number(a && a.__vh) || 0;
		if (hw > 40 && (w < 160 || w < hw * 0.5)) w = hw;
		if (hh > 40 && (h < 120 || h < hh * 0.5)) h = hh;
		return [Math.max(1, Math.round(w)), Math.max(1, Math.round(h))];
	}
	function isUniform(ctx, w, h) {
		try {
			var d = ctx.getImageData(0, 0, w, h).data;
			var first = null;
			var G = 20;
			for (var gy = 0; gy < G; gy++) {
				for (var gx = 0; gx < G; gx++) {
					var x = Math.min(w - 1, Math.floor(((gx + 0.5) * w) / G));
					var y = Math.min(h - 1, Math.floor(((gy + 0.5) * h) / G));
					var i = (y * w + x) * 4;
					var v = d[i] + ',' + d[i + 1] + ',' + d[i + 2];
					if (first === null) first = v;
					else if (v !== first) return false;
				}
			}
			return true;
		} catch (e) {
			return false;
		}
	}
	function shotFromCanvas(cv, fmt, q, maxW) {
		if (!cv || !cv.width || !cv.height || cv.width < 8 || cv.height < 8) return null;
		var d = scaleDims(cv.width, cv.height, maxW);
		var t = document.createElement('canvas');
		t.width = d[0];
		t.height = d[1];
		var ctx = t.getContext('2d');
		ctx.fillStyle = bgColor();
		ctx.fillRect(0, 0, d[0], d[1]);
		try {
			ctx.drawImage(cv, 0, 0, d[0], d[1]);
		} catch (e) {
			return null;
		}
		return { du: t.toDataURL(fmt, q), blank: isUniform(ctx, d[0], d[1]) };
	}
	function inlineImages(root, done) {
		var imgs = root.querySelectorAll('img');
		var pend = 1;
		function one() {
			pend--;
			if (pend === 0) done();
		}
		for (var i = 0; i < imgs.length; i++) {
			(function (img) {
				var src = img.getAttribute('src') || '';
				if (!src || src.indexOf('data:') === 0) return;
				pend++;
				try {
					fetch(img.src)
						.then(function (r) {
							return r.blob();
						})
						.then(function (b) {
							return new Promise(function (res) {
								var fr = new FileReader();
								fr.onload = function () {
									res(fr.result);
								};
								fr.onerror = function () {
									res(null);
								};
								fr.readAsDataURL(b);
							});
						})
						.then(function (du) {
							if (du) img.setAttribute('src', du);
							one();
						})
						.catch(one);
				} catch (e) {
					one();
				}
			})(imgs[i]);
		}
		one();
	}
	function snapCanvases(cb, tries) {
		var cs = document.querySelectorAll('canvas');
		var out = [],
			ruins = 0;
		for (var i = 0; i < cs.length; i++) {
			var r = null;
			try {
				r = shotFromCanvas(cs[i], 'image/png', 0.92, 2048);
			} catch (e) {
				r = null;
			}
			out.push(r ? r.du : null);
			if (!r || r.blank) ruins++;
		}
		if (ruins > 0 && (tries || 0) < 3) {
			nextFrame(function () {
				snapCanvases(cb, (tries || 0) + 1);
			});
			return;
		}
		cb(out, ruins, cs.length);
	}
	function domShot(fmt, q, maxW, W, H, cb, fail, snaps) {
		var clone = document.documentElement.cloneNode(true);
		var sc = clone.querySelectorAll('script');
		for (var i = 0; i < sc.length; i++) if (sc[i].parentNode) sc[i].parentNode.removeChild(sc[i]);
		var liveCv = document.querySelectorAll('canvas'),
			cloneCv = clone.querySelectorAll('canvas');
		for (var c = 0; c < cloneCv.length && c < liveCv.length; c++) {
			try {
				var r2 = liveCv[c].getBoundingClientRect();
				var du0 = snaps && snaps[c] ? snaps[c] : liveCv[c].toDataURL('image/png');
				var im = document.createElement('img');
				im.setAttribute('src', du0);
				im.setAttribute(
					'style',
					'width:' + Math.round(r2.width) + 'px;height:' + Math.round(r2.height) + 'px;',
				);
				if (cloneCv[c].parentNode) cloneCv[c].parentNode.replaceChild(im, cloneCv[c]);
			} catch (e) {}
		}
		var css = '';
		try {
			for (var s = 0; s < document.styleSheets.length; s++) {
				try {
					var rules = document.styleSheets[s].cssRules;
					if (!rules) continue;
					for (var r3 = 0; r3 < rules.length; r3++) css += rules[r3].cssText + '\n';
				} catch (e) {}
			}
		} catch (e) {}
		var head = clone.querySelector('head') || clone;
		var lk = clone.querySelectorAll('link');
		for (var l = 0; l < lk.length; l++) if (lk[l].parentNode) lk[l].parentNode.removeChild(lk[l]);
		var st = document.createElement('style');
		st.textContent = css;
		head.appendChild(st);
		inlineImages(clone, function () {
			var xml;
			try {
				xml = new XMLSerializer().serializeToString(clone);
			} catch (e) {
				fail('Falha ao serializar o DOM: ' + ((e && e.message) || e));
				return;
			}
			var svg =
				'<svg xmlns="http://www.w3.org/2000/svg" width="' +
				W +
				'" height="' +
				H +
				'"><foreignObject width="100%" height="100%">' +
				xml +
				'</foreignObject></svg>';
			var img = new Image();
			img.onload = function () {
				try {
					var d = scaleDims(W, H, maxW);
					var t = document.createElement('canvas');
					t.width = d[0];
					t.height = d[1];
					var ctx = t.getContext('2d');
					ctx.fillStyle = bgColor();
					ctx.fillRect(0, 0, d[0], d[1]);
					ctx.drawImage(img, 0, 0, d[0], d[1]);
					cb(t.toDataURL(fmt, q));
				} catch (e) {
					fail('Canvas bloqueado ao rasterizar o DOM: ' + ((e && e.message) || e));
				}
			};
			img.onerror = function () {
				fail(
					'Falha ao rasterizar o DOM (SVG nao carregou). Tente novamente com mode="canvas" ou use query_dom.',
				);
			};
			img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
		});
	}
	function cropTo(du, rect, fullW, fmt, q, maxW, cb, fail) {
		var img = new Image();
		img.onload = function () {
			try {
				var scale = img.width / Math.max(1, fullW);
				var sx = Math.max(0, rect.left * scale),
					sy = Math.max(0, rect.top * scale),
					sw = Math.max(1, rect.width * scale),
					sh = Math.max(1, rect.height * scale);
				sw = Math.min(sw, img.width - sx);
				sh = Math.min(sh, img.height - sy);
				var d = scaleDims(sw, sh, maxW);
				var t = document.createElement('canvas');
				t.width = d[0];
				t.height = d[1];
				var ctx = t.getContext('2d');
				ctx.drawImage(img, sx, sy, sw, sh, 0, 0, d[0], d[1]);
				cb(t.toDataURL(fmt, q));
			} catch (e) {
				fail('Falha ao recortar o elemento: ' + ((e && e.message) || e));
			}
		};
		img.onerror = function () {
			fail('Falha ao decodificar o screenshot para recorte.');
		};
		img.src = du;
	}
	function nextFrame(cb) {
		var done = false;
		function f() {
			if (done) return;
			done = true;
			cb();
		}
		try {
			requestAnimationFrame(f);
		} catch (e) {}
		setTimeout(f, 120);
	}
	function capture(a, done, fail) {
		var fmt = a.format === 'png' ? 'image/png' : 'image/jpeg';
		var q = Math.min(1, Math.max(0.3, Number(a.quality) || 0.85));
		var maxW = Math.min(2048, Math.max(160, Number(a.max_width) || 1024));
		var vp = viewport(a);
		var modo = String(a.mode || '').toLowerCase();
		if (modo === 'canvas' || modo === 'so-canvas') modo = 'canvas';
		else modo = 'completo';
		var cropEl = null,
			cv = null;
		if (a.selector) {
			var el0 = document.querySelector(a.selector);
			if (!el0) return fail('Seletor nao encontrou nada: ' + a.selector);
			if (el0.tagName === 'CANVAS') cv = el0;
			else cropEl = el0;
		} else if (modo === 'canvas') cv = pickCanvas(null);
		var tries = 0;
		function viaDom(warn, snaps) {
			var sx = window.scrollX || window.pageXOffset || 0,
				sy = window.scrollY || window.pageYOffset || 0;
			var W = vp[0],
				H = vp[1],
				crop = null;
			if (cropEl) {
				var r = cropEl.getBoundingClientRect();
				if (r.width < 2 || r.height < 2)
					return fail('O elemento existe mas esta invisivel/sem area: ' + a.selector);
				crop = { left: r.left + sx, top: r.top + sy, width: r.width, height: r.height };
				W = Math.min(6000, Math.max(W, Math.ceil(crop.left + crop.width)));
				H = Math.min(6000, Math.max(H, Math.ceil(crop.top + crop.height)));
			} else if (sx > 1 || sy > 1) {
				W = Math.min(6000, Math.ceil(sx + vp[0]));
				H = Math.min(6000, Math.ceil(sy + vp[1]));
				crop = { left: sx, top: sy, width: vp[0], height: vp[1] };
			}
			domShot(
				fmt,
				q,
				crop ? 2048 : maxW,
				W,
				H,
				function (du) {
					if (crop)
						cropTo(
							du,
							crop,
							W,
							fmt,
							q,
							maxW,
							function (cdu) {
								done(cdu, cropEl ? 'crop' : 'preview-inteiro', warn, vp);
							},
							fail,
						);
					else done(du, cv ? 'dom-fallback' : 'preview-inteiro', warn, vp);
				},
				function (msg) {
					var cvx = cv || pickCanvas(null);
					if (cvx) {
						var rr = shotFromCanvas(cvx, fmt, q, maxW);
						if (rr)
							return done(
								rr.du,
								'canvas',
								(warn ? warn + ' | ' : '') +
									'nao consegui rasterizar o preview inteiro (' +
									msg +
									'); enviei so o canvas',
								vp,
							);
					}
					fail(msg);
				},
				snaps,
			);
		}
		function viaCanvas() {
			var r = shotFromCanvas(cv, fmt, q, maxW);
			if (r && !r.blank) return done(r.du, 'canvas', null, vp);
			if (tries < 8) {
				tries++;
				nextFrame(viaCanvas);
				return;
			}
			viaDom(
				r
					? 'o canvas retornou frame uniforme (jogo parado, OffscreenCanvas/worker ou WebGPU); usei o preview inteiro como fallback'
					: 'nao consegui ler o canvas; usei o preview inteiro como fallback',
			);
		}
		if (cv && !cropEl && modo === 'canvas') return nextFrame(viaCanvas);
		if (cv && a.selector) return nextFrame(viaCanvas);
		nextFrame(function () {
			snapCanvases(function (snaps, ruins, tot) {
				var w = null;
				if (tot && ruins)
					w =
						ruins +
						' de ' +
						tot +
						' canvas nao devolveram imagem (WebGL sem preserveDrawingBuffer, OffscreenCanvas ou WebGPU); o resto do preview esta correto - use mode="canvas" para capturar so o canvas';
				viaDom(w, snaps);
			});
		});
	}
	var PL = { el: null, installed: false, origReq: null, origExit: null, origGet: null };
	function plInstall() {
		if (PL.installed) return;
		PL.installed = true;
		try {
			PL.origReq = Element.prototype.requestPointerLock;
			PL.origExit = Document.prototype.exitPointerLock;
			var pld = Object.getOwnPropertyDescriptor(Document.prototype, 'pointerLockElement');
			PL.origGet = pld && pld.get;
			Element.prototype.requestPointerLock = function () {
				PL.el = this;
				try {
					if (PL.origReq) PL.origReq.apply(this, arguments);
				} catch (e) {}
				setTimeout(function () {
					try {
						document.dispatchEvent(new Event('pointerlockchange'));
					} catch (e) {}
				}, 0);
			};
			Document.prototype.exitPointerLock = function () {
				PL.el = null;
				try {
					if (PL.origExit) PL.origExit.apply(this, arguments);
				} catch (e) {}
				setTimeout(function () {
					try {
						document.dispatchEvent(new Event('pointerlockchange'));
					} catch (e) {}
				}, 0);
			};
			Object.defineProperty(Document.prototype, 'pointerLockElement', {
				configurable: true,
				get: function () {
					var rr = null;
					try {
						rr = PL.origGet ? PL.origGet.call(this) : null;
					} catch (e) {}
					return rr || PL.el;
				},
			});
		} catch (e) {}
	}
	plInstall();
	function mkTouches(el2, arr) {
		var out = [];
		for (var ti = 0; ti < arr.length; ti++) {
			try {
				out.push(
					new Touch({
						identifier: arr[ti].id || ti + 1,
						target: el2,
						clientX: arr[ti].x,
						clientY: arr[ti].y,
						pageX: arr[ti].x,
						pageY: arr[ti].y,
						screenX: arr[ti].x,
						screenY: arr[ti].y,
						radiusX: 12,
						radiusY: 12,
						force: 1,
					}),
				);
			} catch (e) {}
		}
		return out;
	}
	function touchEv(el2, type, allArr, chgArr) {
		try {
			var tl = mkTouches(el2, allArr);
			var cl = mkTouches(el2, chgArr || allArr);
			var tev = new TouchEvent(type, {
				bubbles: true,
				cancelable: true,
				composed: true,
				view: window,
				touches: tl,
				targetTouches: tl,
				changedTouches: cl,
			});
			el2.dispatchEvent(tev);
			return true;
		} catch (e) {
			return false;
		}
	}
	var NET = { log: [], max: 250, depth: 0, t0: performance.now() };
	function netAdd(e) {
		NET.log.push(e);
		if (NET.log.length > NET.max) NET.log.shift();
		return e;
	}
	function netSkip(u) {
		u = String(u || '');
		return u.indexOf('blob:') === 0 || u.indexOf('data:') === 0;
	}
	function netWrapFetch() {
		var f = window.fetch;
		if (!f || f.__lpNet) return;
		var w = function (input, init) {
			var e = null;
			if (NET.depth === 0) {
				var u = typeof input === 'string' ? input : (input && input.url) || '';
				if (!netSkip(u)) {
					var m = (init && init.method) || (input && input.method) || 'GET';
					e = netAdd({
						k: 'fetch',
						m: String(m).toUpperCase(),
						u: String(u),
						t: Math.round(performance.now() - NET.t0),
						st: null,
						ok: null,
						ms: null,
						err: null,
						done: false,
					});
				}
			}
			NET.depth++;
			var p;
			try {
				p = f.apply(this, arguments);
			} catch (ex) {
				NET.depth--;
				if (e) {
					e.done = true;
					e.err = String((ex && ex.message) || ex);
				}
				throw ex;
			}
			NET.depth--;
			if (e && p && p.then) {
				var st = performance.now();
				p.then(
					function (r) {
						e.done = true;
						e.st = r.status;
						e.ok = !!r.ok;
						e.ms = Math.round(performance.now() - st);
					},
					function (ex) {
						e.done = true;
						e.err = String((ex && ex.message) || ex);
						e.ms = Math.round(performance.now() - st);
					},
				);
			}
			return p;
		};
		w.__lpNet = 1;
		window.fetch = w;
	}
	netWrapFetch();
	document.addEventListener('DOMContentLoaded', function () {
		try {
			netWrapFetch();
		} catch (e) {}
	});
	try {
		var NXO = XMLHttpRequest.prototype.open,
			NXS = XMLHttpRequest.prototype.send;
		XMLHttpRequest.prototype.open = function (m, u) {
			this.__lpN = { m: String(m || 'GET').toUpperCase(), u: String(u || '') };
			return NXO.apply(this, arguments);
		};
		XMLHttpRequest.prototype.send = function () {
			var i = this.__lpN;
			if (i && !netSkip(i.u)) {
				var e = netAdd({
					k: 'xhr',
					m: i.m,
					u: i.u,
					t: Math.round(performance.now() - NET.t0),
					st: null,
					ok: null,
					ms: null,
					err: null,
					done: false,
				});
				var st = performance.now();
				this.addEventListener('loadend', function () {
					e.done = true;
					e.st = this.status;
					e.ok = this.status >= 200 && this.status < 400;
					e.ms = Math.round(performance.now() - st);
					if (!this.status) e.err = 'falhou (status 0 - rede/CORS/abort)';
				});
			}
			return NXS.apply(this, arguments);
		};
	} catch (e) {}
	window.addEventListener(
		'error',
		function (ev) {
			var t = ev && ev.target;
			if (!t || !t.tagName) return;
			var tag = t.tagName.toLowerCase();
			if (
				tag === 'img' ||
				tag === 'script' ||
				tag === 'link' ||
				tag === 'audio' ||
				tag === 'video' ||
				tag === 'source'
			) {
				var u = t.src || t.href || '';
				if (netSkip(u)) return;
				netAdd({
					k: 'recurso',
					m: 'GET',
					u: String(u),
					t: Math.round(performance.now() - NET.t0),
					st: null,
					ok: false,
					ms: null,
					err: 'recurso <' + tag + '> falhou ao carregar',
					done: true,
				});
			}
		},
		true,
	);
	var VP = { cfg: null, ds: {} };
	function vpDef(obj, key, val, tag) {
		try {
			if (!(tag in VP.ds))
				VP.ds[tag] = { obj: obj, key: key, d: Object.getOwnPropertyDescriptor(obj, key) || null };
			Object.defineProperty(obj, key, {
				configurable: true,
				get: function () {
					return typeof val === 'function' ? val() : val;
				},
			});
		} catch (e) {}
	}
	function vpReset() {
		for (var vk in VP.ds) {
			var ve = VP.ds[vk];
			try {
				if (ve.d) Object.defineProperty(ve.obj, ve.key, ve.d);
				else delete ve.obj[ve.key];
			} catch (e) {}
		}
		VP.ds = {};
		VP.cfg = null;
		window.__lpVP = null;
		try {
			window.dispatchEvent(new Event('resize'));
		} catch (e) {}
	}
	function vpApply(cfg) {
		if (!cfg) {
			vpReset();
			return;
		}
		var W2 = Number(cfg.w) || window.innerWidth,
			H2 = Number(cfg.h) || window.innerHeight;
		if (cfg.dpr) vpDef(window, 'devicePixelRatio', Number(cfg.dpr), 'dpr');
		vpDef(navigator, 'maxTouchPoints', Number(cfg.touch) || 0, 'mtp');
		vpDef(screen, 'width', W2, 'sw');
		vpDef(screen, 'height', H2, 'sh');
		vpDef(screen, 'availWidth', W2, 'saw');
		vpDef(screen, 'availHeight', H2, 'sah');
		try {
			if (screen.orientation)
				vpDef(
					screen.orientation,
					'type',
					function () {
						return W2 >= H2 ? 'landscape-primary' : 'portrait-primary';
					},
					'ori',
				);
		} catch (e) {}
		VP.cfg = cfg;
		window.__lpVP = cfg;
		try {
			window.dispatchEvent(new Event('resize'));
		} catch (e) {}
		try {
			window.dispatchEvent(new Event('orientationchange'));
		} catch (e) {}
	}
	try {
		if (window.__lpVP) vpApply(window.__lpVP);
	} catch (e) {}
	var GP = { pads: {}, installed: false };
	function gpPad(i) {
		var p = GP.pads[i];
		if (!p) {
			p = {
				index: i,
				id: 'Synapse Virtual Gamepad (STANDARD GAMEPAD)',
				connected: true,
				mapping: 'standard',
				timestamp: 0,
				axes: [0, 0, 0, 0],
				buttons: [],
			};
			for (var b = 0; b < 17; b++) p.buttons.push({ pressed: false, touched: false, value: 0 });
			GP.pads[i] = p;
		}
		return p;
	}
	function gpInstall() {
		if (GP.installed) return;
		GP.installed = true;
		var orig = null;
		try {
			orig = navigator.getGamepads ? navigator.getGamepads.bind(navigator) : null;
		} catch (e) {}
		try {
			Object.defineProperty(navigator, 'getGamepads', {
				configurable: true,
				value: function () {
					var out = [];
					try {
						if (orig) {
							var o = orig() || [];
							for (var i = 0; i < o.length; i++) out.push(o[i]);
						}
					} catch (e) {}
					for (var k in GP.pads) {
						var idx = Number(k);
						while (out.length <= idx) out.push(null);
						out[idx] = GP.pads[k];
					}
					return out;
				},
			});
		} catch (e) {}
	}
	function gpConnect(p) {
		try {
			var ev = new Event('gamepadconnected');
			Object.defineProperty(ev, 'gamepad', { value: p });
			window.dispatchEvent(ev);
		} catch (e) {}
	}
	window.addEventListener('message', function (ev) {
		var d = ev.data;
		if (!d || !d.__lp_vision) return;
		var id = d.id;
		var a = d.args || {};
		try {
			if (d.action === 'ping') {
				reply(id, true, { v: 2, w: window.innerWidth, h: window.innerHeight });
				return;
			}
			if (d.action === 'screenshot') {
				capture(
					a,
					function (du, mode, warn, vp) {
						reply(id, true, { dataUrl: du, w: vp[0], h: vp[1], mode: mode, warn: warn || null });
					},
					function (msg) {
						reply(id, false, { error: msg });
					},
				);
				return;
			}
			if (d.action === 'frames') {
				var nf = Math.min(8, Math.max(2, Number(a.frames) || 4));
				var ivf = Math.min(2000, Math.max(50, Number(a.interval_ms) || 250));
				var fa = {
					selector: a.selector,
					mode: a.mode || 'canvas',
					format: 'jpeg',
					quality: 0.75,
					max_width: Math.min(1024, Math.max(160, Number(a.max_width) || 640)),
					__vw: a.__vw,
					__vh: a.__vh,
				};
				var acc = [];
				var lastMode = '';
				var lastVp = [0, 0];
				(function grab() {
					capture(
						fa,
						function (du, mode, warn, vp) {
							acc.push(du);
							lastMode = mode;
							lastVp = vp;
							if (acc.length >= nf) {
								var same =
									acc.length > 1 &&
									acc.every(function (x) {
										return x === acc[0];
									});
								reply(id, true, {
									frames: acc,
									mode: lastMode,
									interval: ivf,
									w: lastVp[0],
									h: lastVp[1],
									warn: same
										? 'todos os frames sao identicos (animacao parada, jogo pausado ou requestAnimationFrame suspenso)'
										: null,
								});
								return;
							}
							setTimeout(grab, ivf);
						},
						function (msg) {
							if (acc.length)
								reply(id, true, {
									frames: acc,
									mode: lastMode,
									interval: ivf,
									w: lastVp[0],
									h: lastVp[1],
									warn: 'captura interrompida: ' + msg,
								});
							else reply(id, false, { error: msg });
						},
					);
				})();
				return;
			}
			if (d.action === 'audio') {
				var adur = Math.min(3000, Math.max(100, Number(a.duration_ms) || 400));
				var arms = [];
				var apeak = 0;
				var an0 = Date.now();
				var atick = function () {
					for (var ai = 0; ai < AUD.ctxs.length; ai++) {
						var actx2 = AUD.ctxs[ai];
						var aan = actx2.__audAn;
						if (!aan || !aan.getFloatTimeDomainData) continue;
						try {
							var abuf = new Float32Array(aan.fftSize);
							aan.getFloatTimeDomainData(abuf);
							var asq = 0;
							for (var aj = 0; aj < abuf.length; aj++) {
								var av = abuf[aj];
								asq += av * av;
								var aab = av < 0 ? -av : av;
								if (aab > apeak) apeak = aab;
							}
							var armsv = Math.sqrt(asq / abuf.length);
							if (!arms[ai] || armsv > arms[ai]) arms[ai] = armsv;
						} catch (e) {}
					}
					if (Date.now() - an0 < adur) setTimeout(atick, 50);
					else afin();
				};
				var afin = function () {
					var actxs = [];
					for (var ac = 0; ac < AUD.ctxs.length; ac++) {
						var c3 = AUD.ctxs[ac];
						actxs.push({
							state: c3.state,
							sr: c3.sampleRate,
							clock: Math.round(c3.currentTime * 100) / 100,
							suspCreate: !!c3.__audSuspAtCreate,
							rms: Math.round((arms[ac] || 0) * 1000) / 1000,
						});
					}
					var ameds = [];
					for (var am = 0; am < AUD.media.length && am < 20; am++) {
						var el3 = AUD.media[am];
						ameds.push({
							src: audSrcName(el3),
							tag: (el3.tagName || 'audio').toLowerCase(),
							paused: el3.paused,
							muted: el3.muted,
							volume: Math.round(el3.volume * 100) / 100,
							time: Math.round((el3.currentTime || 0) * 10) / 10,
							dur: isFinite(el3.duration) ? Math.round(el3.duration * 10) / 10 : null,
							loop: el3.loop,
							err: el3.error ? el3.error.code : null,
						});
					}
					var alog = [];
					var anl = Math.min(Math.max(1, Number(a.max_log) || 25), 60);
					for (var al = Math.max(0, AUD.log.length - anl); al < AUD.log.length; al++)
						alog.push(AUD.log[al]);
					reply(id, true, {
						dur: adur,
						ctxs: actxs,
						media: ameds,
						plays: AUD.plays,
						blocked: AUD.blocked,
						errors: AUD.errors,
						starts: AUD.starts,
						decodes: AUD.decodes,
						peak: Math.round(apeak * 1000) / 1000,
						log: alog,
						logTotal: AUD.log.length,
					});
				};
				atick();
				return;
			}
			if (d.action === 'viewport') {
				vpApply(a && a.cfg ? a.cfg : null);
				reply(id, true, {
					iw: window.innerWidth,
					ih: window.innerHeight,
					dpr: window.devicePixelRatio,
					touch: navigator.maxTouchPoints,
					ori: (screen.orientation && screen.orientation.type) || '',
				});
				return;
			}
			if (d.action === 'network') {
				if (a && a.clear) {
					NET.log = [];
					try {
						performance.clearResourceTimings();
					} catch (e) {}
					reply(id, true, { text: 'Registro de rede limpo.', total: 0, errors: 0, pending: 0 });
					return;
				}
				var nlim = Math.min(100, Math.max(1, (a && a.limit) || 40));
				var nonly = !!(a && a.only_errors);
				var nbad = function (e) {
					return !!(e.err || (e.st && e.st >= 400) || (e.done && e.ok === false));
				};
				var nlist = NET.log.filter(function (e) {
					return nonly ? nbad(e) || !e.done : true;
				});
				var ntot = NET.log.length,
					nerr = NET.log.filter(nbad).length,
					npend = NET.log.filter(function (e) {
						return !e.done;
					}).length;
				var nrows = nlist.slice(-nlim).map(function (e) {
					var ln =
						'+' +
						(e.t / 1000).toFixed(1) +
						's ' +
						e.k +
						' ' +
						e.m +
						' ' +
						(e.u.length > 110 ? e.u.slice(0, 110) + '...' : e.u);
					if (!e.done) return ln + ' -> PENDENTE (nao terminou)';
					if (e.err) return ln + ' -> ERRO: ' + e.err;
					return (
						ln +
						' -> ' +
						(e.st != null ? e.st : '?') +
						(e.ok ? ' ok' : ' FALHA') +
						(e.ms != null ? ' ' + e.ms + 'ms' : '')
					);
				});
				var nhead =
					'Rede do preview: ' +
					ntot +
					' requisicoes registradas | ' +
					nerr +
					' com erro | ' +
					npend +
					' pendentes' +
					(nonly ? ' (mostrando so problemas)' : '') +
					'\n';
				reply(id, true, {
					text:
						nhead +
						(nrows.length
							? nrows.join('\n')
							: nonly
								? 'Nenhum problema de rede registrado.'
								: 'Nenhuma requisicao registrada ainda.'),
					total: ntot,
					errors: nerr,
					pending: npend,
				});
				return;
			}
			if (d.action === 'reset') {
				(async function () {
					var keep = (a && a.keep_prefixes) || [];
					var keepDb = (a && a.keep_dbs) || [];
					var rr = { ls: 0, ss: 0, idb: 0, caches: 0, cookies: 0, avisos: [] };
					function keepK(k) {
						for (var i2 = 0; i2 < keep.length; i2++) {
							if (String(k).indexOf(keep[i2]) === 0) return true;
						}
						return false;
					}
					function tempo(p, ms, rotulo) {
						return Promise.race([
							Promise.resolve(p),
							new Promise(function (res) {
								setTimeout(function () {
									res('__LENTO__');
								}, ms);
							}),
						]).then(function (v) {
							if (v === '__LENTO__')
								rr.avisos.push(rotulo + ': operacao lenta - limpeza continua em segundo plano');
							return v;
						});
					}
					try {
						var ks = [];
						for (var i3 = 0; i3 < localStorage.length; i3++) ks.push(localStorage.key(i3));
						ks.forEach(function (k) {
							if (!keepK(k)) {
								localStorage.removeItem(k);
								rr.ls++;
							}
						});
					} catch (e) {
						rr.avisos.push('localStorage: ' + e.message);
					}
					try {
						var ss = [];
						for (var i4 = 0; i4 < sessionStorage.length; i4++) ss.push(sessionStorage.key(i4));
						ss.forEach(function (k) {
							if (!keepK(k)) {
								sessionStorage.removeItem(k);
								rr.ss++;
							}
						});
					} catch (e) {
						rr.avisos.push('sessionStorage: ' + e.message);
					}
					try {
						if (window.indexedDB && indexedDB.databases) {
							var dbs = await tempo(indexedDB.databases(), 2500, 'IndexedDB');
							if (Array.isArray(dbs)) {
								for (var i5 = 0; i5 < dbs.length; i5++) {
									var nm = dbs[i5] && dbs[i5].name;
									if (!nm || keepDb.indexOf(nm) >= 0) continue;
									var rdel = await tempo(
										new Promise(function (res) {
											var q = indexedDB.deleteDatabase(nm);
											q.onsuccess = function () {
												res('ok');
											};
											q.onerror = function () {
												res('erro');
											};
											q.onblocked = function () {
												res('bloqueado');
											};
										}),
										2500,
										'IndexedDB "' + nm + '"',
									);
									if (rdel === 'ok') rr.idb++;
									else if (rdel === 'erro')
										rr.avisos.push('IndexedDB "' + nm + '": erro ao apagar');
									else if (rdel === 'bloqueado')
										rr.avisos.push(
											'IndexedDB "' + nm + '" em uso - sera apagado quando o app fechar a conexao',
										);
								}
							}
						}
					} catch (e) {
						rr.avisos.push('indexedDB: ' + e.message);
					}
					try {
						if (window.caches && caches.keys) {
							var cs = await tempo(caches.keys(), 2500, 'caches');
							if (Array.isArray(cs)) {
								for (var i6 = 0; i6 < cs.length; i6++) {
									var cok = await tempo(caches.delete(cs[i6]), 1500, 'cache "' + cs[i6] + '"');
									if (cok === true) rr.caches++;
								}
							}
						}
					} catch (e) {
						rr.avisos.push('caches: ' + e.message);
					}
					if (a && a.cookies) {
						try {
							String(document.cookie || '')
								.split(';')
								.forEach(function (p) {
									var n = p.split('=')[0].trim();
									if (n) {
										document.cookie = n + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
										rr.cookies++;
									}
								});
						} catch (e) {
							rr.avisos.push('cookies: ' + e.message);
						}
					}
					reply(id, true, rr);
				})().catch(function (e) {
					try {
						reply(id, false, { error: 'reset falhou: ' + ((e && e.message) || e) });
					} catch (_e) {}
				});
				return;
			}
			if (d.action === 'perf') {
				var pdur = Math.min(10000, Math.max(500, Number(a.duration_ms) || 2000));
				var pts = [];
				var plongs = [];
				var pobs = null;
				var pstop = false;
				var pguard = null;
				try {
					if (window.PerformanceObserver) {
						pobs = new PerformanceObserver(function (list) {
							var es = list.getEntries();
							for (var pi = 0; pi < es.length; pi++) plongs.push(es[pi].duration);
						});
						pobs.observe({ entryTypes: ['longtask'] });
					}
				} catch (e) {
					pobs = null;
				}
				var pnow = function () {
					return window.performance && performance.now ? performance.now() : Date.now();
				};
				var pt0 = pnow();
				var pfin = function () {
					if (pstop) return;
					pstop = true;
					if (pguard) clearTimeout(pguard);
					try {
						if (pobs) pobs.disconnect();
					} catch (e) {}
					var dts = [];
					for (var pj = 1; pj < pts.length; pj++) {
						var pdt = pts[pj] - pts[pj - 1];
						if (pdt > 0 && pdt < 2000) dts.push(pdt);
					}
					dts.sort(function (x, y) {
						return x - y;
					});
					var pn = dts.length,
						psum = 0;
					for (var pk = 0; pk < pn; pk++) psum += dts[pk];
					var pavg = pn ? psum / pn : 0;
					var pmed = pn ? dts[Math.floor(pn / 2)] : 0;
					var pp95 = pn ? dts[Math.min(pn - 1, Math.floor(pn * 0.95))] : 0;
					var pworst = pn ? dts[pn - 1] : 0;
					var pstut = 0;
					for (var pm = 0; pm < pn; pm++) if (dts[pm] > Math.max(pmed * 2, 33.5)) pstut++;
					var pmem = null;
					try {
						if (performance.memory)
							pmem = [performance.memory.usedJSHeapSize, performance.memory.jsHeapSizeLimit];
					} catch (e) {}
					var plsum = 0,
						plmax = 0;
					for (var pl = 0; pl < plongs.length; pl++) {
						plsum += plongs[pl];
						if (plongs[pl] > plmax) plmax = plongs[pl];
					}
					var pnodes = 0;
					try {
						pnodes = document.getElementsByTagName('*').length;
					} catch (e) {}
					var pcvs = 0;
					try {
						pcvs = document.querySelectorAll('canvas').length;
					} catch (e) {}
					reply(id, true, {
						dur: pdur,
						samples: pts.length,
						avg: pavg,
						med: pmed,
						p95: pp95,
						worst: pworst,
						stut: pstut,
						lt: plongs.length,
						ltMs: plsum,
						ltMax: plmax,
						mem: pmem,
						hidden: !!document.hidden,
						nodes: pnodes,
						canvases: pcvs,
					});
				};
				var ptick = function (ts) {
					if (pstop) return;
					pts.push(ts);
					if (pnow() - pt0 < pdur) requestAnimationFrame(ptick);
					else pfin();
				};
				pguard = setTimeout(pfin, pdur + 1500);
				try {
					requestAnimationFrame(ptick);
				} catch (e) {
					pfin();
				}
				return;
			}
			if (d.action === 'dom') {
				var max = Math.min(60000, Math.max(200, Number(a.max_chars) || 8000));
				var mode = a.mode || (a.selector ? 'html' : 'text');
				if (mode === 'text') {
					var root = a.selector ? findEl(a.selector) : document.body;
					reply(id, true, { text: visText(root, max) });
					return;
				}
				if (!a.selector) throw new Error('Informe selector para mode=' + mode + '.');
				var els = document.querySelectorAll(a.selector);
				var maxR = Math.min(50, Math.max(1, Number(a.max_results) || 5));
				var out = [],
					used = 0;
				for (var i2 = 0; i2 < els.length && i2 < maxR && used < max; i2++) {
					var e2 = els[i2];
					if (mode === 'list') {
						var r4 = e2.getBoundingClientRect();
						var cls =
							typeof e2.className === 'string' && e2.className
								? '.' + e2.className.trim().split(/\s+/).join('.')
								: '';
						var s4 =
							e2.tagName.toLowerCase() +
							(e2.id ? '#' + e2.id : '') +
							cls +
							' [' +
							Math.round(r4.left) +
							',' +
							Math.round(r4.top) +
							' ' +
							Math.round(r4.width) +
							'x' +
							Math.round(r4.height) +
							'] ' +
							(e2.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120);
						out.push(s4);
						used += s4.length;
					} else {
						var h4 = e2.outerHTML;
						if (h4.length > max - used) h4 = h4.slice(0, Math.max(0, max - used)) + '...(cortado)';
						out.push(h4);
						used += h4.length;
					}
				}
				reply(id, true, { count: els.length, text: out.join('\n\n') });
				return;
			}
			if (d.action === 'ui_map') {
				var maxR2 = Math.min(120, Math.max(1, Number(a.max_results) || 60));
				var selList =
					'a,button,input,select,textarea,summary,canvas,[onclick],[role=button],[role=link],[role=tab],[role=checkbox],[role=menuitem],[role=slider],[tabindex],[contenteditable="true"],[contenteditable=""]';
				var nodes = document.querySelectorAll(selList);
				var out2 = [],
					seen2 = [];
				function cssPath(elx) {
					var cesc = function (s) {
						try {
							return window.CSS && CSS.escape ? CSS.escape(s) : s;
						} catch (e) {
							return s;
						}
					};
					if (elx.id) return '#' + cesc(elx.id);
					var parts = [];
					var cur = elx;
					var depth = 0;
					while (cur && cur.nodeType === 1 && depth < 4) {
						var tg = cur.tagName.toLowerCase();
						var par = cur.parentElement;
						if (!par) {
							parts.unshift(tg);
							break;
						}
						var sibs = par.children;
						var idx = 0,
							same = 0;
						for (var si = 0; si < sibs.length; si++) {
							if (sibs[si].tagName === cur.tagName) {
								same++;
								if (sibs[si] === cur) idx = same;
							}
						}
						parts.unshift(same > 1 ? tg + ':nth-of-type(' + idx + ')' : tg);
						if (par.id) {
							parts.unshift('#' + cesc(par.id));
							break;
						}
						cur = par;
						depth++;
					}
					return parts.join(' > ');
				}
				for (var i7 = 0; i7 < nodes.length && out2.length < maxR2; i7++) {
					var e7 = nodes[i7];
					if (seen2.indexOf(e7) >= 0) continue;
					seen2.push(e7);
					var r7 = e7.getBoundingClientRect();
					if (r7.width < 2 || r7.height < 2) continue;
					if (
						r7.bottom < 0 ||
						r7.right < 0 ||
						r7.top > window.innerHeight ||
						r7.left > window.innerWidth
					)
						continue;
					var st7;
					try {
						st7 = getComputedStyle(e7);
					} catch (e) {
						st7 = null;
					}
					if (
						st7 &&
						(st7.display === 'none' || st7.visibility === 'hidden' || Number(st7.opacity) === 0)
					)
						continue;
					var txt7 = (
						e7.value != null && e7.value !== ''
							? String(e7.value)
							: e7.getAttribute('aria-label') ||
								e7.getAttribute('placeholder') ||
								e7.textContent ||
								''
					)
						.replace(/\s+/g, ' ')
						.trim()
						.slice(0, 60);
					var flags = [];
					if (e7.disabled) flags.push('disabled');
					if (document.activeElement === e7) flags.push('focused');
					if (e7.type) flags.push(String(e7.type));
					out2.push(
						cssPath(e7) +
							' @(' +
							Math.round(r7.left + r7.width / 2) +
							',' +
							Math.round(r7.top + r7.height / 2) +
							') ' +
							Math.round(r7.width) +
							'x' +
							Math.round(r7.height) +
							(flags.length ? ' [' + flags.join(',') + ']' : '') +
							(txt7 ? ' "' + txt7 + '"' : ''),
					);
				}
				reply(id, true, {
					count: out2.length,
					text: out2.join('\n') || '(nenhum elemento interativo visivel)',
				});
				return;
			}
			if (d.action === 'wait_for') {
				var t0 = Date.now();
				var tmax = Math.min(20000, Math.max(100, Number(a.timeout_ms) || 8000));
				var lastV = '';
				if (!(a.js && String(a.js).trim()) && !a.selector) {
					reply(id, false, { error: 'Informe selector ou js.' });
					return;
				}
				(function chk() {
					var okNow = false;
					try {
						if (a.js && String(a.js).trim()) {
							var v6 = (0, eval)(String(a.js));
							lastV = ser(v6).slice(0, 300);
							okNow = !!v6;
						} else {
							var e6 = document.querySelector(a.selector);
							var vis = false;
							if (e6) {
								var r6 = e6.getBoundingClientRect();
								var s6;
								try {
									s6 = getComputedStyle(e6);
								} catch (e) {
									s6 = null;
								}
								vis =
									r6.width > 0 &&
									r6.height > 0 &&
									(!s6 || (s6.display !== 'none' && s6.visibility !== 'hidden'));
							}
							lastV = e6 ? (vis ? 'visivel' : 'presente mas oculto') : 'ausente';
							okNow = a.hidden ? !e6 || !vis : !!e6 && vis;
						}
					} catch (e) {
						lastV = 'erro: ' + ((e && e.message) || e);
					}
					if (okNow) {
						reply(id, true, {
							text: 'Condicao satisfeita em ' + (Date.now() - t0) + 'ms (' + lastV + ').',
							elapsed: Date.now() - t0,
						});
						return;
					}
					if (Date.now() - t0 >= tmax) {
						reply(id, false, {
							error:
								'Timeout de ' +
								tmax +
								'ms esperando ' +
								(a.selector
									? 'o seletor ' + a.selector + (a.hidden ? ' sumir' : ' aparecer/ficar visivel')
									: 'a expressao js ficar truthy') +
								'. Ultimo estado: ' +
								lastV,
						});
						return;
					}
					setTimeout(chk, 120);
				})();
				return;
			}
			if (d.action === 'assert') {
				var t1 = Date.now();
				var tm = Math.min(10000, Math.max(0, Number(a.timeout_ms) || 1500));
				var lv = '';
				(function chk2() {
					var pass = false;
					try {
						var v8 = (0, eval)(String(a.js || ''));
						lv = ser(v8).slice(0, 500);
						pass = !!v8;
					} catch (e) {
						lv = 'erro: ' + ((e && e.message) || e);
					}
					if (pass) {
						reply(id, true, { pass: true, value: lv, elapsed: Date.now() - t1 });
						return;
					}
					if (Date.now() - t1 >= tm) {
						reply(id, true, { pass: false, value: lv, elapsed: Date.now() - t1 });
						return;
					}
					setTimeout(chk2, 120);
				})();
				return;
			}
			if (d.action === 'eval') {
				var res = (0, eval)(String(a.code || ''));
				Promise.resolve(res).then(
					function (v) {
						reply(id, true, { text: ser(v) });
					},
					function (er) {
						reply(id, false, { error: String((er && er.message) || er) });
					},
				);
				return;
			}
			if (d.action === 'interact') {
				var steps = Array.isArray(a.steps) ? a.steps : [];
				if (!steps.length) throw new Error('Informe steps.');
				if (steps.length > 40) throw new Error('Maximo de 40 steps por chamada de interact.');
				var log = [];
				var run = function (i3) {
					if (i3 >= steps.length) {
						reply(id, true, { text: log.join('\n') });
						return;
					}
					var s5 = steps[i3] || {};
					try {
						var act = s5.action;
						if (act === 'wait') {
							var ms = Math.min(5000, Math.max(16, Number(s5.ms) || 500));
							log.push('wait ' + ms + 'ms');
							setTimeout(function () {
								run(i3 + 1);
							}, ms);
							return;
						}
						if (act === 'click' || act === 'dblclick') {
							var t5, x5, y5;
							if (s5.selector) {
								t5 = findEl(s5.selector);
								try {
									t5.scrollIntoView({ block: 'center' });
								} catch (e) {}
								var c5 = center(t5);
								x5 = c5.x;
								y5 = c5.y;
							} else {
								x5 = Number(s5.x) || 0;
								y5 = Number(s5.y) || 0;
								t5 = elAt(x5, y5);
							}
							doClick(t5, x5, y5, act === 'dblclick');
							try {
								if (t5.focus) t5.focus();
							} catch (e) {}
							log.push(
								act +
									' em ' +
									(s5.selector || '(' + Math.round(x5) + ',' + Math.round(y5) + ')') +
									' -> ' +
									t5.tagName.toLowerCase(),
							);
						} else if (act === 'type') {
							var t6 = s5.selector ? findEl(s5.selector) : document.activeElement;
							if (!t6 || t6 === document.body)
								throw new Error('type: nenhum campo focado - informe selector');
							try {
								if (t6.focus) t6.focus();
							} catch (e) {}
							setValue(t6, String(s5.text == null ? '' : s5.text));
							log.push('type em ' + (s5.selector || 'elemento focado'));
						} else if (act === 'key') {
							var key = String(s5.key || '');
							if (!key) throw new Error('key: informe a tecla (ex.: ArrowLeft, Enter, w)');
							var tgt = document.activeElement || document.body;
							var hold = Math.min(3000, Math.max(0, Number(s5.hold_ms) || 0));
							keyEv(tgt, 'keydown', key, s5);
							if (key.length === 1) keyEv(tgt, 'keypress', key, s5);
							if (hold > 0) {
								setTimeout(function () {
									try {
										keyEv(tgt, 'keyup', key, s5);
										log.push('key ' + key + ' (segurada ' + hold + 'ms)');
									} catch (e3) {
										log.push('ERRO no keyup de ' + key + ': ' + ((e3 && e3.message) || e3));
									}
									run(i3 + 1);
								}, hold);
								return;
							}
							keyEv(tgt, 'keyup', key, s5);
							log.push('key ' + key);
						} else if (act === 'keydown') {
							var kd = String(s5.key || '');
							if (!kd) throw new Error('keydown: informe key');
							var tgd = document.activeElement || document.body;
							if (!HELD[kd]) {
								keyEv(tgd, 'keydown', kd, s5);
								HELD[kd] = 1;
							}
							log.push(
								'keydown ' +
									kd +
									' (segurando; teclas ativas: ' +
									Object.keys(HELD).join('+') +
									')',
							);
						} else if (act === 'keyup') {
							var ku = String(s5.key || '');
							if (!ku) throw new Error('keyup: informe key');
							var tgu = document.activeElement || document.body;
							keyEv(tgu, 'keyup', ku, s5);
							delete HELD[ku];
							log.push('keyup ' + ku);
						} else if (act === 'scroll') {
							if (s5.selector) {
								var t7 = findEl(s5.selector);
								try {
									t7.scrollIntoView({ block: 'center' });
								} catch (e) {}
							} else window.scrollTo(Number(s5.x) || 0, Number(s5.y) || 0);
							log.push(
								'scroll ' + (s5.selector || (Number(s5.x) || 0) + ',' + (Number(s5.y) || 0)),
							);
						} else if (act === 'move') {
							var x8 = Number(s5.x) || 0,
								y8 = Number(s5.y) || 0;
							var t8 = (s5.dx != null || s5.dy != null) && PL.el ? PL.el : elAt(x8, y8);
							var mv = { movementX: s5.dx, movementY: s5.dy };
							fire(t8, 'pointermove', x8, y8, mv);
							fire(t8, 'mousemove', x8, y8, mv);
							log.push(
								'move (' +
									x8 +
									',' +
									y8 +
									')' +
									(s5.dx || s5.dy
										? ' delta(' + (Number(s5.dx) || 0) + ',' + (Number(s5.dy) || 0) + ')'
										: ''),
							);
						} else if (act === 'wheel') {
							var tw, xw, yw;
							if (s5.selector) {
								tw = findEl(s5.selector);
								var cw = center(tw);
								xw = cw.x;
								yw = cw.y;
							} else {
								xw = Number(s5.x) || Math.round(window.innerWidth / 2);
								yw = Number(s5.y) || Math.round(window.innerHeight / 2);
								tw = elAt(xw, yw);
							}
							var dyw = Number(s5.delta_y);
							if (isNaN(dyw)) dyw = 120;
							var dxw = Number(s5.delta_x) || 0;
							tw.dispatchEvent(
								new WheelEvent('wheel', {
									bubbles: true,
									cancelable: true,
									composed: true,
									view: window,
									clientX: xw,
									clientY: yw,
									deltaY: dyw,
									deltaX: dxw,
									deltaMode: 0,
								}),
							);
							log.push(
								'wheel dY=' +
									dyw +
									(dxw ? ' dX=' + dxw : '') +
									' em ' +
									(s5.selector || '(' + Math.round(xw) + ',' + Math.round(yw) + ')'),
							);
						} else if (act === 'look') {
							var lx = Number(s5.dx) || 0,
								ly = Number(s5.dy) || 0;
							if (!lx && !ly) throw new Error('look: informe dx e/ou dy');
							var lsegs = Math.min(
								60,
								Math.max(
									1,
									Number(s5.move_steps) ||
										Math.min(40, Math.max(4, Math.round(Math.max(Math.abs(lx), Math.abs(ly)) / 8))),
								),
							);
							var ldur = Math.min(3000, Math.max(16, Number(s5.ms) || 200));
							var lel =
								PL.el ||
								(s5.selector ? findEl(s5.selector) : null) ||
								document.querySelector('canvas') ||
								document.body;
							var lcx = Math.round(window.innerWidth / 2),
								lcy = Math.round(window.innerHeight / 2);
							var li = 0;
							(function lseg() {
								try {
									li++;
									var mvl = { movementX: lx / lsegs, movementY: ly / lsegs };
									fire(lel, 'pointermove', lcx, lcy, mvl);
									fire(lel, 'mousemove', lcx, lcy, mvl);
									if (li < lsegs) {
										setTimeout(lseg, Math.max(8, Math.round(ldur / lsegs)));
										return;
									}
									log.push(
										'look delta(' +
											lx +
											',' +
											ly +
											') em ' +
											lsegs +
											' passos' +
											(PL.el
												? ' [pointer lock ativo: ' + lel.tagName.toLowerCase() + ']'
												: ' [sem pointer lock; enviado para ' + lel.tagName.toLowerCase() + ']'),
									);
									run(i3 + 1);
								} catch (e3) {
									log.push('ERRO no look: ' + ((e3 && e3.message) || e3));
									reply(id, false, { error: log.join('\n') });
								}
							})();
							return;
						} else if (act === 'pointer_lock') {
							var ple = s5.selector
								? findEl(s5.selector)
								: document.querySelector('canvas') || document.body;
							PL.el = ple;
							try {
								document.dispatchEvent(new Event('pointerlockchange'));
							} catch (e) {}
							log.push(
								'pointer_lock em ' + (s5.selector || ple.tagName.toLowerCase()) + ' (emulado)',
							);
						} else if (act === 'pointer_unlock') {
							PL.el = null;
							try {
								if (PL.origExit) PL.origExit.call(document);
							} catch (e) {}
							try {
								document.dispatchEvent(new Event('pointerlockchange'));
							} catch (e) {}
							log.push('pointer_unlock');
						} else if (act === 'chord') {
							var cks = Array.isArray(s5.keys) ? s5.keys.map(String) : [];
							if (!cks.length) throw new Error('chord: informe keys, ex.: ["w","Shift"]');
							if (cks.length > 6) throw new Error('chord: maximo de 6 teclas seguradas');
							var cpress =
								s5.press == null
									? []
									: Array.isArray(s5.press)
										? s5.press.map(String)
										: [String(s5.press)];
							if (cpress.length > 6) throw new Error('chord: maximo de 6 teclas em press');
							var chold = Math.min(5000, Math.max(50, Number(s5.hold_ms) || 400));
							var ctgt = document.activeElement || document.body;
							var cmods = {
								ctrl: !!s5.ctrl || cks.indexOf('Control') >= 0,
								shift: !!s5.shift || cks.indexOf('Shift') >= 0,
								alt: !!s5.alt || cks.indexOf('Alt') >= 0,
							};
							for (var ck = 0; ck < cks.length; ck++) {
								if (!HELD[cks[ck]]) {
									keyEv(ctgt, 'keydown', cks[ck], cmods);
									HELD[cks[ck]] = 1;
								}
							}
							var cpi = 0;
							var cfin = function () {
								setTimeout(function () {
									try {
										for (var cu = cks.length - 1; cu >= 0; cu--) {
											keyEv(ctgt, 'keyup', cks[cu], cmods);
											delete HELD[cks[cu]];
										}
										log.push(
											'chord ' +
												cks.join('+') +
												(cpress.length ? ' com toque de ' + cpress.join(' e ') : '') +
												' segurado ' +
												chold +
												'ms e liberado',
										);
										run(i3 + 1);
									} catch (e3) {
										log.push('ERRO no chord: ' + ((e3 && e3.message) || e3));
										reply(id, false, { error: log.join('\n') });
									}
								}, chold);
							};
							var cnext = function () {
								if (cpi >= cpress.length) {
									cfin();
									return;
								}
								var cpk = cpress[cpi++];
								setTimeout(function () {
									try {
										keyEv(ctgt, 'keydown', cpk, cmods);
										if (cpk.length === 1) keyEv(ctgt, 'keypress', cpk, cmods);
										setTimeout(function () {
											try {
												keyEv(ctgt, 'keyup', cpk, cmods);
											} catch (e) {}
											cnext();
										}, 40);
									} catch (e3) {
										cnext();
									}
								}, 60);
							};
							cnext();
							return;
						} else if (act === 'tap') {
							var tp, xp, yp;
							if (s5.selector) {
								tp = findEl(s5.selector);
								try {
									tp.scrollIntoView({ block: 'center' });
								} catch (e) {}
								var cp = center(tp);
								xp = cp.x;
								yp = cp.y;
							} else {
								xp = Number(s5.x) || 0;
								yp = Number(s5.y) || 0;
								tp = elAt(xp, yp);
							}
							touchEv(tp, 'touchstart', [{ id: 1, x: xp, y: yp }], [{ id: 1, x: xp, y: yp }]);
							fire(tp, 'pointerdown', xp, yp, { pointerId: 2, pointerType: 'touch' });
							setTimeout(
								function () {
									try {
										touchEv(tp, 'touchend', [], [{ id: 1, x: xp, y: yp }]);
										fire(tp, 'pointerup', xp, yp, { pointerId: 2, pointerType: 'touch' });
										fire(tp, 'click', xp, yp);
										log.push(
											'tap em ' +
												(s5.selector || '(' + Math.round(xp) + ',' + Math.round(yp) + ')') +
												' -> ' +
												tp.tagName.toLowerCase(),
										);
										run(i3 + 1);
									} catch (e3) {
										log.push('ERRO no tap: ' + ((e3 && e3.message) || e3));
										reply(id, false, { error: log.join('\n') });
									}
								},
								Math.min(500, Math.max(30, Number(s5.ms) || 60)),
							);
							return;
						} else if (act === 'pinch') {
							var pcx, pcy, pel;
							if (s5.selector) {
								pel = findEl(s5.selector);
								var cpc = center(pel);
								pcx = cpc.x;
								pcy = cpc.y;
							} else {
								pcx = Number(s5.x) || Math.round(window.innerWidth / 2);
								pcy = Number(s5.y) || Math.round(window.innerHeight / 2);
								pel = elAt(pcx, pcy);
							}
							var d0 = Math.min(1200, Math.max(20, Number(s5.start_dist) || 200));
							var d1 =
								s5.end_dist != null
									? Math.min(1200, Math.max(4, Number(s5.end_dist)))
									: s5.scale != null
										? Math.min(1200, Math.max(4, d0 * Math.max(0.05, Number(s5.scale) || 1)))
										: 80;
							var ang = ((Number(s5.angle) || 0) * Math.PI) / 180;
							var ux = Math.cos(ang),
								uy = Math.sin(ang);
							var psegs = Math.min(40, Math.max(4, Number(s5.move_steps) || 10));
							var pdur2 = Math.min(4000, Math.max(60, Number(s5.ms) || 350));
							var fpos = function (dd) {
								return [
									{ id: 1, x: pcx - (ux * dd) / 2, y: pcy - (uy * dd) / 2 },
									{ id: 2, x: pcx + (ux * dd) / 2, y: pcy + (uy * dd) / 2 },
								];
							};
							var p0 = fpos(d0);
							touchEv(pel, 'touchstart', p0, p0);
							fire(pel, 'pointerdown', p0[0].x, p0[0].y, { pointerId: 2, pointerType: 'touch' });
							fire(pel, 'pointerdown', p0[1].x, p0[1].y, { pointerId: 3, pointerType: 'touch' });
							var pst = 0;
							(function pseg() {
								try {
									pst++;
									var dd = d0 + ((d1 - d0) * pst) / psegs;
									var pf = fpos(dd);
									touchEv(pel, 'touchmove', pf, pf);
									fire(pel, 'pointermove', pf[0].x, pf[0].y, {
										pointerId: 2,
										pointerType: 'touch',
										buttons: 1,
									});
									fire(pel, 'pointermove', pf[1].x, pf[1].y, {
										pointerId: 3,
										pointerType: 'touch',
										buttons: 1,
									});
									if (pst < psegs) {
										setTimeout(pseg, Math.max(8, Math.round(pdur2 / psegs)));
										return;
									}
									touchEv(pel, 'touchend', [], pf);
									fire(pel, 'pointerup', pf[0].x, pf[0].y, { pointerId: 2, pointerType: 'touch' });
									fire(pel, 'pointerup', pf[1].x, pf[1].y, { pointerId: 3, pointerType: 'touch' });
									log.push(
										'pinch ' +
											(d1 < d0 ? 'fechando (zoom out)' : 'abrindo (zoom in)') +
											' ' +
											Math.round(d0) +
											'px -> ' +
											Math.round(d1) +
											'px em ' +
											(s5.selector || '(' + Math.round(pcx) + ',' + Math.round(pcy) + ')'),
									);
									run(i3 + 1);
								} catch (e3) {
									log.push('ERRO no pinch: ' + ((e3 && e3.message) || e3));
									reply(id, false, { error: log.join('\n') });
								}
							})();
							return;
						} else if (
							(act === 'drag' && Array.isArray(s5.path) && s5.path.length) ||
							act === 'touch_drag'
						) {
							var isTouch = act === 'touch_drag';
							var pts = [];
							var t9b = null;
							if (s5.selector) {
								t9b = findEl(s5.selector);
								try {
									t9b.scrollIntoView({ block: 'center' });
								} catch (e) {}
								var c9b = center(t9b);
								pts.push({ x: c9b.x, y: c9b.y });
							} else if (s5.x != null || s5.y != null) {
								pts.push({ x: Number(s5.x) || 0, y: Number(s5.y) || 0 });
							}
							if (Array.isArray(s5.path)) {
								for (var pp = 0; pp < s5.path.length && pp < 30; pp++) {
									var pe = s5.path[pp];
									var ppx, ppy;
									if (Array.isArray(pe)) {
										ppx = Number(pe[0]);
										ppy = Number(pe[1]);
									} else if (pe && typeof pe === 'object') {
										ppx = Number(pe.x);
										ppy = Number(pe.y);
									} else continue;
									if (!isNaN(ppx) && !isNaN(ppy)) pts.push({ x: ppx, y: ppy });
								}
							}
							if (s5.to_selector) {
								var te9b = findEl(s5.to_selector);
								var ce9b = center(te9b);
								pts.push({ x: ce9b.x, y: ce9b.y });
							} else if (s5.to_x != null && s5.to_y != null) {
								var ex0 = Number(s5.to_x),
									ey0 = Number(s5.to_y);
								if (!isNaN(ex0) && !isNaN(ey0)) pts.push({ x: ex0, y: ey0 });
							}
							if (pts.length < 2)
								throw new Error(
									act +
										': informe origem (selector ou x/y) e destino (to_selector, to_x/to_y ou path)',
								);
							if (!t9b) t9b = elAt(pts[0].x, pts[0].y);
							var lens = [0];
							var totLen = 0;
							for (var pl2 = 1; pl2 < pts.length; pl2++) {
								var ddx = pts[pl2].x - pts[pl2 - 1].x,
									ddy = pts[pl2].y - pts[pl2 - 1].y;
								totLen += Math.sqrt(ddx * ddx + ddy * ddy);
								lens.push(totLen);
							}
							var atLen = function (L) {
								var li2 = 1;
								while (li2 < lens.length - 1 && lens[li2] < L) li2++;
								var l0 = lens[li2 - 1],
									l1 = lens[li2];
								var f = l1 > l0 ? (L - l0) / (l1 - l0) : 1;
								return {
									x: pts[li2 - 1].x + (pts[li2].x - pts[li2 - 1].x) * f,
									y: pts[li2 - 1].y + (pts[li2].y - pts[li2 - 1].y) * f,
								};
							};
							var segsB = Math.min(
								60,
								Math.max(3, Number(s5.move_steps) || Math.max(12, (pts.length - 1) * 6)),
							);
							var durB = Math.min(
								5000,
								Math.max(50, Number(s5.ms) || Math.max(300, (pts.length - 1) * 150)),
							);
							var lastP = pts[0];
							if (isTouch) {
								touchEv(
									t9b,
									'touchstart',
									[{ id: 1, x: pts[0].x, y: pts[0].y }],
									[{ id: 1, x: pts[0].x, y: pts[0].y }],
								);
								fire(t9b, 'pointerdown', pts[0].x, pts[0].y, {
									pointerId: 2,
									pointerType: 'touch',
								});
							} else {
								fire(t9b, 'pointerdown', pts[0].x, pts[0].y);
								fire(t9b, 'mousedown', pts[0].x, pts[0].y);
							}
							var stB = 0;
							(function segB() {
								try {
									stB++;
									var P = stB >= segsB ? pts[pts.length - 1] : atLen((totLen * stB) / segsB);
									var tt2 = elAt(P.x, P.y);
									if (isTouch) {
										touchEv(
											tt2,
											'touchmove',
											[{ id: 1, x: P.x, y: P.y }],
											[{ id: 1, x: P.x, y: P.y }],
										);
										fire(tt2, 'pointermove', P.x, P.y, {
											pointerId: 2,
											pointerType: 'touch',
											buttons: 1,
											movementX: P.x - lastP.x,
											movementY: P.y - lastP.y,
										});
									} else {
										var mvB = { buttons: 1, movementX: P.x - lastP.x, movementY: P.y - lastP.y };
										fire(tt2, 'pointermove', P.x, P.y, mvB);
										fire(tt2, 'mousemove', P.x, P.y, mvB);
									}
									lastP = P;
									if (stB < segsB) {
										setTimeout(segB, Math.max(8, Math.round(durB / segsB)));
										return;
									}
									var tdB = elAt(P.x, P.y);
									if (isTouch) {
										touchEv(tdB, 'touchend', [], [{ id: 1, x: P.x, y: P.y }]);
										fire(tdB, 'pointerup', P.x, P.y, { pointerId: 2, pointerType: 'touch' });
									} else {
										fire(tdB, 'pointerup', P.x, P.y);
										fire(tdB, 'mouseup', P.x, P.y);
									}
									log.push(
										act +
											' ' +
											pts
												.map(function (q) {
													return '(' + Math.round(q.x) + ',' + Math.round(q.y) + ')';
												})
												.join(' -> ') +
											' em ' +
											durB +
											'ms (' +
											segsB +
											' passos)',
									);
									run(i3 + 1);
								} catch (e3) {
									log.push('ERRO no ' + act + ': ' + ((e3 && e3.message) || e3));
									reply(id, false, { error: log.join('\n') });
								}
							})();
							return;
						} else if (act === 'drag') {
							var sx9, sy9, t9;
							if (s5.selector) {
								t9 = findEl(s5.selector);
								try {
									t9.scrollIntoView({ block: 'center' });
								} catch (e) {}
								var c9 = center(t9);
								sx9 = c9.x;
								sy9 = c9.y;
							} else {
								sx9 = Number(s5.x) || 0;
								sy9 = Number(s5.y) || 0;
								t9 = elAt(sx9, sy9);
							}
							var ex9, ey9;
							if (s5.to_selector) {
								var te9 = findEl(s5.to_selector);
								var ce9 = center(te9);
								ex9 = ce9.x;
								ey9 = ce9.y;
							} else {
								ex9 = Number(s5.to_x);
								ey9 = Number(s5.to_y);
								if (isNaN(ex9) || isNaN(ey9))
									throw new Error('drag: informe to_selector ou to_x/to_y');
							}
							var segs = Math.min(40, Math.max(3, Number(s5.move_steps) || 12));
							var dur = Math.min(3000, Math.max(50, Number(s5.ms) || 300));
							fire(t9, 'pointerdown', sx9, sy9);
							fire(t9, 'mousedown', sx9, sy9);
							var st9 = 0;
							(function seg() {
								try {
									st9++;
									var px = sx9 + ((ex9 - sx9) * st9) / segs,
										py = sy9 + ((ey9 - sy9) * st9) / segs;
									var tt = elAt(px, py);
									var mv2 = {
										buttons: 1,
										movementX: (ex9 - sx9) / segs,
										movementY: (ey9 - sy9) / segs,
									};
									fire(tt, 'pointermove', px, py, mv2);
									fire(tt, 'mousemove', px, py, mv2);
									if (st9 < segs) {
										setTimeout(seg, Math.max(10, Math.round(dur / segs)));
										return;
									}
									var td = elAt(ex9, ey9);
									fire(td, 'pointerup', ex9, ey9);
									fire(td, 'mouseup', ex9, ey9);
									log.push(
										'drag (' +
											Math.round(sx9) +
											',' +
											Math.round(sy9) +
											') -> (' +
											Math.round(ex9) +
											',' +
											Math.round(ey9) +
											') em ' +
											dur +
											'ms',
									);
									run(i3 + 1);
								} catch (e3) {
									log.push('ERRO no drag: ' + ((e3 && e3.message) || e3));
									reply(id, false, { error: log.join('\n') });
								}
							})();
							return;
						} else if (act === 'gamepad') {
							gpInstall();
							var pi = Math.min(3, Math.max(0, Number(s5.pad_index) || 0));
							var isNew = !GP.pads[pi];
							var p9 = gpPad(pi);
							if (s5.buttons && typeof s5.buttons === 'object') {
								for (var bk in s5.buttons) {
									var bi = Number(bk);
									if (bi >= 0 && bi < p9.buttons.length) {
										var bv = s5.buttons[bk];
										var bval =
											bv === true
												? 1
												: bv === false
													? 0
													: Math.min(1, Math.max(0, Number(bv) || 0));
										p9.buttons[bi] = { pressed: bval > 0.05, touched: bval > 0, value: bval };
									}
								}
							}
							if (Array.isArray(s5.axes)) {
								for (var ai = 0; ai < s5.axes.length && ai < 4; ai++)
									p9.axes[ai] = Math.min(1, Math.max(-1, Number(s5.axes[ai]) || 0));
							}
							p9.timestamp = window.performance && performance.now ? performance.now() : Date.now();
							if (isNew) gpConnect(p9);
							var ghold = Math.min(5000, Math.max(0, Number(s5.hold_ms) || 0));
							if (ghold > 0) {
								setTimeout(function () {
									try {
										if (s5.buttons && typeof s5.buttons === 'object') {
											for (var bk2 in s5.buttons) {
												var bi2 = Number(bk2);
												if (bi2 >= 0 && bi2 < p9.buttons.length)
													p9.buttons[bi2] = { pressed: false, touched: false, value: 0 };
											}
										}
										if (Array.isArray(s5.axes)) {
											for (var ai2 = 0; ai2 < s5.axes.length && ai2 < 4; ai2++) p9.axes[ai2] = 0;
										}
										p9.timestamp =
											window.performance && performance.now ? performance.now() : Date.now();
										log.push(
											'gamepad ' +
												pi +
												' segurado ' +
												ghold +
												'ms e liberado (botoes/eixos zerados)',
										);
										run(i3 + 1);
									} catch (e3) {
										log.push('ERRO no gamepad: ' + ((e3 && e3.message) || e3));
										reply(id, false, { error: log.join('\n') });
									}
								}, ghold);
								return;
							}
							log.push('gamepad ' + pi + ' atualizado (axes: ' + p9.axes.join(',') + ')');
						} else throw new Error('Acao desconhecida: ' + act);
						run(i3 + 1);
					} catch (e2) {
						log.push(
							'ERRO no passo ' +
								(i3 + 1) +
								' (' +
								(s5.action || '?') +
								'): ' +
								((e2 && e2.message) || e2),
						);
						reply(id, false, { error: log.join('\n') });
					}
				};
				run(0);
				return;
			}
			reply(id, false, { error: 'Acao de visao desconhecida: ' + d.action });
		} catch (e) {
			reply(id, false, { error: String((e && e.message) || e) });
		}
	});
	announce(document.readyState === 'complete');
	window.addEventListener('load', function () {
		announce(true);
	});
})();
`;
const FETCH_SHIM = [
	'(function(){',
	'  var MAP=window.__LP_MAP__||{};',
	'  function lookup(u){try{var url=new URL(u,document.baseURI);if(url.origin==="https:' +
		'//aurora.local"){var k=decodeURIComponent(url.pathname);if(MAP[k])return MAP[k];' +
		'if(MAP[k.replace(/^\\//,"")])return MAP[k.replace(/^\\//,"")];}}catch(e){}return null;}',
	'  var of=window.fetch?window.fetch.bind(window):null;',
	'  window.fetch=function(input,init){var u=(typeof input==="string")?input:' +
		'(input&&input.url);var hit=lookup(u);if(hit)return of?of(hit.u,init):fetch(hit.u,init);' +
		'return of?of(input,init):Promise.reject(new Error("fetch indisponível"));};',
	'  var OX=window.XMLHttpRequest;if(OX){var op=OX.prototype.open;OX.prototype.open=function(m,u){var hit=lookup(u);return op.call(this,m,hit?hit.u:u);};}',
	'  function redir(v){if(typeof v!=="string"||!v)return v;var hit=lookup(v);return hit?hit.u:v;}',
	'  function patchSrc(C){try{if(!C||!C.prototype)return;var ' +
		'd=Object.getOwnPropertyDescriptor(C.prototype,"src");if(!d||!d.set)return;' +
		'Object.defineProperty(C.prototype,"src",{configurable:true,enumerable:d.enumerable,get:' +
		'd.get,set:function(v){d.set.call(this,redir(v));}});}catch(e){}}',
	'  [window.HTMLImageElement,window.HTMLMediaElement,window.HTMLSourceElement,window.HTMLTrackElement].forEach(patchSrc);',
	'  try{var SA=Element.prototype.setAttribute;Element.prototype.setAttribute=function(n,v)' +
		'{if(n&&typeof v==="string"&&(n==="src"||n==="href"||n==="xlink:href"))v=redir(v);return ' +
		'SA.call(this,n,v);};}catch(e){}',
	'  try{var SI=window.Image;if(SI){window.Image=function(w,h){var img=new SI(w,h);return img;};window.Image.prototype=SI.prototype;}}catch(e){}',
	'})();',
].join('\n');
