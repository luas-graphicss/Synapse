(function (root) {
    'use strict';

    function isNotion(connection) {
      return connection?.prov === 'notion' || connection?.formato === 'notion-agents';
    }

    function isLegacyDefault(connection) {
      return (
        isNotion(connection) &&
        connection.notionCredentialVersion !== 1 &&
        (connection.padrao === true || connection.id === 'notion-padrao')
      );
    }

    function token(connection, volatileKeys = {}) {
      if (!connection || isLegacyDefault(connection)) return '';
      const supplied = connection.chave || volatileKeys[connection.id] || '';
      return typeof supplied === 'string' ? supplied.trim() : '';
    }

    function migrate(state) {
      let changed = false;
      for (const connection of state.conexoes || []) {
        if (!isLegacyDefault(connection)) continue;
        connection.chave = '';
        connection.guardarChave = false;
        connection.padrao = false;
        connection.notionCredentialVersion = 1;
        if (connection.nome === 'Notion · Agentes (pronto para usar)')
        connection.nome = 'Notion · Agentes';
        if (state.chavesVolateis) delete state.chavesVolateis[connection.id];
        changed = true;
      }
      return changed;
    }

    root.SynapseNotionCredentials = Object.freeze({ token, migrate });
})(globalThis);
