'use strict';

const MOD3D_API_KERNEL_FILES = Object.freeze([
    'primitivas.js',
    'normais.js',
    'malha.js',
    'editable-mesh-geometry.js',
    'mesh-shrink-fatten.js',
    'uv.js',
    'materiais.js',
    'verificador.js',
    'cena.js',
    'historico.js',
    'modeler-source-validation.js',
    'modeler-project-paths.js',
    'modeler-scene-document.js',
    'modeler-history-document.js',
    'selecao.js',
    'operacoes-malha.js',
    'glb-binary-writer.js',
    'glb-mesh-optimizer.js',
    'glb-scene-snapshot.js',
    'glb-texture-resources.js',
    'glb-material-writer.js',
    'exportador-minimo.js',
    'exportador-glb.js',
    'modeler-api-validation.js',
    'modeler-api-operations.js',
    'modeler-api-kernel.js',
]);
let mod3dApiFrame = null;
let mod3dApiLoading = null;
let mod3dApiQueue = Promise.resolve();
let mod3dApiBusy = false;
let mod3dApiReleasePending = false;
let mod3dApiStore = null;

function mod3dReleaseApiResources() {
  if (mod3dApiBusy) {
    mod3dApiReleasePending = true;
    return false;
  }
  if (mod3dApiFrame) mod3dApiFrame.remove();
  mod3dApiFrame = null;
  mod3dApiLoading = null;
  if (mod3dApiStore) mod3dApiStore.close();
  mod3dApiStore = null;
  mod3dApiReleasePending = false;
  return true;
}

function mod3dApiScriptUrl(file) {
  const resources = window.__LP_MAP__;
  if (resources) {
    const resource = resources['/' + file];
    mod3dSourceAssert(resource && resource.u, 'Missing modeler engine script: ' + file);
    return resource.u;
  }
  return new URL(file, mod3dBaseDoEditor()).href;
}

function mod3dLoadApiKernel() {
  if (mod3dApiFrame && mod3dApiFrame.contentWindow.MODELER_KERNEL) {
    return Promise.resolve(mod3dApiFrame.contentWindow.MODELER_KERNEL);
  }
  if (mod3dApiLoading) return mod3dApiLoading;
  mod3dApiLoading = new Promise((resolve, reject) => {
      const frame = document.createElement('iframe');
      frame.hidden = true;
      frame.title = 'Modeler geometry engine';
      frame.setAttribute('aria-hidden', 'true');
      mod3dApiFrame = frame;
      const timeout = setTimeout(() => {
          frame.remove();
          mod3dApiFrame = null;
          reject(new Error('Modeler engine did not load. Retry after checking local scripts.'));
        }, 15000);
      frame.addEventListener('load', () => {
          const kernel = frame.contentWindow && frame.contentWindow.MODELER_KERNEL;
          if (!kernel) return;
          clearTimeout(timeout);
          resolve(kernel);
      });
      document.body.appendChild(frame);
      const files = [
        'assets/js/nucleo/diagnostico.js',
        ...MOD3D_API_KERNEL_FILES.map((name) => 'assets/js/estudio-3d/modelador/' + name),
      ];
      const html =
      '<!doctype html><html><head><meta charset="utf-8"></head><body>' +
      files
      .map((file) => '<script src="' + escaparHtml(mod3dApiScriptUrl(file)) + '"><\/script>')
      .join('') +
      '</body></html>';
      frame.contentDocument.open();
      frame.contentDocument.write(html);
      frame.contentDocument.close();
  }).catch((error) => {
      mod3dApiLoading = null;
      throw error;
  });
  return mod3dApiLoading;
}

function mod3dApiIdentity(args) {
  mod3dSourcePlainData(args);
  mod3dSourceAssert(
    typeof args.project === 'string' && args.project,
    'An explicit project is required',
  );
  mod3dSourceAssert(
    typeof args.agent === 'string' && args.agent.trim().length <= 40,
    'Agent name must contain at most 40 characters',
  );
  const agent = agName(args);
  mod3dSourceAssert(agent, 'Use the same agent name on every modeler call');
  const project = mcpProj(args);
  const scope = JSON.stringify([
      'modeler-api',
      mod3dBaseDoEditor(),
      project.id,
      agent.toLowerCase(),
  ]);
  return { project, agent, scope };
}

function mod3dApiRecordKey(identity, sceneId) {
  mod3dSourceAssert(
    typeof sceneId === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(sceneId),
    'A valid sceneId is required',
  );
  return identity.scope + '|' + sceneId;
}

function mod3dApiRun(action, args) {
  const execute = async () => {
    mod3dApiBusy = true;
    try {
      const identity = mod3dApiIdentity(args);
      if (!mod3dApiStore) mod3dApiStore = mod3dCreateAutosaveStore();
      const store = mod3dApiStore;
      if (action === 'state' && !args.sceneId) {
        return {
          scenes: (await store.list(identity.scope)).map((item) => ({
                sceneId: item.documentId,
                updatedAt: item.updatedAt,
                path: item.modelPath,
          })),
        };
      }
      if (action === 'create') {
        mod3dSourceAssert(
          (await store.list(identity.scope)).length < 16,
          'Scene limit reached. Reuse an existing sceneId.',
        );
        let source = {
          format: MOD3D_SOURCE_FORMAT,
          version: MOD3D_SOURCE_VERSION,
          documentId: 'scene-' + mod3dNovoId(),
          scene: { nodes: [], roots: [], selection: [], nextId: 0 },
          history: { steps: [], index: -1, omitted: 0 },
          textures: [],
        };
        let binding = null;
        if (args.sourcePath) {
          mod3dApiCheckReads(identity, [args.sourcePath, MOD3D_PROJECT_METADATA]);
          const link = mod3dReadSourceLink(identity.project, args.sourcePath);
          if (link) mod3dApiCheckReads(identity, [link.path]);
          const opened = await mod3dOpenProjectDocument(identity.project, args.sourcePath, false);
          mod3dSourceAssert(
            !opened.imported,
            'Open an editable source. Geometry-only imports must be reviewed in the modeler UI.',
          );
          source = await mod3dDecodeSource(opened.text);
          binding = opened.binding;
          source.documentId = 'scene-' + mod3dNovoId();
        }
        const record = {
          key: mod3dApiRecordKey(identity, source.documentId),
          scope: identity.scope,
          writerId: identity.agent,
          document: source,
          binding,
          modelPath: binding ? binding.modelPath : '',
          updatedAt: Date.now(),
          revision: 0,
        };
        mod3dSourceAssert(
          mod3dProjetoPorId(identity.project.id) === identity.project,
          'Project closed while opening source',
        );
        await store.put(record, null);
        return {
          sceneId: source.documentId,
          revision: 0,
          recoveredFrom: args.sourcePath || null,
          autosaved: true,
        };
      }
      const key = mod3dApiRecordKey(identity, args.sceneId);
      const record = await store.get(key);
      mod3dSourceAssert(
        record && record.scope === identity.scope,
        'Scene not found for this project and agent. List scenes or create one.',
      );
      if (args.revision !== undefined) {
        mod3dSourceAssert(
          args.revision === record.revision,
          'Scene revision changed. Read its state before retrying.',
        );
      }
      if (action === 'export') return await mod3dExportApiScene(identity, record, args, store);
      if (action === 'material' && args.material?.texture) {
        mod3dApiCheckReads(identity, [args.material.texture]);
        const texture = identity.project.files.get(args.material.texture);
        mod3dSourceAssert(texture, 'Texture missing from project: ' + args.material.texture);
        mod3dGlbImageInfo(mod3dProjectFileBytes(texture));
      }
      const kernel = await mod3dLoadApiKernel();
      const result = kernel.run(record.document, action, args);
      mod3dSourceAssert(
        mod3dProjetoPorId(identity.project.id) === identity.project,
        'Project closed during modeling',
      );
      if (result.document) {
        record.document = mod3dSourceClone(result.document);
        record.revision += 1;
        record.updatedAt = Date.now();
        await store.put(record, record.revision - 1);
      }
      return {
        sceneId: args.sceneId,
        revision: record.revision,
        autosaved: true,
        ...result.value,
        ...(result.state ? { state: result.state } : {}),
      };
    } finally {
      mod3dApiBusy = false;
      if (mod3dApiReleasePending) mod3dReleaseApiResources();
    }
  };
  const result = mod3dApiQueue.then(execute);
  mod3dApiQueue = result.catch(() => undefined);
  return result;
}

function mod3dApiCheckReads(identity, paths) {
  for (const path of paths) {
    mod3dModelerProjectPath(path);
    if (typeof tmGateRead === 'function') tmGateRead(path, identity.agent, identity.project.id);
  }
}
