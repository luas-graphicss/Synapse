'use strict';

function blenderForeignModalIsRunning() {
  if (typeof meshExtrudeModal !== 'object' || meshExtrudeModal === null) return false;
  return meshExtrudeModal.running === true;
}
