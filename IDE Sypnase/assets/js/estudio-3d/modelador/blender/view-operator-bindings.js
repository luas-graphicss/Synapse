'use strict';

function blenderViewportCamera() {
  return typeof mod3dCena === 'object' && mod3dCena ? mod3dCena.camera : null;
}

function blenderFrameAllObjects() {
  if (typeof mod3dEnquadrarCena !== 'function') return false;
  mod3dEnquadrarCena();
  return true;
}

function blenderFrameSelectedObjects() {
  const camera = blenderViewportCamera();
  const ids = blenderSelectedObjectIds();
  if (!camera || !ids.length || typeof mod3dCaixaDeNos !== 'function') return blenderFrameAllObjects();
  const box = mod3dCaixaDeNos(ids);
  if (!box) return blenderFrameAllObjects();
  camera.enquadrar(box.minimo, box.maximo);
  return true;
}

function blenderRegisterViewOperators() {
  blenderRegisterOperator('view3d.view_front', () =>
    blenderApplyViewpoint(blenderViewportCamera(), 'front')
  );
  blenderRegisterOperator('view3d.view_back', () =>
    blenderApplyViewpoint(blenderViewportCamera(), 'back')
  );
  blenderRegisterOperator('view3d.view_right', () =>
    blenderApplyViewpoint(blenderViewportCamera(), 'right')
  );
  blenderRegisterOperator('view3d.view_left', () =>
    blenderApplyViewpoint(blenderViewportCamera(), 'left')
  );
  blenderRegisterOperator('view3d.view_top', () =>
    blenderApplyViewpoint(blenderViewportCamera(), 'top')
  );
  blenderRegisterOperator('view3d.view_bottom', () =>
    blenderApplyViewpoint(blenderViewportCamera(), 'bottom')
  );
  blenderRegisterOperator('view3d.view_opposite', () => blenderFlipView(blenderViewportCamera()));
  blenderRegisterOperator('view3d.view_persportho', () =>
    blenderToggleViewProjection(blenderViewportCamera())
  );
  blenderRegisterOperator('view3d.orbit_left', () =>
    blenderOrbitView(blenderViewportCamera(), 'left')
  );
  blenderRegisterOperator('view3d.orbit_right', () =>
    blenderOrbitView(blenderViewportCamera(), 'right')
  );
  blenderRegisterOperator('view3d.orbit_up', () => blenderOrbitView(blenderViewportCamera(), 'up'));
  blenderRegisterOperator('view3d.orbit_down', () =>
    blenderOrbitView(blenderViewportCamera(), 'down')
  );
  blenderRegisterOperator('view3d.view_all', () => blenderFrameAllObjects());
  blenderRegisterOperator('view3d.view_selected', () => blenderFrameSelectedObjects());
  blenderRegisterOperator('view3d.snap_cursor_to_center', () => {
      blenderResetCursorPosition();
      return true;
  });
}
