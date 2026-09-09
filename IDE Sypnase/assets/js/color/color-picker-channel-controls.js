(function (root) {
    'use strict';

    const conversion = root.SynapseColorConversion;
    const drag = root.SynapseColorPickerDrag;
    const gradient = root.SynapseColorPickerChannelGradient;
    const SMALL_STEP = 1;
    const LARGE_STEP = 10;
    const KEY_DIRECTIONS = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 };

    function ratioFromPointer(event, element) {
      const bounds = element.getBoundingClientRect();
      return conversion.clamp((event.clientX - bounds.left) / bounds.width, 0, 1);
    }

    function writeValue(row, state, rawValue) {
      const value = conversion.clamp(rawValue, 0, row.channel.maximum);
      state.setColor(row.channel.write(state.getColor(), value));
    }

    function handleKeys(row, state, event) {
      const direction = KEY_DIRECTIONS[event.key];
      if (!direction) return;
      event.preventDefault();
      const step = event.shiftKey ? LARGE_STEP : SMALL_STEP;
      writeValue(row, state, row.channel.read(state.getColor()) + direction * step);
    }

    function connectRow(row, state) {
      drag.track(row.track, (event) => {
          writeValue(row, state, ratioFromPointer(event, row.track) * row.channel.maximum);
      });
      row.track.addEventListener('keydown', (event) => handleKeys(row, state, event));
      row.input.addEventListener('input', () => {
          const typedValue = Number(row.input.value);
          if (!Number.isFinite(typedValue)) return;
          writeValue(row, state, typedValue);
      });
    }

    function connect(rows, state) {
      rows.forEach((row) => connectRow(row, state));
    }

    function paintRow(row, color) {
      const value = row.channel.read(color);
      const ratio = value / row.channel.maximum;
      row.track.style.backgroundImage = gradient.build(row.channel.name, color);
      row.thumb.style.left = ratio * 100 + '%';
      row.track.setAttribute('aria-valuenow', String(Math.round(value)));
      if (document.activeElement !== row.input) row.input.value = String(Math.round(value));
    }

    function paint(rows, color) {
      rows.forEach((row) => paintRow(row, color));
    }

    root.SynapseColorPickerChannelControls = Object.freeze({ connect, paint });
})(typeof globalThis !== 'undefined' ? globalThis : window);
