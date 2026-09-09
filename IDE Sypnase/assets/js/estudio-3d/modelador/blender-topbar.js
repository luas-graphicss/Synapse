'use strict';

function blenderBuildTopbar() {
  const topbar = document.querySelector('.mod3d-topo');
  if (!topbar || topbar.classList.contains('blender-topbar')) return null;
  topbar.classList.add('blender-topbar');
  blenderPrependIcon(topbar.querySelector('.mod3d-marca'), BLENDER_TOPBAR_ICONS.brand);
  const right = blenderHeaderGroup('blender-topbar-right');
  const projectBar = document.querySelector('.mod3d-barra');
  if (projectBar) {
    const projectLabel = projectBar.querySelector('.mod3d-rotulo');
    const projectSelect = projectBar.querySelector('.mod3d-seletor');
    const projectRefresh = projectBar.querySelector('.mod3d-botao');
    if (projectSelect) {
      const datablock = blenderWrapWithIcon(
        projectSelect,
        BLENDER_TOPBAR_ICONS.project,
        'blender-datablock',
      );
      if (projectLabel) {
        projectLabel.classList.add(BLENDER_HIDDEN_LABEL_CLASS);
        datablock.insertBefore(projectLabel, datablock.firstChild);
      }
      right.appendChild(datablock);
    }
    if (projectRefresh) {
      right.appendChild(blenderTurnButtonIntoIcon(projectRefresh, BLENDER_TOPBAR_ICONS.reload));
    }
    projectBar.remove();
  }
  const connection = topbar.querySelector('.mod3d-ligacao');
  if (connection) right.appendChild(connection);
  Array.from(topbar.querySelectorAll('.mod3d-atalhos-botao, .mod3d-gaveta-botao')).forEach((button) => {
      button.classList.add('blender-topbar-menu-button');
      right.appendChild(button);
  });
  topbar.appendChild(right);
  return topbar;
}
