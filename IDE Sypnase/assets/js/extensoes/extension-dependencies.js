(function (root) {
	'use strict';

	const MAX_CHAIN = 32;
	const MAX_DEPTH = 6;

	function registry() {
		return root.SynapseExtensions;
	}

	function installer() {
		return root.SynapseExtensionInstaller;
	}

	function market() {
		return root.SynapseExtensionMarketplace;
	}

	function output() {
		return root.SynapseExtensionOutput;
	}

	function toast(title, message, kind) {
		if (typeof root.toast === 'function') root.toast(title, message, kind || 'ok');
	}

	function unique(list) {
		return [...new Set((Array.isArray(list) ? list : []).map((entry) => String(entry || '').trim()).filter(Boolean))];
	}

	function dependenciesOf(manifest) {
		return unique(manifest && manifest.extensionDependencies);
	}

	function packOf(manifest) {
		return unique(manifest && manifest.extensionPack);
	}

	function isPack(manifest) {
		return packOf(manifest).length > 0;
	}

	function installedIds() {
		const api = registry();
		if (!api) return new Set();
		if (typeof api.ids === 'function') return new Set(api.ids());
		return new Set(api.list().map((item) => item.id));
	}

	function missing(manifest) {
		const present = installedIds();
		const dependencies = dependenciesOf(manifest).filter((id) => !present.has(id));
		const pack = packOf(manifest).filter((id) => !present.has(id));
		return { dependencies, pack, all: unique(dependencies.concat(pack)) };
	}

	async function planChain(manifest, seen, depth) {
		const plan = [];
		const wanted = missing(manifest);
		for (const id of wanted.all) {
			if (seen.has(id) || plan.length >= MAX_CHAIN) continue;
			seen.add(id);
			const entry = market() ? await market().find(id) : null;
			const required = wanted.dependencies.includes(id);
			if (!entry) {
				plan.push({ id, required, entry: null, error: `"${id}" não está no registro.` });
				continue;
			}
			plan.push({ id, required, entry, error: null });
			if (depth < MAX_DEPTH) {
				const info = market().versionOf(entry);
				const nested = info && info.manifest ? await planChain(info.manifest, seen, depth + 1) : [];
				nested.forEach((step) => plan.push(step));
			}
		}
		return plan;
	}

	function describePlan(manifest, plan) {
		const lines = plan.map((step) => `• ${step.entry ? step.entry.displayName || step.entry.name || step.id : step.id}${step.required ? ' (dependência)' : ' (pack)'}${step.error ? ` — ${step.error}` : ''}`);
		return `"${manifest.name}" ${isPack(manifest) ? 'é um pack e instala' : 'depende de'} ${plan.length} extensão(ões):\n\n${lines.join('\n')}`;
	}

	async function confirmChain(manifest, plan) {
		if (!plan.length) return true;
		if (typeof root.uiConfirm !== 'function') return true;
		return root.uiConfirm(isPack(manifest) ? 'Instalar pack de extensões' : 'Instalar dependências', describePlan(manifest, plan) + '\n\nCada uma será verificada (hash, blocklist e assinatura) antes de entrar.', 'Instalar tudo', false);
	}

	async function installChain(manifest, context) {
		context = context || {};
		if (!installer() || !market()) return { installed: [], failed: [], skipped: true };
		const plan = await planChain(manifest, new Set([manifest.id]), 0);
		if (!plan.length) return { installed: [], failed: [], skipped: false };
		const approved = context.silent ? true : await confirmChain(manifest, plan);
		if (!approved) {
			const requiredMissing = plan.filter((step) => step.required);
			if (requiredMissing.length) throw new Error(`${manifest.name} precisa de ${requiredMissing.map((step) => step.id).join(', ')} para funcionar.`);
			return { installed: [], failed: [], skipped: true };
		}
		const installed = [];
		const failed = [];
		for (const step of plan) {
			if (step.error) {
				failed.push({ id: step.id, error: step.error, required: step.required });
				continue;
			}
			try {
				const record = await installer().installFromRegistry(step.id, undefined, { silent: true, origin: `pack:${manifest.id}`, chained: true });
				if (record) installed.push(step.id);
			} catch (error) {
				failed.push({ id: step.id, error: error && error.message ? error.message : String(error), required: step.required });
			}
		}
		if (output()) {
			if (installed.length) output().command(manifest.id, `Cadeia instalada: ${installed.join(', ')}.`);
			failed.forEach((entry) => output().warn(manifest.id, `Falha ao instalar ${entry.id}: ${entry.error}`));
		}
		const requiredFailures = failed.filter((entry) => entry.required);
		if (requiredFailures.length) toast('Dependências pendentes', `${manifest.name}: ${requiredFailures.map((entry) => entry.id).join(', ')}`, 'warn');
		else if (installed.length && !context.silent) toast(isPack(manifest) ? 'Pack instalado' : 'Dependências instaladas', `${installed.length} extensão(ões) adicionadas por ${manifest.name}`, 'ok');
		return { installed, failed, skipped: false };
	}

	function unmetDependencies(manifest) {
		return missing(manifest).dependencies;
	}

	async function activateDependencies(manifest, reason) {
		if (!registry()) return [];
		const activated = [];
		for (const id of dependenciesOf(manifest)) {
			const item = registry().get(id);
			if (!item) throw new Error(`Dependência "${id}" não está instalada.`);
			if (item.status === 'active') continue;
			if (!item.enabled) throw new Error(`Dependência "${id}" está desabilitada.`);
			await registry().activate(id, reason ? `dependency:${reason}` : 'dependency');
			activated.push(id);
		}
		return activated;
	}

	function dependentsOf(id) {
		if (!registry()) return [];
		return registry()
			.list()
			.filter((item) => {
				const manifest = registry().manifestOf(item.id);
				return manifest && dependenciesOf(manifest).includes(id);
			})
			.map((item) => item.id);
	}

	function packsContaining(id) {
		if (!registry()) return [];
		return registry()
			.list()
			.filter((item) => {
				const manifest = registry().manifestOf(item.id);
				return manifest && packOf(manifest).includes(id);
			})
			.map((item) => item.id);
	}

	function membersOf(id) {
		const manifest = registry() ? registry().manifestOf(id) : null;
		return manifest ? packOf(manifest) : [];
	}

	root.SynapseExtensionDependencies = Object.freeze({
		dependenciesOf,
		packOf,
		isPack,
		missing,
		unmetDependencies,
		installChain,
		activateDependencies,
		dependentsOf,
		packsContaining,
		membersOf,
	});
})(window);
