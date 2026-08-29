'use strict';
function termProjName(proj) {
	return proj.name || 'projeto-' + proj.id;
}
function termFilesOf(proj) {
	const out = [];
	proj.files.forEach((f, p) => {
		if (f && typeof f.text === 'string') out.push({ path: p, text: f.text });
		else if (f && f.data && f.data.length <= 12 * 1024 * 1024)
			out.push({ path: p, b64: _b64(f.data) });
	});
	return out;
}
async function termSync(proj) {
	const all = termFilesOf(proj);
	const paths = [...proj.files.keys()];
	const MAXB = 30 * 1024 * 1024;
	let batch = [];
	let size = 0;
	for (const f of all) {
		const sz = (f.text != null ? f.text.length : f.b64 ? f.b64.length : 0) + f.path.length + 32;
		if (batch.length && size + sz > MAXB) {
			await termApi('sync', { project: termProjName(proj), files: batch, prune: false });
			batch = [];
			size = 0;
		}
		batch.push(f);
		size += sz;
	}
	return termApi('sync', {
		project: termProjName(proj),
		files: batch,
		prune: true,
		allPaths: paths,
	});
}
function termEcho(kind, text) {
	const o = $('#termOut');
	if (!o) return;
	const d = document.createElement('div');
	d.className = 't-' + kind;
	d.textContent = String(text).replace(/\r/g, '');
	o.appendChild(d);
	while (o.childNodes.length > 1500) o.removeChild(o.firstChild);
	o.scrollTop = o.scrollHeight;
}
function termCwdShow(dir) {
	const c = $('#termCwd');
	if (c) {
		c.textContent = dir || '';
		c.title = dir || '';
	}
}
function termPromptState() {
	const i = $('#termIn');
	if (i) i.disabled = !!TERM.busy;
	const p = $('#termPrompt');
	if (p) p.textContent = TERM.busy ? '…' : '>';
}
function termOpen(open) {
	TERM.open = !!open;
	const p = $('#termPane');
	if (p) p.classList.toggle('open', TERM.open);
	const b = $('#termBtn');
	if (b) b.classList.toggle('on', TERM.open);
	if (TERM.open) {
		if (!TERM.greeted) {
			TERM.greeted = true;
			termEcho(
				'sys',
				'Os comandos rodam no SEU computador, na pasta espelhada do projeto (relay). Configure a URL do relay no menu MCP se ainda nao configurou.',
			);
		}
		const i = $('#termIn');
		if (i && !TERM.busy) setTimeout(() => i.focus(), 60);
	}
}
async function termStart(proj, cmd, who) {
	const s = await termSync(proj);
	termCwdShow(s.dir || '');
	if (s.locked && s.locked.length)
		termEcho(
			'sys',
			`aviso: ${s.locked.length} arquivo(s) em uso nao foram atualizados no disco: ${s.locked.slice(0, 5).join(', ')}`,
		);
	termEcho(who === 'agent' ? 'agent' : 'cmd', (who === 'agent' ? '[agente] > ' : '> ') + cmd);
	let r = null,
		tentRun = 0;
	while (true) {
		try {
			r = await termApi('run', { project: termProjName(proj), command: cmd });
			break;
		} catch (eRun) {
			const mRun = String((eRun && eRun.message) || eRun);
			if (++tentRun > 6 || !/processos simultaneos|HTTP 429/i.test(mRun)) throw eRun;
			termEcho('sys', `relay lotado (${tentRun}/6), esperando vaga: ${mRun.slice(0, 110)}`);
			await (window.bgEspera
				? window.bgEspera(2000 + tentRun * 1500)
				: new Promise(function (rs) {
						setTimeout(rs, 2000 + tentRun * 1500);
					}));
		}
	}
	try {
		tmCmdNoteProc(r.procId, who, cmd, proj);
	} catch (e) {
		ignorarErro(e, 'termStart');
	}
	if (r.reused)
		termEcho(
			'sys',
			`(comando identico ja em execucao - reaproveitando o processo ${r.procId}, sem duplicar)`,
		);
	if (who === 'user') TERM.cur = { procId: r.procId };
	if (TERM.echoed[r.procId] == null) TERM.echoed[r.procId] = 0;
	return r.procId;
}
async function termWait(proj, procId, waitMs) {
	const t0 = Date.now();
	let acc = '';
	let from = 0;
	let st = null;
	while (true) {
		st = await termApi('out', { procId: procId, from: from });
		if (st.text) {
			acc += st.text;
			const seen = TERM.echoed[procId] || 0;
			const end = from + st.text.length;
			if (end > seen) {
				termEcho('out', st.text.slice(Math.max(0, seen - from)));
				TERM.echoed[procId] = end;
			}
		}
		from = st.next || from;
		if (st.done) break;
		if (Date.now() - t0 >= waitMs) break;
		await (window.bgEspera ? window.bgEspera(500) : new Promise((rs) => setTimeout(rs, 500)));
	}
	let note = '';
	if (st && st.done) {
		if (TERM.cur && TERM.cur.procId === procId) TERM.cur = null;
		try {
			note = await termApplyChanges(proj);
		} catch (e) {
			note = 'falha ao sincronizar de volta: ' + ((e && e.message) || e);
		}
		termEcho('sys', `— fim (codigo ${st.code})${note ? ' · ' + note : ''}`);
		delete TERM.echoed[procId];
	}
	return { done: !!(st && st.done), code: st ? st.code : null, out: acc, note: note };
}
async function termApplyChanges(proj) {
	let n = 0,
		del = 0,
		ab = 0;
	const soDisco = [];
	let extra = false;
	const recusados = [];
	let scanParcial = false;
	for (let round = 0; round < 5; round++) {
		const ch = await termApi('changes', { project: termProjName(proj) });
		if (ch && ch.parcial) scanParcial = true;
		(ch.changed || []).forEach((it) => {
			if (!validRelPath(it.path)) return;
			let f = proj.files.get(it.path);
			if (!f) {
				f = newFileEntry(it.path);
				f.isText = true;
				f.data = null;
				f.text = it.text;
				f.history = [{ t: Date.now(), text: it.text }];
				f.doDisco = true;
				proj.files.set(it.path, f);
			} else {
				if (f.text === it.text) return;
				mcpHist(f);
				f.isText = true;
				f.data = null;
				f.text = it.text;
			}
			if (it.enc === 'latin1')
				mcpLog('warn', 'arquivo nao era UTF-8, lido como latin1: ' + it.path);
			n++;
			mcpAfterWrite(proj, it.path);
		});
		const pedidos = (ch.deleted || []).filter((p) => proj.files.has(p));
		if (pedidos.length) {
			const limite = Math.max(DISCO.cfg.delMin, Math.ceil(proj.files.size * DISCO.cfg.delPct));
			const loteGrande = pedidos.length > limite;
			pedidos.forEach((p) => {
				const f = proj.files.get(p);
				const liberado =
					!ch.parcial && !loteGrande && (!DISCO.cfg.exigirOrigem || !!(f && f.doDisco));
				if (!liberado) {
					recusados.push(p);
					return;
				}
				discoLixo(proj, p, f);
				mcpDeleteOne(proj, p);
				del++;
			});
		}
		(ch.binaries || []).forEach((it) => {
			if (!validRelPath(it.path)) return;
			if (it.b64) {
				try {
					const bytes = b64ToBytes(it.b64);
					const antigo = proj.files.get(it.path);
					const nf = makeFileEntry(it.path, bytes);
					nf.doDisco = antigo ? !!antigo.doDisco : true;
					proj.files.set(it.path, nf);
					ab++;
					mcpAfterWrite(proj, it.path);
				} catch (e) {
					soDisco.push(it.path);
				}
			} else soDisco.push(it.path);
		});
		if (!ch.more) {
			extra = false;
			break;
		}
		extra = true;
	}
	if (recusados.length) {
		DISCO.recusas.unshift({
			proj: proj.id,
			nome: proj.name,
			qtd: recusados.length,
			parcial: scanParcial,
			paths: recusados.slice(0, 400),
			at: Date.now(),
		});
		while (DISCO.recusas.length > 20) DISCO.recusas.pop();
		termEcho(
			'err',
			`PROTECAO DE PROJETO: o disco pediu para apagar ${recusados.length} arquivo(s) do editor${scanParcial ? ' (a leitura da pasta veio incompleta)' : ''} \
e NADA foi apagado no site. Exemplos: ${recusados.slice(0, 4).join(', ')}${recusados.length > 4 ? ' ...' : ''}. \
O site vai reescrever esses arquivos no disco. Detalhes: SYNAPSE_DISCO.estado()`,
		);
		try {
			mcpLog(
				'warn',
				`protecao de projeto: ${recusados.length} exclusao(oes) vindas do disco recusadas${scanParcial ? ' (scan parcial)' : ''}`,
			);
		} catch (e) {
			ignorarErro(e, 'termApplyChanges');
		}
		if (Date.now() - DISCO.ultRestauro > DISCO.cfg.restauroMs) {
			DISCO.ultRestauro = Date.now();
			try {
				await termSync(proj);
			} catch (e) {
				ignorarErro(e, 'termApplyChanges');
			}
		}
	}
	if (del) {
		if (proj.id === State.active) {
			renderTree();
			renderEditorTabs();
			scheduleBuild(proj);
		}
		saveSession();
	}
	const parts = [];
	if (n) parts.push(n + ' arquivo(s) atualizados no editor');
	if (ab) parts.push(ab + ' asset(s) binario(s) atualizados');
	if (del) parts.push(del + ' removido(s)');
	if (soDisco.length) parts.push(soDisco.length + ' arquivo(s) grande(s) so no disco');
	if (recusados.length)
		parts.push(recusados.length + ' exclusao(oes) do disco RECUSADAS (protecao de projeto)');
	if (extra)
		parts.push(
			'ha mais alteracoes no disco (rode command_output ou outro comando para continuar a sincronizacao)',
		);
	return parts.join(', ');
}
function termReport(r, procId) {
	const tail = r.out.length > 30000 ? '…(inicio da saida omitido)…\n' + r.out.slice(-30000) : r.out;
	if (r.done)
		return (
			'Comando finalizado (exit code ' +
			r.code +
			').' +
			(r.note ? ` ${r.note}.` : '') +
			'\n--- saida ---\n' +
			(tail || '(sem saida)')
		);
	return `Ainda em execucao (proc_id: ${procId}). Chame command_output com este proc_id para continuar \
acompanhando (ou stop_command para encerrar).\n--- saida ate agora ---\n${tail || '(sem saida ainda)'}`;
}
async function termRunManual(cmd) {
	if (!termBase()) {
		termEcho(
			'err',
			'Configure o endereço do Synapse Relay no menu MCP (ex.: http://localhost:8787) e execute \"node relay.js\" (Node 18+).',
		);
		return;
	}
	const proj = activeProject();
	if (!proj) {
		termEcho('err', 'Nenhum projeto aberto. Importe um .zip ou crie um projeto.');
		return;
	}
	TERM.busy = true;
	termPromptState();
	try {
		const id = await termStart(proj, cmd, 'user');
		await termWait(proj, id, 600000);
	} catch (e) {
		termEcho('err', String((e && e.message) || e));
	} finally {
		TERM.busy = false;
		termPromptState();
		const i = $('#termIn');
		if (i) setTimeout(() => i.focus(), 30);
	}
}
function wireTerm() {
	termLoadCfg();
	const btn = $('#termBtn');
	if (btn) btn.addEventListener('click', () => termOpen(!TERM.open));
	const cl = $('#termClose');
	if (cl) cl.addEventListener('click', () => termOpen(false));
	const cc = $('#termClear');
	if (cc)
		cc.addEventListener('click', () => {
			const o = $('#termOut');
			if (o) o.innerHTML = '';
		});
	const stp = $('#termStop');
	if (stp)
		stp.addEventListener('click', async () => {
			if (!TERM.cur) {
				termEcho('sys', 'Nenhum comando em execucao.');
				return;
			}
			try {
				await termApi('kill', { procId: TERM.cur.procId });
				termEcho('sys', '— interrompido');
			} catch (e) {
				termEcho('err', String((e && e.message) || e));
			}
		});
	const inp = $('#termIn');
	if (inp)
		inp.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				const v = inp.value.trim();
				if (v && !TERM.busy) {
					TERM.hist.push(v);
					if (TERM.hist.length > 100) TERM.hist.shift();
					TERM.hi = TERM.hist.length;
					inp.value = '';
					termRunManual(v);
				}
			} else if (e.key === 'ArrowUp') {
				if (TERM.hi > 0) {
					TERM.hi--;
					inp.value = TERM.hist[TERM.hi] || '';
					e.preventDefault();
				}
			} else if (e.key === 'ArrowDown') {
				if (TERM.hi < TERM.hist.length) {
					TERM.hi++;
					inp.value = TERM.hist[TERM.hi] || '';
					e.preventDefault();
				}
			}
		});
	const ck = $('#mcpTermAllow');
	if (ck) {
		ck.checked = TERM.allow;
		ck.addEventListener('change', () => {
			TERM.allow = ck.checked;
			termSaveCfg();
			mcpLog('ok', `Terminal para o agente ${TERM.allow ? 'ATIVADO' : 'desativado'}.`);
			mcpRenderPanel();
		});
	}
	const tl = document.getElementById('mcpTermList');
	if (tl) {
		tl.value = (TERM.allowList || []).join('\n');
		tl.addEventListener('input', () => {
			TERM.allowList = tl.value
				.split('\n')
				.map((s) => s.trim())
				.filter(Boolean);
			termSaveCfg();
		});
	}
}

const RELAY_SRC = `const SYNAPSE_DEPURAR =
	typeof process !== 'undefined' && !!process.env && process.env.SYNAPSE_DEPURAR === '1';

function ignorarErro(erro, contexto) {
	if (!SYNAPSE_DEPURAR) return;
	const detalhe = (erro && erro.message) || erro;
	console.warn(\`[Synapse] falha tolerada em \${contexto || 'contexto nao informado'}:\`, detalhe);
}

('use strict');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const spawn = require('child_process').spawn;
const SDec = require('string_decoder').StringDecoder;
const NL = String.fromCharCode(10);
const PORT = process.env.PORT || 8787;
const MAX_BODY = 64 * 1024 * 1024;
const TIMEOUT_MS = Number(process.env.AURORA_TIMEOUT_MS || 60000);
const VERSION = 'v9.8';
const WORK = process.env.AURORA_WORK || path.join(process.cwd(), 'aurora-projects');
const IGNORE = ['node_modules', '.git', '.cache', '.next', '.vercel', '.DS_Store'];
const SCAN_MAX = Math.max(50, Number(process.env.AURORA_SCAN_MAX || 0) || 20000);
const MAX_PROCS = Math.max(4, Number(process.env.AURORA_MAX_PROCS || 0) || 24);
const sessions = new Map();
const ALLOW_ORIGIN = String(process.env.AURORA_ALLOW_ORIGIN || '').trim();
function origemPermitida(req) {
	if (!ALLOW_ORIGIN) return true;
	const o = String((req && req.headers && req.headers.origin) || '').replace(/\\/+$/, '');
	if (!o) return true;
	const lista = ALLOW_ORIGIN.split(',');
	for (let i = 0; i < lista.length; i++) {
		const x = String(lista[i] || '')
			.trim()
			.replace(/\\/+$/, '');
		if (x && (x === '*' || x === o)) return true;
	}
	return false;
}
function cors(res) {
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
	res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
	res.setHeader(
		'Access-Control-Allow-Headers',
		'Content-Type, Authorization, Accept, Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID, ngrok-skip-browser-warning, X-Requested-With, Cache-Control, Pragma',
	);
	res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
	res.setHeader('Access-Control-Allow-Private-Network', 'true');
	res.setHeader('Access-Control-Max-Age', '86400');
}
function sendJson(res, code, obj) {
	try {
		cors(res);
		res.writeHead(code, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify(obj));
	} catch (e) {
		ignorarErro(e, 'sendJson');
	}
}
function sseWrite(res, ev, data) {
	try {
		res.write(\`event: \${ev}\${NL}data: \${data}\${NL}\${NL}\`);
		return true;
	} catch (e) {
		return false;
	}
}
function readBody(req) {
	return new Promise(function (resolve, reject) {
		let len = 0;
		const chunks = [];
		req.on('data', function (c) {
			len += c.length;
			if (len > MAX_BODY) {
				reject(new Error('payload muito grande'));
				req.destroy();
				return;
			}
			chunks.push(c);
		});
		req.on('end', function () {
			resolve(Buffer.concat(chunks).toString('utf8'));
		});
		req.on('error', reject);
	});
}

const MAX_PENDING = Number(process.env.AURORA_MAX_PENDING || 4000);
const PER_WORKER = Number(process.env.AURORA_PER_WORKER || 128);
const GRACE_MS = Number(process.env.AURORA_GRACE_MS || 8000);
const CLIENT_TTL = Number(process.env.AURORA_CLIENT_TTL || 900000);
const QUEUE_MAX = Number(process.env.AURORA_QUEUE_MAX || 8192);

const PONG_MAX = Number(process.env.AURORA_PONG_MS || 30000);
const HS_TIMEOUT = Number(process.env.AURORA_HS_TIMEOUT_MS || 15000);
const CACHE_FILE = path.join(WORK, 'aurora-catalogo.json');
let META = { init: null, tools: null, at: 0 };
function salvarCache() {
	try {
		fs.mkdirSync(WORK, { recursive: true });
		fs.writeFileSync(CACHE_FILE, JSON.stringify(META));
	} catch (e) {
		ignorarErro(e, 'salvarCache');
	}
}
function carregarCache() {
	try {
		const j = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
		if (j && typeof j === 'object') META = j;
	} catch (e) {
		ignorarErro(e, 'carregarCache');
	}
}
carregarCache();
function nTools() {
	try {
		return (META.tools && META.tools.tools && META.tools.tools.length) || 0;
	} catch (e) {
		return 0;
	}
}

let AVISO_TRANSP = 0;
function avisarTransporteLocal(rota) {
	if (Date.now() - AVISO_TRANSP < 60000) return;
	AVISO_TRANSP = Date.now();
	console.log(
		\`[atencao] a aba esta usando ESTE relay local como TRANSPORTE do MCP (rota /\${rota}).\`,
	);
	console.log(
		'          No modo local o transporte deve ser a NUVEM; senao o conector do Notion fica com 0 ferramentas.',
	);
	console.log(
		'          No site: menu MCP > campo do relay = https://...workers.dev  |  campo local = http://localhost:8787',
	);
	console.log(
		'          O index.html v9.8 corrige isso sozinho ao ativar o MCP (recarregue o site com Ctrl+F5).',
	);
}
const WAF_MENOR = String.fromCharCode(8249);
function wafSanearTexto(s) {
	if (typeof s !== 'string' || !s) return s;
	let t = s;
	if (t.includes('<')) {
		t = t
			.replace(/<\\s*(\\/?)\\s*([A-Za-z][A-Za-z0-9:._-]{0,40})\\s*\\/?\\s*>/g, function (m, b, n) {
				return \`[\${b || ''}\${n}]\`;
			})
			.replace(/<\\s*(\\/?)\\s*([A-Za-z][A-Za-z0-9:._-]{0,40})/g, function (m, b, n) {
				return \`[\${b || ''}\${n}\`;
			})
			.replace(/</g, WAF_MENOR);
	}
	if (t.includes(':')) t = t.replace(/javascript\\s*:/gi, 'javascript :');
	if (t.includes('=')) t = t.replace(/\\bon([a-z]{3,15})\\s*=/gi, 'on$1 =');
	t = t.replace(/\\x24\\{/g, '\\x24 {');
	return t;
}
function wafSanearJson(obj) {
	try {
		if (obj == null || typeof obj !== 'object') return obj;
		const s = JSON.stringify(obj);
		if (!s.includes('<') && !s.includes('javascript')) return obj;
		return JSON.parse(wafSanearTexto(s));
	} catch (e) {
		return obj;
	}
}
function wafSanearRpc(resp) {
	try {
		if (!resp || typeof resp !== 'object' || !resp.result) return resp;
		resp.result = wafSanearJson(resp.result);
		return resp;
	} catch (e) {
		return resp;
	}
}

function initResult(params) {
	const conhecidas = ['2025-06-18', '2025-03-26', '2024-11-05'];
	const pv =
		params && conhecidas.includes(params.protocolVersion) ? params.protocolVersion : '2025-03-26';
	let out = null;
	try {
		out = META.init ? JSON.parse(JSON.stringify(META.init)) : null;
	} catch (e) {
		out = null;
	}
	if (!out)
		out = {
			capabilities: { tools: { listChanged: false } },
			serverInfo: { name: 'aurora-live-preview', title: 'Synapse Live Preview', version: '1.0.0' },
		};
	out.protocolVersion = pv;
	if (!out.capabilities) out.capabilities = { tools: { listChanged: false } };
	if (!out.serverInfo) out.serverInfo = { name: 'aurora-live-preview', version: VERSION };
	return out;
}
function aprenderMeta(pedido, resposta) {
	if (!pedido || Array.isArray(pedido) || !resposta || Array.isArray(resposta)) return;
	const m = pedido.method,
		r = resposta.result;
	if (!m || !r) return;
	if (m === 'initialize') {
		META.init = wafSanearJson(r);
		META.at = Date.now();
		salvarCache();
		return;
	}
	if (m === 'tools/list' && r.tools && r.tools.length) {
		const antes = nTools();
		META.tools = wafSanearJson(r);
		META.at = Date.now();
		salvarCache();
		if (antes !== r.tools.length)
			console.log(\`[mcp] catalogo aprendido com a aba: \${r.tools.length} ferramentas\`);
	}
}
function respostaFallback(metodo, body) {
	const idv = body && !Array.isArray(body) && body.id != null ? body.id : null;
	if (metodo === 'initialize')
		return { jsonrpc: '2.0', id: idv, result: initResult((body && body.params) || {}) };
	if (metodo === 'tools/list' && nTools()) return { jsonrpc: '2.0', id: idv, result: META.tools };
	return null;
}

function sendJson(res, code, obj, hdrs) {
	try {
		cors(res);
		const h = { 'Content-Type': 'application/json' };
		if (hdrs) for (let k in hdrs) h[k] = hdrs[k];
		res.writeHead(code, h);
		res.end(JSON.stringify(obj));
	} catch (e) {
		ignorarErro(e, 'sendJson');
	}
}
function sendRetry(res, code, msg, seg, hdrs) {
	try {
		cors(res);
		const h = { 'Content-Type': 'application/json', 'Retry-After': String(seg || 1) };
		if (hdrs) for (let k in hdrs) h[k] = hdrs[k];
		res.writeHead(code, h);
		res.end(JSON.stringify({ error: msg, retryable: true }));
	} catch (e) {
		ignorarErro(e, 'sendRetry');
	}
}
function getSession(sid) {
	let s = sessions.get(sid);
	if (!s) {
		s = {
			token: null,
			workers: [],
			polls: [],
			clients: new Map(),
			queue: [],
			pending: new Map(),
			lastSeen: 0,
			seq: 1,
			wseq: 1,
			work: {},
			procs: new Map(),
			procSeq: 1,
			client: null,
			wsock: null,
			notion: null,
			poll: null,
			pollTimer: null,
			lastPoll: 0,
			enviados: new Map(),
		};
		sessions.set(sid, s);
	}
	return s;
}
function getClient(s, cid) {
	let c = s.clients.get(cid);
	if (!c) {
		c = { cid: cid, sse: null, lastSeen: Date.now() };
		s.clients.set(cid, c);
	}
	c.lastSeen = Date.now();
	return c;
}
function limparClients(s) {
	const t = Date.now();
	s.clients.forEach(function (c, cid) {
		if (!c.sse && t - c.lastSeen > CLIENT_TTL) s.clients.delete(cid);
	});
}
function vivoW(w) {
	if (!w || w.morto) return false;
	if (w.kind === 'ws') {
		if (!(w.sock && !w.sock.destroyed)) return false;
		if (w.lastPong && Date.now() - w.lastPong > PONG_MAX) return false;
		return true;
	}
	if (w.kind === 'sse') return !!(w.res && !w.res.writableEnded);
	return false;
}
function workersVivos(s) {
	const out = [];
	for (let i = 0; i < s.workers.length; i++) if (vivoW(s.workers[i])) out.push(s.workers[i]);
	if (out.length !== s.workers.length) s.workers = out;
	return out;
}
function capacidade(s) {
	return workersVivos(s).length * PER_WORKER;
}
function browserOnline(s) {
	if (!s) return false;
	if (workersVivos(s).length) return true;
	if (s.polls && s.polls.length) return true;
	return Date.now() - (s.lastSeen || 0) < GRACE_MS;
}
function escolherWorker(s) {
	let vs = workersVivos(s),
		melhor = null;
	for (let i = 0; i < vs.length; i++) {
		const w = vs[i];
		if (w.inflight.size >= PER_WORKER) continue;
		if (!melhor || w.inflight.size < melhor.inflight.size) melhor = w;
	}
	return melhor;
}
function enviarW(w, payload) {
	if (w.kind === 'ws') return wsSend(w.sock, payload);
	if (w.kind === 'sse') {
		try {
			return sseWrite(w.res, 'rpc', payload);
		} catch (e) {
			return false;
		}
	}
	return false;
}
function flushPoll(s) {
	while (s.polls.length && s.queue.length) {
		const res = s.polls.shift();
		if (res && res.__t) clearTimeout(res.__t);
		const lote = s.queue.splice(0, PER_WORKER);
		for (let i = 0; i < lote.length; i++) {
			const p0 = s.pending.get(lote[i].reqId);
			if (p0 && p0.graceTimer) {
				clearTimeout(p0.graceTimer);
				p0.graceTimer = null;
			}
		}
		sendJson(res, 200, { events: lote });
	}
}
function bombear(s) {
	while (s.queue.length) {
		const w = escolherWorker(s);
		if (!w) break;
		const obj = s.queue.shift();
		const p = s.pending.get(obj.reqId);
		if (!p) continue;
		if (!enviarW(w, JSON.stringify({ t: 'rpc', reqId: obj.reqId, body: obj.body, items: [obj] }))) {
			s.queue.unshift(obj);
			w.morto = true;
			workersVivos(s);
			continue;
		}
		w.inflight.add(obj.reqId);
		p.worker = w;
		if (p.graceTimer) {
			clearTimeout(p.graceTimer);
			p.graceTimer = null;
		}
	}
	if (s.queue.length && s.polls.length) flushPoll(s);
}
function deliver(s, obj) {
	if (s.queue.length >= QUEUE_MAX) return false;
	s.queue.push(obj);
	bombear(s);
	return true;
}
function entregarItens(s, itens, worker) {
	let ent = 0,
		exp = 0;
	for (let i = 0; i < itens.length; i++) {
		const itm = itens[i] || {};
		if (worker && worker.inflight) worker.inflight.delete(itm.reqId);
		const p = s.pending.get(itm.reqId);
		if (!p) {
			exp++;
			continue;
		}
		s.pending.delete(itm.reqId);
		if (p.timer) clearTimeout(p.timer);
		if (p.graceTimer) clearTimeout(p.graceTimer);
		if (p.worker && p.worker.inflight) p.worker.inflight.delete(itm.reqId);
		if (p.mode === 'sse') {
			const cl = s.clients.get(p.cid);
			if (itm.body != null && cl && cl.sse) sseWrite(cl.sse, 'message', JSON.stringify(itm.body));
		} else if (itm.body == null) {
			try {
				cors(p.res);
				p.res.writeHead(202);
				p.res.end();
			} catch (e) {
				ignorarErro(e, 'entregarItens');
			}
		} else sendJson(p.res, 200, itm.body, p.hdrs);
		try {
			aprenderMeta(p.body, itm.body);
		} catch (e) {
			ignorarErro(e, 'entregarItens');
		}
		ent++;
	}
	s.lastSeen = Date.now();
	bombear(s);
	return { delivered: ent, expired: exp };
}
function requeueWorker(s, w) {
	if (!w || !w.inflight || !w.inflight.size) return 0;
	let volta = 0;
	w.inflight.forEach(function (rid) {
		const p = s.pending.get(rid);
		if (!p) return;
		p.worker = null;
		if (s.queue.length >= QUEUE_MAX) return;
		s.queue.push({ reqId: rid, body: p.body });
		volta++;
	});
	w.inflight.clear();
	if (volta) bombear(s);
	return volta;
}
function requeueEnviados(s) {
	return 0;
}
function addWorker(s, w) {
	w.id = s.wseq++;
	w.inflight = new Set();
	w.morto = false;
	w.lastPong = Date.now();
	s.workers.push(w);
	s.lastSeen = Date.now();
	console.log(\`[ponte] aba conectada (\${w.kind}) - executores: \${workersVivos(s).length}\`);
	bombear(s);
	return w;
}
function removeWorker(s, w) {
	w.morto = true;
	const i = s.workers.indexOf(w);
	if (i >= 0) s.workers.splice(i, 1);
	const volta = requeueWorker(s, w);
	console.log(
		'[ponte] aba desconectada - executores: ' +
			workersVivos(s).length +
			(volta ? \` (devolvi \${volta} chamada(s) para a fila)\` : ''),
	);
}

function wsFrame(op, payload) {
	let len = payload.length,
		head;
	if (len < 126) {
		head = Buffer.allocUnsafe(2);
		head[0] = 0x80 | op;
		head[1] = len;
	} else if (len < 65536) {
		head = Buffer.allocUnsafe(4);
		head[0] = 0x80 | op;
		head[1] = 126;
		head.writeUInt16BE(len, 2);
	} else {
		head = Buffer.allocUnsafe(10);
		head[0] = 0x80 | op;
		head[1] = 127;
		head.writeUInt32BE(0, 2);
		head.writeUInt32BE(len, 6);
	}
	return Buffer.concat([head, payload]);
}
function wsSend(sock, str) {
	try {
		if (!sock || sock.destroyed) return false;
		sock.write(wsFrame(1, Buffer.from(str, 'utf8')));
		return true;
	} catch (e) {
		return false;
	}
}
function wsClose(sock) {
	try {
		sock.write(wsFrame(8, Buffer.alloc(0)));
		sock.end();
	} catch (e) {
		try {
			sock.destroy();
		} catch (e2) {
			ignorarErro(e2, 'wsClose');
		}
	}
}
function wsAttach(sock, onText, onClose, onPong) {
	let buf = Buffer.alloc(0),
		frags = [],
		fragOp = 0;
	sock.on('data', function (chunk) {
		buf = Buffer.concat([buf, chunk]);
		for (;;) {
			if (buf.length < 2) return;
			const b0 = buf[0],
				b1 = buf[1];
			let fin = (b0 & 0x80) !== 0,
				op = b0 & 0x0f,
				masked = (b1 & 0x80) !== 0,
				len = b1 & 0x7f,
				off = 2;
			if (len === 126) {
				if (buf.length < 4) return;
				len = buf.readUInt16BE(2);
				off = 4;
			} else if (len === 127) {
				if (buf.length < 10) return;
				if (buf.readUInt32BE(2) > 0) {
					wsClose(sock);
					return;
				}
				len = buf.readUInt32BE(6);
				off = 10;
			}
			if (len > MAX_BODY) {
				wsClose(sock);
				return;
			}
			const need = off + (masked ? 4 : 0) + len;
			if (buf.length < need) return;
			let data = buf.slice(off + (masked ? 4 : 0), need);
			if (masked) {
				const mask = buf.slice(off, off + 4),
					cp = Buffer.allocUnsafe(len);
				for (let i = 0; i < len; i++) cp[i] = data[i] ^ mask[i & 3];
				data = cp;
			} else data = Buffer.from(data);
			buf = buf.slice(need);
			if (op === 8) {
				wsClose(sock);
				return;
			}
			if (op === 9) {
				try {
					sock.write(wsFrame(10, data));
				} catch (e) {
					ignorarErro(e, 'wsAttach');
				}
				continue;
			}
			if (op === 10) {
				if (onPong)
					try {
						onPong();
					} catch (e) {
						ignorarErro(e, 'wsAttach');
					}
				continue;
			}
			if (op === 0) frags.push(data);
			else {
				frags = [data];
				fragOp = op;
			}
			if (fin) {
				const full = Buffer.concat(frags);
				frags = [];
				if (fragOp === 1) {
					try {
						onText(full.toString('utf8'));
					} catch (e) {
						ignorarErro(e, 'wsAttach');
					}
				}
				fragOp = 0;
			}
		}
	});
	sock.on('end', function () {
		try {
			sock.destroy();
		} catch (e) {
			ignorarErro(e, 'wsAttach');
		}
	});
	sock.on('close', function () {
		try {
			onClose();
		} catch (e) {
			ignorarErro(e, 'wsAttach');
		}
	});
	sock.on('error', function () {
		try {
			sock.destroy();
		} catch (e) {
			ignorarErro(e, 'wsAttach');
		}
	});
}
function sha1(buf) {
	return crypto.createHash('sha1').update(buf).digest('hex');
}
function msleep(ms) {
	try {
		Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
	} catch (e) {
		const t1 = Date.now() + ms;
		while (Date.now() < t1) {}
	}
}
function isLockErr(e) {
	const c = (e && e.code) || '';
	return c === 'EBUSY' || c === 'EPERM' || c === 'EACCES' || c === 'ETXTBSY' || c === 'UNKNOWN';
}
function writeFileRetry(abs, buf) {
	for (let a = 0; ; a++) {
		try {
			fs.writeFileSync(abs, buf);
			return;
		} catch (e) {
			if (!isLockErr(e) || a >= 6) throw e;
			msleep(50 * (a + 1));
		}
	}
}
function unlinkRetry(p) {
	for (let a = 0; ; a++) {
		try {
			fs.unlinkSync(p);
			return true;
		} catch (e) {
			if (e && e.code === 'ENOENT') return true;
			if (!isLockErr(e) || a >= 6) return false;
			msleep(50 * (a + 1));
		}
	}
}
function safeName(n) {
	n = String(n == null ? 'projeto' : n)
		.trim()
		.toLowerCase();
	let out = '';
	for (let i = 0; i < n.length && out.length < 60; i++) {
		const c = n[i];
		out += /[a-z0-9._-]/.test(c) ? c : '-';
	}
	out = out.replace(/^[.-]+/, '').replace(/[.-]+$/, '');
	return out || 'projeto';
}
function projDir(name) {
	return path.join(WORK, safeName(name));
}
function manifestFor(s, name) {
	const k = safeName(name);
	if (!s.work[k]) s.work[k] = {};
	return s.work[k];
}
function safeRel(p) {
	p = String(p == null ? '' : p)
		.replace(/\\\\/g, '/')
		.replace(/^\\/+/, '')
		.trim();
	if (!p || p.length > 500) return null;
	const segs = p.split('/');
	for (let i = 0; i < segs.length; i++) {
		const sg = segs[i];
		if (!sg || sg === '.' || sg === '..') return null;
		const sgBase = sg.split('.')[0].toLowerCase();
		if (
			sgBase === 'con' ||
			sgBase === 'prn' ||
			sgBase === 'aux' ||
			sgBase === 'nul' ||
			/^com[1-9]$/.test(sgBase) ||
			/^lpt[1-9]$/.test(sgBase)
		)
			return null;
		const sgLast = sg.charAt(sg.length - 1);
		if (sgLast === '.' || sgLast === ' ') return null;
		if (/[<>:"|?*]/.test(sg)) return null;
	}
	return segs.join('/');
}
function absFor(dir, rel) {
	return path.join(dir, rel.split('/').join(path.sep));
}
function scanDir(root) {
	const out = new Map();
	const stack = [''];
	let count = 0;
	out.parcial = false;
	while (stack.length) {
		const rel = stack.pop();
		const abs = rel ? path.join(root, rel.split('/').join(path.sep)) : root;
		let ents;
		try {
			ents = fs.readdirSync(abs, { withFileTypes: true });
		} catch (e) {
			out.parcial = true;
			continue;
		}
		for (let i = 0; i < ents.length; i++) {
			const en = ents[i];
			if (IGNORE.includes(en.name)) continue;
			const r = rel ? rel + '/' + en.name : en.name;
			if (en.isDirectory()) {
				stack.push(r);
				continue;
			}
			if (!en.isFile()) continue;
			if (++count > SCAN_MAX) {
				out.parcial = true;
				return out;
			}
			out.set(r, path.join(root, r.split('/').join(path.sep)));
		}
	}
	return out;
}
function termAction(s, act, b, res) {
	if (act === 'sync') {
		const dir = projDir(b.project);
		fs.mkdirSync(dir, { recursive: true });
		const man = manifestFor(s, b.project);
		const files = Array.isArray(b.files) ? b.files : [];
		const keep = {};
		let written = 0;
		const locked = [];
		for (let i = 0; i < files.length; i++) {
			const f = files[i];
			if (!f) continue;
			var rel = safeRel(f.path);
			if (!rel) continue;
			var buf = null;
			let h = null;
			if (typeof f.text === 'string') {
				buf = Buffer.from(f.text, 'utf8');
				h = sha1(buf);
			} else if (typeof f.b64 === 'string') {
				try {
					buf = Buffer.from(f.b64, 'base64');
				} catch (e) {
					continue;
				}
				h = 'B:' + sha1(buf);
			} else continue;
			keep[rel] = 1;
			if (man[rel] === h) continue;
			var abs = absFor(dir, rel);
			fs.mkdirSync(path.dirname(abs), { recursive: true });
			try {
				writeFileRetry(abs, buf);
				man[rel] = h;
				written++;
			} catch (e) {
				delete man[rel];
				locked.push(rel);
			}
		}
		let deleted = 0;
		if (b.prune !== false) {
			if (Array.isArray(b.allPaths)) {
				for (let q = 0; q < b.allPaths.length; q++) {
					const rq = safeRel(b.allPaths[q]);
					if (rq) keep[rq] = 1;
				}
			}
			const keys = Object.keys(man);
			for (let j = 0; j < keys.length; j++) {
				const k = keys[j];
				if (keep[k]) continue;
				const mh = String(man[k]);
				if (mh.slice(0, 6) === 'B:big:' || mh.slice(0, 7) === 'B:disk:') continue;
				if (unlinkRetry(absFor(dir, k))) {
					deleted++;
					delete man[k];
				}
			}
		}
		sendJson(res, 200, { written: written, deleted: deleted, dir: dir, locked: locked });
		return;
	}
	if (act === 'changes') {
		const dir2 = projDir(b.project);
		const man2 = manifestFor(s, b.project);
		if (b.fresh) {
			const fk = Object.keys(man2);
			for (let fi = 0; fi < fk.length; fi++) delete man2[fk[fi]];
		}
		let disk;
		try {
			disk = scanDir(dir2);
		} catch (e) {
			disk = new Map();
			disk.parcial = true;
		}
		const changed = [];
		const deleted2 = [];
		const binaries = [];
		let total = 0;
		let binTotal = 0;
		let more = false;
		disk.forEach(function (abs, rel) {
			let st;
			try {
				st = fs.statSync(abs);
			} catch (e) {
				return;
			}
			if (st.size > 12 * 1024 * 1024) {
				const hb = \`B:big:\${st.size}:\${st.mtimeMs}\`;
				if (man2[rel] !== hb) {
					binaries.push({ path: rel, size: st.size });
					man2[rel] = hb;
				}
				return;
			}
			let buf;
			try {
				buf = fs.readFileSync(abs);
			} catch (e) {
				return;
			}
			const isBin = buf.includes(0);
			if (!isBin && st.size > 1500000) {
				const hd = 'B:disk:' + sha1(buf);
				if (man2[rel] !== hd) {
					binaries.push({ path: rel, size: st.size });
					man2[rel] = hd;
				}
				return;
			}
			const h2 = (isBin ? 'B:' : '') + sha1(buf);
			if (man2[rel] === h2) return;
			if (isBin) {
				if (binTotal + st.size > 40 * 1024 * 1024) {
					binaries.push({ path: rel, size: st.size });
					more = true;
					return;
				}
				binTotal += st.size;
				binaries.push({ path: rel, size: st.size, b64: buf.toString('base64') });
				man2[rel] = h2;
				return;
			}
			let text = buf.toString('utf8');
			let encTxt = '';
			if (text.includes('\\uFFFD')) {
				text = buf.toString('latin1');
				encTxt = 'latin1';
			}
			if (total + text.length > 4000000) {
				more = true;
				return;
			}
			total += text.length;
			changed.push(encTxt ? { path: rel, text: text, enc: encTxt } : { path: rel, text: text });
			man2[rel] = h2;
		});
		const parcial = !!disk.parcial;
		if (!parcial) {
			const mkeys = Object.keys(man2);
			for (var m = 0; m < mkeys.length; m++) {
				if (!disk.has(mkeys[m])) {
					deleted2.push(mkeys[m]);
					delete man2[mkeys[m]];
				}
			}
		}
		sendJson(res, 200, {
			changed: changed,
			deleted: deleted2,
			binaries: binaries,
			more: more,
			parcial: parcial,
			vistos: disk.size,
		});
		return;
	}
	if (act === 'run') {
		const cmd = typeof b.command === 'string' ? b.command.trim() : '';
		if (!cmd || cmd.length > 16000) {
			sendJson(res, 400, { error: 'comando vazio ou longo demais' });
			return;
		}
		let running = 0;
		s.procs.forEach(function (r9) {
			if (!r9.done && !r9.exited) running++;
		});
		if (running >= MAX_PROCS) {
			sendJson(res, 429, {
				error: \`limite de \${MAX_PROCS} processos simultaneos no relay (\${running} ativos). NADA foi executado: repita a MESMA chamada em alguns segundos.\`,
				retry: true,
				running: running,
				limite: MAX_PROCS,
			});
			return;
		}
		if (s.procs.size >= 80) {
			const doneIds = [];
			s.procs.forEach(function (r8, pid8) {
				if (r8.done) doneIds.push({ id: pid8, t: r8.t0 });
			});
			doneIds.sort(function (a, b) {
				return a.t - b.t;
			});
			for (let e0 = 0; e0 < doneIds.length && s.procs.size >= 80; e0++)
				s.procs.delete(doneIds[e0].id);
		}
		const projKey = safeName(b.project);
		let dup = null;
		s.procs.forEach(function (r0, pid0) {
			if (
				!dup &&
				!r0.done &&
				!r0.exited &&
				r0.command === cmd &&
				r0.project === projKey &&
				Date.now() - r0.t0 < 10000
			)
				dup = pid0;
		});
		if (dup) {
			sendJson(res, 200, { procId: dup, dir: projDir(b.project), reused: true });
			return;
		}
		const dir3 = projDir(b.project);
		fs.mkdirSync(dir3, { recursive: true });
		const id = 'p' + s.procSeq++;
		let child;
		try {
			if (process.platform === 'win32')
				child = spawn('cmd.exe', ['/d', '/s', '/c', 'chcp 65001>nul & ' + cmd], {
					cwd: dir3,
					windowsHide: true,
				});
			else child = spawn('/bin/sh', ['-c', cmd], { cwd: dir3, detached: true });
		} catch (e) {
			sendJson(res, 500, { error: 'falha ao iniciar: ' + ((e && e.message) || e) });
			return;
		}
		const rec = {
			proc: child,
			out: '',
			done: false,
			exited: false,
			code: null,
			t0: Date.now(),
			command: cmd,
			project: projKey,
		};
		const addTxt = function (s) {
			if (!s) return;
			rec.out += s;
			if (rec.out.length > 2000000)
				rec.out = \`[saida antiga truncada]\${NL}\${rec.out.slice(-1500000)}\`;
		};
		const decOut = new SDec('utf8'),
			decErr = new SDec('utf8');
		const append = function (d) {
			addTxt(typeof d === 'string' ? d : decOut.write(d));
		};
		const appendErr = function (d) {
			addTxt(typeof d === 'string' ? d : decErr.write(d));
		};
		const flushDec = function () {
			try {
				addTxt(decOut.end());
			} catch (e) {
				ignorarErro(e, 'flushDec');
			}
			try {
				addTxt(decErr.end());
			} catch (e) {
				ignorarErro(e, 'flushDec');
			}
		};
		if (child.stdout) child.stdout.on('data', append);
		if (child.stderr) child.stderr.on('data', appendErr);
		child.on('error', function (e) {
			append(\`[erro ao executar: \${(e && e.message) || e}]\`);
			rec.done = true;
			rec.exited = true;
			rec.code = -1;
		});
		child.on('exit', function (code) {
			rec.exited = true;
			if (code != null) rec.code = code;
			setTimeout(function () {
				if (!rec.done) {
					rec.done = true;
					if (rec.code == null) rec.code = -1;
					setTimeout(function () {
						s.procs.delete(id);
					}, 600000);
				}
			}, 2000);
		});
		child.on('close', function (code) {
			flushDec();
			rec.exited = true;
			if (rec.code == null) rec.code = code == null ? -1 : code;
			if (!rec.done) {
				rec.done = true;
				setTimeout(function () {
					s.procs.delete(id);
				}, 600000);
			}
		});
		s.procs.set(id, rec);
		sendJson(res, 200, { procId: id, dir: dir3 });
		return;
	}
	if (act === 'out') {
		const p1 = s.procs.get(String(b.procId || ''));
		if (!p1) {
			sendJson(res, 400, { error: 'processo nao encontrado (ja expirou?)' });
			return;
		}
		let from = Math.max(0, Number(b.from) || 0);
		if (from > p1.out.length) from = 0;
		const espera = Math.max(0, Math.min(25000, Number(b.wait) || 0));
		const soFim = !!b.fim;
		const pronto = function () {
			return p1.done || (!soFim && p1.out.length > from);
		};
		const responder = function () {
			sendJson(res, 200, {
				text: p1.out.slice(from),
				next: p1.out.length,
				done: p1.done,
				code: p1.code,
				lp: true,
			});
		};
		if (!espera || pronto()) {
			responder();
			return;
		}
		let fim0 = Date.now() + espera,
			tick = null,
			acabou = false;
		const fechar = function (mandar) {
			if (acabou) return;
			acabou = true;
			if (tick) {
				clearInterval(tick);
				tick = null;
			}
			if (mandar) responder();
		};
		tick = setInterval(function () {
			if (pronto() || Date.now() >= fim0) fechar(true);
		}, 120);
		try {
			res.on('close', function () {
				fechar(false);
			});
		} catch (e) {
			ignorarErro(e, 'termAction');
		}
		return;
	}
	if (act === 'stdin') {
		const p2 = s.procs.get(String(b.procId || ''));
		if (!p2 || p2.done || p2.exited) {
			sendJson(res, 400, { error: 'processo nao encontrado ou finalizado' });
			return;
		}
		try {
			p2.proc.stdin.write(String(b.data == null ? '' : b.data));
			sendJson(res, 200, { ok: true });
		} catch (e) {
			sendJson(res, 500, { error: String((e && e.message) || e) });
		}
		return;
	}
	if (act === 'kill') {
		const p3 = s.procs.get(String(b.procId || ''));
		if (!p3) {
			sendJson(res, 200, { ok: true, info: 'ja finalizado' });
			return;
		}
		try {
			if (process.platform === 'win32')
				spawn('taskkill', ['/pid', String(p3.proc.pid), '/t', '/f'], { windowsHide: true });
			else {
				try {
					process.kill(-p3.proc.pid, 'SIGKILL');
				} catch (e9) {
					p3.proc.kill('SIGKILL');
				}
			}
		} catch (e) {
			ignorarErro(e, 'termAction');
		}
		p3.exited = true;
		sendJson(res, 200, { ok: true });
		return;
	}
	if (act === 'listdisk') {
		const list = [];
		let ents2;
		try {
			ents2 = fs.readdirSync(WORK, { withFileTypes: true });
		} catch (e) {
			ents2 = [];
		}
		for (let d2 = 0; d2 < ents2.length; d2++) {
			const en2 = ents2[d2];
			if (!en2.isDirectory()) continue;
			if (IGNORE.includes(en2.name)) continue;
			let cnt = 0;
			try {
				cnt = scanDir(path.join(WORK, en2.name)).size;
			} catch (e) {
				cnt = 0;
			}
			list.push({ name: en2.name, files: cnt });
		}
		sendJson(res, 200, { dir: WORK, projects: list });
		return;
	}
	if (act === 'fetchjson') {
		const u4 = String(b.url || '');
		if (!/^https?:\\/\\//i.test(u4)) {
			sendJson(res, 400, { error: 'url invalida: use http(s)' });
			return;
		}
		if (typeof fetch !== 'function') {
			sendJson(res, 500, { error: 'chamada de API pelo relay requer Node 18 ou superior' });
			return;
		}
		let met = String(b.method || 'GET').toUpperCase();
		if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].includes(met)) met = 'GET';
		const o4 = { method: met, redirect: 'follow', headers: relayHeaders(b.headers) };
		if (b.body != null && met !== 'GET' && met !== 'HEAD') {
			o4.body = typeof b.body === 'string' ? b.body : JSON.stringify(b.body);
			if (!o4.headers['Content-Type']) o4.headers['Content-Type'] = 'application/json';
		}
		const ct4 = new AbortController();
		o4.signal = ct4.signal;
		const tm4 = setTimeout(function () {
			try {
				ct4.abort();
			} catch (e) {
				ignorarErro(e, 'termAction');
			}
		}, 30000);
		fetch(u4, o4)
			.then(function (r4) {
				return r4.text().then(function (tx) {
					sendJson(res, 200, {
						status: r4.status,
						ok: !!r4.ok,
						mime: r4.headers.get('content-type') || '',
						text: String(tx || '').slice(0, 4 * 1024 * 1024),
						finalUrl: r4.url || u4,
					});
				});
			})
			.catch(function (e) {
				const m4 =
					e && e.name === 'AbortError' ? 'tempo esgotado (30s)' : (e && e.message) || String(e);
				sendJson(res, 500, { error: 'chamada de API falhou: ' + m4 });
			})
			.finally(function () {
				clearTimeout(tm4);
			});
		return;
	}
	if (act === 'fetchurl') {
		const u2 = String(b.url || '');
		if (!/^https?:\\/\\//i.test(u2)) {
			sendJson(res, 400, { error: 'url invalida: use http(s)' });
			return;
		}
		if (typeof fetch !== 'function') {
			sendJson(res, 500, { error: 'download por URL requer Node 18 ou superior no relay' });
			return;
		}
		const cap = 25 * 1024 * 1024;
		const ctl = new AbortController();
		const tmo = setTimeout(function () {
			try {
				ctl.abort();
			} catch (e) {
				ignorarErro(e, 'termAction');
			}
		}, 30000);
		fetch(u2, { redirect: 'follow', signal: ctl.signal, headers: relayHeaders(b.headers) })
			.then(function (r2) {
				if (!r2.ok) {
					sendJson(res, 502, { error: 'download falhou: HTTP ' + r2.status });
					return null;
				}
				const cl = Number(r2.headers.get('content-length') || 0);
				if (cl > cap) {
					sendJson(res, 413, { error: 'arquivo maior que 25MB' });
					return null;
				}
				return r2.arrayBuffer().then(function (ab) {
					if (ab.byteLength > cap) {
						sendJson(res, 413, { error: 'arquivo maior que 25MB' });
						return;
					}
					sendJson(res, 200, {
						b64: Buffer.from(ab).toString('base64'),
						size: ab.byteLength,
						mime: r2.headers.get('content-type') || '',
						finalUrl: r2.url || u2,
					});
				});
			})
			.catch(function (e) {
				const m =
					e && e.name === 'AbortError' ? 'tempo esgotado (30s)' : (e && e.message) || String(e);
				sendJson(res, 500, { error: 'download falhou: ' + m });
			})
			.finally(function () {
				clearTimeout(tmo);
			});
		return;
	}
	if (act === 'devreg') {
		const chaveR = chaveDe(b.project);
		const portaR = Math.floor(Number(b.port) || 0);
		if (!(portaR > 0 && portaR < 65536)) {
			sendJson(res, 400, { error: 'porta invalida' });
			return;
		}
		if (!s.dev) s.dev = {};
		s.dev[chaveR] = { port: portaR, bridge: String(b.bridge || ''), at: Date.now() };
		sendJson(res, 200, { key: chaveR });
		return;
	}
	if (act === 'devunreg') {
		const chaveU = chaveDe(b.project);
		if (s.dev) delete s.dev[chaveU];
		sendJson(res, 200, { ok: true });
		return;
	}
	if (act === 'deploystart') {
		const chaveD = chaveDe(b.project);
		const listaD = Array.isArray(b.files) ? b.files : [];
		const mapaD = new Map();
		let totalD = 0;
		for (let iD = 0; iD < listaD.length; iD++) {
			const itD = listaD[iD] || {};
			const relD = caminhoRelSeguro(itD.path);
			if (!relD) continue;
			let bufD = null;
			if (typeof itD.text === 'string') bufD = Buffer.from(itD.text, 'utf8');
			else if (typeof itD.b64 === 'string') {
				try {
					bufD = Buffer.from(itD.b64, 'base64');
				} catch (eD) {
					bufD = null;
				}
			}
			if (!bufD) continue;
			totalD += bufD.length;
			if (totalD > 200 * 1024 * 1024) {
				sendJson(res, 413, { error: 'deploy maior que 200MB' });
				return;
			}
			mapaD.set(relD, bufD);
		}
		if (!mapaD.size) {
			sendJson(res, 400, { error: 'nenhum arquivo valido para publicar' });
			return;
		}
		DEPLOYS.set(chaveD, { files: mapaD, at: Date.now() });
		sendJson(res, 200, { key: chaveD, url: \`/deploy/\${chaveD}/\`, files: mapaD.size });
		return;
	}
	if (act === 'deploystop') {
		DEPLOYS.delete(chaveDe(b.project));
		sendJson(res, 200, { ok: true });
		return;
	}
	sendJson(res, 404, { error: 'acao desconhecida' });
}
const TERM_ACTS = [
	'sync',
	'changes',
	'run',
	'out',
	'stdin',
	'kill',
	'fetchurl',
	'fetchjson',
	'listdisk',
	'devreg',
	'devunreg',
	'deploystart',
	'deploystop',
];
function relayHeaders(h) {
	const ok = ['authorization', 'x-auth-token', 'x-api-key', 'accept', 'user-agent', 'content-type'],
		out = {};
	try {
		for (let k in h || {}) {
			if (ok.includes(String(k).toLowerCase()) && h[k] != null)
				out[k] = String(h[k]).slice(0, 2048);
		}
	} catch (e) {
		ignorarErro(e, 'relayHeaders');
	}
	return out;
}

const DEPLOYS = new Map();
const MIMES = {
	html: 'text/html; charset=utf-8',
	htm: 'text/html; charset=utf-8',
	js: 'text/javascript; charset=utf-8',
	mjs: 'text/javascript; charset=utf-8',
	cjs: 'text/javascript; charset=utf-8',
	css: 'text/css; charset=utf-8',
	json: 'application/json; charset=utf-8',
	map: 'application/json',
	svg: 'image/svg+xml',
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	webp: 'image/webp',
	avif: 'image/avif',
	ico: 'image/x-icon',
	txt: 'text/plain; charset=utf-8',
	md: 'text/plain; charset=utf-8',
	xml: 'application/xml',
	wasm: 'application/wasm',
	mp3: 'audio/mpeg',
	ogg: 'audio/ogg',
	wav: 'audio/wav',
	mp4: 'video/mp4',
	webm: 'video/webm',
	woff: 'font/woff',
	woff2: 'font/woff2',
	ttf: 'font/ttf',
	otf: 'font/otf',
	eot: 'application/vnd.ms-fontobject',
	glb: 'model/gltf-binary',
	gltf: 'model/gltf+json',
	bin: 'application/octet-stream',
	pdf: 'application/pdf',
};
function mimeDe(p) {
	const i = String(p).lastIndexOf('.');
	const ex =
		i >= 0
			? String(p)
					.slice(i + 1)
					.toLowerCase()
			: '';
	return MIMES[ex] || 'application/octet-stream';
}
function chaveDe(nome) {
	const s = String(nome == null ? '' : nome).toLowerCase();
	let out = '';
	for (let i = 0; i < s.length; i++) {
		const c = s.charAt(i);
		if ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c === '-' || c === '_' || c === '.')
			out += c;
		else out += '-';
	}
	while (out.includes('--')) out = out.split('--').join('-');
	while (out.length && (out.charAt(0) === '-' || out.charAt(0) === '.')) out = out.slice(1);
	while (out.length && (out.charAt(out.length - 1) === '-' || out.charAt(out.length - 1) === '.'))
		out = out.slice(0, -1);
	return out.slice(0, 80) || 'projeto';
}
function caminhoRelSeguro(p) {
	const s = String(p == null ? '' : p);
	if (s.includes(String.fromCharCode(92)) || s.includes(':') || s.includes(String.fromCharCode(0)))
		return null;
	const pr = s.split('/');
	const out = [];
	for (let i = 0; i < pr.length; i++) {
		const seg = pr[i];
		if (!seg || seg === '.') continue;
		if (seg === '..') return null;
		out.push(seg);
	}
	if (!out.length) return null;
	const j = out.join('/');
	return j.length > 512 ? null : j;
}
function devProxyHttp(req, res, u, parts) {
	if (typeof origemPermitida === 'function' && !origemPermitida(req)) {
		sendJson(res, 403, {
			error: 'origem nao autorizada para terminal/disco - ajuste AURORA_ALLOW_ORIGIN',
		});
		return;
	}
	const sDev = getSession(parts[1]);
	if (sDev.token && sDev.token !== parts[2]) {
		sendJson(res, 403, { error: 'token invalido' });
		return;
	}
	const regDev = (sDev.dev || {})[parts[3]];
	if (!regDev) {
		sendJson(res, 404, { error: 'dev server nao registrado (use start_dev_server)' });
		return;
	}
	const subDev = \`/\${parts.slice(4).join('/')}\${u.search || ''}\`;
	const hDev = {};
	for (let hk in req.headers) {
		const lk = String(hk).toLowerCase();
		if (lk === 'host' || lk === 'connection' || lk === 'accept-encoding') continue;
		hDev[hk] = req.headers[hk];
	}
	hDev['host'] = '127.0.0.1:' + regDev.port;
	hDev['accept-encoding'] = 'identity';
	const pReq = http.request(
		{ host: '127.0.0.1', port: regDev.port, method: req.method, path: subDev, headers: hDev },
		function (pRes) {
			const ct = String(pRes.headers['content-type'] || '');
			const hOut = {};
			for (let hk2 in pRes.headers) {
				const lk2 = String(hk2).toLowerCase();
				if (
					lk2 === 'x-frame-options' ||
					lk2 === 'content-security-policy' ||
					lk2 === 'content-security-policy-report-only' ||
					lk2 === 'content-length' ||
					lk2 === 'transfer-encoding' ||
					lk2 === 'connection' ||
					lk2 === 'keep-alive'
				)
					continue;
				hOut[hk2] = pRes.headers[hk2];
			}
			hOut['Access-Control-Allow-Origin'] = '*';
			hOut['Cross-Origin-Resource-Policy'] = 'cross-origin';
			hOut['Cache-Control'] = 'no-store';
			if (ct.includes('text/html') && regDev.bridge) {
				const pedacos = [];
				pRes.on('data', function (c) {
					pedacos.push(c);
				});
				pRes.on('end', function () {
					try {
						let htmlD = Buffer.concat(pedacos).toString('utf8');
						const tagD = \`<script>\${regDev.bridge}</script>\`;
						const low = htmlD.toLowerCase();
						let anc = low.indexOf('</head>');
						if (anc < 0) anc = low.indexOf('</body>');
						if (anc >= 0) htmlD = htmlD.slice(0, anc) + tagD + htmlD.slice(anc);
						else htmlD = htmlD + tagD;
						const bufOut = Buffer.from(htmlD, 'utf8');
						hOut['Content-Length'] = bufOut.length;
						res.writeHead(pRes.statusCode || 200, hOut);
						res.end(bufOut);
					} catch (eH) {
						try {
							res.writeHead(502, { 'Content-Type': 'application/json' });
							res.end(JSON.stringify({ error: 'falha ao injetar a ponte no HTML do dev server' }));
						} catch (e2) {
							ignorarErro(e2, 'devProxyHttp');
						}
					}
				});
			} else {
				res.writeHead(pRes.statusCode || 200, hOut);
				pRes.pipe(res);
			}
		},
	);
	pReq.on('error', function () {
		try {
			sendJson(res, 502, {
				error: \`dev server nao respondeu na porta \${regDev.port} - rode start_dev_server de novo\`,
			});
		} catch (e3) {
			ignorarErro(e3, 'devProxyHttp');
		}
	});
	pReq.setTimeout(30000, function () {
		try {
			pReq.destroy();
		} catch (e4) {
			ignorarErro(e4, 'devProxyHttp');
		}
	});
	req.pipe(pReq);
}
function servirDeploy(req, res, u, parts) {
	let chaveS = '';
	try {
		chaveS = decodeURIComponent(parts[1] || '');
	} catch (eS1) {
		chaveS = parts[1] || '';
	}
	const dep = DEPLOYS.get(chaveDe(chaveS));
	if (!dep) {
		sendJson(res, 404, { error: 'deploy nao encontrado (use deploy_static)' });
		return;
	}
	const relPartes = [];
	for (let iS = 2; iS < parts.length; iS++) relPartes.push(parts[iS]);
	let rel = '';
	try {
		rel = decodeURIComponent(relPartes.join('/'));
	} catch (eS2) {
		rel = relPartes.join('/');
	}
	if (u.pathname.charAt(u.pathname.length - 1) === '/')
		rel = rel ? rel + '/index.html' : 'index.html';
	else if (!rel) rel = 'index.html';
	rel = caminhoRelSeguro(rel) || 'index.html';
	let corpo = dep.files.get(rel);
	if (!corpo && !rel.includes('.')) corpo = dep.files.get(rel + '/index.html');
	if (!corpo && !rel.includes('.')) corpo = dep.files.get('index.html');
	if (!corpo) {
		sendJson(res, 404, { error: 'arquivo nao encontrado no deploy: ' + rel });
		return;
	}
	cors(res);
	res.writeHead(200, {
		'Content-Type': mimeDe(rel),
		'Content-Length': corpo.length,
		'Cache-Control': 'no-store',
	});
	if (req.method === 'HEAD') {
		res.end();
		return;
	}
	res.end(corpo);
}
const server = http.createServer(function (req, res) {
	let u;
	try {
		u = new URL(req.url, 'http://x');
	} catch (e) {
		sendJson(res, 400, { error: 'url invalida' });
		return;
	}
	const parts = u.pathname.split('/').filter(Boolean);
	if (req.method === 'OPTIONS') {
		cors(res);
		const rotaOk =
			parts.length === 0 ||
			parts[0] === 'mcp' ||
			parts[0] === 'bridge' ||
			parts[0] === 'stats' ||
			parts[0] === 'dev' ||
			parts[0] === 'deploy';
		if (!rotaOk) {
			res.writeHead(404, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify({ error: 'rota desconhecida' }));
			return;
		}
		res.writeHead(204);
		res.end();
		return;
	}
	if (parts.length === 0) {
		cors(res);
		res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
		res.end(\`Synapse MCP Relay \${VERSION} ativo. Sessoes: \${sessions.size}\${NL}\`);
		return;
	}

	if (parts[0] === 'stats') {
		const out = {
			version: VERSION,
			perWorker: PER_WORKER,
			maxPending: MAX_PENDING,
			catalogo: { ferramentas: nTools(), temInitialize: !!META.init, quando: META.at || 0 },
			sessions: [],
		};
		sessions.forEach(function (s, sid) {
			const vs = workersVivos(s),
				det = [];
			for (let i = 0; i < vs.length; i++)
				det.push({ id: vs[i].id, kind: vs[i].kind, inflight: vs[i].inflight.size });
			out.sessions.push({
				sid: sid,
				executores: vs.length,
				capacidade: vs.length * PER_WORKER,
				fila: s.queue.length,
				pendentes: s.pending.size,
				agentes: s.clients.size,
				longPolls: s.polls.length,
				detalhe: det,
			});
		});
		sendJson(res, 200, out);
		return;
	}

	if (
		parts[0] === 'bridge' &&
		parts.length === 4 &&
		parts[3] === 'events' &&
		req.method === 'GET'
	) {
		const s1 = getSession(parts[1]);
		if (s1.token && s1.token !== parts[2]) {
			sendJson(res, 403, { error: 'token invalido' });
			return;
		}
		s1.token = parts[2];
		avisarTransporteLocal(\`bridge/\${parts[1]}/.../events\`);
		cors(res);
		res.writeHead(200, {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive',
			'X-Accel-Buffering': 'no',
		});
		res.write(\`event: hello\${NL}data: {"ok":true,"v":"\${VERSION}"}\${NL}\${NL}\`);
		const w1 = addWorker(s1, { kind: 'sse', res: res });
		const hb = setInterval(function () {
			try {
				res.write(\`event: ping\${NL}data: {}\${NL}\${NL}\`);
				s1.lastSeen = Date.now();
			} catch (e) {
				clearInterval(hb);
				removeWorker(s1, w1);
				try {
					res.end();
				} catch (e2) {
					ignorarErro(e2, 'relay');
				}
			}
		}, 15000);
		req.on('close', function () {
			clearInterval(hb);
			removeWorker(s1, w1);
		});
		return;
	}

	if (parts[0] === 'bridge' && parts.length === 4 && parts[3] === 'poll' && req.method === 'POST') {
		const s5 = getSession(parts[1]);
		if (s5.token && s5.token !== parts[2]) {
			sendJson(res, 403, { error: 'token invalido' });
			return;
		}
		s5.token = parts[2];
		readBody(req)
			.then(function (raw) {
				let wait = 20000;
				try {
					const b = JSON.parse(raw || '{}');
					if (b && b.wait) wait = Math.max(1000, Math.min(25000, Number(b.wait) || 20000));
				} catch (e) {
					ignorarErro(e, 'relay');
				}
				s5.lastSeen = Date.now();
				if (s5.queue.length) {
					const lote = s5.queue.splice(0, PER_WORKER);
					for (let i = 0; i < lote.length; i++) {
						const p0 = s5.pending.get(lote[i].reqId);
						if (p0 && p0.graceTimer) {
							clearTimeout(p0.graceTimer);
							p0.graceTimer = null;
						}
					}
					sendJson(res, 200, { events: lote });
					return;
				}
				s5.polls.push(res);
				res.__t = setTimeout(function () {
					const ix = s5.polls.indexOf(res);
					if (ix >= 0) s5.polls.splice(ix, 1);
					s5.lastSeen = Date.now();
					sendJson(res, 200, { events: [] });
				}, wait);
				req.on('close', function () {
					const ix = s5.polls.indexOf(res);
					if (ix >= 0) s5.polls.splice(ix, 1);
					if (res.__t) clearTimeout(res.__t);
				});
			})
			.catch(function (e) {
				sendJson(res, 400, { error: String((e && e.message) || e) });
			});
		return;
	}

	if (
		parts[0] === 'bridge' &&
		parts.length === 4 &&
		parts[3] === 'reply' &&
		req.method === 'POST'
	) {
		const s2 = sessions.get(parts[1]);
		if (!s2 || s2.token !== parts[2]) {
			sendJson(res, 403, { error: 'sessao/token invalido' });
			return;
		}
		readBody(req)
			.then(function (raw) {
				let msg;
				try {
					msg = JSON.parse(raw);
				} catch (e) {
					sendJson(res, 400, { error: 'json invalido' });
					return;
				}
				s2.lastSeen = Date.now();
				const itens = Array.isArray(msg && msg.batch) ? msg.batch : [msg];
				const wid = Number(u.searchParams.get('w') || 0);
				let wref = null;
				for (let i = 0; i < s2.workers.length; i++)
					if (s2.workers[i].id === wid) wref = s2.workers[i];
				const r9 = entregarItens(s2, itens, wref);
				sendJson(res, 200, { ok: r9.delivered > 0, delivered: r9.delivered, expired: r9.expired });
			})
			.catch(function (e) {
				sendJson(res, 400, { error: String((e && e.message) || e) });
			});
		return;
	}

	if (parts[0] === 'bridge' && parts.length === 4 && parts[3] === 'meta' && req.method === 'POST') {
		const sMe = getSession(parts[1]);
		if (sMe.token && sMe.token !== parts[2]) {
			sendJson(res, 403, { error: 'token invalido' });
			return;
		}
		sMe.token = parts[2];
		avisarTransporteLocal(\`bridge/\${parts[1]}/.../meta\`);
		readBody(req)
			.then(function (raw) {
				let b;
				try {
					b = JSON.parse(raw || '{}');
				} catch (e) {
					b = {};
				}
				let mudou = false;
				if (b && b.init && typeof b.init === 'object') {
					META.init = b.init;
					mudou = true;
				}
				if (b && b.tools && b.tools.tools && b.tools.tools.length) {
					META.tools = b.tools;
					mudou = true;
				}
				if (mudou) {
					META.at = Date.now();
					salvarCache();
					console.log(\`[mcp] catalogo recebido da aba: \${nTools()} ferramentas\`);
				}
				sendJson(res, 200, { ok: true, tools: nTools() });
			})
			.catch(function (e) {
				sendJson(res, 400, { error: String((e && e.message) || e) });
			});
		return;
	}

	if (
		parts[0] === 'bridge' &&
		parts.length === 4 &&
		TERM_ACTS.includes(parts[3]) &&
		req.method === 'POST'
	) {
		const act = parts[3];
		if (!origemPermitida(req)) {
			sendJson(res, 403, {
				error: 'origem nao autorizada para terminal/disco - ajuste AURORA_ALLOW_ORIGIN',
			});
			return;
		}
		const sT = getSession(parts[1]);
		if (sT.token && sT.token !== parts[2]) {
			sendJson(res, 403, { error: 'token invalido' });
			return;
		}
		sT.token = parts[2];
		readBody(req)
			.then(function (raw) {
				let b;
				try {
					b = JSON.parse(raw || '{}');
				} catch (e) {
					sendJson(res, 400, { error: 'json invalido' });
					return;
				}
				try {
					termAction(sT, act, b || {}, res);
				} catch (e) {
					sendJson(res, 500, { error: String((e && e.message) || e) });
				}
			})
			.catch(function (e) {
				sendJson(res, 400, { error: String((e && e.message) || e) });
			});
		return;
	}

	if (parts[0] === 'mcp' && parts.length === 3) {
		const sid3 = parts[1],
			tok3 = parts[2];
		const sM = getSession(sid3);
		if (sM.token && sM.token !== tok3) {
			sendJson(res, 403, { error: 'token invalido' });
			return;
		}
		sM.token = tok3;
		limparClients(sM);

		const cidHdr = String(req.headers['mcp-session-id'] || u.searchParams.get('cid') || '').slice(
			0,
			64,
		);

		if (
			req.method === 'GET' &&
			!(
				u.searchParams.get('transport') === 'sse' ||
				u.searchParams.get('sse') === '1' ||
				u.searchParams.get('legado') === 'sse'
			)
		) {
			cors(res);
			res.writeHead(405, {
				Allow: 'POST, DELETE, OPTIONS',
				'Content-Type': 'application/json; charset=utf-8',
			});
			res.end(
				JSON.stringify({
					jsonrpc: '2.0',
					id: null,
					error: {
						code: -32000,
						message:
							'Este servidor MCP fala Streamable HTTP: mande as mensagens por POST nesta mesma URL. O ' +
							'stream GET nao e oferecido (HTTP 405, permitido pela especificacao). Clientes antigos ' +
							'podem usar ?transport=sse.',
					},
				}),
			);
			return;
		}
		if (req.method === 'GET') {
			const cidG = cidHdr || 'c' + crypto.randomBytes(8).toString('hex');
			const cg = getClient(sM, cidG);
			if (cg.sse && cg.sse !== res) {
				try {
					cg.sse.end();
				} catch (e) {
					ignorarErro(e, 'relay');
				}
				cg.sse = null;
			}
			cors(res);
			res.writeHead(200, {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache, no-transform',
				Connection: 'keep-alive',
				'X-Accel-Buffering': 'no',
				'Mcp-Session-Id': cidG,
			});
			const proto = req.headers['x-forwarded-proto'] || 'http';
			const host = req.headers['host'];
			const ep =
				(host ? proto + '://' + host + u.pathname : u.pathname) +
				'?transport=sse&cid=' +
				encodeURIComponent(cidG);
			res.write(\`event: endpoint\${NL}data: \${ep}\${NL}\${NL}\`);
			cg.sse = res;
			const hb2 = setInterval(function () {
				try {
					res.write(\`: ping\${NL}\${NL}\`);
				} catch (e) {
					clearInterval(hb2);
					if (cg.sse === res) cg.sse = null;
					try {
						res.end();
					} catch (e2) {
						ignorarErro(e2, 'relay');
					}
				}
			}, 15000);
			req.on('close', function () {
				clearInterval(hb2);
				if (cg.sse === res) cg.sse = null;
			});
			return;
		}
		if (req.method === 'DELETE') {
			if (cidHdr) sM.clients.delete(cidHdr);
			cors(res);
			res.writeHead(200);
			res.end();
			return;
		}
		if (req.method !== 'POST') {
			cors(res);
			res.writeHead(405, { Allow: 'GET, POST, DELETE' });
			res.end();
			return;
		}

		const mode = u.searchParams.get('transport') === 'sse' ? 'sse' : 'http';

		readBody(req)
			.then(function (raw) {
				let body;
				try {
					body = JSON.parse(raw);
				} catch (e) {
					sendJson(res, 400, {
						jsonrpc: '2.0',
						id: null,
						error: { code: -32700, message: 'JSON invalido' },
					});
					return;
				}

				const metodos = Array.isArray(body)
					? body.map(function (b) {
							return b && b.method;
						})
					: [body && body.method];
				const ehInit = metodos.includes('initialize');

				let cid = cidHdr;
				if (!cid) cid = ehInit ? 'c' + crypto.randomBytes(8).toString('hex') : '_legado';
				getClient(sM, cid);
				const hdrs = ehInit ? { 'Mcp-Session-Id': cid } : null;

				const metodo =
					!Array.isArray(body) && body && typeof body.method === 'string' ? body.method : '';
				const pontOn = browserOnline(sM);
				if (metodo)
					console.log(
						\`[mcp] \${metodo} | abas=\${workersVivos(sM).length} fila=\${sM.queue.length}\${pontOn ? '' : ' | ATENCAO: nenhuma aba conectada'}\`,
					);
				const responder = function (obj) {
					if (mode === 'sse') {
						try {
							cors(res);
							res.writeHead(202, hdrs || {});
							res.end();
						} catch (e) {
							ignorarErro(e, 'responder');
						}
						const c9 = sM.clients.get(cid);
						if (c9 && c9.sse) sseWrite(c9.sse, 'message', JSON.stringify(obj));
					} else sendJson(res, 200, obj, hdrs);
				};
				const idReq = body && !Array.isArray(body) && body.id != null ? body.id : null;
				if (metodo.indexOf('notifications/') === 0) {
					try {
						cors(res);
						res.writeHead(202, hdrs || {});
						res.end();
					} catch (e) {
						ignorarErro(e, 'relay');
					}
					return;
				}
				if (metodo === 'ping') {
					responder({ jsonrpc: '2.0', id: idReq, result: {} });
					return;
				}
				if (metodo === 'initialize') {
					responder({ jsonrpc: '2.0', id: idReq, result: initResult(body.params || {}) });
					return;
				}
				if (metodo === 'tools/list' && nTools()) {
					responder({ jsonrpc: '2.0', id: idReq, result: META.tools });
					return;
				}
				if (metodo === 'resources/list') {
					responder({ jsonrpc: '2.0', id: idReq, result: { resources: [] } });
					return;
				}
				if (metodo === 'resources/templates/list') {
					responder({ jsonrpc: '2.0', id: idReq, result: { resourceTemplates: [] } });
					return;
				}
				if (metodo === 'prompts/list') {
					responder({ jsonrpc: '2.0', id: idReq, result: { prompts: [] } });
					return;
				}
				if (!pontOn) {
					sendRetry(
						res,
						503,
						'A aba do Synapse nao esta conectada a este relay. Abra o site, ative o MCP no modo "Relay local (PC)" e tente de novo.',
						5,
						hdrs,
					);
					return;
				}

				if (sM.pending.size >= MAX_PENDING) {
					sendRetry(
						res,
						429,
						\`Relay saturado (\${sM.pending.size} pendentes). Tente novamente.\`,
						2,
						hdrs,
					);
					return;
				}

				const reqId = sM.seq++;
				if (mode === 'sse') {
					cors(res);
					res.writeHead(202, hdrs || {});
					res.end();
				}

				const pend = {
					cid: cid,
					mode: mode,
					res: res,
					body: body,
					worker: null,
					timer: null,
					graceTimer: null,
					hdrs: hdrs,
				};

				pend.timer = setTimeout(
					function () {
						if (sM.pending.get(reqId) !== pend) return;
						sM.pending.delete(reqId);
						if (pend.graceTimer) clearTimeout(pend.graceTimer);
						if (pend.worker && pend.worker.inflight) pend.worker.inflight.delete(reqId);
						const fb = respostaFallback(metodo, body);
						if (fb)
							console.log(\`[mcp] \${metodo}: a aba nao respondeu - usando o catalogo em cache\`);
						const toErr = fb || {
							jsonrpc: '2.0',
							id: body && body.id != null ? body.id : null,
							error: {
								code: -32001,
								message:
									'Tempo esgotado aguardando a aba do Synapse. Ela precisa ficar aberta com o MCP ativo.',
							},
						};
						if (mode === 'sse') {
							const cl = sM.clients.get(cid);
							if (cl && cl.sse) sseWrite(cl.sse, 'message', JSON.stringify(toErr));
						} else sendJson(res, 200, toErr, hdrs);
					},
					metodo === 'initialize' || metodo === 'tools/list' ? HS_TIMEOUT : TIMEOUT_MS,
				);

				sM.pending.set(reqId, pend);

				if (!deliver(sM, { reqId: reqId, body: body })) {
					sM.pending.delete(reqId);
					clearTimeout(pend.timer);
					if (mode === 'sse') {
						const cl2 = sM.clients.get(cid);
						const fe = {
							jsonrpc: '2.0',
							id: body && body.id != null ? body.id : null,
							error: { code: -32002, message: 'Fila cheia.' },
						};
						if (cl2 && cl2.sse) sseWrite(cl2.sse, 'message', JSON.stringify(fe));
					} else sendRetry(res, 429, 'Fila cheia. Tente novamente.', 2, hdrs);
					return;
				}

				if (!pend.worker) {
					const graceCheck = function () {
						if (sM.pending.get(reqId) !== pend || pend.worker) return;
						if (browserOnline(sM)) {
							pend.graceTimer = setTimeout(graceCheck, GRACE_MS);
							return;
						}
						sM.pending.delete(reqId);
						if (pend.timer) clearTimeout(pend.timer);
						let ix = -1;
						for (let q = 0; q < sM.queue.length; q++) if (sM.queue[q].reqId === reqId) ix = q;
						if (ix >= 0) sM.queue.splice(ix, 1);
						const fbg = respostaFallback(metodo, body);
						if (fbg) {
							console.log(\`[mcp] \${metodo}: ninguem pegou a chamada - usando o catalogo em cache\`);
							if (mode === 'sse') {
								const clg = sM.clients.get(cid);
								if (clg && clg.sse) sseWrite(clg.sse, 'message', JSON.stringify(fbg));
							} else sendJson(res, 200, fbg, hdrs);
							return;
						}
						const m = \`Sem executor livre (\${workersVivos(sM).length} aba(s), capacidade \${capacidade(sM)}, fila \${sM.queue.length}). Abra mais abas executoras ou reduza os agentes.\`;
						if (mode === 'sse') {
							const cl3 = sM.clients.get(cid);
							if (cl3 && cl3.sse)
								sseWrite(
									cl3.sse,
									'message',
									JSON.stringify({
										jsonrpc: '2.0',
										id: body && body.id != null ? body.id : null,
										error: { code: -32000, message: m },
									}),
								);
						} else sendRetry(res, 503, m, 3, hdrs);
					};
					pend.graceTimer = setTimeout(graceCheck, GRACE_MS);
				}
			})
			.catch(function (e) {
				sendJson(res, 400, {
					jsonrpc: '2.0',
					id: null,
					error: { code: -32700, message: String((e && e.message) || e) },
				});
			});
		return;
	}
	if (parts[0] === 'dev' && parts.length >= 4) {
		devProxyHttp(req, res, u, parts);
		return;
	}
	if (
		parts[0] === 'deploy' &&
		parts.length >= 2 &&
		(req.method === 'GET' || req.method === 'HEAD')
	) {
		servirDeploy(req, res, u, parts);
		return;
	}
	sendJson(res, 404, { error: 'rota desconhecida' });
});

function killAllProcs() {
	sessions.forEach(function (s0) {
		s0.procs.forEach(function (r0) {
			if (r0.exited) return;
			try {
				if (process.platform === 'win32')
					spawn('taskkill', ['/pid', String(r0.proc.pid), '/t', '/f'], { windowsHide: true });
				else {
					try {
						process.kill(-r0.proc.pid, 'SIGKILL');
					} catch (e9) {
						r0.proc.kill('SIGKILL');
					}
				}
				r0.exited = true;
			} catch (e) {
				ignorarErro(e, 'killAllProcs');
			}
		});
	});
}
process.on('SIGINT', function () {
	killAllProcs();
	setTimeout(function () {
		process.exit(0);
	}, 400);
});
process.on('SIGTERM', function () {
	killAllProcs();
	setTimeout(function () {
		process.exit(0);
	}, 400);
});
process.on('uncaughtException', function (e) {
	try {
		console.error('[relay] erro nao tratado (servidor segue rodando): ' + ((e && e.stack) || e));
	} catch (e2) {
		ignorarErro(e2, 'relay');
	}
});
process.on('unhandledRejection', function (e) {
	try {
		console.error(
			'[relay] promise rejeitada (servidor segue rodando): ' + ((e && (e.stack || e.message)) || e),
		);
	} catch (e2) {
		ignorarErro(e2, 'relay');
	}
});

server.on('upgrade', function (req, sock, head) {
	let u2;
	try {
		u2 = new URL(req.url, 'http://x');
	} catch (e) {
		try {
			sock.destroy();
		} catch (e2) {
			ignorarErro(e2, 'relay');
		}
		return;
	}
	const pp = u2.pathname.split('/').filter(Boolean);
	const key = req.headers['sec-websocket-key'];
	if (pp[0] === 'dev' && pp.length >= 4 && key) {
		const sU = getSession(pp[1]);
		if (sU.token && sU.token !== pp[2]) {
			try {
				sock.write(\`HTTP/1.1 403 Forbidden\${NL}Connection: close\${NL}\${NL}\`);
				sock.destroy();
			} catch (eU1) {
				ignorarErro(eU1, 'relay');
			}
			return;
		}
		const regU = (sU.dev || {})[pp[3]];
		if (!regU) {
			try {
				sock.write(\`HTTP/1.1 404 Not Found\${NL}Connection: close\${NL}\${NL}\`);
				sock.destroy();
			} catch (eU2) {
				ignorarErro(eU2, 'relay');
			}
			return;
		}
		const subU = \`/\${pp.slice(4).join('/')}\${u2.search || ''}\`;
		const netU = require('net');
		const alvoU = netU.connect(regU.port, '127.0.0.1', function () {
			const CRLFU = String.fromCharCode(13, 10);
			let linhasU = req.method + ' ' + subU + ' HTTP/1.1' + CRLFU;
			for (let hkU in req.headers) {
				if (String(hkU).toLowerCase() === 'host') {
					linhasU += \`host: 127.0.0.1:\${regU.port}\${CRLFU}\`;
					continue;
				}
				linhasU += hkU + ': ' + req.headers[hkU] + CRLFU;
			}
			linhasU += CRLFU;
			alvoU.write(linhasU);
			if (head && head.length) alvoU.write(head);
			sock.pipe(alvoU);
			alvoU.pipe(sock);
		});
		alvoU.on('error', function () {
			try {
				sock.destroy();
			} catch (eU3) {
				ignorarErro(eU3, 'relay');
			}
		});
		sock.on('error', function () {
			try {
				alvoU.destroy();
			} catch (eU4) {
				ignorarErro(eU4, 'relay');
			}
		});
		return;
	}
	if (!(pp.length === 4 && pp[0] === 'bridge' && pp[3] === 'ws') || !key) {
		try {
			sock.write(\`HTTP/1.1 400 Bad Request\${NL}Connection: close\${NL}\${NL}\`);
			sock.destroy();
		} catch (e) {
			ignorarErro(e, 'relay');
		}
		return;
	}
	const sw = getSession(pp[1]);
	if (sw.token && sw.token !== pp[2]) {
		try {
			sock.write(\`HTTP/1.1 403 Forbidden\${NL}Connection: close\${NL}\${NL}\`);
			sock.destroy();
		} catch (e) {
			ignorarErro(e, 'relay');
		}
		return;
	}
	sw.token = pp[2];
	const accept = crypto
		.createHash('sha1')
		.update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
		.digest('base64');
	try {
		sock.setNoDelay(true);
		sock.setTimeout(0);
		sock.setKeepAlive(true, 30000);
	} catch (e) {
		ignorarErro(e, 'relay');
	}
	try {
		const CRLF = String.fromCharCode(13, 10);
		sock.write(
			\`HTTP/1.1 101 Switching Protocols\${CRLF}Upgrade: websocket\${CRLF}Connection: Upgrade\${CRLF}Sec-WebSocket-Accept: \${accept}\${CRLF}\${CRLF}\`,
		);
	} catch (e) {
		try {
			sock.destroy();
		} catch (e2) {
			ignorarErro(e2, 'relay');
		}
		return;
	}
	if (head && head.length) {
		try {
			sock.unshift(head);
		} catch (e) {
			ignorarErro(e, 'relay');
		}
	}

	const w = addWorker(sw, { kind: 'ws', sock: sock });
	wsSend(
		sock,
		JSON.stringify({
			t: 'hello',
			v: VERSION,
			workerId: w.id,
			perWorker: PER_WORKER,
			pool: workersVivos(sw).length,
		}),
	);

	const hbw = setInterval(function () {
		if (w.morto) {
			clearInterval(hbw);
			return;
		}
		if (!wsSend(sock, JSON.stringify({ t: 'ping' }))) {
			clearInterval(hbw);
			removeWorker(sw, w);
			return;
		}
		try {
			sock.write(wsFrame(9, Buffer.from('a')));
		} catch (e) {
			ignorarErro(e, 'relay');
		}
		if (w.lastPong && Date.now() - w.lastPong > PONG_MAX) {
			console.log(
				\`[ponte] aba sem resposta ha \${Math.round((Date.now() - w.lastPong) / 1000)}s - tirando do pool\`,
			);
			clearInterval(hbw);
			removeWorker(sw, w);
		}
	}, 5000);

	wsAttach(
		sock,
		function (txt) {
			let msg;
			try {
				msg = JSON.parse(txt);
			} catch (e) {
				return;
			}
			sw.lastSeen = Date.now();
			w.lastPong = Date.now();
			if (msg && msg.t === 'pong') return;
			if (msg && msg.t === 'ping') {
				wsSend(sock, JSON.stringify({ t: 'pong' }));
				return;
			}
			const itens = Array.isArray(msg && msg.batch) ? msg.batch : [msg];
			const ids = [];
			for (let i = 0; i < itens.length; i++) ids.push((itens[i] || {}).reqId);
			const r = entregarItens(sw, itens, w);
			wsSend(
				sock,
				JSON.stringify({ t: 'ack', ids: ids, delivered: r.delivered, expired: r.expired }),
			);
		},
		function () {
			clearInterval(hbw);
			removeWorker(sw, w);
		},
		function () {
			w.lastPong = Date.now();
			sw.lastSeen = Date.now();
		},
	);
});

server.on('error', function (e) {
	if (e && e.code === 'EADDRINUSE') {
		console.error(
			\`ERRO: a porta \${PORT} ja esta em uso (outro relay ainda aberto?). Feche o antigo ou rode com outra porta, ex.: PORT=8788 node relay.js\`,
		);
		process.exit(1);
	}
	console.error('[relay] erro no servidor: ' + ((e && e.message) || e));
});
server.listen(PORT, function () {
	console.log(\`Synapse MCP Relay \${VERSION} ouvindo na porta \${PORT}\`);
	console.log('Pasta dos projetos (terminal): ' + WORK);
	console.log(
		'Catalogo em cache: ' +
			(nTools()
				? nTools() + ' ferramentas (o Notion valida a conexao mesmo com a aba fechada)'
				: 'vazio - abra o site e ative o MCP uma vez'),
	);
	console.log('Diagnostico: http://localhost:' + PORT + '/stats');
	console.log('');
	console.log('v8.7 - este processo agora e um COMPLEMENTO, nao o servidor MCP.');
	console.log(
		'  O site fala direto com http://localhost:' + PORT + ' (terminal, disco e dev server)',
	);
	console.log(
		'  enquanto o MCP do Notion continua pela nuvem, com a mesma capacidade do modo nuvem.',
	);
	console.log(
		'  NAO precisa de tunel. No site: menu MCP > modo local > Testar > permitir terminal.',
	);
	console.log('  Tunel so e preciso se o site estiver aberto em OUTRO aparelho:');
	console.log(
		'    cloudflared tunnel --url http://localhost:' + PORT + '   ou   ngrok http ' + PORT,
	);
	console.log(
		'  Para restringir quem usa o terminal: AURORA_ALLOW_ORIGIN=https://seusite,http://localhost:5500',
	);
});
`;
function mcpDownloadRelay() {
	try {
		const blob = new Blob([RELAY_SRC], { type: 'text/javascript' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'relay.js';
		document.body.appendChild(a);
		a.click();
		a.remove();
		setTimeout(() => {
			try {
				URL.revokeObjectURL(url);
			} catch (e) {
				ignorarErro(e, 'mcpDownloadRelay');
			}
		}, 2000);
		toast('relay.js baixado', 'Rode com: node relay.js (Node 18+) em um host público', 'ok');
	} catch (e) {
		toast('Falha ao baixar', (e && e.message) || '', 'err');
	}
}
