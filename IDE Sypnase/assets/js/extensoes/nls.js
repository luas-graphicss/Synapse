(function (root) {
	'use strict';

	const BASE_FILE = 'package.nls.json';
	const PLACEHOLDER = /^%([^%]+)%$/;
	const INLINE = /%([A-Za-z0-9_.-]+)%/g;

	function parseJson(text) {
		try {
			const parsed = JSON.parse(String(text));
			return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
		} catch (error) {
			return null;
		}
	}

	function fileText(files, name) {
		if (!files) return null;
		if (files instanceof Map) return files.has(name) ? files.get(name) : null;
		return Object.prototype.hasOwnProperty.call(files, name) ? files[name] : null;
	}

	function languageChain(language) {
		const tag = String(language || '').toLowerCase().replace('_', '-');
		const chain = [];
		if (tag) {
			chain.push(tag);
			const short = tag.split('-')[0];
			if (short && short !== tag) chain.push(short);
		}
		return chain;
	}

	function bundleFor(files, language) {
		const base = parseJson(fileText(files, BASE_FILE) || '{}') || {};
		let merged = { ...base };
		languageChain(language)
			.reverse()
			.forEach((tag) => {
				const localized = parseJson(fileText(files, `package.nls.${tag}.json`) || '');
				if (localized) merged = { ...merged, ...localized };
			});
		return merged;
	}

	function translate(value, bundle, missing) {
		const whole = PLACEHOLDER.exec(value);
		if (whole) {
			if (Object.prototype.hasOwnProperty.call(bundle, whole[1])) return String(bundle[whole[1]]);
			missing.add(whole[1]);
			return value;
		}
		return value.replace(INLINE, (match, key) => {
			if (Object.prototype.hasOwnProperty.call(bundle, key)) return String(bundle[key]);
			missing.add(key);
			return match;
		});
	}

	function walk(node, bundle, missing) {
		if (typeof node === 'string') return translate(node, bundle, missing);
		if (Array.isArray(node)) return node.map((item) => walk(item, bundle, missing));
		if (node && typeof node === 'object') {
			const out = {};
			Object.keys(node).forEach((key) => {
				out[key] = walk(node[key], bundle, missing);
			});
			return out;
		}
		return node;
	}

	function hasBundle(files) {
		return fileText(files, BASE_FILE) !== null;
	}

	function apply(manifestJson, files, language) {
		if (!manifestJson || typeof manifestJson !== 'object' || !hasBundle(files)) {
			return { manifest: manifestJson, missing: [], localized: false };
		}
		const bundle = bundleFor(files, language);
		const missing = new Set();
		const manifest = walk(manifestJson, bundle, missing);
		return { manifest, missing: [...missing], localized: true };
	}

	root.SynapseExtensionNls = Object.freeze({ BASE_FILE, apply, bundleFor, hasBundle });
})(typeof self !== 'undefined' ? self : window);
