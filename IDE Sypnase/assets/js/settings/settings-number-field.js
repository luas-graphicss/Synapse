(function (root) {
    'use strict';

    function clampToRange(value, minimum, maximum) {
      if (value < minimum) return minimum;
      if (value > maximum) return maximum;
      return value;
    }

    function snapToStep(value, minimum, step) {
      const stepCount = Math.round((value - minimum) / step);
      return minimum + stepCount * step;
    }

    function decimalPlaces(step) {
      const text = String(step);
      return text.includes('.') ? text.split('.')[1].length : 0;
    }

    function create(options) {
      const field = document.createElement('div');
      field.className = 'settings-number';
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'settings-number-input';
      input.spellcheck = false;
      input.setAttribute('aria-label', options.label);
      const unit = document.createElement('span');
      unit.className = 'settings-number-unit';
      unit.textContent = options.unit;
      const steppers = document.createElement('div');
      steppers.className = 'settings-number-steppers';
      let currentValue = options.value;

      function paintInput() {
        input.value = String(currentValue);
      }

      function commitValue(value) {
        const snapped = snapToStep(value, options.minimum, options.step);
        const limited = clampToRange(snapped, options.minimum, options.maximum);
        currentValue = Number(limited.toFixed(decimalPlaces(options.step)));
        paintInput();
        options.onChange(currentValue);
      }

      function createStepper(direction, label) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'settings-number-step';
        button.dataset.direction = direction;
        button.setAttribute('aria-label', label);
        button.addEventListener('click', () => {
            const offset = direction === 'up' ? options.step : -options.step;
            commitValue(currentValue + offset);
        });
        return button;
      }

      input.addEventListener('change', () => {
          const typedValue = Number(input.value.replace(',', '.'));
          if (Number.isFinite(typedValue)) commitValue(typedValue);
          else paintInput();
      });
      input.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') input.blur();
      });
      steppers.appendChild(createStepper('up', 'Aumentar'));
      steppers.appendChild(createStepper('down', 'Diminuir'));
      paintInput();
      field.appendChild(input);
      field.appendChild(unit);
      field.appendChild(steppers);
      return field;
    }

    root.SynapseSettingsNumberField = Object.freeze({ create });
})(typeof globalThis !== 'undefined' ? globalThis : window);
