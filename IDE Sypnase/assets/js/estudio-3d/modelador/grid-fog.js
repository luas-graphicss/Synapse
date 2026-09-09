'use strict';

(function () {
    const planeAxes = { xz: [0, 2], xy: [0, 1], yz: [2, 1] };
    const startRatio = 0.42;
    const endRatio = 0.94;
    const defaultColor = [0.043, 0.051, 0.071];

    function colorOrDefault(color) {
      if (!Array.isArray(color) || color.length < 3) return defaultColor.slice();
      return [Number(color[0]) || 0, Number(color[1]) || 0, Number(color[2]) || 0];
    }

    function centerInWorld(plane, center) {
      const axes = planeAxes[plane] || planeAxes.xz;
      const point = [0, 0, 0];
      point[axes[0]] = Number(center && center[0]) || 0;
      point[axes[1]] = Number(center && center[1]) || 0;
      return point;
    }

    function settingsFor(description, backgroundColor) {
      const radius = Math.max(0.001, Number(description && description.radius) || 1);
      return {
        color: colorOrDefault(backgroundColor),
        center: centerInWorld(description ? description.plane : 'xz', description ? description.center : null),
        start: radius * startRatio,
        end: radius * endRatio,
      };
    }

    function disabledSettings(backgroundColor) {
      return { color: colorOrDefault(backgroundColor), center: [0, 0, 0], start: 0, end: 0 };
    }

    window.SynapseGridFog = Object.freeze({
        settingsFor: settingsFor,
        disabledSettings: disabledSettings,
    });
})();
