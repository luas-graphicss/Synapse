(function (root) {
    'use strict';

    const UNKNOWN_VALUE = 'nao informado';

    function readText(getter) {
      try {
        const value = getter();
        return typeof value === 'string' ? value : '';
      } catch (error) {
        return '';
      }
    }

    function pageAddress() {
      return readText(() => root.location.href).split('#')[0] || UNKNOWN_VALUE;
    }

    function themeName() {
      const attributes = ['data-tema', 'data-theme'];
      for (const attribute of attributes) {
        const value = readText(() => document.documentElement.getAttribute(attribute));
        if (value) return value;
      }
      return UNKNOWN_VALUE;
    }

    function windowSize() {
      return `${root.innerWidth} x ${root.innerHeight}`;
    }

    function pixelDensity() {
      return String(root.devicePixelRatio || 1);
    }

    function timeZoneName() {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || UNKNOWN_VALUE;
      } catch (error) {
        return UNKNOWN_VALUE;
      }
    }

    function collect() {
      return [
        { label: 'Pagina', value: pageAddress() },
        { label: 'Tema ativo', value: themeName() },
        { label: 'Janela', value: windowSize() },
        { label: 'Densidade de pixel', value: pixelDensity() },
        { label: 'Idioma do navegador', value: readText(() => navigator.language) || UNKNOWN_VALUE },
        { label: 'Fuso horario', value: timeZoneName() },
        { label: 'Navegador', value: readText(() => navigator.userAgent) || UNKNOWN_VALUE },
        { label: 'Momento do relato', value: new Date().toISOString() },
      ];
    }

    root.SynapseBugReportEnvironment = Object.freeze({ collect });
})(typeof globalThis !== 'undefined' ? globalThis : window);
