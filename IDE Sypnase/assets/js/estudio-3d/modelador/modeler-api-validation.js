'use strict';

const MOD3D_API_PRIMITIVES = Object.freeze({
    cube: 'cubo',
    sphere: 'esfera',
    cylinder: 'cilindro',
    cone: 'cone',
    plane: 'plano',
    torus: 'toro',
    ramp: 'rampa',
    group: 'grupo',
});
const MOD3D_API_PARAMETERS = Object.freeze({
    width: 'largura',
    height: 'altura',
    depth: 'profundidade',
    radius: 'raio',
    tube: 'tubo',
    segments: 'segmentos',
    rings: 'aneis',
});
const MOD3D_API_OPERATIONS = Object.freeze([
    'transform',
    'parameters',
    'duplicate',
    'delete',
    'extrude',
    'inset',
    'bevel',
    'subdivide',
    'mirror',
    'merge',
    'shade',
    'uv',
    'undo',
    'redo',
]);

function mod3dApiNumber(value, minimum, maximum, label) {
  mod3dSourceAssert(
    typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum,
    `Invalid ${label}: expected ${minimum} to ${maximum}`,
  );
  return value;
}

function mod3dApiVector(value, minimum, maximum, label) {
  mod3dSourceAssert(Array.isArray(value) && value.length === 3, `${label} requires three numbers`);
  return value.map((number) => mod3dApiNumber(number, minimum, maximum, label));
}

function mod3dApiName(value, fallback = '') {
  if (value === undefined) return fallback;
  mod3dSourceAssert(
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= 48 &&
    !/[\u0000-\u001f]/.test(value),
    'Name must contain 1 to 48 readable characters',
  );
  return value.trim();
}

function mod3dApiParameters(type, parameters = {}) {
  mod3dSourceAssert(
    parameters && typeof parameters === 'object' && !Array.isArray(parameters),
    'Invalid primitive parameters',
  );
  const fields = MOD3D_PRIMITIVAS[type] ? MOD3D_PRIMITIVAS[type].campos : [];
  const result = {};
  for (const [key, value] of Object.entries(parameters)) {
    const field = fields.find((item) => item.chave === MOD3D_API_PARAMETERS[key]);
    mod3dSourceAssert(field, `Unsupported parameter: ${key}`);
    const integer = field.tipo !== 'medida';
    result[field.chave] = mod3dApiNumber(
      value,
      integer ? (field.tipo === 'aneis' ? 2 : 3) : 0.001,
      integer ? 96 : 1000,
      key,
    );
    mod3dSourceAssert(!integer || Number.isInteger(value), `${key} must be an integer`);
  }
  return result;
}

function mod3dApiTransform(node, values) {
  for (const [key, property] of [
      ['position', 'pos'],
      ['rotation', 'rot'],
      ['scale', 'esc'],
      ['pivot', 'pivo'],
  ]) {
    if (values[key] === undefined) continue;
    const maximum = key === 'scale' ? 1000 : 100000;
    const vector = mod3dApiVector(values[key], -maximum, maximum, key);
    mod3dSourceAssert(
      key !== 'scale' || vector.every((value) => Math.abs(value) >= 0.001),
      'Scale cannot be zero or smaller than 0.001',
    );
    node[property] = vector;
  }
  if (values.name !== undefined) node.nome = mod3dApiName(values.name);
  mod3dMarcarNoSujo(node);
}

function mod3dApiSelectFaces(mesh, selection = 'all') {
  const directions = {
    top: [0, 1, 0],
    bottom: [0, -1, 0],
    left: [-1, 0, 0],
    right: [1, 0, 0],
    front: [0, 0, 1],
    back: [0, 0, -1],
  };
  mod3dSourceAssert(
    selection === 'all' || Object.hasOwn(directions, selection),
    'Unknown face selection',
  );
  const selected = new Set();
  mesh.faces.forEach((face, index) => {
      if (!face) return;
      if (selection === 'all') {
        selected.add(index);
        return;
      }
      const points = face.slice(0, 3).map((vertex) => mod3dMalhaEdPonto(mesh, vertex));
      const normal = mod3dNormalDaFace(...points);
      const direction = directions[selection];
      if (normal.reduce((sum, component, axis) => sum + component * direction[axis], 0) > 0.5)
      selected.add(index);
  });
  mod3dSourceAssert(selected.size > 0, 'No faces match the requested direction');
  return selected;
}
