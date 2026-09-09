(function (root) {
    'use strict';

    const conversion = root.SynapseColorConversion;
    const layout = root.SynapseColorPickerLayout;
    const pickerWindow = root.SynapseColorPickerWindow;
    const drag = root.SynapseColorPickerDrag;
    const recentColors = root.SynapseRecentColors;
    const channelControls = root.SynapseColorPickerChannelControls;
    const DIALOG_ID = 'colorPickerDialog';
    const DEFAULT_TITLE = 'Selecionar cor';
    const DEFAULT_COLOR = '#6aa3ff';
    const SWATCH_SLOTS = 8;
    const SMALL_STEP = 1;
    const LARGE_STEP = 10;

    let parts = null;
    let color = { hue: 217, saturation: 60, value: 100 };
    let initialColorHex = DEFAULT_COLOR;
    let previewHandler = null;
    let commitHandler = null;
    let dialogOpen = false;

    function reportError(error, source) {
      if (typeof root.ignorarErro === 'function') root.ignorarErro(error, source);
    }

    function currentHex() {
      return conversion.hsvToHex(color);
    }

    function writeInput(input, text) {
      if (document.activeElement !== input) input.value = text;
    }

    function paint() {
      const hex = currentHex();
      parts.field.style.setProperty('--color-picker-hue', String(Math.round(color.hue)));
      parts.fieldCursor.style.left = color.saturation + '%';
      parts.fieldCursor.style.top = 100 - color.value + '%';
      parts.fieldCursor.style.background = hex;
      parts.hueCursor.style.top = (color.hue / 360) * 100 + '%';
      parts.hue.setAttribute('aria-valuenow', String(Math.round(color.hue)));
      parts.resultSwatch.style.background = hex;
      writeInput(parts.hexInput, hex.toUpperCase());
      channelControls.paint(parts.channelRows, color);
    }

    function setColor(nextColor, options) {
      color = {
        hue: conversion.clamp(nextColor.hue, 0, 360),
        saturation: conversion.clamp(nextColor.saturation, 0, 100),
        value: conversion.clamp(nextColor.value, 0, 100),
      };
      paint();
      const silent = Boolean(options && options.silent);
      if (!silent && previewHandler) previewHandler(currentHex());
    }

    function setHex(hex, options) {
      const normalized = conversion.normalizeHex(hex);
      if (!normalized) return;
      const nextColor = conversion.hexToHsv(normalized);
      const keepsCurrentHue = nextColor.saturation === 0;
      setColor(
        {
          hue: keepsCurrentHue ? color.hue : nextColor.hue,
          saturation: nextColor.saturation,
          value: nextColor.value,
        },
        options,
      );
    }

    function ratioFromPointer(event, element) {
      const bounds = element.getBoundingClientRect();
      return {
        horizontal: conversion.clamp((event.clientX - bounds.left) / bounds.width, 0, 1),
        vertical: conversion.clamp((event.clientY - bounds.top) / bounds.height, 0, 1),
      };
    }

    function applyFieldPointer(event) {
      const ratio = ratioFromPointer(event, parts.field);
      setColor({
          hue: color.hue,
          saturation: ratio.horizontal * 100,
          value: (1 - ratio.vertical) * 100,
      });
    }

    function applyHuePointer(event) {
      const ratio = ratioFromPointer(event, parts.hue);
      setColor({ hue: ratio.vertical * 360, saturation: color.saturation, value: color.value });
    }

    function stepFromEvent(event) {
      return event.shiftKey ? LARGE_STEP : SMALL_STEP;
    }

    function handleFieldKeys(event) {
      const step = stepFromEvent(event);
      const moves = {
        ArrowLeft: { saturation: color.saturation - step, value: color.value },
        ArrowRight: { saturation: color.saturation + step, value: color.value },
        ArrowUp: { saturation: color.saturation, value: color.value + step },
        ArrowDown: { saturation: color.saturation, value: color.value - step },
      };
      const move = moves[event.key];
      if (!move) return;
      event.preventDefault();
      setColor({ hue: color.hue, saturation: move.saturation, value: move.value });
    }

    function handleHueKeys(event) {
      const step = stepFromEvent(event);
      const moves = {
        ArrowUp: color.hue - step,
        ArrowLeft: color.hue - step,
        ArrowDown: color.hue + step,
        ArrowRight: color.hue + step,
      };
      const nextHue = moves[event.key];
      if (nextHue === undefined) return;
      event.preventDefault();
      setColor({ hue: nextHue, saturation: color.saturation, value: color.value });
    }

    function readHexInput() {
      setHex(parts.hexInput.value);
    }

    function createSwatchButton(hex) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'color-picker-swatch';
      button.style.background = hex;
      button.title = hex.toUpperCase();
      button.setAttribute('aria-label', 'Usar a cor ' + hex.toUpperCase());
      button.addEventListener('click', () => setHex(hex));
      return button;
    }

    function createEmptySwatch() {
      const slot = document.createElement('span');
      slot.className = 'color-picker-swatch color-picker-swatch-empty';
      return slot;
    }

    function paintSwatches() {
      const colors = recentColors.list().slice(0, SWATCH_SLOTS);
      parts.swatchList.replaceChildren();
      colors.forEach((hex) => parts.swatchList.appendChild(createSwatchButton(hex)));
      for (let slot = colors.length; slot !== SWATCH_SLOTS; slot += 1) {
        parts.swatchList.appendChild(createEmptySwatch());
      }
    }

    async function pickFromScreen() {
      if (typeof root.EyeDropper !== 'function') return;
      try {
        const picked = await new root.EyeDropper().open();
        setHex(picked.sRGBHex);
      } catch (error) {
        reportError(error, 'colorPicker.eyedropper');
      }
    }

    function handleOutsidePointer(event) {
      if (parts.element.contains(event.target)) return;
      cancel();
    }

    function handleKeys(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        cancel();
        return;
      }
      if (event.key === 'Enter' && parts.element.contains(document.activeElement)) {
        event.preventDefault();
        commit();
      }
    }

    function handleResize() {
      pickerWindow.keepInsideScreen(parts.element);
    }

    function build() {
      parts = layout.create();
      parts.element.id = DIALOG_ID;
      document.body.appendChild(parts.element);
      pickerWindow.enableDragging(parts.element, parts.handle);
      drag.track(parts.field, applyFieldPointer);
      drag.track(parts.hue, applyHuePointer);
      parts.field.addEventListener('keydown', handleFieldKeys);
      parts.hue.addEventListener('keydown', handleHueKeys);
      parts.hexInput.addEventListener('input', readHexInput);
      channelControls.connect(parts.channelRows, {
          getColor: () => color,
          setColor: (nextColor) => setColor(nextColor),
      });
      parts.initialSwatch.addEventListener('click', () => setHex(initialColorHex));
      parts.eyedropperButton.addEventListener('click', pickFromScreen);
      parts.closeButton.addEventListener('click', cancel);
      parts.cancelButton.addEventListener('click', cancel);
      parts.applyButton.addEventListener('click', commit);
      parts.element.addEventListener('click', (event) => event.stopPropagation());
    }

    function listenWhileOpen() {
      root.setTimeout(() => {
          if (!dialogOpen) return;
          document.addEventListener('pointerdown', handleOutsidePointer, true);
        }, 0);
      document.addEventListener('keydown', handleKeys, true);
      root.addEventListener('resize', handleResize);
    }

    function stopListening() {
      document.removeEventListener('pointerdown', handleOutsidePointer, true);
      document.removeEventListener('keydown', handleKeys, true);
      root.removeEventListener('resize', handleResize);
    }

    function open(options) {
      const settings = options || {};
      if (!parts) build();
      const anchor = settings.anchor;
      const anchorBounds =
      anchor && typeof anchor.getBoundingClientRect === 'function'
      ? anchor.getBoundingClientRect()
      : null;
      previewHandler = typeof settings.preview === 'function' ? settings.preview : null;
      commitHandler = typeof settings.commit === 'function' ? settings.commit : null;
      parts.title.textContent = settings.title || DEFAULT_TITLE;
      initialColorHex = conversion.normalizeHex(settings.color) || DEFAULT_COLOR;
      parts.initialSwatch.style.background = initialColorHex;
      parts.eyedropperButton.hidden = typeof root.EyeDropper !== 'function';
      parts.element.hidden = false;
      dialogOpen = true;
      setHex(initialColorHex, { silent: true });
      paintSwatches();
      pickerWindow.placeNear(parts.element, anchorBounds);
      listenWhileOpen();
      parts.hexInput.focus({ preventScroll: true });
      parts.hexInput.select();
    }

    function close() {
      if (!dialogOpen) return;
      dialogOpen = false;
      parts.element.hidden = true;
      stopListening();
    }

    function commit() {
      if (!dialogOpen) return;
      const hex = currentHex();
      const handler = commitHandler;
      recentColors.remember(hex);
      close();
      if (handler) handler(hex);
    }

    function cancel() {
      if (!dialogOpen) return;
      const handler = previewHandler;
      const restoredHex = initialColorHex;
      close();
      if (handler) handler(restoredHex);
    }

    function isOpen() {
      return dialogOpen;
    }

    root.SynapseColorPicker = Object.freeze({ open, close, isOpen });
})(typeof globalThis !== 'undefined' ? globalThis : window);
