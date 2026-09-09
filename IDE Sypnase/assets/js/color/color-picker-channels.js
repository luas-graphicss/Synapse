(function (root) {
    'use strict';

    const conversion = root.SynapseColorConversion;

    function copyColor(color) {
      return { hue: color.hue, saturation: color.saturation, value: color.value };
    }

    function copyChannels(channels) {
      return { red: channels.red, green: channels.green, blue: channels.blue };
    }

    function componentChannel(name, label, maximum) {
      return Object.freeze({
          name,
          label,
          maximum,
          read(color) {
            return color[name];
          },
          write(color, value) {
            const nextColor = copyColor(color);
            nextColor[name] = value;
            return nextColor;
          },
      });
    }

    function channelOfRed(name, label) {
      return Object.freeze({
          name,
          label,
          maximum: 255,
          read(color) {
            return conversion.hsvToRgb(color)[name];
          },
          write(color, value) {
            const nextChannels = copyChannels(conversion.hsvToRgb(color));
            nextChannels[name] = value;
            const nextColor = conversion.rgbToHsv(nextChannels);
            return {
              hue: nextColor.saturation === 0 ? color.hue : nextColor.hue,
              saturation: nextColor.saturation,
              value: nextColor.value,
            };
          },
      });
    }

    const list = Object.freeze([
        componentChannel('hue', 'H', 360),
        componentChannel('saturation', 'S', 100),
        componentChannel('value', 'V', 100),
        channelOfRed('red', 'R'),
        channelOfRed('green', 'G'),
        channelOfRed('blue', 'B'),
    ]);

    root.SynapseColorPickerChannels = Object.freeze({ list });
})(typeof globalThis !== 'undefined' ? globalThis : window);
