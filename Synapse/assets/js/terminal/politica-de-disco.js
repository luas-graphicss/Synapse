'use strict';
const DISCO = {
	cfg: {
		exigirOrigem: true,
		delPct: 0.25,
		delMin: 8,
		lixoMax: 400,
		lixoBytes: 8 * 1024 * 1024,
		restauroMs: 15000,
	},
	lixo: [],
	recusas: [],
	ultRestauro: 0,
};
function discoLixo(proj, p, f) {
	try {
		DISCO.lixo.unshift({
			pid: proj.id,
			nome: proj.name,
			path: p,
			text: f && typeof f.text === 'string' ? f.text : null,
			bytes: f && f.data ? f.data.byteLength || f.data.length || 0 : 0,
			at: Date.now(),
		});
		let soma = 0;
		for (let i = 0; i < DISCO.lixo.length; i++) {
			soma += DISCO.lixo[i].text ? DISCO.lixo[i].text.length : 0;
			if (i >= DISCO.cfg.lixoMax || soma > DISCO.cfg.lixoBytes) {
				DISCO.lixo.length = i;
				break;
			}
		}
	} catch (e) {
		ignorarErro(e, 'discoLixo');
	}
}
function discoRestaurar(quantos) {
	const n = Math.max(1, Math.min(DISCO.lixo.length, parseInt(quantos, 10) || DISCO.lixo.length));
	let feitos = 0;
	const tocados = {};
	for (let i = 0; i < n; i++) {
		const it = DISCO.lixo[i];
		if (!it || it.text == null) continue;
		const proj = State.projects.find((x) => x.id === it.pid);
		if (!proj) continue;
		if (proj.files.has(it.path)) continue;
		const f = newFileEntry(it.path);
		f.isText = true;
		f.data = null;
		f.text = it.text;
		f.history = [{ t: Date.now(), text: it.text }];
		proj.files.set(it.path, f);
		feitos++;
		tocados[proj.id] = proj;
	}
	Object.keys(tocados).forEach((k) => {
		const pr = tocados[k];
		if (pr.id === State.active) {
			renderTree();
			renderEditorTabs();
			scheduleBuild(pr);
		}
	});
	if (feitos) saveSession();
	return (
		feitos +
		' arquivo(s) restaurado(s) no editor. Rode qualquer comando para o site reescrever no disco.'
	);
}
window.SYNAPSE_DISCO = {
	cfg: DISCO.cfg,
	estado: function () {
		return {
			politica: DISCO.cfg.exigirOrigem
				? 'o site manda: o disco so apaga arquivo que nasceu no disco'
				: 'lote pequeno liberado sem checar origem',
			limite: `maior entre ${DISCO.cfg.delMin} arquivo(s) e ${Math.round(DISCO.cfg.delPct * 100)}% do projeto`,
			recusas: DISCO.recusas,
			naLixeira: DISCO.lixo.length,
		};
	},
	lixeira: function () {
		return DISCO.lixo.map((x) => ({
			path: x.path,
			projeto: x.nome,
			quando: new Date(x.at).toLocaleString(),
			conteudo:
				x.text != null
					? x.text.length + ' chars (restauravel)'
					: `binario ${x.bytes} bytes (conteudo nao guardado)`,
		}));
	},
	restaurar: discoRestaurar,
};
