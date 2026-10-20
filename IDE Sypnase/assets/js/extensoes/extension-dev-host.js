(function (root) {
	'use strict';

	const PANEL_ID = 'extension-dev-host';
	const WATCH_INTERVAL_MS = 1500;
	const MAX_CONSOLE_LINES = 400;

	const state = {
		watching: false,
		timer: null,
		signatures: new Map(),
		selected: null,
		tab: 'console',
		lastReport: null,
		reloads: new Map(),
	};

	function tr(text, params) {
		const value = typeof root.tr === 'function' ? root.tr(text) : text;
		if (!params) return value;
		return value.replace(/\{(\w+)\}/g, (match, name) => (params[name] === undefined ? match : String(params[name])));
	}

	function registry() {
		return root.SynapseExtensions;
	}

	function loader() {
		return root.SynapseExtensionDevLoader;
	}

	function panels() {
		return root.SynapseHostPanels;
	}

	function output() {
		return root.SynapseExtensionOutput;
	}

	function runner() {
		return root.SynapseExtensionTestRunner;
	}

	function project() {
		return typeof root.activeProject === 'function' ? root.activeProject() : null;
	}

	function escape(value) {
		return String(value == null ? '' : value)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	function devExtensions() {
		const target = project();
		if (!registry() || !target) return [];
		return registry()
			.list()
			.filter((item) => item.source === 'dev' && item.projectId === target.id);
	}

	function folderSignature(target, folder) {
		const prefix = folder ? folder + '/' : '';
		let hash = 0;
		let count = 0;
		for (const [path, entry] of target.files) {
			if (prefix && !path.startsWith(prefix)) continue;
			const text = typeof entry.text === 'string' ? entry.text : '';
			const size = text ? text.length : entry.data ? entry.data.byteLength || entry.data.length || 0 : 0;
			const key = path + ':' + size;
			for (let index = 0; index < key.length; index++) hash = (hash * 31 + key.charCodeAt(index)) | 0;
			if (text) {
				const step = Math.max(1, Math.floor(text.length / 512));
				for (let index = 0; index < text.length; index += step) hash = (hash * 33 + text.charCodeAt(index)) | 0;
				hash = (hash * 17 + text.length) | 0;
			}
			count++;
		}
		return count + ':' + hash;
	}

	function snapshotSignatures() {
		const target = project();
		if (!target) return;
		const folders = target.devExtensionFolders ? [...target.devExtensionFolders] : [];
		folders.forEach((folder) => state.signatures.set(target.id + '::' + folder, folderSignature(target, folder)));
	}

	async function tick() {
		const target = project();
		if (!target || !target.devExtensionFolders || !target.devExtensionFolders.size) return;
		for (const folder of [...target.devExtensionFolders]) {
			const key = target.id + '::' + folder;
			const next = folderSignature(target, folder);
			const previous = state.signatures.get(key);
			state.signatures.set(key, next);
			if (previous === undefined || previous === next) continue;
			await reloadFolder(folder, { reason: 'watch' });
		}
	}

	function setWatching(enabled) {
		state.watching = !!enabled;
		clearInterval(state.timer);
		state.timer = null;
		if (state.watching) {
			snapshotSignatures();
			state.timer = setInterval(() => {
				tick().catch(() => {});
			}, WATCH_INTERVAL_MS);
		}
		render();
	}

	async function reloadFolder(folder, options) {
		const target = project();
		if (!target || !loader()) return null;
		const started = performance.now();
		const result = await loader().runFolder(folder, { silent: true });
		const elapsed = Math.round(performance.now() - started);
		const key = target.id + '::' + folder;
		state.signatures.set(key, folderSignature(target, folder));
		const record = state.reloads.get(key) || { count: 0, lastAt: 0, lastMs: 0, lastOk: true };
		record.count += 1;
		record.lastAt = Date.now();
		record.lastMs = elapsed;
		record.lastOk = !!result;
		state.reloads.set(key, record);
		if (result) output().info(result.id, tr('Recarregada ({reason}) em {ms} ms — {status}', { reason: options && options.reason ? options.reason : 'manual', ms: elapsed, status: result.status }));
		if (root.State && root.State.previewOpen && typeof root.scheduleBuild === 'function' && result && manifestUsesPreview(result.id)) root.scheduleBuild(target);
		render();
		return result;
	}

	function manifestUsesPreview(id) {
		const item = registry() && registry().get ? registry().get(id) : null;
		return !!(item && item.permissions && item.permissions.some((permission) => String(permission).startsWith('preview')));
	}

	async function reloadAll() {
		const target = project();
		const folders = target && target.devExtensionFolders ? [...target.devExtensionFolders] : [];
		for (const folder of folders) await reloadFolder(folder, { reason: 'manual' });
		return folders.length;
	}

	function consoleLines(id) {
		const target = project();
		if (!target || !Array.isArray(target.logs)) return [];
		const source = output().SOURCE_PREFIX + id;
		const lines = target.logs.filter((log) => log.src === source);
		return lines.slice(-MAX_CONSOLE_LINES);
	}

	function formatTime(stamp) {
		const date = new Date(stamp);
		return [date.getHours(), date.getMinutes(), date.getSeconds()].map((part) => String(part).padStart(2, '0')).join(':');
	}

	function findItem(id) {
		return devExtensions().find((item) => item.id === id) || null;
	}

	function manifestOf(item) {
		const target = project();
		if (!target || !item) return null;
		const path = (item.folder ? item.folder + '/' : '') + root.SynapseExtensionManifest.FILE_NAME;
		const entry = target.files.get(path);
		if (!entry || typeof entry.text !== 'string') return null;
		try {
			return JSON.parse(entry.text);
		} catch (error) {
			return null;
		}
	}

	function contributionRows(item) {
		const manifest = manifestOf(item);
		const contributes = manifest && manifest.contributes ? manifest.contributes : {};
		const rows = [];
		const push = (kind, declared, live) => {
			if (!declared && !live) return;
			rows.push({ kind, declared: declared || 0, live: live === undefined ? null : live });
		};
		const count = (value) => (Array.isArray(value) ? value.length : value && typeof value === 'object' ? Object.keys(value).length : 0);
		push('commands', count(contributes.commands), item.commands.length);
		push('menus', count(contributes.menus), item.menus ? item.menus.length : null);
		push('keybindings', count(contributes.keybindings));
		push('configuration', contributes.configuration && contributes.configuration.properties ? count(contributes.configuration.properties) : 0);
		push('languages', count(contributes.languages));
		push('grammars', count(contributes.grammars));
		push('themes', count(contributes.themes));
		push('snippets', count(contributes.snippets));
		push('views', count(contributes.views));
		push('viewsContainers', count(contributes.viewsContainers));
		push('statusBar', count(contributes.statusBar));
		push('preview', contributes.preview ? 1 : 0);
		push('taskProviders', count(contributes.taskProviders));
		push('debuggers', count(contributes.debuggers));
		return rows;
	}

	function renderHeader(items) {
		const target = project();
		const watchLabel = state.watching ? tr('Auto-recarregar: ligado') : tr('Auto-recarregar: desligado');
		return `
			<div class="xdh-toolbar">
				<div class="xdh-title">
					<strong>${escape(tr('Extension Development Host'))}</strong>
					<span class="xdh-muted">${escape(target ? target.name : tr('Nenhum projeto'))} · ${items.length} ${escape(tr('extensão(ões) em desenvolvimento'))}</span>
				</div>
				<div class="xdh-actions">
					<button type="button" class="xv-btn" data-act="run-folder">${escape(tr('Executar pasta…'))}</button>
					<button type="button" class="xv-btn" data-act="reload-all" ${items.length ? '' : 'disabled'}>${escape(tr('Recarregar todas'))}</button>
					<button type="button" class="xv-btn ${state.watching ? 'on' : ''}" data-act="toggle-watch" aria-pressed="${state.watching ? 'true' : 'false'}">${escape(watchLabel)}</button>
					<button type="button" class="xv-btn" data-act="new-extension">${escape(tr('Nova extensão…'))}</button>
				</div>
			</div>`;
	}

	function renderList(items) {
		if (!items.length) {
			return `<div class="xdh-empty">
				<p>${escape(tr('Nenhuma extensão de desenvolvimento carregada neste projeto.'))}</p>
				<p class="xdh-muted">${escape(tr('Use "Executar pasta…" para carregar uma pasta com synapse-extension.json, ou crie uma nova com o assistente.'))}</p>
			</div>`;
		}
		const target = project();
		return `<ul class="xdh-list" role="listbox" aria-label="${escape(tr('Extensões em desenvolvimento'))}">${items
			.map((item) => {
				const reload = state.reloads.get((target ? target.id : '') + '::' + item.folder);
				const selected = state.selected === item.id;
				const timing = item.activationTimeMs !== null && item.activationTimeMs !== undefined ? `${item.activationTimeMs} ms` : '—';
				const reloads = reload ? `${reload.count}× · ${reload.lastMs} ms` : '0×';
				return `<li role="option" aria-selected="${selected ? 'true' : 'false'}" class="xdh-item ${selected ? 'selected' : ''} status-${escape(item.status)}" data-id="${escape(item.id)}" tabindex="0">
					<div class="xdh-item-head">
						<span class="xdh-dot" aria-hidden="true"></span>
						<strong>${escape(item.name)}</strong>
						<span class="xdh-muted">v${escape(item.version)}</span>
						<span class="xdh-status">${escape(item.status)}</span>
					</div>
					<div class="xdh-item-meta xdh-muted">
						<span>${escape(item.folder || '(raiz)')}</span>
						<span>${escape(tr('ativação'))}: ${escape(timing)}</span>
						<span>${escape(tr('recargas'))}: ${escape(reloads)}</span>
						<span>${escape(tr('comandos'))}: ${item.commands.length}</span>
					</div>
					${item.error ? `<div class="xdh-error">${escape(item.error)}</div>` : ''}
					<div class="xdh-item-actions">
						<button type="button" class="xv-btn" data-act="reload" data-folder="${escape(item.folder)}">${escape(tr('Recarregar'))}</button>
						<button type="button" class="xv-btn" data-act="run-tests" data-id="${escape(item.id)}">${escape(tr('Rodar testes'))}</button>
						<button type="button" class="xv-btn" data-act="publish" data-folder="${escape(item.folder)}">${escape(tr('Empacotar'))}</button>
						<button type="button" class="xv-btn" data-act="clear-console" data-id="${escape(item.id)}">${escape(tr('Limpar console'))}</button>
						<button type="button" class="xv-btn danger" data-act="deactivate" data-id="${escape(item.id)}">${escape(tr('Desativar'))}</button>
					</div>
				</li>`;
			})
			.join('')}</ul>`;
	}

	function renderConsole(item) {
		const lines = consoleLines(item.id);
		if (!lines.length) return `<div class="xdh-empty xdh-muted">${escape(tr('Nenhuma saída registrada por esta extensão ainda.'))}</div>`;
		return `<ol class="xdh-console" aria-label="${escape(tr('Console da extensão'))}">${lines
			.map((line) => `<li class="lvl-${escape(line.level)}"><time>${escape(formatTime(line.t))}</time><span>${escape(line.text)}</span></li>`)
			.join('')}</ol>`;
	}

	function renderInspector(item) {
		const rows = contributionRows(item);
		const permissions = item.permissions.length ? item.permissions.map((permission) => `<code>${escape(permission)}</code>`).join(' ') : `<span class="xdh-muted">${escape(tr('nenhuma'))}</span>`;
		const activation = item.activationEvents.length ? item.activationEvents.map((event) => `<code>${escape(event)}</code>`).join(' ') : '<code>*</code>';
		const commands = item.commands.length ? `<ul class="xdh-commands">${item.commands.map((id) => `<li><code>${escape(id)}</code><button type="button" class="xv-btn" data-act="exec" data-command="${escape(id)}">${escape(tr('Executar'))}</button></li>`).join('')}</ul>` : `<span class="xdh-muted">${escape(tr('Nenhum comando registrado'))}</span>`;
		const table = rows.length
			? `<table class="xdh-table"><thead><tr><th>${escape(tr('Contribuição'))}</th><th>${escape(tr('Declarado'))}</th><th>${escape(tr('Em execução'))}</th></tr></thead><tbody>${rows
					.map((row) => `<tr><td><code>${escape(row.kind)}</code></td><td>${row.declared}</td><td>${row.live === null ? '—' : row.live}</td></tr>`)
					.join('')}</tbody></table>`
			: `<span class="xdh-muted">${escape(tr('O manifesto não declara contribuições.'))}</span>`;
		return `
			<dl class="xdh-facts">
				<dt>ID</dt><dd><code>${escape(item.id)}</code></dd>
				<dt>${escape(tr('Publisher'))}</dt><dd>${escape(item.publisher || '—')}</dd>
				<dt>${escape(tr('Eventos de ativação'))}</dt><dd>${activation}</dd>
				<dt>${escape(tr('Permissões'))}</dt><dd>${permissions}</dd>
				<dt>${escape(tr('Falhas registradas'))}</dt><dd>${item.failures}</dd>
				<dt>${escape(tr('Habilitação'))}</dt><dd>${escape(item.enablementScope || 'global')}</dd>
			</dl>
			<h4>${escape(tr('Comandos'))}</h4>
			${commands}
			<h4>${escape(tr('Contribuições'))}</h4>
			${table}`;
	}

	function renderTests(item) {
		const report = state.lastReport && state.lastReport.id === item.id ? state.lastReport.report : null;
		if (!report) return `<div class="xdh-empty xdh-muted">${escape(tr('Nenhuma execução de testes ainda. Use "Rodar testes".'))}</div>`;
		if (report.error) return `<div class="xdh-error">${escape(report.error)}</div>`;
		const summaryClass = report.failed ? 'fail' : 'pass';
		const cases = report.cases || [];
		return `
			<div class="xdh-test-summary ${summaryClass}">
				<strong>${report.passed}/${report.total}</strong> ${escape(tr('aprovados'))} · ${report.failed} ${escape(tr('falharam'))} · ${report.skipped} ${escape(tr('ignorados'))} · ${report.durationMs} ms
			</div>
			<ol class="xdh-tests">${cases
				.map((entry) => `<li class="t-${escape(entry.status)}"><span class="xdh-test-name">${escape(entry.fullName || entry.name)}</span><span class="xdh-muted">${entry.durationMs} ms</span>${entry.error ? `<pre>${escape(entry.error.message || entry.error)}${entry.error.stack ? '\n' + escape(entry.error.stack) : ''}</pre>` : ''}</li>`)
				.join('')}</ol>`;
	}

	function renderDetail(items) {
		const item = state.selected ? items.find((entry) => entry.id === state.selected) : items[0];
		if (!item) return '';
		if (!state.selected) state.selected = item.id;
		const tabs = [
			['console', tr('Console')],
			['inspector', tr('Inspetor')],
			['tests', tr('Testes')],
		];
		const body = state.tab === 'inspector' ? renderInspector(item) : state.tab === 'tests' ? renderTests(item) : renderConsole(item);
		return `
			<section class="xdh-detail" aria-label="${escape(item.name)}">
				<div class="xdh-tabs" role="tablist">${tabs
					.map(([id, label]) => `<button type="button" role="tab" class="xdh-tab ${state.tab === id ? 'on' : ''}" aria-selected="${state.tab === id ? 'true' : 'false'}" data-tab="${id}">${escape(label)}</button>`)
					.join('')}</div>
				<div class="xdh-body" role="tabpanel">${body}</div>
			</section>`;
	}

	let container = null;

	function render() {
		if (!container) return;
		const items = devExtensions();
		if (state.selected && !items.some((item) => item.id === state.selected)) state.selected = null;
		container.innerHTML = `<div class="xdh-root">${renderHeader(items)}<div class="xdh-columns">${renderList(items)}${renderDetail(items)}</div></div>`;
	}

	async function runTests(id) {
		if (!runner()) return null;
		state.tab = 'tests';
		state.lastReport = { id, report: null };
		render();
		let report;
		try {
			report = await runner().run(id, { silent: true });
		} catch (error) {
			report = { error: error && error.message ? error.message : String(error) };
		}
		state.lastReport = { id, report };
		render();
		return report;
	}

	async function handleClick(event) {
		const button = event.target.closest('[data-act]');
		const tab = event.target.closest('[data-tab]');
		const row = event.target.closest('.xdh-item');
		if (tab) {
			state.tab = tab.getAttribute('data-tab');
			render();
			return;
		}
		if (button) {
			event.preventDefault();
			const act = button.getAttribute('data-act');
			const id = button.getAttribute('data-id');
			const folder = button.getAttribute('data-folder');
			if (act === 'run-folder' && loader()) {
				await loader().promptAndRun();
				snapshotSignatures();
			} else if (act === 'reload-all') await reloadAll();
			else if (act === 'toggle-watch') setWatching(!state.watching);
			else if (act === 'new-extension' && root.SynapseExtensionScaffold) await root.SynapseExtensionScaffold.create();
			else if (act === 'reload') await reloadFolder(folder || '', { reason: 'manual' });
			else if (act === 'run-tests') await runTests(id);
			else if (act === 'publish' && root.SynapseExtensionPublisher) await root.SynapseExtensionPublisher.packageCommand();
			else if (act === 'clear-console') output().clear(id);
			else if (act === 'deactivate' && registry()) await registry().deactivate(id);
			else if (act === 'exec' && registry()) {
				const command = button.getAttribute('data-command');
				try {
					await registry().executeCommand(command);
					output().command(state.selected, tr('Comando executado: {command}', { command }));
				} catch (error) {
					output().error(state.selected, `${command}: ${error && error.message ? error.message : error}`);
				}
			}
			render();
			return;
		}
		if (row) {
			state.selected = row.getAttribute('data-id');
			render();
		}
	}

	function handleKeydown(event) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		const row = event.target.closest('.xdh-item');
		if (!row) return;
		event.preventDefault();
		state.selected = row.getAttribute('data-id');
		render();
	}

	function open() {
		if (!panels()) return;
		panels().open({
			key: PANEL_ID,
			title: tr('Extension Development Host'),
			icon: 'bug',
			render: (node) => {
				if (container !== node) {
					container = node;
					node.addEventListener('click', (event) => {
						handleClick(event).catch((error) => output().error('host', error && error.message ? error.message : String(error)));
					});
					node.addEventListener('keydown', handleKeydown);
				}
				render();
			},
			onShow: render,
			onClose: () => {
				container = null;
				setWatching(false);
			},
		});
	}

	function scheduleRender() {
		if (!container) return;
		clearTimeout(scheduleRender.timer);
		scheduleRender.timer = setTimeout(render, 80);
	}

	function bootstrap() {
		if (!registry()) return;
		if (typeof registry().onDidChange === 'function') registry().onDidChange(scheduleRender);
		if (typeof registry().onDidChangeProject === 'function') registry().onDidChangeProject(scheduleRender);
		document.addEventListener('synapse:idioma', scheduleRender);
		registry().registerPaletteCommand(() => ({
			id: 'ext-dev-host',
			label: tr('Extensões: Abrir Extension Development Host'),
			hint: 'extensão desenvolvimento dev host recarregar console inspetor',
			icon: 'bug',
			on: !!project(),
			run: open,
		}));
		registry().registerPaletteCommand(() => ({
			id: 'ext-dev-watch',
			label: state.watching ? tr('Extensões: Desligar auto-recarregar') : tr('Extensões: Ligar auto-recarregar'),
			hint: 'extensão watch auto reload recarregar automático',
			icon: 'refresh',
			on: devExtensions().length > 0,
			run: () => {
				setWatching(!state.watching);
				root.toast(tr('Extension Development Host'), state.watching ? tr('Auto-recarregar: ligado') : tr('Auto-recarregar: desligado'), 'ok');
			},
		}));
	}

	const handlers = {
		'devhost.list': () => devExtensions(),
		'devhost.reload': async (params) => {
			const folder = params && typeof params.folder === 'string' ? params.folder : null;
			if (folder === null) return { reloaded: await reloadAll() };
			const result = await reloadFolder(folder, { reason: 'mcp' });
			return result ? { id: result.id, status: result.status } : { error: 'Falha ao recarregar.' };
		},
		'devhost.console': (params) => consoleLines(params && params.id ? String(params.id) : ''),
		'devhost.inspect': (params) => {
			const item = findItem(params && params.id ? String(params.id) : '');
			if (!item) return null;
			return { ...item, contributions: contributionRows(item), manifest: manifestOf(item) };
		},
		'devhost.watch': (params) => {
			setWatching(!!(params && params.enabled));
			return { watching: state.watching };
		},
	};

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootstrap);
	else bootstrap();

	root.SynapseExtensionDevHost = Object.freeze({
		PANEL_ID,
		open,
		render,
		reloadFolder,
		reloadAll,
		runTests,
		setWatching,
		devExtensions,
		consoleLines,
		handlers,
		get watching() {
			return state.watching;
		},
	});
})(window);

