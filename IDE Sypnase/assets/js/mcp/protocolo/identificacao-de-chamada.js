'use strict';
function mcpReqKey(pkt) {
  if (typeof window.mcpChaveDedupe === 'function') return window.mcpChaveDedupe(pkt);
  let b = '';
  try {
    b = JSON.stringify(pkt.body);
  } catch (e) {
    b = String(pkt.body);
  }
  let h = 5381;
  for (let i = 0; i < b.length; i++) {
    h = (((h << 5) + h) ^ b.charCodeAt(i)) >>> 0;
  }
  return (
    (pkt.ep != null ? String(pkt.ep) + '|' : '') + pkt.reqId + '|' + b.length + '|' + h.toString(36)
  );
}
function mcpReqVisto(key) {
  if (!MCP.seenReq) MCP.seenReq = new Map();
  if (typeof window.mcpVarrerDedupe === 'function') {
    window.mcpVarrerDedupe();
  } else {
    const nowT = Date.now();
    for (const [rk, rv] of MCP.seenReq) {
      if (rv && rv.done && nowT - (rv.t || 0) > MCP_SEEN_TTL) MCP.seenReq.delete(rk);
    }
  }
  return MCP.seenReq.get(key) || null;
}
