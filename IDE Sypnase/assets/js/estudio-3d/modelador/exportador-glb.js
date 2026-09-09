'use strict';

const MOD3D_GLB_SAMPLER = Object.freeze({
    magFilter: 9729,
    minFilter: 9987,
    wrapS: 10497,
    wrapT: 10497,
});

function mod3dBuildGlbDocument(scene, resources) {
  if (!scene) return null;
  const binary = mod3dCreateGlbBinaryWriter();
  const appearance = mod3dCreateGlbMaterialWriter(binary, resources, scene.settings.textureMode);
  const meshes = [];
  let vertices = 0;
  let triangles = 0;
  let primitives = 0;
  const nodes = scene.nodes.map((node) => {
      const output = {
        name: node.name,
        translation: node.translation.slice(),
        rotation: node.rotation.slice(),
        scale: node.scale.slice(),
      };
      if (node.children.length) output.children = node.children.slice();
      if (!node.mesh) return output;
      const materialIndices = [];
      for (const group of mod3dValidateExportGroups(node.mesh, node.materials.length)) {
        if (materialIndices[group.material] === undefined)
        materialIndices[group.material] = appearance.registerMaterial(
          node.materials[group.material],
        );
      }
      const optimized = mod3dOptimizeGlbMesh(node.mesh, node.materials, materialIndices, node.pivot);
      const meshPrimitives = optimized.map((primitive) => {
          const attributes = {
            POSITION: binary.appendAccessor(primitive.positions, 'VEC3', 5126, primitive.bounds),
            NORMAL: binary.appendAccessor(primitive.normals, 'VEC3', 5126),
          };
          if (primitive.uv) attributes.TEXCOORD_0 = binary.appendAccessor(primitive.uv, 'VEC2', 5126);
          if (primitive.colors)
          attributes.COLOR_0 = binary.appendAccessor(primitive.colors, 'VEC3', 5126);
          const indices = binary.appendAccessor(primitive.indices, 'SCALAR', primitive.componentType);
          vertices += primitive.positions.length / 3;
          triangles += primitive.indices.length / 3;
          primitives++;
          return { attributes, indices, material: primitive.material, mode: 4 };
      });
      output.mesh = meshes.length;
      meshes.push({ name: node.name, primitives: meshPrimitives });
      return output;
  });
  const bin = binary.finish();
  const json = {
    asset: { version: '2.0', generator: 'Synapse Modeler glTF 2.0' },
    scene: 0,
    scenes: [{ name: 'Scene', nodes: scene.roots.slice() }],
    nodes,
    meshes,
    materials: appearance.materials,
    accessors: binary.accessors,
    bufferViews: binary.bufferViews,
    buffers: [{ byteLength: bin.length }],
  };
  if (appearance.images.length) {
    json.images = appearance.images;
    json.textures = appearance.textures;
    json.samplers = [{ ...MOD3D_GLB_SAMPLER }];
  }
  const expected = {
    version: 1,
    vertices,
    expandedVertices: scene.sourceVertices,
    triangles: scene.sourceVertices / 3,
    bounds: { min: scene.bounds.min.slice(), max: scene.bounds.max.slice() },
    materials: JSON.parse(JSON.stringify(json.materials)),
    nodes: JSON.parse(JSON.stringify(nodes)),
    roots: scene.roots.slice(),
    textures: appearance.textures.length,
  };
  if (triangles !== expected.triangles) throw new Error('Export changed the source triangle count');
  return {
    json,
    bin,
    expected,
    conversion: { metersPerUnit: scene.settings.metersPerUnit, upAxis: scene.settings.upAxis },
    dependencies: appearance.dependencies.slice(),
    vertices,
    triangulos: triangles,
    nos: nodes.length,
    malhas: meshes.length,
    materiais: appearance.materials.length,
    texturas: appearance.textures.length,
    dimensoes: scene.bounds.max.map((value, axis) => value - scene.bounds.min[axis]),
    primitives,
  };
}
