'use strict';

let mod3dGravando = false;
let mod3dUltimoResultado = null;

async function mod3dSaveGlbScene() {
  if (!mod3dTela || mod3dGravando) return null;
  const project = mod3dTela.seletor.value || mod3dDestino;
  if (!project) {
    mod3dUltimoResultado = { erro: 'sem-projeto' };
    mod3dMostrarResultado(mod3dTextoDoErro(mod3dUltimoResultado), 'erro');
    return mod3dUltimoResultado;
  }
  const view = mod3dTela.exportPanel;
  const controls = [
    view.filename,
    view.textureMode,
    view.selectionOnly,
    view.overwrite,
    view.editableSource,
    view.compressSource,
    view.save,
    mod3dTela.seletor,
  ];
  const previousDisabled = controls.map((control) => control.disabled);
  mod3dGravando = true;
  controls.forEach((control) => {
      control.disabled = true;
  });
  mod3dRenderGlbReport(view, null);
  mod3dMostrarResultado(mod3dGlbText('Preparing and validating export…'), 'espera');
  let pendingWrite = false;
  let savedResult = null;
  let preparedDocument = null;
  try {
    const scene = mod3dCaptureGlbScene({
        selectionOnly: view.selectionOnly.checked,
        textureMode: view.textureMode.value,
    });
    if (!scene) throw new Error(mod3dGlbText('No geometry to export'));
    const textureCache = new Map(mod3dTexturas.cache);
    preparedDocument = await mod3dProjectDocument.prepareExport();
    if (!preparedDocument) {
      mod3dMostrarResultado(mod3dProjectText('Export cancelled'), '');
      return { cancelled: true };
    }
    const resources = await mod3dPrepareGlbTextures(scene, project, mod3dCanalDaAba, textureCache);
    const document = mod3dBuildGlbDocument(scene, resources);
    if (
      preparedDocument.modelPath.includes('/') &&
      (document.json.images || []).some((image) => image.uri)
    ) {
      throw new Error(
        'For subfolder exports, choose Embed textures to keep the GLB self-contained.',
      );
    }
    pendingWrite = true;
    const result = await mod3dEnviarModelo(mod3dCanalDaAba, {
        projeto: project,
        nome: preparedDocument.modelPath,
        documentToken: preparedDocument.token,
        documentConfirmed: true,
        sobrescrever: view.overwrite.checked,
        json: document.json,
        bin: document.bin,
        expected: document.expected,
        conversion: document.conversion,
        progresso: (completed, total) => {
          mod3dMostrarResultado(`${mod3dGlbText('Sending blocks')} ${completed}/${total}`, 'espera');
        },
    });
    pendingWrite = false;
    mod3dUltimoResultado = result;
    if (result.erro) {
      const message =
      result.erro === 'invalid-glb'
      ? mod3dGlbText('Export rejected. Nothing was written.')
      : result.erro === 'sem-resposta'
      ? mod3dGlbText('No confirmation received. Check the destination before trying again.')
      : mod3dTextoDoErro(result);
      mod3dMostrarResultado(
        result.detalhe && result.erro === 'invalid-glb' ? `${message} ${result.detalhe}` : message,
        'erro',
      );
      return result;
    }
    savedResult = result;
    view.filename.value = result.caminho;
    await mod3dProjectDocument.exported(result, preparedDocument);
    mod3dMostrarResultado(`${mod3dGlbText('Saved')}: ${result.caminho} · ${result.projeto}`, 'ok');
    if (result.report && result.report.validated) mod3dRenderGlbReport(view, result.report);
    const notices = (result.warnings || []).slice();
    if (!preparedDocument.sourceIncluded) {
      notices.push(
        mod3dProjectText(
          'GLB saved without editable source. Keep the local draft to continue editing.',
        ),
      );
    }
    if (notices.length) view.result.textContent += ` — ${notices.join(' ')}`;
    mod3dCanalDaAba.enviarPorTodos('projetos-pedido', {});
    return result;
  } catch (error) {
    registro.erro('GLB export failed', error);
    if (savedResult) {
      view.result.textContent = `${mod3dGlbText('Saved')}: ${savedResult.caminho}`;
      return savedResult;
    }
    const result = {
      erro: pendingWrite ? 'sem-resposta' : 'invalid-glb',
      detalhe: error && error.message ? error.message : String(error),
    };
    mod3dUltimoResultado = result;
    const message = pendingWrite
    ? mod3dGlbText('No confirmation received. Check the destination before trying again.')
    : mod3dGlbText('Export rejected. Nothing was written.');
    mod3dMostrarResultado(`${message} ${result.detalhe}`, 'erro');
    return result;
  } finally {
    mod3dGravando = false;
    controls.forEach((control, index) => {
        control.disabled = previousDisabled[index];
    });
    mod3dTela.seletor.disabled = !mod3dProjetosDaAba.length;
    view.save.disabled = mod3dTela.seletor.disabled;
  }
}
