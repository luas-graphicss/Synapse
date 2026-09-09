(function (root) {
    'use strict';

    const MISSING_CLASS = 'bug-report-control-missing';

    function createLabel(field, controlId, labels) {
      const label = document.createElement('label');
      label.className = 'bug-report-label';
      label.setAttribute('for', controlId);
      label.appendChild(document.createTextNode(field.label));
      if (!field.required) return label;
      const mark = document.createElement('span');
      mark.className = 'bug-report-required';
      mark.textContent = labels.requiredText;
      label.appendChild(mark);
      return label;
    }

    function createTextArea(field) {
      const control = document.createElement('textarea');
      control.rows = field.rows || 3;
      if (field.placeholder) control.placeholder = field.placeholder;
      return control;
    }

    function createSelect(field, labels) {
      const control = document.createElement('select');
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = labels.selectPlaceholderText;
      control.appendChild(placeholder);
      field.options.forEach((option) => {
          const item = document.createElement('option');
          item.value = option;
          item.textContent = option;
          control.appendChild(item);
      });
      return control;
    }

    function createTextInput(field) {
      const control = document.createElement('input');
      control.type = 'text';
      if (field.placeholder) control.placeholder = field.placeholder;
      return control;
    }

    function createControl(field, controlId, labels) {
      const control =
      field.type === 'textarea'
      ? createTextArea(field)
      : field.type === 'select'
      ? createSelect(field, labels)
      : createTextInput(field);
      control.id = controlId;
      control.name = field.name;
      control.className = 'bug-report-control';
      return control;
    }

    function createRow(field, index, labels) {
      const element = document.createElement('div');
      element.className = field.wide ? 'bug-report-row bug-report-row-wide' : 'bug-report-row';
      const controlId = `bugReportField${index}`;
      const control = createControl(field, controlId, labels);
      element.appendChild(createLabel(field, controlId, labels));
      element.appendChild(control);
      return { element, control };
    }

    function create(fields, labels) {
      const element = document.createElement('form');
      element.className = 'bug-report-form';
      element.noValidate = true;
      const controls = new Map();
      fields.forEach((field, index) => {
          const row = createRow(field, index, labels);
          controls.set(field.name, row.control);
          element.appendChild(row.element);
      });

      function values() {
        const result = {};
        controls.forEach((control, name) => {
            result[name] = control.value.trim();
        });
        return result;
      }

      function missingRequiredNames() {
        return fields
        .filter((field) => field.required && !controls.get(field.name).value.trim())
        .map((field) => field.name);
      }

      function markMissing(names) {
        controls.forEach((control, name) => {
            control.classList.toggle(MISSING_CLASS, names.includes(name));
        });
      }

      function focusControl(name) {
        const control = controls.get(name);
        if (control) control.focus();
      }

      function focusFirstControl() {
        if (fields.length) focusControl(fields[0].name);
      }

      return { element, values, missingRequiredNames, markMissing, focusControl, focusFirstControl };
    }

    root.SynapseBugReportForm = Object.freeze({ create });
})(typeof globalThis !== 'undefined' ? globalThis : window);
