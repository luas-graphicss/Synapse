'use strict';

const MODELER_TAB_ENTRY_SCRIPT = 'assets/js/estudio-3d/modelador/canal.js';
const MODELER_TAB_LOADABLE_PREFIXES = ['http://', 'https://'];

function modelerIsLoadableBase(base) {
  return MODELER_TAB_LOADABLE_PREFIXES.some((prefix) => base.startsWith(prefix));
}

function modelerBaseFromLoadedScripts() {
  const scripts = document.querySelectorAll('script[src]');
  for (const script of scripts) {
    const address = script.src || '';
    const entryStart = address.indexOf(MODELER_TAB_ENTRY_SCRIPT);
    if (entryStart > 0) return address.slice(0, entryStart);
  }
  return '';
}

function modelerBaseFromDocumentAddress() {
  try {
    return new URL('.', document.baseURI).href;
  } catch (error) {
    ignorarErro(error, 'modelerBaseFromDocumentAddress');
    return '';
  }
}

function modelerTabBaseUrl() {
  const candidates = [modelerBaseFromLoadedScripts(), modelerBaseFromDocumentAddress()];
  return candidates.find((base) => base && modelerIsLoadableBase(base)) || '';
}
