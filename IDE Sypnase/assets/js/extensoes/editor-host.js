(function (root) {
	'use strict';

	const MAX_DECORATION_TYPES = 64;
	const MAX_DECORATION_RANGES = 5000;
	const MAX_GUTTER_SVG_BYTES = 16 * 1024;
	const SELECTION_DEBOUNCE_MS = 40;
	const SCROLL_DEBOUNCE_MS = 100;

	const decorationTypes = new Map();
	let layer = null;
	let gutterLayer = null;
	let renderScheduled = false;
	let lastSelectionKey = '';
	let lastActiveKey = '';
	let lastVisibleKey = '';
	let selectionTimer = null;
	let scrollTimer = null;
	let pendingSelectionKind = 1;
	let metricsCache = null;

	function rpc() {
		return root.SynapseExtensionRpc;
	}

	function fail(code, message, data) {
		const api = rpc();
		return new api.RpcError(api.ERROR_CODES[code] || code, message, data);
	}

	function registry() {
		return root.SynapseExtensions;
	}

	function workspace() {
		return root.SynapseExtensionWorkspace;
	}

	function documents() {
		return root.SynapseEditorDocuments;
	}

	function elements() {
		return typeof el !== 'undefined' ? el : null;
	}

	function activeTextFile() {
		const project = typeof root.activeProject === 'function' ? root.activeProject() : null;
		if (!project || !project.openFile) return null;
		const entry = project.files.get(project.openFile);
		if (!entry || !entry.isText || typeof entry.text !== 'string') return null;
		const ui = elements();
		if (!ui || ui.editorGrid.classList.contains('hidden')) return null;
		return { project, path: project.openFile, entry };
	}

	function projection() {
		const folding = root.EditorFolding;
		return folding && typeof folding.projection === 'function' ? folding.projection() : null;
	}

	function toSourceOffset(displayOffset) {
		const current = projection();
		return current ? current.toSourceOffset(displayOffset) : displayOffset;
	}

	function toDisplayOffset(sourceOffset) {
		const current = projection();
		return current ? current.toDisplayOffset(sourceOffset) : sourceOffset;
	}

	function lineStarts(text) {
		const starts = [0];
		for (let index = text.indexOf('\n'); index >= 0; index = text.indexOf('\n', index + 1)) starts.push(index + 1);
		return starts;
	}

	function lineIndexAt(starts, offset) {
		let lower = 0;
		let upper = starts.length - 1;
		while (lower < upper) {
			const middle = Math.ceil((lower + upper) / 2);
			if (starts[middle] <= offset) lower = middle;
			else upper = middle - 1;
		}
		return lower;
	}

	function positionAt(text, starts, offset) {
		const clamped = Math.max(0, Math.min(text.length, offset));
		const line = lineIndexAt(starts, clamped);
		return { line, character: clamped - starts[line] };
	}

	function offsetAt(text, starts, position) {
		const line = Math.max(0, Math.min(starts.length - 1, Number(position && position.line) || 0));
		const lineStart = starts[line];
		const lineEnd = line + 1 < starts.length ? starts[line + 1] - 1 : text.length;
		return lineStart + Math.max(0, Math.min(lineEnd - lineStart, Number(position && position.character) || 0));
	}

	function editorOptions() {
		const ui = elements();
		const tabSize = ui ? Number(ui.codeTa.style.tabSize) || 2 : 2;
		const indentation = root.SynapseIndentation;
		const active = activeTextFile();
		const unit = indentation && active && typeof indentation.detectIndentation === 'function' ? indentation.detectIndentation(active.entry.text) : '  ';
		return { tabSize, insertSpaces: unit !== '\t' };
	}

	function lineHeight() {
		const ui = elements();
		if (!ui) return 20;
		const value = parseFloat(getComputedStyle(ui.editorGrid).lineHeight);
		return Number.isFinite(value) && value > 0 ? value : 20;
	}

	function visibleRanges(active) {
		const ui = elements();
		if (!ui || !active) return [];
		const height = lineHeight();
		const scroll = ui.editorScroll;
		const padding = 10;
		const firstDisplay = Math.max(0, Math.floor((scroll.scrollTop - padding) / height));
		const lastDisplay = Math.max(firstDisplay, Math.ceil((scroll.scrollTop + scroll.clientHeight - padding) / height));
		const current = projection();
		const totalLines = active.entry.text.split('\n').length;
		const mapLine = (displayLine) => {
			if (!current) return Math.min(totalLines - 1, displayLine);
			const index = Math.min(current.visibleLines.length - 1, displayLine);
			return current.visibleLines[Math.max(0, index)];
		};
		return [{ start: { line: mapLine(firstDisplay), character: 0 }, end: { line: mapLine(lastDisplay), character: 0 } }];
	}

	function selectionsOf(active) {
		const ui = elements();
		if (!ui || !active) return [];
		const text = active.entry.text;
		const starts = lineStarts(text);
		const start = toSourceOffset(ui.codeTa.selectionStart);
		const end = toSourceOffset(ui.codeTa.selectionEnd);
		const backward = ui.codeTa.selectionDirection === 'backward';
		const anchor = positionAt(text, starts, backward ? end : start);
		const activePosition = positionAt(text, starts, backward ? start : end);
		return [{ anchor, active: activePosition, start: positionAt(text, starts, start), end: positionAt(text, starts, end) }];
	}

	function snapshot(includeDocument) {
		const active = activeTextFile();
		if (!active) return null;
		const document = workspace() ? workspace().describeDocument(active.project, active.path, includeDocument !== false) : null;
		if (!document) return null;
		return {
			uri: document.uri,
			path: active.path,
			projectId: active.project.id,
			document,
			selections: selectionsOf(active),
			visibleRanges: visibleRanges(active),
			options: editorOptions(),
		};
	}

	function isActiveDocument(project, path) {
		const active = activeTextFile();
		return !!active && active.project === project && active.path === path;
	}

	function requireActive(params) {
		const active = activeTextFile();
		if (!active) throw fail('HOST_ERROR', 'Nenhum editor de texto ativo.');
		if (params && params.path && workspace() && workspace().relativeOf(params.path) !== active.path) {
			throw fail('HOST_ERROR', `O editor ativo agora é "${active.path}", não "${params.path}".`, { code: 'EditorChanged' });
		}
		if (params && params.version !== undefined && params.version !== null && workspace()) {
			const document = workspace().describeDocument(active.project, active.path, false);
			if (document && document.version !== params.version) throw fail('HOST_ERROR', `Documento mudou (versão ${document.version} ≠ ${params.version}).`, { code: 'VersionMismatch' });
		}
		return active;
	}

	function mapOffset(offset, start, end, insertedLength) {
		if (offset <= start) return offset;
		if (offset >= end) return offset + insertedLength - (end - start);
		return start + insertedLength;
	}

	function replaceSource(active, nextText, selectionHint) {
		const ui = elements();
		const previous = active.entry.text;
		if (previous === nextText) return true;
		const change = workspace() ? workspace().computeChange(previous, nextText) : { rangeOffset: 0, rangeLength: previous.length, text: nextText };
		const start = change.rangeOffset;
		const end = change.rangeOffset + change.rangeLength;
		const currentStart = toSourceOffset(ui.codeTa.selectionStart);
		const currentEnd = toSourceOffset(ui.codeTa.selectionEnd);
		let selectionStart = mapOffset(currentStart, start, end, change.text.length);
		let selectionEnd = mapOffset(currentEnd, start, end, change.text.length);
		if (selectionHint) {
			selectionStart = Math.max(0, Math.min(nextText.length, selectionHint.start));
			selectionEnd = Math.max(0, Math.min(nextText.length, selectionHint.end));
		}
		const applied = documents().applyEdit({
			start,
			end,
			text: change.text,
			selectionStart,
			selectionEnd,
			direction: selectionHint && selectionHint.direction ? selectionHint.direction : ui.codeTa.selectionDirection,
		});
		if (!applied) {
			active.entry.text = nextText;
			active.entry.data = null;
			active.project.dirty.add(active.path);
			if (typeof root.openFileInEditor === 'function') root.openFileInEditor(active.path);
		}
		return true;
	}

	function syncFromModel() {
		const active = activeTextFile();
		const ui = elements();
		if (!active || !ui) return;
		const current = projection();
		const displayed = current ? current.source : ui.codeTa.value;
		if (displayed === active.entry.text) return;
		const nextText = active.entry.text;
		active.entry.text = displayed;
		replaceSource(active, nextText, null);
		active.entry.text = nextText;
	}

	function edit(params) {
		const active = requireActive(params);
		const text = active.entry.text;
		const starts = lineStarts(text);
		const edits = (Array.isArray(params.edits) ? params.edits : []).map((item) => {
			const start = offsetAt(text, starts, item.start || { line: 0, character: 0 });
			const end = offsetAt(text, starts, item.end || item.start || { line: 0, character: 0 });
			return { start: Math.min(start, end), end: Math.max(start, end), text: String(item.text === undefined ? '' : item.text) };
		});
		if (!edits.length) return { applied: true, version: params.version };
		edits.sort((a, b) => b.start - a.start || b.end - a.end);
		for (let index = 1; index < edits.length; index += 1) {
			if (edits[index].end > edits[index - 1].start) throw fail('INVALID_PARAMS', 'Edições sobrepostas.');
		}
		let next = text;
		edits.forEach((item) => {
			next = next.slice(0, item.start) + item.text + next.slice(item.end);
		});
		let hint = null;
		if (edits.length === 1 && params.selectAfter) {
			const single = edits[0];
			hint = { start: single.start + single.text.length, end: single.start + single.text.length };
		}
		replaceSource(active, next, hint);
		const document = workspace() ? workspace().describeDocument(active.project, active.path, false) : null;
		return { applied: true, version: document ? document.version : undefined };
	}

	function leadingWhitespace(line) {
		const match = /^[ \t]*/.exec(line);
		return match ? match[0] : '';
	}

	function snippetVariables(active, selectionStart, selectionEnd) {
		const text = active.entry.text;
		const starts = lineStarts(text);
		const position = positionAt(text, starts, selectionStart);
		const lineEnd = position.line + 1 < starts.length ? starts[position.line + 1] - 1 : text.length;
		const currentLine = text.slice(starts[position.line], lineEnd);
		const now = new Date();
		const basename = active.path.split('/').pop();
		const dot = basename.lastIndexOf('.');
		const project = active.project;
		return {
			TM_SELECTED_TEXT: text.slice(selectionStart, selectionEnd),
			TM_CURRENT_LINE: currentLine,
			TM_CURRENT_WORD: (/[\w$]+$/.exec(currentLine.slice(0, position.character)) || [''])[0] + (/^[\w$]+/.exec(currentLine.slice(position.character)) || [''])[0],
			TM_LINE_INDEX: String(position.line),
			TM_LINE_NUMBER: String(position.line + 1),
			TM_FILENAME: basename,
			TM_FILENAME_BASE: dot > 0 ? basename.slice(0, dot) : basename,
			TM_DIRECTORY: active.path.includes('/') ? active.path.slice(0, active.path.lastIndexOf('/')) : '',
			TM_FILEPATH: active.path,
			RELATIVE_FILEPATH: active.path,
			WORKSPACE_NAME: project.name || '',
			WORKSPACE_FOLDER: '',
			CURRENT_YEAR: String(now.getFullYear()),
			CURRENT_YEAR_SHORT: String(now.getFullYear()).slice(-2),
			CURRENT_MONTH: String(now.getMonth() + 1).padStart(2, '0'),
			CURRENT_DATE: String(now.getDate()).padStart(2, '0'),
			CURRENT_HOUR: String(now.getHours()).padStart(2, '0'),
			CURRENT_MINUTE: String(now.getMinutes()).padStart(2, '0'),
			CURRENT_SECOND: String(now.getSeconds()).padStart(2, '0'),
			CURRENT_DAY_NAME: now.toLocaleDateString(document.documentElement.lang || 'pt', { weekday: 'long' }),
			CURRENT_MONTH_NAME: now.toLocaleDateString(document.documentElement.lang || 'pt', { month: 'long' }),
			CURRENT_TIMEZONE_OFFSET: (() => {
				const minutes = -now.getTimezoneOffset();
				const sign = minutes >= 0 ? '+' : '-';
				const absolute = Math.abs(minutes);
				return sign + String(Math.floor(absolute / 60)).padStart(2, '0') + ':' + String(absolute % 60).padStart(2, '0');
			})(),
			CLIPBOARD: '',
			RANDOM: String(Math.floor(Math.random() * 1e6)).padStart(6, '0'),
			RANDOM_HEX: Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'),
			UUID: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
			BLOCK_COMMENT_START: '/*',
			BLOCK_COMMENT_END: '*/',
			LINE_COMMENT: '//',
		};
	}

	function parseSnippet(source, variables) {
		const tabstops = new Map();
		let cursor = -1;
		let output = '';
		let index = 0;
		const text = String(source);
		function record(number, start, end) {
			if (number === 0) {
				cursor = start;
				return;
			}
			if (!tabstops.has(number)) tabstops.set(number, { start, end });
		}
		function readBalanced(from) {
			let depth = 1;
			let position = from;
			while (position < text.length && depth > 0) {
				const char = text[position];
				if (char === '\\') position += 2;
				else {
					if (char === '{') depth += 1;
					else if (char === '}') depth -= 1;
					position += 1;
				}
			}
			return position;
		}
		while (index < text.length) {
			const char = text[index];
			if (char === '\\' && index + 1 < text.length) {
				output += text[index + 1];
				index += 2;
				continue;
			}
			if (char !== '$') {
				output += char;
				index += 1;
				continue;
			}
			const simple = /^\$(\d+)/.exec(text.slice(index));
			if (simple) {
				record(Number(simple[1]), output.length, output.length);
				index += simple[0].length;
				continue;
			}
			const variable = /^\$([A-Z_][A-Z0-9_]*)/.exec(text.slice(index));
			if (variable) {
				output += Object.prototype.hasOwnProperty.call(variables, variable[1]) ? variables[variable[1]] : variable[1];
				index += variable[0].length;
				continue;
			}
			if (text[index + 1] === '{') {
				const close = readBalanced(index + 2);
				const inner = text.slice(index + 2, close - 1);
				index = close;
				const numbered = /^(\d+)(?::([\s\S]*)|\|([\s\S]*)\||\/([\s\S]*))?$/.exec(inner);
				if (numbered) {
					const number = Number(numbered[1]);
					const start = output.length;
					if (numbered[2] !== undefined) {
						const nested = parseSnippet(numbered[2], variables);
						output += nested.text;
					} else if (numbered[3] !== undefined) {
						output += numbered[3].split(',')[0] || '';
					}
					record(number, start, output.length);
					continue;
				}
				const named = /^([A-Z_][A-Z0-9_]*)(?::([\s\S]*)|\/([\s\S]*))?$/.exec(inner);
				if (named) {
					const value = Object.prototype.hasOwnProperty.call(variables, named[1]) ? variables[named[1]] : '';
					if (value) output += value;
					else if (named[2] !== undefined) output += parseSnippet(named[2], variables).text;
					continue;
				}
				output += '${' + inner + '}';
				continue;
			}
			output += char;
			index += 1;
		}
		return { text: output, tabstops, cursor };
	}

	function insertSnippet(params) {
		const active = requireActive(params);
		const ui = elements();
		const text = active.entry.text;
		const starts = lineStarts(text);
		let start = toSourceOffset(ui.codeTa.selectionStart);
		let end = toSourceOffset(ui.codeTa.selectionEnd);
		if (params.range && params.range.start) {
			start = offsetAt(text, starts, params.range.start);
			end = offsetAt(text, starts, params.range.end || params.range.start);
		} else if (params.position) {
			start = end = offsetAt(text, starts, params.position);
		}
		if (start > end) [start, end] = [end, start];
		const variables = snippetVariables(active, start, end);
		const parsed = parseSnippet(params.snippet, variables);
		const linePosition = positionAt(text, starts, start);
		const lineEnd = linePosition.line + 1 < starts.length ? starts[linePosition.line + 1] - 1 : text.length;
		const indent = leadingWhitespace(text.slice(starts[linePosition.line], lineEnd));
		const lines = parsed.text.split('\n');
		let body = lines[0];
		let shift = 0;
		const adjustments = [];
		for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
			adjustments.push({ at: body.length + 1, added: indent.length });
			body += '\n' + indent + lines[lineIndex];
		}
		function adjust(offset) {
			let delta = 0;
			let consumed = 0;
			for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
				consumed += lines[lineIndex - 1].length + 1;
				if (offset >= consumed) delta += indent.length;
				else break;
			}
			return offset + delta;
		}
		shift = start;
		let selection;
		if (parsed.cursor >= 0) selection = { start: shift + adjust(parsed.cursor), end: shift + adjust(parsed.cursor) };
		else if (parsed.tabstops.size) {
			const first = [...parsed.tabstops.keys()].sort((a, b) => a - b)[0];
			const stop = parsed.tabstops.get(first);
			selection = { start: shift + adjust(stop.start), end: shift + adjust(stop.end) };
		} else selection = { start: shift + body.length, end: shift + body.length };
		const next = text.slice(0, start) + body + text.slice(end);
		replaceSource(active, next, selection);
		return { applied: true, inserted: body.length };
	}

	function setSelections(params) {
		const active = requireActive(params);
		const ui = elements();
		const list = Array.isArray(params.selections) ? params.selections : [];
		if (!list.length) return null;
		const text = active.entry.text;
		const starts = lineStarts(text);
		const first = list[0];
		const anchor = offsetAt(text, starts, first.anchor || first.start);
		const head = offsetAt(text, starts, first.active || first.end || first.start);
		if (root.EditorFolding && typeof root.EditorFolding.expandBeforeInput === 'function' && ui.codeTa.classList.contains('folded')) root.EditorFolding.expandBeforeInput();
		ui.codeTa.setSelectionRange(toDisplayOffset(Math.min(anchor, head)), toDisplayOffset(Math.max(anchor, head)), head < anchor ? 'backward' : 'forward');
		if (params.reveal !== false) revealRange({ range: { start: positionAt(text, starts, Math.min(anchor, head)), end: positionAt(text, starts, Math.max(anchor, head)) }, type: 2 });
		pendingSelectionKind = 3;
		scheduleSelectionEvent();
		return null;
	}

	function revealRange(params) {
		const active = requireActive(params);
		const ui = elements();
		const range = params.range || {};
		const startLine = Number(range.start && range.start.line) || 0;
		const endLine = Number(range.end && range.end.line) || startLine;
		const current = projection();
		const displayLine = (line) => {
			if (!current) return line;
			let index = 0;
			while (index + 1 < current.visibleLines.length && current.visibleLines[index + 1] <= line) index += 1;
			return index;
		};
		const height = lineHeight();
		const top = displayLine(startLine) * height + 10;
		const bottom = (displayLine(endLine) + 1) * height + 10;
		const scroll = ui.editorScroll;
		const type = Number(params.type) || 0;
		const viewTop = scroll.scrollTop;
		const viewBottom = viewTop + scroll.clientHeight;
		const visible = top >= viewTop && bottom <= viewBottom;
		if (type === 3) scroll.scrollTop = Math.max(0, top - 10);
		else if (type === 1 || (type === 2 && !visible)) scroll.scrollTop = Math.max(0, (top + bottom) / 2 - scroll.clientHeight / 2);
		else if (type === 0 && !visible) scroll.scrollTop = top < viewTop ? Math.max(0, top - height) : bottom - scroll.clientHeight + height;
		return null;
	}

	function show(params, context) {
		const project = registry().projectFor(context.descriptor.id);
		if (!project) throw fail('HOST_ERROR', 'Nenhum projeto aberto para esta extensão.');
		const path = workspace().relativeOf(params.path);
		if (!project.files.has(path)) throw fail('HOST_ERROR', `Arquivo "${path}" não encontrado.`, { code: 'FileNotFound' });
		if (root.State && root.State.active !== project.id && typeof root.switchProject === 'function') root.switchProject(project.id);
		if (typeof root.openFileInEditor === 'function') root.openFileInEditor(path);
		if (params.selection) setSelections({ selections: [params.selection], reveal: true });
		if (params.preserveFocus === false && elements()) elements().codeTa.focus({ preventScroll: true });
		return snapshot(true);
	}

	function createDecorationType(params, context) {
		const extensionId = context.descriptor.id;
		if (!decorationTypes.has(extensionId)) decorationTypes.set(extensionId, new Map());
		const own = decorationTypes.get(extensionId);
		if (own.size >= MAX_DECORATION_TYPES) throw fail('HOST_ERROR', `Limite de ${MAX_DECORATION_TYPES} tipos de decoração por extensão.`);
		const options = sanitizeDecoration(params.options || {});
		own.set(String(params.handle), { options, ranges: [], path: null });
		return { handle: String(params.handle) };
	}

	const COLOR_PATTERN = /^(#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|var\(--[a-z0-9-]+\)|[a-z]{3,20}|transparent|currentcolor)$/i;
	const LENGTH_PATTERN = /^-?\d+(\.\d+)?(px|em|rem|%)?$/;

	function color(value) {
		if (!value) return '';
		if (typeof value === 'object' && typeof value.id === 'string') return `var(--${value.id.replace(/[^a-z0-9-]/gi, '-')})`;
		const text = String(value).trim();
		return COLOR_PATTERN.test(text) ? text : '';
	}

	function length(value) {
		if (value === undefined || value === null || value === '') return '';
		const text = String(value).trim();
		return LENGTH_PATTERN.test(text) ? text : '';
	}

	function shorthand(value, max) {
		if (!value) return '';
		const text = String(value).trim().slice(0, max || 60);
		return /^[\w\s#.,%()-]+$/i.test(text) ? text : '';
	}

	function attachment(spec) {
		if (!spec || typeof spec !== 'object') return null;
		return {
			contentText: spec.contentText !== undefined ? String(spec.contentText).slice(0, 200) : '',
			color: color(spec.color),
			backgroundColor: color(spec.backgroundColor),
			border: shorthand(spec.border),
			margin: shorthand(spec.margin),
			fontStyle: /^(italic|normal|oblique)$/.test(String(spec.fontStyle || '')) ? String(spec.fontStyle) : '',
			fontWeight: /^(bold|normal|[1-9]00)$/.test(String(spec.fontWeight || '')) ? String(spec.fontWeight) : '',
			textDecoration: shorthand(spec.textDecoration),
			width: length(spec.width),
			height: length(spec.height),
		};
	}

	function sanitizeDecoration(raw) {
		let gutterIconSvg = '';
		if (typeof raw.gutterIconSvg === 'string' && raw.gutterIconSvg.length <= MAX_GUTTER_SVG_BYTES && /^\s*<svg[\s>]/i.test(raw.gutterIconSvg) && !/<script|on[a-z]+\s*=|javascript:|<foreignObject|href\s*=/i.test(raw.gutterIconSvg)) {
			gutterIconSvg = raw.gutterIconSvg;
		}
		return {
			isWholeLine: !!raw.isWholeLine,
			backgroundColor: color(raw.backgroundColor),
			border: shorthand(raw.border),
			borderColor: color(raw.borderColor),
			borderRadius: length(raw.borderRadius),
			borderStyle: /^(solid|dashed|dotted|double|none)$/.test(String(raw.borderStyle || '')) ? String(raw.borderStyle) : '',
			borderWidth: length(raw.borderWidth),
			outline: shorthand(raw.outline),
			opacity: raw.opacity !== undefined && Number.isFinite(Number(raw.opacity)) ? String(Math.max(0, Math.min(1, Number(raw.opacity)))) : '',
			textDecoration: shorthand(raw.textDecoration),
			gutterIconSvg,
			gutterIconColor: color(raw.gutterIconColor || raw.overviewRulerColor),
			after: attachment(raw.after),
			before: attachment(raw.before),
		};
	}

	function setDecorations(params, context) {
		const own = decorationTypes.get(context.descriptor.id);
		const type = own ? own.get(String(params.handle)) : null;
		if (!type) throw fail('HOST_ERROR', `Tipo de decoração "${params.handle}" não existe (foi descartado?).`);
		const list = Array.isArray(params.ranges) ? params.ranges.slice(0, MAX_DECORATION_RANGES) : [];
		type.path = params.path ? workspace().relativeOf(params.path) : activeTextFile() ? activeTextFile().path : null;
		type.ranges = list.map((item) => {
			const range = item.range || item;
			return {
				start: { line: Math.max(0, Number(range.start && range.start.line) || 0), character: Math.max(0, Number(range.start && range.start.character) || 0) },
				end: { line: Math.max(0, Number(range.end && range.end.line) || 0), character: Math.max(0, Number(range.end && range.end.character) || 0) },
				hoverMessage: item.hoverMessage ? String(item.hoverMessage).slice(0, 500) : '',
				renderOptions: item.renderOptions ? { after: attachment(item.renderOptions.after), before: attachment(item.renderOptions.before) } : null,
			};
		});
		scheduleRender();
		return { count: type.ranges.length };
	}

	function disposeDecorationType(params, context) {
		const own = decorationTypes.get(context.descriptor.id);
		if (own) own.delete(String(params.handle));
		scheduleRender();
		return null;
	}

	function disposeAll(extensionId) {
		decorationTypes.delete(extensionId);
		scheduleRender();
	}

	function ensureLayers() {
		const ui = elements();
		if (!ui) return false;
		if (!layer || !layer.isConnected) {
			layer = document.createElement('div');
			layer.className = 'ext-deco-layer';
			layer.setAttribute('aria-hidden', 'true');
			ui.codeHl.parentElement.insertBefore(layer, ui.codeHl.nextSibling);
		}
		if (!gutterLayer || !gutterLayer.isConnected) {
			gutterLayer = document.createElement('div');
			gutterLayer.className = 'ext-gutter-layer';
			gutterLayer.setAttribute('aria-hidden', 'true');
			ui.gutter.appendChild(gutterLayer);
		}
		return true;
	}

	function metrics() {
		const ui = elements();
		const font = getComputedStyle(ui.codeHl).font;
		if (metricsCache && metricsCache.font === font) return metricsCache;
		const probe = document.createElement('span');
		probe.textContent = 'MMMMMMMMMM';
		probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;left:-9999px;top:0;font:' + font;
		ui.codeHl.parentElement.appendChild(probe);
		const width = probe.getBoundingClientRect().width / 10;
		probe.remove();
		metricsCache = { font, charWidth: width || 7, lineHeight: lineHeight() };
		return metricsCache;
	}

	function visualColumn(lineText, character, tabSize) {
		let column = 0;
		const limit = Math.min(character, lineText.length);
		for (let index = 0; index < limit; index += 1) {
			if (lineText.charCodeAt(index) === 9) column += tabSize - (column % tabSize);
			else column += 1;
		}
		return column + Math.max(0, character - lineText.length);
	}

	function scheduleRender() {
		if (renderScheduled) return;
		renderScheduled = true;
		requestAnimationFrame(() => {
			renderScheduled = false;
			render();
		});
	}

	function styleFor(options, element) {
		if (options.backgroundColor) element.style.backgroundColor = options.backgroundColor;
		if (options.border) element.style.border = options.border;
		if (options.borderColor) element.style.borderColor = options.borderColor;
		if (options.borderStyle) element.style.borderStyle = options.borderStyle;
		if (options.borderWidth) element.style.borderWidth = options.borderWidth;
		if (options.borderRadius) element.style.borderRadius = options.borderRadius;
		if (options.outline) element.style.outline = options.outline;
		if (options.opacity) element.style.opacity = options.opacity;
		if (options.textDecoration) element.style.borderBottom = options.textDecoration.includes('underline') ? '1px solid ' + (options.borderColor || 'currentColor') : element.style.borderBottom;
	}

	function attachmentElement(spec, className) {
		if (!spec || !spec.contentText) return null;
		const element = document.createElement('span');
		element.className = className;
		element.textContent = spec.contentText;
		if (spec.color) element.style.color = spec.color;
		if (spec.backgroundColor) element.style.backgroundColor = spec.backgroundColor;
		if (spec.border) element.style.border = spec.border;
		if (spec.margin) element.style.margin = spec.margin;
		if (spec.fontStyle) element.style.fontStyle = spec.fontStyle;
		if (spec.fontWeight) element.style.fontWeight = spec.fontWeight;
		if (spec.textDecoration) element.style.textDecoration = spec.textDecoration;
		return element;
	}

	function render() {
		if (!ensureLayers()) return;
		const ui = elements();
		const active = activeTextFile();
		layer.replaceChildren();
		gutterLayer.replaceChildren();
		layer.style.transform = ui.codeHl.style.transform || '';
		if (!active) return;
		const text = active.entry.text;
		const starts = lineStarts(text);
		const lines = text.split('\n');
		const current = projection();
		const collapsed = current ? current.collapsedLines : null;
		const displayIndex = new Map();
		if (current) current.visibleLines.forEach((line, index) => displayIndex.set(line, index));
		const { charWidth, lineHeight: height } = metrics();
		const tabSize = Number(ui.codeTa.style.tabSize) || 2;
		const displayLineOf = (line) => {
			if (!current) return line;
			if (displayIndex.has(line)) return displayIndex.get(line);
			let index = 0;
			while (index + 1 < current.visibleLines.length && current.visibleLines[index + 1] <= line) index += 1;
			return collapsed && collapsed.has(current.visibleLines[index]) ? -1 : index;
		};
		const fragment = document.createDocumentFragment();
		const gutterFragment = document.createDocumentFragment();
		const gutterSeen = new Set();
		decorationTypes.forEach((own, extensionId) => {
			own.forEach((type, handle) => {
				if (type.path !== active.path || !type.ranges.length) return;
				type.ranges.forEach((range) => {
					const startLine = Math.min(range.start.line, lines.length - 1);
					const endLine = Math.min(range.end.line, lines.length - 1);
					for (let line = startLine; line <= endLine; line += 1) {
						const displayLine = displayLineOf(line);
						if (displayLine < 0) continue;
						const lineText = lines[line];
						const fromCharacter = line === startLine ? range.start.character : 0;
						const toCharacter = line === endLine ? range.end.character : lineText.length;
						const startColumn = visualColumn(lineText, fromCharacter, tabSize);
						const endColumn = Math.max(startColumn, visualColumn(lineText, toCharacter, tabSize));
						const element = document.createElement('div');
						element.className = 'ext-deco';
						element.dataset.extension = extensionId;
						element.dataset.handle = handle;
						element.style.top = displayLine * height + 'px';
						element.style.height = height + 'px';
						if (type.options.isWholeLine) {
							element.style.left = '0';
							element.style.right = '0';
						} else {
							element.style.left = startColumn * charWidth + 'px';
							element.style.width = Math.max(charWidth * 0.5, (endColumn - startColumn) * charWidth) + 'px';
						}
						styleFor(type.options, element);
						if (range.hoverMessage) element.title = range.hoverMessage;
						if (line === startLine) {
							const before = attachmentElement((range.renderOptions && range.renderOptions.before) || type.options.before, 'ext-deco-before');
							if (before) element.appendChild(before);
						}
						if (line === endLine) {
							const after = attachmentElement((range.renderOptions && range.renderOptions.after) || type.options.after, 'ext-deco-after');
							if (after) {
								if (type.options.isWholeLine) after.style.left = (visualColumn(lineText, lineText.length, tabSize) * charWidth) + 'px';
								element.appendChild(after);
							}
						}
						fragment.appendChild(element);
						if ((type.options.gutterIconSvg || type.options.gutterIconColor) && !gutterSeen.has(handle + ':' + displayLine)) {
							gutterSeen.add(handle + ':' + displayLine);
							const marker = document.createElement('div');
							marker.className = 'ext-gutter-mark';
							marker.style.top = displayLine * height + 'px';
							marker.style.height = height + 'px';
							if (type.options.gutterIconSvg) {
								const icon = document.createElement('img');
								icon.alt = '';
								icon.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(type.options.gutterIconSvg);
								marker.appendChild(icon);
							} else marker.style.setProperty('--ext-gutter-color', type.options.gutterIconColor);
							if (range.hoverMessage) marker.title = range.hoverMessage;
							gutterFragment.appendChild(marker);
						}
					}
				});
			});
		});
		layer.appendChild(fragment);
		gutterLayer.appendChild(gutterFragment);
	}

	function broadcastEditor(method, params) {
		if (!registry()) return;
		const active = activeTextFile();
		registry().broadcast(method, params, (item) => {
			if (!item.capabilities.has('editor')) return false;
			if (!active || item.capabilities.has('workspace.all')) return true;
			const own = registry().projectFor(item.id);
			return !!own && own.id === active.project.id;
		});
	}

	function notifyActiveChanged() {
		const current = snapshot(true);
		const key = current ? current.projectId + '::' + current.path : '';
		if (key === lastActiveKey && !current) return;
		if (key === lastActiveKey) {
			scheduleSelectionEvent();
			return;
		}
		lastActiveKey = key;
		lastSelectionKey = current ? selectionKey(current.selections) : '';
		lastVisibleKey = current ? JSON.stringify(current.visibleRanges) : '';
		broadcastEditor('editor.activeChanged', { editor: current });
		scheduleRender();
	}

	function selectionKey(selections) {
		return JSON.stringify(selections);
	}

	function scheduleSelectionEvent() {
		clearTimeout(selectionTimer);
		selectionTimer = setTimeout(() => {
			const current = snapshot(false);
			if (!current) return;
			const key = current.projectId + '::' + current.path;
			if (key !== lastActiveKey) {
				notifyActiveChanged();
				return;
			}
			const selectionSignature = selectionKey(current.selections);
			if (selectionSignature === lastSelectionKey) return;
			lastSelectionKey = selectionSignature;
			broadcastEditor('editor.selectionChanged', { path: current.path, uri: current.uri, selections: current.selections, kind: pendingSelectionKind });
			pendingSelectionKind = 1;
		}, SELECTION_DEBOUNCE_MS);
	}

	function scheduleVisibleEvent() {
		clearTimeout(scrollTimer);
		scrollTimer = setTimeout(() => {
			const current = snapshot(false);
			if (!current) return;
			const key = JSON.stringify(current.visibleRanges);
			if (key === lastVisibleKey) return;
			lastVisibleKey = key;
			broadcastEditor('editor.visibleRangesChanged', { path: current.path, uri: current.uri, visibleRanges: current.visibleRanges });
		}, SCROLL_DEBOUNCE_MS);
	}

	function bind() {
		const ui = elements();
		if (!ui) return;
		ui.codeTa.addEventListener('keyup', () => {
			pendingSelectionKind = 1;
			scheduleSelectionEvent();
		});
		ui.codeTa.addEventListener('mouseup', () => {
			pendingSelectionKind = 2;
			scheduleSelectionEvent();
		});
		ui.codeTa.addEventListener('input', scheduleSelectionEvent);
		ui.codeTa.addEventListener('focus', scheduleSelectionEvent);
		document.addEventListener('selectionchange', () => {
			if (document.activeElement === ui.codeTa) scheduleSelectionEvent();
		});
		ui.codeTa.addEventListener('scroll', () => {
			if (layer) layer.style.transform = ui.codeHl.style.transform || '';
		}, { passive: true });
		ui.editorScroll.addEventListener('scroll', scheduleVisibleEvent, { passive: true });
		root.addEventListener('synapse:editor-painted', () => {
			metricsCache = null;
			scheduleRender();
			scheduleVisibleEvent();
		});
		root.addEventListener('resize', () => {
			metricsCache = null;
			scheduleRender();
		});
	}

	const handlers = {
		'editor.active': () => snapshot(true),
		'editor.edit': (params) => edit(params),
		'editor.insertSnippet': (params) => insertSnippet(params),
		'editor.setSelections': (params) => setSelections(params),
		'editor.revealRange': (params) => revealRange(params),
		'editor.show': (params, context) => show(params, context),
		'editor.decorations.create': (params, context) => createDecorationType(params, context),
		'editor.decorations.set': (params, context) => setDecorations(params, context),
		'editor.decorations.dispose': (params, context) => disposeDecorationType(params, context),
	};

	root.SynapseExtensionEditor = Object.freeze({
		handlers,
		snapshot,
		isActiveDocument,
		syncFromModel,
		notifyActiveChanged,
		scheduleRender,
		disposeAll,
		parseSnippet,
		initialPayload(item) {
			return item.capabilities.has('editor') ? snapshot(true) : null;
		},
	});

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
	else bind();
})(window);
