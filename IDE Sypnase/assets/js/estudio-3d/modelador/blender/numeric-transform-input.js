'use strict';

const BLENDER_NUMERIC_FIELD_LIMIT = 3;

function blenderCreateNumericInput() {
  return { active: false, fields: ['', '', ''], index: 0 };
}

function blenderNumericInputAcceptsKey(key) {
  if (key.length === 1 && key >= '0' && key <= '9') return true;
  return key === '.' || key === ',' || key === '-' || key === 'Backspace' || key === 'Tab';
}

function blenderCopyNumericInput(input) {
  return { active: input.active, fields: input.fields.slice(), index: input.index };
}

function blenderNumericInputApplyKey(input, key) {
  const next = blenderCopyNumericInput(input);
  if (key === 'Tab') {
    next.index = (next.index + 1) % BLENDER_NUMERIC_FIELD_LIMIT;
    return next;
  }
  if (key === 'Backspace') {
    next.fields[next.index] = next.fields[next.index].slice(0, -1);
    next.active = next.fields.some((field) => field.length > 0);
    return next;
  }
  if (key === '-') {
    const current = next.fields[next.index];
    next.fields[next.index] = current.charAt(0) === '-' ? current.slice(1) : '-' + current;
    next.active = true;
    return next;
  }
  const character = key === ',' ? '.' : key;
  if (character === '.' && next.fields[next.index].indexOf('.') !== -1) return next;
  next.fields[next.index] = next.fields[next.index] + character;
  next.active = true;
  return next;
}

function blenderNumericInputIsActive(input) {
  return input.active === true;
}

function blenderNumericInputHasValue(input, index) {
  const field = input.fields[index];
  if (typeof field !== 'string') return false;
  if (!field.length) return false;
  return field !== '-' && field !== '.' && field !== '-.';
}

function blenderNumericInputValue(input, index, fallback) {
  if (!blenderNumericInputHasValue(input, index)) return fallback;
  const value = Number(input.fields[index]);
  return isFinite(value) ? value : fallback;
}

function blenderNumericInputText(input) {
  let last = input.index;
  for (let index = 0; index < BLENDER_NUMERIC_FIELD_LIMIT; index++) {
    if (input.fields[index].length > 0 && index > last) last = index;
  }
  return input.fields.slice(0, last + 1).join(', ');
}
