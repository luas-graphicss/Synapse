'use strict';
const AURORA_BABEL_CDNS = [
	'https://unpkg.com/@babel/standalone/babel.min.js',
	'https://cdn.jsdelivr.net/npm/@babel/standalone/babel.min.js',
	'https://fastly.jsdelivr.net/npm/@babel/standalone/babel.min.js',
	'https://esm.sh/@babel/standalone@7.26.4/babel.min.js',
];
const AURORA_PRELUDE = [
	'window.global=window.global||window;',
	'window.process=window.process||{env:{NODE_ENV:"development"},platform:"browser",browser:' +
		'true,version:"v20.0.0",versions:{node:"20.0.0"},argv:[],cwd:function(){return "/"},' +
		'nextTick:function(f){Promise.resolve().then(f)}};',
	'window.__AURORA_ENV__=Object.assign({MODE:"development",DEV:true,PROD:false,SSR:false,BASE_URL:"/"},window.__AURORA_ENV__||{});',
	'window.__AURORA_URL__=document.baseURI;',
	'window.__AURORA_GLOB__=function(){return {};};',
].join('\n');
const AURORA_SPA_SHIM = [
	'(function(){try{',
	'var virt=!/^https?:$/.test(location.protocol)||location.pathname==="srcdoc";',
	'window.__AURORA_PREVIEW__={embedded:true,virtualUrl:virt,routing:virt?"hash":"path",base:"/"};',
	'if(!virt)return;',
	'if(!location.hash){try{location.hash="#/";}catch(e){}}',
	'var H=window.History&&window.History.prototype;if(!H)return;',
	'var toHash=function(u){var s=String(u==null?"":u);if(!s)return "/";var i=s.indexOf("#");' +
		'if(i>=0)return s.slice(i+1)||"/";var p=s.indexOf("://");if(p>=0){s=s.slice(p+3);var ' +
		'q=s.indexOf("/");s=q>=0?s.slice(q):"/";}return s||"/";};',
	'["pushState","replaceState"].forEach(function(k){var orig=H[k];if(typeof orig!=="function")return;',
	' H[k]=function(state,title,url){try{return orig.call(this,state,title,url);}catch(err){',
	'  try{var h=url==null?null:toHash(url);',
	'   if(h!==null&&("#"+h)!==location.hash){location.hash=h;}',
	'   else{window.dispatchEvent(new PopStateEvent("popstate",{state:state}));}',
	'  }catch(e2){}',
	'  return undefined;}};});',
	'}catch(e){}})();',
].join('\n');
const AURORA_WORKER_SRC = [
	'function boot(urls){for(var i=0;i<urls.length;i++){try{importScripts(urls[i]);if(self.Babel)return urls[i];}catch(e){}}return null;}',
	'self.onmessage=function(ev){var d=ev.data||{};',
	'  if(d.type==="boot"){var u=boot(d.urls||[]);postMessage(u?{type:"ready",url:u}:{type:"fail"});return;}',
	'  if(d.type==="job"){var out=[],i;for(i=0;i<d.items.length;i++){var it=d.items[i];' +
		'try{out.push({path:it.path,code:self.Babel.transform(it.code,it.opts).code});}catch(e)' +
		'{out.push({path:it.path,error:String((e&&e.message)||e)});}}postMessage({type:"done",id:' +
		'd.id,out:out});}',
	'};',
].join('\n');

const AuroraFix = (function () {
	const NODE_BUILTINS = new Set([
		'assert',
		'async_hooks',
		'buffer',
		'child_process',
		'cluster',
		'console',
		'constants',
		'crypto',
		'dgram',
		'diagnostics_channel',
		'dns',
		'domain',
		'events',
		'fs',
		'http',
		'http2',
		'https',
		'inspector',
		'module',
		'net',
		'os',
		'path',
		'perf_hooks',
		'process',
		'punycode',
		'querystring',
		'readline',
		'repl',
		'stream',
		'string_decoder',
		'sys',
		'timers',
		'tls',
		'trace_events',
		'tty',
		'url',
		'util',
		'v8',
		'vm',
		'wasi',
		'worker_threads',
		'zlib',
	]);
	const JS_EXT = ['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx'];
	const STYLE_EXT = ['.css', '.scss', '.sass', '.less'];
	const AUTORUN_LIMIT = 60;
	const MAX_BLIND = 400;
	const cache = new Map();
	const MAX_CACHE = 1500;
	let pool = null,
		poolPromise = null,
		poolBroken = false,
		jobSeq = 0,
		poolInfo = '';

	function yieldUI() {
		return new Promise((r) => setTimeout(r, 0));
	}
	function hash(str) {
		let h = 5381,
			i = str.length;
		while (i) h = (h * 33) ^ str.charCodeAt(--i);
		return (h >>> 0).toString(36) + ':' + str.length;
	}
	function chunk(arr, size) {
		const out = [];
		for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
		return out;
	}
	function cacheSet(k, v) {
		if (cache.size > MAX_CACHE) cache.clear();
		cache.set(k, v);
	}
	function ext(p) {
		return Core.extname(p);
	}
	function isJs(p) {
		return JS_EXT.includes(ext(p));
	}
	function txt(files, p) {
		try {
			const f = files.get(p);
			return f ? fileText(f) || '' : '';
		} catch (e) {
			return '';
		}
	}
	function looksLikeModule(code) {
		return /(^|[^.\w$])(import|export)\s*[\s{('"*]/.test(code || '');
	}

	function makeWorker() {
		const b = new Blob([AURORA_WORKER_SRC], { type: 'text/javascript' });
		const u = URL.createObjectURL(b);
		const w = new Worker(u);
		w.__url = u;
		return w;
	}
	function bootWorker(w, ms) {
		return new Promise((res) => {
			let done = false;
			const fin = (ok) => {
				if (done) return;
				done = true;
				clearTimeout(to);
				w.onmessage = null;
				w.onerror = null;
				res(ok);
			};
			const to = setTimeout(() => fin(false), ms || 25000);
			w.onmessage = (e) => {
				const d = e.data || {};
				if (d.type === 'ready') {
					poolInfo = d.url || '';
					fin(true);
				} else if (d.type === 'fail') fin(false);
			};
			w.onerror = () => fin(false);
			try {
				w.postMessage({ type: 'boot', urls: AURORA_BABEL_CDNS });
			} catch (e) {
				fin(false);
			}
		});
	}
	async function getPool(n) {
		if (poolBroken) return null;
		if (pool) return pool;
		if (poolPromise) return poolPromise;
		poolPromise = (async () => {
			if (typeof Worker === 'undefined' || typeof Blob === 'undefined') {
				poolBroken = true;
				return null;
			}
			let first = null;
			try {
				first = makeWorker();
			} catch (e) {
				poolBroken = true;
				return null;
			}
			const ok = await bootWorker(first, 25000);
			if (!ok) {
				try {
					first.terminate();
					URL.revokeObjectURL(first.__url);
				} catch (e) {
					ignorarErro(e, 'getPool');
				}
				poolBroken = true;
				poolPromise = null;
				return null;
			}
			const extra = Math.max(0, (n || 2) - 1);
			const rest = await Promise.all(
				Array.from({ length: extra }, async () => {
					try {
						const w = makeWorker();
						if (await bootWorker(w, 25000)) return w;
						try {
							w.terminate();
							URL.revokeObjectURL(w.__url);
						} catch (e) {
							ignorarErro(e, 'getPool');
						}
						return null;
					} catch (e) {
						return null;
					}
				}),
			);
			pool = [first].concat(rest.filter(Boolean));
			return pool;
		})();
		return poolPromise;
	}
	function runJob(w, items) {
		return new Promise((res) => {
			const id = ++jobSeq;
			let done = false;
			const onmsg = (e) => {
				const d = e.data || {};
				if (d.type !== 'done' || d.id !== id || done) return;
				done = true;
				clearTimeout(to);
				w.removeEventListener('message', onmsg);
				res(d.out || []);
			};
			const to = setTimeout(() => {
				if (done) return;
				done = true;
				w.removeEventListener('message', onmsg);
				res(items.map((it) => ({ path: it.path, error: 'tempo esgotado ao compilar' })));
			}, 180000);
			w.addEventListener('message', onmsg);
			try {
				w.postMessage({
					type: 'job',
					id: id,
					items: items.map((it) => ({ path: it.path, code: it.code, opts: it.opts })),
				});
			} catch (e) {
				done = true;
				clearTimeout(to);
				w.removeEventListener('message', onmsg);
				res(items.map((it) => ({ path: it.path, error: String((e && e.message) || e) })));
			}
		});
	}

	function babelOpts(path, e) {
		const presets = [['env', { modules: false, targets: { esmodules: true }, loose: true }]];
		const plugins = [];
		if (e === '.ts') presets.push(['typescript', { allowDeclareFields: true }]);
		else {
			presets.push(['react', { runtime: 'automatic' }]);
			presets.push(['typescript', { isTSX: true, allExtensions: true, allowDeclareFields: true }]);
		}
		return {
			presets: presets,
			plugins: plugins,
			filename: path,
			sourceType: 'module',
			compact: false,
			babelrc: false,
			configFile: false,
		};
	}

	async function compileAll(proj, sources) {
		const out = new Map(),
			todo = [],
			keyOf = new Map();
		for (const s of sources) {
			const e = ext(s.path);
			if (!['.jsx', '.tsx', '.ts'].includes(e)) {
				out.set(s.path, s.code);
				continue;
			}
			const key = e + ':' + hash(s.code);
			keyOf.set(s.path, key);
			const hit = cache.get(key);
			if (hit != null) {
				out.set(s.path, hit);
				continue;
			}
			todo.push({ path: s.path, code: s.code, opts: babelOpts(s.path, e) });
		}
		if (!todo.length) return out;
		const total = todo.length;
		let done = 0;
		const report = () => {
			try {
				if (proj && proj.id === State.active)
					setPreviewLoadingDetail(`Compilando TypeScript/JSX... ${done}/${total}`);
			} catch (e) {
				ignorarErro(e, 'report');
			}
		};
		report();
		const want = Math.min(4, Math.max(1, (navigator.hardwareConcurrency || 4) - 1));
		const tick = setInterval(report, 4000);
		let workers = null;
		try {
			workers = await getPool(want);
		} catch (e) {
			workers = null;
		}
		if (workers && workers.length) {
			const parts = chunk(todo, Math.max(1, Math.ceil(todo.length / (workers.length * 3))));
			let next = 0;
			await Promise.all(
				workers.map(async (w) => {
					while (next < parts.length) {
						const mine = parts[next++];
						const res = await runJob(w, mine);
						for (const r of res) {
							if (r.error) {
								try {
									logErr(proj, `Babel (${r.path}): ${r.error}`);
								} catch (e) {
									ignorarErro(e, 'compileAll');
								}
								const src = mine.filter((x) => x.path === r.path)[0];
								out.set(r.path, src ? src.code : '');
							} else {
								out.set(r.path, r.code);
								const k = keyOf.get(r.path);
								if (k) cacheSet(k, r.code);
							}
							done++;
						}
						report();
						await yieldUI();
					}
				}),
			);
			clearInterval(tick);
			try {
				logCmd(
					proj,
					'Compilador: ' +
						workers.length +
						' worker(s) em paralelo' +
						(poolInfo ? ' - ' + poolInfo.replace(/^https?:\/\//, '').split('/')[0] : ''),
				);
			} catch (e) {
				ignorarErro(e, 'compileAll');
			}
			return out;
		}
		let Babel = null;
		try {
			Babel = await loadBabel();
		} catch (e) {
			clearInterval(tick);
			throw e;
		}
		for (const t of todo) {
			try {
				const code = Babel.transform(t.code, t.opts).code;
				out.set(t.path, code);
				const k = keyOf.get(t.path);
				if (k) cacheSet(k, code);
			} catch (e) {
				try {
					logErr(proj, `Babel (${t.path}): ${e.message}`);
				} catch (_e) {
					ignorarErro(_e, 'compileAll');
				}
				out.set(t.path, t.code);
			}
			done++;
			if (done % 2 === 0) {
				report();
				await yieldUI();
			}
		}
		clearInterval(tick);
		report();
		return out;
	}

	function withExt(files, base) {
		if (!base) return null;
		const cands = [
			base,
			base + '.ts',
			base + '.tsx',
			base + '.js',
			base + '.jsx',
			base + '.mjs',
			base + '.json',
			base + '.css',
			base + '/index.ts',
			base + '/index.tsx',
			base + '/index.js',
			base + '/index.jsx',
		];
		for (const c of cands) if (files.has(c)) return c;
		return null;
	}
	function aliasResolve(spec, files, entryDir) {
		const m = /^([@~])\/(.+)$/.exec(spec);
		if (!m) return null;
		const rest = m[2].replace(/[?#].*$/, '');
		const bases = [];
		if (entryDir) {
			bases.push(Core.joinPath(entryDir, 'src/' + rest));
			bases.push(Core.joinPath(entryDir, rest));
		}
		bases.push('src/' + rest);
		bases.push(rest);
		for (const b of bases) {
			const hit = withExt(files, b);
			if (hit) return hit;
		}
		return null;
	}
	function findSourceEntry(files, dir) {
		const names = [
			'src/main.tsx',
			'src/main.ts',
			'src/main.jsx',
			'src/main.js',
			'src/index.tsx',
			'src/index.ts',
			'src/index.jsx',
			'src/index.js',
			'src/app.tsx',
			'src/App.tsx',
			'main.tsx',
			'main.ts',
			'main.jsx',
			'main.js',
			'index.tsx',
			'index.ts',
			'index.jsx',
			'app/main.tsx',
			'app/index.tsx',
		];
		const dirs = [];
		if (dir) dirs.push(dir);
		dirs.push('');
		for (const d of dirs)
			for (const n of names) {
				const p = d ? Core.joinPath(d, n) : n;
				if (files.has(p)) return p;
			}
		return null;
	}
	function resolveMissingRef(files, r, entryDir) {
		if (!r) return null;
		const OUT = [
			'dist',
			'build',
			'out',
			'www',
			'public',
			'.output/public',
			'build/web',
			'dist/assets',
		];
		const rel =
			entryDir && (r === entryDir || r.indexOf(entryDir + '/') === 0)
				? r.slice(entryDir.length + 1)
				: r;
		const bases = [];
		for (const o of OUT)
			bases.push(entryDir ? Core.joinPath(entryDir, o + '/' + rel) : o + '/' + rel);
		const stripped = rel.replace(/^(dist|build|out|public|www)\//, '');
		if (stripped !== rel) bases.push(entryDir ? Core.joinPath(entryDir, stripped) : stripped);
		bases.push(rel);
		for (const b of bases) if (files.has(b)) return b;
		const isCss = /\.(css|scss|sass|less)$/i.test(r);
		const exts = isCss
			? ['.css', '.scss', '.sass', '.less']
			: ['.tsx', '.ts', '.jsx', '.js', '.mjs'];
		for (const b of bases.concat([r])) {
			const nb = b.replace(/\.(js|mjs|cjs|css|scss|sass|less)$/i, '');
			for (const e of exts) if (files.has(nb + e)) return nb + e;
		}
		const bn = Core.basename(r);
		const hits = [];
		for (const p of files.keys()) {
			if (Core.basename(p) === bn) {
				hits.push(p);
				if (hits.length > 1) break;
			}
		}
		return hits.length === 1 ? hits[0] : null;
	}

	const BUILD_DIR_RE =
		/(^|\/)(dist|build|out|www|release|target|\.output|\.next|\.svelte-kit|\.nuxt|\.vercel|\.netlify)\//i;
	function isBuildOutPath(p) {
		return BUILD_DIR_RE.test(String(p || ''));
	}
	function hasRealSources(files) {
		let n = 0;
		for (const p of files.keys()) {
			if (isBuildOutPath(p)) continue;
			if (/\.(tsx|jsx|ts|vue|svelte)$/i.test(p)) n++;
			if (n >= 1) return true;
		}
		return false;
	}
	function isMinified(text) {
		if (!text || text.length < 20000) return false;
		const lines = text.split('\n');
		return text.length / Math.max(1, lines.length) > 240;
	}
	function isBuiltArtifact(files, p) {
		if (!/\.(js|mjs)$/i.test(p || '')) return false;
		if (isBuildOutPath(p)) return true;
		if (/(^|\/)assets\/[^\/]+-[A-Za-z0-9_]{6,}\.(js|mjs)$/.test(p)) return true;
		return isMinified(txt(files, p));
	}
	function preferSourceOver(files, p, entryDir) {
		try {
			if (!isBuiltArtifact(files, p)) return null;
			if (!hasRealSources(files)) return null;
			const se = findSourceEntry(
				files,
				entryDir && !isBuildOutPath(entryDir + '/') ? entryDir : '',
			);
			if (!se || se === p || isBuildOutPath(se)) return null;
			return se;
		} catch (e) {
			return null;
		}
	}

	function htmlEntryScore(files, path) {
		const text = txt(files, path);
		if (!text) return -1;
		const dir = Core.dirname(path);
		const res = (v) => {
			const clean = String(v).replace(/[?#].*$/, '');
			if (!clean) return null;
			if (clean.charAt(0) === '/') {
				const rel = clean.replace(/^\/+/, '');
				const sc = dir ? Core.joinPath(dir, rel) : rel;
				if (files.has(sc)) return sc;
				return files.has(rel) ? rel : null;
			}
			const r = Core.joinPath(dir, clean);
			return files.has(r) ? r : null;
		};
		let tot = 0,
			ok = 0,
			st = 0,
			sok = 0;
		const re = /<(script|link|img|source|iframe)\b[^>]*?\b(?:src|href)\s*=\s*["']([^"']+)["']/gi;
		let m;
		while ((m = re.exec(text))) {
			const tag = m[1].toLowerCase(),
				v = m[2];
			if (/^([a-z][a-z0-9+.-]*:)?\/\//i.test(v) || /^(data:|blob:|#|mailto:|javascript:)/i.test(v))
				continue;
			tot++;
			const hit = res(v);
			if (hit) ok++;
			if (tag === 'script') {
				st++;
				if (hit) sok++;
			}
		}
		if (!st && /<script[^>]*type\s*=\s*["']module["'][^>]*>/i.test(text)) {
			st = 1;
			sok = 1;
		}
		const sScore = st ? sok / st : 0.4,
			rScore = tot ? ok / tot : 0.4;
		return sScore * 2 + rScore;
	}
	function pickBestEntry(files, detect) {
		try {
			if (detect && detect.framework === 'flutter') return null;
			const htmls = [];
			for (const p of files.keys()) if (ext(p) === '.html') htmls.push(p);
			if (!htmls.length) return null;
			if (htmls.length === 1) return htmls[0];
			htmls.sort((a, b) => a.split('/').length - b.split('/').length || a.length - b.length);
			const cur = detect && detect.entry;
			const srcMode = hasRealSources(files);
			let srcHtmlUsable = false;
			for (const h of htmls) {
				if (!isBuildOutPath(h) && htmlEntryScore(files, h) >= 1.9) {
					srcHtmlUsable = true;
					break;
				}
			}
			let best = null,
				bestScore = -1e9;
			for (const h of htmls) {
				const depth = h.split('/').length - 1;
				let s = htmlEntryScore(files, h) - 0.12 * depth;
				if (/(^|\/)index\.html$/.test(h)) s += 0.2;
				if (/(^|\/)(200|404|offline|error|template)\.html$/.test(h)) s -= 1.5;
				if (srcMode && isBuildOutPath(h)) s -= srcHtmlUsable ? 3 : 0;
				if (h === cur) s += 0.05;
				if (s > bestScore) {
					bestScore = s;
					best = h;
				}
			}
			return best;
		} catch (e) {
			return null;
		}
	}

	function markModule(node, files, path) {
		const t = String(node.getAttribute('type') || '').toLowerCase();
		if (t === 'module') return;
		const e = ext(path);
		if (['.tsx', '.ts', '.jsx', '.mjs'].includes(e)) {
			node.setAttribute('type', 'module');
			return;
		}
		if (e === '.js' && looksLikeModule(txt(files, path))) node.setAttribute('type', 'module');
	}
	function collectInlineRoots(dom, files, resolve, entryDir, push) {
		const list = dom.querySelectorAll('script');
		for (let i = 0; i < list.length; i++) {
			const node = list[i];
			const t = String(node.getAttribute('type') || '').toLowerCase();
			if (t !== 'module' || node.getAttribute('src')) continue;
			const code = node.textContent || '';
			const re = /(?:\bfrom\s*|\bimport\s*|\bexport\s*\*\s*from\s*|\bimport\()\s*(["'])([^"']+)\1/g;
			let m;
			while ((m = re.exec(code))) {
				const spec = m[2];
				if (spec.charAt(0) === '.' || spec.charAt(0) === '/') {
					const r = resolve(spec.replace(/[?#].*$/, ''));
					const hit = files.has(r) ? r : withExt(files, r);
					if (hit) push(hit);
				} else {
					const a = aliasResolve(spec, files, entryDir);
					if (a) push(a);
				}
			}
		}
	}
	function ensureMount(dom, files, roots) {
		try {
			let code = '';
			for (const r of roots) code += txt(files, r).slice(0, 20000);
			const ids = new Set();
			let m;
			const re1 = /getElementById\(\s*["']([\w-]+)["']\s*\)/g;
			while ((m = re1.exec(code))) ids.add(m[1]);
			const re2 = /querySelector\(\s*["']#([\w-]+)["']\s*\)/g;
			while ((m = re2.exec(code))) ids.add(m[1]);
			ids.forEach((id) => {
				try {
					if (dom.getElementById && dom.getElementById(id)) return;
					if (dom.querySelector('#' + id)) return;
					const d = dom.createElement('div');
					d.id = id;
					const host = dom.body || dom.documentElement;
					host.insertBefore(d, host.firstChild);
				} catch (e) {
					ignorarErro(e, 'ensureMount');
				}
			});
		} catch (e) {
			ignorarErro(e, 'ensureMount');
		}
	}
	function fixEntryScripts(proj, dom, files, resolve, entryDir) {
		const roots = [];
		const notes = [];
		const push = (p) => {
			if (p && files.has(p) && !roots.includes(p)) roots.push(p);
		};
		const list = dom.querySelectorAll('script[src]');
		for (let i = 0; i < list.length; i++) {
			const node = list[i];
			const v = node.getAttribute('src') || '';
			if (/^([a-z][a-z0-9+.-]*:)?\/\//i.test(v) || /^(data:|blob:)/i.test(v)) continue;
			const r = resolve(v);
			if (files.has(r)) {
				const sub = preferSourceOver(files, r, entryDir);
				if (sub) {
					node.setAttribute('data-aurora-src', sub);
					node.removeAttribute('src');
					node.removeAttribute('defer');
					markModule(node, files, sub);
					push(sub);
					const w2 = `"${v}" e um bundle ja compilado (${r}). Compilei a FONTE "${sub}" no navegador - assim o preview mostra o codigo atual do projeto, e nao o build antigo.`;
					notes.push(w2);
					try {
						logCmd(proj, 'Entrada corrigida: ' + w2);
					} catch (e) {
						ignorarErro(e, 'fixEntryScripts');
					}
					continue;
				}
				push(r);
				markModule(node, files, r);
				continue;
			}
			let alt = resolveMissingRef(files, r, entryDir),
				why = '';
			if (alt) why = `o script "${v}" nao existe no projeto - usei "${alt}" no lugar.`;
			else {
				const se = findSourceEntry(files, entryDir);
				if (se) {
					alt = se;
					why = `o script "${v}" e gerado pelo build (nao veio no projeto) - compilei a fonte "${se}" direto no navegador.`;
				}
			}
			if (alt) {
				node.setAttribute('data-aurora-src', alt);
				node.removeAttribute('src');
				node.removeAttribute('defer');
				markModule(node, files, alt);
				push(alt);
				notes.push(why);
				try {
					logCmd(proj, 'Entrada corrigida: ' + why);
				} catch (e) {
					ignorarErro(e, 'fixEntryScripts');
				}
			}
		}
		collectInlineRoots(dom, files, resolve, entryDir, push);
		if (!roots.length) {
			const se = findSourceEntry(files, entryDir);
			if (se) {
				const s = dom.createElement('script');
				s.setAttribute('type', 'module');
				s.setAttribute('data-aurora-src', se);
				(dom.body || dom.documentElement).appendChild(s);
				push(se);
				try {
					logCmd(
						proj,
						`Entrada corrigida: o HTML nao tinha script utilizavel - injetei "${se}" (compilado no navegador).`,
					);
				} catch (e) {
					ignorarErro(e, 'fixEntryScripts');
				}
			}
		}
		if (roots.length) ensureMount(dom, files, roots);
		return { roots: roots, notes: notes };
	}
	function synthesizeEntry(files) {
		const se = findSourceEntry(files, '');
		if (!se) return null;
		const dir = Core.dirname(se).replace(/\/?src$/, '');
		const title = (function () {
			try {
				const f = files.get('package.json');
				const j = f ? JSON.parse(fileText(f)) : null;
				return (j && j.name) || 'App';
			} catch (e) {
				return 'App';
			}
		})();
		const rel = dir ? se.slice(dir.length + 1) : se;
		const S = 'script';
		const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" \
content="width=device-width, initial-scale=1"><title>${title}</title></head><body><div id="root"></div>\
<div id="app"></div><${S} type="module" src="./${rel}"></${S}></body></html>`;
		return { html: html, dir: dir, entrySource: se };
	}

	function moduleGraph(files, roots, pkgMap, entryDir) {
		const js = [],
			assets = new Set(),
			seen = new Set();
		const queue = (roots || []).filter((p) => files.has(p));
		const resolveRel = (dir, spec) => {
			const clean = spec.replace(/[?#].*$/, '');
			let base;
			if (clean.charAt(0) === '/') {
				const rel = Core.normalizePath(clean).replace(/^\/+/, '');
				base = (entryDir && withExt(files, Core.joinPath(entryDir, rel))) || rel;
			} else base = Core.joinPath(dir, clean);
			return files.has(base) ? base : withExt(files, base);
		};
		while (queue.length) {
			const p = queue.shift();
			if (seen.has(p)) continue;
			seen.add(p);
			if (!isJs(p)) {
				assets.add(p);
				continue;
			}
			js.push(p);
			const code = txt(files, p),
				dir = Core.dirname(p);
			const re = /(?:\bfrom\s*|\bimport\s*|\bexport\s*\*\s*from\s*|\bimport\()\s*(["'])([^"']+)\1/g;
			let m;
			while ((m = re.exec(code))) {
				const spec = m[2];
				let hit = null;
				if (spec.charAt(0) === '.' || spec.charAt(0) === '/') hit = resolveRel(dir, spec);
				else if (spec.charAt(0) === '~') hit = aliasResolve(spec, files, entryDir);
				else
					hit =
						aliasResolve(spec, files, entryDir) ||
						resolveInternalPkg(spec.replace(/[?#].*$/, ''), pkgMap, files);
				if (hit && !seen.has(hit)) queue.push(hit);
			}
		}
		return { js: js, assets: assets };
	}

	function collectDeps(files) {
		const deps = {};
		const paths = [];
		for (const p of files.keys()) if (Core.basename(p) === 'package.json') paths.push(p);
		paths.sort((a, b) => b.split('/').length - a.split('/').length);
		for (const p of paths) {
			try {
				const j = JSON.parse(fileText(files.get(p)));
				Object.assign(deps, j.devDependencies || {}, j.dependencies || {});
			} catch (e) {
				ignorarErro(e, 'collectDeps');
			}
		}
		return deps;
	}
	function isNodeBuiltin(s) {
		const n = String(s)
			.replace(/^node:/, '')
			.split('/')[0];
		return /^node:/.test(String(s)) || NODE_BUILTINS.has(n);
	}
	function isValidBareSpec(s) {
		if (typeof s !== 'string') return false;
		s = s.trim();
		if (!s || s.length > 200) return false;
		if (/^(\.|\/|https?:|data:|blob:|file:|node:)/i.test(s)) return false;
		if (isNodeBuiltin(s)) return false;
		return /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*(\/[a-z0-9@._\/-]+)?$/i.test(s);
	}
	function esmUrl(spec, deps) {
		const pkg = spec.charAt(0) === '@' ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
		let v = deps && deps[pkg] ? String(deps[pkg]) : '';
		v = v.replace(/^[\^~>=<\s]+/, '').trim();
		const ok = /^\d+(\.\d+)*([-+][\w.]+)?$/.test(v);
		return 'https://esm.sh/' + pkg + (ok ? '@' + v : '') + spec.slice(pkg.length);
	}
	function cleanVer(v) {
		v = String(v == null ? '' : v)
			.replace(/^[\^~>=<\s]+/, '')
			.trim();
		return /^\d+(\.\d+)*([-+][\w.]+)?$/.test(v) ? v : '';
	}
	function pkgOfSpec(spec) {
		return spec.charAt(0) === '@' ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
	}
	function withQuery(url, q) {
		return url + (url.includes('?') ? '&' : '?') + q;
	}
	function jsxShim(proj, reactUrl, dev) {
		const rt = reactUrl + (dev ? '/jsx-dev-runtime' : '/jsx-runtime');
		const code = [
			'import * as __RN from "react";',
			'const R=(__RN&&__RN.default&&__RN.default.createElement)?__RN.default:__RN;',
			'const CE=R&&R.createElement;',
			`const __RT=await Promise.race([import(${JSON.stringify(rt)}).catch(function(){return null;}),new Promise(function(r){setTimeout(function(){r(null);},9000);})]);`,
			'function pick(m,n){var f=m&&m[n];if(typeof f!=="function"&&m&&m.default&&typeof ' +
				'm.default==="object")f=m.default[n];if(typeof f!=="function"&&typeof ' +
				'm==="function"&&n.indexOf("jsx")===0)f=m;return typeof f==="function"?f:null;}',
			'function make(type,props,key){var p={},k;props=props||{};for(k in props)' +
				'{if(k!=="children")p[k]=props[k];}if(key!==undefined&&key!==null)p.key=key;var ' +
				'c=props.children;if(c===undefined)return CE(type,p);return Array.isArray(c)' +
				'?CE.apply(null,[type,p].concat(c)):CE(type,p,c);}',
			'if(!CE&&!pick(__RT,"jsx"))console.error("[Synapse] Nao consegui carregar o React (esm.sh). Verifique a conexao ou o bloqueio de CDN.");',
			'const _F=(__RT&&(__RT.Fragment||(__RT.default&&__RT.default.Fragment)))||(R&&R.Fragment);',
			'const _jsx=pick(__RT,"jsx")||make;',
			'const _jsxs=pick(__RT,"jsxs")||_jsx;',
			'const _jsxDEV=pick(__RT,"jsxDEV")||_jsx;',
			'export {_F as Fragment,_jsx as jsx,_jsxs as jsxs,_jsxDEV as jsxDEV};',
			'export default {Fragment:_F,jsx:_jsx,jsxs:_jsxs,jsxDEV:_jsxDEV};',
		].join('\n');
		return mkBlob(proj, code, 'text/javascript');
	}
	function reactImports(proj, bare, deps) {
		const list = [...(bare || [])];
		const rv = cleanVer(deps && deps['react']);
		const dv = cleanVer(deps && deps['react-dom']) || rv;
		const uses = !!(
			(deps && (deps['react'] || deps['react-dom'])) ||
			list.some((b) => {
				const p = pkgOfSpec(b);
				return p === 'react' || p === 'react-dom';
			})
		);
		const R = 'https://esm.sh/react' + (rv ? '@' + rv : '');
		const D = 'https://esm.sh/react-dom' + (dv ? '@' + dv : '');
		const extra = {};
		const url = (spec) => {
			if (!uses) return esmUrl(spec, deps);
			const pkg = pkgOfSpec(spec);
			if (pkg === 'react') {
				if (spec === 'react') return R;
				if (spec === 'react/jsx-runtime') return jsxShim(proj, R, false);
				if (spec === 'react/jsx-dev-runtime') return jsxShim(proj, R, true);
				return R + spec.slice(5);
			}
			if (pkg === 'react-dom') return withQuery(D + spec.slice(9), 'external=react');
			return withQuery(esmUrl(spec, deps), 'external=react,react-dom');
		};
		if (uses) {
			extra['react'] = R;
			extra['react/'] = R + '/';
			extra['react-dom'] = withQuery(D, 'external=react');
			extra['react-dom/client'] = withQuery(D + '/client', 'external=react');
			extra['react-dom/server'] = withQuery(D + '/server', 'external=react');
			extra['react/jsx-runtime'] = jsxShim(proj, R, false);
			extra['react/jsx-dev-runtime'] = jsxShim(proj, R, true);
		}
		return { uses: uses, url: url, extra: extra, react: R, reactDom: D };
	}

	function assetModule(proj, files, path, rawUrl, processCss) {
		const e = ext(path);
		let code;
		if (STYLE_EXT.includes(e)) {
			let u = rawUrl[path];
			try {
				if (e === '.css' && typeof processCss === 'function') u = processCss(path);
			} catch (err) {
				ignorarErro(err, 'assetModule');
			}
			code = `var __u=${JSON.stringify(u || '')};try{var l=document.createElement("link");l.rel="stylesheet";l.href=__u;document.head.appendChild(l);}catch(e){}\nexport default __u;`;
		} else if (e === '.json') {
			code = `const d=JSON.parse(${JSON.stringify(txt(files, path) || 'null')});\nexport default d;`;
		} else {
			code = `export default ${JSON.stringify(rawUrl[path] || '')};`;
		}
		return mkBlob(proj, code, 'text/javascript');
	}
	function fixMeta(code) {
		if (!code || !code.includes('import.meta')) return code;
		return code
			.replace(/import\.meta\.env\b/g, '(globalThis.__AURORA_ENV__||{})')
			.replace(/import\.meta\.hot\b/g, 'undefined')
			.replace(/import\.meta\.glob\b/g, '(globalThis.__AURORA_GLOB__||function(){return{};})')
			.replace(/import\.meta\.url\b/g, '(globalThis.__AURORA_URL__||document.baseURI)');
	}

	function hideRunServerChip() {
		const c = document.getElementById('auroraRunChip');
		if (c) c.style.display = 'none';
	}
	function showRunServerChip(proj) {
		try {
			if (typeof auroraServerSupport === 'function') {
				const sup = auroraServerSupport();
				if (!sup.ok && !sup.fixable) {
					try {
						logCmd(
							proj,
							'Modo Servidor real indisponivel neste navegador - seguindo no Modo Runtime. ' +
								sup.why,
						);
					} catch (e) {
						ignorarErro(e, 'showRunServerChip');
					}
					hideRunServerChip();
					return;
				}
			}
			const host = (el.device && el.device.parentElement) || el.previewPane;
			if (!host) return;
			if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
			let chip = document.getElementById('auroraRunChip');
			if (!chip) {
				chip = document.createElement('button');
				chip.id = 'auroraRunChip';
				chip.type = 'button';
				chip.style.cssText =
					'position:absolute;right:14px;bottom:14px;z-index:40;display:flex;gap:8px;align-items:' +
					'center;padding:9px 14px;border-radius:999px;border:1px solid rgba(122,167,255,.45);' +
					'background:rgba(15,20,32,.94);color:#dce6ff;font:600 12px/1.1 system-ui,-apple-system,' +
					'Segoe UI,sans-serif;cursor:pointer;box-shadow:0 10px 26px rgba(0,0,0,.5)';
				chip.textContent = '▶  Rodar servidor real (npm)';
				chip.title =
					'Instala as dependencias e sobe o dev server dentro do navegador (WebContainers). Pode levar minutos.';
				chip.addEventListener('click', startRealServer);
				host.appendChild(chip);
			}
			chip.style.display = 'flex';
		} catch (e) {
			ignorarErro(e, 'showRunServerChip');
		}
	}
	function startRealServer() {
		const p = activeProject();
		if (!p) return;
		try {
			localStorage.setItem('aurora.autorun', 'on');
		} catch (e) {
			ignorarErro(e, 'startRealServer');
		}
		hideRunServerChip();
		tryAutoRun(p);
	}
	function maybeAutoRun(proj) {
		const n = proj && proj.files ? proj.files.size : 0;
		let pref = null;
		try {
			pref = localStorage.getItem('aurora.autorun');
		} catch (e) {
			ignorarErro(e, 'maybeAutoRun');
		}
		if (pref === 'on' || (n <= AUTORUN_LIMIT && pref !== 'off')) return tryAutoRun(proj);
		try {
			logCmd(
				proj,
				`Projeto grande (${n} arquivos): nao iniciei npm/WebContainers automaticamente - o preview do modo Runtime aparece na hora.`,
			);
			logCmd(
				proj,
				'Para instalar dependencias e subir o dev server de verdade, clique em "Rodar servidor real (npm)" no canto do preview.',
			);
		} catch (e) {
			ignorarErro(e, 'maybeAutoRun');
		}
		showRunServerChip(proj);
	}

	return {
		NODE_BUILTINS: NODE_BUILTINS,
		MAX_BLIND: MAX_BLIND,
		AUTORUN_LIMIT: AUTORUN_LIMIT,
		yieldUI: yieldUI,
		hash: hash,
		chunk: chunk,
		cache: cache,
		compileAll: compileAll,
		babelOpts: babelOpts,
		getPool: getPool,
		withExt: withExt,
		aliasResolve: aliasResolve,
		findSourceEntry: findSourceEntry,
		resolveMissingRef: resolveMissingRef,
		htmlEntryScore: htmlEntryScore,
		pickBestEntry: pickBestEntry,
		fixEntryScripts: fixEntryScripts,
		synthesizeEntry: synthesizeEntry,
		ensureMount: ensureMount,
		moduleGraph: moduleGraph,
		collectDeps: collectDeps,
		isValidBareSpec: isValidBareSpec,
		isNodeBuiltin: isNodeBuiltin,
		esmUrl: esmUrl,
		assetModule: assetModule,
		fixMeta: fixMeta,
		looksLikeModule: looksLikeModule,
		reactImports: reactImports,
		isBuiltArtifact: isBuiltArtifact,
		preferSourceOver: preferSourceOver,
		isBuildOutPath: isBuildOutPath,
		hasRealSources: hasRealSources,
		maybeAutoRun: maybeAutoRun,
		startRealServer: startRealServer,
		showRunServerChip: showRunServerChip,
		hideRunServerChip: hideRunServerChip,
	};
})();
window.startRealServer = AuroraFix.startRealServer;

let babelPromise = null;
function loadScriptOnce(url) {
	return new Promise((res, rej) => {
		const s = document.createElement('script');
		s.crossOrigin = 'anonymous';
		s.src = url;
		let done = false;
		const to = setTimeout(() => {
			if (done) return;
			done = true;
			try {
				s.remove();
			} catch (e) {
				ignorarErro(e, 'loadScriptOnce');
			}
			rej(new Error('tempo esgotado: ' + url));
		}, 20000);
		s.onload = () => {
			if (done) return;
			done = true;
			clearTimeout(to);
			res();
		};
		s.onerror = () => {
			if (done) return;
			done = true;
			clearTimeout(to);
			try {
				s.remove();
			} catch (e) {
				ignorarErro(e, 'onerror');
			}
			rej(new Error('falha ao carregar: ' + url));
		};
		document.head.appendChild(s);
	});
}
function loadBabel() {
	if (window.Babel) return Promise.resolve(window.Babel);
	if (babelPromise) return babelPromise;
	babelPromise = (async () => {
		let last = null;
		for (const url of AURORA_BABEL_CDNS) {
			try {
				await loadScriptOnce(url);
				if (window.Babel) return window.Babel;
			} catch (e) {
				last = e;
			}
		}
		babelPromise = null;
		throw new Error(
			'Não foi possível carregar o compilador (CDN bloqueada pelo COEP ou sem internet). Com COOP/COEP ligados, use "Cross-Origin-Embedder-Policy: credentialless". Detalhe: ' +
				((last && last.message) || 'sem resposta'),
		);
	})();
	return babelPromise;
}
async function tryBuildModules(proj, files, rawUrl, roots, processCss, entryDir) {
	const JSX = ['.jsx', '.tsx', '.ts'];
	const JS = ['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx'];
	const isJsPath = (p) => JS.includes(Core.extname(p));
	const pkgMap = buildInternalPkgMap(files);
	const deps = AuroraFix.collectDeps(files);
	const graph = AuroraFix.moduleGraph(files, roots, pkgMap, entryDir || '');
	let seed = graph.js,
		scoped = true;
	const assetSet = new Set(graph.assets);
	if (!seed.length) {
		scoped = false;
		seed = [...files.keys()].filter(isJsPath);
		if (seed.length > AuroraFix.MAX_BLIND) {
			logErr(
				proj,
				`Sem entrada HTML utilizável: compilei só os primeiros ${AuroraFix.MAX_BLIND} de ${seed.length} módulos (evita travar a página).`,
			);
			seed = seed.slice(0, AuroraFix.MAX_BLIND);
		}
	}
	const t0 = window.performance && performance.now ? performance.now() : Date.now();
	const bare = new Set(),
		nodeReq = new Set(),
		jsSet = new Set(seed),
		transformed = {};
	const RX = /https:\/\/aurora\.local\/([^"'`)\s>]+)/g;
	let pending = seed.slice(),
		rounds = 0,
		usedBabel = false;
	while (pending.length && rounds < 4) {
		rounds++;
		if (pending.some((p) => JSX.includes(Core.extname(p)))) usedBabel = true;
		const sources = pending.map((p) => ({ path: p, code: fileText(files.get(p)) || '' }));
		const compiled = await AuroraFix.compileAll(proj, sources);
		const next = [];
		let i = 0;
		for (const p of pending) {
			const out = rewriteImports(
				AuroraFix.fixMeta(compiled.get(p) || ''),
				p,
				files,
				bare,
				pkgMap,
				entryDir || '',
				nodeReq,
			);
			transformed[p] = out;
			RX.lastIndex = 0;
			let m;
			while ((m = RX.exec(out))) {
				let q = m[1];
				try {
					q = decodeURIComponent(q);
				} catch (e) {
					ignorarErro(e, 'tryBuildModules');
				}
				if (!files.has(q)) continue;
				if (isJsPath(q)) {
					if (!jsSet.has(q)) {
						jsSet.add(q);
						next.push(q);
					}
				} else assetSet.add(q);
			}
			if (++i % 80 === 0) await AuroraFix.yieldUI();
		}
		pending = next;
	}
	const modules = {},
		imports = {};
	const jsFiles = [...jsSet].filter((p) => transformed[p] != null);
	for (const p of jsFiles) {
		const u = mkBlob(proj, transformed[p], 'text/javascript');
		modules[p] = u;
		imports['https://aurora.local/' + p] = u;
		imports['/' + p] = u;
	}
	for (const a of assetSet) {
		if (modules[a] || !files.has(a)) continue;
		const u = AuroraFix.assetModule(proj, files, a, rawUrl, processCss);
		modules[a] = u;
		imports['https://aurora.local/' + a] = u;
		imports['/' + a] = u;
	}
	const RIM = AuroraFix.reactImports(proj, bare, deps);
	for (const b of bare) imports[b] = RIM.url(b);
	Object.assign(imports, RIM.extra);
	if (RIM.uses)
		logCmd(
			proj,
			'React fixado em uma unica copia (' +
				RIM.react.replace('https://esm.sh/', '') +
				') + ponte propria para react/jsx-runtime.',
		);
	const ms = Math.round(
		(window.performance && performance.now ? performance.now() : Date.now()) - t0,
	);
	const bl = [...bare];
	logCmd(
		proj,
		'Runtime build: ' +
			jsFiles.length +
			' módulo(s)' +
			(assetSet.size ? ` + ${assetSet.size} asset(s)` : '') +
			(scoped ? ' (grafo da entrada)' : ' (projeto inteiro)') +
			(bl.length
				? ', deps via esm.sh: ' +
					bl.slice(0, 12).join(', ') +
					(bl.length > 12 ? ` (+${bl.length - 12})` : '')
				: '') +
			(usedBabel ? ' · JSX/TS compilado' : '') +
			' · ' +
			ms +
			'ms',
	);
	if (nodeReq.size)
		logErr(
			proj,
			`Imports de Node ignorados (${[...nodeReq].slice(0, 8).join(', ')}): esses arquivos são de build/servidor e não rodam no navegador.`,
		);
	return { modules: modules, importMap: { imports: imports } };
}
function buildInternalPkgMap(files) {
	const map = {};
	for (const p of files.keys()) {
		if (Core.basename(p) !== 'package.json') continue;
		let json;
		try {
			json = JSON.parse(fileText(files.get(p)));
		} catch (e) {
			continue;
		}
		if (json && typeof json.name === 'string' && json.name)
			map[json.name] = { dir: Core.dirname(p), pkg: json };
	}
	return map;
}
function resolveInternalPkg(spec, pkgMap, files) {
	if (!pkgMap) return null;
	const scoped = spec.startsWith('@');
	const name = spec
		.split('/')
		.slice(0, scoped ? 2 : 1)
		.join('/');
	const info = pkgMap[name];
	if (!info) return null;
	const dir = info.dir,
		pkg = info.pkg || {};
	const sub = spec.slice(name.length).replace(/^\//, '');
	const exts = [
		'',
		'.ts',
		'.tsx',
		'.js',
		'.jsx',
		'.mjs',
		'.cjs',
		'/index.ts',
		'/index.tsx',
		'/index.js',
		'/index.jsx',
	];
	const cand = [];
	const add = (base) => {
		if (base == null) return;
		base = String(base).replace(/^\.\//, '');
		for (const e of exts) cand.push(dir ? Core.joinPath(dir, base + e) : base + e);
	};
	const fromExports = (d) => {
		if (typeof d === 'string') add(d);
		else if (d && typeof d === 'object')
			['development', 'source', 'import', 'module', 'browser', 'default', 'require'].forEach(
				(k) => {
					if (typeof d[k] === 'string') add(d[k]);
				},
			);
	};
	if (sub) {
		if (pkg.exports && typeof pkg.exports === 'object') {
			const k = './' + sub;
			if (pkg.exports[k]) fromExports(pkg.exports[k]);
		}
		add(sub);
		add('src/' + sub);
		add('dist/' + sub);
	} else {
		if (pkg.exports) {
			const d =
				typeof pkg.exports === 'object' && pkg.exports['.'] !== undefined
					? pkg.exports['.']
					: pkg.exports;
			fromExports(d);
		}
		add(pkg.module);
		add(pkg.main);
		add('index');
		add('src/index');
		add('src/main');
	}
	return cand.find((c) => files.has(c)) || null;
}
function rewriteImports(code, path, files, bare, pkgMap, entryDir, nodeReq) {
	const dir = Core.dirname(path);
	const repl = (spec) => {
		const clean = String(spec).replace(/[?#].*$/, '');
		if (clean.charAt(0) === '.' || clean.charAt(0) === '/') {
			const bases = [];
			if (clean.charAt(0) === '/') {
				const rel = Core.normalizePath(clean).replace(/^\/+/, '');
				if (entryDir) bases.push(Core.joinPath(entryDir, rel));
				bases.push(rel);
			} else bases.push(Core.joinPath(dir, clean));
			for (const b of bases) {
				const hit = files.has(b) ? b : AuroraFix.withExt(files, b);
				if (hit) return 'https://aurora.local/' + hit;
			}
			return spec;
		}
		const alias = AuroraFix.aliasResolve(clean, files, entryDir);
		if (alias) return 'https://aurora.local/' + alias;
		const local = resolveInternalPkg(clean, pkgMap, files);
		if (local) return 'https://aurora.local/' + local;
		if (AuroraFix.isNodeBuiltin(clean)) {
			if (nodeReq) nodeReq.add(clean);
			return spec;
		}
		if (AuroraFix.isValidBareSpec(clean)) bare.add(clean);
		return spec;
	};
	code = code.replace(
		/(\bfrom\s*|\bimport\s*|\bexport\s*\*\s*from\s*|\bimport\()\s*(["'])([^"']+)\2/g,
		(m, pre, q, spec) => pre + q + repl(spec) + q,
	);
	return code;
}
function resolveImportMapLocals(map, resolve, files, rawUrl, modules) {
	const fix = (v) => {
		if (typeof v !== 'string' || !v) return v;
		if (/^([a-z][a-z0-9+.-]*:)?\/\//i.test(v) || /^(data:|blob:)/i.test(v)) return v;
		if (!(v.startsWith('./') || v.startsWith('../') || v.startsWith('/'))) return v;
		const r = resolve(v);
		if (files.has(r)) return (modules && modules[r]) || rawUrl[r] || v;
		return v;
	};
	if (map.imports) for (const k of Object.keys(map.imports)) map.imports[k] = fix(map.imports[k]);
	if (map.scopes)
		for (const s of Object.keys(map.scopes))
			for (const k of Object.keys(map.scopes[s])) map.scopes[s][k] = fix(map.scopes[s][k]);
}
function mergeImportMaps(hostMap, projMaps, log) {
	const merged = { imports: Object.assign({}, (hostMap && hostMap.imports) || {}) };
	const projImports = {};
	let projScopes = null;
	for (const m of projMaps || []) {
		Object.assign(projImports, m.imports || {});
		if (m.scopes) {
			projScopes = projScopes || {};
			for (const s of Object.keys(m.scopes))
				projScopes[s] = Object.assign({}, projScopes[s] || {}, m.scopes[s]);
		}
	}
	const projKeys = Object.keys(projImports);
	const coveredBy = (spec) =>
		projImports[spec] != null || projKeys.some((k) => k.endsWith('/') && spec.startsWith(k));
	const pkgOf = (spec) => {
		const seg = String(spec).split('/');
		return spec.startsWith('@') ? seg.slice(0, 2).join('/') : seg[0];
	};
	const pinnedVersion = (pkg) => {
		if (!pkg) return null;
		for (const k of projKeys) {
			if (k === pkg || k.startsWith(pkg + '/')) {
				const m = String(projImports[k]).match(/@(\d[^/]*)/);
				if (m) return m[1];
			}
		}
		return null;
	};
	for (const k of Object.keys(merged.imports)) {
		if (coveredBy(k)) {
			delete merged.imports[k];
			continue;
		}
		const ver = pinnedVersion(pkgOf(k));
		if (ver && merged.imports[k] === 'https://esm.sh/' + k) {
			const pkg = pkgOf(k);
			merged.imports[k] = 'https://esm.sh/' + pkg + '@' + ver + k.slice(pkg.length);
			if (log) log(`"${k}" fixado em ${pkg}@${ver} (versão do projeto)`);
		}
	}
	if (projKeys.length && log) log('usando versões do projeto para: ' + projKeys.join(', '));
	Object.assign(merged.imports, projImports);
	if (projScopes) merged.scopes = projScopes;
	return merged;
}

window.addEventListener('message', (e) => {
	const isMainC = el.frame && e.source === el.frame.contentWindow;
	const hprojC = isMainC ? null : headlessProjBySource(e.source);
	if (!isMainC && !hprojC) return;
	const d = e.data;
	if (d && d.__lp_console) {
		const proj = hprojC || activeProject();
		if (!proj) return;
		const lv = ['log', 'info', 'warn', 'error', 'debug', 'cmd'].includes(d.level) ? d.level : 'log';
		const text = String(d.text == null ? '' : d.text).slice(0, 5000);
		const src = String(d.src == null ? '' : d.src).slice(0, 300);
		pushLog(proj, lv, text, src);
	}
});
function pushLog(proj, level, text, src) {
	proj.logs.push({ level, text, src, t: Date.now() });
	if (proj.id === State.active) renderConsole();
	updateBadge(proj);
}
function logCmd(proj, text) {
	proj.logs.push({ level: 'cmd', text, t: Date.now() });
	if (proj.id === State.active) renderConsole();
}
function logErr(proj, text) {
	proj.logs.push({ level: 'error', text, t: Date.now() });
	if (proj.id === State.active) renderConsole();
	updateBadge(proj);
}
function updateBadge(proj) {
	const errs = proj.logs.filter((l) => l.level === 'error').length;
	el.consoleBadge.classList.toggle('hidden', errs === 0);
	el.consoleBadge.textContent = errs > 99 ? '99+' : errs;
	el.consoleBtn.classList.toggle('on', State.consoleOpen);
}
function fmtLogTime(t) {
	try {
		const d = new Date(t);
		return (
			d.toLocaleTimeString('pt-BR', { hour12: false }) +
			'.' +
			String(d.getMilliseconds()).padStart(3, '0')
		);
	} catch (e) {
		return '';
	}
}
function renderConsole() {
	const proj = activeProject();
	if (!proj) {
		el.consoleBody.innerHTML = '';
		return;
	}
	const f = State.consoleFilter;
	const q = (State.consoleSearch || '').trim().toLowerCase();
	el.cAll.textContent = proj.logs.length;
	el.cErr.textContent = proj.logs.filter((l) => l.level === 'error').length;
	el.cWarn.textContent = proj.logs.filter((l) => l.level === 'warn').length;
	let logs = proj.logs.filter((l) =>
		f === 'all' ? true : f === 'cmd' ? l.level === 'cmd' : l.level === f,
	);
	if (q)
		logs = logs.filter((l) => ((l.text || '') + ' ' + (l.src || '')).toLowerCase().includes(q));
	if (!logs.length) {
		el.consoleBody.innerHTML = `<div class="console-empty">${q ? 'Nenhuma mensagem corresponde ao filtro.' : 'Sem mensagens neste filtro.'}</div>`;
		return;
	}
	const groups = [];
	for (const l of logs) {
		const p = groups[groups.length - 1];
		if (p && p.level === l.level && p.text === l.text && p.src === l.src) {
			p.count++;
			p.t = l.t;
		} else groups.push({ level: l.level, text: l.text, src: l.src, t: l.t, count: 1 });
	}
	el.consoleBody.innerHTML = groups
		.map((l) => {
			const ic =
				l.level === 'error'
					? 'err'
					: l.level === 'warn'
						? 'warn'
						: l.level === 'cmd'
							? 'term'
							: 'info';
			return (
				'<div class="log ' +
				l.level +
				'"><span class="lg-time">' +
				esc(fmtLogTime(l.t)) +
				'</span>' +
				iconSvg(ic, 'lg-ico') +
				(l.count > 1 ? `<span class="lg-count">${l.count}</span>` : '') +
				'<span class="lg-txt">' +
				esc(l.text) +
				'</span>' +
				(l.src ? `<span class="lg-src">${esc(l.src)}</span>` : '') +
				'</div>'
			);
		})
		.join('');
	el.consoleBody.scrollTop = el.consoleBody.scrollHeight;
}
function openConsole(open) {
	State.consoleOpen = open;
	el.console.classList.toggle('open', open);
	el.consoleBtn.classList.toggle('on', open);
	if (open) {
		try {
			(renderConsole.__orig || renderConsole)();
		} catch (e) {
			ignorarErro(e, 'openConsole');
		}
	}
}

function openPopout() {
	const proj = activeProject();
	if (!proj) {
		toast('Nada para abrir', 'Importe um projeto primeiro', 'err');
		return;
	}
	const w = window.open('', 'aurora_' + proj.id);
	if (!w) {
		toast('Pop-up bloqueado', 'Permita pop-ups para abrir em nova aba', 'err');
		return;
	}
	w.document.open();
	w.document.write(
		POPOUT_SHELL.replace('__CH__', () => 'aurora-lp-' + proj.id).replace('__NAME__', () =>
			esc(proj.name),
		),
	);
	w.document.close();
	proj.popout = w;
	setTimeout(() => {
		if (proj.lastHtml) {
			try {
				proj.channel.postMessage({ type: 'html', html: proj.lastHtml });
			} catch (e) {
				ignorarErro(e, 'openPopout');
			}
			try {
				w.postMessage({ __lp_popout: true, html: proj.lastHtml }, '*');
			} catch (e) {
				ignorarErro(e, 'openPopout');
			}
		}
	}, 300);
	toast('Aberto em nova aba', 'Sincroniza em tempo real', 'ok');
}
const POPOUT_SHELL = [
	'<!DOCTYPE html><html><head><meta charset="utf-8"><title>__NAME__ • Preview</title>',
	'<style>html,body{margin:0;height:100%;background:#fff}iframe{border:0;width:100%;height:100%;display:block}#bar{position:fixed;top:0;left:0;right:0;height:0}</style></head>',
	'<body><iframe id="f" referrerpolicy="no-referrer" allow="pointer-lock; fullscreen; ' +
		'gamepad; autoplay" sandbox="allow-scripts allow-same-origin allow-forms allow-popups ' +
		'allow-pointer-lock allow-modals"></iframe>',
	'<script>',
	'var f=document.getElementById("f");',
	'function set(h){f.srcdoc=h;}',
	'try{var ch=new BroadcastChannel("__CH__");ch.onmessage=function(e){if(e.data&&e.data.type==="html")set(e.data.html);};}catch(e){}',
	'window.addEventListener("message",function(e){if(e.data&&e.data.__lp_popout)set(e.data.html);});',
	'window.addEventListener("message",function(e){if(e.data&&e.data.__lp_console){try{(e.source!==window)&&0;}catch(_){}}} );',
	'if(window.opener){try{window.opener.postMessage({__lp_ready:true},"*");}catch(e){}}',
	'<\/script></body></html>',
].join('\n');

function renderTabs() {
	el.tabs.innerHTML = State.projects
		.map((p) => {
			const ic = p.kind === 'zip' ? 'zip' : p.kind === 'folder' ? 'folder' : 'html';
			return `<div class="tab${p.id === State.active ? ' active' : ''}" data-tab="${p.id}"><span class="tico">${iconSvg(ic)}</span>\
<span class="tname">${esc(p.name)}</span><span class="tclose" data-close="${p.id}">${iconSvg('close')}</span>\
</div>`;
		})
		.join('');
}
el.tabs.addEventListener('click', (e) => {
	const close = e.target.closest('[data-close]');
	if (close) {
		e.stopPropagation();
		closeProject(close.dataset.close);
		return;
	}
	const tab = e.target.closest('[data-tab]');
	if (tab) switchProject(tab.dataset.tab);
});
function switchProject(id) {
	State.active = id;
	try {
		headlessDestroy(id);
	} catch (e) {
		ignorarErro(e, 'switchProject');
	}
	saveSession();
	hidePreviewError();
	openDirs.clear();
	renderAll();
	const p = activeProject();
	if (p) {
		if (p.lastHtml) {
			el.previewEmpty.classList.add('hidden');
			el.device.classList.remove('hidden');
			frameSrcdoc(p.lastHtml);
		} else buildPreview(p);
		if (p.openFile) openFileInEditor(p.openFile);
	}
}
function closeProject(id) {
	const i = State.projects.findIndex((p) => p.id === id);
	if (i < 0) return;
	const p = State.projects[i];
	try {
		headlessDestroy(id);
	} catch (e) {
		ignorarErro(e, 'closeProject');
	}
	revokeBlobs(p);
	if (p.channel) p.channel.close();
	if (p.popout && !p.popout.closed) p.popout.close();
	try {
		recArchiveClosed(p);
	} catch (e) {
		ignorarErro(e, 'closeProject');
	}
	State.projects.splice(i, 1);
	saveSession();
	if (State.active === id)
		State.active = State.projects.length ? State.projects[Math.max(0, i - 1)].id : null;
	if (State.active) switchProject(State.active);
	else {
		State.active = null;
		renderAll();
		renderPreviewEmpty(true);
		disposeMedia();
		el.editorGrid.classList.add('hidden');
		el.editorEmpty.classList.remove('hidden');
		el.editorEmpty.innerHTML = `<div>${iconSvg('code', 'icon')}Selecione um arquivo no Explorer para editar</div>`;
	}
}
function renderAll() {
	renderTabs();
	renderTree();
	renderEditorTabs();
	renderConsole();
	renderStatusbar();
	applyDevice();
	const p = activeProject();
	if (p) updateBadge(p);
}
function renderStatusbar() {
	const p = activeProject();
	if (!p) {
		el.stProject.textContent = '';
		el.stContext.textContent = '';
		el.stFiles.textContent = '';
		if (!State.projects.length) setStatus('', 'Aguardando projeto');
		return;
	}
	el.stProject.innerHTML = iconSvg('folder', 'icon') + '<span>' + esc(p.name) + '</span>';
	el.stFiles.textContent = p.files.size + ' arquivos';
	const ctx =
		location.protocol === 'https:' ||
		location.hostname === 'localhost' ||
		location.protocol === 'file:'
			? location.protocol === 'file:'
				? 'file:// (blob seguro)'
				: 'contexto seguro ✓'
			: 'inseguro';
	const ty =
		p.detect.type === 'build'
			? 'build (Node)'
			: p.detect.type === 'runtime'
				? 'runtime JSX/TS'
				: 'estático';
	el.stContext.textContent = ty + ' • ' + ctx;
}

function setDevice(dev) {
	State.device = dev;
	saveSession();
	document
		.querySelectorAll('#deviceSeg button')
		.forEach((b) => b.classList.toggle('on', b.dataset.dev === dev));
	el.dims.style.display = dev === 'responsive' ? 'none' : 'flex';
	applyDevice();
}
function placeDevice(w, h, scale, borderPad) {
	borderPad = borderPad || 0;
	el.device.style.width = w + 'px';
	el.device.style.height = h + 'px';
	el.device.style.transformOrigin = 'center center';
	el.device.style.transform = `scale(${scale})`;
	const bw = w + borderPad,
		bh = h + borderPad;
	el.device.style.margin = -(bh * (1 - scale)) / 2 + 'px ' + -(bw * (1 - scale)) / 2 + 'px';
	el.zoomLabel.textContent = Math.round(scale * 100) + '%';
}
function applyDevice() {
	const dev = State.device;
	const stageRect = el.stage.getBoundingClientRect();
	if (dev === 'responsive') {
		el.device.classList.remove('bordered');
		el.device.style.margin = '0';
		el.device.style.transformOrigin = 'center center';
		el.device.style.width = '100%';
		el.device.style.height = '100%';
		el.device.style.transform = 'none';
		el.zoomLabel.textContent = '100%';
		return;
	}
	const d = DEVICES[dev];
	let w = d.w,
		h = d.h;
	if (State.rotated) {
		const t = w;
		w = h;
		h = t;
	}
	el.dimW.value = w;
	el.dimH.value = h;
	el.device.classList.toggle('bordered', !!d.border);
	const scale = Core.computeFitScale(
		stageRect.width,
		stageRect.height,
		w + (d.border ? 20 : 0),
		h + (d.border ? 20 : 0),
		22,
	);
	placeDevice(w, h, scale, d.border ? 20 : 0);
}
function setCustomDims() {
	const w = +el.dimW.value || 800,
		h = +el.dimH.value || 600;
	el.device.classList.remove('bordered');
	const r = el.stage.getBoundingClientRect();
	const s = Core.computeFitScale(r.width, r.height, w, h, 22);
	placeDevice(w, h, s, 0);
}
function setLayout(lay) {
	const prevLay = State.layout;
	State.layout = lay;
	saveSession();
	document
		.querySelectorAll('#layoutSeg button')
		.forEach((b) => b.classList.toggle('on', b.dataset.lay === lay));
	el.editorPane.style.display = lay === 'preview' ? 'none' : 'flex';
	el.previewPane.style.display = lay === 'editor' ? 'none' : 'flex';
	el.rz2.style.display = lay === 'split' ? 'block' : 'none';
	applyDevice();
	const _p = activeProject();
	if (lay === 'editor' && prevLay !== 'editor') {
		try {
			el.frame.srcdoc = '';
			el.frame.removeAttribute('src');
		} catch (e) {
			ignorarErro(e, 'setLayout');
		}
	} else if (lay !== 'editor' && prevLay === 'editor') {
		if (_p) {
			_p.previewEverOpened = true;
			if (_p.previewDirty) {
				_p.previewDirty = false;
				scheduleBuild(_p);
			} else if (_p.lastHtml) {
				try {
					frameSrcdoc(_p.lastHtml);
					el.previewEmpty.classList.add('hidden');
					el.device.classList.remove('hidden');
				} catch (e) {
					ignorarErro(e, 'setLayout');
				}
			} else {
				scheduleBuild(_p);
			}
		}
	}
}

let _wcMod = null,
	_wcInstance = null,
	_wcBooting = null,
	_wcCurrentProc = null,
	_wcListeners = [];
async function getWebContainer() {
	if (_wcInstance) return _wcInstance;
	if (_wcBooting) return _wcBooting;
	_wcBooting = (async () => {
		if (!_wcMod) _wcMod = await import('https://esm.sh/@webcontainer/api@1.5.1');
		_wcInstance = await _wcMod.WebContainer.boot();
		return _wcInstance;
	})();
	_wcBooting.catch(() => {
		_wcBooting = null;
	});
	return _wcBooting;
}
async function tryAutoRun(proj) {
	logCmd(proj, '— Execução automática de comandos —');
	const secure = window.crossOriginIsolated;
	if (!navigator.onLine) {
		logCmd(
			proj,
			'Sem internet: não é possível instalar dependências. Mostrando preview estático/runtime.',
		);
		return;
	}
	if (!secure) {
		try {
			if (typeof auroraServerSupport === 'function') logCmd(proj, auroraServerSupport().why);
		} catch (e) {
			ignorarErro(e, 'tryAutoRun');
		}
		logCmd(
			proj,
			'Para rodar npm de verdade no navegador (WebContainers), o site precisa estar hospedado com headers COOP/COEP (cross-origin isolation) E rodar em Chrome/Edge/Firefox de desktop.',
		);
		logCmd(
			proj,
			'Sem isso, uso o modo Runtime: compilo JSX/TS e resolvo dependências via esm.sh — cobre a maioria dos apps React/Vite sem build.',
		);
		return;
	}
	try {
		logCmd(proj, '$ Inicializando WebContainers…');
		showPreviewLoading('Iniciando servidor real…', 'Inicializando WebContainers…');
		if (_wcCurrentProc) {
			try {
				await _wcCurrentProc.kill();
			} catch (e) {
				ignorarErro(e, 'tryAutoRun');
			}
			_wcCurrentProc = null;
		}
		_wcListeners.forEach((off) => {
			try {
				off && off();
			} catch (e) {
				ignorarErro(e, 'tryAutoRun');
			}
		});
		_wcListeners = [];
		const wc = await getWebContainer();
		proj.wc = wc;
		let serverStarted = false,
			settled = false;
		const fallbackToRuntime = (msg) => {
			if (proj.__wcWatchdog) {
				clearTimeout(proj.__wcWatchdog);
				proj.__wcWatchdog = null;
			}
			if (settled) return;
			settled = true;
			hidePreviewLoading();
			if (msg) logCmd(proj, msg);
			if (proj.id === State.active) {
				hidePreviewError();
				if (proj.lastHtml) {
					el.previewEmpty.classList.add('hidden');
					el.device.classList.remove('hidden');
					frameSrcdoc(proj.lastHtml);
				} else {
					renderPreviewEmpty(true);
				}
			}
		};
		_wcListeners.push(
			wc.on('server-ready', (port, url) => {
				if (proj.id !== State.active) return;
				settled = true;
				if (proj.__wcWatchdog) {
					clearTimeout(proj.__wcWatchdog);
					proj.__wcWatchdog = null;
				}
				hidePreviewLoading();
				logCmd(proj, 'Servidor pronto em ' + url);
				el.previewEmpty.classList.add('hidden');
				el.device.classList.remove('hidden');
				el.frame.removeAttribute('srcdoc');
				el.frame.setAttribute(
					'sandbox',
					'allow-scripts allow-forms allow-popups allow-pointer-lock allow-same-origin allow-modals',
				);
				el.frame.setAttribute('allow', 'pointer-lock; fullscreen; gamepad; autoplay');
				el.frame.src = url;
				if (proj.popout && !proj.popout.closed)
					proj.popout.location && (proj.popout.location.href = url);
			}),
		);
		_wcListeners.push(
			wc.on('error', (e) => {
				logErr(proj, 'WebContainers: ' + (e && e.message ? e.message : String(e)));
			}),
		);
		setPreviewLoadingDetail('Montando arquivos do projeto…');
		const wsfix = npmifyWorkspace(proj.files);
		if (wsfix.patched)
			logCmd(
				proj,
				'Monorepo detectado: converti dependências "workspace:*" para "*" e declarei "workspaces" no package.json raiz (o npm não entende o protocolo "workspace:" do pnpm/yarn).',
			);
		const tree = toWcTree(wsfix.files);
		await wc.mount(tree);
		for (const cmd of proj.detect.commands) {
			setPreviewLoadingDetail('Executando: ' + cmd);
			logCmd(proj, '$ ' + cmd);
			const [bin, ...args] = cmd.split(' ');
			const p = await wc.spawn(bin, args);
			_wcCurrentProc = p;
			p.output.pipeTo(
				new WritableStream({
					write(chunk) {
						logCmd(proj, chunk.replace(/\n$/, ''));
					},
				}),
			);
			if (/\b(dev|start|serve)\b/.test(cmd)) {
				serverStarted = true;
				p.exit.then((code) => {
					if (code !== 0) {
						logErr(proj, cmd + ' encerrou com código ' + code);
						fallbackToRuntime(
							'O dev server encerrou antes de ficar pronto — mostrando o preview em modo Runtime.',
						);
					}
				});
				break;
			}
			const code = await p.exit;
			if (code !== 0) {
				hidePreviewLoading();
				showCmdError(proj, cmd, code);
				logErr(proj, cmd + ' saiu com código ' + code);
				return;
			}
		}
		if (serverStarted) {
			proj.__wcWatchdog = setTimeout(() => {
				logErr(proj, 'O servidor não respondeu a tempo (timeout).');
				fallbackToRuntime(
					'Servidor não respondeu a tempo — mostrando o preview em modo Runtime. Veja o console para o log dos comandos.',
				);
			}, 90000);
		} else {
			fallbackToRuntime(
				'Comandos finalizados sem um servidor ativo — mostrando o preview em modo Runtime.',
			);
		}
	} catch (err) {
		hidePreviewLoading();
		showWcError(proj, err);
		logErr(proj, `WebContainers indisponível: ${err.message} — usando modo Runtime.`);
	}
}
function npmifyWorkspace(files) {
	const out = new Map(files);
	const pkgPaths = [...files.keys()].filter((p) => Core.basename(p) === 'package.json');
	if (!pkgPaths.length) return { files: out, patched: false };
	pkgPaths.sort((a, b) => a.split('/').length - b.split('/').length || a.length - b.length);
	const rootPath = pkgPaths[0],
		rootDir = Core.dirname(rootPath);
	let patched = false;
	const fixDeps = (obj) => {
		let did = false;
		if (obj && typeof obj === 'object')
			for (const k of Object.keys(obj)) {
				if (typeof obj[k] === 'string' && /^workspace:/.test(obj[k])) {
					obj[k] = '*';
					did = true;
				}
			}
		return did;
	};
	for (const pp of pkgPaths) {
		let json;
		try {
			json = JSON.parse(fileText(files.get(pp)));
		} catch (e) {
			continue;
		}
		let did = false;
		['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'].forEach(
			(key) => {
				if (fixDeps(json[key])) did = true;
			},
		);
		if (pp === rootPath) {
			const dirs = pkgPaths
				.filter((x) => x !== rootPath)
				.map((x) => {
					let d = Core.dirname(x);
					if (rootDir && (d === rootDir || d.startsWith(rootDir + '/')))
						d = d.slice(rootDir.length + 1);
					return d;
				})
				.filter(Boolean);
			if (dirs.length) {
				const cur = Array.isArray(json.workspaces)
					? json.workspaces
					: json.workspaces && Array.isArray(json.workspaces.packages)
						? json.workspaces.packages
						: [];
				const merged = Array.from(new Set([...cur, ...dirs]));
				if (merged.length !== cur.length || !Array.isArray(json.workspaces)) {
					json.workspaces = merged;
					did = true;
				}
			}
		}
		if (did) {
			out.set(pp, { text: JSON.stringify(json, null, 2), isText: true });
			patched = true;
		}
	}
	return { files: out, patched: patched };
}
function toWcTree(files) {
	const tree = {};
	for (const [path, f] of files) {
		const parts = path.split('/');
		let node = tree;
		for (let i = 0; i < parts.length - 1; i++) {
			const seg = parts[i];
			node[seg] = node[seg] || { directory: {} };
			node = node[seg].directory;
		}
		node[parts[parts.length - 1]] = { file: { contents: f.text != null ? f.text : fileBytes(f) } };
	}
	return tree;
}

function loadSample() {
	const files = new Map();
	const html =
		'<!DOCTYPE html>\n' +
		'<html lang="pt-BR">\n' +
		'<head>\n' +
		'<meta charset="utf-8">\n' +
		'<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
		'<title>Demo Synapse</title>\n' +
		'<link rel="stylesheet" href="styles.css">\n' +
		'</head>\n' +
		'<body>\n' +
		'<header><h1>✨ Synapse Live Preview</h1><p>Edite os arquivos à esquerda — isto atualiza ' +
		'na hora.</p></header>\n' +
		'<main>\n' +
		'<button id="btn">Clique: <span id="n">0</span></button>\n' +
		'<div class="card" id="card">Card responsivo</div>\n' +
		'</main>\n' +
		'<script src="app.js"></script>\n' +
		'</body>\n' +
		'</html>';
	const css =
		'*{box-sizing:border-box}body{margin:0;font-family:system-ui,Segoe UI,sans-serif;' +
		'background:linear-gradient(135deg,#0b0d12,#161a23);color:#e7ebf3;min-height:100vh}' +
		'header{padding:48px 32px;text-align:center}h1{font-size:34px;margin:0 0 8px;background:' +
		'linear-gradient(135deg,#6aa3ff,#8b7bff);-webkit-background-clip:text;background-clip:' +
		'text;color:transparent}main{display:flex;gap:20px;flex-wrap:wrap;justify-content:center;' +
		'padding:0 24px 48px}button{padding:14px 22px;border:0;border-radius:12px;background:' +
		'linear-gradient(135deg,#6aa3ff,#8b7bff);color:#08111f;font-weight:700;font-size:16px;' +
		'cursor:pointer;transition:.2s}button:hover{transform:translateY(-2px);box-shadow:0 10px ' +
		'30px rgba(var(--acc-rgb),.4)}.card{padding:28px;border-radius:16px;background:#1d2230;' +
		'border:1px solid #2a3142;min-width:200px;display:grid;place-items:center}';
	const js =
		'console.log("App demo carregado");\n' +
		'let n=0;\n' +
		'const btn=document.getElementById("btn");\n' +
		'const out=document.getElementById("n");\n' +
		'btn.addEventListener("click",()=>{n++;out.textContent=n;console.log("clique",n);' +
		'if(n===5)console.warn("Chegou a 5!");});';
	files.set('index.html', makeFileEntry('index.html', new TextEncoder().encode(html)));
	files.set('styles.css', makeFileEntry('styles.css', new TextEncoder().encode(css)));
	files.set('app.js', makeFileEntry('app.js', new TextEncoder().encode(js)));
	addProject('demo-aurora', 'folder', files);
}

const THEMES = [
	{ id: 'dark', name: 'Escuro', bg: '#11141b', acc: '#6aa3ff' },
	{ id: 'light', name: 'Claro', bg: '#ffffff', acc: '#6aa3ff' },
	{ id: 'midnight', name: 'Meia-noite', bg: '#0c1326', acc: '#22d3ee' },
	{ id: 'nord', name: 'Nórdico', bg: '#2e3440', acc: '#88c0d0' },
	{ id: 'rose', name: 'Rosé', bg: '#291b24', acc: '#fb7185' },
	{ id: 'forest', name: 'Floresta', bg: '#14271d', acc: '#34d399' },
];
const ACCENTS = [
	'#6aa3ff',
	'#22d3ee',
	'#34d399',
	'#fbbf24',
	'#fb7185',
	'#f472b6',
	'#a78bfa',
	'#38bdf8',
];
function loadTheme() {
	try {
		const t = localStorage.getItem('aurora.theme');
		return THEMES.some((x) => x.id === t) ? t : 'dark';
	} catch (e) {
		return 'dark';
	}
}
function loadAccent() {
	try {
		return localStorage.getItem('aurora.accent') || '';
	} catch (e) {
		return '';
	}
}
function hexToRgb(h) {
	h = (h || '').replace('#', '');
	if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
	const n = parseInt(h, 16) || 0;
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHsl(r, g, b) {
	r /= 255;
	g /= 255;
	b /= 255;
	const mx = Math.max(r, g, b),
		mn = Math.min(r, g, b),
		d = mx - mn;
	let h = 0,
		s = 0;
	const l = (mx + mn) / 2;
	if (d) {
		s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
		h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
		h /= 6;
	}
	return [h * 360, s, l];
}
function hslToHex(h, s, l) {
	h = (((h % 360) + 360) % 360) / 360;
	const a = s * Math.min(l, 1 - l);
	const f = (n) => {
		const k = (n + h * 12) % 12;
		const c = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
		return Math.round(c * 255)
			.toString(16)
			.padStart(2, '0');
	};
	return `#${f(0)}${f(8)}${f(4)}`;
}
function deriveAcc2(hex) {
	const c = hexToRgb(hex),
		hsl = rgbToHsl(c[0], c[1], c[2]);
	return hslToHex(hsl[0] + 30, hsl[1], hsl[2]);
}
function setAccentVars(hex) {
	const r = document.documentElement;
	if (hex) {
		const rgb = hexToRgb(hex),
			a2 = deriveAcc2(hex);
		r.style.setProperty('--acc', hex);
		r.style.setProperty('--acc-2', a2);
		r.style.setProperty('--acc-grad', `linear-gradient(135deg,${hex},${a2})`);
		r.style.setProperty('--acc-rgb', rgb.join(','));
	} else {
		['--acc', '--acc-2', '--acc-grad', '--acc-rgb'].forEach((p) => r.style.removeProperty(p));
	}
}
function applyAccent(hex) {
	setAccentVars(hex);
	State.accent = hex || '';
	try {
		if (hex) localStorage.setItem('aurora.accent', hex);
		else localStorage.removeItem('aurora.accent');
	} catch (e) {
		ignorarErro(e, 'applyAccent');
	}
	renderThemePanel();
}
function applyTheme(theme) {
	State.theme = THEMES.some((x) => x.id === theme) ? theme : 'dark';
	document.documentElement.setAttribute('data-theme', State.theme);
	try {
		localStorage.setItem('aurora.theme', State.theme);
	} catch (e) {
		ignorarErro(e, 'applyTheme');
	}
	if (el.themeBtn) el.themeBtn.innerHTML = iconSvg('palette');
	renderThemePanel();
}
function toggleTheme() {
	const ids = THEMES.map((x) => x.id),
		i = ids.indexOf(State.theme),
		next = ids[(i + 1) % ids.length];
	applyTheme(next);
	const nm = (THEMES.find((x) => x.id === next) || {}).name || next;
	toast('Tema: ' + nm, 'Aparência atualizada', '');
}
function pk(id) {
	return document.getElementById(id);
}
function getComputedAcc() {
	try {
		const v = getComputedStyle(document.documentElement).getPropertyValue('--acc').trim();
		return v || State.accent || '#6aa3ff';
	} catch (e) {
		return State.accent || '#6aa3ff';
	}
}
function readPicker() {
	return hslToHex(+pk('tmHue').value, +pk('tmSat').value / 100, +pk('tmLit').value / 100);
}
function paintPickerTrack() {
	const h = +pk('tmHue').value,
		s = +pk('tmSat').value / 100;
	const sat = pk('tmSat');
	if (sat)
		sat.style.background = `linear-gradient(90deg,${hslToHex(h, 0, 0.5)},${hslToHex(h, 1, 0.5)})`;
	const lit = pk('tmLit');
	if (lit) lit.style.background = `linear-gradient(90deg,#000,${hslToHex(h, s, 0.5)},#fff)`;
}
function updatePickerPreview(hex) {
	const p = pk('tmPrev');
	if (p) p.style.background = hex;
	const hx = pk('tmHex');
	if (hx && document.activeElement !== hx) hx.value = hex.toUpperCase();
}
function syncPickerTo(hex) {
	const c = hexToRgb(hex),
		hsl = rgbToHsl(c[0], c[1], c[2]);
	if (pk('tmHue')) pk('tmHue').value = Math.round(hsl[0]);
	if (pk('tmSat')) pk('tmSat').value = Math.round(hsl[1] * 100);
	if (pk('tmLit')) pk('tmLit').value = Math.round(hsl[2] * 100);
	paintPickerTrack();
	updatePickerPreview(hex);
}
function markPresets() {
	const ac = document.getElementById('tmAccents');
	if (!ac) return;
	ac.querySelectorAll('.tm-ac[data-accent]').forEach((b) => {
		const v = b.getAttribute('data-accent');
		b.classList.toggle(
			'on',
			!!v && !!State.accent && State.accent.toLowerCase() === v.toLowerCase(),
		);
	});
	const cb = ac.querySelector('.tm-custom');
	if (cb)
		cb.classList.toggle(
			'on',
			!!State.accent &&
				!ACCENTS.some((c) => c.toLowerCase() === (State.accent || '').toLowerCase()),
		);
}
function setAccentLive(hex) {
	setAccentVars(hex);
	State.accent = hex;
	try {
		localStorage.setItem('aurora.accent', hex);
	} catch (e) {
		ignorarErro(e, 'setAccentLive');
	}
	updatePickerPreview(hex);
	markPresets();
}
function renderThemePanel() {
	const tc = document.getElementById('tmThemes');
	if (tc)
		tc.innerHTML = THEMES.map(
			(t) =>
				`<button class="tm-th${t.id === State.theme ? ' on' : ''}" data-theme="${t.id}"><span class="tm-sw" \
style="background:${t.bg}"><i style="background:${t.acc}"></i></span><span>${t.name}</span></button>`,
		).join('');
	const ac = document.getElementById('tmAccents');
	if (ac)
		ac.innerHTML =
			ACCENTS.map((c) => {
				const on = State.accent && State.accent.toLowerCase() === c.toLowerCase();
				return `<button class="tm-ac${on ? ' on' : ''}" data-accent="${c}" style="background:${c};color:${c}" title="${c}"></button>`;
			}).join('') +
			'<button class="tm-custom" data-pick="1" title="Cor personalizada"></button>' +
			'<button class="tm-ac tm-reset" data-accent="" title="Padrão do tema" style="background:var(--bg-3)">' +
			iconSvg('reload', 'tm-rico') +
			'</button>';
}

const SDB = { p: null };
function sdb() {
	if (SDB.p) return SDB.p;
	SDB.p = new Promise((res, rej) => {
		let r;
		try {
			r = indexedDB.open('aurora-lp', 1);
		} catch (e) {
			return rej(e);
		}
		r.onupgradeneeded = () => {
			const d = r.result;
			if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
		};
		r.onsuccess = () => res(r.result);
		r.onerror = () => rej(r.error);
	});
	return SDB.p;
}
async function sdbPut(k, v) {
	try {
		const d = await sdb();
		await new Promise((res, rej) => {
			const t = d.transaction('kv', 'readwrite');
			t.objectStore('kv').put(v, k);
			t.oncomplete = res;
			t.onerror = () => rej(t.error);
		});
	} catch (e) {
		ignorarErro(e, 'sdbPut');
	}
}
async function sdbGet(k) {
	try {
		const d = await sdb();
		return await new Promise((res, rej) => {
			const t = d.transaction('kv', 'readonly');
			const q = t.objectStore('kv').get(k);
			q.onsuccess = () => res(q.result);
			q.onerror = () => rej(q.error);
		});
	} catch (e) {
		return null;
	}
}
async function sdbDel(k) {
	try {
		const d = await sdb();
		await new Promise((res, rej) => {
			const t = d.transaction('kv', 'readwrite');
			t.objectStore('kv').delete(k);
			t.oncomplete = res;
			t.onerror = () => rej(t.error);
		});
	} catch (e) {
		ignorarErro(e, 'sdbDel');
	}
}
async function sdbKeys() {
	try {
		const d = await sdb();
		return await new Promise((res, rej) => {
			const t = d.transaction('kv', 'readonly');
			const q = t.objectStore('kv').getAllKeys();
			q.onsuccess = () => res(q.result || []);
			q.onerror = () => rej(q.error);
		});
	} catch (e) {
		return [];
	}
}
const REC = { max: 4, genMs: 900000, lastGen: 0, css: false };
function recTs() {
	return String(Date.now()).padStart(14, '0');
}
function recSerProj(p) {
	return {
		id: p.id,
		name: p.name,
		kind: p.kind,
		openFile: p.openFile,
		openTabs: p.openTabs || [],
		emptyDirs: [...(p.emptyDirs || [])],
		snapSeq: p.snapSeq || 0,
		snapshots: p.snapshots || [],
		files: [...p.files.entries()].map(([path, f]) => [
			path,
			{
				path: f.path || path,
				data: f.data,
				text: f.text,
				isText: f.isText,
				history: f.history || [],
			},
		]),
	};
}
function recBytes(pd) {
	let n = 0;
	try {
		for (const ent of pd.files || []) {
			const f = ent && ent[1];
			if (f && typeof f.text === 'string') n += f.text.length;
			else if (f && f.data && f.data.byteLength) n += f.data.byteLength;
		}
	} catch (e) {
		ignorarErro(e, 'recBytes');
	}
	return n;
}
function fmtB(n) {
	if (!n) return '0 B';
	if (n < 1024) return n + ' B';
	if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
	return (n / 1048576).toFixed(1) + ' MB';
}
async function recPrune(prefix, keep) {
	try {
		const ks = (await sdbKeys())
			.filter((k) => typeof k === 'string' && k.indexOf(prefix) === 0)
			.sort();
		while (ks.length > keep) {
			await sdbDel(ks.shift());
		}
	} catch (e) {
		ignorarErro(e, 'recPrune');
	}
}
async function recArchiveClosed(p) {
	try {
		const pd = recSerProj(p);
		const wrap = {
			t: Date.now(),
			name: p.name,
			kind: p.kind,
			nFiles: p.files.size,
			bytes: recBytes(pd),
			pd: LOCK.key ? await _encSession(pd) : pd,
		};
		await sdbPut(`recent.proj.${recTs()}.${p.id}`, wrap);
		await recPrune('recent.proj.', REC.max);
	} catch (e) {
		ignorarErro(e, 'recArchiveClosed');
	}
}
async function recDec(rec) {
	if (!rec) return null;
	if (!rec.enc) return rec;
	if (LOCK.key) {
		try {
			return await _decSession(rec, LOCK.key);
		} catch (e) {
			ignorarErro(e, 'recDec');
		}
	}
	const pass = await uiPrompt(
		'Registro protegido',
		'Este backup foi salvo com a proteção por senha ativa. Digite a senha.',
		{ password: true, okLabel: 'Desbloquear' },
	);
	if (pass == null) return null;
	try {
		const key = await _deriveKey(pass, _ub64(rec.salt));
		return await _decSession(rec, key);
	} catch (e) {
		toast('Senha incorreta', 'Não foi possível desbloquear este registro', 'err');
		return null;
	}
}
function recRestoreProjData(pd, label) {
	try {
		const files = new Map();
		for (const ent of (pd && pd.files) || []) {
			try {
				const path = ent[0],
					f = ent[1] || {};
				if (typeof path !== 'string') continue;
				files.set(path, {
					path: f.path || path,
					data: f.data || null,
					text: typeof f.text === 'string' ? f.text : null,
					isText: !!f.isText,
					history: Array.isArray(f.history) ? f.history : [],
				});
			} catch (e) {
				ignorarErro(e, 'recRestoreProjData');
			}
		}
		if (!files.size) return null;
		const pkg = readPackageJson(files);
		const detect = Core.detectProject([...files.keys()], pkg);
		const id = pd.id && !State.projects.some((x) => x.id === pd.id) ? pd.id : nid();
		const proj = {
			id: id,
			name: pd.name || label || 'recuperado',
			kind: pd.kind || 'folder',
			files,
			detect,
			entry: detect.entry,
			openFile:
				pd.openFile && files.has(pd.openFile)
					? pd.openFile
					: detect.entry || pickDefaultFile(files),
			dirty: new Set(),
			emptyDirs: new Set(
				(pd.emptyDirs || []).filter((d) => typeof d === 'string' && validRelPath(d)),
			),
			blobs: new Set(),
			popout: null,
			channel: null,
			logs: [],
			snapshots: Array.isArray(pd.snapshots) ? pd.snapshots : [],
			snapSeq: pd.snapSeq || 0,
			runtimeMode: detect.type,
		};
		proj.openTabs = (pd.openTabs || []).filter((t) => files.has(t));
		if (proj.openFile && !proj.openTabs.includes(proj.openFile))
			proj.openTabs.unshift(proj.openFile);
		proj.blocked =
			typeof auroraShouldBlock === 'function'
				? auroraShouldBlock(detect)
				: detect.type === 'build' && !(window.crossOriginIsolated && navigator.onLine);
		try {
			proj.channel = new BroadcastChannel('aurora-lp-' + proj.id);
		} catch (e) {
			ignorarErro(e, 'recRestoreProjData');
		}
		const m = /^p(\d+)$/.exec(proj.id);
		if (m) uid = Math.max(uid, +m[1] + 1);
		State.projects.push(proj);
		return proj;
	} catch (e) {
		registro.aviso('[Synapse] recuperar', e);
		return null;
	}
}
async function recOpen(pds) {
	let last = null,
		n = 0;
	for (const pd of pds || []) {
		if (!pd) continue;
		if (pd.id && State.projects.some((x) => x.id === pd.id)) continue;
		const pr = recRestoreProjData(pd, (pd && pd.name) || 'projeto');
		if (pr) {
			last = pr;
			n++;
		}
	}
	if (last) {
		renderAll();
		switchProject(last.id);
		toast('Recuperado', n + ' projeto(s) reaberto(s)', 'ok');
	} else
		toast(
			'Nada reaberto',
			'Os projetos deste registro já estão abertos ou o registro está vazio',
			'warn',
		);
	return n;
}
function recCssOnce() {
	if (REC.css) return;
	REC.css = true;
	const st = document.createElement('style');
	st.textContent =
		'.rec-modal{width:min(760px,94vw)}.rec-body{max-height:60vh;overflow:auto;margin:10px 0;' +
		'display:flex;flex-direction:column;gap:14px}.rec-sec .rec-t{display:block;margin-bottom:' +
		'6px;font-size:11px;text-transform:uppercase;letter-spacing:.6px;opacity:.7}' +
		'.rec-row{display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:8px;' +
		'background:rgba(127,127,127,.09);margin:4px 0}.rec-row .rec-n{flex:1;min-width:0;' +
		'overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rec-row .rec-m{opacity:.65;' +
		'font-size:11px;white-space:nowrap}.rec-note{font-size:11px;opacity:.68;line-height:1.55}' +
		'.rec-btn{cursor:pointer;border:1px solid rgba(127,127,127,.35);background:transparent;' +
		'color:inherit;border-radius:6px;padding:4px 10px;font-size:12px}.rec-btn:' +
		'hover{border-color:var(--acc,#6aa3ff);color:var(--acc,#6aa3ff)}' +
		'.rec-btn[disabled]{opacity:.4;cursor:default}#recentBtn.rec-alert{color:#e6b455;' +
		'box-shadow:0 0 0 1px rgba(230,180,85,.45) inset;border-radius:8px}';
	document.head.appendChild(st);
}
function recInitBtn() {
	const b = $('#recentBtn');
	if (!b) return;
	b.innerHTML =
		'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
		'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" ' +
		'r="9"></circle><path d="M12 7v5l3 2"></path></svg>';
	b.addEventListener('click', () => openRecentPanel());
}
function recFlagBtn() {
	recCssOnce();
	const b = $('#recentBtn');
	if (b) b.classList.add('rec-alert');
}
let __recBack = null;
async function recRenderBody(body) {
	const ks =
		(await Promise.race([sdbKeys(), new Promise((r) => setTimeout(() => r(null), 4000))])) || [];
	let sess = null;
	try {
		sess = await Promise.race([
			sdbGet('session'),
			new Promise((r) => setTimeout(() => r(null), 4000)),
		]);
	} catch (e) {
		ignorarErro(e, 'recRenderBody');
	}
	const archK = ks
		.filter((k) => typeof k === 'string' && k.indexOf('recent.proj.') === 0)
		.sort()
		.reverse();
	const bakK = ks
		.filter(
			(k) =>
				typeof k === 'string' &&
				(k.indexOf('session.gen.') === 0 || k.indexOf('session.rescue.') === 0),
		)
		.sort((a, b) => {
			const ta = +a.split('.')[2] || 0,
				tb = +b.split('.')[2] || 0;
			return tb - ta;
		});
	let html = '';
	html += '<div class="rec-sec"><span class="rec-t">Sessão salva no navegador</span>';
	if (sess && sess.enc) {
		html +=
			'<div class="rec-row"><span class="rec-n">\ud83d\udd12 Sessão protegida por senha</span><button class="rec-btn" data-op="unlock">Desbloquear</button></div>';
	} else if (sess && Array.isArray(sess.projects) && sess.projects.length) {
		sess.projects.forEach((pd, j) => {
			const open = !!(pd && pd.id && State.projects.some((x) => x.id === pd.id));
			html +=
				'<div class="rec-row"><span class="rec-n">' +
				esc((pd && pd.name) || 'projeto') +
				'</span><span class="rec-m">' +
				((pd && pd.files) || []).length +
				' arquivo(s)</span>' +
				(open
					? '<button class="rec-btn" disabled>Aberto</button>'
					: `<button class="rec-btn" data-op="sess" data-j="${j}">Reabrir</button>`) +
				'</div>';
		});
		if (sess.projects.some((pd) => !(pd && pd.id && State.projects.some((x) => x.id === pd.id))))
			html +=
				'<div class="rec-row"><span class="rec-n">Tudo que não está aberto</span><button class="rec-btn" data-op="sess-all">Reabrir todos</button></div>';
	} else
		html +=
			'<div class="rec-note">Nenhuma sessão salva foi encontrada neste navegador. Se seus ' +
			'projetos sumiram: 1) confira se você abriu o site pelo MESMO endereço de sempre (abrir ' +
			'por file:// ou por localhost usa armazenamentos DIFERENTES); 2) o navegador pode ter ' +
			'limpado os dados do site (modo anônimo, limpeza de espaço, antivírus); 3) se você usa o ' +
			'relay, os projetos com terminal/dev server ficam espelhados na pasta aurora-projects do ' +
			'computador — dá para reabrir de lá (ferramenta list_disk_projects do agente).</div>';
	html += '</div>';
	html += '<div class="rec-sec"><span class="rec-t">Fechados recentemente</span>';
	if (!archK.length)
		html += `<div class="rec-note">Projetos que você fechar a partir de agora ficam guardados aqui por segurança (últimos ${REC.max}) e voltam com 1 clique.</div>`;
	for (const k of archK) {
		let v = null;
		try {
			v = await sdbGet(k);
		} catch (e) {
			ignorarErro(e, 'recRenderBody');
		}
		if (!v) continue;
		html += `<div class="rec-row"><span class="rec-n">${esc(v.name || 'projeto')}</span><span class="rec-m">${v.nFiles != null ? v.nFiles : '?'} \
arquivo(s) · ${fmtB(v.bytes)} · ${relTime(v.t || Date.now())}${v.pd && v.pd.enc ? ' · \ud83d\udd12' : ''}</span>\
<button class="rec-btn" data-op="arch" data-k="${esc(k)}">Reabrir</button><button class="rec-btn" data-op="del" \
data-k="${esc(k)}">Excluir</button></div>`;
	}
	html += '</div>';
	html += '<div class="rec-sec"><span class="rec-t">Backups automáticos da sessão</span>';
	if (!bakK.length)
		html +=
			'<div class="rec-note">Cópias da sessão inteira passam a ser guardadas automaticamente: ' +
			'a cada ~5 minutos de uso e sempre que algo tentar sobrescrever uma sessão que tinha ' +
			'projetos.</div>';
	bakK.slice(0, 10).forEach((k) => {
		const t = +k.split('.')[2] || 0;
		const kind = k.indexOf('session.rescue.') === 0 ? 'Resgate automático' : 'Backup periódico';
		html += `<div class="rec-row"><span class="rec-n">${kind}</span><span class="rec-m">${t ? new Date(t).toLocaleString() : ''} \
· ${relTime(t || Date.now())}</span><button class="rec-btn" data-op="bak" data-k="${esc(k)}">Restaurar \
projetos</button></div>`;
	});
	html += '</div>';
	html +=
		'<div class="rec-note">Dica: para uma cópia fora do navegador use Exportar .zip. Os ' +
		'backups acima moram no armazenamento do navegador — se ele for limpo, eles também vão ' +
		'embora.</div>';
	body.innerHTML = html;
}
async function openRecentPanel() {
	recCssOnce();
	if (__recBack) {
		__recBack.remove();
		__recBack = null;
	}
	const back = document.createElement('div');
	back.className = 'ui-back';
	__recBack = back;
	back.innerHTML =
		'<div class="ui-modal rec-modal" role="dialog" aria-modal="true"><div class="ui-h">🕘 ' +
		'Projetos recentes e backups</div><div class="rec-body" id="recBody">Carregando…</div>' +
		'<div class="ui-actions"><button class="ui-btn" data-op="close">Fechar</button></div>' +
		'</div>';
	document.body.appendChild(back);
	back.addEventListener('mousedown', (e) => {
		if (e.target === back) {
			back.remove();
			__recBack = null;
		}
	});
	back.addEventListener('click', async (e) => {
		const b = e.target.closest('[data-op]');
		if (!b || b.disabled) return;
		const op = b.getAttribute('data-op'),
			k = b.getAttribute('data-k');
		try {
			if (op === 'close') {
				back.remove();
				__recBack = null;
				return;
			}
			if (op === 'unlock') {
				const rec = await sdbGet('session');
				back.remove();
				__recBack = null;
				promptUnlock(rec);
				return;
			}
			if (op === 'sess' || op === 'sess-all') {
				let sess = await sdbGet('session');
				if (sess && sess.enc) sess = await recDec(sess);
				if (!sess || !Array.isArray(sess.projects)) return;
				const pds = op === 'sess' ? [sess.projects[+b.getAttribute('data-j')]] : sess.projects;
				const n = await recOpen(pds);
				if (n) {
					back.remove();
					__recBack = null;
				}
				return;
			}
			if (op === 'arch') {
				const v = await sdbGet(k);
				if (!v) return;
				let pd = v.pd;
				if (pd && pd.enc) {
					pd = await recDec(pd);
					if (!pd) return;
				}
				const n = await recOpen([pd]);
				if (n) {
					await sdbDel(k);
					back.remove();
					__recBack = null;
				}
				return;
			}
			if (op === 'del') {
				await sdbDel(k);
				await recRenderBody(back.querySelector('#recBody'));
				return;
			}
			if (op === 'bak') {
				let v = await sdbGet(k);
				if (!v) return;
				if (v.enc) {
					v = await recDec(v);
					if (!v) return;
				}
				const n = await recOpen(v.projects || []);
				if (n) {
					back.remove();
					__recBack = null;
				}
				return;
			}
		} catch (err) {
			toast('Erro', String((err && err.message) || err), 'err');
		}
	});
	await recRenderBody(back.querySelector('#recBody'));
}

const LOCK = { key: null, salt: null };
function _b64(buf) {
	let s = '';
	const b = new Uint8Array(buf);
	for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
	return btoa(s);
}
function _ub64(str) {
	return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}
async function _deriveKey(pass, salt) {
	const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, [
		'deriveKey',
	]);
	return crypto.subtle.deriveKey(
		{ name: 'PBKDF2', salt: salt, iterations: 310000, hash: 'SHA-256' },
		km,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt'],
	);
}
async function _encSession(obj) {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const json = JSON.stringify(obj, (k, v) => {
		if (v instanceof Uint8Array) return { __u8: _b64(v) };
		if (v instanceof ArrayBuffer) return { __u8: _b64(new Uint8Array(v)) };
		return v;
	});
	const ct = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv: iv },
		LOCK.key,
		new TextEncoder().encode(json),
	);
	return { enc: 1, salt: _b64(LOCK.salt), iv: _b64(iv), ct: _b64(ct) };
}
async function _decSession(rec, key) {
	const pt = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv: _ub64(rec.iv) },
		key,
		_ub64(rec.ct),
	);
	return JSON.parse(new TextDecoder().decode(pt), (k, v) => {
		if (k === '__proto__' || k === 'constructor' || k === 'prototype') return undefined;
		if (v && typeof v === 'object' && typeof v.__u8 === 'string') return _ub64(v.__u8);
		return v;
	});
}
function updateLockBtn() {
	const b = $('#lockBtn');
	if (!b) return;
	b.innerHTML = iconSvg(LOCK.key ? 'lock' : 'unlock');
	b.classList.toggle('on', !!LOCK.key);
	b.title = LOCK.key
		? 'Projetos protegidos — clique para bloquear ou remover a senha'
		: 'Proteger projetos com senha';
}
function uiDialog(opts) {
	return new Promise((resolve) => {
		const back = document.createElement('div');
		back.className = 'ui-back';
		const fields = opts.fields || [];
		const buttons = opts.buttons || [{ id: 'ok', label: 'OK', primary: true }];
		const fieldHtml = fields
			.map(
				(f) =>
					`<input class="ui-input" data-k="${f.key}" type="${f.password ? 'password' : 'text'}" placeholder="${esc(f.placeholder || '')}" autocomplete="off" spellcheck="false"/>`,
			)
			.join('');
		const btnHtml = buttons
			.map(
				(b) =>
					`<button class="ui-btn${b.primary ? ' primary' : ''}${b.danger ? ' danger' : ''}" data-act="${b.id}">${esc(b.label)}</button>`,
			)
			.join('');
		back.innerHTML =
			'<div class="ui-modal" role="dialog" aria-modal="true"><div class="ui-h">' +
			esc(opts.title || '') +
			'</div>' +
			(opts.message ? `<div class="ui-msg">${esc(opts.message)}</div>` : '') +
			(fieldHtml ? `<div class="ui-fields">${fieldHtml}</div>` : '') +
			'<div class="ui-actions">' +
			btnHtml +
			'</div></div>';
		document.body.appendChild(back);
		const inputs = [...back.querySelectorAll('.ui-input')];
		if (inputs[0]) setTimeout(() => inputs[0].focus(), 30);
		function done(act) {
			const values = {};
			inputs.forEach((i) => (values[i.dataset.k] = i.value));
			document.removeEventListener('keydown', onKey, true);
			back.remove();
			resolve({ act: act, values: values });
		}
		function onKey(e) {
			if (e.key === 'Escape') {
				e.preventDefault();
				done(null);
			} else if (e.key === 'Enter') {
				const prim = buttons.find((b) => b.primary);
				if (prim) {
					e.preventDefault();
					done(prim.id);
				}
			}
		}
		back.addEventListener('mousedown', (e) => {
			if (e.target === back) done(null);
		});
		back
			.querySelectorAll('[data-act]')
			.forEach((b) => b.addEventListener('click', () => done(b.getAttribute('data-act'))));
		document.addEventListener('keydown', onKey, true);
	});
}
async function uiPrompt(title, message, opts) {
	opts = opts || {};
	const r = await uiDialog({
		title: title,
		message: message,
		fields: [{ key: 'v', password: opts.password, placeholder: opts.placeholder }],
		buttons: [
			{ id: 'cancel', label: 'Cancelar' },
			{ id: 'ok', label: opts.okLabel || 'Confirmar', primary: true },
		],
	});
	return r.act === 'ok' ? r.values.v || '' : null;
}
async function lockBtnClick() {
	if (!LOCK.key) {
		enableLock();
		return;
	}
	const r = await uiDialog({
		title: 'Proteção por senha ativa',
		message: 'Seus projetos estão protegidos com senha neste navegador.',
		buttons: [
			{ id: 'cancel', label: 'Cancelar' },
			{ id: 'remove', label: 'Remover senha', danger: true },
			{ id: 'lock', label: 'Bloquear agora', primary: true },
		],
	});
	if (r.act === 'lock') {
		lockNow();
	} else if (r.act === 'remove') {
		disableLock();
	}
}
async function enableLock() {
	if (!(window.crypto && crypto.subtle)) {
		toast(
			'Indisponível aqui',
			'Abra o arquivo baixado (ou hospede em https/localhost) — a prévia do Notion bloqueia a criptografia',
			'warn',
		);
		return;
	}
	const pass = await uiPrompt(
		'Proteger projetos',
		'Crie uma senha (mín. 8 caracteres) para proteger seus projetos NESTE navegador. Sem ela não há recuperação.',
		{ password: true, placeholder: 'Nova senha', okLabel: 'Continuar' },
	);
	if (pass == null) return;
	if (pass.length < 8) {
		toast('Senha curta', 'Use pelo menos 8 caracteres na senha', 'err');
		return;
	}
	const pass2 = await uiPrompt('Confirme a senha', 'Digite a senha novamente para confirmar.', {
		password: true,
		placeholder: 'Repita a senha',
		okLabel: 'Ativar proteção',
	});
	if (pass2 == null) return;
	if (pass2 !== pass) {
		toast('Senhas diferentes', 'Tente novamente', 'err');
		return;
	}
	LOCK.salt = crypto.getRandomValues(new Uint8Array(16));
	LOCK.key = await _deriveKey(pass, LOCK.salt);
	try {
		await sdbPut('session', await _encSession(serializeSession()));
	} catch (e) {
		ignorarErro(e, 'enableLock');
	}
	updateLockBtn();
	resetIdleLock();
	toast('Proteção ativada', 'Seus projetos agora exigem senha ao abrir', 'ok');
}
async function disableLock() {
	if (!LOCK.key) return;
	LOCK.key = null;
	LOCK.salt = null;
	try {
		await sdbPut('session', serializeSession());
	} catch (e) {
		ignorarErro(e, 'disableLock');
	}
	updateLockBtn();
	toast('Proteção removida', 'Os projetos não exigem mais senha', 'ok');
}
async function lockNow() {
	if (!LOCK.key) {
		toast('Sem proteção', 'Ative a proteção com senha primeiro', 'warn');
		return;
	}
	try {
		await sdbPut('session', await _encSession(serializeSession()));
	} catch (e) {
		ignorarErro(e, 'lockNow');
	}
	LOCK.key = null;
	State.suppressSave = true;
	[...State.projects].forEach((p) => {
		revokeBlobs(p);
		if (p.channel) p.channel.close();
		if (p.popout && !p.popout.closed) p.popout.close();
	});
	State.projects = [];
	State.active = null;
	State.suppressSave = false;
	renderAll();
	renderPreviewEmpty(true);
	hidePreviewError();
	updateLockBtn();
	const rec = await sdbGet('session');
	promptUnlock(rec);
}
let __idleT = null;
function resetIdleLock() {
	clearTimeout(__idleT);
	if (!LOCK || !LOCK.key) return;
	__idleT = setTimeout(() => {
		if (LOCK.key) {
			toast('Bloqueado por inatividade', 'Digite a senha para voltar a abrir os projetos', 'warn');
			lockNow();
		}
	}, 600000);
}
async function promptUnlock(rec) {
	if (!rec || !rec.enc) return false;
	const salt = _ub64(rec.salt);
	for (let i = 0; i < 5; i++) {
		const pass = await uiPrompt(
			i ? 'Senha incorreta' : '🔒 Projetos protegidos',
			i
				? 'Tente de novo. (Cancelar mantém os projetos bloqueados.)'
				: 'Digite a senha para desbloquear seus projetos.',
			{ password: true, placeholder: 'Senha', okLabel: 'Desbloquear' },
		);
		if (pass == null) {
			toast('Projetos bloqueados', 'Clique no cadeado para desbloquear quando quiser', 'warn');
			updateLockBtn();
			return false;
		}
		try {
			const key = await _deriveKey(pass, salt);
			const data = await _decSession(rec, key);
			LOCK.key = key;
			LOCK.salt = salt;
			if (restoreSession(data)) {
				setLayout(State.layout);
				setDevice(State.device);
				renderAll();
				const p = activeProject();
				if (p) {
					if (p.openFile) openFileInEditor(p.openFile);
					buildPreview(p);
				}
			}
			updateLockBtn();
			resetIdleLock();
			toast('Desbloqueado', 'Sessão restaurada', 'ok');
			return true;
		} catch (e) {
			ignorarErro(e, 'promptUnlock');
		}
	}
	toast('Muitas tentativas', 'Recarregue a página para tentar novamente', 'err');
	updateLockBtn();
	return false;
}
function serializeSession() {
	return {
		v: 1,
		teams: tmSerialize(),
		active: State.active,
		layout: State.layout,
		device: State.device,
		agents: {
			claims: AG.claims,
			log: AG.log.slice(-120),
			msgs: AG.msgs.slice(-60),
			seen: AG.seen,
			msgSeq: AG.msgSeq,
		},
		projects: State.projects.map((p) => ({
			id: p.id,
			name: p.name,
			kind: p.kind,
			openFile: p.openFile,
			openTabs: p.openTabs || [],
			emptyDirs: [...(p.emptyDirs || [])],
			snapSeq: p.snapSeq || 0,
			snapshots: p.snapshots || [],
			files: [...p.files.entries()].map(([path, f]) => [
				path,
				{
					path: f.path || path,
					data: f.data,
					text: f.text,
					isText: f.isText,
					history: f.history || [],
				},
			]),
		})),
	};
}
let __saveT = null;
async function __sessionFlush() {
	try {
		const s = serializeSession();
		try {
			if (!s.projects.length) {
				const old = await sdbGet('session');
				if (old && (old.enc || (old.projects && old.projects.length))) {
					await sdbPut('session.rescue.' + recTs(), old);
					await recPrune('session.rescue.', 5);
				}
			} else if (Date.now() - REC.lastGen > REC.genMs) {
				REC.lastGen = Date.now();
				await sdbPut('session.gen.' + recTs(), LOCK.key ? await _encSession(s) : s);
				await recPrune('session.gen.', 8);
			}
		} catch (e) {
			ignorarErro(e, '__sessionFlush');
		}
		await sdbPut('session', LOCK.key ? await _encSession(s) : s);
	} catch (e) {
		ignorarErro(e, '__sessionFlush');
	}
}
function saveSession() {
	if (State.suppressSave) return;
	clearTimeout(__saveT);
	__saveT = setTimeout(__sessionFlush, 450);
}
function restoreSession(data) {
	if (!data || !data.projects || !data.projects.length) return false;
	State.suppressSave = true;
	for (const pd of data.projects) {
		try {
			const files = new Map();
			for (const [path, f] of pd.files || []) {
				files.set(path, {
					path: (f && f.path) || path,
					data: f ? f.data : null,
					text: f ? f.text : null,
					isText: f ? f.isText : false,
					history: (f && f.history) || [],
				});
			}
			if (!files.size) continue;
			const pkg = readPackageJson(files);
			const detect = Core.detectProject([...files.keys()], pkg);
			try {
				const __be = AuroraFix.pickBestEntry(files, detect);
				if (__be) detect.entry = __be;
			} catch (e) {
				ignorarErro(e, 'restoreSession');
			}
			const proj = {
				id: pd.id || nid(),
				name: pd.name || 'projeto',
				kind: pd.kind || 'folder',
				files,
				detect,
				entry: detect.entry,
				openFile: pd.openFile || detect.entry || pickDefaultFile(files),
				dirty: new Set(),
				emptyDirs: new Set(
					(pd.emptyDirs || []).filter((d) => typeof d === 'string' && validRelPath(d)),
				),
				blobs: new Set(),
				popout: null,
				channel: null,
				logs: [],
				snapshots: Array.isArray(pd.snapshots) ? pd.snapshots : [],
				snapSeq: pd.snapSeq || 0,
				runtimeMode: detect.type,
			};
			proj.openTabs = (pd.openTabs && pd.openTabs.filter((p) => files.has(p))) || [];
			if (proj.openFile && !proj.openTabs.includes(proj.openFile))
				proj.openTabs.unshift(proj.openFile);
			proj.blocked =
				typeof auroraShouldBlock === 'function'
					? auroraShouldBlock(detect)
					: detect.type === 'build' && !(window.crossOriginIsolated && navigator.onLine);
			try {
				proj.channel = new BroadcastChannel('aurora-lp-' + proj.id);
			} catch (e) {
				ignorarErro(e, 'restoreSession');
			}
			const m = /^p(\d+)$/.exec(proj.id);
			if (m) uid = Math.max(uid, +m[1] + 1);
			try {
				tmAdopt(proj);
			} catch (e) {
				ignorarErro(e, 'restoreSession');
			}
			State.projects.push(proj);
		} catch (e) {
			ignorarErro(e, 'restoreSession');
		}
	}
	try {
		const ag = data.agents;
		if (ag && typeof ag === 'object') {
			AG.claims = ag.claims && typeof ag.claims === 'object' ? ag.claims : {};
			AG.log = Array.isArray(ag.log) ? ag.log : [];
			AG.msgs = Array.isArray(ag.msgs) ? ag.msgs : [];
			AG.seen = ag.seen && typeof ag.seen === 'object' ? ag.seen : {};
			AG.msgSeq = ag.msgSeq || 1;
		}
	} catch (e) {
		ignorarErro(e, 'restoreSession');
	}
	try {
		tmRestore(data.teams);
	} catch (e) {
		ignorarErro(e, 'restoreSession');
	}
	if (!State.projects.length) {
		State.suppressSave = false;
		return false;
	}
	State.active =
		data.active && State.projects.some((p) => p.id === data.active)
			? data.active
			: State.projects[0].id;
	if (data.layout) State.layout = data.layout;
	if (data.device) State.device = data.device;
	State.suppressSave = false;
	return true;
}
function resetFirstRunUI() {
	try {
		el.frame.removeAttribute('srcdoc');
		el.frame.removeAttribute('src');
	} catch (e) {
		ignorarErro(e, 'resetFirstRunUI');
	}
	try {
		renderAll();
	} catch (e) {
		ignorarErro(e, 'resetFirstRunUI');
	}
	try {
		renderPreviewEmpty(true);
	} catch (e) {
		ignorarErro(e, 'resetFirstRunUI');
	}
	try {
		editorToEmpty();
	} catch (e) {
		ignorarErro(e, 'resetFirstRunUI');
	}
	try {
		hidePreviewLoading();
	} catch (e) {
		ignorarErro(e, 'resetFirstRunUI');
	}
}
async function restoreOnBoot() {
	let data = null;
	try {
		data = await sdbGet('session');
	} catch (e) {
		ignorarErro(e, 'restoreOnBoot');
	}
	if (data && data.enc) {
		updateLockBtn();
		await promptUnlock(data);
		return;
	}
	const want = data && Array.isArray(data.projects) ? data.projects.length : 0;
	if (restoreSession(data)) {
		setLayout(State.layout);
		setDevice(State.device);
		renderAll();
		const p = activeProject();
		if (p) {
			try {
				if (p.openFile) openFileInEditor(p.openFile);
			} catch (_e) {
				registro.aviso('[Synapse] restore open', _e);
			}
			try {
				buildPreview(p);
			} catch (_e) {
				registro.aviso('[Synapse] restore preview', _e);
			}
		}
		if (State.projects.length < want) {
			try {
				await sdbPut('session.rescue.' + recTs(), data);
				await recPrune('session.rescue.', 5);
			} catch (e) {
				ignorarErro(e, 'restoreOnBoot');
			}
			recFlagBtn();
			toast(
				'Restauração parcial',
				want -
					State.projects.length +
					' projeto(s) não abriram — clique no relógio (Recentes) para recuperar',
				'warn',
			);
		} else toast('Sessão restaurada', State.projects.length + ' projeto(s) reaberto(s)', 'ok');
		return;
	}
	resetFirstRunUI();
	if (want) {
		try {
			await sdbPut('session.rescue.' + recTs(), data);
			await recPrune('session.rescue.', 5);
		} catch (e) {
			ignorarErro(e, 'restoreOnBoot');
		}
		recFlagBtn();
		toast(
			'Sessão encontrada, mas não abriu',
			'Ela foi copiada para um backup seguro — abrindo o painel de recuperação',
			'warn',
		);
		try {
			openRecentPanel();
		} catch (e) {
			ignorarErro(e, 'restoreOnBoot');
		}
		return;
	}
	try {
		const ks = await sdbKeys();
		if (
			ks.some(
				(k) =>
					typeof k === 'string' &&
					(k.indexOf('recent.proj.') === 0 ||
						k.indexOf('session.gen.') === 0 ||
						k.indexOf('session.rescue.') === 0),
			)
		) {
			recFlagBtn();
			toast(
				'Sessão vazia',
				'Há projetos recuperáveis no painel Recentes (ícone de relógio)',
				'warn',
			);
		}
	} catch (e) {
		ignorarErro(e, 'restoreOnBoot');
	}
}
async function clearSession() {
	await sdbDel('session');
	State.suppressSave = true;
	[...State.projects].forEach((p) => {
		revokeBlobs(p);
		if (p.channel) p.channel.close();
		if (p.popout && !p.popout.closed) p.popout.close();
	});
	State.projects = [];
	State.active = null;
	State.suppressSave = false;
	renderAll();
	renderPreviewEmpty(true);
	disposeMedia();
	el.editorGrid.classList.add('hidden');
	el.editorEmpty.classList.remove('hidden');
	el.editorEmpty.innerHTML = `<div>${iconSvg('code', 'icon')}Selecione um arquivo no Explorer para editar</div>`;
	toast('Sessão limpa', 'Os projetos salvos foram removidos', 'ok');
}

function toggleSidebar() {
	const hid = el.explorer.classList.toggle('hidden');
	const rz = $('#rz1');
	if (rz) rz.classList.toggle('hidden', hid);
	applyDevice();
}

function commandList() {
	const has = !!activeProject();
	const cmds = [
		{
			id: 'imp-zip',
			label: 'Importar .zip',
			hint: 'projeto',
			icon: 'zip',
			run: () => $('#fileZip').click(),
		},
		{
			id: 'imp-assets',
			label: 'Importar assets (.zip)',
			hint: 'assets',
			icon: 'zip',
			run: () => $('#fileAssets').click(),
		},
		{
			id: 'imp-folder',
			label: 'Importar pasta',
			hint: 'projeto',
			icon: 'folder',
			run: () => $('#fileFolder').click(),
		},
		{
			id: 'imp-html',
			label: 'Importar index.html avulso',
			hint: 'projeto',
			icon: 'html',
			run: () => $('#fileHtml').click(),
		},
		{
			id: 'imp-sample',
			label: 'Carregar exemplo',
			hint: 'demo',
			icon: 'spark',
			run: () => loadSample(),
		},
		{
			id: 'export-zip',
			label: 'Exportar projeto (.zip)',
			hint: 'download',
			icon: 'export',
			on: has,
			run: () => exportZipDialog(),
		},
		{
			id: 'new-file',
			label: 'Novo arquivo',
			hint: 'projeto',
			icon: 'plus',
			on: has,
			run: () => ctxNewFile(''),
		},
		{
			id: 'new-folder',
			label: 'Nova pasta',
			hint: 'projeto',
			icon: 'folder',
			on: has,
			run: () => ctxNewFolder(''),
		},
		{
			id: 'theme',
			label: 'Alternar tema',
			hint: 'aparência',
			icon: 'palette',
			run: toggleTheme,
		},
		{
			id: 'qopen',
			label: 'Buscar arquivo / conteúdo',
			hint: 'Ctrl/⌘ P',
			icon: 'search',
			on: has,
			run: () => openQuickOpen(true),
		},
		{
			id: 'find-replace',
			label: 'Buscar e substituir (todos os arquivos)',
			hint: 'Ctrl/⌘ ⇧ F',
			icon: 'search',
			on: has,
			run: () => openFindReplace(true),
		},
		{
			id: 'format',
			label: 'Formatar código (arquivo atual)',
			hint: 'Shift+Alt+F',
			icon: 'spark',
			on: has,
			run: formatActiveFile,
		},
		{
			id: 'history',
			label: 'Histórico de versões do arquivo',
			hint: 'Ctrl/⌘ H',
			icon: 'clock',
			on: has,
			run: openHistory,
		},
		{
			id: 'lock',
			label: 'Proteção por senha (bloquear / proteger projetos)',
			hint: 'segurança',
			icon: 'lock',
			run: lockBtnClick,
		},
		{
			id: 'mcp',
			label: 'MCP para Notion (conectar agente de IA)',
			hint: 'integração',
			icon: 'mcp',
			run: () =>
				setTimeout(() => {
					const m = document.getElementById('mcpMenu');
					if (m) m.classList.add('open');
				}, 0),
		},
		{
			id: 'reload',
			label: 'Recarregar preview',
			hint: 'preview',
			icon: 'reload',
			on: has,
			run: () => {
				const p = activeProject();
				if (p) buildPreview(p);
			},
		},
		{
			id: 'console',
			label: (State.consoleOpen ? 'Fechar' : 'Abrir') + ' console',
			hint: 'preview',
			icon: 'term',
			run: () => openConsole(!State.consoleOpen),
		},
		{
			id: 'popout',
			label: 'Abrir preview em nova aba',
			hint: 'preview',
			icon: 'external',
			on: has,
			run: openPopout,
		},
		{
			id: 'lay-split',
			label: 'Layout: Editor + Preview',
			hint: 'layout',
			icon: 'split',
			run: () => setLayout('split'),
		},
		{
			id: 'lay-editor',
			label: 'Layout: Só editor',
			hint: 'layout',
			icon: 'code',
			run: () => setLayout('editor'),
		},
		{
			id: 'lay-preview',
			label: 'Layout: Só preview',
			hint: 'layout',
			icon: 'eye',
			run: () => setLayout('preview'),
		},
		{
			id: 'dev-resp',
			label: 'Dispositivo: Responsivo',
			hint: 'preview',
			icon: 'resp',
			run: () => setDevice('responsive'),
		},
		{
			id: 'dev-desktop',
			label: 'Dispositivo: Desktop',
			hint: 'preview',
			icon: 'desktop',
			run: () => setDevice('desktop'),
		},
		{
			id: 'dev-tablet',
			label: 'Dispositivo: Tablet',
			hint: 'preview',
			icon: 'tablet',
			run: () => setDevice('tablet'),
		},
		{
			id: 'dev-mobile',
			label: 'Dispositivo: Mobile',
			hint: 'preview',
			icon: 'mobile',
			run: () => setDevice('mobile'),
		},
		{
			id: 'sidebar',
			label: 'Mostrar/ocultar Explorer',
			hint: 'layout',
			icon: 'collapse',
			run: toggleSidebar,
		},
		{
			id: 'clear-console',
			label: 'Limpar console',
			hint: 'preview',
			icon: 'trash',
			on: has,
			run: () => {
				const p = activeProject();
				if (p) {
					p.logs = [];
					renderConsole();
					updateBadge(p);
				}
			},
		},
		{
			id: 'close',
			label: 'Fechar projeto atual',
			hint: 'projeto',
			icon: 'close',
			on: has,
			run: () => {
				if (State.active) closeProject(State.active);
			},
		},
		{
			id: 'recent-panel',
			label: 'Projetos recentes e backups (recuperar projetos fechados)',
			hint: 'recuperar recentes backup restaurar',
			icon: 'reload',
			run: openRecentPanel,
		},
		{
			id: 'clear-session',
			label: 'Limpar sessão salva (remove todos os projetos)',
			hint: 'sessão',
			icon: 'trash',
			run: clearSession,
		},
	];
	return cmds.filter((c) => c.on === undefined || c.on);
}
const __cmd = { items: [], sel: 0 };
function openPalette(open) {
	State.paletteOpen = !!open;
	el.cmdkBack.classList.toggle('hidden', !open);
	if (open) {
		el.cmdkIcon.innerHTML = iconSvg('command');
		el.cmdkInput.value = '';
		renderPalette('');
		setTimeout(() => el.cmdkInput.focus(), 0);
	}
}
function renderPalette(q) {
	q = (q || '').toLowerCase().trim();
	const all = commandList();
	const items = q
		? all.filter(
				(c) => c.label.toLowerCase().includes(q) || (c.hint || '').toLowerCase().includes(q),
			)
		: all;
	__cmd.items = items;
	__cmd.sel = 0;
	el.cmdkList.innerHTML = items.length
		? items
				.map(
					(c, i) =>
						`<button class="cmdk-item${i === 0 ? ' sel' : ''}" data-i="${i}">${iconSvg(c.icon, 'cmdk-ic2')}<span \
class="cmdk-lbl">${esc(c.label)}</span><span class="cmdk-hint">${esc(c.hint || '')}</span></button>`,
				)
				.join('')
		: '<div class="cmdk-empty">Nenhum comando encontrado</div>';
}
function moveSel(d) {
	const n = __cmd.items.length;
	if (!n) return;
	__cmd.sel = (__cmd.sel + d + n) % n;
	[...el.cmdkList.children].forEach((c, i) => {
		if (c.classList) c.classList.toggle('sel', i === __cmd.sel);
	});
	const s = el.cmdkList.children[__cmd.sel];
	if (s && s.scrollIntoView) s.scrollIntoView({ block: 'nearest' });
}
function runSel() {
	const c = __cmd.items[__cmd.sel];
	openPalette(false);
	if (c && c.run) {
		try {
			c.run();
		} catch (e) {
			ignorarErro(e, 'runSel');
		}
	}
}
function wirePalette() {
	el.cmdkInput.addEventListener('input', () => renderPalette(el.cmdkInput.value));
	el.cmdkInput.addEventListener('keydown', (e) => {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			moveSel(1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			moveSel(-1);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			runSel();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			openPalette(false);
		}
	});
	el.cmdkList.addEventListener('click', (e) => {
		const b = e.target.closest('[data-i]');
		if (b) {
			__cmd.sel = +b.dataset.i;
			runSel();
		}
	});
	el.cmdkBack.addEventListener('click', (e) => {
		if (e.target === el.cmdkBack) openPalette(false);
	});
}

const __qo = { items: [], sel: 0 };
function fileIconKey(path) {
	const e = (path.split('.').pop() || '').toLowerCase();
	return (
		{
			html: 'html',
			htm: 'html',
			css: 'css',
			js: 'js',
			jsx: 'js',
			mjs: 'js',
			ts: 'js',
			tsx: 'js',
			json: 'json',
			png: 'img',
			jpg: 'img',
			jpeg: 'img',
			gif: 'img',
			svg: 'img',
			webp: 'img',
		}[e] || 'file'
	);
}
function dirOf(path) {
	const i = path.lastIndexOf('/');
	return i < 0 ? '' : path.slice(0, i);
}
function fuzzyMatch(q, s) {
	s = s.toLowerCase();
	let i = 0;
	for (const c of q) {
		i = s.indexOf(c, i);
		if (i < 0) return false;
		i++;
	}
	return true;
}
function openQuickOpen(open) {
	el.qopenBack.classList.toggle('hidden', !open);
	State.paletteOpen = !!open;
	if (open) {
		el.qopenIcon.innerHTML = iconSvg('search');
		el.qopenInput.value = '';
		renderQuickOpen('');
		setTimeout(() => el.qopenInput.focus(), 0);
	}
}
function renderQuickOpen(q) {
	q = (q || '').toLowerCase().trim();
	const proj = activeProject();
	const items = [];
	if (proj) {
		const paths = [...proj.files.keys()].sort();
		for (const p of paths) {
			if (!q || fuzzyMatch(q, p)) items.push({ kind: 'file', path: p });
		}
		if (q.length >= 2) {
			let budget = 60;
			for (const p of paths) {
				const f = proj.files.get(p);
				if (!f || !f.isText || f.text == null) continue;
				const lines = f.text.split('\n');
				for (let i = 0; i < lines.length && budget > 0; i++) {
					if (lines[i].toLowerCase().includes(q)) {
						items.push({
							kind: 'content',
							path: p,
							line: i + 1,
							snippet: lines[i].trim().slice(0, 90),
						});
						budget--;
					}
				}
				if (budget <= 0) break;
			}
		}
	}
	__qo.items = items.slice(0, 120);
	__qo.sel = 0;
	el.qopenList.innerHTML = __qo.items.length
		? __qo.items
				.map((it, i) => {
					const sub =
						it.kind === 'content'
							? `<span class="cmdk-sub">linha ${it.line}: ${esc(it.snippet)}</span>`
							: `<span class="cmdk-hint">${esc(dirOf(it.path) || '/')}</span>`;
					return `<button class="cmdk-item${i === 0 ? ' sel' : ''}" data-i="${i}">${iconSvg(it.kind === 'content' ? 'search' : fileIconKey(it.path), 'cmdk-ic2')}<span \
class="cmdk-lbl">${esc(Core.basename(it.path))}</span>${sub}</button>`;
				})
				.join('')
		: `<div class="cmdk-empty">${proj ? 'Nenhum resultado' : 'Importe um projeto primeiro'}</div>`;
}
function qoMoveSel(d) {
	const n = __qo.items.length;
	if (!n) return;
	__qo.sel = (__qo.sel + d + n) % n;
	[...el.qopenList.children].forEach((c, i) => {
		if (c.classList) c.classList.toggle('sel', i === __qo.sel);
	});
	const s = el.qopenList.children[__qo.sel];
	if (s && s.scrollIntoView) s.scrollIntoView({ block: 'nearest' });
}
function qoRun() {
	const it = __qo.items[__qo.sel];
	openQuickOpen(false);
	if (!it) return;
	openFileInEditor(it.path);
	if (it.kind === 'content' && it.line) setTimeout(() => jumpToLine(it.line), 60);
}
function jumpToLine(line) {
	const ta = el.codeTa;
	if (!ta) return;
	if (__folds.size) {
		const _p = activeProject();
		clearFolds();
		if (_p && _p.openFile) {
			const _f = _p.files.get(_p.openFile);
			if (_f) paintEditor(_p.openFile, _f.text);
		}
	}
	const lines = ta.value.split('\n');
	let pos = 0;
	for (let i = 0; i < line - 1 && i < lines.length; i++) pos += lines[i].length + 1;
	ta.focus();
	try {
		ta.setSelectionRange(pos, pos + (lines[line - 1] || '').length);
	} catch (e) {
		ignorarErro(e, 'jumpToLine');
	}
	const lh = parseFloat(getComputedStyle(ta).lineHeight) || 20;
	if (el.editorScroll) el.editorScroll.scrollTop = Math.max(0, (line - 1) * lh - 80);
}
function __scanState(line, st) {
	let depth = st.depth,
		inBlock = st.inBlock,
		inTmpl = st.inTmpl;
	let i = 0;
	const n = line.length;
	while (i < n) {
		const c = line[i],
			c2 = line[i + 1];
		if (inBlock) {
			if (c === '*' && c2 === '/') {
				inBlock = false;
				i += 2;
				continue;
			}
			i++;
			continue;
		}
		if (inTmpl) {
			if (c === '\\') {
				i += 2;
				continue;
			}
			if (c === '`') {
				inTmpl = false;
				i++;
				continue;
			}
			i++;
			continue;
		}
		if (c === '/' && c2 === '*') {
			inBlock = true;
			i += 2;
			continue;
		}
		if (c === '/' && c2 === '/') break;
		if (c === '`') {
			inTmpl = true;
			i++;
			continue;
		}
		if (c === '"' || c === "'") {
			const q = c;
			i++;
			while (i < n) {
				if (line[i] === '\\') {
					i += 2;
					continue;
				}
				if (line[i] === q) {
					i++;
					break;
				}
				i++;
			}
			continue;
		}
		if (c === '{' || c === '(' || c === '[') depth++;
		else if (c === '}' || c === ')' || c === ']') depth--;
		i++;
	}
	return { depth: depth, inBlock: inBlock, inTmpl: inTmpl };
}
function reindentCode(src, unit) {
	unit = unit || '  ';
	const lines = src.replace(/\r\n?/g, '\n').split('\n');
	let depth = 0,
		inBlock = false,
		inTmpl = false;
	const out = [];
	for (const raw of lines) {
		if (inBlock || inTmpl) {
			out.push(raw);
			const r = __scanState(raw, { depth: depth, inBlock: inBlock, inTmpl: inTmpl });
			depth = r.depth;
			inBlock = r.inBlock;
			inTmpl = r.inTmpl;
			continue;
		}
		const trimmed = raw.replace(/^\s+/, '');
		let lead = 0;
		for (const ch of trimmed) {
			if (ch === '}' || ch === ')' || ch === ']') lead++;
			else break;
		}
		const indent = Math.max(0, depth - lead);
		out.push(trimmed.length ? unit.repeat(indent) + trimmed : '');
		const r = __scanState(trimmed, { depth: depth, inBlock: false, inTmpl: false });
		depth = Math.max(0, r.depth);
		inBlock = r.inBlock;
		inTmpl = r.inTmpl;
	}
	return out.join('\n');
}
function formatCss(src) {
	const unit = '  ';
	const s = src.replace(/\r\n?/g, '\n');
	const out = [];
	let depth = 0,
		buf = '',
		i = 0;
	const n = s.length;
	let inStr = false,
		q = '',
		inCmt = false;
	function push(t) {
		t = (t || '').trim();
		if (t !== '') out.push(unit.repeat(Math.max(0, depth)) + t);
	}
	while (i < n) {
		const c = s[i],
			c2 = s[i + 1];
		if (inCmt) {
			buf += c;
			if (c === '*' && c2 === '/') {
				buf += '/';
				i += 2;
				push(buf);
				buf = '';
				inCmt = false;
				continue;
			}
			i++;
			continue;
		}
		if (inStr) {
			buf += c;
			if (c === '\\') {
				buf += c2 || '';
				i += 2;
				continue;
			}
			if (c === q) inStr = false;
			i++;
			continue;
		}
		if (c === '/' && c2 === '*') {
			if (buf.trim()) push(buf);
			buf = '/*';
			i += 2;
			inCmt = true;
			continue;
		}
		if (c === '"' || c === "'") {
			inStr = true;
			q = c;
			buf += c;
			i++;
			continue;
		}
		if (c === '{') {
			push(buf.trim() + ' {');
			buf = '';
			depth++;
			i++;
			continue;
		}
		if (c === '}') {
			if (buf.trim()) push(buf);
			buf = '';
			depth = Math.max(0, depth - 1);
			push('}');
			i++;
			continue;
		}
		if (c === ';') {
			push(buf + ';');
			buf = '';
			i++;
			continue;
		}
		if (c === '\n') {
			i++;
			continue;
		}
		buf += c;
		i++;
	}
	if (buf.trim()) push(buf);
	return out.join('\n');
}
function formatHtml(src) {
	const unit = '  ';
	let s = src.replace(/\r\n?/g, '\n');
	const raw = [];
	s = s.replace(/<(script|style|pre|textarea)([\s\S]*?)<\/\1>/gi, function (m) {
		raw.push(m);
		return `@@RAW${raw.length - 1}@@`;
	});
	s = s.replace(/>\s*</g, '>\n<');
	const lines = s.split('\n');
	let depth = 0;
	const out = [];
	const voidEl = /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr|!)/i;
	for (let ln of lines) {
		const t = ln.trim();
		if (t === '') continue;
		const isEnd = /^<\//.test(t);
		const isOpen = /^<[a-zA-Z!]/.test(t);
		const tag = (t.match(/^<\/?([a-zA-Z0-9]+)/) || [])[1] || '';
		const selfClose = /\/>\s*$/.test(t) || voidEl.test(t.replace(/^<\//, '<'));
		const sameClose = tag && new RegExp(`</${tag}>\\s*$`, 'i').test(t);
		if (isEnd) depth = Math.max(0, depth - 1);
		out.push(unit.repeat(depth) + t);
		if (isOpen && !isEnd && !selfClose && !sameClose && !/^<!\x2d\x2d/.test(t)) depth++;
	}
	let res = out.join('\n');
	res = res.replace(/@@RAW(\d+)@@/g, function (m, d) {
		return raw[+d];
	});
	return res;
}
function formatCode(text, ext) {
	ext = (ext || '').toLowerCase();
	if (ext === '.json') return JSON.stringify(JSON.parse(text), null, 2) + '\n';
	if (ext === '.css' || ext === '.scss' || ext === '.less') return formatCss(text);
	if (ext === '.html' || ext === '.htm' || ext === '.xml' || ext === '.svg' || ext === '.vue')
		return formatHtml(text);
	return reindentCode(text, '  ');
}
function formatActiveFile() {
	const proj = activeProject();
	if (!proj || !proj.openFile) {
		toast('Nada para formatar', 'Abra um arquivo primeiro', '');
		return;
	}
	const f = proj.files.get(proj.openFile);
	if (!f || !f.isText || f.text == null) {
		toast('Nao da para formatar', 'Este arquivo nao e texto', 'warn');
		return;
	}
	let out;
	try {
		out = formatCode(f.text, Core.extname(proj.openFile));
	} catch (e) {
		toast('Falha ao formatar', (e && e.message) || 'Conteudo invalido', 'err');
		return;
	}
	if (out === f.text) {
		toast('Ja esta formatado', 'Nenhuma mudanca necessaria', 'ok');
		return;
	}
	if (!f.history) f.history = [];
	const last = f.history[f.history.length - 1];
	if (!last || last.text !== f.text) f.history.push({ t: Date.now(), text: f.text });
	if (f.history.length > 40) f.history.splice(0, f.history.length - 40);
	f.text = out;
	f.data = null;
	proj.dirty.add(proj.openFile);
	el.editorDirty.classList.add('on');
	clearFolds();
	el.codeTa.value = out;
	paintEditor(proj.openFile, out);
	renderEditorTabs();
	scheduleBuild(proj);
	saveSession();
	toast('Codigo formatado', `"${Core.basename(proj.openFile)}" reindentado`, 'ok');
}
const __fr = { items: [], case: false, regex: false };
function openFindReplace(open) {
	el.frBack.classList.toggle('hidden', !open);
	State.paletteOpen = !!open;
	if (open) {
		if (el.frIcon) el.frIcon.innerHTML = iconSvg('search');
		el.frCase.classList.toggle('on', __fr.case);
		el.frRegex.classList.toggle('on', __fr.regex);
		renderFindReplace();
		setTimeout(function () {
			el.frFind.focus();
		}, 0);
	}
}
function frBuildRegex() {
	const q = el.frFind.value;
	if (!q) return null;
	const flags = 'g' + (__fr.case ? '' : 'i');
	try {
		return __fr.regex
			? new RegExp(q, flags)
			: new RegExp(
					q.replace(/[^A-Za-z0-9_]/g, function (c) {
						return '\\' + c;
					}),
					flags,
				);
	} catch (e) {
		return false;
	}
}
function renderFindReplace() {
	const proj = activeProject();
	const re = frBuildRegex();
	__fr.items = [];
	let total = 0;
	if (proj && re) {
		for (const p of [...proj.files.keys()].sort()) {
			const f = proj.files.get(p);
			if (!f || !f.isText || f.text == null) continue;
			re.lastIndex = 0;
			let m,
				c = 0,
				first = 0;
			const text = f.text;
			while ((m = re.exec(text))) {
				c++;
				if (c === 1) first = text.slice(0, m.index).split('\n').length;
				if (m.index === re.lastIndex) re.lastIndex++;
				if (c > 9999) break;
			}
			if (c > 0) {
				__fr.items.push({ path: p, count: c, line: first });
				total += c;
			}
		}
	}
	el.frCount.textContent =
		re === false
			? 'expressao regular invalida'
			: re
				? total + ' ocorrencia(s) em ' + __fr.items.length + ' arquivo(s)'
				: '';
	el.frList.innerHTML = __fr.items.length
		? __fr.items
				.map(function (it) {
					return `<button class="fr-file" data-p="${esc(it.path)}" data-l="${it.line}">${iconSvg(fileIconKey(it.path))}<span \
class="ff-name">${esc(it.path)}</span><span class="ff-cnt">${it.count}</span></button>`;
				})
				.join('')
		: `<div class="cmdk-empty">${proj ? (el.frFind.value ? 'Nenhuma ocorrencia' : 'Digite algo para buscar') : 'Importe um projeto primeiro'}</div>`;
}
function frDoReplaceAll() {
	const proj = activeProject();
	const re = frBuildRegex();
	if (!proj) {
		return;
	}
	if (re === false) {
		toast('Regex invalida', 'Verifique a expressao', 'err');
		return;
	}
	if (!re) {
		toast('Digite algo', 'Campo de busca vazio', '');
		return;
	}
	const rawRepl = el.frRepl.value;
	const repl = __fr.regex ? rawRepl : rawRepl.replace(/\$/g, '$$$$');
	let files = 0,
		total = 0;
	for (const p of [...proj.files.keys()]) {
		const f = proj.files.get(p);
		if (!f || !f.isText || f.text == null) continue;
		re.lastIndex = 0;
		const before = f.text;
		const matches = (before.match(re) || []).length;
		if (!matches) continue;
		const after = before.replace(re, repl);
		if (after === before) continue;
		if (!f.history) f.history = [];
		const last = f.history[f.history.length - 1];
		if (!last || last.text !== before) f.history.push({ t: Date.now(), text: before });
		if (f.history.length > 40) f.history.splice(0, f.history.length - 40);
		f.text = after;
		f.data = null;
		proj.dirty.add(p);
		files++;
		total += matches;
		if (p === proj.openFile) {
			clearFolds();
			el.codeTa.value = after;
			paintEditor(p, after);
			el.editorDirty.classList.add('on');
		}
	}
	if (!files) {
		toast('Nada substituido', 'Nenhuma ocorrencia encontrada', '');
		return;
	}
	renderEditorTabs();
	scheduleBuild(proj);
	saveSession();
	renderFindReplace();
	toast('Substituicao concluida', total + ' ocorrencia(s) em ' + files + ' arquivo(s)', 'ok');
}
function wireFindReplace() {
	el.frFind.addEventListener('input', renderFindReplace);
	el.frCase.addEventListener('click', function () {
		__fr.case = !__fr.case;
		el.frCase.classList.toggle('on', __fr.case);
		renderFindReplace();
	});
	el.frRegex.addEventListener('click', function () {
		__fr.regex = !__fr.regex;
		el.frRegex.classList.toggle('on', __fr.regex);
		renderFindReplace();
	});
	el.frReplaceAll.addEventListener('click', frDoReplaceAll);
	el.frFind.addEventListener('keydown', function (e) {
		if (e.key === 'Escape') {
			e.preventDefault();
			openFindReplace(false);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			el.frRepl.focus();
		}
	});
	el.frRepl.addEventListener('keydown', function (e) {
		if (e.key === 'Escape') {
			e.preventDefault();
			openFindReplace(false);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			frDoReplaceAll();
		}
	});
	el.frList.addEventListener('click', function (e) {
		const b = e.target.closest('[data-p]');
		if (!b) return;
		const p = b.getAttribute('data-p');
		const l = +b.getAttribute('data-l');
		openFindReplace(false);
		openFileInEditor(p);
		if (l)
			setTimeout(function () {
				jumpToLine(l);
			}, 60);
	});
	el.frBack.addEventListener('click', function (e) {
		if (e.target === el.frBack) openFindReplace(false);
	});
}

function wireQuickOpen() {
	el.qopenInput.addEventListener('input', () => renderQuickOpen(el.qopenInput.value));
	el.qopenInput.addEventListener('keydown', (e) => {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			qoMoveSel(1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			qoMoveSel(-1);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			qoRun();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			openQuickOpen(false);
		}
	});
	el.qopenList.addEventListener('click', (e) => {
		const b = e.target.closest('[data-i]');
		if (b) {
			__qo.sel = +b.dataset.i;
			qoRun();
		}
	});
	el.qopenBack.addEventListener('click', (e) => {
		if (e.target === el.qopenBack) openQuickOpen(false);
	});
}

let __snapT = null,
	__snapKey = null;
function scheduleSnapshot(proj, path) {
	const key = proj.id + '::' + path;
	if (__snapKey && __snapKey !== key) flushSnapshot();
	__snapKey = key;
	clearTimeout(__snapT);
	__snapT = setTimeout(flushSnapshot, 1200);
}
function flushSnapshot() {
	clearTimeout(__snapT);
	const key = __snapKey;
	__snapKey = null;
	if (!key) return;
	const idx = key.indexOf('::');
	const pid = key.slice(0, idx),
		path = key.slice(idx + 2);
	const proj = State.projects.find((p) => p.id === pid);
	if (!proj) return;
	const f = proj.files.get(path);
	if (!f || !f.isText || f.text == null) return;
	if (!f.history) f.history = [];
	const last = f.history[f.history.length - 1];
	if (last && last.text === f.text) return;
	f.history.push({ t: Date.now(), text: f.text });
	if (f.history.length > 40) f.history.splice(0, f.history.length - 40);
	saveSession();
}
const __hist = { path: null, versions: [], sel: 0 };
function relTime(ts) {
	const s = Math.floor((Date.now() - ts) / 1000);
	if (s < 5) return 'agora';
	if (s < 60) return `há ${s}s`;
	const m = Math.floor(s / 60);
	if (m < 60) return `há ${m} min`;
	const h = Math.floor(m / 60);
	if (h < 24) return `há ${h} h`;
	const d = Math.floor(h / 24);
	return `há ${d} d`;
}
function openHistory() {
	const proj = activeProject();
	if (!proj) {
		toast('Sem projeto', 'Importe um projeto primeiro', '');
		return;
	}
	const path = proj.openFile;
	const f = path && proj.files.get(path);
	if (!f || !f.isText) {
		toast('Sem histórico', 'Abra um arquivo de texto para ver versões', '');
		return;
	}
	flushSnapshot();
	const hist = (f.history || []).slice();
	const versions = [];
	const lastSaved = hist[hist.length - 1];
	if (!lastSaved || lastSaved.text !== f.text)
		versions.push({ t: Date.now(), text: f.text, cur: true });
	for (let i = hist.length - 1; i >= 0; i--) versions.push(hist[i]);
	__hist.path = path;
	__hist.versions = versions;
	__hist.sel = 0;
	el.histTitle.textContent = 'Histórico — ' + Core.basename(path);
	State.paletteOpen = true;
	el.histBack.classList.remove('hidden');
	renderHistList();
	selectHist(0);
}
function closeHistory() {
	State.paletteOpen = false;
	el.histBack.classList.add('hidden');
}
function renderHistList() {
	el.histList.innerHTML = __hist.versions.length
		? __hist.versions
				.map(
					(v, i) =>
						`<button class="hist-item${i === __hist.sel ? ' sel' : ''}" data-i="${i}"><b>${v.cur ? 'Versão atual' : 'Versão ' + (__hist.versions.length - i)}</b>\
<span>${relTime(v.t)}${v.cur ? ' • não salva' : ''}</span></button>`,
				)
				.join('')
		: '<div class="cmdk-empty">Sem versões anteriores</div>';
}
function selectHist(i) {
	__hist.sel = i;
	renderHistList();
	const v = __hist.versions[i];
	el.histPre.textContent = v ? v.text : '';
	el.histRestore.style.display = v && v.cur ? 'none' : '';
}
function restoreHist() {
	const v = __hist.versions[__hist.sel];
	if (!v || v.cur) return;
	const proj = activeProject();
	if (!proj) return;
	const f = proj.files.get(__hist.path);
	if (!f) return;
	if (!f.history) f.history = [];
	const last = f.history[f.history.length - 1];
	if (!last || last.text !== f.text) f.history.push({ t: Date.now(), text: f.text });
	f.text = v.text;
	f.data = null;
	proj.dirty.add(__hist.path);
	f.history.push({ t: Date.now(), text: v.text });
	if (f.history.length > 40) f.history.splice(0, f.history.length - 40);
	if (proj.openFile === __hist.path) {
		clearFolds();
		el.codeTa.value = v.text;
		paintEditor(__hist.path, v.text);
		el.editorDirty.classList.add('on');
	}
	scheduleBuild(proj);
	saveSession();
	closeHistory();
	toast('Versão restaurada', Core.basename(__hist.path) + ' • ' + relTime(v.t), 'ok');
}
function wireHistory() {
	el.histList.addEventListener('click', (e) => {
		const b = e.target.closest('[data-i]');
		if (b) selectHist(+b.dataset.i);
	});
	el.histRestore.addEventListener('click', restoreHist);
	el.histClose.addEventListener('click', closeHistory);
	el.histBack.addEventListener('click', (e) => {
		if (e.target === el.histBack) closeHistory();
	});
}

function closeOverlays() {
	el.cmdkBack.classList.add('hidden');
	el.qopenBack.classList.add('hidden');
	el.histBack.classList.add('hidden');
	if (el.frBack) el.frBack.classList.add('hidden');
	State.paletteOpen = false;
}
function handleShortcut(e) {
	const mod = e.ctrlKey || e.metaKey;
	const k = (e.key || '').toLowerCase();
	if (e.key === 'Escape') {
		if (State.paletteOpen) closeOverlays();
		return;
	}
	if (mod && k === 'k') {
		e.preventDefault();
		const open = !el.cmdkBack.classList.contains('hidden');
		closeOverlays();
		if (!open) openPalette(true);
		return;
	}
	if (mod && k === 'p') {
		e.preventDefault();
		const open = !el.qopenBack.classList.contains('hidden');
		closeOverlays();
		if (!open) openQuickOpen(true);
		return;
	}
	if (mod && e.shiftKey && k === 'f') {
		e.preventDefault();
		const open = !el.frBack.classList.contains('hidden');
		closeOverlays();
		if (!open) openFindReplace(true);
		return;
	}
	if (e.altKey && e.shiftKey && k === 'f') {
		e.preventDefault();
		formatActiveFile();
		return;
	}
	if (mod && k === 'h') {
		e.preventDefault();
		const open = !el.histBack.classList.contains('hidden');
		closeOverlays();
		if (!open) openHistory();
		return;
	}
	if (State.paletteOpen) return;
	if (!mod) return;
	if (k === 's') {
		e.preventDefault();
		const p = activeProject();
		if (p) {
			buildPreview(p);
			toast('Preview atualizado', 'Ctrl/⌘ S', '');
		}
	} else if (k === 'b') {
		e.preventDefault();
		toggleSidebar();
	} else if (k === '`') {
		e.preventDefault();
		openConsole(!State.consoleOpen);
	} else if (k === '1') {
		e.preventDefault();
		setLayout('split');
	} else if (k === '2') {
		e.preventDefault();
		setLayout('editor');
	} else if (k === '3') {
		e.preventDefault();
		setLayout('preview');
	}
}

ICONS.mcp =
	'<path d="M9 2v5M15 2v5"/><path d="M6 7h12v4a6 6 0 0 1-12 0z"/><path d="M12 17v2.5a2.5 2.5 0 0 1-2.5 2.5H7"/>';

const MCP_RELAY_PADRAO = 'https://aurora-relay.pedrinnieeva.workers.dev';
const MCP_HELLO_MS = 25000;
const MCP_WS_FAILS_MAX = 4;
const MCP_PROMOVER_MS = 60000;
const MCP_INFLIGHT_TTL = 150000;
const MCP_SEEN_TTL = 300000;
const MCP_POOL_SOCKETS = 6;
const MCP_POLL_LANES = 3;
const MCP_MOBILE = (function () {
	try {
		return !window.matchMedia('(pointer:fine)').matches;
	} catch (e) {
		return false;
	}
})();
const MCP = {
	active: false,
	es: null,
	status: 'off',
	relay: '',
	pub: '',
	sid: '',
	token: '',
	log: [],
	retryT: null,
	calls: 0,
};

function mcpRand(n) {
	const a = new Uint8Array(n);
	crypto.getRandomValues(a);
	let s = '';
	for (let i = 0; i < a.length; i++) s += 'abcdefghijklmnopqrstuvwxyz0123456789'[a[i] % 36];
	return s;
}
function mcpSaveCfg() {
	try {
		localStorage.setItem('aurora.mcp.relay', MCP.relay);
		localStorage.setItem('aurora.mcp.pub', MCP.pub || '');
		localStorage.setItem('aurora.mcp.sid', MCP.sid);
		localStorage.setItem('aurora.mcp.token', MCP.token);
		localStorage.setItem('aurora.mcp.active', MCP.active ? '1' : '0');
	} catch (e) {
		ignorarErro(e, 'mcpSaveCfg');
	}
}
function mcpLoadCfg() {
	try {
		MCP.relay = localStorage.getItem('aurora.mcp.relay') || '';
		MCP.pub = localStorage.getItem('aurora.mcp.pub') || '';
		MCP.sid = localStorage.getItem('aurora.mcp.sid') || '';
		MCP.token = localStorage.getItem('aurora.mcp.token') || '';
	} catch (e) {
		ignorarErro(e, 'mcpLoadCfg');
	}
	if (!MCP.relay && MCP_RELAY_PADRAO) MCP.relay = MCP_RELAY_PADRAO;
	if (MCP_MOBILE && !appPonte()) MCP.pub = '';
	if (!MCP.sid || !MCP.token) {
		MCP.sid = mcpRand(10);
		MCP.token = mcpRand(24);
		mcpSaveCfg();
	}
	try {
		mcpTransporteNuvem(false);
	} catch (e) {
		ignorarErro(e, 'mcpLoadCfg');
	}
}
