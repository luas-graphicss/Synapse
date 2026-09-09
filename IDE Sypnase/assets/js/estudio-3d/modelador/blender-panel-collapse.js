'use strict';

const BLENDER_CLOSED_PANEL_CLASS = 'is-closed';

function blenderPanelHeader(panel) {
  return Array.from(panel.children).filter((child) => child.classList.contains('mod3d-painel-titulo'))[0] || null;
}

function blenderMakePanelCollapsible(panel) {
  const header = blenderPanelHeader(panel);
  if (!header || header.classList.contains('blender-panel-header')) return false;
  header.classList.add('blender-panel-header');
  header.setAttribute('role', 'button');
  header.setAttribute('aria-expanded', 'true');
  header.tabIndex = 0;
  const togglePanel = () => {
    const closed = panel.classList.toggle(BLENDER_CLOSED_PANEL_CLASS);
    header.setAttribute('aria-expanded', closed ? 'false' : 'true');
  };
  header.addEventListener('click', togglePanel);
  header.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      togglePanel();
  });
  return true;
}

function blenderMakePanelsCollapsible() {
  const panels = Array.from(document.querySelectorAll('.blender-properties-body > .mod3d-painel'));
  panels.forEach(blenderMakePanelCollapsible);
  return panels.length;
}
