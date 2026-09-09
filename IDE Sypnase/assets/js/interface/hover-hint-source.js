(function (root) {
    'use strict';

    const HINT_ATTRIBUTE = 'data-hint';
    const SHORTCUT_ATTRIBUTE = 'data-hint-shortcut';
    const SHORTCUT_IN_TEXT = /\s*[([]\s*((?:ctrl|cmd|alt|shift|⌘|⌥|⇧)[^)\]]*)[)\]]\s*$/i;
const HINTABLE_SELECTOR =
'[data-hint], [title], button, a[href], summary, input, select, textarea, [role="button"], [role="tab"], [role="switch"]';

function catalogHint(element) {
  return root.SynapseHoverHintCatalog?.hintFor(element) || '';
}

function adoptNativeTitle(element) {
  const title = element.getAttribute('title');
  if (title === null) return;
  element.removeAttribute('title');
  const trimmed = title.trim();
  if (trimmed && !element.hasAttribute(HINT_ATTRIBUTE))
  element.setAttribute(HINT_ATTRIBUTE, trimmed);
}

function storedHint(element) {
  adoptNativeTitle(element);
  const stored = element.getAttribute(HINT_ATTRIBUTE);
  if (stored !== null) return stored.trim();
  const discovered = catalogHint(element) || element.getAttribute('aria-label')?.trim() || '';
  element.setAttribute(HINT_ATTRIBUTE, discovered);
  return discovered;
}

function splitShortcut(element, text) {
  const declared = element.getAttribute(SHORTCUT_ATTRIBUTE)?.trim();
  if (declared) return { text, shortcut: declared };
  const match = text.match(SHORTCUT_IN_TEXT);
  if (!match) return { text, shortcut: '' };
  return { text: text.slice(0, match.index).trim(), shortcut: match[1].trim() };
}

function resolve(target) {
  const element = target?.closest?.(HINTABLE_SELECTOR);
  if (!element || element.hasAttribute('data-hint-off')) return null;
  const text = storedHint(element);
  if (!text) return null;
  return Object.assign({ element }, splitShortcut(element, text));
}

root.SynapseHoverHintSource = Object.freeze({ resolve, HINTABLE_SELECTOR });
})(typeof globalThis !== 'undefined' ? globalThis : window);
