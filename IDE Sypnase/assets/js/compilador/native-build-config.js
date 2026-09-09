(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.SYNAPSE_NATIVE_BUILD_CONFIG = api;
})(globalThis, function () {
    'use strict';
    const profiles = ['wcc-wasi', 'cargo-wasi', 'cmake-wasi', 'rustc-wasi', 'wasi-artifact'];
    function relativePath(value) {
      if (typeof value !== 'string' || value.length > 512 || /[:\\\x00-\x1f\x7f]/.test(value) || value.split('/').some((part) => !part || part === '.' || part === '..')) throw new Error('A safe relative project path is required.');
      return value;
    }
    function record(value, name) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(name + ' must be an object.');
      return value;
    }
    function stringList(value, name, maximum, length) {
      if (value === undefined) return [];
      if (!Array.isArray(value) || value.length > maximum || value.some((item) => typeof item !== 'string' || item.length > length || /[\x00]/.test(item))) throw new Error(name + ' must be a bounded array of strings.');
      return value.slice();
    }
    function cOptions(value = {}) {
      record(value, 'C build options');
      const sources = stringList(value.sources, 'C sources', 128, 512).map(relativePath);
      if (sources.some((path) => !path.endsWith('.c')) || new Set(sources).size !== sources.length) throw new Error('C sources must be unique .c translation units.');
      if (value.sources !== undefined && !sources.length) throw new Error('C sources cannot be empty.');
      const includeDirectories = stringList(value.includeDirectories, 'C include directories', 32, 512).map(relativePath);
      const defines = Object.entries(record(value.defines ?? {}, 'C defines'));
      if (defines.length > 64 || defines.some(([key, item]) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || !['string', 'number'].includes(typeof item) || (typeof item === 'number' && !Number.isFinite(item)) || String(item).length > 512 || /[\x00-\x1f\x7f]/.test(String(item)))) throw new Error('C defines require bounded scalar values and valid macro names.');
      return { sources: value.sources === undefined ? undefined : sources, includeDirectories, defines: Object.fromEntries(defines) };
    }
    function parse(text) {
      if (typeof text !== 'string' || new TextEncoder().encode(text).length > 32768) throw new Error('synapse.preview.json must be text under 32 KiB.');
      let value;
      try { value = record(JSON.parse(text), 'Preview configuration'); }
      catch (cause) { throw new Error('Invalid synapse.preview.json: ' + cause.message); }
      if (value.runtime !== 'wasi-preview1') throw new Error('synapse.preview.json requires runtime wasi-preview1.');
      const build = { ...record(value.build ?? {}, 'Preview build') };
      if (build.profile !== undefined && !profiles.includes(build.profile)) throw new Error('Unknown WASI build profile: ' + build.profile);
      const artifact = relativePath(value.artifact ?? (build.profile === 'wcc-wasi' ? 'main.wasm' : undefined));
      if (!artifact.endsWith('.wasm')) throw new Error('The configured artifact must be a .wasm file.');
      const args = stringList(value.args, 'WASI args', 128, 8192);
      if (value.stdin !== undefined && (typeof value.stdin !== 'string' || new TextEncoder().encode(value.stdin).length > 65536)) throw new Error('WASI stdin must be text under 64 KiB.');
      if (value.timeoutMs !== undefined && (!Number.isInteger(value.timeoutMs) || value.timeoutMs < 100 || value.timeoutMs > 60000)) throw new Error('WASI timeoutMs must be 100 to 60000.');
      const environment = Object.entries(record(value.env ?? {}, 'WASI env'));
      if (environment.length > 64 || environment.some(([key, item]) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || typeof item !== 'string' || item.length > 8192 || item.includes('\0'))) throw new Error('WASI env requires bounded string values and valid names.');
      if (build.entry !== undefined) relativePath(build.entry);
      if (build.artifactDirectory !== undefined) relativePath(build.artifactDirectory);
      if (build.profile === 'wcc-wasi') Object.assign(build, cOptions(build));
      else if (['sources', 'includeDirectories', 'defines'].some((key) => build[key] !== undefined)) throw new Error('C options require build.profile wcc-wasi.');
      return { runtime: value.runtime, artifact, args, env: Object.fromEntries(environment), stdin: value.stdin ?? '', timeoutMs: value.timeoutMs ?? 10000, build };
    }
    function read(files) {
      const entry = files.get('synapse.preview.json');
      if (entry === undefined) return null;
      try { return parse(typeof entry === 'string' ? entry : entry?.text ?? entry?.content ?? entry?.conteudo); }
      catch (error) { error.file = 'synapse.preview.json'; throw error; }
    }
    function profile(files, settings = read(files)) {
      if (!settings) return null;
      return settings.build.profile || (files.has('Cargo.toml') ? 'cargo-wasi' : files.has('CMakeLists.txt') ? 'cmake-wasi' : 'wasi-artifact');
    }
    function shellPath(path) {
      relativePath(path);
      if (!/^[A-Za-z0-9_./ -]+$/.test(path)) throw new Error('Compiler command paths must use letters, digits, spaces, dots, underscores, hyphens and slashes.');
      return '"' + path + '"';
    }
    return { read, parse, profile, cOptions, relativePath, shellPath };
});
