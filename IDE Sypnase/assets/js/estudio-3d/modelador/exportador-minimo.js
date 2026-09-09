'use strict';

function mod3dNumeroDoGltf(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number * 1000000) / 1000000;
}

function mod3dCenaGltf(options) {
  return mod3dBuildGlbDocument(mod3dCaptureGlbScene(options));
}
