(function () {
    'use strict';

    const javascriptKeywords =
    'as async await break case catch class const continue debugger default delete do else export extends false finally for from function get if import in instanceof let new null of return set static super switch this throw true try typeof undefined var void while with yield';
    const typescriptKeywords =
    'abstract any asserts bigint boolean constructor declare enum global implements infer interface is keyof module namespace never number object override private protected public readonly require satisfies string symbol type unique unknown';
    const grammarCatalog = window.SynapseLanguageGrammars;
    const aliases = Object.freeze({
        ...(grammarCatalog ? grammarCatalog.extensionAliases : {}),
        javascript: 'js',
        mjs: 'js',
        cjs: 'js',
        jsx: 'jsx',
        typescript: 'ts',
        mts: 'ts',
        cts: 'ts',
        tsx: 'tsx',
        htm: 'html',
        xml: 'html',
        svg: 'html',
        vue: 'html',
        svelte: 'html',
        scss: 'css',
        less: 'css',
        webmanifest: 'json',
        jsonc: 'jsonc',
    });
    const supportedLanguages = new Set([
        'js',
        'jsx',
        'ts',
        'tsx',
        'html',
        'css',
        'json',
        'jsonc',
        ...(grammarCatalog ? grammarCatalog.languages : []),
    ]);

    function grammar(language) {
      if (!grammarCatalog) return null;
      return grammarCatalog.grammars[normalize(language)] || null;
    }
    const keywords = Object.freeze({
        js: Object.freeze(javascriptKeywords.split(' ')),
        ts: Object.freeze(`${javascriptKeywords} ${typescriptKeywords}`.split(' ')),
        json: Object.freeze(['true', 'false', 'null']),
    });
    const htmlTags = Object.freeze(
      'a article aside audio body br button canvas code details dialog div em fieldset figure footer form h1 h2 h3 head header hr html iframe img input label li link main meta nav ol option p picture pre progress script section select small source span strong style summary table tbody td template textarea th thead title tr ul video'.split(
        ' ',
      ),
    );
    const htmlAttributes = Object.freeze(
      'alt aria-label aria-labelledby aria-describedby aria-expanded aria-hidden aria-live aria-pressed autocomplete autofocus checked class content controls data- disabled for height hidden href id lang loading max maxlength method min multiple name pattern placeholder readonly rel required role rows selected src srcset step style tabindex target title type value width'.split(
        ' ',
      ),
    );
    const cssProperties = Object.freeze(
      'align-content align-items align-self animation animation-delay animation-duration animation-name appearance aspect-ratio backdrop-filter background background-color background-image background-position background-size border border-color border-radius border-style border-width bottom box-shadow box-sizing color column-gap content cursor display fill filter flex flex-basis flex-direction flex-grow flex-shrink flex-wrap font font-family font-size font-style font-weight gap grid grid-area grid-auto-flow grid-column grid-row grid-template-columns grid-template-rows height inset isolation justify-content left letter-spacing line-height list-style margin margin-block margin-bottom margin-inline margin-left margin-right margin-top max-height max-width min-height min-width object-fit object-position opacity order outline outline-color outline-offset overflow overflow-x overflow-y padding padding-block padding-bottom padding-inline padding-left padding-right padding-top place-items pointer-events position resize right rotate row-gap scroll-behavior stroke text-align text-decoration text-overflow text-transform top touch-action transform transform-origin transition transition-duration transition-property translate user-select vertical-align visibility white-space width word-break z-index'.split(
        ' ',
      ),
    );
    const cssValues = Object.freeze({
        display: 'block inline inline-block flex inline-flex grid inline-grid none contents flow-root',
        position: 'relative absolute fixed sticky static',
        'align-items': 'center start end flex-start flex-end stretch baseline',
        'justify-content':
        'center start end flex-start flex-end space-between space-around space-evenly',
        'flex-direction': 'row column row-reverse column-reverse',
        'flex-wrap': 'wrap nowrap wrap-reverse',
        overflow: 'auto hidden visible scroll clip',
        'box-sizing': 'border-box content-box',
        'font-weight': 'normal bold bolder lighter',
        'text-align': 'left right center justify start end',
        'white-space': 'normal nowrap pre pre-wrap pre-line break-spaces',
        color: 'transparent currentColor black white red green blue rebeccapurple',
        'background-color': 'transparent currentColor black white',
        cursor: 'auto default pointer text move grab grabbing not-allowed crosshair',
        visibility: 'visible hidden collapse',
    });
    const javascriptGlobals = Object.freeze(
      'Array ArrayBuffer Boolean Date Error Event FormData Headers JSON Map Math Number Object Promise RegExp Request Response Set String Symbol URL URLSearchParams WeakMap WeakSet addEventListener cancelAnimationFrame clearInterval clearTimeout console document fetch globalThis localStorage navigator performance queueMicrotask removeEventListener requestAnimationFrame sessionStorage setInterval setTimeout structuredClone window'.split(
        ' ',
      ),
    );
    const javascriptMembers = Object.freeze({
        console:
        'assert clear count debug dir error group groupEnd info log table time timeEnd trace warn',
        document:
        'activeElement addEventListener body createDocumentFragment createElement createTextNode documentElement getElementById head querySelector querySelectorAll removeEventListener title',
        window:
        'addEventListener alert cancelAnimationFrame clearInterval clearTimeout document innerHeight innerWidth location matchMedia navigator open removeEventListener requestAnimationFrame setInterval setTimeout',
        Math: 'abs ceil cos floor hypot max min PI pow random round sign sin sqrt tan trunc',
        JSON: 'parse stringify',
        Object: 'assign create entries freeze fromEntries getOwnPropertyNames hasOwn is keys values',
        Array: 'from isArray of',
        Promise: 'all allSettled any race reject resolve',
        localStorage: 'clear getItem key length removeItem setItem',
        sessionStorage: 'clear getItem key length removeItem setItem',
        performance: 'mark measure now',
    });

    function normalize(language) {
      const name = String(language || '').toLowerCase();
      const normalized = aliases[name] || name;
      return supportedLanguages.has(normalized) ? normalized : 'text';
    }

    function fromPath(path) {
      const filename = String(path || '')
      .split(/[\\/]/)
      .pop()
      .toLowerCase();
      if (/^(?:tsconfig|jsconfig)(?:\.[\w-]+)?\.json$/.test(filename)) return 'jsonc';
      return normalize(
        filename.includes('.') ? filename.slice(filename.lastIndexOf('.') + 1) : filename,
      );
    }

    function isLarge(source) {
      if (source.length > 250000) return true;
      let lineCount = 1;
      for (
        let offset = source.indexOf('\n');
        offset >= 0;
        offset = source.indexOf('\n', offset + 1)
      ) {
        if (++lineCount > 7000) return true;
      }
      return false;
    }

    window.SynapseEditorLanguages = Object.freeze({
        normalize,
        fromPath,
        isLarge,
        grammar,
        keywords,
        htmlTags,
        htmlAttributes,
        cssProperties,
        cssValues,
        javascriptGlobals,
        javascriptMembers,
    });
})();
