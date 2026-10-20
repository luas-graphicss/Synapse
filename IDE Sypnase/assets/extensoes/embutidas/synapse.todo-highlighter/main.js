const synapse = require('synapse');

const DEFAULT_KEYWORDS = ['TODO', 'FIXME', 'HACK', 'NOTE', 'XXX'];
const MAX_FILE_CHARS = 400000;
const MAX_SCAN_FILES = 400;
const SCAN_EXCLUDE = '**/{node_modules,dist,build,.git,.modeler-backups}/**';
const DEBOUNCE_MS = 200;

let decoration = null;
let statusItem = null;
let diagnostics = null;
let timer = null;

function configuration() {
	const config = synapse.workspace.getConfiguration('synapse.todo');
	const keywords = config.get('keywords', DEFAULT_KEYWORDS);
	return {
		enabled: config.get('enabled', true) !== false,
		keywords: (Array.isArray(keywords) ? keywords : DEFAULT_KEYWORDS).map((word) => String(word).trim()).filter((word) => /^[A-Za-z][A-Za-z0-9_-]{1,15}$/.test(word)),
	};
}

function patternFor(keywords) {
	return new RegExp(`\\b(${keywords.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b:?`, 'g');
}

function scanText(text, keywords) {
	const pattern = patternFor(keywords);
	const found = [];
	const lines = text.split(/\r?\n/);
	for (let line = 0; line < lines.length; line++) {
		const content = lines[line];
		pattern.lastIndex = 0;
		let match;
		while ((match = pattern.exec(content))) {
			found.push({ line, character: match.index, length: match[0].length, keyword: match[1].toUpperCase(), text: content.slice(match.index).trim().slice(0, 160) });
			if (found.length >= 2000) return found;
		}
	}
	return found;
}

function markersOf(document, keywords) {
	if (!document || document.getText().length > MAX_FILE_CHARS) return [];
	return scanText(document.getText(), keywords);
}

function severityOf(keyword) {
	if (keyword === 'FIXME' || keyword === 'XXX') return synapse.DiagnosticSeverity.Warning;
	if (keyword === 'HACK') return synapse.DiagnosticSeverity.Information;
	return synapse.DiagnosticSeverity.Hint;
}

function refresh() {
	const editor = synapse.window.activeTextEditor;
	const config = configuration();
	if (!editor || !config.enabled || !config.keywords.length) {
		if (editor && decoration) editor.setDecorations(decoration, []);
		if (statusItem) statusItem.hide();
		if (diagnostics) diagnostics.clear();
		return;
	}
	const markers = markersOf(editor.document, config.keywords);
	const ranges = markers.map((marker) => new synapse.Range(new synapse.Position(marker.line, marker.character), new synapse.Position(marker.line, marker.character + marker.length)));
	editor.setDecorations(decoration, ranges);
	if (diagnostics) {
		diagnostics.set(
			editor.document.uri,
			markers.map((marker, index) => {
				const diagnostic = new synapse.Diagnostic(ranges[index], marker.text, severityOf(marker.keyword));
				diagnostic.source = 'TODO';
				return diagnostic;
			}),
		);
	}
	statusItem.text = markers.length ? `${markers.length} marcador${markers.length === 1 ? '' : 'es'}` : '';
	statusItem.tooltip = markers.length ? `${config.keywords.join(', ')} neste arquivo. Clique para listar.` : '';
	if (markers.length) statusItem.show();
	else statusItem.hide();
}

function scheduleRefresh() {
	if (timer) clearTimeout(timer);
	timer = setTimeout(() => {
		timer = null;
		refresh();
	}, DEBOUNCE_MS);
}

async function listMarkers() {
	const editor = synapse.window.activeTextEditor;
	if (!editor) {
		synapse.window.showInformationMessage('Abra um arquivo para listar marcadores.');
		return;
	}
	const markers = markersOf(editor.document, configuration().keywords);
	if (!markers.length) {
		synapse.window.showInformationMessage('Nenhum marcador neste arquivo.');
		return;
	}
	const picked = await synapse.window.showQuickPick(
		markers.map((marker) => ({ label: `${marker.keyword}  L${marker.line + 1}`, description: marker.text, marker })),
		{ placeHolder: `${markers.length} marcador(es) — escolha para ir até a linha` },
	);
	if (!picked) return;
	const position = new synapse.Position(picked.marker.line, picked.marker.character);
	editor.selection = new synapse.Selection(position, position);
	editor.revealRange(new synapse.Range(position, position), synapse.TextEditorRevealType.InCenter);
}

async function toggle() {
	const config = synapse.workspace.getConfiguration('synapse.todo');
	const next = config.get('enabled', true) === false;
	await config.update('enabled', next, synapse.ConfigurationTarget.Global);
	synapse.window.showInformationMessage(next ? 'Destaque de marcadores ativado.' : 'Destaque de marcadores desativado.');
	refresh();
}

async function listMarkersTool(args) {
	const glob = String((args && args.glob) || '**/*');
	const limit = Math.min(Math.max(Number((args && args.maxResults) || 200), 1), 2000);
	const keywords = configuration().keywords;
	const paths = await synapse.workspace.findFilePaths(glob, SCAN_EXCLUDE, MAX_SCAN_FILES);
	const results = [];
	for (const path of paths) {
		if (results.length >= limit) break;
		if (!/\.(js|mjs|cjs|ts|tsx|jsx|json|md|html|css|scss|c|cc|cpp|h|hpp|py|rs|go|java|kt|swift|lua|zig|sh|yaml|yml|toml|txt)$/i.test(path)) continue;
		let text;
		try {
			text = new TextDecoder().decode(await synapse.workspace.fs.readFile(path));
		} catch (error) {
			continue;
		}
		if (text.length > MAX_FILE_CHARS) continue;
		scanText(text, keywords).forEach((marker) => {
			if (results.length < limit) results.push({ path, line: marker.line + 1, keyword: marker.keyword, text: marker.text });
		});
	}
	return { total: results.length, truncated: results.length >= limit, scannedFiles: paths.length, markers: results };
}

function activate(context) {
	decoration = synapse.window.createTextEditorDecorationType({
		backgroundColor: 'rgba(255, 196, 0, 0.22)',
		border: '1px solid rgba(255, 196, 0, 0.6)',
		borderRadius: '3px',
		overviewRulerColor: 'rgba(255, 196, 0, 0.9)',
		rangeBehavior: synapse.DecorationRangeBehavior.ClosedClosed,
	});
	statusItem = synapse.window.createStatusBarItem(synapse.StatusBarAlignment.Right, 5);
	statusItem.command = 'synapse.todo.list';
	diagnostics = synapse.languages.createDiagnosticCollection('todo');
	context.subscriptions.push(decoration, statusItem, diagnostics);
	context.subscriptions.push(synapse.commands.registerCommand('synapse.todo.list', listMarkers));
	context.subscriptions.push(synapse.commands.registerCommand('synapse.todo.toggle', toggle));
	context.subscriptions.push(synapse.window.onDidChangeActiveTextEditor(scheduleRefresh));
	context.subscriptions.push(synapse.workspace.onDidChangeTextDocument(scheduleRefresh));
	context.subscriptions.push(synapse.workspace.onDidChangeConfiguration((event) => {
		if (event.affectsConfiguration('synapse.todo')) refresh();
	}));
	context.subscriptions.push(synapse.mcp.registerTool('list_markers', (args) => listMarkersTool(args || {})));
	refresh();
}

function deactivate() {
	if (timer) clearTimeout(timer);
	timer = null;
}

module.exports = { activate, deactivate };
