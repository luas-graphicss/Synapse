(function (root) {
    'use strict';

    function createService(typescript, libraries) {
      const projectRoot = '/project/';
      const libraryRoot = '/typescript/';
      const files = new Map();
      const snapshots = new Map();
      let projectId = null;
      let projectVersion = 0;
      let fileVersion = 0;
      let configuration = null;
      let configurationErrors = [];
      let options = defaultOptions();
      let rootNames = [];
      let service = null;

      function defaultOptions() {
        return {
          target: typescript.ScriptTarget.ES2022,
          module: typescript.ModuleKind.ESNext,
          moduleResolution: typescript.ModuleResolutionKind.Bundler,
          jsx: typescript.JsxEmit.Preserve,
          allowJs: true,
          checkJs: true,
          allowNonTsExtensions: true,
          allowImportingTsExtensions: true,
          resolveJsonModule: true,
          esModuleInterop: true,
          skipLibCheck: true,
          noEmit: true,
        };
      }
      function normalize(path) {
        const result = [];
        for (const segment of String(path).replace(/\\/g, '/').split('/')) {
          if (!segment || segment === '.') continue;
          if (segment === '..') result.pop();
          else result.push(segment);
        }
        return '/' + result.join('/');
      }
      function projectPath(path) {
        if (
          typeof path !== 'string' ||
          path.startsWith('/') ||
          path.split('/').some((part) => !part || part === '.' || part === '..') ||
          path.includes('\\')
        )
        throw new Error('Invalid project file path');
        return projectRoot + path;
      }
      function readFile(path) {
        const normalized = normalize(path);
        return (
          files.get(normalized)?.text ??
          (normalized.startsWith(libraryRoot)
            ? libraries.get(normalized.slice(libraryRoot.length))
            : undefined)
        );
      }
      function directoryExists(path) {
        const prefix = normalize(path) + '/';
        return [...files.keys()].some((name) => name.startsWith(prefix)) || prefix === libraryRoot;
      }
      function fileSystemEntries(path) {
        const prefix = normalize(path) + '/';
        const names = new Set();
        const directories = new Set();
        for (const name of files.keys()) {
          if (!name.startsWith(prefix)) continue;
          const relative = name.slice(prefix.length);
          if (relative.includes('/')) directories.add(relative.split('/')[0]);
          else names.add(relative);
        }
        return { files: [...names], directories: [...directories] };
      }
      function readDirectory(path, extensions, excludes, includes, depth) {
        return typescript.matchFiles(
          path,
          extensions,
          excludes,
          includes,
          true,
          projectRoot,
          depth,
          fileSystemEntries,
          normalize,
        );
      }
      function getSnapshot(path) {
        const text = readFile(path);
        if (text === undefined) return undefined;
        const previous = snapshots.get(path);
        if (previous?.text === text) return previous.snapshot;
        const snapshot = typescript.ScriptSnapshot.fromString(text);
        snapshots.set(path, { text, snapshot });
        return snapshot;
      }
      const host = {
        getCompilationSettings: () => options,
        getCurrentDirectory: () => projectRoot,
        getDefaultLibFileName: () => libraryRoot + typescript.getDefaultLibFileName(options),
        getDefaultLibLocation: () => libraryRoot,
        getScriptFileNames: () => rootNames,
        getScriptVersion: (path) => String(files.get(path)?.version || 0),
        getProjectVersion: () => String(projectVersion),
        getScriptSnapshot: getSnapshot,
        fileExists: (path) => readFile(path) !== undefined,
        readFile,
        readDirectory,
        directoryExists,
        getDirectories: (path) => fileSystemEntries(path).directories,
        realpath: normalize,
        useCaseSensitiveFileNames: () => true,
        getNewLine: () => '\n',
      };
      function configure() {
        options = defaultOptions();
        configurationErrors = [];
        rootNames = [...files.keys()].filter((path) => /\.[cm]?[jt]sx?$/.test(path));
        if (!configuration) return;
        const path = projectPath(configuration);
        const text = readFile(path);
        if (text === undefined) return;
        const parsed = typescript.parseConfigFileTextToJson(path, text);
        if (parsed.error) {
          configurationErrors = [parsed.error];
          return;
        }
        const result = typescript.parseJsonConfigFileContent(
          parsed.config,
          host,
          path.slice(0, path.lastIndexOf('/')),
          undefined,
          path,
        );
        options = {
          ...options,
          ...result.options,
          noEmit: true,
          skipLibCheck: true,
          allowNonTsExtensions: true,
        };
        if (result.options.module !== undefined && result.options.moduleResolution === undefined)
        options.moduleResolution = typescript.getEmitModuleResolutionKind(result.options);
        if (result.options.allowJs === false && result.options.checkJs === undefined)
        options.checkJs = false;
        if (
          options.moduleResolution === typescript.ModuleResolutionKind.Classic &&
          result.options.resolveJsonModule === undefined
        )
        options.resolveJsonModule = false;
        configurationErrors = result.errors;
        rootNames = result.fileNames.filter((name) => files.has(name));
      }
      function synchronize(update) {
        const reset = update.reset || projectId !== update.projectId;
        if (
          !reset &&
          configuration === update.configuration &&
          !update.files?.length &&
          !update.removed?.length
        )
        return;
        if (reset) {
          service?.dispose();
          service = null;
          files.clear();
          snapshots.clear();
        }
        projectId = update.projectId;
        configuration = update.configuration;
        for (const path of update.removed || []) {
          const name = projectPath(path);
          files.delete(name);
          snapshots.delete(name);
        }
        for (const file of update.files || []) {
          const name = projectPath(file.path);
          files.set(name, { text: file.text, version: ++fileVersion });
        }
        projectVersion++;
        configure();
        if (!service)
        service = typescript.createLanguageService(
          host,
          typescript.createDocumentRegistry(true, projectRoot),
        );
      }
      function requireFile(path) {
        const name = projectPath(path);
        if (!files.has(name)) throw new Error('The file is no longer in the project');
        if (!rootNames.includes(name)) {
          rootNames.push(name);
          projectVersion++;
        }
        return name;
      }
      function wordRange(text, position) {
        const isIdentifier = (value) => !!value && /[\p{ID_Continue}$\u200c\u200d]/u.test(value);
        let start = position;
        let end = position;
        while (start > 0) {
          const previous =
          start > 1 &&
          /[\uDC00-\uDFFF]/.test(text[start - 1]) &&
          /[\uD800-\uDBFF]/.test(text[start - 2])
          ? start - 2
          : start - 1;
          if (!isIdentifier(text.slice(previous, start))) break;
          start = previous;
        }
        while (end < text.length) {
          const character = String.fromCodePoint(text.codePointAt(end));
          if (!isIdentifier(character)) break;
          end += character.length;
        }
        return { start, length: end - start };
      }
      function matchRank(name, prefix) {
        if (!prefix || name.startsWith(prefix)) return 0;
        if (name.toLowerCase().startsWith(prefix.toLowerCase())) return 1;
        const initials = name.replace(/[^A-Z_$]/g, '').toLowerCase();
        return initials.startsWith(prefix.toLowerCase()) ? 2 : Infinity;
      }
      function completions(path, position) {
        const name = requireFile(path);
        const text = files.get(name).text;
        if (!Number.isInteger(position) || position < 0 || position > text.length)
        return { items: [] };
        const result = service.getCompletionsAtPosition(name, position, {
            includeCompletionsForModuleExports: false,
            includeCompletionsWithInsertText: true,
            includeCompletionsWithSnippetText: false,
        });
        if (!result) return { items: [] };
        const fallback = result.optionalReplacementSpan || wordRange(text, position);
        const items = result.entries
        .map((entry) => {
            const replacement = entry.replacementSpan;
            const span =
            replacement && replacement.start <= fallback.start
            ? {
              start: replacement.start,
              length:
              Math.max(
                replacement.start + replacement.length,
                fallback.start + fallback.length,
              ) - replacement.start,
            }
            : replacement || fallback;
            const prefix = text.slice(fallback.start, position);
            return {
              name: entry.name,
              kind: entry.kind,
              insertText: entry.insertText || entry.name,
              sortText: entry.sortText,
              source: entry.source,
              data: entry.data,
              span,
              rank: matchRank(entry.name, prefix),
            };
        })
        .filter((entry) => Number.isFinite(entry.rank));
        items.sort(
          (left, right) =>
          left.rank - right.rank ||
          left.sortText.localeCompare(right.sortText) ||
          left.name.localeCompare(right.name),
        );
        return { items: items.slice(0, 80) };
      }
      function details(path, position, item) {
        const name = requireFile(path);
        const result = service.getCompletionEntryDetails(
          name,
          position,
          item.name,
          {},
          item.source,
          {},
          item.data,
        );
        return result
        ? {
          signature: typescript.displayPartsToString(result.displayParts),
          documentation: typescript.displayPartsToString(result.documentation).slice(0, 600),
        }
        : null;
      }
      function definitions(path, position) {
        const name = requireFile(path);
        const results = service.getDefinitionAtPosition(name, position) || [];
        const locations = [];
        const seen = new Set();
        for (const result of results) {
          if (!result.fileName.startsWith(projectRoot) || !files.has(result.fileName)) continue;
          const key = `${result.fileName}:${result.textSpan.start}`;
          if (seen.has(key)) continue;
          seen.add(key);
          locations.push({
              path: result.fileName.slice(projectRoot.length),
              start: result.textSpan.start,
              length: result.textSpan.length,
          });
        }
        return { locations, external: results.length > 0 && locations.length === 0 };
      }
      function diagnosticRecord(diagnostic, path, text) {
        const start = Math.max(0, Math.min(text.length, diagnostic.start ?? 0));
        const prefix = text.slice(0, start);
        return {
          path,
          start,
          length: Math.max(0, Math.min(diagnostic.length ?? 1, text.length - start)),
          line: prefix.split('\n').length,
          column: start - prefix.lastIndexOf('\n'),
          severity:
          diagnostic.category === typescript.DiagnosticCategory.Error
          ? 'error'
          : diagnostic.category === typescript.DiagnosticCategory.Warning
          ? 'warning'
          : 'info',
          code:
          typeof diagnostic.code === 'number' ? `TS${diagnostic.code}` : String(diagnostic.code),
          message: typescript.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
        };
      }
      function diagnostics(path) {
        const name = requireFile(path);
        const text = files.get(name).text;
        let results;
        if (/\.jsonc?$/i.test(path)) {
          const parsed = typescript.parseJsonText(name, text);
          results = [...parsed.parseDiagnostics];
          if (!/\.jsonc$|(?:^|\/)(?:tsconfig|jsconfig)(?:\.[^/]+)?\.json$/i.test(path)) {
            try {
              JSON.parse(text);
            } catch (error) {
              if (!results.length) {
                const match = /position (\d+)/i.exec(error.message);
                results.push({
                    start: match ? Number(match[1]) : 0,
                    length: 1,
                    category: typescript.DiagnosticCategory.Error,
                    code: 'JSON',
                    messageText: error.message,
                });
              }
            }
          }
        } else
        results = [
          ...service.getSyntacticDiagnostics(name),
          ...service.getSemanticDiagnostics(name),
        ];
        const unique = new Map();
        for (const diagnostic of results) {
          const item = diagnosticRecord(diagnostic, path, text);
          unique.set(`${item.start}:${item.code}:${item.message}`, item);
        }
        const items = [...unique.values()].sort((left, right) => left.start - right.start);
        const optionDiagnostics = /\.jsonc?$/i.test(path)
        ? []
        : service.getCompilerOptionsDiagnostics();
        const messages = [...configurationErrors, ...optionDiagnostics].map((error) =>
          typescript.flattenDiagnosticMessageText(error.messageText, '\n'),
        );
        return {
          items: items.slice(0, 150),
          total: items.length,
          configurationErrors: [...new Set(messages)],
        };
      }
      function dispose() {
        service?.dispose();
        service = null;
        files.clear();
        snapshots.clear();
      }
      return Object.freeze({
          synchronize,
          completions,
          details,
          definitions,
          diagnostics,
          dispose,
          requiredLibraries: () =>
          options.noLib ? [] : options.lib || [typescript.getDefaultLibFileName(options)],
      });
    }
    root.SynapseTypeScriptService = Object.freeze({ create: createService });
})(globalThis);
