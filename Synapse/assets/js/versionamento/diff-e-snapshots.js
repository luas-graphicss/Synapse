'use strict';
function lpDiffOps(A, B) {
	let pre = 0;
	while (pre < A.length && pre < B.length && A[pre] === B[pre]) pre++;
	let suf = 0;
	while (
		suf < A.length - pre &&
		suf < B.length - pre &&
		A[A.length - 1 - suf] === B[B.length - 1 - suf]
	)
		suf++;
	const a = A.slice(pre, A.length - suf),
		b = B.slice(pre, B.length - suf);
	const ops = [];
	const n = a.length,
		m = b.length;
	if (n && m && n * m <= 2250000) {
		const w = m + 1;
		const dp = new Uint16Array((n + 1) * w);
		for (let i = n - 1; i >= 0; i--)
			for (let j = m - 1; j >= 0; j--) {
				dp[i * w + j] =
					a[i] === b[j]
						? dp[(i + 1) * w + j + 1] + 1
						: Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
			}
		let i = 0,
			j = 0;
		while (i < n && j < m) {
			if (a[i] === b[j]) {
				ops.push([0, a[i]]);
				i++;
				j++;
			} else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) {
				ops.push([-1, a[i]]);
				i++;
			} else {
				ops.push([1, b[j]]);
				j++;
			}
		}
		while (i < n) {
			ops.push([-1, a[i]]);
			i++;
		}
		while (j < m) {
			ops.push([1, b[j]]);
			j++;
		}
	} else {
		for (let i = 0; i < n; i++) ops.push([-1, a[i]]);
		for (let j = 0; j < m; j++) ops.push([1, b[j]]);
	}
	return { pre: pre, suf: suf, ops: ops };
}
function lpDiffText(aText, bText, ctx) {
	ctx = ctx == null ? 3 : Math.max(0, Math.min(10, ctx));
	const A = String(aText == null ? '' : aText).split('\n'),
		B = String(bText == null ? '' : bText).split('\n');
	const r = lpDiffOps(A, B);
	const all = [];
	for (let k = 0; k < r.pre; k++) all.push([0, A[k]]);
	for (const o of r.ops) all.push(o);
	for (let k = A.length - r.suf; k < A.length; k++) all.push([0, A[k]]);
	let add = 0,
		del = 0;
	for (const o of all) {
		if (o[0] === 1) add++;
		else if (o[0] === -1) del++;
	}
	if (!add && !del) return { stats: { add: 0, del: 0 }, text: '(sem diferenças)' };
	const ranges = [];
	for (let k = 0; k < all.length; k++) {
		if (all[k][0] === 0) continue;
		const s = Math.max(0, k - ctx),
			e = Math.min(all.length - 1, k + ctx);
		if (ranges.length && s <= ranges[ranges.length - 1][1] + 1)
			ranges[ranges.length - 1][1] = Math.max(ranges[ranges.length - 1][1], e);
		else ranges.push([s, e]);
	}
	const aPos = new Array(all.length),
		bPos = new Array(all.length);
	let ai = 1,
		bi = 1;
	for (let k = 0; k < all.length; k++) {
		aPos[k] = ai;
		bPos[k] = bi;
		if (all[k][0] === 0) {
			ai++;
			bi++;
		} else if (all[k][0] === -1) ai++;
		else bi++;
	}
	const out = [];
	for (const rg of ranges) {
		let aC = 0,
			bC = 0;
		for (let k = rg[0]; k <= rg[1]; k++) {
			if (all[k][0] !== 1) aC++;
			if (all[k][0] !== -1) bC++;
		}
		out.push(`@@ -${aPos[rg[0]]},${aC} +${bPos[rg[0]]},${bC} @@`);
		for (let k = rg[0]; k <= rg[1]; k++) {
			const o = all[k];
			out.push((o[0] === 0 ? ' ' : o[0] === 1 ? '+' : '-') + o[1]);
		}
	}
	let text = out.join('\n');
	if (text.length > 60000) text = text.slice(0, 60000) + '\n... (diff truncado — muito grande)';
	return { stats: { add: add, del: del }, text: text };
}
function lpDelta(before, after) {
	try {
		if (before === after) return '';
		const A = String(before == null ? '' : before).split('\n'),
			B = String(after == null ? '' : after).split('\n');
		if (A.length > 6000 || B.length > 6000) return ` Δ ${A.length} -> ${B.length} linha(s).`;
		const d = lpDiffText(before, after, 0);
		return d.stats.add || d.stats.del ? ` Δ +${d.stats.add}/-${d.stats.del} linha(s).` : '';
	} catch (_e) {
		return '';
	}
}
const SNAP_MAX = 3;
function projSnapshots(proj) {
	if (!proj.snapshots) proj.snapshots = [];
	return proj.snapshots;
}
function makeSnapshot(proj, label) {
	const snaps = projSnapshots(proj);
	proj.snapSeq = (proj.snapSeq || 0) + 1;
	const files = [];
	for (const [path, f] of proj.files) {
		if (f.isText && f.text != null) files.push([path, { text: f.text }]);
		else files.push([path, { bin: 1, size: f.data ? f.data.length : 0 }]);
	}
	const s = { id: 's' + proj.snapSeq, t: Date.now(), label: label || '', files: files };
	snaps.push(s);
	if (snaps.length > SNAP_MAX) snaps.splice(0, snaps.length - SNAP_MAX);
	saveSession();
	return s;
}
function findSnap(proj, spec) {
	const snaps = projSnapshots(proj);
	if (!snaps.length)
		throw new Error('Nenhum snapshot neste projeto ainda — crie um com snapshot_project.');
	if (spec == null || spec === '' || spec === 'latest') return snaps[snaps.length - 1];
	const s = String(spec);
	const hit =
		snaps.find((x) => x.id === s) ||
		snaps.find((x) => x.id === 's' + s) ||
		snaps.find((x) => x.label && x.label === s);
	if (!hit)
		throw new Error(
			'Snapshot não encontrado: ' +
				s +
				'. Disponíveis: ' +
				snaps.map((x) => x.id + (x.label ? ` ("${x.label}")` : '')).join(', ') +
				'.',
		);
	return hit;
}
function mcpVersion(f, spec, path) {
	const h = f.history || [];
	if (spec == null || spec === 'current' || spec === 0 || spec === '0' || spec === 'atual')
		return { text: f.text, label: 'atual', t: null };
	const n = typeof spec === 'number' ? spec : parseInt(String(spec).replace(/^v/i, ''), 10);
	if (!isFinite(n) || n < 1 || n > h.length)
		throw new Error(
			`Versão inválida: ${spec} — ${path} tem ${h.length} versão(ões) no histórico (v1 a v${h.length}). Use list_versions.`,
		);
	return { text: h[n - 1].text, label: 'v' + n, t: h[n - 1].t };
}
let uiEscritaT = null;
function uiEscritaAgendar() {
	if (uiEscritaT) return;
	uiEscritaT = setTimeout(() => {
		uiEscritaT = null;
		try {
			renderTree();
			renderEditorTabs();
		} catch (e) {
			ignorarErro(e, 'uiEscritaAgendar');
		}
	}, 400);
}
function mcpAfterWrite(proj, path) {
	try {
		if (typeof tmDepInvalida === 'function') tmDepInvalida(proj && proj.id);
	} catch (e) {
		ignorarErro(e, 'mcpAfterWrite');
	}
	proj.dirty.add(path);
	devAutoSync(proj);
	if (proj.id === State.active) {
		if (proj.openFile === path) {
			const f = proj.files.get(path);
			if (f && f.text != null) {
				clearFolds();
				el.codeTa.value = f.text;
				paintEditor(path, f.text);
				el.editorDirty.classList.add('on');
			}
		}
		uiEscritaAgendar();
		scheduleBuild(proj);
	}
	saveSession();
}
function mcpBulkChanged(proj) {
	try {
		if (typeof tmDepInvalida === 'function') tmDepInvalida(proj && proj.id);
	} catch (e) {
		ignorarErro(e, 'mcpBulkChanged');
	}
	devAutoSync(proj);
	if (proj.id === State.active) {
		renderTree();
		renderEditorTabs();
		if (proj.openFile && proj.files.has(proj.openFile)) openFileInEditor(proj.openFile);
		else {
			proj.openFile = null;
			editorToEmpty();
		}
		scheduleBuild(proj);
	}
	saveSession();
}
function mcpDeleteOne(proj, p) {
	proj.files.delete(p);
	proj.dirty.delete(p);
	try {
		if (typeof tmDepInvalida === 'function') tmDepInvalida(proj && proj.id);
	} catch (e) {
		ignorarErro(e, 'mcpDeleteOne');
	}
	if (proj.openTabs) {
		const i = proj.openTabs.indexOf(p);
		if (i >= 0) proj.openTabs.splice(i, 1);
	}
	if (proj.openFile === p)
		proj.openFile =
			(proj.openTabs && proj.openTabs[proj.openTabs.length - 1]) ||
			pickDefaultFile(proj.files) ||
			null;
}
function mcpSize(f) {
	if (f.data) return f.data.byteLength || f.data.length || 0;
	if (f.text != null) return f.text.length;
	return 0;
}
function mcpBytesB64(bytes) {
	let s = '';
	for (let i = 0; i < bytes.length; i += 0x8000) {
		s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
	}
	return btoa(s);
}

const MCP_PROJECT_PROP = {
	type: 'string',
	description:
		'Nome ou id do projeto alvo (veja list_projects). A ação é aplicada nesse projeto mesmo ' +
		'que ele NÃO esteja ativo na tela. SEMPRE informe quando houver vários projetos ou ' +
		'agentes em paralelo. Se omitido, usa o projeto ativo (que pode mudar a qualquer momento)' +
		'.',
};
const MCP_TOOLS = [
	{
		name: 'project_status',
		title: 'Status do projeto',
		desc: 'Mostra os projetos abertos, o projeto ativo, tipo detectado e estado do preview/console. Comece por aqui. Informe project para detalhar um projeto específico (não precisa estar ativo).',
		schema: { type: 'object', properties: { project: MCP_PROJECT_PROP } },
		run: async (a) => {
			const lines = ['Projetos abertos: ' + State.projects.length];
			State.projects.forEach((p) =>
				lines.push(
					(p.id === State.active ? '* ' : '- ') +
						p.name +
						' (id: ' +
						p.id +
						', ' +
						p.files.size +
						' arquivo(s), ' +
						((p.detect && p.detect.type) || '?') +
						', ' +
						p.logs.filter((l) => l.level === 'error').length +
						' erro(s) no console)',
				),
			);
			const p = a && a.project ? mcpProj(a) : activeProject();
			if (p) {
				lines.push('');
				lines.push(
					(p.id === State.active ? 'Projeto ativo: ' : 'Projeto alvo (não ativo): ') +
						p.name +
						' (id: ' +
						p.id +
						')',
				);
				lines.push(
					'Tipo detectado: ' +
						((p.detect && p.detect.type) || '?') +
						(p.detect && p.detect.framework ? ` (${p.detect.framework})` : ''),
				);
				lines.push('Entrada do preview: ' + (p.entry || (p.detect && p.detect.entry) || '(auto)'));
				lines.push('Arquivo aberto no editor: ' + (p.openFile || '(nenhum)'));
				const errs = p.logs.filter((l) => l.level === 'error').length;
				lines.push(
					`Console do preview: ${p.logs.length} registro(s), ${errs} erro(s). Use console_logs para inspecionar.`,
				);
			} else
				lines.push(
					'Nenhum projeto aberto. Use create_project, open_project_from_disk (projetos na pasta do relay) ou peça ao usuário para importar um .zip.',
				);
			return lines.join('\n');
		},
	},
	{
		name: 'list_projects',
		title: 'Listar projetos',
		desc: 'Lista todos os projetos abertos no site (o ativo é marcado com *).',
		schema: { type: 'object', properties: {} },
		run: async () =>
			State.projects.length
				? State.projects
						.map(
							(p) =>
								(p.id === State.active ? '* ' : '- ') +
								p.name +
								' (id: ' +
								p.id +
								', ' +
								p.files.size +
								' arquivo(s))',
						)
						.join('\n')
				: 'Nenhum projeto aberto.',
	},
	{
		name: 'set_active_project',
		title: 'Trocar projeto ativo',
		desc:
			'Ativa outro projeto na tela do usuário (o preview e o editor passam a mostrar esse ' +
			'projeto). NÃO é necessário para trabalhar em outro projeto — todas as ferramentas ' +
			'aceitam o parâmetro project. Em trabalho multi-agente, evite: isso troca a tela do ' +
			'usuário e afeta os outros agentes.',
		schema: {
			type: 'object',
			properties: { project: { type: 'string', description: 'Nome ou id do projeto' } },
			required: ['project'],
		},
		run: async (a) => {
			const p = mcpProj({ project: a.project });
			switchProject(p.id);
			return `Projeto ativo: ${p.name} (id: ${p.id}). Preview atualizado.`;
		},
	},
	{
		name: 'create_project',
		title: 'Criar projeto',
		desc:
			'Cria um projeto novo do zero com arquivos de texto iniciais. Se files for omitido, cria ' +
			'um index.html inicial. Por padrão NÃO troca o projeto ativo do usuário quando já existe ' +
			'um (multiprojeto: o usuário e outros agentes não são atrapalhados); passe activate=true ' +
			'para ativar na tela. Continue trabalhando nele informando project nas outras ' +
			'ferramentas.',
		schema: {
			type: 'object',
			properties: {
				name: { type: 'string', description: 'Nome do projeto' },
				files: {
					type: 'array',
					description: 'Arquivos iniciais',
					items: {
						type: 'object',
						properties: { path: { type: 'string' }, content: { type: 'string' } },
						required: ['path', 'content'],
					},
				},
				activate: {
					type: 'boolean',
					description:
						'true = ativar o projeto na tela do usuário (padrão: false quando já há um projeto ativo)',
				},
			},
			required: ['name'],
		},
		run: async (a) => {
			const name = String(a.name || '').trim() || 'projeto-mcp';
			const list = Array.isArray(a.files) ? a.files : [];
			const files = new Map();
			for (const it of list) {
				if (!it || typeof it.path !== 'string' || typeof it.content !== 'string')
					throw new Error('files deve ser uma lista de {path, content}');
				const p = mcpNorm(it.path);
				const f = newFileEntry(p);
				f.isText = true;
				f.text = it.content;
				f.data = null;
				f.history = [{ t: Date.now(), text: it.content }];
				files.set(p, f);
			}
			if (!files.size) {
				const f = newFileEntry('index.html');
				f.text = `<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" \
content="width=device-width, initial-scale=1">\n<title>${name}</title>\n</head>\n<body>\n<h1>${name}</h1>\
\n<p>Projeto criado via MCP.</p>\n</body>\n</html>\n`;
				f.history = [{ t: Date.now(), text: f.text }];
				files.set('index.html', f);
			}
			const dupe = State.projects.find((x) => (x.name || '').toLowerCase() === name.toLowerCase());
			if (dupe)
				throw new Error(
					`Já existe um projeto aberto chamado "${dupe.name}" (id: ${dupe.id}). Use outro nome ou trabalhe nele passando project.`,
				);
			const act = a.activate === true || !State.active;
			addProject(name, 'folder', files, { activate: act });
			const np = State.projects[State.projects.length - 1];
			return (
				'Projeto "' +
				name +
				'" criado com ' +
				files.size +
				' arquivo(s) (id: ' +
				(np ? np.id : '?') +
				')' +
				(act
					? ', ativado e com preview montado.'
					: `, em segundo plano — o projeto ativo do usuário foi preservado. Use project="${name}" nas próximas chamadas.`)
			);
		},
	},
	{
		name: 'list_disk_projects',
		title: 'Listar projetos no disco',
		desc:
			'Lista as pastas de projetos que existem na pasta espelhada do relay no PC do usuário ' +
			'(aurora-projects), incluindo projetos que NÃO estão abertos no editor. Use ' +
			'open_project_from_disk para abrir um deles. Requer relay v7+ e permissão de terminal.',
		schema: { type: 'object', properties: {} },
		run: async () => {
			termAssertAllowed();
			const r = await termApi('listdisk', {});
			const list = (r && r.projects) || [];
			if (!list.length)
				return `Nenhuma pasta de projeto encontrada em ${(r && r.dir) || '(pasta do relay)'}.`;
			const openKeys = State.projects.map((p) => mcpProjKey(p.name));
			return (
				'Pasta do relay: ' +
				(r.dir || '?') +
				'\n' +
				list
					.map(
						(it) =>
							`- ${it.name} (${it.files} arquivo(s))${openKeys.includes(mcpProjKey(it.name)) ? ' · já aberto no editor' : ''}`,
					)
					.join('\n')
			);
		},
	},
	{
		name: 'open_project_from_disk',
		title: 'Abrir projeto do disco',
		desc:
			'Abre no editor um projeto que existe na pasta espelhada do relay (mesmo sem estar ' +
			'aberto no site), carregando os arquivos do disco. Por padrão abre em segundo plano, sem ' +
			'trocar o projeto ativo do usuário (activate=true para ativar na tela). Depois trabalhe ' +
			'nele passando project nas outras ferramentas. Requer relay v7+ e permissão de terminal.',
		schema: {
			type: 'object',
			properties: {
				name: {
					type: 'string',
					description: 'Nome da pasta do projeto no disco (veja list_disk_projects)',
				},
				activate: {
					type: 'boolean',
					description: 'Ativar o projeto na tela do usuário (padrão: false)',
				},
			},
			required: ['name'],
		},
		run: async (a) => {
			termAssertAllowed();
			const name = String(a.name || '').trim();
			if (!name) throw new Error('Informe o nome da pasta do projeto (veja list_disk_projects).');
			const already = State.projects.find((x) => mcpProjKey(x.name) === mcpProjKey(name));
			if (already)
				return `O projeto "${already.name}" já está aberto no editor (id: ${already.id}). Use o parâmetro project para trabalhar nele.`;
			const files = new Map();
			const soDisco = [];
			let fresh = true;
			for (let round = 0; round < 10; round++) {
				const ch = await termApi('changes', { project: name, fresh: fresh });
				fresh = false;
				(ch.changed || []).forEach((it) => {
					if (!validRelPath(it.path)) return;
					const f = newFileEntry(it.path);
					f.isText = true;
					f.data = null;
					f.text = it.text;
					f.history = [{ t: Date.now(), text: it.text }];
					f.doDisco = true;
					files.set(it.path, f);
				});
				(ch.binaries || []).forEach((it) => {
					if (!validRelPath(it.path)) return;
					if (it.b64) {
						try {
							const bf = makeFileEntry(it.path, b64ToBytes(it.b64));
							bf.doDisco = true;
							files.set(it.path, bf);
						} catch (e) {
							soDisco.push(it.path);
						}
					} else soDisco.push(it.path);
				});
				if (!ch.more) break;
			}
			if (!files.size)
				throw new Error(
					`Nenhum arquivo encontrado na pasta "${name}" do relay. Use list_disk_projects para ver as pastas disponíveis (o relay precisa ser v7+).`,
				);
			const act = a.activate === true || !State.active;
			addProject(name, 'disk', files, { activate: act });
			const np = State.projects[State.projects.length - 1];
			return (
				'Projeto "' +
				name +
				'" aberto do disco com ' +
				files.size +
				' arquivo(s) (id: ' +
				(np ? np.id : '?') +
				')' +
				(soDisco.length ? ` · ${soDisco.length} arquivo(s) grande(s) ficaram só no disco` : '') +
				(act
					? '. Ativado na tela.'
					: `. Aberto em segundo plano — use project="${name}" nas próximas chamadas.`)
			);
		},
	},
	{
		name: 'list_files',
		title: 'Listar arquivos',
		desc: 'Lista todos os arquivos do projeto com tamanho (e se são binários).',
		schema: { type: 'object', properties: { project: MCP_PROJECT_PROP } },
		run: async (a) => {
			const proj = mcpProj(a);
			const keys = [...proj.files.keys()].sort();
			return keys.length
				? `Projeto "${proj.name}" — ${keys.length} arquivo(s):\n${keys
						.map((p) => {
							const f = proj.files.get(p);
							return p + ' (' + mvSize(mcpSize(f)) + (f.isText ? '' : ' · binário') + ')';
						})
						.join('\n')}`
				: '(projeto vazio)';
		},
	},
	{
		name: 'read_file',
		title: 'Ler arquivo',
		desc: 'Retorna o conteúdo de QUALQUER arquivo: texto vem direto (use start_line/end_line para trechos); binário vem em base64 (use offset/max_bytes para fatiar).',
		schema: {
			type: 'object',
			properties: {
				path: { type: 'string' },
				start_line: { type: 'integer', minimum: 1 },
				end_line: { type: 'integer', minimum: 1 },
				offset: { type: 'integer', minimum: 0, description: 'Binário: byte inicial (padrão 0)' },
				max_bytes: {
					type: 'integer',
					minimum: 1,
					description: 'Binário: máximo de bytes por resposta (padrão 49152)',
				},
				project: MCP_PROJECT_PROP,
			},
			required: ['path'],
		},
		run: async (a) => {
			const proj = mcpProj(a);
			const path = mcpNorm(a.path);
			tmGateRead(path, agName(a), proj && proj.id);
			tmLockReadTouch(path, agName(a), proj && proj.id, proj && proj.name, 'read_file');
			const f = mcpFile(proj, path);
			if (!f.isText || f.text == null) {
				const bytes = fileBytes(f);
				const total = bytes.length;
				const mime = Core.getMime(path);
				const off = Math.max(0, parseInt(a.offset, 10) || 0);
				if (total && off >= total)
					return `Arquivo binário: ${path} (${mvSize(total)} · ${mime}). offset ${off} está além do fim (${total} bytes).`;
				const want = Math.min(Math.max(1, parseInt(a.max_bytes, 10) || 49152), 98304);
				const chunk = bytes.subarray(off, Math.min(total, off + want));
				const fim = off + chunk.length;
				return (
					'Arquivo binário: ' +
					path +
					' (' +
					mvSize(total) +
					' · ' +
					mime +
					').\n' +
					(total
						? 'Bytes ' +
							off +
							'-' +
							(fim - 1) +
							' de ' +
							total +
							' em base64' +
							(fim < total ? ` (parcial — continue com offset=${fim})` : ' (arquivo completo)') +
							':\n' +
							mcpBytesB64(chunk)
						: '(arquivo vazio)')
				);
			}
			if (a.start_line || a.end_line) {
				const lines = f.text.split('\n');
				const s = Math.max(1, a.start_line || 1);
				const e2 = Math.min(lines.length, a.end_line || lines.length);
				return (
					path +
					' (linhas ' +
					s +
					'-' +
					e2 +
					' de ' +
					lines.length +
					'):\n' +
					lines.slice(s - 1, e2).join('\n')
				);
			}
			return f.text;
		},
	},
	{
		name: 'create_file',
		title: 'Criar arquivo',
		desc: 'Cria um novo arquivo de texto (pastas são criadas automaticamente pelo caminho). Falha se o arquivo já existir.',
		schema: {
			type: 'object',
			properties: {
				path: { type: 'string' },
				content: { type: 'string' },
				project: MCP_PROJECT_PROP,
			},
			required: ['path', 'content'],
		},
		run: async (a) => {
			const proj = mcpProj(a);
			const path = mcpNorm(a.path);
			if (typeof a.content !== 'string') throw new Error('content deve ser uma string');
			if (proj.files.has(path))
				throw new Error(`Já existe um arquivo em ${path}. Use write_file para sobrescrever.`);
			const f = newFileEntry(path);
			f.isText = true;
			f.text = a.content;
			f.data = null;
			f.history = [{ t: Date.now(), text: a.content }];
			proj.files.set(path, f);
			mcpAfterWrite(proj, path);
			return `Arquivo criado: ${path} (${a.content.length} caractere(s)). Preview atualizado.${lintSuffix(path, f.text)}`;
		},
	},
	{
		name: 'write_file',
		title: 'Gravar arquivo',
		desc: 'Cria ou sobrescreve completamente um arquivo de texto. Para mudanças pequenas prefira edit_file; para vários arquivos de uma vez, write_files.',
		schema: {
			type: 'object',
			properties: {
				path: { type: 'string' },
				content: { type: 'string' },
				project: MCP_PROJECT_PROP,
			},
			required: ['path', 'content'],
		},
		run: async (a) => {
			const proj = mcpProj(a);
			const path = mcpNorm(a.path);
			if (typeof a.content !== 'string') throw new Error('content deve ser uma string');
			let f = proj.files.get(path);
			const existed = !!f;
			let delta = '';
			if (f) {
				if (!f.isText || f.text == null)
					throw new Error('Não dá para sobrescrever arquivo binário: ' + path);
				mcpHist(f);
				const before = f.text;
				f.text = a.content;
				f.data = null;
				delta = lpDelta(before, a.content);
			} else {
				f = newFileEntry(path);
				f.isText = true;
				f.text = a.content;
				f.data = null;
				f.history = [{ t: Date.now(), text: a.content }];
				proj.files.set(path, f);
			}
			mcpAfterWrite(proj, path);
			return (
				(existed ? 'Arquivo sobrescrito: ' : 'Arquivo criado: ') +
				path +
				' (' +
				a.content.length +
				' caractere(s)).' +
				delta +
				' Preview atualizado.' +
				lintSuffix(path, f.text)
			);
		},
	},
	{
		name: 'edit_file',
		title: 'Editar trechos',
		desc:
			'Edita um arquivo por substituição exata. Modo simples: old_str/new_str (old_str deve ' +
			'aparecer exatamente 1 vez, a menos que replace_all=true). Modo LOTE (preferido para ' +
			'várias mudanças no mesmo arquivo): edits=[{old_str,new_str,replace_all?},...] aplicadas ' +
			'em sequência e de forma ATÔMICA — se uma falhar, nada é salvo. Copie trechos exatos via ' +
			'read_file/search antes.',
		schema: {
			type: 'object',
			properties: {
				path: { type: 'string' },
				old_str: { type: 'string', description: 'Trecho exato a localizar (modo simples)' },
				new_str: { type: 'string', description: 'Novo texto (vazio para remover; modo simples)' },
				replace_all: {
					type: 'boolean',
					description: 'Substituir todas as ocorrências (modo simples)',
				},
				edits: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							old_str: { type: 'string' },
							new_str: { type: 'string' },
							replace_all: { type: 'boolean' },
						},
						required: ['old_str', 'new_str'],
					},
					description:
						'Modo lote: lista de edições aplicadas em sequência (atômico: ou todas entram, ou nenhuma)',
				},
				project: MCP_PROJECT_PROP,
			},
			required: ['path'],
		},
		run: async (a) => {
			const proj = mcpProj(a);
			const path = mcpNorm(a.path);
			const f = mcpFile(proj, path);
			if (!f.isText || f.text == null)
				throw new Error('Arquivo binário não pode ser editado como texto: ' + path);
			const list =
				Array.isArray(a.edits) && a.edits.length
					? a.edits
					: a.old_str != null || a.new_str != null
						? [{ old_str: a.old_str, new_str: a.new_str, replace_all: a.replace_all }]
						: null;
			if (!list) throw new Error('Informe old_str/new_str ou edits=[{old_str,new_str},...].');
			if (list.length > 50) throw new Error('Máximo de 50 edições por chamada.');
			let txt = f.text;
			let subs = 0;
			for (let i = 0; i < list.length; i++) {
				const ed = list[i] || {};
				const old = String(ed.old_str == null ? '' : ed.old_str);
				const nw = String(ed.new_str == null ? '' : ed.new_str);
				const tag = list.length > 1 ? `Edição #${i}${1} de ${list.length}: ` : '';
				if (!old)
					throw new Error(
						tag +
							'old_str não pode ser vazio.' +
							(list.length > 1 ? ' NENHUMA edição do lote foi salva (atômico).' : ''),
					);
				const parts = txt.split(old);
				const count = parts.length - 1;
				if (count === 0)
					throw new Error(
						tag +
							'trecho não encontrado em ' +
							path +
							'.' +
							(list.length > 1
								? ' NENHUMA edição do lote foi salva (atômico). Lembre que as edições anteriores do lote já alteram o texto.'
								: '') +
							' Use read_file ou search para copiar o trecho exato (espaços e quebras de linha contam).',
					);
				if (count > 1 && !ed.replace_all)
					throw new Error(
						tag +
							'o trecho aparece ' +
							count +
							' vezes em ' +
							path +
							'. Torne old_str mais específico ou use replace_all=true.' +
							(list.length > 1 ? ' NENHUMA edição do lote foi salva (atômico).' : ''),
					);
				txt = ed.replace_all ? parts.join(nw) : txt.replace(old, () => nw);
				subs += ed.replace_all ? count : 1;
			}
			mcpHist(f);
			const beforeTxt = f.text;
			f.text = txt;
			f.data = null;
			mcpAfterWrite(proj, path);
			return `Editado: ${path} (${subs} substituição(ões), ${list.length} edição(ões)).${lpDelta(beforeTxt, f.text)} Preview atualizado.${lintSuffix(path, f.text)}`;
		},
	},
	{
		name: 'read_files',
		title: 'Ler vários arquivos',
		desc:
			'Retorna o conteúdo de VÁRIOS arquivos em uma única chamada (menos idas e voltas que ' +
			'read_file; binários aparecem como resumo — use read_file para o base64). Limite total ' +
			'de ~180000 caracteres — o excedente é truncado com aviso.',
		schema: {
			type: 'object',
			properties: {
				paths: {
					type: 'array',
					items: { type: 'string' },
					description: 'Caminhos dos arquivos (máx. 40)',
				},
				project: MCP_PROJECT_PROP,
			},
			required: ['paths'],
		},
		run: async (a) => {
			const proj = mcpProj(a);
			const paths = Array.isArray(a.paths) ? a.paths : [];
			if (!paths.length) throw new Error('paths vazio.');
			if (paths.length > 40) throw new Error('Máximo de 40 arquivos por chamada.');
			const MAXT = 180000;
			let used = 0;
			const out = [];
			for (let i = 0; i < paths.length; i++) {
				const path = mcpNorm(paths[i]);
				const trava = tmGateReadSoft(path, agName(a), proj && proj.id);
				if (!trava)
					tmLockReadTouch(path, agName(a), proj && proj.id, proj && proj.name, 'read_files');
				if (trava) {
					out.push(`===== ${path} =====${String.fromCharCode(10)}${trava}`);
					continue;
				}
				const f = sniffTextEntry(proj.files.get(path));
				if (!f) {
					out.push(`===== ${path} =====\n(arquivo não encontrado — use list_files)`);
					continue;
				}
				if (!f.isText || f.text == null) {
					out.push(
						`===== ${path} =====\n(binário — ${mvSize(mcpSize(f))} · ${Core.getMime(path)} — leia o conteúdo em base64 com read_file path=${path})`,
					);
					continue;
				}
				let body = f.text;
				const lc = body.split('\n').length;
				if (used + body.length > MAXT) {
					const room = Math.max(0, MAXT - used);
					body =
						body.slice(0, room) +
						'\n... (truncado — use read_file com start_line/end_line para o restante)';
				}
				used += body.length;
				out.push(`===== ${path} (${lc} linha(s)) =====\n${body}`);
				if (used >= MAXT && i < paths.length - 1) {
					out.push(
						'... (limite total atingido — arquivos restantes omitidos: peça-os em outra chamada)',
					);
					break;
				}
			}
			return out.join('\n\n');
		},
	},
	{
		name: 'write_files',
		title: 'Gravar vários arquivos',
		desc:
			'Cria ou sobrescreve VÁRIOS arquivos de texto em uma única chamada (ideal para ' +
			'scaffolding e mudanças amplas). Validação prévia atômica: se algum item for inválido, ' +
			'nada é salvo. O preview é atualizado uma única vez no final.',
		schema: {
			type: 'object',
			properties: {
				files: {
					type: 'array',
					items: {
						type: 'object',
						properties: { path: { type: 'string' }, content: { type: 'string' } },
						required: ['path', 'content'],
					},
					description: 'Lista de arquivos {path, content} (máx. 80)',
				},
				project: MCP_PROJECT_PROP,
			},
			required: ['files'],
		},
		run: async (a) => {
			const proj = mcpProj(a);
			const list = Array.isArray(a.files) ? a.files : [];
			if (!list.length) throw new Error('files vazio.');
			if (list.length > 80) throw new Error('Máximo de 80 arquivos por chamada.');
			const items = [];
			const dup = new Set();
			for (let i = 0; i < list.length; i++) {
				const it = list[i] || {};
				const path = mcpNorm(it.path);
				if (typeof it.content !== 'string')
					throw new Error(
						`Arquivo #${i}${1} (${path}): content deve ser uma string. Nada foi salvo.`,
					);
				if (dup.has(path)) throw new Error(`Caminho repetido no lote: ${path}. Nada foi salvo.`);
				dup.add(path);
				const f = proj.files.get(path);
				if (f && (!f.isText || f.text == null))
					throw new Error(`Não dá para sobrescrever arquivo binário: ${path}. Nada foi salvo.`);
				items.push({ path: path, content: it.content, f: f });
			}
			const out = [];
			const lints = [];
			for (const it of items) {
				let f = it.f;
				if (f) {
					mcpHist(f);
					const before = f.text;
					f.text = it.content;
					f.data = null;
					out.push(
						`- sobrescrito: ${it.path} (${it.content.length} caractere(s))${lpDelta(before, it.content)}`,
					);
				} else {
					f = newFileEntry(it.path);
					f.isText = true;
					f.text = it.content;
					f.data = null;
					f.history = [{ t: Date.now(), text: it.content }];
					proj.files.set(it.path, f);
					out.push(`- criado: ${it.path} (${it.content.length} caractere(s))`);
				}
				proj.dirty.add(it.path);
				const ls = lintSuffix(it.path, f.text);
				if (ls) lints.push(ls);
			}
			mcpBulkChanged(proj);
			const lintOut =
				lints.slice(0, 5).join('') +
				(lints.length > 5
					? `\n(+${lints.length - 5} outro(s) arquivo(s) com problemas de sintaxe — use check_syntax para ver tudo)`
					: '');
			return (
				items.length +
				' arquivo(s) gravado(s) em "' +
				proj.name +
				'":\n' +
				out.join('\n') +
				'\nPreview atualizado.' +
				lintOut
			);
		},
	},
	{
		name: 'outline',
		title: 'Outline (mapa do código)',
		desc:
			'Mapa de símbolos com números de linha, sem precisar ler o arquivo inteiro: ' +
			'funções/classes/métodos (JS/TS, inclusive os blocos script do HTML), headings (Markdown)' +
			', seletores (CSS), chaves (JSON), scripts/styles/ids (HTML). Informe path para 1 ' +
			'arquivo, ou omita para o resumo do projeto inteiro. Combine com read_file ' +
			'start_line/end_line para ler só o trecho relevante.',
		schema: {
			type: 'object',
			properties: {
				path: {
					type: 'string',
					description: 'Arquivo específico (opcional; padrão: projeto inteiro resumido)',
				},
				project: MCP_PROJECT_PROP,
			},
		},
		run: async (a) => {
			const proj = mcpProj(a);
			const fmt = (s) => (s.line ? `  L${s.line}  ` : '  ') + s.kind + '  ' + s.name;
			if (a.path) {
				const path = mcpNorm(a.path);
				const f = mcpFile(proj, path);
				if (!f.isText || f.text == null) return `Arquivo binário: ${path}. Sem outline.`;
				const sy = lpOutline(path, f.text);
				const lc = f.text.split('\n').length;
				if (!sy.length)
					return path + ': nenhum símbolo reconhecido (' + lc + ' linha(s)). Use read_file.';
				const shown = sy.slice(0, 300);
				return (
					path +
					' (' +
					lc +
					' linha(s), ' +
					sy.length +
					' símbolo(s)):\n' +
					shown.map(fmt).join('\n') +
					(sy.length > shown.length
						? `\n... +${sy.length - shown.length} símbolo(s) omitido(s)`
						: '')
				);
			}
			const out = [];
			for (const [p, f] of proj.files) {
				if (!f.isText || f.text == null) continue;
				const sy = lpOutline(p, f.text);
				if (!sy.length) continue;
				out.push(p + ' (' + f.text.split('\n').length + ' linha(s)):');
				const shown = sy.slice(0, 25);
				for (const s of shown) out.push(fmt(s));
				if (sy.length > shown.length)
					out.push(
						`  ... +${sy.length - shown.length} símbolo(s) — use outline com path para ver todos`,
					);
				if (out.length > 400) {
					out.push('... (projeto grande — use outline com path por arquivo)');
					break;
				}
			}
			if (!out.length) return 'Nenhum símbolo reconhecido no projeto.';
			return out.join('\n');
		},
	},
	{
		name: 'rename',
		title: 'Renomear / mover',
		desc: 'Renomeia ou move um arquivo ou uma pasta inteira (from → to). Também serve para mover entre pastas.',
		schema: {
			type: 'object',
			properties: { from: { type: 'string' }, to: { type: 'string' }, project: MCP_PROJECT_PROP },
			required: ['from', 'to'],
		},
		run: async (a) => {
			const proj = mcpProj(a);
			const from = mcpNorm(a.from);
			const to = mcpNorm(a.to);
			if (from === to) return 'Origem e destino são iguais — nada a fazer.';
			if (proj.files.has(from)) {
				if (proj.files.has(to)) throw new Error('Já existe um arquivo em ' + to);
				const f = proj.files.get(from);
				f.path = to;
				const map = new Map();
				for (const [k, v] of proj.files) map.set(k === from ? to : k, v);
				proj.files = map;
				remapPaths(proj, (p) => (p === from ? to : p));
			} else {
				const pre = from + '/';
				const victims = [...proj.files.keys()].filter((k) => k.indexOf(pre) === 0);
				if (!victims.length) throw new Error('Nada encontrado em: ' + from);
				for (const k of proj.files.keys())
					if (k === to || k.indexOf(to + '/') === 0)
						throw new Error('Conflito: já existe algo em ' + to);
				const map = new Map();
				for (const [k, v] of proj.files) {
					if (k.indexOf(pre) === 0) {
						const nk = to + '/' + k.slice(pre.length);
						v.path = nk;
						map.set(nk, v);
					} else map.set(k, v);
				}
				proj.files = map;
				remapPaths(proj, (p) => (p && p.indexOf(pre) === 0 ? to + '/' + p.slice(pre.length) : p));
				if (openDirs.has(from)) {
					openDirs.delete(from);
					openDirs.add(to);
				}
			}
			mcpBulkChanged(proj);
			return `Renomeado: ${from} → ${to}. Preview atualizado.`;
		},
	},
	{
		name: 'delete',
		title: 'Excluir',
		desc: 'Exclui arquivos e/ou pastas (lista de caminhos). Pastas são removidas com todo o conteúdo.',
		schema: {
			type: 'object',
			properties: {
				paths: {
					type: 'array',
					items: { type: 'string' },
					description: 'Caminhos de arquivos ou pastas',
				},
				project: MCP_PROJECT_PROP,
			},
			required: ['paths'],
		},
		run: async (a) => {
			const proj = mcpProj(a);
			const paths = Array.isArray(a.paths) ? a.paths : [];
			if (!paths.length) throw new Error('Informe pelo menos um caminho em paths');
			const snap = makeSnapshot(proj, 'auto: antes de excluir');
			const removed = [];
			for (const raw of paths) {
				const p = mcpNorm(raw);
				if (proj.files.has(p)) {
					mcpDeleteOne(proj, p);
					removed.push(p);
				} else {
					const pre = p + '/';
					const victims = [...proj.files.keys()].filter((k) => k.indexOf(pre) === 0);
					if (!victims.length) throw new Error('Não encontrado: ' + p);
					for (const v of victims) mcpDeleteOne(proj, v);
					openDirs.delete(p);
					removed.push(p + '/ (' + victims.length + ' arquivo(s))');
				}
			}
			mcpBulkChanged(proj);
			return `Excluído(s):\n${removed.join('\n')}\nSnapshot de segurança ${snap.id} criado antes da exclusão (use restore_snapshot para desfazer). Preview atualizado.`;
		},
	},
	{
		name: 'search',
		title: 'Busca global',
		desc: 'Busca texto (ou regex) em todos os arquivos de texto do projeto. Retorna arquivo:linha com o trecho. Use context_lines para ver linhas ao redor e path para limitar a uma pasta.',
		schema: {
			type: 'object',
			properties: {
				query: { type: 'string' },
				regex: { type: 'boolean', description: 'Tratar query como expressão regular' },
				case_sensitive: { type: 'boolean' },
				path: { type: 'string', description: 'Limitar a um arquivo ou pasta' },
				max_results: { type: 'integer', minimum: 1, maximum: 500 },
				context_lines: { type: 'integer', minimum: 0, maximum: 5 },
				project: MCP_PROJECT_PROP,
			},
			required: ['query'],
		},
		run: async (a) => {
			const proj = mcpProj(a);
			const q = String(a.query || '');
			if (!q) throw new Error('query é obrigatória');
			const flags = 'g' + (a.case_sensitive ? '' : 'i');
			let re;
			try {
				re = a.regex
					? new RegExp(q, flags)
					: new RegExp(
							q.replace(/[^A-Za-z0-9_]/g, (c) => '\\' + c),
							flags,
						);
			} catch (e) {
				throw new Error('Regex inválida: ' + ((e && e.message) || e));
			}
			const max = Math.min(500, a.max_results || 100);
			const ctx = Math.min(5, Math.max(0, a.context_lines || 0));
			const dirFilter = a.path ? mcpNorm(a.path) : '';
			const out = [];
			let total = 0;
			for (const p of [...proj.files.keys()].sort()) {
				if (dirFilter && p !== dirFilter && p.indexOf(dirFilter + '/') !== 0) continue;
				const f = proj.files.get(p);
				if (!f || !f.isText || f.text == null) continue;
				const lines = f.text.split('\n');
				for (let i = 0; i < lines.length; i++) {
					re.lastIndex = 0;
					if (re.test(lines[i])) {
						total++;
						if (out.length < max) {
							if (ctx) {
								const s = Math.max(0, i - ctx),
									e2 = Math.min(lines.length - 1, i + ctx);
								const block = [];
								for (let j = s; j <= e2; j++)
									block.push(p + ':' + (j + 1) + (j === i ? ' >' : '  ') + ' ' + lines[j]);
								out.push(block.join('\n'));
							} else out.push(p + ':' + (i + 1) + ': ' + lines[i].trim().slice(0, 200));
						}
					}
				}
			}
			if (!total) return `Nenhuma ocorrência de "${q}"${dirFilter ? ' em ' + dirFilter : ''}.`;
			return (
				'Total: ' +
				total +
				' linha(s) com ocorrência' +
				(total > out.length ? ` (mostrando ${out.length})` : '') +
				'\n\n' +
				out.join(ctx ? '\n---\n' : '\n')
			);
		},
	},
	{
		name: 'list_versions',
		title: 'Listar versões (arquivo)',
		desc:
			'Lista o histórico de versões automático de um arquivo de texto (toda gravação guarda a ' +
			'versão anterior; máx. 40). Retorna v1 (mais antiga) até vN (mais recente), com data e ' +
			'tamanho. Combine com read_version, diff_file e restore_version.',
		schema: {
			type: 'object',
			properties: { path: { type: 'string' }, project: MCP_PROJECT_PROP },
			required: ['path'],
		},
		run: async (a) => {
			const proj = mcpProj(a);
			const path = mcpNorm(a.path);
			const f = mcpFile(proj, path);
			if (!f.isText || f.text == null)
				throw new Error('Arquivo binário não tem histórico de versões: ' + path);
			const h = f.history || [];
			if (!h.length)
				return `Sem versões registradas para ${path} ainda (o histórico é criado a cada gravação).`;
			const lines = h.map(
				(v, i) =>
					`v${i}${1} — ${new Date(v.t).toLocaleString()} (${relTime(v.t)}) — ${v.text.length} caractere(s), ${v.text.split('\n').length} linha(s)`,
			);
			const cur =
				h[h.length - 1].text === f.text
					? `O conteúdo atual é igual à última versão (v${h.length}).`
					: `O conteúdo atual DIFERE da última versão (v${h.length}) — diff_file sem from/to mostra essa diferença.`;
			return (
				path +
				' — ' +
				h.length +
				' versão(ões), da mais antiga para a mais recente:\n' +
				lines.join('\n') +
				'\n' +
				cur
			);
		},
	},
	{
		name: 'read_version',
		title: 'Ler versão antiga',
		desc: 'Retorna o conteúdo de uma versão antiga de um arquivo, sem alterar nada. version aceita v3 ou 3 (veja list_versions) ou current para o conteúdo atual.',
		schema: {
			type: 'object',
			properties: {
				path: { type: 'string' },
				version: { type: 'string', description: 'v1..vN, número, ou current' },
				project: MCP_PROJECT_PROP,
			},
			required: ['path', 'version'],
		},
		run: async (a) => {
			const proj = mcpProj(a);
			const path = mcpNorm(a.path);
			const f = mcpFile(proj, path);
			if (!f.isText || f.text == null)
				throw new Error('Arquivo binário não tem histórico de versões: ' + path);
			const v = mcpVersion(f, a.version, path);
			let txt = v.text == null ? '' : v.text;
			let note = '';
			if (txt.length > 100000) {
				note = '\n... (truncado em 100000 caracteres)';
				txt = txt.slice(0, 100000);
			}
			return `Conteúdo de ${path} (${v.label}${v.t ? ', ' + new Date(v.t).toLocaleString() : ''}, ${txt.split('\n').length} linha(s)):\n${txt}${note}`;
		},
	},
	{
		name: 'diff_file',
		title: 'Diff de arquivo',
		desc:
			'Mostra um diff unificado (linhas + e -) entre versões de um arquivo. Sem from/to ' +
			'compara a última versão do histórico com o conteúdo atual (ou seja, a última mudança). ' +
			'from/to aceitam v1..vN ou current. context controla as linhas ao redor.',
		schema: {
			type: 'object',
			properties: {
				path: { type: 'string' },
				from: {
					type: 'string',
					description: 'Versão base (padrão: última versão diferente do atual)',
				},
				to: { type: 'string', description: 'Versão alvo (padrão: current)' },
				context: {
					type: 'integer',
					minimum: 0,
					maximum: 10,
					description: 'Linhas de contexto (padrão 3)',
				},
				project: MCP_PROJECT_PROP,
			},
			required: ['path'],
		},
		run: async (a) => {
			const proj = mcpProj(a);
			const path = mcpNorm(a.path);
			const f = mcpFile(proj, path);
			if (!f.isText || f.text == null) throw new Error('Arquivo binário não tem diff: ' + path);
			const h = f.history || [];
			let fromSpec = a.from,
				toSpec = a.to == null ? 'current' : a.to;
			if (fromSpec == null) {
				if (!h.length) throw new Error(`Sem versões no histórico de ${path} — nada para comparar.`);
				let n = h.length;
				if (String(toSpec) === 'current' && h[n - 1].text === f.text && n > 1) n--;
				fromSpec = 'v' + n;
			}
			const from = mcpVersion(f, fromSpec, path),
				to = mcpVersion(f, toSpec, path);
			if (from.text === to.text)
				return `Sem diferenças entre ${from.label} e ${to.label} de ${path}.`;
			const d = lpDiffText(from.text, to.text, a.context == null ? 3 : a.context);
			return `Diff de ${path} (${from.label} -> ${to.label}): +${d.stats.add}/-${d.stats.del} linha(s)\n${d.text}`;
		},
	},
	{
		name: 'restore_version',
		title: 'Restaurar versão (arquivo)',
		desc: 'Restaura um arquivo para uma versão do histórico (veja list_versions). O conteúdo atual é guardado no histórico antes, então dá para desfazer. Preview atualiza automaticamente.',
		schema: {
			type: 'object',
			properties: {
				path: { type: 'string' },
				version: { type: 'string', description: 'v1..vN ou número' },
				project: MCP_PROJECT_PROP,
			},
			required: ['path', 'version'],
		},
		run: async (a) => {
			const proj = mcpProj(a);
			const path = mcpNorm(a.path);
			const f = mcpFile(proj, path);
			if (!f.isText || f.text == null)
				throw new Error('Arquivo binário não pode ser restaurado por versão: ' + path);
			const v = mcpVersion(f, a.version, path);
			if (v.label === 'atual')
				throw new Error(
					`Informe uma versão do histórico (v1..v${(f.history || []).length}), não current.`,
				);
			if (v.text === f.text)
				return `O conteúdo atual de ${path} já é igual a ${v.label} — nada a fazer.`;
			mcpHist(f);
			const before = f.text;
			f.text = v.text;
			f.data = null;
			mcpAfterWrite(proj, path);
			return `Restaurado: ${path} -> ${v.label}${v.t ? ' de ' + new Date(v.t).toLocaleString() : ''}.${lpDelta(before, f.text)} \
O conteúdo substituído ficou no histórico. Preview atualizado.`;
		},
	},
	{
		name: 'snapshot_project',
		title: 'Criar snapshot do projeto',
		desc:
			'Congela o estado atual do projeto INTEIRO (todos os arquivos de texto; binários são ' +
			'registrados por nome/tamanho). Use antes de mudanças grandes/refactors e rotule com ' +
			'label. Máximo de 10 snapshots por projeto (o mais antigo é descartado). Snapshots ' +
			'automáticos também são criados antes de delete e restore_snapshot.',
		schema: {
			type: 'object',
			properties: {
				label: { type: 'string', description: 'Rótulo do snapshot (ex.: antes do refactor)' },
				project: MCP_PROJECT_PROP,
			},
		},
		run: async (a) => {
			const proj = mcpProj(a);
			const s = makeSnapshot(proj, a.label ? String(a.label).slice(0, 80) : '');
			const txt = s.files.filter((e) => !e[1].bin).length;
			return (
				'Snapshot ' +
				s.id +
				(s.label ? ` ("${s.label}")` : '') +
				' criado no projeto "' +
				proj.name +
				'": ' +
				s.files.length +
				' arquivo(s), sendo ' +
				txt +
				' de texto. Use diff_snapshot para ver mudanças e restore_snapshot para reverter.'
			);
		},
	},
	{
		name: 'list_snapshots',
		title: 'Listar snapshots',
		desc: 'Lista os snapshots do projeto (id, rótulo, data, número de arquivos), do mais antigo para o mais recente.',
		schema: { type: 'object', properties: { project: MCP_PROJECT_PROP } },
		run: async (a) => {
			const proj = mcpProj(a);
			const snaps = projSnapshots(proj);
			if (!snaps.length)
				return `Nenhum snapshot no projeto "${proj.name}" ainda. Crie com snapshot_project.`;
			return (
				'Snapshots de "' +
				proj.name +
				'" (' +
				snaps.length +
				'/' +
				SNAP_MAX +
				'):\n' +
				snaps
					.map(
						(s) =>
							s.id +
							(s.label ? ` ("${s.label}")` : '') +
							' — ' +
							new Date(s.t).toLocaleString() +
							' (' +
							relTime(s.t) +
							') — ' +
							s.files.length +
							' arquivo(s)',
					)
					.join('\n')
			);
		},
	},
	{
		name: 'diff_snapshot',
		title: 'Diff desde um snapshot',
		desc:
			'Compara um snapshot com o estado atual do projeto. Sem path: resumo com arquivos ' +
			'adicionados, excluídos e modificados (+linhas/-linhas). Com path: diff unificado ' +
			'completo daquele arquivo. snapshot aceita o id (ex.: s3) ou o rótulo; padrão: o mais ' +
			'recente.',
		schema: {
			type: 'object',
			properties: {
				snapshot: { type: 'string', description: 'Id (s1..sN) ou rótulo (padrão: mais recente)' },
				path: { type: 'string', description: 'Arquivo específico para diff completo' },
				context: { type: 'integer', minimum: 0, maximum: 10 },
				project: MCP_PROJECT_PROP,
			},
		},
		run: async (a) => {
			const proj = mcpProj(a);
			const s = findSnap(proj, a.snapshot);
			const snapMap = new Map(s.files);
			if (a.path) {
				const path = mcpNorm(a.path);
				const v = snapMap.get(path);
				const f = proj.files.get(path);
				if (!v && !f) throw new Error('Arquivo não existe nem no snapshot nem no projeto: ' + path);
				if (!v)
					return (
						path +
						' NÃO existia no snapshot ' +
						s.id +
						' — é um arquivo novo (' +
						(f.isText && f.text != null ? f.text.split('\n').length + ' linha(s)' : 'binário') +
						').'
					);
				if (v.bin)
					return (
						path + ' é binário — o snapshot registra apenas nome/tamanho, sem diff de conteúdo.'
					);
				if (!f)
					return (
						path +
						' existia no snapshot ' +
						s.id +
						' mas foi EXCLUÍDO do projeto. restore_snapshot com path recria o arquivo.'
					);
				const cur = f.isText && f.text != null ? f.text : null;
				if (cur == null) return path + ' virou binário — diff indisponível.';
				if (v.text === cur) return `Sem diferenças em ${path} desde o snapshot ${s.id}.`;
				const d = lpDiffText(v.text, cur, a.context == null ? 3 : a.context);
				return `Diff de ${path} (${s.id} -> atual): +${d.stats.add}/-${d.stats.del} linha(s)\n${d.text}`;
			}
			const added = [],
				gone = [],
				mod = [],
				binCh = [];
			for (const [path, f] of proj.files) {
				const v = snapMap.get(path);
				if (!v) {
					added.push(path);
					continue;
				}
				if (v.bin) {
					const size = f.text != null ? f.text.length : f.data ? f.data.length : 0;
					if (size !== v.size) binCh.push(path);
					continue;
				}
				const cur = f.isText && f.text != null ? f.text : null;
				if (cur == null) {
					mod.push(path + ' (virou binário)');
					continue;
				}
				if (cur !== v.text) {
					const d = lpDiffText(v.text, cur, 0);
					mod.push(path + ' (+' + d.stats.add + '/-' + d.stats.del + ')');
				}
			}
			for (const e of s.files) {
				if (!proj.files.has(e[0])) gone.push(e[0]);
			}
			if (!added.length && !gone.length && !mod.length && !binCh.length)
				return (
					'Nenhuma mudança no projeto desde o snapshot ' +
					s.id +
					(s.label ? ` ("${s.label}")` : '') +
					'.'
				);
			const parts = [
				'Mudanças desde o snapshot ' +
					s.id +
					(s.label ? ` ("${s.label}")` : '') +
					' de ' +
					new Date(s.t).toLocaleString() +
					':',
			];
			if (mod.length) parts.push(`Modificados (${mod.length}):\n  ${mod.join('\n  ')}`);
			if (added.length) parts.push(`Adicionados (${added.length}):\n  ${added.join('\n  ')}`);
			if (gone.length) parts.push(`Excluídos (${gone.length}):\n  ${gone.join('\n  ')}`);
			if (binCh.length)
				parts.push(`Binários alterados (${binCh.length}):\n  ${binCh.join('\n  ')}`);
			parts.push(
				'diff_snapshot com path mostra o diff completo de um arquivo; restore_snapshot reverte tudo ou um arquivo.',
			);
			return parts.join('\n');
		},
	},
	{
		name: 'restore_snapshot',
		title: 'Restaurar snapshot',
		desc:
			'Restaura o projeto (ou um único arquivo, com path) para o estado de um snapshot. Antes ' +
			'de restaurar tudo, um snapshot automático de segurança do estado atual é criado (dá ' +
			'para desfazer). Arquivos de texto criados depois do snapshot são excluídos na ' +
			'restauração completa; binários são mantidos (o snapshot não guarda conteúdo binário). ' +
			'Preview atualiza automaticamente.',
		schema: {
			type: 'object',
			properties: {
				snapshot: { type: 'string', description: 'Id (s1..sN) ou rótulo (padrão: mais recente)' },
				path: { type: 'string', description: 'Restaurar somente este arquivo' },
				project: MCP_PROJECT_PROP,
			},
		},
		run: async (a) => {
			const proj = mcpProj(a);
			const s = findSnap(proj, a.snapshot);
			const snapMap = new Map(s.files);
			if (a.path) {
				const path = mcpNorm(a.path);
				const v = snapMap.get(path);
				if (!v) throw new Error(`Arquivo não existe no snapshot ${s.id}: ${path}`);
				if (v.bin)
					throw new Error(
						'Arquivo binário não pode ser restaurado do snapshot (apenas nome/tamanho é registrado): ' +
							path,
					);
				let f = proj.files.get(path);
				if (f && f.isText && f.text === v.text)
					return `O conteúdo atual de ${path} já é igual ao do snapshot ${s.id} — nada a fazer.`;
				if (f) {
					if (f.isText && f.text != null) mcpHist(f);
					f.isText = true;
					f.text = v.text;
					f.data = null;
				} else {
					f = newFileEntry(path);
					f.isText = true;
					f.text = v.text;
					f.data = null;
					f.history = [{ t: Date.now(), text: v.text }];
					proj.files.set(path, f);
				}
				mcpAfterWrite(proj, path);
				return `Restaurado do snapshot ${s.id}: ${path}. Preview atualizado.`;
			}
			const safety = makeSnapshot(proj, 'auto: antes de restaurar ' + s.id);
			let changed = 0,
				created = 0,
				removedTxt = 0;
			const binMissing = [];
			for (const e of s.files) {
				const path = e[0],
					v = e[1];
				if (v.bin) {
					if (!proj.files.has(path)) binMissing.push(path);
					continue;
				}
				let f = proj.files.get(path);
				if (f) {
					if (f.isText && f.text === v.text) continue;
					if (f.isText && f.text != null) mcpHist(f);
					f.isText = true;
					f.text = v.text;
					f.data = null;
					changed++;
				} else {
					f = newFileEntry(path);
					f.isText = true;
					f.text = v.text;
					f.data = null;
					f.history = [{ t: Date.now(), text: v.text }];
					proj.files.set(path, f);
					created++;
				}
			}
			for (const path of [...proj.files.keys()]) {
				const f = proj.files.get(path);
				if (!snapMap.has(path) && f && f.isText && f.text != null) {
					mcpDeleteOne(proj, path);
					removedTxt++;
				}
			}
			mcpBulkChanged(proj);
			let msg =
				'Projeto "' +
				proj.name +
				'" restaurado para o snapshot ' +
				s.id +
				(s.label ? ` ("${s.label}")` : '') +
				': ' +
				changed +
				' arquivo(s) revertido(s), ' +
				created +
				' recriado(s), ' +
				removedTxt +
				' excluído(s).';
			if (binMissing.length)
				msg += ` Binários que existiam no snapshot mas não puderam ser restaurados: ${binMissing.join(', ')}.`;
			msg += ` Estado anterior salvo no snapshot de segurança ${safety.id}. Preview atualizado.`;
			return msg;
		},
	},
	{
		name: 'claim_project',
		title: 'Reivindicar projeto (lock)',
		desc:
			'Reivindica um projeto para você (lock cooperativo): enquanto o claim estiver ativo, ' +
			'gravações de OUTROS agentes nesse projeto são bloqueadas (a menos que usem force=true). ' +
			'Cada gravação sua renova o prazo. Use no início do trabalho e libere com ' +
			'release_project ao terminar.',
		schema: {
			type: 'object',
			properties: {
				agent: { type: 'string', description: 'Seu nome de agente (ex.: agente-frontend)' },
				note: { type: 'string', description: 'O que você vai fazer (visível aos outros agentes)' },
				minutes: {
					type: 'integer',
					minimum: 5,
					maximum: 480,
					description: 'Duração do claim em minutos (padrão 30; renova a cada gravação sua)',
				},
				force: { type: 'boolean', description: 'Tomar o claim mesmo se outro agente o detiver' },
				project: MCP_PROJECT_PROP,
			},
			required: ['agent'],
		},
		run: async (a) => {
			const proj = mcpProj(a);
			const agent = agName(a);
			if (!agent) throw new Error('Informe agent (seu nome de agente).');
			const c = agClaimOf(proj);
			if (c && c.agent !== agent && a.force !== true)
				throw new Error(
					`Projeto "${proj.name}" já está reivindicado por "${c.agent}" (expira ${agIn(c.until)}${c.note ? ' · nota: ' + c.note : ''}). \
Combine via post_message ou use force=true apenas se tiver certeza de que ele terminou.`,
				);
			const mins = Math.max(5, Math.min(480, parseInt(a.minutes, 10) || 30));
			AG.claims[proj.id] = {
				agent: agent,
				note: String(a.note == null ? '' : a.note).slice(0, 120),
				mins: mins,
				until: Date.now() + mins * 60000,
				t: Date.now(),
			};
			agRecord({
				agent: agent,
				tool: 'claim_project',
				project: proj.name,
				hint:
					c && c.agent !== agent
						? 'tomou o claim de ' + c.agent
						: String(a.note == null ? '' : a.note).slice(0, 60),
				ok: 1,
				warn: c && c.agent !== agent ? 1 : 0,
			});
			return `Projeto "${proj.name}" reivindicado por "${agent}" por ${mins} min (cada gravação sua renova \
o prazo). Gravações de outros agentes serão bloqueadas. Libere com release_project ao terminar.`;
		},
	},
	{
		name: 'release_project',
		title: 'Liberar projeto',
		desc: 'Libera o claim (lock) de um projeto. Use ao terminar seu trabalho para deixar outros agentes gravarem.',
		schema: {
			type: 'object',
			properties: {
				agent: { type: 'string', description: 'Seu nome de agente' },
				force: { type: 'boolean', description: 'Liberar mesmo se o claim for de outro agente' },
				project: MCP_PROJECT_PROP,
			},
			required: ['agent'],
		},
		run: async (a) => {
			const proj = mcpProj(a);
			const agent = agName(a);
			const c = agClaimOf(proj);
			if (!c) return `Nenhum claim ativo em "${proj.name}".`;
			if (c.agent !== agent && a.force !== true)
				throw new Error(
					`O claim de "${proj.name}" pertence a "${c.agent}". Use force=true para liberar mesmo assim.`,
				);
			delete AG.claims[proj.id];
			mcpRenderAgents();
			agRecord({
				agent: agent,
				tool: 'release_project',
				project: proj.name,
				hint: c.agent !== agent ? 'liberou o claim de ' + c.agent : '',
				ok: 1,
				warn: c.agent !== agent ? 1 : 0,
			});
			return `Claim de "${proj.name}" liberado.`;
		},
	},
	{
		name: 'list_claims',
		title: 'Listar claims e agentes',
		desc: 'Mostra os claims (locks) ativos — quem reivindicou cada projeto e até quando — e os agentes vistos recentemente. Use antes de escolher em qual projeto trabalhar.',
		schema: { type: 'object', properties: {} },
		run: async (a) => {
			const now = Date.now();
			const lines = [];
			const cs = Object.keys(AG.claims)
				.map((id) => [id, AG.claims[id]])
				.filter((x) => now <= x[1].until);
			lines.push(cs.length ? `Claims ativos (${cs.length}):` : 'Nenhum claim ativo.');
			for (const x of cs) {
				const c = x[1];
				const p = State.projects.find((pp) => pp.id === x[0]);
				lines.push(
					`- ${p ? p.name : x[0]} → ${c.agent} (expira ${agIn(c.until)}${c.note ? ' · ' + c.note : ''})`,
				);
			}
			const seen = Object.keys(AG.seen)
				.map((n) => [n, AG.seen[n]])
				.sort((x, y) => y[1] - x[1])
				.slice(0, 20);
			if (seen.length) {
				lines.push('');
				lines.push('Agentes vistos recentemente:');
				for (const s of seen) lines.push(`- ${s[0]} (${relTime(s[1])})`);
			}
			return lines.join('\n');
		},
	},
	{
		name: 'agent_activity',
		title: 'Atividade dos agentes',
		desc: 'Feed das últimas ações relevantes (gravações, claims, comandos, mensagens) de todos os agentes — use para coordenar trabalho em paralelo e ver o que os outros fizeram. Filtre por project e/ou agent.',
		schema: {
			type: 'object',
			properties: {
				agent: { type: 'string', description: 'Filtrar por um agente' },
				limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Quantidade (padrão 30)' },
				project: MCP_PROJECT_PROP,
			},
		},
		run: async (a) => {
			let list = AG.log.slice();
			if (a && a.project) {
				const p = mcpProj(a);
				list = list.filter((e) => e.project === p.name);
			}
			if (a && a.agent) {
				const q = String(a.agent).trim();
				list = list.filter((e) => e.agent === q);
			}
			list = list.slice(-Math.max(1, Math.min(100, parseInt(a && a.limit, 10) || 30)));
			if (!list.length) return 'Nenhuma atividade registrada ainda.';
			return list
				.map(
					(e) =>
						`[${relTime(e.t)}] ${e.agent} · ${e.tool}${e.project ? ' · ' + e.project : ''}${e.hint ? ' · ' + e.hint : ''}${e.ok ? '' : ' · FALHOU'}${e.warn ? ' ⚠️' : ''}`,
				)
				.join('\n');
		},
	},
	{
		name: 'post_message',
		title: 'Mensagem entre agentes',
		desc: 'Publica uma mensagem no quadro compartilhado entre agentes (ex.: avisar que terminou uma parte, pedir para liberar um projeto). Use to para endereçar um agente específico; sem to, vale para todos.',
		schema: {
			type: 'object',
			properties: {
				agent: { type: 'string', description: 'Seu nome de agente (remetente)' },
				text: { type: 'string', description: 'Texto da mensagem (até 500 caracteres)' },
				to: { type: 'string', description: 'Agente destinatário (vazio = todos)' },
				project: MCP_PROJECT_PROP,
			},
			required: ['agent', 'text'],
		},
		run: async (a) => {
			const agent = agName(a);
			if (!agent) throw new Error('Informe agent (seu nome).');
			let projName = '';
			if (a && a.project) projName = mcpProj(a).name;
			const m = tmMsgSend({ from: agent, to: a && a.to, text: a && a.text, projName: projName });
			agRecord({
				agent: agent,
				tool: 'post_message',
				project: projName,
				hint: (m.tipo === 'todos' ? '' : `para ${m.para}: `) + m.texto.slice(0, 60),
				ok: 1,
			});
			return (
				'Mensagem #' +
				m.id +
				' publicada' +
				(m.tipo === 'todos' ? ' para todos' : ` para "${m.para}"`) +
				'. Cada destinatario recebe uma linha [NOTIFICACAO] no topo da proxima resposta de ferramenta e le o texto com ' +
				ntRotulo('msg_inbox') +
				'.'
			);
		},
	},
	{
		name: 'read_messages',
		title: 'Ler mensagens',
		desc: 'Lê o quadro de mensagens entre agentes. Informe agent para ver só o que interessa a você (mensagens para todos, para você ou suas). Use after_id para ler apenas as novas desde a última leitura.',
		schema: {
			type: 'object',
			properties: {
				agent: { type: 'string', description: 'Seu nome de agente' },
				after_id: {
					type: 'integer',
					description: 'Retornar apenas mensagens com id maior que este',
				},
				limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Quantidade (padrão 20)' },
			},
		},
		run: async (a) => {
			const me = agName(a);
			const after = parseInt(a && a.after_id, 10);
			if (!me) {
				let list = tmMsgs().filter((m) => m.tipo === 'todos');
				if (isFinite(after)) list = list.filter((m) => m.id > after);
				list = list.slice(-Math.max(1, Math.min(50, parseInt(a && a.limit, 10) || 20)));
				if (!list.length)
					return `Nenhuma mensagem no quadro geral${isFinite(after) ? ' apos #' + after : ''}. Informe agent="seu-nome" para ver tambem o que foi endereçado a voce e a sua equipe.`;
				return list.map((m) => tmMsgLinha(m, '')).join('\n');
			}
			const r = tmMsgInbox(me, {
				afterId: isFinite(after) ? after : 0,
				limit: a && a.limit,
				marcar: false,
			});
			if (!r.mensagens.length)
				return `Nenhuma mensagem${isFinite(after) ? ' nova apos #' + after : ''} para "${r.agente}".`;
			return r.mensagens.map((m) => tmMsgLinha(m, tmAgKey(r.agente))).join('\n');
		},
	},
	{
		name: 'check_syntax',
		title: 'Verificar sintaxe',
		desc:
			'Valida a sintaxe SEM executar nem alterar nada: JS/módulos (inclusive os blocos script ' +
			'embutidos no HTML), JSON, CSS e TS/JSX (quando o compilador do preview já estiver ' +
			'carregado). Informe path para checar 1 arquivo, ou omita para checar o projeto inteiro. ' +
			'Funciona em qualquer projeto, ativo ou não — ideal após uma sequência de edições.',
		schema: {
			type: 'object',
			properties: {
				path: {
					type: 'string',
					description:
						'Arquivo específico (opcional; padrão: todos os arquivos verificáveis do projeto)',
				},
				project: MCP_PROJECT_PROP,
			},
		},
		run: async (a) => {
			const proj = mcpProj(a);
			const exts = ['.js', '.mjs', '.cjs', '.json', '.html', '.htm', '.css', '.jsx', '.ts', '.tsx'];
			const targets = [];
			if (a.path) {
				const p = mcpNorm(a.path);
				const f = mcpFile(proj, p);
				if (!f.isText || f.text == null)
					throw new Error('Arquivo binário não pode ser verificado: ' + p);
				targets.push([p, f.text]);
			} else {
				for (const [p, f] of proj.files) {
					if (f.isText && f.text != null && exts.includes(Core.extname(p)))
						targets.push([p, f.text]);
				}
			}
			if (!targets.length) return 'Nenhum arquivo verificável encontrado.';
			const out = [];
			let bad = 0;
			for (const [p, t] of targets) {
				let issues = [];
				try {
					issues = lintFile(p, t);
				} catch (e) {
					issues = ['falha ao verificar: ' + ((e && e.message) || e)];
				}
				if (issues.length) {
					bad++;
					out.push(p + ':\n  - ' + issues.join('\n  - '));
				}
			}
			let msg = bad
				? `Problemas de sintaxe em ${bad} de ${targets.length} arquivo(s) verificado(s):\n\n${out.join('\n\n')}`
				: `OK — nenhum problema de sintaxe em ${targets.length} arquivo(s) verificado(s).`;
			if (!window.Babel && targets.some(([p]) => ['.jsx', '.ts', '.tsx'].includes(Core.extname(p))))
				msg +=
					'\n(Obs.: arquivos .ts/.tsx/.jsx só são verificados quando o compilador do preview já foi carregado.)';
			return msg;
		},
	},
	{
		name: 'wait_for_errors',
		title: 'Smoke test do preview',
		desc:
			'Teste rápido de fumaça: recompila o preview, observa o site rodando por alguns segundos ' +
			'e devolve os erros (e opcionalmente avisos) de runtime que apareceram. Use após ' +
			'terminar um bloco de edições para confirmar que nada quebrou em execução. Requer que o ' +
			'projeto alvo esteja ativo na tela (o preview só roda para o projeto ativo); para ' +
			'projetos não ativos use check_syntax + console_logs.',
		schema: {
			type: 'object',
			properties: {
				seconds: {
					type: 'number',
					description: 'Tempo de observação em segundos (1-10, padrão 3)',
				},
				level: {
					type: 'string',
					enum: ['error', 'warn'],
					description: 'error (padrão) ou warn para incluir avisos',
				},
				project: MCP_PROJECT_PROP,
			},
		},
		run: async (a) => {
			const proj = mcpProj(a);
			if (proj.id !== State.active)
				throw new Error(
					`O preview só roda para o projeto ativo — wait_for_errors precisa que "${proj.name}" esteja ativo \
na tela. Use check_syntax (funciona sem ativar) ou ative o projeto com set_active_project (avise o usuário).`,
				);
			const secs = Math.min(10, Math.max(1, Number(a.seconds) || 3));
			const mark = proj.logs.length;
			await buildPreview(proj);
			await new Promise((r) => setTimeout(r, secs * 1000));
			let logs = proj.logs.slice(mark);
			logs =
				a.level === 'warn'
					? logs.filter((l) => l.level === 'error' || l.level === 'warn')
					: logs.filter((l) => l.level === 'error');
			if (!logs.length)
				return `OK — preview recompilado e nenhum ${a.level === 'warn' ? 'erro/aviso' : 'erro'} de runtime em ${secs}s de execução.`;
			return (
				'O preview apresentou ' +
				logs.length +
				' problema(s) em ' +
				secs +
				's de execução:\n' +
				logs
					.map(
						(l) =>
							'[' + String(l.level).toUpperCase() + '] ' + l.text + (l.src ? ` (${l.src})` : ''),
					)
					.join('\n')
			);
		},
	},
	{
		name: 'console_logs',
		title: 'Console do preview',
		desc: 'Retorna os últimos registros do console do preview (console.log, erros e avisos do site em execução). Útil para depurar depois de editar.',
		schema: {
			type: 'object',
			properties: {
				limit: { type: 'integer', minimum: 1, maximum: 200 },
				level: {
					type: 'string',
					enum: ['all', 'error', 'warn'],
					description: 'Filtro (padrão: all)',
				},
				project: MCP_PROJECT_PROP,
			},
		},
		run: async (a) => {
			const proj = mcpProj(a);
			const limit = Math.min(200, a.limit || 50);
			let logs = proj.logs;
			if (a.level === 'error') logs = logs.filter((l) => l.level === 'error');
			else if (a.level === 'warn')
				logs = logs.filter((l) => l.level === 'warn' || l.level === 'error');
			logs = logs.slice(-limit);
			return logs.length
				? logs
						.map(
							(l) =>
								'[' +
								fmtLogTime(l.t) +
								'] ' +
								String(l.level).toUpperCase() +
								' ' +
								l.text +
								(l.src ? ` (${l.src})` : ''),
						)
						.join('\n')
				: 'Console vazio.';
		},
	},
	{
		name: 'refresh_preview',
		title: 'Recompilar preview',
		desc: 'Força a recompilação do preview do projeto alvo (normalmente desnecessário: toda edição já atualiza sozinha). Só surte efeito visível se o projeto for o ativo.',
		schema: { type: 'object', properties: { project: MCP_PROJECT_PROP } },
		run: async (a) => {
			const proj = mcpProj(a);
			if (proj.id !== State.active)
				return `O projeto "${proj.name}" não está ativo na tela — o preview dele será montado automaticamente \
quando for ativado (set_active_project ou clique do usuário). Nada a recompilar agora.`;
			buildPreview(proj);
			return 'Preview recompilado.';
		},
	},
	{
		name: 'network_log',
		title: 'Registro de rede do preview',
		desc:
			'Mostra as requisições de rede feitas pelo preview: fetch, XMLHttpRequest e recursos que ' +
			'falharam ao carregar (img/script/css/audio/video), com método, URL, status HTTP, tempo ' +
			'e requisições PENDENTES (que nunca terminaram). É assim que você descobre por que uma ' +
			'imagem/API não carrega: only_errors=true filtra só os problemas; clear=true zera o ' +
			'registro (útil antes de um teste). O registro reinicia junto com o preview. Funciona ' +
			'também com projeto não ativo (headless).',
		schema: {
			type: 'object',
			properties: {
				only_errors: { type: 'boolean', description: 'Só mostrar erros e requisições pendentes' },
				clear: { type: 'boolean', description: 'Limpar o registro de rede' },
				limit: { type: 'integer', description: 'Máximo de linhas (1-100, padrão 40)' },
				project: MCP_PROJECT_PROP,
			},
		},
		run: async (a) => {
			const proj = mcpProj(a);
			const r = await visionCall(
				proj,
				'network',
				{ clear: !!a.clear, only_errors: !!a.only_errors, limit: a.limit },
				12000,
			);
			return String(r.text || 'ok') + (r.__headless ? '\n(preview headless)' : '');
		},
	},
	{
		name: 'reset_state',
		title: 'Zerar estado do app',
		desc:
			'Apaga o estado salvo do app no preview — localStorage, sessionStorage, IndexedDB e ' +
			'caches (e cookies se cookies=true) — e recarrega o preview (reload=false só limpa, sem ' +
			'recarregar). Use para testar como um USUÁRIO NOVO, do zero, sem resíduo de sessões ' +
			'anteriores (saves de jogo, onboarding já visto, tokens). O armazenamento do próprio ' +
			'editor é preservado automaticamente. screenshot_after=true já devolve a imagem da ' +
			'primeira visita. Funciona também com projeto não ativo (headless).',
		schema: {
			type: 'object',
			properties: {
				cookies: { type: 'boolean', description: 'Também limpar cookies (padrão false)' },
				reload: { type: 'boolean', description: 'Recarregar o preview após limpar (padrão true)' },
				screenshot_after: {
					type: 'boolean',
					description: 'Já devolver um screenshot após o reset',
				},
				project: MCP_PROJECT_PROP,
			},
		},
		run: async (a) => {
			const proj = mcpProj(a);
			const r = await visionCall(
				proj,
				'reset',
				{ keep_prefixes: ['aurora.'], keep_dbs: ['aurora-lp'], cookies: !!a.cookies },
				15000,
			);
			let relTxt = '';
			if (a.reload !== false) {
				if (proj.id === State.active) {
					const dv = typeof DEV !== 'undefined' && DEV.map ? DEV.map[proj.id] : null;
					if (dv && dv.url) {
						el.frame.src = dv.url;
					} else if (proj.lastHtml) {
						frameSrcdoc(proj.lastHtml);
					} else {
						await buildPreview(proj);
					}
					await new Promise((r2) => setTimeout(r2, 900));
					relTxt = ' · preview recarregado';
				} else {
					const hl = HEADLESS.map.get(proj.id);
					if (hl && hl.ifr) {
						hl.ready = headlessWaitReady(hl, 10000);
						if (hl.dev && hl.src) {
							hl.ifr.src = hl.src;
						} else if (proj.lastHtml) {
							hl.ifr.srcdoc = proj.lastHtml;
						}
						await hl.ready;
						relTxt = ' · preview recarregado';
					}
				}
			}
			const av = r.avisos && r.avisos.length ? '\nAvisos: ' + r.avisos.join(' | ') : '';
			const text = `Estado de "${proj.name}" zerado: localStorage ${r.ls || 0} chave(s) · sessionStorage ${r.ss || 0} \
· IndexedDB ${r.idb || 0} banco(s) · caches ${r.caches || 0}${a.cookies ? ' · cookies ' + (r.cookies || 0) : ''}${relTxt}.${av}${a.reload !== false ? '\nO app agora roda como um usuário novo (primeira visita).' : '\nLimpeza feita SEM recarregar; o app ainda pode ter estado em memória. Use reload=true para começar do zero.'}`;
			if (a.screenshot_after) {
				const sh = await visionCall(proj, 'screenshot', {}, 20000);
				const m = String(sh.dataUrl || '').match(/^data:(image\/[a-z+]+);base64,(.+)$/);
				if (m)
					return {
						__content: [
							{ type: 'image', data: m[2], mimeType: m[1] },
							{ type: 'text', text: text + (sh.warn ? '\nAviso do screenshot: ' + sh.warn : '') },
						],
					};
			}
			return text;
		},
	},
	{
		name: 'set_viewport',
		title: 'Definir viewport (responsividade)',
		desc:
			'Muda o tamanho do preview para testar responsividade: presets ' +
			'celular/tablet/notebook/desktop, medidas exatas (width/height), DPR emulado ' +
			'(devicePixelRatio), orientação (portrait/landscape) e toque (navigator.maxTouchPoints=5)' +
			'. Vale para o preview ativo E para o headless, dispara resize/orientationchange na ' +
			'página e PERSISTE até ser trocado (inclusive após rebuilds do preview). ' +
			'screenshot_after=true já devolve a imagem no novo tamanho — o jeito de VER o layout ' +
			'como num celular antes de entregar. Volte ao normal com preset "padrao".',
		schema: {
			type: 'object',
			properties: {
				preset: {
					type: 'string',
					enum: ['celular', 'celular_pequeno', 'tablet', 'notebook', 'desktop', 'padrao'],
					description:
						'Tamanho pronto: celular 390x844 @3x touch, celular_pequeno 360x640 @2x touch, tablet 820x1180 @2x touch, notebook 1366x768, desktop 1920x1080, padrao = volta ao normal',
				},
				width: { type: 'integer', description: 'Largura exata em px (16-4096; sobrepõe o preset)' },
				height: { type: 'integer', description: 'Altura exata em px (16-4096)' },
				dpr: { type: 'number', description: 'devicePixelRatio emulado (0.5-4)' },
				orientation: {
					type: 'string',
					enum: ['portrait', 'landscape'],
					description: 'Gira as medidas se necessário',
				},
				touch: { type: 'boolean', description: 'Emular tela de toque (maxTouchPoints=5)' },
				screenshot_after: {
					type: 'boolean',
					description: 'Já devolver um screenshot no novo tamanho',
				},
				project: MCP_PROJECT_PROP,
			},
		},
		run: async (a) => {
			const proj = mcpProj(a);
			const PRESETS = {
				celular: { w: 390, h: 844, dpr: 3, touch: true },
				celular_pequeno: { w: 360, h: 640, dpr: 2, touch: true },
				tablet: { w: 820, h: 1180, dpr: 2, touch: true },
				notebook: { w: 1366, h: 768, dpr: 1, touch: false },
				desktop: { w: 1920, h: 1080, dpr: 1, touch: false },
			};
			const pk = String(a.preset || '')
				.trim()
				.toLowerCase();
			const reset = pk === 'padrao' || pk === 'reset' || pk === 'default';
			if (pk && !reset && !PRESETS[pk])
				throw new Error(
					`Preset desconhecido: ${a.preset}. Use celular, celular_pequeno, tablet, notebook, desktop ou padrao.`,
				);
			if (
				!pk &&
				a.width == null &&
				a.height == null &&
				a.dpr == null &&
				!a.orientation &&
				a.touch == null
			)
				throw new Error('Informe preset, width/height, dpr, orientation ou touch.');
			let cfg = null;
			if (!reset) {
				const base = PRESETS[pk] ||
					proj.viewport || { w: HEADLESS.W, h: HEADLESS.H, dpr: 0, touch: false };
				let w = a.width != null ? Math.round(Number(a.width)) : base.w;
				let hh = a.height != null ? Math.round(Number(a.height)) : base.h;
				if (!(w >= 16 && w <= 4096) || !(hh >= 16 && hh <= 4096))
					throw new Error('width/height devem estar entre 16 e 4096.');
				const dpr = a.dpr != null ? Math.min(4, Math.max(0.5, Number(a.dpr) || 1)) : base.dpr || 0;
				const touch = a.touch != null ? !!a.touch : !!base.touch;
				const ori = String(a.orientation || '').toLowerCase();
				if (ori === 'landscape' && hh > w) {
					const t = w;
					w = hh;
					hh = t;
				}
				if (ori === 'portrait' && w > hh) {
					const t = w;
					w = hh;
					hh = t;
				}
				cfg = { w: w, h: hh, dpr: dpr, touch: touch, label: pk || 'personalizado' };
			}
			proj.viewport = cfg;
			if (proj.id === State.active) {
				if (cfg) {
					el.device.classList.remove('bordered');
					const r0 = el.stage.getBoundingClientRect();
					const sc = Core.computeFitScale(r0.width, r0.height, cfg.w, cfg.h, 22);
					placeDevice(cfg.w, cfg.h, sc, 0);
				} else {
					applyDevice();
				}
				await new Promise((r) => setTimeout(r, 450));
			} else {
				const hl = HEADLESS.map.get(proj.id);
				if (hl && hl.ifr) {
					hl.ifr.style.width = ((cfg && cfg.w) || HEADLESS.W) + 'px';
					hl.ifr.style.height = ((cfg && cfg.h) || HEADLESS.H) + 'px';
				}
			}
			let vr = null;
			try {
				vr = await visionCall(
					proj,
					'viewport',
					{ cfg: cfg ? { w: cfg.w, h: cfg.h, dpr: cfg.dpr || 0, touch: cfg.touch ? 5 : 0 } : null },
					10000,
				);
			} catch (e) {
				ignorarErro(e, 'run');
			}
			const text = cfg
				? 'Viewport de "' +
					proj.name +
					'" definido: ' +
					cfg.w +
					'x' +
					cfg.h +
					(cfg.dpr ? ` @${cfg.dpr}x` : '') +
					(cfg.touch ? ' · touch' : '') +
					' (' +
					(cfg.w >= cfg.h ? 'landscape' : 'portrait') +
					(cfg.label && cfg.label !== 'personalizado' ? ' · preset ' + cfg.label : '') +
					')' +
					(vr && vr.iw
						? `\nDentro da página: innerWidth ${vr.iw}px · innerHeight ${vr.ih}px · devicePixelRatio ${vr.dpr}${vr.ori ? ' · ' + vr.ori : ''}`
						: '') +
					'\nO tamanho PERSISTE para as próximas ferramentas de visão (screenshot_preview, interact, ui_map…). Volte com preset "padrao".'
				: 'Viewport de "' +
					proj.name +
					'" restaurado ao padrão (' +
					(proj.id === State.active
						? 'modo responsivo da tela'
						: `headless ${HEADLESS.W}x${HEADLESS.H}`) +
					').';
			if (a.screenshot_after) {
				const sh = await visionCall(proj, 'screenshot', {}, 20000);
				const m = String(sh.dataUrl || '').match(/^data:(image\/[a-z+]+);base64,(.+)$/);
				if (m)
					return {
						__content: [
							{ type: 'image', data: m[2], mimeType: m[1] },
							{ type: 'text', text: text + (sh.warn ? '\nAviso do screenshot: ' + sh.warn : '') },
						],
					};
			}
			return text;
		},
	},
	{
		name: 'screenshot_preview',
		title: 'Capturar preview (screenshot)',
		desc:
			'Tira um screenshot do preview e retorna a IMAGEM — use para VER o resultado do que você ' +
			'criou/editou (chame após edições importantes). PADRÃO: captura o PREVIEW INTEIRO (a ' +
			'página renderizada com HUD, menus, DOM e o conteúdo dos canvas embutido no lugar certo) ' +
			'— não só o canvas. Use mode="canvas" quando quiser apenas o canvas do jogo/WebGL (mais ' +
			'rápido). selector aceita qualquer elemento: canvas é capturado direto, outros elementos ' +
			'são recortados (element screenshot). Funciona TAMBÉM com projeto não ativo via preview ' +
			'headless em segundo plano (1280x720 por padrão; use set_viewport para testar outros ' +
			'tamanhos) (animações podem rodar mais lentas; para timing real ative o projeto).',
		schema: {
			type: 'object',
			properties: {
				selector: {
					type: 'string',
					description:
						'Opcional: seletor CSS de um canvas (captura direta) ou de qualquer elemento (recorte)',
				},
				mode: {
					type: 'string',
					enum: ['completo', 'canvas'],
					description:
						'completo (padrão) = preview inteiro (DOM + canvas dentro); canvas = só o canvas do jogo/WebGL',
				},
				format: { type: 'string', enum: ['jpeg', 'png'], description: 'Formato (padrão jpeg)' },
				quality: { type: 'number', description: 'Qualidade JPEG 0.3-1 (padrão 0.85)' },
				max_width: { type: 'integer', description: 'Largura máxima em px (padrão 1024, máx 2048)' },
				project: MCP_PROJECT_PROP,
			},
		},
		run: async (a) => {
			const proj = mcpProj(a);
			const r = await visionCall(
				proj,
				'screenshot',
				{
					selector: a.selector,
					mode: a.mode,
					format: a.format,
					quality: a.quality,
					max_width: a.max_width,
				},
				20000,
			);
			const m = String(r.dataUrl || '').match(/^data:(image\/[a-z+]+);base64,(.+)$/);
			if (!m) throw new Error('Screenshot vazio ou inválido.');
			const modeTxt =
				r.mode === 'canvas'
					? 'canvas do jogo/WebGL'
					: r.mode === 'crop'
						? 'recorte de ' + a.selector
						: r.mode === 'dom-fallback'
							? 'preview inteiro (fallback do canvas)'
							: 'preview inteiro (DOM + canvas)';
			const extra =
				(r.__headless ? ' [preview headless 1280x720 — projeto não ativo]' : '') +
				(r.warn ? ` Aviso: ${r.warn}.` : '');
			return {
				__content: [
					{ type: 'image', data: m[2], mimeType: m[1] },
					{
						type: 'text',
						text: `Screenshot do preview de "${proj.name}" (${modeTxt}, viewport ${r.w}x${r.h}).${extra}`,
					},
				],
			};
		},
	},
	{
		name: 'screenshot_burst',
		title: 'Rajada de quadros (filmstrip)',
		desc:
			'Captura N quadros do preview ao longo de um período e devolve UMA imagem só: um ' +
			'filmstrip com os quadros lado a lado, cada um rotulado com o tempo (+ms), mais a ' +
			'porcentagem de pixels alterados entre quadros consecutivos e um veredito. É a forma ' +
			'direta de VER movimento: animação fluida, personagem que treme, algo que pisca errado ' +
			'ou tela congelada. Use após implementar animação, física ou transição. Funciona também ' +
			'com projeto não ativo (headless; o navegador pode desacelerar animações em segundo ' +
			'plano — para timing real ative o projeto).',
		schema: {
			type: 'object',
			properties: {
				frames: {
					type: 'integer',
					minimum: 2,
					maximum: 8,
					description: 'Quantidade de quadros (padrão 6)',
				},
				duration_ms: {
					type: 'integer',
					minimum: 150,
					maximum: 14000,
					description: 'Período total da rajada em ms (padrão 1500)',
				},
				frame_width: {
					type: 'integer',
					minimum: 160,
					maximum: 800,
					description: 'Largura de cada quadro no filmstrip (padrão 480)',
				},
				selector: {
					type: 'string',
					description: 'Opcional: seletor CSS de um canvas/elemento específico',
				},
				format: {
					type: 'string',
					enum: ['jpeg', 'png'],
					description: 'Formato da imagem final (padrão jpeg)',
				},
				project: MCP_PROJECT_PROP,
			},
		},
		run: async (a) => {
			const proj = mcpProj(a);
			const nf = Math.min(8, Math.max(2, Math.round(Number(a.frames) || 6)));
			const dur = Math.min(14000, Math.max(150, Number(a.duration_ms) || 1500));
			const iv = Math.min(2000, Math.max(50, Math.round(dur / (nf - 1))));
			const fw = Math.min(800, Math.max(160, Math.round(Number(a.frame_width) || 480)));
			const r = await visionCall(
				proj,
				'frames',
				{ frames: nf, interval_ms: iv, max_width: fw, selector: a.selector, mode: a.mode },
				nf * iv + 30000,
			);
			const frames = r.frames || [];
			if (!frames.length) throw new Error('Nenhum quadro capturado.');
			const fmt = a.format === 'png' ? 'image/png' : 'image/jpeg';
			const fs = await burstFilmstrip(frames, r.interval || iv, fmt, 0.85);
			const m = String(fs.dataUrl || '').match(/^data:(image\/[a-z+]+);base64,(.+)$/);
			if (!m) throw new Error('Falha ao montar o filmstrip.');
			const dtxt = fs.diffs.map((d, i) => `F${i}${1}→F${i}${2}: ${d.toFixed(2)}%`).join(' · ');
			const text =
				'Filmstrip de ' +
				frames.length +
				' quadros de "' +
				proj.name +
				'" a cada ' +
				(r.interval || iv) +
				'ms (' +
				(r.mode === 'canvas' ? 'canvas do jogo/WebGL' : 'DOM rasterizado') +
				', viewport ' +
				r.w +
				'x' +
				r.h +
				').' +
				'\n' +
				'Pixels alterados entre quadros: ' +
				(dtxt || 'n/d') +
				'\n' +
				'Veredito: ' +
				burstVerdict(fs.diffs) +
				'.' +
				(r.__headless
					? '\n' +
						'[preview headless — projeto não ativo; animações podem rodar mais lentas em segundo plano]'
					: '') +
				(r.warn ? `\nAviso: ${r.warn}` : '');
			return {
				__content: [
					{ type: 'image', data: m[2], mimeType: m[1] },
					{ type: 'text', text: text },
				],
			};
		},
	},
	{
		name: 'perf_stats',
		title: 'Performance do preview (FPS)',
		desc:
			'Mede a performance REAL do preview durante alguns segundos e devolve números objetivos: ' +
			'FPS médio e mínimo, frame time (média/mediana/p95/pior), travadas (stutters), long ' +
			'tasks (tarefas >50ms que congelam a tela), memória JS e contagem de nós DOM/canvas, com ' +
			'veredito. Use para saber se o jogo/app roda liso a 60 FPS ou engasga. Funciona também ' +
			'com projeto não ativo (headless), mas o navegador reduz o requestAnimationFrame em ' +
			'segundo plano — para números exatos ative o projeto na tela.',
		schema: {
			type: 'object',
			properties: {
				duration_ms: {
					type: 'integer',
					minimum: 500,
					maximum: 10000,
					description: 'Duração da medição em ms (padrão 2000)',
				},
				project: MCP_PROJECT_PROP,
			},
		},
		run: async (a) => {
			const proj = mcpProj(a);
			const dur = Math.min(10000, Math.max(500, Number(a.duration_ms) || 2000));
			const r = await visionCall(proj, 'perf', { duration_ms: dur }, dur + 12000);
			const f1 = (x) => Math.round(Number(x) * 10) / 10;
			const fpsAvg = r.avg ? 1000 / r.avg : 0,
				fpsLow = r.worst ? 1000 / r.worst : 0;
			const lines = [];
			if (!r.samples || r.samples < 2) {
				lines.push(
					`requestAnimationFrame NÃO rodou durante a medição (${r.samples || 0} amostra(s) em ${r.dur}ms).`,
				);
				lines.push(
					r.hidden
						? 'Causa provável: preview oculto/em segundo plano (rAF suspenso pelo navegador). Ative o projeto na tela e meça de novo.'
						: 'Causa provável: loop de animação travado ou página congelada — confira com console_logs e wait_for_errors.',
				);
			} else {
				lines.push(
					`FPS: média ${f1(fpsAvg)} · mínimo instantâneo ${f1(fpsLow)} (${r.samples} quadros em ${r.dur}ms)`,
				);
				lines.push(
					`Frame time: média ${f1(r.avg)}ms · mediana ${f1(r.med)}ms · p95 ${f1(r.p95)}ms · pior ${f1(r.worst)}ms`,
				);
				lines.push('Travadas (quadro >2x a mediana ou >33.5ms): ' + r.stut);
				lines.push(
					'Long tasks (>50ms): ' +
						r.lt +
						(r.lt ? ` · total ${Math.round(r.ltMs)}ms · maior ${Math.round(r.ltMax)}ms` : ''),
				);
				lines.push(
					'Memória JS: ' +
						(r.mem ? mvSize(r.mem[0]) + ' de ' + mvSize(r.mem[1]) : 'n/d neste navegador'),
				);
				lines.push(`DOM: ${r.nodes} nós · ${r.canvases} canvas`);
				let v;
				if (fpsAvg >= 55 && r.stut <= 1) v = 'EXCELENTE — 60 FPS estável';
				else if (fpsAvg >= 55)
					v = `BOM — 60 FPS de média, mas com ${r.stut} travada(s); investigue as long tasks`;
				else if (fpsAvg >= 28) v = `MEDIANO — ~${Math.round(fpsAvg)} FPS; jogável mas não fluido`;
				else v = `RUIM — ~${Math.round(fpsAvg)} FPS; otimize (menos objetos, draw calls e efeitos)`;
				lines.push(`Veredito: ${v}.`);
				if (r.hidden)
					lines.push(
						'Atenção: o preview estava oculto/em segundo plano — o navegador reduz o rAF e os números reais podem ser melhores. Ative o projeto para medir com precisão.',
					);
			}
			return `Performance de "${proj.name}" (${r.dur}ms de medição)${r.__headless ? ' [preview headless]' : ''}:\n${lines.join('\n')}`;
		},
	},
	{
		name: 'audio_status',
		title: 'Audição do agente: telemetria de áudio do preview',
		desc:
			'Ouça o projeto sem ouvir: intercepta WebAudio e as mídias audio/video desde o ' +
			'carregamento e devolve o que tocou e quando, volume real (RMS e pico medidos no destino ' +
			'do WebAudio), fontes de som disparadas, buffers decodificados, erros de mídia e ' +
			'bloqueios de autoplay, com histórico de eventos com timestamps. Use para verificar se a ' +
			'música/efeito realmente toca, se o som saiu após uma ação (combine com interact) e para ' +
			'diagnosticar silêncio (autoplay bloqueado, contexto suspenso, arquivo não encontrado).',
		schema: {
			type: 'object',
			properties: {
				duration_ms: {
					type: 'number',
					description: 'Janela de medição do volume RMS em ms (100-3000, padrão 400).',
				},
				max_log: {
					type: 'number',
					description: 'Quantos eventos recentes do histórico mostrar (1-60, padrão 25).',
				},
				project: { type: 'string', description: 'Nome ou id do projeto (padrão: ativo).' },
			},
		},
		run: async (a) => {
			const proj = mcpProj(a);
			const adur = Math.min(3000, Math.max(100, Number(a.duration_ms) || 400));
			const r = await visionCall(
				proj,
				'audio',
				{ duration_ms: adur, max_log: a.max_log },
				adur + 12000,
			);
			const L = [];
			L.push(
				`Áudio de "${proj.name}" (janela de ${r.dur}ms)${r.headless ? ' · preview headless' : ''}`,
			);
			const semNada =
				(!r.ctxs || !r.ctxs.length) &&
				(!r.media || !r.media.length) &&
				!r.plays &&
				!r.starts &&
				!r.decodes &&
				(!r.log || !r.log.length);
			if (semNada) {
				L.push(
					'Nenhuma atividade de áudio detectada até agora: nenhum AudioContext criado e nenhuma mídia audio/video tocada desde o carregamento.',
				);
				return L.join('\n');
			}
			let audivel = false;
			if (r.ctxs && r.ctxs.length) {
				L.push(`WebAudio: ${r.ctxs.length} contexto(s)`);
				r.ctxs.forEach((c, i) => {
					let ln = `  #${i}${1}: ${c.state} · ${c.sr}Hz · clock ${c.clock}s · RMS ${c.rms}`;
					if (c.rms > 0.005) audivel = true;
					if (c.state === 'suspended')
						ln += c.suspCreate
							? ' — SUSPENSO desde a criação (autoplay bloqueado: chame audioCtx.resume() no primeiro clique/tecla, ou use interact para simular o gesto)'
							: ' — suspenso (nenhum som sai até resume())';
					L.push(ln);
				});
				L.push(`  Fontes de som disparadas: ${r.starts} · buffers decodificados: ${r.decodes}`);
			}
			if (r.peak > 0.01) audivel = true;
			L.push(
				'Som audível AGORA: ' +
					(audivel ? `SIM (pico ${r.peak})` : 'não detectado nesta janela (RMS ~0)'),
			);
			if (r.media && r.media.length) {
				L.push(`Mídia (${r.media.length}):`);
				const ERRC = {
					1: 'carregamento abortado',
					2: 'erro de rede',
					3: 'falha ao decodificar',
					4: 'formato não suportado ou arquivo não encontrado',
				};
				r.media.forEach((m) => {
					let ln = `  ${m.tag} "${m.src}": `;
					if (m.err != null) ln += `ERRO ${m.err} (${ERRC[m.err] || 'desconhecido'})`;
					else
						ln +=
							(m.paused ? 'pausado' : 'tocando') +
							' em ' +
							m.time +
							's' +
							(m.dur != null ? `/${m.dur}s` : '') +
							' · volume ' +
							m.volume +
							(m.muted ? ' (MUDO)' : '') +
							(m.loop ? ' · loop' : '');
					L.push(ln);
				});
			}
			L.push(
				`Contadores: play() chamados: ${r.plays} · autoplay bloqueado: ${r.blocked} · erros: ${r.errors}`,
			);
			if (r.blocked > 0)
				L.push(
					`AUTOPLAY BLOQUEADO ${r.blocked} vez(es): o navegador exige gesto do usuário antes do som. Corrija \
tocando/retomando o áudio no primeiro clique ou tecla (use interact para simular e teste de novo).`,
				);
			if (r.log && r.log.length) {
				L.push(`Histórico (últimos ${r.log.length} de ${r.logTotal}):`);
				r.log.forEach((e) => L.push(`  +${e.t}ms ${e.type}${e.detail ? ' ' + e.detail : ''}`));
			}
			return L.join('\n');
		},
	},
	{
		name: 'query_dom',
		title: 'Inspecionar DOM do preview',
		desc:
			'Lê o DOM renderizado do preview em execução: texto visível da página (mode=text), HTML ' +
			'dos elementos que casam com um seletor CSS (mode=html) ou lista resumida com ' +
			'posição/tamanho de cada elemento (mode=list). Use para verificar se a UI foi ' +
			'renderizada como esperado. Funciona também com projeto não ativo (preview headless).',
		schema: {
			type: 'object',
			properties: {
				selector: {
					type: 'string',
					description: 'Seletor CSS (opcional; sem ele retorna o texto visível da página)',
				},
				mode: {
					type: 'string',
					enum: ['text', 'html', 'list'],
					description: 'Padrão: text sem seletor, html com seletor',
				},
				max_results: { type: 'integer', minimum: 1, maximum: 50 },
				max_chars: { type: 'integer', minimum: 200, maximum: 60000 },
				project: MCP_PROJECT_PROP,
			},
		},
		run: async (a) => {
			const proj = mcpProj(a);
			const r = await visionCall(
				proj,
				'dom',
				{ selector: a.selector, mode: a.mode, max_results: a.max_results, max_chars: a.max_chars },
				12000,
			);
			return (
				(r.count != null ? `Elementos encontrados: ${r.count}\n\n` : '') + (r.text || '(vazio)')
			);
		},
	},
	{
		name: 'interact',
		title: 'Interagir com o preview',
		desc:
			'Simula interação de usuário no preview: cliques (selector ou x/y), digitação (type), ' +
			'teclas (key com hold_ms; keydown/keyup para SEGURAR teclas), chord (acorde: segura keys ' +
			'juntas, ex. ["w","Shift"], e aperta press no meio — movimento real de jogos), ' +
			'drag/touch_drag (arrasto com mouse ou dedo, linear ou com trajetória via path=[[x,y],' +
			'...] — peças, sliders, joystick virtual), look (mira relativa: dx/dy divididos em ' +
			'vários movementX/Y — FPS e câmeras orbitais; o pointer lock é EMULADO automaticamente ' +
			'quando o jogo chama requestPointerLock, ou force com pointer_lock/pointer_unlock), tap ' +
			'(toque mobile), pinch (pinça de zoom com 2 dedos: start_dist/end_dist ou scale), wheel ' +
			'(scroll/zoom com delta_y), move com dx/dy (1 movimento relativo), gamepad virtual ' +
			'(buttons {"0":true}/axes [x,y]; com hold_ms solta sozinho), scroll e pausas (wait). Os ' +
			'steps rodam em ordem; screenshot_after=true já devolve a imagem do resultado. Funciona ' +
			'também com projeto não ativo (preview headless).',
		schema: {
			type: 'object',
			properties: {
				steps: {
					type: 'array',
					description: 'Passos executados em ordem',
					items: {
						type: 'object',
						properties: {
							action: {
								type: 'string',
								enum: [
									'click',
									'dblclick',
									'type',
									'key',
									'keydown',
									'keyup',
									'chord',
									'scroll',
									'move',
									'look',
									'drag',
									'touch_drag',
									'tap',
									'pinch',
									'wheel',
									'gamepad',
									'pointer_lock',
									'pointer_unlock',
									'wait',
								],
								description: 'Tipo do passo',
							},
							selector: {
								type: 'string',
								description: 'Seletor CSS do alvo/origem (click/type/scroll/drag/wheel)',
							},
							x: {
								type: 'number',
								description: 'Coordenada X (click/move/drag/wheel sem selector)',
							},
							y: { type: 'number', description: 'Coordenada Y' },
							to_selector: { type: 'string', description: 'drag: seletor CSS do destino' },
							to_x: { type: 'number', description: 'drag: X do destino' },
							to_y: { type: 'number', description: 'drag: Y do destino' },
							move_steps: {
								type: 'integer',
								description: 'drag: quantidade de movimentos intermediários (3-40, padrão 12)',
							},
							text: { type: 'string', description: 'Texto (type)' },
							key: {
								type: 'string',
								description: 'Tecla (key/keydown/keyup), ex.: ArrowLeft, Enter, w, espaço=" "',
							},
							hold_ms: {
								type: 'integer',
								description:
									'key: segurar a tecla por N ms (máx 3000). chord: duração do acorde (padrão 400, máx 5000). gamepad: solta botões/eixos sozinho após N ms.',
							},
							dx: {
								type: 'number',
								description:
									'move/look: movementX sintético (mira em jogos; look divide em vários passos suaves)',
							},
							dy: { type: 'number', description: 'move/look: movementY sintético' },
							delta_y: {
								type: 'number',
								description: 'wheel: deltaY (padrão 120; negativo = zoom in)',
							},
							delta_x: { type: 'number', description: 'wheel: deltaX' },
							pad_index: {
								type: 'integer',
								description: 'gamepad: índice do controle (0-3, padrão 0)',
							},
							buttons: {
								type: 'object',
								description:
									'gamepad: mapa índice->estado, ex.: {"0":true,"7":0.8} (true/false ou 0-1)',
							},
							axes: {
								type: 'array',
								items: { type: 'number' },
								description: 'gamepad: eixos -1 a 1, ex.: [1,0] = stick direita',
							},
							ms: {
								type: 'integer',
								description:
									'wait: pausa em ms (máx 5000); drag/touch_drag/pinch/look: duração do gesto; tap: tempo do toque',
							},
							path: {
								type: 'array',
								items: { type: 'array', items: { type: 'number' } },
								description:
									'drag/touch_drag: trajetória [[x,y],[x,y],...] percorrida em ordem (até 30 pontos)',
							},
							keys: {
								type: 'array',
								items: { type: 'string' },
								description: 'chord: teclas seguradas juntas, ex.: ["w","Shift"]',
							},
							press: {
								type: 'array',
								items: { type: 'string' },
								description:
									'chord: teclas apertadas (down+up) enquanto o acorde está seguro, ex.: [" "]',
							},
							start_dist: {
								type: 'number',
								description: 'pinch: distância inicial entre os dedos em px (padrão 200)',
							},
							end_dist: {
								type: 'number',
								description: 'pinch: distância final (menor que start = zoom out)',
							},
							scale: {
								type: 'number',
								description: 'pinch: alternativa a end_dist (end = start*scale; >1 abre, <1 fecha)',
							},
							angle: {
								type: 'number',
								description: 'pinch: ângulo dos dedos em graus (padrão 0 = horizontal)',
							},
							ctrl: { type: 'boolean' },
							shift: { type: 'boolean' },
							alt: { type: 'boolean' },
						},
						required: ['action'],
					},
				},
				screenshot_after: {
					type: 'boolean',
					description: 'Retornar um screenshot após executar os passos',
				},
				project: MCP_PROJECT_PROP,
			},
			required: ['steps'],
		},
		run: async (a) => {
			const proj = mcpProj(a);
			if (!Array.isArray(a.steps) || !a.steps.length) throw new Error('Informe steps.');
			if (a.steps.length > 40) throw new Error('Máximo de 40 steps por chamada.');
			const r = await visionCall(proj, 'interact', { steps: a.steps }, interactBudget(a.steps));
			const text = `Interação concluída${r.__headless ? ' (preview headless)' : ''}:\n${r.text || 'ok'}`;
			if (a.screenshot_after) {
				const s = await visionCall(proj, 'screenshot', {}, 20000);
				const m = String(s.dataUrl || '').match(/^data:(image\/[a-z+]+);base64,(.+)$/);
				if (m)
					return {
						__content: [
							{ type: 'image', data: m[2], mimeType: m[1] },
							{ type: 'text', text: text + (s.warn ? '\nAviso do screenshot: ' + s.warn : '') },
						],
					};
			}
			return text;
		},
	},
	{
		name: 'eval_js',
		title: 'Executar JS no preview',
		desc:
			'Executa uma expressão JavaScript dentro do preview em execução e retorna o resultado ' +
			'serializado (aguarda Promises). Útil para inspecionar o estado do app/jogo (ex.: ' +
			'player.position, score, document.title) sem editar arquivos. Funciona também com ' +
			'projeto não ativo (preview headless).',
		schema: {
			type: 'object',
			properties: {
				code: {
					type: 'string',
					description: 'Expressão/código JS a executar no contexto do preview',
				},
				project: MCP_PROJECT_PROP,
			},
			required: ['code'],
		},
		run: async (a) => {
			const proj = mcpProj(a);
			if (!String(a.code || '').trim()) throw new Error('Informe code.');
			const r = await visionCall(proj, 'eval', { code: String(a.code) }, 12000);
			return 'Resultado:\n' + (r.text == null ? 'undefined' : r.text);
		},
	},
	{
		name: 'ui_map',
		title: 'Mapa de elementos interativos',
		desc:
			'Lista os elementos interativos VISÍVEIS do preview (botões, links, inputs, canvas…) com ' +
			'seletor CSS, coordenadas do centro @(x,y), tamanho, estado (disabled/focused) e texto — ' +
			'o "mapa de cliques" para usar com interact. Muito mais barato que screenshot para ' +
			'navegar pela UI. Funciona também com projeto não ativo (preview headless).',
		schema: {
			type: 'object',
			properties: {
				max_results: {
					type: 'integer',
					minimum: 1,
					maximum: 120,
					description: 'Máximo de elementos (padrão 60)',
				},
				project: MCP_PROJECT_PROP,
			},
		},
		run: async (a) => {
			const proj = mcpProj(a);
			const r = await visionCall(proj, 'ui_map', { max_results: a.max_results }, 12000);
			return `Elementos interativos visíveis: ${r.count || 0}${r.__headless ? ' (preview headless 1280x720)' : ''}\n${r.text || ''}`;
		},
	},
	{
		name: 'wait_for',
		title: 'Esperar condição no preview',
		desc:
			'Espera ativa até uma condição ficar verdadeira no preview: um seletor CSS existir e ' +
			'estar visível (ou sumir, com hidden=true) OU uma expressão JS (js) retornar truthy. Use ' +
			'SEMPRE no lugar de waits cegos antes de capturar/interagir/verificar. Retorna o tempo ' +
			'decorrido; em timeout descreve o último estado observado. Funciona também com projeto ' +
			'não ativo (preview headless).',
		schema: {
			type: 'object',
			properties: {
				selector: {
					type: 'string',
					description: 'Seletor CSS que deve aparecer (ou sumir com hidden=true)',
				},
				hidden: { type: 'boolean', description: 'true = esperar o seletor sumir/ficar oculto' },
				js: {
					type: 'string',
					description: 'Expressão JS que deve retornar truthy (alternativa ao selector)',
				},
				timeout_ms: {
					type: 'integer',
					minimum: 100,
					maximum: 20000,
					description: 'Tempo máximo (padrão 8000)',
				},
				project: MCP_PROJECT_PROP,
			},
		},
		run: async (a) => {
			const proj = mcpProj(a);
			if (!a.selector && !String(a.js || '').trim()) throw new Error('Informe selector ou js.');
			const budget = Math.min(20000, Math.max(100, Number(a.timeout_ms) || 8000));
			const r = await visionCall(
				proj,
				'wait_for',
				{ selector: a.selector, hidden: a.hidden, js: a.js, timeout_ms: budget },
				budget + 5000,
			);
			return r.text;
		},
	},
	{
		name: 'assert_state',
		title: 'Verificar estado (assert)',
		desc:
			'Avalia uma expressão JS no preview com retry automático até timeout_ms e responde PASS ' +
			'ou FAIL com o valor observado; em FAIL anexa um screenshot automático do momento da ' +
			'falha. É a base para testes autônomos (ex.: js="score>0", ' +
			'js="document.querySelectorAll(\'.card\').length===5"). Funciona também com projeto não ' +
			'ativo (preview headless).',
		schema: {
			type: 'object',
			properties: {
				js: { type: 'string', description: 'Expressão que deve retornar truthy para PASS' },
				timeout_ms: {
					type: 'integer',
					minimum: 0,
					maximum: 10000,
					description: 'Janela de retry (padrão 1500)',
				},
				label: { type: 'string', description: 'Rótulo do teste (aparece no resultado)' },
				project: MCP_PROJECT_PROP,
			},
			required: ['js'],
		},
		run: async (a) => {
			const proj = mcpProj(a);
			if (!String(a.js || '').trim()) throw new Error('Informe js.');
			const r = await visionCall(
				proj,
				'assert',
				{ js: String(a.js), timeout_ms: a.timeout_ms },
				16000,
			);
			const label = a.label ? String(a.label) + ': ' : '';
			if (r.pass) return label + 'PASS em ' + r.elapsed + 'ms — valor observado: ' + r.value;
			const out = [
				{
					type: 'text',
					text:
						label +
						'FAIL após ' +
						r.elapsed +
						'ms — valor observado: ' +
						r.value +
						' (screenshot do momento da falha anexado)',
				},
			];
			try {
				const s = await visionCall(proj, 'screenshot', {}, 20000);
				const m = String(s.dataUrl || '').match(/^data:(image\/[a-z+]+);base64,(.+)$/);
				if (m) out.unshift({ type: 'image', data: m[2], mimeType: m[1] });
			} catch (e) {
				ignorarErro(e, 'run');
			}
			return { __content: out };
		},
	},
	{
		name: 'record_frames',
		title: 'Gravar frames (animação)',
		desc:
			'Captura uma sequência de 2-8 frames do preview com intervalo configurável e retorna as ' +
			'imagens em ordem — use para VER animação, física e movimento (ex.: conferir se o ' +
			'personagem anda, se a transição roda). Funciona também com projeto não ativo (headless; ' +
			'animações podem ficar mais lentas em segundo plano).',
		schema: {
			type: 'object',
			properties: {
				frames: {
					type: 'integer',
					minimum: 2,
					maximum: 8,
					description: 'Quantidade de frames (padrão 4)',
				},
				interval_ms: {
					type: 'integer',
					minimum: 50,
					maximum: 2000,
					description: 'Intervalo entre frames (padrão 250)',
				},
				max_width: {
					type: 'integer',
					minimum: 160,
					maximum: 1024,
					description: 'Largura de cada frame (padrão 640)',
				},
				selector: { type: 'string', description: 'Opcional: canvas/elemento específico' },
				project: MCP_PROJECT_PROP,
			},
		},
		run: async (a) => {
			const proj = mcpProj(a);
			const r = await visionCall(
				proj,
				'frames',
				{
					frames: a.frames,
					interval_ms: a.interval_ms,
					max_width: a.max_width,
					selector: a.selector,
					mode: a.mode,
				},
				35000,
			);
			const content = [];
			for (const du of r.frames || []) {
				const m = String(du || '').match(/^data:(image\/[a-z+]+);base64,(.+)$/);
				if (m) content.push({ type: 'image', data: m[2], mimeType: m[1] });
			}
			if (!content.length) throw new Error('Nenhum frame capturado.');
			content.push({
				type: 'text',
				text:
					content.length +
					' frames de "' +
					proj.name +
					'" a cada ' +
					(r.interval || '?') +
					'ms (' +
					(r.mode === 'canvas' ? 'canvas do jogo/WebGL' : 'DOM rasterizado') +
					', ' +
					r.w +
					'x' +
					r.h +
					').' +
					(r.__headless ? ' [preview headless]' : '') +
					(r.warn ? ' Aviso: ' + r.warn : ''),
			});
			return { __content: content };
		},
	},
	{
		name: 'run_scenario',
		title: 'Rodar cenário de teste autônomo',
		desc:
			'Executa um TESTE COMPLETO em 1 chamada: lista de passos onde cada item tem interact ' +
			'(array de steps de interação), wait_for ({selector|js,timeout_ms,hidden}) ou assert ' +
			'(expressão JS), com label opcional. Para no primeiro FAIL, anexa screenshot do momento ' +
			'da falha e devolve relatório passo a passo + screenshot final. É a forma mais eficiente ' +
			'de testar sem humano — prefira isto a várias chamadas soltas. Funciona também com ' +
			'projeto não ativo (preview headless).',
		schema: {
			type: 'object',
			properties: {
				scenario: {
					type: 'array',
					description: 'Passos do teste, executados em ordem (máx 25)',
					items: {
						type: 'object',
						properties: {
							label: { type: 'string', description: 'Nome do passo no relatório' },
							interact: {
								type: 'array',
								description: 'Steps de interação (mesmo formato da ferramenta interact)',
								items: { type: 'object' },
							},
							wait_for: { type: 'object', description: '{selector?, hidden?, js?, timeout_ms?}' },
							assert: { type: 'string', description: 'Expressão JS que deve ser truthy' },
							timeout_ms: {
								type: 'integer',
								description: 'Timeout do wait_for/assert deste passo',
							},
						},
					},
				},
				screenshot_final: {
					type: 'boolean',
					description: 'Anexar screenshot ao final (padrão true)',
				},
				project: MCP_PROJECT_PROP,
			},
			required: ['scenario'],
		},
		run: async (a) => {
			const proj = mcpProj(a);
			const sc = Array.isArray(a.scenario) ? a.scenario : [];
			if (!sc.length) throw new Error('Informe scenario (lista de passos).');
			if (sc.length > 25) throw new Error('Máximo de 25 passos por cenário.');
			const report = [];
			let failed = null;
			let failShot = null;
			for (let i = 0; i < sc.length; i++) {
				const st = sc[i] || {};
				const label = st.label || `passo ${i}${1}`;
				try {
					if (Array.isArray(st.interact) && st.interact.length) {
						const r = await visionCall(
							proj,
							'interact',
							{ steps: st.interact },
							interactBudget(st.interact),
						);
						report.push(
							`✔ ${label} (interact):\n   ${String(r.text || 'ok')
								.split('\n')
								.join('\n   ')}`,
						);
					} else if (st.wait_for && typeof st.wait_for === 'object') {
						const w = st.wait_for;
						const budget = Math.min(
							20000,
							Math.max(100, Number(w.timeout_ms || st.timeout_ms) || 8000),
						);
						const r = await visionCall(
							proj,
							'wait_for',
							{ selector: w.selector, hidden: w.hidden, js: w.js, timeout_ms: budget },
							budget + 5000,
						);
						report.push(`✔ ${label} (wait_for): ${r.text}`);
					} else if (st.assert && String(st.assert).trim()) {
						const r = await visionCall(
							proj,
							'assert',
							{ js: String(st.assert), timeout_ms: st.timeout_ms },
							16000,
						);
						if (r.pass) report.push(`✔ ${label} (assert PASS em ${r.elapsed}ms): ${r.value}`);
						else {
							report.push(
								`✘ ${label} (assert FAIL após ${r.elapsed}ms) — valor observado: ${r.value}`,
							);
							failed = label;
						}
					} else {
						report.push(`• ${label}: passo vazio (use interact, wait_for ou assert) — ignorado`);
					}
				} catch (e) {
					report.push(`✘ ${label}: ${(e && e.message) || e}`);
					failed = label;
				}
				if (failed) {
					try {
						const s = await visionCall(proj, 'screenshot', {}, 20000);
						const m = String(s.dataUrl || '').match(/^data:(image\/[a-z+]+);base64,(.+)$/);
						if (m) failShot = { type: 'image', data: m[2], mimeType: m[1] };
					} catch (e) {
						ignorarErro(e, 'run');
					}
					break;
				}
			}
			const done = report.length;
			const summary =
				(failed ? `FAIL no passo "${failed}"` : 'PASS') +
				' — ' +
				done +
				' de ' +
				sc.length +
				' passo(s) executado(s) em "' +
				proj.name +
				'".\n\n' +
				report.join('\n');
			const content = [];
			if (failShot) content.push(failShot);
			else if (a.screenshot_final !== false) {
				try {
					const s = await visionCall(proj, 'screenshot', {}, 20000);
					const m = String(s.dataUrl || '').match(/^data:(image\/[a-z+]+);base64,(.+)$/);
					if (m) content.push({ type: 'image', data: m[2], mimeType: m[1] });
				} catch (e) {
					ignorarErro(e, 'run');
				}
			}
			content.push({ type: 'text', text: summary });
			return { __content: content };
		},
	},
	{
		name: 'start_dev_server',
		title: 'Iniciar dev server (preview real)',
		desc:
			'Inicia um dev server real (Vite, Next, CRA etc.) na pasta espelhada do projeto e ' +
			'conecta o preview ao relay via proxy, com hot-reload. Detect a porta automaticamente na ' +
			'saida (ou informe port). Enquanto roda, gravacoes de arquivos sao sincronizadas ' +
			'automaticamente. Use stop_dev_server para encerrar. Requer terminal e relay v9+.',
		schema: {
			type: 'object',
			properties: {
				command: { type: 'string', description: 'Comando (padrao: npm run dev)' },
				port: { type: 'integer', description: 'Porta do dev server' },
				wait_sec: { type: 'number', description: 'Segundos aguardando a porta (5-40, padrao 25)' },
				project: MCP_PROJECT_PROP,
			},
		},
		run: async (a) => {
			const cmd = String(a.command || 'npm run dev').trim();
			termAssertAllowed(cmd);
			const proj = mcpProj(a);
			const cur = DEV.map[proj.id];
			if (cur)
				throw new Error(
					cur.url
						? `Ja existe dev server para "${proj.name}" (${cur.url}). Use stop_dev_server antes.`
						: `Dev server ja iniciado para "${proj.name}". Use dev_server_status ou stop_dev_server.`,
				);
			termOpen(true);
			const procId = await termStart(proj, cmd, 'agent');
			let port = Math.floor(Number(a.port) || 0) || null;
			let out = '';
			let ended = false;
			let code = null;
			const until = Date.now() + Math.max(5, Math.min(40, Number(a.wait_sec) || 25)) * 1000;
			while (Date.now() < until) {
				const st = await termApi('out', { procId: procId, from: 0 });
				out = st.text || '';
				if (st.done) {
					ended = true;
					code = st.code;
					break;
				}
				if (!port) port = devScanPort(out);
				if (port) break;
				await (window.bgEspera ? window.bgEspera(700) : new Promise((r) => setTimeout(r, 700)));
			}
			const tail = out.slice(-1800);
			if (ended)
				throw new Error(
					`Comando terminou (codigo ${code}) antes de virar dev server. Verifique dependencias. Saida:\n${tail}`,
				);
			if (!port) {
				DEV.map[proj.id] = { procId: procId, port: null, url: null, t: Date.now() };
				return `Dev server iniciado (proc ${procId}), porta nao detectada ainda. Chame dev_server_status. Saida:\n${tail}`;
			}
			const url = await devRegister(proj, procId, port);
			return `Dev server conectado! proc ${procId} porta ${port}\nPreview: ${url}\nUse stop_dev_server para encerrar. Saida:\n${tail}`;
		},
	},
	{
		name: 'dev_server_status',
		title: 'Status do dev server',
		desc: 'Status do dev server do projeto. Tenta conectar se a porta nao foi detectada ainda.',
		schema: { type: 'object', properties: { project: MCP_PROJECT_PROP } },
		run: async (a) => {
			termAssertAllowed();
			const proj = mcpProj(a);
			const dvi = DEV.map[proj.id];
			if (!dvi) return `Nenhum dev server para "${proj.name}". Use start_dev_server.`;
			const st = await termApi('out', { procId: dvi.procId, from: 0 });
			const tail = (st.text || '').slice(-1800);
			if (st.done) {
				delete DEV.map[proj.id];
				try {
					await termApi('devunreg', { project: termProjName(proj) });
				} catch (_e) {
					ignorarErro(_e, 'run');
				}
				if (proj.id === State.active) buildPreview(proj);
				return `Dev server terminou (codigo ${st.code}). Preview voltou ao normal. Saida:\n${tail}`;
			}
			if (!dvi.url) {
				const p = devScanPort(st.text || '');
				if (p) {
					const url = await devRegister(proj, dvi.procId, p);
					return `Porta ${p} detectada: ${url}\nSaida:\n${tail}`;
				}
				return `Rodando (proc ${dvi.procId}), porta nao detectada. Saida:\n${tail}`;
			}
			return `Rodando: proc ${dvi.procId} porta ${dvi.port} preview: ${dvi.url}\nSaida:\n${tail}`;
		},
	},
	{
		name: 'stop_dev_server',
		title: 'Parar dev server',
		desc: 'Encerra o dev server, remove o proxy no relay e volta o preview ao modo normal.',
		schema: { type: 'object', properties: { project: MCP_PROJECT_PROP } },
		run: async (a) => {
			termAssertAllowed();
			const proj = mcpProj(a);
			const dvi = DEV.map[proj.id];
			if (!dvi) return `Nenhum dev server ativo para "${proj.name}".`;
			try {
				await termApi('kill', { procId: dvi.procId });
			} catch (_e) {
				ignorarErro(_e, 'run');
			}
			try {
				await termApi('devunreg', { project: termProjName(proj) });
			} catch (_e) {
				ignorarErro(_e, 'run');
			}
			clearTimeout(dvi.syncT);
			delete DEV.map[proj.id];
			logCmd(proj, '■ Dev server encerrado.');
			if (proj.id === State.active) buildPreview(proj);
			return `Dev server encerrado (proc ${dvi.procId}). Preview voltou ao normal.`;
		},
	},
	{
		name: 'export_zip',
		title: 'Exportar projeto como .zip',
		desc: 'Gera o .zip do projeto no browser e dispara o download. Funciona sem terminal e sem relay.',
		schema: { type: 'object', properties: { project: MCP_PROJECT_PROP } },
		run: async (a) => {
			const proj = mcpProj(a);
			const items = projectZipItems(proj);
			if (!items.length) return 'Projeto vazio.';
			const blob = await buildZip(items);
			const fname = safeZipName(proj.name);
			const url2 = URL.createObjectURL(blob);
			try {
				const a2 = document.createElement('a');
				a2.href = url2;
				a2.download = fname;
				a2.rel = 'noopener';
				document.body.appendChild(a2);
				a2.click();
				a2.remove();
			} catch (_e) {
				ignorarErro(_e, 'run');
			}
			logCmd(
				proj,
				`📦 Exportado "${fname}" (${items.length} arquivo(s), ${mvSize(blob.size)}). Verifique Downloads.`,
			);
			setTimeout(() => {
				try {
					URL.revokeObjectURL(url2);
				} catch (_e) {
					ignorarErro(_e, 'run');
				}
			}, 600000);
			return `Download iniciado: ${fname} (${mvSize(blob.size)}, ${items.length} arquivo(s)).`;
		},
	},
	{
		name: 'deploy_static',
		title: 'Publicar site estatico (relay)',
		desc: 'Publica os arquivos como site estatico servido pelo relay. URL estavel enquanto o relay rodar. Requer terminal e relay v9+.',
		schema: { type: 'object', properties: { project: MCP_PROJECT_PROP } },
		run: async (a) => {
			termAssertAllowed();
			const proj = mcpProj(a);
			const files = [];
			for (const [p, f] of proj.files) {
				if (f.text != null) files.push({ path: p, text: f.text });
				else if (f.data != null) {
					try {
						files.push({ path: p, b64: btoa(String.fromCharCode(...new Uint8Array(f.data))) });
					} catch (_e) {
						ignorarErro(_e, 'run');
					}
				}
			}
			if (!files.length) return 'Projeto vazio.';
			const r = await termApi('deploystart', { project: termProjName(proj), files: files });
			const url2 = termBase() + r.url;
			DEP.map[proj.id] = { key: r.key, url: url2 };
			logCmd(proj, '🌐 Site publicado: ' + url2);
			return `Site publicado!\nURL: ${url2}\nAcesse enquanto o relay rodar. Use undeploy_static para encerrar.`;
		},
	},
	{
		name: 'undeploy_static',
		title: 'Remover site estatico',
		desc: 'Remove o deploy estatico do relay.',
		schema: { type: 'object', properties: { project: MCP_PROJECT_PROP } },
		run: async (a) => {
			termAssertAllowed();
			const proj = mcpProj(a);
			const dep = DEP.map[proj.id];
			if (!dep) return `Nenhum deploy ativo para "${proj.name}".`;
			try {
				await termApi('deploystop', { project: termProjName(proj) });
			} catch (_e) {
				ignorarErro(_e, 'run');
			}
			delete DEP.map[proj.id];
			logCmd(proj, 'Deploy removido.');
			return `Deploy encerrado. URL "${dep.url}" nao esta mais disponivel.`;
		},
	},
	{
		name: 'run_command',
		title: 'Executar comando (terminal)',
		desc:
			'Executa um comando de terminal real (npm, node, builds etc.) na pasta espelhada do ' +
			'projeto, no computador do usuário (via relay). O projeto é sincronizado para o disco ' +
			'antes de rodar e, ao terminar, arquivos criados/alterados voltam para o editor e o ' +
			'preview atualiza. Aguarda a conclusão por até wait_sec; se não terminar, devolve um ' +
			'proc_id para acompanhar com command_output. Requer que o usuário permita o terminal no ' +
			'menu MCP.',
		schema: {
			type: 'object',
			properties: {
				command: { type: 'string', description: 'Comando a executar (ex.: npm install three)' },
				project: MCP_PROJECT_PROP,
				wait_sec: {
					type: 'number',
					description: 'Segundos de espera pela conclusão (1-15, padrão 15)',
				},
			},
			required: ['command'],
		},
		run: async (a) => {
			const cmd = String(a.command || '').trim();
			if (!cmd) throw new Error('Informe o comando em command.');
			termAssertAllowed(cmd);
			const proj = mcpProj(a);
			termOpen(true);
			const procId = await termStart(proj, cmd, 'agent');
			const r = await termWait(
				proj,
				procId,
				Math.max(1, Math.min(15, Number(a.wait_sec) || 15)) * 1000,
			);
			return termReport(r, procId);
		},
	},
	{
		name: 'command_output',
		title: 'Saída do comando',
		desc: 'Acompanha um comando iniciado por run_command que ainda estava em execução: retorna a saída acumulada e o status. Chame repetidamente (com wait_sec) até finalizar.',
		schema: {
			type: 'object',
			properties: {
				proc_id: { type: 'string', description: 'proc_id retornado por run_command' },
				project: MCP_PROJECT_PROP,
				wait_sec: { type: 'number', description: 'Segundos de espera (1-15, padrão 10)' },
			},
			required: ['proc_id'],
		},
		run: async (a) => {
			termAssertAllowed();
			const proj = mcpProj(a);
			const procId = String(a.proc_id || '').trim();
			if (!procId) throw new Error('Informe proc_id.');
			const r = await termWait(
				proj,
				procId,
				Math.max(1, Math.min(15, Number(a.wait_sec) || 10)) * 1000,
			);
			return termReport(r, procId);
		},
	},
	{
		name: 'stop_command',
		title: 'Parar comando',
		desc: 'Encerra um comando em execução iniciado por run_command (equivalente a forçar Ctrl+C).',
		schema: {
			type: 'object',
			properties: { proc_id: { type: 'string' }, project: MCP_PROJECT_PROP },
			required: ['proc_id'],
		},
		run: async (a) => {
			termAssertAllowed();
			await termApi('kill', { procId: String(a.proc_id || '') });
			return `Comando ${a.proc_id} finalizado.`;
		},
	},
	{
		name: 'add_asset_from_url',
		title: 'Adicionar asset por URL',
		desc:
			'Baixa um arquivo (glb, gltf, png, jpg, mp4, ogg, mp3, wasm etc.) de uma URL publica e ' +
			'salva no projeto como asset, ja integrado ao preview (referencie pelo caminho relativo, ' +
			'ex.: assets/modelo.glb). O download e feito pelo relay no PC do usuario (sem restricao ' +
			'de CORS). Sobrescreve se o caminho ja existir. Limite: 25MB.',
		schema: {
			type: 'object',
			properties: {
				url: { type: 'string', description: 'URL publica http(s) do arquivo' },
				path: {
					type: 'string',
					description: 'Caminho de destino no projeto (ex.: assets/modelo.glb)',
				},
				project: MCP_PROJECT_PROP,
			},
			required: ['url', 'path'],
		},
		run: async (a) => {
			const proj = mcpProj(a);
			const path = mcpNorm(a.path);
			if (!/^https?:\/\//i.test(String(a.url || ''))) throw new Error('URL invalida: use http(s).');
			if (!/^https?:\/\//i.test(mcpBase()) && !termBase())
				throw new Error(
					'Nem a nuvem nem o complemento local estao configurados (o download e feito por eles).',
				);
			const r = await termApi('fetchurl', { url: String(a.url) });
			const bytes = b64ToBytes(r.b64);
			const f = makeFileEntry(path, bytes);
			proj.files.set(path, f);
			mcpAfterWrite(proj, path);
			return `Asset salvo: ${path} (${mvSize(bytes.length)}${r.mime ? ' · ' + r.mime : ''}${f.isText ? ' · detectado como texto' : ' · binario'}). \
Ja disponivel no preview pelo caminho relativo.`;
		},
	},
	{
		name: 'add_asset_base64',
		title: 'Adicionar asset (base64)',
		desc:
			'Salva um arquivo no projeto a partir de conteudo base64 puro (aceita tambem data URI). ' +
			'Para arquivos pequenos (ate ~5MB); para arquivos hospedados na web prefira ' +
			'add_asset_from_url. Sobrescreve se o caminho ja existir.',
		schema: {
			type: 'object',
			properties: {
				path: { type: 'string', description: 'Caminho de destino (ex.: assets/icone.png)' },
				base64: { type: 'string', description: 'Conteudo em base64 (sem quebras) ou data URI' },
				project: MCP_PROJECT_PROP,
			},
			required: ['path', 'base64'],
		},
		run: async (a) => {
			const proj = mcpProj(a);
			const path = mcpNorm(a.path);
			let s = String(a.base64 || '').trim();
			const di = s.indexOf('base64,');
			if (di >= 0) s = s.slice(di + 7);
			s = s.replace(/\s+/g, '');
			if (!s) throw new Error('base64 vazio.');
			if (s.length > 7 * 1024 * 1024)
				throw new Error('Grande demais para base64 (limite ~5MB). Use add_asset_from_url.');
			let bytes;
			try {
				bytes = b64ToBytes(s);
			} catch (e) {
				throw new Error('base64 invalido.');
			}
			const f = makeFileEntry(path, bytes);
			proj.files.set(path, f);
			mcpAfterWrite(proj, path);
			return `Asset salvo: ${path} (${mvSize(bytes.length)}${f.isText ? ' · texto' : ' · binario'}). Ja disponivel no preview.`;
		},
	},
	{
		name: 'model3d_list',
		title: 'Estudio 3D: listar modelos',
		desc:
			'ESTUDIO 3D (menu interno para agentes): lista os modelos 3D do projeto (.glb, .gltf, ' +
			'.obj, .stl, .fbx) com tamanho e o estado salvo (pivot/escala/rotacao/bake) de ' +
			'aurora.3d.json. Comece por aqui antes de inspect/set_pivot.',
		schema: { type: 'object', properties: { project: MCP_PROJECT_PROP } },
		run: async (a) => {
			const proj = mcpProj(a);
			const meta = est3dMeta(proj);
			const out = [];
			for (const [path, f] of proj.files) {
				const ext = (Core.extname(path) || '').toLowerCase();
				if (!is3DExt(ext)) continue;
				const st = meta.models[path];
				let extra = '';
				if (st)
					extra =
						' | pivot [' +
						(st.pivot || [0, 0, 0])
							.map(function (v) {
								return +(+v).toFixed(4);
							})
							.join(', ') +
						'] m' +
						(st.scale && st.scale !== 1 ? ' | escala x' + st.scale : '') +
						((st.rotation || []).some(function (v) {
							return v;
						})
							? ` | rot [${st.rotation.join(', ')}] graus`
							: '') +
						(st.applied ? ' | bake aplicado' : '');
				out.push(
					`- ${path} (${ext.slice(1).toUpperCase()} | ${mvSize(mcpSize(f))})${ext === '.fbx' ? ' — use model3d_convert para poder inspecionar' : ''}${extra}`,
				);
			}
			return out.length
				? `Modelos 3D em ${proj.name}:\n${out.join('\n')}\n\nUse model3d_inspect para receber a ficha tecnica (imagem com 7 vistas + reguas + pivot).`
				: 'Nenhum modelo 3D neste projeto (.glb, .gltf, .obj, .stl, .fbx).';
		},
	},
	{
		name: 'model3d_inspect',
		title: 'Estudio 3D: ficha tecnica',
		desc:
			'ESTUDIO 3D: devolve UMA imagem (ficha tecnica) do modelo em ate 7 vistas (frente, tras, ' +
			'esquerda, direita, topo, baixo, perspectiva 3/4) com reguas exatas nas 4 bordas de cada ' +
			'vista na unidade escolhida, grade no chao, marcador do pivot com gizmo XYZ e painel ' +
			'INFO — mais as medidas exatas em texto. Use para ganhar nocao de escala/espaco antes de ' +
			'posicionar o modelo no jogo.',
		schema: {
			type: 'object',
			properties: {
				path: { type: 'string', description: 'Caminho do modelo (ex.: assets/porta.glb)' },
				unit: {
					type: 'string',
					description: 'Unidade das reguas: m, cm, mm, stud, ft, in (padrao: m ou a ultima usada)',
				},
				views: {
					type: 'array',
					items: { type: 'string' },
					description:
						'Subconjunto de vistas: frente, tras, esquerda, direita, topo, baixo, perspectiva (padrao: todas)',
				},
				show_grid: { type: 'boolean', description: 'Mostrar grade (padrao true)' },
				show_pivot: { type: 'boolean', description: 'Mostrar pivot (padrao true)' },
				stud_m: {
					type: 'number',
					description:
						'Tamanho de 1 stud em metros (padrao 0,28 — Roblox; LEGO ~0,008). Fica salvo no projeto para as proximas chamadas',
				},
				format: { type: 'string', description: 'jpeg (padrao) ou png' },
				project: MCP_PROJECT_PROP,
			},
			required: ['path'],
		},
		run: async (a) => {
			const proj = mcpProj(a);
			est3dStud(proj, a);
			const sheet = est3dRenderSheet(proj, a.path, {
				unit: a.unit,
				views: a.views,
				show_grid: a.show_grid,
				show_pivot: a.show_pivot,
				format: a.format,
			});
			return est3dContent(sheet, est3dText(sheet));
		},
	},
	{
		name: 'model3d_set_pivot',
		title: 'Estudio 3D: definir pivot',
		desc:
			'ESTUDIO 3D: define o pivot do modelo e devolve a imagem atualizada com o pivot marcado ' +
			'em todas as vistas para voce validar. Modos (use exatamente UM): preset (origem, centro,' +
			' base-centro, topo-centro, dobradica-esquerda, dobradica-direita, dobradica-topo, ' +
			'edge-left-bottom, edge-right-bottom, edge-front-bottom, edge-back-bottom, canto-min, ' +
			'canto-max), position {x,y,z} na unidade escolhida no espaco do arquivo, normalized {x,y,' +
			'z} de 0 a 1 dentro do bbox, ou delta {x,y,z} relativo ao pivot atual. O pivot fica ' +
			'salvo em aurora.3d.json; use model3d_apply para gravar no arquivo real. Ex.: porta — ' +
			'preset dobradica-esquerda.',
		schema: {
			type: 'object',
			properties: {
				path: { type: 'string' },
				preset: { type: 'string' },
				position: {
					type: 'object',
					properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
					required: ['x', 'y', 'z'],
				},
				normalized: {
					type: 'object',
					properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
					required: ['x', 'y', 'z'],
				},
				delta: {
					type: 'object',
					properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
					required: ['x', 'y', 'z'],
				},
				unit: {
					type: 'string',
					description:
						'Unidade de position/delta e das reguas. Padrao SEMPRE m para coordenadas (nao herda a unidade anterior)',
				},
				stud_m: { type: 'number' },
				agent: { type: 'string', description: 'Seu nome de agente (feed de atividade)' },
				project: MCP_PROJECT_PROP,
			},
			required: ['path'],
		},
		run: async (a) => {
			const proj = mcpProj(a);
			est3dStud(proj, a);
			const m = est3dLoad(proj, a.path);
			const st = est3dState(proj, m.path);
			const u = u3dGet(a.unit || 'm');
			const uDisp = u3dGet(a.unit || st.unit || 'm');
			const modes = ['preset', 'position', 'normalized', 'delta'].filter(function (k) {
				return a[k] != null;
			});
			if (modes.length !== 1)
				throw new Error('Informe exatamente UM modo: preset, position, normalized ou delta.');
			function vec(o) {
				const r = [Number(o && o.x), Number(o && o.y), Number(o && o.z)];
				if (
					r.some(function (v) {
						return !isFinite(v);
					})
				)
					throw new Error('Coordenadas invalidas: informe numeros em x, y e z.');
				return r;
			}
			let pv;
			if (a.preset != null) {
				const P = est3dPresets(m.bboxMin, m.bboxMax);
				pv = P[String(a.preset).toLowerCase().trim()];
				if (!pv)
					throw new Error(
						`Preset desconhecido: ${a.preset}. Opcoes: origem, centro, base-centro, topo-centro, dobradica-esquerda, \
dobradica-direita, dobradica-topo, edge-left-bottom, edge-right-bottom, edge-front-bottom, edge-back-bottom, \
canto-min, canto-max.`,
					);
			} else if (a.position != null) {
				const v = vec(a.position);
				pv = [v[0] * u.f, v[1] * u.f, v[2] * u.f];
			} else if (a.normalized != null) {
				const v = vec(a.normalized);
				pv = [0, 1, 2].map(function (i) {
					return m.bboxMin[i] + v[i] * (m.bboxMax[i] - m.bboxMin[i]);
				});
			} else {
				const v = vec(a.delta);
				pv = [st.pivot[0] + v[0] * u.f, st.pivot[1] + v[1] * u.f, st.pivot[2] + v[2] * u.f];
			}
			let warn = '';
			for (let i = 0; i < 3; i++) {
				const tol = (m.bboxMax[i] - m.bboxMin[i]) * 0.001 + 1e-6;
				if (pv[i] < m.bboxMin[i] - tol || pv[i] > m.bboxMax[i] + tol) {
					warn =
						'\nAVISO: o pivot esta FORA do bounding box do modelo — confira na imagem se e intencional.';
					break;
				}
			}
			st.pivot = pv;
			st.unit = uDisp.key;
			st.applied = false;
			est3dPutState(proj, m.path, st, a.agent);
			const sheet = est3dRenderSheet(proj, m.path, { unit: uDisp.key });
			return est3dContent(
				sheet,
				`Pivot atualizado (${modes[0]}${a.preset ? ': ' + a.preset : ''}). Valide a posicao do marcador em todas as vistas.\n${est3dText(sheet)}${warn}`,
			);
		},
	},
	{
		name: 'model3d_transform',
		title: 'Estudio 3D: rotacionar/escalar',
		desc:
			'ESTUDIO 3D: aplica rotacao ou escala ao modelo (no estado do estudio; use model3d_apply ' +
			'para gravar no arquivo). Operacoes (use exatamente UMA): rotate {axis, degrees} ' +
			'(rotaciona em torno do pivot atual), scale (fator multiplicativo, ex.: 0.5), fit {axis, ' +
			'size, unit} (escala uniforme para o eixo atingir o tamanho exato — ex.: porta com ' +
			'altura 2,10 m: fit {axis:"y", size:2.1, unit:"m"}), reset=true (zera rotacao e escala). ' +
			'Devolve a imagem atualizada com as novas medidas.',
		schema: {
			type: 'object',
			properties: {
				path: { type: 'string' },
				rotate: {
					type: 'object',
					properties: {
						axis: { type: 'string', enum: ['x', 'y', 'z'] },
						degrees: { type: 'number' },
					},
					required: ['axis', 'degrees'],
				},
				scale: { type: 'number' },
				fit: {
					type: 'object',
					properties: {
						axis: { type: 'string', enum: ['x', 'y', 'z'] },
						size: { type: 'number' },
						unit: { type: 'string' },
					},
					required: ['axis', 'size'],
				},
				reset: { type: 'boolean' },
				unit: { type: 'string' },
				stud_m: { type: 'number' },
				agent: { type: 'string' },
				project: MCP_PROJECT_PROP,
			},
			required: ['path'],
		},
		run: async (a) => {
			const proj = mcpProj(a);
			est3dStud(proj, a);
			const m = est3dLoad(proj, a.path);
			const st = est3dState(proj, m.path);
			const modes = ['rotate', 'scale', 'fit', 'reset'].filter(function (k) {
				return a[k] != null && a[k] !== false;
			});
			if (modes.length !== 1)
				throw new Error(
					'Informe exatamente UMA operacao: rotate {axis,degrees}, scale (numero), fit {axis,size,unit} ou reset=true.',
				);
			let msg = '';
			if (a.rotate != null) {
				const ax = { x: 0, y: 1, z: 2 }[String(a.rotate.axis || '').toLowerCase()];
				const deg = Number(a.rotate.degrees);
				if (ax == null || !isFinite(deg))
					throw new Error('rotate exige axis (x|y|z) e degrees (numero).');
				st.rotation[ax] = (((st.rotation[ax] + deg) % 360) + 360) % 360;
				msg = `Rotacao aplicada: ${String(a.rotate.axis).toUpperCase()} ${deg} graus (acumulado: [${st.rotation.join(', ')}]).`;
				if (
					st.rotation.filter(function (v) {
						return v !== 0;
					}).length > 1
				)
					msg +=
						' Nota: rotacoes em eixos diferentes compoem na ordem Z*Y*X (nao na ordem das chamadas) — valide o resultado na imagem.';
			} else if (a.scale != null) {
				const f2 = Number(a.scale);
				if (!isFinite(f2) || f2 <= 0) throw new Error('scale deve ser um numero maior que 0.');
				const ns = st.scale * f2;
				if (ns < 1e-6 || ns > 1e6)
					throw new Error('Escala resultante fora do limite (1e-6 a 1e6).');
				st.scale = +ns.toPrecision(8);
				msg = `Escala aplicada: x${f2} (acumulada: x${st.scale}).`;
			} else if (a.fit != null) {
				const ax = { x: 0, y: 1, z: 2 }[String(a.fit.axis || '').toLowerCase()];
				const uf = u3dGet(a.fit.unit || a.unit || 'm');
				const size = Number(a.fit.size);
				if (ax == null || !isFinite(size) || size <= 0)
					throw new Error('fit exige axis (x|y|z) e size maior que 0.');
				const eff0 = est3dEffective(proj, m.path, st);
				const cur = eff0.dims[ax];
				const f3 = (size * uf.f) / cur;
				const ns = st.scale * f3;
				if (ns < 1e-6 || ns > 1e6)
					throw new Error('Escala resultante fora do limite (1e-6 a 1e6).');
				st.scale = +ns.toPrecision(8);
				msg = `Fit aplicado: eixo ${String(a.fit.axis).toUpperCase()} -> ${u3dFmt(size * uf.f, uf)} (fator x${+f3.toPrecision(6)}, escala acumulada x${st.scale}).`;
			} else {
				st.rotation = [0, 0, 0];
				st.scale = 1;
				msg = 'Rotacao e escala zeradas (pivot mantido).';
			}
			if (a.unit) st.unit = u3dGet(a.unit).key;
			st.applied = false;
			est3dPutState(proj, m.path, st, a.agent);
			const sheet = est3dRenderSheet(proj, m.path, { unit: st.unit || 'm' });
			return est3dContent(sheet, msg + '\n' + est3dText(sheet));
		},
	},
	{
		name: 'model3d_compare',
		title: 'Estudio 3D: comparar escala',
		desc:
			'ESTUDIO 3D: compara 2 a 4 modelos lado a lado NA MESMA ESCALA (vista frontal, base ' +
			'alinhada no chao), com regua vertical na unidade escolhida e silhueta humana de 1,75 m ' +
			'como referencia (human=false para ocultar). Ideal para conferir se predios, portas e ' +
			'objetos estao proporcionais entre si antes de montar a cena.',
		schema: {
			type: 'object',
			properties: {
				paths: {
					type: 'array',
					items: { type: 'string' },
					description: '2 a 4 caminhos de modelos',
				},
				unit: { type: 'string' },
				human: { type: 'boolean', description: 'Mostrar silhueta humana de 1,75 m (padrao true)' },
				stud_m: { type: 'number' },
				project: MCP_PROJECT_PROP,
			},
			required: ['paths'],
		},
		run: async (a) => {
			const proj = mcpProj(a);
			est3dStud(proj, a);
			const paths = Array.isArray(a.paths) ? a.paths : null;
			if (!paths || paths.length < 2 || paths.length > 4)
				throw new Error('Informe paths com 2 a 4 modelos.');
			const sheet = est3dCompareSheet(proj, paths, { unit: a.unit, human: a.human });
			const u = sheet.unit;
			const lines = sheet.effs.map(function (e) {
				return `- ${e.path}: L ${u3dFmt(e.dims[0], u)} x A ${u3dFmt(e.dims[1], u)} x P ${u3dFmt(e.dims[2], u)} | altura = ${(e.dims[1] / 1.75).toFixed(2)}x um humano de 1,75 m`;
			});
			return est3dContent(
				sheet,
				'Comparacao na MESMA escala (vista frontal, bases alinhadas no chao):\n' + lines.join('\n'),
			);
		},
	},
	{
		name: 'model3d_apply',
		title: 'Estudio 3D: gravar no arquivo (bake)',
		desc:
			'ESTUDIO 3D: grava DE VERDADE o pivot/rotacao/escala do estudio no arquivo do modelo. ' +
			'GLB/GLTF: insere nos raiz de pivot na cena (geometria, materiais, texturas, animacoes e ' +
			'skins intactos — a origem do arquivo passa a ser o pivot). OBJ: reescreve os vertices. ' +
			'Padrao: gera um arquivo novo nome.pivot.ext (overwrite=true substitui o original; ' +
			'output define outro caminho). Cria snapshot automatico do projeto antes. Depois do bake ' +
			'o modelo rotaciona/posiciona pelo pivot correto em qualquer engine.',
		schema: {
			type: 'object',
			properties: {
				path: { type: 'string' },
				output: { type: 'string', description: 'Caminho de saida (padrao: nome.pivot.ext)' },
				overwrite: { type: 'boolean', description: 'Substituir o arquivo original (padrao false)' },
				agent: { type: 'string' },
				project: MCP_PROJECT_PROP,
			},
			required: ['path'],
		},
		run: async (a) => {
			const proj = mcpProj(a);
			const m = est3dLoad(proj, a.path);
			const st = est3dState(proj, m.path);
			const ident =
				st.scale === 1 &&
				!st.rotation.some(function (v) {
					return v;
				}) &&
				!st.pivot.some(function (v) {
					return v;
				});
			if (ident)
				return `Nada para aplicar em ${m.path}: pivot na origem, escala x1 e rotacao 0. Use model3d_set_pivot ou model3d_transform antes.`;
			if (m.ext === '.stl')
				throw new Error('Bake de STL ainda nao e suportado — converta para OBJ ou GLB primeiro.');
			makeSnapshot(proj, 'auto: antes do bake 3D de ' + m.path);
			let outPath = a.output
				? mcpNorm(a.output)
				: a.overwrite
					? m.path
					: m.path.replace(/(\.[a-z0-9]+)$/i, '.pivot$1');
			if (!a.output && !a.overwrite && outPath === m.path) outPath = m.path + '.pivot';
			const f = proj.files.get(m.path);
			let binWarn = '';
			if (m.ext === '.glb') {
				const parts = est3dGlbParts(fileBytes(f));
				est3dBakeGltfJson(parts.json, st.pivot, st.rotation, st.scale);
				const packed = est3dPackGLB(parts.json, parts.bin);
				proj.files.set(outPath, makeFileEntry(outPath, packed));
				if (outPath === m.path)
					binWarn =
						'\nAtencao: binario substituido no lugar — o snapshot automatico registra binarios apenas por nome/tamanho (sem undo do conteudo).';
			} else {
				const src = f.isText && f.text != null ? f.text : new TextDecoder().decode(fileBytes(f));
				let txt;
				if (m.ext === '.gltf') {
					const json = JSON.parse(src);
					est3dBakeGltfJson(json, st.pivot, st.rotation, st.scale);
					txt = JSON.stringify(json);
					const hasExt = (json.buffers || []).some(function (b) {
						return b.uri && !/^data:/i.test(b.uri);
					});
					const dirOf = function (p2) {
						const i2 = p2.lastIndexOf('/');
						return i2 < 0 ? '' : p2.slice(0, i2);
					};
					if (hasExt && dirOf(outPath) !== dirOf(m.path))
						binWarn =
							'\nAtencao: este .gltf usa buffers externos (.bin) com caminho relativo — o arquivo gerado esta em OUTRA pasta e pode nao encontrar o .bin. Prefira gravar na mesma pasta do original.';
				} else {
					txt = est3dBakeOBJ(src, st.pivot, st.rotation, st.scale);
				}
				let nf = proj.files.get(outPath);
				if (nf && nf.isText && nf.text != null) {
					mcpHist(nf);
					nf.text = txt;
					nf.data = null;
				} else {
					nf = newFileEntry(outPath);
					nf.isText = true;
					nf.text = txt;
					nf.data = null;
					nf.history = [{ t: Date.now(), text: txt }];
					proj.files.set(outPath, nf);
				}
			}
			mcpAfterWrite(proj, outPath);
			EST3D.cache.delete(proj.id + ':' + outPath);
			const meta = est3dMeta(proj);
			meta.models[outPath] = {
				pivot: [0, 0, 0],
				rotation: [0, 0, 0],
				scale: 1,
				unit: st.unit || null,
				applied: true,
				updatedBy: a.agent || null,
				updatedAt: Date.now(),
			};
			est3dSaveMeta(proj, meta);
			const okMsg = `Bake aplicado: ${outPath} — a origem do arquivo agora e o pivot escolhido; rotacao e escala foram gravadas. Snapshot automatico criado antes.${binWarn}`;
			let sheet = null;
			try {
				sheet = est3dRenderSheet(proj, outPath, { unit: st.unit || 'm' });
			} catch (eV) {
				sheet = null;
			}
			if (sheet) return est3dContent(sheet, okMsg + '\n' + est3dText(sheet));
			return {
				__content: [
					{
						type: 'text',
						text:
							okMsg +
							'\nAviso: o arquivo foi gravado, mas nao consegui recarrega-lo para gerar a imagem de validacao (ex.: .bin externo fora da pasta). Verifique as referencias do arquivo gerado.',
					},
				],
			};
		},
	},
	{
		name: 'model3d_convert',
		title: 'Estudio 3D: converter FBX para GLB',
		desc:
			'ESTUDIO 3D: converte um .fbx do projeto para .glb usando o terminal do relay (npx ' +
			'fbx2gltf no PC do usuario — requer permissao de terminal no menu MCP; na primeira vez o ' +
			'npx baixa o conversor). O .glb gerado volta automaticamente ao editor e pode ser usado ' +
			'com model3d_inspect/set_pivot/apply.',
		schema: {
			type: 'object',
			properties: {
				path: { type: 'string', description: 'Arquivo .fbx do projeto' },
				output: { type: 'string', description: 'Caminho .glb de saida (padrao: mesmo nome .glb)' },
				project: MCP_PROJECT_PROP,
			},
			required: ['path'],
		},
		run: async (a) => {
			const proj = mcpProj(a);
			const path = mcpNorm(a.path);
			mcpFile(proj, path);
			const ext = (Core.extname(path) || '').toLowerCase();
			if (ext !== '.fbx')
				throw new Error('model3d_convert converte apenas FBX -> GLB. Arquivo informado: ' + path);
			let out = a.output ? mcpNorm(a.output) : path.replace(/\.fbx$/i, '.glb');
			if (!/\.glb$/i.test(out)) out += '.glb';
			const rc = MCP_TOOLS.find(function (t) {
				return t.name === 'run_command';
			});
			const cmd = `npx --yes fbx2gltf --binary --input "${path}" --output "${out.replace(/\.glb$/i, '')}"`;
			let rep;
			try {
				rep = await rc.run({ command: cmd, project: a.project, wait_sec: 15 });
			} catch (e) {
				throw new Error(
					'A conversao precisa do terminal do relay (permita no menu MCP; allowlist deve incluir npx). Detalhe: ' +
						((e && e.message) || e),
				);
			}
			if (proj.files.get(out))
				return `Convertido: ${path} -> ${out}. Use model3d_inspect em ${out}.\n\nSaida do conversor:\n${String(rep).slice(0, 800)}`;
			return `O comando terminou mas ${out} ainda nao apareceu no editor — a conversao pode demorar (o \
npx baixa o fbx2gltf na primeira vez). Acompanhe com command_output usando o proc_id abaixo, ou rode \
de novo em seguida.\n${String(rep).slice(0, 1200)}`;
		},
	},
];
