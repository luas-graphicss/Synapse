'use strict';

const mod3dPreparedDocuments = new Map();
const MOD3D_PREPARED_DOCUMENT_TTL = 120000;
let mod3dEditorDocumentTransport = null;

function mod3dPurgePreparedDocuments() {
  for (const [token, prepared] of mod3dPreparedDocuments) {
    if (Date.now() - prepared.createdAt > MOD3D_PREPARED_DOCUMENT_TTL) {
      mod3dPreparedDocuments.delete(token);
    }
  }
}

function mod3dReadSourceLink(project, modelPath) {
  const entry = mod3dReadProjectMetadata(project).models[modelPath];
  const source = entry && entry.source;
  if (!source) return null;
  mod3dSourceAssert(
    source.format === MOD3D_SOURCE_FORMAT && source.version === MOD3D_SOURCE_VERSION,
    'Unsupported linked source version',
  );
  mod3dModelerProjectPath(source.path, MOD3D_SOURCE_EXTENSION);
  return source;
}

function mod3dListProjectDocuments(project) {
  const metadata = mod3dReadProjectMetadata(project);
  return Array.from(project.files.keys())
  .filter(
    (path) =>
    !path.startsWith('.modeler-backups/') && /\.(glb|gltf|obj|stl|model3d\.json)$/i.test(path),
  )
  .sort()
  .map((path) => ({
        path,
        editable:
        path.endsWith(MOD3D_SOURCE_EXTENSION) ||
        Boolean(metadata.models[path] && metadata.models[path].source),
  }));
}

async function mod3dOpenProjectDocument(project, path, geometryOnly) {
  mod3dModelerProjectPath(path);
  const sourceFile = path.toLowerCase().endsWith(MOD3D_SOURCE_EXTENSION);
  mod3dSourceAssert(project.files.has(path), 'Project file is missing');
  const link = !sourceFile && !geometryOnly ? mod3dReadSourceLink(project, path) : null;
  if (!sourceFile && !link) return mod3dImportProjectModel(project, path);
  const sourcePath = sourceFile ? path : link.path;
  const file = project.files.get(sourcePath);
  mod3dSourceAssert(
    file,
    'Linked source is missing. Restore it or import the geometry explicitly.',
  );
  if (link) {
    mod3dSourceAssert(
      link.modelRevision === mod3dModelerFileRevision(project.files.get(path)),
      'Model changed outside the modeler. Import geometry explicitly or restore the matching model.',
    );
    mod3dSourceAssert(
      link.sourceRevision === mod3dModelerFileRevision(file),
      'Source changed outside the modeler. Open the source file directly to review it.',
    );
  }
  const openedSourceRevision = mod3dModelerFileRevision(file);
  const openedModelRevision = mod3dModelerFileRevision(project.files.get(path));
  const text = new TextDecoder('utf-8', { fatal: true }).decode(mod3dProjectFileBytes(file));
  const document = await mod3dDecodeSource(text);
  mod3dSourceAssert(
    mod3dModelerFileRevision(project.files.get(sourcePath)) === openedSourceRevision &&
    mod3dModelerFileRevision(project.files.get(path)) === openedModelRevision,
    'Project changed while opening the document. Open it again.',
  );
  const matches = sourceFile
  ? Object.entries(mod3dReadProjectMetadata(project).models).filter(
    ([, entry]) => entry.source && entry.source.path === sourcePath,
  )
  : [];
  const modelPath = sourceFile
  ? matches.length === 1
  ? matches[0][0]
  : sourcePath.slice(0, -MOD3D_SOURCE_EXTENSION.length) + '.glb'
  : path;
  return {
    text,
    modelPath,
    sourcePath,
    imported: false,
    warnings: [],
    binding: {
      project: project.id,
      modelPath,
      sourcePath,
      modelRevision: modelPath ? mod3dModelerFileRevision(project.files.get(modelPath)) : null,
      sourceRevision: mod3dModelerFileRevision(file),
      documentId: document.documentId,
    },
  };
}

async function mod3dPrepareProjectDocument(project, request) {
  mod3dPurgePreparedDocuments();
  mod3dSourceAssert(
    mod3dPreparedDocuments.size < 4,
    'Too many pending exports. Wait and try again.',
  );
  let modelPath = mod3dModelerExportPath(request.modelPath);
  let sourcePath = mod3dModelerSourcePath(modelPath);
  const metadata = mod3dReadProjectMetadata(project);
  const linked = metadata.models[modelPath] && metadata.models[modelPath].source;
  if (request.overwrite && linked) {
    sourcePath = mod3dModelerProjectPath(linked.path, MOD3D_SOURCE_EXTENSION);
  }
  if (!request.overwrite) {
    const stem = modelPath.slice(0, -4);
    let number = 1;
    while (
      project.files.has(modelPath) ||
      (request.sourceText !== null && project.files.has(sourcePath))
    ) {
      number += 1;
      mod3dSourceAssert(number <= 999, 'No available file name');
      modelPath = `${stem}-${number}.glb`;
      sourcePath = mod3dModelerSourcePath(modelPath);
    }
  }
  const bound =
  request.binding &&
  request.binding.project === project.id &&
  request.binding.modelPath === modelPath;
  if (bound) {
    mod3dSourceAssert(
      request.binding.modelRevision === mod3dModelerFileRevision(project.files.get(modelPath)),
      'Model changed since opening. Reopen it or save under a new name.',
    );
    if (request.binding.sourcePath) {
      mod3dSourceAssert(
        request.binding.sourceRevision ===
        mod3dModelerFileRevision(project.files.get(request.binding.sourcePath)),
        'Source changed since opening. Reopen it or save under a new name.',
      );
    }
  }
  const sourceText = request.sourceText === null ? null : request.sourceText;
  const paths = [modelPath, MOD3D_PROJECT_METADATA];
  if (sourceText !== null) paths.push(sourcePath);
  const revisions = Object.fromEntries(
    paths.map((path) => [path, mod3dModelerFileRevision(project.files.get(path))]),
  );
  const overwriteRequired =
  project.files.has(modelPath) || (sourceText !== null && project.files.has(sourcePath));
  let documentId = '';
  if (sourceText !== null) documentId = (await mod3dDecodeSource(sourceText)).documentId;
  mod3dSourceAssert(mod3dProjetoPorId(project.id) === project, 'Project closed during preparation');
  mod3dSourceAssert(mod3dPreparedDocuments.size < 4, 'Too many pending exports');
  for (const [path, revision] of Object.entries(revisions)) {
    mod3dSourceAssert(
      revision === mod3dModelerFileRevision(project.files.get(path)),
      `Project changed during preparation: ${path}`,
    );
  }
  mod3dCheckProjectWrites(project, paths);
  const token = mod3dNovoId();
  mod3dPreparedDocuments.set(token, {
      createdAt: Date.now(),
      project,
      modelPath,
      sourcePath,
      sourceText,
      documentId,
      revisions,
      overwriteRequired,
      selectionOnly: request.selectionOnly === true,
  });
  return { token, modelPath, sourcePath: sourceText === null ? '' : sourcePath, overwriteRequired };
}

function mod3dCommitModelerDocument(request, project, bytes, report) {
  mod3dPurgePreparedDocuments();
  const prepared = mod3dPreparedDocuments.get(request.documentToken);
  mod3dSourceAssert(
    prepared && prepared.project === project,
    'Export preparation expired. Prepare the export again.',
  );
  mod3dPreparedDocuments.delete(request.documentToken);
  mod3dSourceAssert(
    !prepared.overwriteRequired || request.documentConfirmed === true,
    'Overwrite confirmation is required',
  );
  mod3dSourceAssert(request.nome === prepared.modelPath, 'Export destination changed');
  for (const [path, revision] of Object.entries(prepared.revisions)) {
    mod3dSourceAssert(
      mod3dModelerFileRevision(project.files.get(path)) === revision,
      `Project changed during export: ${path}`,
    );
  }
  const { modelPath, sourcePath, sourceText } = prepared;
  const paths = Object.keys(prepared.revisions);
  mod3dCheckProjectWrites(project, paths);
  const backup = mod3dCreateProjectBackup(project, paths);
  const entries = backup.entries;
  const model = makeFileEntry(modelPath, bytes);
  entries.set(modelPath, model);
  const metadata = mod3dReadProjectMetadata(project);
  const previous = metadata.models[modelPath] || {};
  const modelMetadata = {
    ...previous,
    pivot: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: 1,
    applied: true,
    updatedAt: Date.now(),
  };
  if (sourceText !== null) {
    const source = mod3dProjectTextEntry(sourcePath, sourceText, project.files.get(sourcePath));
    entries.set(sourcePath, source);
    modelMetadata.source = {
      path: sourcePath,
      format: MOD3D_SOURCE_FORMAT,
      version: MOD3D_SOURCE_VERSION,
      documentId: prepared.documentId,
      modelRevision: mod3dModelerFileRevision(model),
      sourceRevision: mod3dModelerFileRevision(source),
      selectionOnly: prepared.selectionOnly,
    };
  } else delete modelMetadata.source;
  if (backup.folder) modelMetadata.backup = backup.folder;
  metadata.models[modelPath] = modelMetadata;
  entries.set(
    MOD3D_PROJECT_METADATA,
    mod3dProjectTextEntry(
      MOD3D_PROJECT_METADATA,
      JSON.stringify(metadata, null, 2),
      project.files.get(MOD3D_PROJECT_METADATA),
    ),
  );
  const committed = mod3dCommitProjectFiles(project, entries, modelPath);
  const binding = {
    project: project.id,
    modelPath,
    sourcePath: sourceText === null ? '' : sourcePath,
    modelRevision: mod3dModelerFileRevision(model),
    sourceRevision: sourceText === null ? null : mod3dModelerFileRevision(entries.get(sourcePath)),
    documentId: prepared.documentId,
  };
  return {
    caminho: modelPath,
    tamanho: bytes.length,
    projeto: project.name,
    sobrescrito: prepared.overwriteRequired,
    report,
    binding,
    sourcePath: binding.sourcePath,
    backup: backup.folder,
    ...committed,
  };
}

async function mod3dHandleDocumentRequest(request) {
  mod3dSourceAssert(
    request &&
    typeof request.action === 'string' &&
    typeof request.project === 'string' &&
    request.project,
    'Invalid document request',
  );
  const project = mod3dResolveOpenProject(request.project);
  mod3dSourceAssert(project, 'Project is no longer open');
  if (request.action === 'list') return { documents: mod3dListProjectDocuments(project) };
  if (request.action === 'open') {
    return mod3dOpenProjectDocument(project, request.path, request.geometryOnly === true);
  }
  if (request.action === 'prepare-save') return mod3dPrepareProjectDocument(project, request);
  if (request.action === 'cancel-save') {
    const prepared = mod3dPreparedDocuments.get(request.token);
    if (prepared && prepared.project === project) mod3dPreparedDocuments.delete(request.token);
    return { cancelled: true };
  }
  throw new Error('Unknown document request');
}

function mod3dHandleDocumentEnvelope(envelope, via, channel) {
  if (!mod3dEditorDocumentTransport) {
    mod3dEditorDocumentTransport = mod3dCreateDocumentTransport(channel, {
        onRequest: mod3dHandleDocumentRequest,
    });
  }
  return mod3dEditorDocumentTransport.receive(envelope, via);
}
