(function () {
    'use strict';

    const planes = Object.freeze({ xz: [0, 2], xy: [0, 1], yz: [2, 1] });
    const axisColors = [
      [0.85, 0.35, 0.4],
      [0.36, 0.78, 0.52],
      [0.36, 0.56, 0.95],
    ];
    const minorColor = [0.125, 0.145, 0.185];
    const majorColor = [0.2, 0.23, 0.3];

    function planeFor(camera) {
      if (!camera.orto) return 'xz';
      if (camera.vista === 'frente') return 'xy';
      if (camera.vista === 'lado') return 'yz';
      return 'xz';
    }

    function stepFor(visibleHeight) {
      const desired = Math.max(
        1e-6,
        (Number.isFinite(visibleHeight) && visibleHeight > 0 ? visibleHeight : 1) / 12,
      );
      const magnitude = 10 ** Math.floor(Math.log10(desired));
      const normalized = desired / magnitude;
      return (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
    }

    function describe(visibleHeight, target, camera) {
      const step = stepFor(visibleHeight);
      const plane = planeFor(camera);
      const axes = planes[plane];
      const center = axes.map((axis) =>
        Math.round((Number.isFinite(target?.[axis]) ? target[axis] : 0) / step),
      );
      return { step, plane, center, key: [plane, step, ...center].join('|') };
    }

    function geometry(description, radius = 60) {
      const { step, plane, center } = description;
      if (!(step > 0) || !Number.isFinite(step) || !planes[plane] || !center.every(Number.isFinite)) {
        throw new RangeError('Invalid grid description.');
      }
      const extent = Math.min(120, Math.max(2, Math.floor(radius) || 60));
      const axes = planes[plane];
      const segmentLength = 4;
      const segmentCount = Math.ceil((extent * 2) / segmentLength);
      const positions = new Float32Array((extent * 2 + 1) * segmentCount * 12);
      const colors = new Float32Array(positions.length);
      let offset = 0;
      for (let index = -extent; index <= extent; index++) {
        for (let direction = 0; direction < 2; direction++) {
          const fixedAxis = axes[direction];
          const movingAxis = axes[1 - direction];
          const worldIndex = center[direction] + index;
          const color =
          worldIndex === 0
          ? axisColors[movingAxis]
          : worldIndex % 10 === 0
          ? majorColor
          : minorColor;
          for (let segmentStart = -extent; segmentStart < extent; segmentStart += segmentLength) {
            for (const position of [segmentStart, Math.min(extent, segmentStart + segmentLength)]) {
              positions[offset + fixedAxis] = worldIndex * step;
              positions[offset + movingAxis] = (center[1 - direction] + position) * step;
              colors.set(color, offset);
              offset += 3;
            }
          }
        }
      }
      return { positions, colors };
    }

    window.SynapseModelerGrid = Object.freeze({ planeFor, stepFor, describe, geometry });
})();
