'use strict';

(function () {
    const bindings = Object.freeze([
        Object.freeze({
            key: 'albedo',
            samplerName: 'uBaseColorMap',
            flagName: 'uHasBaseColorMap',
            unit: 0,
        }),
        Object.freeze({
            key: 'metalness',
            samplerName: 'uMetalnessMap',
            flagName: 'uHasMetalnessMap',
            unit: 1,
        }),
        Object.freeze({
            key: 'roughness',
            samplerName: 'uRoughnessMap',
            flagName: 'uHasRoughnessMap',
            unit: 2,
        }),
        Object.freeze({
            key: 'normal',
            samplerName: 'uNormalMap',
            flagName: 'uHasNormalMap',
            unit: 3,
        }),
        Object.freeze({
            key: 'occlusion',
            samplerName: 'uOcclusionMap',
            flagName: 'uHasOcclusionMap',
            unit: 4,
        }),
        Object.freeze({
            key: 'emissive',
            samplerName: 'uEmissiveMap',
            flagName: 'uHasEmissiveMap',
            unit: 5,
        }),
    ]);

    window.SynapseMaterialTextureMapBindings = Object.freeze({ bindings: bindings });
})();
