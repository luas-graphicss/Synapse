(function (root) {
    'use strict';

    const maximumCharacters = 250000;
    const maximumDiagnostics = 150;
    const supportedPath = /\.(?:[cm]?[jt]s|[jt]sx|jsonc?)$/i;
    const relaxedJsonPath = /\.jsonc$|(?:^|\/)(?:tsconfig|jsconfig)(?:\.[^/]+)?\.json$/i;

    function createRecord(typescript, diagnostic, path, text) {
      const start = Math.max(0, Math.min(text.length, diagnostic.start ?? 0));
      const prefix = text.slice(0, start);
      return {
        path,
        start,
        length: Math.max(0, Math.min(diagnostic.length ?? 1, text.length - start)),
        line: prefix.split('\n').length,
        column: start - prefix.lastIndexOf('\n'),
        severity: 'error',
        code: typeof diagnostic.code === 'number' ? `TS${diagnostic.code}` : String(diagnostic.code),
        message: typescript.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
      };
    }

    function scriptDiagnostics(typescript, path, text) {
      const fileName = '/syntax/source' + path.match(/\.[^.]+$/)[0];
      const source = typescript.createSourceFile(fileName, text, typescript.ScriptTarget.Latest, false);
      const host = {
        getSourceFile: (name) => (name === fileName ? source : undefined),
        getDefaultLibFileName: () => '',
        writeFile: () => undefined,
        getCurrentDirectory: () => '/syntax',
        getDirectories: () => [],
        fileExists: (name) => name === fileName,
        readFile: (name) => (name === fileName ? text : undefined),
        getCanonicalFileName: (name) => name,
        useCaseSensitiveFileNames: () => true,
        getNewLine: () => '\n',
      };
      const program = typescript.createProgram(
        [fileName],
        {
          noLib: true,
          noResolve: true,
          allowJs: true,
          checkJs: true,
          jsx: typescript.JsxEmit.Preserve,
          target: typescript.ScriptTarget.Latest,
        },
        host,
      );
      return program.getSyntacticDiagnostics(source);
    }

    function analyze(typescript, path, text) {
      if (typeof path !== 'string' || !supportedPath.test(path))
      throw new TypeError('Unsupported syntax document');
      if (typeof text !== 'string' || text.length > maximumCharacters)
      throw new RangeError('Syntax document exceeds the analysis limit');
      const normalizedText = text.replace(/\r\n?/g, '\n');
      const json = /\.jsonc?$/i.test(path);
      const diagnostics = json
      ? [...typescript.parseJsonText(path, normalizedText).parseDiagnostics]
      : [...scriptDiagnostics(typescript, path, normalizedText)];
      if (json && !relaxedJsonPath.test(path)) {
        try {
          JSON.parse(normalizedText);
        } catch (error) {
          if (!diagnostics.length) {
            const match = /position (\d+)/i.exec(error.message);
            diagnostics.push({
                start: match ? Number(match[1]) : normalizedText.length,
                length: 1,
                code: 'JSON',
                messageText: error.message,
            });
          }
        }
      }
      const items = diagnostics
      .slice(0, maximumDiagnostics)
      .map((diagnostic) => createRecord(typescript, diagnostic, path, normalizedText))
      .sort((first, second) => first.start - second.start);
      return { items, total: diagnostics.length, configurationErrors: [] };
    }

    root.SynapseSyntaxDiagnostics = Object.freeze({ analyze });
})(globalThis);
