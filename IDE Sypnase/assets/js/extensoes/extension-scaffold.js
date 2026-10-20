(function (root) {
	'use strict';

	const TYPINGS_PATH = 'assets/extensoes/synapse.d.ts';
	const SCHEMA_URL = 'https://sypnase-live-preview.vercel.app/schemas/extension-manifest.schema.json';
	const API_VERSION = root.SynapseExtensionCompat ? root.SynapseExtensionCompat.API_VERSION : '2.5.0';
	const TYPES = [
		{ id: 'comando', label: 'Comando', description: 'Comando na paleta, atalho, item de status bar e configuração', categories: ['Outros'], permissions: ['editor'] },
		{ id: 'linguagem', label: 'Linguagem', description: 'Gramática, snippets, completions e hover para uma nova linguagem', categories: ['Linguagens', 'Snippets'], permissions: [] },
		{ id: 'tema', label: 'Tema', description: 'Tema escuro e claro mapeando os tokens da IDE', categories: ['Temas'], permissions: [] },
		{ id: 'webview', label: 'Webview', description: 'View lateral e painel com UI própria em iframe isolado', categories: ['Outros'], permissions: ['webview', 'editor'] },
		{ id: 'formatador', label: 'Formatador', description: 'Provider de formatação de documento com configuração', categories: ['Formatadores'], permissions: ['editor'] },
	];

	function tr(text) {
		return typeof root.tr === 'function' ? root.tr(text) : text;
	}

	function toast(title, message, kind) {
		if (typeof root.toast === 'function') root.toast(title, message, kind || 'ok');
	}

	function windowHost() {
		return root.SynapseExtensionWindow;
	}

	function registry() {
		return root.SynapseExtensions;
	}

	function project() {
		return typeof root.activeProject === 'function' ? root.activeProject() : null;
	}

	function slugify(text) {
		return String(text || '')
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 40);
	}

	function camel(slug) {
		return slug.replace(/-([a-z0-9])/g, (match, char) => char.toUpperCase());
	}

	function pascal(slug) {
		const value = camel(slug);
		return value.charAt(0).toUpperCase() + value.slice(1);
	}

	function json(value) {
		return JSON.stringify(value, null, '\t') + '\n';
	}

	async function pick(title, placeHolder, items) {
		if (!windowHost()) return null;
		const picked = await windowHost().showQuickPick({ items, options: { title, placeHolder, matchOnDescription: true } }, {});
		return Array.isArray(picked) && picked.length ? picked[0] : null;
	}

	async function ask(title, hint, placeholder, validate) {
		if (typeof root.uiPrompt !== 'function') return null;
		for (;;) {
			const answer = await root.uiPrompt(title, hint, { placeholder, okLabel: tr('Continuar') });
			if (answer === null) return null;
			const problem = validate ? validate(answer.trim()) : '';
			if (!problem) return answer.trim();
			toast(tr('Valor recusado'), problem, 'warn');
		}
	}

	async function fetchTypings() {
		const address = root.SynapseSupportSiteBase && typeof root.SynapseSupportSiteBase.resolve === 'function' ? root.SynapseSupportSiteBase.resolve(TYPINGS_PATH) || TYPINGS_PATH : TYPINGS_PATH;
		try {
			const response = await fetch(address, { cache: 'no-cache' });
			if (!response.ok) throw new Error(String(response.status));
			const text = await response.text();
			if (!/declare namespace synapse/.test(text)) throw new Error('conteúdo inesperado');
			return text;
		} catch (error) {
			return `declare namespace synapse {\n\tconst version: string;\n\tconst commands: any;\n\tconst window: any;\n\tconst workspace: any;\n\tconst languages: any;\n\tconst preview: any;\n\tconst env: any;\n\tconst test: any;\n}\ndeclare function require(module: 'synapse'): typeof synapse;\ndeclare var module: { exports: any };\n`;
		}
	}

	const ICON_ACCEPT = '.png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml';
	const ICON_MAX_BYTES = 512 * 1024;
	const ICON_MIN_SIZE = 64;
	const ICON_EXTENSIONS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg' };

	function iconExtensionOf(file) {
		const byType = ICON_EXTENSIONS[String(file.type || '').toLowerCase()];
		if (byType) return byType;
		const match = /\.(png|jpe?g|webp|svg)$/i.exec(file.name || '');
		return match ? match[1].toLowerCase().replace('jpeg', 'jpg') : '';
	}

	function pickFile(accept) {
		return new Promise((resolve) => {
			const input = document.createElement('input');
			input.type = 'file';
			input.accept = accept;
			input.style.display = 'none';
			const done = (file) => {
				input.remove();
				resolve(file || null);
			};
			input.addEventListener('change', () => done(input.files && input.files[0]));
			input.addEventListener('cancel', () => done(null));
			document.body.appendChild(input);
			input.click();
		});
	}

	async function imageSize(bytes, mime) {
		try {
			const blob = new Blob([bytes], { type: mime });
			if (typeof createImageBitmap === 'function' && mime !== 'image/svg+xml') {
				const bitmap = await createImageBitmap(blob);
				const size = { width: bitmap.width, height: bitmap.height };
				if (typeof bitmap.close === 'function') bitmap.close();
				return size;
			}
			const url = URL.createObjectURL(blob);
			try {
				return await new Promise((resolve, reject) => {
					const image = new Image();
					image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
					image.onerror = () => reject(new Error('imagem inválida'));
					image.src = url;
				});
			} finally {
				URL.revokeObjectURL(url);
			}
		} catch (error) {
			return null;
		}
	}

	async function pickIconImage() {
		const file = await pickFile(ICON_ACCEPT);
		if (!file) return null;
		const ext = iconExtensionOf(file);
		if (!ext) {
			toast(tr('Formato não suportado'), tr('Use uma imagem PNG, JPG, WebP ou SVG.'), 'warn');
			return null;
		}
		if (file.size > ICON_MAX_BYTES) {
			toast(tr('Ícone muito grande'), `${Math.round(file.size / 1024)} KB · ${tr('o limite é 512 KB; reduza para 128 a 256 px.')}`, 'warn');
			return null;
		}
		const bytes = new Uint8Array(await file.arrayBuffer());
		const mime = Object.keys(ICON_EXTENSIONS).find((key) => ICON_EXTENSIONS[key] === ext) || file.type;
		const size = await imageSize(bytes, mime);
		if (!size) {
			toast(tr('Imagem inválida'), tr('Não foi possível ler a imagem escolhida.'), 'warn');
			return null;
		}
		if (size.width !== size.height) toast(tr('Ícone não é quadrado'), `${size.width}×${size.height} px · ${tr('a IDE recorta para um quadrado; prefira uma imagem quadrada.')}`, 'warn');
		else if (size.width < ICON_MIN_SIZE) toast(tr('Ícone pequeno'), `${size.width}×${size.height} px · ${tr('use pelo menos 128×128 px para ficar nítido.')}`, 'warn');
		const path = `media/icon.${ext}`;
		return { path, ext, mime, bytes, content: ext === 'svg' ? new TextDecoder().decode(bytes) : bytes, width: size.width, height: size.height, fileName: file.name };
	}

	async function chooseIcon(name) {
		const choice = await pick(tr('Ícone da extensão'), tr('Imagem mostrada na view de Extensões e no marketplace'), [
			{ label: tr('Escolher imagem PNG, JPG, WebP ou SVG…'), description: tr('Quadrada, de 128 a 256 px, até 512 KB') },
			{ label: tr('Gerar ícone padrão'), description: tr('SVG com a inicial do nome; troque depois em media/icon.svg') },
		]);
		if (choice === null) return null;
		if (choice === 1) return { path: 'media/icon.svg', ext: 'svg', content: iconSvg(String(name || 'S').trim().charAt(0).toUpperCase() || 'S') };
		for (;;) {
			const image = await pickIconImage();
			if (image) return image;
			const again = await pick(tr('Nenhuma imagem selecionada'), tr('Como continuar?'), [
				{ label: tr('Escolher outra imagem…'), description: tr('Abrir o seletor de arquivos de novo') },
				{ label: tr('Usar ícone padrão'), description: tr('SVG com a inicial do nome') },
			]);
			if (again === null) return null;
			if (again === 1) return { path: 'media/icon.svg', ext: 'svg', content: iconSvg(String(name || 'S').trim().charAt(0).toUpperCase() || 'S') };
		}
	}

	function manifestFor(spec) {
		const type = spec.type;
		const ns = spec.namespace;
		const manifest = {
			$schema: SCHEMA_URL,
			id: `${spec.publisher}.${spec.slug}`,
			name: spec.name,
			version: '0.1.0',
			publisher: spec.publisher,
			description: spec.description,
			engines: { synapse: `>=${API_VERSION}` },
			main: 'src/extension.js',
			icon: spec.icon && spec.icon.path ? spec.icon.path : 'media/icon.svg',
			categories: type.categories,
			activationEvents: [],
			permissions: type.permissions,
			contributes: {},
			repository: `https://github.com/${spec.publisher}/${spec.slug}`,
			license: 'MIT',
		};
		if (type.id === 'comando') {
			manifest.activationEvents = [`onCommand:${ns}.saudar`, `onCommand:${ns}.contarLinhas`];
			manifest.contributes = {
				commands: [
					{ command: `${ns}.saudar`, title: 'Saudar', category: spec.name },
					{ command: `${ns}.contarLinhas`, title: 'Contar linhas do arquivo ativo', category: spec.name },
				],
				keybindings: [{ command: `${ns}.contarLinhas`, key: 'ctrl+alt+l', when: 'editorFocus' }],
				menus: { 'editor/context': [{ command: `${ns}.contarLinhas`, when: 'editorFocus', group: 'navigation' }] },
				configuration: { title: spec.name, properties: { [`${ns}.nome`]: { type: 'string', default: 'mundo', description: 'Quem recebe a saudação.' } } },
				statusBar: [{ id: `${ns}.status`, alignment: 'right', priority: 40, text: spec.name, command: `${ns}.saudar` }],
			};
		} else if (type.id === 'linguagem') {
			manifest.activationEvents = [`onLanguage:${spec.languageId}`];
			manifest.contributes = {
				languages: [{ id: spec.languageId, extensions: [`.${spec.languageId}`], aliases: [pascal(spec.languageId)], configuration: 'language-configuration.json' }],
				grammars: [{ language: spec.languageId, path: `grammars/${spec.languageId}.json` }],
				snippets: [{ language: spec.languageId, path: `snippets/${spec.languageId}.json` }],
			};
		} else if (type.id === 'tema') {
			manifest.contributes = {
				themes: [
					{ label: `${spec.name} Escuro`, uiTheme: 'dark', path: `themes/${spec.slug}-escuro.json` },
					{ label: `${spec.name} Claro`, uiTheme: 'light', path: `themes/${spec.slug}-claro.json` },
				],
			};
		} else if (type.id === 'webview') {
			manifest.activationEvents = [`onView:${ns}.painel`, `onCommand:${ns}.abrir`];
			manifest.contributes = {
				commands: [{ command: `${ns}.abrir`, title: 'Abrir painel', category: spec.name }],
				views: { sidebar: [{ id: `${ns}.painel`, name: spec.name, icon: 'media/view.svg' }] },
			};
		} else if (type.id === 'formatador') {
			manifest.activationEvents = ['onStartupFinished'];
			manifest.contributes = {
				commands: [{ command: `${ns}.formatar`, title: 'Formatar documento', category: spec.name }],
				keybindings: [{ command: `${ns}.formatar`, key: 'ctrl+alt+f', when: 'editorFocus' }],
				configuration: { title: spec.name, properties: { [`${ns}.linhaFinal`]: { type: 'boolean', default: true, description: 'Garante quebra de linha no fim do arquivo.' } } },
			};
		}
		return manifest;
	}

	function commandSource(spec) {
		const ns = spec.namespace;
		return [
			"const synapse = require('synapse');",
			'',
			'function activate(context) {',
			`\tconst output = synapse.window.createOutputChannel('${spec.name}');`,
			`\tconst status = synapse.window.createStatusBarItem('${ns}.status', synapse.StatusBarAlignment.Right, 40);`,
			`\tstatus.text = '${spec.name}';`,
			`\tstatus.command = '${ns}.saudar';`,
			'\tstatus.show();',
			'',
			'\tcontext.subscriptions.push(',
			'\t\toutput,',
			'\t\tstatus,',
			`\t\tsynapse.commands.registerCommand('${ns}.saudar', async () => {`,
			`\t\t\tconst nome = synapse.workspace.getConfiguration('${ns}').get('nome', 'mundo');`,
			"\t\t\tconst runs = (context.globalState.get('runs', 0) || 0) + 1;",
			"\t\t\tawait context.globalState.update('runs', runs);",
			"\t\t\toutput.appendLine(`Saudação nº ${runs} para ${nome}`);",
			"\t\t\treturn synapse.window.showInformationMessage(`Olá, ${nome}!`, 'Abrir saída').then((choice) => {",
			"\t\t\t\tif (choice === 'Abrir saída') output.show();",
			'\t\t\t\treturn runs;',
			'\t\t\t});',
			'\t\t}),',
			`\t\tsynapse.commands.registerCommand('${ns}.contarLinhas', async () => {`,
			'\t\t\tconst editor = synapse.window.activeTextEditor;',
			"\t\t\tif (!editor) return synapse.window.showWarningMessage('Abra um arquivo primeiro.');",
			'\t\t\tconst total = editor.document.lineCount;',
			'\t\t\tsynapse.window.setStatusBarMessage(`${total} linha(s) em ${editor.document.fileName}`, 3000);',
			'\t\t\treturn total;',
			'\t\t}),',
			'\t\tsynapse.workspace.onDidChangeConfiguration((event) => {',
			`\t\t\tif (event.affectsConfiguration('${ns}.nome')) output.appendLine('Configuração "nome" alterada.');`,
			'\t\t}),',
			'\t);',
			'}',
			'',
			'function deactivate() {}',
			'',
			'module.exports = { activate, deactivate };',
			'',
		].join('\n');
	}

	function languageSource(spec) {
		const id = spec.languageId;
		return [
			"const synapse = require('synapse');",
			'',
			"const KEYWORDS = ['fn', 'let', 'const', 'if', 'else', 'for', 'while', 'return', 'true', 'false', 'null'];",
			'',
			'function activate(context) {',
			`\tconst selector = { language: '${id}' };`,
			'\tcontext.subscriptions.push(',
			'\t\tsynapse.languages.registerCompletionItemProvider(selector, {',
			'\t\t\tprovideCompletionItems() {',
			'\t\t\t\treturn KEYWORDS.map((word) => {',
			'\t\t\t\t\tconst item = new synapse.CompletionItem(word, synapse.CompletionItemKind.Keyword);',
			"\t\t\t\t\titem.detail = 'palavra-chave';",
			'\t\t\t\t\treturn item;',
			'\t\t\t\t});',
			'\t\t\t},',
			'\t\t}),',
			'\t\tsynapse.languages.registerHoverProvider(selector, {',
			'\t\t\tprovideHover(document, position) {',
			'\t\t\t\tconst range = document.getWordRangeAtPosition(position);',
			'\t\t\t\tif (!range) return null;',
			'\t\t\t\tconst word = document.getText(range);',
			'\t\t\t\tif (!KEYWORDS.includes(word)) return null;',
			"\t\t\t\treturn new synapse.Hover(new synapse.MarkdownString('**' + word + '** — palavra-chave de " + pascal(id) + "'), range);",
			'\t\t\t},',
			'\t\t}),',
			'\t);',
			'}',
			'',
			'function deactivate() {}',
			'',
			'module.exports = { activate, deactivate };',
			'',
		].join('\n');
	}

	function themeSource() {
		return 'module.exports = { activate() {}, deactivate() {} };\n';
	}

	function webviewSource(spec) {
		const ns = spec.namespace;
		return [
			"const synapse = require('synapse');",
			'',
			'function escapeHtml(text) {',
			"\treturn String(text).replace(/[&<>\"']/g, (char) => `&#${char.charCodeAt(0)};`);",
			'}',
			'',
			'function html(webview, title, fileName) {',
			'\treturn `<!DOCTYPE html>',
			'<html lang="pt-BR">',
			'<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>',
			'<body class="sx-pad">',
			'\t<div class="sx-stack">',
			'\t\t<span class="sx-label">${escapeHtml(title)}</span>',
			'\t\t<span class="sx-hint" id="arquivo">${escapeHtml(fileName || "Nenhum arquivo ativo")}</span>',
			'\t\t<button class="sx-btn primary" id="ola">Enviar mensagem ao host</button>',
			'\t</div>',
			'\t<script nonce="${webview.nonce}">',
			'\t\tconst api = acquireSynapseApi();',
			"\t\tdocument.getElementById('ola').addEventListener('click', () => api.postMessage({ type: 'ola' }));",
			"\t\twindow.addEventListener('message', (event) => {",
			"\t\t\tif (event.data && event.data.type === 'arquivo') document.getElementById('arquivo').textContent = event.data.fileName || 'Nenhum arquivo ativo';",
			'\t\t});',
			'\t</script>',
			'</body>',
			'</html>`;',
			'}',
			'',
			'function activeFileName() {',
			'\tconst editor = synapse.window.activeTextEditor;',
			"\treturn editor ? editor.document.fileName : '';",
			'}',
			'',
			'function wire(webview, title) {',
			'\twebview.html = html(webview, title, activeFileName());',
			'\twebview.onDidReceiveMessage(async (message) => {',
			"\t\tif (message && message.type === 'ola') await synapse.window.showInformationMessage('Mensagem recebida do webview.');",
			'\t});',
			"\treturn synapse.window.onDidChangeActiveTextEditor(() => webview.postMessage({ type: 'arquivo', fileName: activeFileName() }));",
			'}',
			'',
			'function activate(context) {',
			'\tcontext.subscriptions.push(',
			`\t\tsynapse.window.registerWebviewViewProvider('${ns}.painel', {`,
			'\t\t\tresolveWebviewView(view) {',
			`\t\t\t\tconst listener = wire(view.webview, '${spec.name}');`,
			'\t\t\t\tview.onDidDispose(() => listener.dispose());',
			'\t\t\t},',
			'\t\t}),',
			`\t\tsynapse.commands.registerCommand('${ns}.abrir', () => {`,
			`\t\t\tconst panel = synapse.window.createWebviewPanel('${ns}.painel-editor', '${spec.name}', { preserveFocus: false }, { enableScripts: true, retainContextWhenHidden: true });`,
			`\t\t\tconst listener = wire(panel.webview, '${spec.name}');`,
			'\t\t\tpanel.onDidDispose(() => listener.dispose());',
			'\t\t}),',
			'\t);',
			'}',
			'',
			'function deactivate() {}',
			'',
			'module.exports = { activate, deactivate };',
			'',
		].join('\n');
	}

	function formatterSource(spec) {
		const ns = spec.namespace;
		return [
			"const synapse = require('synapse');",
			'',
			'function format(text, options, linhaFinal) {',
			"\tconst eol = text.includes('\\r\\n') ? '\\r\\n' : '\\n';",
			'\tconst lines = text.split(/\\r?\\n/).map((line) => line.replace(/[ \\t]+$/, ""));',
			"\twhile (lines.length && lines[lines.length - 1] === '') lines.pop();",
			"\treturn lines.join(eol) + (linhaFinal ? eol : '');",
			'}',
			'',
			'function fullRange(document) {',
			'\tconst last = document.lineCount - 1;',
			'\treturn new synapse.Range(0, 0, last, document.lineAt(last).text.length);',
			'}',
			'',
			'function linhaFinal() {',
			`\treturn synapse.workspace.getConfiguration('${ns}').get('linhaFinal') !== false;`,
			'}',
			'',
			'function provideDocumentFormattingEdits(document, options, token) {',
			'\tconst text = document.getText();',
			'\tconst formatted = format(text, options, linhaFinal());',
			'\tif (token.isCancellationRequested || formatted === text) return [];',
			'\treturn [synapse.TextEdit.replace(fullRange(document), formatted)];',
			'}',
			'',
			'function activate(context) {',
			'\tcontext.subscriptions.push(',
			"\t\tsynapse.languages.registerDocumentFormattingEditProvider([{ language: 'text' }, { pattern: '**/*.txt' }, { pattern: '**/*.md' }], { provideDocumentFormattingEdits }),",
			`\t\tsynapse.commands.registerCommand('${ns}.formatar', async () => {`,
			'\t\t\tconst editor = synapse.window.activeTextEditor;',
			"\t\t\tif (!editor) return synapse.window.showWarningMessage('Abra um arquivo para formatar.');",
			'\t\t\tconst text = editor.document.getText();',
			'\t\t\tconst formatted = format(text, editor.options, linhaFinal());',
			"\t\t\tif (formatted === text) return synapse.window.setStatusBarMessage('Já está formatado', 2000);",
			'\t\t\treturn editor.edit((builder) => builder.replace(fullRange(editor.document), formatted));',
			'\t\t}),',
			'\t);',
			'}',
			'',
			'function deactivate() {}',
			'',
			'module.exports = { activate, deactivate, format };',
			'',
		].join('\n');
	}

	function testSource(spec) {
		const type = spec.type.id;
		const lines = ["const { describe, it, expect, beforeAll } = synapse.test;", "const extension = require('synapse');", ''];
		if (type === 'formatador') {
			lines.push(
				"const { format } = module.exports;",
				'',
				`describe('${spec.name}', () => {`,
				"\tit('remove espaços no fim das linhas', () => {",
				"\t\texpect(format('a  \\nb\\t\\n', { tabSize: 2, insertSpaces: true }, true)).toBe('a\\nb\\n');",
				'\t});',
				"\tit('respeita a opção de linha final', () => {",
				"\t\texpect(format('a\\n\\n\\n', { tabSize: 2, insertSpaces: true }, false)).toBe('a');",
				'\t});',
				'});',
			);
		} else if (type === 'comando') {
			lines.push(
				`describe('${spec.name}', () => {`,
				"\tit('registra os comandos no host', async () => {",
				'\t\tconst commands = await extension.commands.getCommands();',
				`\t\texpect(commands).toContain('${spec.namespace}.saudar');`,
				`\t\texpect(commands).toContain('${spec.namespace}.contarLinhas');`,
				'\t});',
				"\tit('lê a configuração padrão', () => {",
				`\t\texpect(extension.workspace.getConfiguration('${spec.namespace}').get('nome', 'mundo')).toBe('mundo');`,
				'\t});',
				'});',
			);
		} else if (type === 'linguagem') {
			lines.push(
				`describe('${spec.name}', () => {`,
				"\tit('a linguagem foi registrada', async () => {",
				'\t\tconst languages = await extension.languages.getLanguages();',
				`\t\texpect(languages).toContain('${spec.languageId}');`,
				'\t});',
				"\tit('o seletor casa com documentos da linguagem', () => {",
				`\t\texpect(extension.languages.match({ language: '${spec.languageId}' }, { languageId: '${spec.languageId}', _path: 'a.${spec.languageId}' })).toBeGreaterThan(0);`,
				'\t});',
				'});',
			);
		} else {
			lines.push(
				`describe('${spec.name}', () => {`,
				"\tit('a API está disponível', () => {",
				"\t\texpect(extension.version).toMatch(/^\\d+\\.\\d+\\.\\d+/);",
				'\t});',
				"\tit('o manifesto foi carregado', () => {",
				"\t\texpect(typeof extension.env.appName).toBe('string');",
				'\t});',
				'});',
			);
		}
		lines.push('');
		return lines.join('\n');
	}

	function readme(spec) {
		return [
			`# ${spec.name}`,
			'',
			spec.description,
			'',
			'## Desenvolver',
			'',
			'1. Abra esta pasta na Synapse IDE.',
			'2. Paleta de comandos → **Extensões: Executar extensão** (ou Ctrl+Alt+R para recarregar depois de editar).',
			'3. **Extensões: Executar testes…** roda `test/*.test.js` dentro do Extension Host.',
			'4. **Extensões: Empacotar (.sx)** gera o pacote; **Extensões: Publicar…** prepara a Release e o PR do registro.',
			'',
			'## Estrutura',
			'',
			'- `synapse-extension.json` — manifesto (validado pelo schema em `$schema`).',
			'- `src/extension.js` — `activate` / `deactivate`.',
			'- `synapse.d.ts` — tipos da API para autocompletar no editor.',
			'- `test/extension.test.js` — testes com `synapse.test`.',
			'- `.github/workflows/release.yml` — gera o `.sx` e a Release ao criar uma tag `vX.Y.Z`.',
			'',
			'## Licença',
			'',
			'MIT',
			'',
		].join('\n');
	}

	function changelog() {
		return `# Changelog\n\n## 0.1.0 — ${new Date().toISOString().slice(0, 10)}\n\n- Projeto criado pelo assistente da Synapse IDE.\n`;
	}

	function license(spec) {
		const year = new Date().getFullYear();
		return `MIT License\n\nCopyright (c) ${year} ${spec.publisher}\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the "Software"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.\n`;
	}

	function releaseWorkflow(spec) {
		return [
			'name: Release .sx',
			'',
			'on:',
			'  push:',
			"    tags: ['v*.*.*']",
			'',
			'permissions:',
			'  contents: write',
			'',
			'jobs:',
			'  release:',
			'    runs-on: ubuntu-latest',
			'    steps:',
			'      - uses: actions/checkout@v4',
			'      - name: Conferir versão do manifesto',
			'        run: |',
			'          TAG="${GITHUB_REF_NAME#v}"',
			"          VERSION=$(node -p \"require('./synapse-extension.json').version\")",
			'          if [ "$TAG" != "$VERSION" ]; then echo "Tag v$TAG difere de version=$VERSION no manifesto"; exit 1; fi',
			'      - name: Gerar pacote .sx',
			'        run: |',
			'          mkdir -p dist-sx',
			`          zip -r "dist-sx/${spec.slug}-\${GITHUB_REF_NAME#v}.sx" . -x ".git/*" ".github/*" "dist-sx/*" "node_modules/*" "*.sx"`,
			'          (cd dist-sx && sha256sum *.sx > SHA256SUMS.txt && cat SHA256SUMS.txt)',
			'      - name: Publicar Release',
			'        uses: softprops/action-gh-release@v2',
			'        with:',
			'          files: |',
			'            dist-sx/*.sx',
			'            dist-sx/SHA256SUMS.txt',
			'          generate_release_notes: true',
			'',
		].join('\n');
	}

	function iconSvg(letter) {
		return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128"><rect width="128" height="128" rx="24" fill="#1c2430"/><text x="64" y="82" font-family="system-ui, sans-serif" font-size="64" font-weight="700" text-anchor="middle" fill="#5fb3ff">${letter}</text></svg>\n`;
	}

	function viewSvg() {
		return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="12" rx="2"/><path d="M2 6h12M6 6v8"/></svg>\n';
	}

	function themeJson(spec, dark) {
		const colors = dark
			? { bg: '#0f1216', 'bg-1': '#13171c', 'bg-2': '#181d23', 'bg-3': '#222932', line: '#2a323c', 'line-2': '#3b4652', txt: '#e3e8ee', 'txt-2': '#a7b1bd', 'txt-3': '#6f7a87', acc: '#5fb3ff', 'acc-2': '#3a8fdc', 'acc-ink': '#06131f', ok: '#6dcf8a', warn: '#e3b34c', err: '#ef6b6b', info: '#8ab4f8', 'tk-key': '#c792ea', 'tk-str': '#a5d6a7', 'tk-num': '#f78c6c', 'tk-com': '#6f7a87', 'tk-tag': '#82aaff', 'tk-attr': '#ffcb6b', 'tk-punc': '#9aa5b1', 'tk-fn': '#89ddff', 'preview-a': '#13171c', 'preview-b': '#0f1216', 'preview-veil': 'rgba(15, 18, 22, 0.92)', scrim: 'rgba(6, 9, 12, 0.6)' }
			: { bg: '#f6f7f9', 'bg-1': '#ffffff', 'bg-2': '#eef1f5', 'bg-3': '#e3e8ee', line: '#d5dbe3', 'line-2': '#c1c9d3', txt: '#1b2430', 'txt-2': '#4b5766', 'txt-3': '#7c8794', acc: '#1f6fd0', 'acc-2': '#1858a8', 'acc-ink': '#ffffff', ok: '#1f8f4b', warn: '#b7791f', err: '#c9403d', info: '#2f6fd8', 'tk-key': '#7c3aed', 'tk-str': '#2f7d3b', 'tk-num': '#c2410c', 'tk-com': '#7c8794', 'tk-tag': '#1d4ed8', 'tk-attr': '#a16207', 'tk-punc': '#4b5766', 'tk-fn': '#0e7490', 'preview-a': '#ffffff', 'preview-b': '#f6f7f9', 'preview-veil': 'rgba(246, 247, 249, 0.92)', scrim: 'rgba(27, 36, 48, 0.4)' };
		return json({ name: `${spec.name} ${dark ? 'Escuro' : 'Claro'}`, type: dark ? 'dark' : 'light', colors });
	}

	function grammarJson(spec) {
		const id = spec.languageId;
		return json({
			language: id,
			extensions: [id],
			lineComments: ['//'],
			blockComments: [['/*', '*/']],
			quotes: ['"', "'"],
			balanced: true,
			keywords: 'fn let const if else for while return true false null',
			patterns: [
				{ match: '\\b(?:fn)\\s+([A-Za-z_][A-Za-z0-9_]*)', captures: { 0: 'keyword', 1: 'entity.name.function' } },
				{ match: '\\b\\d+(?:\\.\\d+)?\\b', name: 'constant.numeric' },
				{ match: '[A-Za-z_][A-Za-z0-9_]*(?=\\s*\\()', name: 'entity.name.function' },
			],
		});
	}

	function snippetsJson(spec) {
		return json({
			Função: { prefix: 'fn', body: ['fn ${1:nome}(${2:args}) {', '\t$0', '}'], description: 'Declaração de função' },
			Condicional: { prefix: 'if', body: ['if ${1:condição} {', '\t$0', '}'], description: 'Bloco if' },
		});
	}

	function languageConfigurationJson() {
		return json({
			comments: { lineComment: '//', blockComment: ['/*', '*/'] },
			brackets: [['{', '}'], ['[', ']'], ['(', ')']],
			autoClosingPairs: [{ open: '{', close: '}' }, { open: '[', close: ']' }, { open: '(', close: ')' }, { open: '"', close: '"', notIn: ['string'] }],
			surroundingPairs: [{ open: '{', close: '}' }, { open: '[', close: ']' }, { open: '(', close: ')' }, { open: '"', close: '"' }],
		});
	}

	function jsconfig() {
		return json({ compilerOptions: { target: 'es2020', module: 'commonjs', checkJs: true, strict: false, noEmit: true }, include: ['src', 'test', 'synapse.d.ts'] });
	}

	function sourceFor(spec) {
		switch (spec.type.id) {
			case 'comando':
				return commandSource(spec);
			case 'linguagem':
				return languageSource(spec);
			case 'tema':
				return themeSource();
			case 'webview':
				return webviewSource(spec);
			default:
				return formatterSource(spec);
		}
	}

	async function generate(spec) {
		const files = new Map();
		files.set('synapse-extension.json', json(manifestFor(spec)));
		files.set('src/extension.js', sourceFor(spec));
		files.set('test/extension.test.js', testSource(spec));
		files.set('synapse.d.ts', await fetchTypings());
		files.set('jsconfig.json', jsconfig());
		files.set('README.md', readme(spec));
		files.set('CHANGELOG.md', changelog());
		files.set('LICENSE', license(spec));
		files.set('.gitignore', 'dist-sx/\nnode_modules/\n.synapse/\n');
		files.set('.github/workflows/release.yml', releaseWorkflow(spec));
		if (spec.icon && spec.icon.path) files.set(spec.icon.path, spec.icon.content);
		else files.set('media/icon.svg', iconSvg(spec.name.trim().charAt(0).toUpperCase() || 'S'));
		if (spec.type.id === 'linguagem') {
			files.set(`grammars/${spec.languageId}.json`, grammarJson(spec));
			files.set(`snippets/${spec.languageId}.json`, snippetsJson(spec));
			files.set('language-configuration.json', languageConfigurationJson());
		}
		if (spec.type.id === 'tema') {
			files.set(`themes/${spec.slug}-escuro.json`, themeJson(spec, true));
			files.set(`themes/${spec.slug}-claro.json`, themeJson(spec, false));
		}
		if (spec.type.id === 'webview') files.set('media/view.svg', viewSvg());
		return files;
	}

	function isBinary(value) {
		return value instanceof Uint8Array || value instanceof ArrayBuffer;
	}

	function bytesOf(value) {
		return value instanceof Uint8Array ? value : new Uint8Array(value);
	}

	function entryFor(path, content) {
		if (isBinary(content)) {
			const entry = typeof root.newFileEntry === 'function' ? root.newFileEntry(path) : { path };
			entry.data = bytesOf(content);
			entry.text = null;
			entry.isText = false;
			entry.history = [];
			return entry;
		}
		const text = String(content);
		if (typeof root.newFileEntry === 'function') {
			const entry = root.newFileEntry(path);
			entry.text = text;
			entry.data = null;
			entry.isText = true;
			entry.history = [{ t: Date.now(), text }];
			return entry;
		}
		return { path, text, isText: true, data: null, history: [{ t: Date.now(), text }] };
	}

	function assignEntry(existing, content) {
		if (isBinary(content)) {
			existing.data = bytesOf(content);
			existing.text = null;
			existing.isText = false;
			return;
		}
		existing.text = String(content);
		existing.data = null;
		existing.isText = true;
	}

	function writeIntoProject(target, folder, files) {
		const prefix = folder ? folder + '/' : '';
		files.forEach((content, path) => {
			const full = prefix + path;
			const existing = target.files.get(full);
			if (existing) assignEntry(existing, content);
			else target.files.set(full, entryFor(full, content));
			if (target.dirty) target.dirty.add(full);
		});
		if (typeof root.fsChanged === 'function') root.fsChanged(target);
		if (files.has('src/extension.js') && typeof root.openFileInEditor === 'function') root.openFileInEditor(prefix + 'src/extension.js');
	}

	function createProject(name, files) {
		if (typeof root.addProject !== 'function') throw new Error('Criação de projetos indisponível nesta build.');
		const entries = new Map();
		files.forEach((content, path) => entries.set(path, entryFor(path, content)));
		const created = root.addProject(name, 'folder', entries);
		if (created && typeof root.openFileInEditor === 'function') root.openFileInEditor('src/extension.js');
		return created;
	}

	function validateName(value) {
		if (!value) return tr('Informe um nome.');
		if (!slugify(value)) return tr('O nome precisa ter letras ou números.');
		return '';
	}

	function validatePublisher(value) {
		if (!/^[a-z0-9][a-z0-9-]*$/.test(value)) return tr('Use o login do GitHub em minúsculas (letras, números e hífens).');
		return '';
	}

	function validateLanguageId(value) {
		if (!/^[a-z][a-z0-9_+.#-]{0,39}$/.test(value)) return tr('Id de linguagem: minúsculas, começando por letra.');
		return '';
	}

	async function create() {
		const typeIndex = await pick(tr('Criar nova extensão'), tr('Que tipo de extensão?'), TYPES.map((type) => ({ label: tr(type.label), description: tr(type.description) })));
		if (typeIndex === null) return null;
		const type = TYPES[typeIndex];
		const name = await ask(tr('Nome da extensão'), tr('Nome exibido na view de Extensões, ex.: "Minhas Ferramentas".'), tr('Minha Extensão'), validateName);
		if (name === null) return null;
		const slug = slugify(name);
		const remembered = typeof root.localStorage !== 'undefined' ? root.localStorage.getItem('synapse.extensions.publisher') || '' : '';
		const publisher = await ask(tr('Publisher'), tr('Seu login do GitHub em minúsculas. Precisa ser o dono do repositório que publica a extensão.'), remembered || 'meu-login', validatePublisher);
		if (publisher === null) return null;
		try {
			root.localStorage.setItem('synapse.extensions.publisher', publisher);
		} catch (error) {}
		let languageId = '';
		if (type.id === 'linguagem') {
			languageId = await ask(tr('Id da linguagem'), tr('Identificador usado em onLanguage e nos seletores, ex.: "zig".'), slug.replace(/-/g, ''), validateLanguageId);
			if (languageId === null) return null;
		}
		const description = (await ask(tr('Descrição'), tr('Uma frase sobre o que a extensão faz.'), `${name} para a Synapse IDE.`, null)) || `${name} para a Synapse IDE.`;
		const icon = await chooseIcon(name);
		if (icon === null) return null;
		const spec = { type, name, slug, publisher, description, languageId, icon, namespace: camel(slug) };
		const current = project();
		const destinations = [{ label: tr('Novo projeto'), description: tr('Abre um projeto separado só com a extensão') }];
		if (current) destinations.push({ label: tr('Pasta no projeto atual'), description: `${current.name}/extensoes/${slug}` });
		const destination = destinations.length > 1 ? await pick(tr('Onde criar?'), tr('Escolha o destino dos arquivos'), destinations) : 0;
		if (destination === null) return null;
		let files;
		try {
			files = await generate(spec);
		} catch (error) {
			toast(tr('Falha ao gerar extensão'), error.message, 'err');
			return null;
		}
		let folder = '';
		let target = current;
		if (destination === 1 && current) {
			folder = `extensoes/${slug}`;
			writeIntoProject(current, folder, files);
		} else {
			target = createProject(slug, files);
			if (!target) return null;
		}
		toast(tr('Extensão criada'), `${files.size} ${tr('arquivo(s)')} · ${spec.publisher}.${spec.slug}${icon.fileName ? ` · ${tr('ícone')} ${icon.path}` : ''}`, 'ok');
		const runNow = typeof root.uiConfirm === 'function' ? await root.uiConfirm(tr('Executar agora?'), tr('Carregar a extensão no Extension Development Host para testá-la ao vivo?'), tr('Executar'), false) : false;
		if (runNow && root.SynapseExtensionDevLoader) await root.SynapseExtensionDevLoader.runFolder(folder);
		return { spec, files: [...files.keys()], folder, project: target };
	}

	function manifestCandidates(target) {
		const list = [];
		for (const [path, entry] of target.files) {
			if (!/(^|\/)synapse-extension\.json$/.test(path) || !entry.isText) continue;
			list.push({ path, folder: path.slice(0, -'synapse-extension.json'.length).replace(/\/$/, ''), entry });
		}
		return list.sort((a, b) => a.path.localeCompare(b.path));
	}

	async function setIcon() {
		const target = project();
		if (!target) {
			toast(tr('Sem projeto'), tr('Abra o projeto da extensão antes de definir o ícone.'), 'warn');
			return null;
		}
		const candidates = manifestCandidates(target);
		if (!candidates.length) {
			toast(tr('Manifesto não encontrado'), tr('O projeto não tem synapse-extension.json.'), 'warn');
			return null;
		}
		let chosen = candidates[0];
		if (candidates.length > 1) {
			const index = await pick(tr('Qual extensão?'), tr('Escolha o manifesto que recebe o ícone'), candidates.map((candidate) => ({ label: candidate.folder || tr('(raiz do projeto)'), description: candidate.path })));
			if (index === null) return null;
			chosen = candidates[index];
		}
		let manifest;
		try {
			manifest = JSON.parse(chosen.entry.text || '{}');
		} catch (error) {
			toast(tr('Manifesto inválido'), error.message, 'err');
			return null;
		}
		const image = await pickIconImage();
		if (!image) return null;
		manifest.icon = image.path;
		const files = new Map();
		files.set('synapse-extension.json', json(manifest));
		files.set(image.path, image.content);
		writeIntoProject(target, chosen.folder, files);
		if (typeof root.openFileInEditor === 'function') root.openFileInEditor(chosen.path);
		toast(tr('Ícone definido'), `${image.path} · ${image.width}×${image.height} px`, 'ok');
		if (root.SynapseExtensionDevLoader && typeof root.SynapseExtensionDevLoader.reloadAll === 'function') root.SynapseExtensionDevLoader.reloadAll().catch(() => {});
		return { path: image.path, manifest: chosen.path };
	}

	function register() {
		if (!registry()) return;
		registry().registerPaletteCommand(() => ({ id: 'synapse.extensions.scaffold', label: tr('Extensões: Criar nova extensão…'), hint: tr('assistente comando linguagem tema webview formatador'), icon: 'plus', on: true, run: create }));
		registry().registerPaletteCommand(() => ({ id: 'synapse.extensions.setIcon', label: tr('Extensões: Definir ícone da extensão…'), hint: tr('ícone imagem png jpg logo extensão manifesto'), icon: 'assets', on: () => !!project(), run: setIcon }));
		if (root.SynapseNativeShortcuts && typeof root.SynapseNativeShortcuts.register === 'function') {
			root.SynapseNativeShortcuts.register([{ id: 'synapse.extensions.scaffold', label: tr('Criar nova extensão'), defaultBinding: '', category: tr('Extensões'), run: () => create() }]);
		}
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', register, { once: true });
	else register();

	root.SynapseExtensionScaffold = Object.freeze({ TYPES, create, generate, manifestFor, slugify, fetchTypings, pickIconImage, setIcon });
})(window);

