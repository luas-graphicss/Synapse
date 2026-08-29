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
		p = p.replace(/\/+$/, '');
		if (!/^https?:\/\//i.test(p)) {
			try {
				registro.aviso('[synapse] ?relay= ignorado, precisa comecar com http:// ou https://');
			} catch (e) {
				ignorarErro(e, 'auroraRelayPelaURL');
			}
			return;
		}
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
