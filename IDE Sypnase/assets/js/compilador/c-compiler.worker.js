'use strict';
importScripts('native-build-config.js', 'wasi.js', 'toolchain-archive.js', 'compiler-filesystem.js', 'c-compiler-core.js');
let accepted = false;
self.onmessage = async ({ data }) => {
  if (accepted || data?.tipo !== 'compilar') return;
  accepted = true;
  try {
    const wasm = await SYNAPSE_C_COMPILER_CORE.compile(
      data.files,
      data.resources?.['wccfiles.zip'],
      { archive: SYNAPSE_TOOLCHAIN_ARCHIVE, filesystem: SYNAPSE_COMPILER_FILESYSTEM, wasi: SYNAPSE_WASI },
      (fluxo, texto) => postMessage({ tipo: 'saida', fluxo, texto }),
      data.options,
    );
    postMessage({ tipo: 'compilado', wasm }, [wasm.buffer]);
  } catch (error) {
    postMessage({ tipo: 'falha', texto: error.message || String(error) });
  }
};
