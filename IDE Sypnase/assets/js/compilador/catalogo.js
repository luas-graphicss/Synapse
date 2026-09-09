(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.SYNAPSE_CATALOGO = api;
})(globalThis, function () {
    'use strict';
    const catalog = [
      {
        id: 'wcc-wasi', nome: 'WCC · C console → WASI', linguagens: ['c'], nivel: 1,
        versao: 'sha256-a7c07101e79b1520', verificado: true, execution: 'browser', buildProfile: 'wcc-wasi',
        notas: 'Build & Run compiles C in an isolated Worker. Configure sources, includeDirectories and defines with build.profile wcc-wasi in synapse.preview.json. No C++, native GUI, threads or host filesystem.',
        recursos: [{ nome: 'wccfiles.zip', urls: [globalThis.SYNAPSE_COMPILER_RESOURCES?.resolve('../../vendor/wcc/wccfiles.zip') || 'assets/vendor/wcc/wccfiles.zip', 'https://tyfkda.github.io/xcc/wccfiles.zip'], bytes: 166188, sha256: 'a7c07101e79b1520d4b1cf2134ee157a4dd984384985d970df3702c74a2e873f' }],
      },
      {
        id: 'clang-wasi', nome: 'C / C++ · WASI SDK via Relay', linguagens: ['c', 'cpp'], nivel: 2,
        execution: 'relay', buildProfile: 'cmake-wasi', verificado: false, recursos: [],
        notas: 'Use Build & Run → C / C++ WASI SDK preset. Install WASI SDK and CMake in the connected computer; provide configure/build presets named wasi and select the .wasm artifact in synapse.preview.json. No browser Clang download is bundled.',
      },
      {
        id: 'cargo-wasm', nome: 'Rust · Cargo → WASI via Relay', linguagens: ['rust'], nivel: 2,
        execution: 'relay', buildProfile: 'cargo-wasi', verificado: false, recursos: [],
        notas: 'Use Build & Run → Rust Cargo WASI. Install Rust and rustup target add wasm32-wasip1. For standalone main.rs use the rustc WASI profile. The browser runs the synchronized WASI command, not a native executable or wasm-bindgen module.',
      },
      {
        id: 'emscripten', nome: 'Emscripten · web bundle via Relay', linguagens: ['c', 'cpp'], nivel: 2,
        execution: 'relay', buildProfile: 'custom', verificado: false, recursos: [],
        notas: 'Install Emscripten on the connected computer and configure its project build command in Build & Run. Import the complete HTML/JavaScript/WASM/assets output for the existing web preview. Emscripten imports are not WASI commands.',
      },
      {
        id: 'avalonia-browser', nome: 'Avalonia · browser target via Relay', linguagens: ['csharp'], nivel: 2,
        execution: 'relay', buildProfile: 'dotnet', verificado: false, recursos: [],
        notas: 'Publish an Avalonia browser project with an installed .NET SDK/browser workload and import its complete web output. Desktop Avalonia, WPF and WinForms binaries cannot run in a browser.',
      },
      {
        id: 'roslyn-wasm', nome: 'C# · browser compiler unavailable', linguagens: ['csharp'], nivel: 1,
        execution: 'unavailable', buildProfile: 'dotnet', verificado: false, recursos: [], relayFallback: 'dotnet-relay',
        notas: 'No verified Roslyn browser compiler/runtime adapter is bundled. Build & Run supports native .NET through Relay; browser preview requires a separate browser target and its complete web output.',
      },
      {
        id: 'dotnet-relay', nome: '.NET via Relay (Build & Run)', linguagens: ['csharp'], nivel: 2,
        execution: 'relay', buildProfile: 'dotnet', verificado: false, recursos: [],
        notas: 'Install a .NET SDK on the connected computer and build with Build & Run through Relay. The browser only executes a published browser target: import its complete web output for the preview.',
      },
      {
        id: 'go-wasm', nome: 'Go · external WebAssembly build', linguagens: ['go'], nivel: 2,
        execution: 'relay', buildProfile: 'go', verificado: false, recursos: [],
        notas: 'Build a Go wasip1/wasm command externally and import it with the WASI binary profile. A js/wasm program requires its matching wasm_exec.js web loader. The native Go profile alone does not produce a browser preview.',
      },
      {
        id: 'flutter-web', nome: 'Flutter · web build via Relay', linguagens: ['dart'], nivel: 2,
        execution: 'relay', buildProfile: 'flutter-web', verificado: false, recursos: [],
        notas: 'Install the Flutter SDK on the connected computer and use Build & Run with the Flutter web profile: flutter pub get followed by flutter build web. Import or keep the generated build/web output for the preview. The Dart compiler does not run inside the browser.',
      },
      {
        id: 'pyodide', nome: 'Python · browser runtime unavailable', linguagens: ['python'], nivel: 1,
        execution: 'unavailable', verificado: false, recursos: [],
        notas: 'No verified Pyodide resource bundle or runtime adapter is installed. Python sources are not compiled by the C/WASI backend. Use a configured external build or a complete web application.',
      },
    ];
    const clone = (value) => JSON.parse(JSON.stringify(value));
    function registrarTudo(motor = globalThis.SYNAPSE_TOOLCHAINS) {
      const result = { registrados: [], pendentes: [], externos: [], indisponiveis: [] };
      for (const entry of catalog) {
        if (entry.execution === 'relay') result.externos.push(entry.id);
        else if (entry.execution === 'unavailable') result.indisponiveis.push(entry.id);
        else if (motor && entry.verificado === true && entry.recursos.length && entry.recursos.every((resource) => resource.urls?.length && /^[a-f0-9]{64}$/i.test(resource.sha256 || ''))) {
          motor.registrar(clone(entry));
          result.registrados.push(entry.id);
        } else result.pendentes.push(entry.id);
      }
      return result;
    }
    function porLinguagem(language) {
      const entry = catalog.find((item) => item.linguagens.includes(language));
      return entry ? clone(entry) : null;
    }
    function obter(id) {
      const entry = catalog.find((item) => item.id === id);
      return entry ? clone(entry) : null;
    }
    return { listar: () => clone(catalog), obter, porLinguagem, registrarTudo, get CATALOGO() { return clone(catalog); } };
});
