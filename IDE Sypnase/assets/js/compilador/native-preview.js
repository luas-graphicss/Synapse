(function (root) {
    'use strict';
    let currentOperation;
    let currentPanel;
    function canHandle(files, plan) {
      const mapped = root.SYNAPSE_WASI_ARTIFACTS.fileMap(files);
      if (mapped.has('synapse.preview.json')) return true;
      if (plan?.toolchain === 'nativo' || plan?.toolchain === 'dev-server') return false;
      if (root.SYNAPSE_BUNDLE?.achar(files)) return false;
      return (plan?.tipo === 'c' && plan.nivel === 1) || root.SYNAPSE_WASI_ARTIFACTS.candidates(mapped).length > 0;
    }
    async function compile(files, options = {}) {
      const mapped = root.SYNAPSE_WASI_ARTIFACTS.fileMap(files);
      const settings = root.SYNAPSE_NATIVE_BUILD_CONFIG.read(mapped);
      const buildOptions = root.SYNAPSE_NATIVE_BUILD_CONFIG.cOptions(settings?.build);
      const selected = buildOptions.sources ? new Set(buildOptions.sources) : null;
      const sources = [];
      for (const [path, file] of mapped) {
        if (selected && /\.(?:c|cc|cpp|cxx|C)$/.test(path) && !selected.has(path)) continue;
        if (/(^|\/)(node_modules|\.git|vendor|tools|docs|examples|build|dist|target)(\/|$)/.test(path)) continue;
        if (/\.(?:cc|cpp|cxx|C)$/.test(path)) throw new Error('WCC compiles C only. Use a Relay WASI SDK profile for C++.');
        if (/\.(?:c|h|inc)$/.test(path)) sources.push({ path, content: typeof file === 'string' ? file : file.text ?? file.content ?? file.conteudo });
      }
      if (!sources.some((source) => source.path.endsWith('.c'))) throw new Error('No C translation unit found.');
      if (selected && [...selected].some((path) => !sources.some((source) => source.path === path))) throw new Error('A configured C translation unit is missing or excluded.');
      root.SYNAPSE_CATALOGO.registrarTudo(root.SYNAPSE_TOOLCHAINS);
      const toolchain = await root.SYNAPSE_TOOLCHAINS.carregar('wcc-wasi', { sinal: options.signal, aoProgresso: options.onProgress });
      const result = await root.SYNAPSE_COMPILER_RESOURCES.runWorker('c-compiler.worker.js', { tipo: 'compilar', files: sources, resources: toolchain.arquivos, options: buildOptions }, { signal: options.signal, timeoutMs: 60000, onOutput: options.onOutput });
      const wasm = await root.SYNAPSE_WASI_ARTIFACTS.bytes(result.wasm);
      root.SYNAPSE_WASI_ARTIFACTS.inspect(await WebAssembly.compile(wasm));
      return { kind: 'wasi', runtime: 'wasi-preview1', path: settings?.artifact || 'main.wasm', wasm, settings: settings || {}, compiled: true };
    }
    function cancel() {
      currentOperation?.abort();
      currentPanel?._largar();
      currentPanel = null;
    }
    async function preview(options = {}) {
      cancel();
      const operation = new AbortController();
      currentOperation = operation;
      const abort = () => operation.abort();
      options.signal?.addEventListener('abort', abort, { once: true });
      if (options.signal?.aborted) abort();
      let panel;
      const valid = () => !operation.signal.aborted && currentOperation === operation && options.shouldMount?.() !== false;
      const check = () => { if (!valid()) throw root.SYNAPSE_WORKER_TASK.canceledError(); };
      const guard = setInterval(() => {
          try { if (!valid()) operation.abort(); }
          catch { operation.abort(); }
        }, 125);
      const emit = (stream, text) => {
        check();
        panel?.saida(stream === 'stderr' ? 'err' : stream === 'stdout' ? 'out' : stream, text);
        options.aoSaida?.(stream, text);
      };
      const log = (nivel, texto) => {
        check();
        if (nivel === 'aviso') panel?.aviso(texto);
        else panel?.sistema(texto);
        options.aoLog?.({ nivel, codigo: 'wasi-preview1', texto });
      };
      try {
        check();
        if (options.frame) {
          panel = new root.SYNAPSE_ORQUESTRADOR.Painel(options.frame);
          currentPanel = panel;
          options.frame.removeAttribute('src');
          options.frame.srcdoc = root.SYNAPSE_SHELL.montar({ titulo: 'WASI Preview 1', modo: 'console', interativo: false, rotulos: options.rotulos });
        }
        const files = root.SYNAPSE_WASI_ARTIFACTS.fileMap(options.arquivos);
        let artifact = options.artifact;
        if (!artifact && files.has('synapse.preview.json')) {
          const profile = root.SYNAPSE_NATIVE_BUILD_CONFIG.profile(files);
          if (profile === 'wcc-wasi') artifact = await compile(files, { signal: operation.signal, onOutput: emit });
          else if (profile !== 'wasi-artifact') throw new Error('Use Build & Run with the ' + profile + ' profile to compile and synchronize a fresh WASI artifact. Automatic preview never starts Relay commands or runs a stale source build.');
          else artifact = await root.SYNAPSE_WASI_ARTIFACTS.find(files);
        }
        if (!artifact && options.plano?.tipo === 'c' && options.plano.nivel === 1) artifact = await compile(files, { signal: operation.signal, onOutput: emit, onProgress: (value) => { check(); panel?.progresso(value.pct, value.recurso || 'Compiler resources'); } });
        if (!artifact) artifact = await root.SYNAPSE_WASI_ARTIFACTS.find(files);
        check();
        if (!artifact.compiled && !options.freshBuild) log('aviso', 'Running an imported WASI artifact. Source changes require a new WASI build.');
        const settings = artifact.settings || {};
        panel?.estado('Running in an isolated Worker');
        const result = await root.SYNAPSE_COMPILER_RESOURCES.runWorker('executor.worker.js', { tipo: 'rodar', wasm: artifact.wasm, args: [artifact.path, ...(settings.args || options.args || [])], env: settings.env || {}, stdin: settings.stdin ?? options.stdin ?? '', limiteMs: settings.timeoutMs || options.limiteMs || 10000 }, { signal: operation.signal, timeoutMs: settings.timeoutMs || options.limiteMs || 10000, onOutput: emit });
        check();
        panel?.fim(result.codigo, result.ms);
        return { ok: result.codigo === 0, etapa: 'wasi-preview1', codigo: result.codigo, motivo: result.codigo === 0 ? '' : 'WASI program exited with code ' + result.codigo + '.' };
      } catch (error) {
        const canceled = error.cancelado || error.name === 'AbortError' || !valid();
        if (valid()) {
          panel?.erro(error.message);
          panel?.estado(canceled ? 'Canceled' : 'Failed');
        }
        return { ok: false, cancelado: canceled, etapa: 'wasi-preview1', motivo: error.message };
      } finally {
        clearInterval(guard);
        options.signal?.removeEventListener('abort', abort);
        if (valid()) panel?.soltar();
        else panel?._largar();
        if (currentOperation === operation) currentOperation = null;
      }
    }
    root.SYNAPSE_NATIVE_PREVIEW = { canHandle, compile, preview, cancel };
})(globalThis);
