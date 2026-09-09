'use strict';

function modelerTabInstallToastFallback() {
  if (typeof window.toast === 'function') return;
  window.toast = function (title, detail) {
    registro.info('modelador 3d', title, detail);
  };
}

modelerTabInstallToastFallback();
