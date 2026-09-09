'use strict';

const BLENDER_HIDDEN_LABEL_CLASS = 'blender-hidden-label';

function blenderTranslate(text) {
  if (typeof mod3dTexto === 'function') return mod3dTexto(text);
  return text;
}

function blenderHiddenLabel(text) {
  const label = document.createElement('span');
  label.className = BLENDER_HIDDEN_LABEL_CLASS;
  label.textContent = text;
  return label;
}

function blenderHeaderGroup(extraClass) {
  const group = document.createElement('div');
  group.className = extraClass ? `blender-header-group ${extraClass}` : 'blender-header-group';
  return group;
}

function blenderHeaderSeparator() {
  const separator = document.createElement('span');
  separator.className = 'blender-header-separator';
  return separator;
}

function blenderHeaderSpacer() {
  const spacer = document.createElement('span');
  spacer.className = 'blender-header-spacer';
  return spacer;
}

function blenderPrependIcon(element, iconName) {
  if (!element) return null;
  element.insertBefore(blenderIconSvg(iconName), element.firstChild);
  return element;
}

function blenderTurnButtonIntoIcon(button, iconName) {
  if (!button) return null;
  const text = button.textContent.trim();
  if (text && !button.title) button.title = text;
  if (text && !button.getAttribute('aria-label')) button.setAttribute('aria-label', text);
  button.textContent = '';
  button.appendChild(blenderIconSvg(iconName));
  if (text) button.appendChild(blenderHiddenLabel(text));
  button.classList.add('blender-icon-button');
  return button;
}

function blenderWrapWithIcon(element, iconName, wrapperClass) {
  if (!element) return null;
  const wrapper = document.createElement('div');
  wrapper.className = wrapperClass;
  const parent = element.parentElement;
  if (parent) parent.insertBefore(wrapper, element);
  wrapper.appendChild(blenderIconSvg(iconName));
  wrapper.appendChild(element);
  return wrapper;
}

function blenderHideControlText(control) {
  if (!control) return null;
  const text = control.querySelector('span');
  if (!text) return control;
  if (!control.title) control.title = text.textContent.trim();
  text.classList.add(BLENDER_HIDDEN_LABEL_CLASS);
  return control;
}
