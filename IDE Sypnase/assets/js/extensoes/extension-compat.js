(function (root) {
	'use strict';

	const API_VERSION = '2.5.0';
	const SUPPORTED_MAJORS = 2;
	const CHANGELOG_PATH = 'assets/extensoes/api-changelog.md';
	if (!root.SYNAPSE_VERSION) root.SYNAPSE_VERSION = API_VERSION;

	const deprecations = new Map();
	const listeners = new Set();

	function pkg() {
		return root.SynapseExtensionPackage;
	}

	function output() {
		return root.SynapseExtensionOutput;
	}

	function major(version) {
		const match = /^\s*[\^~>=<\s]*v?(\d+)/.exec(String(version || ''));
		return match ? Number(match[1]) : null;
	}

	function apiMajor() {
		return Number(API_VERSION.split('.')[0]);
	}

	function minimumMajorOf(range) {
		const text = String(range || '').trim();
		if (!text || text === '*' || text === 'x') return null;
		const majors = text
			.split('||')
			.map((group) => group.trim().split(/\s+/)[0])
			.map(major)
			.filter((value) => typeof value === 'number' && !Number.isNaN(value));
		return majors.length ? Math.min(...majors) : null;
	}

	function supportProblem(manifest) {
		const range = manifest && manifest.engines && manifest.engines.synapse;
		if (!range) return null;
		const minimum = minimumMajorOf(range);
		if (minimum === null) return null;
		const current = apiMajor();
		if (minimum > current) return `Foi feita para uma API futura (engines.synapse "${range}"); esta IDE expõe a API ${API_VERSION}.`;
		if (current - minimum >= SUPPORTED_MAJORS) {
			return `Depende da API ${minimum}.x, fora da janela de suporte (esta IDE mantém as ${SUPPORTED_MAJORS} versões maiores mais recentes: ${current}.x e ${current - 1}.x). Ela pode funcionar, mas sem garantias.`;
		}
		return null;
	}

	function engineProblem(manifest) {
		return pkg() && typeof pkg().engineProblem === 'function' ? pkg().engineProblem(manifest) : null;
	}

	function emit() {
		listeners.forEach((listener) => {
			try {
				listener(list());
			} catch (error) {}
		});
	}

	function record(extensionId, params) {
		const api = String((params && params.api) || '').trim();
		if (!api) return;
		const bucket = deprecations.get(extensionId) || new Map();
		if (!bucket.has(api)) {
			bucket.set(api, {
				api,
				replacement: params && params.replacement ? String(params.replacement) : '',
				since: params && params.since ? String(params.since) : '',
				count: 0,
				firstAt: Date.now(),
			});
			const entry = bucket.get(api);
			const hint = entry.replacement ? ` Use ${entry.replacement}.` : '';
			if (output()) output().warn(extensionId, `API obsoleta: ${api}${entry.since ? ` (desde ${entry.since})` : ''}.${hint} Veja ${CHANGELOG_PATH}.`);
		}
		bucket.get(api).count += 1;
		deprecations.set(extensionId, bucket);
		emit();
	}

	function listFor(extensionId) {
		const bucket = deprecations.get(extensionId);
		return bucket ? [...bucket.values()].map((entry) => ({ ...entry })) : [];
	}

	function list() {
		const result = [];
		deprecations.forEach((bucket, extensionId) => {
			bucket.forEach((entry) => result.push({ extensionId, ...entry }));
		});
		return result;
	}

	function clear(extensionId) {
		if (extensionId) deprecations.delete(extensionId);
		else deprecations.clear();
		emit();
	}

	function onDidChange(listener) {
		listeners.add(listener);
		return () => listeners.delete(listener);
	}

	const handlers = Object.freeze({
		'api.deprecated': (params, context) => {
			record(context.descriptor.id, params);
			return null;
		},
	});

	root.SynapseExtensionCompat = Object.freeze({
		API_VERSION,
		SUPPORTED_MAJORS,
		CHANGELOG_PATH,
		apiMajor,
		minimumMajorOf,
		supportProblem,
		engineProblem,
		record,
		listFor,
		list,
		clear,
		onDidChange,
		handlers,
	});
})(window);
