(function () {
    'use strict';

    const definitions = [
      {
        language: 'csharp',
        extensions: ['cs', 'csx'],
        lineComments: ['//'],
        blockComments: [['/*', '*/']],
        quotes: ['"'],
        preprocessor: true,
        balanced: true,
        keywords:
        'abstract as async await base bool break byte case catch char checked class const continue decimal default delegate do double dynamic else enum event explicit extern false finally fixed float for foreach get global goto if implicit in init int interface internal is lock long nameof namespace new null object operator out override params partial private protected public readonly record ref return sbyte sealed set short sizeof stackalloc static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using value var virtual void volatile when where while with yield',
      },
      {
        language: 'java',
        extensions: ['java'],
        lineComments: ['//'],
        blockComments: [['/*', '*/']],
        quotes: ['"'],
        balanced: true,
        keywords:
        'abstract assert boolean break byte case catch char class const continue default do double else enum extends false final finally float for goto if implements import instanceof int interface long native new null package permits private protected public record return sealed short static strictfp super switch synchronized this throw throws transient true try var void volatile while yield',
      },
      {
        language: 'cpp',
        extensions: ['c', 'h', 'cpp', 'cc', 'cxx', 'hpp', 'hh', 'hxx', 'ino', 'm', 'mm'],
        lineComments: ['//'],
        blockComments: [['/*', '*/']],
        quotes: ['"'],
        preprocessor: true,
        balanced: true,
        keywords:
        'alignas alignof and auto bool break case catch char char8_t char16_t char32_t class concept const consteval constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do double dynamic_cast else enum explicit export extern false float for friend goto if inline int long mutable namespace new noexcept nullptr operator or private protected public register reinterpret_cast requires return short signed sizeof static static_assert static_cast struct switch template this thread_local throw true try typedef typeid typename union unsigned using virtual void volatile wchar_t while',
      },
      {
        language: 'go',
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
        extensions: ['rs'],
        lineComments: ['//'],
        blockComments: [['/*', '*/']],
        quotes: ['"'],
        balanced: true,
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
        lineComments: ['#'],
        blockComments: [],
        quotes: ['"', "'"],
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
        keywords:
        'any as associatedtype async await break case catch class continue default defer deinit do else enum extension fallthrough false fileprivate final for func guard if import in init inout internal is lazy let mutating nil open operator private protocol public repeat rethrows return self Self static struct subscript super switch throw throws true try typealias var weak where while',
      },
      {
        language: 'kotlin',
        extensions: ['kt', 'kts'],
        lineComments: ['//'],
        blockComments: [['/*', '*/']],
        quotes: ['"'],
        balanced: true,
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
        keywords:
        'abstract as assert async await bool break case catch class const continue covariant default deferred do double dynamic else enum export extends extension external factory false final finally for get if implements import in int interface is late library List Map mixin new null on operator part required rethrow return sealed set show static String super switch sync this throw true try typedef var void while with yield',
      },
      {
        language: 'lua',
        extensions: ['lua'],
        lineComments: ['--'],
        blockComments: [['--[[', ']]']],
        quotes: ['"', "'"],
        balanced: true,
        keywords:
        'and break do else elseif end false for function goto if in local nil not or pairs ipairs print repeat require return self then true until while',
      },
      {
        language: 'shell',
        extensions: ['sh', 'bash', 'zsh', 'fish'],
        lineComments: ['#'],
        blockComments: [],
        quotes: ['"', "'"],
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
        keywords: 'true false null yes no on off',
      },
      {
        language: 'toml',
        extensions: ['toml'],
        lineComments: ['#'],
        blockComments: [],
        quotes: ['"', "'"],
        keyAssignment: '=',
        keywords: 'true false',
      },
      {
        language: 'ini',
        extensions: ['ini', 'cfg', 'conf', 'env', 'properties'],
        lineComments: ['#', ';'],
        blockComments: [],
        quotes: ['"', "'"],
        keyAssignment: '=',
        keywords: 'true false',
      },
    ];

    const grammars = {};
    const extensionAliases = {};

    for (const definition of definitions) {
      const words = definition.keywords.split(' ');
      grammars[definition.language] = Object.freeze({
          language: definition.language,
          keywords: new Set(definition.ignoreCase ? words.map((word) => word.toLowerCase()) : words),
          ignoreCase: !!definition.ignoreCase,
          lineComments: Object.freeze(definition.lineComments.slice()),
          blockComments: Object.freeze(
            definition.blockComments.map((pair) => Object.freeze(pair.slice())),
          ),
          quotes: Object.freeze(definition.quotes.slice()),
          tripleQuotes: !!definition.tripleQuotes,
          preprocessor: !!definition.preprocessor,
          keyAssignment: definition.keyAssignment || '',
          balanced: !!definition.balanced,
      });
      extensionAliases[definition.language] = definition.language;
      for (const extension of definition.extensions)
      extensionAliases[extension] = definition.language;
    }

    window.SynapseLanguageGrammars = Object.freeze({
        grammars: Object.freeze(grammars),
        extensionAliases: Object.freeze(extensionAliases),
        languages: Object.freeze(Object.keys(grammars)),
    });
})();
