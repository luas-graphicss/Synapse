'use strict';

function mod3dProjectIsOpen(projects, projectId) {
  if (!Array.isArray(projects) || !projectId) return false;
  return projects.some((project) => project.id === projectId);
}

function mod3dChooseOpenProject(projects, preferredId) {
  if (!Array.isArray(projects) || !projects.length) return '';
  if (mod3dProjectIsOpen(projects, preferredId)) return preferredId;
  const active = projects.find((project) => project.ativo);
  return (active || projects[0]).id;
}
