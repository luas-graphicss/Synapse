'use strict';

function mod3dOpenProjectList() {
  if (typeof State === 'undefined' || !State || !Array.isArray(State.projects)) return [];
  return State.projects;
}

function mod3dActiveOpenProject() {
  const projects = mod3dOpenProjectList();
  if (!projects.length) return null;
  return projects.find((project) => project.id === State.active) || projects[0];
}

function mod3dResolveOpenProject(projectId) {
  const projects = mod3dOpenProjectList();
  const wantedId = String(projectId || '');
  const wanted = wantedId ? projects.find((project) => project.id === wantedId) : null;
  return wanted || mod3dActiveOpenProject();
}
