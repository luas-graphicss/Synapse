'use strict';
(function synapseRelayToolchainBuild(root) {
    function relayTerminalReady() {
      return typeof termTemComplemento === 'function' && !!termTemComplemento();
    }

    function buildPanel() {
      return root.SYNAPSE_BUILD && root.SYNAPSE_BUILD.execute ? root.SYNAPSE_BUILD : null;
    }

    function commandsText(plan) {
      return plan.buildCommands.join(' && ');
    }

    function start(plan) {
      if (!plan) return null;
      const commands = commandsText(plan);
      if (!commands)
      return {
        started: false,
        state: 'Build & Run · falta o comando',
        message: `Nivel 2 (${plan.toolchainId}): o toolchain esta no catalogo e usa o perfil ${plan.profileLabel} do Build & Run, que ainda nao tem comando de build. Abra Build & Run e informe o comando do seu projeto.`,
        reason: 'perfil sem comando de build',
      };
      const panel = buildPanel();
      if (!panel)
      return {
        started: false,
        state: 'Build & Run indisponivel',
        message: `Nivel 2 (${plan.toolchainId}): o toolchain compila pelo perfil ${plan.profileLabel} (${commands}), mas o painel Build & Run nao esta carregado nesta sessao. Recarregue a IDE e rode o build por lá.`,
        reason: 'painel de build nao carregado',
      };
      if (plan.needsRelayTerminal && !relayTerminalReady())
      return {
        started: false,
        state: 'Precisa do Relay para compilar',
        message: `Nivel 2 (${plan.toolchainId}): o toolchain esta no catalogo e compila pelo perfil ${plan.profileLabel} do Build & Run (${commands}). Ligue o Relay local com terminal no menu MCP para compilar daqui, ou importe o projeto junto com a pasta do build web pronta.`,
        reason: 'relay com terminal desligado',
      };
      try {
        panel.execute('build');
      } catch (error) {
        return {
          started: false,
          state: 'Build & Run recusou o build',
          message: `Nivel 2 (${plan.toolchainId}): o perfil ${plan.profileLabel} (${commands}) esta pronto, mas o Build & Run nao aceitou iniciar o build agora. Abra o painel Build & Run e rode o build manualmente.`,
          reason: 'build nao iniciou',
        };
      }
      return {
        started: true,
        state: 'Compilando pelo Relay',
        message: `Nivel 2 (${plan.toolchainId}): compilando pelo Relay com o perfil ${plan.profileLabel} do Build & Run (${commands}). O andamento e a saida aparecem no painel Build & Run.`,
        reason: 'build iniciado pelo Build & Run',
      };
    }

    root.SynapseRelayToolchainBuild = Object.freeze({ start: start });
})(globalThis);
