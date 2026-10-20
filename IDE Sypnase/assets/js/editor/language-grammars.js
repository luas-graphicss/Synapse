(function () {
	'use strict';

	const definitions = [
		{
			language: 'csharp',
			charLiterals: true,
			extensions: ['cs', 'csx'],
			lineComments: ['//'],
			blockComments: [['/*', '*/']],
			quotes: ['"'],
			preprocessor: true,
			balanced: true,
			tripleQuotes: true,
			rawStringStyle: 'csharp',
			keywords:
				'abstract as async await base bool break byte case catch char checked class const continue decimal default delegate do double dynamic else enum event explicit extern false finally fixed float for foreach get global goto if implicit in init int interface internal is lock long nameof namespace new null object operator out override params partial private protected public readonly record ref return sbyte sealed set short sizeof stackalloc static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using value var virtual void volatile when where while with yield',
		},
		{
			language: 'java',
			charLiterals: true,
			extensions: ['java'],
			lineComments: ['//'],
			blockComments: [['/*', '*/']],
			quotes: ['"'],
			balanced: true,
			tripleQuotes: true,
			keywords:
				'abstract assert boolean break byte case catch char class const continue default do double else enum extends false final finally float for goto if implements import instanceof int interface long native new null package permits private protected public record return sealed short static strictfp super switch synchronized this throw throws transient true try var void volatile while yield',
		},
		{
			language: 'cpp',
			charLiterals: true,
			extensions: ['c', 'h', 'cpp', 'cc', 'cxx', 'hpp', 'hh', 'hxx', 'ino', 'm', 'mm'],
			lineComments: ['//'],
			blockComments: [['/*', '*/']],
			quotes: ['"'],
			preprocessor: true,
			balanced: true,
			rawStringStyle: 'cpp',
			digitSeparatorQuote: true,
			keywords:
				'alignas alignof and auto bool break case catch char char8_t char16_t char32_t class concept const consteval constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do double dynamic_cast else enum explicit export extern false float for friend goto if inline int long mutable namespace new noexcept nullptr operator or private protected public register reinterpret_cast requires return short signed sizeof static static_assert static_cast struct switch template this thread_local throw true try typedef typeid typename union unsigned using virtual void volatile wchar_t while',
		},
		{
			language: 'go',
			charLiterals: true,
			extensions: ['go'],
			lineComments: ['//'],
			blockComments: [['/*', '*/']],
			quotes: ['"', '`'],
			balanced: true,
			keywords:
				'append bool break byte cap case chan close complex complex64 complex128 const continue copy default defer delete else error fallthrough false float32 float64 for func go goto if import int int8 int16 int32 int64 interface len make map new nil package panic range recover return rune select string struct switch true type uint uint8 uint16 uint32 uint64 uintptr var',
		},
		{
			language: 'rust',
			charLiterals: true,
			extensions: ['rs'],
			lineComments: ['//'],
			blockComments: [['/*', '*/']],
			quotes: ['"'],
			balanced: true,
			multilineStrings: true,
			lifetimes: true,
			rawStringStyle: 'rust',
			keywords:
				'as async await bool break char const continue crate dyn else enum extern f32 f64 false fn for i8 i16 i32 i64 i128 if impl in isize let loop match mod move mut pub ref return self Self static str struct super trait true type u8 u16 u32 u64 u128 unsafe use usize where while Box Err None Ok Option Result Some String Vec',
		},
		{
			language: 'python',
			extensions: ['py', 'pyw', 'pyi'],
			lineComments: ['#'],
			blockComments: [],
			quotes: ['"', "'"],
			tripleQuotes: true,
			balanced: true,
			keywords:
				'and as assert async await bool break case class continue def del dict elif else except False finally float for from global if import in int is lambda len list match None nonlocal not or pass print raise range return self set str True try tuple while with yield',
		},
		{
			language: 'ruby',
			extensions: ['rb', 'rake', 'gemspec'],
			regexLiterals: true,
			lineComments: ['#'],
			blockComments: [],
			quotes: ['"', "'"],
			multilineStrings: true,
			heredoc: "<<[~-]?(?:\"([A-Za-z_]\\w*)\"|'([A-Za-z_]\\w*)'|([A-Z_][A-Z0-9_]*))",
			keywords:
				'alias and begin break case class def do else elsif end ensure false for if in module next nil not or private protected public puts raise redo require require_relative rescue retry return self super then true undef unless until when while yield',
		},
		{
			language: 'php',
			extensions: ['php', 'phtml'],
			lineComments: ['//', '#'],
			blockComments: [['/*', '*/']],
			quotes: ['"', "'"],
			balanced: true,
			multilineStrings: true,
			embeddedMarkup: true,
			heredoc: "<<<[ \\t]*(?:\"([A-Za-z_]\\w*)\"|'([A-Za-z_]\\w*)'|([A-Za-z_]\\w*))(?=[ \\t]*\\r?\\n)",
			keywords:
				'abstract and array as break callable case catch class clone const continue declare default do echo else elseif empty enum extends false final finally fn for foreach function global if implements include include_once instanceof insteadof interface isset list match namespace new null or print private protected public readonly require require_once return static switch throw trait true try unset use var while xor yield',
		},
		{
			language: 'swift',
			extensions: ['swift'],
			lineComments: ['//'],
			blockComments: [['/*', '*/']],
			quotes: ['"'],
			balanced: true,
			tripleQuotes: true,
			keywords:
				'any as associatedtype async await break case catch class continue default defer deinit do else enum extension fallthrough false fileprivate final for func guard if import in init inout internal is lazy let mutating nil open operator private protocol public repeat rethrows return self Self static struct subscript super switch throw throws true try typealias var weak where while',
		},
		{
			language: 'kotlin',
			charLiterals: true,
			extensions: ['kt', 'kts'],
			lineComments: ['//'],
			blockComments: [['/*', '*/']],
			quotes: ['"'],
			balanced: true,
			tripleQuotes: true,
			keywords:
				'abstract actual annotation as break by catch class companion const constructor continue crossinline data do dynamic else enum expect external false final finally for fun get if import in infix init inline inner interface internal is it lateinit noinline null object open operator out override package private protected public reified return sealed set super suspend tailrec this throw true try typealias val var vararg when where while',
		},
		{
			language: 'dart',
			extensions: ['dart'],
			lineComments: ['//'],
			blockComments: [['/*', '*/']],
			quotes: ['"', "'"],
			balanced: true,
			tripleQuotes: true,
			keywords:
				'abstract as assert async await bool break case catch class const continue covariant default deferred do double dynamic else enum export extends extension external factory false final finally for get if implements import in int interface is late library List Map mixin new null on operator part required rethrow return sealed set show static String super switch sync this throw true try typedef var void while with yield',
		},
		{
			language: 'lua',
			extensions: ['lua', 'luau'],
			lineComments: ['--'],
			blockComments: [['--[[', ']]']],
			quotes: ['"', "'", '`'],
			balanced: true,
			rawStringStyle: 'lua',
			keywords:
				'and break continue do else elseif end export false for function goto if in local nil not or pairs ipairs print repeat require return self then true type typeof until while',
		},
		{
			language: 'shell',
			extensions: ['sh', 'bash', 'zsh', 'fish'],
			lineComments: ['#'],
			blockComments: [],
			quotes: ['"', "'"],
			multilineStrings: true,
			rawSingleQuotes: true,
			commentNeedsSpace: true,
			heredoc: "<<-?[ \\t]*(?:\"([A-Za-z_]\\w*)\"|'([A-Za-z_]\\w*)'|\\\\?([A-Za-z_]\\w*))",
			keywords:
				'alias break case cd continue declare do done echo elif else esac exit export fi for function if in local read readonly return select set shift source then time trap unset until while',
		},
		{
			language: 'sql',
			extensions: ['sql'],
			lineComments: ['--'],
			blockComments: [['/*', '*/']],
			quotes: ["'", '"'],
			ignoreCase: true,
			multilineStrings: true,
			rawSingleQuotes: true,
			keywords:
				'add all alter and as asc avg begin between by case cast check column commit constraint count create cross default delete desc distinct drop else end exists foreign from full group having if in index inner insert into is join key left like limit max min not null offset on or order outer primary references returning right rollback select set sum table then transaction union unique update values view when where with',
		},
		{
			language: 'yaml',
			extensions: ['yaml', 'yml'],
			lineComments: ['#'],
			blockComments: [],
			quotes: ['"', "'"],
			keyAssignment: ':',
			multilineStrings: true,
			rawSingleQuotes: true,
			valueQuotes: ':-[{,?!',
			commentNeedsSpace: true,
			keywords: 'true false null yes no on off',
		},
		{
			language: 'toml',
			extensions: ['toml'],
			lineComments: ['#'],
			blockComments: [],
			quotes: ['"', "'"],
			keyAssignment: '=',
			tripleQuotes: true,
			rawSingleQuotes: true,
			valueQuotes: '=[{,',
			keywords: 'true false',
		},
		{
			language: 'ini',
			extensions: ['ini', 'cfg', 'conf', 'env', 'properties'],
			lineComments: ['#', ';'],
			blockComments: [],
			quotes: ['"', "'"],
			keyAssignment: '=',
			rawSingleQuotes: true,
			valueQuotes: '=[{,',
			keywords: 'true false',
		},
	];

	const TOKEN_TYPES = new Set(['keyword', 'string', 'regex', 'number', 'comment', 'tag', 'attribute', 'punctuation', 'function', 'identifier', 'text']);
	const SCOPE_TO_TYPE = [
		['comment', 'comment'],
		['string', 'string'],
		['constant.numeric', 'number'],
		['constant.character', 'string'],
		['constant', 'keyword'],
		['keyword', 'keyword'],
		['storage', 'keyword'],
		['entity.name.function', 'function'],
		['support.function', 'function'],
		['entity.name.tag', 'tag'],
		['entity.name.type', 'identifier'],
		['entity.other.attribute-name', 'attribute'],
		['variable.other.property', 'attribute'],
		['variable', 'identifier'],
		['punctuation', 'punctuation'],
		['meta.preprocessor', 'keyword'],
		['markup.heading', 'keyword'],
		['markup.bold', 'attribute'],
		['markup.italic', 'attribute'],
		['markup.inline.raw', 'string'],
	];
	const MAX_PATTERNS = 200;
	const MAX_PATTERN_SOURCE = 2000;
	const LANGUAGE_ID = /^[a-z][a-z0-9_+.#-]{0,39}$/;

	const grammars = new Map();
	const extensionAliases = new Map();
	const listeners = new Set();
	let version = 0;

	function tokenTypeOf(name) {
		const scope = String(name || '').toLowerCase();
		if (!scope) return 'text';
		if (TOKEN_TYPES.has(scope)) return scope;
		for (const [prefix, type] of SCOPE_TO_TYPE) {
			if (scope === prefix || scope.startsWith(prefix + '.')) return type;
		}
		return 'text';
	}

	function compileRegex(source, flags, sticky, indices) {
		const text = String(source || '');
		if (!text || text.length > MAX_PATTERN_SOURCE) throw new Error('padrão vazio ou maior que ' + MAX_PATTERN_SOURCE + ' caracteres');
		const clean = String(flags || '').replace(/[^ims]/g, '');
		return new RegExp(text, clean + (sticky ? 'y' : 'g') + (indices ? 'd' : ''));
	}

	function compileCaptures(raw) {
		if (!raw || typeof raw !== 'object') return null;
		const captures = {};
		Object.keys(raw).forEach((key) => {
			const index = Number(key);
			if (!Number.isInteger(index) || index < 0 || index > 20) return;
			const entry = raw[key];
			captures[index] = tokenTypeOf(entry && typeof entry === 'object' ? entry.name : entry);
		});
		return captures;
	}

	function compilePatterns(list, errors) {
		const compiled = [];
		(Array.isArray(list) ? list : []).slice(0, MAX_PATTERNS).forEach((pattern, index) => {
			if (!pattern || typeof pattern !== 'object') return;
			try {
				if (typeof pattern.begin === 'string' && typeof pattern.end === 'string') {
					compiled.push({
						kind: 'block',
						begin: compileRegex(pattern.begin, pattern.flags, true),
						end: compileRegex(pattern.end, pattern.flags, false),
						type: tokenTypeOf(pattern.name || pattern.contentName),
						multiline: pattern.multiline !== false,
					});
					return;
				}
				if (typeof pattern.match === 'string') {
					const captures = compileCaptures(pattern.captures);
					compiled.push({
						kind: 'match',
						regex: compileRegex(pattern.match, pattern.flags, true, !!captures),
						type: tokenTypeOf(pattern.name),
						captures,
					});
					return;
				}
				errors.push(`patterns[${index}]: use "match" ou "begin"+"end".`);
			} catch (error) {
				errors.push(`patterns[${index}]: ${error.message}`);
			}
		});
		return compiled;
	}

	function words(value, ignoreCase) {
		const list = Array.isArray(value) ? value.map(String) : String(value || '').split(/\s+/);
		return new Set(list.filter(Boolean).map((word) => (ignoreCase ? word.toLowerCase() : word)));
	}

	function pairList(value) {
		return (Array.isArray(value) ? value : [])
			.filter((pair) => Array.isArray(pair) && pair.length === 2 && pair[0] && pair[1])
			.map((pair) => Object.freeze([String(pair[0]), String(pair[1])]));
	}

	function compile(definition, owner) {
		const errors = [];
		const language = String(definition.language || definition.id || '').toLowerCase();
		if (!LANGUAGE_ID.test(language)) throw new Error(`id de linguagem inválido "${language}".`);
		let heredoc = null;
		if (definition.heredoc) {
			try {
				heredoc = new RegExp(String(definition.heredoc), 'y');
			} catch (error) {
				errors.push('heredoc: ' + error.message);
			}
		}
		const patterns = compilePatterns(definition.patterns, errors);
		return Object.freeze({
			language,
			owner: owner || 'builtin',
			keywords: words(definition.keywords, !!definition.ignoreCase),
			ignoreCase: !!definition.ignoreCase,
			lineComments: Object.freeze((Array.isArray(definition.lineComments) ? definition.lineComments : []).map(String).filter(Boolean)),
			blockComments: Object.freeze(pairList(definition.blockComments)),
			quotes: Object.freeze((Array.isArray(definition.quotes) ? definition.quotes : []).map(String).filter((quote) => quote.length === 1)),
			tripleQuotes: !!definition.tripleQuotes,
			preprocessor: !!definition.preprocessor,
			keyAssignment: definition.keyAssignment ? String(definition.keyAssignment).slice(0, 1) : '',
			balanced: !!definition.balanced,
			multilineStrings: !!definition.multilineStrings,
			rawSingleQuotes: !!definition.rawSingleQuotes,
			valueQuotes: definition.valueQuotes ? String(definition.valueQuotes) : '',
			commentNeedsSpace: !!definition.commentNeedsSpace,
			lifetimes: !!definition.lifetimes,
			rawStringStyle: ['rust', 'cpp', 'csharp', 'lua'].includes(definition.rawStringStyle) ? definition.rawStringStyle : '',
			digitSeparatorQuote: !!definition.digitSeparatorQuote,
			charLiterals: !!definition.charLiterals,
			regexLiterals: !!definition.regexLiterals,
			embeddedMarkup: !!definition.embeddedMarkup,
			heredoc,
			patterns: patterns.length ? Object.freeze(patterns) : null,
			errors: Object.freeze(errors),
		});
	}

	function notify(change) {
		version += 1;
		listeners.forEach((listener) => {
			try {
				listener(change);
			} catch (error) {
				if (typeof window.ignorarErro === 'function') window.ignorarErro(error, 'languageGrammars.listener');
			}
		});
	}

	function dropAliases(language) {
		[...extensionAliases.entries()].forEach(([key, value]) => {
			if (value === language) extensionAliases.delete(key);
		});
	}

	function register(definition, owner) {
		const grammar = compile(definition || {}, owner);
		const previous = grammars.get(grammar.language) || null;
		if (previous && previous.owner === 'builtin' && grammar.owner !== 'builtin') {
			throw new Error(`A linguagem "${grammar.language}" é nativa e não pode ser substituída.`);
		}
		grammars.set(grammar.language, grammar);
		extensionAliases.set(grammar.language, grammar.language);
		(Array.isArray(definition.extensions) ? definition.extensions : []).forEach((extension) => {
			const key = String(extension || '').toLowerCase().replace(/^\./, '');
			if (key) extensionAliases.set(key, grammar.language);
		});
		notify({ type: 'grammar', language: grammar.language, owner: grammar.owner });
		return Object.freeze({
			grammar,
			dispose() {
				if (grammars.get(grammar.language) !== grammar) return;
				if (previous) grammars.set(grammar.language, previous);
				else {
					grammars.delete(grammar.language);
					dropAliases(grammar.language);
				}
				notify({ type: 'grammar', language: grammar.language, owner: grammar.owner, removed: true });
			},
		});
	}

	function unregister(language, owner) {
		const grammar = grammars.get(String(language || '').toLowerCase());
		if (!grammar || grammar.owner === 'builtin' || (owner && grammar.owner !== owner)) return false;
		grammars.delete(grammar.language);
		dropAliases(grammar.language);
		notify({ type: 'grammar', language: grammar.language, owner: grammar.owner, removed: true });
		return true;
	}

	function unregisterOwner(owner) {
		let removed = 0;
		[...grammars.values()].forEach((grammar) => {
			if (grammar.owner === owner && unregister(grammar.language, owner)) removed += 1;
		});
		return removed;
	}

	function get(language) {
		return grammars.get(String(language || '').toLowerCase()) || null;
	}

	function aliasOf(extension) {
		return extensionAliases.get(String(extension || '').toLowerCase().replace(/^\./, '')) || null;
	}

	function onDidChange(listener) {
		if (typeof listener !== 'function') return () => {};
		listeners.add(listener);
		return () => listeners.delete(listener);
	}

	definitions.forEach((definition) => register(definition, 'builtin'));

	window.SynapseLanguageGrammars = Object.freeze({
		register,
		unregister,
		unregisterOwner,
		get,
		has: (language) => grammars.has(String(language || '').toLowerCase()),
		aliasOf,
		tokenTypeOf,
		onDidChange,
		get version() {
			return version;
		},
		get grammars() {
			return Object.fromEntries(grammars);
		},
		get extensionAliases() {
			return Object.fromEntries(extensionAliases);
		},
		get languages() {
			return [...grammars.keys()];
		},
		get contributed() {
			return [...grammars.values()]
				.filter((grammar) => grammar.owner !== 'builtin')
				.map((grammar) => ({ language: grammar.language, owner: grammar.owner, patterns: !!grammar.patterns }));
		},
	});
})();
