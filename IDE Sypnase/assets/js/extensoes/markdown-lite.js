(function (root) {
	'use strict';

	const SAFE_URL = /^(https?:\/\/|mailto:)/i;
	const MAX_INPUT = 400000;

	function esc(text) {
		return String(text).replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
	}

	function safeHref(url) {
		const value = String(url || '').trim();
		return SAFE_URL.test(value) ? value : '';
	}

	function emphasis(text) {
		let html = esc(text);
		html = html.replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '<strong>$2</strong>');
		html = html.replace(/(^|[^*\w])\*(?=\S)([^*]*?\S)\*(?!\w)/g, '$1<em>$2</em>');
		html = html.replace(/(^|[^_\w])_(?=\S)([^_]*?\S)_(?!\w)/g, '$1<em>$2</em>');
		html = html.replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>');
		return html;
	}

	function inline(text) {
		let out = '';
		let rest = String(text);
		while (rest.length) {
			const code = /`([^`]+)`/.exec(rest);
			const img = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/.exec(rest);
			const link = /\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/.exec(rest);
			const auto = /(^|[\s(])(https?:\/\/[^\s<>)]+)/.exec(rest);
			const candidates = [code, img, link, auto].filter(Boolean).sort((a, b) => a.index - b.index);
			if (!candidates.length) {
				out += emphasis(rest);
				break;
			}
			const first = candidates[0];
			out += emphasis(rest.slice(0, first.index));
			if (first === code) out += `<code>${esc(first[1])}</code>`;
			else if (first === img) out += `<span class="md-image">[imagem: ${esc(first[1] || first[2])}]</span>`;
			else if (first === link) {
				const href = safeHref(first[2]);
				out += href ? `<a href="${esc(href)}" data-md-link rel="noopener noreferrer" target="_blank">${emphasis(first[1])}</a>` : emphasis(first[1]);
			} else {
				const href = safeHref(first[2]);
				out += esc(first[1]) + (href ? `<a href="${esc(href)}" data-md-link rel="noopener noreferrer" target="_blank">${esc(first[2])}</a>` : esc(first[2]));
			}
			rest = rest.slice(first.index + first[0].length);
		}
		return out;
	}

	function tableRow(line) {
		return line
			.trim()
			.replace(/^\||\|$/g, '')
			.split('|')
			.map((cell) => cell.trim());
	}

	function isTableSeparator(line) {
		return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);
	}

	function render(source) {
		let text = String(source || '');
		if (text.length > MAX_INPUT) text = text.slice(0, MAX_INPUT) + '\n\n_(conteúdo truncado)_';
		const lines = text.replace(/\r\n?/g, '\n').split('\n');
		const html = [];
		let paragraph = [];
		let list = null;
		let quote = [];
		let i = 0;

		function flushParagraph() {
			if (!paragraph.length) return;
			html.push(`<p>${inline(paragraph.join(' '))}</p>`);
			paragraph = [];
		}

		function flushList() {
			if (!list) return;
			html.push(`<${list.tag}>${list.items.map((item) => `<li>${item}</li>`).join('')}</${list.tag}>`);
			list = null;
		}

		function flushQuote() {
			if (!quote.length) return;
			html.push(`<blockquote>${render(quote.join('\n'))}</blockquote>`);
			quote = [];
		}

		function flushAll() {
			flushParagraph();
			flushList();
			flushQuote();
		}

		while (i < lines.length) {
			const line = lines[i];
			const fence = /^\s*(```|~~~)\s*([\w+#.-]*)\s*$/.exec(line);
			if (fence) {
				flushAll();
				const marker = fence[1];
				const language = fence[2];
				const code = [];
				i++;
				while (i < lines.length && !new RegExp('^\\s*' + marker + '\\s*$').test(lines[i])) {
					code.push(lines[i]);
					i++;
				}
				i++;
				html.push(`<pre><code${language ? ` data-lang="${esc(language)}"` : ''}>${esc(code.join('\n'))}</code></pre>`);
				continue;
			}
			const heading = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
			if (heading) {
				flushAll();
				const level = heading[1].length;
				html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
				i++;
				continue;
			}
			if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) {
				flushAll();
				html.push('<hr>');
				i++;
				continue;
			}
			if (/^\s*>/.test(line)) {
				flushParagraph();
				flushList();
				quote.push(line.replace(/^\s*>\s?/, ''));
				i++;
				continue;
			}
			if (quote.length && line.trim()) {
				quote.push(line);
				i++;
				continue;
			}
			flushQuote();
			if (line.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
				flushAll();
				const head = tableRow(line);
				const rows = [];
				i += 2;
				while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
					rows.push(tableRow(lines[i]));
					i++;
				}
				html.push(
					`<table><thead><tr>${head.map((cell) => `<th>${inline(cell)}</th>`).join('')}</tr></thead>` +
						`<tbody>${rows.map((row) => `<tr>${head.map((_, index) => `<td>${inline(row[index] || '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`,
				);
				continue;
			}
			const bullet = /^\s{0,3}([-*+]|\d+[.)])\s+(.*)$/.exec(line);
			if (bullet) {
				flushParagraph();
				const ordered = /\d/.test(bullet[1]);
				const tag = ordered ? 'ol' : 'ul';
				if (!list || list.tag !== tag) {
					flushList();
					list = { tag, items: [] };
				}
				const task = /^\[([ xX])\]\s+(.*)$/.exec(bullet[2]);
				list.items.push(task ? `<span class="md-task${task[1] === ' ' ? '' : ' done'}" aria-hidden="true"></span>${inline(task[2])}` : inline(bullet[2]));
				i++;
				continue;
			}
			if (list && /^\s{2,}\S/.test(line)) {
				list.items[list.items.length - 1] += ' ' + inline(line.trim());
				i++;
				continue;
			}
			if (!line.trim()) {
				flushAll();
				i++;
				continue;
			}
			flushList();
			paragraph.push(line.trim());
			i++;
		}
		flushAll();
		return html.join('\n');
	}

	function toElement(source, className) {
		const container = document.createElement('div');
		container.className = 'md-body' + (className ? ' ' + className : '');
		container.innerHTML = render(source);
		return container;
	}

	root.SynapseMarkdownLite = Object.freeze({ render, toElement, inline, safeHref });
})(typeof globalThis !== 'undefined' ? globalThis : window);
