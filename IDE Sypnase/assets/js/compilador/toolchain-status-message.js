(function () {
    'use strict';
    const PENDING_LABEL = 'Toolchain nao configurado';
    const UNAVAILABLE_LABEL = 'Sem compilador no navegador';
    const RELAY_LABEL = 'Compilar pelo Relay';

    function catalogEntry(toolchainId) {
      const catalog = globalThis.SYNAPSE_CATALOGO;
      if (!catalog || typeof catalog.obter !== 'function') return null;
      return catalog.obter(toolchainId);
    }

    function withNotes(text, entry) {
      return entry.notas ? text + ' Detalhes: ' + entry.notas : text;
    }

    function relayAlternative(entry) {
      const fallback = globalThis.SynapseBrowserToolchainFallback;
      if (!fallback || typeof fallback.relayToolchainFor !== 'function') return '';
      const relay = fallback.relayToolchainFor(entry.id);
      if (!relay) return '';
      return ' Alternativa configurada: ' + relay.nome + ' (Build & Run pelo Relay).';
    }

    function describe(toolchainId) {
      const entry = catalogEntry(toolchainId);
      if (!entry)
      return {
        label: PENDING_LABEL,
        text: `O toolchain "${toolchainId}" nao existe em assets/js/compilador/catalogo.js. Nada foi compilado.`,
      };
      if (entry.execution === 'unavailable')
      return {
        label: UNAVAILABLE_LABEL,
        text:
        withNotes(
          `"${entry.id}" (${entry.nome}) nao tem compilador verificado para rodar dentro do navegador, entao nao ha URL de download para preencher no catalogo. Nada foi baixado nem compilado. Compile na sua maquina com Build & Run pelo Relay e importe a saida web completa.`,
          entry,
        ) + relayAlternative(entry),
      };
      if (entry.execution === 'relay')
      return {
        label: RELAY_LABEL,
        text: withNotes(
          `"${entry.id}" (${entry.nome}) compila fora do navegador. Configure Build & Run com o Relay na sua maquina e importe o resultado; o navegador so executa a saida gerada.`,
          entry,
        ),
      };
      return {
        label: PENDING_LABEL,
        text: `O toolchain "${entry.id}" ainda nao tem urls, bytes e sha256 preenchidos em assets/js/compilador/catalogo.js. Nada foi compilado. Siga docs/historico/compilador-VERIFICAR.md para preencher e conferir o download.`,
      };
    }

    globalThis.SynapseToolchainStatus = { describe };
})();
