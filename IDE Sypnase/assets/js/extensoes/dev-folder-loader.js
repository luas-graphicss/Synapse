(function (root) {
	'use strict';

	const MAX_TOTAL_BYTES = 8 * 1024 * 1024;
	const MAX_BINARY_BYTES = 2 * 1024 * 1024;
	const BINARY_ASSETS = /\.(png|jpe?g|gif|webp|avif|ico|bmp|woff2?|ttf|otf|mp3|ogg|wav|glb)$/i;

	function manifestApi() {
		return root.SynapseExtensionManifest;
	}

	function registry() {
		return root.SynapseExtensions;
	}

	function output() {
		return root.SynapseExtensionOutput;
	}

	function project() {
		return typeof root.activeProject === 'function' ? root.activeProject() : null;
	}

	function cleanFolder(value) {
		return String(value || '')
			.trim()
			.replace(/\\/g, '/')
			.replace(/^\.\//, '')
			.replace(/^\/+|\/+$/g, '');
	}

	function candidates(target) {
		const name = manifestApi().FILE_NAME;
		const found = [];
		for (const path of target.files.keys()) {
			if (path === name) found.push('');
			else if (path.endsWith('/' + name)) found.push(path.slice(0, -(name.length + 1)));
		}
		return found.sort((a, b) => a.length - b.length);
	}

	function collectFiles(target, folder) {
		const prefix = folder ? folder + '/' : '';
		const files = new Map();
		let total = 0;
		for (const [path, entry] of target.files) {
			if (prefix && !path.startsWith(prefix)) continue;
			if (typeof root.sniffTextEntry === 'function') root.sniffTextEntry(entry);
			if (!entry.isText || typeof entry.text !== 'string') {
				const bytes = entry.data && (entry.data.byteLength || entry.data.length) ? entry.data : null;
				if (!bytes || !BINARY_ASSETS.test(path) || (bytes.byteLength || bytes.length) > MAX_BINARY_BYTES) continue;
				total += bytes.byteLength || bytes.length;
				if (total > MAX_TOTAL_BYTES) break;
				files.set(path.slice(prefix.length), bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes.buffer || bytes));
				continue;
			}
			total += entry.text.length;
			if (total > MAX_TOTAL_BYTES) break;
			files.set(path.slice(prefix.length), entry.text);
		}
		return files;
	}

	function parseLocalizedManifest(text, files, folder) {
		let json;
		try {
			json = JSON.parse(String(text));
		} catch (error) {
			return manifestApi().parse(text);
		}
		const nls = root.SynapseExtensionNls;
		if (nls && nls.hasBundle(files)) {
			const localized = nls.apply(json, files, document.documentElement.lang || 'pt');
			localized.missing.forEach((key) => output().warn(folder || '(raiz)', `package.nls.json: chave "${key}" não encontrada.`));
			json = localized.manifest;
		}
		return manifestApi().validate(json);
	}

	function rememberFolder(target, folder) {
		if (!target.devExtensionFolders) target.devExtensionFolders = new Set();
		target.devExtensionFolders.add(folder);
	}

	async function runFolder(folder, options) {
		options = options || {};
		const target = project();
		if (!target) {
			root.toast('Nenhum projeto aberto', 'Abra o projeto que contém a extensão.', 'warn');
			return null;
		}
		folder = cleanFolder(folder);
		const manifestPath = folder ? folder + '/' + manifestApi().FILE_NAME : manifestApi().FILE_NAME;
		const entry = target.files.get(manifestPath);
		if (!entry) {
			root.toast('Manifesto não encontrado', `Esperado em ${manifestPath}`, 'err');
			return null;
		}
		if (typeof root.sniffTextEntry === 'function') root.sniffTextEntry(entry);
		const files = collectFiles(target, folder);
		const parsed = parseLocalizedManifest(entry.text || '', files, folder);
		if (!parsed.ok) {
			const id = folder || '(raiz)';
			parsed.errors.forEach((error) => output().error(id, `${manifestPath} → ${error.path}: ${error.message}`));
			output().show();
			root.toast('Manifesto inválido', `${parsed.errors.length} problema(s) em ${manifestPath}. Veja o console.`, 'err');
			return null;
		}
		if (!files.has(parsed.manifest.main.replace(/^\.\//, ''))) {
			output().error(parsed.manifest.id, `Arquivo principal "${parsed.manifest.main}" não encontrado em ${folder || '(raiz)'}.`);
			output().show();
			root.toast('Arquivo principal ausente', parsed.manifest.main, 'err');
			return null;
		}
		try {
			const result = await registry().register({
				manifest: parsed.manifest,
				files,
				source: 'dev',
				projectId: target.id,
				folder,
			});
			rememberFolder(target, folder);
			if (!options.silent) root.toast('Extensão carregada', `${result.name} v${result.version} — ${result.status}`, 'ok');
			return result;
		} catch (error) {
			output().error(parsed.manifest.id, error.message);
			output().show();
			root.toast('Falha ao carregar extensão', error.message, 'err');
			return null;
		}
	}

	async function promptAndRun() {
		const target = project();
		if (!target) {
			root.toast('Nenhum projeto aberto', 'Abra o projeto que contém a extensão.', 'warn');
			return null;
		}
		const found = candidates(target);
		const hint = found.length
			? `Encontrado em: ${found.map((folder) => folder || '(raiz)').join(', ')}. Deixe em branco para usar a primeira.`
			: 'Nenhum synapse-extension.json encontrado no projeto. Informe a pasta mesmo assim.';
		const answer = await root.uiPrompt('Executar pasta como extensão', hint, {
			placeholder: found.length ? found[0] || '(raiz)' : 'extensoes/minha-extensao',
			okLabel: 'Executar',
		});
		if (answer === null) return null;
		const folder = answer.trim() && answer.trim() !== '(raiz)' ? answer : found.length ? found[0] : '';
		return runFolder(folder);
	}

	async function reloadAll() {
		const target = project();
		const folders = target && target.devExtensionFolders ? [...target.devExtensionFolders] : [];
		if (!folders.length) {
			root.toast('Nada para recarregar', 'Nenhuma extensão de desenvolvimento carregada neste projeto.', 'warn');
			return 0;
		}
		let count = 0;
		for (const folder of folders) {
			if (await runFolder(folder, { silent: true })) count++;
		}
		root.toast('Extensões recarregadas', `${count} de ${folders.length}`, count === folders.length ? 'ok' : 'warn');
		return count;
	}

	function showRunning() {
		const list = registry().list();
		const target = project();
		const id = 'host';
		if (!list.length) output().info(id, 'Nenhuma extensão registrada.');
		list.forEach((item) => {
			const timing = item.activationTimeMs !== null ? ` · ${item.activationTimeMs} ms` : '';
			const error = item.error ? ` · erro: ${item.error}` : '';
			output().info(id, `${item.id} v${item.version} — ${item.status}${timing} · comandos: ${item.commands.length || 0} · permissões: ${item.permissions.join(', ') || 'nenhuma'}${error}`);
		});
		if (target) output().show();
	}

	async function deactivateAll() {
		const list = registry().list();
		for (const item of list) await registry().unregister(item.id);
		root.toast('Extensões desativadas', `${list.length} extensão(ões) descarregada(s).`, 'ok');
	}

	function hasProject() {
		return !!project();
	}

	function hasDevExtensions() {
		const target = project();
		return !!(target && target.devExtensionFolders && target.devExtensionFolders.size);
	}

	function hasExtensions() {
		return registry().list().length > 0;
	}

	function hasConfiguration() {
		return !!root.SynapseExtensionConfiguration && root.SynapseExtensionConfiguration.list().length > 0;
	}

	function hasStatusItems() {
		return !!root.SynapseExtensionWindow && root.SynapseExtensionWindow.listStatusItems().length > 0;
	}

	function workspaceHost() {
		return root.SynapseExtensionWorkspace;
	}

	function hasExtensionUndo() {
		return !!workspaceHost() && workspaceHost().undoCount > 0;
	}

	function undoExtensionEdit() {
		const host = workspaceHost();
		if (!host || !host.undoCount) return;
		const label = host.lastUndoLabel;
		const record = host.undoLast();
		if (!record) return;
		if (typeof root.toast === 'function') {
			root.toast('Alteração desfeita', `"${label}" revertida: ${record.files.length} arquivo(s), ${record.operations.length} operação(ões).`, 'ok');
		}
	}

	function openSettings() {
		if (root.SynapseSettingsPanel) root.SynapseSettingsPanel.open('extensions');
	}

	async function pickStatusItem() {
		const items = root.SynapseExtensionWindow.listStatusItems();
		if (!items.length) return;
		const picked = await root.SynapseExtensionWindow.showQuickPick(
			{
				items: items.map((item) => ({ label: item.text, description: item.extensionName, detail: item.tooltip })),
				options: { title: 'Itens da barra de status', placeHolder: 'Escolha um item para acionar' },
			},
			{},
		);
		if (!Array.isArray(picked) || !picked.length) return;
		const item = items[picked[0]];
		if (item && item.command) registry().executeCommand(item.command, ...item.arguments).catch(() => {});
	}

	registry().registerPaletteCommand(() => ({
		id: 'ext-dev-run',
		label: 'Extensões: Executar pasta como extensão',
		hint: 'extensão dev host',
		icon: 'folderOpen',
		on: hasProject(),
		run: promptAndRun,
	}));
	registry().registerPaletteCommand(() => ({
		id: 'ext-dev-reload',
		label: 'Extensões: Recarregar extensões de desenvolvimento',
		hint: 'extensão dev recarregar',
		icon: 'reload',
		on: hasDevExtensions(),
		run: reloadAll,
	}));
	registry().registerPaletteCommand(() => ({
		id: 'ext-running',
		label: 'Extensões: Mostrar extensões em execução',
		hint: 'extensão status',
		icon: 'console',
		on: hasExtensions(),
		run: showRunning,
	}));
	registry().registerPaletteCommand(() => ({
		id: 'ext-settings',
		label: 'Extensões: Abrir configurações das extensões',
		hint: 'extensão configurações settings',
		icon: 'settings',
		on: hasConfiguration(),
		run: openSettings,
	}));
	registry().registerPaletteCommand(() => ({
		id: 'ext-status-items',
		label: 'Extensões: Itens da barra de status',
		hint: 'extensão status bar celular',
		icon: 'info',
		on: hasStatusItems(),
		run: pickStatusItem,
	}));
	registry().registerPaletteCommand(() => ({
		id: 'ext-deactivate-all',
		label: 'Extensões: Desativar todas',
		hint: 'extensão desativar',
		icon: 'trash',
		on: hasExtensions(),
		run: deactivateAll,
	}));
	registry().registerPaletteCommand(() => ({
		id: 'ext-undo-edit',
		label: 'Extensões: Desfazer última alteração de extensão' + (hasExtensionUndo() ? ` (${workspaceHost().lastUndoLabel})` : ''),
		hint: 'extensão desfazer undo workspace edit',
		icon: 'undo',
		on: hasExtensionUndo(),
		run: undoExtensionEdit,
	}));

	root.SynapseExtensionDevLoader = Object.freeze({ runFolder, promptAndRun, reloadAll, showRunning, deactivateAll, candidates });
})(window);
