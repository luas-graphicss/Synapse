(function () {
    'use strict';

    function contains(directory, path) {
      return path === directory || path.startsWith(directory + '/');
    }

    function directoryOf(path) {
      return path.slice(0, Math.max(0, path.lastIndexOf('/')));
    }

    function directories(project) {
      const result = new Set(project.emptyDirs || []);
      for (const path of [...project.files.keys(), ...result]) {
        let directory = directoryOf(path);
        while (directory) {
          result.add(directory);
          directory = directoryOf(directory);
        }
      }
      return result;
    }

    function roots(project, paths) {
      const folders = directories(project);
      const unique = [...new Set(paths)].filter(
        (path) => project.files.has(path) || folders.has(path),
      );
      return unique.filter(
        (path) =>
        !unique.some((parent) => parent !== path && folders.has(parent) && contains(parent, path)),
      );
    }

    function capture(project, paths) {
      const selectedRoots = roots(project, paths);
      return {
        roots: selectedRoots,
        files: new Map(
          [...project.files]
          .filter(([path]) => selectedRoots.some((root) => contains(root, path)))
          .map(([path, file]) => [
              path,
              {
                ...file,
                data: file.data ? file.data.slice() : null,
                history: (file.history || []).map((entry) => ({ ...entry })),
              },
          ]),
        ),
        emptyDirs: new Set(
          [...directories(project)].filter((path) =>
            selectedRoots.some((root) => contains(root, path)),
          ),
        ),
      };
    }

    function availableName(project, desiredPath, reserved, isFile) {
      const occupied = new Set([...project.files.keys(), ...directories(project), ...reserved]);
      if (!occupied.has(desiredPath)) return desiredPath;
      const separator = desiredPath.lastIndexOf('/');
      const dot = desiredPath.lastIndexOf('.');
      const extension = isFile && dot > separator + 1 ? desiredPath.slice(dot) : '';
      const stem = extension ? desiredPath.slice(0, -extension.length) : desiredPath;
      for (let index = 1; index <= 10000; index++) {
        const candidate = stem + ' copy' + (index === 1 ? '' : ' ' + index) + extension;
        if (!occupied.has(candidate)) return candidate;
      }
      throw new Error('No available filename.');
    }

    function planTransfer(project, source, destination, move = false, duplicate = false) {
      const targetDirectories = directories(project);
      if (destination && !targetDirectories.has(destination))
      throw new Error('A pasta de destino não existe mais.');
      const reserved = new Set();
      const mapping = new Map();
      for (const root of source.roots) {
        if (move && !source.files.has(root) && contains(root, destination))
        throw new Error('Não é possível colocar uma pasta dentro dela mesma.');
        const parent = duplicate ? directoryOf(root) : destination;
        const desired = (parent ? parent + '/' : '') + root.slice(root.lastIndexOf('/') + 1);
        if (move && desired === root) continue;
        if (
          move &&
          (project.files.has(desired) || targetDirectories.has(desired) || reserved.has(desired))
        ) {
          throw new Error('Já existe um item em "' + desired + '". Nenhum arquivo foi movido.');
        }
        const target = move
        ? desired
        : availableName(project, desired, reserved, source.files.has(root));
        reserved.add(target);
        mapping.set(root, target);
      }
      function remap(path) {
        if (!path) return path;
        for (const [root, target] of mapping) {
          if (contains(root, path)) return target + path.slice(root.length);
        }
        return path;
      }
      return { mapping, remap, targets: [...mapping.values()] };
    }

    function transfer(project, source, plan, move) {
      if (!plan.mapping.size) return [];
      const files = new Map(project.files);
      const emptyDirectories = new Set(project.emptyDirs || []);
      if (move) {
        for (const path of source.files.keys()) if (plan.remap(path) !== path) files.delete(path);
        for (const path of emptyDirectories)
        if (plan.remap(path) !== path) emptyDirectories.delete(path);
      }
      for (const [path, file] of source.files) {
        const destination = plan.remap(path);
        if (move && destination === path) continue;
        files.set(destination, {
            ...file,
            path: destination,
            data: file.data ? file.data.slice() : null,
            history: (file.history || []).map((entry) => ({ ...entry })),
        });
        project.dirty.add(destination);
      }
      for (const path of source.emptyDirs) {
        if (!move || plan.remap(path) !== path) emptyDirectories.add(plan.remap(path));
      }
      project.files = files;
      project.emptyDirs = emptyDirectories;
      if (move) {
        project.openFile = plan.remap(project.openFile);
        project.openTabs = (project.openTabs || []).map(plan.remap);
        project.dirty = new Set([...project.dirty].map(plan.remap));
        project.entry = plan.remap(project.entry);
        if (project.detect?.entry) project.detect.entry = plan.remap(project.detect.entry);
        window.SynapseDebug?.preferences.remap(project, plan.remap);
        window.SynapseExplorerSelection?.remap(project, plan.remap);
      }
      return plan.targets;
    }

    function remove(project, paths) {
      const selectedRoots = roots(project, paths);
      const removed = (path) => path && selectedRoots.some((root) => contains(root, path));
      project.files = new Map([...project.files].filter(([path]) => !removed(path)));
      project.emptyDirs = new Set([...(project.emptyDirs || [])].filter((path) => !removed(path)));
      project.dirty = new Set([...project.dirty].filter((path) => !removed(path)));
      project.openTabs = (project.openTabs || []).filter((path) => !removed(path));
      if (removed(project.openFile)) project.openFile = project.openTabs.at(-1) || project.files.keys().next().value || null;
      if (removed(project.entry)) project.entry = null;
      if (removed(project.detect?.entry)) project.detect.entry = null;
      window.SynapseDebug?.preferences.remap(project, (path) => (removed(path) ? null : path));
      return selectedRoots;
    }

    window.SynapseExplorerFiles = Object.freeze({
        contains,
        directoryOf,
        directories,
        roots,
        capture,
        planTransfer,
        transfer,
        remove,
    });
})();
