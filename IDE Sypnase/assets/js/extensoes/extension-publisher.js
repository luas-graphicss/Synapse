(function (root) {
	'use strict';

	const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
	const BINARY_ASSETS = /\.(png|jpe?g|gif|webp|avif|ico|bmp|woff2?|ttf|otf|mp3|ogg|wav|glb)$/i;
	const IGNORED = /(^|\/)(node_modules|\.git|\.synapse|dist-sx)(\/|$)|\.sx$/;

	function pkg() {
		return root.SynapseExtensionPackage;
	}

	function market() {
		return root.SynapseExtensionMarketplace;
	}

	function installer() {
		return root.SynapseExtensionInstaller;
	}

	function registry() {
		return root.SynapseExtensions;
	}

	function manifestApi() {
		return root.SynapseExtensionManifest;
	}

	function devLoader() {
		return root.SynapseExtensionDevLoader;
	}

	function output() {
		return root.SynapseExtensionOutput;
	}

	function windowHost() {
		return root.SynapseExtensionWindow;
	}

	function toast(title, message, kind) {
		if (typeof root.toast === 'function') root.toast(title, message, kind || 'ok');
	}

	function project() {
		return typeof root.activeProject === 'function' ? root.activeProject() : null;
	}

	function cleanFolder(value) {
		return String(value || '')
			.trim()
			.replace(/\\/g, '/')
			.replace(/^\.\//, '')
			.replace(/^\/+|\/+$/g, '')
			.replace(/^\(raiz\)$/, '');
	}

	function collectFiles(target, folder) {
		const prefix = folder ? folder + '/' : '';
		const files = new Map();
		let total = 0;
		for (const [path, entry] of target.files) {
			if (prefix && !path.startsWith(prefix)) continue;
			const relative = path.slice(prefix.length);
			if (!relative || IGNORED.test(relative)) continue;
			if (typeof root.sniffTextEntry === 'function') root.sniffTextEntry(entry);
			if (entry.isText && typeof entry.text === 'string') {
				total += entry.text.length;
				files.set(relative, entry.text);
			} else if (entry.data && BINARY_ASSETS.test(relative)) {
				const bytes = entry.data instanceof Uint8Array ? entry.data : new Uint8Array(entry.data.buffer || entry.data);
				total += bytes.length;
				files.set(relative, bytes);
			}
			if (total > MAX_TOTAL_BYTES) throw new Error('A pasta da extensão passa de 20 MB.');
		}
		return files;
	}

	function readManifest(files) {
		const text = files.get(manifestApi().FILE_NAME);
		if (typeof text !== 'string') throw new Error(`${manifestApi().FILE_NAME} não encontrado na pasta escolhida.`);
		const parsed = manifestApi().parse(text);
		if (!parsed.ok) throw new Error('Manifesto inválido:\n' + manifestApi().formatErrors(parsed.errors));
		return parsed.manifest;
	}

	function writeProjectFile(target, path, text) {
		const existing = target.files.get(path);
		if (existing) {
			existing.text = text;
			existing.data = null;
			existing.isText = true;
		} else if (typeof root.newFileEntry === 'function') {
			const entry = root.newFileEntry(path);
			entry.text = text;
			entry.isText = true;
			target.files.set(path, entry);
		} else {
			target.files.set(path, { text, isText: true, data: null, history: [] });
		}
		if (target.dirty) target.dirty.add(path);
		if (typeof root.fsChanged === 'function') root.fsChanged(target);
	}

	function readmeTemplate(manifest) {
		const commands = (manifest.contributes && manifest.contributes.commands) || [];
		const lines = [`# ${manifest.name}`, '', manifest.description || 'Descreva em uma frase o que a extensão faz.', '', '## Instalação', '', `Na IDE Synapse: **Extensões: Instalar de URL ou owner/repo@tag** e informe \`${manifest.id}\`.`, ''];
		if (commands.length) {
			lines.push('## Comandos', '');
			commands.forEach((command) => lines.push(`- \`${command.command}\` — ${command.title}`));
			lines.push('');
		}
		if (manifest.permissions && manifest.permissions.length) {
			lines.push('## Permissões', '');
			manifest.permissions.forEach((permission) => lines.push(`- \`${permission}\``));
			lines.push('');
		}
		lines.push('## Licença', '', manifest.license || 'Veja o arquivo LICENSE.', '');
		return lines.join('\n');
	}

	function changelogTemplate(manifest) {
		const today = new Date().toISOString().slice(0, 10);
		return `# Changelog\n\n## ${manifest.version} — ${today}\n\n- Primeira versão publicada.\n`;
	}

	async function ensureDocs(target, folder, files, manifest) {
		const missing = pkg().REQUIRED_DOCS.filter((doc) => !files.has(doc));
		if (!missing.length) return files;
		const ok = typeof root.uiConfirm === 'function' ? await root.uiConfirm('Documentos obrigatórios', `${missing.join(' e ')} ${missing.length > 1 ? 'não existem' : 'não existe'} em ${folder || '(raiz)'}. Gerar modelos agora e continuar?`, 'Gerar e continuar', false) : true;
		if (!ok) throw new Error(`Empacotamento cancelado: ${missing.join(', ')} obrigatório(s).`);
		missing.forEach((doc) => {
			const text = doc === 'README.md' ? readmeTemplate(manifest) : changelogTemplate(manifest);
			writeProjectFile(target, folder ? `${folder}/${doc}` : doc, text);
			files.set(doc, text);
		});
		return files;
	}

	async function pickFolder(title) {
		const target = project();
		if (!target) {
			toast('Nenhum projeto aberto', 'Abra o projeto que contém a extensão.', 'warn');
			return null;
		}
		const found = devLoader() ? devLoader().candidates(target) : [];
		if (found.length === 1) return { target, folder: found[0] };
		if (found.length > 1 && windowHost()) {
			const picked = await windowHost().showQuickPick(
				{ items: found.map((folder) => ({ label: folder || '(raiz)', description: `${folder ? folder + '/' : ''}${manifestApi().FILE_NAME}` })), options: { title, placeHolder: 'Escolha a pasta da extensão' } },
				{},
			);
			if (!Array.isArray(picked) || !picked.length) return null;
			return { target, folder: found[picked[0]] };
		}
		if (typeof root.uiPrompt !== 'function') return null;
		const answer = await root.uiPrompt(title, found.length ? 'Nenhuma pasta detectada automaticamente; informe o caminho.' : `Nenhum ${manifestApi().FILE_NAME} encontrado. Informe a pasta.`, { placeholder: 'extensoes/minha-extensao', okLabel: 'Continuar' });
		if (answer === null) return null;
		return { target, folder: cleanFolder(answer) };
	}

	function download(blob, name) {
		const url = URL.createObjectURL(blob);
		let started = false;
		try {
			const anchor = document.createElement('a');
			anchor.href = url;
			anchor.download = name;
			anchor.rel = 'noopener';
			document.body.appendChild(anchor);
			anchor.click();
			anchor.remove();
			started = true;
		} catch (error) {}
		if (typeof root.showExportResult === 'function') root.showExportResult(name, url, blob.size, started);
		else setTimeout(() => URL.revokeObjectURL(url), 60000);
	}

	async function buildFromFolder(target, folder) {
		const files = collectFiles(target, folder);
		const manifest = readManifest(files);
		await ensureDocs(target, folder, files, manifest);
		const built = await pkg().build({ manifest, files });
		built.warnings.forEach((warning) => output() && output().warn(manifest.id, warning));
		return built;
	}

	async function packageCommand() {
		const picked = await pickFolder('Empacotar extensão (.sx)');
		if (!picked) return null;
		try {
			const built = await buildFromFolder(picked.target, picked.folder);
			download(built.blob, built.fileName);
			if (output()) output().command(built.manifest.id, `Pacote ${built.fileName}: ${built.fileCount} arquivo(s), ${Math.round(built.bytes.length / 1024)} KB, sha256 ${built.sha256}.`);
			toast('Pacote gerado', `${built.fileName} · SHA-256 ${built.sha256.slice(0, 12)}…${built.warnings.length ? ` · ${built.warnings.length} aviso(s) no console` : ''}`, built.warnings.length ? 'warn' : 'ok');
			return built;
		} catch (error) {
			if (output()) {
				output().error(picked.folder || '(raiz)', error.message);
				output().show();
			}
			toast('Falha ao empacotar', error.message.split('\n')[0], 'err');
			return null;
		}
	}

	function prFilledUrl(cfg, entry) {
		const path = `registry/${entry.publisher}/${entry.name}.json`;
		const value = JSON.stringify(entry, null, 2) + '\n';
		const message = encodeURIComponent(`${entry.id}: publicar v${entry.latest}`);
		const url = `https://github.com/${cfg.owner}/${cfg.repo}/new/${cfg.branch}?filename=${encodeURIComponent(path)}&value=${encodeURIComponent(value)}&message=${message}`;
		return url.length < 7500 ? url : `https://github.com/${cfg.owner}/${cfg.repo}/new/${cfg.branch}?filename=${encodeURIComponent(path)}&message=${message}`;
	}

	async function copy(text) {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch (error) {
			return false;
		}
	}

	async function publishCommand() {
		const picked = await pickFolder('Publicar extensão no registro');
		if (!picked) return null;
		let built;
		try {
			built = await buildFromFolder(picked.target, picked.folder);
		} catch (error) {
			toast('Falha ao preparar publicação', error.message.split('\n')[0], 'err');
			return null;
		}
		const manifest = built.manifest;
		const gh = pkg().githubOwner(manifest.repository);
		if (!gh) {
			toast('Repositório ausente', 'Preencha "repository" no manifesto com a URL pública do GitHub (https://github.com/owner/repo).', 'err');
			return null;
		}
		if (gh.owner !== manifest.publisher) {
			toast('Publisher divergente', `"publisher" deve ser "${gh.owner}" (login do dono do repositório em minúsculas).`, 'err');
			return null;
		}
		const cfg = await market().loadConfig();
		let previous = null;
		try {
			previous = await market().find(manifest.id);
			if (previous && pkg().compareVersions(manifest.version, previous.latest) <= 0) {
				toast('Versão não cresce', `O registro já tem v${previous.latest}; aumente "version" no manifesto.`, 'err');
				return null;
			}
		} catch (error) {}
		const entry = pkg().registryEntry(built, { repository: manifest.repository, previous });
		let signed = null;
		if (root.SynapseExtensionSigning) {
			try {
				signed = await root.SynapseExtensionSigning.signPackage(manifest.publisher, built.bytes);
			} catch (error) {
				toast('Assinatura ignorada', error.message, 'warn');
			}
		}
		if (signed) {
			entry.versions[0].signature = signed.signature;
			entry.versions[0].keyId = signed.keyId;
		}
		const json = JSON.stringify(entry, null, 2) + '\n';
		const registryPath = `registry/${entry.publisher}/${entry.name}.json`;
		writeProjectFile(picked.target, picked.folder ? `${picked.folder}/dist-sx/${entry.name}.registry.json` : `dist-sx/${entry.name}.registry.json`, json);
		download(built.blob, built.fileName);
		const prUrl = prFilledUrl(cfg, entry);
		const copied = await copy(json);
		const steps = [
			`1. Crie a Release "${entry.versions[0].tag}" em ${manifest.repository}/releases/new e anexe ${built.fileName} (baixado agora).${signed ? ` Pacote assinado (ECDSA P-256, keyId ${signed.keyId}).` : ' Sem assinatura: gere uma chave em "Extensões: Gerar chave de assinatura do publisher" para o selo Verificado.'}`,
			`2. Abra o PR no registro: ${prUrl.length < 7500 ? 'link já pré-preenchido' : 'cole o JSON copiado'} em ${registryPath}.`,
			'3. A Action valida hash, semver e publisher; passou, entra automaticamente.',
		];
		if (output()) {
			output().command(manifest.id, `Publicação preparada. SHA-256 ${built.sha256}. ${registryPath} salvo em dist-sx/.`);
			steps.forEach((step) => output().info(manifest.id, step));
			output().show();
		}
		const proceed = typeof root.uiConfirm === 'function' ? await root.uiConfirm('Publicar no registro', `${steps.join('\n')}\n\nJSON do registro ${copied ? 'copiado para a área de transferência' : 'salvo em dist-sx/'}. Abrir o GitHub para criar o arquivo no registro agora?`, 'Abrir GitHub', false) : false;
		if (proceed) root.open(prUrl, '_blank', 'noopener');
		return { built, entry, prUrl, registryPath };
	}

	async function browseRegistry() {
		const query = typeof root.uiPrompt === 'function' ? await root.uiPrompt('Buscar no registro de extensões', 'Palavras-chave, id (publisher.nome) ou vazio para listar tudo.', { placeholder: 'tema, zig, formatador…', okLabel: 'Buscar' }) : '';
		if (query === null) return null;
		let results;
		try {
			results = await market().search(query);
		} catch (error) {
			toast('Registro indisponível', error.message.split('\n')[0], 'err');
			return null;
		}
		if (!results.length) {
			toast('Nada encontrado', query ? `Nenhuma extensão para "${query}".` : 'O registro está vazio.', 'warn');
			return null;
		}
		if (!windowHost()) return results;
		const installedIds = new Set(installer().list().map((item) => item.id));
		const picked = await windowHost().showQuickPick(
			{
				items: results.slice(0, 60).map((entry) => ({
					label: `${entry.displayName || entry.name}${installedIds.has(entry.id) ? ' · instalada' : ''}`,
					description: `${entry.id} v${entry.latest}`,
					detail: [entry.description, (entry.categories || []).join(', ')].filter(Boolean).join(' — '),
				})),
				options: { title: 'Registro de extensões', placeHolder: 'Escolha uma extensão para instalar', matchOnDescription: true },
			},
			{},
		);
		if (!Array.isArray(picked) || !picked.length) return null;
		const entry = results[picked[0]];
		try {
			return await installer().installFromRegistry(entry.id);
		} catch (error) {
			toast('Falha ao instalar', error.message.split('\n')[0], 'err');
			return null;
		}
	}

	async function installFromReferenceCommand() {
		if (typeof root.uiPrompt !== 'function') return null;
		const answer = await root.uiPrompt('Instalar extensão', 'URL de um .sx, "owner/repo@tag" ou "publisher.nome[@versão]" do registro.', { placeholder: 'ana/hello-world@v1.0.0', okLabel: 'Instalar' });
		if (!answer || !answer.trim()) return null;
		try {
			return await installer().installFromReference(answer.trim());
		} catch (error) {
			if (output()) output().error('instalador', error.message);
			toast('Falha ao instalar', error.message.split('\n')[0], 'err');
			return null;
		}
	}

	async function installFromFileCommand() {
		try {
			return await installer().installFromFile();
		} catch (error) {
			if (output()) output().error('instalador', error.message);
			toast('Falha ao instalar', error.message.split('\n')[0], 'err');
			return null;
		}
	}

	async function pickInstalled(title, filter) {
		const items = installer().list().filter(filter || (() => true));
		if (!items.length || !windowHost()) return null;
		const picked = await windowHost().showQuickPick(
			{ items: items.map((item) => ({ label: item.name, description: `${item.id} v${item.version}`, detail: item.previousVersion ? `versão anterior guardada: v${item.previousVersion}` : '' })), options: { title, placeHolder: 'Escolha a extensão' } },
			{},
		);
		if (!Array.isArray(picked) || !picked.length) return null;
		return items[picked[0]];
	}

	async function uninstallCommand() {
		const item = await pickInstalled('Desinstalar extensão');
		if (item) await installer().uninstall(item.id);
	}

	async function rollbackCommand() {
		const item = await pickInstalled('Reverter para a versão anterior', (entry) => entry.canRollback);
		if (!item) return;
		try {
			await installer().rollback(item.id);
		} catch (error) {
			toast('Reversão falhou', error.message, 'err');
		}
	}

	async function configureRegistryCommand() {
		if (typeof root.uiPrompt !== 'function') return;
		const cfg = await market().loadConfig();
		const answer = await root.uiPrompt('Registro remoto de extensões', `Repositório GitHub que publica index.json (atual: ${cfg.owner}/${cfg.repo}@${cfg.branch}). O registro local da IDE continua ativo e é mesclado com o remoto.`, { placeholder: 'owner/synapse-extensions@main', okLabel: 'Salvar' });
		if (!answer || !answer.trim()) return;
		const match = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:@([A-Za-z0-9_.\/-]+))?$/.exec(answer.trim());
		if (!match) {
			toast('Formato inválido', 'Use owner/repo ou owner/repo@branch.', 'err');
			return;
		}
		await market().configure({ owner: match[1], repo: match[2], branch: match[3] || 'main' });
		toast('Registro configurado', `${match[1]}/${match[2]}@${match[3] || 'main'}`, 'ok');
		market().fetchIndex({ force: true }).catch((error) => toast('Registro inacessível', error.message.split('\n')[0], 'warn'));
	}

	async function toggleMarketplaceCommand() {
		const cfg = await market().loadConfig();
		const next = cfg.enabled === false;
		await market().setEnabled(next);
		toast(next ? 'Marketplace ativado' : 'Marketplace desativado', next ? 'A view de Extensões volta a listar o registro.' : 'A view de Extensões mostra só as extensões instaladas.', next ? 'ok' : 'warn');
		if (next) market().fetchIndex({ force: true }).catch((error) => toast('Registro inacessível', error.message.split('\n')[0], 'warn'));
	}

	function marketplaceEnabled() {
		return !market() || typeof market().isEnabled !== 'function' || market().isEnabled();
	}

	function hasProject() {
		return !!project();
	}

	function hasInstalled() {
		return installer().list().length > 0;
	}

	function hasRollback() {
		return installer().list().some((item) => item.canRollback);
	}

	function hasUpdates() {
		return installer().updates().length > 0;
	}

	const commands = [
		{ id: 'ext-package', label: 'Extensões: Empacotar (.sx)', hint: 'extensão empacotar pacote zip sx publicar', icon: 'folderOpen', on: hasProject, run: packageCommand },
		{ id: 'ext-publish', label: 'Extensões: Publicar…', hint: 'extensão publicar registro release pr github', icon: 'command', on: hasProject, run: publishCommand },
		{ id: 'ext-browse', label: 'Extensões: Buscar no registro…', hint: 'extensão marketplace registro instalar buscar', icon: 'info', on: () => true, run: browseRegistry },
		{ id: 'ext-install-ref', label: 'Extensões: Instalar de URL ou owner/repo@tag', hint: 'extensão instalar url github release sx', icon: 'command', on: () => true, run: installFromReferenceCommand },
		{ id: 'ext-install-file', label: 'Extensões: Instalar de arquivo .sx', hint: 'extensão instalar arquivo local sx', icon: 'folderOpen', on: () => true, run: installFromFileCommand },
		{ id: 'ext-check-updates', label: () => `Extensões: Verificar atualizações${hasUpdates() ? ` (${installer().updates().length} disponível)` : ''}`, hint: 'extensão atualizar update verificar', icon: 'reload', on: hasInstalled, run: () => installer().checkUpdates({ force: true }).catch((error) => toast('Registro indisponível', error.message.split('\n')[0], 'warn')) },
		{ id: 'ext-update-all', label: 'Extensões: Atualizar todas', hint: 'extensão atualizar todas lote', icon: 'reload', on: hasUpdates, run: () => installer().updateAll() },
		{ id: 'ext-rollback', label: 'Extensões: Reverter versão…', hint: 'extensão reverter rollback versão anterior', icon: 'undo', on: hasRollback, run: rollbackCommand },
		{ id: 'ext-uninstall', label: 'Extensões: Desinstalar…', hint: 'extensão desinstalar remover', icon: 'trash', on: hasInstalled, run: uninstallCommand },
		{ id: 'ext-registry-config', label: 'Extensões: Configurar registro remoto…', hint: 'extensão registro fonte github pages jsdelivr marketplace', icon: 'settings', on: () => true, run: configureRegistryCommand },
		{ id: 'ext-market-toggle', label: () => (marketplaceEnabled() ? 'Extensões: Desativar marketplace' : 'Extensões: Ativar marketplace'), hint: 'extensão marketplace loja registro ativar desativar', icon: 'settings', on: () => true, run: toggleMarketplaceCommand },
	];

	commands.forEach((command) => {
		registry().registerPaletteCommand(() => ({
			id: command.id,
			label: typeof command.label === 'function' ? command.label() : command.label,
			hint: command.hint,
			icon: command.icon,
			on: command.on(),
			run: command.run,
		}));
	});

	root.SynapseExtensionPublisher = Object.freeze({
		collectFiles,
		buildFromFolder,
		packageCommand,
		publishCommand,
		browseRegistry,
		installFromReferenceCommand,
		installFromFileCommand,
		uninstallCommand,
		rollbackCommand,
		configureRegistryCommand,
		readmeTemplate,
		changelogTemplate,
		prFilledUrl,
	});
})(window);
