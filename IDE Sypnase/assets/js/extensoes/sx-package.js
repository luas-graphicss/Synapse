(function (root) {
	'use strict';

	const MAX_PACKAGE_BYTES = 20 * 1024 * 1024;
	const REQUIRED_DOCS = ['README.md', 'CHANGELOG.md'];
	const LICENSE_FILES = ['LICENSE', 'LICENSE.md', 'LICENSE.txt'];
	const EXTENSION = '.sx';
	const RISKY_CODE = /\beval\s*\(|new\s+Function\s*\(/;
	const ICON_FORMATS = /\.(png|jpe?g|webp|svg)$/i;
	const MAX_ICON_BYTES = 512 * 1024;

	function manifestApi() {
		return root.SynapseExtensionManifest;
	}

	function textOf(value) {
		if (typeof value === 'string') return value;
		if (value instanceof Uint8Array) return new TextDecoder().decode(value);
		return '';
	}

	function bytesOf(value) {
		if (value instanceof Uint8Array) return value;
		return new TextEncoder().encode(String(value == null ? '' : value));
	}

	function toHex(buffer) {
		return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
	}

	async function sha256(bytes) {
		const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
		if (!root.crypto || !root.crypto.subtle) throw new Error('SHA-256 indisponível: abra a IDE em https ou localhost.');
		return toHex(await root.crypto.subtle.digest('SHA-256', data));
	}

	function parseVersion(value) {
		const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/.exec(String(value || '').trim());
		if (!match) return null;
		return { major: +match[1], minor: +match[2], patch: +match[3], pre: match[4] ? match[4].split('.') : [] };
	}

	function compareVersions(a, b) {
		const left = parseVersion(a);
		const right = parseVersion(b);
		if (!left || !right) return String(a).localeCompare(String(b));
		for (const key of ['major', 'minor', 'patch']) {
			if (left[key] !== right[key]) return left[key] - right[key];
		}
		if (!left.pre.length && !right.pre.length) return 0;
		if (!left.pre.length) return 1;
		if (!right.pre.length) return -1;
		for (let index = 0; index < Math.max(left.pre.length, right.pre.length); index++) {
			const x = left.pre[index];
			const y = right.pre[index];
			if (x === undefined) return -1;
			if (y === undefined) return 1;
			const numeric = /^\d+$/.test(x) && /^\d+$/.test(y);
			const delta = numeric ? +x - +y : x.localeCompare(y);
			if (delta) return delta;
		}
		return 0;
	}

	function satisfiesComparator(version, comparator) {
		const token = comparator.trim();
		if (!token || token === '*' || token === 'x') return true;
		const match = /^(>=|<=|>|<|=|\^|~)?\s*v?(\d+)(?:\.(\d+|x|\*))?(?:\.(\d+|x|\*))?(?:-[0-9A-Za-z.-]+)?$/.exec(token);
		if (!match) return false;
		const operator = match[1] || '';
		const major = +match[2];
		const minorRaw = match[3];
		const patchRaw = match[4];
		const minor = minorRaw === undefined || /x|\*/.test(minorRaw) ? null : +minorRaw;
		const patch = patchRaw === undefined || /x|\*/.test(patchRaw) ? null : +patchRaw;
		const base = `${major}.${minor == null ? 0 : minor}.${patch == null ? 0 : patch}`;
		const current = parseVersion(version);
		if (!current) return false;
		if (operator === '^') {
			const upper = major > 0 ? `${major + 1}.0.0` : minor == null ? '1.0.0' : minor > 0 ? `0.${minor + 1}.0` : `0.0.${(patch || 0) + 1}`;
			return compareVersions(version, base) >= 0 && compareVersions(version, upper) < 0;
		}
		if (operator === '~') {
			const upper = minor == null ? `${major + 1}.0.0` : `${major}.${minor + 1}.0`;
			return compareVersions(version, base) >= 0 && compareVersions(version, upper) < 0;
		}
		if (operator === '' || operator === '=') {
			if (minor == null) return current.major === major;
			if (patch == null) return current.major === major && current.minor === minor;
			return compareVersions(version, base) === 0;
		}
		const delta = compareVersions(version, base);
		if (operator === '>=') return delta >= 0;
		if (operator === '>') return delta > 0;
		if (operator === '<=') return delta <= 0;
		return delta < 0;
	}

	function satisfies(version, range) {
		const text = String(range || '').trim();
		if (!text) return true;
		return text.split('||').some((group) => group.trim().split(/\s+/).every((comparator) => satisfiesComparator(version, comparator)));
	}

	function appVersion() {
		const compat = root.SynapseExtensionCompat;
		return String(root.SYNAPSE_VERSION || root.APP_VERSION || (compat && compat.API_VERSION) || '0.0.0');
	}

	function engineProblem(manifest) {
		const range = manifest && manifest.engines && manifest.engines.synapse;
		if (!range) return null;
		const version = parseVersion(appVersion()) ? appVersion() : null;
		if (!version) return null;
		return satisfies(version, range) ? null : `Requer Synapse ${range}; esta IDE é ${version}.`;
	}

	function normalizePath(path) {
		return String(path || '')
			.replace(/\\/g, '/')
			.replace(/^\.\//, '')
			.replace(/^\/+/, '');
	}

	function fileName(manifest) {
		return `${manifest.publisher}.${manifest.id.split('.').slice(1).join('.')}-${manifest.version}${EXTENSION}`;
	}

	function lint(manifest, files) {
		const problems = [];
		const warnings = [];
		const main = normalizePath(manifest.main);
		if (!files.has(main)) problems.push(`Arquivo principal "${manifest.main}" não encontrado.`);
		REQUIRED_DOCS.forEach((doc) => {
			if (!files.has(doc)) problems.push(`${doc} é obrigatório no pacote.`);
		});
		const hasLicenseFile = LICENSE_FILES.some((name) => files.has(name));
		if (!hasLicenseFile && !manifest.license) problems.push('Inclua um arquivo LICENSE ou o campo "license" no manifesto.');
		if (!manifest.repository) warnings.push('Campo "repository" ausente: o registro exige a URL pública do repositório para publicar.');
		if (!manifest.description) warnings.push('Campo "description" ausente: a busca do registro usa a descrição.');
		if (manifest.icon && !files.has(normalizePath(manifest.icon))) warnings.push(`Ícone "${manifest.icon}" não encontrado.`);
		if (manifest.icon && !ICON_FORMATS.test(manifest.icon)) warnings.push(`Ícone "${manifest.icon}": use PNG, JPG, WebP ou SVG.`);
		if (manifest.icon && files.has(normalizePath(manifest.icon)) && bytesOf(files.get(normalizePath(manifest.icon))).length > MAX_ICON_BYTES) warnings.push(`Ícone "${manifest.icon}" acima de 512 KB; use uma imagem quadrada de 128 a 256 px.`);
		if (files.has(main) && RISKY_CODE.test(textOf(files.get(main)))) warnings.push('O arquivo principal usa eval/new Function; o registro emite aviso e revisores podem recusar.');
		const changelog = textOf(files.get('CHANGELOG.md'));
		if (changelog && !changelog.includes(manifest.version)) warnings.push(`CHANGELOG.md não menciona a versão ${manifest.version}.`);
		return { problems, warnings };
	}

	async function build(descriptor) {
		if (typeof root.buildZip !== 'function') throw new Error('Gerador de zip indisponível nesta build da IDE.');
		const validation = manifestApi().validate(descriptor.manifest);
		if (!validation.ok) throw new Error('Manifesto inválido:\n' + manifestApi().formatErrors(validation.errors));
		const manifest = validation.manifest;
		const files = descriptor.files instanceof Map ? descriptor.files : new Map(Object.entries(descriptor.files || {}));
		const report = lint(manifest, files);
		if (report.problems.length) throw new Error(report.problems.join('\n'));
		const items = [];
		let total = 0;
		for (const [path, value] of files) {
			const clean = normalizePath(path);
			if (!clean || clean.startsWith('.git/') || clean.startsWith('node_modules/')) continue;
			const data = bytesOf(value);
			total += data.length;
			if (total > MAX_PACKAGE_BYTES) throw new Error('Pacote acima de 20 MB. Remova artefatos ou binários pesados.');
			items.push({ name: clean, data });
		}
		if (!items.some((item) => item.name === manifestApi().FILE_NAME)) {
			items.unshift({ name: manifestApi().FILE_NAME, data: bytesOf(JSON.stringify(descriptor.manifest, null, 2) + '\n') });
		}
		items.sort((a, b) => a.name.localeCompare(b.name));
		const blob = await root.buildZip(items);
		const bytes = new Uint8Array(await blob.arrayBuffer());
		if (bytes.length > MAX_PACKAGE_BYTES) throw new Error('Pacote comprimido acima de 20 MB.');
		return { manifest, bytes, blob, sha256: await sha256(bytes), fileName: fileName(manifest), warnings: report.warnings, fileCount: items.length };
	}

	function stripRoot(entries) {
		const names = entries.map((entry) => entry.name);
		const manifestName = manifestApi().FILE_NAME;
		if (names.includes(manifestName)) return '';
		const nested = names.find((name) => name.endsWith('/' + manifestName));
		return nested ? nested.slice(0, -manifestName.length) : null;
	}

	async function read(input) {
		if (typeof root.parseZipAsync !== 'function') throw new Error('Leitor de zip indisponível nesta build da IDE.');
		const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
		if (bytes.length > MAX_PACKAGE_BYTES) throw new Error('Pacote acima de 20 MB.');
		const entries = await root.parseZipAsync(bytes);
		const prefix = stripRoot(entries);
		if (prefix === null) throw new Error(`Pacote inválido: ${manifestApi().FILE_NAME} não encontrado.`);
		const files = new Map();
		const isText = typeof root.Core === 'object' && root.Core && typeof root.Core.isTextFile === 'function' ? root.Core.isTextFile : (name) => /\.(js|mjs|cjs|json|md|txt|css|html|svg|xml|yml|yaml|ts|d\.ts|map)$/i.test(name);
		for (const entry of entries) {
			if (!entry.name.startsWith(prefix)) continue;
			const path = entry.name.slice(prefix.length);
			if (!path) continue;
			files.set(path, isText(path) ? new TextDecoder().decode(entry.data) : entry.data);
		}
		const parsed = manifestApi().parse(textOf(files.get(manifestApi().FILE_NAME)));
		if (!parsed.ok) throw new Error('Manifesto inválido:\n' + manifestApi().formatErrors(parsed.errors));
		const nls = root.SynapseExtensionNls;
		let manifest = parsed.manifest;
		if (nls && nls.hasBundle(files)) {
			const raw = JSON.parse(textOf(files.get(manifestApi().FILE_NAME)));
			const localized = nls.apply(raw, files, document.documentElement.lang || 'pt');
			const revalidated = manifestApi().validate(localized.manifest);
			if (revalidated.ok) manifest = revalidated.manifest;
		}
		return { manifest, files, bytes, sha256: await sha256(bytes), report: lint(manifest, files) };
	}

	function registryEntry(pkg, options) {
		options = options || {};
		const manifest = pkg.manifest;
		const name = manifest.id.split('.').slice(1).join('.');
		const repository = String(options.repository || manifest.repository || '').replace(/\.git$/, '').replace(/\/+$/, '');
		const tag = options.tag || `v${manifest.version}`;
		const release = repository ? `${repository}/releases/download/${tag}/${pkg.fileName}` : options.url || '';
		const version = {
			version: manifest.version,
			sha256: pkg.sha256,
			size: pkg.bytes.length,
			url: release,
			engines: manifest.engines || {},
			publishedAt: new Date().toISOString(),
			tag,
		};
		const previous = options.previous && Array.isArray(options.previous.versions) ? options.previous.versions.filter((entry) => entry.version !== manifest.version) : [];
		return {
			id: manifest.id,
			publisher: manifest.publisher,
			name,
			displayName: manifest.name,
			description: manifest.description || '',
			categories: manifest.categories || [],
			tags: options.tags || [],
			license: manifest.license || 'ver LICENSE',
			repository,
			icon: manifest.icon ? `${repository ? repository.replace('https://github.com/', 'https://cdn.jsdelivr.net/gh/') + '@' + tag + '/' : ''}${manifest.icon}` : '',
			permissions: manifest.permissions || [],
			latest: manifest.version,
			versions: [version, ...previous].sort((a, b) => compareVersions(b.version, a.version)),
		};
	}

	function githubOwner(repository) {
		const match = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)/i.exec(String(repository || ''));
		return match ? { owner: match[1].toLowerCase(), repo: match[2].replace(/\.git$/, '') } : null;
	}

	root.SynapseExtensionPackage = Object.freeze({
		EXTENSION,
		MAX_PACKAGE_BYTES,
		REQUIRED_DOCS: Object.freeze([...REQUIRED_DOCS]),
		build,
		read,
		lint,
		sha256,
		fileName,
		registryEntry,
		githubOwner,
		compareVersions,
		satisfies,
		parseVersion,
		engineProblem,
		appVersion,
		textOf,
	});
})(window);
