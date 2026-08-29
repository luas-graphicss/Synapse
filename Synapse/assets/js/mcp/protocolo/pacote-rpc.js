'use strict';
function mcpPacotesRpc(m) {
	if (!m) return [];
	let lista = null;
	if (Array.isArray(m)) lista = m;
	else if (Array.isArray(m.items)) lista = m.items;
	else if (Array.isArray(m.batch)) lista = m.batch;
	else if (Array.isArray(m.events)) lista = m.events;
	else if (m.reqId != null) lista = [m];
	else return [];
	const out = [];
	for (let i = 0; i < lista.length; i++) {
		const it = lista[i];
		if (it && it.reqId != null && it.body != null)
			out.push({
				reqId: it.reqId,
				ep: it.ep != null ? it.ep : m && m.ep != null ? m.ep : null,
				body: it.body,
			});
	}
	return out;
}
try {
	window.mcpPacotesRpc = mcpPacotesRpc;
} catch (e) {
	ignorarErro(e, 'pacote-rpc');
}
