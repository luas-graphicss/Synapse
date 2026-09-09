'use strict';

const MOD3D_PROJECT_METADATA = 'aurora.3d.json';
const MOD3D_BACKUP_LIMIT = 134217728;

function mod3dReadProjectMetadata(project) {
  const file = project.files.get(MOD3D_PROJECT_METADATA);
  if (!file) return { version: 1, models: {} };
  const text = file.isText ? file.text : new TextDecoder().decode(mod3dComoBytes(file.data));
  mod3dSourceAssert(typeof text === 'string' && text.length <= 4194304, 'Invalid 3D metadata');
  const metadata = JSON.parse(text);
  mod3dSourcePlainData(metadata);
  mod3dSourceAssert(
    metadata &&
    metadata.models &&
    !Array.isArray(metadata.models) &&
    typeof metadata.models === 'object',
    'Invalid 3D metadata',
  );
  return metadata;
}

function mod3dProjectFileBytes(file) {
  mod3dSourceAssert(file, 'Project file is missing');
  const bytes = file.isText ? new TextEncoder().encode(file.text || '') : mod3dComoBytes(file.data);
  mod3dSourceAssert(bytes, 'Project file has no readable bytes');
  return bytes;
}

function mod3dProjectTextEntry(path, text, previous) {
  const file = newFileEntry(path);
  file.isText = true;
  file.text = previous && previous.isText ? previous.text : text;
  file.data = null;
  file.history = previous && previous.isText ? (previous.history || []).slice() : [];
  if (previous && previous.isText) mcpHist(file);
  file.text = text;
  return file;
}

function mod3dCheckProjectWrites(project, paths) {
  for (const path of paths) {
    mod3dModelerProjectPath(path);
    mod3dSourceAssert(mcpNorm(path) === path, 'Project path normalization changed the destination');
    const lock =
    typeof tmBloqueioEscrita === 'function'
    ? tmBloqueioEscrita(path, '', project.id)
    : mod3dTravaDoArquivo(project, path);
    mod3dSourceAssert(!lock, `File is in use: ${path}`);
    for (const existing of project.files.keys()) {
      if (
        existing !== path &&
        (existing.startsWith(path + '/') || path.startsWith(existing + '/'))
      ) {
        throw new Error(`File and directory conflict: ${path}`);
      }
    }
  }
}

function mod3dCreateProjectBackup(project, paths) {
  const entries = new Map();
  const items = [];
  const folder = `.modeler-backups/${Date.now()}-${mod3dNovoId()}`;
  let size = 0;
  for (const path of paths) {
    const previous = project.files.get(path);
    if (!previous) continue;
    const bytes = mod3dProjectFileBytes(previous);
    size += bytes.length;
    mod3dSourceAssert(size <= MOD3D_BACKUP_LIMIT, 'Backup exceeds the safe size limit');
    const backupPath = `${folder}/${path}`;
    entries.set(
      backupPath,
      previous.isText
      ? mod3dProjectTextEntry(backupPath, previous.text, null)
      : makeFileEntry(backupPath, bytes.slice()),
    );
    items.push({ path, backupPath, revision: mod3dModelerFileRevision(previous) });
  }
  if (!items.length) return { entries, folder: '', items };
  const manifest = `${folder}/manifest.json`;
  entries.set(
    manifest,
    mod3dProjectTextEntry(
      manifest,
      JSON.stringify({ version: 1, createdAt: Date.now(), items }, null, 2),
      null,
    ),
  );
  return { entries, folder, items };
}

function mod3dCommitProjectFiles(project, entries, modelPath) {
  mod3dCheckProjectWrites(project, Array.from(entries.keys()));
  const previous = new Map(Array.from(entries.keys(), (path) => [path, project.files.get(path)]));
  mod3dSourceAssert(typeof makeSnapshot === 'function', 'Snapshot service is unavailable');
  const snapshot = makeSnapshot(project, `Modeler: before saving ${modelPath}`);
  mod3dSourceAssert(snapshot, 'Snapshot failed. Nothing was replaced.');
  try {
    for (const [path, entry] of entries) project.files.set(path, entry);
  } catch (error) {
    for (const [path, entry] of previous) {
      if (entry) project.files.set(path, entry);
      else project.files.delete(path);
    }
    throw error;
  }
  const warnings = [];
  for (const path of entries.keys()) {
    try {
      mcpAfterWrite(project, path);
    } catch (error) {
      ignorarErro(error, 'modeler:post-write');
      warnings.push('Project changed in memory; verify browser persistence before closing.');
    }
  }
  if (typeof EST3D !== 'undefined' && EST3D.cache) EST3D.cache.delete(`${project.id}:${modelPath}`);
  return { snapshot: snapshot.id || '', warnings: Array.from(new Set(warnings)) };
}
