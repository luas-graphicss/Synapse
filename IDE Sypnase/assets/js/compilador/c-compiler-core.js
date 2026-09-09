(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.SYNAPSE_C_COMPILER_CORE = api;
})(globalThis, function () {
    'use strict';
    async function compile(sourceFiles, archiveBytes, dependencies, onOutput = () => {}, options = {}) {
      if (!Array.isArray(sourceFiles) || sourceFiles.length < 1 || sourceFiles.length > 128) throw new Error('C compilation requires 1 to 128 source/header files.');
      const configuration = typeof module === 'object' && module.exports ? require('./native-build-config.js') : globalThis.SYNAPSE_NATIVE_BUILD_CONFIG;
      const settings = configuration.cOptions(options);
      const mounted = new Map();
      const sourcePaths = [];
      let totalBytes = 0;
      for (const source of sourceFiles) {
        const path = source.path;
        if (typeof path !== 'string' || !/\.(?:c|h|inc)$/.test(path) || /^[\/-]/.test(path) || /[:\\\x00-\x1f]/.test(path) || path.split('/').some((part) => !part || part === '.' || part === '..')) throw new Error('Invalid C source path or unsupported C++ file.');
        if (mounted.has('/project/' + path)) throw new Error('C source has a duplicate path.');
        if (typeof source.content !== 'string') throw new Error('C source content must be text.');
        const bytes = new TextEncoder().encode(source.content);
        if ((totalBytes += bytes.length) > 2097152) throw new Error('C sources exceed 2 MiB.');
        mounted.set('/project/' + path, bytes);
        if (path.endsWith('.c')) sourcePaths.push('/project/' + path);
      }
      if (!sourcePaths.length) throw new Error('No C translation unit found.');
      if (settings.sources?.some((path) => !sourcePaths.includes('/project/' + path))) throw new Error('A configured C translation unit is missing.');
      const selectedSources = settings.sources?.map((path) => '/project/' + path) || sourcePaths.sort();
      const compilerArguments = [...settings.includeDirectories.map((path) => '-I/project/' + path), ...Object.entries(settings.defines).map(([name, value]) => '-D' + name + '=' + value)];
      for (const [path, bytes] of await dependencies.archive.unpack(archiveBytes)) mounted.set(path, bytes);
      const runtime = dependencies.wasi.criar({
          args: ['/usr/bin/cc', '-I/usr/include', '-I/project', ...compilerArguments, '-L/usr/lib', '-o', '/output/main.wasm', ...selectedSources],
          env: {}, stdin: '', limiteMs: 30000,
          stdout: (text) => onOutput('out', text),
          stderr: (text) => onOutput('err', text),
      });
      const filesystem = dependencies.filesystem.create(mounted, runtime.wasiImport);
      const { instance } = await WebAssembly.instantiate(mounted.get('/usr/bin/cc'), filesystem.imports);
      filesystem.bind(instance);
      runtime.vincular(instance);
      const exitCode = runtime.rodar(instance);
      if (exitCode !== 0) throw new Error('C compilation failed with exit code ' + exitCode + '.');
      const wasm = filesystem.read('/output/main.wasm');
      if (!WebAssembly.validate(wasm)) throw new Error('The C compiler produced invalid WebAssembly.');
      return wasm;
    }
    return { compile };
});
