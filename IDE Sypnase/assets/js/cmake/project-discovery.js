(function (root) {
    'use strict';

    const ignoredDirectory =
    /(^|\/)(?:node_modules|\.git|\.svn|dist|build(?:[-_][^/]*)?|cmake-build[^/]*|CMakeFiles|out|bin|obj|target|vendor|_deps)(?:\/|$)/i;
    const supportingDirectory =
    /(^|\/)(?:docs?|examples?|samples?|tools?|scripts?|tests?|third[-_]?party|external|deps|\.github)(?:\/|$)/i;

    function normalizePath(value) {
      const path = String(value ?? '').replace(/\\/g, '/');
      if (/^(?:\/|[a-z]:)/i.test(path) || /[\x00-\x1f\x7f]/.test(path))
      throw new Error('Use a relative path inside the project.');
      const segments = [];
      for (const segment of path.split('/')) {
        if (!segment || segment === '.') continue;
        if (segment === '..') {
          if (!segments.length) throw new Error('The path leaves the project.');
          segments.pop();
        } else segments.push(segment);
      }
      return segments.join('/') || '.';
    }

    function directoryOf(path) {
      const normalized = normalizePath(path);
      const separator = normalized.lastIndexOf('/');
      return separator === -1 ? '.' : normalized.slice(0, separator);
    }

    function joinPath(directory, path) {
      if (/^(?:[\\/]|[a-z]:)/i.test(String(path)))
      throw new Error('Use a relative path inside the project.');
      return normalizePath(`${directory}/${path}`);
    }

    function relativePath(from, to) {
      const origin = normalizePath(from)
      .split('/')
      .filter((segment) => segment !== '.');
      const destination = normalizePath(to)
      .split('/')
      .filter((segment) => segment !== '.');
      while (origin.length && destination.length && origin[0] === destination[0]) {
        origin.shift();
        destination.shift();
      }
      return [...origin.map(() => '..'), ...destination].join('/') || '.';
    }

    function fileMap(files) {
      const result = new Map();
      const add = (path, value) => {
        const normalized = normalizePath(path);
        const text =
        typeof value === 'string'
        ? value
        : (value?.text ?? value?.content ?? value?.conteudo ?? '');
        result.set(normalized, String(text));
      };
      if (files instanceof Map) files.forEach((value, path) => add(path, value));
      else if (Array.isArray(files)) {
        for (const entry of files) {
          if (typeof entry === 'string') add(entry, '');
          else if (entry) add(entry.path ?? entry.caminho ?? entry.nome, entry);
        }
      } else if (files && typeof files === 'object') {
        for (const [path, value] of Object.entries(files)) add(path, value);
      }
      return result;
    }

    function discover(files) {
      const paths = [...fileMap(files).keys()];
      const manifests = paths.filter(
        (path) => /(?:^|\/)CMakeLists\.txt$/.test(path) && !ignoredDirectory.test(path),
      );
      manifests.sort(
        (left, right) =>
        left.split('/').length - right.split('/').length || left.localeCompare(right),
      );
      return manifests.map((path) => ({
            sourceDirectory: directoryOf(path),
            manifest: path,
            supporting: supportingDirectory.test(path),
      }));
    }

    function primary(files) {
      const mapped = fileMap(files);
      const candidates = discover(mapped).filter((candidate) => !candidate.supporting);
      const candidate = candidates[0];
      if (!candidate) return null;
      if (candidate.sourceDirectory === '.') return candidate;
      const sourceDepth = candidate.sourceDirectory.split('/').length;
      const shallowerWeb = [...mapped.keys()].some(
        (path) =>
        /(?:^|\/)(?:index\.html?|package\.json)$/i.test(path) &&
        !ignoredDirectory.test(path) &&
        !supportingDirectory.test(path) &&
        path.split('/').length - 1 < sourceDepth,
      );
      return shallowerWeb ? null : candidate;
    }

    root.SYNAPSE_CMAKE_PROJECT = Object.freeze({
        normalizePath,
        directoryOf,
        joinPath,
        relativePath,
        fileMap,
        discover,
        primary,
    });
})(globalThis);
