'use strict';

function blenderStatusHint() {
  const counter = document.querySelector('.mod3d-malha-contagem');
  const panel = counter ? counter.closest('.mod3d-painel') : null;
  return panel ? panel.querySelector('.mod3d-malha-dica') : null;
}

function blenderBuildStatusBar() {
  const bar = document.querySelector('.mod3d-estado');
  if (!bar || bar.classList.contains('blender-statusbar')) return null;
  bar.classList.add('blender-statusbar');
  const left = document.createElement('div');
  left.className = 'blender-statusbar-left';
  const right = document.createElement('div');
  right.className = 'blender-statusbar-right';
  while (bar.firstChild) right.appendChild(bar.firstChild);
  const hint = blenderStatusHint();
  if (hint) {
    hint.classList.add('blender-statusbar-hint');
    left.appendChild(hint);
  }
  const stats = document.querySelector('.mod3d-painel-resumo');
  if (stats) {
    stats.classList.add('blender-statusbar-stats');
    right.insertBefore(stats, right.firstChild);
  }
  bar.appendChild(left);
  bar.appendChild(right);
  return bar;
}
