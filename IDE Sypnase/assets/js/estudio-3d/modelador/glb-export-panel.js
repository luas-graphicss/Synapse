'use strict';

function mod3dCreateGlbExportPanel() {
  const panel = mod3dNo('section', 'mod3d-painel mod3d-glb-export');
  const labels = [];
  function text(tag, className, key) {
    const element = mod3dNo(tag, className, mod3dGlbText(key));
    labels.push({ element, key });
    return element;
  }
  function field(key, input, id) {
    const label = text('label', 'mod3d-glb-label', key);
    input.id = id;
    label.htmlFor = id;
    const container = mod3dNo('div', 'mod3d-glb-field');
    container.append(label, input);
    return container;
  }
  function checkbox(key, id) {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = id;
    const label = mod3dNo('label', 'mod3d-glb-check');
    label.htmlFor = id;
    label.append(input, text('span', '', key));
    return { input, label };
  }
  panel.appendChild(text('h2', 'mod3d-painel-titulo', 'Export GLB'));
  panel.appendChild(text('p', 'mod3d-glb-description', 'Meters, Y up. Validated before writing.'));
  const filename = document.createElement('input');
  filename.type = 'text';
  filename.spellcheck = false;
  filename.value = MOD3D_NOME_PADRAO;
  filename.className = 'mod3d-entrada';
  panel.appendChild(field('File name', filename, 'mod3dNomeDoArquivo'));
  const textureMode = document.createElement('select');
  textureMode.className = 'mod3d-seletor';
  for (const [value, key] of [
      ['material', 'Use material settings'],
      ['embed', 'Embed textures'],
      ['reference', 'Reference project textures'],
  ]) {
    const option = text('option', '', key);
    option.value = value;
    textureMode.appendChild(option);
  }
  panel.appendChild(field('Textures', textureMode, 'mod3dGlbTextureMode'));
  const selectionOnly = checkbox('Export selection only', 'mod3dGlbSelectionOnly');
  const overwrite = checkbox('Overwrite if the file exists', 'mod3dSobrescrever');
  panel.append(selectionOnly.label, overwrite.label);
  const save = text('button', 'mod3d-botao mod3d-botao-forte', 'Save to project');
  save.type = 'button';
  let initialStatus = mod3dGlbText('Nothing saved yet');
  const result = mod3dNo('p', 'mod3d-resultado', initialStatus);
  result.setAttribute('role', 'status');
  result.setAttribute('aria-live', 'polite');
  const report = mod3dNo('div', 'mod3d-glb-report');
  report.hidden = true;
  panel.append(save, result, report);
  const view = {
    panel,
    filename,
    textureMode,
    selectionOnly: selectionOnly.input,
    overwrite: overwrite.input,
    save,
    result,
    report,
    lastReport: null,
  };
  if (window.SYNAPSE_I18N && typeof window.SYNAPSE_I18N.on === 'function') {
    window.SYNAPSE_I18N.on(() => {
        for (const label of labels) label.element.textContent = mod3dGlbText(label.key);
        if (result.textContent === initialStatus) {
          initialStatus = mod3dGlbText('Nothing saved yet');
          result.textContent = initialStatus;
        }
        if (view.lastReport) mod3dRenderGlbReport(view, view.lastReport);
    });
  }
  return view;
}

function mod3dRenderGlbReport(view, report) {
  view.lastReport = report;
  view.report.replaceChildren();
  view.report.hidden = !report;
  if (!report) return;
  const heading = mod3dNo('h3', 'mod3d-glb-report-title', mod3dGlbText('Export report'));
  const values = mod3dNo('dl', 'mod3d-glb-metrics');
  const metrics = [
    ['File size', mod3dTamanhoLegivel(report.bytes)],
    ['Triangles', report.triangles.toLocaleString()],
    ['Vertices', report.vertices.toLocaleString()],
    ['Materials', report.materials.toLocaleString()],
    ['Textures', report.textures.toLocaleString()],
    ['Removed duplicates', report.removedVertices.toLocaleString()],
  ];
  for (const [key, value] of metrics) {
    const item = mod3dNo('div', 'mod3d-glb-metric');
    item.append(mod3dNo('dt', '', mod3dGlbText(key)), mod3dNo('dd', '', value));
    values.appendChild(item);
  }
  view.report.append(heading, values);
  view.report.appendChild(
    mod3dNo('p', 'mod3d-glb-validation', mod3dGlbText('Structure and Studio round trip passed')),
  );
  if (report.warnings && report.warnings.length) {
    const warnings = mod3dNo('ul', 'mod3d-glb-warnings');
    for (const warning of report.warnings)
    warnings.appendChild(mod3dNo('li', '', mod3dGlbText(warning)));
    view.report.appendChild(warnings);
  }
}
