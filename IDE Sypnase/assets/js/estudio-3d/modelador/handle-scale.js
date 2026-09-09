'use strict';

(function () {
    const minimumClipDistance = 1e-4;

    function clipDistanceForPoint(matrices, point) {
      const view = matrices.view;
      const projection = matrices.proj;
      const viewX = view[0] * point[0] + view[4] * point[1] + view[8] * point[2] + view[12];
      const viewY = view[1] * point[0] + view[5] * point[1] + view[9] * point[2] + view[13];
      const viewZ = view[2] * point[0] + view[6] * point[1] + view[10] * point[2] + view[14];
      return projection[3] * viewX + projection[7] * viewY + projection[11] * viewZ + projection[15];
    }

    function worldUnitsPerPixel(matrices, viewportHeightInPixels, point) {
      if (!matrices || !matrices.view || !matrices.proj || !point) return 0;
      const heightInPixels = Math.max(1, Number(viewportHeightInPixels) || 0);
      const verticalFocus = matrices.proj[5];
      if (!isFinite(verticalFocus) || verticalFocus <= 0) return 0;
      const clipDistance = Math.abs(clipDistanceForPoint(matrices, point));
      if (!isFinite(clipDistance)) return 0;
      return (2 * Math.max(minimumClipDistance, clipDistance)) / (verticalFocus * heightInPixels);
    }

    function worldSizeForPixels(matrices, viewportHeightInPixels, point, sizeInPixels) {
      const scale = worldUnitsPerPixel(matrices, viewportHeightInPixels, point);
      const pixels = Math.max(1, Number(sizeInPixels) || 0);
      return scale > 0 ? scale * pixels : 0;
    }

    window.SynapseHandleScale = Object.freeze({
        worldUnitsPerPixel: worldUnitsPerPixel,
        worldSizeForPixels: worldSizeForPixels,
    });
})();
