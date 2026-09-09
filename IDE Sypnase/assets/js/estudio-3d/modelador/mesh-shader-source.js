'use strict';

(function () {
    const vertexSource = [
      'attribute vec3 aPos;',
      'attribute vec3 aNormal;',
      'attribute vec2 aUv;',
      'attribute vec3 aTinta;',
      'uniform mat4 uProj;',
      'uniform mat4 uView;',
      'varying vec3 vWorldPosition;',
      'varying vec3 vWorldNormal;',
      'varying vec2 vTextureCoordinate;',
      'varying vec3 vVertexTint;',
      'void main() {',
      '  vWorldPosition = aPos;',
      '  vWorldNormal = aNormal;',
      '  vTextureCoordinate = aUv;',
      '  vVertexTint = aTinta;',
      '  gl_Position = uProj * uView * vec4(aPos, 1.0);',
      '}',
    ].join('\n');

    const fragmentDeclarations = [
      'precision mediump float;',
      'varying vec3 vWorldPosition;',
      'varying vec3 vWorldNormal;',
      'varying vec2 vTextureCoordinate;',
      'varying vec3 vVertexTint;',
      'uniform vec3 uCor;',
      'uniform vec3 uLuz;',
      'uniform vec3 uEyePosition;',
      'uniform float uOpacidade;',
      'uniform float uEmissao;',
      'uniform float uMetalness;',
      'uniform float uRoughness;',
      'uniform sampler2D uBaseColorMap;',
      'uniform sampler2D uMetalnessMap;',
      'uniform sampler2D uRoughnessMap;',
      'uniform sampler2D uNormalMap;',
      'uniform sampler2D uOcclusionMap;',
      'uniform sampler2D uEmissiveMap;',
      'uniform float uHasBaseColorMap;',
      'uniform float uHasMetalnessMap;',
      'uniform float uHasRoughnessMap;',
      'uniform float uHasNormalMap;',
      'uniform float uHasOcclusionMap;',
      'uniform float uHasEmissiveMap;',
    ];

    const normalMappingWithDerivatives = [
      'vec3 shadingNormalFromMap(vec3 orientedNormal) {',
      '  vec3 mapSample = texture2D(uNormalMap, vTextureCoordinate).rgb * 2.0 - 1.0;',
      '  vec3 positionAlongScreenX = dFdx(vWorldPosition);',
      '  vec3 positionAlongScreenY = dFdy(vWorldPosition);',
      '  vec2 coordinateAlongScreenX = dFdx(vTextureCoordinate);',
      '  vec2 coordinateAlongScreenY = dFdy(vTextureCoordinate);',
      '  float coordinateArea = coordinateAlongScreenX.x * coordinateAlongScreenY.y - coordinateAlongScreenY.x * coordinateAlongScreenX.y;',
      '  if (abs(coordinateArea) > 0.000001) {',
      '    vec3 rawTangent = positionAlongScreenX * coordinateAlongScreenY.y - positionAlongScreenY * coordinateAlongScreenX.y;',
      '    vec3 tangent = normalize(rawTangent - orientedNormal * dot(orientedNormal, rawTangent));',
      '    vec3 bitangent = normalize(cross(orientedNormal, tangent));',
      '    return normalize(mat3(tangent, bitangent, orientedNormal) * mapSample);',
      '  }',
      '  return orientedNormal;',
      '}',
    ];

    const normalMappingDisabled = [
      'vec3 shadingNormalFromMap(vec3 orientedNormal) {',
      '  return orientedNormal;',
      '}',
    ];

    const fragmentShading = [
      'void main() {',
      '  float normalLength = max(length(vWorldNormal), 0.0001);',
      '  vec3 geometryNormal = vWorldNormal / normalLength;',
      '  float faceSign = gl_FrontFacing ? 1.0 : -1.0;',
      '  vec3 orientedNormal = geometryNormal * faceSign;',
      '  vec3 shadingNormal = orientedNormal;',
      '  if (uHasNormalMap > 0.5) shadingNormal = shadingNormalFromMap(orientedNormal);',
      '  vec4 baseColorTexel = texture2D(uBaseColorMap, vTextureCoordinate);',
      '  float metalnessTexel = texture2D(uMetalnessMap, vTextureCoordinate).r;',
      '  float roughnessTexel = texture2D(uRoughnessMap, vTextureCoordinate).r;',
      '  float occlusionTexel = texture2D(uOcclusionMap, vTextureCoordinate).r;',
      '  vec3 emissiveTexel = texture2D(uEmissiveMap, vTextureCoordinate).rgb;',
      '  vec3 baseColor = uCor * vVertexTint;',
      '  baseColor = mix(baseColor, baseColor * baseColorTexel.rgb, uHasBaseColorMap);',
      '  float metalness = clamp(uMetalness * mix(1.0, metalnessTexel, uHasMetalnessMap), 0.0, 1.0);',
      '  float roughness = clamp(uRoughness * mix(1.0, roughnessTexel, uHasRoughnessMap), 0.06, 1.0);',
      '  float occlusion = mix(1.0, occlusionTexel, uHasOcclusionMap);',
      '  vec3 directionToEye = normalize(uEyePosition - vWorldPosition);',
      '  vec3 lightDirection = normalize(uLuz);',
      '  float lightAmount = max(dot(shadingNormal, lightDirection), 0.0);',
      '  float skyAmount = 0.5 + 0.5 * shadingNormal.y;',
      '  vec3 ambientColor = baseColor * mix(0.24, 0.44, skyAmount) * occlusion;',
      '  vec3 diffuseColor = baseColor * lightAmount * (1.0 - metalness * 0.85);',
      '  vec3 halfwayDirection = normalize(lightDirection + directionToEye);',
      '  float shininess = mix(180.0, 6.0, roughness);',
      '  float highlightAmount = pow(max(dot(shadingNormal, halfwayDirection), 0.0), shininess);',
      '  vec3 highlightTint = mix(vec3(0.04), baseColor, metalness);',
      '  vec3 specularColor = highlightTint * highlightAmount * mix(1.6, 0.25, roughness);',
      '  float facingEye = clamp(dot(shadingNormal, directionToEye), 0.0, 1.0);',
      '  float rimAmount = pow(1.0 - facingEye, 2.5) * 0.14 * (1.0 - roughness * 0.6);',
      '  vec3 emissiveColor = mix(baseColor, emissiveTexel, uHasEmissiveMap) * uEmissao;',
      '  vec3 shadedColor = ambientColor + diffuseColor + specularColor + emissiveColor + rimAmount;',
      '  float alpha = uOpacidade * mix(1.0, baseColorTexel.a, uHasBaseColorMap);',
      '  gl_FragColor = vec4(shadedColor, alpha);',
      '}',
    ];

    function createFragmentSource(options) {
      const settings = options || {};
      const extensionLines =
      settings.withDerivativesExtension === true
      ? ['#extension GL_OES_standard_derivatives : enable']
      : [];
      const normalLines =
      settings.withNormalMapping === true ? normalMappingWithDerivatives : normalMappingDisabled;
      return extensionLines
      .concat(fragmentDeclarations, normalLines, fragmentShading)
      .join('\n');
    }

    window.SynapseMeshShaderSource = Object.freeze({
        vertexSource: vertexSource,
        fragmentSource: createFragmentSource({}),
        createFragmentSource: createFragmentSource,
        attributeNames: Object.freeze(['aPos', 'aNormal', 'aUv', 'aTinta']),
        uniformNames: Object.freeze([
            'uProj',
            'uView',
            'uCor',
            'uLuz',
            'uEyePosition',
            'uOpacidade',
            'uEmissao',
            'uMetalness',
            'uRoughness',
            'uBaseColorMap',
            'uMetalnessMap',
            'uRoughnessMap',
            'uNormalMap',
            'uOcclusionMap',
            'uEmissiveMap',
            'uHasBaseColorMap',
            'uHasMetalnessMap',
            'uHasRoughnessMap',
            'uHasNormalMap',
            'uHasOcclusionMap',
            'uHasEmissiveMap',
        ]),
    });
})();
