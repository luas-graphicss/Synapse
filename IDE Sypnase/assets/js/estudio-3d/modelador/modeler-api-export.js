'use strict';

async function mod3dExportApiScene(identity, record, args, store) {
  const { project, agent } = identity;
  const path = mod3dModelerExportPath(args.path);
  mod3dSourceAssert(
    !project.files.has(path) || args.overwrite === true,
    'File exists. Choose a new path or explicitly set overwrite:true; a backup will be created.',
  );
  mod3dSourceAssert(
    !args.textureMode || ['embed', 'reference'].includes(args.textureMode),
    'Unknown texture mode',
  );
  const kernel = await mod3dLoadApiKernel();
  const snapshot = kernel.run(record.document, 'export', args);
  const scene = snapshot.scene;
  mod3dSourceAssert(scene, 'Scene has no exportable geometry');
  const resources = new Map();
  for (const request of snapshot.textures) {
    mod3dApiCheckReads(identity, [request.path]);
    const file = project.files.get(request.path);
    mod3dSourceAssert(file, `Texture missing from project: ${request.path}`);
    mod3dSourceAssert(
      !request.reference || !path.includes('/'),
      'Subfolder exports require embedded textures',
    );
    const override = (record.document.textures || []).find((item) => item.path === request.path);
    const bytes = override
    ? mod3dSourceFromBase64(override.data)
    : mod3dProjectFileBytes(file).slice();
    const info = mod3dGlbImageInfo(bytes);
    resources.set(request.path, { bytes, ...info });
  }
  const output = kernel.build(scene, resources);
  const sourceText =
  args.includeSource === false
  ? null
  : await mod3dEncodeSource(record.document, { compress: true });
  const current = await store.get(record.key);
  mod3dSourceAssert(
    current?.revision === record.revision,
    'Scene changed while preparing export. Read its state and retry.',
  );
  let prepared;
  try {
    prepared = await mod3dPrepareProjectDocument(project, {
        modelPath: path,
        sourceText,
        overwrite: args.overwrite === true,
        binding: record.binding,
        agent,
    });
    mod3dSourceAssert(
      prepared.modelPath === path,
      'Destination changed. Choose an unused path and retry.',
    );
    const result = mod3dGravarModelo({
        ...output,
        bin: new Uint8Array(output.bin),
        projeto: project.id,
        nome: path,
        documentToken: prepared.token,
        documentConfirmed: args.overwrite === true,
        agent,
    });
    mod3dSourceAssert(!result.erro, result.detalhe || result.erro);
    record.binding = result.binding;
    record.modelPath = result.caminho;
    record.sourcePath = result.sourcePath;
    record.updatedAt = Date.now();
    const warnings = (result.warnings || []).slice();
    let draftSaved = true;
    const previousRevision = record.revision;
    record.revision += 1;
    try {
      await store.put(record, previousRevision);
    } catch (error) {
      draftSaved = false;
      ignorarErro(error, 'modeler:api-export-autosave');
      warnings.push(
        'Files were written, but the local draft binding could not be saved. Reopen the project source before overwriting.',
      );
    }
    return {
      sceneId: record.document.documentId,
      revision: draftSaved ? record.revision : null,
      draftSaved,
      path: result.caminho,
      sourcePath: result.sourcePath,
      backup: result.backup,
      report: result.report,
      warnings,
    };
  } finally {
    if (prepared) mod3dPreparedDocuments.delete(prepared.token);
  }
}
