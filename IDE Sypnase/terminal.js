                                                                                         
                                                                                           
                                                                              
                                                                                        
                                                                    
                                                            
                                                                                        
                                                                                                     
                                                                                                          
                                                                                      
                                           

export const CLIENTE_TERMINAL = 'synapse-mcp-cli';
export const VERSAO_TERMINAL = '1.0.0';

const OCULTOS = new Set(['agent', 'project']);

const tipo = (s) => {
	if (!s || typeof s !== 'object') return 'any';
	if (s.enum) return 'enum(' + s.enum.join('|') + ')';
	if (s.type === 'array') return `array<${tipo(s.items)}>`;
	if (s.anyOf || s.oneOf) return (s.anyOf || s.oneOf).map(tipo).join('|');
	return Array.isArray(s.type) ? s.type.join('|') : s.type || 'any';
};

const umaLinha = (t, max) => {
	const d = String(t || '')
		.split('\n')[0]
		.replace(/\s+/g, ' ')
		.trim();
	return d.length > max ? d.slice(0, max - 3) + '...' : d;
};

export function listarFerramentas(tools) {
	const linhas = [];
	for (const f of tools || []) {
		const props = (f.inputSchema && f.inputSchema.properties) || {};
		const req = ((f.inputSchema && f.inputSchema.required) || []).filter((n) => !OCULTOS.has(n));
		const opt = Object.keys(props).filter((n) => !req.includes(n) && !OCULTOS.has(n));
		let cab = f.name;
		if (req.length) cab += ' ' + req.map((n) => n + '=').join(' ');
		if (opt.length) cab += '  [' + opt.join(' ') + ']';
		linhas.push(cab);
		linhas.push('    ' + umaLinha(decodificarWaf(f.description), 150));
	}
	linhas.push('');
	linhas.push(
		'Todas aceitam agent= (sua identidade; o CLI e o cabecalho X-Mcp-Agent preenchem) e project= (id do projeto; padrao: o ativo).',
	);
	return linhas.join('\n');
}

export function descreverFerramenta(f) {
	if (!f) return null;
	const props = (f.inputSchema && f.inputSchema.properties) || {};
	const req = new Set((f.inputSchema && f.inputSchema.required) || []);
	const linhas = [
		`## ${f.name}${f.title ? ' — ' + f.title : ''}`,
		decodificarWaf(f.description || '').trim(),
		'',
	];
	for (const [n, s] of Object.entries(props)) {
		if (OCULTOS.has(n)) continue;
		const desc = decodificarWaf(s.description || '')
			.replace(/\s+/g, ' ')
			.trim();
		linhas.push(
			` ${req.has(n) ? '*' : ' '} ${n}: ${tipo(s)}${s.default !== undefined ? ` [default=${JSON.stringify(s.default)}]` : ''}`,
		);
		if (desc) linhas.push(`      ${desc}`);
		if (s.type === 'object' && s.properties)
			for (const [k, v] of Object.entries(s.properties))
				linhas.push(
					`        .${k}: ${tipo(v)}${v.description ? ' — ' + umaLinha(v.description, 140) : ''}`,
				);
		if (s.type === 'array' && s.items && s.items.properties)
			for (const [k, v] of Object.entries(s.items.properties))
				linhas.push(
					`        [].${k}: ${tipo(v)}${v.description ? ' — ' + umaLinha(v.description, 140) : ''}`,
				);
	}
	linhas.push('', '(* = obrigatorio; agent e project sao opcionais em todas)');
	return linhas.join('\n');
}

                                                                                          
export function coagir(v) {
	if (typeof v !== 'string') return v;
	if (v === '') return '';
	if ('[{"'.includes(v[0])) {
		try {
			return JSON.parse(v);
		} catch (e) {
			return v;
		}
	}
	const low = v.toLowerCase();
	if (low === 'true' || low === 'false') return low === 'true';
	if (low === 'null' || low === 'none') return null;
	if (/^-?\d+$/.test(v)) return Number(v);
	if (/^-?\d*\.\d+([eE][-+]?\d+)?$/.test(v)) return Number(v);
	return v;
}

                                                                                        
export function argumentosDeTexto(texto) {
	const out = {};
	const t = String(texto || '').trim();
	if (!t) return out;
	if (t[0] === '{') return JSON.parse(t);
	const tokens = t.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
	for (const tok of tokens) {
		const m = tok.match(/^([A-Za-z_][\w.-]*)(:=|=)([\s\S]*)$/);
		if (!m)
			throw new Error(
				`argumento invalido '${tok}': use chave=valor, chave:=json ou um unico JSON`,
			);
		let [, key, op, val] = m;
		if (
			(val.startsWith('"') && val.endsWith('"') && val.length >= 2) ||
			(val.startsWith("'") && val.endsWith("'") && val.length >= 2)
		) {
			const interno = val.slice(1, -1);
			                                                                                
			if (op === '=') {
				atribuir(out, key, val.startsWith('"') ? tentarJson(val, interno) : interno);
				continue;
			}
			val = interno;
		}
		atribuir(out, key, op === ':=' ? JSON.parse(val) : coagir(val));
	}
	return out;
}
function tentarJson(bruto, interno) {
	try {
		return JSON.parse(bruto);
	} catch (e) {
		return interno;
	}
}
function atribuir(out, key, valor) {
	const partes = key.split('.');
	let cur = out;
	for (const p of partes.slice(0, -1)) cur = cur[p] ??= {};
	cur[partes[partes.length - 1]] = valor;
}

                                                                                       
                                                                                        
                                                                                  
const MAPA_WAF = [
	[/&#10216;|&#x27E8;|\u27E8/gi, '<'],
	[/&#10217;|&#x27E9;|\u27E9/gi, '>'],
	[/&#65309;|&#xFF1D;|\uFF1D/gi, '='],
	[/&#8758;|&#x2236;|\u2236/gi, ':'],
	[/^\[WAF\] Resultado codificado[^\n]*\n(?:Trocas:[^\n]*\n)?/, ''],
];
export function decodificarWaf(texto) {
	if (typeof texto !== 'string' || !texto) return texto;
	let t = texto;
	for (const [re, sub] of MAPA_WAF) t = t.replace(re, sub);
	return t;
}
export function decodificarArgs(valor) {
	if (typeof valor === 'string') return decodificarWaf(valor);
	if (!valor || typeof valor !== 'object') return valor;
	if (Array.isArray(valor)) return valor.map(decodificarArgs);
	const out = {};
	for (const k of Object.keys(valor)) out[k] = decodificarArgs(valor[k]);
	return out;
}

                                                  
export function textoDoResultado(result) {
	if (!result || typeof result !== 'object') return '';
	const partes = [];
	for (const item of Array.isArray(result.content) ? result.content : []) {
		if (!item) continue;
		if (item.type === 'text')
			partes.push(decodificarWaf(String(item.text == null ? '' : item.text)));
		else if (item.type === 'image')
			partes.push(
				`[imagem ${item.mimeType || 'image/*'} · ${(item.data || '').length} bytes base64 — use ?format=json (ou o comando 'shot' do CLI) para salvar o arquivo]`,
			);
		else if (item.type === 'resource')
			partes.push(`[resource ${(item.resource && item.resource.uri) || ''}]`);
		else partes.push(JSON.stringify(item));
	}
	if (!partes.length && result.structuredContent)
		partes.push(JSON.stringify(result.structuredContent, null, 2));
	return partes.join('\n');
}

export function ajudaTerminal(base, nomes) {
	return `Synapse Live Preview MCP — acesso por terminal
URL: ${base}

Voce e um agente com terminal? Nao precisa de handshake MCP, sessao, helper nem configuracao.

OPCAO 1 — CLI pronto (recomendado; so precisa de python3):
  curl -fsSL ${base}/cli -o syn && chmod +x syn
  ./syn status                          projeto ativo, preview, erros no console
  ./syn ls                              lista de arquivos do projeto
  ./syn read src/app.js                 conteudo (start_line= end_line= para trechos)
  ./syn search "TODO" context_lines=2   busca em todos os arquivos (regex=true opcional)
  ./syn write src/app.js @local.js      grava (ou - para stdin, ou o texto direto)
  ./syn edit src/app.js 'antigo' 'novo' substituicao exata (old_str deve ser unico)
  ./syn check src/app.js                valida sintaxe sem executar
  ./syn errors 4                        recompila o preview e devolve os erros de 4 s
  ./syn console                         console.log/erros do preview
  ./syn shot tela.png                   screenshot do preview salvo em arquivo
  ./syn tools | ./syn schema edit_file  catalogo e parametros
  ./syn call <ferramenta> k=v k:='{"json":1}' ...   qualquer ferramenta
  Sem python: curl -fsSL ${base}/cli.mjs -o syn (node) ou ${base}/cli.sh (bash+curl). Mesmos comandos.
  A identidade (agent) e criada e guardada automaticamente pelo CLI (~/.synapse-mcp-agent).

TRABALHAR NA SUA SANDBOX (projeto inteiro, byte a byte):
  ./syn pull ./projeto                  baixa o projeto INTEIRO (codigo + assets) para a pasta, em segundos
  ./syn push ./projeto                  espelho continuo: toda edicao/novo arquivo/asset/exclusao na pasta
                                        aparece no projeto do editor (com aviso e registro para o usuario)
  ./syn push ./projeto --once           sincroniza uma vez e sai;  --force sobrescreve conflitos;
                                        --delete apaga no editor o que sumiu da pasta;  --exclude glob
  Fluxo: pull -> edite e teste localmente -> push (deixe rodando) -> tudo que voce salvar ja esta na IDE.

OPCAO 2 — curl direto (qualquer linguagem):
  curl -s ${base}/tools                                  lista;  ${base}/tools/<nome> = parametros
  curl -s -H 'X-Mcp-Agent: meu-agente' ${base}/call/list_files
  curl -s -H 'X-Mcp-Agent: meu-agente' -d 'path=src/app.js start_line=1 end_line=80' ${base}/call/read_file
  curl -s -H 'X-Mcp-Agent: meu-agente' -H 'Content-Type: application/json' -d '{"query":"TODO"}' ${base}/call/search
  curl -s ${base}/file/src/app.js                        conteudo cru do arquivo
  curl -s -X PUT --data-binary @local.js ${base}/file/src/app.js      grava o arquivo com o corpo
  curl -s -X DELETE ${base}/file/src/velho.js                          apaga
  Corpo do /call: JSON ou "chave=valor chave2=valor2" (numeros/booleanos/JSON convertidos; k:=json forca JSON).
  Resposta: texto limpo. HTTP 200 = ok; 4xx/5xx = erro (o texto explica). ?format=json devolve o objeto bruto.
  Use SEMPRE o mesmo X-Mcp-Agent (qualquer nome unico seu) em todas as chamadas — e a sua identidade
  para travas, revisoes e recados entre agentes.

OPCAO 3 — cliente MCP padrao (Streamable HTTP): POST ${base} com JSON-RPC. SSE legado: ?transport=sse

Regras: caminhos relativos sem barra inicial (src/app.js). Toda gravacao atualiza o preview ao vivo.
Fluxo eficiente: status -> ls -> search/outline -> read (trechos) -> edit/write -> check -> errors -> shot.
Ferramentas: ${(nomes || []).join(', ') || '(catalogo ainda nao carregado: abra o Synapse e ative o MCP)'}
`;
}

                                                                                                
                                                                                     
                                                                                                

const AJUDA_CLI = `syn — Synapse Live Preview MCP via terminal (URL ja configurada)
  syn status                           projeto ativo, preview, erros
  syn ls                               list_files
  syn read <path> [start_line= end_line=]
  syn cat <path>                       conteudo cru (sem cabecalho)
  syn write <path> <@arquivo | - | texto>
  syn edit <path> <antigo> <novo> [replace_all=true]
  syn search <texto> [regex=true context_lines=N path=src]
  syn check [path]                     check_syntax
  syn errors [segundos]                wait_for_errors
  syn console                          console do preview
  syn shot [saida.png]                 screenshot do preview
  syn tools | syn schema <tool>        catalogo e parametros
  syn call <tool> [k=v k:=json | '{json}' | @args.json | -]
  syn agent                            identidade usada (SYN_AGENT sobrescreve)
  syn pull [pasta] [include= exclude= binaries=false max_file_mb=]
                                       baixa o projeto INTEIRO (byte a byte) para a pasta (padrao ./nome-do-projeto)
  syn push <pasta> [--once] [--force] [--delete] [--interval 1] [--exclude glob]... [--include glob]...
           [--max-file-mb 48] [--batch-mb 2] [--log arquivo] [--dry-run] [--no-initial] [--note texto]
                                       espelha a pasta no projeto do editor: cada alteracao local (codigo, asset,
                                       exclusao, renomeacao) e aplicada na IDE com aviso e registro. Ctrl+C encerra.
  --json                               resposta em JSON bruto
  --project <id>                       projeto alvo (padrao: o ativo no Synapse)
Exemplos:
  syn call edit_file path=src/app.js old_str='foo' new_str='bar'
  syn call write_files files:='[{"path":"a.js","content":"1"}]'
  syn call interact steps:='[{"click":"#btn"}]' screenshot_after=true
  syn pull ./projeto && cd projeto && ../syn push . &      # baixa tudo e deixa o espelho rodando
Ignorados pelo push: .git node_modules __pycache__ *.pyc .DS_Store (+ padroes de um .synapseignore na pasta).`;

                                                                                                   
                                                                                         
const PY_SANDBOX = String.raw`
# ---------------------------------------------------------------------------------------------
# Sandbox: pull (baixa o projeto inteiro) e push (espelha a pasta local no projeto do editor)
# ---------------------------------------------------------------------------------------------
import fnmatch, hashlib, socket, stat, subprocess, tempfile, time

IGNORAR = [".git", ".hg", ".svn", "node_modules", "__pycache__", ".DS_Store", "Thumbs.db", "*.pyc", "*.pyo",
           "*.swp", "*~", ".venv", "venv", ".mypy_cache", ".pytest_cache", ".cache", "*.synapse.zip",
           ".synapse-push.log", "synapse_download.py"]
RAIZ_IGNORAR = {"syn", "syn.py", "syn.mjs", "syn.sh", ".synapseignore"}
BINARIAS = {"png", "jpg", "jpeg", "jfif", "gif", "webp", "avif", "ico", "bmp", "tif", "tiff", "psd", "mp3", "wav",
            "ogg", "oga", "opus", "flac", "m4a", "aac", "mp4", "m4v", "webm", "mov", "mkv", "avi", "zip", "gz",
            "tgz", "bz2", "xz", "7z", "rar", "jar", "wasm", "glb", "fbx", "stl", "woff", "woff2", "ttf", "otf",
            "eot", "pdf", "docx", "xlsx", "pptx", "exe", "dll", "so", "dylib", "bin", "dat", "db", "sqlite",
            "ktx2", "basis", "drc", "splat", "spz", "sx", "class", "pyc"}
USO_PUSH = ("uso: syn push <pasta> [--once] [--force] [--delete] [--interval 1] [--exclude glob]... "
            "[--include glob]... [--max-file-mb 48] [--batch-mb 2] [--log arquivo] [--dry-run] [--no-initial] [--note texto]")


class ErroPush(Exception):
    pass


class SessaoPerdida(Exception):
    pass


class EncerradoPeloUsuario(Exception):
    pass


def _agora():
    return time.strftime("%H:%M:%S")


def _kb(n):
    if n < 1024:
        return "%d B" % n
    if n < 1048576:
        return "%.1f KB" % (n / 1024.0)
    return "%.1f MB" % (n / 1048576.0)


def _carregar_ignore(raiz):
    pats = list(IGNORAR)
    try:
        with open(os.path.join(raiz, ".synapseignore"), encoding="utf-8", errors="replace") as fh:
            for linha in fh:
                linha = linha.strip()
                if linha and not linha.startswith("#"):
                    pats.append(linha)
    except OSError:
        pass
    return pats


def _casa(rel, padrao):
    p = padrao.replace("\\", "/").strip()
    if not p:
        return False
    q = p.strip("/")
    if "/" in q:
        return fnmatch.fnmatch(rel, q) or rel.startswith(q + "/") or fnmatch.fnmatch(rel, q + "/*")
    return any(fnmatch.fnmatch(parte, q) for parte in rel.split("/"))


def _ignorado(rel, pats, extras):
    if "/" not in rel and rel in RAIZ_IGNORAR:
        return True
    for p in pats:
        if _casa(rel, p):
            return True
    for p in extras:
        if _casa(rel, p):
            return True
    return False


def _varrer(raiz, pats, excl, incl):
    out = {}
    for pasta, subs, arquivos in os.walk(raiz):
        rel_pasta = os.path.relpath(pasta, raiz).replace(os.sep, "/")
        if rel_pasta == ".":
            rel_pasta = ""
        vivos = []
        for s in sorted(subs):
            rel_s = (rel_pasta + "/" + s) if rel_pasta else s
            if _ignorado(rel_s, pats, excl) or os.path.islink(os.path.join(pasta, s)):
                continue
            vivos.append(s)
        subs[:] = vivos
        for nome in arquivos:
            rel = (rel_pasta + "/" + nome) if rel_pasta else nome
            if _ignorado(rel, pats, excl):
                continue
            if incl and not any(_casa(rel, g) for g in incl):
                continue
            caminho = os.path.join(pasta, nome)
            try:
                st = os.stat(caminho)
            except OSError:
                continue
            if not stat.S_ISREG(st.st_mode):
                continue
            out[rel] = (st.st_size, st.st_mtime_ns)
    return out


def _hash(caminho):
    h = hashlib.sha1()
    with open(caminho, "rb") as fh:
        for bloco in iter(lambda: fh.read(1 << 20), b""):
            h.update(bloco)
    return h.hexdigest()[:16]


def _texto_de(rel, dados):
    nome = rel.rsplit("/", 1)[-1]
    ext = nome.rsplit(".", 1)[-1].lower() if "." in nome else ""
    if ext in BINARIAS or b"\x00" in dados[:8192]:
        return None
    try:
        return dados.decode("utf-8")
    except UnicodeDecodeError:
        return None


def _ops_de_arquivo(raiz, rel, expect, limite):
    with open(os.path.join(raiz, rel), "rb") as fh:
        dados = fh.read()
    texto = _texto_de(rel, dados)
    base = {"path": rel}
    if expect:
        base["expect"] = expect
    if texto is not None and len(dados) <= limite:
        op = dict(base, op="write", content=texto)
        return [op], len(dados), len(dados)
    b64 = base64.b64encode(dados).decode("ascii")
    if len(b64) <= limite:
        op = dict(base, op="write_b64", base64=b64)
        return [op], len(b64), len(dados)
    total = max(1, -(-len(b64) // limite))
    partes = []
    for i in range(total):
        partes.append(dict(base, op="part", index=i, total=total, size=len(dados), base64=b64[i * limite:(i + 1) * limite]))
    return partes, len(b64), len(dados)


def _q(est, extra=None):
    q = dict(extra or {})
    if est.get("projeto"):
        q["project"] = est["projeto"]
    return q


def _json_de(raw):
    texto = raw.decode("utf-8", "replace") if isinstance(raw, bytes) else str(raw)
    try:
        return json.loads(texto), texto
    except ValueError:
        return None, texto


def _textos(obj):
    res = (obj or {}).get("result") or {}
    return [i.get("text", "") for i in res.get("content") or [] if i.get("type") == "text"]


def _erro_de(obj, texto):
    if obj and obj.get("error"):
        return str(obj["error"].get("message") or obj["error"])
    ts = _textos(obj)
    return ts[0] if ts else texto[:400]


def _meta_de(obj):
    ts = _textos(obj)
    for t in ts[1:]:
        try:
            m = json.loads(t)
            if isinstance(m, dict):
                return m, ts
        except ValueError:
            continue
    return {}, ts


def _linha(est, simbolo, rel, extra=""):
    msg = "%s  %s %s%s" % (_agora(), simbolo, rel, ("  " + extra) if extra else "")
    print(msg, flush=True)
    if est.get("log"):
        try:
            with open(est["log"], "a", encoding="utf-8") as fh:
                fh.write(msg + "\n")
        except OSError:
            pass


def _aviso(est, texto):
    _linha(est, "!", texto)


def _chamar_push(est, corpo, timeout="120"):
    return http("POST", "/call/push_sync", json.dumps(corpo), "application/json", _q(est, {"format": "json", "timeout": timeout}))


def _iniciar(est):
    corpo = {"action": "start", "folder": est["raiz"], "host": socket.gethostname()}
    if est.get("note"):
        corpo["note"] = est["note"]
    atraso = 1.0
    for tentativa in range(10):
        status, raw = _chamar_push(est, corpo)
        obj, texto = _json_de(raw)
        if 200 <= status < 300 and obj is not None:
            meta, ts = _meta_de(obj)
            if not meta.get("session"):
                raise ErroPush("resposta inesperada do editor: " + texto[:300])
            remoto = {}
            if len(ts) >= 3:
                try:
                    for linha in json.loads(ts[2]):
                        remoto[linha[0]] = linha[2]
                except (ValueError, IndexError, TypeError):
                    pass
            est["sessao"] = meta["session"]
            est["seq"] = 0
            est["projeto_nome"] = meta.get("project", "")
            return remoto
        if status in (0, 429, 502, 503, 504) or status >= 500:
            _aviso(est, "editor/relay indisponivel (HTTP %d): nova tentativa em %.0fs" % (status, atraso))
            time.sleep(atraso)
            atraso = min(atraso * 1.7, 20.0)
            continue
        raise ErroPush("nao consegui abrir a sessao de push (HTTP %d): %s" % (status, _erro_de(obj, texto)))
    raise ErroPush("editor indisponivel: desisti de abrir a sessao de push")


def _aplicar(est, ops):
    est["seq"] += 1
    corpo = {"action": "apply", "session": est["sessao"], "seq": est["seq"], "ops": ops}
    if est.get("force"):
        corpo["force"] = True
    atraso = 1.0
    for tentativa in range(12):
        status, raw = _chamar_push(est, corpo)
        obj, texto = _json_de(raw)
        if obj is not None and (200 <= status < 300 or status in (400, 404, 422)):
            if status != 422 and 200 <= status < 300 and obj.get("ok", True):
                meta, _ts = _meta_de(obj)
                return meta
            msg = _erro_de(obj, texto)
            baixa = msg.lower()
            if "pelo usuario" in baixa:
                est["sessao"] = None
                raise EncerradoPeloUsuario(msg)
            if ("sessao" in baixa or "sessão" in baixa) and ("nao existe" in baixa or "não existe" in baixa or "expirad" in baixa or "encerrad" in baixa or "nao esta mais aberto" in baixa):
                raise SessaoPerdida(msg)
            raise ErroPush(msg)
        if status in (0, 429, 502, 503, 504) or status >= 500:
            _aviso(est, "editor/relay indisponivel (HTTP %d): lote fica pendente, nova tentativa em %.0fs" % (status, atraso))
            time.sleep(atraso)
            atraso = min(atraso * 1.7, 20.0)
            continue
        raise ErroPush("HTTP %d: %s" % (status, texto[:400]))
    raise ErroPush("desisti do lote depois de 12 tentativas (editor offline?)")


def _grupos_de(est, pendentes):
    # pendentes: lista de (tipo, rel, extra) com tipo em write/delete/rename.
    # Devolve grupos; cada grupo e uma lista de lotes que precisam ir juntos (partes de um arquivo grande).
    limite = int(est["batch_mb"] * 1048576)
    teto = int(est["max_file_mb"] * 1048576)
    grupos = []
    atual, peso = [], 0
    for tipo, rel, extra in pendentes:
        if tipo == "write":
            caminho = os.path.join(est["raiz"], rel)
            try:
                tam = os.path.getsize(caminho)
            except OSError:
                continue
            if tam > teto:
                _aviso(est, "%s tem %s e passou de --max-file-mb %.0f: nao espelhado" % (rel, _kb(tam), est["max_file_mb"]))
                continue
            try:
                ops, p, _bruto = _ops_de_arquivo(est["raiz"], rel, extra, limite)
            except OSError as e:
                _aviso(est, "%s: nao consegui ler (%s)" % (rel, e))
                continue
            if len(ops) > 1:
                if atual:
                    grupos.append([atual])
                    atual, peso = [], 0
                grupos.append([[op] for op in ops])
                continue
            if atual and peso + p > limite:
                grupos.append([atual])
                atual, peso = [], 0
            atual.append(ops[0])
            peso += p
        elif tipo == "delete":
            op = {"op": "delete", "path": rel}
            if extra:
                op["expect"] = extra
            atual.append(op)
        elif tipo == "rename":
            atual.append({"op": "rename", "from": rel, "to": extra})
        if len(atual) >= 300:
            grupos.append([atual])
            atual, peso = [], 0
    if atual:
        grupos.append([atual])
    return grupos


def _enviar_grupo(est, grupo):
    # Reabre a sessao se ela sumiu e reenvia o grupo inteiro (as partes de um arquivo nao podem se separar).
    for tentativa in range(2):
        try:
            metas = []
            for lote in grupo:
                metas.append(_aplicar(est, lote))
            return metas
        except SessaoPerdida as e:
            if tentativa:
                raise ErroPush("sessao perdida de novo: " + str(e)[:200])
            _aviso(est, "sessao perdida (%s): abrindo outra e reenviando" % str(e)[:160])
            est["remoto"] = _iniciar(est)
    return []


def _enviar(est, pendentes):
    grupos = _grupos_de(est, pendentes)
    if est.get("dry"):
        for grupo in grupos:
            for lote in grupo:
                for op in lote:
                    _linha(est, "?", op.get("path") or op.get("from"), "(dry-run: %s)" % op["op"])
        return
    for grupo in grupos:
        try:
            metas = _enviar_grupo(est, grupo)
        except ErroPush as e:
            ops = [op for lote in grupo for op in lote]
            if len(ops) > 1 and ops[0].get("op") != "part":
                _aviso(est, "lote recusado (%s): reenviando item a item" % str(e)[:200])
                for op in ops:
                    try:
                        _processar(est, _enviar_grupo(est, [[op]]))
                    except ErroPush as e2:
                        _aviso(est, "%s: %s" % (op.get("path") or op.get("from"), str(e2)[:300]))
                continue
            _aviso(est, "%s: %s" % (ops[0].get("path") or ops[0].get("from"), str(e)[:300]))
            continue
        _processar(est, metas)


def _processar(est, metas):
    for meta in metas:
        for item in meta.get("applied") or []:
            rel = item.get("path", "")
            op = item.get("op")
            if op == "delete":
                est["remoto"].pop(rel, None)
                _linha(est, "-", rel, "removido no editor")
            elif op == "rename":
                h = est["remoto"].pop(rel, None)
                if h and item.get("to"):
                    est["remoto"][item["to"]] = h
                _linha(est, ">", rel, "-> " + str(item.get("to", "")))
            elif op in ("create", "write"):
                h = est["hashes"].get(rel)
                if h:
                    est["remoto"][rel] = h
                est["conflitos"].discard(rel)
                lint = item.get("lint")
                _linha(est, "+" if op == "create" else "~", rel, _kb(item.get("bytes", 0)) + (" | SINTAXE: " + lint if lint else ""))
            else:
                _linha(est, "*", rel, str(op))
        for item in meta.get("conflicts") or []:
            rel = item.get("path", "")
            est["remoto"][rel] = item.get("current") or est["remoto"].get(rel)
            est["conflitos"].add(rel)
            _aviso(est, "CONFLITO %s: mudou no editor desde o ultimo espelhamento (editor=%s local=%s). NAO sobrescrevi. Veja com ./syn read %s; a sua proxima edicao local nesse arquivo vai valer (ou rode com --force)." % (rel, item.get("current"), est["hashes"].get(rel), rel))
        for item in meta.get("skipped") or []:
            if item.get("op") == "part":
                continue
            _linha(est, ".", item.get("path", ""), "ignorado: " + str(item.get("reason", "")))


def _diferencas(est, antes, agora):
    # devolve (pendentes, novos_hashes). Deteccao de renomeacao: sumiu X e apareceu Y com o mesmo hash e tamanho.
    pend = []
    novos = {}
    sumiram = {rel: antes[rel] for rel in antes if rel not in agora}
    candidatos = {}
    for rel, (tam, mtime) in agora.items():
        velho = antes.get(rel)
        if velho and velho[0] == tam and velho[1] == mtime:
            continue
        try:
            h = _hash(os.path.join(est["raiz"], rel))
        except OSError:
            continue
        novos[rel] = h
        if not velho:
            candidatos[rel] = (tam, h)
        elif est["hashes"].get(rel) != h:
            pend.append(("write", rel, None if est.get("force") else est["remoto"].get(rel)))
    usados = set()
    for rel_velho, (tam, mtime) in sumiram.items():
        h = est["hashes"].get(rel_velho)
        par = None
        for rel_novo, (tam2, h2) in candidatos.items():
            if rel_novo not in usados and h2 == h and tam2 == tam and rel_velho in est["remoto"]:
                par = rel_novo
                break
        if par:
            usados.add(par)
            pend.append(("rename", rel_velho, par))
        else:
            pend.append(("delete", rel_velho, None if est.get("force") else est["remoto"].get(rel_velho)))
    for rel_novo, (tam, h) in candidatos.items():
        if rel_novo in usados:
            continue
        if est["remoto"].get(rel_novo) == h:
            continue
        pend.append(("write", rel_novo, None if est.get("force") else est["remoto"].get(rel_novo)))
    return pend, novos


def _aplicar_estado(est, pend, novos, agora):
    for rel, h in novos.items():
        est["hashes"][rel] = h
    for tipo, rel, extra in pend:
        if tipo == "delete":
            est["hashes"].pop(rel, None)
        elif tipo == "rename":
            est["hashes"].pop(rel, None)
    est["local"] = dict(agora)


def cmd_pull(rest, projeto):
    dest = None
    kv, flags = [], []
    for a in rest:
        if a.startswith("--"):
            flags.append(a)
        elif "=" in a:
            kv.append(a)
        elif dest is None:
            dest = a
        else:
            flags.append(a)
    args = ["action=script"] + (["out=" + dest] if dest else []) + kv
    status, raw = chamar("download_project", args, "json", projeto)
    obj, texto = _json_de(raw)
    ts = _textos(obj)
    if status != 200 or len(ts) < 2:
        print(_erro_de(obj, texto) if obj else texto)
        return 1
    script = ts[-1]
    tmp = tempfile.NamedTemporaryFile("w", suffix=".py", delete=False, encoding="utf-8")
    tmp.write(script)
    tmp.close()
    cmd = [sys.executable, tmp.name, "--url", BASE, "--agent", agente()] + (["--out", dest] if dest else []) + flags
    print("Synapse: baixando o projeto inteiro para %s ..." % (dest or "./<nome-do-projeto>"), flush=True)
    try:
        codigo = subprocess.call(cmd)
    finally:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass
    if codigo == 0:
        print("Pronto. Para espelhar suas edicoes de volta no editor: ./syn push %s" % (dest or "./<pasta>"), flush=True)
    return codigo


def cmd_push(rest, projeto):
    est = {"once": False, "force": False, "delete": False, "dry": False, "no_initial": False, "interval": 1.0,
           "batch_mb": 2.0, "max_file_mb": 48.0, "exclude": [], "include": [], "log": None, "note": "",
           "projeto": projeto, "hashes": {}, "remoto": {}, "conflitos": set(), "seq": 0, "sessao": None}
    pasta = None
    i = 0
    while i < len(rest):
        a = rest[i]
        prox = rest[i + 1] if i + 1 < len(rest) else None
        if a == "--once": est["once"] = True
        elif a == "--force": est["force"] = True
        elif a == "--delete": est["delete"] = True
        elif a == "--dry-run": est["dry"] = True
        elif a == "--no-initial": est["no_initial"] = True
        elif a in ("--interval", "--batch-mb", "--max-file-mb") and prox is not None:
            est[a[2:].replace("-", "_")] = float(prox); i += 1
        elif a in ("--exclude", "--include") and prox is not None:
            est[a[2:]].append(prox); i += 1
        elif a == "--log" and prox is not None:
            est["log"] = prox; i += 1
        elif a == "--note" and prox is not None:
            est["note"] = prox; i += 1
        elif a.startswith("--"):
            print("opcao desconhecida: " + a + "\n" + USO_PUSH); return 2
        elif pasta is None:
            pasta = a
        i += 1
    if not pasta:
        print(USO_PUSH); return 2
    raiz = os.path.abspath(pasta)
    if not os.path.isdir(raiz):
        print("pasta nao encontrada: " + raiz); return 2
    est["raiz"] = raiz
    est["batch_mb"] = max(0.2, min(6.0, est["batch_mb"]))
    pats = _carregar_ignore(raiz)
    est["pats"] = pats
    print("Synapse push: espelhando %s no projeto%s (agente %s). Ctrl+C encerra." % (raiz, (" " + projeto) if projeto else " ativo", agente()), flush=True)
    if est["dry"]:
        status, raw = _chamar_push(est, {"action": "manifest"})
        obj, texto = _json_de(raw)
        if status != 200 or obj is None:
            print(_erro_de(obj, texto) if obj else texto); return 1
        _meta, ts = _meta_de(obj)
        try:
            est["remoto"] = {l[0]: l[2] for l in json.loads(ts[-1])}
        except (ValueError, IndexError, TypeError):
            est["remoto"] = {}
        est["projeto_nome"] = _meta.get("project", "")
    else:
        est["remoto"] = _iniciar(est)
        print("%s  sessao %s aberta no projeto \"%s\" (%d arquivo(s) no editor)" % (_agora(), est["sessao"], est.get("projeto_nome", ""), len(est["remoto"])), flush=True)
    codigo = 0
    try:
        agora = _varrer(raiz, pats, est["exclude"], est["include"])
        pend = []
        for rel, (tam, mtime) in agora.items():
            try:
                h = _hash(os.path.join(raiz, rel))
            except OSError:
                continue
            est["hashes"][rel] = h
            if est["remoto"].get(rel) != h:
                pend.append(("write", rel, None if est["force"] else est["remoto"].get(rel)))
        so_no_editor = [rel for rel in est["remoto"] if rel not in agora and not _ignorado(rel, pats, est["exclude"]) and (not est["include"] or any(_casa(rel, g) for g in est["include"]))]
        if est["delete"]:
            for rel in so_no_editor:
                pend.append(("delete", rel, None if est["force"] else est["remoto"].get(rel)))
        elif so_no_editor:
            _aviso(est, "%d arquivo(s) existem so no editor e foram mantidos (use --delete para remove-los): %s%s" % (len(so_no_editor), ", ".join(so_no_editor[:5]), " ..." if len(so_no_editor) > 5 else ""))
        est["local"] = dict(agora)
        if est["no_initial"]:
            if pend:
                _aviso(est, "%d diferenca(s) iniciais ignoradas por --no-initial; so alteracoes a partir de agora serao espelhadas" % len(pend))
            for tipo, rel, extra in pend:
                if tipo == "write":
                    est["remoto"][rel] = est["hashes"].get(rel)
        elif pend:
            print("%s  sincronizacao inicial: %d alteracao(oes)" % (_agora(), len(pend)), flush=True)
            _enviar(est, pend)
        else:
            print("%s  pasta e editor ja estao iguais (%d arquivo(s))" % (_agora(), len(agora)), flush=True)
        if est["once"] or est["dry"]:
            return 0
        print("%s  observando a pasta (intervalo %.1fs)..." % (_agora(), est["interval"]), flush=True)
        ultimo_sinal = time.time()
        while True:
            time.sleep(max(0.2, est["interval"]))
            agora = _varrer(raiz, pats, est["exclude"], est["include"])
            pend, novos = _diferencas(est, est["local"], agora)
            if pend:
                time.sleep(0.4)
                agora = _varrer(raiz, pats, est["exclude"], est["include"])
                pend, novos = _diferencas(est, est["local"], agora)
            if pend:
                _aplicar_estado(est, pend, novos, agora)
                _enviar(est, pend)
                ultimo_sinal = time.time()
            elif novos:
                _aplicar_estado(est, [], novos, agora)
            elif time.time() - ultimo_sinal > 600:
                try:
                    _chamar_push(est, {"action": "status", "session": est["sessao"]}, "30")
                except Exception:
                    pass
                ultimo_sinal = time.time()
    except KeyboardInterrupt:
        print("", flush=True)
    except EncerradoPeloUsuario:
        print("%s  o usuario encerrou o espelho pelo painel MCP. Saindo." % _agora(), flush=True)
    except ErroPush as e:
        _aviso(est, "erro: " + str(e))
        codigo = 1
    finally:
        if est.get("sessao") and not est["dry"]:
            try:
                _chamar_push(est, {"action": "end", "session": est["sessao"], "reason": "CLI encerrado"}, "30")
            except Exception:
                pass
            print("%s  espelho encerrado." % _agora(), flush=True)
    return codigo
`;

export function cliPython(base) {
	return `#!/usr/bin/env python3
# syn — CLI do Synapse Live Preview MCP (gerado pelo servidor; ja vem com a URL). Uso: ./syn help
import base64, json, os, re, sys, urllib.error, urllib.parse, urllib.request, uuid

BASE = os.environ.get("SYN_MCP_URL", ${JSON.stringify(base)}).rstrip("/")
AGENT_FILE = os.path.join(os.environ.get("HOME") or os.environ.get("USERPROFILE") or ".", ".synapse-mcp-agent")
HELP = ${JSON.stringify(AJUDA_CLI)}
KV = re.compile(r"^([A-Za-z_][\\w.-]*)(:=|=)([\\s\\S]*)$", re.S)

def agente():
    a = os.environ.get("SYN_AGENT") or os.environ.get("MCP_AGENT")
    if a:
        return a
    try:
        a = open(AGENT_FILE).read().strip()
    except OSError:
        a = ""
    if not a:
        a = "cli_" + uuid.uuid4().hex[:10]
        try:
            open(AGENT_FILE, "w").write(a)
        except OSError:
            pass
    return a

def http(method, path, body=None, ctype="text/plain; charset=utf-8", query=None):
    url = BASE + path
    if query:
        url += ("&" if "?" in url else "?") + urllib.parse.urlencode(query)
    data = body.encode() if isinstance(body, str) else body
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Content-Type": ctype, "X-Mcp-Agent": agente(), "Accept": "text/plain, application/json",
        "User-Agent": "syn-cli/${VERSAO_TERMINAL}"})
    try:
        with urllib.request.urlopen(req, timeout=float(os.environ.get("SYN_TIMEOUT", "180"))) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except urllib.error.URLError as e:
        return 0, ("ERRO REDE: " + str(e.reason)).encode()

def saida(status, raw):
    texto = raw.decode("utf-8", "replace") if isinstance(raw, bytes) else str(raw)
    sys.stdout.write(texto if texto.endswith("\\n") else texto + "\\n")
    return 0 if 200 <= status < 300 else 1

def corpo_args(args):
    # Sempre manda JSON: cada k=v vira chave com coercao simples; k:=json e JSON literal.
    if len(args) == 1 and args[0] == "-":
        return sys.stdin.read(), "application/json"
    if len(args) == 1 and args[0].startswith("@"):
        return open(args[0][1:]).read(), "application/json"
    if len(args) == 1 and args[0].lstrip().startswith("{"):
        return args[0], "application/json"
    obj = {}
    for a in args:
        m = KV.match(a)
        if not m:
            raise SystemExit("argumento invalido: " + a + " (use chave=valor ou chave:=json)")
        k, op, v = m.group(1), m.group(2), m.group(3)
        obj[k] = json.loads(v) if op == ":=" else coagir(v)
    return json.dumps(obj), "application/json"

def coagir(v):
    if v in ("true", "false"): return v == "true"
    if v in ("null", "none"): return None
    if re.match(r"^-?\\d+$", v): return int(v)
    if re.match(r"^-?\\d*\\.\\d+$", v): return float(v)
    if v[:1] in "[{":
        try: return json.loads(v)
        except ValueError: pass
    return v

def chamar(tool, args, fmt, projeto):
    body, ctype = corpo_args(args)
    q = {}
    if fmt: q["format"] = fmt
    if projeto: q["project"] = projeto
    return http("POST", "/call/" + tool, body, ctype, q)

def chamar_e_sair(tool, args, fmt, projeto):
    return saida(*chamar(tool, args, fmt, projeto))
${PY_SANDBOX}

def main(argv):
    fmt = "json" if "--json" in argv else None
    projeto = None
    if "--project" in argv:
        i = argv.index("--project"); projeto = argv[i + 1]; argv = argv[:i] + argv[i + 2:]
    argv = [a for a in argv if a != "--json"]
    if not argv or argv[0] in ("help", "-h", "--help"):
        print(HELP); return 0
    cmd, rest = argv[0], argv[1:]
    qp = {"project": projeto} if projeto else None
    if cmd == "agent":
        print(agente()); return 0
    if cmd == "tools":
        return saida(*http("GET", "/tools"))
    if cmd == "schema":
        if not rest: print("uso: syn schema <tool>"); return 2
        return saida(*http("GET", "/tools/" + rest[0]))
    if cmd == "status":
        return chamar_e_sair("project", ["action=status"] + rest, fmt, projeto)
    if cmd == "ls":
        return chamar_e_sair("list_files", rest, fmt, projeto)
    if cmd == "read":
        if not rest: print("uso: syn read <path> [start_line= end_line=]"); return 2
        return chamar_e_sair("read_file", ["path=" + rest[0]] + rest[1:], fmt, projeto)
    if cmd == "cat":
        if not rest: print("uso: syn cat <path>"); return 2
        return saida(*http("GET", "/file/" + urllib.parse.quote(rest[0]), None, "text/plain", qp))
    if cmd == "write":
        if len(rest) < 2: print("uso: syn write <path> <@arquivo | - | texto>"); return 2
        src = rest[1]
        conteudo = sys.stdin.read() if src == "-" else open(src[1:]).read() if src.startswith("@") else src
        return saida(*http("PUT", "/file/" + urllib.parse.quote(rest[0]), conteudo, "text/plain; charset=utf-8", qp))
    if cmd == "edit":
        if len(rest) < 3: print("uso: syn edit <path> <antigo> <novo> [replace_all=true]"); return 2
        args = {"path": rest[0], "old_str": rest[1], "new_str": rest[2]}
        for extra in rest[3:]:
            k, _, v = extra.partition("=")
            args[k] = coagir(v)
        return chamar_e_sair("edit_file", [json.dumps(args)], fmt, projeto)
    if cmd == "search":
        if not rest: print("uso: syn search <texto> [regex=true context_lines=N]"); return 2
        return chamar_e_sair("search", ["query=" + rest[0]] + rest[1:], fmt, projeto)
    if cmd == "check":
        return chamar_e_sair("check_syntax", (["path=" + rest[0]] if rest else []), fmt, projeto)
    if cmd == "errors":
        return chamar_e_sair("wait_for_errors", (["seconds=" + rest[0]] if rest else []) + rest[1:], fmt, projeto)
    if cmd == "console":
        return chamar_e_sair("preview", ["action=console"] + rest, fmt, projeto)
    if cmd == "shot":
        dest = rest[0] if rest and "=" not in rest[0] else "synapse-shot.png"
        extra = [a for a in rest if "=" in a]
        status, raw = chamar("capture", ["action=shot"] + extra, "json", projeto)
        try:
            obj = json.loads(raw.decode("utf-8", "replace"))
        except ValueError:
            return saida(status, raw)
        res = obj.get("result") or {}
        for item in res.get("content") or []:
            if item.get("type") == "image" and item.get("data"):
                if item.get("mimeType", "").endswith("jpeg") and dest.endswith(".png"):
                    dest = dest[:-4] + ".jpg"
                open(dest, "wb").write(base64.b64decode(item["data"]))
                print("screenshot salvo em " + dest + " (" + item.get("mimeType", "") + ")")
                return 0
        return saida(status, raw)
    if cmd == "call":
        if not rest: print("uso: syn call <tool> [args]"); return 2
        return chamar_e_sair(rest[0], rest[1:], fmt, projeto)
    if cmd in ("pull", "download"):
        return cmd_pull(rest, projeto)
    if cmd in ("push", "mirror", "watch"):
        return cmd_push(rest, projeto)
    print("comando desconhecido: " + cmd + "\\n" + HELP); return 2

if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except KeyboardInterrupt:
        sys.exit(130)
`;
}

                                                                                          
const JS_SANDBOX = String.raw`
// ---------------------------------------------------------------------------------------------
// Sandbox: pull (baixa o projeto inteiro) e push (espelha a pasta local no projeto do editor)
// ---------------------------------------------------------------------------------------------
const IGNORAR = [".git", ".hg", ".svn", "node_modules", "__pycache__", ".DS_Store", "Thumbs.db", "*.pyc", "*.pyo",
  "*.swp", "*~", ".venv", "venv", ".mypy_cache", ".pytest_cache", ".cache", "*.synapse.zip", ".synapse-push.log", "synapse_download.py"];
const RAIZ_IGNORAR = new Set(["syn", "syn.py", "syn.mjs", "syn.sh", ".synapseignore"]);
const BINARIAS = new Set(["png", "jpg", "jpeg", "jfif", "gif", "webp", "avif", "ico", "bmp", "tif", "tiff", "psd", "mp3", "wav",
  "ogg", "oga", "opus", "flac", "m4a", "aac", "mp4", "m4v", "webm", "mov", "mkv", "avi", "zip", "gz", "tgz", "bz2", "xz", "7z",
  "rar", "jar", "wasm", "glb", "fbx", "stl", "woff", "woff2", "ttf", "otf", "eot", "pdf", "docx", "xlsx", "pptx", "exe", "dll",
  "so", "dylib", "bin", "dat", "db", "sqlite", "ktx2", "basis", "drc", "splat", "spz", "sx", "class", "pyc"]);
const USO_PUSH = "uso: syn push <pasta> [--once] [--force] [--delete] [--interval 1] [--exclude glob]... [--include glob]... [--max-file-mb 48] [--batch-mb 2] [--log arquivo] [--dry-run] [--no-initial] [--note texto]";
class ErroPush extends Error {}
class SessaoPerdida extends Error {}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const agora = () => new Date().toTimeString().slice(0, 8);
const kb = (n) => (n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(1) + " KB" : (n / 1048576).toFixed(1) + " MB");
function globRe(g) {
  let s = "";
  for (const ch of g) s += ch === "*" ? ".*" : ch === "?" ? "." : ch.replace(/[.+^$(){}|[\]\\]/g, "\\$&");
  return new RegExp("^" + s + "$");
}
function casa(rel, padrao) {
  const p = String(padrao).replace(/\\/g, "/").trim();
  if (!p) return false;
  const q = p.replace(/^\/+|\/+$/g, "");
  if (q.includes("/")) return globRe(q).test(rel) || rel.startsWith(q + "/") || globRe(q + "/*").test(rel);
  const re = globRe(q);
  return rel.split("/").some((parte) => re.test(parte));
}
function ignorado(rel, pats, extras) {
  if (!rel.includes("/") && RAIZ_IGNORAR.has(rel)) return true;
  return pats.some((p) => casa(rel, p)) || extras.some((p) => casa(rel, p));
}
function carregarIgnore(raiz) {
  const pats = IGNORAR.slice();
  try {
    for (const l of readFileSync(join(raiz, ".synapseignore"), "utf8").split(/\r?\n/)) { const t = l.trim(); if (t && !t.startsWith("#")) pats.push(t); }
  } catch {}
  return pats;
}
function varrer(raiz, pats, excl, incl) {
  const out = new Map();
  const walk = (dir, relDir) => {
    let entradas;
    try { entradas = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    entradas.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entradas) {
      const rel = relDir ? relDir + "/" + e.name : e.name;
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) { if (!ignorado(rel, pats, excl)) walk(join(dir, e.name), rel); continue; }
      if (!e.isFile() || ignorado(rel, pats, excl)) continue;
      if (incl.length && !incl.some((g) => casa(rel, g))) continue;
      let st;
      try { st = statSync(join(dir, e.name)); } catch { continue; }
      out.set(rel, [st.size, st.mtimeMs]);
    }
  };
  walk(raiz, "");
  return out;
}
const hashDe = (caminho) => createHash("sha1").update(readFileSync(caminho)).digest("hex").slice(0, 16);
function textoDe(rel, dados) {
  const nome = rel.split("/").pop();
  const ext = nome.includes(".") ? nome.split(".").pop().toLowerCase() : "";
  if (BINARIAS.has(ext) || dados.subarray(0, 8192).includes(0)) return null;
  try { return new TextDecoder("utf-8", { fatal: true }).decode(dados); } catch { return null; }
}
function opsDeArquivo(raiz, rel, expect, limite) {
  const dados = readFileSync(join(raiz, rel));
  const texto = textoDe(rel, dados);
  const base = expect ? { path: rel, expect } : { path: rel };
  if (texto !== null && dados.length <= limite) return [[Object.assign({}, base, { op: "write", content: texto })], dados.length];
  const b64 = dados.toString("base64");
  if (b64.length <= limite) return [[Object.assign({}, base, { op: "write_b64", base64: b64 })], b64.length];
  const total = Math.max(1, Math.ceil(b64.length / limite));
  const partes = [];
  for (let i = 0; i < total; i++) partes.push(Object.assign({}, base, { op: "part", index: i, total, size: dados.length, base64: b64.slice(i * limite, (i + 1) * limite) }));
  return [partes, b64.length];
}
const qDe = (est, extra) => Object.assign({}, extra || {}, est.projeto ? { project: est.projeto } : {});
function jsonDe(texto) { try { return JSON.parse(texto); } catch { return null; } }
const textos = (obj) => (((obj || {}).result || {}).content || []).filter((i) => i && i.type === "text").map((i) => String(i.text == null ? "" : i.text));
function erroDe(obj, texto) {
  if (obj && obj.error) return String(obj.error.message || obj.error);
  const ts = textos(obj);
  return ts.length ? ts[0] : String(texto).slice(0, 400);
}
function metaDe(obj) {
  const ts = textos(obj);
  for (const t of ts.slice(1)) { const m = jsonDe(t); if (m && typeof m === "object" && !Array.isArray(m)) return [m, ts]; }
  return [{}, ts];
}
function linha(est, simbolo, rel, extra) {
  const msg = agora() + "  " + simbolo + " " + rel + (extra ? "  " + extra : "");
  console.log(msg);
  if (est.log) { try { appendFileSync(est.log, msg + "\n"); } catch {} }
}
const aviso = (est, texto) => linha(est, "!", texto);
const chamarPush = (est, corpo, timeout) => http("POST", "/call/push_sync", JSON.stringify(corpo), "application/json", qDe(est, { format: "json", timeout: timeout || "120" }));
async function iniciar(est) {
  const corpo = { action: "start", folder: est.raiz, host: hostname() };
  if (est.note) corpo.note = est.note;
  let atraso = 1000;
  for (let tentativa = 0; tentativa < 10; tentativa++) {
    const [status, texto] = await chamarPush(est, corpo);
    const obj = jsonDe(texto);
    if (status >= 200 && status < 300 && obj) {
      const [meta, ts] = metaDe(obj);
      if (!meta.session) throw new ErroPush("resposta inesperada do editor: " + texto.slice(0, 300));
      const remoto = new Map();
      if (ts.length >= 3) { const linhas = jsonDe(ts[2]); if (Array.isArray(linhas)) for (const l of linhas) remoto.set(l[0], l[2]); }
      est.sessao = meta.session; est.seq = 0; est.projetoNome = meta.project || "";
      return remoto;
    }
    if (status === 0 || status === 429 || status >= 500) {
      aviso(est, "editor/relay indisponivel (HTTP " + status + "): nova tentativa em " + Math.round(atraso / 1000) + "s");
      await sleep(atraso); atraso = Math.min(atraso * 1.7, 20000); continue;
    }
    throw new ErroPush("nao consegui abrir a sessao de push (HTTP " + status + "): " + erroDe(obj, texto));
  }
  throw new ErroPush("editor indisponivel: desisti de abrir a sessao de push");
}
async function aplicar(est, ops) {
  est.seq++;
  const corpo = { action: "apply", session: est.sessao, seq: est.seq, ops };
  if (est.force) corpo.force = true;
  let atraso = 1000;
  for (let tentativa = 0; tentativa < 12; tentativa++) {
    const [status, texto] = await chamarPush(est, corpo);
    const obj = jsonDe(texto);
    if (obj && ((status >= 200 && status < 300) || status === 400 || status === 404 || status === 422)) {
      if (status !== 422 && status >= 200 && status < 300 && obj.ok !== false) return metaDe(obj)[0];
      const msg = erroDe(obj, texto);
      const baixa = msg.toLowerCase();
        if (baixa.includes("pelo usuario")) { console.log(agora() + "  o usuario encerrou o espelho pelo painel MCP. Saindo."); process.exit(0); }
      if ((baixa.includes("sessao") || baixa.includes("sess\u00e3o")) && /nao existe|n\u00e3o existe|expirad|encerrad|nao esta mais aberto/.test(baixa)) throw new SessaoPerdida(msg);
      throw new ErroPush(msg);
    }
    if (status === 0 || status === 429 || status >= 500) {
      aviso(est, "editor/relay indisponivel (HTTP " + status + "): lote fica pendente, nova tentativa em " + Math.round(atraso / 1000) + "s");
      await sleep(atraso); atraso = Math.min(atraso * 1.7, 20000); continue;
    }
    throw new ErroPush("HTTP " + status + ": " + texto.slice(0, 400));
  }
  throw new ErroPush("desisti do lote depois de 12 tentativas (editor offline?)");
}
function gruposDe(est, pendentes) {
  const limite = Math.floor(est.batchMb * 1048576), teto = Math.floor(est.maxFileMb * 1048576);
  const grupos = [];
  let atual = [], peso = 0;
  for (const [tipo, rel, extra] of pendentes) {
    if (tipo === "write") {
      let tam;
      try { tam = statSync(join(est.raiz, rel)).size; } catch { continue; }
      if (tam > teto) { aviso(est, rel + " tem " + kb(tam) + " e passou de --max-file-mb " + est.maxFileMb + ": nao espelhado"); continue; }
      let ops, p;
      try { [ops, p] = opsDeArquivo(est.raiz, rel, extra, limite); } catch (e) { aviso(est, rel + ": nao consegui ler (" + (e && e.message) + ")"); continue; }
      if (ops.length > 1) { if (atual.length) { grupos.push([atual]); atual = []; peso = 0; } grupos.push(ops.map((op) => [op])); continue; }
      if (atual.length && peso + p > limite) { grupos.push([atual]); atual = []; peso = 0; }
      atual.push(ops[0]); peso += p;
    } else if (tipo === "delete") {
      const op = { op: "delete", path: rel }; if (extra) op.expect = extra; atual.push(op);
    } else if (tipo === "rename") atual.push({ op: "rename", from: rel, to: extra });
    if (atual.length >= 300) { grupos.push([atual]); atual = []; peso = 0; }
  }
  if (atual.length) grupos.push([atual]);
  return grupos;
}
async function enviarGrupo(est, grupo) {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try { const metas = []; for (const lote of grupo) metas.push(await aplicar(est, lote)); return metas; }
    catch (e) {
      if (!(e instanceof SessaoPerdida)) throw e;
      if (tentativa) throw new ErroPush("sessao perdida de novo: " + String(e.message).slice(0, 200));
      aviso(est, "sessao perdida (" + String(e.message).slice(0, 160) + "): abrindo outra e reenviando");
      est.remoto = await iniciar(est);
    }
  }
  return [];
}
function processar(est, metas) {
  for (const meta of metas) {
    for (const item of meta.applied || []) {
      const rel = item.path || "", op = item.op;
      if (op === "delete") { est.remoto.delete(rel); linha(est, "-", rel, "removido no editor"); }
      else if (op === "rename") { const h = est.remoto.get(rel); est.remoto.delete(rel); if (h && item.to) est.remoto.set(item.to, h); linha(est, ">", rel, "-> " + (item.to || "")); }
      else if (op === "create" || op === "write") {
        const h = est.hashes.get(rel); if (h) est.remoto.set(rel, h); est.conflitos.delete(rel);
        linha(est, op === "create" ? "+" : "~", rel, kb(item.bytes || 0) + (item.lint ? " | SINTAXE: " + item.lint : ""));
      } else linha(est, "*", rel, String(op));
    }
    for (const item of meta.conflicts || []) {
      const rel = item.path || "";
      est.remoto.set(rel, item.current || est.remoto.get(rel)); est.conflitos.add(rel);
      aviso(est, "CONFLITO " + rel + ": mudou no editor desde o ultimo espelhamento (editor=" + item.current + " local=" + est.hashes.get(rel) + "). NAO sobrescrevi. Veja com ./syn read " + rel + "; a sua proxima edicao local nesse arquivo vai valer (ou rode com --force).");
    }
    for (const item of meta.skipped || []) if (item.op !== "part") linha(est, ".", item.path || "", "ignorado: " + (item.reason || ""));
  }
}
async function enviar(est, pendentes) {
  const grupos = gruposDe(est, pendentes);
  if (est.dry) { for (const g of grupos) for (const lote of g) for (const op of lote) linha(est, "?", op.path || op.from, "(dry-run: " + op.op + ")"); return; }
  for (const grupo of grupos) {
    let metas;
    try { metas = await enviarGrupo(est, grupo); }
    catch (e) {
      const ops = grupo.flat();
      if (ops.length > 1 && ops[0].op !== "part") {
        aviso(est, "lote recusado (" + String(e.message).slice(0, 200) + "): reenviando item a item");
        for (const op of ops) { try { processar(est, await enviarGrupo(est, [[op]])); } catch (e2) { aviso(est, (op.path || op.from) + ": " + String(e2.message).slice(0, 300)); } }
        continue;
      }
      aviso(est, (ops[0].path || ops[0].from) + ": " + String(e.message).slice(0, 300));
      continue;
    }
    processar(est, metas);
  }
}
function diferencas(est, antes, agoraMapa) {
  const pend = [], novos = new Map(), candidatos = new Map();
  const sumiram = [...antes.keys()].filter((rel) => !agoraMapa.has(rel));
  for (const [rel, [tam, mtime]] of agoraMapa) {
    const velho = antes.get(rel);
    if (velho && velho[0] === tam && velho[1] === mtime) continue;
    let h; try { h = hashDe(join(est.raiz, rel)); } catch { continue; }
    novos.set(rel, h);
    if (!velho) candidatos.set(rel, [tam, h]);
    else if (est.hashes.get(rel) !== h) pend.push(["write", rel, est.force ? null : est.remoto.get(rel)]);
  }
  const usados = new Set();
  for (const relVelho of sumiram) {
    const tam = antes.get(relVelho)[0], h = est.hashes.get(relVelho);
    let par = null;
    for (const [relNovo, [tam2, h2]] of candidatos) if (!usados.has(relNovo) && h2 === h && tam2 === tam && est.remoto.has(relVelho)) { par = relNovo; break; }
    if (par) { usados.add(par); pend.push(["rename", relVelho, par]); }
    else pend.push(["delete", relVelho, est.force ? null : est.remoto.get(relVelho)]);
  }
  for (const [relNovo, [, h]] of candidatos) {
    if (usados.has(relNovo) || est.remoto.get(relNovo) === h) continue;
    pend.push(["write", relNovo, est.force ? null : est.remoto.get(relNovo)]);
  }
  return [pend, novos];
}
function aplicarEstado(est, pend, novos, agoraMapa) {
  for (const [rel, h] of novos) est.hashes.set(rel, h);
  for (const [tipo, rel] of pend) if (tipo === "delete" || tipo === "rename") est.hashes.delete(rel);
  est.local = new Map(agoraMapa);
}
async function cmdPull(rest, projeto) {
  let dest = null; const kv = [], flags = [];
  for (const a of rest) { if (a.startsWith("--")) flags.push(a); else if (a.includes("=")) kv.push(a); else if (dest === null) dest = a; else flags.push(a); }
  const [status, texto] = await chamar("download_project", ["action=script", ...(dest ? ["out=" + dest] : []), ...kv], "json", projeto);
  const obj = jsonDe(texto); const ts = textos(obj);
  if (status !== 200 || ts.length < 2) { console.log(obj ? erroDe(obj, texto) : texto); return 1; }
  const tmp = join(mkdtempSync(join(tmpdir(), "synapse-pull-")), "synapse_download.py");
  writeFileSync(tmp, ts[ts.length - 1]);
  console.log("Synapse: baixando o projeto inteiro para " + (dest || "./<nome-do-projeto>") + " ...");
  const r = spawnSync("python3", [tmp, "--url", BASE, "--agent", agente(), ...(dest ? ["--out", dest] : []), ...flags], { stdio: "inherit" });
  try { unlinkSync(tmp); } catch {}
  if (r.error) { console.log("python3 nao encontrado: o downloader e um script Python (biblioteca padrao). Instale python3 ou salve o script devolvido por: ./syn call download_project action=script"); return 1; }
  if (r.status === 0) console.log("Pronto. Para espelhar suas edicoes de volta no editor: ./syn push " + (dest || "./<pasta>"));
  return r.status == null ? 1 : r.status;
}
async function cmdPush(rest, projeto) {
  const est = { once: false, force: false, delete: false, dry: false, noInitial: false, interval: 1, batchMb: 2, maxFileMb: 48, exclude: [], include: [], log: null, note: "", projeto, hashes: new Map(), remoto: new Map(), conflitos: new Set(), seq: 0, sessao: null };
  let pasta = null;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i], prox = rest[i + 1];
    if (a === "--once") est.once = true; else if (a === "--force") est.force = true; else if (a === "--delete") est.delete = true;
    else if (a === "--dry-run") est.dry = true; else if (a === "--no-initial") est.noInitial = true;
    else if (a === "--interval" && prox != null) { est.interval = Number(prox) || 1; i++; }
    else if (a === "--batch-mb" && prox != null) { est.batchMb = Number(prox) || 2; i++; }
    else if (a === "--max-file-mb" && prox != null) { est.maxFileMb = Number(prox) || 48; i++; }
    else if (a === "--exclude" && prox != null) { est.exclude.push(prox); i++; }
    else if (a === "--include" && prox != null) { est.include.push(prox); i++; }
    else if (a === "--log" && prox != null) { est.log = prox; i++; }
    else if (a === "--note" && prox != null) { est.note = prox; i++; }
    else if (a.startsWith("--")) { console.log("opcao desconhecida: " + a + "\n" + USO_PUSH); return 2; }
    else if (pasta === null) pasta = a;
  }
  if (!pasta) { console.log(USO_PUSH); return 2; }
  const raiz = resolve(pasta);
  let ok = false; try { ok = statSync(raiz).isDirectory(); } catch {}
  if (!ok) { console.log("pasta nao encontrada: " + raiz); return 2; }
  est.raiz = raiz; est.batchMb = Math.max(0.2, Math.min(6, est.batchMb));
  const pats = carregarIgnore(raiz);
  console.log("Synapse push: espelhando " + raiz + " no projeto" + (projeto ? " " + projeto : " ativo") + " (agente " + agente() + "). Ctrl+C encerra.");
  if (est.dry) {
    const [status, texto] = await chamarPush(est, { action: "manifest" });
    const obj = jsonDe(texto);
    if (status !== 200 || !obj) { console.log(obj ? erroDe(obj, texto) : texto); return 1; }
    const [meta, ts] = metaDe(obj);
    const linhas = jsonDe(ts[ts.length - 1]); if (Array.isArray(linhas)) for (const l of linhas) est.remoto.set(l[0], l[2]);
    est.projetoNome = meta.project || "";
  } else {
    est.remoto = await iniciar(est);
    console.log(agora() + "  sessao " + est.sessao + " aberta no projeto \"" + est.projetoNome + "\" (" + est.remoto.size + " arquivo(s) no editor)");
  }
  let parar = false, codigo = 0;
  process.on("SIGINT", () => { if (parar) process.exit(130); parar = true; console.log(""); });
  try {
    let agoraMapa = varrer(raiz, pats, est.exclude, est.include);
    const pend = [];
    for (const [rel] of agoraMapa) {
      let h; try { h = hashDe(join(raiz, rel)); } catch { continue; }
      est.hashes.set(rel, h);
      if (est.remoto.get(rel) !== h) pend.push(["write", rel, est.force ? null : est.remoto.get(rel)]);
    }
    const soNoEditor = [...est.remoto.keys()].filter((rel) => !agoraMapa.has(rel) && !ignorado(rel, pats, est.exclude) && (!est.include.length || est.include.some((g) => casa(rel, g))));
    if (est.delete) for (const rel of soNoEditor) pend.push(["delete", rel, est.force ? null : est.remoto.get(rel)]);
    else if (soNoEditor.length) aviso(est, soNoEditor.length + " arquivo(s) existem so no editor e foram mantidos (use --delete para remove-los): " + soNoEditor.slice(0, 5).join(", ") + (soNoEditor.length > 5 ? " ..." : ""));
    est.local = new Map(agoraMapa);
    if (est.noInitial) {
      if (pend.length) aviso(est, pend.length + " diferenca(s) iniciais ignoradas por --no-initial; so alteracoes a partir de agora serao espelhadas");
      for (const [tipo, rel] of pend) if (tipo === "write") est.remoto.set(rel, est.hashes.get(rel));
    } else if (pend.length) { console.log(agora() + "  sincronizacao inicial: " + pend.length + " alteracao(oes)"); await enviar(est, pend); }
    else console.log(agora() + "  pasta e editor ja estao iguais (" + agoraMapa.size + " arquivo(s))");
    if (est.once || est.dry) return 0;
    console.log(agora() + "  observando a pasta (intervalo " + est.interval + "s)...");
    let ultimoSinal = Date.now();
    while (!parar) {
      await sleep(Math.max(200, est.interval * 1000));
      if (parar) break;
      agoraMapa = varrer(raiz, pats, est.exclude, est.include);
      let [pend2, novos] = diferencas(est, est.local, agoraMapa);
      if (pend2.length) { await sleep(400); agoraMapa = varrer(raiz, pats, est.exclude, est.include); [pend2, novos] = diferencas(est, est.local, agoraMapa); }
      if (pend2.length) { aplicarEstado(est, pend2, novos, agoraMapa); await enviar(est, pend2); ultimoSinal = Date.now(); }
      else if (novos.size) aplicarEstado(est, [], novos, agoraMapa);
      else if (Date.now() - ultimoSinal > 600000) { try { await chamarPush(est, { action: "status", session: est.sessao }, "30"); } catch {} ultimoSinal = Date.now(); }
    }
  } catch (e) {
    if (e instanceof ErroPush) { aviso(est, "erro: " + e.message); codigo = 1; } else throw e;
  } finally {
    if (est.sessao && !est.dry) { try { await chamarPush(est, { action: "end", session: est.sessao, reason: "CLI encerrado" }, "30"); } catch {} console.log(agora() + "  espelho encerrado."); }
  }
  return codigo;
}
`;

export function cliNode(base) {
	return `#!/usr/bin/env node
// syn — CLI node do Synapse Live Preview MCP (gerado pelo servidor; ja vem com a URL). Uso: ./syn help
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, appendFileSync, mkdtempSync, unlinkSync } from "node:fs";
import { homedir, hostname, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomBytes, createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const BASE = (process.env.SYN_MCP_URL || ${JSON.stringify(base)}).replace(/\\/+$/, "");
const AGENT_FILE = join(process.env.HOME || process.env.USERPROFILE || homedir() || ".", ".synapse-mcp-agent");
const HELP = ${JSON.stringify(AJUDA_CLI)};
const KV = /^([A-Za-z_][\\w.-]*)(:=|=)([\\s\\S]*)$/;

function agente() {
  if (process.env.SYN_AGENT || process.env.MCP_AGENT) return process.env.SYN_AGENT || process.env.MCP_AGENT;
  try { if (existsSync(AGENT_FILE)) { const a = readFileSync(AGENT_FILE, "utf8").trim(); if (a) return a; } } catch {}
  const a = "cli_" + randomBytes(5).toString("hex");
  try { writeFileSync(AGENT_FILE, a); } catch {}
  return a;
}
async function http(method, path, body, ctype = "text/plain; charset=utf-8", query) {
  let url = BASE + path;
  if (query) { const q = new URLSearchParams(query).toString(); if (q) url += (url.includes("?") ? "&" : "?") + q; }
  try {
    const r = await fetch(url, { method, body, headers: { "Content-Type": ctype, "X-Mcp-Agent": agente(), Accept: "text/plain, application/json", "User-Agent": "syn-cli/${VERSAO_TERMINAL}" }, signal: AbortSignal.timeout(Number(process.env.SYN_TIMEOUT || 180) * 1000) });
    return [r.status, await r.text()];
  } catch (e) { return [0, "ERRO REDE: " + ((e && e.message) || e)]; }
}
function saida([status, texto]) { process.stdout.write(texto.endsWith("\\n") ? texto : texto + "\\n"); return status >= 200 && status < 300 ? 0 : 1; }
function lerFonte(src) { return src === "-" ? readFileSync(0, "utf8") : src.startsWith("@") ? readFileSync(src.slice(1), "utf8") : src; }
function coagir(v) {
  if (v === "true" || v === "false") return v === "true";
  if (v === "null" || v === "none") return null;
  if (/^-?\\d+$/.test(v)) return Number(v);
  if (/^-?\\d*\\.\\d+$/.test(v)) return Number(v);
  if ("[{".includes(v[0] || "")) { try { return JSON.parse(v); } catch {} }
  return v;
}
function corpoArgs(args) {
  if (args.length === 1 && (args[0] === "-" || args[0].startsWith("@"))) return [lerFonte(args[0]), "application/json"];
  if (args.length === 1 && args[0].trimStart().startsWith("{")) return [args[0], "application/json"];
  const obj = {};
  for (const a of args) {
    const m = a.match(KV);
    if (!m) { console.error("argumento invalido: " + a + " (use chave=valor ou chave:=json)"); process.exit(2); }
    obj[m[1]] = m[2] === ":=" ? JSON.parse(m[3]) : coagir(m[3]);
  }
  return [JSON.stringify(obj), "application/json"];
}
function chamar(tool, args, fmt, projeto) {
  const [body, ctype] = corpoArgs(args);
  const q = {}; if (fmt) q.format = fmt; if (projeto) q.project = projeto;
  return http("POST", "/call/" + tool, body, ctype, q);
}
const kv = (arr) => { const o = {}; for (const a of arr) { const i = a.indexOf("="); if (i > 0) o[a.slice(0, i)] = coagir(a.slice(i + 1)); } return o; };
${JS_SANDBOX}
(async () => {
  let argv = process.argv.slice(2);
  const fmt = argv.includes("--json") ? "json" : null;
  let projeto = null;
  const pi = argv.indexOf("--project"); if (pi !== -1) { projeto = argv[pi + 1]; argv.splice(pi, 2); }
  argv = argv.filter((a) => a !== "--json");
  const [cmd, ...rest] = argv;
  const qp = projeto ? { project: projeto } : undefined;
  const fim = (c) => process.exit(c);
  if (!cmd || cmd === "help" || cmd === "-h" || cmd === "--help") { console.log(HELP); return fim(0); }
  const uso = (m) => { console.log("uso: " + m); return fim(2); };
  switch (cmd) {
    case "agent": console.log(agente()); return fim(0);
    case "tools": return fim(saida(await http("GET", "/tools")));
    case "schema": if (!rest[0]) return uso("syn schema <tool>"); return fim(saida(await http("GET", "/tools/" + rest[0])));
    case "status": return fim(saida(await chamar("project", ["action=status", ...rest], fmt, projeto)));
    case "ls": return fim(saida(await chamar("list_files", rest, fmt, projeto)));
    case "read": if (!rest[0]) return uso("syn read <path> [start_line= end_line=]"); return fim(saida(await chamar("read_file", ["path=" + rest[0], ...rest.slice(1)], fmt, projeto)));
    case "cat": if (!rest[0]) return uso("syn cat <path>"); return fim(saida(await http("GET", "/file/" + encodeURI(rest[0]), undefined, "text/plain", qp)));
    case "write": if (rest.length < 2) return uso("syn write <path> <@arquivo | - | texto>"); return fim(saida(await http("PUT", "/file/" + encodeURI(rest[0]), lerFonte(rest[1]), "text/plain; charset=utf-8", qp)));
    case "edit": if (rest.length < 3) return uso("syn edit <path> <antigo> <novo> [replace_all=true]"); return fim(saida(await chamar("edit_file", [JSON.stringify({ path: rest[0], old_str: rest[1], new_str: rest[2], ...kv(rest.slice(3)) })], fmt, projeto)));
    case "search": if (!rest[0]) return uso("syn search <texto> [regex=true context_lines=N]"); return fim(saida(await chamar("search", ["query=" + rest[0], ...rest.slice(1)], fmt, projeto)));
    case "check": return fim(saida(await chamar("check_syntax", rest[0] ? ["path=" + rest[0]] : [], fmt, projeto)));
    case "errors": return fim(saida(await chamar("wait_for_errors", [...(rest[0] ? ["seconds=" + rest[0]] : []), ...rest.slice(1)], fmt, projeto)));
    case "console": return fim(saida(await chamar("preview", ["action=console", ...rest], fmt, projeto)));
    case "shot": {
      let dest = rest[0] && !rest[0].includes("=") ? rest[0] : "synapse-shot.png";
      const [status, texto] = await chamar("capture", ["action=shot", ...rest.filter((a) => a.includes("="))], "json", projeto);
      let obj = null; try { obj = JSON.parse(texto); } catch {}
      const img = obj && obj.result && Array.isArray(obj.result.content) ? obj.result.content.find((i) => i && i.type === "image" && i.data) : null;
      if (!img) return fim(saida([status, texto]));
      if ((img.mimeType || "").endsWith("jpeg") && dest.endsWith(".png")) dest = dest.slice(0, -4) + ".jpg";
      writeFileSync(dest, Buffer.from(img.data, "base64"));
      console.log("screenshot salvo em " + dest + " (" + (img.mimeType || "") + ")");
      return fim(0);
    }
    case "call": if (!rest[0]) return uso("syn call <tool> [args]"); return fim(saida(await chamar(rest[0], rest.slice(1), fmt, projeto)));
    case "pull": case "download": return fim(await cmdPull(rest, projeto));
    case "push": case "mirror": case "watch": return fim(await cmdPush(rest, projeto));
    default: console.log("comando desconhecido: " + cmd + "\\n" + HELP); return fim(2);
  }
})();
`;
}

export function cliBash(base) {
	return `#!/usr/bin/env bash
# syn — CLI bash+curl do Synapse Live Preview MCP (gerado pelo servidor). Uso: ./syn help
# Valores com espaco: coloque aspas DENTRO do valor (chave='"texto com espaco"') ou use chave:='"json"'.
BASE="\${SYN_MCP_URL:-${base}}"
AGENT_FILE="\${HOME:-.}/.synapse-mcp-agent"
agente() {
  if [ -n "$SYN_AGENT" ]; then echo "$SYN_AGENT"; return; fi
  if [ -s "$AGENT_FILE" ]; then cat "$AGENT_FILE"; return; fi
  a="cli_$(head -c 16 /dev/urandom 2>/dev/null | od -An -tx1 | tr -d ' \\n' | cut -c1-10)"
  [ -z "$a" ] && a="cli_$$$(date +%s)"
  echo "$a" > "$AGENT_FILE" 2>/dev/null; echo "$a"
}
FMT=""; PROJ=""; ARGS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --json) FMT="json"; shift ;;
    --project) PROJ="$2"; shift 2 ;;
    *) ARGS+=("$1"); shift ;;
  esac
done
set -- "\${ARGS[@]}"
query() { local q=""; [ -n "$FMT" ] && q="format=$FMT"; [ -n "$PROJ" ] && q="\${q:+$q&}project=$PROJ"; [ -n "$q" ] && printf '?%s' "$q"; }
pede() { # metodo caminho [corpo] [content-type]
  local m="$1" p="$2" b="$3" ct="\${4:-text/plain; charset=utf-8}" code out
  out=$(curl -sS -X "$m" -H "X-Mcp-Agent: $(agente)" -H "Content-Type: $ct" --data-binary "$b" -w '\\n%{http_code}' "$BASE$p$(query)")
  code="\${out##*$'\\n'}"; printf '%s\\n' "\${out%$'\\n'*}"
  [ "\${code:0:1}" = "2" ]
}
pede_arquivo() { # metodo caminho arquivo-local
  local m="$1" p="$2" f="$3" code out
  out=$(curl -sS -X "$m" -H "X-Mcp-Agent: $(agente)" -H "Content-Type: text/plain; charset=utf-8" --data-binary "@$f" -w '\\n%{http_code}' "$BASE$p$(query)")
  code="\${out##*$'\\n'}"; printf '%s\\n' "\${out%$'\\n'*}"
  [ "\${code:0:1}" = "2" ]
}
jstr() { # string -> JSON (python3 se houver; senao escape basico)
  if command -v python3 >/dev/null 2>&1; then printf '%s' "$1" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))'
  else printf '"%s"' "$(printf '%s' "$1" | sed 's/\\\\/\\\\\\\\/g; s/"/\\\\"/g')"; fi
}
call() { # tool args...
  local tool="$1"; shift
  if [ $# -eq 1 ] && [ "$1" = "-" ]; then pede POST "/call/$tool" "$(cat)" application/json
  elif [ $# -eq 1 ] && [ "\${1:0:1}" = "@" ]; then pede POST "/call/$tool" "$(cat "\${1:1}")" application/json
  elif [ $# -eq 1 ] && [ "\${1:0:1}" = "{" ]; then pede POST "/call/$tool" "$1" application/json
  else pede POST "/call/$tool" "$*"; fi
}
case "\${1:-help}" in
  help|-h|--help) cat <<'EOF'
${AJUDA_CLI}
EOF
;;
  agent) agente ;;
  tools) pede GET /tools ;;
  schema) pede GET "/tools/$2" ;;
  status) shift; call project action=status "$@" ;;
  ls) shift; call list_files "$@" ;;
  read) shift; p="$1"; shift; call read_file "path=$p" "$@" ;;
  cat) pede GET "/file/$2" ;;
  write) src="$3"
    if [ "$src" = "-" ]; then pede PUT "/file/$2" "$(cat)"
    elif [ "\${src:0:1}" = "@" ]; then pede_arquivo PUT "/file/$2" "\${src:1}"
    else pede PUT "/file/$2" "$src"; fi ;;
  edit) p="$2"; a="$3"; b="$4"; ra=""; [ "$5" = "replace_all=true" ] && ra=',"replace_all":true'
    pede POST /call/edit_file "{\\"path\\":$(jstr "$p"),\\"old_str\\":$(jstr "$a"),\\"new_str\\":$(jstr "$b")$ra}" application/json ;;
  search) shift; q="$1"; shift; call search "query=$(jstr "$q")" "$@" ;;
  check) shift; if [ -n "$1" ]; then call check_syntax "path=$1"; else call check_syntax; fi ;;
  errors) shift; if [ -n "$1" ]; then call wait_for_errors "seconds=$1"; else call wait_for_errors; fi ;;
  console) shift; call preview action=console "$@" ;;
  shot) dest="\${2:-synapse-shot.png}"; FMT=json
    out=$(curl -sS -X POST -H "X-Mcp-Agent: $(agente)" -H "Content-Type: text/plain" --data-binary "action=shot" "$BASE/call/capture$(query)")
    if command -v python3 >/dev/null 2>&1; then
      printf '%s' "$out" | python3 -c 'import base64,json,sys; o=json.load(sys.stdin); r=o.get("result") or {}; imgs=[i for i in r.get("content") or [] if i.get("type")=="image"]; d=sys.argv[1]; (open(d,"wb").write(base64.b64decode(imgs[0]["data"])) or print("screenshot salvo em "+d)) if imgs else print(json.dumps(o)[:800])' "$dest"
    else echo "$out" | head -c 800; echo; echo "(instale python3 ou use o CLI node para salvar a imagem)"; fi ;;
  call) shift; call "$@" ;;
  pull|download) shift; dest=""; kv=(); flags=()
    for a in "$@"; do case "$a" in --*) flags+=("$a") ;; *=*) kv+=("$a") ;; *) [ -z "$dest" ] && dest="$a" || flags+=("$a") ;; esac; done
    if ! command -v python3 >/dev/null 2>&1; then echo "pull precisa de python3 (o downloader e um script Python da biblioteca padrao)."; exit 1; fi
    args=("action=script"); [ -n "$dest" ] && args+=("out=$dest"); args+=("\${kv[@]}")
    out=$(curl -sS -X POST -H "X-Mcp-Agent: $(agente)" -H "Content-Type: text/plain" --data-binary "\${args[*]}" "$BASE/call/download_project?format=json\${PROJ:+&project=$PROJ}")
    tmp=$(mktemp /tmp/synapse_download.XXXXXX.py) || exit 1
    printf '%s' "$out" | python3 -c 'import json,sys; o=json.load(sys.stdin); r=o.get("result") or {}; ts=[i.get("text","") for i in r.get("content") or [] if i.get("type")=="text"]; sys.exit(print(ts[0] if ts else json.dumps(o)[:800]) or 1) if len(ts)<2 or not o.get("ok",True) else open(sys.argv[1],"w").write(ts[-1])' "$tmp" || { rm -f "$tmp"; exit 1; }
    echo "Synapse: baixando o projeto inteiro para \${dest:-./<nome-do-projeto>} ..."
    if [ -n "$dest" ]; then python3 "$tmp" --url "$BASE" --agent "$(agente)" --out "$dest" "\${flags[@]}"; else python3 "$tmp" --url "$BASE" --agent "$(agente)" "\${flags[@]}"; fi
    code=$?; rm -f "$tmp"
    [ "$code" = "0" ] && echo "Pronto. Para espelhar suas edicoes de volta no editor use o CLI python ou node: curl -fsSL $BASE/cli -o syn.py && python3 syn.py push \${dest:-./<pasta>}"
    exit $code ;;
  push|mirror|watch) echo "O espelho continuo (push) precisa do CLI python ou node:"
    echo "  curl -fsSL $BASE/cli -o syn.py && python3 syn.py push \${2:-./pasta}"
    echo "  curl -fsSL $BASE/cli.mjs -o syn.mjs && node syn.mjs push \${2:-./pasta}"
    exit 2 ;;
  *) echo "comando desconhecido: $1 (syn help)"; exit 2 ;;
esac
`;
}
