(function (root) {
    'use strict';

    const channels = root.SynapseColorPickerChannels;
    const channelRow = root.SynapseColorPickerChannelRow;
    const eyedropperIcon = root.SynapseColorPickerEyedropperIcon;
    const DEFAULT_TITLE = 'Selecionar cor';
    const CHANNEL_DIVIDER_INDEX = 3;

    function createElement(tag, className, text) {
      const element = document.createElement(tag);
      if (className) element.className = className;
      if (text) element.textContent = text;
      return element;
    }

    function createButton(className, label) {
      const button = createElement('button', className, label);
      button.type = 'button';
      return button;
    }

    function createTitleBar() {
      const label = createElement('span', 'color-picker-title', DEFAULT_TITLE);
      const handle = createElement('div', 'color-picker-handle');
      handle.appendChild(label);
      const closeButton = createButton('color-picker-close');
      if (typeof root.iconSvg === 'function') {
        closeButton.innerHTML = root.iconSvg('close', 'color-picker-icon');
      } else {
        closeButton.textContent = '\u00d7';
      }
      closeButton.title = 'Fechar';
      closeButton.setAttribute('aria-label', 'Fechar seletor de cor');
      const bar = createElement('div', 'color-picker-titlebar');
      bar.appendChild(handle);
      bar.appendChild(closeButton);
      return { bar, handle, label, closeButton };
    }

    function createStage() {
      const field = createElement('div', 'color-picker-field');
      field.tabIndex = 0;
      field.setAttribute('role', 'application');
      field.setAttribute('aria-label', 'Saturacao e brilho');
      const fieldCursor = createElement('span', 'color-picker-field-cursor');
      field.appendChild(fieldCursor);
      const hue = createElement('div', 'color-picker-hue');
      hue.tabIndex = 0;
      hue.setAttribute('role', 'slider');
      hue.setAttribute('aria-label', 'Matiz');
      hue.setAttribute('aria-valuemin', '0');
      hue.setAttribute('aria-valuemax', '360');
      const hueCursor = createElement('span', 'color-picker-hue-cursor');
      hue.appendChild(hueCursor);
      const stage = createElement('div', 'color-picker-stage');
      stage.appendChild(field);
      stage.appendChild(hue);
      return { stage, field, fieldCursor, hue, hueCursor };
    }

    function createPreview() {
      const marks = createElement('div', 'color-picker-preview-marks');
      marks.appendChild(createElement('span', 'color-picker-preview-mark', 'nova'));
      marks.appendChild(createElement('span', 'color-picker-preview-mark', 'atual'));
      const resultSwatch = createElement('span', 'color-picker-preview-result');
      const initialSwatch = createButton('color-picker-preview-initial');
      initialSwatch.title = 'Voltar para a cor atual';
      initialSwatch.setAttribute('aria-label', 'Voltar para a cor atual');
      const stack = createElement('div', 'color-picker-preview-stack');
      stack.appendChild(resultSwatch);
      stack.appendChild(initialSwatch);
      const eyedropperButton = createButton('color-picker-tool');
      eyedropperButton.appendChild(eyedropperIcon.create('color-picker-icon'));
      eyedropperButton.title = 'Capturar uma cor da tela';
      eyedropperButton.setAttribute('aria-label', 'Capturar uma cor da tela');
      const preview = createElement('div', 'color-picker-preview');
      preview.appendChild(marks);
      preview.appendChild(stack);
      preview.appendChild(eyedropperButton);
      return { preview, initialSwatch, resultSwatch, eyedropperButton };
    }

    function createHexRow() {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'color-picker-hex-input';
      input.spellcheck = false;
      input.maxLength = 7;
      input.setAttribute('aria-label', 'Codigo hexadecimal');
      const row = createElement('label', 'color-picker-hex');
      row.appendChild(createElement('span', 'color-picker-hex-label', 'Hex'));
      row.appendChild(input);
      return { row, input };
    }

    function createChannels() {
      const rows = channels.list.map((channel) => channelRow.create(channel));
      const group = createElement('div', 'color-picker-channels');
      rows.forEach((row, index) => {
          if (index === CHANNEL_DIVIDER_INDEX) {
            group.appendChild(createElement('div', 'color-picker-divider'));
          }
          group.appendChild(row.row);
      });
      return { group, rows };
    }

    function createSwatches() {
      const list = createElement('div', 'color-picker-swatches');
      const section = createElement('div', 'color-picker-section');
      section.appendChild(createElement('span', 'color-picker-section-label', 'Recentes'));
      section.appendChild(list);
      return { section, list };
    }

    function createFooter() {
      const cancelButton = createButton('color-picker-action', 'Cancelar');
      const applyButton = createButton('color-picker-action color-picker-action-primary', 'OK');
      const footer = createElement('div', 'color-picker-footer');
      footer.appendChild(cancelButton);
      footer.appendChild(applyButton);
      return { footer, cancelButton, applyButton };
    }

    function create() {
      const element = createElement('div', 'color-picker');
      element.hidden = true;
      element.setAttribute('role', 'dialog');
      element.setAttribute('aria-label', DEFAULT_TITLE);
      const titleBar = createTitleBar();
      const stage = createStage();
      const preview = createPreview();
      const hex = createHexRow();
      const channelGroup = createChannels();
      const swatches = createSwatches();
      const footer = createFooter();
      const body = createElement('div', 'color-picker-body');
      body.appendChild(stage.stage);
      body.appendChild(preview.preview);
      body.appendChild(hex.row);
      body.appendChild(channelGroup.group);
      body.appendChild(swatches.section);
      element.appendChild(titleBar.bar);
      element.appendChild(body);
      element.appendChild(footer.footer);
      return {
        element,
        handle: titleBar.handle,
        title: titleBar.label,
        closeButton: titleBar.closeButton,
        field: stage.field,
        fieldCursor: stage.fieldCursor,
        hue: stage.hue,
        hueCursor: stage.hueCursor,
        initialSwatch: preview.initialSwatch,
        resultSwatch: preview.resultSwatch,
        eyedropperButton: preview.eyedropperButton,
        hexInput: hex.input,
        channelRows: channelGroup.rows,
        swatchList: swatches.list,
        cancelButton: footer.cancelButton,
        applyButton: footer.applyButton,
      };
    }

    root.SynapseColorPickerLayout = Object.freeze({ create });
})(typeof globalThis !== 'undefined' ? globalThis : window);
