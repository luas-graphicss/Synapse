(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.SYNAPSE_WASI_ARTIFACTS = api;
})(globalThis, function () {
    'use strict';
    const maximumBytes = 67108864;
    const supportedImports = new Set(['fd_write', 'fd_read', 'fd_close', 'fd_seek', 'fd_fdstat_get', 'fd_fdstat_set_flags', 'fd_fdstat_set_rights', 'fd_prestat_get', 'fd_prestat_dir_name', 'fd_filestat_get', 'fd_filestat_set_size', 'fd_filestat_set_times', 'fd_readdir', 'fd_sync', 'fd_tell', 'fd_pread', 'fd_pwrite', 'fd_renumber', 'fd_advise', 'fd_allocate', 'fd_datasync', 'path_open', 'path_filestat_get', 'path_create_directory', 'path_remove_directory', 'path_unlink_file', 'path_rename', 'path_readlink', 'path_symlink', 'path_link', 'path_filestat_set_times', 'args_sizes_get', 'args_get', 'environ_sizes_get', 'environ_get', 'clock_time_get', 'clock_res_get', 'random_get', 'proc_exit', 'proc_raise', 'sched_yield', 'poll_oneoff', 'sock_accept', 'sock_recv', 'sock_send', 'sock_shutdown']);
    function normalizePath(value) {
      if (typeof value !== 'string' || /^[\/]/.test(value) || /[:\\\x00-\x1f]/.test(value) || value.split('/').some((part) => !part || part === '.' || part === '..')) throw new Error('An artifact requires a safe relative project path.');
      return value;
    }
    function fileMap(files) {
      const entries = files instanceof Map ? files.entries() : Array.isArray(files) ? files.map((file) => [file.path ?? file.caminho, file]) : Object.entries(files || {});
      const mapped = new Map();
      for (const [rawPath, value] of entries) {
        const path = normalizePath(rawPath);
        if (mapped.has(path)) throw new Error('Duplicate artifact path.');
        mapped.set(path, value);
      }
      return mapped;
    }
    function configuration(files) {
      const config = typeof module === 'object' && module.exports ? require('./native-build-config.js') : globalThis.SYNAPSE_NATIVE_BUILD_CONFIG;
      if (!config) throw new Error('Native build configuration module is unavailable.');
      return config.read(files);
    }
    async function bytes(entry) {
      let value = entry;
      if (value && typeof value === 'object' && !(value instanceof ArrayBuffer) && !ArrayBuffer.isView(value) && !(typeof Blob !== 'undefined' && value instanceof Blob)) value = value.bytes ?? value.data ?? value.conteudo ?? value.content;
      if (typeof Blob !== 'undefined' && value instanceof Blob) {
        if (value.size > maximumBytes) throw new Error('WASM exceeds 64 MiB.');
        value = await value.arrayBuffer();
      }
      if (typeof value === 'string' && /^data:.*?;base64,/i.test(value)) {
        const encoded = value.slice(value.indexOf(',') + 1);
        if (encoded.length > maximumBytes * 1.34) throw new Error('WASM exceeds 64 MiB.');
        value = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
      }
      const binary = value instanceof ArrayBuffer ? new Uint8Array(value) : ArrayBuffer.isView(value) ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength) : null;
      if (!binary || binary.length < 8 || binary.length > maximumBytes || binary[0] !== 0 || binary[1] !== 97 || binary[2] !== 115 || binary[3] !== 109) throw new Error('A core WASM binary is required, not an OS executable.');
      if (binary[4] !== 1 || binary[5] !== 0 || binary[6] !== 0 || binary[7] !== 0) throw new Error('WASM components are not WASI Preview 1 commands.');
      return binary.slice();
    }
    function inspect(module) {
      const exports = WebAssembly.Module.exports(module);
      if (!exports.some((entry) => entry.name === '_start' && entry.kind === 'function')) throw new Error('WASI command requires an exported _start function.');
      if (!exports.some((entry) => entry.name === 'memory' && entry.kind === 'memory')) throw new Error('WASI command requires exported memory.');
      const imports = WebAssembly.Module.imports(module);
      for (const entry of imports) if (!['wasi_snapshot_preview1', 'wasi_unstable'].includes(entry.module) || entry.kind !== 'function' || !supportedImports.has(entry.name)) throw new Error('This WASM needs a JavaScript loader or unsupported imports: ' + entry.module + '.' + entry.name);
      return imports;
    }
    function candidates(files, directory) {
      const prefix = directory ? normalizePath(String(directory).replace(/\/$/, '')) + '/' : '';
      return [...files.keys()].filter((path) => path.endsWith('.wasm') && (!prefix || path.startsWith(prefix)) && !/(^|\/)(node_modules|\.git|vendor|deps|incremental|\.fingerprint)(\/|$)/.test(path));
    }
    async function find(source, options = {}) {
      const files = fileMap(source);
      const settings = configuration(files);
      if (options.path && settings && options.path !== settings.artifact) throw new Error('Configured artifact changed during the build.');
      const selectedPath = options.path ?? settings?.artifact;
      const paths = selectedPath ? [normalizePath(selectedPath)] : candidates(files, options.directory);
      if (!paths.length) throw new Error('No WASI artifact found. Build a wasm32-wasip1 command or import a .wasm file.');
      if (paths.length !== 1) throw new Error('Several WASM artifacts found. Select one in synapse.preview.json.');
      const path = paths[0];
      if (!files.has(path)) throw new Error('Configured WASI artifact is missing: ' + path);
      if (options.directory && !path.startsWith(normalizePath(options.directory.replace(/\/$/, '')) + '/')) throw new Error('Configured artifact is outside the selected build target directory.');
      const wasm = await bytes(files.get(path));
      const imports = inspect(await WebAssembly.compile(wasm));
      return { kind: 'wasi', path, wasm, settings: settings || {}, runtime: 'wasi-preview1', imports };
    }
    return { find, inspect, bytes, fileMap, configuration, candidates, normalizePath, maximumBytes };
});
