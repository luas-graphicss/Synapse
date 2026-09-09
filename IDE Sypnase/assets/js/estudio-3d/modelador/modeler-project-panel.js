'use strict';

function mod3dProjectText(text) {
  const translator = window.SYNAPSE_I18N;
  return translator && typeof translator.modelerProjectText === 'function'
  ? translator.modelerProjectText(text)
  : text;
}

function mod3dProjectButton(text, id) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'mod3d-botao';
  button.id = id;
  button.textContent = mod3dProjectText(text);
  button.dataset.projectLabel = text;
  return button;
}

function mod3dCreateProjectPanel() {
  const panel = mod3dNo('section', 'mod3d-painel mod3d-project');
  panel.dataset.i18n = 'off';
  panel.setAttribute('aria-labelledby', 'mod3dDocumentHeading');
  const title = mod3dNo('h2', 'mod3d-painel-titulo', mod3dProjectText('Editable project'));
  title.id = 'mod3dDocumentHeading';
  title.dataset.projectLabel = 'Editable project';
  const identity = mod3dNo('p', 'mod3d-project-identity', mod3dProjectText('Untitled scene'));
  identity.id = 'mod3dDocumentIdentity';
  const state = mod3dNo('p', 'mod3d-project-status');
  state.id = 'mod3dDocumentStatus';
  state.setAttribute('role', 'status');
  state.setAttribute('aria-live', 'polite');
  const actions = mod3dNo('div', 'mod3d-ferramentas');
  const create = mod3dProjectButton('New scene', 'mod3dNewDocument');
  const refresh = mod3dProjectButton('Refresh files', 'mod3dRefreshDocuments');
  const retry = mod3dProjectButton('Save local draft', 'mod3dFlushDraft');
  actions.append(create, refresh, retry);
  const label = mod3dNo(
    'label',
    'mod3d-entrada-rotulo',
    mod3dProjectText('Project model or source'),
  );
  label.htmlFor = 'mod3dDocumentFiles';
  label.dataset.projectLabel = 'Project model or source';
  const files = mod3dNo('select', 'mod3d-seletor');
  files.id = 'mod3dDocumentFiles';
  const open = mod3dProjectButton('Open editable', 'mod3dOpenDocument');
  const importGeometry = mod3dProjectButton('Import geometry only', 'mod3dImportGeometry');
  const openActions = mod3dNo('div', 'mod3d-ferramentas');
  openActions.append(open, importGeometry);
  const recovery = mod3dNo('div', 'mod3d-project-recovery');
  recovery.id = 'mod3dRecovery';
  recovery.hidden = true;
  const notice = mod3dNo(
    'p',
    'mod3d-project-note',
    mod3dProjectText(
      'Local drafts stay in this browser. Export with editable source to include your work in the project ZIP.',
    ),
  );
  notice.dataset.projectLabel =
  'Local drafts stay in this browser. Export with editable source to include your work in the project ZIP.';
  panel.append(title, identity, state, actions, label, files, openActions, recovery, notice);
  return { panel, identity, state, create, refresh, retry, files, open, importGeometry, recovery };
}

function mod3dRenderProjectFiles(view, documents) {
  const selected = view.files.value;
  view.files.replaceChildren();
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = mod3dProjectText('Choose a file');
  view.files.appendChild(placeholder);
  for (const file of documents) {
    const option = document.createElement('option');
    option.value = file.path;
    option.textContent = `${file.editable ? '◇ ' : ''}${file.path}`;
    view.files.appendChild(option);
  }
  view.files.value = documents.some((file) => file.path === selected) ? selected : '';
}

function mod3dRenderRecovery(view, drafts, recover, remove) {
  view.recovery.replaceChildren();
  view.recovery.hidden = drafts.length === 0;
  if (!drafts.length) return;
  view.recovery.appendChild(mod3dNo('h3', '', mod3dProjectText('Recovery drafts')));
  for (const draft of drafts) {
    const row = mod3dNo('div', 'mod3d-recovery-row');
    const title = mod3dNo(
      'span',
      '',
      `${draft.modelPath || mod3dProjectText('Untitled scene')} · ${new Date(draft.updatedAt).toLocaleString()}`,
    );
    const restore = mod3dProjectButton('Recover', '');
    const discard = mod3dProjectButton('Discard', '');
    restore.addEventListener('click', () => recover(draft.key));
    discard.addEventListener('click', () => remove(draft.key));
    row.append(title, restore, discard);
    view.recovery.appendChild(row);
  }
}

function mod3dCreateSourceOptions(view) {
  const makeCheckbox = (text, id) => {
    const label = mod3dNo('label', 'mod3d-glb-check');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = true;
    input.id = id;
    const span = mod3dNo('span', '', mod3dProjectText(text));
    span.dataset.projectLabel = text;
    label.append(input, span);
    view.panel.insertBefore(label, view.save);
    return input;
  };
  view.editableSource = makeCheckbox('Include editable source (full scene)', 'mod3dIncludeSource');
  view.compressSource = makeCheckbox('Compress editable source', 'mod3dCompressSource');
  view.editableSource.addEventListener('change', () => {
      view.compressSource.disabled = !view.editableSource.checked;
  });
}
