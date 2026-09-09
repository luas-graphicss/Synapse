'use strict';

const MODELER_TAB_PAGE_PATH = 'modelador-3d.html';
const MODELER_TAB_SESSION_PARAM = 'sessao';

function modelerTabPageUrl(session) {
  const base = modelerTabBaseUrl();
  if (!base) return '';
  const address = new URL(MODELER_TAB_PAGE_PATH, base);
  address.searchParams.set(MODELER_TAB_SESSION_PARAM, session);
  return address.href;
}

function modelerTabSessionFromPageUrl(address) {
  try {
    return new URL(address).searchParams.get(MODELER_TAB_SESSION_PARAM) || '';
  } catch {
    return '';
  }
}
