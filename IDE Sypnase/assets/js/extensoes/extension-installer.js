(function (root) {
	'use strict';

	const KEY_PREFIX = 'ext-installed:';
	const SOURCE = 'installed';
	const STARTUP_DELAY_MS = 1200;
	const UPDATE_CHECK_DELAY_MS = 20000;

	const installed = new Map();
	const updateListeners = new Set();
	let pendingUpdates = [];
	let restored = null;

	function pkg() {
		return root.SynapseExtensionPackage;
	}

	function market() {
		return root.SynapseExtensionMarketplace;
	}

	function registry() {
		return root.SynapseExtensions;
	}

	function output() {
		return root.SynapseExtensionOutput;
	}

	function permissions() {
		return root.SynapseExtensionPermissions;
	}

	function signing() {
		return root.SynapseExtensionSigning;
	}

	function trust() {
		return root.SynapseWorkspaceTrust;
	}

	function audit() {
		return root.SynapseExtensionAudit;
	}

	function compat() {
		return root.SynapseExtensionCompat;
	}

	function dependencies() {
		return root.SynapseExtensionDependencies;
	}

	function blockMessage(manifest, blocked) {
		return `Instalação recusada: "${manifest.name}" v${manifest.version} está na lista de bloqueio do registro${blocked.reason ? ` (${blocked.reason})` : ''}.${blocked.url ? ` Detalhes: ${blocked.url}` : ''}`;
	}

	async function verifySignature(manifest, read, context) {
		const result = { verified: false, present: !!context.expectedSignature, publisherHasKey: false, warning: null };
		if (!signing() || !market() || typeof market().fetchPublisherKey !== 'function') return result;
		let key = null;
		try {
			key = await market().fetchPublisherKey(manifest.publisher);
		} catch (error) {
			if (result.present) throw new Error(`Não foi possível obter a chave pública de "${manifest.publisher}" para verificar a assinatura: ${error.message}. Instalação recusada.`);
			result.warning = `Chave do publicador indisponível (${error.message}); pacote tratado como não assinado.`;
			return result;
		}
		result.publisherHasKey = !!key;
		if (!result.present) {
			if (key) result.warning = `O publicador "${manifest.publisher}" tem chave de assinatura registrada, mas esta versão não está assinada.`;
			return result;
		}
		if (!key) throw new Error(`A versão declara assinatura, mas "${manifest.publisher}" não tem publisher.json no registro. Instalação recusada.`);
		if (key.revokedKeyIds && context.keyId && key.revokedKeyIds.includes(String(context.keyId))) throw new Error(`Assinatura feita com a chave revogada ${context.keyId}. Instalação recusada.`);
		if (context.keyId && key.keyId && String(context.keyId) !== String(key.keyId)) throw new Error(`Assinatura usa keyId ${context.keyId}, mas o registro publica ${key.keyId}. Instalação recusada.`);
		const ok = await signing().verify(read.bytes, context.expectedSignature, key.publicKey);
		if (!ok) {
			if (audit()) audit().security(manifest.id, 'signature.invalid', `Assinatura inválida em ${manifest.id}@${manifest.version}`, { severity: 'error', code: 'signature' });
			throw new Error(`Assinatura inválida para ${manifest.name} v${manifest.version}: o pacote não foi assinado pelo publicador "${manifest.publisher}". Instalação recusada.`);
		}
		result.verified = true;
		return result;
	}

	function toast(title, message, kind) {
		if (typeof root.toast === 'function') root.toast(title, message, kind || 'ok');
	}

	function kvGet(key) {
		return typeof root.sdbGet === 'function' ? root.sdbGet(key) : Promise.resolve(null);
	}

	function kvPut(key, value) {
		return typeof root.sdbPut === 'function' ? root.sdbPut(key, value) : Promise.resolve(false);
	}

	function kvDel(key) {
		return typeof root.sdbDel === 'function' ? root.sdbDel(key) : Promise.resolve(false);
	}

	function kvKeys() {
		return typeof root.sdbKeys === 'function' ? root.sdbKeys() : Promise.resolve([]);
	}

	function recordKey(id) {
		return KEY_PREFIX + id;
	}

	function describePermissions(manifest) {
		const list = Array.isArray(manifest.permissions) ? manifest.permissions : [];
		if (!list.length) return 'Não pede permissões além do básico (comandos, notificações, configurações).';
		return list.map((permission) => `• ${permissions() && typeof permissions().describe === 'function' ? permissions().describe(permission) : permission}`).join('\n');
	}

	async function confirmInstall(manifest, context) {
		const current = installed.get(manifest.id);
		if (root.SynapseExtensionPermissionsDialog) {
			return root.SynapseExtensionPermissionsDialog.confirm(manifest, {
				currentVersion: current ? current.version : null,
				origin: context.url || (context.origin ? String(context.origin).replace(/^Origem:\s*/, '') : 'arquivo local'),
				hashVerified: !!context.hashVerified,
				signatureVerified: !!context.signatureVerified,
				publisher: manifest.publisher,
				warnings: context.warnings || [],
			});
		}
		if (typeof root.uiConfirm !== 'function') return true;
		const heading = current ? `Atualizar de v${current.version} para v${manifest.version}` : `Instalar v${manifest.version}`;
		const origin = context.url ? `Origem: ${context.url}` : context.origin || 'Origem: arquivo local';
		const hash = context.hashVerified ? 'SHA-256 verificado contra o registro.' : 'SHA-256 calculado localmente (sem referência no registro).';
		const warnings = context.warnings && context.warnings.length ? '\n\nAvisos:\n' + context.warnings.map((warning) => `• ${warning}`).join('\n') : '';
		const message = `${heading} de "${manifest.name}" (${manifest.id}) por ${manifest.publisher}.\n\n${origin}\n${hash}\n\nPermissões solicitadas:\n${describePermissions(manifest)}${warnings}`;
		return root.uiConfirm(current ? 'Atualizar extensão' : 'Instalar extensão', message, current ? 'Atualizar' : 'Instalar', false);
	}

	function packageFiles(read) {
		const files = new Map();
		read.files.forEach((value, path) => files.set(path, value));
		return files;
	}

	async function registerRecord(record, read) {
		const files = read ? packageFiles(read) : packageFiles(await pkg().read(record.bytes));
		return registry().register({ manifest: record.manifest, files, source: SOURCE, folder: '', blocked: record.blocked || null });
	}

	async function persist(record) {
		installed.set(record.id, record);
		await kvPut(recordKey(record.id), record);
	}

	async function installFromBytes(bytes, context) {
		context = context || {};
		const read = await pkg().read(bytes);
		const manifest = read.manifest;
		if (context.expectedSha256 && context.expectedSha256.toLowerCase() !== read.sha256) {
			throw new Error(`Hash divergente para ${manifest.id}: esperado ${context.expectedSha256.slice(0, 12)}…, obtido ${read.sha256.slice(0, 12)}…. Download recusado.`);
		}
		const engine = pkg().engineProblem(manifest);
		if (engine) throw new Error(`${manifest.name}: ${engine}`);
		const blocked = market() && typeof market().isBlocked === 'function' ? await market().isBlocked(manifest.id, manifest.version, read.sha256) : null;
		if (blocked) {
			if (audit()) audit().security(manifest.id, 'blocklist.install', blockMessage(manifest, blocked), { severity: 'error', code: 'blocklist' });
			throw new Error(blockMessage(manifest, blocked));
		}
		const signature = await verifySignature(manifest, read, context);
		const current = installed.get(manifest.id);
		if (current && current.version === manifest.version && current.sha256 === read.sha256 && !context.force) {
			toast('Já instalada', `${manifest.name} v${manifest.version} já está instalada.`, 'warn');
			return current;
		}
		const warnings = [...read.report.warnings];
		if (signature.warning) warnings.push(signature.warning);
		const support = compat() ? compat().supportProblem(manifest) : null;
		if (support) warnings.push(support);
		if (dependencies()) {
			const wanted = dependencies().missing(manifest);
			if (wanted.dependencies.length) warnings.push(`Depende de: ${wanted.dependencies.join(', ')} (serão instaladas em seguida).`);
			if (wanted.pack.length) warnings.push(`Pack com ${wanted.pack.length} extensão(ões): ${wanted.pack.join(', ')}.`);
		}
		if (trust()) {
			const verdict = trust().allowsExtension(manifest, undefined, SOURCE);
			if (!verdict.allowed) warnings.push('O projeto ativo está restrito: a extensão será instalada, mas só ativada quando o projeto for marcado como confiável.');
		}
		if (!context.silent) {
			const approved = await confirmInstall(manifest, { ...context, warnings, hashVerified: !!context.expectedSha256, signatureVerified: signature.verified });
			if (!approved) return null;
		}
		const record = {
			id: manifest.id,
			version: manifest.version,
			manifest,
			sha256: read.sha256,
			bytes: read.bytes,
			size: read.bytes.length,
			url: context.url || null,
			installedAt: Date.now(),
			signed: signature.verified,
			keyId: signature.verified && context.keyId ? String(context.keyId) : null,
			previous: current ? { version: current.version, sha256: current.sha256, bytes: current.bytes, url: current.url, installedAt: current.installedAt } : current && current.previous ? current.previous : null,
		};
		const result = await registerRecord(record, read);
		await persist(record);
		pendingUpdates = pendingUpdates.filter((update) => update.id !== record.id);
		emitUpdates();
		if (output()) output().command(record.id, `Instalada v${record.version} (${Math.round(record.size / 1024)} KB, sha256 ${record.sha256.slice(0, 12)}…${record.signed ? ', assinatura verificada' : ''}).`);
		if (!context.silent) toast(current ? 'Extensão atualizada' : 'Extensão instalada', `${manifest.name} v${manifest.version} — ${result.status}`, 'ok');
		if (current && result && result.status !== 'active') root.dispatchEvent(new CustomEvent('synapse:extension-reload-required', { detail: { id: record.id, reason: `${manifest.name} v${manifest.version}` } }));
		if (dependencies() && !context.chained) {
			try {
				await dependencies().installChain(manifest, { silent: !!context.silent });
			} catch (error) {
				if (output()) output().warn(record.id, error && error.message ? error.message : String(error));
			}
		}
		return record;
	}

	async function installFromUrl(url, context) {
		const { bytes, url: used } = await market().downloadBytes([url]);
		return installFromBytes(bytes, { ...(context || {}), url: used });
	}

	async function installFromGitHub(owner, repo, tag, context) {
		const urls = await market().releaseAssets(owner, repo, tag);
		const { bytes, url } = await market().downloadBytes(urls);
		return installFromBytes(bytes, { ...(context || {}), url, origin: `Origem: github.com/${owner}/${repo}@${tag}` });
	}

	async function installFromRegistry(id, version, context) {
		const entry = await market().find(id);
		if (!entry) throw new Error(`"${id}" não está no registro.`);
		const info = market().versionOf(entry, version);
		if (!info) throw new Error(`Versão ${version} de ${id} não existe no registro.`);
		const urls = market().downloadUrls(entry, info);
		if (!urls.length) throw new Error(`Registro sem URL de download para ${id}.`);
		const { bytes, url } = await market().downloadBytes(urls);
		return installFromBytes(bytes, { ...(context || {}), url, expectedSha256: info.sha256, expectedSignature: info.signature || null, keyId: info.keyId || null });
	}

	async function installFromReference(text, context) {
		const reference = market().parseReference(text);
		if (!reference) throw new Error('Informe uma URL de .sx, "owner/repo@tag" ou "publisher.nome[@versão]".');
		if (reference.type === 'url') return installFromUrl(reference.url, context);
		if (reference.type === 'github') return installFromGitHub(reference.owner, reference.repo, reference.tag, context);
		return installFromRegistry(reference.id, reference.version, context);
	}

	function pickLocalFile() {
		return new Promise((resolve) => {
			const input = document.createElement('input');
			input.type = 'file';
			input.accept = '.sx,application/zip';
			input.style.display = 'none';
			input.addEventListener('change', async () => {
				const file = input.files && input.files[0];
				input.remove();
				if (!file) return resolve(null);
				resolve({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
			});
			input.addEventListener('cancel', () => {
				input.remove();
				resolve(null);
			});
			document.body.appendChild(input);
			input.click();
		});
	}

	async function installFromFile() {
		const picked = await pickLocalFile();
		if (!picked) return null;
		return installFromBytes(picked.bytes, { origin: `Origem: arquivo local ${picked.name}` });
	}

	async function uninstall(id, options) {
		const record = installed.get(id);
		if (!record) return false;
		if (!(options && options.silent) && typeof root.uiConfirm === 'function') {
			const dependents = dependencies() ? dependencies().dependentsOf(id) : [];
			const warning = dependents.length ? `\n\nAtenção: ${dependents.join(', ')} depende(m) dela e deixará(ão) de ativar.` : '';
			const ok = await root.uiConfirm('Desinstalar extensão', `Remover "${record.manifest.name}" v${record.version}? O estado salvo pela extensão é mantido.${warning}`, 'Desinstalar', true);
			if (!ok) return false;
		}
		await registry().unregister(id);
		installed.delete(id);
		await kvDel(recordKey(id));
		pendingUpdates = pendingUpdates.filter((update) => update.id !== id);
		emitUpdates();
		if (!(options && options.silent)) toast('Extensão removida', record.manifest.name, 'ok');
		return true;
	}

	async function rollback(id) {
		const record = installed.get(id);
		if (!record || !record.previous || !record.previous.bytes) throw new Error('Não há versão anterior guardada para reverter.');
		const previous = record.previous;
		const read = await pkg().read(previous.bytes);
		if (read.sha256 !== previous.sha256) throw new Error('Pacote anterior corrompido no cache; reversão cancelada.');
		const next = {
			id,
			version: read.manifest.version,
			manifest: read.manifest,
			sha256: read.sha256,
			bytes: read.bytes,
			size: read.bytes.length,
			url: previous.url || null,
			installedAt: Date.now(),
			previous: { version: record.version, sha256: record.sha256, bytes: record.bytes, url: record.url, installedAt: record.installedAt },
		};
		await registerRecord(next, read);
		await persist(next);
		toast('Versão revertida', `${next.manifest.name} voltou para v${next.version}.`, 'ok');
		return next;
	}

	async function restoreAll() {
		if (restored) return restored;
		restored = (async () => {
			const keys = (await kvKeys().catch(() => [])).filter((key) => typeof key === 'string' && key.startsWith(KEY_PREFIX));
			let count = 0;
			for (const key of keys) {
				const record = await kvGet(key).catch(() => null);
				if (!record || !record.manifest || !(record.bytes instanceof Uint8Array || (record.bytes && record.bytes.byteLength))) continue;
				try {
					record.bytes = record.bytes instanceof Uint8Array ? record.bytes : new Uint8Array(record.bytes);
					const read = await pkg().read(record.bytes);
					if (read.sha256 !== record.sha256) throw new Error('hash do cache não confere');
					installed.set(record.id, record);
					await registerRecord(record, read);
					count++;
				} catch (error) {
					if (output()) output().error(record.id || key, `Falha ao restaurar extensão instalada: ${error.message}`);
				}
			}
			if (count && output()) output().info('host', `${count} extensão(ões) instalada(s) restaurada(s) do cache offline.`);
			await applyBlocklist().catch(() => {});
			return count;
		})();
		return restored;
	}

	async function applyBlocklist(blocklist) {
		if (!market() || typeof market().readBlocklistCache !== 'function' || !registry() || typeof registry().setBlocked !== 'function') return 0;
		const list = blocklist || (await market().readBlocklistCache());
		let changed = 0;
		for (const record of installed.values()) {
			const entry = market().blockedIn(list, record.id, record.version, record.sha256);
			const wasBlocked = !!record.blocked;
			record.blocked = entry ? { reason: entry.reason, url: entry.url, at: Date.now() } : null;
			const flipped = registry().setBlocked(record.id, record.blocked);
			if (flipped || wasBlocked !== !!entry) {
				changed++;
				await kvPut(recordKey(record.id), record);
				if (entry) {
					toast('Extensão bloqueada pelo registro', `${record.manifest.name} v${record.version} foi desativada${entry.reason ? ': ' + entry.reason : '.'}`, 'err');
					if (output()) output().error(record.id, `Bloqueada pelo registro${entry.reason ? ': ' + entry.reason : ''}${entry.url ? ` (${entry.url})` : ''}. A extensão fica desativada até ser removida da lista ou desinstalada.`);
				} else if (output()) output().command(record.id, 'Removida da lista de bloqueio; pode ser ativada novamente.');
			}
		}
		return changed;
	}

	function emitUpdates() {
		document.documentElement.dataset.extUpdates = pendingUpdates.length ? String(pendingUpdates.length) : '';
		updateListeners.forEach((listener) => {
			try {
				listener(pendingUpdates.slice());
			} catch (error) {}
		});
	}

	async function checkUpdates(options) {
		options = options || {};
		if (!installed.size) {
			pendingUpdates = [];
			emitUpdates();
			return [];
		}
		const index = await market().fetchIndex({ force: !!options.force });
		const blocklist = typeof market().readBlocklistCache === 'function' ? await market().readBlocklistCache() : null;
		const updates = [];
		installed.forEach((record) => {
			const entry = index.extensions.find((item) => item.id === record.id);
			if (!entry) return;
			const candidates = entry.versions.filter((version) => pkg().compareVersions(version.version, record.version) > 0 && !pkg().engineProblem({ engines: version.engines }) && !(blocklist && market().blockedIn(blocklist, record.id, version.version, version.sha256)));
			if (!candidates.length) return;
			const target = candidates.sort((a, b) => pkg().compareVersions(b.version, a.version))[0];
			updates.push({ id: record.id, name: record.manifest.name, from: record.version, to: target.version, entry, version: target });
		});
		pendingUpdates = updates;
		emitUpdates();
		if (!options.silent) {
			if (updates.length) toast('Atualizações disponíveis', updates.map((update) => `${update.name} ${update.from} → ${update.to}`).join(', '), 'ok');
			else toast('Tudo atualizado', 'Nenhuma atualização para as extensões instaladas.', 'ok');
		}
		return updates;
	}

	async function updateAll() {
		const updates = pendingUpdates.length ? pendingUpdates : await checkUpdates({ silent: true });
		if (!updates.length) {
			toast('Tudo atualizado', 'Nenhuma atualização pendente.', 'ok');
			return 0;
		}
		let done = 0;
		for (const update of updates) {
			try {
				const urls = market().downloadUrls(update.entry, update.version);
				const { bytes, url } = await market().downloadBytes(urls);
				const record = await installFromBytes(bytes, { url, expectedSha256: update.version.sha256, expectedSignature: update.version.signature || null, keyId: update.version.keyId || null, silent: true });
				if (record) done++;
			} catch (error) {
				if (output()) output().error(update.id, `Atualização falhou: ${error.message}`);
			}
		}
		toast('Atualização em lote', `${done} de ${updates.length} extensão(ões) atualizada(s).`, done === updates.length ? 'ok' : 'warn');
		return done;
	}

	function list() {
		return [...installed.values()].map((record) => ({
			id: record.id,
			name: record.manifest.name,
			version: record.version,
			publisher: record.manifest.publisher,
			sha256: record.sha256,
			size: record.size,
			url: record.url,
			installedAt: record.installedAt,
			signed: !!record.signed,
			keyId: record.keyId || null,
			blocked: record.blocked ? { ...record.blocked } : null,
			canRollback: !!(record.previous && record.previous.bytes),
			previousVersion: record.previous ? record.previous.version : null,
		}));
	}

	function get(id) {
		return installed.get(id) || null;
	}

	function onDidChangeUpdates(listener) {
		updateListeners.add(listener);
		return () => updateListeners.delete(listener);
	}

	function updates() {
		return pendingUpdates.slice();
	}

	function bootstrap() {
		const start = () => {
			restoreAll()
				.then(() => {
					if (typeof registry().notifyStartupFinished === 'function' && installed.size) registry().notifyStartupFinished();
				})
				.catch(() => {});
			setTimeout(() => {
				if (navigator.onLine === false || !installed.size) return;
				checkUpdates({ silent: true }).catch(() => {});
			}, UPDATE_CHECK_DELAY_MS);
			market().schedulePeriodicRefresh(() => checkUpdates({ silent: true }).catch(() => {}));
			if (typeof market().onDidUpdateBlocklist === 'function') market().onDidUpdateBlocklist((blocklist) => applyBlocklist(blocklist).catch(() => {}));
			setTimeout(() => {
				if (navigator.onLine === false) return;
				market().fetchBlocklist({ force: true }).then((blocklist) => applyBlocklist(blocklist)).catch(() => {});
			}, UPDATE_CHECK_DELAY_MS / 2);
		};
		if (document.readyState === 'complete') setTimeout(start, STARTUP_DELAY_MS);
		else root.addEventListener('load', () => setTimeout(start, STARTUP_DELAY_MS), { once: true });
	}

	bootstrap();

	root.SynapseExtensionInstaller = Object.freeze({
		SOURCE,
		installFromBytes,
		installFromUrl,
		installFromGitHub,
		installFromRegistry,
		installFromReference,
		installFromFile,
		uninstall,
		rollback,
		restoreAll,
		checkUpdates,
		updateAll,
		updates,
		onDidChangeUpdates,
		applyBlocklist,
		list,
		get,
	});
})(window);
