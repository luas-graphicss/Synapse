'use strict';
(function auroraRelayPelaURL() {
    try {
      let p = null;
      try {
        p = new URLSearchParams(location.search).get('relay');
      } catch (e) {
        ignorarErro(e, 'auroraRelayPelaURL');
      }
      if (!p && location.hash) {
        try {
          p = new URLSearchParams(location.hash.replace(/^#/, '')).get('relay');
        } catch (e) {
          ignorarErro(e, 'auroraRelayPelaURL');
        }
      }
      if (!p) return;
      p = String(p).trim();
      if (p === 'reset' || p === 'padrao') {
        try {
          localStorage.removeItem('aurora.mcp.relay');
        } catch (e) {
          ignorarErro(e, 'auroraRelayPelaURL');
        }
        try {
          MCP.relay = '';
        } catch (e) {
          ignorarErro(e, 'auroraRelayPelaURL');
        }
        try {
          registro.debug('[synapse] relay resetado para o padrao do arquivo');
        } catch (e) {
          ignorarErro(e, 'auroraRelayPelaURL');
        }
        return;
      }
      const destino = window.SynapseRelayUrlPolicy.safeRelayUrl(p);
      if (!destino) {
        try {
          registro.aviso('[synapse] ?relay= ignorado: use https:// (ou http:// apenas em localhost)');
        } catch (e) {
          ignorarErro(e, 'auroraRelayPelaURL');
        }
        return;
      }
      if (!confirm(`Trocar o relay do MCP para ${destino}? Todo o trafego do MCP vai passar por esse endereco.`)) {
        try {
          registro.aviso('[synapse] ?relay= recusado pelo usuario');
        } catch (e) {
          ignorarErro(e, 'auroraRelayPelaURL');
        }
        return;
      }
      p = destino;
      try {
        localStorage.setItem('aurora.mcp.relay', p);
      } catch (e) {
        ignorarErro(e, 'auroraRelayPelaURL');
      }
      try {
        MCP.relay = p;
      } catch (e) {
        ignorarErro(e, 'auroraRelayPelaURL');
      }
      try {
        registro.debug('[synapse] relay definido pela URL:', p);
      } catch (e) {
        ignorarErro(e, 'auroraRelayPelaURL');
      }
    } catch (e) {
      ignorarErro(e, 'auroraRelayPelaURL');
    }
})();

function mcpNewSession() {
  MCP.sid = mcpRand(10);
  MCP.token = mcpRand(24);
  mcpSaveCfg();
}
function MCP_HDRS() {
  return { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' };
}
function mcpBase() {
  return (MCP.relay || '').trim().replace(/\/+$/, '');
}
