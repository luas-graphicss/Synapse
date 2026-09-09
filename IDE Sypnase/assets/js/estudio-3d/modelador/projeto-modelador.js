'use strict';

function mod3dCreateProjectDocument(channel, view, exportView, boot) {
  const store = mod3dCreateAutosaveStore();
  const transport = mod3dCreateDocumentTransport(channel);
  const writerId = mod3dNovoId();
  let project = '';
  let scope = '';
  let documentId = mod3dNovoId();
  let binding = null;
  let sequence = 0;
  let savedSequence = 0;
  let busy = false;
  let applying = false;
  let disposed = false;
  let status = { state: 'idle' };
  let files = [];
  let fileRequest = 0;
  const draftKey = () => `${scope}|${documentId}|${writerId}`;
  const dirty = () => sequence !== savedSequence;
  const warn = (error) => {
    if (disposed) return;
    status = { state: 'error', error: error.message || String(error) };
    render();
    ignorarErro(error, 'modeler:document');
  };

  function capture() {
    if (!project || applying || disposed) return null;
    return {
      key: draftKey(),
      scope,
      writerId,
      document: mod3dCaptureSourceDocument(documentId),
      updatedAt: Date.now(),
      modelPath: exportView.filename.value,
      sourcePath: binding ? binding.sourcePath : '',
      binding: binding ? { ...binding } : null,
      dirty: dirty(),
      savedSequence,
      sequence,
    };
  }

  function render() {
    if (disposed) return;
    view.identity.textContent =
    binding && binding.sourcePath ? binding.sourcePath : mod3dProjectText('Untitled scene');
    const labels = {
      idle: 'Ready',
      pending: 'Local draft pending…',
      saving: 'Saving local draft…',
      saved: 'Local draft saved',
      error: 'Local recovery unavailable',
    };
    view.state.textContent = `${mod3dProjectText(dirty() ? 'Unexported changes' : 'Project source unchanged')} · ${mod3dProjectText(labels[status.state] || 'Ready')}`;
    if (status.state === 'error') view.state.textContent += ` — ${status.error}`;
    view.state.classList.toggle('error', status.state === 'error');
    view.panel.setAttribute('aria-busy', String(busy));
    for (const control of [
        view.create,
        view.refresh,
        view.files,
        view.open,
        view.importGeometry,
        view.retry,
    ]) {
      control.disabled = busy;
    }
    view.open.disabled = busy || !project || !view.files.value;
    view.importGeometry.disabled =
    busy || !project || !/\.(glb|gltf|obj|stl)$/i.test(view.files.value);
    view.refresh.disabled = busy || !project;
  }

  const autosave = mod3dCreateAutosaveScheduler({
      store,
      capture,
      onStatus(next) {
        if (next.key && next.key !== draftKey()) return;
        status = next;
        render();
      },
  });

  function changed() {
    if (applying || disposed) return;
    sequence += 1;
    autosave.changed();
    render();
  }

  async function request(action, data = {}) {
    const result = await transport.request(action, { project, ...data });
    if (!result || !result.ok) {
      throw new Error((result && result.error) || 'Document request failed');
    }
    return result;
  }

  async function refreshFiles() {
    if (disposed || !project || !channel.ligado()) return;
    const currentProject = project;
    const currentRequest = ++fileRequest;
    try {
      const result = await request('list');
      if (currentProject !== project || currentRequest !== fileRequest) return;
      files = result.documents || [];
      mod3dRenderProjectFiles(view, files);
      render();
    } catch (error) {
      warn(error);
    }
  }

  async function refreshDrafts() {
    const currentScope = scope;
    if (disposed || !scope) return;
    try {
      const drafts = await store.list(scope);
      if (currentScope !== scope) return;
      mod3dRenderRecovery(
        view,
        drafts.filter((draft) => draft.key !== draftKey()),
        recoverDraft,
        discardDraft,
      );
    } catch (error) {
      warn(error);
    }
  }

  async function allowSwitch() {
    if (disposed || busy || mod3dGravando) return false;
    if (!dirty()) return true;
    const saved = await autosave.flush();
    const message =
    saved && !autosave.pending()
    ? 'This scene has unexported changes. Keep its local draft and switch scenes?'
    : 'This scene has changes that are not saved locally. Switch anyway and lose those changes?';
    if (disposed || busy || mod3dGravando) return false;
    return window.confirm(mod3dProjectText(message));
  }

  function applySource(source, nextBinding, modelPath, imported) {
    applying = true;
    try {
      mod3dRestoreSourceDocument(source);
      documentId = source.documentId;
      binding = nextBinding || null;
      sequence = imported ? 1 : 0;
      savedSequence = 0;
      exportView.filename.value = modelPath || 'model.glb';
      exportView.overwrite.checked = Boolean(nextBinding && nextBinding.modelPath);
      exportView.editableSource.checked = true;
      exportView.compressSource.disabled = false;
      if (typeof mod3dLimparReferencia === 'function') mod3dLimparReferencia();
      if (typeof mod3dEnquadrarCena === 'function') mod3dEnquadrarCena();
    } finally {
      applying = false;
    }
    render();
  }

  async function openDocument(path, geometryOnly = false, targetProject = '') {
    if (!(await allowSwitch())) return false;
    busy = true;
    const openingSequence = sequence;
    render();
    try {
      const destination = targetProject || project;
      const result = await transport.request('open', { project: destination, path, geometryOnly });
      if (!result.ok) throw new Error(result.error);
      const source = await mod3dDecodeSource(result.text);
      if (
        result.imported &&
        !window.confirm(
          mod3dProjectText(
            'Import geometry only? Materials, UVs, custom normals and hierarchy will not be preserved. The original file stays unchanged.',
          ),
        )
      ) {
        return false;
      }
      await autosave.flush();
      mod3dSourceAssert(
        !disposed && sequence === openingSequence,
        mod3dProjectText('Scene changed during the operation. Nothing was replaced; try again.'),
      );
      if (destination !== project) updateProject(destination);
      applySource(source, result.binding, result.modelPath, result.imported);
      if (result.imported) autosave.changed();
      await refreshDrafts();
      await refreshFiles();
      return true;
    } catch (error) {
      warn(error);
      return false;
    } finally {
      busy = false;
      render();
    }
  }

  async function createDocument() {
    if (!(await allowSwitch())) return false;
    busy = true;
    const openingSequence = sequence;
    render();
    try {
      await autosave.flush();
      mod3dSourceAssert(
        !disposed && sequence === openingSequence,
        mod3dProjectText('Scene changed during the operation. Nothing was replaced; try again.'),
      );
      const source = {
        format: MOD3D_SOURCE_FORMAT,
        version: MOD3D_SOURCE_VERSION,
        documentId: mod3dNovoId(),
        scene: { nodes: [], roots: [], selection: [], nextId: 0 },
        history: { steps: [], index: -1, omitted: 0 },
      };
      applySource(source, null, 'model.glb', true);
      autosave.changed();
      await refreshDrafts();
      return true;
    } catch (error) {
      warn(error);
      return false;
    } finally {
      busy = false;
      render();
    }
  }

  function updateProject(id) {
    project = id;
    const entry = mod3dProjetosDaAba.find((item) => item.id === id);
    scope = `${boot.base || 'modeler'}|${id}|${entry ? entry.nome : ''}`;
    mod3dGuardarDestino(id);
    mod3dTela.seletor.value = id;
    mod3dViewportProjeto(id, channel);
    mod3dPedirImagensDoProjeto(channel, id);
  }

  async function chooseProject(id) {
    if (id === project) return true;
    if (!(await allowSwitch())) return false;
    busy = true;
    const openingSequence = sequence;
    render();
    try {
      await autosave.flush();
      mod3dSourceAssert(
        !disposed && sequence === openingSequence,
        mod3dProjectText('Scene changed during the operation. Nothing was replaced; try again.'),
      );
      mod3dSourceAssert(
        mod3dProjetosDaAba.some((entry) => entry.id === id),
        'The selected project is no longer open',
      );
      updateProject(id);
      binding = null;
      documentId = mod3dNovoId();
      sequence += 1;
      exportView.overwrite.checked = false;
      autosave.changed();
      await refreshFiles();
      await refreshDrafts();
      return true;
    } catch (error) {
      warn(error);
      return false;
    } finally {
      busy = false;
      render();
    }
  }

  async function recoverDraft(key) {
    if (!(await allowSwitch())) return;
    busy = true;
    const openingSequence = sequence;
    render();
    try {
      const record = await store.get(key);
      mod3dSourceAssert(record && record.scope === scope, 'Recovery draft is unavailable');
      mod3dValidateSourceDocument(record.document);
      await autosave.flush();
      mod3dSourceAssert(
        !disposed && sequence === openingSequence,
        mod3dProjectText('Scene changed during the operation. Nothing was replaced; try again.'),
      );
      applySource(record.document, record.binding, record.modelPath, true);
      autosave.changed();
    } catch (error) {
      warn(error);
    } finally {
      busy = false;
      render();
    }
  }

  async function discardDraft(key) {
    if (
      busy ||
      !window.confirm(
        mod3dProjectText('Discard this recovery draft? The project files will not change.'),
      )
    ) {
      return;
    }
    try {
      await store.remove(key);
      await refreshDrafts();
    } catch (error) {
      warn(error);
    }
  }

  async function prepareExport() {
    mod3dSourceAssert(!busy && project, 'Choose a project and finish loading the document first');
    const source = exportView.editableSource.checked
    ? mod3dCaptureSourceDocument(documentId)
    : null;
    const capturedSequence = sequence;
    const text = exportView.editableSource.checked
    ? await mod3dEncodeSource(source, { compress: exportView.compressSource.checked })
    : null;
    const result = await request('prepare-save', {
        modelPath: exportView.filename.value,
        sourceText: text,
        overwrite: exportView.overwrite.checked,
        binding,
        selectionOnly: exportView.selectionOnly.checked,
    });
    if (
      result.overwriteRequired &&
      !window.confirm(
        `${mod3dProjectText('Replace this model and its linked source? A recoverable backup and snapshot will be created first.')}\n${result.modelPath}\n${result.sourcePath}`,
      )
    ) {
      await request('cancel-save', { token: result.token });
      return null;
    }
    return { ...result, sequence: capturedSequence, documentId, sourceIncluded: text !== null };
  }

  async function exported(result, prepared) {
    if (prepared.documentId !== documentId || result.erro) return;
    binding = result.binding || null;
    if (prepared.sourceIncluded && !(result.warnings || []).length) {
      savedSequence = prepared.sequence;
    }
    exportView.overwrite.checked = true;
    autosave.changed();
    await autosave.flush();
    if (prepared.sourceIncluded && !(result.warnings || []).length && !dirty()) {
      try {
        await store.remove(draftKey());
      } catch (error) {
        warn(error);
      }
    }
    await refreshFiles();
    await refreshDrafts();
    render();
  }

  function syncProject(id) {
    if (!id || disposed) return;
    if (mod3dProjectIsOpen(mod3dProjetosDaAba, project)) return;
    const previousProjectClosed = Boolean(project) && project !== id;
    updateProject(id);
    if (previousProjectClosed) {
      binding = null;
      documentId = mod3dNovoId();
      sequence += 1;
      exportView.overwrite.checked = false;
      render();
    }
    void refreshDrafts();
    void refreshFiles();
  }

  mod3dCenaAoMudar(changed);
  mod3dHistoricoAoMudar(changed);
  view.create.addEventListener('click', () => {
      void createDocument().catch(warn);
  });
  view.refresh.addEventListener('click', () => {
      void refreshFiles();
      void refreshDrafts();
  });
  view.retry.addEventListener('click', () => {
      autosave.changed();
      void autosave.flush();
  });
  view.files.addEventListener('change', render);
  view.open.addEventListener('click', () => {
      void openDocument(view.files.value);
  });
  view.importGeometry.addEventListener('click', () => {
      void openDocument(view.files.value, true);
  });
  document.addEventListener('visibilitychange', () => {
      if (document.hidden) void autosave.flush();
  });
  window.addEventListener('pagehide', () => {
      void autosave.flush();
  });
  window.addEventListener('beforeunload', (event) => {
      void autosave.flush();
      if (dirty() || mod3dGravando || autosave.pending()) {
        event.preventDefault();
        event.returnValue = '';
      }
  });
  if (window.SYNAPSE_I18N && window.SYNAPSE_I18N.on) {
    window.SYNAPSE_I18N.on(() => {
        for (const element of document.querySelectorAll('[data-project-label]')) {
          element.textContent = mod3dProjectText(element.dataset.projectLabel);
        }
        render();
        mod3dRenderProjectFiles(view, files);
        void refreshDrafts();
    });
  }
  render();
  return {
    open: openDocument,
    chooseProject,
    syncProject,
    prepareExport,
    exported,
    capture,
    flush: () => autosave.flush(),
    changed,
    refreshFiles,
    recoverDraft,
    state: () => ({
        project,
        scope,
        documentId,
        binding,
        dirty: dirty(),
        busy,
        status,
        key: draftKey(),
    }),
    receive(envelope, via) {
      if (transport.receive(envelope, via)) return true;
      if (envelope.tipo === 'document-open-request') {
        void openDocument(envelope.dados.path, false, envelope.dados.project);
        return true;
      }
      return false;
    },
    dispose() {
      disposed = true;
      autosave.dispose();
      transport.dispose();
      store.close();
    },
  };
}
