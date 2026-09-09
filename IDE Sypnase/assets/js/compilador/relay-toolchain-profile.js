'use strict';
(function synapseRelayToolchainProfile(root) {
    function relayCatalogEntry(toolchainId) {
      const catalog = root.SYNAPSE_CATALOGO;
      if (!catalog || !catalog.obter || !toolchainId) return null;
      const entry = catalog.obter(toolchainId);
      return entry && entry.execution === 'relay' ? entry : null;
    }

    function profileDefinition(profileId) {
      const profiles = root.SYNAPSE_BUILD_PROFILES;
      const definitions = profiles && profiles.definitions ? profiles.definitions : null;
      if (!definitions || !profileId) return null;
      return definitions[profileId] || null;
    }

    function resolve(toolchainId) {
      const entry = relayCatalogEntry(toolchainId);
      if (!entry) return null;
      const definition = profileDefinition(entry.buildProfile);
      if (!definition) return null;
      return {
        toolchainId: toolchainId,
        profileId: entry.buildProfile,
        profileLabel: definition.label || entry.buildProfile,
        buildCommands: (definition.build || []).slice(),
        runCommands: (definition.run || []).slice(),
        needsRelayTerminal: definition.mode === 'relay',
      };
    }

    root.SynapseRelayToolchainProfile = Object.freeze({ resolve: resolve });
})(globalThis);
