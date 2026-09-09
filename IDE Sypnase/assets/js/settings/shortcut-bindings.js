(function (root) {
    'use strict';

    const STORAGE_KEY = 'synapse.settings.shortcuts';
    const catalog = root.SynapseShortcutCatalog;
    const format = root.SynapseShortcutFormat;
    const FILE_NAVIGATION_IDS = ['files.nextFile', 'files.previousFile', 'files.closeFile'];
    const listeners = new Set();
    let overrides = readOverrides();

    function reportError(error, context) {
      if (typeof root.ignorarErro === 'function') root.ignorarErro(error, context);
    }

    function readOverrides() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (!parsed || typeof parsed !== 'object') return {};
        const cleaned = {};
        for (const shortcut of catalog.list()) {
          const value = parsed[shortcut.id];
          if (typeof value === 'string') cleaned[shortcut.id] = value;
        }
        return cleaned;
      } catch (error) {
        reportError(error, 'shortcuts.read');
        return {};
      }
    }

    function persist() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
      } catch (error) {
        reportError(error, 'shortcuts.write');
      }
    }

    function notify() {
      for (const listener of [...listeners]) {
        try {
          listener();
        } catch (error) {
          reportError(error, 'shortcuts.listener');
        }
      }
    }

    function isCustomized(identifier) {
      return Object.prototype.hasOwnProperty.call(overrides, identifier);
    }

    function bindingOf(identifier) {
      if (isCustomized(identifier)) return overrides[identifier];
      const shortcut = catalog.find(identifier);
      return shortcut ? shortcut.defaultBinding : '';
    }

    function list() {
      return catalog.list().map((shortcut) => ({
            ...shortcut,
            binding: bindingOf(shortcut.id),
            customized: isCustomized(shortcut.id),
      }));
    }

    function conflict(identifier, binding) {
      if (!binding) return null;
      return list().find((shortcut) => shortcut.id !== identifier && shortcut.binding === binding) || null;
    }

    function assign(identifier, binding) {
      if (!catalog.find(identifier)) return;
      overrides[identifier] = String(binding || '');
      persist();
      notify();
    }

    function clear(identifier) {
      if (!isCustomized(identifier)) return;
      delete overrides[identifier];
      persist();
      notify();
    }

    function resetAll() {
      overrides = {};
      persist();
      notify();
    }

    function resolve(event) {
      for (const shortcut of list()) {
        if (shortcut.binding && format.matchesEvent(shortcut.binding, event)) return shortcut;
      }
      return null;
    }

    function hasCustomFileNavigation() {
      return FILE_NAVIGATION_IDS.some(isCustomized);
    }

    function subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }

    root.SynapseShortcutBindings = Object.freeze({
        list,
        bindingOf,
        conflict,
        assign,
        clear,
        resetAll,
        resolve,
        hasCustomFileNavigation,
        subscribe,
    });
})(typeof globalThis !== 'undefined' ? globalThis : window);
