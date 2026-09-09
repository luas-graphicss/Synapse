(function (root) {
    'use strict';

    function clamp(value, minimum, maximum) {
      if (!Number.isFinite(value)) return minimum;
      return Math.min(maximum, Math.max(minimum, value));
    }

    function normalizeHex(value) {
      const text = String(value == null ? '' : value)
      .trim()
      .replace(/^#/, '');
      if (/^[0-9a-f]{3}$/i.test(text)) {
        const expanded = text
        .split('')
        .map((digit) => digit + digit)
        .join('');
        return '#' + expanded.toLowerCase();
      }
      if (/^[0-9a-f]{6}$/i.test(text)) return '#' + text.toLowerCase();
      return '';
    }

    function hexToRgb(value) {
      const hex = normalizeHex(value);
      if (!hex) return null;
      return {
        red: parseInt(hex.slice(1, 3), 16),
        green: parseInt(hex.slice(3, 5), 16),
        blue: parseInt(hex.slice(5, 7), 16),
      };
    }

    function channelToHex(channel) {
      return Math.round(clamp(channel, 0, 255)).toString(16).padStart(2, '0');
    }

    function rgbToHex(color) {
      return '#' + channelToHex(color.red) + channelToHex(color.green) + channelToHex(color.blue);
    }

    function rgbToHsv(color) {
      const red = clamp(color.red, 0, 255) / 255;
      const green = clamp(color.green, 0, 255) / 255;
      const blue = clamp(color.blue, 0, 255) / 255;
      const maximum = Math.max(red, green, blue);
      const minimum = Math.min(red, green, blue);
      const span = maximum - minimum;
      let hue = 0;
      if (span > 0) {
        if (maximum === red) hue = ((green - blue) / span) % 6;
        else if (maximum === green) hue = (blue - red) / span + 2;
        else hue = (red - green) / span + 4;
        hue *= 60;
        if (hue < 0) hue += 360;
      }
      return {
        hue,
        saturation: maximum === 0 ? 0 : (span / maximum) * 100,
        value: maximum * 100,
      };
    }

    function hsvToRgb(color) {
      const hue = (((color.hue % 360) + 360) % 360) / 60;
      const saturation = clamp(color.saturation, 0, 100) / 100;
      const value = clamp(color.value, 0, 100) / 100;
      const chroma = value * saturation;
      const secondary = chroma * (1 - Math.abs((hue % 2) - 1));
      const base = value - chroma;
      const sectors = [
        [chroma, secondary, 0],
        [secondary, chroma, 0],
        [0, chroma, secondary],
        [0, secondary, chroma],
        [secondary, 0, chroma],
        [chroma, 0, secondary],
      ];
      const channels = sectors[Math.floor(hue) % 6];
      return {
        red: (channels[0] + base) * 255,
        green: (channels[1] + base) * 255,
        blue: (channels[2] + base) * 255,
      };
    }

    function hexToHsv(value) {
      const rgb = hexToRgb(value);
      return rgb ? rgbToHsv(rgb) : null;
    }

    function hsvToHex(color) {
      return rgbToHex(hsvToRgb(color));
    }

    function channelLuminance(channel) {
      const ratio = clamp(channel, 0, 255) / 255;
      return ratio <= 0.03928 ? ratio / 12.92 : Math.pow((ratio + 0.055) / 1.055, 2.4);
    }

    function relativeLuminance(color) {
      return (
        0.2126 * channelLuminance(color.red) +
        0.7152 * channelLuminance(color.green) +
        0.0722 * channelLuminance(color.blue)
      );
    }

    root.SynapseColorConversion = Object.freeze({
        clamp,
        normalizeHex,
        hexToRgb,
        rgbToHex,
        rgbToHsv,
        hsvToRgb,
        hexToHsv,
        hsvToHex,
        relativeLuminance,
    });
})(typeof globalThis !== 'undefined' ? globalThis : window);
