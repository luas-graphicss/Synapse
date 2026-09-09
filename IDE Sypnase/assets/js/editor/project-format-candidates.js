(function (root) {
    'use strict';

    const FORMATTABLE_EXTENSIONS = [
      '.js',
      '.mjs',
      '.cjs',
      '.jsx',
      '.ts',
      '.tsx',
      '.json',
      '.css',
      '.scss',
      '.less',
      '.html',
      '.htm',
      '.xml',
      '.svg',
      '.vue',
    ];

    const GENERATED_DIRECTORY =
    /(^|\/)(node_modules|\.git|dist|build|out|bin|obj|target|\.next|\.cache|vendor|__pycache__)(\/|$)/i;

    const MAXIMUM_CHARACTERS = 400000;

    function extensionOf(path) {
      return String(Core.extname(path) || '').toLowerCase();
    }

    function isTextFile(file) {
      return Boolean(file) && file.isText === true && typeof file.text === 'string';
    }

    function hasFormattableExtension(path) {
      return FORMATTABLE_EXTENSIONS.includes(extensionOf(path));
    }

    function isTooLarge(file) {
      return file.text.length > MAXIMUM_CHARACTERS;
    }

    function collect(project) {
      const selected = [];
      const skipped = [];
      for (const [path, file] of project.files) {
        if (!isTextFile(file)) continue;
        if (GENERATED_DIRECTORY.test(path)) continue;
        if (!hasFormattableExtension(path)) continue;
        if (isTooLarge(file)) {
          skipped.push(path);
          continue;
        }
        selected.push(path);
      }
      selected.sort();
      return { selected: selected, skipped: skipped };
    }

    root.SynapseProjectFormatCandidates = Object.freeze({
        collect: collect,
        extensions: FORMATTABLE_EXTENSIONS.slice(),
        maximumCharacters: MAXIMUM_CHARACTERS,
    });
})(typeof globalThis !== 'undefined' ? globalThis : window);
