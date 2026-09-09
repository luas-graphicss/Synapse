'use strict';

(function () {
    const planeAxes = { xz: [0, 2], xy: [0, 1], yz: [2, 1] };
    const axisColors = [
      [0.85, 0.35, 0.4],
      [0.36, 0.78, 0.52],
      [0.36, 0.56, 0.95],
    ];
    const minorColor = [0.13, 0.15, 0.19];
    const majorColor = [0.24, 0.27, 0.33];
    const defaultBackground = [0.043, 0.051, 0.071];
    const cellsAcrossHeight = 10;
    const radiusInScreenHeights = 2.4;
    const fadeStart = 0.05;
    const fadeEnd = 0.6;
    const fadeSteps = 24;
    const minimumStrength = 0.03;
    const maximumLinesPerLevel = 420;
    const levelFactors = [1, 10, 100];

    function clamp(value, minimum, maximum) {
      return Math.min(maximum, Math.max(minimum, value));
    }

    function finiteOr(value, fallback) {
      const number = Number(value);
      return isFinite(number) ? number : fallback;
    }

    function smoothStep(value) {
      const amount = clamp(value, 0, 1);
      return amount * amount * (3 - 2 * amount);
    }

    function mixColor(from, to, amount) {
      return [
        from[0] + (to[0] - from[0]) * amount,
        from[1] + (to[1] - from[1]) * amount,
        from[2] + (to[2] - from[2]) * amount,
      ];
    }

    function backgroundOrDefault(color) {
      if (!Array.isArray(color) || color.length < 3) return defaultBackground;
      return [Number(color[0]) || 0, Number(color[1]) || 0, Number(color[2]) || 0];
    }

    function planeForCamera(camera) {
      const grid = window.SynapseModelerGrid;
      if (grid && typeof grid.planeFor === 'function') return grid.planeFor(camera || {});
      return 'xz';
    }

    function describe(visibleHeight, target, camera) {
      const height = clamp(finiteOr(visibleHeight, 6), 0.002, 200000);
      const plane = planeForCamera(camera);
      const axes = planeAxes[plane] || planeAxes.xz;
      const desiredSpacing = height / cellsAcrossHeight;
      const exponent = Math.floor(Math.log(desiredSpacing) / Math.LN10);
      const fraction = Math.log(desiredSpacing) / Math.LN10 - exponent;
      const transition =
      Math.round(smoothStep((fraction - fadeStart) / (fadeEnd - fadeStart)) * fadeSteps) / fadeSteps;
      const spacing = Math.pow(10, exponent);
      const radius = height * radiusInScreenHeights;
      const center = [
        clamp(finiteOr(target && target[axes[0]], 0), -1e6, 1e6),
        clamp(finiteOr(target && target[axes[1]], 0), -1e6, 1e6),
      ];
      const low = center.map((value) => Math.floor((value - radius) / spacing));
      const high = center.map((value) => Math.ceil((value + radius) / spacing));
      const levels = [
        { factor: levelFactors[0], spacing: spacing, color: minorColor, strength: 1 - transition },
        {
          factor: levelFactors[1],
          spacing: spacing * levelFactors[1],
          color: mixColor(majorColor, minorColor, transition),
          strength: 1,
        },
        { factor: levelFactors[2], spacing: spacing * levelFactors[2], color: majorColor, strength: transition },
      ];
      return {
        plane: plane,
        exponent: exponent,
        transition: transition,
        spacing: spacing,
        step: transition < 0.5 ? spacing : spacing * levelFactors[1],
        radius: radius,
        center: center,
        low: low,
        high: high,
        levels: levels,
        key: [plane, exponent, transition, low.join(','), high.join(',')].join('|'),
      };
    }

    function pushSegment(positions, colors, alongAxis, acrossAxis, acrossValue, fromValue, toValue, color) {
      const start = [0, 0, 0];
      const end = [0, 0, 0];
      start[alongAxis] = fromValue;
      end[alongAxis] = toValue;
      start[acrossAxis] = acrossValue;
      end[acrossAxis] = acrossValue;
      positions.push(start[0], start[1], start[2], end[0], end[1], end[2]);
      colors.push(color[0], color[1], color[2], color[0], color[1], color[2]);
    }

    function build(description, options) {
      const positions = [];
      const colors = [];
      if (!description || !Array.isArray(description.levels)) {
        return { positions: new Float32Array(0), colors: new Float32Array(0) };
      }
      const background = backgroundOrDefault(options && options.background);
      const axes = planeAxes[description.plane] || planeAxes.xz;
      const spacing = description.spacing;
      const low = description.low;
      const high = description.high;
      const levelIsVisible = description.levels.map((level) => level.strength > minimumStrength);
      description.levels.forEach((level, levelIndex) => {
          if (!levelIsVisible[levelIndex]) return;
          const color = mixColor(background, level.color, level.strength);
          const coarserLevelIsVisible = levelIsVisible[levelIndex + 1] === true;
          for (let axisSlot = 0; axisSlot < 2; axisSlot++) {
            const alongAxis = axes[axisSlot];
            const acrossAxis = axes[1 - axisSlot];
            const firstIndex = Math.ceil(low[1 - axisSlot] / level.factor);
            const lastIndex = Math.floor(high[1 - axisSlot] / level.factor);
            if (lastIndex - firstIndex + 1 > maximumLinesPerLevel) continue;
            for (let index = firstIndex; index <= lastIndex; index++) {
              if (index === 0) continue;
              if (coarserLevelIsVisible && index % levelFactors[1] === 0) continue;
              pushSegment(
                positions,
                colors,
                alongAxis,
                acrossAxis,
                index * level.spacing,
                low[axisSlot] * spacing,
                high[axisSlot] * spacing,
                color,
              );
            }
          }
      });
      for (let axisSlot = 0; axisSlot < 2; axisSlot++) {
        if (low[1 - axisSlot] > 0 || high[1 - axisSlot] < 0) continue;
        pushSegment(
          positions,
          colors,
          axes[axisSlot],
          axes[1 - axisSlot],
          0,
          low[axisSlot] * spacing,
          high[axisSlot] * spacing,
          axisColors[axes[axisSlot]],
        );
      }
      return { positions: Float32Array.from(positions), colors: Float32Array.from(colors) };
    }

    window.SynapseGridLevels = Object.freeze({ describe: describe, build: build });
})();
