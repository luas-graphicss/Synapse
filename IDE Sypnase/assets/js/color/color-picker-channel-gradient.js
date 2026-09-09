(function (root) {
    'use strict';

    const conversion = root.SynapseColorConversion;
    const HUE_STEPS = 6;

    function hueStops() {
      const stops = [];
      for (let step = 0; step !== HUE_STEPS + 1; step += 1) {
        const hue = (step * 360) / HUE_STEPS;
        stops.push(conversion.hsvToHex({ hue, saturation: 100, value: 100 }));
      }
      return stops;
    }

    function saturationStops(color) {
      return [
        conversion.hsvToHex({ hue: color.hue, saturation: 0, value: color.value }),
        conversion.hsvToHex({ hue: color.hue, saturation: 100, value: color.value }),
      ];
    }

    function valueStops(color) {
      return [
        conversion.hsvToHex({ hue: color.hue, saturation: color.saturation, value: 0 }),
        conversion.hsvToHex({ hue: color.hue, saturation: color.saturation, value: 100 }),
      ];
    }

    function rgbStops(name, color) {
      const channels = conversion.hsvToRgb(color);
      const start = { red: channels.red, green: channels.green, blue: channels.blue };
      const end = { red: channels.red, green: channels.green, blue: channels.blue };
      start[name] = 0;
      end[name] = 255;
      return [conversion.rgbToHex(start), conversion.rgbToHex(end)];
    }

    const STOPS_BY_CHANNEL = {
      hue: hueStops,
      saturation: saturationStops,
      value: valueStops,
      red: (color) => rgbStops('red', color),
      green: (color) => rgbStops('green', color),
      blue: (color) => rgbStops('blue', color),
    };

    function build(channelName, color) {
      const stopsFor = STOPS_BY_CHANNEL[channelName];
      if (!stopsFor) return 'none';
      return 'linear-gradient(to right, ' + stopsFor(color).join(', ') + ')';
    }

    root.SynapseColorPickerChannelGradient = Object.freeze({ build });
})(typeof globalThis !== 'undefined' ? globalThis : window);
