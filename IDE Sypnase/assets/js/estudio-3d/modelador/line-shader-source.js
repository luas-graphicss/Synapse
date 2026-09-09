'use strict';

(function () {
    const vertexSource = [
      'attribute vec3 aPos;',
      'attribute vec3 aCor;',
      'uniform mat4 uProj;',
      'uniform mat4 uView;',
      'varying vec3 vLineColor;',
      'varying vec3 vWorldPosition;',
      'void main() {',
      '  vLineColor = aCor;',
      '  vWorldPosition = aPos;',
      '  gl_Position = uProj * uView * vec4(aPos, 1.0);',
      '}',
    ].join('\n');

    const fragmentSource = [
      'precision mediump float;',
      'varying vec3 vLineColor;',
      'varying vec3 vWorldPosition;',
      'uniform vec3 uFogColor;',
      'uniform vec3 uFogCenter;',
      'uniform float uFogStart;',
      'uniform float uFogEnd;',
      'void main() {',
      '  float fogAmount = 0.0;',
      '  if (uFogEnd > uFogStart) {',
      '    float distanceToCenter = distance(vWorldPosition, uFogCenter);',
      '    fogAmount = smoothstep(uFogStart, uFogEnd, distanceToCenter);',
      '  }',
      '  gl_FragColor = vec4(mix(vLineColor, uFogColor, fogAmount), 1.0);',
      '}',
    ].join('\n');

    window.SynapseLineShaderSource = Object.freeze({
        vertexSource: vertexSource,
        fragmentSource: fragmentSource,
        attributeNames: Object.freeze(['aPos', 'aCor']),
        uniformNames: Object.freeze(['uProj', 'uView', 'uFogColor', 'uFogCenter', 'uFogStart', 'uFogEnd']),
    });
})();
