'use strict';

const MODELER_TAB_DOCUMENT_TITLE = 'Blepse 3D • Synapse';
const MODELER_TAB_BODY_CLASS = 'mod3d-corpo';
const MODELER_TAB_VIEWPORT = 'width=device-width, initial-scale=1, viewport-fit=cover';
const MODELER_TAB_BOOT_ELEMENT_ID = 'mod3dBoot';

function modelerTabStyleTag(path) {
  const url = modelerTabResourceUrl(path);
  if (!url) return '';
  return '<link rel="stylesheet" href="' + escaparHtml(url) + '" />';
}

function modelerTabScriptTag(path) {
  const url = modelerTabResourceUrl(path);
  if (!url) throw new Error('Modeler tab script is missing: ' + path);
  return '<script src="' + escaparHtml(url) + '"><\/script>';
}

function modelerTabBaseTag() {
  const base = modelerTabBaseUrl();
  if (!base) return '';
  return '<base href="' + escaparHtml(base) + '" />';
}

function modelerTabJsonForScript(payload) {
  return JSON.stringify(payload).replace(/</g, '\\u003c');
}

function modelerTabBootTag(session) {
  const payload = modelerTabJsonForScript({ sessao: session, base: modelerTabBaseUrl() });
  return (
    '<script type="application/json" id="' +
    MODELER_TAB_BOOT_ELEMENT_ID +
    '">' +
    payload +
    '<\/script>'
  );
}

function modelerTabDocumentHtml(session) {
  return (
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />' +
    '<meta name="viewport" content="' +
    MODELER_TAB_VIEWPORT +
    '" />' +
    modelerTabBaseTag() +
    '<title>' +
    escaparHtml(MODELER_TAB_DOCUMENT_TITLE) +
    '</title>' +
    MODELER_TAB_STYLE_PATHS.map(modelerTabStyleTag).join('') +
    modelerTabBootTag(session) +
    '</head><body class="' +
    MODELER_TAB_BODY_CLASS +
    '">' +
    MODELER_TAB_SCRIPT_PATHS.map(modelerTabScriptTag).join('') +
    '</body></html>'
  );
}
