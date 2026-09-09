(function (root) {
    'use strict';

    function analyze(parser, path, text) {
      if (typeof path !== 'string' || !/\.(?:[cm]?[jt]s|[jt]sx)$/i.test(path))
      throw new TypeError('Unsupported script document');
      if (typeof text !== 'string' || text.length > 250000)
      throw new RangeError('Syntax document exceeds the analysis limit');
      const source = text.replace(/\r\n?/g, '\n');
      const extension = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
      const plugins = ['decorators-legacy', 'explicitResourceManagement', 'importAttributes'];
      if (['ts', 'tsx', 'mts', 'cts'].includes(extension))
      plugins.push(['typescript', { disallowAmbiguousJSXLike: ['mts', 'cts'].includes(extension) }]);
      if (['js', 'jsx', 'tsx'].includes(extension)) plugins.push('jsx');
      let errors;
      try {
        const result = parser.parse(source, {
            sourceType: 'unambiguous',
            allowReturnOutsideFunction: true,
            allowAwaitOutsideFunction: true,
            allowUndeclaredExports: true,
            attachComment: false,
            errorRecovery: true,
            plugins,
        });
        errors = result.errors;
      } catch (error) {
        if (!Number.isInteger(error.pos)) throw error;
        errors = [error];
      }
      const items = errors.slice(0, 150).map((error) => {
          const start = Math.max(0, Math.min(source.length, error.pos ?? source.length));
          const prefix = source.slice(0, start);
          return {
            path,
            start,
            length: start === source.length ? 0 : source.codePointAt(start) > 0xffff ? 2 : 1,
            line: prefix.split('\n').length,
            column: start - prefix.lastIndexOf('\n'),
            severity: 'error',
            code: 'SYNTAX_' + (error.reasonCode || 'UnexpectedToken'),
            message: error.message.replace(/ \(\d+:\d+\)$/, ''),
          };
      });
      return { items, total: errors.length, configurationErrors: [] };
    }

    root.SynapseLocalScriptDiagnostics = Object.freeze({ analyze });
})(globalThis);
