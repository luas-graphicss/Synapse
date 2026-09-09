'use strict';

const MODELER_TAB_BOOT_ID = 'mod3dBoot';

function modelerTabBootPayload() {
  return {
    sessao: modelerTabSessionFromPageUrl(window.location.href),
    base: new URL('.', document.baseURI).href,
  };
}

function modelerTabWriteBoot() {
  if (document.getElementById(MODELER_TAB_BOOT_ID)) return;
  const boot = document.createElement('script');
  boot.type = 'application/json';
  boot.id = MODELER_TAB_BOOT_ID;
  boot.textContent = JSON.stringify(modelerTabBootPayload());
  document.head.appendChild(boot);
}

modelerTabWriteBoot();
