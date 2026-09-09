(function (root) {
    'use strict';

    const STORAGE_KEY = 'synapse.settings.preferences';
    const defaults = root.SynapseSettingsDefaults.values;
    const listeners = new Set();
    let values = readStoredValues();

    function reportError(error, context) {
      if (typeof root.ignorarErro === 'function') root.ignorarErro(error, context);
    }

    function readStoredValues() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (!parsed || typeof parsed !== 'object') return { ...defaults };
        const merged = { ...defaults };
        for (const key of Object.keys(defaults)) {
          if (parsed[key] !== undefined) merged[key] = parsed[key];
        }
        return merged;
      } catch (error) {
        reportError(error, 'settings.read');
        return { ...defaults };
      }
    }

    function persist() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
      } catch (error) {
        reportError(error, 'settings.write');
      }
    }

    function notify() {
      const snapshot = { ...values };
      for (const listener of [...listeners]) {
        try {
          listener(snapshot);
        } catch (error) {
          reportError(error, 'settings.listener');
        }
      }
    }

    function get(key) {
      return values[key];
    }

    function all() {
      return { ...values };
    }

    function set(key, value) {
      if (!Object.prototype.hasOwnProperty.call(defaults, key)) return;
      if (values[key] === value) return;
      values[key] = value;
      persist();
      notify();
    }

    function reset() {
      values = { ...defaults };
      persist();
      notify();
    }

    function subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }

    root.SynapseSettingsStore = Object.freeze({ get, all, set, reset, subscribe });
})(typeof globalThis !== 'undefined' ? globalThis : window);
