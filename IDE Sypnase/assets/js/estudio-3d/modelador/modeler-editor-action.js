'use strict';

function mod3dAttachEditorAction(toolbar, project, path) {
  if (!/\.(glb|gltf|obj|stl)$/i.test(path)) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'mv-btn';
  button.dataset.mv = 'edit-model';
  button.textContent =
  window.SYNAPSE_I18N && window.SYNAPSE_I18N.modelerProjectText
  ? window.SYNAPSE_I18N.modelerProjectText('Edit in modeler')
  : 'Edit in modeler';
  button.addEventListener('click', () => mod3dAbrirAba({ project: project.id, path }));
  const actions = toolbar.querySelector('.mv-actions') || toolbar;
  actions.appendChild(button);
}
