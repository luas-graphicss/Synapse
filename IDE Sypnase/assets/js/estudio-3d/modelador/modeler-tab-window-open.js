'use strict';

function modelerOpenTabWindow(windowName) {
  try {
    return window.open('', windowName);
  } catch (erro) {
    ignorarErro(erro, 'modelerOpenTabWindow');
    return null;
  }
}
