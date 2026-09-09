'use strict';

const SYSTEM_MESSAGE = [
  'Voce completa codigo dentro de um editor.',
  'Responda somente com continuacoes possiveis, uma por linha.',
  'Nao explique, nao numere e nao use blocos de codigo.',
  'Cada linha deve encaixar exatamente na posicao do cursor.',
].join(' ');

const FENCE_LINE = /^\s*`{3,}/;
const LIST_PREFIX = /^\s*(?:[-*\u2022]|\d+[.)])\s+/;
const MAXIMUM_SUGGESTION_LENGTH = 160;

function describeTarget(context) {
	return context.path ? `Arquivo: ${context.path}` : 'Arquivo sem nome';
}

function buildMessages(context) {
	const userMessage = [
		describeTarget(context),
		'Texto antes do cursor:',
		context.prefix,
		context.suffix ? 'Texto depois do cursor:' : '',
		context.suffix,
	]
		.filter(Boolean)
		.join('\n');
	return [
		{ role: 'system', content: SYSTEM_MESSAGE },
		{ role: 'user', content: userMessage },
	];
}

function cleanLine(line) {
	return line.replace(LIST_PREFIX, '').trim();
}

function parseSuggestions(content, maximum) {
	if (typeof content !== 'string' || !content.trim()) return [];
	const seen = new Set();
	const suggestions = [];
	for (const rawLine of content.split('\n')) {
		if (FENCE_LINE.test(rawLine)) continue;
		const line = cleanLine(rawLine);
		if (!line || line.length > MAXIMUM_SUGGESTION_LENGTH) continue;
		if (seen.has(line)) continue;
		seen.add(line);
		suggestions.push({ label: line, insertText: line, kind: 'ai' });
		if (suggestions.length >= maximum) break;
	}
	return suggestions;
}

module.exports = { SYSTEM_MESSAGE, MAXIMUM_SUGGESTION_LENGTH, buildMessages, parseSuggestions };
