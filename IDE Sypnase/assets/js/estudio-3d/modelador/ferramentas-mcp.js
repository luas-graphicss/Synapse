'use strict';

(function registerModelerTools() {
    const vector = { type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 3 };
    const parameters = {
      type: 'object',
      additionalProperties: false,
      properties: Object.fromEntries(
        ['width', 'height', 'depth', 'radius', 'tube', 'segments', 'rings'].map((key) => [
            key,
            { type: 'number' },
        ]),
      ),
    };
    const selection = {
      type: 'string',
      enum: ['all', 'top', 'bottom', 'left', 'right', 'front', 'back'],
      description: 'Faces selected by local normal direction; defaults to all.',
    };
    const transform = {
      name: { type: 'string', maxLength: 48 },
      position: vector,
      rotation: vector,
      scale: vector,
      pivot: vector,
    };
    const definitions = [
      [
        'modeler_create_scene',
        'Create editable 3D scene',
        'create',
        'Create a persistent, agent-owned editable scene without opening a popup. Optionally copy a project model with editable source. Returns sceneId; keep it for subsequent calls.',
        {
          sourcePath: {
            type: 'string',
            description: 'Existing .model3d.json or .glb with linked editable source.',
          },
        },
        [],
      ],
      [
        'modeler_add_primitive',
        'Add 3D primitive',
        'primitive',
        'Add a parametric primitive or group. Dimensions and position are meters; rotation is degrees. Returns nodeId. Uses the same mesh engine as the modeler UI.',
        {
          ...transform,
          primitive: {
            type: 'string',
            enum: ['cube', 'sphere', 'cylinder', 'cone', 'plane', 'torus', 'ramp', 'group'],
          },
          parameters,
          parentId: { type: 'string' },
        },
        ['sceneId', 'primitive'],
      ],
      [
        'modeler_edit_mesh',
        'Edit 3D mesh',
        'mesh',
        'High-level mesh editing with undo/redo. Select faces by local direction. extrude/bevel/merge use amount in meters; inset uses 0.01–0.9; shade uses angle in degrees. Mesh edits replace primitive parameters. Each call is atomic and autosaved.',
        {
          ...transform,
          nodeId: { type: 'string' },
          operation: {
            type: 'string',
            enum: [
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
            ],
          },
          parameters,
          selection,
          amount: { type: 'number' },
          axis: { type: 'string', enum: ['x', 'y', 'z'] },
          weld: { type: 'boolean' },
          shading: { type: 'string', enum: ['flat', 'smooth', 'angle'] },
          projection: {
            type: 'string',
            enum: ['planar', 'cubic', 'cylindrical', 'spherical', 'unwrap'],
          },
        },
        ['sceneId', 'operation'],
      ],
      [
        'modeler_apply_material',
        'Apply 3D material',
        'material',
        'Apply PBR material to an object or directional face selection. Texture is a relative image path already in this project; no uploads/downloads. Colors, metalness, roughness, emission and opacity are 0–1.',
        {
          nodeId: { type: 'string' },
          slot: { type: 'integer', minimum: 0, maximum: 11 },
          selection,
          material: {
            type: 'object',
            additionalProperties: false,
            properties: {
              name: { type: 'string', maxLength: 40 },
              color: vector,
              metalness: { type: 'number' },
              roughness: { type: 'number' },
              emission: { type: 'number' },
              opacity: { type: 'number' },
              doubleSided: { type: 'boolean' },
              texture: { type: 'string' },
              embed: { type: 'boolean' },
            },
          },
        },
        ['sceneId', 'nodeId', 'material'],
      ],
      [
        'modeler_export',
        'Save editable model to project',
        'export',
        'WRITE: validate and save GLB plus editable source and metadata through the project writer. Existing paths require explicit overwrite:true and a previous-byte backup. Subject to user AI write approval and team permissions, including aurora.3d.json and .modeler-backups/.',
        {
          path: { type: 'string', description: 'Exact relative destination ending in .glb.' },
          overwrite: { type: 'boolean', default: false },
          includeSource: { type: 'boolean', default: true },
          textureMode: { type: 'string', enum: ['embed', 'reference'], default: 'embed' },
        },
        ['sceneId', 'path'],
      ],
      [
        'modeler_get_scene',
        'Read editable scene state',
        'state',
        'Read nodes, parameters and revision. Omit sceneId to list this agent’s locally saved scenes in the explicit project. Does not replace the user’s live scene.',
        {
          offset: { type: 'integer', minimum: 0, maximum: 400 },
          limit: { type: 'integer', minimum: 1, maximum: 100 },
        },
        [],
      ],
    ];
    for (const [name, title, action, desc, properties, required] of definitions) {
      if (MCP_TOOLS.some((tool) => tool.name === name)) continue;
      const schema = {
        type: 'object',
        additionalProperties: false,
        properties: {
          project: { ...MCP_PROJECT_PROP, type: 'string', minLength: 1, maxLength: 128 },
          agent: { ...MCP_AGENT_PROP, minLength: 1, maxLength: 40 },
          sceneId: { type: 'string', minLength: 1, maxLength: 100 },
          revision: {
            type: 'integer',
            minimum: 0,
            description: 'Optional optimistic scene revision returned by get_scene.',
          },
          ...properties,
        },
        required: ['project', 'agent', ...required],
      };
      const validate = (args) => mod3dValidateApiArguments(schema, args);
      MCP_TOOLS.push({
          name,
          title,
          desc,
          schema,
          validate,
          annotations: {
            readOnlyHint: action === 'state',
            destructiveHint: action === 'export',
            openWorldHint: false,
          },
          run: (args) => {
            validate(args);
            return mod3dApiRun(action, args);
          },
      });
      if (action !== 'state') {
        AG_WRITE.add(name);
        AG_TRACK.add(name);
      }
      TM_TOOL_PATHS[name] = () => ({});
    }
    TM_TOOL_PATHS.modeler_export = (args) => {
      const project = mcpProj(args);
      const path = mod3dModelerExportPath(args.path);
      const link = args.overwrite ? mod3dReadSourceLink(project, path) : null;
      return {
        w: [
          path,
          args.includeSource === false ? null : link ? link.path : mod3dModelerSourcePath(path),
          MOD3D_PROJECT_METADATA,
        ],
        wp: ['.modeler-backups'],
      };
    };
})();
