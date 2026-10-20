'use strict';

const SynapseZipGuard = (function () {
	const MEGABYTE = 1024 * 1024;
	const MAXIMUM_ENTRIES = 20000;
	const MAXIMUM_NAME_LENGTH = 400;
	const MAXIMUM_ENTRY_BYTES = 75 * MEGABYTE;
	const MAXIMUM_ASSET_BYTES = 200 * MEGABYTE;
	const MAXIMUM_ZIP_BYTES = 700 * MEGABYTE;
	const MAXIMUM_ARCHIVE_BYTES = 2048 * MEGABYTE;
	const MAXIMUM_EXPANSION_RATIO = 2000;
	const WINDOWS_DRIVE_START = /^[a-z]:/i;
	const THREE_DIMENSIONAL_EXTENSIONS = Object.freeze([
		'glb',
		'gltf',
		'bin',
		'fbx',
		'obj',
		'mtl',
		'stl',
		'ply',
		'dae',
		'3ds',
		'3mf',
		'blend',
		'usd',
		'usda',
		'usdc',
		'usdz',
		'abc',
		'vrm',
		'vox',
		'drc',
		'ktx',
		'ktx2',
		'basis',
		'hdr',
		'exr',
		'splat',
		'spz',
	]);
	const THREE_DIMENSIONAL_SET = new Set(THREE_DIMENSIONAL_EXTENSIONS);

	function hasControlCharacters(text) {
		for (let index = 0; index < text.length; index++) {
			const code = text.charCodeAt(index);
			if (code <= 31 || code === 127) return true;
		}
		return false;
	}

	function normalizeSeparators(name) {
		return String(name == null ? '' : name).replace(/\\/g, '/');
	}

	function extensionOf(name) {
		const base = normalizeSeparators(name).split('/').pop() || '';
		const dot = base.lastIndexOf('.');
		return dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
	}

	function isThreeDimensionalAsset(name) {
		return THREE_DIMENSIONAL_SET.has(extensionOf(name));
	}

	function limitFor(name) {
		return isThreeDimensionalAsset(name) ? MAXIMUM_ASSET_BYTES : MAXIMUM_ENTRY_BYTES;
	}

	function describeLimit(name) {
		return isThreeDimensionalAsset(name) ? '200 MB por asset 3D' : '75 MB por arquivo';
	}

	function formatMegabytes(byteLength) {
		const megabytes = Math.max(0, Number(byteLength) || 0) / MEGABYTE;
		return (megabytes >= 10 ? Math.round(megabytes) : megabytes.toFixed(1)) + ' MB';
	}

	function isSafeEntryName(name) {
		const path = normalizeSeparators(name);
		if (!path || path.length > MAXIMUM_NAME_LENGTH) return false;
		if (hasControlCharacters(path)) return false;
		if (path.startsWith('/') || WINDOWS_DRIVE_START.test(path)) return false;
		return !path.split('/').some((part) => part === '..');
	}

	function safeEntries(entries) {
		const list = Array.isArray(entries) ? entries : [];
		if (list.length > MAXIMUM_ENTRIES) {
			throw new Error(`ZIP: arquivo com ${list.length} entradas acima do limite de ${MAXIMUM_ENTRIES}.`);
		}
		const safe = [];
		for (const entry of list) {
			if (!entry || !isSafeEntryName(entry.name)) continue;
			safe.push(Object.assign({}, entry, { name: normalizeSeparators(entry.name) }));
		}
		return safe;
	}

	function checkArchiveSize(byteLength) {
		const size = Number(byteLength) || 0;
		if (size > MAXIMUM_ZIP_BYTES) {
			throw new Error(`ZIP: o arquivo tem ${formatMegabytes(size)} e passa do limite de 700 MB.`);
		}
	}

	function checkDeclaredSize(entry) {
		const declaredBytes = Number(entry && entry.size) || 0;
		const compressedBytes = Number(entry && entry.compSize) || 0;
		const name = (entry && entry.name) || 'entrada';
		if (declaredBytes > limitFor(name)) {
			throw new Error(`ZIP: "${name}" ultrapassa o limite de ${describeLimit(name)}.`);
		}
		if (compressedBytes > 0 && declaredBytes / compressedBytes > MAXIMUM_EXPANSION_RATIO) {
			throw new Error(`ZIP: "${name}" tem taxa de expansao suspeita e foi recusado.`);
		}
	}

	function createExpansionBudget() {
		let usedBytes = 0;
		return {
			add(entryName, byteLength) {
				const amount = Number(byteLength) || 0;
				if (amount > limitFor(entryName)) {
					throw new Error(`ZIP: "${entryName}" ultrapassa o limite de ${describeLimit(entryName)}.`);
				}
				usedBytes += amount;
				if (usedBytes > MAXIMUM_ARCHIVE_BYTES) {
					throw new Error('ZIP: conteudo descompactado ultrapassa o limite de 2 GB.');
				}
				return usedBytes;
			},
		};
	}

	return {
		isSafeEntryName,
		safeEntries,
		checkArchiveSize,
		checkDeclaredSize,
		createExpansionBudget,
		isThreeDimensionalAsset,
		limitFor,
		describeLimit,
		formatMegabytes,
		threeDimensionalExtensions: THREE_DIMENSIONAL_EXTENSIONS,
		maximumEntries: MAXIMUM_ENTRIES,
		maximumEntryBytes: MAXIMUM_ENTRY_BYTES,
		maximumAssetBytes: MAXIMUM_ASSET_BYTES,
		maximumZipBytes: MAXIMUM_ZIP_BYTES,
		maximumArchiveBytes: MAXIMUM_ARCHIVE_BYTES,
		maximumExpansionRatio: MAXIMUM_EXPANSION_RATIO,
	};
})();

window.SynapseZipGuard = SynapseZipGuard;
