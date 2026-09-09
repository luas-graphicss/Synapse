'use strict';

function mod3dModelerProjectPath(value, extension) {
  mod3dSourceAssert(
    typeof value === 'string' && value.length > 0 && value.length <= 400,
    'Invalid project path',
  );
  mod3dSourceAssert(
    value === value.trim() && !/[\\\u0000-\u001f<>:"|?*]/.test(value),
      'Invalid project path',
    );
    const segments = value.split('/');
    mod3dSourceAssert(
      segments.every(
        (segment) => segment && segment !== '.' && segment !== '..' && !/[. ]$/.test(segment),
      ),
      'Project path must be relative and cannot traverse directories',
    );
    mod3dSourceAssert(
      !extension || value.toLowerCase().endsWith(extension),
      `Expected a ${extension} file`,
    );
    return value;
  }

  function mod3dModelerExportPath(value) {
    const input = String(value || '').trim();
    return mod3dModelerProjectPath(input.includes('/') ? input : mod3dNomeDeArquivo(input), '.glb');
  }

  function mod3dModelerSourcePath(modelPath) {
    return mod3dModelerProjectPath(modelPath, '.glb').slice(0, -4) + MOD3D_SOURCE_EXTENSION;
  }

  function mod3dModelerFileRevision(file) {
    if (!file) return null;
    const bytes = file.isText ? new TextEncoder().encode(file.text || '') : mod3dComoBytes(file.data);
    mod3dSourceAssert(bytes, 'Cannot read project file');
    return `${mod3dResumoDosBytes(bytes)}:${bytes.length}`;
  }

  function mod3dModelerFileExtension(path) {
    const match = /\.[^./]+$/.exec(path);
    return match ? match[0].toLowerCase() : '';
  }
