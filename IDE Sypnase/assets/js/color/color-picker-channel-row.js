(function (root) {
    'use strict';

    function createElement(tag, className, text) {
      const element = document.createElement(tag);
      if (className) element.className = className;
      if (text) element.textContent = text;
      return element;
    }

    function createTrack(channel) {
      const track = createElement('div', 'color-picker-channel-track');
      track.tabIndex = 0;
      track.setAttribute('role', 'slider');
      track.setAttribute('aria-label', channel.label);
      track.setAttribute('aria-valuemin', '0');
      track.setAttribute('aria-valuemax', String(channel.maximum));
      return track;
    }

    function createInput(channel) {
      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'color-picker-channel-input';
      input.min = '0';
      input.max = String(channel.maximum);
      input.step = '1';
      input.setAttribute('aria-label', channel.label);
      return input;
    }

    function create(channel) {
      const track = createTrack(channel);
      const thumb = createElement('span', 'color-picker-channel-thumb');
      track.appendChild(thumb);
      const input = createInput(channel);
      const row = createElement('div', 'color-picker-channel-row');
      row.appendChild(createElement('span', 'color-picker-channel-label', channel.label));
      row.appendChild(track);
      row.appendChild(input);
      return { channel, row, track, thumb, input };
    }

    root.SynapseColorPickerChannelRow = Object.freeze({ create });
})(typeof globalThis !== 'undefined' ? globalThis : window);
