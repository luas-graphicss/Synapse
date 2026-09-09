(function (root) {
    'use strict';

    const namespace = (root.SynapseIntelligence = root.SynapseIntelligence || {});
    const limits = Object.freeze({ fileCharacters: 250000, projectCharacters: 8000000, files: 600 });
    const scriptPattern = /\.(?:[cm]?[jt]s|[jt]sx)$/i;
    const supportedPattern = /\.(?:[cm]?[jt]s|[jt]sx|json|jsonc)$/i;
    const excludedPattern = /(?:^|\/)(?:\.git|dist|build|coverage|\.next)(?:\/|$)|\.min\.[cm]?js$/i;

    function normalizeText(text) {
      return text.replace(/\r\n?/g, '\n');
    }
    function isSupported(path) {
      return typeof path === 'string' && supportedPattern.test(path);
    }
    function isProjectFile(path) {
      return (
        isSupported(path) &&
        !excludedPattern.test(path) &&
        (!path.includes('node_modules/') || /\.d\.[cm]?ts$|package\.json$/.test(path))
      );
    }
    function configurationPath(project, path) {
      let directory = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
      while (true) {
        for (const name of ['tsconfig.json', 'jsconfig.json'])
        if (project.files.has(directory + name)) return directory + name;
        if (!directory) return null;
        directory = directory.slice(0, -1);
        directory = directory.includes('/') ? directory.slice(0, directory.lastIndexOf('/') + 1) : '';
      }
    }
    function createSnapshot(project, activePath) {
      const activeFile = project?.files?.get(activePath);
      if (
        !activeFile ||
        typeof activeFile.text !== 'string' ||
        !isSupported(activePath) ||
        activeFile.text.length > limits.fileCharacters
      )
      return null;
      const configuration = configurationPath(project, activePath);
      const candidates = [...project.files.entries()].filter(
        ([path, file]) =>
        typeof file.text === 'string' && (path === activePath || isProjectFile(path)),
      );
      const priority = (path) =>
      path === activePath
      ? 0
      : path === configuration
      ? 1
      : /\.jsonc?$/.test(path)
      ? 2
      : /\.d\.[cm]?ts$/.test(path)
      ? 3
      : 4;
      candidates.sort(
        ([left], [right]) => priority(left) - priority(right) || left.localeCompare(right),
      );
      const files = [];
      let characters = 0;
      let omitted = 0;
      for (const [path, file] of candidates) {
        if (
          file.text.length > limits.fileCharacters ||
          files.length >= limits.files ||
          characters + file.text.length > limits.projectCharacters
        ) {
          omitted++;
          continue;
        }
        files.push({ path, text: normalizeText(file.text) });
        characters += file.text.length;
      }
      return { projectId: String(project.id), activePath, configuration, files, omitted };
    }
    function createPatch(previous, snapshot) {
      const reset = !previous || previous.projectId !== snapshot.projectId;
      const before = reset
      ? new Map()
      : new Map(previous.files.map((file) => [file.path, file.text]));
      const after = new Map(snapshot.files.map((file) => [file.path, file.text]));
      return {
        projectId: snapshot.projectId,
        configuration: snapshot.configuration,
        reset,
        files: snapshot.files.filter((file) => before.get(file.path) !== file.text),
        removed: [...before.keys()].filter((path) => !after.has(path)),
      };
    }
    function positionAt(text, offset) {
      const end = Math.max(0, Math.min(text.length, offset));
      let line = 1;
      let lineStart = 0;
      for (let index = 0; index < end; index++)
      if (text[index] === '\n') {
        line++;
        lineStart = index + 1;
      }
      return { line, column: end - lineStart + 1 };
    }
    namespace.projectModel = Object.freeze({
        limits,
        isSupported,
        isScript: (path) => scriptPattern.test(path),
        normalizeText,
        createSnapshot,
        createPatch,
        positionAt,
    });
})(globalThis);
