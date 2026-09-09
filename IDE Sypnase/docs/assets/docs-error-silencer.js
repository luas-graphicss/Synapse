(function (root) {
    'use strict';

    if (typeof root.ignorarErro === 'function') return;

    root.ignorarErro = function ignorarErro() {};
})(typeof globalThis !== 'undefined' ? globalThis : window);
