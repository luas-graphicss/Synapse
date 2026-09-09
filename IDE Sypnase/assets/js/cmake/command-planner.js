(function (root) {
    'use strict';

    const configurations = ['Debug', 'Release', 'RelWithDebInfo', 'MinSizeRel'];
    const actions = ['configure', 'build', 'test', 'clean'];

    function safeValue(value, label) {
      const text = String(value ?? '');
      if (!text.trim() || /[\x00-\x1f\x7f"\\$`%&|<>^!]/.test(text))
          throw new Error(
            `${label} is empty or contains shell syntax. Use the terminal for this value.`,
          );
          return text;
        }

        function quote(value, label = 'Argument') {
          return `"${safeValue(value, label)}"`;
        }

        function nameValue(value, label) {
          const name = safeValue(value, label);
          if (name.startsWith('-')) throw new Error(`${label} cannot start with a dash.`);
          return name;
        }

        function definitions(text) {
          return String(text ?? '')
          .split(/\r?\n/)
          .filter((line) => line.trim())
          .map((line) => {
              const match =
              /^([A-Za-z_][A-Za-z0-9_]*(?::(?:BOOL|FILEPATH|PATH|STRING|INTERNAL))?)=(.*)$/.exec(
                line.trim(),
              );
              if (!match) throw new Error('Cache entries must use NAME[:TYPE]=VALUE, one per line.');
              return quote(`-D${match[1]}=${match[2]}`, 'Cache entry');
          });
        }

        function plan(files, options = {}, action = 'build') {
          if (!actions.includes(action)) throw new Error(`Unknown CMake action: ${action}`);
          const project = root.SYNAPSE_CMAKE_PROJECT;
          const mapped = project.fileMap(files);
          const source = project.normalizePath(options.sourceDirectory ?? '.');
          const manifest = project.joinPath(source, 'CMakeLists.txt');
          if (!mapped.has(manifest)) throw new Error(`CMakeLists.txt not found in ${source}.`);
          const sourceArgument = quote(source === '.' ? '.' : `./${source}`, 'Source directory');
          let configureCommand;
          let buildCommand;
          let testCommand;
          let cleanCommand;
          const presetMode = !!options.configurePreset;

          if (presetMode) {
            const catalog = root.SYNAPSE_CMAKE_PRESETS.read(mapped, source);
            const configure = catalog.configurePresets.find(
              (preset) => preset.name === options.configurePreset,
            );
            if (!configure) throw new Error('Select an available configure preset.');
            const presetArgument = quote(nameValue(configure.name, 'Configure preset'));
            const prefix = `cmake -E chdir ${sourceArgument}`;
            configureCommand = `${prefix} cmake --preset ${presetArgument}`;
            if (action !== 'configure') {
              const build = catalog.buildPresets.find((preset) => preset.name === options.buildPreset);
              if (!build || build.configurePreset !== configure.name)
              throw new Error('Select a build preset linked to the configure preset.');
              buildCommand = `${prefix} cmake --build --preset ${quote(nameValue(build.name, 'Build preset'))}`;
              cleanCommand = `${buildCommand} --target clean`;
              if (options.target?.trim())
              buildCommand += ` --target ${quote(nameValue(options.target.trim(), 'Build target'))}`;
              if (action === 'test') {
                const test = catalog.testPresets.find((preset) => preset.name === options.testPreset);
                if (!test || test.configurePreset !== configure.name)
                throw new Error('Select a test preset linked to the configure preset.');
                testCommand = `${prefix} ctest --preset ${quote(nameValue(test.name, 'Test preset'))} --output-on-failure --no-tests=error`;
              }
            }
          } else {
            const jobs = Number(options.jobs ?? 2);
            if (!Number.isInteger(jobs) || jobs < 1 || jobs > 64)
            throw new Error('Parallel jobs must be an integer from 1 to 64.');
            const build = project.normalizePath(
              options.buildDirectory ?? project.joinPath(source, 'build'),
            );
            if (build === '.' || build === source || source.startsWith(`${build}/`))
            throw new Error('The build directory must be separate from the source directory.');
            const buildArgument = quote(`./${build}`, 'Build directory');
            const configuration = options.configuration || 'Debug';
            if (!configurations.includes(configuration))
            throw new Error('Select a supported build configuration.');
            configureCommand = `cmake -S ${sourceArgument} -B ${buildArgument} -DCMAKE_EXPORT_COMPILE_COMMANDS=ON`;
            if (!/Visual Studio|Xcode|Multi-Config/i.test(options.generator || ''))
            configureCommand += ` -DCMAKE_BUILD_TYPE=${configuration}`;
            if (options.generator?.trim())
            configureCommand += ` -G ${quote(nameValue(options.generator.trim(), 'Generator'))}`;
            if (options.toolchainFile?.trim()) {
              const toolchain = project.normalizePath(options.toolchainFile.trim());
              if (!mapped.has(toolchain)) throw new Error(`Toolchain file not imported: ${toolchain}`);
              configureCommand += ` --toolchain ${quote(project.relativePath(source, toolchain), 'Toolchain file')}`;
            }
            const cacheEntries = definitions(options.cacheEntries);
            if (cacheEntries.length) configureCommand += ` ${cacheEntries.join(' ')}`;
            buildCommand = `cmake --build ${buildArgument} --config ${configuration} --parallel ${jobs}`;
            cleanCommand = `${buildCommand} --target clean`;
            if (options.target?.trim())
            buildCommand += ` --target ${quote(nameValue(options.target.trim(), 'Build target'))}`;
            testCommand = `ctest --test-dir ${buildArgument} --build-config ${configuration} --output-on-failure --no-tests=error`;
          }

          const steps = [{ action: 'configure', command: configureCommand }];
          if (action === 'clean') return [{ action: 'clean', command: cleanCommand }];
          if (action === 'build' || action === 'test')
          steps.push({ action: 'build', command: buildCommand });
          if (action === 'test') steps.push({ action: 'test', command: testCommand });
          return steps;
        }

        root.SYNAPSE_CMAKE_COMMANDS = Object.freeze({ plan, quote, configurations });
    })(globalThis);
