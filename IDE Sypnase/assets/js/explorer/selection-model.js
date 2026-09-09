(function () {
    'use strict';

    const projects = new WeakMap();

    function state(project) {
      if (!projects.has(project)) {
        projects.set(project, {
            selected: new Set(),
            anchor: null,
            focused: null,
            visible: [],
            initialized: false,
        });
      }
      return projects.get(project);
    }

    function synchronize(project, visiblePaths) {
      const selection = state(project);
      const available = new Set(visiblePaths);
      selection.visible = visiblePaths.slice();
      selection.selected = new Set([...selection.selected].filter((path) => available.has(path)));
      if (!available.has(selection.focused)) {
        selection.focused = [...selection.selected][0] || visiblePaths[0] || null;
      }
      if (!available.has(selection.anchor)) selection.anchor = selection.focused;
      if (!selection.initialized && available.has(project.openFile)) {
        selection.selected.add(project.openFile);
        selection.anchor = project.openFile;
        selection.focused = project.openFile;
      }
      selection.initialized ||= visiblePaths.length > 0;
      return selection;
    }

    function select(project, path, options = {}) {
      const selection = state(project);
      if (!selection.visible.includes(path)) return selection;
      if (options.range) {
        const anchor = selection.visible.indexOf(selection.anchor);
        const target = selection.visible.indexOf(path);
        const start = anchor < 0 ? target : anchor;
        const range = selection.visible.slice(Math.min(start, target), Math.max(start, target) + 1);
        selection.selected = new Set(options.additive ? [...selection.selected, ...range] : range);
        if (anchor < 0) selection.anchor = path;
      } else if (options.toggle) {
        if (selection.selected.has(path)) selection.selected.delete(path);
        else selection.selected.add(path);
        selection.anchor = path;
      } else if (!options.focusOnly) {
        selection.selected = new Set([path]);
        selection.anchor = path;
      }
      selection.focused = path;
      return selection;
    }

    function selectAll(project) {
      const selection = state(project);
      selection.selected = new Set(selection.visible);
      selection.anchor ||= selection.visible[0] || null;
      return selection;
    }

    function clear(project) {
      const selection = state(project);
      selection.selected.clear();
      selection.anchor = selection.focused;
      return selection;
    }

    function replace(project, paths) {
      const selection = state(project);
      selection.selected = new Set(paths);
      selection.focused = paths[0] || null;
      selection.anchor = selection.focused;
      selection.initialized = true;
      return selection;
    }

    function remap(project, transform) {
      if (!projects.has(project)) return;
      const selection = state(project);
      selection.selected = new Set([...selection.selected].map(transform).filter(Boolean));
      selection.focused = selection.focused ? transform(selection.focused) : null;
      selection.anchor = selection.anchor ? transform(selection.anchor) : null;
      selection.visible = selection.visible.map(transform).filter(Boolean);
    }

    window.SynapseExplorerSelection = Object.freeze({
        state,
        synchronize,
        select,
        selectAll,
        clear,
        replace,
        remap,
    });
})();
