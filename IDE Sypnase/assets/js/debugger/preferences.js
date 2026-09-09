(function () {
    'use strict';

    const debug = window.SynapseDebug;
    const initializedProjects = new WeakSet();
    const observedSources = new WeakMap();
    const limits = Object.freeze({ breakpoints: 500, watches: 100, expression: 1024 });

    function sanitize(value) {
      const source = value && typeof value === 'object' ? value : {};
      const keys = new Set();
      const breakpoints = [];
      for (const candidate of Array.isArray(source.breakpoints) ? source.breakpoints : []) {
        if (!candidate || !debug.paths.isJavaScript(candidate.path)) continue;
        if (!Number.isSafeInteger(candidate.line) || candidate.line < 1 || candidate.line > 1000000)
        continue;
        const breakpoint = {
          path: debug.paths.projectPath(candidate.path),
          line: candidate.line,
          enabled: candidate.enabled !== false,
        };
        const key = debug.paths.breakpointKey(breakpoint);
        if (keys.has(key)) continue;
        keys.add(key);
        breakpoints.push(breakpoint);
        if (breakpoints.length === limits.breakpoints) break;
      }
      const watches = Array.from(
        new Set(
          (Array.isArray(source.watches) ? source.watches : [])
          .filter(
            (expression) =>
            typeof expression === 'string' &&
            expression.trim() &&
            expression.length <= limits.expression,
          )
          .map((expression) => expression.trim()),
        ),
      ).slice(0, limits.watches);
      return {
        version: 1,
        entry: debug.paths.isJavaScript(source.entry) ? source.entry : '',
        sourceRoot: typeof source.sourceRoot === 'string' ? source.sourceRoot.slice(0, 2048) : '',
        breakpoints,
        watches,
      };
    }

    function forProject(project) {
      if (!project) return sanitize(null);
      if (!initializedProjects.has(project)) {
        project.debuggerState = sanitize(project.debuggerState);
        initializedProjects.add(project);
      }
      return project.debuggerState;
    }

    function toggleBreakpoint(project, path, line) {
      if (!project || !debug.paths.isJavaScript(path) || !Number.isSafeInteger(line) || line < 1)
      return false;
      const file = project.files.get(path);
      if (typeof file?.text !== 'string' || line > file.text.split('\n').length) return false;
      const preferences = forProject(project);
      const index = preferences.breakpoints.findIndex(
        (entry) => entry.path === path && entry.line === line,
      );
      if (index >= 0) preferences.breakpoints.splice(index, 1);
      else {
        if (preferences.breakpoints.length >= limits.breakpoints)
        throw new Error('Breakpoint limit reached (500).');
        preferences.breakpoints.push({ path, line, enabled: true });
      }
      return true;
    }

    function addWatch(project, value) {
      const expression = String(value || '').trim();
      if (!expression || expression.length > limits.expression)
      throw new Error('Use a watch expression of 1–1024 characters.');
      const preferences = forProject(project);
      if (preferences.watches.includes(expression)) return false;
      if (preferences.watches.length >= limits.watches) throw new Error('Watch limit reached (100).');
      preferences.watches.push(expression);
      return true;
    }

    function remap(project, remapPath) {
      if (!project?.debuggerState) return;
      const preferences = forProject(project);
      preferences.entry = remapPath(preferences.entry) || '';
      preferences.breakpoints = preferences.breakpoints.map((entry) => ({
            ...entry,
            path: remapPath(entry.path),
      }));
      project.debuggerState = sanitize(preferences);
    }

    function observeSources(project) {
      if (!project?.debuggerState) return false;
      if (!observedSources.has(project)) observedSources.set(project, new Map());
      const sources = observedSources.get(project);
      const paths = new Set(forProject(project).breakpoints.map((entry) => entry.path));
      let changed = false;
      for (const path of paths) {
        const currentText = project.files.get(path)?.text;
        if (typeof currentText !== 'string') {
          sources.delete(path);
          continue;
        }
        const previousText = sources.get(path);
        sources.set(path, currentText);
        if (previousText !== undefined && previousText !== currentText) {
          rebase(project, path, previousText, currentText);
          changed = true;
        }
      }
      for (const path of sources.keys()) if (!paths.has(path)) sources.delete(path);
      return changed;
    }

    function rebase(project, path, previousText, nextText) {
      if (!project?.debuggerState || previousText === nextText) return;
      if (!forProject(project).breakpoints.some((entry) => entry.path === path)) return;
      if (!observedSources.has(project)) observedSources.set(project, new Map());
      observedSources.get(project).set(path, nextText);
      const previousLines = previousText.split('\n');
      const nextLines = nextText.split('\n');
      let prefix = 0;
      while (
        prefix < previousLines.length &&
        prefix < nextLines.length &&
        previousLines[prefix] === nextLines[prefix]
      )
      prefix++;
      let suffix = 0;
      while (
        suffix < previousLines.length - prefix &&
        suffix < nextLines.length - prefix &&
        previousLines[previousLines.length - suffix - 1] === nextLines[nextLines.length - suffix - 1]
      )
      suffix++;
      const delta = nextLines.length - previousLines.length;
      const preferences = forProject(project);
      preferences.breakpoints = preferences.breakpoints.map((entry) => {
          if (entry.path !== path || entry.line <= prefix) return entry;
          const line =
          entry.line > previousLines.length - suffix
          ? entry.line + delta
          : Math.min(entry.line, nextLines.length - suffix || 1);
          return { ...entry, line: Math.max(1, line) };
      });
      project.debuggerState = sanitize(preferences);
    }

    debug.preferences = Object.freeze({
        sanitize,
        forProject,
        toggleBreakpoint,
        addWatch,
        remap,
        rebase,
        observeSources,
        limits,
    });
})();
