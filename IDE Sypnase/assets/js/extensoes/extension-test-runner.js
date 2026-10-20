(function (root) {
	'use strict';

	const KEY = 'extensions-tests';
	const TEST_FILE_PATTERN = /^test\/.*\.test\.js$/;
	const RUN_TIMEOUT_MS = 120000;
	const reports = new Map();
	const running = new Set();
	let container = null;

	function tr(text) {
		return typeof root.tr === 'function' ? root.tr(text) : text;
	}

	function esc(text) {
		return typeof root.escaparHtml === 'function' ? root.escaparHtml(String(text == null ? '' : text)) : String(text == null ? '' : text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
	}

	function icon(name, className) {
		return typeof root.iconSvg === 'function' ? root.iconSvg(name, className) : '';
	}

	function registry() {
		return root.SynapseExtensions;
	}

	function output() {
		return root.SynapseExtensionOutput;
	}

	function panels() {
		return root.SynapseHostPanels;
	}

	function toast(title, message, kind) {
		if (typeof root.toast === 'function') root.toast(title, message, kind || 'ok');
	}

	function testFilesOf(id) {
		const files = registry() && registry().filesOf(id);
		if (!files) return [];
		return [...files.keys()].filter((path) => TEST_FILE_PATTERN.test(path)).sort();
	}

	function hasTests(id) {
		return testFilesOf(id).length > 0;
	}

	function testable() {
		return registry() ? registry().list().filter((item) => hasTests(item.id)) : [];
	}

	function lastReport(id) {
		return reports.get(id) || null;
	}

	function logReport(id, report) {
		if (!output()) return;
		const channel = output();
		report.cases.forEach((entry) => {
			const line = `[${entry.status === 'passed' ? 'PASS' : entry.status === 'failed' ? 'FAIL' : 'SKIP'}] ${entry.name} (${entry.durationMs} ms)`;
			if (entry.status === 'failed') channel.error(id, `${line}\n    ${entry.error || ''}`);
			else if (entry.status === 'skipped') channel.warn(id, line);
			else channel.info(id, line);
		});
		const summary = `${report.passed}/${report.total} ${tr('aprovado(s)')}, ${report.failed} ${tr('reprovado(s)')}, ${report.skipped} ${tr('pulado(s)')} · ${report.durationMs} ms · ${(report.files || []).length} ${tr('arquivo(s) de teste')}`;
		if (report.failed) channel.error(id, summary);
		else channel.command(id, summary);
	}

	async function run(id, options) {
		options = options || {};
		if (!registry()) throw new Error('Registro de extensões indisponível.');
		const item = registry().get(id);
		if (!item) throw new Error(`Extensão "${id}" não está carregada.`);
		if (running.has(id)) throw new Error(`Testes de "${id}" já estão em execução.`);
		running.add(id);
		render();
		try {
			if (item.status !== 'active') await registry().activate(id, 'tests');
			const report = await registry().requestExtension(id, 'test.run', { pattern: options.pattern || '' }, { timeoutMs: options.timeoutMs || RUN_TIMEOUT_MS });
			const record = { ...report, extensionId: id, finishedAt: Date.now() };
			reports.set(id, record);
			logReport(id, record);
			if (!options.silent) {
				if (!record.total) toast(tr('Sem testes'), `${item.name}: ${tr('nenhum arquivo test/*.test.js encontrado.')}`, 'warn');
				else toast(record.failed ? tr('Testes reprovados') : tr('Testes aprovados'), `${item.name}: ${record.passed}/${record.total} · ${record.durationMs} ms`, record.failed ? 'err' : 'ok');
			}
			return record;
		} catch (error) {
			const record = { extensionId: id, total: 0, passed: 0, failed: 1, skipped: 0, durationMs: 0, cases: [], files: [], finishedAt: Date.now(), error: error && error.message ? error.message : String(error) };
			reports.set(id, record);
			if (output()) output().error(id, `${tr('Falha ao executar testes')}: ${record.error}`);
			if (!options.silent) toast(tr('Falha ao executar testes'), record.error, 'err');
			throw error;
		} finally {
			running.delete(id);
			render();
		}
	}

	async function runAll(options) {
		const items = testable();
		const results = [];
		for (const item of items) {
			try {
				results.push(await run(item.id, { ...(options || {}), silent: true }));
			} catch (error) {
				results.push(reports.get(item.id));
			}
		}
		const failed = results.filter((entry) => entry && entry.failed).length;
		if (!(options && options.silent)) toast(failed ? tr('Testes reprovados') : tr('Testes aprovados'), `${results.length} ${tr('extensão(ões)')}, ${failed} ${tr('com falhas')}`, failed ? 'err' : 'ok');
		return results;
	}

	function statusClass(entry) {
		return entry.status === 'passed' ? 'ok' : entry.status === 'failed' ? 'fail' : 'skip';
	}

	function caseRows(report) {
		if (report.error) return `<tr class="xt-case xt-fail"><td>${icon('close', 'xt-ico')}</td><td colspan="2">${esc(report.error)}</td></tr>`;
		if (!report.cases.length) return `<tr class="xt-case xt-skip"><td></td><td colspan="2">${esc(tr('Nenhum caso encontrado em test/*.test.js.'))}</td></tr>`;
		return report.cases
			.map((entry) => {
				const cls = statusClass(entry);
				return `<tr class="xt-case xt-${cls}"><td>${icon(cls === 'ok' ? 'check' : cls === 'fail' ? 'close' : 'minus', 'xt-ico')}</td><td><div>${esc(entry.name)}</div>${entry.error ? `<div class="xt-error">${esc(entry.error)}</div>` : ''}</td><td class="xd-mono xd-muted">${entry.durationMs} ms</td></tr>`;
			})
			.join('');
	}

	function block(item) {
		const report = reports.get(item.id);
		const busy = running.has(item.id);
		const files = testFilesOf(item.id);
		const head =
			`<header class="xt-block-head">` +
			`<div><div class="xr-name">${esc(item.name)}</div><div class="xd-mono xd-muted">${esc(item.id)} · ${files.length} ${esc(tr('arquivo(s)'))}</div></div>` +
			`<div class="xr-head-actions">` +
			(report && report.total ? `<span class="xt-badge ${report.failed ? 'xt-badge-fail' : 'xt-badge-ok'}">${report.passed}/${report.total}</span>` : '') +
			`<button type="button" class="xv-btn xv-btn-primary" data-act="run" data-id="${esc(item.id)}" ${busy ? 'disabled' : ''}>${icon('play')} ${esc(busy ? tr('Executando…') : tr('Executar'))}</button>` +
			`<button type="button" class="xv-gear" data-act="open" data-path="${esc(files[0] || '')}" data-id="${esc(item.id)}" title="${esc(tr('Abrir arquivo de teste'))}" aria-label="${esc(tr('Abrir arquivo de teste'))}">${icon('file')}</button>` +
			`</div></header>`;
		const body = report ? `<table class="xd-table xt-table"><tbody>${caseRows(report)}</tbody></table>` : `<p class="xd-empty">${esc(tr('Ainda não executado.'))}</p>`;
		return `<section class="xt-block" data-id="${esc(item.id)}">${head}${body}</section>`;
	}

	function render() {
		if (!container) return;
		const items = testable();
		const total = [...reports.values()].reduce((sum, report) => sum + (report.total || 0), 0);
		const failed = [...reports.values()].reduce((sum, report) => sum + (report.failed || 0), 0);
		container.innerHTML =
			`<div class="xr-root xt-root">` +
			`<header class="xr-head"><h1>${esc(tr('Testes de extensões'))}</h1><div class="xr-head-actions">` +
			`<button type="button" class="xv-btn" data-act="output">${esc(tr('Ver saída'))}</button>` +
			`<button type="button" class="xv-btn xv-btn-primary" data-act="run-all" ${items.length && !running.size ? '' : 'disabled'}>${icon('play')} ${esc(tr('Executar todas'))}</button>` +
			`</div></header>` +
			`<div class="xr-summary"><span><strong>${items.length}</strong> ${esc(tr('extensão(ões) com testes'))}</span><span><strong>${total}</strong> ${esc(tr('casos'))}</span><span><strong>${failed}</strong> ${esc(tr('falhas'))}</span></div>` +
			(items.length ? items.map(block).join('') : `<p class="xd-empty">${esc(tr('Nenhuma extensão carregada tem arquivos test/*.test.js. Use "Extensões: Criar nova extensão…" para gerar um projeto com testes.'))}</p>`) +
			`</div>`;
	}

	function openTestFile(id, path) {
		const item = registry().get(id);
		if (!item || !path) return;
		const project = registry().projectFor(id);
		if (!project || typeof root.openFileInEditor !== 'function') return;
		const full = item.folder ? `${item.folder}/${path}` : path;
		if (project.files.has(full)) root.openFileInEditor(full);
	}

	function bind(node) {
		node.addEventListener('click', (event) => {
			const button = event.target.closest('[data-act]');
			if (!button) return;
			const action = button.dataset.act;
			if (action === 'output' && output()) return output().show();
			if (action === 'run-all') return runAll().catch(() => {});
			if (action === 'run') return run(button.dataset.id).catch(() => {});
			if (action === 'open') return openTestFile(button.dataset.id, button.dataset.path);
		});
	}

	function open() {
		if (!panels()) return;
		panels().open({
			key: KEY,
			title: tr('Testes de extensões'),
			icon: 'check',
			render: (node) => {
				if (container !== node) {
					container = node;
					bind(node);
				}
				render();
			},
			onShow: render,
			onClose: () => {
				container = null;
			},
		});
	}

	async function pickAndRun() {
		const items = testable();
		if (!items.length) {
			toast(tr('Sem testes'), tr('Nenhuma extensão carregada tem arquivos test/*.test.js.'), 'warn');
			return null;
		}
		let target = items[0];
		if (items.length > 1 && root.SynapseExtensionWindow) {
			const picked = await root.SynapseExtensionWindow.showQuickPick(
				{ items: items.map((item) => ({ label: item.name, description: `${item.id} · ${testFilesOf(item.id).length} ${tr('arquivo(s)')}` })), options: { title: tr('Executar testes de extensão'), placeHolder: tr('Escolha a extensão') } },
				{},
			);
			if (!Array.isArray(picked) || !picked.length) return null;
			target = items[picked[0]];
		}
		open();
		return run(target.id).catch(() => null);
	}

	const handlers = {
		'test.report': (params, context) => {
			const id = context.descriptor.id;
			const previous = reports.get(id) || {};
			reports.set(id, { ...previous, ...params, extensionId: id, finishedAt: Date.now() });
			render();
			return null;
		},
	};

	function register() {
		if (!registry()) return;
		if (typeof registry().onDidChange === 'function') registry().onDidChange(() => container && render());
		registry().registerPaletteCommand(() => ({ id: 'synapse.extensions.tests.run', label: tr('Extensões: Executar testes…'), hint: tr('synapse.test describe it expect'), icon: 'play', on: testable().length > 0, run: pickAndRun }));
		registry().registerPaletteCommand(() => ({ id: 'synapse.extensions.tests.panel', label: tr('Extensões: Painel de testes'), hint: tr('relatório dos testes das extensões'), icon: 'check', on: true, run: open }));
		if (root.SynapseNativeShortcuts && typeof root.SynapseNativeShortcuts.register === 'function') {
			root.SynapseNativeShortcuts.register([{ id: 'synapse.extensions.tests', label: tr('Executar testes da extensão'), defaultBinding: '', category: tr('Extensões'), run: () => pickAndRun() }]);
		}
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', register, { once: true });
	else register();

	root.SynapseExtensionTestRunner = Object.freeze({ handlers, run, runAll, open, hasTests, testFilesOf, lastReport, TEST_FILE_PATTERN });
	root.SynapseExtensionTests = root.SynapseExtensionTestRunner;
})(window);

