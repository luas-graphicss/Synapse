'use strict';

function modelerTabVirtualResourceUrl(path) {
  const resources = window.__LP_MAP__;
  if (!resources) return '';
  const resource = resources['/' + path] || resources[path];
  if (!resource) return '';
  if (typeof resource === 'string') return resource;
  return typeof resource.u === 'string' ? resource.u : '';
}

function modelerTabResourceUrl(path) {
  const virtualUrl = modelerTabVirtualResourceUrl(path);
  if (virtualUrl) return virtualUrl;
  const base = modelerTabBaseUrl();
  if (!base) return '';
  return new URL(path, base).href;
}
