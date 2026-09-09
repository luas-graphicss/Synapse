(function () {
    'use strict';

    function resolveSiblingPath(currentPath, nextName) {
      if (typeof currentPath !== 'string' || typeof nextName !== 'string') return null;
      const fileName = nextName.trim();
      if (!fileName || fileName === '.' || fileName === '..') return null;
      if (/[\\/<>:"|?*\u0000-\u001f\u007f]/.test(fileName)) return null;
          const separatorIndex = currentPath.lastIndexOf('/');
          return currentPath.slice(0, separatorIndex + 1) + fileName;
        }

        function destinationExists(project, destinationPath) {
          if (project.files.has(destinationPath) || project.emptyDirs?.has(destinationPath)) return true;
          const directoryPrefix = destinationPath + '/';
          for (const filePath of project.files.keys()) {
            if (filePath.startsWith(directoryPrefix)) return true;
          }
          for (const directoryPath of project.emptyDirs || []) {
            if (directoryPath.startsWith(directoryPrefix)) return true;
          }
          return false;
        }

        function renameEntry(project, currentPath, nextName, isDirectory, expandedDirectories) {
          const destinationPath = resolveSiblingPath(currentPath, nextName);
          if (!destinationPath) return { changed: false, error: 'invalid-name' };
          if (destinationPath === currentPath) return { changed: false };
          const sourceExists = isDirectory
          ? destinationExists(project, currentPath)
          : project.files.has(currentPath);
          if (!sourceExists) return { changed: false, error: 'missing-source' };
          if (destinationExists(project, destinationPath)) return { changed: false, error: 'conflict' };
          const sourcePrefix = currentPath + '/';

          function remapPath(filePath) {
            if (filePath === currentPath) return destinationPath;
            if (isDirectory && filePath?.startsWith(sourcePrefix)) {
              return destinationPath + '/' + filePath.slice(sourcePrefix.length);
            }
            return filePath;
          }

          const renamedFiles = new Map();
          for (const [filePath, entry] of project.files) {
            const renamedPath = remapPath(filePath);
            if (renamedPath !== filePath) entry.path = renamedPath;
            renamedFiles.set(renamedPath, entry);
          }
          project.files = renamedFiles;
          window.SynapseExplorerSelection?.remap(project, remapPath);
          window.SynapseDebug?.preferences.remap(project, remapPath);
          if (project.openFile) project.openFile = remapPath(project.openFile);
          if (project.openTabs) project.openTabs = project.openTabs.map(remapPath);
          if (project.dirty) project.dirty = new Set(Array.from(project.dirty, remapPath));
          if (project.entry) project.entry = remapPath(project.entry);
          if (project.detect?.entry) project.detect.entry = remapPath(project.detect.entry);
          if (isDirectory && project.emptyDirs) {
            project.emptyDirs = new Set(Array.from(project.emptyDirs, remapPath));
          }
          if (isDirectory && expandedDirectories) {
            const renamedDirectories = Array.from(expandedDirectories, remapPath);
            expandedDirectories.clear();
            renamedDirectories.forEach((directoryPath) => expandedDirectories.add(directoryPath));
          }
          return { changed: true, destinationPath };
        }

        window.SynapseRenamePath = Object.freeze({ resolveSiblingPath, destinationExists, renameEntry });
    })();
