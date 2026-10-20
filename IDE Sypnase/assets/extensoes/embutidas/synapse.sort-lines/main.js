const synapse = require('synapse');

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function sortLines(lines, options) {
	const compare = options.caseSensitive ? (a, b) => (a < b ? -1 : a > b ? 1 : 0) : (a, b) => collator.compare(a, b);
	const sorted = lines.slice().sort(compare);
	return options.descending ? sorted.reverse() : sorted;
}

function uniqueLines(lines, caseSensitive) {
	const seen = new Set();
	return lines.filter((line) => {
		const key = caseSensitive ? line : line.toLowerCase();
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function trimTrailing(lines) {
	return lines.map((line) => line.replace(/[ \t]+$/g, ''));
}

function lineRangeOf(editor) {
	const document = editor.document;
	const selection = editor.selection;
	if (selection.isEmpty) return new synapse.Range(new synapse.Position(0, 0), document.lineAt(Math.max(document.lineCount - 1, 0)).range.end);
	const endLine = selection.end.character === 0 && selection.end.line > selection.start.line ? selection.end.line - 1 : selection.end.line;
	return new synapse.Range(new synapse.Position(selection.start.line, 0), document.lineAt(endLine).range.end);
}

async function transform(handler) {
	const editor = synapse.window.activeTextEditor;
	if (!editor) {
		synapse.window.showWarningMessage('Abra um arquivo no editor para usar este comando.');
		return false;
	}
	const range = lineRangeOf(editor);
	const text = editor.document.getText(range);
	const lines = text.split(/\r?\n/);
	const next = handler(lines);
	const replacement = next.join(editor.document.eol === synapse.EndOfLine.CRLF ? '\r\n' : '\n');
	if (replacement === text) return true;
	return editor.edit((builder) => builder.replace(range, replacement));
}

function sortTextTool(args) {
	const lines = String(args.text || '').split(/\r?\n/);
	let result = sortLines(lines, { descending: !!args.descending, caseSensitive: !!args.caseSensitive });
	if (args.unique) result = uniqueLines(result, !!args.caseSensitive);
	return result.join('\n');
}

function activate(context) {
	const register = (id, handler) => context.subscriptions.push(synapse.commands.registerCommand(id, () => transform(handler)));
	register('synapse.sortLines.ascending', (lines) => sortLines(lines, { descending: false }));
	register('synapse.sortLines.descending', (lines) => sortLines(lines, { descending: true }));
	register('synapse.sortLines.unique', (lines) => uniqueLines(lines, true));
	register('synapse.sortLines.reverse', (lines) => lines.slice().reverse());
	register('synapse.sortLines.trimTrailing', trimTrailing);
	context.subscriptions.push(synapse.mcp.registerTool('sort_text', (args) => sortTextTool(args || {})));
}

module.exports = { activate };
