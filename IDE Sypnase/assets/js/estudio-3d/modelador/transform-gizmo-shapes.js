'use strict';

(function () {
    const ringSegments = 64;
    const coneSegments = 12;
    const shaftStartRatio = 0.16;
    const arrowLengthRatio = 0.26;
    const arrowRadiusRatio = 0.085;
    const boxRatio = 0.08;
    const silhouetteMargin = 0.02;
    const defaultAxes = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    const defaultHandles = ['x', 'y', 'z'];

    function pointAlong(origin, direction, length) {
      return [
        origin[0] + direction[0] * length,
        origin[1] + direction[1] * length,
        origin[2] + direction[2] * length,
      ];
    }

    function pointOnPlane(origin, firstAxis, secondAxis, firstAmount, secondAmount) {
      return [
        origin[0] + firstAxis[0] * firstAmount + secondAxis[0] * secondAmount,
        origin[1] + firstAxis[1] * firstAmount + secondAxis[1] * secondAmount,
        origin[2] + firstAxis[2] * firstAmount + secondAxis[2] * secondAmount,
      ];
    }

    function dotProduct(first, second) {
      return first[0] * second[0] + first[1] * second[1] + first[2] * second[2];
    }

    function arrowShapes(handle, origin, direction, firstSide, secondSide, radius) {
      const shapes = [];
      const shaftStart = pointAlong(origin, direction, radius * shaftStartRatio);
      const headBase = pointAlong(origin, direction, radius * (1 - arrowLengthRatio));
      const tip = pointAlong(origin, direction, radius);
      const headRadius = radius * arrowRadiusRatio;
      const baseRing = [];
      for (let step = 0; step <= coneSegments; step++) {
        const angle = (step / coneSegments) * Math.PI * 2;
        baseRing.push(
          pointOnPlane(
            headBase,
            firstSide,
            secondSide,
            Math.cos(angle) * headRadius,
            Math.sin(angle) * headRadius,
          ),
        );
      }
      shapes.push({ handle: handle, points: [shaftStart, headBase], pickable: true });
      shapes.push({ handle: handle, points: [headBase, tip], pickable: true });
      shapes.push({ handle: handle, points: baseRing, pickable: false });
      for (let step = 0; step < coneSegments; step++) {
        shapes.push({ handle: handle, points: [baseRing[step], tip], pickable: false });
      }
      return shapes;
    }

    function boxCorner(center, direction, firstSide, secondSide, signs, half) {
      return [
        center[0] + (direction[0] * signs[0] + firstSide[0] * signs[1] + secondSide[0] * signs[2]) * half,
        center[1] + (direction[1] * signs[0] + firstSide[1] * signs[1] + secondSide[1] * signs[2]) * half,
        center[2] + (direction[2] * signs[0] + firstSide[2] * signs[1] + secondSide[2] * signs[2]) * half,
      ];
    }

    function boxCornerSigns() {
      const corners = [];
      for (let alongSign = -1; alongSign <= 1; alongSign += 2) {
        for (let firstSign = -1; firstSign <= 1; firstSign += 2) {
          for (let secondSign = -1; secondSign <= 1; secondSign += 2) {
            corners.push([alongSign, firstSign, secondSign]);
          }
        }
      }
      return corners;
    }

    function boxShapes(handle, origin, direction, firstSide, secondSide, radius) {
      const shapes = [];
      const half = radius * boxRatio;
      const shaftStart = pointAlong(origin, direction, radius * shaftStartRatio);
      const boxCenter = pointAlong(origin, direction, radius - half);
      shapes.push({ handle: handle, points: [shaftStart, boxCenter], pickable: true });
      const corners = boxCornerSigns();
      corners.forEach((first, firstIndex) => {
          corners.forEach((second, secondIndex) => {
              if (secondIndex <= firstIndex) return;
              let differences = 0;
              for (let axis = 0; axis < 3; axis++) {
                if (first[axis] !== second[axis]) differences++;
              }
              if (differences !== 1) return;
              shapes.push({
                  handle: handle,
                  points: [
                    boxCorner(boxCenter, direction, firstSide, secondSide, first, half),
                    boxCorner(boxCenter, direction, firstSide, secondSide, second, half),
                  ],
                  pickable: false,
              });
          });
      });
      return shapes;
    }

    function ringShapes(handle, origin, firstSide, secondSide, radius, forward) {
      const shapes = [];
      let current = [];
      for (let step = 0; step <= ringSegments; step++) {
        const angle = (step / ringSegments) * Math.PI * 2;
        const point = pointOnPlane(
          origin,
          firstSide,
          secondSide,
          Math.cos(angle) * radius,
          Math.sin(angle) * radius,
        );
        const offset = [point[0] - origin[0], point[1] - origin[1], point[2] - origin[2]];
        const facesCamera = !forward || dotProduct(offset, forward) <= radius * silhouetteMargin;
        if (facesCamera) {
          current.push(point);
          continue;
        }
        if (current.length > 1) shapes.push({ handle: handle, points: current, pickable: true });
        current = [];
      }
      if (current.length > 1) shapes.push({ handle: handle, points: current, pickable: true });
      return shapes;
    }

    function shapes(request) {
      const settings = request || {};
      const origin = settings.origin || [0, 0, 0];
      const axes = Array.isArray(settings.axes) && settings.axes.length === 3 ? settings.axes : defaultAxes;
      const handles = Array.isArray(settings.handles) ? settings.handles : defaultHandles;
      const radius = Math.max(1e-6, Number(settings.radius) || 1);
      const forward = Array.isArray(settings.forward) ? settings.forward : null;
      const mode = settings.mode || 'move';
      const result = [];
      handles.forEach((handle, index) => {
          const direction = axes[index] || defaultAxes[index];
          const firstSide = axes[(index + 1) % 3] || defaultAxes[(index + 1) % 3];
          const secondSide = axes[(index + 2) % 3] || defaultAxes[(index + 2) % 3];
          let parts = [];
          if (mode === 'rotate') parts = ringShapes(handle, origin, firstSide, secondSide, radius, forward);
          else if (mode === 'scale') parts = boxShapes(handle, origin, direction, firstSide, secondSide, radius);
          else parts = arrowShapes(handle, origin, direction, firstSide, secondSide, radius);
          parts.forEach((shape) => result.push(shape));
      });
      return result;
    }

    window.SynapseTransformGizmoShapes = Object.freeze({ shapes: shapes });
})();
