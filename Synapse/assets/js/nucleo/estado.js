'use strict';

const State = {
	projects: [],
	active: null,
	layout: 'split',
	device: 'responsive',
	customW: 1280,
	customH: 800,
	consoleOpen: false,
	consoleFilter: 'all',
	buildToken: 0,
	theme: 'dark',
	suppressSave: false,
	paletteOpen: false,
};
const DEVICES = {
	responsive: null,
	desktop: { w: 1440, h: 900, border: false },
	tablet: { w: 820, h: 1180, border: true },
	mobile: { w: 390, h: 844, border: true },
};
let uid = 1;
const nid = () => 'p' + uid++;

const $ = (s) => document.querySelector(s);
const el = {
	tabs: $('#tabs'),
	tree: $('#tree'),
	stage: $('#stage'),
	device: $('#device'),
	frame: $('#frame'),
	previewEmpty: $('#previewEmpty'),
	previewLoading: $('#previewLoading'),
	previewLoadingText: $('#previewLoadingText'),
	previewLoadingDetail: $('#previewLoadingDetail'),
	previewError: $('#previewError'),
	editorPane: $('#editorPane'),
	previewPane: $('#previewPane'),
	rz2: $('#rz2'),
	editorEmpty: $('#editorEmpty'),
	editorGrid: $('#editorGrid'),
	gutter: $('#gutter'),
	codeHl: $('#codeHl'),
	codeTa: $('#codeTa'),
	editorTitle: $('#editorTitle'),
	editorPath: $('#editorPath'),
	editorDirty: $('#editorDirty'),
	editorScroll: $('#editorScroll'),
	mediaView: $('#mediaView'),
	editorTabs: $('#editorTabs'),
	console: $('#console'),
	consoleBody: $('#consoleBody'),
	consoleBtn: $('#consoleBtn'),
	consoleBadge: $('#consoleBadge'),
	cAll: $('#cAll'),
	cErr: $('#cErr'),
	cWarn: $('#cWarn'),
	dims: $('#dims'),
	dimW: $('#dimW'),
	dimH: $('#dimH'),
	zoomLabel: $('#zoomLabel'),
	stDot: $('#stDot'),
	stState: $('#stState'),
	stProject: $('#stProject'),
	stContext: $('#stContext'),
	stFiles: $('#stFiles'),
	dropzone: $('#dropzone'),
	toasts: $('#toasts'),
	exSearch: $('#exSearch'),
	explorer: $('#explorer'),
	themeBtn: $('#themeBtn'),
	cmdkBtn: $('#cmdkBtn'),
	cmdkBack: $('#cmdkBack'),
	cmdkInput: $('#cmdkInput'),
	cmdkList: $('#cmdkList'),
	cmdkIcon: $('#cmdkIcon'),
	qopenBtn: $('#qopenBtn'),
	histBtn: $('#histBtn'),
	qopenBack: $('#qopenBack'),
	qopenInput: $('#qopenInput'),
	qopenList: $('#qopenList'),
	qopenIcon: $('#qopenIcon'),
	fmtBtn: $('#fmtBtn'),
	miniBtn: $('#miniBtn'),
	foldBtn: $('#foldBtn'),
	miniMap: $('#miniMap'),
	frBack: $('#frBack'),
	frFind: $('#frFind'),
	frRepl: $('#frRepl'),
	frList: $('#frList'),
	frCount: $('#frCount'),
	frCase: $('#frCase'),
	frRegex: $('#frRegex'),
	frReplaceAll: $('#frReplaceAll'),
	frIcon: $('#frIcon'),
	histBack: $('#histBack'),
	histList: $('#histList'),
	histPre: $('#histPre'),
	histRestore: $('#histRestore'),
	histClose: $('#histClose'),
	histTitle: $('#histTitle'),
};

function esc(s) {
	return escaparHtml(s);
}
function toast(title, sub, kind) {
	const t = document.createElement('div');
	t.className = 'toast' + (kind ? ' ' + kind : '');
	const icHtml =
		kind === 'ok'
			? '<svg class="toast-ic-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
				'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle ' +
				'class="tc-ring" cx="12" cy="12" r="9"/><path class="tc-tick" d="M8 12.4l2.6 2.6L16 ' +
				'9.4"/></svg>'
			: iconSvg(kind === 'err' ? 'err' : kind === 'warn' ? 'warn' : 'info');
	t.innerHTML =
		icHtml +
		'<div class="tx"><b>' +
		esc(title) +
		'</b>' +
		(sub ? `<span>${esc(sub)}</span>` : '') +
		'</div><i class="toast-bar"></i>';
	el.toasts.appendChild(t);
	const dismiss = () => {
		t.style.transition = 'opacity .3s, transform .3s';
		t.style.opacity = '0';
		t.style.transform = 'translateX(30px)';
		setTimeout(() => t.remove(), 320);
	};
	t.addEventListener('click', dismiss);
	setTimeout(dismiss, 3600);
}
function setStatus(kind, msg) {
	el.stDot.className = 'dot' + (kind ? ' ' + kind : '');
	if (msg !== undefined) el.stState.textContent = msg;
}
let _loadingGuard = null;
function armLoadingGuard() {
	if (_loadingGuard) clearTimeout(_loadingGuard);
	_loadingGuard = setTimeout(loadingSafetyNet, 45000);
}
function loadingSafetyNet() {
	_loadingGuard = null;
	if (!el.previewLoading || el.previewLoading.classList.contains('hidden')) return;
	el.previewLoading.classList.add('hidden');
	const p = activeProject();
	if (p)
		logErr(
			p,
			'Watchdog: o preview demorou demais para montar (sem progresso) — exibindo o melhor resultado disponível. Veja os logs acima para o último passo.',
		);
	if (p && p.lastHtml) {
		hidePreviewError();
		el.previewEmpty.classList.add('hidden');
		el.device.classList.remove('hidden');
		frameSrcdoc(p.lastHtml);
	} else if (p) {
		buildPreview(p);
	} else {
		renderPreviewEmpty(true);
	}
}
function showPreviewLoading(text, detail) {
	if (!el.previewLoading) return;
	if (text !== undefined) el.previewLoadingText.textContent = text;
	if (detail !== undefined) el.previewLoadingDetail.textContent = detail;
	hidePreviewError();
	el.previewEmpty.classList.add('hidden');
	el.device.classList.add('hidden');
	el.previewLoading.classList.remove('hidden');
	armLoadingGuard();
}
function setPreviewLoadingDetail(detail) {
	if (el.previewLoading && !el.previewLoading.classList.contains('hidden')) {
		el.previewLoadingDetail.textContent = detail;
		armLoadingGuard();
	}
}
function hidePreviewLoading() {
	if (_loadingGuard) {
		clearTimeout(_loadingGuard);
		_loadingGuard = null;
	}
	if (el.previewLoading) el.previewLoading.classList.add('hidden');
}
function nextPaint() {
	return new Promise((r) => {
		let done = false;
		const fin = () => {
			if (done) return;
			done = true;
			r();
		};
		try {
			requestAnimationFrame(() => requestAnimationFrame(fin));
		} catch (e) {
			fin();
			return;
		}
		setTimeout(fin, 250);
	});
}

function showPreviewError(opts) {
	opts = opts || {};
	if (!el.previewError) return;
	hidePreviewLoading();
	el.previewEmpty.classList.add('hidden');
	el.device.classList.add('hidden');
	const warn = opts.level === 'warn';
	let h = `<div class="pe2-card"><div class="pe2-head"><div class="pe2-icon">${iconSvg(warn ? 'warn' : 'err', 'icon')}</div>\
<div style="flex:1"><h2>${esc(opts.title || 'Não foi possível mostrar o preview')}</h2>`;
	if (opts.cause) h += `<p class="pe2-cause">${opts.cause}</p>`;
	h += '</div></div>';
	if (opts.steps && opts.steps.length) {
		h += '<div class="pe2-sub">O que fazer</div><ol>';
		opts.steps.forEach((s) => {
			h += `<li>${s}</li>`;
		});
		h += '</ol>';
	}
	if (opts.commands && opts.commands.length) {
		const c = opts.commands.join('\n');
		h += `<div class="pe2-cmd"><button class="pe2-copy" data-cmd="${esc(c)}" onclick="copyCmd(this)">Copiar</button>${esc(c)}</div>`;
	}
	if (opts.details)
		h += `<details><summary>Detalhes técnicos</summary><div class="pe2-tech">${esc(opts.details)}</div></details>`;
	if (opts.actions && opts.actions.length) {
		h += '<div class="pe2-actions">';
		opts.actions.forEach((a) => {
			h += `<button class="pe2-btn${a.primary ? ' primary' : ''}" onclick="${a.onclick}">${esc(a.label)}</button>`;
		});
		h += '</div>';
	}
	if (opts.foot) h += `<div class="pe2-foot">${opts.foot}</div>`;
	h += '</div>';
	el.previewError.className = 'preview-error' + (warn ? ' warn' : '');
	el.previewError.innerHTML = h;
	el.previewError.classList.remove('hidden');
}
function hidePreviewError() {
	if (el.previewError) el.previewError.classList.add('hidden');
}
function copyCmd(btn) {
	const t = btn.getAttribute('data-cmd') || '';
	try {
		navigator.clipboard && navigator.clipboard.writeText(t);
	} catch (e) {
		ignorarErro(e, 'copyCmd');
	}
	const o = btn.textContent;
	btn.textContent = 'Copiado!';
	setTimeout(() => {
		btn.textContent = o;
	}, 1400);
}
function dismissPreviewError() {
	const p = activeProject();
	if (p) p.blocked = false;
	hidePreviewError();
	if (p && p.lastHtml) {
		el.previewEmpty.classList.add('hidden');
		el.device.classList.remove('hidden');
		frameSrcdoc(p.lastHtml);
	} else if (p) {
		buildPreview(p);
	} else {
		renderPreviewEmpty(true);
	}
}
function recheckServerMode() {
	const p = activeProject();
	if (!p) {
		toast('Sem projeto', 'Importe um projeto primeiro', '');
		return;
	}
	p.blocked =
		typeof auroraShouldBlock === 'function'
			? auroraShouldBlock(p.detect)
			: p.detect.type === 'build' && !(window.crossOriginIsolated && navigator.onLine);
	if (!p.blocked) {
		hidePreviewError();
		toast('Modo Servidor real liberado', 'Isolamento ativo — iniciando o servidor…', 'ok');
		tryAutoRun(p);
	} else {
		toast(
			'Ainda bloqueado',
			'crossOriginIsolated continua false — confira os headers e abra a URL direto numa aba',
			'warn',
		);
		showBuildBlockedError(p);
	}
}
function showBuildBlockedError(proj) {
	const d = proj.detect;
	const cmds =
		d.commands && d.commands.length ? d.commands.slice() : ['npm install', 'npm run build'];
	const fw = d.framework ? ` <b>(${esc(d.framework)})</b>` : '';
	const iso = !!window.crossOriginIsolated,
		inFrame = window.top !== window.self,
		proto = location.protocol;
	const diag = `crossOriginIsolated=${iso} · protocolo=${proto} · iframe=${inFrame ? 'sim' : 'não'} · online=${navigator.onLine ? 'sim' : 'não'}`;
	const actions = [
		{ label: 'Verificar novamente', onclick: 'recheckServerMode()' },
		{ label: 'Tentar mostrar mesmo assim (Runtime)', onclick: 'dismissPreviewError()' },
	];
	if (!navigator.onLine) {
		showPreviewError({
			level: 'warn',
			title: 'Este projeto precisa de build (npm) e você está offline',
			cause: `O projeto${fw} usa uma toolchain Node/npm, então precisa rodar comandos para gerar o preview. Sem internet não dá para instalar as dependências.`,
			steps: [
				'Conecte-se à internet e importe novamente, <b>ou</b>',
				'Rode o build no seu terminal e importe a pasta de saída (ex.: <code>dist/</code> ou <code>build/</code>).',
			],
			commands: cmds,
			foot: 'Depois de gerar a pasta de saída, arraste-a aqui ou use <b>Importar → pasta</b>.',
			actions: actions,
		});
		return;
	}
	const why = inFrame
		? 'O app está rodando dentro de um iframe/embed. O isolamento (crossOriginIsolated) quase ' +
			'nunca ativa nesse caso. Abra a <b>URL do site direto numa aba</b> do navegador — não ' +
			'embutido em outra página (nem no preview do Notion).'
		: proto === 'file:'
			? 'Você abriu o arquivo direto do disco (<code>file://</code>). O Modo Servidor real exige servir por <b>http/https</b> com os headers.'
			: 'A página está servida, mas os headers <b>COOP/COEP</b> não chegaram ao navegador — normalmente o arquivo de configuração não foi para a pasta publicada, ou a sintaxe ficou errada.';
	showPreviewError({
		level: 'warn',
		title: 'Modo Servidor real desligado — isolamento de origem cruzada inativo',
		cause: `O projeto${fw} precisa rodar comandos (build). ${why}`,
		steps: [
			'<b>1.</b> Confirme o problema: abra o Console do navegador (F12) e digite <code>crossOriginIsolated</code>. Se vier <code>false</code>, os headers não estão ativos.',
			'<b>2.</b> Na <b>pasta que você publica</b>, crie um arquivo chamado <code>_headers</code> (sem extensão) com exatamente este conteúdo:',
			'<b>3.</b> Refaça o deploy, abra a URL <b>direto numa aba</b> e cheque <code>crossOriginIsolated</code> de novo (deve ser <code>true</code>).',
			'<b>4.</b> Se ainda for <code>false</code> ou algum recurso for bloqueado, troque <code>require-corp</code> por <code>credentialless</code> na linha do COEP.',
			'Depois clique em <b>Verificar novamente</b> aqui — sem precisar reimportar.',
		],
		commands: [
			'/*',
			'  Cross-Origin-Opener-Policy: same-origin',
			'  Cross-Origin-Embedder-Policy: require-corp',
		],
		foot: 'Alternativa sem servidor: o <b>Modo Runtime</b> (botão abaixo) já roda a maioria dos apps React/Vite compilando JSX/TS e puxando dependências via esm.sh.',
		details: diag,
		actions: actions,
	});
}
function showWcError(proj, err) {
	showPreviewError({
		title: 'Falha ao iniciar o Modo Servidor real (WebContainers)',
		cause:
			'Tentei iniciar o servidor real, mas houve um erro ao inicializar o ambiente ou instalar as dependências.',
		steps: [
			'Confirme que você está online (as dependências são baixadas da internet).',
			'Use um navegador recente (Chrome, Edge ou Firefox).',
			'Se continuar, rode o build no terminal e importe a pasta de saída.',
		],
		commands:
			proj && proj.detect && proj.detect.commands && proj.detect.commands.length
				? proj.detect.commands
				: ['npm install', 'npm run build'],
		details: err && err.message ? err.message : String(err),
		actions: [{ label: 'Tentar mostrar em modo Runtime', onclick: 'dismissPreviewError()' }],
	});
}
function showCmdError(proj, cmd, code) {
	showPreviewError({
		title: 'Um comando do build falhou',
		cause: `O comando <code>${esc(cmd)}</code> terminou com código de erro <b>${code}</b>, então o preview não pôde ser gerado.`,
		steps: [
			'Abra o console (aba <b>Build/Comandos</b>) e leia o log completo do erro.',
			'Corrija o que for apontado e importe o projeto novamente.',
		],
		details: cmd + ' → exit code ' + code,
		actions: [
			{ label: 'Ver console', onclick: 'openConsole(true)' },
			{ label: 'Tentar em modo Runtime', onclick: 'dismissPreviewError()' },
		],
	});
}
function showBuildCompileError(proj, err) {
	showPreviewError({
		title: 'Erro ao montar o preview',
		cause: 'Aconteceu um erro ao compilar/montar os arquivos do projeto para o preview.',
		steps: [
			'Veja os detalhes técnicos abaixo e o console para mais informações.',
			'Confira o arquivo de entrada (HTML) e os caminhos dos assets/imports.',
		],
		details: err && err.message ? err.message : String(err),
		actions: [
			{
				label: 'Recarregar preview',
				onclick: '(function(){var p=activeProject();if(p){hidePreviewError();buildPreview(p);}})()',
			},
			{ label: 'Ver console', onclick: 'openConsole(true)' },
		],
	});
}
function showZipError(err) {
	showPreviewError({
		title: 'Não foi possível abrir o .zip',
		cause: 'O arquivo .zip não pôde ser lido ou descompactado.',
		steps: [
			'Confirme que é um .zip válido e que não está corrompido.',
			'Use um navegador recente (a descompactação usa DecompressionStream).',
			'Tente compactar/exportar o projeto novamente.',
		],
		details: err && err.message ? err.message : String(err),
	});
}
function showDropError(err) {
	showPreviewError({
		title: 'Não foi possível importar os arquivos',
		cause: 'Houve um erro ao ler os arquivos arrastados para a janela.',
		steps: [
			'Tente importar pelo botão <b>Importar</b> no topo.',
			'Confirme que a pasta/arquivos não estão corrompidos.',
		],
		details: err && err.message ? err.message : String(err),
	});
}
function activeProject() {
	return State.projects.find((p) => p.id === State.active) || null;
}

function fileIcon(path, isDir, open) {
	if (isDir) return iconSvg(open ? 'folderOpen' : 'folder');
	const e = Core.extname(path);
	if (e === '.html' || e === '.htm') return iconSvg('html');
	if (e === '.css' || e === '.scss' || e === '.less') return iconSvg('css');
	if (['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx'].includes(e)) return iconSvg('js');
	if (e === '.json') return iconSvg('json');
	if (e === '.dart') return iconSvg('code');
	if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.avif', '.bmp'].includes(e))
		return iconSvg('img');
	return iconSvg('file');
}
function colorOfExt(path) {
	const e = Core.extname(path);
	if (e === '.html' || e === '.htm') return '#ff8f6b';
	if (e === '.css' || e === '.scss') return '#5cc8ff';
	if (['.js', '.mjs', '.cjs'].includes(e)) return '#ffcb6b';
	if (['.jsx', '.tsx', '.ts'].includes(e)) return '#82aaff';
	if (e === '.json') return '#ffd166';
	if (e === '.dart') return '#54c5f8';
	if (e === '.yaml' || e === '.yml') return '#c3e88d';
	if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(e)) return '#c792ea';
	return '#7e879c';
}

function bytesToText(data) {
	try {
		return Core.utf8Decode(data);
	} catch (e) {
		return '';
	}
}
function looksLikeTextBytes(data) {
	if (!data) return false;
	const len = data.byteLength || data.length || 0;
	if (!len) return false;
	let u;
	try {
		u = data instanceof Uint8Array ? data : new Uint8Array(data.buffer || data);
	} catch (e) {
		return false;
	}
	const n = Math.min(len, 4096);
	let ctrl = 0;
	for (let i = 0; i < n; i++) {
		const b = u[i];
		if (b === 0) return false;
		if (b < 9 || (b > 13 && b < 32 && b !== 27)) ctrl++;
	}
	if (ctrl / n > 0.05) return false;
	const s = bytesToText(u.subarray(0, n));
	if (!s) return false;
	let bad = 0;
	for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 0xfffd) bad++;
	return bad / Math.max(1, s.length) <= 0.02;
}
function sniffTextEntry(f) {
	if (!f || f.isText || f.text != null || !f.data || f._sniffed) return f;
	f._sniffed = true;
	try {
		if (looksLikeTextBytes(f.data)) {
			const t = bytesToText(f.data);
			if (t) {
				f.text = t;
				f.isText = true;
				if (!f.history || !f.history.length) f.history = [{ t: Date.now(), text: t }];
			}
		}
	} catch (e) {
		ignorarErro(e, 'sniffTextEntry');
	}
	return f;
}
function makeFileEntry(path, data) {
	let isText = Core.isTextFile(path);
	if (!isText && looksLikeTextBytes(data)) isText = true;
	const text = isText ? bytesToText(data) : null;
	const keepData = text == null || text.includes('\uFFFD') ? data : null;
	return {
		path,
		data: keepData,
		text,
		isText,
		history: text != null ? [{ t: Date.now(), text }] : [],
	};
}
function filesFromEntries(entries) {
	const MAX_FILES = 8000,
		MAX_TOTAL = 120 * 1024 * 1024;
	const names = entries.map((e) => Core.normalizePath(e.name)).filter((n) => n && !n.endsWith('/'));
	const root = Core.stripCommonRoot(names);
	const files = new Map();
	let total = 0,
		skipped = 0;
	for (const e of entries) {
		let p = Core.normalizePath(e.name);
		if (!p || p.endsWith('/')) continue;
		if (root && (p === root || p.startsWith(root + '/'))) p = p.slice(root.length + 1);
		p = p.replace(/^\/+/, '').replace(/^(\.\.\/)+/, '');
		if (!p || p.split('/').some((s) => s === '..' || s === '')) {
			skipped++;
			continue;
		}
		if (files.size >= MAX_FILES) {
			skipped++;
			continue;
		}
		const sz = e.data ? e.data.byteLength || e.data.length || 0 : 0;
		total += sz;
		if (total > MAX_TOTAL) {
			skipped++;
			continue;
		}
		files.set(p, makeFileEntry(p, e.data));
	}
	if (skipped) {
		try {
			toast(
				'Importação filtrada',
				skipped + ' arquivo(s) ignorado(s) por segurança (caminho inválido ou limite)',
				'warn',
			);
		} catch (e) {
			ignorarErro(e, 'filesFromEntries');
		}
	}
	return files;
}
function readPackageJson(files) {
	const f = files.get('package.json');
	if (!f) return null;
	try {
		return JSON.parse(f.text);
	} catch (e) {
		return null;
	}
}
async function runImport(label, fn) {
	try {
		await fn();
	} catch (err) {
		hidePreviewLoading();
		setStatus('err', 'Falha ao importar');
		const msg = (err && err.message) || String(err);
		const p = activeProject();
		if (p) logErr(p, `Importação (${label}) falhou: ${msg}`);
		try {
			toast('Erro ao importar', msg, 'err');
		} catch (e) {
			ignorarErro(e, 'runImport');
		}
		try {
			showDropError(err);
		} catch (e) {
			ignorarErro(e, 'runImport');
		}
		registro.aviso(`[Synapse] import(${label}) falhou:`, err);
	}
}
function addProject(name, kind, files, opts) {
	const activate = !(opts && opts.activate === false) || !State.active;
	if (!files.size) {
		hidePreviewLoading();
		setStatus('err', 'Nada para importar');
		toast(
			'Nada para importar',
			'Nenhum arquivo encontrado (ou tudo foi filtrado por segurança)',
			'err',
		);
		return;
	}
	const pkg = readPackageJson(files);
	const detect = Core.detectProject([...files.keys()], pkg);
	try {
		const __be = AuroraFix.pickBestEntry(files, detect);
		if (__be) detect.entry = __be;
	} catch (e) {
		ignorarErro(e, 'addProject');
	}
	const proj = {
		id: nid(),
		name,
		kind,
		files,
		detect,
		entry: detect.entry,
		openFile: null,
		dirty: new Set(),
		emptyDirs: new Set(),
		blobs: new Set(),
		popout: null,
		channel: null,
		logs: [],
		runtimeMode: detect.type,
	};
	proj.blocked =
		typeof auroraShouldBlock === 'function'
			? auroraShouldBlock(detect)
			: detect.type === 'build' && !(window.crossOriginIsolated && navigator.onLine);
	proj.openFile = detect.entry || pickDefaultFile(files);
	proj.openTabs = proj.openFile ? [proj.openFile] : [];
	State.projects.push(proj);
	if (activate) State.active = proj.id;
	proj.channel = new BroadcastChannel('aurora-lp-' + proj.id);
	renderAll();
	if (activate) buildPreview(proj);
	logCmd(proj, `Projeto "${name}" importado — ${files.size} arquivo(s).`);
	if (activate) describeProject(proj);
	else
		logCmd(
			proj,
			'Projeto aberto em segundo plano — o preview será montado quando ele for ativado.',
		);
	toast('Importado', `“${name}” • ${files.size} arquivos`, 'ok');
	saveSession();
}
function pickDefaultFile(files) {
	const order = [
		'index.html',
		'lib/main.dart',
		'src/main.jsx',
		'src/main.tsx',
		'src/main.js',
		'src/index.jsx',
		'src/App.jsx',
		'src/App.tsx',
		'main.js',
		'script.js',
		'style.css',
	];
	for (const o of order) if (files.has(o)) return o;
	const txt = [...files.keys()].find((p) => Core.isTextFile(p));
	return txt || [...files.keys()][0] || null;
}
function describeProject(proj) {
	const d = proj.detect;
	if (d.type === 'build') {
		logCmd(proj, `Toolchain detectada: ${d.framework || 'node'}. Comandos do projeto:`);
		d.commands.forEach((c) => logCmd(proj, '  $ ' + c));
		logCmd(proj, '→ Build nativo (npm) precisa de um runtime Node. Veja “Executar build” abaixo.');
		if (proj.blocked) {
			showBuildBlockedError(proj);
		} else {
			AuroraFix.maybeAutoRun(proj);
		}
	} else if (d.type === 'flutter') {
		logCmd(proj, 'Projeto Flutter detectado (pubspec.yaml + Dart).');
		if (d.entry) {
			logCmd(proj, `Build web encontrado — preview direto de ${d.entry}.`);
		} else {
			logCmd(proj, 'Sem build web no projeto — exibindo visão geral do app (sem erros).');
			logCmd(proj, 'Para ver o app rodando no preview:');
			d.commands.forEach((c) => logCmd(proj, '  $ ' + c));
			logCmd(proj, '→ depois reimporte o .zip incluindo a pasta build/web.');
		}
	} else if (d.type === 'runtime') {
		logCmd(proj, 'Projeto com JSX/TS — transformação automática no navegador ativada.');
	} else {
		logCmd(
			proj,
			'Site estático — preview direto, sem build. Entrada: ' + (d.entry || '(diretório)'),
		);
	}
}

async function importZipFile(file) {
	showPreviewLoading('Carregando arquivos…', `Extraindo ${file.name}…`);
	setStatus('run', `Extraindo ${file.name}…`);
	await nextPaint();
	try {
		const buf = new Uint8Array(await file.arrayBuffer());
		setPreviewLoadingDetail('Descompactando o .zip…');
		const entries = await parseZipAsync(buf);
		setPreviewLoadingDetail(`Preparando ${entries.length} arquivo(s)…`);
		const files = filesFromEntries(entries);
		addProject(file.name.replace(/\.zip$/i, ''), 'zip', files);
	} catch (err) {
		hidePreviewLoading();
		setStatus('err', 'Falha ao extrair');
		toast('Erro no .zip', err.message, 'err');
		showZipError(err);
	}
}
const ASSET_EXTS = new Set([
	'glb',
	'gltf',
	'webp',
	'png',
	'jpg',
	'jpeg',
	'jfif',
	'ogg',
	'mp3',
	'mp4',
	'bin',
]);
async function importAssetsZipFile(file) {
	const proj = activeProject();
	if (!proj) {
		toast('Nenhum projeto aberto', 'Importe ou crie um projeto antes de adicionar assets.', 'warn');
		return;
	}
	showPreviewLoading('Importando assets…', `Extraindo ${file.name}…`);
	setStatus('run', 'Extraindo assets…');
	await nextPaint();
	try {
		const buf = new Uint8Array(await file.arrayBuffer());
		const entries = await parseZipAsync(buf);
		let added = 0,
			ignored = 0;
		const usados = new Set([...proj.files.keys()]);
		for (const e of entries) {
			const p = Core.normalizePath(e.name);
			if (!p || p.endsWith('/')) continue;
			const base = Core.basename(p);
			const m = /\.([a-z0-9]+)$/i.exec(base);
			const ext = m ? m[1].toLowerCase() : '';
			if (!ASSET_EXTS.has(ext)) {
				ignored++;
				continue;
			}
			let dest = base;
			if (usados.has(dest)) {
				const stem = base.slice(0, base.length - ext.length - 1);
				let i = 2;
				while (usados.has(stem + '-' + i + '.' + ext)) i++;
				dest = stem + '-' + i + '.' + ext;
			}
			usados.add(dest);
			proj.files.set(dest, makeFileEntry(dest, e.data));
			added++;
		}
		hidePreviewLoading();
		if (!added) {
			setStatus('err', 'Nenhum asset');
			toast(
				'Nenhum asset encontrado',
				'O .zip não tem arquivos suportados (glb, gltf, webp, png, jpg, jpeg, jfif, ogg, mp3, mp4, bin).',
				'warn',
			);
			return;
		}
		renderTree();
		scheduleBuild(proj);
		saveSession();
		setStatus('ok', 'Assets importados');
		toast(
			'Assets importados',
			'+' +
				added +
				' arquivo(s) na raiz do projeto' +
				(ignored ? ` · ${ignored} ignorado(s)` : '') +
				'. Arraste na árvore para organizar em pastas.',
			'ok',
		);
	} catch (err) {
		hidePreviewLoading();
		setStatus('err', 'Falha ao extrair');
		toast('Erro no .zip', err.message, 'err');
		showZipError(err);
	}
}
async function importHtmlFile(file) {
	showPreviewLoading('Carregando arquivos…', `Lendo ${file.name}…`);
	await nextPaint();
	const data = new Uint8Array(await file.arrayBuffer());
	const files = new Map();
	files.set('index.html', makeFileEntry('index.html', data));
	addProject(file.name, 'html', files);
}
async function importFolderFiles(fileList) {
	showPreviewLoading('Carregando arquivos…', 'Lendo pasta…');
	setStatus('run', 'Lendo pasta…');
	await nextPaint();
	const entries = [];
	const total = fileList.length;
	let _i = 0;
	for (const f of fileList) {
		const rel = f.webkitRelativePath || f.name;
		const data = new Uint8Array(await f.arrayBuffer());
		entries.push({ name: rel, data });
		if (++_i % 15 === 0 || _i === total) setPreviewLoadingDetail(`Lendo arquivos… ${_i}/${total}`);
	}
	const files = filesFromEntries(entries);
	const top = (fileList[0] && (fileList[0].webkitRelativePath || '').split('/')[0]) || 'pasta';
	addProject(top, 'folder', files);
}
async function readDataTransfer(dt) {
	const plainFiles = [...dt.files];
	const items = dt.items ? [...dt.items] : [];
	const entries = [];
	const fileEntries = [];
	for (const it of items) {
		if (it.kind === 'file') {
			const e = it.webkitGetAsEntry && it.webkitGetAsEntry();
			if (e) fileEntries.push(e);
		}
	}
	if (fileEntries.length) {
		try {
			await Promise.race([
				(async () => {
					for (const fe of fileEntries) await walkEntry(fe, '', entries);
				})(),
				new Promise((_, rej) =>
					setTimeout(() => rej(new Error('Tempo esgotado ao ler os arquivos arrastados')), 8000),
				),
			]);
		} catch (e) {
			registro.aviso('[Synapse] leitura de entries travou, usando fallback:', e && e.message);
		}
		if (entries.length) return { entries, plainFiles };
		return { entries: null, plainFiles };
	}
	return { entries: null, plainFiles };
}
function walkEntry(entry, prefix, out) {
	return new Promise((resolve) => {
		if (entry.isFile) {
			entry.file(
				async (f) => {
					const data = new Uint8Array(await f.arrayBuffer());
					out.push({ name: prefix + entry.name, data });
					resolve();
				},
				() => resolve(),
			);
		} else if (entry.isDirectory) {
			const rd = entry.createReader();
			const all = [];
			const read = () =>
				rd.readEntries(
					async (es) => {
						if (!es.length) {
							for (const c of all) await walkEntry(c, prefix + entry.name + '/', out);
							resolve();
						} else {
							all.push(...es);
							read();
						}
					},
					() => resolve(),
				);
			read();
		} else resolve();
	});
}
async function handleDrop(dt) {
	const fileEntries = [];
	try {
		const items = dt.items ? [...dt.items] : [];
		for (const it of items) {
			if (it.kind === 'file') {
				const en = it.webkitGetAsEntry && it.webkitGetAsEntry();
				if (en) fileEntries.push(en);
			}
		}
	} catch (e) {
		registro.aviso('[Synapse] webkitGetAsEntry indisponível:', e && e.message);
	}
	const plainFiles = dt.files ? [...dt.files] : [];
	showPreviewLoading('Carregando arquivos…', 'Lendo os arquivos soltos…');
	setStatus('run', 'Importando…');
	await nextPaint();
	try {
		const entries = [];
		if (fileEntries.length) {
			try {
				await Promise.race([
					(async () => {
						for (const fe of fileEntries) await walkEntry(fe, '', entries);
					})(),
					new Promise((_, rej) =>
						setTimeout(() => rej(new Error('Tempo esgotado ao ler os arquivos arrastados')), 8000),
					),
				]);
			} catch (e) {
				registro.aviso('[Synapse] leitura de entries travou, usando fallback:', e && e.message);
			}
		}
		if (entries.length) {
			if (entries.length === 1 && /\.zip$/i.test(entries[0].name)) {
				return await importZipBytes(entries[0].name, entries[0].data);
			}
			const files = filesFromEntries(entries);
			const top = Core.stripCommonRoot(entries.map((e) => Core.normalizePath(e.name))) || 'projeto';
			addProject(top, 'folder', files);
			return;
		}
		if (plainFiles.length) {
			const f = plainFiles[0];
			if (/\.zip$/i.test(f.name)) return await importZipFile(f);
			if (/\.html?$/i.test(f.name)) return await importHtmlFile(f);
			const ents = [];
			for (const pf of plainFiles) {
				ents.push({ name: pf.name, data: new Uint8Array(await pf.arrayBuffer()) });
			}
			addProject('arquivos', 'folder', filesFromEntries(ents));
			return;
		}
		hidePreviewLoading();
		setStatus('err', 'Falha');
		toast(
			'Nada para importar',
			'Não consegui ler nenhum arquivo do que foi arrastado. Tente o botão Importar.',
			'err',
		);
	} catch (err) {
		hidePreviewLoading();
		setStatus('err', 'Falha');
		toast('Erro ao importar', err.message, 'err');
		try {
			showDropError(err);
		} catch (e) {
			ignorarErro(e, 'handleDrop');
		}
		registro.aviso('[Synapse] handleDrop falhou:', err);
	}
}
async function importZipBytes(name, bytes) {
	showPreviewLoading('Carregando arquivos…', `Extraindo ${name}…`);
	await nextPaint();
	const entries = await parseZipAsync(bytes);
	addProject(name.replace(/\.zip$/i, ''), 'zip', filesFromEntries(entries));
}

function buildTreeModel(files, filter, extraDirs) {
	const root = { name: '', dir: true, children: new Map(), path: '' };
	const flt = (filter || '').trim().toLowerCase();
	for (const path of [...files.keys()].sort()) {
		if (flt && !path.toLowerCase().includes(flt)) continue;
		const parts = path.split('/');
		let node = root;
		let acc = '';
		parts.forEach((part, i) => {
			acc = acc ? acc + '/' + part : part;
			const isLeaf = i === parts.length - 1;
			if (!node.children.has(part))
				node.children.set(part, { name: part, dir: !isLeaf, children: new Map(), path: acc });
			node = node.children.get(part);
			if (!isLeaf) node.dir = true;
		});
	}
	if (extraDirs)
		for (const d of [...extraDirs].sort()) {
			if (flt && !d.toLowerCase().includes(flt)) continue;
			let node = root;
			let acc = '';
			for (const part of d.split('/')) {
				acc = acc ? acc + '/' + part : part;
				if (!node.children.has(part))
					node.children.set(part, { name: part, dir: true, children: new Map(), path: acc });
				node = node.children.get(part);
				node.dir = true;
			}
		}
	return root;
}
const openDirs = new Set();
function renderTree() {
	const proj = activeProject();
	if (!proj || (!proj.files.size && !(proj.emptyDirs && proj.emptyDirs.size))) {
		el.tree.innerHTML =
			'<div class="ex-empty">Nenhum projeto aberto.<br>Importe um .zip, pasta ou index.html.</div>';
		return;
	}
	const model = buildTreeModel(proj.files, el.exSearch.value, proj.emptyDirs);
	if (openDirs.size === 0) {
		for (const c of model.children.values()) if (c.dir) openDirs.add(c.path);
		openDirs.add('');
	}
	const html = renderDir(model, 0, proj);
	el.tree.innerHTML = html || '<div class="ex-empty">Sem resultados.</div>';
}
function renderDir(node, depth, proj) {
	const kids = [...node.children.values()].sort(
		(a, b) => b.dir - a.dir || a.name.localeCompare(b.name),
	);
	let out = '';
	for (const k of kids) {
		const pad = 8 + depth * 13;
		if (k.dir) {
			const open = openDirs.has(k.path) || el.exSearch.value.trim() !== '';
			out += `<div class="node"><div class="row${open ? ' open' : ''}" draggable="true" data-dir="${esc(k.path)}" \
style="padding-left:${pad}px"><span class="chev"><svg class="icon" viewBox="0 0 24 24"><path d="M9 6l6 \
6-6 6"/></svg></span><span class="fico" style="color:#7aa7ff">${fileIcon(k.path, true, open)}</span>\
<span class="rname">${esc(k.name)}</span></div><div class="children" style="${open ? '' : 'display:none'}">${renderDir(k, depth + 1, proj)}</div>\
</div>`;
		} else {
			const sel = proj.openFile === k.path ? ' sel' : '';
			out += `<div class="row${sel}" draggable="true" data-file="${esc(k.path)}" style="padding-left:${pad}${8}px">\
<span class="fico" style="color:${colorOfExt(k.path)}">${fileIcon(k.path, false)}</span><span class="rname">${esc(k.name)}</span>\
</div>`;
		}
	}
	return out;
}
function validRelPath(p) {
	if (typeof p !== 'string') return false;
	p = p.replace(/^\/+/, '');
	if (!p) return false;
	if (/[<>:"|?*]/.test(p)) return false;
	return p.split('/').every((s) => s && s !== '.' && s !== '..' && !s.includes('\\'));
}
function newFileEntry(path) {
	const it = Core.isTextFile(path);
	const isT = it !== false;
	return {
		path: path,
		data: null,
		text: isT ? '' : null,
		isText: isT,
		history: isT ? [{ t: Date.now(), text: '' }] : [],
	};
}
function remapPaths(proj, fn) {
	if (proj.openFile) proj.openFile = fn(proj.openFile);
	if (proj.openTabs) proj.openTabs = proj.openTabs.map(fn);
	if (proj.dirty) {
		const nd = new Set();
		proj.dirty.forEach((p) => nd.add(fn(p)));
		proj.dirty = nd;
	}
}
function editorToEmpty() {
	disposeMedia();
	el.editorGrid.classList.add('hidden');
	el.editorEmpty.classList.remove('hidden');
	el.editorEmpty.innerHTML = `<div>${iconSvg('code', 'icon')}Selecione um arquivo no Explorer para editar</div>`;
	el.editorTitle.textContent = 'Nenhum arquivo';
	el.editorPath.textContent = '';
}
function fsChanged(proj, openPath) {
	renderTree();
	renderEditorTabs();
	scheduleBuild(proj);
	saveSession();
	if (openPath !== undefined && openPath !== null && proj.files.has(openPath))
		openFileInEditor(openPath);
}
async function uiConfirm(title, message, okLabel, danger) {
	const r = await uiDialog({
		title: title,
		message: message,
		buttons: [
			{ id: 'cancel', label: 'Cancelar' },
			{ id: 'ok', label: okLabel || 'Confirmar', primary: !danger, danger: !!danger },
		],
	});
	return r.act === 'ok';
}
async function ctxNewFile(dir) {
	const proj = activeProject();
	if (!proj) return;
	const msg =
		(dir ? `Dentro de "${dir}/". ` : '') +
		'Nome do arquivo — pode incluir subpastas (ex.: components/Card.jsx).';
	const name = await uiPrompt('Novo arquivo', msg, {
		placeholder: 'novo-arquivo.js',
		okLabel: 'Criar',
	});
	if (name == null) return;
	const nm = name.trim();
	if (!nm) return;
	const path = (dir ? dir + '/' + nm : nm).replace(/^\/+/, '');
	if (!validRelPath(path)) {
		toast('Nome inválido', 'Evite ".." e caracteres especiais', 'err');
		return;
	}
	if (proj.files.has(path)) {
		toast('Já existe', 'Já há um arquivo nesse caminho', 'err');
		openFileInEditor(path);
		return;
	}
	if (proj.emptyDirs && proj.emptyDirs.has(path)) {
		toast('Já existe', 'Já há uma pasta com esse nome', 'err');
		return;
	}
	proj.files.set(path, newFileEntry(path));
	if (dir) openDirs.add(dir);
	if (proj.emptyDirs)
		for (const d of [...proj.emptyDirs]) if (path.startsWith(d + '/')) proj.emptyDirs.delete(d);
	toast('Arquivo criado', `"${path}"`, 'ok');
	fsChanged(proj, path);
}
async function ctxNewFolder(dir) {
	const proj = activeProject();
	if (!proj) return;
	const msg =
		(dir ? `Dentro de "${dir}/". ` : '') +
		'Nome da pasta — pode incluir subpastas (ex.: assets/imagens).';
	const name = await uiPrompt('Nova pasta', msg, { placeholder: 'nova-pasta', okLabel: 'Criar' });
	if (name == null) return;
	const nm = name.trim().replace(/^\/+/, '').replace(/\/+$/, '');
	if (!nm) return;
	const path = dir ? dir + '/' + nm : nm;
	if (!validRelPath(path)) {
		toast('Nome inválido', 'Evite ".." e caracteres especiais', 'err');
		return;
	}
	if (proj.files.has(path)) {
		toast('Já existe', 'Já há um arquivo com esse caminho', 'err');
		return;
	}
	if (!proj.emptyDirs) proj.emptyDirs = new Set();
	const jaExiste =
		proj.emptyDirs.has(path) || [...proj.files.keys()].some((k) => k.startsWith(path + '/'));
	if (jaExiste) {
		toast('Já existe', 'Essa pasta já existe no projeto', 'warn');
		openDirs.add(path);
		renderTree();
		return;
	}
	proj.emptyDirs.add(path);
	let acc = '';
	for (const part of path.split('/')) {
		acc = acc ? acc + '/' + part : part;
		openDirs.add(acc);
	}
	toast('Pasta criada', `"${path}/"`, 'ok');
	renderTree();
	saveSession();
}
async function ctxRenameFile(path) {
	const proj = activeProject();
	if (!proj) return;
	const np = await uiPrompt('Renomear arquivo', 'Novo caminho do arquivo.', {
		placeholder: path,
		okLabel: 'Renomear',
	});
	if (np == null) return;
	const dest = np.trim().replace(/^\/+/, '');
	if (!dest || dest === path) return;
	if (!validRelPath(dest)) {
		toast('Nome inválido', 'Evite ".." e caracteres especiais', 'err');
		return;
	}
	if (proj.files.has(dest)) {
		toast('Já existe', 'Já há um arquivo nesse caminho', 'err');
		return;
	}
	const f = proj.files.get(path);
	if (!f) return;
	f.path = dest;
	const map = new Map();
	for (const [k, v] of proj.files) map.set(k === path ? dest : k, v);
	proj.files = map;
	remapPaths(proj, (p) => (p === path ? dest : p));
	toast('Renomeado', `"${path}" → "${dest}"`, 'ok');
	fsChanged(proj, proj.openFile);
}
async function ctxDuplicateFile(path) {
	const proj = activeProject();
	if (!proj) return;
	const f = proj.files.get(path);
	if (!f) return;
	const dot = path.lastIndexOf('.'),
		slash = path.lastIndexOf('/');
	const hasExt = dot > slash && dot >= 0;
	const base = hasExt ? path.slice(0, dot) : path,
		ext = hasExt ? path.slice(dot) : '';
	let dest = base + '-copia' + ext,
		n = 2;
	while (proj.files.has(dest)) dest = base + '-copia' + n++ + ext;
	proj.files.set(dest, {
		path: dest,
		data: f.data,
		text: f.text,
		isText: f.isText,
		history: f.text != null ? [{ t: Date.now(), text: f.text }] : [],
	});
	toast('Duplicado', `"${dest}"`, 'ok');
	fsChanged(proj, dest);
}
async function ctxDeleteFile(path) {
	const proj = activeProject();
	if (!proj) return;
	if (
		!(await uiConfirm(
			'Excluir arquivo',
			`Excluir "${path}"? Esta ação não pode ser desfeita.`,
			'Excluir',
			true,
		))
	)
		return;
	proj.files.delete(path);
	const wasOpen = proj.openFile === path;
	proj.dirty.delete(path);
	if (proj.openTabs) {
		const i = proj.openTabs.indexOf(path);
		if (i >= 0) proj.openTabs.splice(i, 1);
	}
	if (wasOpen) {
		const next =
			(proj.openTabs && proj.openTabs[proj.openTabs.length - 1]) || pickDefaultFile(proj.files);
		if (next && proj.files.has(next)) openFileInEditor(next);
		else {
			proj.openFile = null;
			editorToEmpty();
		}
	}
	toast('Excluído', `"${path}"`, 'ok');
	fsChanged(proj);
}
async function ctxRenameFolder(dir) {
	const proj = activeProject();
	if (!proj) return;
	const np = await uiPrompt('Renomear pasta', `Novo caminho da pasta "${dir}".`, {
		placeholder: dir,
		okLabel: 'Renomear',
	});
	if (np == null) return;
	const dest = np.trim().replace(/^\/+/, '').replace(/\/+$/, '');
	if (!dest || dest === dir) return;
	if (!validRelPath(dest)) {
		toast('Nome inválido', 'Evite ".." e caracteres especiais', 'err');
		return;
	}
	const pre = dir + '/';
	for (const k of proj.files.keys())
		if (k === dest || k.startsWith(dest + '/')) {
			toast('Conflito', `Já existe algo no destino "${dest}"`, 'err');
			return;
		}
	const map = new Map();
	for (const [k, v] of proj.files) {
		if (k.startsWith(pre)) {
			const nk = dest + '/' + k.slice(pre.length);
			v.path = nk;
			map.set(nk, v);
		} else map.set(k, v);
	}
	proj.files = map;
	remapPaths(proj, (p) => (p && p.startsWith(pre) ? dest + '/' + p.slice(pre.length) : p));
	if (proj.emptyDirs) {
		const nd = new Set();
		proj.emptyDirs.forEach((x) =>
			nd.add(x === dir ? dest : x.startsWith(pre) ? dest + '/' + x.slice(pre.length) : x),
		);
		proj.emptyDirs = nd;
	}
	if (openDirs.has(dir)) {
		openDirs.delete(dir);
		openDirs.add(dest);
	}
	toast('Pasta renomeada', `"${dir}" → "${dest}"`, 'ok');
	fsChanged(proj, proj.openFile);
}
async function ctxDeleteFolder(dir) {
	const proj = activeProject();
	if (!proj) return;
	const pre = dir + '/';
	const victims = [...proj.files.keys()].filter((k) => k.startsWith(pre));
	if (
		!(await uiConfirm(
			'Excluir pasta',
			`Excluir a pasta "${dir}" e seus ${victims.length} arquivo(s)? Esta ação não pode ser desfeita.`,
			'Excluir',
			true,
		))
	)
		return;
	let reopen = false;
	for (const k of victims) {
		proj.files.delete(k);
		proj.dirty.delete(k);
		if (proj.openTabs) {
			const i = proj.openTabs.indexOf(k);
			if (i >= 0) proj.openTabs.splice(i, 1);
		}
		if (proj.openFile === k) reopen = true;
	}
	if (reopen) {
		const next =
			(proj.openTabs && proj.openTabs[proj.openTabs.length - 1]) || pickDefaultFile(proj.files);
		if (next && proj.files.has(next)) openFileInEditor(next);
		else {
			proj.openFile = null;
			editorToEmpty();
		}
	}
	openDirs.delete(dir);
	if (proj.emptyDirs)
		for (const x of [...proj.emptyDirs])
			if (x === dir || x.startsWith(dir + '/')) proj.emptyDirs.delete(x);
	toast('Pasta excluída', victims.length + ' arquivo(s) removido(s)', 'ok');
	fsChanged(proj);
}
let __ctxEl = null;
function hideCtxMenu() {
	if (__ctxEl) {
		__ctxEl.remove();
		__ctxEl = null;
	}
}
function showCtxMenu(x, y, items) {
	hideCtxMenu();
	const m = document.createElement('div');
	m.className = 'ctxmenu';
	m.innerHTML = items
		.map((it, idx) =>
			it.sep
				? '<div class="csep"></div>'
				: it.label != null
					? `<div class="clabel">${esc(it.label)}</div>`
					: `<button class="ci${it.danger ? ' danger' : ''}" data-i="${idx}">${iconSvg(it.icon || 'file')}<span>${esc(it.text)}</span></button>`,
		)
		.join('');
	document.body.appendChild(m);
	const vw = window.innerWidth,
		vh = window.innerHeight,
		r = m.getBoundingClientRect();
	m.style.left = Math.max(6, Math.min(x, vw - r.width - 8)) + 'px';
	m.style.top = Math.max(6, Math.min(y, vh - r.height - 8)) + 'px';
	m.addEventListener('click', (ev) => {
		const b = ev.target.closest('[data-i]');
		if (!b) return;
		hideCtxMenu();
		const it = items[+b.getAttribute('data-i')];
		if (it && it.run) it.run();
	});
	__ctxEl = m;
}
el.tree.addEventListener('contextmenu', (e) => {
	const proj = activeProject();
	if (!proj || !proj.files.size) return;
	e.preventDefault();
	const fileRow = e.target.closest('[data-file]');
	const dirRow = e.target.closest('[data-dir]');
	let items;
	if (fileRow) {
		const p = fileRow.dataset.file;
		items = [
			{ label: p },
			{ icon: 'eye', text: 'Abrir', run: () => openFileInEditor(p) },
			{ icon: 'edit', text: 'Renomear', run: () => ctxRenameFile(p) },
			{ icon: 'copy', text: 'Duplicar', run: () => ctxDuplicateFile(p) },
			{ sep: true },
			{ icon: 'trash', text: 'Excluir', danger: true, run: () => ctxDeleteFile(p) },
		];
	} else if (dirRow) {
		const d = dirRow.dataset.dir;
		items = [
			{ label: d + '/' },
			{ icon: 'plus', text: 'Novo arquivo aqui', run: () => ctxNewFile(d) },
			{ icon: 'folder', text: 'Nova pasta aqui', run: () => ctxNewFolder(d) },
			{ icon: 'edit', text: 'Renomear pasta', run: () => ctxRenameFolder(d) },
			{ sep: true },
			{ icon: 'trash', text: 'Excluir pasta', danger: true, run: () => ctxDeleteFolder(d) },
		];
	} else {
		items = [
			{ icon: 'plus', text: 'Novo arquivo', run: () => ctxNewFile('') },
			{ icon: 'folder', text: 'Nova pasta', run: () => ctxNewFolder('') },
		];
	}
	showCtxMenu(e.clientX, e.clientY, items);
});
window.addEventListener('click', hideCtxMenu);
window.addEventListener('blur', hideCtxMenu);
window.addEventListener('resize', hideCtxMenu);
document.addEventListener('keydown', (e) => {
	if (e.key === 'Escape') hideCtxMenu();
});
el.tree.addEventListener('click', (e) => {
	const dirRow = e.target.closest('[data-dir]');
	const fileRow = e.target.closest('[data-file]');
	if (dirRow) {
		const p = dirRow.dataset.dir;
		if (openDirs.has(p)) openDirs.delete(p);
		else openDirs.add(p);
		renderTree();
		return;
	}
	if (fileRow) {
		openFileInEditor(fileRow.dataset.file);
	}
});

let __media = { dispose: null, url: null };
function disposeMedia() {
	try {
		if (__media.dispose) __media.dispose();
	} catch (e) {
		ignorarErro(e, 'disposeMedia');
	}
	if (__media.url) {
		try {
			URL.revokeObjectURL(__media.url);
		} catch (e) {
			ignorarErro(e, 'disposeMedia');
		}
	}
	__media = { dispose: null, url: null };
	if (typeof el !== 'undefined' && el.mediaView) {
		el.mediaView.classList.add('hidden');
		el.mediaView.innerHTML = '';
	}
}
const IMG_EXT = new Set([
	'.png',
	'.jpg',
	'.jpeg',
	'.jfif',
	'.gif',
	'.webp',
	'.bmp',
	'.ico',
	'.avif',
	'.apng',
]);
const TD_EXT = new Set(['.glb', '.gltf', '.obj', '.stl', '.fbx']);
function isImageExt(e) {
	return IMG_EXT.has(e);
}
function is3DExt(e) {
	return TD_EXT.has(e);
}
function imgMime(ext) {
	const m = {
		'.png': 'image/png',
		'.jpg': 'image/jpeg',
		'.jpeg': 'image/jpeg',
		'.jfif': 'image/jpeg',
		'.gif': 'image/gif',
		'.webp': 'image/webp',
		'.bmp': 'image/bmp',
		'.ico': 'image/x-icon',
		'.avif': 'image/avif',
		'.apng': 'image/apng',
	};
	return m[ext] || 'application/octet-stream';
}
function mvSize(n) {
	if (n < 1024) return n + ' B';
	if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
	return (n / 1048576).toFixed(2) + ' MB';
}
function mvHexToRgb(hex) {
	hex = String(hex || '')
		.trim()
		.replace('#', '');
	if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
	const n = parseInt(hex, 16);
	if (isNaN(n) || hex.length < 6) return [0.36, 0.61, 1.0];
	return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
function mvReduceMotion() {
	return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}
function b64ToBytes(b64) {
	const bin = atob(String(b64).trim());
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}
function m4identity() {
	const o = new Float32Array(16);
	o[0] = o[5] = o[10] = o[15] = 1;
	return o;
}
function m4mul(a, b) {
	const o = new Float32Array(16);
	for (let i = 0; i < 4; i++) {
		const a0 = a[i],
			a1 = a[i + 4],
			a2 = a[i + 8],
			a3 = a[i + 12];
		o[i] = a0 * b[0] + a1 * b[1] + a2 * b[2] + a3 * b[3];
		o[i + 4] = a0 * b[4] + a1 * b[5] + a2 * b[6] + a3 * b[7];
		o[i + 8] = a0 * b[8] + a1 * b[9] + a2 * b[10] + a3 * b[11];
		o[i + 12] = a0 * b[12] + a1 * b[13] + a2 * b[14] + a3 * b[15];
	}
	return o;
}
function m4perspective(fovy, aspect, near, far) {
	const f = 1 / Math.tan(fovy / 2),
		nf = 1 / (near - far);
	const o = new Float32Array(16);
	o[0] = f / aspect;
	o[5] = f;
	o[10] = (far + near) * nf;
	o[11] = -1;
	o[14] = 2 * far * near * nf;
	return o;
}
function m4lookAt(eye, center, up) {
	let z0 = eye[0] - center[0],
		z1 = eye[1] - center[1],
		z2 = eye[2] - center[2];
	let zl = Math.hypot(z0, z1, z2) || 1;
	z0 /= zl;
	z1 /= zl;
	z2 /= zl;
	let x0 = up[1] * z2 - up[2] * z1,
		x1 = up[2] * z0 - up[0] * z2,
		x2 = up[0] * z1 - up[1] * z0;
	let xl = Math.hypot(x0, x1, x2) || 1;
	x0 /= xl;
	x1 /= xl;
	x2 /= xl;
	const y0 = z1 * x2 - z2 * x1,
		y1 = z2 * x0 - z0 * x2,
		y2 = z0 * x1 - z1 * x0;
	const o = new Float32Array(16);
	o[0] = x0;
	o[1] = y0;
	o[2] = z0;
	o[3] = 0;
	o[4] = x1;
	o[5] = y1;
	o[6] = z1;
	o[7] = 0;
	o[8] = x2;
	o[9] = y2;
	o[10] = z2;
	o[11] = 0;
	o[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]);
	o[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]);
	o[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]);
	o[15] = 1;
	return o;
}
function m4fromTRS(t, q, s) {
	const x = q[0],
		y = q[1],
		z = q[2],
		w = q[3];
	const x2 = x + x,
		y2 = y + y,
		z2 = z + z;
	const xx = x * x2,
		xy = x * y2,
		xz = x * z2,
		yy = y * y2,
		yz = y * z2,
		zz = z * z2,
		wx = w * x2,
		wy = w * y2,
		wz = w * z2;
	const sx = s[0],
		sy = s[1],
		sz = s[2];
	const o = new Float32Array(16);
	o[0] = (1 - (yy + zz)) * sx;
	o[1] = (xy + wz) * sx;
	o[2] = (xz - wy) * sx;
	o[3] = 0;
	o[4] = (xy - wz) * sy;
	o[5] = (1 - (xx + zz)) * sy;
	o[6] = (yz + wx) * sy;
	o[7] = 0;
	o[8] = (xz + wy) * sz;
	o[9] = (yz - wx) * sz;
	o[10] = (1 - (xx + yy)) * sz;
	o[11] = 0;
	o[12] = t[0];
	o[13] = t[1];
	o[14] = t[2];
	o[15] = 1;
	return o;
}
function m4transformP(m, p) {
	const x = p[0],
		y = p[1],
		z = p[2];
	let w = m[3] * x + m[7] * y + m[11] * z + m[15];
	if (!w) w = 1;
	return [
		(m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
		(m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
		(m[2] * x + m[6] * y + m[10] * z + m[14]) / w,
	];
}
function finalizeGeo(positions, indices) {
	let P;
	if (indices && indices.length) {
		P = new Float32Array(indices.length * 3);
		for (let i = 0; i < indices.length; i++) {
			const s = indices[i] * 3;
			P[i * 3] = positions[s];
			P[i * 3 + 1] = positions[s + 1];
			P[i * 3 + 2] = positions[s + 2];
		}
	} else {
		P = positions instanceof Float32Array ? positions : new Float32Array(positions);
	}
	let mnx = Infinity,
		mny = Infinity,
		mnz = Infinity,
		mxx = -Infinity,
		mxy = -Infinity,
		mxz = -Infinity;
	for (let i = 0; i < P.length; i += 3) {
		const x = P[i],
			y = P[i + 1],
			z = P[i + 2];
		if (x < mnx) mnx = x;
		if (y < mny) mny = y;
		if (z < mnz) mnz = z;
		if (x > mxx) mxx = x;
		if (y > mxy) mxy = y;
		if (z > mxz) mxz = z;
	}
	const cx = (mnx + mxx) / 2,
		cy = (mny + mxy) / 2,
		cz = (mnz + mxz) / 2;
	for (let i = 0; i < P.length; i += 3) {
		P[i] -= cx;
		P[i + 1] -= cy;
		P[i + 2] -= cz;
	}
	const radius = Math.max(1e-4, Math.hypot(mxx - mnx, mxy - mny, mxz - mnz) / 2);
	const N = new Float32Array(P.length);
	for (let i = 0; i + 8 < P.length; i += 9) {
		const ax = P[i],
			ay = P[i + 1],
			az = P[i + 2],
			bx = P[i + 3],
			by = P[i + 4],
			bz = P[i + 5],
			ux = P[i + 6],
			uy = P[i + 7],
			uz = P[i + 8];
		let nx = (by - ay) * (uz - az) - (bz - az) * (uy - ay);
		let ny = (bz - az) * (ux - ax) - (bx - ax) * (uz - az);
		let nz = (bx - ax) * (uy - ay) - (by - ay) * (ux - ax);
		const l = Math.hypot(nx, ny, nz) || 1;
		nx /= l;
		ny /= l;
		nz /= l;
		for (let k = 0; k < 9; k += 3) {
			N[i + k] = nx;
			N[i + k + 1] = ny;
			N[i + k + 2] = nz;
		}
	}
	return {
		bboxMin: [mnx, mny, mnz],
		bboxMax: [mxx, mxy, mxz],
		center: [cx, cy, cz],
		pos: P,
		nrm: N,
		radius: radius,
		vertCount: (P.length / 3) | 0,
		triCount: (P.length / 9) | 0,
	};
}
function objPush(out, vs, idx) {
	const o = idx * 3;
	out.push(vs[o] || 0, vs[o + 1] || 0, vs[o + 2] || 0);
}
function parseOBJ(text) {
	const vs = [];
	const out = [];
	const lines = text.split('\n');
	for (let li = 0; li < lines.length; li++) {
		const ln = lines[li].trim();
		if (!ln || ln.charAt(0) === '#') continue;
		const c0 = ln.charAt(0),
			c1 = ln.charAt(1);
		if (c0 === 'v' && (c1 === ' ' || c1 === '\t')) {
			const p = ln.split(/\s+/);
			vs.push(+p[1], +p[2], +p[3]);
			continue;
		}
		if (c0 === 'f' && (c1 === ' ' || c1 === '\t')) {
			const p = ln.split(/\s+/);
			const ids = [];
			for (let i = 1; i < p.length; i++) {
				if (!p[i]) continue;
				let n = parseInt(p[i].split('/')[0], 10);
				if (isNaN(n)) continue;
				if (n < 0) n = vs.length / 3 + n + 1;
				ids.push(n - 1);
			}
			for (let i = 1; i + 1 < ids.length; i++) {
				objPush(out, vs, ids[0]);
				objPush(out, vs, ids[i]);
				objPush(out, vs, ids[i + 1]);
			}
		}
	}
	if (!out.length) throw new Error('OBJ sem faces de triângulo');
	return finalizeGeo(new Float32Array(out), null);
}
function parseSTL(bytes) {
	if (bytes.length >= 84) {
		const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
		const tri = dv.getUint32(80, true);
		if (tri > 0 && 84 + tri * 50 === bytes.length) {
			const out = new Float32Array(tri * 9);
			let o = 0,
				p = 84;
			for (let t = 0; t < tri; t++) {
				p += 12;
				for (let v = 0; v < 3; v++) {
					out[o++] = dv.getFloat32(p, true);
					out[o++] = dv.getFloat32(p + 4, true);
					out[o++] = dv.getFloat32(p + 8, true);
					p += 12;
				}
				p += 2;
			}
			return finalizeGeo(out, null);
		}
	}
	const text = new TextDecoder().decode(bytes);
	const out = [];
	const re = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
	let m;
	while ((m = re.exec(text))) {
		out.push(+m[1], +m[2], +m[3]);
	}
	if (!out.length) throw new Error('STL sem vértices');
	return finalizeGeo(new Float32Array(out), null);
}
function gltfMakeRead(json, buffers) {
	return function (ai) {
		const a = json.accessors[ai];
		if (a.bufferView == null) throw new Error('Acessador sparse não suportado');
		const view = json.bufferViews[a.bufferView];
		const buf = buffers[view.buffer];
		if (!buf) throw new Error('Buffer ausente');
		const numComp = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type] || 1;
		const cs = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }[a.componentType];
		const base = (view.byteOffset || 0) + (a.byteOffset || 0);
		const stride = view.byteStride || cs * numComp;
		const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
		const out = new Float32Array(a.count * numComp);
		for (let i = 0; i < a.count; i++) {
			for (let c = 0; c < numComp; c++) {
				const o = base + i * stride + c * cs;
				let v = 0;
				switch (a.componentType) {
					case 5126:
						v = dv.getFloat32(o, true);
						break;
					case 5125:
						v = dv.getUint32(o, true);
						break;
					case 5123:
						v = dv.getUint16(o, true);
						break;
					case 5122:
						v = dv.getInt16(o, true);
						break;
					case 5121:
						v = dv.getUint8(o);
						break;
					case 5120:
						v = dv.getInt8(o);
						break;
				}
				out[i * numComp + c] = v;
			}
		}
		return { array: out, count: a.count, numComp: numComp };
	};
}
function parseGLTFJson(json, glbBin, resolver) {
	const buffers = (json.buffers || []).map(function (b) {
		if (b.uri == null) {
			if (!glbBin) throw new Error('Buffer GLB ausente');
			return glbBin;
		}
		if (/^data:/i.test(b.uri)) {
			const idx = b.uri.indexOf('base64,');
			if (idx < 0) throw new Error('Buffer data URI sem base64');
			return b64ToBytes(b.uri.slice(idx + 7));
		}
		if (!resolver) throw new Error('Buffer externo não disponível');
		return resolver(b.uri);
	});
	const read = gltfMakeRead(json, buffers);
	const pos = [];
	const idx = [];
	let scene = null;
	if (json.scenes && json.scenes.length) {
		scene = json.scenes[json.scene != null ? json.scene : 0];
	}
	const roots =
		scene && scene.nodes
			? scene.nodes
			: (json.nodes || []).map(function (n, i) {
					return i;
				});
	function walk(ni, parent) {
		const node = json.nodes && json.nodes[ni];
		if (!node) return;
		const local = node.matrix
			? Float32Array.from(node.matrix)
			: m4fromTRS(
					node.translation || [0, 0, 0],
					node.rotation || [0, 0, 0, 1],
					node.scale || [1, 1, 1],
				);
		const world = m4mul(parent, local);
		if (node.mesh != null && json.meshes && json.meshes[node.mesh]) {
			const prims = json.meshes[node.mesh].primitives || [];
			for (let pi = 0; pi < prims.length; pi++) {
				const prim = prims[pi];
				if (!prim.attributes || prim.attributes.POSITION == null) continue;
				if (prim.mode != null && prim.mode !== 4) continue;
				const pa = read(prim.attributes.POSITION);
				const startV = pos.length / 3;
				for (let i = 0; i < pa.count; i++) {
					const tp = m4transformP(world, [
						pa.array[i * 3],
						pa.array[i * 3 + 1],
						pa.array[i * 3 + 2],
					]);
					pos.push(tp[0], tp[1], tp[2]);
				}
				if (prim.indices != null) {
					const ir = read(prim.indices);
					for (let i = 0; i < ir.count; i++) idx.push((ir.array[i] | 0) + startV);
				} else {
					for (let i = 0; i < pa.count; i++) idx.push(startV + i);
				}
			}
		}
		if (node.children) for (let c = 0; c < node.children.length; c++) walk(node.children[c], world);
	}
	const I = m4identity();
	for (let r = 0; r < roots.length; r++) walk(roots[r], I);
	if (!pos.length) throw new Error('Nenhuma geometria de triângulos encontrada');
	return finalizeGeo(new Float32Array(pos), idx);
}
function parseGLB(bytes) {
	const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('Cabeçalho GLB inválido');
	const total = dv.getUint32(8, true);
	let off = 12,
		json = null,
		bin = null;
	while (off + 8 <= total && off + 8 <= bytes.length) {
		const clen = dv.getUint32(off, true);
		const ctype = dv.getUint32(off + 4, true);
		const cstart = off + 8;
		const chunk = bytes.subarray(cstart, cstart + clen);
		if (ctype === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(chunk));
		else if (ctype === 0x004e4942) bin = chunk;
		off = cstart + clen;
	}
	if (!json) throw new Error('GLB sem bloco JSON');
	return parseGLTFJson(json, bin, null);
}
function resolveSibling(proj, path, uri) {
	if (/^data:/i.test(uri)) {
		const idx = uri.indexOf('base64,');
		return b64ToBytes(uri.slice(idx + 7));
	}
	const dir = Core.dirname(path);
	const rel = decodeURIComponent(uri);
	const cand = Core.normalizePath(dir ? Core.joinPath(dir, rel) : rel);
	const g = proj.files.get(cand) || proj.files.get(rel) || proj.files.get(Core.normalizePath(rel));
	if (!g) throw new Error('Arquivo referenciado não encontrado: ' + rel);
	return fileBytes(g);
}
function load3D(ext, f, proj, path) {
	const bytes = fileBytes(f);
	if (ext === '.obj') return parseOBJ(new TextDecoder().decode(bytes));
	if (ext === '.stl') return parseSTL(bytes);
	if (ext === '.glb') return parseGLB(bytes);
	if (ext === '.gltf')
		return parseGLTFJson(JSON.parse(new TextDecoder().decode(bytes)), null, function (uri) {
			return resolveSibling(proj, path, uri);
		});
	throw new Error('Formato 3D não suportado: ' + ext);
}
