(function (root) {
    'use strict';

    const presetTypes = ['configurePresets', 'buildPresets', 'testPresets'];

    function read(files, sourceDirectory = '.') {
      const project = root.SYNAPSE_CMAKE_PROJECT;
      const mapped = project.fileMap(files);
      const source = project.normalizePath(sourceDirectory);
      const documents = new Map();
      const visiting = new Set();
      const definitions = Object.fromEntries(presetTypes.map((type) => [type, new Map()]));
      const resolved = Object.fromEntries(presetTypes.map((type) => [type, new Map()]));
      const publicPath = project.joinPath(source, 'CMakePresets.json');
      const userPath = project.joinPath(source, 'CMakeUserPresets.json');

      function visit(path) {
        if (visiting.has(path)) throw new Error(`CMake preset include cycle: ${path}`);
        if (documents.has(path)) return;
        if (documents.size + visiting.size >= 64)
        throw new Error('Too many CMake preset include files.');
        if (!mapped.has(path)) throw new Error(`CMake preset include not imported: ${path}`);
        let document;
        try {
          document = JSON.parse(mapped.get(path).replace(/^\uFEFF/, ''));
        } catch (error) {
          throw new Error(`Invalid JSON in ${path}: ${error.message}`);
        }
        if (
          !document ||
          typeof document !== 'object' ||
          Array.isArray(document) ||
          !Number.isInteger(document.version) ||
          document.version < 1
        )
        throw new Error(`Invalid CMake preset document: ${path}`);
        visiting.add(path);
        const includes = document.include ?? [];
        if (!Array.isArray(includes) || includes.some((value) => typeof value !== 'string'))
        throw new Error(`Expected an include array in ${path}.`);
        for (const include of includes) {
          if (include.includes('$'))
          throw new Error(`Preset include macros require the native terminal: ${include}`);
          visit(project.joinPath(project.directoryOf(path), include));
        }
        for (const type of presetTypes) {
          const entries = document[type] ?? [];
          if (!Array.isArray(entries)) throw new Error(`Expected ${type} to be an array in ${path}.`);
          for (const entry of entries) {
            if (
              !entry ||
              typeof entry !== 'object' ||
              typeof entry.name !== 'string' ||
              !entry.name.trim()
            )
            throw new Error(`A preset has no valid name in ${path}.`);
            if (definitions[type].has(entry.name))
            throw new Error(`Duplicate ${type} name: ${entry.name}`);
            definitions[type].set(entry.name, { ...entry, origin: path });
          }
        }
        documents.set(path, document);
        visiting.delete(path);
      }

      if (mapped.has(publicPath)) visit(publicPath);
      if (mapped.has(userPath)) visit(userPath);

      function resolve(type, name, ancestors = new Set()) {
        if (resolved[type].has(name)) return resolved[type].get(name);
        if (ancestors.size > 128) throw new Error('CMake preset inheritance is too deep.');
        const definition = definitions[type].get(name);
        if (!definition) throw new Error(`Missing inherited ${type} preset: ${name}`);
        if (ancestors.has(name)) throw new Error(`CMake preset inheritance cycle: ${name}`);
        const nextAncestors = new Set([...ancestors, name]);
        const inherits =
        definition.inherits == null
        ? []
        : Array.isArray(definition.inherits)
        ? definition.inherits
        : [definition.inherits];
        if (inherits.some((parent) => typeof parent !== 'string'))
        throw new Error(`Invalid inheritance in preset: ${name}`);
        let inherited = {};
        for (const parent of [...inherits].reverse())
        inherited = { ...inherited, ...resolve(type, parent, nextAncestors) };
        const preset = { ...inherited, ...definition, hidden: definition.hidden === true };
        resolved[type].set(name, preset);
        return preset;
      }

      const catalog = {};
      for (const type of presetTypes) {
        catalog[type] = [...definitions[type].keys()]
        .map((name) => resolve(type, name))
        .filter((preset) => !preset.hidden && preset.condition !== false);
      }
      return { ...catalog, files: [...documents.keys()] };
    }

    root.SYNAPSE_CMAKE_PRESETS = Object.freeze({ read });
})(globalThis);
