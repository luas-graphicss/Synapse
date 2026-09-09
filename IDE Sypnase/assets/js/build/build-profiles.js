(function (root, factory) {
	'use strict';
	const api = factory();
	if (typeof module === 'object' && module.exports) module.exports = api;
	else root.SYNAPSE_BUILD_PROFILES = api;
})(globalThis, function () {
	'use strict';

	const generatedDirectory =
		/(^|\/)(node_modules|\.git|\.next|\.cache|dist|build|out|target|bin|obj|__pycache__)(\/|$)/i;
	const definitions = Object.freeze({
		browser: {
			label: 'Browser · JavaScript / TypeScript / JSX',
			mode: 'browser',
			build: [],
			run: [],
			clean: [],
		},
		'wcc-wasi': { label: 'C · WCC → WASI (browser)', mode: 'wasi', build: [], run: [], clean: [] },
		'wasi-artifact': { label: 'WASI Preview 1 · imported binary', mode: 'wasi', build: [], run: [], clean: [] },
		'cargo-wasi': { label: 'Rust · Cargo → WASI preview', mode: 'wasi-relay', build: ['cargo build --target wasm32-wasip1'], run: [], clean: ['cargo clean --target wasm32-wasip1'], artifactDirectory: 'target/wasm32-wasip1' },
		'cmake-wasi': { label: 'C / C++ · WASI SDK preset', mode: 'wasi-relay', build: ['cmake --preset wasi', 'cmake --build --preset wasi'], run: [], clean: ['cmake --build --preset wasi --target clean'], artifactDirectory: 'build/wasi' },
		'rustc-wasi': { label: 'Rust · standalone → WASI preview', mode: 'wasi-relay', build: [], run: [], clean: [] },
		npm: {
			label: 'Node.js · package scripts',
			mode: 'relay',
			build: ['npm run build'],
			run: ['npm start'],
			clean: [],
		},
		cargo: {
			label: 'Rust · Cargo',
			mode: 'relay',
			build: ['cargo build'],
			run: ['cargo run'],
			clean: ['cargo clean'],
		},
		cmake: {
			label: 'C / C++ · CMake (GCC / Clang / MSVC)',
			mode: 'relay',
			build: ['cmake -S . -B build', 'cmake --build build'],
			run: [],
			clean: ['cmake --build build --target clean'],
		},
		dotnet: {
			label: 'C# / F# · .NET',
			mode: 'relay',
			build: ['dotnet build'],
			run: ['dotnet run --no-build'],
			clean: ['dotnet clean'],
		},
		'flutter-web': {
			label: 'Flutter · web build (Relay)',
			mode: 'relay',
			build: ['flutter pub get', 'flutter build web'],
			run: [],
			clean: ['flutter clean'],
		},
		go: {
			label: 'Go',
			mode: 'relay',
			build: ['go build ./...'],
			run: ['go run .'],
			clean: ['go clean'],
		},
		make: {
			label: 'Make · configured compiler',
			mode: 'relay',
			build: ['make'],
			run: [],
			clean: ['make clean'],
		},
		custom: { label: 'Custom compiler · Relay', mode: 'relay', build: [], run: [], clean: [] },
	});

	function fileText(files, path) {
		const file = files.get(path);
		return typeof file === 'string' ? file : String(file?.text ?? '');
	}

	function readPackage(files) {
		if (!files.has('package.json')) return null;
		try {
			return JSON.parse(fileText(files, 'package.json'));
		} catch (cause) {
			const error = new Error('Invalid package.json: ' + cause.message);
			error.file = 'package.json';
			throw error;
		}
	}

	function nativeConfiguration() {
		const configuration = typeof module === 'object' && module.exports
			? require('../compilador/native-build-config.js')
			: globalThis.SYNAPSE_NATIVE_BUILD_CONFIG;
		if (!configuration) throw new Error('Native build configuration module is unavailable.');
		return configuration;
	}

	function standaloneRust(files, settings) {
		const configuration = nativeConfiguration();
		const entry = settings?.build.entry || 'main.rs';
		const artifact = settings?.artifact || 'build/wasi/main.wasm';
		const commandEntry = configuration.shellPath(entry).replace(/^"/, '"./');
		const commandArtifact = configuration.shellPath(artifact).replace(/^"/, '"./');
		if (!entry.endsWith('.rs') || !files.has(entry))
			throw new Error('Select an existing Rust .rs entry in synapse.preview.json build.entry.');
		const directory = artifact.includes('/') ? artifact.slice(0, artifact.lastIndexOf('/')) : '.';
		return {
			build: [
				`node -e "require('node:fs').mkdirSync('${directory}',{recursive:true})"`,
				'rustc --target wasm32-wasip1 --edition 2021 --crate-name synapse_preview -o ' + commandArtifact + ' ' + commandEntry,
			],
			run: [],
			clean: [`node -e "require('node:fs').rmSync('${artifact}',{force:true})"`],
			artifactPath: artifact,
		};
	}

	function detect(files) {
		const paths = Array.from(files.keys());
		if (files.has('synapse.preview.json')) return nativeConfiguration().profile(files);
		if (files.has('Cargo.toml')) return 'cargo';
		if (files.has('CMakeLists.txt')) return 'cmake';
		if (paths.some((path) => /^[^/]+\.(?:sln|csproj|fsproj)$/i.test(path))) return 'dotnet';
		if (files.has('go.mod')) return 'go';
		if (files.has('pubspec.yaml')) return 'flutter-web';
		if (files.has('Makefile') || files.has('makefile')) return 'make';
		const manifest = readPackage(files);
		if (typeof manifest?.scripts?.build === 'string' && manifest.scripts.build.trim()) return 'npm';
		if (paths.some((path) => !generatedDirectory.test(path) && /\.(?:html?|jsx|tsx)$/i.test(path)))
			return 'browser';
		if (manifest && (manifest.scripts?.start || manifest.scripts?.dev)) return 'npm';
		const sourcePaths = paths.filter((path) => !generatedDirectory.test(path));
		if (sourcePaths.some((path) => /\.c$/.test(path)) && !sourcePaths.some((path) => /\.(?:cc|cpp|cxx|C)$/.test(path))) return 'wcc-wasi';
		if (paths.some((path) => /\.wasm$/i.test(path)) && !sourcePaths.some((path) => /\.[cm]?js$/i.test(path))) return 'wasi-artifact';
		if (
			paths.some(
				(path) =>
					!generatedDirectory.test(path) &&
					/\.(?:c|cc|cpp|cxx|cs|rs|go|py|java|zig|kt|swift)$/i.test(path),
			)
		)
			return 'custom';
		return 'browser';
	}

	function commands(value, fallback) {
		const result =
			value == null
				? fallback.slice()
				: Array.isArray(value)
					? value.slice()
					: String(value).split('\n');
		if (result.length > 12) throw new Error('Use at most 12 commands per action.');
		return result
			.map((command) => String(command).trim())
			.filter(Boolean)
			.map((command) => {
				if (command.length > 2000 || /[\x00\r\n]/.test(command))
					throw new Error('Each command must be a single line of at most 2000 characters.');
				return command;
			});
	}

	function resolve(files, settings = {}) {
		const id = settings.profile && settings.profile !== 'auto' ? settings.profile : detect(files);
		if (!Object.prototype.hasOwnProperty.call(definitions, id))
			throw new Error('Unknown build profile: ' + id);
		const definition = definitions[id];
		const defaults = {
			build: definition.build.slice(),
			run: definition.run.slice(),
			clean: definition.clean.slice(),
		};
		if (id === 'npm') {
			const manifest = readPackage(files);
			const scripts = manifest?.scripts || {};
			const manager = files.has('pnpm-lock.yaml')
				? 'pnpm'
				: files.has('yarn.lock')
					? 'yarn'
					: 'npm';
			for (const action of ['build', 'clean'])
				defaults[action] = scripts[action] ? [manager + ' run ' + action] : [];
			defaults.run = scripts.start
				? [manager + ' run start']
				: scripts.dev
					? [manager + ' run dev']
					: [];
		}
		const nativeSettings = files.has('synapse.preview.json') && ['wasi', 'wasi-relay'].includes(definition.mode)
			? nativeConfiguration().read(files)
			: null;
		const rustPlan = id === 'rustc-wasi' ? standaloneRust(files, nativeSettings) : null;
		if (rustPlan) Object.assign(defaults, rustPlan);
		const resolved = { id, label: definition.label, mode: definition.mode, commands: {} };
		for (const action of ['build', 'run', 'clean'])
			resolved.commands[action] = commands(settings.commands?.[action], defaults[action]);
		if (resolved.mode === 'browser' || resolved.mode === 'wasi') resolved.commands = { build: [], run: [], clean: [] };
		if (resolved.mode === 'wasi-relay') {
			resolved.commands.run = [];
			resolved.artifactPath = nativeSettings?.artifact || rustPlan?.artifactPath;
			resolved.artifactDirectory = nativeSettings?.build.artifactDirectory || definition.artifactDirectory;
			if (resolved.artifactPath && resolved.artifactDirectory && !resolved.artifactPath.startsWith(resolved.artifactDirectory + '/'))
				throw new Error('Configured artifact is outside the selected build target directory.');
		}
		return resolved;
	}

	function snapshot(files, mode = 'browser') {
		const artifactPath = mode === 'wasi-relay' && files.has('synapse.preview.json')
			? nativeConfiguration().read(files)?.artifact
			: null;
		return Array.from(files)
			.filter(
				([path]) =>
					mode === 'browser' || mode === 'wasi' ||
					(path !== artifactPath && !generatedDirectory.test(path) && !/\.(?:o|obj|exe|dll|so|a|pyc)$/i.test(path)),
			)
			.map(([path, file]) => [path, typeof file === 'string' ? file : (file?.text ?? file?.data ?? file)]);
	}

	function isCurrent(snapshotValue, files, mode) {
		const current = snapshot(files, mode);
		if (snapshotValue.length !== current.length) return false;
		const previous = new Map(snapshotValue);
		return current.every(([path, value]) => previous.has(path) && previous.get(path) === value);
	}

	return {
		definitions,
		resolve,
		detect,
		commands,
		snapshot,
		isCurrent,
		isGenerated: (path) => generatedDirectory.test(path),
	};
});
