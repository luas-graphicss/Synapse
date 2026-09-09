'use strict';

function mod3dValidateApiSchema(schema, value, path = 'arguments') {
  if (schema.type === 'object') {
    mod3dSourceAssert(
      value && typeof value === 'object' && !Array.isArray(value),
      `${path} must be an object`,
    );
    for (const required of schema.required || [])
    mod3dSourceAssert(Object.hasOwn(value, required), `${path}.${required} is required`);
    for (const [key, entry] of Object.entries(value)) {
      mod3dSourceAssert(
        Object.hasOwn(schema.properties || {}, key),
        `Unknown argument: ${path}.${key}`,
      );
      mod3dValidateApiSchema(schema.properties[key], entry, path + '.' + key);
    }
  } else if (schema.type === 'array') {
    mod3dSourceAssert(
      Array.isArray(value) &&
      value.length >= (schema.minItems || 0) &&
      value.length <= (schema.maxItems || 100),
      `${path} has an invalid length`,
    );
    value.forEach((entry, index) =>
      mod3dValidateApiSchema(schema.items, entry, `${path}[${index}]`),
    );
  } else if (schema.type === 'string') {
    mod3dSourceAssert(
      typeof value === 'string' &&
      value.length <= (schema.maxLength || 400) &&
      value.length >= (schema.minLength || 0),
      `${path} must be a bounded string`,
    );
  } else if (schema.type === 'boolean')
  mod3dSourceAssert(typeof value === 'boolean', `${path} must be boolean`);
  else if (schema.type === 'number' || schema.type === 'integer') {
    mod3dSourceAssert(
      typeof value === 'number' && Number.isFinite(value),
      `${path} must be finite`,
    );
    mod3dSourceAssert(
      schema.type !== 'integer' || Number.isInteger(value),
      `${path} must be an integer`,
    );
    if (schema.minimum !== undefined)
    mod3dSourceAssert(value >= schema.minimum, `${path} is below its minimum`);
    if (schema.maximum !== undefined)
    mod3dSourceAssert(value <= schema.maximum, `${path} exceeds its maximum`);
  }
  if (schema.enum)
  mod3dSourceAssert(schema.enum.includes(value), `${path} has an unsupported value`);
}

function mod3dValidateApiArguments(schema, args) {
  mod3dSourcePlainData(args);
  mod3dSourceAssert(
    new TextEncoder().encode(JSON.stringify(args)).length <= 16384,
    'Modeler arguments exceed 16 KiB',
  );
  mod3dValidateApiSchema(schema, args);
  mod3dApiIdentity(args);
  if (args.path !== undefined) mod3dModelerExportPath(args.path);
  if (args.sourcePath !== undefined) mod3dModelerProjectPath(args.sourcePath);
  if (args.material?.texture) mod3dModelerProjectPath(args.material.texture);
}
